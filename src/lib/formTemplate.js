import JSZip from "jszip";
import { DEFAULT_FORM_TEMPLATE } from "./constants.js";

/* Deep-merge an override onto the default so a partial template (only some
   labels changed) still yields a complete, usable template. */
export function mergeTemplate(override) {
  const d = DEFAULT_FORM_TEMPLATE;
  if (!override) return d;
  return {
    ...d, ...override,
    columns: { ...d.columns, ...(override.columns || {}) },
    taskCols: { ...d.taskCols, ...(override.taskCols || {}) },
    activityCols: { ...d.activityCols, ...(override.activityCols || {}) },
    legend: override.legend?.length ? override.legend : d.legend,
  };
}

/* ---- map a header cell's text to one of our fixed logbook fields ---- */
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const up = (s) => norm(s).toUpperCase();

function matchColumnField(text) {
  const t = up(text);
  if (!t) return null;
  // order matters: rating (contains MAINT) before ref; acReg before acType
  if (t.includes("DATE")) return "date";
  if (t.includes("LOCATION") || t === "LOC") return "location";
  if (t.includes("A/C") && t.includes("REG")) return "acReg";
  if (t.includes("REG") && (t.includes("S/N") || t.includes("SERIAL"))) return "acReg";
  if (t.includes("A/C") || (t.includes("COMP") && t.includes("TYPE"))) return "acType";
  if (t.includes("RATING") || t.includes("TYPE OF MAINT")) return "rating";
  if (t.includes("PRIVILEGE")) return "privilege";
  if (t.includes("TASK TYPE")) return "taskType";
  if (t.includes("TYPE OF ACTIVITY") || t === "ACTIVITY") return "activity";
  if (t === "ATA") return "ata";
  if (t.includes("DETAIL") || t.includes("DESCRIPTION") || t.includes("JOB")) return "details";
  if (t.includes("DURATION") || t.includes("HOUR") || t.includes("HRS") || t.includes("HR)") || t.includes("TIME")) return "duration";
  if (t.includes("REFERENCE") || t.includes("MAINT") || t.includes("RECORD")) return "ref";
  if (t.includes("REMARK")) return "remark";
  return null;
}
const TASK_KEYS = { "FOT": "FOT", "SGH": "SGH", "R/I": "RI", "RI": "RI", "T/S": "TS", "TS": "TS", "OPC": "OPC", "REP": "REP", "INSP": "INSP" };
const ACT_KEYS = { "TRAINING": "TRAINING", "TRN": "TRAINING", "PERFORM": "PERFORM", "PRF": "PERFORM", "SUPERVISE": "SUPERVISE", "SUP": "SUPERVISE", "CRS": "CRS" };

/* ---- read a .docx: title (first paragraph), the first table's header
   cells, and legend paragraphs (lines like "ABC: meaning") ---- */
export async function parseFormDocx(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("This is not a valid Word .docx file (missing word/document.xml).");
  const xml = await docFile.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not read the Word document XML.");

  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paraText = (p) => Array.from(p.getElementsByTagNameNS(W, "t")).map(t => t.textContent).join("").trim();

  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (!body) throw new Error("The Word document has no body content.");

  // title = first non-empty top-level paragraph before the first table
  let title = "";
  const legendLines = [];
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue;
    if (node.localName === "p") {
      const txt = paraText(node);
      if (!title && txt) title = txt;
      if (/^[A-Za-z/]{2,5}\s*:/.test(txt)) legendLines.push(norm(txt));
    }
  }

  // first table → header cells (scan the first few rows for label cells)
  const table = doc.getElementsByTagNameNS(W, "tbl")[0];
  if (!table) throw new Error("No table was found in the Word form. Expected a logbook table with column headers.");
  const rows = Array.from(table.getElementsByTagNameNS(W, "tr"));
  const columns = {}, taskCols = {}, activityCols = {};
  let matched = 0;
  for (const tr of rows.slice(0, 4)) {
    for (const tc of Array.from(tr.getElementsByTagNameNS(W, "tc"))) {
      const cellText = Array.from(tc.getElementsByTagNameNS(W, "p")).map(paraText).join(" ").trim();
      if (!cellText) continue;
      const field = matchColumnField(cellText);
      if (field) { columns[field] = norm(cellText); matched++; continue; }
      const tk = TASK_KEYS[up(cellText)]; if (tk) { taskCols[tk] = norm(cellText); matched++; continue; }
      const ak = ACT_KEYS[up(cellText)]; if (ak) { activityCols[ak] = norm(cellText); matched++; }
    }
  }
  if (matched < 4) throw new Error("Could not recognise the logbook columns in this Word form. Make sure it contains the standard header row (DATE, LOCATION, A/C TYPE, TASK TYPE, …).");

  const override = { title: title || undefined, columns, taskCols, activityCols };
  // legend: keep only recognised-looking "CODE: text" lines, else default
  const cleanLegend = legendLines.filter(l => /^[A-Za-z/]{2,5}\s*:/.test(l));
  if (cleanLegend.length >= 3) override.legend = cleanLegend;

  return { template: mergeTemplate(override), parsed: { title, columnsMatched: matched, legendLines: cleanLegend } };
}
