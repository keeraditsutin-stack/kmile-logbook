import { jsPDF } from "jspdf";
import autoTableImport from "jspdf-autotable";
import { todayISO, fmtDMY } from "./helpers.js";

// jspdf-autotable's default export is the function in browser ESM but is
// wrapped as { default } under some Node/CJS interop — normalise either way.
const autoTable = typeof autoTableImport === "function" ? autoTableImport : autoTableImport.default;
import { DEFAULT_FORM_TEMPLATE } from "./constants.js";
import { mergeTemplate } from "./formTemplate.js";
import { KMILE_LOGO, KMILE_LOGO_RATIO } from "./logo.js";

// compact grid labels for the narrow check columns (group headers still match)
const TASK_ORDER = ["FOT", "SGH", "RI", "TS", "OPC", "REP", "INSP"];
const ACT_ORDER = ["TRAINING", "PERFORM", "SUPERVISE", "CRS"];
const ACT_SHORT = { TRAINING: "TRN", PERFORM: "PRF", SUPERVISE: "SUP", CRS: "CRS" };
const FIRST_CHK_COL = 6, LAST_CHK_COL = 16; // 7 task + 4 activity columns

// draw a crisp vector tick (✓) centred in a cell — reliable in any PDF font
function drawTick(doc, cell) {
  const cx = cell.x + cell.width / 2, cy = cell.y + cell.height / 2;
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.8); doc.setLineCap("round");
  doc.line(cx - 2.4, cy + 0.4, cx - 0.6, cy + 2.4);   // short down-stroke
  doc.line(cx - 0.6, cy + 2.4, cx + 3.0, cy - 2.4);   // long up-stroke
  doc.setLineCap("butt");
}

