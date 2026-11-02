export type StatKey = 'atk' | 'def' | 'mag' | 'mdef' | 'spd';
export type Stats = Record<StatKey, number>;
export type JobId = 'warrior' | 'fighter' | 'mage' | 'thief' | 'priest';
export type GenreId = 'kanri' | 'eisei' | 'kogaku' | 'hoki' | 'kucho';

export const STAT_NAMES: Record<StatKey, string> = {
  atk: '攻撃',
  def: '防御',
  mag: '魔法',
  mdef: '魔法防御',
  spd: '素早さ',
};
export const STAT_KEYS: StatKey[] = ['atk', 'def', 'mag', 'mdef', 'spd'];
export const STAT_COLORS: Record<StatKey, number> = {
  atk: 0xff6a4a,
  def: 0x58b0ff,
  mag: 0xb98aff,
  mdef: 0xffc94a,
  spd: 0x5be0a0,
};
export const STAT_CSS: Record<StatKey, string> = {
  atk: '#ff6a4a',
  def: '#58b0ff',
  mag: '#b98aff',
  mdef: '#ffc94a',
  spd: '#5be0a0',
};

export interface JobDef {
  id: JobId;
  name: string;
  best: StatKey;
  desc: string;
}
// 表示順: 参考画像どおり 格闘家・魔法使い・戦士・盗賊・神官
export const JOBS: JobDef[] = [
  { id: 'fighter', name: '格闘家', best: 'atk', desc: '拳ひとつで敵を砕く、攻撃の達人。' },
  { id: 'mage', name: '魔法使い', best: 'mag', desc: '強力な魔法を操る、知恵者。' },
  { id: 'warrior', name: '戦士', best: 'def', desc: '銀の鎧で仲間を守る、鉄壁の騎士。' },
  { id: 'thief', name: '盗賊', best: 'spd', desc: '誰よりも速く動き、攻撃をかわす。' },
  { id: 'priest', name: '神官', best: 'mdef', desc: '魔法を寄せつけない、聖なる加護。' },
];

export interface GenreDef {
  id: GenreId;
  name: string;
  sub: string;
  stat: StatKey;
}
// ジャンルと上昇能力の固定対応（変更しないこと）
export const GENRES: GenreDef[] = [
  { id: 'kanri', name: '施工管理', sub: '工程・品質・安全・施工', stat: 'atk' },
  { id: 'eisei', name: '衛生設備・機器材料・設計図書', sub: '給排水・ガス・消火・図面', stat: 'def' },
  { id: 'kogaku', name: '工学基礎', sub: '環境・流体・熱・電気・建築', stat: 'mag' },
  { id: 'hoki', name: '法規', sub: '建設業法・労働安全・消防', stat: 'mdef' },
  { id: 'kucho', name: '空調設備', sub: '冷暖房・換気・排煙', stat: 'spd' },
];

export const BASE_STAT = 10;
export const BEST_STAT = 20;
