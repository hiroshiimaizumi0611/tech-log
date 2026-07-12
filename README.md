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
```

依存関係を意図的に更新するときだけ `npm install` を使い、`package-lock.json` の差分も確認してください。

## ローカル開発

開発サーバーを起動します。

```sh
npm run dev
```

表示されたローカルURLを開きます。終了は `Ctrl+C` です。canonical URL、RSS、sitemapを生成するため、ビルド時の `SITE_URL` には公開先のHTTPS origin（パス、query、fragment、資格情報なし）が必要です。

## 記事を追加する

1. `src/content/blog/` に、URLに使う名前で `.md` または `.mdx` を追加します。
2. 後述のfrontmatterと本文を書きます。
3. 下書き中は `draft: true`、公開するときは `draft: false` にします。
4. `npm run check`、`npm test`、`SITE_URL=https://example.invalid npm run build` を実行します。
5. 記事ページ、一覧、タグ、カテゴリー、RSS、sitemap、検索をローカルで確認します。

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
heroImage: ../../assets/blog/example.svg
ogImage: ../../assets/blog/example-og.png
draft: true
---
```

- `title`: 必須。記事タイトル。
- `description`: 必須。一覧やSEOに使う要約。
- `publishedAt`: 必須。`YYYY-MM-DD` の公開日。
- `updatedAt`: 任意。公開日以降の更新日。
- `category`: 必須。`Cloud`、`Backend`、`Frontend`、`Infrastructure`、`AI`、`Operations` のいずれか。
- `tags`: 必須。空配列も可。表記の重複に注意。
- `heroImage`: 任意。記事カード・本文用画像。記事からの相対パスで指定。
- `ogImage`: 任意。SNS共有用画像。省略時は `heroImage`、さらに未設定なら既定画像を使用。
- `draft`: 任意。安全のため執筆中は `true` にする。

画像ファイルは `src/assets/blog/` へ置きます。著作権と公開可否を確認した素材だけを追加してください。

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
```

`npm run build` は最初にAstro buildで静的ファイルを `dist/` に生成し、その完了後に検索処理と成果物検査を実行します。Productionでは `SITE_URL` を実際の公開HTTPS originへ置き換えてください。

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

Variables:

- `SITE_URL`: 公開先のHTTPS origin。
- `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`: Web Analyticsを使う場合のpublic token。未使用なら空でよい。

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
