import Phaser from 'phaser';
import { L } from './layout';

type Palette = Record<string, string>;

function canvasFrom(rows: string[], pal: Palette): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = pal[ch];
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}

export const ASSETS = [
  'job_fighter',
  'job_mage',
  'job_warrior',
  'job_thief',
  'job_priest',
  'boss_barbulock',
  'boss_flowdam',
  'boss_ductohayate',
  'boss_elborga',
  'boss_kansecoa',
  'boss_drainslime',
  'boss_pumptroll',
  'boss_steamdrago',
  'boss_atsuryoga',
  'boss_seigyonosu',
  'logo',
  'title_bg',
];

export function preloadAssets(scene: Phaser.Scene): void {
  ASSETS.forEach((k) => scene.load.image(k, `assets/${k}.png`));
}

// ---------------------------------------------------------------- 能力アイコン(12x12)
const K = '#14122b';
const ICONS: Record<string, { rows: string[]; pal: Palette }> = {
  ic_atk: {
    pal: { k: K, w: '#eef3fb', g: '#f6c744', b: '#b5702d', s: '#9fb0c8' },
    rows: [
      '.........kk.',
      '........kwwk',
      '.......kwwsk',
      '......kwwsk.',
      '.....kwwsk..',
      '.k..kwwsk...',
      '.kkkwwsk....',
      '..kggwk.....',
      '...kggk.....',
      '..kbgk......',
      '.kbk.kk.....',
      'kbk.........',
    ],
  },
  ic_def: {
    pal: { k: K, b: '#3d86ff', w: '#e8f2ff', d: '#2756c9' },
    rows: [
      '.kkkkkkkkkk.',
      'kbbbbwwbbbbk',
      'kbbbbwwbbbdk',
      'kbbbbwwbbbdk',
      'kbbbbwwbbbdk',
      'kbbbbwwbbbdk',
      '.kbbbwwbbdk.',
      '.kbbbwwbbdk.',
      '..kbbwwbdk..',
      '...kbwwdk...',
      '....kbdk....',
      '.....kk.....',
    ],
  },
  ic_mag: {
    pal: { k: K, p: '#a56bff', P: '#c9a4ff', W: '#ffffff' },
    rows: [
      '.....kk.....',
      '....kppk....',
      '....kppk....',
      '...kpPPpk...',
      '.kkkpPWPpkk.',
      'kppPPWWPPppk',
      'kppPPWWPPppk',
      '.kkkpPWPpkk.',
      '...kpPPpk...',
      '....kppk....',
      '....kppk....',
      '.....kk.....',
    ],
  },
  ic_mdef: {
    pal: { k: K, g: '#f6c744', y: '#ffe98a', o: '#c98a1c', w: '#fff7d6' },
    rows: [
      '.kkkkkkkkkk.',
      'kyyyyyyyyyyk',
      'kygggwwgggok',
      'kygggwwgggok',
      'kywwwwwwwwok',
      'kywwwwwwwwok',
      'kygggwwgggok',
      '.kgggwwggok.',
      '.kgggwwggok.',
      '..kggwwgok..',
      '...kgwwok...',
      '....kkkk....',
    ],
  },
  ic_spd: {
    pal: { k: K, w: '#ffffff', c: '#bfe4ff', g: '#5be0a0' },
    rows: [
      '............',
      '.........kk.',
      '......kkkwwk',
      '....kkwwwwck',
      '..kkwwwwwck.',
      '.kwwwwwwcck.',
      'kwwwwwwcck..',
      'kkwwwwcck...',
      '.kkgwwck....',
      '..kggkk.....',
      '...kk.......',
      '............',
    ],
  },
};

const FIRE_ROWS = ['....rr..', '...rrr..', '..rorrr.', '..roorr.', '.rooyorr', '.rooyyor', '.rroyyor', '..rrooor', '...rrrr.'];
const FIRE_PAL: Palette = { r: '#d83a1c', o: '#f58a1f', y: '#ffe56b' };

export function buildTextures(scene: Phaser.Scene): void {
  const tm = scene.textures;
  Object.entries(ICONS).forEach(([k, v]) => {
    if (!tm.exists(k)) tm.addCanvas(k, canvasFrom(v.rows, v.pal));
  });
  if (!tm.exists('fire')) tm.addCanvas('fire', canvasFrom(FIRE_ROWS, FIRE_PAL));
  (['ic_atk', 'ic_def', 'ic_mag', 'ic_mdef', 'ic_spd', 'fire'] as const).forEach((k) => tm.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST));
  ASSETS.forEach((k) => tm.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST));
}

