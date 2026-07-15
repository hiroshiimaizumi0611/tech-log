# テックログ

Astro、Markdown、Pagefind、Cloudflare Workers Static Assetsで構成した技術ブログです。記事は `src/content/blog/` で管理し、ビルド時に静的HTMLと検索インデックスを生成します。

## Node.js

Node.js 24 が必要です。`package.json` の `engines` も24系に固定しています。

```sh
node --version
```

## インストール

リポジトリを取得したら、lockfileどおりに依存関係を入れます。

```sh
npm ci
npx playwright install chromium
```

`npm ci` はNode.jsの依存packageを入れますが、Playwrightのブラウザーはインストールしません。LinuxまたはCIでOS依存packageも必要な場合は、ブラウザーの導入に次を使います。

```sh
npx playwright install --with-deps chromium
```

依存packageを意図的に更新するときだけ `npm install` を使い、`package-lock.json` の差分も確認してください。

## ローカル開発

開発サーバーを起動します。

```sh
npm run dev
```

表示されたローカルURLを開きます。終了は `Ctrl+C` です。canonical URL、RSS、sitemapを生成するため、ビルド時の `SITE_URL` には公開先のHTTPS origin（パス、query、fragment、資格情報なし）が必要です。

`npm run dev` は執筆中の表示確認用です。Production build後のPagefind索引は生成しないため、Productionと同じ検索は確認できません。検索を含む成果物は後述のbuildとpreviewで確認します。

## 記事を追加する

1. `src/content/blog/` に、URLに使う名前で `.md` または `.mdx` を追加します。
2. 後述のfrontmatterと本文を書きます。
3. 下書き中は `draft: true`、公開するときは `draft` を削除するか `draft: false` にします。
4. `npm run check`、`npm test`、`SITE_URL=https://example.invalid npm run build` を実行します。
5. `npm run preview` を起動し、記事ページ、一覧、タグ、カテゴリー、RSS、sitemap、検索を表示URLから確認します。

`draft: true` の記事はProductionのページ、一覧、RSS、sitemap、検索から除外されます。`draft: false` は公開対象になるため、内容・日付・リンクを確認してから変更してください。

## frontmatter

最小例です。

```yaml
---
title: 記事タイトル
description: 記事の要約
publishedAt: '2026-07-12'
updatedAt: '2026-07-12'
category: Frontend
tags:
  - Astro
draft: true
---
```

- `title`: 必須。記事タイトル。
- `description`: 必須。一覧やSEOに使う要約。
- `publishedAt`: 必須。`YYYY-MM-DD` の公開日。
- `updatedAt`: 任意。公開日以降の更新日。
- `category`: 必須。`Cloud`、`Backend`、`Frontend`、`Infrastructure`、`AI`、`Operations` のいずれか。
- `tags`: 必須。空配列も可。表記の重複に注意。
- `draft`: 任意。省略時は `false` になり公開対象。下書き中は明示的に `true` にする。
- `featured`: 任意。省略時は `false`。`true` の公開記事をホームの注目記事候補にする。
- `featuredCode`: 任意。互換性のため残しているメタデータ。現在のコンパクトな注目記事では、コードパネルとこのメタデータの内容を表示しない。
  - `language`: 必須。コードの言語を表す空でない文字列。
  - `filename`: 任意。互換性のため残しているファイル名のメタデータ。現在の表示には使用しない。
  - `code`: 必須。空白だけではないコード本文。
- `heroImage`: 任意。記事カードの画像に使用し、`ogImage` がない場合はOG画像にも使用。現在のコンパクトな注目記事には表示しない。記事本文にも自動表示しない。
- `ogImage`: 任意。OG画像として最優先。画像の選択順は `ogImage`、`heroImage`、サイトの既定画像。

`heroImage` と `ogImage` は任意で、画像を使わない場合は省略します。使う場合は `src/assets/blog/` に画像ファイルを先に追加し、`src/content/blog/` の記事から `../../assets/blog/<ファイル名>` の形式で指定します。これは現在のcontent schemaの `image()` が検証・importできる、記事ファイル基準の相対パスです。著作権と公開可否を確認した実在ファイルだけを指定してください。

注目記事は下書きを除く公開記事から選びます。複数の記事が `featured: true` の場合は、公開日が新しい順、同じ公開日ならIDの昇順で最初の記事を選びます。候補がなければ最新の公開記事を使います。選ばれた記事には「FEATURED」、タイトル、リンクだけを表示します。

## テスト

段階別の確認コマンドです。

```sh
npm run check
npm test
SITE_URL=https://example.invalid npm run build
SITE_URL=https://example.invalid npm run verify
```

`npm run verify` はformat、Astro check、unit test、build、Playwright E2Eを順番に実行します。PRではGitHub Actionsの `verify` が同じ受け入れ確認を行います。

