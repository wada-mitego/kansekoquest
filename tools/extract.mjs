// 参考画像(refs/)からスプライトを切り出して public/assets/ に透過PNGとして出力する
import fs from 'node:fs';
import pkg from 'pngjs';
const { PNG } = pkg;

const load = (f) => PNG.sync.read(fs.readFileSync(f));
const save = (png, f) => fs.writeFileSync(f, PNG.sync.write(png));

function crop(src, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const si = ((y + y0) * src.width + (x + x0)) * 4;
      const di = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = src.data[si + k];
    }
  return out;
}

// 箱型フィルタ縮小(アルファ考慮)
function reduce(src, f) {
  const w = Math.floor(src.width / f), h = Math.floor(src.height / f);
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < f; j++)
        for (let i = 0; i < f; i++) {
          const si = ((y * f + j) * src.width + (x * f + i)) * 4;
          const al = src.data[si + 3];
          r += src.data[si] * al; g += src.data[si + 1] * al; b += src.data[si + 2] * al; a += al;
        }
      const di = (y * w + x) * 4;
      if (a > 0) { out.data[di] = r / a; out.data[di + 1] = g / a; out.data[di + 2] = b / a; }
      out.data[di + 3] = Math.round(a / (f * f)) > 127 ? 255 : 0;
    }
  return out;
}

const luma = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** 暗い輪郭を壁に、外周からの塗りつぶしで背景を除去 */
function cutout(img, { thr = 70, dilate = 1, fillTop = 0, keyBlue = false } = {}) {
  const { width: w, height: h, data: d } = img;
  const barrier = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) barrier[i] = luma(d, i * 4) < thr ? 1 : 0;
  let wall = barrier;
  for (let n = 0; n < dilate; n++) {
    const nb = wall.slice();
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++)
        if (wall[y * w + x]) { nb[y * w + x - 1] = nb[y * w + x + 1] = nb[(y - 1) * w + x] = nb[(y + 1) * w + x] = 1; }
    wall = nb;
  }
  const bgm = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => { const k = y * w + x; if (!wall[k] && !bgm[k]) { bgm[k] = 1; stack.push(k); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop(); const x = k % w, y = (k / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  // 壁(輪郭)のうち背景に接していないものだけ残す → 最大連結成分
  const fg = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) fg[i] = bgm[i] ? 0 : 1;
  // 背景に接する膨張分(輪郭の外側)を削る: 元の輪郭(barrier)でないのに壁になった画素で背景隣接のもの
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      if (fg[k] && !barrier[k]) {
        if (bgm[k - 1] || bgm[k + 1] || bgm[k - w] || bgm[k + w]) fg[k] = 0;
      }
    }
  // 最大連結成分
  const lab = new Int32Array(w * h); let best = 0, bestN = 0, cur = 0;
  for (let i = 0; i < w * h; i++) {
    if (!fg[i] || lab[i]) continue;
    cur++; let n = 0; const st = [i]; lab[i] = cur;
    while (st.length) {
      const k = st.pop(); n++; const x = k % w, y = (k / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (fg[nk] && !lab[nk]) { lab[nk] = cur; st.push(nk); }
      }
    }
    if (n > bestN) { bestN = n; best = cur; }
  }
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) keep[i] = lab[i] === best ? 1 : 0;
  for (let y = 0; y < Math.floor(h * fillTop); y++) {
    let a = -1, b = -1;
    for (let x = 0; x < w; x++) if (keep[y * w + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) for (let x = a; x <= b; x++) keep[y * w + x] = 1;
  }
  if (keyBlue) for (let i = 0; i < w * h; i++) { const r = d[i*4], g = d[i*4+1], b = d[i*4+2]; if (b > g + 25 && b > r + 70) keep[i] = 0; }
  const out = new PNG({ width: w, height: h });
  let minx = w, miny = h, maxx = 0, maxy = 0;
  for (let i = 0; i < w * h; i++) {
    if (keep[i]) {
      for (let k = 0; k < 3; k++) out.data[i * 4 + k] = d[i * 4 + k];
      out.data[i * 4 + 3] = 255;
      const x = i % w, y = (i / w) | 0;
      minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
    }
  }
  return crop(out, minx, miny, maxx + 1, maxy + 1);
}

const jobs = {
  fighter: [165, 525, 392, 775],
  mage: [360, 500, 615, 775],
  warrior: [590, 425, 910, 775],
  thief: [905, 510, 1120, 775],
  priest: [1135, 550, 1365, 775],
};
const bosses = {
  barbulock: [45, 295, 440, 605],
  flowdam: [1010, 325, 1405, 645],
  ductohayate: [95, 720, 475, 995],
  elborga: [970, 690, 1400, 995],
  kansecoa: [370, 325, 1070, 800],
};

