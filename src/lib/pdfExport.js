import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { todayISO, fmtDMY } from "./helpers.js";

const CHK = "√";

export async function exportLogbookPdf(records, profile) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const exportedOn = fmtDMY(todayISO());
  const recs = [...records].sort((a, b) => a.date.localeCompare(b.date));

  const head = [
    [
      { content: "DATE", rowSpan: 2 }, { content: "LOC", rowSpan: 2 }, { content: "A/C\nTYPE", rowSpan: 2 },
      { content: "REG /\nS/N", rowSpan: 2 }, { content: "RATING", rowSpan: 2 }, { content: "PRIV", rowSpan: 2 },
      { content: "TASK TYPE", colSpan: 7 }, { content: "TYPE OF ACTIVITY", colSpan: 4 },
      { content: "ATA", rowSpan: 2 }, { content: "TASK DETAILS", rowSpan: 2 }, { content: "HRS", rowSpan: 2 },
      { content: "MAINT. REF", rowSpan: 2 }, { content: "REMARK", rowSpan: 2 },
    ],
    ["FOT", "SGH", "R/I", "T/S", "OPC", "REP", "INSP", "TRN", "PRF", "SUP", "CRS"].map(t => ({ content: t })),
  ];
  const body = recs.map((r, idx) => ([
    fmtDMY(r.date), r.location || "", r.acType || "", r.acReg || "", r.rating || "", r.privilege === "-" ? "" : (r.privilege || ""),
    r.tasks?.FOT ? CHK : "", r.tasks?.SGH ? CHK : "", r.tasks?.RI ? CHK : "", r.tasks?.TS ? CHK : "", r.tasks?.OPC ? CHK : "", r.tasks?.REP ? CHK : "", r.tasks?.INSP ? CHK : "",
    r.activity?.TRAINING ? CHK : "", r.activity?.PERFORM ? CHK : "", r.activity?.SUPERVISE ? CHK : "", r.activity?.CRS ? CHK : "",
    r.ata || "", r.details || "", r.duration || "", r.ref || "", r.remark || String(idx + 1),
  ]));

  const chk = { halign: "center", cellWidth: 15 };
  autoTable(doc, {
    head, body, startY: 92, margin: { top: 92, left: 24, right: 24, bottom: 96 },
    styles: { fontSize: 6.2, cellPadding: 2, overflow: "linebreak", valign: "middle", lineColor: [180, 190, 205], lineWidth: 0.4 },
    headStyles: { fillColor: [15, 42, 84], textColor: 255, fontSize: 6, halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 42 }, 1: { cellWidth: 26 }, 2: { cellWidth: 34 }, 3: { cellWidth: 40 }, 4: { cellWidth: 34 }, 5: { cellWidth: 30 },
      6: chk, 7: chk, 8: chk, 9: chk, 10: chk, 11: chk, 12: chk, 13: chk, 14: chk, 15: chk, 16: chk,
      17: { cellWidth: 22, halign: "center" }, 18: { cellWidth: 168 }, 19: { cellWidth: 22, halign: "center" }, 20: { cellWidth: 58 }, 21: { cellWidth: 30, halign: "center" },
    },
    didDrawPage: () => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(15, 42, 84);
      doc.text("K-MILE ASIA", 24, 34);
      doc.setFontSize(12); doc.setTextColor(20, 30, 45);
      doc.text("Aircraft Maintenance Experience Logbook", W / 2, 30, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(60, 70, 85);
      const line = `Name - Surname: ${profile.name || ""}     Staff ID: ${profile.staffId || ""}     License No.: ${profile.license || profile.amelNo || ""}     Authorization No.: ${profile.authNo || ""}`;
      doc.text(line, 24, 52);
      doc.setDrawColor(15, 42, 84); doc.setLineWidth(0.8); doc.line(24, 60, W - 24, 60);
    },
  });

  // footer: legend + declaration + signature + export date (last page)
  const pages = doc.internal.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(5.6); doc.setTextColor(90, 100, 115); doc.setFont("helvetica", "normal");
    const legend = "FOT: Functional Operational Test   SGH: Servicing Ground Handling   R/I: Removal Installation Activation   T/S: Trouble Shooting   OPC: Operational Check   REP: Replacement   INSP: Inspection   CRS: Certificate of Release to Service";
    doc.text(legend, 24, H - 74, { maxWidth: W - 48 });
    doc.setFontSize(7); doc.setTextColor(90, 100, 115);
    doc.text(`Page ${p} / ${pages}`, W - 24, H - 20, { align: "right" });
  }
  doc.setPage(pages);
  doc.setFontSize(8); doc.setTextColor(20, 30, 45);
  doc.text("I declare that the entries in this logbook are completed and true.", 24, H - 56);
  const sigX = W - 260;
  if (profile.signature) { try { doc.addImage(profile.signature, "PNG", sigX + 90, H - 62, 110, 34); } catch { /* skip bad image */ } }
  doc.setDrawColor(120); doc.setLineWidth(0.5); doc.line(sigX + 80, H - 30, sigX + 210, H - 30);
  doc.setFontSize(8); doc.setTextColor(40, 50, 65);
  doc.text("Logbook Owner's Signature", sigX + 80, H - 20);
  doc.text(`Date: ${exportedOn}`, W - 24, H - 44, { align: "right" });

  const fname = `AMEL_Logbook_${(profile.name || "staff").replace(/\s+/g, "_")}_${todayISO()}.pdf`;
  doc.save(fname);
  return recs.length;
}
