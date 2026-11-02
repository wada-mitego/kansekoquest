import Phaser from 'phaser';
import { BOSSES, resolveBoss } from '../config';
import { bgm } from '../bgm';
import { STAT_KEYS, STAT_NAMES } from '../data';
import { L } from '../layout';
import { getSave, mainCleared, nextBoss, questionsToBoss, wrongCount } from '../state';
import { GOLD, bg, button, fadeIn, go, txt, windowBox, wrapJP } from '../ui';
import { hero, jobName } from './common';

export class ResultScene extends Phaser.Scene {
  private win = false;
  private bossId: string = BOSSES[0].id;
  constructor() {
    super('Result');
  }
  init(data: { win: boolean; boss: string }) {
    this.win = !!data?.win;
    this.bossId = data?.boss ?? BOSSES[0].id;
  }

  create() {
    bgm.play('genre');
    fadeIn(this);
    const P = L.portrait;
    const s = getSave();
    const boss = resolveBoss(this.bossId)!;
    const nb = nextBoss(s);
    bg(this, this.win ? 'cliff' : 'field');

    txt(this, P ? L.W / 2 : 330, P ? 120 : 110, this.win ? '勝利！' : '敗北…', P ? 130 : 120, this.win ? GOLD : '#aab0d8', {
      stroke: this.win ? '#7a3a00' : '#10122a',
      strokeThickness: 16,
    }).setOrigin(0.5);
    txt(this, P ? L.W / 2 : 330, P ? 220 : 224, wrapJP(this.win ? `${boss.name}を たおした！` : `${jobName(s.job)}は ${boss.name}に やぶれた…`, 26, P ? 640 : 560), 26, '#ffffff', {
      stroke: '#000',
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5, 0);

    const h = hero(this, s.job, P ? L.W / 2 : 330, P ? 520 : 560, P ? 3.2 : 3.4, this.win);
    if (!this.win) h.setScale(P ? 3.2 : 2.6).setAngle(90).setAlpha(0.6).setY(P ? 540 : 520);
    if (this.win) {
      for (let i = 0; i < 60; i++) {
        const r = this.add.rectangle(Phaser.Math.Between(0, L.W), Phaser.Math.Between(-600, 0), 12, 12, [0xffe14d, 0xff6a6a, 0x7fe3ff, 0x9dffb8, 0xffffff][i % 5]);
        this.tweens.add({ targets: r, y: L.H + 40, angle: Phaser.Math.Between(180, 720), duration: Phaser.Math.Between(2500, 5000), delay: Phaser.Math.Between(0, 2500), repeat: -1 });
      }
    }

    const px = P ? 24 : 640;
    const py = P ? 580 : 40;
    const pw = L.W - px - 24;
    const ph = P ? 360 : 400;
    windowBox(this, px, py, pw, ph);
    const rate = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
    let y = py + 22;
    const line = (str: string, size = 26, col = '#ffffff') => {
      const t = txt(this, px + 28, y, wrapJP(str, size, pw - 56), size, col, { lineSpacing: 6 });
      y += t.height + 12;
    };
    if (this.win) {
      if (mainCleared(s)) {
        line(`★ 本編クリア！ ${BOSSES.length}体の ボスを すべて たおした！`, 28, GOLD);
        line('学習は いつでも つづけられる。強化ボスも まっている。', 22);
      } else if (nb) {
        line(`つぎの ボス： ${nb.name}`, 28, '#ff9d9d');
        const rest = questionsToBoss(s);
        line(rest > 0 ? `あと ${rest} 問（はじめて解く問題）で ボスせんが かいほうされる。` : 'すぐに ちょうせん できる！', 22);
      }
    } else {
      line('アドバイス', 28, GOLD);
      line(boss.hint, 24, '#9dffb8');
      line('HPが へったら「スイジュク」、MPが たりなければ「しゅうちゅう」。', 22, '#bfe4ff');
      line(`ふくしゅう たいしょう ${wrongCount(s)} 問。学習を つづけても 強くなれる！`, 22, '#bfc8ff');
    }
    line(`学習の正答率 ${rate}%（${s.correct}/${s.answered}）※ボスの勝敗とは 別です`, 20, '#bfc8ff');
    txt(this, px + 28, y + 4, STAT_KEYS.map((k) => `${STAT_NAMES[k]}${s.stats[k]}`).join('　'), P ? 20 : 22, '#ffffff');
    txt(this, px + 28, y + 40, '※ボス撃破は 試験合格の保証ではありません', 17, '#9fb0d8');

    const by0 = P ? py + ph + 24 : py + ph + 20;
    const bw = pw;
    if (this.win) {
      button(this, px, by0, bw, P ? 100 : 84, 'ホームへ', () => go(this, 'Home'), { size: 34 }).setState('selected');
      button(this, px, by0 + (P ? 116 : 96), bw / 2 - 8, P ? 90 : 76, '学習に もどる', () => go(this, 'Genre'), { size: 26 });
      button(this, px + bw / 2 + 8, by0 + (P ? 116 : 96), bw / 2 - 8, P ? 90 : 76, 'ボスいちらん', () => go(this, 'Roster'), { size: 26 });
    } else {
      button(this, px, by0 - (P ? 0 : 6), bw, P ? 100 : 70, 'もういちど ちょうせん', () => go(this, 'Battle', { boss: boss.id }), { size: 32 }).setState('selected');
      button(this, px, by0 + (P ? 116 : 70), bw / 2 - 8, P ? 90 : 64, '学習に もどる', () => go(this, 'Genre'), { size: 26 });
      button(this, px + bw / 2 + 8, by0 + (P ? 116 : 70), bw / 2 - 8, P ? 90 : 64, 'ホームへ', () => go(this, 'Home'), { size: 26 });
    }
  }
}
