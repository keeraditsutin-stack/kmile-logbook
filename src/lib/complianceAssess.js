import { todayISO, daysBetween } from "./helpers.js";
import { CROSS_LINKS, roleLabel } from "./requirements.js";
import { matchRequirements, resolveRequirementIds } from "./requirementMatch.js";

const addDaysISO = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const addYearsISO = (iso, n) => { const d = new Date(iso); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10); };

/* due date = completion date + interval − 1 day (matches the K-Mile
   record convention, e.g. 15-Oct-25 (1yr) -> 14-Oct-26). */
export function computeDueDate(completedISO, years) {
  if (!completedISO || !years) return null;
  return addDaysISO(addYearsISO(completedISO, years), -1);
}

/* For each requirement id, find the training record with the latest
   completion ("to" date, falling back to "date") on or before the audit
   date. Records dated after the audit date never count. Also honours a
   manual `requirementOverride` array on a record (admin-confirmed match)
   in preference to the automatic alias match. */
function buildRequirementRecordIndex(trainingRecords, matrix, auditDate) {
  const byReq = new Map(); // reqId -> best record so far
  const unmapped = [];
  for (const rec of trainingRecords || []) {
    const completed = rec.dateTo && rec.dateTo >= rec.date ? rec.dateTo : rec.date;
    if (!completed || completed > auditDate) continue; // not yet completed as of the audit date
    const ids = resolveRequirementIds(
      rec.requirementOverride?.length ? rec.requirementOverride : matchRequirements(rec.course),
      matrix
    );
    if (!ids.length) { unmapped.push(rec); continue; }
    for (const id of ids) {
      const cur = byReq.get(id);
      if (!cur || completed > cur.completed) byReq.set(id, { record: rec, completed });
    }
  }
  return { byReq, unmapped };
}

function rowsForSource(matrix, source) { return matrix?.[source]?.rows || []; }

function applicableRoleKeysForRow(row, roles, conditions) {
  const hit = roles.filter(k => row.cells[k]);
  if (!hit.length) return null;
  // footnote-gated rows only apply if the matching condition flag is set
  for (const k of hit) {
    const fn = row.cells[k].footnote;
    if (fn === "reliability" && !conditions?.reliabilityProgram) continue;
    if (fn === "fdrcvr" && !conditions?.fdrCvrEvaluation) continue;
    if (fn === "safetymgr" && !conditions?.safetyManager) continue;
    return k; // first eligible role wins
  }
  return null;
}

/* Assess one person's compliance against a matrix version at an audit
   date. `person` = { tpmRoles: [...], gmmPositions: [...], authorizedTypes: [...],
   conditions: { reliabilityProgram, fdrCvrEvaluation, safetyManager } }. */
