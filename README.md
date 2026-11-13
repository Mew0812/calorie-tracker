# MyDiet

よく食べる食品を登録して、＋・−で食事を記録する iPhone 向けのカロリー・PFC 管理アプリです。食品、画像、食事、目標はブラウザの IndexedDB に保存されます。

## 開発環境

Node.js 22 以上を使用します。PowerShell で npm の実行ポリシーに抵触する場合は、`npm` を `npm.cmd` に置き換えてください。

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

開発サーバーの URL はターミナルに表示されます。ビルド成果物は `dist/` に生成されます。PWA の動作は本番ビルドで有効になります。

## iPhone の Safari で使う

### GitHub から Vercel に公開する

GitHub で空のリポジトリを作成します。README、ライセンス、.gitignore の自動生成はオフにします。以下をプロジェクトのルートで実行し、URL は作成したリポジトリのものに置き換えてください。

```sh
git init -b main
git add .
git diff --cached --name-only
git commit -m "Initial MyDiet release"
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

Vercel の「Add New」→「Project」で GitHub リポジトリをインポートします。Root Directory はリポジトリ直下、Framework Preset は Vite、Build Command は `npm run build`、Output Directory は `dist` です。環境変数の登録は不要です。デプロイ後は Production の HTTPS URL を使います。

### ホーム画面に追加する

1. `npm run build` で生成した `dist/` を、HTTPS の静的ホスティングに配置します。
2. iPhone の Safari で、配置先の URL を開きます。
3. Safari の共有メニューで「ホーム画面に追加」を選び、「追加」を押します。
4. ホーム画面の MyDiet を開き、「食品を追加」から普段食べる食品を登録します。

同じ URL を使い続けてください。別の URL やブラウザのデータ領域に移すときは、設定の「バックアップ・復元」から JSON をエクスポートし、移行先で復元します。復元は端末内のデータを置き換えます。

## 記録・集計

- 1日を最初に記録した時点の目標を、その日付に保存します。切り替えに備えて筋トレ日と休養日の両方を保持します。目標の新規設定は設定日以降に新しく作る記録へ適用します。
- 同じ日の食品の数量は1行で管理し、最初の登録時に保存した栄養成分を使います。計算では小数点以下6桁を保持し、画面には最大1桁を表示します。
- 分析の週間は月曜始まり、月間は暦月です。平均と週間差の合計は記録完了日が対象です。棒グラフと日別の差には記録中の日も表示します。
- 食品登録は方式切替と換算プレビュー、セットはリスト編集、分析は栄養素のグラフ切替を採用しています。

`src/model.ts` が日付、計算、データアクセス、バックアップの処理を担当します。UI は `src/main.tsx`、テーマとレイアウトは `src/style.css` にあります。

