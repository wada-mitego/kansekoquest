// バランス調整用の定数とボス定義。数値だけを変えて調整できる。
import type { Stats } from './data';

/** 本編ボスの解放間隔（生涯で初めて回答した異なる問題の累計） */
export const MAIN_STEP = 10;

/** 強化ボスシリーズ: シリーズs・i体目は 有効回答 firstThreshold + (s-1)*(本編ボス数*MAIN_STEP) + (i-1)*MAIN_STEP 以上で解放（5体なら 110〜150, 160〜200…） */
export const ENHANCE = {
  firstThreshold: 110,
  hpPerSeries: 0.3,
  atkPerSeries: 0.2,
  magPerSeries: 0.2,
  defPerSeries: 0.12,
  mdefPerSeries: 0.12,
  spdPerSeries: 0.08,
};

export const BALANCE = {
  hpBase: 60,
  hpPerDef: 7,
  mpBase: 16,
  mpPerMag: 2,
  costBengari: 6,
  costSuijuku: 5,
  bengariPerMag: 1.9,
  bengariBase: 14,
  /** 回復量 = 基礎回復量 + 魔法防御 × healPerMdef（最大HPの healCapRatio までに制限） */
  healBase: 12,
  healPerMdef: 3.5,
  healCapRatio: 0.6,
  playerAtkPower: 2.0,
  /** 物理ダメージ = 攻撃×playerAtkPower + playerAtkBase − 防御（攻撃の低い職業でも戦えるようにする底上げ） */
  playerAtkBase: 12,
  playerBaseHit: 0.92,
  /** 命中率: 技の基本命中率 + (攻撃側素早さ − 防御側素早さ) × hitPerSpd */
  hitPerSpd: 0.025,
  hitMin: 0.4,
  hitMax: 0.98,
  /** 回避率: 防御側が速いとき (防御側素早さ − 攻撃側素早さ) × evadePerSpd。上限 evadeCap */
  evadePerSpd: 0.016,
  evadeCap: 0.4,
  /** 会心率: critBase + (攻撃側素早さ − 防御側素早さ) × critPerSpd を [critMin, critMax] に制限 */
  critBase: 0.05,
  critPerSpd: 0.013,
  critMin: 0.02,
  critMax: 0.4,
  /** 会心の一撃は通常の物理ダメージ（計算後）の2倍 */
  critMult: 2,
  focusMult: 1.5,
  focusMpRatio: 0.2,
  defendMult: 0.5,
  defFactor: 2.0,
  /** 魔法ダメージ軽減率 = mdef / (mdef + mdefK)（上限 mdefCap） */
  mdefK: 30,
  mdefCap: 0.7,
  jitter: 0.1,
};

export const maxHp = (s: Stats) => BALANCE.hpBase + s.def * BALANCE.hpPerDef;
export const maxMp = (s: Stats) => BALANCE.mpBase + s.mag * BALANCE.mpPerMag;

export interface Move {
  name: string;
  kind: 'phys' | 'magic';
  /** 物理: atk×power − 防御×係数。魔法: mag×power − 魔法防御×係数 */
  power: number;
  /** 物理の基本命中率（魔法は必中） */
  acc: number;
  weight: number;
  /** 連続攻撃の回数（物理のみ。各回で命中判定） */
  hits?: number;
}

export interface Form {
  label: string;
  /** ボスHPがこの割合以下になると移行 */
  hpBelow: number;
  moves: Move[];
}

export interface BossDef {
  id: string;
  order: number;
  name: string;
  sprite: string;
  hp: number;
  atk: number;
  def: number;
  mag: number;
  mdef: number;
  spd: number;
  /** プレイヤーの物理攻撃の命中率を下げる */
  evasion: number;
  /** ベンガリ(炎)の倍率 */
  fireMult: number;
  /** 行動順の判定に加算される素早さ（行動順制御型） */
  initiative?: number;
  /** true: プレイヤーの素早さによる回避補正を受けない（高命中型） */
  ignoreEvade?: boolean;
  tagline: string;
  traits: string[];
  hint: string;
  intro: string;
  moves: Move[];
  forms?: Form[];
  /** 強化版の場合のシリーズ番号（0=本編） */
  series?: number;
  baseId?: string;
}

