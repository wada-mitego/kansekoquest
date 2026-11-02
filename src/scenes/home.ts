import Phaser from 'phaser';
import { BOSSES, MAIN_STEP, maxHp, maxMp, resolveBoss } from '../config';
import { L } from '../layout';
import {
  bossUnlocked,
  enhancedId,
  enhancedThreshold,
  enhancedUnlocked,
  getSave,
  mainCleared,
  mainUnlockAt,
  mainUnlocked,
  nextBoss,
  questionsToBoss,
  uniqueFirst,
} from '../state';
import { bgm } from '../bgm';
import { QUESTIONS } from '../questions';
import { Button, GOLD, bar, bg, button, fadeIn, go, ribbon, txt, windowBox, wrapJP } from '../ui';
import { hero, jobBest, jobName, statRows } from './common';

export class HomeScene extends Phaser.Scene {
  constructor() {
    super('Home');
  }
  init(data: { unlocked?: boolean }) {
    this.data.set('unlocked', !!data?.unlocked);
  }

  create() {
    bgm.play('genre');
    fadeIn(this);
    bg(this, 'cliff');
    const P = L.portrait;
    const s = getSave();
    const best = jobBest(s.job);
    const nb = nextBoss(s);
    const unlocked = bossUnlocked(s);
    const rate = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
    const U = uniqueFirst(s);

    windowBox(this, 24, 18, L.W - 48, P ? 84 : 70);
    txt(this, 52, P ? 60 : 53, `ホーム　${jobName(s.job)}`, P ? 36 : 34).setOrigin(0, 0.5);
    txt(this, L.W - 52, P ? 60 : 53, `ボス撃破 ${BOSSES.filter((b) => s.defeated.includes(b.id)).length}/${BOSSES.length}`, 28, GOLD).setOrigin(1, 0.5);
    // BGMのON/OFF（ホームからも切り替えられる。音量は「せってい」）
    const bgmBtn = button(this, L.W - 52 - (P ? 220 : 240) - 100, P ? 36 : 29, 90, 48, '', () => {
      bgm.setOn(!bgm.settings().bgmOn);
      bgmBtn.setLabel(bgm.settings().bgmOn ? '♪ON' : '♪OFF');
    }, { size: 24 });
    bgmBtn.setLabel(bgm.settings().bgmOn ? '♪ON' : '♪OFF');

    const top = P ? 120 : 108;
    const hh = P ? 340 : 400;
    const heroW = P ? 300 : 380;
    windowBox(this, 24, top, heroW, hh);
    hero(this, s.job, 24 + heroW / 2, top + hh - 28, P ? 2.6 : 3.1);

    const sx = 24 + heroW + 16;
    const sw = P ? L.W - sx - 24 : 400;
    windowBox(this, sx, top, sw, hh);
    txt(this, sx + 26, top + 18, `HP ${maxHp(s.stats)}`, 26, GOLD);
    txt(this, sx + sw - 26, top + 18, `MP ${maxMp(s.stats)}`, 26, GOLD).setOrigin(1, 0);
    statRows(this, sx + 26, top + 62, sw - 52, s.stats, best, P ? 54 : 62, P ? 24 : 28);

    const bx = P ? 24 : sx + sw + 16;
    const by = P ? top + hh + 14 : top;
    const bw = P ? L.W - 48 : L.W - bx - 24;
    const bh = P ? 330 : hh;
    windowBox(this, bx, by, bw, bh);
    const line = (yy: number, str: string, size: number, col = '#ffffff') => txt(this, bx + 26, by + yy, wrapJP(str, size, bw - 52), size, col);
    if (nb) {
      line(14, `つぎの ボス（だい${nb.order}戦）`, 22, '#bfc8ff');
      line(44, nb.name, P ? 34 : 28, '#ff9d9d');
      const img = this.add.image(bx + bw - 22, by + (P ? 18 : 56), nb.sprite).setOrigin(1, 0);
      img.setScale(Math.max(0.6, Math.min(130 / img.width, 100 / img.height)));
      const done = U - mainUnlockAt(nb.order - 1);
      line(P ? 104 : 120, unlocked ? 'ボスせん かいほう！' : `ボスまで あと ${questionsToBoss(s)} 問`, 28, unlocked ? GOLD : '#ffffff');
      bar(this, bx + 26, by + (P ? 152 : 172), bw - 52, 20, 0x4a86e8).set(Math.min(1, Math.max(0, done) / MAIN_STEP), false);
    } else {
      line(20, mainCleared(s) ? '★ 本編ボス ぜんげきは！' : '', 32, GOLD);
    }
    // 2つのカウンターを分けて表示（本編 と 強化ボス用）
    const cy = P ? 184 : 204;
    let yy = cy;
    const next = (str: string, size: number, col: string) => {
      const t = line(yy, str, size, col);
      yy += t.height + 6;
    };
    next(`【本編】はじめて解いた問題 ${U}問（${BOSSES.length * MAIN_STEP}問で最終ボス）`, 19, '#ffe98a');
    next(`【強化ボス用】周回内の初回回答 ${s.validTotal}問`, 19, '#bfe4ff');
    next(`回答 ${s.answered}回　正答率 ${rate}%（${s.correct}/${s.answered}）　収録 ${QUESTIONS.length}問`, 17, '#9fb0d8');
    if (!P) next('※同じ問題の くりかえしでは 本編は すすまない', 17, '#9fb0d8');

    const btnY = P ? by + bh + 16 : top + hh + 20;
    const half = P ? (L.W - 64) / 2 : 0;
    button(this, 24, btnY, P ? L.W - 48 : 340, P ? 96 : 80, 'べんきょうする', () => go(this, 'Genre'), { size: P ? 36 : 30 });
    const x2 = P ? 24 : 24 + 340 + 16;
    const y2 = P ? btnY + 108 : btnY;
    const challenge: Button = button(
      this,
      x2,
      y2,
      P ? L.W - 48 : 340,
      P ? 100 : 80,
      nb ? (unlocked ? '⚔ ボスに ちょうせん！' : '⚔ ボスせん（ロック）') : '⚔ ボスいちらんへ',
      () => go(this, nb ? 'Battle' : 'Roster', nb ? { boss: nb.id } : undefined),
      { size: P ? 34 : 28, enabled: unlocked || !nb },
    );
    if (unlocked || !nb) challenge.setState('selected');
    const y3 = P ? y2 + 112 : btnY;
    const x3 = P ? 24 : x2 + 340 + 16;
    const w3 = P ? half : 250;
    button(this, x3, y3, w3, P ? 84 : 80, 'ボスいちらん', () => go(this, 'Roster'), { size: P ? 28 : 26 });
    button(this, P ? x3 + w3 + 16 : x3 + w3 + 16, y3, P ? half : L.W - (x3 + w3 + 16) - 24, P ? 84 : 80, 'タイトルへ', () => go(this, 'Title'), { size: P ? 28 : 26 });
    txt(this, L.W / 2, L.H - 20, '✔ 自動セーブ　※ボス撃破は 試験合格の保証ではありません', 18, '#dfe8ff', { stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);

    if (this.data.get('unlocked')) {
      const t = txt(this, L.W / 2, P ? 720 : 665, '★ ボスせんが かいほうされた！ ★', 34, GOLD, { stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: t, alpha: 0.2, duration: 500, yoyo: true, repeat: 5 });
    }
  }
}

export class RosterScene extends Phaser.Scene {
  private sel = 0;
  private series = 0;
  constructor() {
    super('Roster');
  }

