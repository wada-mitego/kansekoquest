import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, Path2D, DOMMatrix, ImageData } from '@napi-rs/canvas';
Object.assign(globalThis, { Path2D, DOMMatrix, ImageData });
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const [, , pdf, pagesArg, outDir, scale = '1.4'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const base = path.resolve('node_modules/pdfjs-dist') + path.sep;
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(pdf)), cMapUrl: base + 'cmaps' + path.sep, cMapPacked: true, standardFontDataUrl: base + 'standard_fonts' + path.sep, verbosity: 0 }).promise;
const pages = pagesArg.split(',').flatMap((s) => { const [a, b] = s.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
for (const p of pages) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: Number(scale) });
  const canvas = createCanvas(Math.floor(vp.width), Math.floor(vp.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  const f = path.join(outDir, `${path.basename(pdf, '.pdf')}_p${p}.png`);
  fs.writeFileSync(f, canvas.toBuffer('image/png'));
  console.log(f);
}
