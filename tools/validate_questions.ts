import { ALL_QUESTIONS, QUESTIONS, validateQuestions } from '../src/questions';
import { GENRES } from '../src/data';
const errs = validateQuestions(ALL_QUESTIONS);
console.log(`全${ALL_QUESTIONS.length}問 / 出題対象(verified) ${QUESTIONS.length}問`);
for (const g of GENRES) {
  const a = ALL_QUESTIONS.filter((q) => q.genre === g.id);
  const v = a.filter((q) => q.verificationStatus === 'verified');
  console.log(`  ${g.name}: 全${a.length} / verified ${v.length}（択一${v.filter((q) => q.format === 'single').length}・択二${v.filter((q) => q.format === 'multiple').length}）`);
}
if (errs.length) {
  console.log('エラー:\n' + errs.join('\n'));
  process.exit(1);
}
console.log('検証OK');