/** 全ボス定義（本編5体＋保管中5体）。保管ボスのデータ・画像は削除せず残す */
const ALL_BASE_BOSSES: BossDef[] = [
  {
    id: 'barbulock',
    order: 1,
    name: 'バルブロック',
    sprite: 'boss_barbulock',
    hp: 300,
    atk: 13,
    def: 6,
    mag: 10,
    mdef: 3,
    spd: 8,
    evasion: 0,
    fireMult: 1.5,
    tagline: '鋼鉄のバルブゴーレム',
    traits: ['物理攻撃・物理防御が高い', '魔法に弱い（とくに炎）'],
    hint: '魔法を育てて「ベンガリ」で攻めよう。魔法使いが有利。',
    intro: 'がっしりとした はいかんが こちらを にらんでいる！',
    moves: [
      { name: 'てつのこぶし', kind: 'phys', power: 2.0, acc: 0.9, weight: 55 },
      { name: 'ハンマーフォール', kind: 'phys', power: 3.2, acc: 0.8, weight: 20 },
      { name: 'スチームブラスト', kind: 'magic', power: 3.0, acc: 1, weight: 25 },
    ],
  },
  {
    id: 'drainslime',
    order: 2,
    name: 'ドレンスライム',
    sprite: 'boss_drainslime',
    hp: 340,
    atk: 14,
    def: 4,
    mag: 15,
    mdef: 22,
    spd: 9,
    evasion: 0.03,
    fireMult: 0.7,
    tagline: '排水にひそむ液状モンスター',
    traits: ['魔法防御が高く、魔法が通りにくい', '物理攻撃に弱い'],
    hint: '攻撃を鍛えて「たたかう」で押そう。格闘家が有利。',
    intro: 'ドレンから ぬるりと なにかが はいだしてきた！',
    moves: [
      { name: 'ぷるぷるタックル', kind: 'phys', power: 2.2, acc: 0.9, weight: 45 },
      { name: 'ドレンショット', kind: 'magic', power: 2.8, acc: 1, weight: 35 },
      { name: 'ヘドロのうず', kind: 'phys', power: 3.0, acc: 0.8, weight: 20 },
    ],
  },
  {
    id: 'flowdam',
    order: 3,
    name: 'フローダム',
    sprite: 'boss_flowdam',
    hp: 300,
    atk: 8,
    def: 8,
    mag: 13,
    mdef: 11,
    spd: 12,
    evasion: 0.04,
    fireMult: 0.9,
    tagline: '水流をあやつる魔導士',
    traits: ['魔法攻撃が強力', '水の使い手で炎に強い'],
    hint: '魔法防御を鍛えて魔法ダメージを減らそう。回復量も魔法防御で増える。神官が有利。',
    intro: 'ゲージの杖が ひかり、うずまく みずが おそってくる！',
    moves: [
      { name: 'ウォーターショット', kind: 'magic', power: 3.0, acc: 1, weight: 40 },
      { name: 'アクアスパイラル', kind: 'magic', power: 4.2, acc: 1, weight: 25 },
      { name: 'ゲージスタッフ', kind: 'phys', power: 2.4, acc: 0.9, weight: 35 },
    ],
  },
  {
    id: 'pumptroll',
    order: 4,
    name: 'ポンプトロル',
    sprite: 'boss_pumptroll',
    hp: 420,
    atk: 16,
    def: 12,
    mag: 5,
    mdef: 7,
    spd: 9,
    evasion: 0,
    fireMult: 1.0,
    tagline: '巨大ポンプを両腕に持つ鉄の怪物',
    traits: ['連続した物理攻撃', '魔法はあまり得意でない'],
    hint: '防御を鍛えて受けきろう。戦士が有利。ぼうぎょも有効。',
    intro: 'ポンプの うでが ごうごうと うなりを あげている！',
    moves: [
      { name: 'ダブルポンプ', kind: 'phys', power: 1.4, acc: 0.9, weight: 45, hits: 2 },
      { name: 'ハンマーポンプ', kind: 'phys', power: 3.0, acc: 0.85, weight: 25 },
      { name: 'プレスアーム', kind: 'phys', power: 2.2, acc: 0.9, weight: 30 },
    ],
  },
  {
    id: 'ductohayate',
    order: 5,
    name: 'ダクトハヤーテ',
    sprite: 'boss_ductohayate',
    hp: 300,
    atk: 17,
    def: 8,
    mag: 10,
    mdef: 8,
    spd: 22,
    evasion: 0.08,
    fireMult: 1.0,
    tagline: '疾風のダクト暗殺者',
    traits: ['素早く回避率が高い', '攻撃が当たりにくい'],
    hint: '素早さで命中・回避・会心が変わる。盗賊は有利だが相手も速い。魔法は必中。',
    intro: 'ひゅうっと かぜが ふいた… どこだ！？',
    moves: [
      { name: 'ダクトスラッシュ', kind: 'phys', power: 2.4, acc: 0.98, weight: 45 },
      { name: 'しっぷうざん', kind: 'phys', power: 3.0, acc: 0.95, weight: 25 },
      { name: 'かまいたち', kind: 'magic', power: 3.0, acc: 1, weight: 30 },
    ],
  },
  {
    id: 'steamdrago',
    order: 6,
    name: 'スチームドラゴ',
    sprite: 'boss_steamdrago',
    hp: 400,
    atk: 12,
    def: 12,
    mag: 13,
    mdef: 10,
    spd: 14,
    evasion: 0.02,
    fireMult: 1.0,
    tagline: '蒸気をふきあげる配管の竜',
    traits: ['蒸気による魔法攻撃', '魔法防御が低め'],
    hint: '魔法防御を上げつつ、魔法で攻めよう。魔法使い・神官が有利。',
    intro: 'えんとつの つのから しろい じょうきが ふきあがった！',
    moves: [
      { name: 'スチームブレス', kind: 'magic', power: 3.0, acc: 1, weight: 45 },
      { name: 'ボイラーバースト', kind: 'magic', power: 4.0, acc: 1, weight: 20 },
      { name: 'テールパイプ', kind: 'phys', power: 2.2, acc: 0.9, weight: 35 },
    ],
  },
  {
    id: 'elborga',
    order: 7,
    name: 'エルボルガ',
    sprite: 'boss_elborga',
    hp: 450,
    atk: 22,
    def: 14,
    mag: 5,
    mdef: 6,
    spd: 10,
    evasion: 0,
    fireMult: 1.0,
    tagline: '巨大工具の狂戦士',
    traits: ['物理攻撃に特化', 'HPが高い'],
    hint: '短期決戦か、防御で耐えよう。戦士が受けやすい。',
    intro: 'おおきな レンチを ふりかざし、ほえた！',
    moves: [
      { name: 'レンチスイング', kind: 'phys', power: 2.6, acc: 0.9, weight: 50 },
      { name: 'エルボクラッシュ', kind: 'phys', power: 4.0, acc: 0.72, weight: 30 },
      { name: 'ぶんまわし', kind: 'phys', power: 2.0, acc: 0.95, weight: 20 },
    ],
  },
  {
    id: 'atsuryoga',
    order: 8,
    name: 'アツリョーガ',
    sprite: 'boss_atsuryoga',
    hp: 620,
    atk: 22,
    def: 6,
    mag: 8,
    mdef: 10,
    spd: 8,
    evasion: 0,
    fireMult: 1.0,
    tagline: '高圧配管をまとった巨人',
    traits: ['HPと攻撃力が高い', '防御に隙がある'],
    hint: '攻撃を鍛えて一気に押し切ろう。格闘家が有利。',
    intro: '胸の あつりょくけいが じわじわと はりを ふっている…！',
    moves: [
      { name: 'パイプラップ', kind: 'phys', power: 2.4, acc: 0.9, weight: 45 },
      { name: 'プレッシャーパンチ', kind: 'phys', power: 3.6, acc: 0.75, weight: 30 },
      { name: 'あつりょくかいほう', kind: 'magic', power: 2.6, acc: 1, weight: 25 },
    ],
  },
  {
    id: 'seigyonosu',
    order: 9,
    name: 'セイギョノス',
    sprite: 'boss_seigyonosu',
    hp: 460,
    atk: 20,
    def: 12,
    mag: 19,
    mdef: 12,
    spd: 20,
    evasion: 0.05,
    fireMult: 1.0,
    initiative: 14,
    ignoreEvade: true,
    tagline: '制御盤の機械魔王',
    traits: ['攻撃が高確率で命中する', '先手を取りやすい'],
    hint: '素早さで先手を取ろう。盗賊が有利。回避に頼らず守りを固めて。',
    intro: 'ランプが いっせいに てんめつし、けいほうおんが ひびいた！',
    moves: [
      { name: 'シーケンスアタック', kind: 'phys', power: 2.4, acc: 0.98, weight: 45 },
      { name: 'ショートサーキット', kind: 'magic', power: 3.0, acc: 1, weight: 35 },
      { name: 'インターロック', kind: 'phys', power: 2.0, acc: 0.98, weight: 20 },
    ],
  },
  {
    id: 'kansecoa',
    order: 10,
    name: 'ハイカンオー・カンセコア',
    sprite: 'boss_kansecoa',
    hp: 500,
    atk: 16,
    def: 14,
    mag: 13,
    mdef: 12,
    spd: 15,
    evasion: 0.06,
    fireMult: 1.0,
    tagline: '配管の王・最終ボス',
    traits: ['全能力が高い', '物理・魔法・総合の3形態'],
    hint: '形態ごとに戦い方を変えよう。総合力が試される。',
    intro: '配管の王が ゆっくりと めを ひらいた…！',
    moves: [
      { name: 'ロイヤルパイプ', kind: 'phys', power: 2.4, acc: 0.92, weight: 60 },
      { name: 'キングバルブ', kind: 'phys', power: 3.4, acc: 0.8, weight: 40 },
    ],
    forms: [
      {
        label: '魔法形態',
        hpBelow: 0.66,
        moves: [
          { name: 'ハイドロカノン', kind: 'magic', power: 3.0, acc: 1, weight: 60 },
          { name: 'スチームストーム', kind: 'magic', power: 3.6, acc: 1, weight: 40 },
        ],
      },
      {
        label: '総合形態',
        hpBelow: 0.33,
        moves: [
          { name: 'ロイヤルパイプ', kind: 'phys', power: 2.6, acc: 0.92, weight: 35 },
          { name: 'ハイドロカノン', kind: 'magic', power: 3.0, acc: 0.92, weight: 35 },
          { name: 'カンセコア・フィニッシュ', kind: 'phys', power: 4.0, acc: 0.8, weight: 30 },
        ],
      },
    ],
  },
];

