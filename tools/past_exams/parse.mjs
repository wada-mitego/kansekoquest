// 過去問PDFから抽出したテキスト → 問題オブジェクトの下書き
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];

const RUBY = /^[\sぁ-ゟー・]+$/;
const CJK_GAP = /\s+(?=[^\x00-\x7F])|(?<=[^\x00-\x7F])\s+/g;

export function clean(raw) {
  const lines = raw
    .split('\n')
    .filter((l) => !l.startsWith('==='))
    .filter((l) => !/^\s*―\s*\d+\s*―\s*$/.test(l))
    .filter((l) => !RUBY.test(l) || l.trim() === '');
  return lines.join('\n');
}

const flat = (s) => s.replace(/\n+/g, ' ').replace(CJK_GAP, '').replace(/\s{2,}/g, ' ').trim();

export function parseExam(text) {
  // 問題ブロックに分割
  const re = /【\s*No\.\s*(\d+)\s*】/g;
  const marks = [...text.matchAll(re)];
  const out = [];
  marks.forEach((m, i) => {
    const body = text.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : text.length);
    out.push({ no: Number(m[1]), body });
  });
  return out.map(({ no, body }) => {
    // 選択肢マーカー "( 1" "(1"
    const cm = [...body.matchAll(/(?:^|\n)\s*(?:[;(=>（<:：]|9)\s*([1-4])\s/g)];
    // 1,2,3,4 の順に並ぶ最初の組を採用
    let idx = [];
    let want = 1;
    for (const c of cm) {
      if (Number(c[1]) === want) {
        idx.push(c);
        want++;
        if (want > 4) break;
      }
    }
    if (idx.length !== 4) return { no, error: 'choices', raw: body.slice(0, 200) };
    const stem = flat(body.slice(0, idx[0].index));
    const choices = idx.map((c, k) => {
      let seg = body.slice(c.index + c[0].length, k + 1 < 4 ? idx[k + 1].index : body.length);
      if (k === 3) {
        // 最後の選択肢: 次の注意書き(※/問題番号 …)以降を切り落とす
        const cut = seg.search(/\n\s*(※|問題番号|問\s*題\s*番\s*号|【|第\s*\d|\d+\s*ページ)/);
        if (cut >= 0) seg = seg.slice(0, cut);
      }
      return flat(seg);
    });
    return { no, stem, choices };
  });
}

export function parseAnswers(text) {
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const nums = (s) => (s.match(/\d+/g) ?? []).map(Number);
  // 見出し行（連番）と、その直後の回答行（1つ=単一正答、2つ=二つ選択）を順に集める
  const groups = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/^[^\d]*?(?=\d)/, (m) => (/問題番号|正答肢|Ａ|Ｂ|●/.test(m) || m === '' ? '' : m));
    const n = nums(l);
    const onlyNums = /^[^\d]*(\d+( \d+)+)\s*$/.test(l) || /^(問題番号|●正答肢|Ａ|Ｂ|問|題| )*\s*\d+( \d+)+\s*$/.test(l);
    if (n.length >= 5 && onlyNums && n.every((v, k) => k === 0 || v === n[k - 1] + 1)) {
      const rows = [];
      for (let j = i + 1; j < lines.length && rows.length < 2; j++) {
        const r = nums(lines[j].replace(/^[^\d]*(?=\d)/, ''));
        const label = lines[j].replace(/[\d\s]/g, '').replace(/問|題|解答|Ａ|Ｂ|●|正答肢|番号/g, '');
        if (r.length === n.length && r.every((v) => v >= 1 && v <= 4) && label.length === 0) rows.push(r);
        else if (r.length === 0) continue; // 「解答」だけの行など
        else break;
      }      groups.push({ start: n[0], nos: n, rows });
    }
  }
  return groups;
}
if (process.argv[1].endsWith('parse.mjs')) {
  for (const y of [3, 4, 5, 6, 7, 8]) {
    for (const part of ['A', 'B']) {
      const f = path.join(dir, `R${y}_1kan_01_mondai${part}.txt`);
      const qs = parseExam(clean(fs.readFileSync(f, 'utf8')));
      console.log(`R${y} ${part}: ${qs.length} questions, errors: ${qs.filter((q) => q.error).map((q) => q.no)}`);
      if (y === 8 && process.argv[3] === 'dump') qs.forEach((q) => console.log(`  ${part}${q.no}: ${q.stem?.slice(0, 50)}`));
    }
  }
}
