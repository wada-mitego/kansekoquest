import Phaser from 'phaser';
import { BASE_STAT, BEST_STAT, JOBS, STAT_KEYS, STAT_NAMES, Stats } from '../data';
import { L } from '../layout';
import { bgm } from '../bgm';
import { newSave, setSave } from '../state';
import { Button, GOLD, bg, button, fadeIn, go, ribbon, txt, windowBox, wrapJP } from '../ui';
import { ICON, statRows } from './common';

export class JobScene extends Phaser.Scene {
  private sel = 2; // 戦士を基準表示
  constructor() {
    super('Job');
  }

  create() {
    bgm.play('job');
    fadeIn(this);
    bg(this, 'cliff');
    const P = L.portrait;
    const imgs: Phaser.GameObjects.Image[] = [];
    const btns: Button[] = [];
    const glow = this.add.ellipse(0, 0, 10, 10, 0xffd83a, 0.35).setVisible(false);

    ribbon(this, L.W / 2, P ? 30 : 18, P ? 520 : 480, P ? 80 : 66, '職業選択', P ? 42 : 38);
    button(this, 20, P ? 36 : 22, 130, P ? 60 : 54, 'もどる', () => go(this, 'Title'), { size: 24 });

    const baseScale = P ? 1.25 : 2.4;
    const baseY = P ? 690 : 440;
    const xs = P ? [88, 224, 360, 496, 632] : [128, 384, 640, 896, 1152];
    const bw = P ? 128 : 220;
    const by = P ? 700 : 462;
    const bh = P ? 60 : 54;

    const big = P ? this.add.image(360, 530, 'job_warrior').setOrigin(0.5, 1).setScale(3.2) : null;

    JOBS.forEach((j, i) => {
      // 職業カード: キャラ絵と名前ボタンをまとめた枠全体をタップ・クリック可能にする（ホバーで薄く光る）
      const cardTop = baseY - (P ? 130 : 300);
      const card = this.add.rectangle(xs[i] - bw / 2, cardTop, bw, by + bh - cardTop, 0xffffff, 0).setOrigin(0).setStrokeStyle(0, 0xffffff);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => card.setFillStyle(0xffffff, 0.14));
      card.on('pointerout', () => card.setFillStyle(0xffffff, 0));
      card.on('pointerup', () => this.choose(i));
      imgs.push(this.add.image(xs[i], baseY, 'job_' + j.id).setOrigin(0.5, 1).setScale(baseScale));
      imgs[i].setInteractive({ useHandCursor: true }).on('pointerup', () => this.choose(i));
      const b = button(this, xs[i] - bw / 2, by, bw, bh, j.name, () => this.choose(i), { size: P ? 22 : 26, cursor: false });
      btns.push(b);
    });

    // 情報パネル
    const px = P ? 20 : 30;
    const py = P ? 785 : 534;
    const pw = L.W - px * 2;
    const ph = P ? 340 : 170;
    windowBox(this, px, py, pw, ph);
    const name = txt(this, px + 30, py + 20, '', P ? 40 : 38, GOLD);
    const best = txt(this, px + 30, py + (P ? 72 : 70), '', 26, '#9dffb8');
    const desc = txt(this, px + 30, py + (P ? 112 : 112), '', 22, '#ffffff');
    const statObjs: Phaser.GameObjects.GameObject[] = [];

    const draw = () => {
      statObjs.splice(0).forEach((o) => o.destroy());
      const j = JOBS[this.sel];
      name.setText(j.name);
      best.setText(`得意能力： ${STAT_NAMES[j.best]}`);
      desc.setText(wrapJP(j.desc, 22, P ? pw - 60 : 330));
      const stats = {} as Stats;
      STAT_KEYS.forEach((k) => (stats[k] = k === j.best ? BEST_STAT : BASE_STAT));
      const before = this.children.length;
      if (P) {
        statRows(this, px + 40, py + 170, pw - 80, stats, j.best, 32, 22);
      } else {
        STAT_KEYS.forEach((k, i) => {
          const x = px + 410 + i * 96;
          this.add.image(x, py + 30, ICON[k]).setOrigin(0.5, 0).setScale(3);
          txt(this, x, py + 80, STAT_NAMES[k], 18, '#bfc8ff').setOrigin(0.5, 0);
          txt(this, x, py + 106, String(stats[k]), 38, k === j.best ? GOLD : '#ffffff').setOrigin(0.5, 0);
        });
      }
      statObjs.push(...(this.children.list.slice(before) as Phaser.GameObjects.GameObject[]));
    };

    this.data.set('refresh', () => {
      imgs.forEach((im, i) => {
        const on = i === this.sel;
        this.tweens.killTweensOf(im);
        im.setScale(on && !P ? baseScale * 1.25 : baseScale);
        im.setAlpha(on || P ? 1 : 0.85);
        if (on && !P) this.tweens.add({ targets: im, y: baseY - 8, duration: 500, yoyo: true, repeat: -1 });
        else im.setY(baseY);
        btns[i].setState(on ? 'selected' : 'normal');
      });
      if (big) big.setTexture('job_' + JOBS[this.sel].id);
      glow.setVisible(true).setPosition(xs[this.sel], baseY + 6).setSize(P ? 140 : 300, 28).setDisplaySize(P ? 140 : 300, 28);
      draw();
    });
    (this.data.get('refresh') as () => void)();

    const startW = P ? 460 : 300;
    button(this, P ? (L.W - startW) / 2 : px + pw - startW - 24, P ? 1150 : py + 40, startW, P ? 100 : 90, 'この職業で はじめる', () => {
      setSave(newSave(JOBS[this.sel].id));
      go(this, 'Home');
    }, { size: P ? 34 : 28 }).setState('selected');

    this.input.keyboard?.on('keydown-LEFT', () => this.choose((this.sel + 4) % 5));
    this.input.keyboard?.on('keydown-RIGHT', () => this.choose((this.sel + 1) % 5));
  }

  private choose(i: number) {
    this.sel = i;
    (this.data.get('refresh') as () => void)();
  }
}
