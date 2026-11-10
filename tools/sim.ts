// 全クリア率シミュレーション: 5職業 × 正答率3水準(50/70/90%) × 育成3種 の通しプレイ（第1〜第5ボスを順に、各ボス初回挑戦のみ）
import fs from 'node:fs';
import { BOSSES, BossDef, MAIN_STEP } from '../src/config';
import { BASE_STAT, BEST_STAT, GENRES, JOBS, StatKey, Stats } from '../src/data';
import { QUESTIONS, questionsOf } from '../src/questions';
import * as B from '../src/battle';

export type Alloc = 'even' | 'biased' | 'focus';
export const ALLOCS: Alloc[] = ['even', 'biased', 'focus'];
export const ALLOC_NAME: Record<Alloc, string> = { even: '均等育成', biased: '2能力に偏り', focus: '得意に集中(6割)' };

/** 偏り・集中で「得意の次」に伸ばす能力(職業ごとに固定) */
const SECOND: Record<string, StatKey> = { def: 'mdef', atk: 'spd', mag: 'mdef', spd: 'atk', mdef: 'mag' };
const GENRE_OF = Object.fromEntries(GENRES.map((g) => [g.stat, g.id])) as Record<StatKey, string>;
const CAP = Object.fromEntries(GENRES.map((g) => [g.stat, questionsOf(g.id, QUESTIONS).length])) as Record<StatKey, number>;

/** 生涯で初めて回答する順番（ジャンル＝上昇能力）。各ジャンルは収録問題数が上限（同じ問題の再回答は解放に数えない） */
export function answerOrder(best: StatKey, alloc: Alloc, n: number): StatKey[] {
  const keys = Object.keys(CAP) as StatKey[];
  const used: Record<string, number> = {};
  const open = (k: StatKey) => (used[k] ?? 0) < CAP[k];
  const out: StatKey[] = [];
  const second = SECOND[best];
  const prio = [best, second, ...keys.filter((k) => k !== best && k !== second)];
  while (out.length < n) {
    let k: StatKey | undefined;
    if (alloc === 'even') k = [...keys].filter(open).sort((a, b) => (used[a] ?? 0) - (used[b] ?? 0))[0];
    else if (alloc === 'biased') {
      const pair = [best, second].filter(open);
      k = pair.length ? pair.sort((a, b) => (used[a] ?? 0) - (used[b] ?? 0))[0] : prio.find(open);
    } else {
      // 得意に集中: 6割を得意ジャンル、残り4割を他の能力へ均等に（上限に達したら他へ）
      const others = keys.filter((x) => x !== best && open(x)).sort((a, b) => (used[a] ?? 0) - (used[b] ?? 0));
      k = out.length % 5 < 3 && open(best) ? best : others[0] ?? prio.find(open);
    }
    if (!k) break;
    used[k] = (used[k] ?? 0) + 1;
    out.push(k);
  }
  return out;
}

export interface BattleLog {
  win: boolean;
  turns: number;
  heals: number;
  crits: number;
}

export function simulate(p: Stats, boss: BossDef, rnd: B.Rng = Math.random): BattleLog {
  const s = B.newBattle({ ...p }, boss);
  const log: BattleLog = { win: false, turns: 0, heals: 0, crits: 0 };
  const act = () => {
    const hitRate = B.playerHitRate(s);
    const critBoost = 1 + B.critRate(s.p.spd, boss.spd);
    const atkDmg = Math.max(1, s.p.atk * 2.0 + 12 - boss.def) * hitRate * critBoost;
    const fireDmg = Math.max(1, (s.p.mag * 1.9 + 14) * boss.fireMult - boss.mdef);
    const strongHeal = Math.min(B.healAmount(s.p.mdef), s.maxHp * 0.6) >= s.maxHp * 0.4;
    if (s.hp < s.maxHp * 0.4 && s.mp >= B.COST_SUIJUKU) {
      log.heals++;
      B.playerSuijuku(s, rnd);
      return;
    }
    // 回復が強い職業は、MPが尽きかけたら「しゅうちゅう」でMPを戻して粘る
    if (strongHeal && s.hp < s.maxHp * 0.55 && s.mp < B.COST_SUIJUKU) {
      B.playerFocus(s);
      return;
    }
    // 回復が強い職業は、回復用のMPを残してから攻撃魔法を使う
    const reserve = Math.min(B.healAmount(s.p.mdef), s.maxHp * 0.6) >= s.maxHp * 0.4 ? B.COST_SUIJUKU * 2 : 0;
    if (s.mp >= B.COST_BENGARI + reserve && fireDmg > atkDmg) {
      B.playerBengari(s, rnd);
      return;
    }
    if (s.mp < B.COST_BENGARI && s.maxMp >= 14 && fireDmg / 1.6 > atkDmg) {
      B.playerFocus(s);
      return;
    }
    if (s.hp < s.maxHp * 0.3 && s.mp < B.COST_SUIJUKU) {
      s.defending = true;
      return;
    }
    const r = B.playerAttack(s, rnd);
    if (r.crit) log.crits++;
  };
  for (let t = 0; t < 150; t++) {
    log.turns++;
    s.defending = false;
    B.updateForm(s);
    const first = B.playerFirst(s, rnd);
    if (first) {
      act();
      if (s.bossHp <= 0) {
        log.win = true;
        return log;
      }
    }
    B.updateForm(s);
    const mv = B.bossChoose(s, rnd);
    B.bossAct(s, mv, rnd);
    if (s.hp <= 0) return log;
    if (!first) {
      act();
      if (s.bossHp <= 0) {
        log.win = true;
        return log;
      }
    }
  }
  return log;
}

