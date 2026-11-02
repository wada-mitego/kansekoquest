# 公開手順（無料・PCを閉じても遊べる）

公開物は静的ファイルだけ（`dist/` フォルダ、またはその zip `kankouji-rpg-dist.zip`）です。サーバー処理はなく、セーブは遊ぶ人のブラウザ内(localStorage)に保存されます。

## A. いちばん簡単: Netlify Drop（登録なしで試せる）
1. https://app.netlify.com/drop を開く
2. `dist` フォルダをそのままドラッグ&ドロップ
3. 発行された `https://xxxx.netlify.app` を共有
   - 登録せずに作ったサイトは一定時間で消えるので、残したい場合は無料アカウントを作って「Claim site」する。

## B. Cloudflare Pages（無料・帯域無制限）
1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → **Upload assets**
2. プロジェクト名を決め、`dist` フォルダ（または zip）をアップロード → Deploy
3. `https://プロジェクト名.pages.dev` が発行される

## C. GitHub Pages（ソースも管理したい場合）
1. GitHubで新規リポジトリを作り、このプロジェクトを push（`node_modules` と `dist` は除外）
2. 付属の `.github/workflows/deploy.yml` を使う場合: Settings → Pages → Source を **GitHub Actions** にする
3. push すると自動ビルド・公開され、`https://ユーザー名.github.io/リポジトリ名/` で遊べる

## 更新するとき
`npm run build` → 新しい `dist` を同じ方法で上げ直す（Netlify/Cloudflareは再アップロード、GitHubはpush）。

## 注意
- 問題の正確性は公開前にご自身で確認してください（`src/questions.ts`）。
- 文字フォント(DotGothic16)は Google Fonts から読み込みます。読めない環境では代替フォントで表示されます。