export function assessCompliance({ trainingRecords, matrix, person, auditDate, warnDays = 60 }) {
  const date = auditDate || todayISO();
  const { byReq, unmapped } = buildRequirementRecordIndex(trainingRecords, matrix, date);

  const linkedTpm = new Set(CROSS_LINKS.map(([t]) => t));
  const linkedGmm = new Set(CROSS_LINKS.map(([, g]) => g));
  const linkPairs = new Map(CROSS_LINKS); // tpmId -> gmmId

  function evalRow(source, row) {
    const roles = source === "tpm" ? (person.tpmRoles || []) : (person.gmmPositions || []);
    const roleKey = applicableRoleKeysForRow(row, roles, person.conditions);
    if (!roleKey) return null; // not required for this person
    if (row.aircraftSpecific && person.authorizedTypes?.length === 0) return null;
    const cell = row.cells[roleKey];
    const found = byReq.get(row.id);
    const completed = found?.completed || null;
    const dueDate = cell.type === "R" ? computeDueDate(completed, cell.years) : null;
    const recordedExpiry = found?.record?.expiry || "";
    const recordedDate = recordedExpiry && recordedExpiry !== "NEVER" && recordedExpiry !== "RECURRENT" ? recordedExpiry : null;
    const mismatch = !!(recordedDate && dueDate && recordedDate !== dueDate);
    const recordedNeverButRecurrent = recordedExpiry === "NEVER" && cell.type === "R";

    let status;
    if (cell.type === "I") status = completed ? "COMPLIANT" : "MISSING";
    else {
      if (!completed) status = "MISSING";
      else if (dueDate < date) status = "EXPIRED";
      else if (daysBetween(date, dueDate) <= warnDays) status = "DUE_SOON";
      else status = "COMPLIANT";
    }
    return {
      reqId: row.id, source, course: row.course, roleKey, roleLabel: roleLabel(source, roleKey),
      docRef: matrix[source].docRef, type: cell.type, years: cell.years || null,
      completed, dueDate, recordedExpiry: recordedExpiry || null, mismatch, recordedNeverButRecurrent,
      status, matchedRecordId: found?.record?.id || null, note: row.note || null,
    };
  }

  const tpmFindings = rowsForSource(matrix, "tpm").filter(r => !linkedTpm.has(r.id)).map(r => evalRow("tpm", r)).filter(Boolean);
  const gmmFindings = rowsForSource(matrix, "gmm").filter(r => !linkedGmm.has(r.id)).map(r => evalRow("gmm", r)).filter(Boolean);

  // linked pairs: evaluate both sides, govern by the earlier due date
  const linkedFindings = [];
  for (const [tpmId, gmmId] of linkPairs) {
    const tRow = rowsForSource(matrix, "tpm").find(r => r.id === tpmId);
    const gRow = rowsForSource(matrix, "gmm").find(r => r.id === gmmId);
    const t = tRow ? evalRow("tpm", tRow) : null;
    const g = gRow ? evalRow("gmm", gRow) : null;
    const sides = [t, g].filter(Boolean);
    if (!sides.length) continue;
    if (sides.length === 1) { linkedFindings.push({ ...sides[0], linked: true, sources: [sides[0].source] }); continue; }
    // both apply — governing side is whichever has the earlier due date
    // (missing counts as most urgent; expired beats due-soon beats compliant)
    const rank = { MISSING: 0, EXPIRED: 1, DUE_SOON: 2, COMPLIANT: 3 };
    const governing = sides.reduce((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] < rank[b.status] ? a : b;
      if (a.dueDate && b.dueDate) return a.dueDate <= b.dueDate ? a : b;
      return a;
    });
    linkedFindings.push({
      ...governing, linked: true, sources: sides.map(s => s.source),
      docRef: sides.map(s => `${s.source.toUpperCase()} ${s.docRef}`).join(" / "),
      otherSide: sides.find(s => s !== governing) || null,
    });
  }

  const all = [...tpmFindings, ...gmmFindings, ...linkedFindings];
  const counts = { COMPLIANT: 0, DUE_SOON: 0, EXPIRED: 0, MISSING: 0 };
  all.forEach(f => { counts[f.status] = (counts[f.status] || 0) + 1; });
  const mismatchCount = all.filter(f => f.mismatch).length;
  const overall = counts.EXPIRED > 0 || counts.MISSING > 0 ? "ACTION_REQUIRED"
    : counts.DUE_SOON > 0 ? "ACTION_REQUIRED" : "COMPLIANT";

  return {
    auditDate: date, findings: all.sort((a, b) => rankStatus(a.status) - rankStatus(b.status)),
    counts, mismatchCount, overall, unmappedRecords: unmapped,
  };
}

function rankStatus(s) { return { EXPIRED: 0, MISSING: 1, DUE_SOON: 2, COMPLIANT: 3 }[s] ?? 4; }

/* GMM §2.11.9.3 B.e — an LAE who hasn't signed a CRS for an authorized type
   within 6 months before the audit date must be re-trained/brush-up before
   signing again. Uses logbook CRS activity, not training records. */
export function brushUpCheck({ logbookRecords, authorizedTypes, auditDate }) {
  const date = auditDate || todayISO();
  const sixMoAgo = (() => { const d = new Date(date); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); })();
  const flags = [];
  for (const type of authorizedTypes || []) {
    const hasCRS = (logbookRecords || []).some(r =>
      r.activity?.CRS && r.acType === type && r.date >= sixMoAgo && r.date <= date);
    if (!hasCRS) flags.push({ acType: type, message: `No CRS activity recorded for ${type} in the 6 months before the audit date — brush-up required before next CRS.` });
  }
  return flags;
}
