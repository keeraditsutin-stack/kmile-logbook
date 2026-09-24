/* Matches a training record's free-text course description to requirement
   rows in the ACTIVE matrix, by keyword overlap against each row's own
   `course` text — not a hand-maintained alias table. This is deliberately
   generic: personnel training-record course names drift from the official
   GMM/TPM wording in real, unpredictable ways (typos, renames, abbreviation
   vs spelled-out, "System" vs "Safety", old vs new course titles), so
   matching against the manuals' own live text self-adapts whenever the
   matrix is revised, instead of needing a new hand-written rule every time.

   Approach:
   1. Tokenize both the record description and each row's course name into
      weighted keywords (acronyms and single-digit phase/group numbers count
      more; common filler words are dropped).
   2. A small typo/synonym table repairs the handful of proven real-world
      spelling variants and renamed acronyms (SQMS/SCMS, SEP/ESETC, HF/CRM,
      B737-400/-800 -> CL/NG) — this is the only part that needs maintaining
      by hand, and it is short and about wording, not about which course
      maps to which requirement.
   3. Score = weighted overlap of shared tokens ÷ total weight of the row's
      tokens. A row with a single-digit phase/group number (Phase 1 vs
      Phase 2, Group 1&2 vs Group 5) only matches if that exact digit is
      present in the record — this prevents a "Phase 2" record from also
      satisfying "Phase 1", which pure overlap would otherwise allow.
   4. Every row scoring above the threshold is returned (not just the best
      single match), because one record legitimately satisfies more than
      one requirement row sometimes — e.g. a combined "Awareness and
      In-Flight" certificate, or a "Phase 1+2" course. */

const STOPWORDS = new Set([
  "and", "for", "of", "the", "a", "an", "on", "in", "to", "with", "by",
  "initial", "recurrent", "course", "program", "training", "provided",
]);

// spelling/OCR-typo fixes seen in real K-Mile records, applied before matching
const TYPO_FIX = {
  compilance: "compliance", complianace: "compliance", compliancee: "compliance",
  confuguration: "configuration", configuartion: "configuration",
  familization: "familiarization", familiarzation: "familiarization",
  differentail: "differential", differental: "differential",
  suspected: "suspect", technique: "techniques",
};

// token -> extra tokens to inject (renames / acronym drift / abbreviations
// that share no common substring with the official wording)
const SYNONYM_ADD = {
  sqms: ["scms"], sms: ["scms"], quality: ["compliance"],
  sep: ["esetc", "emergency", "checking"],
  hf: ["human", "factors"], crm: ["human", "factors"],
  moe: ["manual"], gmm: ["general", "maintenance", "manual"],
  dg: ["dangerous", "goods"],
  gse: ["ground", "support", "equipment"],
  sup: ["unapproved", "part"],
  iai: ["differential", "door"], aei: ["differential", "door"],
  bcf: ["conversion", "freighter"],
  avsec: ["aviation", "security"],
};

/** Light plural stemming (manuals/manual, factors/factor) so wording
   variants of the same word don't miss each other. Never applied to
   acronyms or numbers — stemming "SCMS"/"EWIS" would mangle them (SCMS ->
   "SCM", EWIS -> "EWI") since they happen to end in S. */