export async function exportLogbookPdf(records, profile, formTemplate) {
  const tpl = mergeTemplate(formTemplate || DEFAULT_FORM_TEMPLATE);
  const C = tpl.columns;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const exportedOn = fmtDMY(todayISO());
  const recs = [...records].sort((a, b) => a.date.localeCompare(b.date));

  const twoLine = (s) => String(s).replace(/\s*\(/, "\n(").replace(/ OR /, " OR\n");
  const head = [
    [
      { content: C.date, rowSpan: 2 }, { content: C.location, rowSpan: 2 },
      { content: twoLine(C.acType), rowSpan: 2 }, { content: twoLine(C.acReg), rowSpan: 2 },
      { content: twoLine(C.rating), rowSpan: 2 }, { content: twoLine(C.privilege), rowSpan: 2 },
      { content: C.taskType, colSpan: 7 }, { content: C.activity, colSpan: 4 },
      { content: C.ata, rowSpan: 2 }, { content: C.details, rowSpan: 2 },
      { content: twoLine(C.duration), rowSpan: 2 }, { content: twoLine(C.ref), rowSpan: 2 },
      { content: twoLine(C.supervision), rowSpan: 2 }, { content: C.remark, rowSpan: 2 },
    ],
    [
      ...TASK_ORDER.map(k => ({ content: tpl.taskCols[k] || k })),
      ...ACT_ORDER.map(k => ({ content: ACT_SHORT[k] || k })),
    ],
  ];
  // ticks are drawn as vectors in didDrawCell; check cells stay empty in the body
  const checkMatrix = recs.map(r => [
    r.tasks?.FOT, r.tasks?.SGH, r.tasks?.RI, r.tasks?.TS, r.tasks?.OPC, r.tasks?.REP, r.tasks?.INSP,
    r.activity?.TRAINING, r.activity?.PERFORM, r.activity?.SUPERVISE, r.activity?.CRS,
  ].map(Boolean));
  const body = recs.map((r, idx) => ([
    fmtDMY(r.date), r.location || "", r.acType || "", r.acReg || "", r.rating || "", r.privilege === "-" ? "" : (r.privilege || ""),
    "", "", "", "", "", "", "", "", "", "", "",
    r.ata || "", r.details || "", r.duration || "", r.ref || "", r.supervisedBy || "", r.remark || String(idx + 1),
  ]));

  // black & white, Arial-equivalent (Helvetica), no bold anywhere
  const INK = [0, 0, 0];
  const TOP = 92, BOTTOM = 162;
  const chk = { cellWidth: 15 };
  // all other columns are fixed; TASK DETAILS takes the remaining width so the
  // table exactly fills the page (date+loc+actype+reg+rating+priv = 214,
  // 11 checks = 165, ata+dur+ref+sup+remark = 214 → 593 total)
  const DETAILS_W = (W - 44) - 593;
  autoTable(doc, {
    head, body, startY: TOP, margin: { top: TOP, left: 22, right: 22, bottom: BOTTOM },
    // fit the table to the page; text columns auto-size to their content
    tableWidth: W - 44,
    // no table fill colours; thin black grid only; all text centred (middle)
    styles: { font: "helvetica", fontStyle: "normal", fontSize: 6.2, cellPadding: 2, overflow: "linebreak", halign: "center", valign: "middle", textColor: INK, lineColor: INK, lineWidth: 0.4, fillColor: false },
    headStyles: { font: "helvetica", fontStyle: "normal", fontSize: 6, halign: "center", valign: "middle", textColor: INK, fillColor: false, lineColor: INK, lineWidth: 0.4 },
    bodyStyles: { fillColor: false },
    columnStyles: {
      0: { cellWidth: 42 }, 1: { cellWidth: 28 }, 2: { cellWidth: 38 }, 3: { cellWidth: 44 }, 4: { cellWidth: 34 }, 5: { cellWidth: 28 },
      6: chk, 7: chk, 8: chk, 9: chk, 10: chk, 11: chk, 12: chk, 13: chk, 14: chk, 15: chk, 16: chk,
      // TASK DETAILS (the row subject) is a fixed width and shrink-to-fit onto one line
      17: { cellWidth: 22 }, 18: { cellWidth: DETAILS_W }, 19: { cellWidth: 24 }, 20: { cellWidth: 66 }, 21: { cellWidth: 66 }, 22: { cellWidth: 36 },
    },
    // keep the row subject (TASK DETAILS) on a single line by shrinking its
    // font just enough to fit the fixed column width — never wraps
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 18) {
        const txt = String(data.cell.raw || "");
        if (!txt) return;
        const avail = DETAILS_W - 4; // minus L/R padding (2 + 2)
        let fs = 6.2;
        doc.setFont("helvetica", "normal"); doc.setFontSize(fs);
        while (fs > 3.6 && doc.getTextWidth(txt) > avail) { fs -= 0.2; doc.setFontSize(fs); }
        data.cell.styles.fontSize = fs;
      }
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index >= FIRST_CHK_COL && data.column.index <= LAST_CHK_COL) {
        if (checkMatrix[data.row.index]?.[data.column.index - FIRST_CHK_COL]) drawTick(doc, data.cell);
      }
    },
    didDrawPage: () => {
      // ---- header: K-Mile logo (top-left) + centered title + identity row ----
      const logoW = 130, logoH = logoW / KMILE_LOGO_RATIO;
      try { doc.addImage(KMILE_LOGO, "PNG", 22, 18, logoW, logoH); } catch { /* logo optional */ }
      doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
      doc.setFontSize(13); doc.text(tpl.title, W / 2, 32, { align: "center" });
      doc.setFontSize(9);
      const y = 56;
      const cells = [
        ["Name - Surname: ", profile.name || ""],
        ["Staff ID. ", profile.staffId || ""],
        ["License No. ", profile.license || profile.amelNo || ""],
        ["Authorization No. ", profile.authNo || ""],
      ];
      const colX = [22, W * 0.40, W * 0.60, W * 0.78];
      cells.forEach(([label, val], i) => {
        doc.text(label + String(val), colX[i], y);
      });
      doc.setDrawColor(...INK); doc.setLineWidth(0.6); doc.line(22, 66, W - 22, 66);
    },
  });

  // ---- footer on EVERY page: legend + declaration + signature + company band ----
  const pages = doc.internal.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  const legend = tpl.legend;
  const half = Math.ceil(legend.length / 2);
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
    // separator between table and footer
    doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.line(22, H - BOTTOM + 20, W - 22, H - BOTTOM + 20);

    // legend (left, two columns)
    doc.setFontSize(7); doc.text("* Remark", 22, H - BOTTOM + 34);
    doc.setFontSize(6.6);
    const colA = legend.slice(0, half), colB = legend.slice(half);
    colA.forEach((l, i) => doc.text(l, 38, H - BOTTOM + 46 + i * 10));
    colB.forEach((l, i) => doc.text(l, 210, H - BOTTOM + 46 + i * 10));

    // declaration + signature stacked on the right: statement on TOP, then the
    // signature well below it so the signature can never cover the statement
    const sigRight = W - 22, sigLeftX = W - 250;
    const blockMid = (sigLeftX + sigRight) / 2;
    doc.setFontSize(8);
    doc.text(tpl.declaration, blockMid, H - 78, { align: "center" });   // statement (top)
    if (profile.signature) { try { doc.addImage(profile.signature, "PNG", sigLeftX + 6, H - 66, 110, 24); } catch { /* skip bad image */ } }
    doc.setDrawColor(...INK); doc.setLineWidth(0.5);
    doc.line(sigLeftX, H - 40, sigLeftX + 140, H - 40);           // signature line
    doc.line(sigLeftX + 152, H - 40, sigRight, H - 40);           // date line
    doc.setFontSize(8);
    doc.text(tpl.signatureCaption, sigLeftX, H - 30);
    doc.text(`${tpl.dateCaption}: ${exportedOn}`, sigLeftX + 152, H - 30);

    // bottom band: company (left) + page (center) + form no. (right)
    doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.line(22, H - 22, W - 22, H - 22);
    doc.setFontSize(7.5); doc.text(tpl.companyFooter, 22, H - 11);
    doc.text(`Form No. ${tpl.formNo}`, W - 22, H - 11, { align: "right" });
    doc.setFontSize(6.5); doc.text(`Page ${p} / ${pages}`, W / 2, H - 11, { align: "center" });
  }

  const fname = `AMEL_Logbook_${(profile.name || "staff").replace(/\s+/g, "_")}_${todayISO()}.pdf`;
  doc.save(fname);
  return recs.length;
}
