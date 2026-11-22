# MyDietのアイコン作成と正式アイコンへの反映

## アプリ内で作成する

「設定 → アプリアイコン」を開きます。初期状態は現在の正式アイコンです。

- 「文字・数字」では日本語・英字・数字・記号・絵文字を最大5書記素まで入力します。結合文字や家族などの絵文字を途中で分割しません。背景色・文字色を選び、中央1行のプレビューを確認します。
- 「写真・画像」では画像を選び、拡大・縮小、左右・上下のスライダーで正方形に切り抜きます。
- 通常は1024pxを保存してください。正式なPWA素材用には、同じデザインで192px・512px・180px（Apple用）も保存します。
- iPhoneでは「共有・ファイルに保存」から保存先を選べます。共有できない環境では「PNGを保存」でダウンロードします。

プレビューだけを角丸表示します。保存されるPNGは不透明な正方形です。作成内容は端末内だけで処理し、食品・記録・設定のデータベースを変更しません。画面を閉じると作成途中の内容は保持されません。

## Codexで正式アイコンに組み込む

作成した `mydiet-icon-192.png`、`mydiet-icon-512.png`、`mydiet-icon-180.png` をPCへ移し、Codexに3枚のパスを伝えて「MyDietの正式なPWAアイコンに反映して」と依頼できます。画像の作成・保存だけでは、公開中のアイコンは変わりません。

手動で更新する場合はMyDietのプロジェクト直下で次を実行します。

```powershell
node scripts/apply-app-icons.mjs --check "C:\保存先\mydiet-icon-192.png" "C:\保存先\mydiet-icon-512.png" "C:\保存先\mydiet-icon-180.png"
node scripts/apply-app-icons.mjs "C:\保存先\mydiet-icon-192.png" "C:\保存先\mydiet-icon-512.png" "C:\保存先\mydiet-icon-180.png"
npm test
npm run build
```

最初の行は検証だけです。2行目で `public/icon-192.png`、`public/icon-512.png`、`public/apple-touch-icon.png` を更新します。ManifestとApple touch iconのパスは変えません。Manifestのid/start_url/scope/display、IndexedDB名も維持します。現在のstandalone起動をショートカットやSafari起動に置き換えません。

画像・Manifestの内容もService Workerのバージョン計算に含まれるため、画像だけの更新でも再ビルドすると更新対象になります。新しいアイコンはオフライン用キャッシュにも含まれます。

## 公開する

画像3枚を確認してコミットし、既存の公開ブランチへpushします。GitHubへの画像の自動アップロード機能はありません。

**今回の調査では、リポジトリはVercelに接続され、GitHubのhomepageもVercelのURLでした。GitHub Pages設定はAPIで取得できず、Pagesのworkflowも見つかりませんでした。** この機能の追加でホスティング先・公開URLは変更しません。既存のmainへのpush後、設定済みのVercel自動デプロイの結果を確認してください。

別途GitHub Pagesで公開している場合も、既存の公開方法をそのまま利用してください。Viteのbaseは `./`、Manifest・Apple touch icon・Service Workerは相対パスのままで、`/calorie-tracker/` のようなサブパスをブラウザーテストしています。Pagesの配信対象はViteでビルドした `dist/` の内容です。新しいPages設定やURLへの移行は今回行っていません。

URLを変えるとブラウザーの保存領域は別になります。現在使っているURLを維持してください。移行が必要な場合は先にJSONバックアップを保存し、別途移行手順を確認してください。

## iPhoneで反映を確認する

1. 公開完了後、MyDietのすべての画面・タブを閉じ、同じURLで開き直します。既存Service Workerは古い画面が閉じられた後に更新されます。
2. 正式画像とManifestを確認します。サイトデータの消去は行いません。
3. ホーム画面のアイコンはiOS側でキャッシュされ、即時変更されない場合があります。追加し直す場合も、先にJSONバックアップを保存し、同じURLを利用してください。インストール済みアイコンをWebアプリから強制変更する機能はありません。

WebKitの自動テストは実機の写真ライブラリ・共有シートそのものを保証しないため、最後に実機で確認してください。

## 変更ファイル

- 作成画面・描画: `src/AppIcon.tsx`、`src/iconDrawing.ts`、設定への導線: `src/main.tsx`、見た目: `src/style.css`
- PWAの画像キャッシュと更新判定: `public/sw.js`、`vite.config.mjs`、`scripts/pwaAssets.mjs`
- PNG組み込み: `scripts/apply-app-icons.mjs`、`scripts/apply-app-icons.d.mts`
- 検証: `src/iconDrawing.test.ts`、`src/pwa.test.js`、`e2e/app-icon.pw.ts`、`playwright.config.ts`
- 手順・開発設定: `docs/app-icons.md`、`README.md`、`package.json`、`package-lock.json`、`.gitignore`