export interface RunResult {
  job: string;
  acc: number;
  alloc: Alloc;
  trials: number;
  /** 5体すべて撃破した割合（通しプレイ・各ボス初回のみ） */
  fullClear: number;
  /** ボスkに初回挑戦で勝つ割合（ボスk-1まで撃破しているとは限らず、各ボスを独立に判定） */
  bossWin: number[];
}

/** 1試行: 10問ずつ回答→ボス挑戦、を第1〜第5ボスまで。敗北した時点で全クリア失敗（残りは独立判定のため続行して記録） */
export function trial(job: (typeof JOBS)[number], acc: number, alloc: Alloc, rnd: B.Rng): { wins: boolean[] } {
  const order = answerOrder(job.best, alloc, BOSSES.length * MAIN_STEP);
  const st: Stats = { atk: BASE_STAT, def: BASE_STAT, mag: BASE_STAT, mdef: BASE_STAT, spd: BASE_STAT };
  st[job.best] = BEST_STAT;
  const wins: boolean[] = [];
  BOSSES.forEach((boss, k) => {
    for (let i = k * MAIN_STEP; i < (k + 1) * MAIN_STEP; i++) if (rnd() < acc) st[order[i]]++;
    wins.push(simulate(st, boss, rnd).win);
  });
  return { wins };
}

export function runAll(trials = 1000): RunResult[] {
  const res: RunResult[] = [];
  for (const j of JOBS)
    for (const acc of [0.5, 0.7, 0.9])
      for (const alloc of ALLOCS) {
        const bw = BOSSES.map(() => 0);
        let clear = 0;
        for (let i = 0; i < trials; i++) {
          const { wins } = trial(j, acc, alloc, Math.random);
          wins.forEach((w, k) => w && bw[k]++);
          if (wins.every(Boolean)) clear++;
        }
        res.push({ job: j.id, acc, alloc, trials, fullClear: clear / trials, bossWin: bw.map((x) => x / trials) });
      }
  return res;
}

const pct = (x: number) => String(Math.round(x * 100)).padStart(3) + '%';
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

export function summary(res: RunResult[]): string {
  let out = '';
  for (const acc of [0.5, 0.7, 0.9]) {
    const sub = res.filter((r) => r.acc === acc);
    const byAlloc = ALLOCS.map((a) => `${ALLOC_NAME[a]} ${pct(mean(sub.filter((r) => r.alloc === a).map((r) => r.fullClear)))}`);
    const byJob = JOBS.map((j) => `${j.name} ${pct(mean(sub.filter((r) => r.job === j.id).map((r) => r.fullClear)))}`);
    out += `正答率${acc * 100}%: 全職業平均 ${pct(mean(sub.map((r) => r.fullClear)))}（${byAlloc.join(' / ')}）\n   職業別: ${byJob.join(' ')}\n`;
  }
  return out;
}

