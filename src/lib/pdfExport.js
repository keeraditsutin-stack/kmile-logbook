import { jsPDF } from "jspdf";
import autoTableImport from "jspdf-autotable";
import { todayISO, fmtDMY } from "./helpers.js";

// jspdf-autotable's default export is the function in browser ESM but is
// wrapped as { default } under some Node/CJS interop — normalise either way.
const autoTable = typeof autoTableImport === "function" ? autoTableImport : autoTableImport.default;
import { DEFAULT_FORM_TEMPLATE } from "./constants.js";
import { mergeTemplate } from "./formTemplate.js";
import { KMILE_LOGO, KMILE_LOGO_RATIO } from "./logo.js";

const CHK = "√";
// compact grid labels for the narrow check columns (group headers still match)
const TASK_ORDER = ["FOT", "SGH", "RI", "TS", "OPC", "REP", "INSP"];
const ACT_ORDER = ["TRAINING", "PERFORM", "SUPERVISE", "CRS"];
const ACT_SHORT = { TRAINING: "TRN", PERFORM: "PRF", SUPERVISE: "SUP", CRS: "CRS" };

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
      { content: C.remark, rowSpan: 2 },
    ],
    [
      ...TASK_ORDER.map(k => ({ content: tpl.taskCols[k] || k })),
      ...ACT_ORDER.map(k => ({ content: ACT_SHORT[k] || k })),
    ],
  ];
  const body = recs.map((r, idx) => ([
    fmtDMY(r.date), r.location || "", r.acType || "", r.acReg || "", r.rating || "", r.privilege === "-" ? "" : (r.privilege || ""),
    r.tasks?.FOT ? CHK : "", r.tasks?.SGH ? CHK : "", r.tasks?.RI ? CHK : "", r.tasks?.TS ? CHK : "", r.tasks?.OPC ? CHK : "", r.tasks?.REP ? CHK : "", r.tasks?.INSP ? CHK : "",
    r.activity?.TRAINING ? CHK : "", r.activity?.PERFORM ? CHK : "", r.activity?.SUPERVISE ? CHK : "", r.activity?.CRS ? CHK : "",
    r.ata || "", r.details || "", r.duration || "", r.ref || "", r.remark || String(idx + 1),
  ]));

  // black & white, Arial-equivalent (Helvetica), no bold anywhere
  const INK = [0, 0, 0];
  const TOP = 92, BOTTOM = 150;
  const chk = { halign: "center", cellWidth: 15 };
  autoTable(doc, {
    head, body, startY: TOP, margin: { top: TOP, left: 22, right: 22, bottom: BOTTOM },
    // no table fill colours; thin black grid only
    styles: { font: "helvetica", fontStyle: "normal", fontSize: 6.4, cellPadding: 2, overflow: "linebreak", valign: "middle", textColor: INK, lineColor: INK, lineWidth: 0.4, fillColor: false },
    headStyles: { font: "helvetica", fontStyle: "normal", fontSize: 6, halign: "center", valign: "middle", textColor: INK, fillColor: false, lineColor: INK, lineWidth: 0.4 },
    bodyStyles: { fillColor: false },
    columnStyles: {
      0: { cellWidth: 44 }, 1: { cellWidth: 30 }, 2: { cellWidth: 38 }, 3: { cellWidth: 44 }, 4: { cellWidth: 38 }, 5: { cellWidth: 34 },
      6: chk, 7: chk, 8: chk, 9: chk, 10: chk, 11: chk, 12: chk, 13: chk, 14: chk, 15: chk, 16: chk,
      17: { cellWidth: 24, halign: "center" }, 18: { cellWidth: "auto" }, 19: { cellWidth: 26, halign: "center" }, 20: { cellWidth: 70 }, 21: { cellWidth: 34, halign: "center" },
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

    // declaration (left, below legend) — kept clear of the signature on the right
    doc.setFontSize(8); doc.text(tpl.declaration, 22, H - 40);

    // signature block (right side, cannot overlap the declaration on the left)
    const sigRight = W - 22, sigLeftX = W - 250;
    if (profile.signature) { try { doc.addImage(profile.signature, "PNG", sigLeftX + 6, H - 74, 110, 28); } catch { /* skip bad image */ } }
    doc.setDrawColor(...INK); doc.setLineWidth(0.5);
    doc.line(sigLeftX, H - 44, sigLeftX + 140, H - 44);           // signature line
    doc.line(sigLeftX + 152, H - 44, sigRight, H - 44);           // date line
    doc.setFontSize(8);
    doc.text(tpl.signatureCaption, sigLeftX, H - 34);
    doc.text(`${tpl.dateCaption}: ${exportedOn}`, sigLeftX + 152, H - 34);

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
