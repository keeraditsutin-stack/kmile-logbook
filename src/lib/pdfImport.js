import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseTrainingPages, parseLogbookPages } from "./pdfParse.js";
import { normType } from "./excelImport.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/* Extract positioned text lines from every page of a PDF. */
export async function extractPages(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items
      .map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5] }))
      .filter(i => i.s.trim());
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const lines = [];
    for (const it of items) {
      const ln = lines.find(l => Math.abs(l.y - it.y) < 3);
      if (ln) ln.items.push(it); else lines.push({ y: it.y, items: [it] });
    }
    lines.forEach(l => l.items.sort((a, b) => a.x - b.x));
    pages.push(lines);
  }
  try { doc.destroy(); } catch { /* noop */ }
  return pages;
}

export async function parseTrainingPdf(arrayBuffer) {
  return parseTrainingPages(await extractPages(arrayBuffer));
}

export async function parseLogbookPdf(arrayBuffer) {
  return parseLogbookPages(await extractPages(arrayBuffer), normType);
}
