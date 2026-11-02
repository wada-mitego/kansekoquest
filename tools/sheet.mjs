import fs from 'node:fs';
import pkg from 'pngjs';
const { PNG } = pkg;
const files = process.argv.slice(3);
const scale = Number(process.argv[2]);
const imgs = files.map((f) => PNG.sync.read(fs.readFileSync(f)));
const W = imgs.reduce((a, i) => a + i.width * scale + 10, 10);
const H = Math.max(...imgs.map((i) => i.height * scale)) + 20;
const out = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) { out.data[i * 4] = 200; out.data[i * 4 + 1] = 40; out.data[i * 4 + 2] = 200; out.data[i * 4 + 3] = 255; }
let ox = 10;
for (const im of imgs) {
  for (let y = 0; y < im.height * scale; y++)
    for (let x = 0; x < im.width * scale; x++) {
      const si = (((y / scale) | 0) * im.width + ((x / scale) | 0)) * 4;
      if (im.data[si + 3] < 128) continue;
      const di = ((y + 10) * W + ox + x) * 4;
      for (let k = 0; k < 3; k++) out.data[di + k] = im.data[si + k];
    }
  ox += im.width * scale + 10;
}
fs.writeFileSync('refs/_sheet.png', PNG.sync.write(out));
