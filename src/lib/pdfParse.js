/* Pure PDF table parsers — operate on pre-extracted text lines so they can be
   unit-tested in Node without a browser. `pages` is an array (one per PDF page)
   of lines: { y, items: [{ s, x }] } sorted top-to-bottom, items left-to-right. */
import { uid, clean, toISO } from "./helpers.js";

const lineText = (ln) => ln.items.map(i => i.s).join(" ").replace(/\s+/g, " ").trim();

/* =========================================================================
   TRAINING RECORD PDF
   Table: From | To | Description | Reference | Expiry date | Remark,
   plus a staff header (ID / Name / Position / Email).
   Wrapped descriptions appear on their own lines above/below the dated line,
   so orphan lines are attached to the vertically nearest dated row.
   ========================================================================= */

export function inferTrainingCategory(desc) {
  const d = desc.toLowerCase();
  if (/ewis|electrical wiring/.test(d)) return "EWIS";
  if (/fuel tank|cdccl/.test(d)) return "Fuel Tank Safety";
  if (/human factor|crew resource|crm\b/.test(d)) return "Human Factors";
  if (/safety management|quality management|sqms|\bsms\b|compilance management|compliance management/.test(d)) return "SMS";
  if (/dangerous goods/.test(d)) return "Dangerous Goods";
  if (/security|first aid|ramp safety|de-icing|anti-icing|safety (and emergency|equipment|orientation)|\bsep\b/.test(d)) return "Safety / Security";
  if (/type (course|rating|training)|aircraft type|famili|differences|conversion|ground run|brush up|simulator|aircraft recurrent/.test(d)) return "Type Training";
  if (/continuation/.test(d)) return "Continuation Training";
  return "Other";
}

export function inferAircraftType(desc) {
  const d = desc.toUpperCase();
  if (/B737[- ]?(800|NG|8CF|8)/.test(d) || /B737CL TO B737NG/.test(d)) return "B737-800";
  if (/B737/.test(d)) return "B737-400";
  if (/B767/.test(d)) return "B767-300";
  return "Other";
}

export function parseTrainingPages(pages) {
  const meta = {};
  const records = [];

  for (const lines of pages) {
    // find the "From | To | Description..." header to fix column x positions
    let col = null;
    for (const ln of lines) {
      const labels = {};
      ln.items.forEach(i => { labels[clean(i.s).toLowerCase()] = i.x; });
      if (labels["from"] != null && labels["to"] != null && labels["description"] != null) {
        col = {
          from: labels["from"], to: labels["to"], desc: labels["description"],
          ref: labels["reference"] ?? 573, exp: labels["expiry date"] ?? 638, rem: labels["remark"] ?? 737,
        };
        break;
      }
    }
    if (!col) col = { from: 49, to: 140, desc: 351, ref: 573, exp: 638, rem: 737 };
    const B = { to: (col.from + col.to) / 2, desc: col.to + 40, ref: col.ref - 60, exp: col.exp - 25, rem: col.rem - 40 };
    const bucket = (x) => x < B.to ? "from" : x < B.desc ? "to" : x < B.ref ? "desc" : x < B.exp ? "ref" : x < B.rem ? "exp" : "rem";

    const rows = [];
    for (const ln of lines) {
      const txt = lineText(ln);
      if (!txt || /^page \d+ of \d+$/i.test(txt) || /^training record$/i.test(txt)) continue;
      if (/^from to description/i.test(txt.replace(/\s+/g, " "))) continue;
      // staff meta lines
      if (/(^|\s)(id|name|sex|position|email)\s*:/i.test(txt)) {
        const KEYS = "ID|Name|Sex|Position|Email|Date of Employment";
        const grab = (key) => { const m = txt.match(new RegExp(key + "\\s*:\\s*(.*?)(?=\\s+(?:" + KEYS + ")\\s*:|$)", "i")); return m ? clean(m[1]) : ""; };
        const found = { staffId: grab("ID"), name: grab("Name"), position: grab("Position"), email: grab("Email") };
        if (found.staffId && !meta.staffId) meta.staffId = found.staffId;
        if (found.name && !meta.name) meta.name = found.name;
        if (found.position && !meta.position) meta.position = found.position;
        if (found.email && !meta.email) meta.email = found.email.toLowerCase();
        if (found.staffId || found.name || found.email) continue;
      }
      const cells = { from: [], to: [], desc: [], ref: [], exp: [], rem: [] };
      ln.items.forEach(i => cells[bucket(i.x)].push(clean(i.s)));
      const row = {
        y: ln.y,
        from: toISO(cells.from.join(" ")), to: toISO(cells.to.join(" ")),
        desc: cells.desc.join(" "), ref: cells.ref.join(" "), exp: cells.exp.join(" "), rem: cells.rem.join(" "),
      };
      if (!row.from && !row.desc && !row.ref && !row.exp) continue;
      rows.push(row);
    }

    // dated rows become records; orphan rows merge into the nearest dated row
    const dated = rows.filter(r => r.from);
    const orphans = rows.filter(r => !r.from);
    for (const o of orphans) {
      let best = null, bd = Infinity;
      for (const d of dated) { const dist = Math.abs(d.y - o.y); if (dist < bd) { bd = dist; best = d; } }
      if (!best || bd > 30) continue;
      if (o.desc) best.desc = o.y > best.y ? `${o.desc} ${best.desc}`.trim() : `${best.desc} ${o.desc}`.trim();
      if (o.ref && !best.ref) best.ref = o.ref;
      if (o.exp && !best.exp) best.exp = o.exp;
      if (o.rem && !best.rem) best.rem = o.rem;
    }

    for (const d of dated) {
      const desc = clean(d.desc);
      if (!desc) continue;
      const expRaw = clean(d.exp).toUpperCase();
      const expiry = expRaw === "NEVER" ? "NEVER" : expRaw === "RECURRENT" ? "RECURRENT" : (toISO(d.exp) || "");
      records.push({
        id: uid(),
        date: d.from, dateTo: d.to || d.from,
        course: desc,
        acType: inferAircraftType(desc),
        org: "",
        category: inferTrainingCategory(desc),
        theoretical: true, practical: false,
        result: "Pass",
        ref: clean(d.ref),
        expiry,
        remark: clean(d.rem),
      });
    }
  }

  if (!records.length) throw new Error("No training rows were found. Expected the K-Mile TRAINING RECORD layout with From / To / Description / Reference / Expiry date columns.");
  records.sort((a, b) => a.date.localeCompare(b.date));
  return { records, meta };
}

