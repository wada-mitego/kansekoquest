import raw from './data/questions.json';
import type { GenreId } from './data';

export type VerificationStatus = 'verified' | 'needs_review' | 'rejected';

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  genre: GenreId;
  /** single=四肢択一 / multiple=四肢択二（2つ選んで確定） */
  format: 'single' | 'multiple';
  question: string;
  choices: Choice[];
  correctAnswerIds: string[];
  explanation: string;
  sourceYear: number | null;
  sourceExam: string;
  sourceQuestionNo: string | null;
  sourceReference: string;
  checkedAt: string;
  verificationStatus: VerificationStatus;
  rightsStatus: string;
  revisionNotes: string;
  /** false にすると選択肢の並べ替えをしない（順序依存の問題用） */
  shuffle?: boolean;
}

/** ゲームに出題してよい検証状況。未確認(needs_review)は含めない */
export const INCLUDED_STATUSES: VerificationStatus[] = ['verified'];

export const ALL_QUESTIONS = raw as unknown as Question[];
export const QUESTIONS: Question[] = ALL_QUESTIONS.filter((q) => INCLUDED_STATUSES.includes(q.verificationStatus));

const GENRE_IDS = ['kanri', 'eisei', 'kogaku', 'hoki', 'kucho'];

/** データ投入時の整合性検査。問題があれば説明文を返す */
export function validateQuestions(list: Question[]): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const q of list) {
    const p = `[${q.id}]`;
    if (!q.id) errs.push('IDが空の問題がある');
    if (seen.has(q.id)) errs.push(`${p} IDが重複`);
    seen.add(q.id);
    if (!GENRE_IDS.includes(q.genre)) errs.push(`${p} ジャンルが不正: ${q.genre}`);
    if (q.choices.length !== 4) errs.push(`${p} 選択肢が4つではない`);
    const ids = q.choices.map((c) => c.id);
    if (new Set(ids).size !== ids.length) errs.push(`${p} 選択肢IDが重複`);
    const texts = q.choices.map((c) => c.text.trim());
    if (new Set(texts).size !== texts.length) errs.push(`${p} 選択肢の文言が重複`);
    if (q.correctAnswerIds.length === 0) errs.push(`${p} 正答がない`);
    for (const a of q.correctAnswerIds) if (!ids.includes(a)) errs.push(`${p} 正答ID ${a} が選択肢に存在しない`);
    const want = q.format === 'multiple' ? 2 : 1;
    if (q.correctAnswerIds.length !== want) errs.push(`${p} 正答数(${q.correctAnswerIds.length})が形式(${q.format})と不一致`);
    if (!q.question.trim()) errs.push(`${p} 問題文が空`);
    if (!q.explanation.trim()) errs.push(`${p} 解説が空`);
    if (q.verificationStatus === 'verified' && !q.sourceReference.trim()) errs.push(`${p} verified なのに出典がない`);
    if (!q.rightsStatus) errs.push(`${p} rightsStatus が空`);
  }
  return errs;
}

export function questionsOf(genre: GenreId, list: Question[] = QUESTIONS): Question[] {
  return list.filter((q) => q.genre === genre);
}

/** 解答の判定。四肢択二は2つとも一致した場合のみ正解（部分正解なし） */
export function isCorrect(q: Question, picked: string[]): boolean {
  if (picked.length !== q.correctAnswerIds.length) return false;
  const a = [...picked].sort().join('|');
  const b = [...q.correctAnswerIds].sort().join('|');
  return a === b;
}
