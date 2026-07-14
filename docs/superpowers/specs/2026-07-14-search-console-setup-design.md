# Search Console計測基盤 設計

## 目的

Google検索からテックログへ流入する状態を観測できるようにする。記事テーマの選定は対象外とし、今回は所有権確認、sitemap送信、計測確認に限定する。

## 現状

- 公開先は `https://tech-log.hiroshiimaizumi0611.workers.dev`。
- canonical、robots、sitemap、構造化データ、Cloudflare Web Analyticsは本番で配信済み。
- 直近24時間の本番流入は12訪問、25ページビュー。参照元は直接10件、Bing 2件。
- Google Search Consoleのプロパティは未確認で、Google検索で公開ページのインデックスを確認できない。

## 設計

### Search Console

URLプレフィックスプロパティを使用する。`workers.dev`のDNS全体は所有していないため、ドメインプロパティは使わない。

所有権確認にはGoogle指定のHTMLメタタグを使う。GitHub Repository Variable `PUBLIC_GOOGLE_SITE_VERIFICATION`には、Googleが示すタグ全体ではなく`content="..."`内の値だけを保存する。値はtrimし、未設定または空白だけならタグを出さない。全ページ共通の`<head>`を生成する`SEOHead.astro`から、`<meta name="google-site-verification" content={token} />`を1件だけ出力し、確認後も削除しない。確認値は公開情報であり、production buildだけへRepository Variableから渡す。

### sitemap

Search Consoleで `/sitemap-index.xml` を送信する。現在のAstro sitemap生成をそのまま使う。公開後はindexがHTTP 200で本番originの`/sitemap-0.xml`を参照すること、子sitemapもHTTP 200で、本番originの絶対canonical URLだけを含むことを確認する。Search Consoleではfetch・解析エラーのない処理成功を確認する。sitemap送信はGoogleへの発見ヒントであり、インデックス登録を保証しない。

### 分析データ

Search Consoleを検索表示回数、検索語、順位、クリック数の正とする。Cloudflare Web Analyticsは訪問数、閲覧ページ、参照元の正とする。ローカル閲覧が混ざる問題はSearch Console登録を妨げないため、別変更で本番host限定にする。

## 検証

- テスト用確認値を指定したproduction buildで、ホームの`<head>`に正しいname/contentの確認タグが1件だけ出る。
- 確認値を指定しない場合と空白だけの場合はタグを出さない。
- 本番公開後、未認証で取得したホームの`<head>`に確認タグが1件だけあり、canonicalが本番originを指す。
- sitemap indexと子sitemapがHTTP 200で、本番originの絶対URLだけを案内する。
- Search Consoleで所有権確認が成功し、sitemapの処理結果にfetch・解析エラーがない。