/* =========================================================================
   LOGBOOK PDF (the layout exported by this app / the paper logbook)
   ========================================================================= */

const TASK_COLS = ["FOT", "SGH", "RI", "TS", "OPC", "REP", "INSP"];
const ACT_COLS = ["TRAINING", "PERFORM", "SUPERVISE", "CRS"];
/* Narrow check-mark columns wrap their 3-letter labels across two lines
   ("SGH" -> "SG" + "H"), so the leading fragments are aliases too. */
const SUB_ALIASES = {
  "FOT": "FOT", "SGH": "SGH", "SG": "SGH",
  "R/I": "RI", "RI": "RI", "T/S": "TS", "TS": "TS",
  "OPC": "OPC", "OP": "OPC", "REP": "REP", "RE": "REP",
  "INSP": "INSP", "INS": "INSP",
  "TRN": "TRAINING", "TR": "TRAINING", "TRAINING": "TRAINING",
  "PRF": "PERFORM", "PERFORM": "PERFORM",
  "SUP": "SUPERVISE", "SU": "SUPERVISE", "SUPERVISE": "SUPERVISE",
  "CRS": "CRS", "CR": "CRS",
};

export function parseLogbookPages(pages, normType) {
  const meta = {};
  const records = [];

  for (const lines of pages) {
    for (const ln of lines) {
      const txt = lineText(ln);
      const nm = txt.match(/Name\s*-\s*Surname:\s*(.*?)(?:Staff ID:|License|Authorization|$)/i);
      if (nm && clean(nm[1]) && !meta.name) meta.name = clean(nm[1]);
      const sid = txt.match(/Staff ID:\s*(\S+)/i);
      if (sid && !meta.staffId) meta.staffId = clean(sid[1]);
    }

    // anchor: the line carrying DATE + LOC; header labels straddle nearby
    // lines (rowSpan cells, wrapped sub-labels), so read the whole block.
    const anchor = lines.find(ln => {
      const T = ln.items.map(i => clean(i.s).toUpperCase());
      return T.includes("DATE") && (T.includes("LOC") || T.includes("LOCATION"));
    });
    if (!anchor) continue;
    const block = lines.filter(ln =>
      Math.abs(ln.y - anchor.y) <= 18 && !ln.items.some(i => toISO(i.s) && /\d/.test(i.s)));
    const headerYs = new Set(block.map(l => l.y));

    const main = {}, sub = {};
    for (const ln of block) {
      for (const it of ln.items) {
        const t = clean(it.s).toUpperCase();
        const sk = SUB_ALIASES[t];
        if (sk) { if (sub[sk] == null) sub[sk] = it.x; continue; }
        const set = (k) => { if (main[k] == null) main[k] = it.x; };
        if (t === "DATE") set("date");
        else if (t === "LOC" || t === "LOCATION") set("loc");
        else if (t.startsWith("A/C")) set("acType");
        else if (t.startsWith("REG")) set("reg");
        else if (t === "RATING") set("rating");
        else if (t.startsWith("PRIV")) set("priv");
        else if (t === "ATA") set("ata");
        else if (t.includes("DETAILS")) set("details");
        else if (t === "HRS" || t.includes("DURATION")) set("hrs");
        else if (t.startsWith("MAINT") || t === "REFERENCE") set("ref");
        else if (t === "REMARK") set("remark");
      }
    }
    if (main.date == null || sub.FOT == null) continue;

    const cols = [
      ...Object.entries(main).map(([k, x]) => ({ k, x })),
      ...TASK_COLS.filter(k => sub[k] != null).map(k => ({ k: "task:" + k, x: sub[k] })),
      ...ACT_COLS.filter(k => sub[k] != null).map(k => ({ k: "act:" + k, x: sub[k] })),
    ].sort((a, b) => a.x - b.x);

    const assign = (x) => {
      let best = cols[0], bd = Infinity;
      for (const c of cols) { const d = Math.abs(c.x - x); if (d < bd) { bd = d; best = c; } }
      return best.k;
    };
    // header labels are centered while data is left-aligned, so the wide
    // free-text details column is matched by range instead of by centre
    const detailsStart = main.ata != null ? main.ata + 12 : (main.details != null ? main.details - 70 : null);
    const detailsEnd = main.hrs != null ? main.hrs - 25 : Infinity;

    const rows = [];
    for (const ln of lines) {
      if (headerYs.has(ln.y)) continue;
      const txt = lineText(ln);
      if (!txt || /^page \d+/i.test(txt) || /K-MILE/i.test(txt) || /TASK TYPE|TYPE OF ACTIVITY/i.test(txt)) continue;
      if (/Name\s*-\s*Surname:/i.test(txt) || /^Date:/i.test(txt)) continue;
      if (/declare that|Logbook Owner|Functional Operational Test|Maintenance Experience Logbook/i.test(txt)) continue;
      const cell = {};
      const put = (k, s) => { cell[k] = cell[k] ? cell[k] + " " + s : s; };
      for (const it of ln.items) {
        const s = clean(it.s); if (!s) continue;
        let k;
        if (main.details != null && detailsStart != null && it.x >= detailsStart && it.x < detailsEnd) k = "details";
        else k = assign(it.x);
        put(k, s);
      }
      const row = { y: ln.y, cell };
      row.date = toISO(cell.date);
      if (!row.date && !cell.details) continue;
      rows.push(row);
    }

    const dated = rows.filter(r => r.date);
    const orphans = rows.filter(r => !r.date);
    for (const o of orphans) {
      let best = null, bd = Infinity;
      for (const d of dated) { const dist = Math.abs(d.y - o.y); if (dist < bd) { bd = dist; best = d; } }
      if (!best || bd > 26) continue;
      for (const [k, v] of Object.entries(o.cell)) {
        if (k === "date" || k === "hrs" || k.startsWith("task:") || k.startsWith("act:")) {
          if (!best.cell[k]) best.cell[k] = v;
        } else {
          // wrapped text: line above the dated row comes first, below comes last
          best.cell[k] = o.y > best.y ? `${v} ${best.cell[k] || ""}`.trim() : `${best.cell[k] || ""} ${v}`.trim();
        }
      }
    }

    for (const d of dated) {
      const c = d.cell;
      // check columns only ever hold a mark; the glyph varies with font
      // encoding (√ may extract as a quote), so any content counts
      const tasks = {}, activity = {};
      TASK_COLS.forEach(k => tasks[k] = !!clean(c["task:" + k] || ""));
      ACT_COLS.forEach(k => activity[k] = !!clean(c["act:" + k] || ""));
      const details = clean(c.details || "");
      if (!details && !c.acType && !c.reg) continue;
      let duration = "";
      const hs = clean(c.hrs || ""); const hm = hs.match(/^(\d{1,2}):(\d{2})/);
      if (hm) duration = +hm[1] + +hm[2] / 60; else if (hs && !isNaN(Number(hs))) duration = Number(hs);
      records.push({
        id: uid(), date: d.date, location: clean(c.loc || ""), acType: normType(c.acType || ""),
        acReg: clean(c.reg || ""), rating: clean(c.rating || "") || "A1", privilege: clean(c.priv || "") || "-",
        tasks, activity,
        ata: clean(c.ata || ""), details, duration, ref: clean(c.ref || ""),
        supervisedBy: "", remark: clean(c.remark || ""), category: "direct",
      });
    }
  }

  if (!records.length) throw new Error("No logbook rows were found. Expected the K-Mile logbook PDF layout (DATE / LOC / A/C TYPE header with task-type check marks).");
  const seen = new Set(); const out = [];
  for (const r of records) { const key = r.date + "|" + r.ref + "|" + r.details.slice(0, 40); if (seen.has(key)) continue; seen.add(key); out.push(r); }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { records: out, meta };
}