// ---------------------------------------------------------------- 背景（参考画像と同じ配色のドット風景を生成）
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type BgKind = 'cliff' | 'field';

/** 向き別に低解像度で描いて、nearest で拡大する */
export function landscapeKey(scene: Phaser.Scene, kind: BgKind): string {
  const key = `bg_${kind}_${L.portrait ? 'p' : 'l'}`;
  if (scene.textures.exists(key)) return key;
  const S = 6;
  const w = Math.ceil(L.W / S);
  const h = Math.ceil(L.H / S);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const r = rng(kind === 'cliff' ? 11 : 29);
  const rect = (x: number, y: number, ww: number, hh: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
  };
  const horizon = Math.round(h * (L.portrait ? 0.52 : 0.58));
  // 空
  const sky = ['#1a3fd0', '#1f4fe0', '#2a63ee', '#3a78f6', '#4d8cff'];
  sky.forEach((col, i) => rect(0, (horizon * i) / sky.length, w, horizon / sky.length + 1, col));
  // 雲
  for (let i = 0; i < (L.portrait ? 4 : 6); i++) {
    const cx = r() * w, cy = 4 + r() * horizon * 0.45, cw = 14 + r() * 14;
    rect(cx, cy + 2, cw, 4, '#ffffff');
    rect(cx + 3, cy, cw - 8, 3, '#ffffff');
    rect(cx, cy + 5, cw, 2, '#c9dcff');
  }
  // 雪山
  const peak = (cx: number, base: number, ph: number, col: string) => {
    for (let y = 0; y < ph; y++) {
      const half = Math.round((y / ph) * (ph * 1.25));
      rect(cx - half, base - ph + y, half * 2, 1, col);
    }
  };
  for (let i = 0; i < (L.portrait ? 3 : 6); i++) {
    const cx = (i + 0.5) * (w / (L.portrait ? 3 : 6)) + (r() - 0.5) * 10;
    const ph = 14 + r() * 12;
    peak(cx, horizon + 2, ph, '#5f86d6');
    peak(cx, horizon + 2, Math.round(ph * 0.3), '#f4f8ff');
  }
  // 森
  rect(0, horizon, w, 6, '#1f7a2e');
  for (let x = 0; x < w; x += 3) {
    const th = 3 + r() * 4;
    rect(x, horizon - th + 2, 4, th, r() > 0.5 ? '#2c9a36' : '#1f7a2e');
    if (r() > 0.6) rect(x + 1, horizon - th + 2, 2, 1, '#6fd04a');
  }
  // 草地
  const grassTop = horizon + 5;
  rect(0, grassTop, w, h - grassTop, '#55c23a');
  for (let i = 0; i < w * 0.6; i++) rect(r() * w, grassTop + r() * (h - grassTop) * 0.5, 2, 1, r() > 0.5 ? '#7bdc4a' : '#3f9e2c');
  // 地面
  if (kind === 'cliff') {
    const cliffTop = Math.round(h * 0.82);
    rect(0, cliffTop - 2, w, 2, '#3f9e2c');
    rect(0, cliffTop, w, h - cliffTop, '#b8783a');
    for (let x = 0; x < w; x += 2) {
      const len = 2 + Math.floor(r() * 8);
      rect(x, cliffTop + 2, 2, len, r() > 0.5 ? '#8a5a2a' : '#d49a58');
      rect(x, cliffTop + 12, 2, 3 + Math.floor(r() * 6), '#8a5a2a');
    }
  } else {
    const groundTop = Math.round(h * (L.portrait ? 0.62 : 0.7));
    rect(0, groundTop, w, h - groundTop, '#d6a24a');
    for (let i = 0; i < w * 0.8; i++) rect(r() * w, groundTop + r() * (h - groundTop), 2, 1, r() > 0.5 ? '#b9822f' : '#e8bf68');
    rect(0, groundTop - 2, w, 2, '#3f9e2c');
  }
  const key2 = key;
  scene.textures.addCanvas(key2, c);
  scene.textures.get(key2).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key2;
}
