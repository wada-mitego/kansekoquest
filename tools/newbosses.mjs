// 新ボス5体のドット絵を生成する（既存ボスと同じ太い黒輪郭・粗いドット・彩度に合わせる）
import fs from 'node:fs';
import pkg from 'pngjs';
const { PNG } = pkg;

const W = 64, H = 56, UP = 2;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function canvas() {
  const px = new Array(W * H).fill(null);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = hex(c); };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const ellipse = (cx, cy, rx, ry, c) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, c); };
  const circle = (cx, cy, r, c) => ellipse(cx, cy, r, r, c);
  const poly = (pts, c) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) set(x, y, c);
      }
  };
  const line = (x0, y0, x1, y1, c, t = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      for (let dy = 0; dy < t; dy++) for (let dx = 0; dx < t; dx++) set(x + dx - (t - 1) / 2, y + dy - (t - 1) / 2, c);
    }
  };
  return { px, set, rect, ellipse, circle, poly, line };
}

const lighten = (c, k) => c.map((v) => Math.min(255, Math.round(v + (255 - v) * k)));
const darken = (c, k) => c.map((v) => Math.round(v * (1 - k)));

function finish(cv, file) {
  const { px } = cv;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : px[y * W + x]);
  // 縁の陰影: 左上が空なら明るく、右下が空なら暗く
  const shaded = px.map((c, i) => {
    if (!c) return null;
    const x = i % W, y = (i / W) | 0;
    if (!at(x - 1, y - 1) || !at(x, y - 1) || !at(x - 1, y)) return lighten(c, 0.28);
    if (!at(x + 1, y + 1) || !at(x, y + 1) || !at(x + 1, y)) return darken(c, 0.25);
    return c;
  });
  // 黒の太輪郭(1px) — 拡大後は2px
  const out = new Array(W * H).fill(null);
  const K = hex('#14122b');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (shaded[i]) out[i] = shaded[i];
      else {
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && shaded[yy * W + xx]; });
        if (n) out[i] = K;
      }
    }
  const png = new PNG({ width: W * UP, height: H * UP });
  for (let y = 0; y < H * UP; y++)
    for (let x = 0; x < W * UP; x++) {
      const c = out[((y / UP) | 0) * W + ((x / UP) | 0)];
      const o = (y * W * UP + x) * 4;
      if (c) { png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255; }
    }
  fs.writeFileSync(file, PNG.sync.write(png));
}

const STEEL = '#aab4c4', STEEL_D = '#6f7b92', GOLD = '#f2c230', RED = '#e0382f', WHITE = '#ffffff', BLACK = '#14122b';
const out = 'public/assets';

// ---- ドレンスライム
{
  const c = canvas();
  c.ellipse(32, 50, 26, 5, '#23917f');
  c.ellipse(32, 33, 24, 18, '#3fc9b0');
  c.poly([[32, 5], [23, 20], [41, 20]], '#3fc9b0');
  c.ellipse(32, 21, 11, 6, '#3fc9b0');
  c.ellipse(21, 25, 5, 3, '#a6f7e6');
  // 内側の配管とバルブ
  c.rect(18, 40, 46, 44, STEEL);
  c.rect(18, 40, 46, 40, '#dfe6ee');
  c.rect(30, 36, 34, 40, STEEL);
  c.circle(32, 35, 4, RED);
  c.circle(32, 35, 2, '#23917f');
  c.line(28, 35, 36, 35, RED, 1);
  // 目と口
  c.ellipse(24, 28, 4, 5, WHITE);
  c.ellipse(40, 28, 4, 5, WHITE);
  c.circle(25, 29, 2, BLACK);
  c.circle(39, 29, 2, BLACK);
  c.line(27, 33, 30, 35, BLACK, 1);
  c.line(37, 33, 34, 35, BLACK, 1);
  c.circle(8, 24, 2, '#3fc9b0');
  c.circle(57, 28, 2, '#3fc9b0');
  c.rect(54, 36, 55, 38, '#3fc9b0');
  finish(c, `${out}/boss_drainslime.png`);
}

