# テックログ 設計書

作成日: 2026-07-11  
状態: ユーザー承認済み  
対象: 初期公開版

## 1. 目的

個人の技術発信とポートフォリオを兼ねた、日本語の技術ブログ「テックログ」を構築する。最優先の読者は、技術的な解決策を探している現役エンジニアとする。

ブログは記事の読みやすさを最優先にしつつ、クラウド、バックエンド、フロントエンド、IaC、AI、運用・障害調査に関する実務的な知識が伝わるものにする。

初期版の完了条件は、Cloudflare Workersの`*.workers.dev` URLで公開可能かつ実際に閲覧できる状態である。独自ドメイン接続は初期版の対象外とする。

### 1.1 要件の優先順位

この設計書は、ユーザー提供の`tech-blog-implementation-spec.md`を対話で更新し、承認された最新版である。両者が競合する場合はこの設計書を優先する。特に次は意図的な変更であり、元仕様へ戻さない。

- Pagefind全文検索を後回しから初期リリース必須へ変更する。
- 初期記事3と4を、GPT-5.6 Sol・Terra・LunaおよびChatGPT Workの記事へ変更する。
- 初期4記事を表示確認用ダミーではなく、公開可能な実用記事として作成する。
- 初期版はダークテーマだけとし、ライトテーマ切り替えは実装しない。

## 2. ブランドとコンテンツ方針

### 2.1 ブランド

- 正式名称: `テックログ`
- 著者表示名: `Hiroshi Imaizumi`
- ヘッダータグライン: `つくる、動かす、改善する。`
- ヒーロー説明文: `クラウド、バックエンド、フロントエンド、IaC、AI、運用まで。現場で得た技術の実践知を、わかりやすく発信します。`
- UIと記事本文: 日本語のみ

### 2.2 デザイン

提供されたデザインカンプをデスクトップの基準とし、可能な限り忠実に再現する。ただし、次は置き換える。

基準カンプの識別情報:

- ソースファイル: `/Users/hiroshiimaizumi/Downloads/ChatGPT Image 2026年7月10日 14_24_24.png`
- 画像サイズ: `1122 × 1402 px`
- SHA-256: `5de510f2e464569e1ff6d130d545a466db97121dfa19efa76c8a2d7a990267f4`

このパスのファイルを実装と視覚確認の基準にする。パスが変わった場合は、同じSHA-256の画像を基準カンプとして扱う。

- 実在しない記事数、閲覧数、運用期間は表示しない。
- 動作しない操作は置かない。
- 公式ロゴを模倣した画像は使わず、独自の抽象図形へ置き換える。
- モバイルは可読性と操作性を優先し、1カラムへ再構成する。

配色は次のCSSカスタムプロパティを基準とし、コンポーネントへ色を直接ハードコードしない。

| 用途 | 値 |
| --- | --- |
| 背景 | `#07090D` |
| セクション背景 | `#0B0F14` |
| カード背景 | `#10151C` |
| カードHover | `#151C25` |
| 境界線 | `#202936` |
| メイン文字 | `#F5F7FA` |
| サブ文字 | `#A6AFBC` |
| 弱い文字 | `#6F7885` |
| アクセント | `#4EA1FF` |
| アクセント淡色 | `#8CC5FF` |

初期版はダークテーマのみとする。将来ライトテーマを追加できるよう、色、文字、境界線、状態色はセマンティックなトークンとして定義する。テーマ切り替えUIとそのJavaScriptは初期版に含めない。

外部Webフォントは初期表示性能を優先して使わない。日本語本文はシステムゴシック、UIはモダンなサンセリフ、コードは利用可能なシステム等幅フォントを優先する。

### 2.3 著者情報

