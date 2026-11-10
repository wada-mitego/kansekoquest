import Phaser from 'phaser';
import { GENRES, GenreId, STAT_CSS, STAT_NAMES } from '../data';
import { ALL_QUESTIONS, Question, isCorrect } from '../questions';
import { L } from '../layout';
import { bgm } from '../bgm';
import { getSave, mainUnlockAt, nextBoss, pickQuestion, questionsToBoss, recordAnswer, roundInfo, uniqueFirst } from '../state';
import { sfx } from '../sfx';
import { Button, GOLD, bg, button, fadeIn, fitText, floatText, go, txt, windowBox, wrapJP } from '../ui';
import { ICON } from './common';

const MARKS = ['①', '②', '③', '④'];

export class QuizScene extends Phaser.Scene {
  q!: Question;
  /** 表示順 → 元の選択肢インデックス */
  order: number[] = [];
  answered = false;
  review = false;
  private btns: Button[] = [];
  private picked = new Set<number>();
  private confirm: Button | null = null;
  private genreId!: GenreId;

  constructor() {
    super('Quiz');
  }

  private forceId: string | null = null;

  init(data: { genre: GenreId; qid?: string }) {
    this.genreId = data.genre;
    // 動作確認用: ?debug のときだけ問題IDを指定できる
    this.forceId = location.search.includes('debug') && data.qid ? data.qid : null;
    this.answered = false;
    this.btns = [];
    this.picked = new Set();
    this.confirm = null;
  }

