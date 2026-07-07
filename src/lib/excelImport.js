import * as XLSX from "xlsx";
import { AIRCRAFT_TYPES } from "./constants.js";
import { uid, clean, toISO } from "./helpers.js";

const CHECKS = ["√", "✓", "x", "v", "j", "y", "yes", "true", "1", "•", "●", "*"];
export const isTrue = (v) => v === true || v === 1 || CHECKS.includes(clean(v).toLowerCase());
export const normType = (t) => { const c = clean(t).toUpperCase().replace(/\s/g, ""); const map = { B734: "B737-400", B738: "B737-800", B737: "B737-800", B763: "B767-300", B767: "B767-300" }; if (map[c]) return map[c]; const orig = clean(t); return AIRCRAFT_TYPES.includes(orig) ? orig : (orig || "Other"); };

function detectColumns(head, sub) {
  const H = (head || []).map(c => clean(c).toUpperCase());
  const S = (sub || []).map(c => clean(c).toUpperCase());
  const find = (arr, pred) => arr.findIndex(pred);
  const col = {};
  col.date = find(H, v => v === "DATE");
  col.loc = find(H, v => v === "LOCATION");
  col.acType = find(H, v => v.includes("A/C OR COMP") || (v.includes("A/C") && v.includes("TYPE")));
  col.acReg = find(H, v => v.includes("REG"));
  col.rating = find(H, v => v.includes("MAINT"));
  col.priv = find(H, v => v.includes("PRIVILEGE"));
  col.ata = find(H, v => v === "ATA");
  col.details = find(H, v => v.includes("DETAILS"));
  col.duration = find(H, v => v.includes("DURATION"));
  col.ref = find(H, v => v.includes("REFERENCE"));
  col.supervisedBy = find(H, v => v.includes("SUPERVISION"));
  col.remark = find(H, v => v === "REMARK");
  const eq = t => (v => v === t);
  col.FOT = find(S, eq("FOT")); col.SGH = find(S, eq("SGH"));
  col.RI = find(S, v => v === "R/I" || v === "RI"); col.TS = find(S, v => v === "T/S" || v === "TS");
  col.OPC = find(S, eq("OPC")); col.REP = find(S, eq("REP")); col.INSP = find(S, eq("INSP"));
  col.TRAINING = find(S, eq("TRAINING")); col.PERFORM = find(S, eq("PERFORM"));
  col.SUPERVISE = find(S, eq("SUPERVISE")); col.CRS = find(S, eq("CRS"));
  return col;
}
const at = (r, i) => (i >= 0 ? r[i] : null);

function parseSheet(rows) {
  const h = rows.findIndex(r => r && clean(r[0]).toUpperCase() === "DATE");
  if (h < 0) return { records: [], meta: {} };
  const sub = rows[h + 1] || [];
  const hasSub = sub.some(c => ["FOT", "SGH", "PERFORM"].includes(clean(c).toUpperCase()));
  const col = detectColumns(rows[h], hasSub ? sub : []);
  const dataStart = hasSub ? h + 2 : h + 1;

  const meta = {};
  rows.slice(0, h).forEach(r => (r || []).forEach((c, i) => {
    const t = clean(c).replace(/[:.]$/, "");
    const nextVals = r.slice(i + 1).map(clean).filter(Boolean);
    if (/^Name/i.test(t) && !meta.name) meta.name = clean(r[i + 1]) || nextVals[0];
    if (/Staff ID/i.test(t) && !meta.staffId) meta.staffId = nextVals[0];
    if (/Position/i.test(t) && !meta.position) meta.position = nextVals[0];
    if (/License No/i.test(t) && !meta.license) meta.license = nextVals[0];
    if (/Experience Period/i.test(t)) {
      const ds = []; for (let j = i + 1; j < r.length && ds.length < 2; j++) { const iso = toISO(r[j]); if (iso) ds.push(iso); }
      if (ds[0]) meta.periodStart = ds[0]; if (ds[1]) meta.periodEnd = ds[1];
    }
  }));

  const records = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const date = toISO(at(r, col.date));
    if (!date) continue;
    const details = clean(at(r, col.details));
    const acType = clean(at(r, col.acType));
    if (!details && !acType && !clean(at(r, col.acReg))) continue;
    const durRaw = at(r, col.duration);
    let duration = "";
    if (durRaw instanceof Date) duration = durRaw.getHours() + durRaw.getMinutes() / 60;
    else if (typeof durRaw === "number") duration = durRaw < 1 ? Math.round(durRaw * 24 * 100) / 100 : durRaw;
    else { const ds = clean(durRaw); const hm = ds.match(/^(\d{1,2}):(\d{2})/); if (hm) duration = +hm[1] + +hm[2] / 60; else if (ds && !isNaN(Number(ds))) duration = Number(ds); }
    records.push({
      id: uid(), date, location: clean(at(r, col.loc)), acType: normType(acType),
      acReg: clean(at(r, col.acReg)), rating: clean(at(r, col.rating)) || "A1", privilege: clean(at(r, col.priv)) || "-",
      tasks: { FOT: isTrue(at(r, col.FOT)), SGH: isTrue(at(r, col.SGH)), RI: isTrue(at(r, col.RI)), TS: isTrue(at(r, col.TS)), OPC: isTrue(at(r, col.OPC)), REP: isTrue(at(r, col.REP)), INSP: isTrue(at(r, col.INSP)) },
      activity: { TRAINING: isTrue(at(r, col.TRAINING)), PERFORM: isTrue(at(r, col.PERFORM)), SUPERVISE: isTrue(at(r, col.SUPERVISE)), CRS: isTrue(at(r, col.CRS)) },
      ata: clean(at(r, col.ata)), details, duration, ref: clean(at(r, col.ref)),
      supervisedBy: clean(at(r, col.supervisedBy)), remark: clean(at(r, col.remark)), category: "direct",
    });
  }
  return { records, meta };
}

export function parseLogbookXlsx(buf) {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  if (!wb.SheetNames.length) throw new Error("The workbook has no sheets.");
  let all = [], meta = {}, sheetsUsed = 0;
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
    const { records, meta: m } = parseSheet(rows);
    if (records.length) { all = all.concat(records); sheetsUsed++; }
    meta = { ...m, ...meta };
  }
  if (!all.length) throw new Error("Could not find the DATE column header in any sheet. Please use the standard K-Mile logbook template.");
  const seen = new Set(); const records = [];
  for (const r of all) { const key = r.date + "|" + r.ref + "|" + r.details.slice(0, 40); if (seen.has(key)) continue; seen.add(key); records.push(r); }
  return { records, meta, sheetsUsed };
}