- 実名と、青いアクセントを使った`HI`モノグラムを表示する。
- 初期リリースでは、2026-07-13にユーザー承認された`HI`プレースホルダーを正式な著者表示として採用する。
- 顔写真を基にした著者イラストは、将来ユーザーが希望した場合だけ別変更として作成する。
- 問い合わせは公開メールアドレスへの`mailto:`リンクとする。
- GitHub、X、Zenn、Emailは設定値として管理し、空の項目はアイコンやリンク自体を表示しない。

## 3. 初期リリース範囲

### 3.1 必須機能

- Astro、TypeScript strict、Tailwind CSS、Markdown、MDX
- Astro Content Collectionsによる記事スキーマ検証
- トップ、記事一覧、記事詳細、タグ、カテゴリー、About、Privacy、404
- RSS、sitemap、canonical、OGP、Twitter Card、構造化データ
- Shikiコードハイライト、ファイル名表示、コードコピー
- Pagefindによる日本語全文検索とモーダルUI
- カテゴリー別の抽象サムネイルと記事固有画像の上書き
- Desktop、Tablet、Mobile対応
- Cloudflare Web Analytics
- GitHub ActionsによるPR検証と`main`マージ後の自動公開
- Cloudflare Workersの静的アセット配信
- 実用的に読める初期記事4本
- ローカル開発、記事追加、テスト、ビルド、公開手順を記載したREADME

### 3.2 対象外

- 独自ドメイン接続
- ライトテーマとテーマ切り替え
- コメント
- ニュースレター
- CMS、管理画面、認証、DB
- 閲覧数、実ランキング、架空統計
- 会員機能
- 多言語対応
- SSRとオンデマンドレンダリング

## 4. システム構成

### 4.1 採用方式

Astroの完全静的生成を採用する。Cloudflareアダプターは使用しない。全ページをビルド時にHTML化し、Cloudflare Workersでは`dist`を静的アセットとして配信する。

PagefindはAstroビルド後の`dist`を索引化し、`dist/pagefind`へ検索用アセットを生成する。検索サーバーは持たない。

ブラウザへ送るJavaScriptは次に限定する。

- Pagefindモーダル検索
- モバイルメニュー
- コードコピー
- MDX記事で明示的に使うReact Island

### 4.2 公開フロー

GitHubリポジトリはPublicとし、サイト実装自体もポートフォリオとして閲覧できるようにする。`draft: true`はWeb公開だけを防ぐもので、Publicリポジトリ上のソースは隠さない。機密情報や公開前に秘匿すべき原稿はコミットしない。

1. Markdown、MDX、画像、設定をブランチで変更する。
2. Pull Requestを作成する。
3. GitHub Actionsが静的検査、単体テスト、ビルド、Pagefind索引、ブラウザテストを実行する。
4. 必須チェック成功後に`main`へマージする。
5. デプロイジョブが同じ検証とビルドを再実行する。
6. Wranglerが`dist`をCloudflare Workersへ公開する。
7. 公開URLに対してスモークテストを実行する。

## 5. ページ構成

| URL | 内容 |
| --- | --- |
| `/` | ヒーロー、注目記事、最新4記事、人気タグ、著者プロフィール |
| `/blog/` | 全記事一覧、公開日降順、1ページ12件の静的ページネーション |
| `/blog/[slug]/` | 記事詳細、目次、前後記事、関連記事、著者情報 |
| `/tags/` | 全タグと記事数 |
| `/tags/[tag]/` | 対象タグの記事一覧 |
| `/categories/` | 6カテゴリーと記事数 |
| `/categories/[category]/` | 対象カテゴリーの記事一覧 |
| `/about/` | 自己紹介、得意分野、技術スタック、ブログ目的、外部リンク、問い合わせ |
| `/privacy/` | Cloudflare Web Analyticsと問い合わせ情報を含むプライバシー説明 |
| `/404.html` | 復帰導線付きの独自404 |
| `/rss.xml` | 公開記事のRSS |
| `/sitemap-index.xml` | 公開ページのsitemap |

タグ・カテゴリー・記事一覧は共通の一覧レイアウトとArticleCardを使う。空の一覧では空グリッドを表示せず、理由と戻り先を案内する。

