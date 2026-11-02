import { ALL_BOSS_IDS, BOSSES, ENHANCE, MAIN_STEP, maxHp, maxMp } from './config';
import { BASE_STAT, BEST_STAT, GENRES, GenreId, JOBS, JobId, Stats } from './data';
import { QUESTIONS, Question, questionsOf } from './questions';

export type Rng = () => number;

/** 問題ごとの履歴（周回をまたいで残す） */
export interface QHistory {
  /** 回答回数(attempts) */
  n: number;
  /** 正解回数 */
  c: number;
  /** 直近の回答が正解だったか */
  lastOk: boolean;
  /** 最後に能力+1を付与した周回番号（0=未付与） */
  creditedRound: number;
}

/** ジャンルごとの現在の周回 */
export interface RoundState {
  round: number;
  /** この周回の出題対象（開始時に確定・シャッフル済み。周回中は固定） */
  pool: string[];
  /** この周回で1回以上回答した問題 */
  seen: string[];
  /** この周回で正解した問題 */
  correct: string[];
  /** この周回で能力+1を付与した問題 */
  credited: string[];
  /** 直前に出した問題（連続出題の回避用） */
  last: string | null;
}

export interface RoundLogEntry {
  round: number;
  answered: number;
  correct: number;
}

export interface SaveData {
  v: 3;
  job: JobId;
  stats: Stats;
  hp: number;
  mp: number;
  history: Record<string, QHistory>;
  rounds: Record<GenreId, RoundState>;
  roundsCleared: Record<GenreId, number>;
  roundLog: Record<GenreId, RoundLogEntry[]>;
  /** 生涯で初めて回答した異なる問題ID（本編ボス解放の指標） */
  firstSeen: string[];
  /** 各周回内で初めて回答した問題の累計（強化ボス解放の指標） */
  validTotal: number;
  /** 回答総数（再回答も数える。正答率表示用） */
  answered: number;
  correct: number;
  wrong: number;
  perGenre: Record<GenreId, { answered: number; correct: number }>;
  /** 撃破済みボスの安定ID */
  defeated: string[];
  /** 撃破済み強化ボス: `${bossId}#${series}` */
  enhancedDefeated: string[];
  bossTries: Record<string, number>;
}

const KEY = 'kankouji-rpg.save.v1'; // 初期から同じキーを使い、中身だけ移行する
const BACKUP_V1 = 'kankouji-rpg.save.v1.backup';
const BACKUP_V2 = 'kankouji-rpg.save.v2.backup';

const shuffle = <T,>(a: T[], rnd: Rng): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

const emptyPerGenre = () => {
  const o = {} as SaveData['perGenre'];
  GENRES.forEach((g) => (o[g.id] = { answered: 0, correct: 0 }));
  return o;
};
const emptyMap = <T,>(f: () => T) => {
  const o = {} as Record<GenreId, T>;
  GENRES.forEach((g) => (o[g.id] = f()));
  return o;
};

function startRoundState(genre: GenreId, prevRound: number, qs: Question[], rnd: Rng): RoundState {
  return { round: prevRound + 1, pool: shuffle(questionsOf(genre, qs).map((q) => q.id), rnd), seen: [], correct: [], credited: [], last: null };
}

export function newSave(job: JobId, qs: Question[] = QUESTIONS, rnd: Rng = Math.random): SaveData {
  const def = JOBS.find((j) => j.id === job)!;
  const stats: Stats = { atk: BASE_STAT, def: BASE_STAT, mag: BASE_STAT, mdef: BASE_STAT, spd: BASE_STAT };
  stats[def.best] = BEST_STAT;
  return {
    v: 3,
    job,
    stats,
    hp: maxHp(stats),
    mp: maxMp(stats),
    history: {},
    rounds: emptyMap(() => ({ round: 0, pool: [], seen: [], correct: [], credited: [], last: null })),
    roundsCleared: emptyMap(() => 0),
    roundLog: emptyMap(() => []),
    firstSeen: [],
    validTotal: 0,
    answered: 0,
    correct: 0,
    wrong: 0,
    perGenre: emptyPerGenre(),
    defeated: [],
    enhancedDefeated: [],
    bossTries: {},
  };
}