  create() {
    bgm.play('quiz');
    fadeIn(this);
    bg(this, 'cliff');
    const P = L.portrait;
    const s = getSave();
    const genre = GENRES.find((g) => g.id === this.genreId)!;
    let pick = pickQuestion(s, this.genreId);
    if (this.forceId) {
      const fq = ALL_QUESTIONS.find((x) => x.id === this.forceId);
      if (fq) pick = { q: fq, round: 1, fresh: true };
    }

    if (!pick) {
      // 出題候補0件のジャンル: 処理を止めず、戻れるようにする
      windowBox(this, 60, L.H / 2 - 120, L.W - 120, 240);
      txt(this, L.W / 2, L.H / 2 - 50, `${genre.name}\n問題準備中`, 36, '#ffffff', { align: 'center' }).setOrigin(0.5);
      button(this, L.W / 2 - 140, L.H / 2 + 30, 280, 70, 'もどる', () => go(this, 'Genre'), { size: 30 });
      return;
    }
    this.q = pick.q;
    this.review = !pick.fresh;
    const idx = [0, 1, 2, 3];
    this.order = this.q.shuffle === false ? idx : Phaser.Utils.Array.Shuffle(idx);

    // ヘッダ
    const hh = P ? 100 : 64;
    windowBox(this, 24, 18, L.W - 48, hh);
    this.add.image(50, 18 + hh / 2, ICON[genre.stat]).setOrigin(0, 0.5).setScale(P ? 3.5 : 3);
    txt(this, 110, 18 + hh / 2, wrapJP(genre.name, P ? 26 : 28, P ? 300 : 440), P ? 26 : 28, GOLD).setOrigin(0, 0.5);
    const ri = roundInfo(s, this.genreId);
    const rest = questionsToBoss(s);
    const head =
      `${ri.round}周目 ${ri.correct}/${ri.total}問正解` +
      (this.review ? '　【ふくしゅう】' : '') +
      (nextBoss(s) ? (rest > 0 ? `\nボスまで あと${rest}問` : '\nボスせん かいほう中') : '');
    txt(this, L.W - 52, 18 + hh / 2, head, P ? 22 : 22, '#ffffff', { align: 'right' }).setOrigin(1, 0.5);

    // 問題文
    const qy = 18 + hh + 14;
    const qh = P ? 240 : 170;
    windowBox(this, 24, qy, L.W - 48, qh);
    const tag = this.q.format === 'multiple' ? '【2つ選べ】 ' : '';
    const stemT = txt(this, 56, qy + 20, '', 30, '#ffffff', { lineSpacing: 8 });
    fitText(stemT, tag + this.q.question, 30, L.W - 112, qh - 36, 16);

    // 選択肢
    const cy0 = qy + qh + 16;
    const cw = P ? L.W - 48 : (L.W - 48 - 16) / 2;
    const chh = P ? 100 : 112;
    this.order.forEach((orig, i) => {
      const x = P ? 24 : 24 + (i % 2) * (cw + 16);
      const y = P ? cy0 + i * (chh + 10) : cy0 + Math.floor(i / 2) * (chh + 14);
      const b = button(this, x, y, cw, chh, `${MARKS[i]} ${this.q.choices[orig].text}`, () => this.tap(i), {
        size: P ? 27 : 28,
        align: 'left',
        wrap: true,
      });
      this.btns.push(b);
    });

    if (this.q.format === 'multiple') {
      const cy = P ? cy0 + 4 * (chh + 10) + 6 : cy0 + 2 * (chh + 14) + 4;
      const w = P ? L.W - 48 : 520;
      this.confirm = button(this, P ? 24 : (L.W - w) / 2, cy, w, P ? 90 : 66, '', () => this.submit(), { size: 30, enabled: false });
      this.updateConfirm();
    }

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && !this.answered) this.tap(n - 1);
      if (e.key === 'Enter' && this.confirm) this.submit();
    });
  }

  private updateConfirm() {
    if (!this.confirm) return;
    const n = this.picked.size;
    this.confirm.setLabel(n === 2 ? 'この2つで 確定する' : `えらんだ数 ${n}/2　（2つ えらぶと 確定できる）`);
    this.confirm.setEnabled(n === 2);
    this.confirm.setState(n === 2 ? 'selected' : 'normal');
  }

  private tap(i: number) {
    if (this.answered || !this.q) return;
    if (this.q.format === 'single') {
      this.submit([i]);
      return;
    }
    // 四肢択二: トグル選択。3つ目は選べない（押し間違い防止）
    if (this.picked.has(i)) this.picked.delete(i);
    else if (this.picked.size < 2) this.picked.add(i);
    else return;
    this.btns.forEach((b, k) => b.setState(this.picked.has(k) ? 'selected' : 'normal'));
    this.updateConfirm();
  }

  private submit(sel?: number[]) {
    if (this.answered) return;
    const chosen = sel ?? [...this.picked];
    const need = this.q.format === 'multiple' ? 2 : 1;
    if (chosen.length !== need) return;
    this.answered = true;
    this.confirm?.c.destroy();
    this.confirm = null;
    const P = L.portrait;
    const s = getSave();
    const genre = GENRES.find((g) => g.id === this.genreId)!;
    const pickedIds = chosen.map((k) => this.q.choices[this.order[k]].id);
    const ok = isCorrect(this.q, pickedIds);

    this.btns.forEach((b, k) => {
      const id = this.q.choices[this.order[k]].id;
      const isAns = this.q.correctAnswerIds.includes(id);
      const wasPicked = chosen.includes(k);
      b.setEnabled(false);
      if (isAns || wasPicked) {
        b.setEnabled(true);
        b.setState(isAns ? 'ok' : 'ng');
        b.setActive(false);
      }
    });

    const wasFirst = !s.firstSeen.includes(this.q.id);
    const r = recordAnswer(s, this.q, ok);
    const stat = genre.stat;

    const y0 = P ? 850 : 546;
    const h = P ? 390 : 160;
    windowBox(this, 24, y0, L.W - 48, h, ok ? 0x0b3a1e : 0x3a0f0f);
    txt(this, 56, y0 + 16, ok ? '◎ 正解！' : '× ざんねん…', P ? 40 : 36, ok ? '#9dffb8' : '#ff9d9d');
    let line: string;
    let lcol = '#cccccc';
    if (r.grew) {
      line = `${STAT_NAMES[stat]}  ${r.before} → ${r.before + 1}  （+1）`;
      lcol = STAT_CSS[stat];
    } else if (ok) {
      line = 'この周回では すでに 加算ずみ（能力は そのまま）';
    } else {
      line = `${STAT_NAMES[stat]}は あがらなかった（この周回で あとから正解すれば +1）`;
    }
    const lx = P ? 56 : 330;
    const ly = P ? y0 + 72 : y0 + 22;
    if (r.grew) this.add.image(lx, ly - 2, ICON[stat]).setOrigin(0, 0).setScale(2);
    const lt = txt(this, lx + (r.grew ? 36 : 0), ly, wrapJP(line, 26, L.W - lx - 60), 26, lcol);
    const shift = lt.height > 40 ? lt.height - 34 : 0;
    const exT = txt(this, 56, (P ? y0 + 124 : y0 + 66) + shift, '', 24, '#ffffff', { lineSpacing: 6 });
    fitText(exT, this.q.explanation, 24, P ? L.W - 112 : 900, (P ? 150 : 92) - shift, 14);

    const nb = nextBoss(s);
    const unlockedNow = wasFirst && !!nb && uniqueFirst(s) === mainUnlockAt(nb.order);
    const bw = P ? 300 : 220;
    button(this, L.W - 24 - bw - 16, y0 + h - (P ? 92 : 86), bw, 72, unlockedNow ? 'ホームへ' : 'つぎへ', () => {
      if (unlockedNow) go(this, 'Home', { unlocked: true });
      else go(this, 'Genre', r.roundCleared ? { cleared: r.roundCleared } : undefined);
    }, { size: 30 }).c.setDepth(20);
    if (!P) txt(this, 56, y0 + h - 40, '✔ 自動セーブ', 18, '#9ea8ff');

    if (ok) {
      sfx.correct();
      if (r.grew) {
        this.time.delayedCall(450, () => {
          sfx.statUp();
          floatText(this, L.W / 2, P ? 400 : 500, `${STAT_NAMES[stat]} +1`, STAT_CSS[stat], 64);
        });
      }
    } else {
      sfx.wrong();
      this.cameras.main.shake(250, 0.008);
    }
    if (r.roundCleared) {
      this.time.delayedCall(900, () => {
        sfx.win();
        const t = txt(this, L.W / 2, P ? 330 : 160, `${genre.name}\n${r.roundCleared!.round}周クリア → ${r.roundCleared!.round + 1}周目へ！`, 40, GOLD, {
          stroke: '#000',
          strokeThickness: 8,
          align: 'center',
        }).setOrigin(0.5).setDepth(60);
        this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 500, onComplete: () => t.destroy() });
      });
    }
  }
}
