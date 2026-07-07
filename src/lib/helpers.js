export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const parseJSON = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };
export const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const addYears = (iso, n) => { const d = new Date(iso); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10); };
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const clampPct = (n) => Math.max(0, Math.min(100, n));

export const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
export const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Parse "17-Sep-15", "17 Sep 2015", "09/02/2026", Date, or Excel serial into ISO yyyy-mm-dd. */
export function toISO(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d) ? "" : d.toISOString().slice(0, 10); }
  const s = clean(v);
  let m = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{2,4})$/);
  if (m) { const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; if (mo != null) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(mo + 1).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`; } }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`; }
  const d = new Date(s);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDMY = (iso) => { const d = new Date(iso); return isNaN(d) ? String(iso) : `${d.getDate()}-${M3[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`; };