/** 本編に登場するボス（この順で order=1..5 を振る）。増やす場合はここへIDを足すだけで解放条件も伸びる */
export const MAIN_BOSS_IDS = ['barbulock', 'flowdam', 'ductohayate', 'elborga', 'kansecoa'];

/** 全ボス共通の難易度倍率（定数だけで全体の強さを調整できる） */
export const DIFFICULTY = { hp: 1.0, atk: 1.0, mag: 1.1 };
const scaled = (b: BossDef): BossDef => ({
  ...b,
  hp: Math.round(b.hp * DIFFICULTY.hp),
  atk: Math.round(b.atk * DIFFICULTY.atk),
  mag: Math.round(b.mag * DIFFICULTY.mag),
});
export const BOSSES: BossDef[] = MAIN_BOSS_IDS.map((id, i) => scaled({ ...ALL_BASE_BOSSES.find((b) => b.id === id)!, order: i + 1 }));
/** 本編から外した保管ボス（order は旧順位のまま。撃破記録のIDはセーブに残る） */
export const ARCHIVED_BOSSES: BossDef[] = ALL_BASE_BOSSES.filter((b) => !MAIN_BOSS_IDS.includes(b.id)).map(scaled);
export const ALL_BOSS_IDS: string[] = [...BOSSES, ...ARCHIVED_BOSSES].map((b) => b.id);
export const bossByOrder = (o: number) => BOSSES.find((b) => b.order === o);
export const bossById = (id: string) => BOSSES.find((b) => b.id === id);

/** 強化ボス: 既存の能力値を倍率で強化（画像・技は共通） */
export function enhancedBoss(b: BossDef, series: number): BossDef {
  const e = ENHANCE;
  const m = (base: number, per: number) => Math.round(base * (1 + per * series));
  return {
    ...b,
    id: `${b.id}#${series}`,
    baseId: b.id,
    series,
    name: `${b.name}【強化${series}】`,
    hp: m(b.hp, e.hpPerSeries),
    atk: m(b.atk, e.atkPerSeries),
    mag: m(b.mag, e.magPerSeries),
    def: m(b.def, e.defPerSeries),
    mdef: m(b.mdef, e.mdefPerSeries),
    spd: m(b.spd, e.spdPerSeries),
  };
}

/** `id` または `baseId#series` から BossDef を得る */
export function resolveBoss(id: string): BossDef | undefined {
  const [base, s] = id.split('#');
  const b = bossById(base);
  if (!b) return undefined;
  return s ? enhancedBoss(b, Number(s)) : b;
}