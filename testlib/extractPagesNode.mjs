// Test-only helper: extracts the same { y, items:[{s,x}] } "pages" shape
// that src/lib/pdfImport.js produces in the browser, but runs directly in
// Node (via pdfjs-dist's legacy build) so the pure parsers in src/lib can be
// exercised against the real sample PDFs without a browser.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";

export async function extractPagesFromFile(path) {
  const data = new Uint8Array(fs.readFileSync(path));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
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
