/* Pure parser for the GMM §2.11.10.1 / TPM §2.7 training matrices. Operates
   on the same `pages` shape pdfParse.js uses (array of pages, each an array
   of { y, items:[{s,x}] } lines), so it can be unit-tested in Node without a
   browser and reuses the same extractPages() front end as training/logbook
   PDF import.

   This is a best-effort coordinate parser: rotated column headers and
   multi-line wrapped course names make pixel-perfect extraction hard, so
   every result carries per-cell and per-page confidence, and the caller
   (RequirementMatrixAdmin) MUST show a review/diff screen before applying —
   this parser never has authority to change the live matrix by itself. */
import { clean } from "./helpers.js";
import { TPM_ROLES, GMM_POSITIONS } from "./requirements.js";

const MARK_RE = /^(x[¹²³]|x|I\*|I|R\(\d+\)|o)$/;
const SKIP_ROW_RE = /^(A|B|C|D|E|F|\d+)\s+(Initial Training|Specific Technical Training|Recurrent Training.*|Remedial Training|On Job Training.*)$/i;
const TPM_HEADER_WORDS = /\b(AM|Manager|Managers|Certifying|Staff|Mechanic|Borescope|Inspector|Maintenance|Planning|Personnel|Technical|Service|CD|Safety|MCC|Receiving|MSS|Procurement|Engineering|Training)\b/;
const GMM_HEADER_WORDS = /\b(HOE|CME|LMM|MCM|MSM|PEM|TSM|MPM|ETM|MCC|LLAE|LAE|MEC|MCO|MSS|PES|Staff|TSS|MPN|ETS|TCM|CM-ENG|Admin)\b/;

function clusterX(xs, gap = 9) {
  const uniq = [...new Set(xs.map(x => +x.toFixed(1)))].sort((a, b) => a - b);
  const clusters = []; let cur = [];
  for (const x of uniq) { if (cur.length && x - cur[cur.length - 1] > gap) { clusters.push(cur); cur = []; } cur.push(x); }
  if (cur.length) clusters.push(cur);
  return clusters.map(c => c.reduce((a, b) => a + b, 0) / c.length);
}

/** Detect which document this is and its Section/Issue/Revision/Date box. */
export function detectMatrixDoc(pages) {
  for (const lines of pages) {
    const text = lines.map(l => l.items.map(i => clean(i.s)).join(" ")).join(" ");
    if (/GENERAL MAINTENANCE MANUAL/i.test(text)) {
      const issue = text.match(/Issue:\s*(\S+)/i)?.[1];
      const revision = text.match(/Revision:\s*(\S+)/i)?.[1];
      const date = text.match(/Date:\s*(\d{1,2}\s\w+\s\d{4})/i)?.[1];
      if (issue || revision) return { source: "gmm", issue, revision, dateRaw: date };
    }
    if (/CAAT PART 145 TRAINING PROGRAM|TRAINING PROGRAM\s*MANUAL/i.test(text)) {
      const issue = text.match(/Issue:\s*(\S+)/i)?.[1];
      const revision = text.match(/Revision:\s*(\S+)/i)?.[1];
      const date = text.match(/Date:\s*(\d{1,2}\s\w+\s\d{4})/i)?.[1];
      if (issue || revision) return { source: "tpm", issue, revision, dateRaw: date };
    }
  }
  return { source: null };
}

