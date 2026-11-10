import fs from 'node:fs';
import { ALL_QUESTIONS } from '../src/questions';
import { GENRES } from '../src/data';

const OLD = new Set(['k1','k2','k3','k4','k5','k6','k7','k8','e1','e2','e3','e4','e5','e6','e7','e8','g1','g2','g3','g4','g5','g6','g7','g8','h1','h2','h3','h4','h5','h6','h7','h8','a1','a2','a3','a4','a5','a6','a7','a8']);
const old = ALL_QUESTIONS.filter((q) => OLD.has(q.id));
const past = ALL_QUESTIONS.filter((q) => q.sourceYear !== null);
const added = ALL_QUESTIONS.filter((q) => !OLD.has(q.id) && q.sourceYear === null);
const adopted = old.filter((q) => q.verificationStatus === 'verified' && !q.revisionNotes.includes('修正')).length;
const revised = old.filter((q) => q.verificationStatus === 'verified' && q.revisionNotes.includes('修正')).length;
const hold = old.filter((q) => q.verificationStatus === 'needs_review').length;
const rejected = old.filter((q) => q.verificationStatus === 'rejected').length;

let md = `# 問題データ監査・収録状況（${new Date().toISOString().slice(0, 10)} 作成）\n\n`;
md += `## 現行40問の監査結果\n\n採用 ${adopted} / 修正して採用 ${revised} / 保留(needs_review) ${hold} / 不採用 ${rejected}\n\n`;
md += `- 「verified」は、公開されている資料（官公庁・自治体・学術資料など）で内容を照合できた問題のみ。照合できなかったものは保留とし、ゲームには出題しない（\`INCLUDED_STATUSES\` で制御）。\n`;
md += `- 独自作問（権利状況: original）に加え、ユーザー提供の公式PDF（令和4〜8年度の問題A/B・正答肢）から取り込んだ過去問を収録（権利状況: user_supplied_official_past_exam）。過去問は同年度の正答肢PDFの値のみを正答とし、令和8年度の数値入り問題の一部はページ画像と照合済み。図表・空欄・組合せ形式、令和4〜7年度の数値入り問題は文字化けの恐れがあるため除外。公式解説は無いため解説は付けていない。\n`;
md += `- 照合は Web検索で得た二次資料を含む。厳密な一次資料（法令の最新条文・JIS・SHASE規格）の再確認は未了。\n\n`;
md += `## 収録数（verified）\n\n`;
const ver = ALL_QUESTIONS.filter((q) => q.verificationStatus === 'verified');
md += `合計 **${ver.length}問**（択一 ${ver.filter((q) => q.format === 'single').length} / 択二 ${ver.filter((q) => q.format === 'multiple').length}）。年度別: 公式過去問 ${past.filter((q) => q.verificationStatus === 'verified').length}問（${[2026, 2025, 2024, 2023, 2022].map((y) => `R${y - 2018}:${past.filter((q) => q.sourceYear === y).length}`).join(' / ')}）、独自作問 ${ver.length - past.length}問。\n\n`;
md += `| ジャンル | 収録(verified) | 択一 | 択二 | 保留 |\n|---|---:|---:|---:|---:|\n`;
for (const g of GENRES) {
  const a = ALL_QUESTIONS.filter((q) => q.genre === g.id);
  const v = a.filter((q) => q.verificationStatus === 'verified');
  md += `| ${g.name} | ${v.length} | ${v.filter((q) => q.format === 'single').length} | ${v.filter((q) => q.format === 'multiple').length} | ${a.length - v.length} |\n`;
}
md += `\n## 保留中の問題（未解決の出典）\n\n`;
for (const q of ALL_QUESTIONS.filter((x) => x.verificationStatus !== 'verified')) md += `- **${q.id}**（${GENRES.find((g) => g.id === q.genre)!.name}）${q.question}\n  - 理由: ${q.revisionNotes}／${q.sourceReference}\n`;
md += `\n## 現行40問の一覧\n\n| ID | 状況 | 問題 | 出典・確認方法 | 備考 |\n|---|---|---|---|---|\n`;
for (const q of old) md += `| ${q.id} | ${q.verificationStatus} | ${q.question.replace(/\|/g, '／')} | ${q.sourceReference.replace(/\|/g, '／')} | ${q.revisionNotes} |\n`;
md += `\n## 公式過去問から取り込んだ問題（${past.length}問）\n\n| ID | 形式 | ジャンル | 出典 |\n|---|---|---|---|\n`;
for (const q of past) md += `| ${q.id} | ${q.format === 'multiple' ? '択二' : '択一'} | ${GENRES.find((g) => g.id === q.genre)!.name} | ${q.sourceExam.split('（')[0]} |\n`;
md += `\n## 追加した問題（${added.length}問）\n\n| ID | 形式 | 問題 | 出典・確認方法 |\n|---|---|---|---|\n`;
for (const q of added) md += `| ${q.id} | ${q.format === 'multiple' ? '択二' : '択一'} | ${q.question.replace(/\|/g, '／')} | ${q.sourceReference.replace(/\|/g, '／')} |\n`;
md += `\n## 本編ボスの解放に必要な問題数\n\n本編は5体構成（10問ごとに1体、50問でラスボス）。収録${ver.length}問のうち異なる問題を50問以上初回回答すれば全ボスに到達できる（余裕 ${Math.max(0, ver.length - 50)}問）。将来ボスを追加する場合は、問題の増加に合わせて \`src/config.ts\` の \`MAIN_BOSS_IDS\` に保管ボスのIDを足す。\n\n公式の過去問（2022〜2026年度の第一次検定）は権利条件が未確認のため原文を収録していない。出典のない問題の水増しも禁止のため、出典を確認できた範囲（${ver.length}問）で止めている。公式正答（2026年10月6日付の訂正を含む）と照合できる資料や、利用許諾のある問題の提供を受ければ、\`src/data/questions.json\` に追加するだけで反映される（\`npm run validate\` で検査）。\n`;fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/question_audit.md', md);
console.log(`audit: adopted ${adopted}, revised ${revised}, hold ${hold}, rejected ${rejected}; added ${added.length}; verified ${ver.length}`);
