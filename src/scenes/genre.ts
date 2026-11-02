import Phaser from 'phaser';
import { GENRES, STAT_CSS, STAT_COLORS, STAT_NAMES } from '../data';
import { L } from '../layout';
import { bgm } from '../bgm';
import { getSave, nextBoss, questionsToBoss, roundInfo } from '../state';
import { Button, GOLD, bg, button, fadeIn, go, txt, windowBox, wrapJP } from '../ui';
import { ICON, jobName } from './common';

export class GenreScene extends Phaser.Scene {
  private sel = 0;
  private cleared: { genre: string; round: number } | null = null;
  constructor() {
    super('Genre');
  }
  init(data: { cleared?: { genre: string; round: number } }) {
    this.cleared = data?.cleared ?? null;
  }

  create() {
    bgm.play('genre');
    fadeIn(this);
    bg(this, 'cliff');
    const P = L.portrait;
    const s = getSave();
    const nb = nextBoss(s);

    windowBox(this, 24, 18, L.W - 48, P ? 96 : 76);
    txt(this, L.W / 2, P ? 66 : 56, P ? '学習ジャンルを えらぼう' : '学習ジャンルを えらんでください', P ? 40 : 38).setOrigin(0.5);

    const sy = P ? 128 : 106;
    const shh = P ? 100 : 74;
    windowBox(this, 24, sy, L.W - 48, shh);
    const face = this.add.image(54, sy + shh / 2, 'job_' + s.job).setOrigin(0, 0.5);
    face.setScale(Math.min((shh - 20) / face.height, 1));
    txt(this, 120, sy + (P ? 14 : 20), jobName(s.job), P ? 28 : 30, '#ffffff');
    const rest = questionsToBoss(s);
    txt(this, P ? 120 : 330, sy + (P ? 54 : 22), nb ? (rest > 0 ? `ボスまで あと ${rest}問` : 'ボスせん かいほうずみ！') : '本編ボス ぜんげきは！', P ? 28 : 28, GOLD);
    if (!P) txt(this, 690, sy + 24, '周回内で はじめて正解 → 能力 +1', 22, '#bfe4ff');
    button(this, L.W - 24 - (P ? 150 : 170) - 12, sy + 10, P ? 150 : 170, shh - 20, 'もどる', () => go(this, 'Home'), { size: 26 });

    const cy0 = sy + shh + 14;
    const ch = P ? 160 : 92;
    const gap = P ? 12 : 10;
    const btns: Button[] = [];
    GENRES.forEach((g, i) => {
      const y = cy0 + i * (ch + gap);
      const cur = s.stats[g.stat];
      const ri = roundInfo(s, g.id);
      const pg = s.perGenre[g.id];
      const acc = pg.answered ? Math.round((pg.correct / pg.answered) * 100) : 0;
      const col = STAT_CSS[g.stat];
      const b = button(this, 24, y, L.W - 48, ch, '', () => go(this, 'Quiz', { genre: g.id }), { accent: STAT_COLORS[g.stat], cursor: false, enabled: ri.prepared });
      b.c.setData('label', g.name);
      btns.push(b);
      const c = b.c;
      const addT = (x: number, yy: number, str: string, size: number, color: string, ox = 0) => {
        const t = txt(this, x, yy, str, size, color).setOrigin(ox, 0);
        c.add(t);
        return t;
      };
      c.add(this.add.image(50, ch / 2, ICON[g.stat]).setOrigin(0, 0.5).setScale(5));
      const nameX = 130;
      const roundTxt = ri.prepared ? `${ri.round}周目　正解 ${ri.correct}/${ri.total}問　（収録 ${ri.total}問）` : '問題準備中';
      const gain = ri.prepared ? `${cur} → ${cur + 1}` : `${cur}`;
      if (P) {
        addT(nameX, 14, wrapJP(g.name, 30, 310), 30, '#ffffff');
        addT(nameX, ch - 78, g.sub, 20, '#c9d4f0');
        addT(nameX, ch - 54, roundTxt, 19, '#ffe98a');
        addT(nameX, ch - 28, `正答率 ${acc}%（${pg.correct}/${pg.answered}）`, 19, '#9fb0d8');
        const dx = 470;
        c.add(this.add.rectangle(dx - 14, ch / 2, 2, ch - 40, 0x5a6285));
        addT(dx, 22, STAT_NAMES[g.stat], 28, '#ffffff');
        addT(dx + 220, 24, ri.prepared ? '+1' : '', 24, col, 1);
        addT(dx, 66, gain, 38, '#ffe98a');
        addT(dx, 118, ri.prepared ? '正解すると アップ！' : '', 22, col);
      } else {
        addT(nameX, 8, g.name, 32, '#ffffff');
        addT(nameX, 48, g.sub, 19, '#c9d4f0');
        addT(nameX, 70, `${roundTxt}　正答率 ${acc}%（${pg.correct}/${pg.answered}）`, 17, '#ffe98a');
        c.add(this.add.rectangle(850, ch / 2, 2, ch - 24, 0x5a6285));
        addT(878, 8, `${STAT_NAMES[g.stat]}　${gain}`, 32, '#ffe98a');
        addT(878, 54, ri.prepared ? '正解すると アップ！ +1' : '', 22, col);
      }
    });

    const setSel = (i: number) => {
      this.sel = i;
      btns.forEach((b, k) => b.setState(k === i ? 'selected' : 'normal'));
    };
    setSel(0);
    this.input.keyboard?.on('keydown-UP', () => setSel((this.sel + 4) % 5));
    this.input.keyboard?.on('keydown-DOWN', () => setSel((this.sel + 1) % 5));
    this.input.keyboard?.on('keydown-ENTER', () => go(this, 'Quiz', { genre: GENRES[this.sel].id }));
    btns.forEach((b, i) => b.c.on('pointerover', () => setSel(i)));
    if (P) txt(this, L.W / 2, L.H - 26, '周回内で 初めて正解した問題だけ +1。全問正解で つぎの周回へ！', 20, '#ffffff', { stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

    if (this.cleared) {
      const g = GENRES.find((x) => x.id === this.cleared!.genre)!;
      const t = txt(this, L.W / 2, P ? 640 : 360, `${g.name}\n${this.cleared.round}周クリア → ${this.cleared.round + 1}周目へ！`, 40, GOLD, {
        stroke: '#000',
        strokeThickness: 8,
        align: 'center',
      }).setOrigin(0.5).setDepth(50);
      this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 600, onComplete: () => t.destroy() });
    }
  }
}
