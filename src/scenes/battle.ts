import Phaser from 'phaser';
import * as B from '../battle';
import { BOSSES, BossDef, Move, resolveBoss } from '../config';
import { L } from '../layout';
import { bgm } from '../bgm';
import { getSave, persist } from '../state';
import { sfx } from '../sfx';
import { Button, GOLD, bar, bg, button, fadeIn, floatText, go, txt, tweenP, wait, windowBox, wrapJP } from '../ui';
import { jobName } from './common';

type Cmd = 'attack' | 'defend' | 'bengari' | 'suijuku' | 'focus';

export class BattleScene extends Phaser.Scene {
  private st!: B.BattleState;
  private boss!: BossDef;
  private jobName = '';
  private bossImg!: Phaser.GameObjects.Image;
  private heroImg!: Phaser.GameObjects.Image;
  private msg!: Phaser.GameObjects.Text;
  private bossBar!: ReturnType<typeof bar>;
  private hpBar!: ReturnType<typeof bar>;
  private mpBar!: ReturnType<typeof bar>;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private bossHpText!: Phaser.GameObjects.Text;
  private focusTag!: Phaser.GameObjects.Text;
  private mainBtns: Button[] = [];
  private magicBtns: Button[] = [];
  private cmdPanel!: Phaser.GameObjects.Graphics;
  private fast = false;
  busy = true;
  ended = false;
  // レイアウト
  private bx = 0;
  private by = 0;
  private bh = 0;
  private hx = 0;
  private hy = 0;
  private msgW = 0;

  constructor() {
    super('Battle');
  }

  init(data: { boss?: string }) {
    const nb = (data?.boss ? resolveBoss(data.boss) : undefined) ?? BOSSES.find((b) => !getSave().defeated.includes(b.id)) ?? BOSSES[BOSSES.length - 1];
    this.boss = nb;
    this.fast = false;
    this.busy = true;
    this.ended = false;
    this.mainBtns = [];
    this.magicBtns = [];
  }