  create() {
    bgm.play('genre');
    fadeIn(this);
    bg(this, 'cliff');
    const P = L.portrait;
    const s = getSave();
    const nb = nextBoss(s);
    this.sel = nb ? nb.order - 1 : BOSSES.length - 1;

    ribbon(this, L.W / 2, P ? 22 : 12, P ? 420 : 380, P ? 70 : 56, 'ボス一覧', P ? 38 : 32);
    button(this, 20, P ? 28 : 16, 130, P ? 58 : 50, 'もどる', () => go(this, 'Home'), { size: 24 });

    const maxSeries = () => {
      let m = 0;
      while (enhancedUnlocked(s, m + 1, 1)) m++;
      return m + 1; // 次のシリーズまで見せる
    };

    const strip: Button[] = [];
    const sw = P ? 124 : 108;
    const sh = P ? 54 : 50;
    BOSSES.forEach((b, i) => {
      const x = P ? 24 + (i % 5) * (sw + 7) : 100 + i * (sw + 3);
      const y = P ? 108 + Math.floor(i / 5) * (sh + 8) : 76;
      const bt = button(this, x, y, sw, sh, `${b.order}`, () => {
        this.sel = i;
        draw();
      }, { size: P ? 26 : 26 });
      strip.push(bt);
    });

    const modeY = P ? 236 : 138;
    const modeLbl = button(this, P ? 190 : 190, modeY, P ? 340 : 320, P ? 56 : 50, '', () => {}, { size: 24 });
    button(this, P ? 24 : 100, modeY, P ? 150 : 80, P ? 56 : 50, '◀', () => {
      this.series = Math.max(0, this.series - 1);
      draw();
    }, { size: 24 });
    button(this, P ? 546 : 520, modeY, P ? 150 : 80, P ? 56 : 50, '▶', () => {
      this.series = Math.min(maxSeries(), this.series + 1);
      draw();
    }, { size: 24 });

    const sprite = this.add.image(0, 0, BOSSES[0].sprite).setOrigin(0.5, 1);
    const dyn: Phaser.GameObjects.GameObject[] = [];
    let chal: Button | null = null;

    const draw = () => {
      dyn.splice(0).forEach((o) => o.destroy());
      chal?.c.destroy();
      const base = BOSSES[this.sel];
      const enhanced = this.series > 0;
      const b = enhanced ? resolveBoss(enhancedId(base.id, this.series))! : base;
      const unlocked = enhanced ? enhancedUnlocked(s, this.series, base.order) : mainUnlocked(s, base.order);
      const defeated = enhanced ? s.enhancedDefeated.includes(b.id) : s.defeated.includes(b.id);
      modeLbl.setLabel(enhanced ? `強化版 ${this.series}周目` : '本編');
      strip.forEach((bt, i) => {
        const bb = BOSSES[i];
        const dd = enhanced ? s.enhancedDefeated.includes(enhancedId(bb.id, this.series)) : s.defeated.includes(bb.id);
        const un = enhanced ? enhancedUnlocked(s, this.series, bb.order) : mainUnlocked(s, bb.order);
        bt.setLabel(`${dd ? '★' : un ? '' : '🔒'}${bb.order}`);
        bt.setState(i === this.sel ? 'selected' : 'normal');
      });
      sprite.setTexture(base.sprite);
      const box = P ? { w: 560, h: 300 } : { w: 460, h: 300 };
      const k = Math.max(1, Math.floor(Math.min(box.w / sprite.width, box.h / sprite.height)));
      sprite.setScale(k).setPosition(P ? L.W / 2 : 320, P ? 560 : 510).setAlpha(unlocked ? 1 : 0.5);

      const px = P ? 24 : 590;
      const py = P ? 580 : 200;
      const pw = L.W - px - 24;
      const ph = P ? 440 : 360;
      const n0 = this.children.length;
      windowBox(this, px, py, pw, ph);
      txt(this, px + 26, py + 14, `だい${base.order}戦　${b.name}`, P ? 30 : 28, '#ff9d9d');
      txt(this, px + 26, py + 54, base.tagline, 22, GOLD);
      const need = enhanced ? enhancedThreshold(this.series, base.order) : mainUnlockAt(base.order);
      const have = enhanced ? s.validTotal : uniqueFirst(s);
      const status = defeated ? '★ 撃破済み（再戦できる）' : unlocked ? '⚔ 挑戦できる' : `未解放　あと ${Math.max(0, need - have)}問`;
      txt(this, px + pw - 26, py + 56, status, 21, defeated ? GOLD : unlocked ? '#9dffb8' : '#bfc8ff').setOrigin(1, 0);
      txt(this, px + 26, py + 92, enhanced ? `解放: 周回内の初回回答 ${need}問（いま ${have}問）` : `解放: はじめて解いた問題 ${need}問（いま ${have}問）`, 19, '#9fb0d8');
      txt(this, px + 26, py + 124, base.traits.map((t) => '・' + t).join('\n'), 21, '#ffffff', { lineSpacing: 6 });
      txt(this, px + 26, py + (P ? 206 : 196), wrapJP('★ ' + base.hint, 20, pw - 52), 20, '#9dffb8', { lineSpacing: 4 });
      txt(this, px + 26, py + (P ? 290 : 262), `HP${b.hp} 攻${b.atk} 防${b.def} 魔${b.mag} 魔防${b.mdef} 速${b.spd}${enhanced ? '（強化）' : ''}`, 20, '#bfc8ff');
      txt(this, px + 26, py + (P ? 326 : 296), '※ボス撃破は試験合格の保証ではありません', 17, '#9fb0d8');
      dyn.push(...(this.children.list.slice(n0) as Phaser.GameObjects.GameObject[]));

      chal = button(this, px, P ? py + ph + 14 : py + ph + 14, pw, P ? 100 : 80, unlocked ? `⚔ ${b.name} に ちょうせん` : '⚔ ロックされています', () => go(this, 'Battle', { boss: b.id }), {
        size: P ? 30 : 28,
        enabled: unlocked,
      });
      if (unlocked) chal.setState('selected');
    };
    draw();
  }
}
