# 3Dサーバールーム公開デモ設計

## 目的

Blenderサーバールーム連載の第4回で紹介したReact Three Fiber製の3D監視画面を、読者がブラウザ上で操作できるデモとして公開します。

記事のスクリーンショットだけでは確認できない、視点の回転・ズーム・サーバー選択・アラーム状態の切り替えを、ログインなしで試せるようにします。

## 公開範囲

- 公開URLはブログと同じドメインの`/demos/server-room/`とします。
- 認証なしの一般公開とし、記事を読んだ人はログインせずに利用できます。
- 監視情報は14台分のローカルモックデータです。
- AWS、CloudWatch、監視API、データベースには接続しません。
- 入力内容や操作履歴は保存しません。

## リポジトリとソースの扱い

Blenderファイルと3Dアプリの制作原本は、引き続き`3d-server-room-dashboard`リポジトリで管理します。

まず3Dリポジトリの`episode-04`タグから公開対応ブランチを作り、サブパス対応、静的な戻るリンク、モバイル案内、no-JS案内、テスト用のready・カメラ変更契約を実装します。検証後に`episode-04-demo`タグを付け、そのコミットを公開版のソース・オブ・トゥルースとします。

ブログのリポジトリには、`episode-04-demo`の公開用スナップショットを`demos/server-room/`へ取り込みます。`demos/server-room/upstream.json`へ、元のタグ、コミット、同期対象ファイル、各ファイルのSHA-256を記録します。

同期には`node scripts/sync-server-room-demo.mjs --source <3Dリポジトリ>`を使います。このスクリプトは元のタグとコミットを確認し、許可したファイルだけをコピーしてmanifestを更新します。CIではmanifestとブログ内のファイルを照合し、手作業による変更や同期漏れがあれば失敗させます。ブログ側だけの独自機能は追加しません。

## ビルド構成

ブログの既存Astroビルドと、デモ用Viteビルドを1つのCIで実行します。

1. Astroがブログを`dist/`へ出力します。
2. Viteがデモを`dist/demos/server-room/`へ追加出力します。
3. Pagefindが完成した`dist/`を対象に検索インデックスを作成します。
4. 成果物検査がブログとデモの必須ファイルを確認します。
5. Cloudflare Workers Static Assetsが`dist/`全体を公開します。

デモ用Vite設定は、次の値を明示します。

- `root`: `demos/server-room`
- `base`: `/demos/server-room/`
- `publicDir`: `public`。`root`を基準に`demos/server-room/public`を参照します。
- `build.outDir`: ブログルートから絶対パスへ解決した`dist/demos/server-room`
- `build.emptyOutDir`: `false`

ルートの`build:demo`がこの設定を指定してViteを実行します。最終`build`の順序は`Astro → demo Vite → Pagefind → verify-build`とします。成果物検査では、Viteの実行後もブログの`index.html`、RSS、sitemap、Pagefindの前提ファイルが残り、GLBがデモ配下にだけ出力されたことを確認します。

デモのGLBは`/demos/server-room/models/server-room.glb`から読み込みます。3Dアプリでは`import.meta.env.BASE_URL`から取得URLを組み立て、読み込み失敗時にも同じ実URLを表示します。3Dリポジトリの通常開発では`base: /`、ブログへ同期した公開ビルドでは`base: /demos/server-room/`を使います。

Cloudflare Workers Static Assetsは、既存の`not_found_handling: 404-page`と既定の`html_handling: auto-trailing-slash`を維持します。SPA fallbackは使いません。`/demos/server-room`は末尾スラッシュ付きURLへリダイレクトし、`/demos/server-room/`はデモの`index.html`を返します。

## 依存関係

