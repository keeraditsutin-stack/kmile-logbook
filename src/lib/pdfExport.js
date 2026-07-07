import { jsPDF } from "jspdf";
import autoTableImport from "jspdf-autotable";
import { todayISO, fmtDMY } from "./helpers.js";

// jspdf-autotable's default export is the function in browser ESM but is
// wrapped as { default } under some Node/CJS interop — normalise either way.
const autoTable = typeof autoTableImport === "function" ? autoTableImport : autoTableImport.default;
import { DEFAULT_FORM_TEMPLATE } from "./constants.js";
import { mergeTemplate } from "./formTemplate.js";

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

  const TOP = 96, BOTTOM = 132;
  const chk = { halign: "center", cellWidth: 15 };
  autoTable(doc, {
    head, body, startY: TOP, margin: { top: TOP, left: 24, right: 24, bottom: BOTTOM },
    styles: { fontSize: 6.2, cellPadding: 2, overflow: "linebreak", valign: "middle", lineColor: [120, 130, 145], lineWidth: 0.5 },
    headStyles: { fillColor: [15, 42, 84], textColor: 255, fontSize: 5.6, halign: "center", valign: "middle", lineColor: [120, 130, 145], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 42 }, 1: { cellWidth: 26 }, 2: { cellWidth: 34 }, 3: { cellWidth: 40 }, 4: { cellWidth: 34 }, 5: { cellWidth: 30 },
      6: chk, 7: chk, 8: chk, 9: chk, 10: chk, 11: chk, 12: chk, 13: chk, 14: chk, 15: chk, 16: chk,
      17: { cellWidth: 22, halign: "center" }, 18: { cellWidth: 168 }, 19: { cellWidth: 22, halign: "center" }, 20: { cellWidth: 58 }, 21: { cellWidth: 30, halign: "center" },
    },
    didDrawPage: () => {
      // ---- header: centered title + identity row (matches the K-Mile form) ----
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(15, 42, 84);
      doc.text(tpl.title, W / 2, 30, { align: "center" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 30, 45);
      const y = 52;
      const cells = [
        ["Name - Surname: ", profile.name || ""],
        ["Staff ID. ", profile.staffId || ""],
        ["License No. ", profile.license || profile.amelNo || ""],
        ["Authorization No. ", profile.authNo || ""],
      ];
      const colX = [24, W * 0.40, W * 0.60, W * 0.78];
      cells.forEach(([label, val], i) => {
        doc.setFont("helvetica", "bold"); doc.text(label, colX[i], y);
        const lw = doc.getTextWidth(label);
        doc.setFont("helvetica", "normal"); doc.text(String(val), colX[i] + lw, y);
      });
      doc.setDrawColor(15, 42, 84); doc.setLineWidth(1); doc.line(24, 62, W - 24, 62);
    },
  });

  // ---- footer on every page: * Remark legend (two columns) ----
  const pages = doc.internal.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  const legend = tpl.legend;
  const half = Math.ceil(legend.length / 2);
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(15, 42, 84); doc.setLineWidth(0.6); doc.line(24, H - BOTTOM + 42, W - 24, H - BOTTOM + 42);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(40, 50, 65);
    doc.text("* Remark", 24, H - BOTTOM + 56);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.6); doc.setTextColor(70, 80, 95);
    const colA = legend.slice(0, half), colB = legend.slice(half);
    colA.forEach((l, i) => doc.text(l, 40, H - BOTTOM + 68 + i * 11));
    colB.forEach((l, i) => doc.text(l, 220, H - BOTTOM + 68 + i * 11));
    doc.setFontSize(7); doc.setTextColor(90, 100, 115);
    doc.text(`Page ${p} / ${pages}`, W - 24, H - 16, { align: "right" });
  }

  // ---- last page: declaration + signature + date ----
  doc.setPage(pages);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(20, 30, 45);
  doc.text(tpl.declaration, W / 2 + 40, H - BOTTOM + 60, { align: "left" });
  const sigX = W - 300;
  if (profile.signature) { try { doc.addImage(profile.signature, "PNG", sigX + 40, H - 74, 120, 36); } catch { /* skip bad image */ } }
  doc.setDrawColor(120); doc.setLineWidth(0.5);
  doc.line(sigX + 30, H - 38, sigX + 180, H - 38);
  doc.line(W - 150, H - 38, W - 24, H - 38);
  doc.setFontSize(8); doc.setTextColor(40, 50, 65);
  doc.text(tpl.signatureCaption, sigX + 40, H - 26);
  doc.text(`${tpl.dateCaption}: ${exportedOn}`, W - 150, H - 26);

  const fname = `AMEL_Logbook_${(profile.name || "staff").replace(/\s+/g, "_")}_${todayISO()}.pdf`;
  doc.save(fname);
  return recs.length;
}