const isMain = process.argv[1]?.includes('sim');
if (isMain) {
  const trials = Number(process.env.TRIALS ?? 1000);
  const res = runAll(trials);
  console.log(summary(res));
  if (process.env.DETAIL) {
    for (const acc of [0.5, 0.9])
      for (const a of ['even', 'biased'] as Alloc[])
        for (const j of JOBS) {
          const r = res.find((x) => x.job === j.id && x.acc === acc && x.alloc === a)!;
          console.log(`${acc * 100}% ${a.padEnd(6)} ${j.name.padEnd(4, '　')} ${r.bossWin.map(pct).join(' ')}  clear ${pct(r.fullClear)}`);
        }
  }
  if (process.env.REPORT) {
    fs.mkdirSync('docs', { recursive: true });
    fs.writeFileSync('docs/balance_sim.json', JSON.stringify(res));
    let md = `# 戦闘バランス シミュレーション結果\n\n条件: 5職業 × 正答率3水準(50/70/90%) × 育成3種 = 45条件、各条件 ${trials} 試行（計 ${45 * trials} 通しプレイ）。\n`;
    md += '各試行は「10問回答 → 第1ボス挑戦 → 10問回答 → 第2ボス … → 第5ボス（3形態）」を各ボス初回挑戦のみで通す。1問ごとに正答率どおりに正誤を乱数で決め、正解した分だけ対応能力+1。ボス挑戦前の追加周回は含めない。\n';
    md += '戦闘AIは、回復(スイジュク)・たたかう/ベンガリの選択・しゅうちゅう・ぼうぎょを使う。\n\n';
    md += `## 1. 全クリア率（全職業平均）\n\n| 正答率 | ${ALLOCS.map((a) => ALLOC_NAME[a]).join(' | ')} | 全体 |\n|---|---|---|---|---|\n`;
    for (const acc of [0.5, 0.7, 0.9]) {
      const sub = res.filter((r) => r.acc === acc);
      md += `| ${acc * 100}% | ${ALLOCS.map((a) => pct(mean(sub.filter((r) => r.alloc === a).map((r) => r.fullClear)))).join(' | ')} | **${pct(mean(sub.map((r) => r.fullClear))).trim()}** |\n`;
    }
    md += `\n## 2. 職業別の全クリア率\n\n| 職業 | 正答率 | ${ALLOCS.map((a) => ALLOC_NAME[a]).join(' | ')} |\n|---|---|---|---|---|\n`;
    for (const j of JOBS)
      for (const acc of [0.5, 0.7, 0.9])
        md += `| ${j.name} | ${acc * 100}% | ${ALLOCS.map((a) => pct(res.find((r) => r.job === j.id && r.acc === acc && r.alloc === a)!.fullClear)).join(' | ')} |\n`;
    for (const acc of [0.5, 0.7, 0.9]) {
      md += `\n## 3. 各ボスに対する職業別勝率（正答率${acc * 100}%）\n\n| 職業 | 育成 | ${BOSSES.map((b) => b.order + '.' + b.name.slice(0, 6)).join(' | ')} |\n|---|---|${BOSSES.map(() => '---').join('|')}|\n`;
      for (const j of JOBS)
        for (const a of ALLOCS) {
          const r = res.find((x) => x.job === j.id && x.acc === acc && x.alloc === a)!;
          md += `| ${j.name} | ${ALLOC_NAME[a]} | ${r.bossWin.map(pct).join(' | ')} |\n`;
        }
    }
    md += '\n## 4. 調整前後の比較（全職業×3育成の平均 全クリア率）\n\n';
    md += '| 正答率 | 調整前（新しい素早さ・魔法防御・回復式を入れ、ボス能力は旧10体構成のままの初期値） | 調整後（本ビルド） |\n|---|---|---|\n';
    const before: Record<number, number> = { 0.5: 0, 0.7: 0, 0.9: 1 };
    for (const acc of [0.5, 0.7, 0.9]) md += `| ${acc * 100}% | ${before[acc]}% | ${pct(mean(res.filter((r) => r.acc === acc).map((r) => r.fullClear))).trim()} |\n`;
    md += '\n調整内容: 物理ダメージに底上げ(+12)、防御係数1.5→2.0、回復式を「基礎12+魔法防御×3.5（最大HPの60%まで）」、回復MP 5、MP基礎16、しゅうちゅうのMP回復20%、ボスの攻撃/魔法倍率と各ボスのHP・素早さ・技を再調整。\n';
    md += '\n## 5. 素早さ差と物理攻撃の成功率（攻撃側の基本命中率0.92、回避ボーナス0）\n\n| 素早さ差(攻撃側−防御側) | 命中率 | 相手の回避率 | 最終成功率 | 会心率 |\n|---:|---:|---:|---:|---:|\n';
    for (const d of [-20, -15, -10, -5, 0, 5, 10, 15, 20, 30]) {
      const h = B.hitRate(0.92, 20 + d, 20);
      const e = B.evadeRate(20 + d, 20);
      md += `| ${d >= 0 ? '+' : ''}${d} | ${(h * 100).toFixed(0)}% | ${(e * 100).toFixed(0)}% | ${(B.attackSuccess(0.92, 20 + d, 20) * 100).toFixed(0)}% | ${(B.critRate(20 + d, 20) * 100).toFixed(0)}% |\n`;
    }
    fs.writeFileSync('docs/balance_report.md', md);
  }
}
