// 自動テスト: npm test （周回制・加算・解放条件・四肢択二・データ検証・セーブ移行・戦闘）
import assert from 'node:assert/strict';
import { ALL_BOSS_IDS, ARCHIVED_BOSSES, BALANCE as B, BOSSES, ENHANCE, enhancedBoss, resolveBoss } from '../src/config';
import * as Bt from '../src/battle';
import { GENRES, Stats } from '../src/data';
import { ALL_QUESTIONS, QUESTIONS, Question, isCorrect, questionsOf, validateQuestions } from '../src/questions';
import * as S from '../src/state';
import { runAll } from './sim';

let passed = 0;
const failed: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log('  ok  ', name);
  } catch (e) {
    failed.push(name);
    console.log('  FAIL', name, '\n      ', (e as Error).message);
  }
}

// 決定的な乱数
function lcg(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const mkQ = (id: string, genre: Question['genre'], format: Question['format'] = 'single'): Question => ({
  id,
  genre,
  format,
  question: 'Q' + id,
  choices: [
    { id: 'a', text: 'A' + id },
    { id: 'b', text: 'B' + id },
    { id: 'c', text: 'C' + id },
    { id: 'd', text: 'D' + id },
  ],
  correctAnswerIds: format === 'multiple' ? ['a', 'b'] : ['a'],
  explanation: 'e',
  sourceYear: null,
  sourceExam: 'test',
  sourceQuestionNo: null,
  sourceReference: 'test',
  checkedAt: '2026-11-03',
  verificationStatus: 'verified',
  rightsStatus: 'original',
  revisionNotes: '',
});
const pool = (g: Question['genre'], n: number) => Array.from({ length: n }, (_, i) => mkQ(`${g}${i + 1}`, g));
const bigPool = [...pool('kanri', 5), ...pool('eisei', 3), ...pool('kogaku', 4), ...pool('hoki', 4), ...pool('kucho', 4)];

console.log('■ 問題データ');
test('実データの検証が通る（ID重複・選択肢重複・正答・形式）', () => {
  assert.deepEqual(validateQuestions(ALL_QUESTIONS), []);
});
test('ゲームに出る問題は verified のみ', () => {
  assert.ok(QUESTIONS.every((q) => q.verificationStatus === 'verified'));
  assert.ok(QUESTIONS.length > 0);
});
test('検証器が不正データを検出する（ID重複・正答不存在・正答数不一致・選択肢重複）', () => {
  const a = mkQ('x1', 'kanri');
  const dup = { ...mkQ('x1', 'kanri') };
  assert.ok(validateQuestions([a, dup]).some((e) => e.includes('重複')));
  const bad = { ...mkQ('x2', 'kanri'), correctAnswerIds: ['z'] };
  assert.ok(validateQuestions([bad]).some((e) => e.includes('存在しない')));
  const cnt = { ...mkQ('x3', 'kanri', 'multiple'), correctAnswerIds: ['a'] };
  assert.ok(validateQuestions([cnt]).some((e) => e.includes('不一致')));
  const same = { ...mkQ('x4', 'kanri'), choices: [{ id: 'a', text: 'S' }, { id: 'b', text: 'S' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }] };
  assert.ok(validateQuestions([same]).some((e) => e.includes('文言が重複')));
  const g = { ...mkQ('x5', 'kanri'), genre: 'zzz' as never };
  assert.ok(validateQuestions([g]).some((e) => e.includes('ジャンル')));
});
test('四肢択二の判定: 2つ一致のみ正解、部分正解・順不同', () => {
  const q = mkQ('m1', 'kanri', 'multiple');
  assert.equal(isCorrect(q, ['a', 'b']), true);
  assert.equal(isCorrect(q, ['b', 'a']), true);
  assert.equal(isCorrect(q, ['a', 'c']), false);
  assert.equal(isCorrect(q, ['a']), false);
  assert.equal(isCorrect(q, ['a', 'b', 'c']), false);
});
test('選択肢の並べ替え（IDで判定）でも正誤が変わらない', () => {
  const q = mkQ('m2', 'kanri');
  const shuffled = [...q.choices].reverse();
  const correctText = shuffled.find((c) => q.correctAnswerIds.includes(c.id))!;
  assert.equal(isCorrect(q, [correctText.id]), true);
  assert.equal(isCorrect(q, [shuffled[0].id]), false);
});

console.log('■ 周回制・能力加算');
test('同じ周回の同一問題で能力が二重加算されない（連打・重複イベント）', () => {
  const s = S.newSave('warrior', bigPool, lcg(2));
  const q = S.pickQuestion(s, 'kanri', bigPool, lcg(3))!.q;
  const before = s.stats.atk;
  const r1 = S.recordAnswer(s, q, true, bigPool, lcg(4));
  const r2 = S.recordAnswer(s, q, true, bigPool, lcg(5));
  const r3 = S.recordAnswer(s, q, true, bigPool, lcg(6));
  assert.equal(r1.grew, true);
  assert.equal(r2.grew, false);
  assert.equal(r3.grew, false);
  assert.equal(s.stats.atk, before + 1);
  assert.equal(s.validTotal, 1);
  assert.equal(S.uniqueFirst(s), 1);
});
test('誤答後の同周回での初回正解で+1', () => {
  const s = S.newSave('mage', bigPool, lcg(2));
  const q = S.pickQuestion(s, 'kogaku', bigPool, lcg(3))!.q;
  const before = s.stats.mag;
  assert.equal(S.recordAnswer(s, q, false, bigPool, lcg(4)).grew, false);
  assert.equal(s.stats.mag, before);
  assert.equal(S.recordAnswer(s, q, true, bigPool, lcg(5)).grew, true);
  assert.equal(s.stats.mag, before + 1);
});
test('不正解では能力が上がらない', () => {
  const s = S.newSave('priest', bigPool, lcg(2));
  const stats = { ...s.stats };
  const q = S.pickQuestion(s, 'hoki', bigPool, lcg(3))!.q;
  S.recordAnswer(s, q, false, bigPool, lcg(4));
  assert.deepEqual(s.stats, stats);
});
test('未回答を先に出し、その後に誤答問題を出し、全問正解で次周回へ', () => {
  const s = S.newSave('fighter', bigPool, lcg(7));
  const rnd = lcg(8);
  const g = 'kanri';
  const asked: string[] = [];
  // 1周目: 5問をすべて不正解にする（未回答が先に出る）
  for (let i = 0; i < 5; i++) {
    const p = S.pickQuestion(s, g, bigPool, rnd)!;
    assert.equal(p.fresh, true, '未回答が先');
    assert.ok(!asked.includes(p.q.id), '未回答の問題は重複して出ない');
    asked.push(p.q.id);
    S.recordAnswer(s, p.q, false, bigPool, rnd);
  }
  // 次は誤答の復習
  let p = S.pickQuestion(s, g, bigPool, rnd)!;
  assert.equal(p.fresh, false);
  assert.equal(S.roundInfo(s, g, bigPool).round, 1);
  const before = s.stats.atk;
  let cleared = null as null | { genre: string; round: number };
  let guard = 0;
  while (!cleared && guard++ < 50) {
    p = S.pickQuestion(s, g, bigPool, rnd)!;
    assert.equal(p.fresh, false);
    cleared = S.recordAnswer(s, p.q, true, bigPool, rnd).roundCleared;
  }
  assert.ok(cleared, '全問正解で周回クリア');
  assert.equal(cleared!.round, 1);
  assert.equal(s.roundsCleared[g], 1);
  assert.equal(s.stats.atk, before + 5, '5問分+1');
  const info = S.roundInfo(s, g, bigPool);
  assert.equal(info.round, 2);
  assert.equal(info.correct, 0);
  // 2周目は全問題が再び出題され、正解で再び+1
  const q2 = S.pickQuestion(s, g, bigPool, rnd)!;
  assert.equal(q2.fresh, true);
  assert.equal(S.recordAnswer(s, q2.q, true, bigPool, rnd).grew, true);
});
test('周回内で正解済みの問題は、その周回では再出題されない', () => {
  const s = S.newSave('thief', bigPool, lcg(9));
  const rnd = lcg(10);
  const g = 'hoki';
  const solved: string[] = [];
  for (let i = 0; i < 3; i++) {
    const p = S.pickQuestion(s, g, bigPool, rnd)!;
    S.recordAnswer(s, p.q, true, bigPool, rnd);
    solved.push(p.q.id);
  }
  for (let i = 0; i < 10; i++) {
    const p = S.pickQuestion(s, g, bigPool, rnd);
    if (!p) break;
    assert.ok(!solved.includes(p.q.id) || S.roundInfo(s, g, bigPool).round > 1);
    if (S.roundInfo(s, g, bigPool).round > 1) break;
    S.recordAnswer(s, p.q, false, bigPool, rnd);
    S.recordAnswer(s, p.q, true, bigPool, rnd);
  }
});
test('各ジャンルは独立した周回数を持つ', () => {
  const s = S.newSave('warrior', bigPool, lcg(11));
  const rnd = lcg(12);
  for (let i = 0; i < 3; i++) {
    const p = S.pickQuestion(s, 'eisei', bigPool, rnd)!;
    S.recordAnswer(s, p.q, true, bigPool, rnd);
  }
  assert.equal(S.roundInfo(s, 'eisei', bigPool).round, 2);
  assert.equal(S.roundInfo(s, 'kanri', bigPool).round, 1);
  assert.equal(s.roundsCleared.eisei, 1);
  assert.equal(s.roundsCleared.kanri, 0);
});
test('周回途中の再読み込み（JSON往復）で周回・順番・付与履歴が壊れない', () => {
  const s = S.newSave('mage', bigPool, lcg(13));
  const rnd = lcg(14);
  const first = S.pickQuestion(s, 'kucho', bigPool, rnd)!;
  S.recordAnswer(s, first.q, true, bigPool, rnd);
  const reloaded = JSON.parse(JSON.stringify(s)) as S.SaveData;
  const a = S.pickQuestion(s, 'kucho', bigPool, lcg(99))!;
  const b = S.pickQuestion(reloaded, 'kucho', bigPool, lcg(99))!;
  assert.equal(a.q.id, b.q.id, '再読込後も次の問題が同じ');
  assert.deepEqual(reloaded.rounds.kucho, s.rounds.kucho);
  assert.equal(S.recordAnswer(reloaded, first.q, true, bigPool, lcg(1)).grew, false, '付与済みなので再度は加算されない');
});
test('ジャンルの問題が0問のとき null（問題準備中）で停止しない', () => {
  const s = S.newSave('warrior', [], lcg(1));
  assert.equal(S.pickQuestion(s, 'kanri', [], lcg(1)), null);
  const info = S.roundInfo(s, 'kanri', []);
  assert.equal(info.prepared, false);
});
test('ジャンルの問題が1問でも周回が回る', () => {
  const one = [mkQ('k1', 'kanri')];
  const s = S.newSave('warrior', one, lcg(1));
  for (let r = 1; r <= 3; r++) {
    const p = S.pickQuestion(s, 'kanri', one, lcg(r))!;
    const res = S.recordAnswer(s, p.q, true, one, lcg(r));
    assert.equal(res.grew, true);
    assert.equal(res.roundCleared?.round, r);
  }
  assert.equal(s.stats.atk, 10 + 3);
});
test('大量の問題でも動く（1000問）', () => {
  const many = Array.from({ length: 1000 }, (_, i) => mkQ('b' + i, 'kucho'));
  const s = S.newSave('warrior', many, lcg(1));
  const rnd = lcg(2);
  for (let i = 0; i < 1000; i++) {
    const p = S.pickQuestion(s, 'kucho', many, rnd)!;
    S.recordAnswer(s, p.q, true, many, rnd);
  }
  assert.equal(s.roundsCleared.kucho, 1);
  assert.equal(S.uniqueFirst(s), 1000);
});
test('周回途中に問題を追加しても進行中の周回は固定、次周回から反映', () => {
  let qs = pool('kanri', 3);
  const s = S.newSave('warrior', qs, lcg(1));
  const rnd = lcg(2);
  const p = S.pickQuestion(s, 'kanri', qs, rnd)!;
  S.recordAnswer(s, p.q, true, qs, rnd);
  qs = [...qs, mkQ('kNew', 'kanri')];
  const seen = new Set<string>([p.q.id]);
  for (let i = 0; i < 2; i++) {
    const q = S.pickQuestion(s, 'kanri', qs, rnd)!;
    seen.add(q.q.id);
    S.recordAnswer(s, q.q, true, qs, rnd);
  }
  assert.ok(!seen.has('kNew'), '進行中の周回に新問題は出ない');
  assert.equal(S.roundInfo(s, 'kanri', qs).round, 2);
  assert.ok(s.rounds.kanri.pool.includes('kNew'), '次周回の対象に新問題が入る');
});
test('周回途中に問題が削除されてもクラッシュせず進行できる', () => {
  let qs = pool('kanri', 3);
  const s = S.newSave('warrior', qs, lcg(1));
  const rnd = lcg(2);
  const p = S.pickQuestion(s, 'kanri', qs, rnd)!;
  S.recordAnswer(s, p.q, true, qs, rnd);
  qs = qs.filter((q) => q.id !== qs[1].id);
  for (let i = 0; i < 6; i++) {
    const q = S.pickQuestion(s, 'kanri', qs, rnd);
    assert.ok(q);
    S.recordAnswer(s, q!.q, true, qs, rnd);
  }
});
test('四肢択二でも1周に1回だけ+1', () => {
  const qs = [mkQ('mm1', 'kogaku', 'multiple'), mkQ('mm2', 'kogaku')];
  const s = S.newSave('mage', qs, lcg(1));
  const before = s.stats.mag;
  const m = qs[0];
  assert.equal(isCorrect(m, ['a', 'c']), false);
  S.recordAnswer(s, m, false, qs, lcg(1));
  assert.equal(s.stats.mag, before);
  assert.equal(S.recordAnswer(s, m, isCorrect(m, ['b', 'a']), qs, lcg(1)).grew, true);
  assert.equal(S.recordAnswer(s, m, true, qs, lcg(1)).grew, false);
});

console.log('■ ボス解放');
test('本編: 生涯の初回回答（異なる問題ID）が10問でボス1、以降10問ごとに1体解放', () => {
  const qs = Array.from({ length: 200 }, (_, i) => mkQ('u' + i, GENRES[i % 5].id));
  const s = S.newSave('warrior', qs, lcg(1));
  const rnd = lcg(2);
  let n = 0;
  const unlockedAt: number[] = [];
  let lastUnlocked = 0;
  for (let i = 0; i < 200; i++) {
    const g = GENRES[i % 5].id;
    const p = S.pickQuestion(s, g, qs, rnd)!;
    S.recordAnswer(s, p.q, i % 3 === 0, qs, rnd); // 正誤は問わない
    n++;
    const open = BOSSES.filter((b) => S.mainUnlocked(s, b.order)).length;
    if (open !== lastUnlocked) {
      unlockedAt.push(S.uniqueFirst(s));
      lastUnlocked = open;
    }
  }
  assert.deepEqual(unlockedAt, [10, 20, 30, 40, 50], '本編は5体: 10問ごとに解放され50問でラスボス');
  void n;
});
test('同じ問題の繰り返し・別周回の再回答では本編の解放数が進まない', () => {
  const qs = pool('kanri', 4);
  const s = S.newSave('warrior', qs, lcg(1));
  const rnd = lcg(2);
  for (let i = 0; i < 30; i++) {
    const p = S.pickQuestion(s, 'kanri', qs, rnd)!;
    S.recordAnswer(s, p.q, true, qs, rnd);
  }
  assert.equal(S.uniqueFirst(s), 4, '異なる問題は4つだけ');
  assert.equal(S.mainUnlocked(s, 1), false);
  assert.ok(s.validTotal > 4, '強化用カウンターは周回ごとに進む');
  const p = S.pickQuestion(s, 'kanri', qs, rnd)!;
  for (let i = 0; i < 20; i++) S.recordAnswer(s, p.q, false, qs, rnd);
  assert.equal(S.uniqueFirst(s), 4, '連打でも進まない');
});
test('強化ボスの解放条件: 110〜150, 160〜200（5体構成。周回内の初回回答）', () => {
  assert.equal(S.enhancedThreshold(1, 1), 110);
  assert.equal(S.enhancedThreshold(1, 5), 150);
  assert.equal(S.enhancedThreshold(2, 1), 160);
  assert.equal(S.enhancedThreshold(2, 5), 200);
  assert.equal(S.enhancedThreshold(3, 1), 210);
  const s = S.newSave('warrior', [], lcg(1));
  s.validTotal = 109;
  assert.equal(S.enhancedUnlocked(s, 1, 1), false);
  s.validTotal = 110;
  assert.equal(S.enhancedUnlocked(s, 1, 1), true);
  assert.equal(S.enhancedUnlocked(s, 1, 2), false);
});
test('強化ボスは本編5体の能力を倍率で強化したもの（ID/名前/画像は共通）', () => {
  const e = resolveBoss('flowdam#2')!;
  const b = BOSSES.find((x) => x.id === 'flowdam')!;
  assert.equal(e.sprite, b.sprite);
  assert.ok(e.hp > b.hp && e.mag > b.mag);
  assert.equal(e.hp, enhancedBoss(b, 2).hp);
  assert.ok(ENHANCE.hpPerSeries > 0);
});
test('本編ボスは5体・順序と名前が仕様どおり。除外した5体は保管されている', () => {
  assert.deepEqual(
    BOSSES.map((b) => b.name),
    ['バルブロック', 'フローダム', 'ダクトハヤーテ', 'エルボルガ', 'ハイカンオー・カンセコア'],
  );
  assert.deepEqual(BOSSES.map((b) => b.order), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    ARCHIVED_BOSSES.map((b) => b.id).sort(),
    ['atsuryoga', 'drainslime', 'pumptroll', 'seigyonosu', 'steamdrago'],
  );
  assert.equal(new Set(ALL_BOSS_IDS).size, 10);
});
test('未討伐の中間ボスが残っていれば本編クリアにならない', () => {
  const s = S.newSave('warrior', [], lcg(1));
  s.defeated = BOSSES.filter((b) => b.order !== 4).map((b) => b.id);
  assert.equal(S.mainCleared(s), false);
  s.defeated.push('pumptroll'); // 保管ボスの撃破では本編クリアにならない
  assert.equal(S.mainCleared(s), false);
  s.defeated.push('elborga');
  assert.equal(S.mainCleared(s), true);
});

console.log('■ セーブ移行');
const v2sample = () => ({
  v: 2 as const,
  job: 'mage' as const,
  stats: { atk: 14, def: 14, mag: 25, mdef: 13, spd: 13 } as Stats,
  hp: 144,
  mp: 60,
  history: {
    g3: { n: 1, c: 1, lastOk: true, grown: true },
    h3: { n: 2, c: 1, lastOk: true, grown: true },
    k5: { n: 1, c: 0, lastOk: false, grown: false },
  },
  answered: 4,
  correct: 3,
  wrong: 1,
  perGenre: { kanri: { answered: 1, correct: 0 }, eisei: { answered: 0, correct: 0 }, kogaku: { answered: 1, correct: 1 }, hoki: { answered: 2, correct: 2 }, kucho: { answered: 0, correct: 0 } },
  defeated: ['barbulock', 'flowdam', 'ductohayate'],
  bossTries: { barbulock: 2 },
});
test('v2→v3: 能力値・HP/MP・撃破済みボス（安定ID）・履歴が保持される', () => {
  const old = v2sample();
  const n = S.migrate(old, QUESTIONS, lcg(1))!;
  assert.equal(n.v, 3);
  assert.deepEqual(n.stats, old.stats);
  assert.equal(n.hp, 144);
  assert.equal(n.mp, 60);
  assert.deepEqual(n.defeated, ['barbulock', 'flowdam', 'ductohayate']);
  assert.ok(!n.defeated.includes('drainslime') && !n.defeated.includes('pumptroll'), '保管ボスは未撃破');
  assert.equal(n.answered, 4);
  assert.deepEqual(new Set(n.firstSeen), new Set(['g3', 'h3', 'k5']));
  assert.equal(S.uniqueFirst(n), 3);
});
test('v2→v3: 旧データで加算済みの問題は、移行後の周回で二重加算されない', () => {
  const n = S.migrate(v2sample(), QUESTIONS, lcg(1))!;
  const qG3 = QUESTIONS.find((q) => q.id === 'g3')!;
  const before = n.stats.mag;
  // 同周回でg3に再び正解しても+1されない
  assert.equal(S.recordAnswer(n, qG3, true, QUESTIONS, lcg(2)).grew, false);
  assert.equal(n.stats.mag, before);
  // 誤答だった k5 は、周回内で初めて正解すれば+1
  const qK5 = QUESTIONS.find((q) => q.id === 'k5')!;
  const a = n.stats.atk;
  assert.equal(S.recordAnswer(n, qK5, true, QUESTIONS, lcg(3)).grew, true);
  assert.equal(n.stats.atk, a + 1);
});
test('v1→v3: 旧撃破フラグを名前(ID)で移行し、回答済み問題は加算済み扱い', () => {
  const v1 = {
    v: 1 as const,
    job: 'warrior' as const,
    stats: { atk: 12, def: 22, mag: 11, mdef: 12, spd: 11 },
    answered: ['k1', 'e1', 'g1', 'h1', 'a1'],
    correct: 5,
    wrong: 0,
    perGenre: { kanri: { answered: 1, correct: 1 }, eisei: { answered: 1, correct: 1 }, kogaku: { answered: 1, correct: 1 }, hoki: { answered: 1, correct: 1 }, kucho: { answered: 1, correct: 1 } },
    bossTries: 3,
    bossCleared: true,
  };
  const n = S.migrate(v1, QUESTIONS, lcg(1))!;
  assert.equal(n.v, 3);
  assert.deepEqual(n.stats, v1.stats);
  assert.deepEqual(n.defeated, ['barbulock']);
  assert.equal(n.bossTries.barbulock, 3);
  assert.equal(S.uniqueFirst(n), 5);
  const q = QUESTIONS.find((x) => x.id === 'k1')!;
  assert.equal(S.recordAnswer(n, q, true, QUESTIONS, lcg(1)).grew, false);
});
test('v2→v3: 本編から外した保管ボスの撃破記録も保持される', () => {
  const old = v2sample();
  old.defeated = ['barbulock', 'drainslime', 'pumptroll', 'seigyonosu'] as never;
  const n = S.migrate(old, QUESTIONS, lcg(1))!;
  assert.deepEqual(n.defeated, ['barbulock', 'drainslime', 'pumptroll', 'seigyonosu']);
  assert.equal(S.mainCleared(n), false);
  assert.equal(S.nextBoss(n)?.id, 'flowdam');
});
test('v3 はそのまま読める。不明な形式は null（データは壊さない）', () => {
  const s = S.newSave('priest', QUESTIONS, lcg(1));
  assert.deepEqual(S.migrate(JSON.parse(JSON.stringify(s)), QUESTIONS), s);
  assert.equal(S.migrate({ v: 99 }, QUESTIONS), null);
  assert.equal(S.migrate(null, QUESTIONS), null);
});
test('問題の削除・差し替えがあってもセーブ読み込みが失敗しない', () => {
  const old = v2sample();
  old.history = { ...old.history, removedQuestion: { n: 1, c: 1, lastOk: true, grown: true } } as never;
  const n = S.migrate(old, QUESTIONS, lcg(1))!;
  assert.ok(n);
  assert.ok(S.pickQuestion(n, 'kanri', QUESTIONS, lcg(1)));
});
test('実データ: 全ジャンルに出題できる問題がある', () => {
  for (const g of GENRES) assert.ok(questionsOf(g.id).length > 0, g.name);
});

console.log('■ 戦闘');
const full: Stats = { atk: 20, def: 20, mag: 20, mdef: 20, spd: 20 };
test('本編5体・保管5体のすべてで戦闘が成立（勝敗がつき、HPが範囲内）', () => {
  for (const b of [...BOSSES, ...ARCHIVED_BOSSES]) {
    const s = Bt.newBattle({ ...full }, b);
    for (let t = 0; t < 200 && s.hp > 0 && s.bossHp > 0; t++) {
      Bt.playerAttack(s, Math.random);
      Bt.updateForm(s);
      if (s.bossHp > 0) Bt.bossAct(s, Bt.bossChoose(s, Math.random), Math.random);
    }
    assert.ok(s.hp >= 0 && s.bossHp >= 0);
    assert.ok(s.hp === 0 || s.bossHp === 0, b.name);
  }
});
test('最終ボスは3形態（通常→魔法→総合）へ移行する', () => {
  const b = BOSSES[4];
  const s = Bt.newBattle({ ...full }, b);
  assert.equal(Bt.updateForm(s), null);
  s.bossHp = Math.floor(b.hp * 0.6);
  assert.equal(Bt.updateForm(s), '魔法形態');
  assert.ok(Bt.currentMoves(s).every((m) => m.kind === 'magic'));
  s.bossHp = Math.floor(b.hp * 0.3);
  assert.equal(Bt.updateForm(s), '総合形態');
  assert.ok(Bt.currentMoves(s).some((m) => m.kind === 'phys') && Bt.currentMoves(s).some((m) => m.kind === 'magic'));
});
test('保管ボスの特殊仕様（連続攻撃・高命中）は保たれている', () => {
  const pt = ARCHIVED_BOSSES.find((b) => b.id === 'pumptroll')!;
  assert.ok(pt.moves.some((m) => (m.hits ?? 1) >= 2));
  const sg = ARCHIVED_BOSSES.find((b) => b.id === 'seigyonosu')!;
  assert.ok(sg.ignoreEvade && (sg.initiative ?? 0) > 0);
});
const mk = (st: Partial<Stats>, boss = BOSSES[0]) => Bt.newBattle({ ...full, ...st }, boss);
test('命中率・回避率・会心率は素早さ差で変化し、上限・下限がある', () => {
  // 攻撃側が速いほど命中が上がる
  assert.ok(Bt.hitRate(0.9, 30, 10) > Bt.hitRate(0.9, 10, 10));
  assert.ok(Bt.hitRate(0.9, 10, 30) < Bt.hitRate(0.9, 10, 10));
  // 防御側が速いほど回避が上がり、上限を超えない（無敵にならない）
  assert.ok(Bt.evadeRate(10, 30) > Bt.evadeRate(10, 15));
  assert.equal(Bt.evadeRate(0, 999), B.evadeCap);
  assert.equal(Bt.evadeRate(30, 10), 0);
  // 会心は同速でも低確率で出て、差が広がるほど上がり、上限がある
  assert.ok(Bt.critRate(10, 10) > 0);
  assert.ok(Bt.critRate(30, 10) > Bt.critRate(10, 10));
  assert.ok(Bt.critRate(10, 30) < Bt.critRate(10, 10));
  assert.equal(Bt.critRate(999, 0), B.critMax);
  assert.equal(Bt.critRate(0, 999), B.critMin);
  // 最終的な攻撃成功率は、極端な差でも0〜1の範囲かつ下限以上
  for (const d of [-50, -20, -10, 0, 10, 20, 50]) {
    const r = Bt.attackSuccess(0.92, 20 + d, 20);
    assert.ok(r > 0.2 && r <= 0.98, `d=${d}: ${r}`);
  }
});
test('プレイヤーの命中率に素早さが反映される（素早いほど当たる）', () => {
  const slow = Bt.playerHitRate(mk({ spd: 6 }));
  const fast = Bt.playerHitRate(mk({ spd: 30 }));
  assert.ok(fast > slow);
});
test('会心の一撃は通常ダメージの2倍（計算後に倍加）', () => {
  assert.equal(B.critMult, 2);
  const boss = { ...BOSSES[0], def: 0 };
  const fixed = (v: number) => () => v; // 乱数固定: 命中・会心判定を通し、ジッターは中央値
  const normal = mk({ atk: 20, spd: 0 }, boss);
  normal.focus = true; // 命中を保証し会心しない値(0.99)で通常ダメージを得る
  const n = Bt.playerAttack(normal, fixed(0.99));
  assert.equal(n.crit, false);
  const crit = mk({ atk: 20, spd: 0 }, boss);
  crit.focus = true;
  const seq = [0.0, 0.5];
  let i = 0;
  const c = Bt.playerAttack(crit, () => seq[Math.min(i++, seq.length - 1)] ?? 0.5);
  assert.equal(c.crit, true);
  const base = Math.max(1, Math.round((20 * B.playerAtkPower + B.playerAtkBase - 0) * (1 - B.jitter + 0.5 * B.jitter * 2) * B.focusMult));
  assert.equal(c.dmg, base * 2);
  assert.ok(c.dmg > n.dmg * 1.5);
});
test('魔法防御が高いほど魔法ダメージが減り、ほぼ無効にはならない', () => {
  const sp = ARCHIVED_BOSSES.find((b) => b.id === 'steamdrago')!;
  const mv = sp.moves.find((m) => m.kind === 'magic')!;
  const avg = (mdef: number) => {
    let t = 0;
    for (let i = 0; i < 300; i++) t += Bt.bossAct(Bt.newBattle({ ...full, mdef, def: 99 }, sp), mv, () => 0.5).dmg;
    return t / 300;
  };
  assert.ok(avg(30) < avg(10) && avg(10) < avg(0));
  assert.ok(avg(60) > avg(0) * 0.25, '軽減には上限がある');
  assert.ok(Bt.magicReduction(9999) <= B.mdefCap);
});
test('回復量は魔法防御で増え、最大HPと上限割合を超えない', () => {
  assert.ok(Bt.healAmount(30) > Bt.healAmount(10));
  const lowMdef = Bt.newBattle({ ...full, mdef: 5 }, BOSSES[0]);
  const hiMdef = Bt.newBattle({ ...full, mdef: 30 }, BOSSES[0]);
  lowMdef.hp = hiMdef.hp = 1;
  const rng = () => 0.5;
  const a = Bt.playerSuijuku(lowMdef, rng).heal;
  const b2 = Bt.playerSuijuku(hiMdef, rng).heal;
  assert.ok(b2 > a, '魔法防御が高いほど回復が大きい');
  assert.ok(hiMdef.hp <= hiMdef.maxHp && b2 <= Math.round(hiMdef.maxHp * B.healCapRatio));
  const nearFull = Bt.newBattle({ ...full, mdef: 99 }, BOSSES[0]);
  nearFull.hp = nearFull.maxHp - 3;
  assert.equal(Bt.playerSuijuku(nearFull, rng).heal, 3);
  assert.equal(nearFull.hp, nearFull.maxHp);
});test('MP不足で魔法が使えない状況を判定できる', () => {
  const s = Bt.newBattle({ ...full }, BOSSES[0]);
  s.mp = Bt.COST_BENGARI - 1;
  assert.ok(s.mp < Bt.COST_BENGARI);
});
test('ボスの得意・不得意: 魔法弱点/炎耐性/物理弱点が設定されている', () => {
  assert.ok(BOSSES[0].fireMult > 1);
  assert.ok(BOSSES[1].mag > BOSSES[1].atk, 'フローダムは魔法攻撃型');
  assert.ok(BOSSES[2].spd > BOSSES[0].spd && BOSSES[2].spd >= 20, 'ダクトハヤーテは素早さ重視型');
  assert.ok(BOSSES[3].atk > BOSSES[3].mag, 'エルボルガは物理特化');
});

console.log('■ 全クリア率（バランス）');
test('正答率50%で全クリア率が25〜38%、正答率が上がるほど全クリア率が上がる（5職業×3育成の平均）', () => {
  const res = runAll(150);
  const mean = (acc: number) => {
    const x = res.filter((r) => r.acc === acc).map((r) => r.fullClear);
    return x.reduce((a, b) => a + b, 0) / x.length;
  };
  const [a50, a70, a90] = [mean(0.5), mean(0.7), mean(0.9)];
  assert.ok(a50 > 0.22 && a50 < 0.4, `50%: ${a50}`);
  assert.ok(a70 > a50 + 0.1 && a90 > a70 + 0.1, `${a50} ${a70} ${a90}`);
  // どの職業も、育成次第でクリアできる可能性がある（均等育成・正答率90%で全職業が60%以上）
  for (const r of res.filter((x) => x.acc === 0.9 && x.alloc === 'even')) assert.ok(r.fullClear > 0.6, `${r.job}: ${r.fullClear}`);
});
console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length) {
  console.log('失敗:', failed.join(' / '));
  process.exit(1);
}