function parsePage(lines, roleOrder, headerWordRe) {
  const anchors = lines.filter(ln => ln.items.some(it => MARK_RE.test(clean(it.s))));
  if (!anchors.length) return { rows: [], warnings: [] };
  const firstAnchorY = Math.max(...anchors.map(l => l.y));
  const warnings = [];

  // column centers: prefer the repeated rotated header block (always fully
  // printed); fall back to clustering the data marks if that doesn't yield
  // the expected column count (e.g. a sparse page).
  const headerItems = [];
  for (const ln of lines) {
    if (ln.y <= firstAnchorY + 5) continue;
    for (const it of ln.items) if (headerWordRe.test(clean(it.s))) headerItems.push(it);
  }
  let centers = clusterX(headerItems.map(h => h.x), 10);
  let centerSource = "header";
  if (centers.length !== roleOrder.length) {
    const marks = [];
    for (const ln of lines) for (const it of ln.items) if (MARK_RE.test(clean(it.s))) marks.push(it);
    const dataCenters = clusterX(marks.map(m => m.x), 9);
    if (dataCenters.length === roleOrder.length) { centers = dataCenters; centerSource = "data"; }
    else warnings.push(`Expected ${roleOrder.length} columns, detected ${centers.length} from headers / ${dataCenters.length} from data — this page's cells need verification.`);
  }
  const pageConfidence = centers.length === roleOrder.length ? (centerSource === "header" ? "high" : "medium") : "low";
  const nearestCol = (x) => { let bi = 0, bd = Infinity; centers.forEach((c, i) => { const d = Math.abs(c - x); if (d < bd) { bd = d; bi = i; } }); return { idx: bi, dist: bd }; };

  const anchorYs = new Set(anchors.map(a => a.y));
  const marginX = (centers.length ? Math.min(...centers) : 999) - 35;
  const textLines = lines.filter(ln => !anchorYs.has(ln.y) && ln.y <= firstAnchorY + 5);
  const rowText = new Map();
  for (const t of textLines) {
    const txt = clean(t.items.filter(it => it.x < marginX).map(i => i.s).join(" "));
    if (!txt) continue;
    if (/^page \d+/i.test(txt) || /K-Mile Air/i.test(txt) || /Document Number/i.test(txt)) continue;
    if (/^(GENERAL MAINTENANCE|ORGANIZATION|CAAT PART|TRAINING PROGRAM|Section:|Page:|Issue:|Revision:|Date:|Note:)/i.test(txt)) continue;
    if (SKIP_ROW_RE.test(txt)) continue;
    let best = null, bd = Infinity;
    for (const a of anchors) { const d = Math.abs(a.y - t.y); if (d < bd) { bd = d; best = a; } }
    if (!best || bd > 16) continue;
    if (!rowText.has(best.y)) rowText.set(best.y, { before: [], after: [] });
    rowText.get(best.y)[t.y > best.y ? "before" : "after"].push({ y: t.y, txt });
  }

  const rows = [];
  for (const a of anchors) {
    const label = clean(a.items.filter(it => it.x < marginX).map(it => it.s).join(" "));
    const idM = label.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
    const rowNo = idM ? idM[1] : "";
    let course = idM ? idM[2] : label;
    const extra = rowText.get(a.y) || { before: [], after: [] };
    extra.before.sort((x, y) => y.y - x.y); extra.after.sort((x, y) => y.y - x.y);
    course = clean(`${extra.before.map(e => e.txt).join(" ")} ${course} ${extra.after.map(e => e.txt).join(" ")}`);
    if (!course) continue;
    const cells = {};
    for (const m of a.items.filter(it => MARK_RE.test(clean(it.s)))) {
      const { idx, dist } = nearestCol(m.x);
      const role = roleOrder[idx];
      if (!role) continue;
      const cellConf = dist <= 6 ? "high" : dist <= 10 ? "medium" : "low";
      cells[role.k] = { value: clean(m.s), confidence: pageConfidence === "low" ? "low" : cellConf };
    }
    if (Object.keys(cells).length) rows.push({ rowNo, course, cells, pageConfidence });
  }
  return { rows, warnings };
}

/** Parse every page of a GMM or TPM matrix PDF's already-extracted `pages`. */
export function parseMatrixPages(pages, source) {
  const roleOrder = source === "tpm" ? TPM_ROLES : GMM_POSITIONS;
  const headerWordRe = source === "tpm" ? TPM_HEADER_WORDS : GMM_HEADER_WORDS;
  const allRows = []; const warnings = [];
  pages.forEach((lines, i) => {
    const { rows, warnings: w } = parsePage(lines, roleOrder, headerWordRe);
    rows.forEach(r => allRows.push({ page: i + 1, ...r }));
    w.forEach(msg => warnings.push(`Page ${i + 1}: ${msg}`));
  });
  if (!allRows.length) throw new Error(`No matrix rows were found. Expected the ${source === "tpm" ? "TPM §2.7" : "GMM §2.11.10.1"} training matrix layout.`);
  return { rows: allRows, warnings };
}

/** GMM §2.11.9.3 A — "Training Course | Interval" prose table (not a grid,
   so this is a much more reliable read than the position matrix). Returns
   { courseText: years|null } (null = "Refer to ERPM"/non-numeric). */
export function parseGmmIntervalTable(pages) {
  const out = [];
  for (const lines of pages) {
    for (const ln of lines) {
      const txt = clean(ln.items.map(i => i.s).join(" "));
      const m = txt.match(/^(.+?)\s+(\d+)\s*Years?$/i) || txt.match(/^(.+?)\s+Refer to ERPM$/i);
      if (m) out.push({ course: clean(m[1]), years: m[2] ? +m[2] : null });
    }
  }
  return out;
}