  create() {
    // 通常ボス・強化ボスは通常ボス戦BGM、ラスボス（3形態を通して）はラスボス戦BGM
    bgm.play(this.boss.id === 'kansecoa' ? 'last' : 'boss');
    fadeIn(this);
    bg(this, 'field');
    const P = L.portrait;
    const save = getSave();
    this.jobName = jobName(save.job);
    this.st = B.newBattle({ ...save.stats }, this.boss);

    // ---- 配置
    const box = P ? { w: 640, h: 440 } : { w: 540, h: 380 };
    this.bx = P ? L.W / 2 : 960;
    this.by = P ? 640 : 470;
    this.hx = P ? 160 : 250;
    this.hy = P ? 820 : 490;

    // ---- ボス
    this.add.ellipse(this.bx, this.by + 8, 320, 36, 0x000000, 0.3);
    this.bossImg = this.add.image(this.bx, this.by, this.boss.sprite).setOrigin(0.5, 1);
    const k = Math.max(2, Math.floor(Math.min(box.w / this.bossImg.width, box.h / this.bossImg.height)));
    this.bossImg.setScale(k);
    this.bh = this.bossImg.height * k;
    this.tweens.add({ targets: this.bossImg, y: this.by - 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // ---- 主人公
    this.add.ellipse(this.hx, this.hy + 6, 190, 28, 0x000000, 0.3);
    this.heroImg = this.add.image(this.hx, this.hy, 'job_' + save.job).setOrigin(0.5, 1).setScale(P ? 2.2 : 2.6);
    this.tweens.add({ targets: this.heroImg, y: this.hy - 4, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // ---- ステータス
    if (P) {
      windowBox(this, 24, 16, L.W - 48, 130);
      txt(this, L.W / 2, 44, `第${this.boss.order}の試練　${this.boss.name}`, 32, '#ffffff').setOrigin(0.5);
      this.bossBar = bar(this, 56, 100, 480, 24, 0xe04848);
      this.bossHpText = txt(this, L.W - 52, 94, '', 26).setOrigin(1, 0);
      windowBox(this, 280, 692, 416, 150);
      txt(this, 306, 706, this.jobName, 28, GOLD);
      this.focusTag = txt(this, 672, 710, '', 20, '#9dffb8').setOrigin(1, 0);
      txt(this, 306, 748, 'HP', 22);
      this.hpBar = bar(this, 352, 756, 170, 16, 0x3ddc6a);
      this.hpText = txt(this, 672, 744, '', 24).setOrigin(1, 0);
      txt(this, 306, 792, 'MP', 22);
      this.mpBar = bar(this, 352, 800, 170, 16, 0x4a86e8);
      this.mpText = txt(this, 672, 788, '', 24).setOrigin(1, 0);
    } else {
      windowBox(this, 24, 14, 650, 78);
      txt(this, 48, 28, '▶ ' + this.jobName, 28, GOLD);
      this.focusTag = txt(this, 48, 62, '', 18, '#9dffb8');
      txt(this, 250, 24, 'HP', 22);
      this.hpBar = bar(this, 292, 32, 130, 16, 0x3ddc6a);
      this.hpText = txt(this, 292, 54, '', 20);
      txt(this, 470, 24, 'MP', 22);
      this.mpBar = bar(this, 512, 32, 130, 16, 0x4a86e8);
      this.mpText = txt(this, 512, 54, '', 20);
      windowBox(this, 690, 14, 566, 78);
      txt(this, 714, 22, `第${this.boss.order}の試練　${this.boss.name}`, 24, '#ff9d9d');
      this.bossBar = bar(this, 714, 62, 380, 18, 0xe04848);
      this.bossHpText = txt(this, 1232, 56, '', 22).setOrigin(1, 0);
    }
    this.updateBossText(false);
    this.updatePlayerText(false);

    // ---- メッセージ・コマンド
    const mx = P ? 24 : 432;
    const my = P ? 860 : 510;
    this.msgW = P ? L.W - 48 : 1256 - 432;
    const mh = P ? 170 : 190;
    windowBox(this, mx, my, this.msgW, mh);
    this.msg = txt(this, mx + 28, my + 22, '', P ? 30 : 28, '#ffffff', { lineSpacing: 8 });
    this.add.zone(mx, my, this.msgW, mh).setOrigin(0).setInteractive().on('pointerdown', () => (this.fast = true));
    this.buildMenu();
    void this.intro();
  }

  // ------------------------------------------------------------ UI
  private updateBossText(animate = true) {
    this.bossHpText.setText(`${this.st.bossHp}/${this.boss.hp}`);
    this.bossBar.set(this.st.bossHp / this.boss.hp, animate);
  }
  private updatePlayerText(animate = true) {
    const s = this.st;
    this.hpText.setText(`${s.hp}/${s.maxHp}`);
    this.mpText.setText(`${s.mp}/${s.maxMp}`);
    this.hpBar.set(s.hp / s.maxHp, animate);
    this.mpBar.set(s.mp / s.maxMp, animate);
    this.focusTag.setText(s.focus ? '★しゅうちゅう' : '');
  }

  private async say(s: string, hold = 550) {
    const text = wrapJP(s, L.portrait ? 30 : 28, this.msgW - 60);
    this.msg.setText('');
    for (let i = 1; i <= text.length; i++) {
      this.msg.setText(text.slice(0, i));
      if (!this.fast) await wait(this, 16);
    }
    await wait(this, this.fast ? 120 : hold);
    this.fast = false;
  }

  private buildMenu() {
    const P = L.portrait;
    const px = 24;
    const py = P ? 1040 : 510;
    const pw = P ? L.W - 48 : 392;
    const ph = P ? 222 : 190;
    this.cmdPanel = windowBox(this, px, py, pw, ph);
    const gx = 12;
    const bw = (pw - gx * 3) / 2;
    const bh = P ? 86 : 78;
    const row = (r: number) => py + 14 + r * (bh + 8);
    const mk = (c: number, r: number, label: string, cb: () => void, w = bw, size = P ? 34 : 28) =>
      button(this, px + gx + c * (bw + gx), row(r), w, bh, label, cb, { size, cursor: false });
    this.mainBtns = [
      mk(0, 0, 'たたかう', () => void this.command('attack')),
      mk(1, 0, 'ぼうぎょ', () => void this.command('defend')),
      mk(0, 1, 'まほう', () => this.showMagic(true)),
      mk(1, 1, 'しゅうちゅう', () => void this.command('focus'), bw, P ? 32 : 24),
    ];
    this.magicBtns = [
      mk(0, 0, `ベンガリ MP${B.COST_BENGARI}`, () => void this.command('bengari'), bw, P ? 30 : 22),
      mk(1, 0, `スイジュク MP${B.COST_SUIJUKU}`, () => void this.command('suijuku'), bw, P ? 30 : 22),
      mk(0, 1, 'もどる', () => this.showMagic(false), pw - gx * 2),
    ];
    this.showMagic(false);
    this.setMenuVisible(false);
  }

  private showMagic(on: boolean) {
    this.mainBtns.forEach((b) => b.c.setVisible(!on));
    this.magicBtns.forEach((b) => b.c.setVisible(on));
    this.mainBtns.forEach((b) => b.setActive(!on));
    this.magicBtns.forEach((b) => b.setActive(on));
  }

  private setMenuVisible(v: boolean) {
    this.cmdPanel.setVisible(v);
    if (v) {
      this.showMagic(false);
    } else {
      this.mainBtns.concat(this.magicBtns).forEach((b) => {
        b.c.setVisible(false);
        b.setActive(false);
      });
    }
  }

  // ------------------------------------------------------------ 進行
  private async intro() {
    await wait(this, 300);
    sfx.hurt();
    await this.say(`${this.boss.name}が あらわれた！\n${this.boss.intro}`, 800);
    await this.askCommand();
  }

  private async askCommand() {
    if (this.ended) return;
    this.updatePlayerText(false);
    this.msg.setText(wrapJP(`${this.jobName}は どうする？`, L.portrait ? 30 : 28, this.msgW - 60));
    this.setMenuVisible(true);
    this.busy = false;
  }

  private async command(cmd: Cmd) {
    if (this.busy || this.ended) return;
    const s = this.st;
    // MP不足は行動を消費せず、理由を表示する
    if ((cmd === 'bengari' && s.mp < B.COST_BENGARI) || (cmd === 'suijuku' && s.mp < B.COST_SUIJUKU)) {
      const need = cmd === 'bengari' ? B.COST_BENGARI : B.COST_SUIJUKU;
      this.msg.setText(wrapJP(`MPが たりない！\n（${cmd === 'bengari' ? 'ベンガリ' : 'スイジュク'}は MP${need} ひつよう／いま MP${s.mp}）`, L.portrait ? 28 : 26, this.msgW - 60));
      sfx.wrong();
      return;
    }
    this.busy = true;
    this.setMenuVisible(false);
    s.defending = false;
    if (cmd === 'defend') s.defending = true;
    const first = B.playerFirst(s, Math.random);

    if (first) {
      await this.doPlayer(cmd);
      if (this.ended) return;
    }
    await this.doBoss();
    if (this.ended) return;
    if (!first) {
      await this.doPlayer(cmd);
      if (this.ended) return;
    }
    s.turn++;
    await this.askCommand();
  }

  // ------------------------------------------------------------ 主人公の行動
  private async doPlayer(cmd: Cmd) {
    const s = this.st;
    const rng = Math.random;
    const bn = this.boss.name;
    const ty = this.by - this.bh / 2;
    switch (cmd) {
      case 'attack': {
        await this.say(`${this.jobName}の こうげき！`, 200);
        await tweenP(this, { targets: this.heroImg, x: this.hx + (L.portrait ? 150 : 200), y: this.hy - 90, duration: 160 });
        const r = B.playerAttack(s, rng);
        if (!r.hit) {
          sfx.miss();
          await tweenP(this, { targets: this.bossImg, x: this.bx + 60, duration: 120, yoyo: true });
          await this.returnHero();
          await this.say(`ミス！ ${bn}は ひらりと かわした！`);
          return;
        }
        sfx.hit();
        this.slashFx(ty);
        this.hitBoss();
        if (r.crit) this.critFx(this.bx, ty - 40, r.dmg);
        else floatText(this, this.bx, ty - 40, String(r.dmg), '#ffffff');
        this.updateBossText();
        this.updatePlayerText();
        await this.returnHero();
        if (r.crit) await this.say('会心の一撃！', 350);
        await this.say(`${bn}に ${r.dmg}の ダメージ！`);
        break;
      }
      case 'defend':
        sfx.guard();
        this.guardFx();
        await this.say(`${this.jobName}は みをまもっている！`);
        return;
      case 'focus': {
        const r = B.playerFocus(s);
        sfx.focus();
        await this.focusFx();
        this.updatePlayerText();
        await this.say(`${this.jobName}は しんしょうを とぎすました！\nMPが ${r.mp} かいふく。つぎの こうげきが つよくなる！`, 700);
        return;
      }
      case 'bengari': {
        await this.say(`${this.jobName}は ベンガリを となえた！`, 150);
        this.spellBanner('ベンガリ', '#ff9d5a');
        const r = B.playerBengari(s, rng);
        this.updatePlayerText();
        await this.bengariFx(ty);
        floatText(this, this.bx, ty - 40, String(r.dmg), '#ffb347', 72);
        this.updateBossText();
        const note = this.boss.fireMult > 1 ? '\nほのおが よく きいている！' : this.boss.fireMult < 1 ? '\nほのおは あまり きいていない…' : '';
        await this.say(`${bn}に ${r.dmg}の ダメージ！${note}`, 650);
        break;
      }
      case 'suijuku': {
        await this.say(`${this.jobName}は スイジュクを となえた！`, 150);
        this.spellBanner('スイジュク', '#7fe3ff');
        const r = B.playerSuijuku(s, rng);
        this.updatePlayerText();
        await this.suijukuFx();
        floatText(this, this.hx, this.hy - 220, `+${r.heal}`, '#7dff9d', 64);
        await this.say(`${this.jobName}の HPが ${r.heal} かいふくした！`, 600);
        break;
      }
    }
    if (s.bossHp <= 0) {
      await this.win();
      return;
    }
    const form = B.updateForm(s);
    if (form) await this.formChange(form);
  }

  private async formChange(label: string) {
    sfx.boom();
    this.cameras.main.shake(400, 0.012);
    const f = this.add.rectangle(L.W / 2, L.H / 2, L.W, L.H, 0xffffff, 0.6).setDepth(80);
    this.tweens.add({ targets: f, alpha: 0, duration: 500, onComplete: () => f.destroy() });
    await this.say(`${this.boss.name}は ${label}に へんかした！`, 700);
  }

  // ------------------------------------------------------------ ボスの行動
  private async doBoss() {
    const s = this.st;
    const move: Move = B.bossChoose(s, Math.random);
    await this.say(`${this.boss.name}の ${move.name}！`, 200);
    await tweenP(this, { targets: this.bossImg, y: this.by + 50, duration: 160, yoyo: true });
    const r = B.bossAct(s, move, Math.random);
    if (!r.hit) {
      sfx.miss();
      await tweenP(this, { targets: this.heroImg, x: this.hx - 40, duration: 120, yoyo: true });
      await this.say(`${this.jobName}は ひらりと みをかわした！`);
      return;
    }
    sfx.hurt();
    if (r.magic) this.rustSprayFx();
    this.hitHero();
    if (r.crits > 0) this.critFx(this.hx, this.hy - 220, r.dmg, '#ff9d9d');
    else floatText(this, this.hx, this.hy - 220, String(r.dmg), '#ff9d9d');
    this.updatePlayerText();
    await wait(this, 350);
    if (r.crits > 0) await this.say('会心の一撃！', 350);
    await this.say(`${r.swings > 1 ? `${r.hits}かい ヒット！ ` : ''}${this.jobName}は ${r.dmg}の ダメージを うけた！${s.defending ? '\n（ぼうぎょで ダメージが はんげんした）' : ''}`);
    if (s.hp <= 0) await this.lose();
  }

  // ------------------------------------------------------------ 演出
  private async returnHero() {
    await tweenP(this, { targets: this.heroImg, x: this.hx, y: this.hy, duration: 180 });
  }

  /** 会心の一撃: 大きな金色のダメージ数値・画面フラッシュ・振動 */
  private critFx(x: number, y: number, dmg: number, color = '#ffe14d') {
    sfx.boom();
    this.cameras.main.shake(320, 0.02);
    const f = this.add.rectangle(L.W / 2, L.H / 2, L.W, L.H, 0xffffff, 0.7).setDepth(85);
    this.tweens.add({ targets: f, alpha: 0, duration: 260, onComplete: () => f.destroy() });
    const t = txt(this, x, y - 70, '会心！', 40, '#ffffff', { stroke: '#c0392b', strokeThickness: 8 }).setOrigin(0.5).setDepth(101);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, delay: 600, duration: 400, onComplete: () => t.destroy() });
    const n = txt(this, x, y, String(dmg), 96, color, { stroke: '#000000', strokeThickness: 10 }).setOrigin(0.5).setDepth(100).setScale(0.4);
    this.tweens.add({ targets: n, scale: 1.15, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: n, y: y - 70, alpha: 0, delay: 900, duration: 300, onComplete: () => n.destroy() });
  }

  private hitBoss() {
    this.tweens.add({ targets: this.bossImg, x: this.bx + 14, duration: 40, yoyo: true, repeat: 4, onComplete: () => this.bossImg.setX(this.bx) });
    this.tweens.add({ targets: this.bossImg, alpha: 0.3, duration: 50, yoyo: true, repeat: 3, onComplete: () => this.bossImg.setAlpha(1) });
  }

  private hitHero() {
    this.cameras.main.shake(220, 0.012);
    this.tweens.add({ targets: this.heroImg, alpha: 0.2, duration: 50, yoyo: true, repeat: 3, onComplete: () => this.heroImg.setAlpha(1) });
    const f = this.add.rectangle(L.W / 2, L.H / 2, L.W, L.H, 0xff0000, 0.3).setDepth(50);
    this.tweens.add({ targets: f, alpha: 0, duration: 300, onComplete: () => f.destroy() });
  }

  private slashFx(ty: number) {
    const g = this.add.graphics().setDepth(60);
    g.lineStyle(14, 0xffffff, 1);
    g.beginPath();
    g.moveTo(this.bx - 120, ty - 140);
    g.lineTo(this.bx + 120, ty + 140);
    g.strokePath();
    g.lineStyle(6, 0x9ad8ff, 1);
    g.beginPath();
    g.moveTo(this.bx - 100, ty - 140);
    g.lineTo(this.bx + 140, ty + 130);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  private guardFx() {
    const g = this.add.graphics().setDepth(60);
    g.lineStyle(8, 0x9ad8ff, 1);
    g.strokeCircle(this.hx, this.hy - 100, 110);
    g.fillStyle(0x9ad8ff, 0.2);
    g.fillCircle(this.hx, this.hy - 100, 110);
    this.tweens.add({ targets: g, alpha: 0, scale: 1.1, duration: 700, onComplete: () => g.destroy() });
  }

  private async focusFx() {
    for (let i = 0; i < 3; i++) {
      const c = this.add.circle(this.hx, this.hy - 100, 130, 0xffe14d, 0).setStrokeStyle(6, 0xffe14d).setDepth(60);
      this.tweens.add({ targets: c, scale: 0.2, alpha: { from: 1, to: 0.1 }, duration: 600, delay: i * 180, onComplete: () => c.destroy() });
    }
    await wait(this, 900);
  }

  private spellBanner(name: string, color: string) {
    const bx = L.W / 2 - 170;
    const by = L.portrait ? 170 : 110;
    const g = windowBox(this, bx, by, 340, 80).setDepth(70);
    const t = txt(this, L.W / 2, by + 40, name, 40, color).setOrigin(0.5).setDepth(71);
    this.time.delayedCall(1300, () => {
      g.destroy();
      t.destroy();
    });
  }

  private pixel(x: number, y: number, size: number, color: number, depth = 65) {
    return this.add.rectangle(x, y, size, size, color).setDepth(depth);
  }

  private async bengariFx(ty: number) {
    sfx.fire();
    const sx = this.hx + 60;
    const sy = this.hy - 140;
    const tx = this.bx;
    for (let i = 0; i < 12; i++) {
      const p = this.pixel(sx + Phaser.Math.Between(-40, 40), sy + Phaser.Math.Between(-20, 30), 12, [0xff5a1f, 0xffb347, 0xffe56b][i % 3]);
      this.tweens.add({ targets: p, y: p.y - 80, alpha: 0, duration: 500, onComplete: () => p.destroy() });
    }
    await wait(this, 380);
    const balls: Promise<void>[] = [];
    for (let i = 0; i < 3; i++) {
      balls.push(
        new Promise<void>((res) => {
          const f = this.add.image(sx, sy, 'fire').setScale(8).setDepth(66);
          const prog = { t: 0 };
          const off = (i - 1) * 90;
          this.tweens.add({
            targets: prog,
            t: 1,
            delay: i * 170,
            duration: 520,
            ease: 'Quad.easeIn',
            onUpdate: () => {
              f.x = Phaser.Math.Linear(sx, tx, prog.t);
              f.y = Phaser.Math.Linear(sy, ty, prog.t) - Math.sin(prog.t * Math.PI) * 140 + off * 0.3;
              f.setRotation(prog.t * 6);
              if (Math.random() < 0.8) {
                const tr = this.pixel(f.x + Phaser.Math.Between(-16, 16), f.y + Phaser.Math.Between(-16, 16), 10, 0xff8a1f, 64);
                this.tweens.add({ targets: tr, alpha: 0, scale: 0.2, duration: 260, onComplete: () => tr.destroy() });
              }
            },
            onComplete: () => {
              f.destroy();
              this.explode(tx + off * 0.6, ty + (i % 2 ? 40 : -30));
              res();
            },
          });
        }),
      );
    }
    await Promise.all(balls);
    await wait(this, 350);
  }

  private explode(x: number, y: number) {
    sfx.boom();
    const flash = this.add.rectangle(L.W / 2, L.H / 2, L.W, L.H, 0xff8a1f, 0.5).setDepth(80);
    this.tweens.add({ targets: flash, alpha: 0, duration: 250, onComplete: () => flash.destroy() });
    this.cameras.main.shake(260, 0.015);
    this.hitBoss();
    const cols = [0xff3a1f, 0xff8a1f, 0xffe56b, 0xffffff];
    for (let i = 0; i < 40; i++) {
      const sz = Phaser.Math.Between(2, 5) * 6;
      const p = this.pixel(x, y, sz, cols[i % cols.length], 70);
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.Between(60, 240);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d + 60,
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(450, 800),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
    const flame = this.add.image(x, y, 'fire').setScale(6).setDepth(69);
    this.tweens.add({ targets: flame, scale: 20, alpha: 0, duration: 500, onComplete: () => flame.destroy() });
  }

  private async suijukuFx() {
    sfx.heal();
    const cx = this.hx;
    const base = this.hy;
    const pillar = this.add.rectangle(cx, base, 150, 10, 0x7fe3ff, 0.35).setOrigin(0.5, 1).setDepth(60);
    this.tweens.add({ targets: pillar, displayHeight: 300, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => pillar.destroy() });
    for (let i = 0; i < 36; i++) {
      const col = [0x7fe3ff, 0x4aa8ff, 0xb9fff0, 0x7dff9d][i % 4];
      const p = this.pixel(cx + Phaser.Math.Between(-60, 60), base - Phaser.Math.Between(0, 40), 10 + (i % 3) * 4, col, 66);
      const ph = Math.random() * Math.PI * 2;
      const prog = { t: 0 };
      const x0 = p.x;
      this.tweens.add({
        targets: prog,
        t: 1,
        delay: i * 22,
        duration: 900,
        onUpdate: () => {
          p.y = base - prog.t * 260;
          p.x = x0 + Math.sin(prog.t * 8 + ph) * 26;
          p.setAlpha(1 - prog.t * 0.9);
        },
        onComplete: () => p.destroy(),
      });
    }
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(cx, base - 100, 30, 0x7fe3ff, 0).setStrokeStyle(6, 0xb9fff0).setDepth(61);
      this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 800, delay: i * 220, onComplete: () => ring.destroy() });
    }
    await wait(this, 1100);
  }

  private rustSprayFx() {
    for (let i = 0; i < 24; i++) {
      const p = this.pixel(this.bx, this.by - this.bh / 2, 14, [0x58b0ff, 0xb9fff0, 0xffffff][i % 3], 66);
      this.tweens.add({
        targets: p,
        x: this.hx + Phaser.Math.Between(-50, 50),
        y: this.hy - 100 + Phaser.Math.Between(-50, 50),
        duration: 320 + (i % 5) * 40,
        ease: 'Quad.easeIn',
        onComplete: () => p.destroy(),
      });
    }
  }

  // ------------------------------------------------------------ 決着
  private async win() {
    this.ended = true;
    this.setMenuVisible(false);
    const s = getSave();
    s.bossTries[this.boss.id] = (s.bossTries[this.boss.id] ?? 0) + 1;
    const list = this.boss.series ? s.enhancedDefeated : s.defeated;
    if (!list.includes(this.boss.id)) list.push(this.boss.id);
    persist();
    sfx.boom();
    await this.say(`${this.boss.name}を たおした！`, 400);
    this.tweens.killTweensOf(this.bossImg);
    for (let i = 0; i < 24; i++) {
      const p = this.pixel(this.bx + Phaser.Math.Between(-150, 150), this.by - Phaser.Math.Between(20, this.bh), 18, [0xffe56b, 0xff8a1f, 0xffffff][i % 3], 70);
      this.tweens.add({ targets: p, y: p.y - 100, alpha: 0, duration: 900, delay: i * 40, onComplete: () => p.destroy() });
    }
    await tweenP(this, { targets: this.bossImg, alpha: 0, scaleY: 0.2, y: this.by + 10, duration: 900 });
    sfx.win();
    await wait(this, 1300);
    go(this, 'Result', { win: true, boss: this.boss.id });
  }

  private async lose() {
    this.ended = true;
    this.setMenuVisible(false);
    const s = getSave();
    s.bossTries[this.boss.id] = (s.bossTries[this.boss.id] ?? 0) + 1;
    persist();
    await this.say(`${this.jobName}は ちからつきた…`, 400);
    sfx.lose();
    await tweenP(this, { targets: this.heroImg, angle: 90, y: this.hy + 20, alpha: 0.4, duration: 800 });
    const f = this.add.rectangle(L.W / 2, L.H / 2, L.W, L.H, 0x000000, 0).setDepth(90);
    await tweenP(this, { targets: f, alpha: 0.85, duration: 900 });
    go(this, 'Result', { win: false, boss: this.boss.id });
  }
}