function stem(w) {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("es") && !w.endsWith("ss")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

// aircraft-type tokens that are alternatives of EACH OTHER within a single
// requirement row (e.g. "Aircraft Type Rating (B737CL / B737NG / B767-300)"
// lists three options a person could hold any one of) — collapsed to one
// slot before scoring so a record naming only one type isn't penalized for
// not mentioning the other two.
const ALT_GROUPS = [["b737cl", "b737ng", "b767"]];
function collapseAltGroups(mapIn) {
  const map = new Map(mapIn);
  ALT_GROUPS.forEach((group, gi) => {
    let maxW = 0, present = false;
    for (const g of group) { if (map.has(g)) { present = true; maxW = Math.max(maxW, map.get(g)); map.delete(g); } }
    if (present) map.set(`__altgroup${gi}`, maxW);
  });
  return map;
}

/** Tokenize text into { map: word -> weight, numeric: Set of single-digit
   mandatory tokens }. Runs the typo fixes and synonym injections, plus a
   small pass that resolves K-Mile's B737-400/-800 registration naming to
   the manuals' B737CL/B737NG naming (400 = CL, 800 = NG per the fleet). */
function tokenSetOf(text) {
  // collapse dotted acronyms ("I.A.I", "A.E.I") into one token before splitting
  const collapsed = String(text || "").replace(/\b(?:[A-Za-z]\.){1,}[A-Za-z]\.?\b/g, m => m.replace(/\./g, ""));
  const raw = collapsed.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const map = new Map(); const numeric = new Set();
  const add = (word, weight) => map.set(word, Math.max(map.get(word) || 0, weight));

  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    const isPureNumber = /^\d+$/.test(w);
    const isAcronym = !isPureNumber && w.length >= 2 && w.length <= 6 && w === w.toUpperCase() && /[A-Z]/.test(w);
    let lower = isAcronym || isPureNumber ? w.toLowerCase() : stem(w.toLowerCase());
    lower = TYPO_FIX[lower] || lower;
    if (STOPWORDS.has(lower)) continue;

    if (isPureNumber && w.length === 1) { add(lower, 5); numeric.add(lower); continue; }
    add(lower, isPureNumber ? 2 : isAcronym ? 3 : 1);

    const extra = SYNONYM_ADD[w.toLowerCase()] || SYNONYM_ADD[lower];
    if (extra) for (const e of extra) add(e, isAcronym ? 2 : 1);

    // B737-400 / B737-800 -> inject the CL/NG naming the manuals use
    if (/^b?737$/.test(lower) && raw[i + 1]) {
      const suffix = raw[i + 1];
      if (suffix === "400") add("b737cl", 3);
      if (suffix === "800") add("b737ng", 3);
    }
  }
  return { map: collapseAltGroups(map), numeric };
}

function scoreMatch(recSet, rowSet) {
  for (const n of rowSet.numeric) if (!recSet.map.has(n)) return 0; // hard: phase/group number must match exactly
  let shared = 0, total = 0, sharedWords = 0;
  for (const [w, wt] of rowSet.map) {
    total += wt;
    if (recSet.map.has(w)) { shared += wt; sharedWords++; }
  }
  if (total === 0) return 0;
  const need = rowSet.map.size <= 2 ? 1 : 2; // a short 2-token row (e.g. "SCMS — Awareness") can be decisively matched by its one distinctive word
  if (sharedWords < need) return 0;
  const weightedScore = shared / total;
  // a row like "Aviation Security (AVSEC) Awareness" is 3/4 distinctive
  // words plus one acronym that just repeats the same meaning — a record
  // that names every distinctive word but happens to skip the acronym
  // shouldn't fail purely because the acronym's weight dominated the
  // total, so distinct-word coverage is accepted as an alternate path.
  const coverage = sharedWords / rowSet.map.size;
  return Math.max(weightedScore, coverage >= 0.7 ? coverage : 0);
}

const MATCH_THRESHOLD = 0.55;

/** Returns the requirement row ids (across TPM + GMM in `matrix`) whose
   course text keyword-matches `description`, best score first. A record
   can satisfy more than one row (see module doc). */
export function matchRequirements(description, matrix) {
  const recSet = tokenSetOf(description);
  if (!recSet.map.size) return [];
  const results = [];
  for (const source of ["tpm", "gmm"]) {
    for (const row of matrix?.[source]?.rows || []) {
      const rowSet = tokenSetOf(row.course);
      const score = scoreMatch(recSet, rowSet);
      if (score >= MATCH_THRESHOLD) results.push({ id: row.id, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).map(r => r.id);
}

/** Given the active matrix, filter a list of requirement ids down to the
   ones that actually exist in it — defends manual `requirementOverride`
   picks (and any leftover ids) against drift after a matrix revision. */
export function resolveRequirementIds(ids, matrix) {
  const known = new Set([
    ...(matrix?.tpm?.rows || []).map(r => r.id),
    ...(matrix?.gmm?.rows || []).map(r => r.id),
  ]);
  return (ids || []).filter(id => known.has(id));
}