// ---- ポンプトロル
{
  const c = canvas();
  c.rect(20, 42, 29, 54, STEEL_D);
  c.rect(35, 42, 44, 54, STEEL_D);
  c.rect(18, 22, 46, 44, STEEL);
  c.rect(18, 32, 46, 34, GOLD);
  c.circle(24, 27, 1, GOLD); c.circle(40, 27, 1, GOLD); c.circle(24, 39, 1, GOLD); c.circle(40, 39, 1, GOLD);
  // 頭
  c.ellipse(32, 15, 9, 8, STEEL_D);
  c.rect(27, 13, 29, 15, '#ffe14d'); c.rect(35, 13, 37, 15, '#ffe14d');
  c.rect(28, 19, 36, 20, BLACK);
  c.poly([[27, 20], [29, 20], [28, 24]], WHITE);
  c.poly([[35, 20], [37, 20], [36, 24]], WHITE);
  c.poly([[24, 9], [27, 12], [22, 12]], STEEL);
  c.poly([[40, 9], [37, 12], [42, 12]], STEEL);
  // 巨大ポンプの腕
  for (const [x0, x1] of [[3, 17], [47, 61]]) {
    const mx = (x0 + x1) / 2;
    c.rect(x0, 18, x1, 40, STEEL);
    c.rect(x0, 22, x1, 23, GOLD); c.rect(x0, 34, x1, 35, GOLD);
    c.rect(mx - 3, 7, mx + 3, 18, STEEL_D);
    c.rect(x0 - 1, 4, x1 + 1, 7, RED);
    c.ellipse(mx, 46, 8, 6, STEEL_D);
    c.rect(mx - 6, 41, mx + 6, 44, STEEL_D);
  }
  c.rect(16, 20, 20, 28, STEEL_D); c.rect(44, 20, 48, 28, STEEL_D);
  finish(c, `${out}/boss_pumptroll.png`);
}

// ---- スチームドラゴ
{
  const c = canvas();
  const wing = (sgn) => {
    const X = (x) => (sgn < 0 ? 64 - x : x);
    c.poly([[X(3), 18], [X(20), 26], [X(16), 44], [X(8), 36]], '#8a3a3a');
    c.line(X(4), 19, X(18), 40, STEEL, 1);
  };
  wing(1); wing(-1);
  c.poly([[40, 46], [60, 50], [54, 54], [38, 52]], '#d8432b');
  c.circle(58, 52, 2, GOLD);
  c.ellipse(32, 37, 17, 14, '#d8432b');
  c.ellipse(32, 42, 9, 8, '#f2d9a0');
  c.rect(24, 40, 40, 40, '#d8a96a'); c.rect(24, 45, 40, 45, '#d8a96a');
  c.circle(32, 38, 4, RED); c.circle(32, 38, 2, '#7a1f1a');
  c.line(28, 38, 36, 38, GOLD, 1); c.line(32, 34, 32, 42, GOLD, 1);
  c.ellipse(32, 21, 10, 8, '#d8432b');
  c.rect(26, 24, 38, 29, '#d8432b');
  c.rect(28, 26, 29, 27, BLACK); c.rect(35, 26, 36, 27, BLACK);
  c.rect(26, 17, 29, 20, '#ffe14d'); c.rect(35, 17, 38, 20, '#ffe14d');
  c.rect(28, 18, 28, 19, BLACK); c.rect(36, 18, 36, 19, BLACK);
  // えんとつの角
  c.rect(22, 8, 27, 15, STEEL); c.rect(21, 6, 28, 8, STEEL_D);
  c.rect(37, 8, 42, 15, STEEL); c.rect(36, 6, 43, 8, STEEL_D);
  c.circle(24, 3, 3, WHITE); c.circle(28, 2, 2, '#dfe6ee'); c.circle(40, 3, 3, WHITE); c.circle(36, 2, 2, '#dfe6ee');
  // 配管
  c.rect(14, 34, 17, 50, STEEL); c.rect(47, 34, 50, 50, STEEL);
  c.rect(13, 40, 18, 41, GOLD); c.rect(46, 40, 51, 41, GOLD);
  finish(c, `${out}/boss_steamdrago.png`);
}

