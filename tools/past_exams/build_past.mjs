// 過去問(令和3〜8年度)の抽出テキスト → src/data/past_questions.json
// 使い方: node build_past.mjs <txtフォルダ> <出力json> [R3の正答JSON]
import fs from 'node:fs';
import { clean, parseAnswers, parseExam } from './parse.mjs';

const [, , dir, outFile, r3Ans] = process.argv;
const YEARS = { 3: 2021, 4: 2022, 5: 2023, 6: 2024, 7: 2025, 8: 2026 };
const MARK = ['a', 'b', 'c', 'd'];

/** 年度ごとの問題番号 → ジャンル（問題Aは全年度共通。問題Bは必須数の違いで境界が1つずれる） */
function genreOf(part, no, y) {
  if (part === 'A') {
    if (no <= 14) return 'kogaku';
    if (no <= 25) return 'kucho';
    if (no === 43) return 'hoki';
    return 'eisei';
  }
  const mustEnd = y <= 5 ? 10 : 9;
  const selEnd = y <= 5 ? 22 : 21;
  if (no <= mustEnd) return 'kanri';
  if (no <= selEnd) return 'hoki';
  return 'kanri';
}

const SKIP_FIG = /下図|次図|上図|右図|左図|別図|図に示|図中|図のよう|図は|図の|グラフ|表に示|次の表|下表|表は|写真|文中|空欄|に当てはまる|内に当てはま|組合せ|［|\[|イ[、，]|次の(記述|文)の/;
const SUSPECT = /[?@�◯]|(?:^|[^A-Za-z0-9])[A-Z]{1,3} [A-Z]{1,3}(?![A-Za-z])|^[A-Za-z0-9]/;
const REF = /前記|上記|いずれ|すべて|全て|[(（][1-4][)）]|選択肢|次のうち|組合せ/;

const norm = (s) => s.replace(/[\s　、。，．・]/g, '');
const seen = new Map();
const out = [];
const stats = {};

for (const y of [8, 7, 6, 5, 4, 3]) {
  const kaitouFile = `${dir}/R${y}_1kan_01_kaitou.txt`;
  let groups = null;
  if (y === 3) {
    if (!r3Ans) continue;
    groups = JSON.parse(fs.readFileSync(r3Ans, 'utf8'));
  } else {
    groups = parseAnswers(fs.readFileSync(kaitouFile, 'utf8'));
  }
  // groups: [A1-22, A23-44, B1-.., B..-29]
  const ans = { A: {}, B: {} };
  const put = (sect, g) => g.nos.forEach((n, i) => (ans[sect][n] = g.rows.map((r) => r[i])));
  put('A', groups[0]);
  put('A', groups[1]);
  put('B', groups[2]);
  put('B', groups[3]);

  for (const part of ['A', 'B']) {
    const qs = parseExam(clean(fs.readFileSync(`${dir}/R${y}_1kan_01_mondai${part}.txt`, 'utf8')));
    const st = (stats[`R${y}${part}`] = { parsed: qs.length, kept: 0, skip: {} });
    const skip = (why) => (st.skip[why] = (st.skip[why] ?? 0) + 1);
    for (const q of qs) {
      if (q.error) { skip('parse'); continue; }
      const a = ans[part][q.no];
      if (!a || !a.length) { skip('noAnswer'); continue; }
      const multi = a.length === 2;
      const all = [q.stem, ...q.choices].join(' ');
      if (SKIP_FIG.test(all)) { skip('figure/table/blank'); continue; }
      // 数字・記号の文字化けが確認された年度(R3〜R7)は、数値を含まず量の表現も無い問題だけを採用する（令和8年度は数字が正しく取り出せる）
      if (y !== 8 && (/[0-9]/.test(all) || /以上|以下|未満|超え|倍|割|％|%|(?<![A-Za-z])[A-Z](?![A-Za-z])/.test(all))) { skip('quantity-risk(R3-R7)'); continue; }
      if (/[。．]\s*[0-9](\s[0-9])*\s*$/.test(q.stem) || q.choices.some((c) => /[。．]\s*[0-9](\s[0-9])*\s*$/.test(c)) || /[のがは]\s*(以上|以下|未満)/.test(all)) { skip('lost-number'); continue; }
      const tail = (s) => (s.includes('。') ? s.slice(s.lastIndexOf('。') + 1).replace(/[）)」』]/g, '').trim() : '');
      if ([q.stem, ...q.choices].some((s) => tail(s) !== '')) { skip('trailing-garbage'); continue; }
      if (SUSPECT.test(q.stem) || q.choices.some((c) => SUSPECT.test(c))) { skip('suspect-glyph'); continue; }
      if (q.choices.some((c) => c.length < 3)) { skip('short-choice'); continue; }
      if (q.stem.length < 8) { skip('no-stem'); continue; }
      if (multi && !/二つ/.test(q.stem)) { skip('multi-mismatch'); continue; }
      if (!multi && /二つ/.test(q.stem)) { skip('multi-mismatch'); continue; }
      const key = norm(q.stem + [...q.choices].sort().join('|'));
      const id = `r${y}${part.toLowerCase()}${q.no}`;
      const ref = `令和${y}年度 第一次検定 問題${part} No.${q.no}`;
      if (seen.has(key)) {
        const first = seen.get(key);
        first.sourceExam += `／同一問題: ${ref}`;
        skip('duplicate');
        continue;
      }
      const correctIdx = a.map((n) => n - 1);
      const rec = {
        id,
        genre: genreOf(part, q.no, y),
        format: multi ? 'multiple' : 'single',
        question: q.stem,
        choices: q.choices.map((t, i) => ({ id: MARK[i], text: t })),
        correctAnswerIds: correctIdx.map((i) => MARK[i]),
        explanation: `公式の正答肢: ${correctIdx.map((i) => `(${i + 1}) ${q.choices[i]}`).join(' ／ ')}`,
        sourceYear: YEARS[y],
        sourceExam: `${ref}（1級管工事施工管理技術検定）`,
        sourceQuestionNo: `No.${q.no}`,
        sourceReference: `全国建設研修センター公表の試験問題PDF(R${y}_1kan_01_mondai${part}.pdf)と正答肢PDF(R${y}_1kan_01_kaitou.pdf)の記載どおり。ふりがなを除き、文言は原文のまま`,
        checkedAt: new Date().toISOString().slice(0, 10),
        verificationStatus: 'verified',
        rightsStatus: 'user_supplied_official_past_exam',
        revisionNotes: 'ユーザー提供の公式PDFから転記。解説は公式に無いため付けていない（正答肢のみ表示）。権利関係は公開者が確認すること。',
      };
      if (REF.test(q.choices.join(' '))) rec.shuffle = false;
      seen.set(key, rec);
      out.push(rec);
      st.kept++;
    }
  }
}
fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
for (const [k, v] of Object.entries(stats)) console.log(k, `parsed ${v.parsed} kept ${v.kept}`, JSON.stringify(v.skip));
const g = {};
out.forEach((r) => (g[r.genre] = (g[r.genre] ?? 0) + 1));
console.log('total', out.length, JSON.stringify(g), 'multiple', out.filter((r) => r.format === 'multiple').length);