## 6. コンポーネント境界

### 6.1 レイアウト

- `BaseLayout`: HTML骨格、共通メタデータ、スキップリンク、Header、Footer、Analytics
- `ArticleLayout`: 記事ヘッダー、本文、目次、前後記事、関連記事、著者情報
- `ListingLayout`: 一覧見出し、件数、ArticleCardグリッド、ページネーション、空状態

### 6.2 共通UI

- `Header`: ロゴ、ホーム、記事、カテゴリー、タグ、プロフィール、検索、モバイルメニュー
- `Footer`: ロゴ、説明、メニュー、カテゴリー、Privacy、問い合わせ用`mailto:`、RSS、設定済みSNS、Copyright
- `Container`: 最大幅と左右余白
- `SectionHeading`: セクション見出しと任意リンク
- `TagChip`: タグリンク、件数、Hover、可視フォーカス
- `SearchModal`: Pagefindのモーダル構造とテックログ用スタイル
- `CodeCopyButton`: コピー成功・失敗状態

### 6.3 記事UI

- `ArticleCard`: 画像、日付、タイトル、概要、タグ、読了時間
- `FeaturedArticle`: 注目記事、任意のコードプレビュー、続きを読む導線
- `ArticleMeta`: 公開日、更新日、カテゴリー、タグ、読了時間
- `ArticleToc`: DesktopのSticky目次とMobileの折りたたみ目次
- `RelatedArticles`: 最大3件の関連記事
- `CategoryArtwork`: 6カテゴリーの抽象サムネイル

### 6.4 トップUI

- `Hero`: サイト紹介と技術領域
- `LatestArticles`: 最新4記事
- `PopularTags`: 記事数上位10タグ
- `AuthorProfile`: イラスト、名前、紹介、設定済み外部リンク。架空統計は表示しない

各コンポーネントは表示に必要な値をPropsとして受け取り、Content Collectionsの検索や集計を内部で行わない。取得、絞り込み、集計はページまたは専用のコンテンツユーティリティで行う。

## 7. 記事データ

### 7.1 ファイル形式とURL

- 通常記事は`.md`を使う。
- 記事内でReactデモが必要な場合だけ`.mdx`を使う。
- ファイル名のstemをURL slugとする。
- ファイル名は小文字ASCIIのkebab-caseとする。
- 例: `terraform-drift-detection.md` → `/blog/terraform-drift-detection/`
- タグURLは、表示名をUnicode NFKC正規化し、前後空白を除去し、小文字化し、連続空白を`-`へ変換してからURLエンコードする。
- 例: `TypeScript` → `/tags/typescript/`、`生成 AI` → `/tags/%E7%94%9F%E6%88%90-ai/`
- 異なる表示名が同じタグURLになる場合はビルドを失敗させ、記事側のタグ表記を統一する。

### 7.2 frontmatter

必須:

| 項目 | 型 | 規則 |
| --- | --- | --- |
| `title` | string | 空文字不可 |
| `description` | string | 一覧、SEO、検索結果に使用 |
| `publishedAt` | date | JST基準の公開日 |
| `category` | enum | 6分類から1つ |
| `tags` | string[] | 0個以上、重複不可 |

任意:

| 項目 | 型 | 既定値・用途 |
| --- | --- | --- |
| `updatedAt` | date | `publishedAt`以降であること |
| `draft` | boolean | 既定値`false` |
| `featured` | boolean | 既定値`false` |
| `heroImage` | local image | 記事固有の画像 |
| `ogImage` | local image | 未設定なら`heroImage`、さらに未設定ならサイト共通画像 |
| `featuredCode` | object | `language`、任意`filename`、`code` |

### 7.3 カテゴリー