ブログのルート`package.json`で、デモに必要な次の依存関係を管理します。

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `vite`
- `@vitejs/plugin-react`
- `gltf-validator`
- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/user-event`
- `@testing-library/jest-dom`
- `@types/node`
- Three.jsおよびReactの型定義

ReactとReact DOMはブログですでに利用しているため、3D原本の互換範囲を確認したうえでブログルートのバージョンへそろえます。`npm ci`でpeer dependencyとlockfileを検証します。デモ専用`tsconfig`と`check:demo`を追加し、Vite buildとは別に`tsc --noEmit`を実行します。

デモの単体テストには専用Vitest設定を使います。対象を`demos/server-room/src/**/*.test.{ts,tsx}`、環境を`jsdom`、setup fileとCSS処理を明示し、既存のブログ単体テストとは別コマンドで実行します。ルートの`verify`には`check:demo`、デモ単体テスト、GLB検証を含めます。

## デモ画面

公開デモは第4回の完成状態を維持します。

- 床、壁2面、ラック2台、サーバー14台を表示します。
- マウスまたはトラックパッドで回転・ズームできます。
- 3DオブジェクトまたはHTMLの選択欄からサーバーを選べます。
- 選択したサーバーの名前、オブジェクトID、役割、IPアドレス、状態を表示します。
- 「アラーム発生」で選択中のサーバーだけを赤へ変更します。
- 「正常に戻す」で選択中のサーバーだけを緑へ戻します。
- 読み込み中とGLB取得失敗時に案内を表示します。

React rootの外にある静的ヘッダーへ、ブログへ戻るリンクと「モバイルでは操作領域が狭いため、デスクトップでの利用を推奨します」という短い案内を追加します。`noscript`にも、JavaScriptが必要なこととブログへ戻るリンクを表示します。

状態はページ内のReact stateだけで管理します。再読み込みすると初期状態へ戻ります。

モデル読み込み完了時は、`role="status"`を持つ表示を「3Dモデルを読み込みました」へ更新します。OrbitControlsの`change`イベントをキャンバスのラッパーにある`data-camera-change-count`へ反映し、回転・ズーム操作をE2Eで観測できるようにします。この属性は表示には使いません。

## 記事からの導線

第4回記事の「今回作るもの」付近へ、`/demos/server-room/`を別タブで開く「3Dデモを開く」リンクを追加します。

リンクの近くに次の内容を明記します。

- 読者が回転、ズーム、サーバー選択、アラーム操作を試せること
- モックデータであり、実際の監視サービスには接続していないこと
- デスクトップでの操作を推奨すること

別タブリンクには`rel="noopener"`を設定します。同一originで参照元を隠す必要はないため、`noreferrer`は付けません。

## アクセシビリティとモバイル

- 3D操作だけに依存せず、ラベル付きのHTML選択欄を残します。
- 状態は色だけでなく「正常」「障害」の文字でも表示します。
- 操作ボタンの無効状態を維持します。
- キーボードで選択欄とボタンを操作できます。
- 幅390 pxで横スクロールを発生させません。
- URLは詳細パネル内で折り返します。ページ全体には横スクロールを発生させません。
- Canvas内だけで`touch-action: none`を使い、Canvas外では縦スクロールできることを確認します。

3Dキャンバス自体の高度なタッチジェスチャー最適化は今回の対象外です。

## エラー処理

- GLB読み込み中は`role="status"`と`aria-live="polite"`を持つ案内を表示します。
- GLBの取得または解析に失敗した場合は、`role="alert"`と実際に取得したbase付きURLを含む案内を表示します。
- JavaScriptが無効な場合も、ページタイトル、ブログへ戻るリンク、モックデータであること、デスクトップ推奨案内を静的HTMLまたは`noscript`へ残します。
- 公開後のスモークテストでHTML、JavaScript、GLBのHTTP 2xxを確認します。

## 検索、セキュリティ、キャッシュ

デモは第4回記事の補助画面であり、単独の検索流入を目的にしません。`robots` metaと`X-Robots-Tag`を`noindex, follow`にし、Pagefindの検索対象から除外します。sitemapにも追加しません。HTMLには日本語のtitle、description、canonicalを設定します。canonicalは検証済みの`SITE_URL`と`/demos/server-room/`をViteのHTML変換処理で結合し、絶対URLとして出力します。

ブログの`public/_headers`へ`/demos/server-room/*`のルールを追加します。

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'`
- `X-Robots-Tag: noindex, follow`

React Three FiberとDreiがDOM要素へ設定するstyle属性を動かせるよう、`style-src`に限って`'unsafe-inline'`を許可します。scriptは外部のハッシュ付きファイルだけを読み込み、`'unsafe-inline'`は許可しません。

Cloudflare Workers Static Assetsの既定である`Cache-Control: public, max-age=0, must-revalidate`とETagを、HTML、ハッシュ付きJS/CSS、固定名GLBのすべてで維持します。今回は独自の長期immutable設定を追加せず、デプロイ直後の古いGLB残存を避けます。

## テスト

### 単体・契約テスト

- 14台分のモックデータとオブジェクト名の対応
- サーバーごとのマテリアル複製
- 選択した1台だけの状態変更
- 正常色と障害色
- 詳細パネル、選択欄、ボタンの状態
- 読み込み失敗時の案内
- 第4回記事のデモリンク、文言、属性
- Viteの`base`とGLB公開パス
- upstream manifestのファイル一覧とSHA-256
- `robots` metaが`noindex, follow`であること
- canonicalが`SITE_URL`配下の絶対URLであること
- `_headers`の各セキュリティヘッダーが設計値と一致すること

### GLB検証

- 元コミット: `c44b0dba97260f159f0af791338c6bffd5d2f22c`
- 元パス: `models/episode-03-server-room.glb`
- 3D公開コピー: `public/models/server-room.glb`
- ブログ公開コピー: `demos/server-room/public/models/server-room.glb`
- 期待SHA-256: `42114017b88bc45862e598de271ca05ce7df0e3f227197fc65941658794e552a`
- glTF Validatorをブログ公開コピーに対して実行し、`numErrors === 0`かつ`numWarnings === 0`を検証すること
- 14台のサーバーオブジェクト名に重複がなく、期待集合と完全一致すること

Validatorの出力は一時領域またはメモリ内で扱い、追跡済みレポートを書き換えません。

### E2E

- `/demos/server-room/`が表示できること
- `role="status"`が「3Dモデルを読み込みました」になり、GLBの読み込み完了を観測できること
- HTML選択欄でサーバーを選べること
- アラーム発生と正常復帰が文字と色へ反映されること
- Canvas上のdragとwheelにより`data-camera-change-count`が増えること
- ブログへ戻るリンクが正しいこと
- 第4回記事からデモを開けること
- JavaScript無効時にも案内とブログへ戻るリンクが表示されること
- axe検査に重大な違反がないこと
- 選択欄と両ボタンをキーボードで操作できること
- 幅390 pxで`document.documentElement.scrollWidth <= window.innerWidth`となること
- Canvas外では縦スクロールできること
- ブラウザコンソールにアプリ由来のエラーがないこと

### ビルド成果物

- `dist/demos/server-room/index.html`
- デモのJavaScriptとCSS
- `dist/demos/server-room/models/server-room.glb`
- HTMLとアセットURLが`/demos/server-room/`を参照すること
- ブログの`index.html`、RSS、sitemapがVite build後も残ること
- GLBが`dist/demos/server-room/models/`にだけ出力されること
- PagefindのentryとindexにデモURLやデモ本文が含まれないこと
- デモURLがsitemapに含まれないこと

### 本番スモークテスト

- `/demos/server-room`が末尾スラッシュ付きURLへリダイレクトすること
- `/demos/server-room/`がHTTP 200を返すこと
- HTMLからmodule scriptとstylesheetを抽出し、同じサブパス内のURLであること
- JavaScriptとCSSがHTTP 2xxおよび期待MIMEを返すこと
- GLBがHTTP 2xx、期待MIME、期待SHA-256を満たすこと
- CSP、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`、`X-Robots-Tag`が設計した値と一致すること
- HTML、JavaScript、CSS、GLBの`Cache-Control`が`public, max-age=0, must-revalidate`であること

既存の`scripts/smoke-production.mjs`と対応単体テストへ、これらの検査を追加します。ローカルのAstro previewだけでなく、デプロイ後のWorkersレスポンスを確認します。

## 公開手順

1. 公開デモ用ブランチで実装します。
2. Node.js 24でクリーンインストール後にブログの`verify`を実行します。
3. ローカルの本番プレビューでデスクトップとモバイルを確認します。
4. PRを作成し、CI成功を確認します。
5. `main`へマージしてCloudflareへデプロイします。
6. 公開URL、記事の導線、操作、スモークテストを確認します。
7. `_headers`が適用された本番環境で、モデルready、選択、アラーム、正常復帰、回転、ズームまで到達できることを実ブラウザで確認します。

## 対象外

- 実際の監視APIとの接続
- AWSやCloudWatchとの接続
- ログイン、権限管理
- 操作履歴や状態の永続化
- WebSocketによるリアルタイム更新
- チャートや履歴表示
- 3Dアセットの追加制作
- Three.jsチャンクの分割

## 完了条件

- 読者が`/demos/server-room/`をログインなしで開けます。
- 回転、ズーム、選択、アラーム発生、正常復帰を操作できます。
- 第4回記事からデモへ移動でき、デモからブログへ戻れます。
- デスクトップと幅390 pxで利用でき、横あふれがありません。
- ブログ、デモ、GLB、E2Eの検証がNode.js 24で成功します。
- Cloudflareへのデプロイと本番スモークテストが成功します。
- `episode-04-demo`タグ、upstream manifest、ブログ内の同期ファイルが一致します。