const out = 'public/assets';
fs.mkdirSync(out, { recursive: true });
const FACTOR = Number(process.env.F ?? 3);
const main = load('refs/01_main_title_original.png');
const roster = load('refs/03_boss_roster.png');
const meta = {};
// 輪郭が途切れた頭巾部分を、行ごとの左右端の間で埋める
function fillSpans(raw, c) {
  // c は切り抜き後にトリムされているため、再度同じ設定で未トリムのマスクを作る
  return c;
}
// 切り抜き縁に残った背景色(空の青・草の緑)の画素を、外周から2画素分だけ除去する
function defringe(img) {
  const { width: w, height: h, data: d } = img;
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  for (let pass = 0; pass < 4; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!d[i + 3]) continue;
      if (op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1)) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2]; const l = 0.299 * r + 0.587 * g + 0.114 * b;
      const sky = b > r + 35 && b > g + 5 && l > 110; const grass = g > r + 25 && g > b + 25 && l > 90;
      if (sky || grass) kill.push(i + 3);
    }
    kill.forEach((i) => (d[i] = 0));
  }
  return img;
}
const jobOpts = { priest: { thr: 80, dilate: 3, fillTop: 0.5 } };
// 足元の草むらを消す(下部の彩度の高い緑)
function dropGround(img) {
  const { width: w, height: h, data: d } = img;
  for (let y = Math.floor(h * 0.86); y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] && (d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2] + 15)) d[i + 3] = 0;
    }
  return img;
}
for (const [k, b] of Object.entries(jobs)) {
  const raw = crop(main, ...b);
  let c = cutout(raw, jobOpts[k]);
  
  if (k !== 'mage') c = dropGround(c);
  const s = reduce(c, FACTOR);
  save(s, `${out}/job_${k}.png`); meta['job_' + k] = [s.width, s.height];
}
function despeckle(img) {
  const { width: w, height: h, data: d } = img; const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3] ? 1 : 0);
  const kill = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a(x, y) && a(x-1,y)+a(x+1,y)+a(x,y-1)+a(x,y+1) < 3) kill.push((y*w+x)*4+3);
  kill.forEach((i) => (d[i] = 0));
  return img;
}
const bossOpts = { barbulock: { keyBlue: true }, ductohayate: { keyBlue: true }, elborga: { keyBlue: true } };
for (const [k, b] of Object.entries(bosses)) {
  let c = cutout(crop(roster, ...b), { thr: 60, ...bossOpts[k] });
  if (k === 'ductohayate') c = dropGround(c);
  const s = defringe(despeckle(reduce(c, FACTOR)));
  save(s, `${out}/boss_${k}.png`); meta['boss_' + k] = [s.width, s.height];
}
console.log(meta);



// ---- タイトルロゴ(空色を外周から除去) と タイトル背景
function keySky(img) {
  const { width: w, height: h, data: d } = img;
  const sky = (i) => { const r = d[i*4], g = d[i*4+1], b = d[i*4+2]; return b > r + 45 && b > g + 5; };
  const bg = new Uint8Array(w * h); const st = [];
  const push = (x, y) => { const k = y * w + x; if (!bg[k] && sky(k)) { bg[k] = 1; st.push(k); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const k = st.pop(); const x = k % w, y = (k / w) | 0; if (x > 0) push(x-1,y); if (x < w-1) push(x+1,y); if (y > 0) push(x,y-1); if (y < h-1) push(x,y+1); }
  for (let i = 0; i < w * h; i++) if (bg[i]) d[i*4+3] = 0;
  return img;
}
function keepLargest(img) {
  const { width: w, height: h, data: d } = img; const lab = new Int32Array(w*h); let best = 0, bn = 0, cur = 0;
  for (let i = 0; i < w*h; i++) { if (!d[i*4+3] || lab[i]) continue; cur++; let n = 0; const st = [i]; lab[i] = cur; while (st.length) { const k = st.pop(); n++; const x = k % w, y = (k/w)|0; for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) { const nx = x+dx, ny = y+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue; const nk = ny*w+nx; if (d[nk*4+3] && !lab[nk]) { lab[nk] = cur; st.push(nk); } } } if (n > bn) { bn = n; best = cur; } }
  for (let i = 0; i < w*h; i++) if (lab[i] !== best) d[i*4+3] = 0;
  return img;
}
function keyAllSky(img) { const d = img.data; for (let i = 0; i < img.width*img.height; i++) { const r=d[i*4], g=d[i*4+1], b=d[i*4+2]; if (b > r + 45 && b > g + 5) d[i*4+3] = 0; } return img; }
const logo = keepLargest(despeckle(reduce(keyAllSky(crop(main, 150, 0, 1390, 445)), 2)));
save(logo, out + '/logo.png');
save(reduce(main, 2), out + '/title_bg.png');
console.log('logo', logo.width, logo.height);