## ビルド

```sh
SITE_URL=https://example.invalid npm run build
npm run preview
```

`npm run build` は最初にAstro buildで静的ファイルを `dist/` に生成し、その完了後に検索処理と成果物検査を実行します。続けて `npm run preview` を起動し、表示されたローカルURLで記事と検索を操作し、`/rss.xml` と `/sitemap-index.xml` も確認します。Productionでは `SITE_URL` を実際の公開HTTPS originへ置き換えてください。

## Pagefind

PagefindはMarkdownではなく、Astroが生成したHTMLを索引化します。`npm run build` ではAstroの生成後にPagefindで `dist/pagefind/` を作るため、通常は個別実行不要です。

```sh
npm run build:astro
npm run build:search
```

上記を分けて実行する場合も、この順序を守ります。検索へ記事が出ないときは、`draft`、`dist/pagefind/`、buildログの索引ページ数を確認してからプレビューを更新します。

## Cloudflare

このサイトは `wrangler.jsonc` のStatic Assets設定で `dist/` を配信します。公開を伴わないローカル確認は次のとおりです。

```sh
SITE_URL=https://example.invalid npm run build
npx wrangler deploy --dry-run
```

実際のdeployは、公開先、権限、連絡先を確認し、GitHub側の設定が完了してから `main` のDeploy workflowで行います。最小権限のWorkers API tokenを使用し、秘密値をファイル、commit、チャット、ログへ貼り付けないでください。

## GitHub Secrets / Variables

Repository settingsで次だけを登録します。値はREADMEや `.env.example` に書きません。

Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_WEB_ANALYTICS_TOKEN`: Cloudflare Web Analyticsのpublic token。任意。workflowがbuild環境の `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` へ割り当てるため、GitHubではこのSecret名で登録する。

Variables:

- `SITE_URL`: 公開先のHTTPS origin。
- `PUBLIC_GOOGLE_SITE_VERIFICATION`: Search Consoleが提示するHTMLタグの`content`値だけを登録する。タグ全体は登録しない。production deployでは必須で、未設定・重複・不一致はデプロイ前の成果物検査で失敗する。

Cloudflare Web Analyticsは、閲覧中のホストが`SITE_URL`のホストと一致する場合だけ読み込みます。localhostやプレビューURLで本番成果物を確認しても、Analyticsへ送信しません。

PRではCIの `verify` を必須checkにします。GitHubのbranch protectionで、`main` への直接変更を避け、PRと `verify` の成功を必須にしてください。

## 公開

外部公開はtarget / authorization / contactの設定後にだけ実施します。このREADMEの手順を読んだだけでは、リポジトリ作成、push、deployを実行しません。

1. GitHub repositoryのowner、名前、公開範囲を確認する。
2. Cloudflare account、Workers target、最小権限tokenを確認する。
3. 公開メールとGitHub URL（必要ならX、Zenn）を `src/config/site.ts` に設定する。未設定のリンクはFooterに表示されない。
4. GitHub Secrets / Variablesを登録する。
5. PRを作り、branch protectionで必須にした `verify` の成功を確認する。
6. 承認後に `main` へmergeし、Deploy workflowのbuild、deploy、smokeがすべて成功したことを確認する。
7. 公開URLでトップ、4記事、検索、RSS、sitemap、404、faviconを確認する。

smoke確認はレスポンス本文やSecretsをログへ出さず、HTTP statusだけを検査します。公開メールとGitHub URLが未設定の状態はローカル検証可能ですが、Production完成条件は満たしません。

## トラブルシューティング

- `SITE_URL must ...`: `SITE_URL` がHTTPS originか確認します。末尾 `/` は使用できますが、path、query、fragment、ユーザー名・パスワードは付けません。
- Astro checkまたはbuildが失敗する: 最初のエラーと対象記事のfrontmatterを確認し、日付、カテゴリー、タグ、画像パスを直します。
- 検索結果がない: Astro buildの後にPagefindが動いたか、`dist/pagefind/` と索引件数を確認します。下書きはProduction検索に出ません。
- Playwrightが起動しない: Node.js 24と依存関係を確認し、必要なら `npx playwright install chromium` を実行します。
- Cloudflareの検証が失敗する: Secrets / Variablesの「名前」と登録先を確認します。値を表示する診断コマンドやログ追加は行いません。
- deploy後のsmokeが失敗する: 失敗したURLとHTTP status、Deploy workflowの該当stepだけを確認します。レスポンス本文やtokenをログへ出しません。
- ローカルとCIで結果が違う: Node.js 24で `npm ci` をやり直し、`SITE_URL=https://example.invalid npm run verify` を実行します。

公開作業は外部システムを変更します。target、authorization、contactやProduction情報が不足している場合はそこで止め、設定を推測しないでください。