// ---- アツリョーガ
{
  const c = canvas();
  c.rect(22, 42, 30, 54, '#566079');
  c.rect(34, 42, 42, 54, '#566079');
  c.rect(16, 16, 48, 44, '#8a94a8');
  // 高圧配管の巻き付け
  for (const y of [18, 28, 38]) { c.line(16, y, 48, y + 8, STEEL, 3); c.line(16, y + 1, 48, y + 9, '#e8eef5', 1); }
  for (const t of [0.2, 0.5, 0.8]) c.rect(16 + 32 * t - 1, 20 + 24 * t - 3, 16 + 32 * t + 1, 20 + 24 * t + 3, GOLD);
  // 圧力計
  c.circle(32, 30, 8, GOLD);
  c.circle(32, 30, 6, WHITE);
  c.line(32, 30, 37, 25, RED, 1);
  c.rect(28, 26, 28, 26, BLACK); c.rect(36, 26, 36, 26, BLACK); c.rect(32, 24, 32, 24, BLACK);
  c.circle(32, 30, 1, BLACK);
  // 頭
  c.ellipse(32, 10, 9, 7, '#c98a6b');
  c.rect(26, 9, 30, 10, RED); c.rect(34, 9, 38, 10, RED);
  c.rect(28, 14, 36, 15, BLACK);
  c.rect(29, 14, 30, 15, WHITE); c.rect(34, 14, 35, 15, WHITE);
  c.rect(23, 4, 41, 5, '#566079');
  // 腕
  for (const [x0, x1] of [[4, 15], [49, 60]]) {
    c.rect(x0, 18, x1, 42, '#8a94a8');
    c.line(x0, 24, x1, 30, STEEL, 3); c.line(x0, 34, x1, 40, STEEL, 3);
    c.rect(x0, 29, x1, 30, GOLD);
    c.ellipse((x0 + x1) / 2, 46, 8, 7, '#566079');
    c.rect(x0 - 1, 12, x1 + 1, 18, STEEL);
  }
  finish(c, `${out}/boss_atsuryoga.png`);
}

// ---- セイギョノス
{
  const c = canvas();
  const DARK = '#4a3f6a';
  c.rect(14, 22, 50, 52, DARK);
  c.rect(16, 24, 48, 50, '#5d5185');
  c.rect(31, 24, 32, 50, DARK);
  // 太い配線の腕
  c.line(14, 28, 6, 34, RED, 2); c.line(6, 34, 8, 44, RED, 2); c.line(8, 44, 5, 51, RED, 2);
  c.line(50, 28, 58, 34, '#3d86ff', 2); c.line(58, 34, 56, 44, '#3d86ff', 2); c.line(56, 44, 59, 51, '#3d86ff', 2);
  c.rect(2, 50, 8, 54, STEEL); c.rect(56, 50, 62, 54, STEEL);
  c.rect(3, 54, 3, 55, STEEL); c.rect(6, 54, 6, 55, STEEL); c.rect(57, 54, 57, 55, STEEL); c.rect(60, 54, 60, 55, STEEL);
  // メーターとランプ
  for (const x of [23, 41]) {
    c.circle(x, 33, 6, STEEL);
    c.circle(x, 33, 4, WHITE);
    c.line(x, 33, x + 2, 30, RED, 1);
  }
  const leds = ['#e0382f', '#3ddc6a', '#ffe14d', '#e0382f', '#3ddc6a', '#ffe14d'];
  leds.forEach((col, i) => c.rect(20 + i * 5, 43, 22 + i * 5, 45, col));
  c.rect(20, 47, 44, 48, '#2a2440');
  // モニタ頭
  c.rect(15, 5, 49, 21, '#2a2440');
  c.rect(17, 7, 47, 19, '#103a52');
  c.rect(17, 7, 47, 7, '#5be0ff');
  c.rect(22, 10, 28, 15, RED); c.rect(36, 10, 42, 15, RED);
  c.rect(24, 12, 26, 13, '#ffe14d'); c.rect(38, 12, 40, 13, '#ffe14d');
  c.line(25, 18, 28, 16, RED, 1); c.line(28, 16, 31, 18, RED, 1); c.line(31, 18, 34, 16, RED, 1); c.line(34, 16, 37, 18, RED, 1);
  // アンテナと王冠
  c.line(20, 5, 15, 0, STEEL, 1); c.line(44, 5, 49, 0, STEEL, 1);
  c.circle(15, 1, 1, RED); c.circle(49, 1, 1, RED);
  c.rect(28, 2, 36, 4, GOLD); c.rect(28, 0, 29, 2, GOLD); c.rect(31, 0, 32, 2, GOLD); c.rect(35, 0, 36, 2, GOLD);
  finish(c, `${out}/boss_seigyonosu.png`);
}
console.log('new bosses written');
