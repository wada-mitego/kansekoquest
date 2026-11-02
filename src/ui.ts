import Phaser from 'phaser';
import { BgKind, landscapeKey } from './sprites';
import { L } from './layout';
import { sfx } from './sfx';

export const FONT = "'DotGothic16','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',monospace";

export const COL = {
  fill: 0x070b18,
  border: 0xffffff,
  hi: 0xffd83a,
  ok: 0x0f5a2c,
  ng: 0x6a1414,
  dim: 0x4a4f6a,
};
export const GOLD = '#ffd83a';

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size = 28,
  color = '#ffffff',
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color, ...extra });
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** 日本語対応の折り返し(文字単位で幅を測る) */
export function wrapJP(s: string, size: number, maxW: number): string {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
  measureCtx.font = `${size}px ${FONT}`;
  const noHead = '、。，．）」』】！？ー・,.)!?';
  const lines: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (measureCtx.measureText(line + ch).width > maxW && line && !noHead.includes(ch)) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** 黒い面+白い二重枠(参考画像のウィンドウ) */
export function drawWindow(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = COL.fill,
  border: number = COL.border,
): void {
  const n = 5; // 角の欠け
  g.fillStyle(0x000000, 0.4);
  g.fillRect(x + 5, y + 6, w, h);
  g.fillStyle(border, 1);
  g.fillRect(x + n, y, w - n * 2, h);
  g.fillRect(x, y + n, w, h - n * 2);
  g.fillStyle(0x000000, 1);
  g.fillRect(x + 4 + n, y + 4, w - 8 - n * 2, h - 8);
  g.fillRect(x + 4, y + 4 + n, w - 8, h - 8 - n * 2);
  g.fillStyle(fill, 1);
  g.fillRect(x + 6 + n, y + 6, w - 12 - n * 2, h - 12);
  g.fillRect(x + 6, y + 6 + n, w - 12, h - 12 - n * 2);
}

export function windowBox(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = COL.fill,
  border: number = COL.border,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawWindow(g, x, y, w, h, fill, border);
  return g;
}

export type BtnState = 'normal' | 'ok' | 'ng' | 'selected';

export interface Button {
  c: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  /** 入力の受付そのものを切り替える（非表示にするメニューなど）。当たり判定は常に枠全体 */
  setActive(v: boolean): void;
  setEnabled(v: boolean): void;
  setState(state: BtnState): void;
  setLabel(s: string): void;
}

export interface ButtonOpts {
  size?: number;
  align?: 'center' | 'left';
  enabled?: boolean;
  wrap?: boolean;
  icon?: string;
  iconScale?: number;
  accent?: number;
  cursor?: boolean;
}

/** x,y は左上。タップ・クリックできる実UI部品 */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  cb: () => void,
  opts: ButtonOpts = {},
): Button {
  const size = opts.size ?? 30;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const left = opts.align === 'left' || !!opts.icon;
  const iconW = opts.icon ? (opts.iconScale ?? 4) * 12 + 24 : 0;
  const padL = 28 + iconW + (opts.cursor ? 30 : 0);
  const t = txt(scene, left ? padL : w / 2, h / 2, label, size, '#ffffff', { align: left ? 'left' : 'center' });
  t.setOrigin(left ? 0 : 0.5, 0.5);
  if (opts.wrap) t.setText(wrapJP(label, size, w - padL - 24));
  c.add([g, t]);
  let iconImg: Phaser.GameObjects.Image | null = null;
  if (opts.icon) {
    iconImg = scene.add.image(28 + (opts.cursor ? 30 : 0), h / 2, opts.icon).setOrigin(0, 0.5).setScale(opts.iconScale ?? 4);
    c.add(iconImg);
  }
  const cur = scene.add.triangle(30, h / 2, 0, 0, 0, 24, 20, 12, COL.hi).setOrigin(0.5).setVisible(false);
  if (opts.cursor) c.add(cur);
  c.setSize(w, h);
  c.setData('label', label);

  let enabled = opts.enabled ?? true;
  let state: BtnState = 'normal';
  let pressed = false;
  let hover = false;

  const redraw = () => {
    g.clear();
    let fill: number = COL.fill;
    let border: number = COL.border;
    if (!enabled) {
      border = COL.dim;
    } else if (state === 'ok') {
      fill = COL.ok;
      border = 0x9dffb8;
    } else if (state === 'ng') {
      fill = COL.ng;
      border = 0xff9d9d;
    } else if (state === 'selected') {
      border = COL.hi;
      fill = 0x14204a;
    }
    if (enabled && hover && state !== 'ok' && state !== 'ng') {
      fill = state === 'selected' ? 0x1c2f6a : 0x182a5c;
      if (state === 'normal') border = 0xbfe0ff;
    }
    if (pressed && enabled) fill = 0x24366e;
    drawWindow(g, 0, 0, w, h, fill, border);
    if (opts.accent) {
      g.fillStyle(opts.accent, enabled ? 1 : 0.4);
      g.fillRect(10, 12, 8, h - 24);
    }
    t.setColor(!enabled ? '#6a6f90' : state === 'selected' ? GOLD : '#ffffff');
    cur.setVisible(!!opts.cursor && state === 'selected');
    iconImg?.setAlpha(enabled ? 1 : 0.4);
  };
  redraw();

  // 当たり判定は「表示している枠そのもの」(0,0)-(w,h)。Containerは当たり判定に表示原点(w/2,h/2)を足すため、
  // 同じだけ矩形をずらして、文字ではなく枠の内側全体をクリック・タップ可能にする。
  const hitRect = new Phaser.Geom.Rectangle(w / 2, h / 2, w, h);
  const activate = () => {
    c.setInteractive(hitRect, Phaser.Geom.Rectangle.Contains);
    if (c.input) c.input.cursor = enabled ? 'pointer' : 'default';
  };
  activate();
  c.on('pointerover', () => {
    hover = true;
    if (c.input) c.input.cursor = enabled ? 'pointer' : 'default';
    redraw();
  });
  c.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    redraw();
  });
  const release = () => {
    if (pressed) {
      pressed = false;
      redraw();
    }
  };
  c.on('pointerout', () => {
    hover = false;
    release();
    redraw();
  });
  c.on('pointerup', () => {
    if (!enabled || !pressed) return;
    pressed = false;
    redraw();
    sfx.select();
    cb();
  });

  return {
    c,
    label: t,
    setActive(v) {
      if (v) {
        hover = false;
        pressed = false;
        activate();
        redraw();
      } else {
        c.disableInteractive();
      }
    },
    setEnabled(v) {
      enabled = v;
      if (c.input) c.input.cursor = enabled ? 'pointer' : 'default';
      redraw();
    },
    setState(s) {
      state = s;
      redraw();
    },
    setLabel(s) {
      t.setText(opts.wrap ? wrapJP(s, size, w - padL - 24) : s);
      c.setData('label', s);
    },
  };
}

