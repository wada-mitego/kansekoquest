# カンセコクエスト（1級管工事施工管理技士・第一次検定 × レトロRPG）

Phaser 4 + TypeScript + Vite。

```bash
npm install
npm run dev        # 開発サーバ (http://localhost:5173)  ?debug を付けると window.__game / window.__bgm を公開
npm run build      # dist/ に本番ビルド（公開手順は PUBLISH.md）
npm test           # 自動テスト（周回制・解放・四肢択二・セーブ移行・戦闘式・全クリア率）
npm run validate   # 問題データの整合性検査
npm run sim        # 全クリア率シミュレーション（TRIALS=1000 REPORT=1 で docs/balance_report.md を更新）
```

## ゲーム構成
- 本編ボス5体（第1〜第4ボス＋ラスボス）。**初めて回答した異なる問題が10問ごとに1体解放、50問でラスボス**（3形態の連続戦闘）。
  バルブロック → フローダム → ダクトハヤーテ → エルボルガ → ハイカンオー・カンセコア
- 本編から外した5体（ドレンスライム／ポンプトロル／スチームドラゴ／アツリョーガ／セイギョノス）は `src/config.ts` の `ARCHIVED_BOSSES` に保管（画像も `public/assets` に残している）。`MAIN_BOSS_IDS` にIDを足せば、解放条件ごと本編へ戻せる。
- 周回制・強化ボス（本編とは別カウンター。5体構成では 110〜150、160〜200…）・四肢択二は従来どおり。

## 問題データ
- `src/data/questions.json`（独自作問56問）＋ `src/data/past_questions.json`（公式過去問 令和4〜8年度から117問）。出題されるのは `verificationStatus: verified` のみ。
- 過去問は、ユーザー提供の公式PDF（問題A/B・正答肢）から、同年度の正答肢PDFの値を正答として取り込み。図・表・空欄・組合せ形式と、数字が文字化けする令和4〜7年度の数値入り問題は除外。再生成手順は `tools/past_exams/README.md`。権利関係は公開者が確認すること。

## 戦闘式（`src/config.ts` の `BALANCE` / `src/battle.ts`）
- 命中率 = 技の基本命中率 + (攻撃側素早さ − 防御側素早さ) × 0.025（0.40〜0.98）
- 回避率 = (防御側素早さ − 攻撃側素早さ) × 0.016（0〜0.40）。最終成功率 = 命中率 × (1 − 回避率)
- 会心率 = 0.05 + (攻撃側素早さ − 防御側素早さ) × 0.013（0.02〜0.40）。会心は**通常の物理ダメージ計算後に2倍**（プレイヤー・ボス共通）
- 魔法ダメージ = ボス魔力×威力 ×（1 − 魔法防御/(魔法防御+30)）。軽減は最大70%
- スイジュク（回復）= 基礎12 + 魔法防御 × 3.5（最大HPの60%まで・MP5）

## BGM・設定
- `public/assets/bgm/` の6曲を画面ごとに再生（タイトル／職業選択／ジャンル選択・ホーム／問題／通常・強化ボス／ラスボス）。`src/bgm.ts` が WebAudio でループ（先頭・末尾の無音をループ区間から除外）・クロスフェード・二重再生防止を担当。
- 問題出題中は他より小さな音量。初回のタップ／クリック／キー操作で再生解禁（スマホの自動再生制限対応）。
- BGM ON/OFF・音量・効果音ON/OFFは「せってい」で変更でき、`localStorage`（`kankouji-rpg.settings.v1`）に保存。ホーム画面にも ♪ON/OFF ボタン。

## UI
すべての選択ボタン（`src/ui.ts` の `button`）は、文字ではなく**表示している枠そのもの**を当たり判定にしている。職業選択はキャラ絵＋名前をまとめたカード全体が当たり判定。ホバー時は枠が明るくなる。

## セーブ
`localStorage` のキー `kankouji-rpg.save.v1`（初期から同じキー）。読み込み時に v1/v2 を v3 へ自動移行し、移行前の生データは `.v1.backup` / `.v2.backup` に退避。能力値・撃破済みボス（安定ID。保管ボスの撃破記録も保持）・回答履歴を保持し、移行に失敗した場合は元データを変更しない。今回の改修でセーブ形式（v3）は変更なし。

## 主なファイル
- `src/data/questions.json` … 問題データ（出典・検証状況つき）。`src/questions.ts` が読み込み・検証・判定
- `src/state.ts` … セーブ v3、周回・出題エンジン、移行 / `src/config.ts` … 戦闘定数・ボス定義 / `src/battle.ts` … 戦闘計算
- `src/bgm.ts` … BGM / `src/sfx.ts` … 効果音 / `src/ui.ts` … ボタン等 / `src/scenes/*` … 各画面（PC横長・スマホ縦長）
- `tools/sim.ts` … 全クリア率シミュレーション / `tools/test.ts` … 自動テスト
- `docs/question_audit.md`（問題の監査）、`docs/balance_report.md`（勝率表）、`backup/`（旧データ）