// ---------------------------------------------------------------- マイグレーション
interface SaveV1 {
  v: 1;
  job: JobId;
  stats: Stats;
  answered: string[];
  correct: number;
  wrong: number;
  perGenre: SaveData['perGenre'];
  bossTries: number;
  bossCleared: boolean;
}
interface SaveV2 {
  v: 2;
  job: JobId;
  stats: Stats;
  hp: number;
  mp: number;
  history: Record<string, { n: number; c: number; lastOk: boolean; grown: boolean }>;
  answered: number;
  correct: number;
  wrong: number;
  perGenre: SaveData['perGenre'];
  defeated: string[];
  bossTries: Record<string, number>;
}

export function migrateV1toV2(old: SaveV1): SaveV2 {
  const history: SaveV2['history'] = {};
  // v1 は正誤の内訳を持たないため、回答済みの問題は「能力加算済み」として扱う（新たな成長の根拠にしない）
  (old.answered ?? []).forEach((id) => (history[id] = { n: 1, c: 1, lastOk: true, grown: true }));
  const stats = { ...old.stats };
  return {
    v: 2,
    job: old.job,
    stats,
    hp: maxHp(stats),
    mp: maxMp(stats),
    history,
    answered: (old.answered ?? []).length,
    correct: old.correct ?? 0,
    wrong: old.wrong ?? 0,
    perGenre: { ...emptyPerGenre(), ...old.perGenre },
    defeated: old.bossCleared ? ['barbulock'] : [],
    bossTries: old.bossTries ? { barbulock: old.bossTries } : {},
  };
}

export function migrateV2toV3(old: SaveV2, qs: Question[] = QUESTIONS, rnd: Rng = Math.random): SaveData {
  const s = newSave(old.job, qs, rnd);
  s.stats = { ...old.stats };
  s.hp = old.hp ?? maxHp(old.stats);
  s.mp = old.mp ?? maxMp(old.stats);
  s.answered = old.answered ?? 0;
  s.correct = old.correct ?? 0;
  s.wrong = old.wrong ?? 0;
  s.perGenre = { ...emptyPerGenre(), ...old.perGenre };
  // 旧ボスは「安定ID」で引き継ぐ（配列番号は使わない）。存在しないIDは無視
  const known = new Set(ALL_BOSS_IDS); // 本編から外した保管ボスの撃破記録も保持する
  s.defeated = (old.defeated ?? []).filter((id) => known.has(id));
  s.bossTries = { ...(old.bossTries ?? {}) };
  for (const [id, h] of Object.entries(old.history ?? {})) {
    s.history[id] = { n: h.n, c: h.c, lastOk: h.lastOk, creditedRound: h.grown ? 1 : 0 };
    s.firstSeen.push(id);
  }
  // 1周目として開始。加算済み(grown)の問題は「正解・付与済み」、誤答のみの問題は「回答済み・未正解」。
  // 正誤が不明な問題を推測して新たな成長の根拠にはしない。
  let seenTotal = 0;
  for (const g of GENRES) {
    const r = startRoundState(g.id, 0, qs, rnd);
    for (const id of r.pool) {
      const h = old.history?.[id];
      if (!h) continue;
      r.seen.push(id);
      seenTotal++;
      if (h.grown) {
        r.correct.push(id);
        r.credited.push(id);
      }
    }
    s.rounds[g.id] = r;
  }
  s.validTotal = seenTotal;
  return s;
}

/** 旧データを現行形式(v3)へ。不明な形式は null */
export function migrate(raw: unknown, qs: Question[] = QUESTIONS, rnd: Rng = Math.random): SaveData | null {
  const d = raw as { v?: number } | null;
  if (!d || typeof d !== 'object') return null;
  if (d.v === 3) return d as SaveData;
  if (d.v === 2) return migrateV2toV3(d as unknown as SaveV2, qs, rnd);
  if (d.v === 1) return migrateV2toV3(migrateV1toV2(d as unknown as SaveV1), qs, rnd);
  return null;
}

// ---------------------------------------------------------------- 保存
let current: SaveData | null = null;
export let lastLoadError: string | null = null;

