import Phaser from 'phaser';
import { buildTextures, preloadAssets } from '../sprites';
import { L } from '../layout';
import { clearSave, hasSave, loadSave } from '../state';
import { bgm } from '../bgm';
import { sfx } from '../sfx';
import { COL, bg, button, fadeIn, go, txt, windowBox, wrapJP } from '../ui';
import { hero } from './common';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload() {
    const t = txt(this, L.W / 2, L.H / 2, 'よみこみちゅう…', 32).setOrigin(0.5);
    void t;
    preloadAssets(this);
  }
  create() {
    buildTextures(this);
    this.scene.start('Title');
  }
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }
  create() {
    bgm.play('title');
    fadeIn(this);
    const save = hasSave();
    const start = () => go(this, 'Job');
    const cont = () => {
      if (loadSave()) go(this, 'Home');
    };
    const askNew = () => (save ? this.confirmNew(start) : start());

    if (!L.portrait) {
      // PC: 正式メインビジュアルを背景に使い、元画像の固定メニューは実ボタンで覆う
      const s = L.W / 768;
      this.add.image(0, 0, 'title_bg').setOrigin(0).setScale(s);
      windowBox(this, 380, 640, 520, 76);
      button(this, 396, 650, 156, 56, 'はじめから', askNew, { size: 26, cursor: false });
      button(this, 562, 650, 156, 56, 'つづきから', cont, { size: 26, enabled: save });
      button(this, 728, 650, 156, 56, 'せってい', () => go(this, 'Settings'), { size: 26 });
    } else {
      bg(this, 'cliff');
      const logo = this.add.image(L.W / 2, 40, 'logo').setOrigin(0.5, 0).setScale(1.12);
      this.tweens.add({ targets: logo, y: 46, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      hero(this, 'warrior', 360, 660, 2.3);
      hero(this, 'mage', 140, 720, 2.3);
      hero(this, 'priest', 585, 720, 2.5);
      hero(this, 'thief', 255, 820, 2.5);
      hero(this, 'fighter', 470, 830, 2.6);
      const x = 130;
      const w = 460;
      button(this, x, 880, w, 100, 'はじめから', askNew, { size: 38, cursor: true }).setState('selected');
      button(this, x, 1000, w, 100, 'つづきから', cont, { size: 38, enabled: save });
      button(this, x, 1120, w, 100, 'せってい', () => go(this, 'Settings'), { size: 38 });
    }
    this.input.once('pointerdown', () => sfx.unlock());
  }

  private confirmNew(onYes: () => void) {
    const cx = L.W / 2;
    const cy = L.H / 2;
    const dim = this.add.rectangle(cx, cy, L.W, L.H, 0x000000, 0.7).setInteractive().setDepth(10);
    const g = windowBox(this, cx - 300, cy - 170, 600, 340).setDepth(11);
    const msg = txt(this, cx, cy - 110, wrapJP('いまのセーブデータは\nきえてしまいます。\nはじめからにしますか？', 30, 520), 30, '#fff', {
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(12);
    const yes = button(this, cx - 260, cy + 50, 240, 84, 'はい', () => {
      clearSave();
      onYes();
    });
    const no = button(this, cx + 20, cy + 50, 240, 84, 'いいえ', () => [dim, g, msg, yes.c, no.c].forEach((o) => o.destroy()));
    yes.c.setDepth(12);
    no.c.setDepth(12);
  }
}

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }
  create() {
    bgm.play('title');
    fadeIn(this);
    bg(this, 'cliff');
    const P = L.portrait;
    const w = P ? 640 : 760;
    const x = (L.W - w) / 2;
    let y = P ? 160 : 40;
    windowBox(this, x, y, w, 80);
    txt(this, L.W / 2, y + 40, 'せってい', 38).setOrigin(0.5);
    y += 100;

    const bgmLabel = () => (bgm.settings().bgmOn ? 'BGM　ON' : 'BGM　OFF');
    const bgmBtn = button(this, x, y, w, 84, '', () => {
      bgm.setOn(!bgm.settings().bgmOn);
      bgmBtn.setLabel(bgmLabel());
    }, { size: 34 });
    bgmBtn.setLabel(bgmLabel());
    y += 100;

    // BGM音量スライダー（バー全体をドラッグ・タップできる。−/＋でも調整可）
    windowBox(this, x, y, w, 120);
    const volTxt = txt(this, x + 28, y + 14, '', 28);
    const tx0 = x + 150;
    const tx1 = x + w - 150;
    const ty = y + 78;
    const g = this.add.graphics();
    const draw = () => {
      const v = bgm.settings().bgmVol;
      volTxt.setText(`BGM音量　${Math.round(v * 100)}%`);
      g.clear();
      g.fillStyle(0x3a3a4e, 1);
      g.fillRect(tx0, ty - 8, tx1 - tx0, 16);
      g.fillStyle(0xffd83a, 1);
      g.fillRect(tx0, ty - 8, (tx1 - tx0) * v, 16);
      g.fillStyle(0xffffff, 1);
      g.fillRect(tx0 + (tx1 - tx0) * v - 10, ty - 20, 20, 40);
    };
    const setFromX = (px: number) => {
      bgm.setVolume(Math.round(Math.min(1, Math.max(0, (px - tx0) / (tx1 - tx0))) * 20) / 20);
      draw();
    };
    const track = this.add.rectangle(tx0 - 20, ty - 34, tx1 - tx0 + 40, 68, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    let dragging = false;
    track.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      setFromX(p.x);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => dragging && setFromX(p.x));
    this.input.on('pointerup', () => (dragging = false));
    button(this, x + 20, ty - 26, 100, 52, '−', () => { bgm.setVolume(bgm.settings().bgmVol - 0.1); draw(); }, { size: 30 });
    button(this, x + w - 120, ty - 26, 100, 52, '＋', () => { bgm.setVolume(bgm.settings().bgmVol + 0.1); draw(); }, { size: 30 });
    draw();
    y += 136;

    const sfxLabel = () => (sfx.isMuted() ? 'こうかおん　OFF' : 'こうかおん　ON');
    const snd = button(this, x, y, w, 84, '', () => {
      sfx.setMuted(!sfx.isMuted());
      snd.setLabel(sfxLabel());
      sfx.select();
    }, { size: 34 });
    snd.setLabel(sfxLabel());
    y += 100;
    button(this, x, y, w, 84, 'セーブデータを けす', () => this.confirmDelete(), { size: 32, enabled: hasSave() });
    y += 100;
    txt(this, L.W / 2, y, wrapJP('セーブは このブラウザの中に じどうで ほぞんされます。', 24, w - 40), 24, '#e0e6ff', { align: 'center', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0);
    y += P ? 70 : 38;
    button(this, x, y, w, 76, 'タイトルへ もどる', () => go(this, 'Title'), { size: 30 });
  }
  private confirmDelete() {
    const cx = L.W / 2;
    const cy = L.H / 2;
    const dim = this.add.rectangle(cx, cy, L.W, L.H, 0x000000, 0.75).setInteractive().setDepth(10);
    const g = windowBox(this, cx - 300, cy - 170, 600, 340, COL.fill).setDepth(11);
    const msg = txt(this, cx, cy - 120, wrapJP('セーブデータを ほんとうに\nけしますか？\n（もとには もどせません）', 30, 520), 30, '#fff', { align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(12);
    const yes = button(this, cx - 260, cy + 50, 240, 84, 'けす', () => {
      clearSave();
      go(this, 'Title');
    });
    const no = button(this, cx + 20, cy + 50, 240, 84, 'やめる', () => [dim, g, msg, yes.c, no.c].forEach((o) => o.destroy()));
    yes.c.setDepth(12);
    no.c.setDepth(12);
  }
}
