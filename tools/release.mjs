// 公開版の更新: テスト・ビルドを確認してから、変更をコミットして push する（push すると GitHub Actions が自動で公開）
// 使い方: npm run release -- "変更内容のメモ"
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const msg = process.argv.slice(2).join(' ') || '更新';

run('npm test');
run('npm run build');
const dirty = execSync('git status --porcelain').toString().trim();
if (dirty) {
  run('git add -A');
  run(`git commit -m ${JSON.stringify(msg)}`);
} else {
  console.log('変更はありません（コミットなし）。');
}
run('git push origin main');
console.log('\n公開を開始しました。1〜2分後に https://wada-mitego.github.io/kansekoquest/ に反映されます。');
console.log('進行状況: https://github.com/wada-mitego/kansekoquest/actions');