export function getSave(): SaveData {
  if (!current) throw new Error('no save');
  return current;
}
export function setSave(s: SaveData): void {
  current = s;
  persist();
}

export function persist(): boolean {
  if (!current) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
}

export function loadSave(): SaveData | null {
  lastLoadError = null;
  let rawText: string | null = null;
  try {
    rawText = localStorage.getItem(KEY);
    if (!rawText) return null;
    const parsed = JSON.parse(rawText);
    if (parsed?.v === 1 && !localStorage.getItem(BACKUP_V1)) localStorage.setItem(BACKUP_V1, rawText);
    if (parsed?.v === 2 && !localStorage.getItem(BACKUP_V2)) localStorage.setItem(BACKUP_V2, rawText);
    const d = migrate(parsed);
    if (!d) {
      lastLoadError = '未対応のセーブ形式です（データは削除していません）';
      return null;
    }
    // 検証: 能力値と撃破状況が移行前と一致すること。不一致なら移行を取り消して元データを残す
    if (parsed.v !== 3) {
      const before = parsed.stats as Stats;
      const okStats = (Object.keys(before) as (keyof Stats)[]).every((k) => d.stats[k] === before[k]);
      if (!okStats) throw new Error('migration verification failed');
    }
    current = d;
    if (parsed.v !== 3) persist();
    return d;
  } catch (e) {
    lastLoadError = 'セーブデータの移行に失敗しました。元のデータは残してあります。';
    console.error(e);
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function clearSave(): void {
  current = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- 周回・出題エンジン
function ensureRound(s: SaveData, g: GenreId, qs: Question[], rnd: Rng): RoundState {
  let r = s.rounds[g];
  const existing = new Set(questionsOf(g, qs).map((q) => q.id));
  if (!r || r.round === 0) {
    r = s.rounds[g] = startRoundState(g, 0, qs, rnd);
  } else if (r.pool.filter((id) => existing.has(id)).length === 0 && existing.size > 0) {
    // 出題対象が全て削除された場合などは次の周回へ
    r = s.rounds[g] = startRoundState(g, r.round, qs, rnd);
  }
  return r;
}

export interface RoundInfo {
  round: number;
  total: number;
  correct: number;
  seen: number;
  prepared: boolean;
}

export function roundInfo(s: SaveData, g: GenreId, qs: Question[] = QUESTIONS): RoundInfo {
  const exist = new Set(questionsOf(g, qs).map((q) => q.id));
  const r = s.rounds[g];
  if (!r || r.round === 0) {
    return { round: 1, total: exist.size, correct: 0, seen: 0, prepared: exist.size > 0 };
  }
  const pool = r.pool.filter((id) => exist.has(id));
  return {
    round: r.round,
    total: pool.length,
    correct: pool.filter((id) => r.correct.includes(id)).length,
    seen: pool.filter((id) => r.seen.includes(id)).length,
    prepared: pool.length > 0,
  };
}

export interface Pick {
  q: Question;
  round: number;
  /** 未回答の問題か（falseなら誤答の復習） */
  fresh: boolean;
}

/** 優先順位: ①この周回の未回答 → ②この周回で不正解かつ未正解。正解済みは出さない */
export function pickQuestion(s: SaveData, g: GenreId, qs: Question[] = QUESTIONS, rnd: Rng = Math.random): Pick | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = ensureRound(s, g, qs, rnd);
    const byId = new Map(questionsOf(g, qs).map((q) => [q.id, q]));
    const pool = r.pool.filter((id) => byId.has(id));
    if (pool.length === 0) return null; // 問題準備中
    const unseen = pool.filter((id) => !r.seen.includes(id));
    if (unseen.length) return { q: byId.get(unseen[0])!, round: r.round, fresh: true };
    const wrong = pool.filter((id) => !r.correct.includes(id));
    if (wrong.length) {
      const cand = wrong.length > 1 ? wrong.filter((id) => id !== r.last) : wrong;
      const id = cand[Math.floor(rnd() * cand.length)];
      return { q: byId.get(id)!, round: r.round, fresh: false };
    }
    // 全問正解済み（移行直後など）: 次の周回へ進めて再試行
    s.roundsCleared[g]++;
    s.rounds[g] = startRoundState(g, r.round, qs, rnd);
  }
  return null;
}

export interface AnswerResult {
  grew: boolean;
  before: number;
  firstEver: boolean;
  newInRound: boolean;
  roundCleared: { genre: GenreId; round: number } | null;
}

/** 回答を記録する。同じ周回での二重加算・連打・再読込に耐える */
export function recordAnswer(s: SaveData, q: Question, ok: boolean, qs: Question[] = QUESTIONS, rnd: Rng = Math.random): AnswerResult {
  const g = q.genre;
  const r = ensureRound(s, g, qs, rnd);
  const stat = GENRES.find((x) => x.id === g)!.stat;
  const before = s.stats[stat];
  const h = (s.history[q.id] ??= { n: 0, c: 0, lastOk: false, creditedRound: 0 });
  const firstEver = !s.firstSeen.includes(q.id);
  if (firstEver) s.firstSeen.push(q.id);
  const newInRound = !r.seen.includes(q.id);
  if (newInRound) {
    r.seen.push(q.id);
    s.validTotal++;
  }
  h.n++;
  h.lastOk = ok;
  r.last = q.id;
  s.answered++;
  s.perGenre[g].answered++;
  let grew = false;
  if (ok) {
    h.c++;
    s.correct++;
    s.perGenre[g].correct++;
    if (!r.correct.includes(q.id)) r.correct.push(q.id);
    if (!r.credited.includes(q.id)) {
      r.credited.push(q.id);
      h.creditedRound = r.round;
      s.stats[stat]++;
      grew = true;
      s.hp = maxHp(s.stats);
      s.mp = maxMp(s.stats);
    }
  } else {
    s.wrong++;
  }
  // 周回クリア判定
  let roundCleared: AnswerResult['roundCleared'] = null;
  const exist = new Set(questionsOf(g, qs).map((x) => x.id));
  const pool = r.pool.filter((id) => exist.has(id));
  if (pool.length > 0 && pool.every((id) => r.correct.includes(id))) {
    s.roundsCleared[g]++;
    s.roundLog[g].push({ round: r.round, answered: r.seen.length, correct: r.correct.length });
    roundCleared = { genre: g, round: r.round };
    s.rounds[g] = startRoundState(g, r.round, qs, rnd);
  }
  persist();
  return { grew, before, firstEver, newInRound, roundCleared };
}

// ---------------------------------------------------------------- ボス進行
export const uniqueFirst = (s: SaveData) => s.firstSeen.length;
export const mainUnlockAt = (order: number) => order * MAIN_STEP;
export const mainUnlocked = (s: SaveData, order: number) => uniqueFirst(s) >= mainUnlockAt(order);

/** 次に挑戦する本編ボス（全撃破ならnull） */
export function nextBoss(s: SaveData) {
  return BOSSES.find((b) => !s.defeated.includes(b.id)) ?? null;
}
export function questionsToBoss(s: SaveData): number {
  const b = nextBoss(s);
  return b ? Math.max(0, mainUnlockAt(b.order) - uniqueFirst(s)) : 0;
}
export function bossUnlocked(s: SaveData): boolean {
  const b = nextBoss(s);
  return !!b && mainUnlocked(s, b.order);
}
export const mainCleared = (s: SaveData) => BOSSES.every((b) => s.defeated.includes(b.id));

/** 強化ボス: シリーズ s(1〜) の i 体目は、有効回答 110 + (s-1)*(ボス数*10) + (i-1)*10 以上で解放 */
export function enhancedThreshold(series: number, order: number): number {
  return ENHANCE.firstThreshold + (series - 1) * BOSSES.length * MAIN_STEP + (order - 1) * MAIN_STEP;
}
export const enhancedId = (bossId: string, series: number) => `${bossId}#${series}`;
export function enhancedUnlocked(s: SaveData, series: number, order: number): boolean {
  return s.validTotal >= enhancedThreshold(series, order);
}

/** 直近の回答が不正解のままの問題数（ふくしゅう対象） */
export function wrongCount(s: SaveData, qs: Question[] = QUESTIONS): number {
  const ids = new Set(qs.map((q) => q.id));
  return Object.entries(s.history).filter(([id, h]) => ids.has(id) && !h.lastOk).length;
}
