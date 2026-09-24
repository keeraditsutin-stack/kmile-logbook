import * as XLSX from "xlsx";
import { extractPages } from "./pdfImport.js";
import { parseMatrixPages, parseGmmIntervalTable, detectMatrixDoc } from "./requirementParse.js";
import { TPM_ROLES, GMM_POSITIONS, roleLabel } from "./requirements.js";
import { clean, toISO } from "./helpers.js";

export async function sha256Hex(arrayBuffer) {
  const buf = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------------------------------------------------------------- */
/* PDF import: detects GMM vs TPM, parses the matrix grid + (for GMM) the
   recurrent-interval prose table, and folds them into { rows, warnings }.
   Returns a partial matrix source object the caller merges into a full
   { tpm, gmm } matrix before diffing/applying. */
export async function parseRequirementPdf(arrayBuffer) {
  const sha256 = await sha256Hex(arrayBuffer);
  const pages = await extractPages(arrayBuffer);
  const doc = detectMatrixDoc(pages);
  if (!doc.source) throw new Error("This doesn't look like a GMM or TPM training-requirement page. Expected the GMM §2.11.9–2.11.10 pages or the TPM §2.7 training matrix page.");
  const { rows: rawRows, warnings } = parseMatrixPages(pages, doc.source);

  // collapse per-page rows keyed by rowNo+course into unique requirement
  // rows, merging cells (a row can't span pages in these manuals, so this
  // just normalises the shape)
  const rows = rawRows.map(r => ({
    rowNo: r.rowNo, course: r.course, cells: r.cells,
    confidence: r.pageConfidence, page: r.page,
  }));

  let intervals = null;
  if (doc.source === "gmm") {
    intervals = parseGmmIntervalTable(pages);
  }

  return {
    source: doc.source, issue: doc.issue || "", revision: doc.revision || "",
    dateRaw: doc.dateRaw || "", date: toISO(doc.dateRaw) || "",
    rows, intervals, warnings, sha256,
  };
}

/* ---------------------------------------------------------------------- */
/* Excel round-trip. One sheet per source (TPM, GMM), one row per
   requirement, one column per role — cell value is "I", "R(2)", "x1"
   (footnote 1 = reliability), etc, or blank. A Meta sheet carries the
   issue/revision/date/docRef for each source. This is the deterministic
   fallback the admin can always use instead of the PDF parser. */
const FOOTNOTE_CODE = { reliability: "x2", fdrcvr: "x3", safetymgr: "*" };
const FOOTNOTE_FROM_CODE = { x2: "reliability", x3: "fdrcvr", "*": "safetymgr" };

function cellToText(cell) {
  if (!cell) return "";
  let s = cell.type === "I" ? "I" : `R(${cell.years})`;
  if (cell.footnote) s += FOOTNOTE_CODE[cell.footnote] ? ` [${FOOTNOTE_CODE[cell.footnote]}]` : "";
  return s;
}
function textToCell(s) {
  const t = clean(s);
  if (!t) return null;
  const fnMatch = t.match(/\[(x2|x3|\*)\]/);
  const footnote = fnMatch ? FOOTNOTE_FROM_CODE[fnMatch[1]] : undefined;
  const base = t.replace(/\[.*?\]/, "").trim();
  if (/^I\*?$/i.test(base)) return { type: "I", ...(footnote ? { footnote } : {}) };
  const m = base.match(/^R\((\d+)\)$/i);
  if (m) return { type: "R", years: +m[1], ...(footnote ? { footnote } : {}) };
  return null;
}

export function exportMatrixXlsx(matrix) {
  const wb = XLSX.utils.book_new();
  for (const source of ["tpm", "gmm"]) {
    const m = matrix[source]; if (!m) continue;
    const roleList = source === "tpm" ? TPM_ROLES : GMM_POSITIONS;
    const head = ["Requirement ID", "Course", "Note", ...roleList.map(r => r.label)];
    const rows = [head];
    for (const r of m.rows) {
      rows.push([r.id, r.course, r.note || "", ...roleList.map(role => cellToText(r.cells[role.k]))]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, source.toUpperCase());
  }
  const metaRows = [["Source", "Doc Ref", "Issue", "Revision", "Date"]];
  for (const source of ["tpm", "gmm"]) {
    const m = matrix[source]; if (!m) continue;
    metaRows.push([source.toUpperCase(), m.docRef, m.issue, m.revision, m.date]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), "Meta");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function parseMatrixXlsx(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const meta = {};
  const metaSheet = wb.Sheets["Meta"];
  if (metaSheet) {
    const rows = XLSX.utils.sheet_to_json(metaSheet, { header: 1, raw: true, defval: "" });
    rows.slice(1).forEach(r => {
      const source = clean(r[0]).toLowerCase();
      if (source === "tpm" || source === "gmm") meta[source] = { docRef: clean(r[1]), issue: clean(r[2]), revision: clean(r[3]), date: toISO(r[4]) || clean(r[4]) };
    });
  }
  const out = {};
  for (const source of ["tpm", "gmm"]) {
    const sheetName = wb.SheetNames.find(n => n.toLowerCase() === source);
    if (!sheetName) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: "" });
    const head = rows[0] || [];
    const roleList = source === "tpm" ? TPM_ROLES : GMM_POSITIONS;
    const roleCols = roleList.map(role => head.findIndex(h => clean(h) === role.label));
    const parsedRows = [];
    for (const r of rows.slice(1)) {
      if (!r || !clean(r[1])) continue;
      const cells = {};
      roleList.forEach((role, i) => {
        const col = roleCols[i]; if (col < 0) return;
        const c = textToCell(r[col]); if (c) cells[role.k] = c;
      });
      parsedRows.push({ id: clean(r[0]) || null, course: clean(r[1]), note: clean(r[2]) || undefined, cells });
    }
    out[source] = { ...meta[source], rows: parsedRows };
  }
  if (!out.tpm && !out.gmm) throw new Error("No TPM or GMM sheet found. Expected sheets named \"TPM\" and/or \"GMM\" (use \"Download current matrix as Excel\" to get the right template).");
  return out;
}

/* ---------------------------------------------------------------------- */
/* Diff a candidate source-matrix (from PDF or Excel import) against the
   active one, row by row and cell by cell, for the mandatory review screen. */
export function diffMatrixSource(source, activeRows, candidateRows) {
  const roleList = source === "tpm" ? TPM_ROLES : GMM_POSITIONS;
  const byId = new Map(activeRows.map(r => [r.id, r]));
  const matched = new Set();
  const changes = [];
  for (const cand of candidateRows) {
    // match by id if the import carried one (Excel round-trip), else by
    // fuzzy course-name containment against the active set
    let active = cand.id ? byId.get(cand.id) : null;
    if (!active) {
      active = activeRows.find(a => !matched.has(a.id) &&
        (a.course.toLowerCase().includes(cand.course.toLowerCase().slice(0, 15)) ||
          cand.course.toLowerCase().includes(a.course.toLowerCase().slice(0, 15))));
    }
    if (active) matched.add(active.id);
    const cellChanges = [];
    for (const role of roleList) {
      const oldC = active?.cells?.[role.k];
      const newC = cand.cells?.[role.k];
      const oldTxt = oldC ? cellToText(oldC) : "";
      const newTxt = newC ? cellToText(newC) : "";
      if (oldTxt !== newTxt) cellChanges.push({ role: role.k, roleLabel: role.label, from: oldTxt || "—", to: newTxt || "—" });
    }
    if (!active) changes.push({ kind: "added", course: cand.course, id: cand.id, cellChanges, lowConfidence: hasLowConfidence(cand) });
    else if (cellChanges.length) changes.push({ kind: "changed", id: active.id, course: cand.course, cellChanges, lowConfidence: hasLowConfidence(cand) });
  }
  const removed = activeRows.filter(a => !matched.has(a.id)).map(a => ({ kind: "removed", id: a.id, course: a.course, cellChanges: [] }));
  return [...changes, ...removed];
}

function hasLowConfidence(row) {
  return Object.values(row.cells || {}).some(c => c?.confidence === "low");
}