| 値 | 日本語表示 | URL |
| --- | --- | --- |
| `Cloud` | クラウド / AWS | `cloud` |
| `Backend` | バックエンド | `backend` |
| `Frontend` | フロントエンド | `frontend` |
| `Infrastructure` | インフラ / IaC | `infrastructure` |
| `AI` | AI | `ai` |
| `Operations` | 運用 / 障害調査 | `operations` |

1記事の主カテゴリーは1つだけとし、補助分類はタグで表現する。

### 7.4 派生データ

- 公開記事: 本番では`draft: false`のみ。下書きは一覧、RSS、sitemap、Pagefindから除外する。
- 注目記事: `featured: true`のうち公開日が最新の記事。該当なしなら全公開記事の最新。
- 最新記事: 公開日降順の先頭4件。
- 人気タグ: 公開記事の件数降順、同数なら表示名昇順。先頭10件。
- 読了時間: 本文の空白を除く文字数を500文字/分で割って切り上げ、最低1分。
- 関連記事: 自分を除き、同カテゴリー一致を優先し、次に共通タグ数の多い順、公開日の新しい順、最後にslugの昇順で順位付けし、最大3件。
- 前後記事: 公開日順で直前と直後の記事。
- 画像: `heroImage`未設定時はカテゴリー別の抽象画像を使う。

## 8. 初期記事

初期公開時に、表示確認用のダミーではなく、実用的に読める日本語記事を4本公開する。各記事は見出し、コードまたは例、リスト、引用、参考情報を含み、記事ページの主要要素を検証できる内容とする。

1. `2026年版 Astroで技術ブログを構築した`
2. `Terraformで手動変更されたリソースを追従する方法`
3. `GPT-5.6 Sol・Terra・Lunaの違い―特徴・料金・選び方`
4. `ChatGPT Workとは？Chat・Codexとの違いと使い分け`

記事3と4はOpenAI公式情報を一次情報とし、日本語で要点、違い、用途、選び方を再構成する。価格、提供プラン、対応環境など変わりやすい情報には「記事更新時点」と明記し、公開時に再確認する。

主要な一次情報:

- [GPT-5.6公式発表](https://openai.com/index/gpt-5-6/)
- [ChatGPT Work公式ページ](https://openai.com/chatgpt-work/)
- [ChatGPT WorkとCodexの公式Help](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)

## 9. レスポンシブ設計

### 9.1 Desktop

- 全体最大幅は約1280px。
- ヒーローはサイト紹介と注目記事の2カラム。
- 最新記事は4カラム。
- 記事本文は約760pxで、右側にSticky目次を置く。

### 9.2 Tablet

- ヒーローの2カラム比率と余白を縮小する。
- 記事カードは2カラム。
- 目次が本文幅を圧迫する場合はMobile形式へ切り替える。

### 9.3 Mobile

- ヒーローは`サイト紹介 → 注目記事`の順で1カラム表示する。
- 紹介文を短く保ち、注目記事の冒頭が早い段階で見える高さにする。
- 記事カードは1カラム。
- Headerはフォーカス管理付きのモバイルメニューへ切り替える。
- 目次は記事冒頭の折りたたみ表示とする。
- コードブロックだけ横スクロールを許可し、ページ全体の横スクロールは発生させない。

## 10. 検索

Pagefindのモーダル検索を採用する。ヘッダーの検索ボタンから開き、次を満たす。

- 開いた直後に検索入力へフォーカスする。
- モーダル内にフォーカスを閉じ込める。
- `Escape`、閉じるボタン、背景クリックで閉じられる。
- 閉じた後は検索ボタンへフォーカスを戻す。
- 背景スクロールを抑止する。
- 日本語ページとして索引化し、記事タイトル、概要、本文、タグ、カテゴリーを検索対象にする。
- Header、Footer、ナビゲーション、コードコピーボタンなどは索引対象外にする。
- 検索アセットはモーダルを初めて開いた時点で遅延ロードする。
- 索引読込に失敗した場合はエラー文と記事一覧へのリンクを表示し、ページ閲覧を妨げない。

## 11. 記事表示

- 本文文字サイズは16〜18px、行間は約1.8、最大幅は約760px。
- 見出しにはアンカーリンクを付ける。
- 外部リンクは視覚的に判別できるようにする。
- コードブロックはShikiで装飾し、任意のファイル名、コピーボタン、横スクロールを提供する。
- コピー成功時は短時間`コピーしました`、失敗時は`コピーできませんでした`を表示する。
- 画像は幅と高さを確保し、遅延読み込み、必須alt、任意キャプションに対応する。
- `featuredCode`はトップの注目記事専用で、未設定ならコード領域自体を表示しない。

## 12. エラーとフォールバック

| 状態 | 動作 |
| --- | --- |
| 存在しないURL | 独自404。トップ、記事一覧、検索への導線を表示 |
| 記事0件 | 理由と戻り先を表示 |
| 検索結果0件 | 条件変更と記事一覧を案内 |
| Pagefind読込失敗 | モーダル内にエラーと記事一覧リンク。ほかのページは通常動作 |
| Clipboard API非対応・失敗 | 失敗通知。コードの閲覧と手動選択は維持 |
| 記事画像未設定 | カテゴリー別画像 |
| 記事画像読込失敗 | カード寸法を保ったカテゴリー別画像または単色フォールバック |
| 不正frontmatter | Content Collectionsの検証でビルド失敗 |
| 外部リンク未設定 | 対応するアイコンとリンクを非表示 |

## 13. SEO、アクセシビリティ、性能

### 13.1 SEO

- 全ページにtitle、description、canonical URLを設定する。
- 記事タイトルは`記事タイトル | テックログ`とする。
- Blog、BlogPosting、PersonのJSON-LDを適用する。
- OGPとTwitter Cardを設定する。
- テックログのブランドに合わせたfaviconを設定する。
- 本番URLは環境変数で一元管理し、Production buildでは未設定をエラーにする。
- RSS、sitemap、Pagefindには公開記事だけを含める。

### 13.2 アクセシビリティ

- `header`、`nav`、`main`、`article`、`aside`、`footer`を適切に使う。
- 本文へのスキップリンクを設ける。
- 全主要操作をキーボードだけで実行可能にする。
- 可視フォーカスを保持する。
- アイコンだけのボタンにアクセシブルネームを付ける。
- テキストと背景はWCAG AA相当のコントラストを満たす。
- 見出し階層を飛ばさない。
- `prefers-reduced-motion`では不要な動きを停止する。

### 13.3 性能

- React IslandはMDX記事で必要な場合だけ読み込む。
- Pagefind索引は検索開始まで遅延ロードする。
- 画像寸法を予約し、CLSを防ぐ。
- 初期表示に不要なスクリプトを配信しない。
- JavaScript無効時でも記事閲覧、通常リンク、ページネーションを利用できる。
- LighthouseのPerformance、Accessibility、Best Practices、SEOは各90以上を合格目安とする。

## 14. テスト戦略

### 14.1 単体テスト

Vitestで次を検証する。

- 下書き除外
- 公開日順
- 注目記事の選択とフォールバック
- 人気タグの件数と順序
- 関連記事の順位付け
- 前後記事
- 日本語読了時間
- カテゴリーとslugの変換

### 14.2 ブラウザテスト

Playwrightとaxeで、ビルド済みサイトに対して次を検証する。

- トップから記事詳細への移動
- 記事一覧の静的ページネーション
- タグ、カテゴリー一覧と詳細
- Mobileメニューの開閉、フォーカス、Escape
- Pagefindモーダルの検索、結果移動、フォーカス、Escape
- コードコピーの成功・失敗表示
- 404からの復帰
- RSS、sitemap、Pagefind成果物の存在
- 主要ページに重大または深刻なaxe違反がないこと

### 14.3 手動確認

- 提供カンプとDesktop表示の視覚的一致
- 1440px、768px、390px付近での余白、改行、カード配置
- 日本語本文とコードの読みやすさ
- カテゴリー別画像の統一感
- Lighthouse各カテゴリ90以上

## 15. GitHub ActionsとCloudflare Workers

### 15.1 Pull Request

Pull Requestでは次を必須チェックにする。

1. `npm ci`
2. フォーマット検査
3. `astro check`
4. Vitest
5. `npm run build`によるAstro buildとPagefind indexing
6. Playwrightとaxe

必須チェック失敗時は`main`へマージしない。

### 15.2 Production deploy

- `main`へのマージだけがProduction deployを実行する。
- Wrangler設定は`assets.directory = "./dist"`と独自404処理を持つ。
- SSR entry pointは持たない。
- Cloudflare API tokenとAccount IDはGitHub Secretsで管理する。
- 本番URLは`SITE_URL`、Cloudflare Web Analytics tokenは`PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`というGitHub Repository Variablesで管理する。
- 秘密値をコード、Actionsログ、公開リポジトリへ出力しない。
- デプロイ失敗時は直前の公開版を維持する。
- デプロイ後にトップ、代表記事、RSS、sitemap、404をHTTPで確認する。

### 15.3 Analytics

Cloudflare Web AnalyticsはProductionだけで有効化する。`PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`がない開発・テスト環境ではスクリプトを出力しない。このtokenはブラウザへ配信される公開設定値として扱い、Secretには入れない。初期版ではCookie、広告、ユーザー追跡用DBを使用しない。

## 16. 外部入力と公開前作業

実装は仮値で進められるが、Production公開前に次が必要である。

- CloudflareアカウントとWorkers用API token、Account ID
- GitHubリポジトリの作成先
- 最終的な`*.workers.dev` URLを設定する`SITE_URL`
- Cloudflare Web Analyticsの`PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`
- 公開するメールアドレス
- GitHub、X、Zennのうち表示するURL

値が未提供のSNSリンクは表示しない。著者表示にはユーザー承認済みの`HI`モノグラムを使用する。

## 17. 受け入れ条件

- `npm install`と`npm ci`が成功する。
- `npm run dev`でローカル起動できる。
- TypeScript strictと`astro check`が成功する。
- 単体テストとブラウザテストが成功する。
- Astro build後にPagefind索引が生成される。
- `npm run build`で、公開可能な`dist`が一度に生成される。
- 提供カンプのDesktopデザインを忠実に再現している。
- Desktop、Tablet、Mobileでページ全体のレイアウトが崩れない。
- MarkdownまたはMDX追加だけで記事、タグ、カテゴリー、RSS、sitemap、検索へ反映される。
- `draft: true`はProductionの全導線と索引から除外される。
- 注目記事、関連記事、前後記事が規則どおり生成される。
- Pagefindモーダル、モバイルメニュー、コードコピーをキーボードで操作できる。
- 404、RSS、sitemap、OGP、構造化データ、faviconが存在する。
- Footerに問い合わせ、Copyright、RSS、設定済みSNSへの導線が存在する。
- 初期4記事が実用的な内容で公開される。
- GitHub ActionsのPRチェックが機能する。
- `main`マージ後にCloudflare Workersへ公開され、スモークテストが成功する。
- Lighthouse各カテゴリ90以上を目安として満たす。
- READMEにNode.js要件、ローカル起動、記事追加、検証、ビルド、Cloudflare/GitHub設定、公開方法を記載する。

## 18. 参考資料

- ユーザー提供: `tech-blog-implementation-spec.md`
- ユーザー提供: トップページデザインカンプ
- [AstroのCloudflare公開ガイド](https://docs.astro.build/en/guides/deploy/cloudflare/)
- [Cloudflare WorkersのAstroガイド](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
- [Pagefind公式ドキュメント](https://pagefind.app/docs/)
- [Pagefind Modal](https://pagefind.app/docs/components/modal/)
