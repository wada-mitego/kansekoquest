import { BALANCE as B, BossDef, Move, maxHp, maxMp } from './config';
import type { Stats } from './data';

export type Rng = () => number;

export const COST_BENGARI = B.costBengari;
export const COST_SUIJUKU = B.costSuijuku;

export interface BattleState {
  p: Stats;
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
  boss: BossDef;
  bossHp: number;
  defending: boolean;
  focus: boolean;
  turn: number;
  /** 0=通常形態, 1以上=boss.forms[idx-1] */
  formIdx: number;
}

export function newBattle(p: Stats, boss: BossDef): BattleState {
  return {
    p,
    hp: maxHp(p),
    mp: maxMp(p),
    maxHp: maxHp(p),
    maxMp: maxMp(p),
    boss,
    bossHp: boss.hp,
    defending: false,
    focus: false,
    turn: 1,
    formIdx: 0,
  };
}

const jitter = (r: Rng) => 1 - B.jitter + r() * B.jitter * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function playerFirst(s: BattleState, r: Rng): boolean {
  return s.p.spd + r() * 10 >= s.boss.spd + (s.boss.initiative ?? 0) + r() * 10;
}

// ---- 素早さによる命中・回避・会心（攻撃側 a / 防御側 d の素早さ）
/** 命中率: 基本命中率 + 素早さ差 × hitPerSpd */
export const hitRate = (acc: number, a: number, d: number) => clamp(acc + (a - d) * B.hitPerSpd, B.hitMin, B.hitMax);
/** 回避率: 防御側が速いほど上昇（上限 evadeCap） */
export const evadeRate = (a: number, d: number, bonus = 0) => clamp((d - a) * B.evadePerSpd + bonus, 0, B.evadeCap);
/** 会心率: 素早さ差に比例（上限・下限あり） */
export const critRate = (a: number, d: number) => clamp(B.critBase + (a - d) * B.critPerSpd, B.critMin, B.critMax);
/** 物理攻撃が当たる確率（命中 × (1−回避)） */
export const attackSuccess = (acc: number, a: number, d: number, evadeBonus = 0) => hitRate(acc, a, d) * (1 - evadeRate(a, d, evadeBonus));

/** プレイヤーの物理攻撃の最終成功率（命中×(1−ボス回避)） */
export function playerHitRate(s: BattleState): number {
  return attackSuccess(B.playerBaseHit, s.p.spd, s.boss.spd, s.boss.evasion);
}

/** 魔法ダメージ軽減率（魔法防御が高いほど大きいが上限あり） */
export const magicReduction = (mdef: number) => Math.min(B.mdefCap, mdef / (mdef + B.mdefK));
/** 回復量（上限前）= 基礎回復量 + 魔法防御による追加回復 */
export const healAmount = (mdef: number) => B.healBase + mdef * B.healPerMdef;

export interface AttackResult {
  hit: boolean;
  dmg: number;
  crit: boolean;
}
export function playerAttack(s: BattleState, r: Rng): AttackResult {
  const focused = s.focus;
  s.focus = false;
  if (!focused && r() > playerHitRate(s)) return { hit: false, dmg: 0, crit: false };
  const crit = r() < critRate(s.p.spd, s.boss.spd);
  let dmg = (s.p.atk * B.playerAtkPower + B.playerAtkBase - s.boss.def) * jitter(r);
  if (focused) dmg *= B.focusMult;
  dmg = Math.max(1, Math.round(dmg));
  if (crit) dmg *= B.critMult; // 通常ダメージ計算後に2倍
  s.bossHp = Math.max(0, s.bossHp - dmg);
  return { hit: true, dmg, crit };
}
export function playerBengari(s: BattleState, r: Rng): { dmg: number } {
  s.mp -= COST_BENGARI;
  const focused = s.focus;
  s.focus = false;
  let dmg = (s.p.mag * B.bengariPerMag + B.bengariBase) * s.boss.fireMult * jitter(r) - s.boss.mdef;
  if (focused) dmg *= B.focusMult;
  dmg = Math.max(1, Math.round(dmg));
  s.bossHp = Math.max(0, s.bossHp - dmg);
  return { dmg };
}

export function playerSuijuku(s: BattleState, r: Rng): { heal: number } {
  s.mp -= COST_SUIJUKU;
  const raw = Math.round(healAmount(s.p.mdef) * jitter(r));
  const heal = Math.max(0, Math.min(raw, Math.round(s.maxHp * B.healCapRatio), s.maxHp - s.hp));
  s.hp += heal;
  return { heal };
}
export function playerFocus(s: BattleState): { mp: number } {
  const gain = Math.min(Math.ceil(s.maxMp * B.focusMpRatio), s.maxMp - s.mp);
  s.mp += gain;
  s.focus = true;
  return { mp: gain };
}

/** HPが閾値を下回ったら形態を進める。変化したらラベルを返す */
export function updateForm(s: BattleState): string | null {
  const forms = s.boss.forms;
  if (!forms) return null;
  const ratio = s.bossHp / s.boss.hp;
  let idx = 0;
  forms.forEach((f, i) => {
    if (ratio <= f.hpBelow) idx = i + 1;
  });
  if (idx > s.formIdx && s.bossHp > 0) {
    s.formIdx = idx;
    return forms[idx - 1].label;
  }
  return null;
}

export const currentMoves = (s: BattleState): Move[] =>
  s.formIdx > 0 && s.boss.forms ? s.boss.forms[s.formIdx - 1].moves : s.boss.moves;

export function bossChoose(s: BattleState, r: Rng): Move {
  const moves = currentMoves(s);
  const total = moves.reduce((a, m) => a + m.weight, 0);
  let v = r() * total;
  for (const m of moves) {
    v -= m.weight;
    if (v <= 0) return m;
  }
  return moves[0];
}

export interface BossResult {
  hit: boolean;
  dmg: number;
  magic: boolean;
  /** 命中した回数（連続攻撃用） */
  hits: number;
  /** 攻撃の総回数 */
  swings: number;
  /** 会心が出た回数 */
  crits: number;
}
/** ボスの物理攻撃がプレイヤーに当たる確率（命中×(1−プレイヤー回避)） */
export function bossHitChance(s: BattleState, move: Move): number {
  const b = s.boss;
  const acc = hitRate(move.acc, b.spd, s.p.spd);
  return acc * (1 - (b.ignoreEvade ? 0 : evadeRate(b.spd, s.p.spd)));
}
export function bossAct(s: BattleState, move: Move, r: Rng): BossResult {
  const b = s.boss;
  const magic = move.kind === 'magic';
  const swings = magic ? 1 : move.hits ?? 1;
  let total = 0;
  let hits = 0;
  let crits = 0;
  for (let i = 0; i < swings; i++) {
    let dmg: number;
    if (!magic) {
      if (r() > bossHitChance(s, move)) continue;
      dmg = (b.atk * move.power - s.p.def * B.defFactor) * jitter(r);
      dmg = Math.max(1, dmg);
      if (r() < critRate(b.spd, s.p.spd)) {
        dmg *= B.critMult;
        crits++;
      }
    } else {
      dmg = b.mag * move.power * (1 - magicReduction(s.p.mdef)) * jitter(r);
    }
    if (s.defending) dmg *= B.defendMult;
    dmg = Math.max(1, Math.round(dmg));
    s.hp = Math.max(0, s.hp - dmg);
    total += dmg;
    hits++;
    if (s.hp <= 0) break;
  }
  return { hit: hits > 0, dmg: total, magic, hits, swings, crits };
}