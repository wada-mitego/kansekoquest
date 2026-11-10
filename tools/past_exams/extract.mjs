import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const src = process.argv[2];
const out = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const base = path.resolve('node_modules/pdfjs-dist') + path.sep;
for (const f of fs.readdirSync(src).filter((x) => /^R\d_1kan_01_.*\.pdf$/.test(x))) {
  const data = new Uint8Array(fs.readFileSync(path.join(src, f)));
  const doc = await getDocument({ data, cMapUrl: base + 'cmaps' + path.sep, cMapPacked: true, standardFontDataUrl: base + 'standard_fonts' + path.sep, useSystemFonts: false, verbosity: 0 }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // 行ごとにまとめる（y座標でグループ化）
    const rows = new Map();
    for (const it of tc.items) {
      const y = Math.round(it.transform[5] / 3);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(it);
    }
    text += `\n=== page ${p} ===\n`;
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => {
      items.sort((a, b) => a.transform[4] - b.transform[4]);
      text += items.map((i) => i.str).join(' ') + '\n';
    });
  }
  fs.writeFileSync(path.join(out, f.replace('.pdf', '.txt')), text, 'utf8');
  console.log(f, doc.numPages, 'pages', text.length, 'chars');
}