/** ドット風景を画面いっぱいに敷く */
export function bg(scene: Phaser.Scene, kind: BgKind): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, landscapeKey(scene, kind)).setOrigin(0).setDisplaySize(L.W, L.H);
}

export function go(scene: Phaser.Scene, key: string, data?: object): void {
  const cam = scene.cameras.main;
  cam.fadeOut(200, 0, 0, 0);
  cam.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(200, 0, 0, 0);
}

export const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((res) => scene.time.delayedCall(ms, res));

export function tweenP(scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((res) => {
    scene.tweens.add({ ...cfg, onComplete: () => res() });
  });
}

export function bar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): { set(ratio: number, animate?: boolean): void; g: Phaser.GameObjects.Graphics } {
  const g = scene.add.graphics();
  const state = { shown: 1 };
  const draw = () => {
    g.clear();
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle(0x3a3a4e, 1);
    g.fillRect(x, y, w, h);
    const r = Math.max(0, Math.min(1, state.shown));
    let col = color;
    if (color === 0x3ddc6a) col = r > 0.5 ? 0x3ddc6a : r > 0.2 ? 0xf2c230 : 0xe04848;
    g.fillStyle(col, 1);
    g.fillRect(x, y, Math.round(w * r), h);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(x, y, Math.round(w * r), Math.max(2, Math.floor(h / 4)));
  };
  draw();
  return {
    g,
    set(ratio: number, animate = true) {
      if (!animate) {
        state.shown = ratio;
        draw();
        return;
      }
      scene.tweens.add({ targets: state, shown: ratio, duration: 500, ease: 'Sine.easeOut', onUpdate: draw });
    },
  };
}

export function floatText(scene: Phaser.Scene, x: number, y: number, s: string, color: string, size = 56): void {
  const t = txt(scene, x, y, s, size, color, { stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5).setDepth(100);
  scene.tweens.add({ targets: t, y: y - 60, duration: 220, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 300, onComplete: () => t.destroy() });
}

/** 金縁のリボン風見出し（職業選択・ボス一覧で使用） */
export function ribbon(scene: Phaser.Scene, cx: number, y: number, w: number, h: number, label: string, size: number): void {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRect(cx - w / 2 + 5, y + 6, w, h);
  g.fillStyle(0x8a1d1d, 1);
  g.fillRect(cx - w / 2, y, w, h);
  g.lineStyle(5, 0xf6c744, 1);
  g.strokeRect(cx - w / 2 + 3, y + 3, w - 6, h - 6);
  txt(scene, cx, y + h / 2, label, size, '#fff3d0', { stroke: '#3a0a0a', strokeThickness: 4 }).setOrigin(0.5);
}
