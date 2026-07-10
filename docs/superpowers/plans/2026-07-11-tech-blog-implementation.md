# テックログ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Astroで完全静的な日本語技術ブログ「テックログ」を構築し、Pagefind検索、4本の実用記事、品質ゲート、Cloudflare Workersへの自動公開まで完成させる。

**Architecture:** Astro 7で全ページを事前生成し、Content Collectionsを唯一の記事データ源にする。PagefindはAstroビルド後の`dist`を索引化し、Cloudflare WorkersはSSRなしで静的アセットだけを配信する。ブラウザJavaScriptは検索、モバイルメニュー、コードコピー、明示的なMDX React Islandに限定する。

**Tech Stack:** Node.js 24、npm、Astro 7、TypeScript strict、Tailwind CSS 4、MDX、React 19、Pagefind 1.5、Vitest 4、Playwright 1.61、axe、Wrangler 4、GitHub Actions

---

## 実行前提

- 仕様書: `docs/superpowers/specs/2026-07-11-tech-blog-design.md`
- 実装は専用worktreeと`codex/tech-blog`ブランチで行う。
- Node.jsは`.nvmrc`で24に固定する。現在のローカルNode.js 25はAstro公式のサポート対象外なので使わない。
- 依存関係は実装開始時に下記major/minorをインストールし、`package-lock.json`で正確に固定する。
- デザイン作業では`@frontend-design`、著者画像作成ではユーザーの参考画像受領後に`@imagegen`を使う。
- 外部サービスの作成・Secrets設定・公開pushは、実行時に対象アカウントを確認してから行う。

## ファイル責務マップ

### ルート設定

- `package.json`: 開発、検査、ビルド、検索索引、E2E、公開コマンド
- `package-lock.json`: 依存関係固定
- `.nvmrc`: Node.js 24
- `tsconfig.json`: Astro strict設定
- `astro.config.mjs`: MDX、React、sitemap、Tailwind、Markdownプラグイン
- `vitest.config.ts`: 単体テスト設定
- `playwright.config.ts`: ビルド済みサイトのブラウザテスト設定
- `.prettierrc.json`: Astro対応フォーマット設定
- `wrangler.jsonc`: Workers静的アセットと独自404設定
- `.env.example`: 公開設定値の例

### 設定とドメインロジック

- `src/config/site.ts`: サイト名、説明、著者、SNS、カテゴリー
- `src/content.config.ts`: Content Collections schema
- `src/lib/content/posts.ts`: 公開記事、並び順、注目、最新、前後、関連記事
- `src/lib/content/tags.ts`: タグ正規化、slug、件数、衝突検出
- `src/lib/content/reading-time.ts`: 日本語読了時間
- `src/lib/content/pagination.ts`: 一覧ページの分割
- `src/lib/remark-code-filename.ts`: コードフェンスのファイル名メタデータ
- `src/lib/seo.ts`: canonical、OGP、JSON-LD生成

### レイアウトとUI

- `src/layouts/BaseLayout.astro`: HTML骨格、SEO、Header、Footer、Analytics
- `src/layouts/ArticleLayout.astro`: 記事本文、目次、前後、関連記事、著者
- `src/layouts/ListingLayout.astro`: 一覧、件数、ページネーション、空状態
- `src/components/layout/{Header,Footer,MobileMenu}.astro`: 共通ナビゲーション
- `src/components/common/{Container,SectionHeading,TagChip,SEOHead}.astro`: 共通UI
- `src/components/home/{Hero,LatestArticles,PopularTags,AuthorProfile}.astro`: トップ固有UI
- `src/components/blog/{ArticleCard,FeaturedArticle,ArticleMeta,ArticleToc,RelatedArticles,CategoryArtwork,SearchModal}.astro`: 記事UI
- `src/scripts/{mobile-menu,code-copy,search-modal}.ts`: 最小限のブラウザ動作
- `src/styles/{tokens,global,article,pagefind}.css`: トークン、全体、記事、検索

### ページとコンテンツ

- `src/pages/index.astro`: トップ
- `src/pages/blog/index.astro`, `src/pages/blog/page/[page].astro`, `src/pages/blog/[slug].astro`: 記事一覧と詳細
- `src/pages/tags/index.astro`, `src/pages/tags/[tag].astro`: タグ
- `src/pages/categories/index.astro`, `src/pages/categories/[category].astro`: カテゴリー
- `src/pages/{about,privacy,404}.astro`: 静的ページ
- `src/pages/rss.xml.ts`: RSS
- `src/content/blog/*.md`: 初期4記事。React Islandが必要な将来記事だけ`.mdx`
- `src/assets/images/author.png`: 承認済み著者イラスト
- `public/og-default.png`: 共通OGP

### 検査と公開

- `tests/unit/*.test.ts`: コンテンツロジック、SEO、production env
- `tests/e2e/*.spec.ts`: 導線、検索、キーボード、a11y、成果物
- `scripts/validate-site-url.mjs`: 通常build用のHTTPS `SITE_URL`検査
- `scripts/validate-production-env.mjs`: deploy用のCloudflare認証値検査
- `scripts/verify-build.mjs`: RSS、sitemap、Pagefind成果物検査
- `.github/workflows/ci.yml`: Pull Request品質ゲート
- `.github/workflows/deploy.yml`: `main`公開とスモークテスト

## Task 1: Astro 7基盤と最初の失敗するブラウザテスト

**Files:**
- Create: `.nvmrc`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `astro.config.mjs`
- Create: `.prettierrc.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/env.d.ts`
- Create: `src/pages/index.astro`
- Create: `tests/e2e/home.spec.ts`

- [ ] **Step 1: Node.js 24を選択する**

```bash
printf '24\n' > .nvmrc
nvm install 24
nvm use 24
node --version
```

Expected: `v24.x.x`。

- [ ] **Step 2: package manifestを作る**

`package.json`のscriptsを次で開始する。

```json
{
  "name": "tech-log",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "dev": "astro dev",
    "build:astro": "astro build",
    "build:search": "pagefind --site dist",
    "build": "npm run build:astro && npm run build:search && node scripts/verify-build.mjs",
    "preview": "astro preview",
    "check": "astro check",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify": "npm run format:check && npm run check && npm test && npm run build && npm run test:e2e",
    "validate:production": "node scripts/validate-production-env.mjs",
    "deploy": "npm run validate:production && npm run build && wrangler deploy"
  }
}
```

- [ ] **Step 3: 依存関係を固定する**

```bash
npm install astro@7 @astrojs/mdx@7 @astrojs/react@6 @astrojs/sitemap@3 @astrojs/check@1 react@19 react-dom@19 tailwindcss@4 @tailwindcss/vite@4
npm install --save-dev typescript@5 pagefind@1.5.2 vitest@4 @playwright/test@1.61 @axe-core/playwright@4 prettier@3 prettier-plugin-astro@0 wrangler@4 unist-util-visit@5 sharp@0
npx playwright install chromium
```

Expected: `package-lock.json`生成、peer dependency errorなし。

- [ ] **Step 4: Astroとテスト設定を作る**

`tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } }
}
```

`astro.config.mjs`は`mdx()`、`react()`、`sitemap()`、`tailwindcss()`を登録し、`site`は`process.env.SITE_URL ?? "http://localhost:4321"`とする。Cloudflare adapterと`output: "server"`は追加しない。

`vitest.config.ts`はE2Eを誤検出しないよう次を明示する。

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

`playwright.config.ts`は`webServer.command = "SITE_URL=https://example.invalid npm run build && npm run preview -- --host 127.0.0.1"`、`baseURL = "http://127.0.0.1:4321"`、Chromiumのみとする。

- [ ] **Step 5: トップの失敗テストを書く**

```ts
import { expect, test } from '@playwright/test';

test('トップにブランド名と日本語langがある', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page).toHaveTitle(/テックログ/);
  await expect(page.getByRole('heading', { level: 1, name: 'テックログ' })).toBeVisible();
});
```

- [ ] **Step 6: 失敗を確認する**

Run: `npm run test:e2e -- tests/e2e/home.spec.ts`

Expected: FAIL。`src/pages/index.astro`がない、または期待要素がない。

- [ ] **Step 7: 最小ページと不足しているbuild検査scriptを作る**

`src/pages/index.astro`は`lang="ja"`、`<title>テックログ</title>`、`<h1>テックログ</h1>`だけを持つ。`scripts/verify-build.mjs`はこの段階では`dist/index.html`の存在だけを検査する。

- [ ] **Step 8: 基盤を検証する**

Run: `npm run check && npm test && npm run test:e2e -- tests/e2e/home.spec.ts`

Expected: all PASS。

- [ ] **Step 9: Commit**

```bash
git add .nvmrc package.json package-lock.json tsconfig.json astro.config.mjs .prettierrc.json vitest.config.ts playwright.config.ts src/env.d.ts src/pages/index.astro scripts/verify-build.mjs tests/e2e/home.spec.ts
git commit -m "chore: initialize Astro blog"
```

## Task 2: Content Collectionsと純粋関数をTDDで作る

**Files:**
- Create: `src/config/site.ts`
- Create: `src/content.config.ts`
- Create: `src/lib/content/posts.ts`
- Create: `src/lib/content/tags.ts`
- Create: `src/lib/content/reading-time.ts`
- Create: `src/lib/content/pagination.ts`
- Create: `tests/unit/posts.test.ts`
- Create: `tests/unit/tags.test.ts`
- Create: `tests/unit/reading-time.test.ts`
- Create: `tests/unit/pagination.test.ts`

- [ ] **Step 1: カテゴリーとサイト設定を書く**

`src/config/site.ts`に次を定義する。

```ts
export const CATEGORY_KEYS = ['Cloud', 'Backend', 'Frontend', 'Infrastructure', 'AI', 'Operations'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORIES = {
  Cloud: { label: 'クラウド / AWS', slug: 'cloud' },
  Backend: { label: 'バックエンド', slug: 'backend' },
  Frontend: { label: 'フロントエンド', slug: 'frontend' },
  Infrastructure: { label: 'インフラ / IaC', slug: 'infrastructure' },
  AI: { label: 'AI', slug: 'ai' },
  Operations: { label: '運用 / 障害調査', slug: 'operations' },
} as const;

export const SITE = {
  name: 'テックログ',
  author: 'Hiroshi Imaizumi',
  tagline: 'つくる、動かす、改善する。',
  description: 'クラウド、バックエンド、フロントエンド、IaC、AI、運用まで。現場で得た技術の実践知を、わかりやすく発信します。',
  email: '', github: '', x: '', zenn: '',
} as const;
```

- [ ] **Step 2: 期待する純粋関数の失敗テストを書く**

最低限、次をfixtureで検証する。

```ts
expect(sortPosts(posts).map((post) => post.id)).toEqual(['newer', 'older']);
expect(getPublishedPosts(posts, { production: true }).every((post) => !post.data.draft)).toBe(true);
expect(getFeaturedPost(posts)?.id).toBe('featured-newest');
expect(getPopularTags(posts, 2)).toEqual([
  { label: 'AWS', count: 3 },
  { label: 'Astro', count: 2 },
]);
expect(getRelatedPosts(current, posts, 3).map((post) => post.id)).toEqual([
  'same-category-two-tags',
  'same-category-one-tag-newer',
  'same-category-one-tag-older',
]);
expect(getAdjacentPosts(current, posts)).toEqual({ previous: older, next: newer });
expect(normalizeTagSegment('生成 AI')).toBe('生成-ai');
expect(tagToHref('生成 AI')).toBe('/tags/%E7%94%9F%E6%88%90-ai/');
expect(() => buildTagIndex([{ label: 'ＡＷＳ' }, { label: 'aws' }])).toThrow(/衝突/);
expect(readingMinutes('あ'.repeat(501))).toBe(2);
expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
```

- [ ] **Step 3: 失敗を確認する**

Run: `npm test -- tests/unit/posts.test.ts tests/unit/tags.test.ts tests/unit/reading-time.test.ts tests/unit/pagination.test.ts`

Expected: FAIL with missing modules/functions。

- [ ] **Step 4: 純粋関数を最小実装する**

規則は次で固定する。

- 公開日降順、同日なら`id`昇順。
- `production: true`では`draft: true`を除外し、developmentでは明示的にpreviewへ含められる。
- 人気タグは公開記事だけを数え、件数降順、同数なら表示名昇順。
- 前後記事は公開日順の直前・直後を返し、自分自身を含めない。
- 関連記事はカテゴリー一致降順、共通タグ数降順、公開日降順、`id`昇順。
- `normalizeTagSegment()`はNFKC、trim、小文字、空白を`-`へ変換し、生の`生成-ai`を返す。
- `tagToHref()`だけが`encodeURIComponent(normalizeTagSegment(tag))`を使ってURLを組み立てる。
- タグ名に`/`、`?`、`#`を含む場合はvalidation error。
- 読了時間は空白を除く文字数÷500を切り上げ、最低1分。
- ページサイズは12。

- [ ] **Step 5: Content schemaを作る**

`glob({ base: './src/content/blog', pattern: '*.{md,mdx}' })`を使い、必須項目、カテゴリーenum、日付、画像、`featuredCode`を検証する。object-level refinementで`updatedAt >= publishedAt`を保証する。

- [ ] **Step 6: テストと型検査を通す**

Run: `npm test -- tests/unit && npm run check`

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add src/config/site.ts src/content.config.ts src/lib/content tests/unit
git commit -m "feat: define typed blog content model"
```

## Task 3: デザイントークン、BaseLayout、Header、Footer

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/components/common/Container.astro`
- Create: `src/components/common/SEOHead.astro`
- Create: `src/components/layout/Header.astro`
- Create: `src/components/layout/Footer.astro`
- Create: `src/components/layout/MobileMenu.astro`
- Create: `src/scripts/mobile-menu.ts`
- Create: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/index.astro`
- Modify: `tests/e2e/home.spec.ts`

- [ ] **Step 1: semantic shellの失敗テストを追加する**

Header内のロゴ、タグライン、`nav`、`main#main-content`、Footer、スキップリンク、存在するSNSだけが表示されることを検証する。Mobile viewportではメニューボタンが見え、Escape後にトリガーへフォーカスが戻ることも追加する。

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test:e2e -- tests/e2e/home.spec.ts`

Expected: FAIL with missing landmarks/menu。

- [ ] **Step 3: トークンと全体CSSを実装する**

`tokens.css`へ仕様書の9色、spacing、radius、container、本文幅、focus ringをCSS変数で定義する。`global.css`でreset、system font、dark background、`prefers-reduced-motion`、skip linkを実装し、Tailwind 4の`@import "tailwindcss";`を先頭に置く。

- [ ] **Step 4: BaseLayoutと共通ナビを実装する**

Headerはホーム、記事、カテゴリー、タグ、プロフィール、検索用slotを持つ。MobileMenuはbutton、`aria-expanded`、メニューパネルを持ち、`mobile-menu.ts`が開閉、Escape、focus return、body scroll lockを処理する。Footerは空でないSNSだけを描画する。

- [ ] **Step 5: トップをBaseLayoutへ移す**

`index.astro`は直接HTML骨格を持たず、`BaseLayout`内に`h1`を置く。

- [ ] **Step 6: 検証する**

Run: `npm run check && npm run test:e2e -- tests/e2e/home.spec.ts`

Expected: PASS。Mobile menuはmouseとkeyboardの両方で閉じる。

- [ ] **Step 7: Commit**

```bash
git add src/styles src/components/common src/components/layout src/scripts/mobile-menu.ts src/layouts/BaseLayout.astro src/pages/index.astro tests/e2e/home.spec.ts
git commit -m "feat: add branded site shell"
```

## Task 4: 初期記事1・2を実用品質で作る

**Files:**
- Create: `src/content/blog/build-tech-blog-with-astro-2026.md`
- Create: `src/content/blog/terraform-drift-detection.md`
- Create: `tests/unit/content-fixtures.test.ts`

- [ ] **Step 1: 記事1・2のfixture失敗テストを書く**

記事1・2の期待id、`featured: true`が記事1だけであること、各記事に600文字以上、H2、コードフェンス、リスト、引用、参考リンクがあることを検証する。現時点では記事がないためFAILすることを確認する。

- [ ] **Step 2: Astro記事の一次情報を確認する**

実装時点のAstro、Tailwind、Pagefind、Cloudflare公式ドキュメントを再確認し、記事更新日を当日にする。記事構成は「採用構成」「Astro静的生成」「Content Collections」「Pagefind」「Workers」「得られた知見」とする。

- [ ] **Step 3: 記事1を書く**

frontmatterは`category: Frontend`、タグ`[Astro, TypeScript, Tailwind CSS, Cloudflare]`、`featured: true`、短い`featuredCode`を持たせる。実在しない性能値や経験談は書かない。

- [ ] **Step 4: Terraform記事の一次情報を確認する**

HashiCorp公式のrefresh-only plan/apply、import、state、drift関連ドキュメントを確認する。構成は「driftとは」「まずplan」「コードへ戻す」「実環境を正とする」「import/state操作の注意」「事故を避ける確認手順」とする。

- [ ] **Step 5: 記事2を書く**

frontmatterは`category: Infrastructure`、タグ`[AWS, Terraform, IaC]`。破壊的なstate操作を無条件に推奨せず、バックアップとレビューを明記する。

- [ ] **Step 6: 内容とschemaを検証する**

Run: `npm test -- tests/unit/content-fixtures.test.ts && npm run check`

Expected: PASS。赤いテストを残したままcommitしない。

- [ ] **Step 7: Commit**

```bash
git add src/content/blog/build-tech-blog-with-astro-2026.md src/content/blog/terraform-drift-detection.md tests/unit/content-fixtures.test.ts
git commit -m "content: add Astro and Terraform guides"
```

## Task 5: GPT-5.6とChatGPT Work記事を公式情報から作る

**Files:**
- Create: `src/content/blog/gpt-5-6-sol-terra-luna.md`
- Create: `src/content/blog/chatgpt-work-guide.md`
- Modify: `tests/unit/content-fixtures.test.ts`

- [ ] **Step 1: OpenAI公式情報を公開当日に再確認する**

最低限、次を確認する。

- `https://openai.com/index/gpt-5-6/`
- `https://help.openai.com/en/articles/20001354-gpt-56-in-chatgpt`
- `https://openai.com/chatgpt-work/`
- `https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex`

価格、利用可能プラン、対応surfaceは変わりやすいため、取得日と「記事更新時点」を明記する。

- [ ] **Step 2: 記事3・4のfixture失敗テストを追加する**

期待id、各600文字以上、H2、リスト、引用、OpenAI公式リンクを検証する。Run: `npm test -- tests/unit/content-fixtures.test.ts`。Expected: 記事3・4が未作成のためFAIL。

- [ ] **Step 3: GPT-5.6比較記事を書く**

構成は「3モデルの位置付け」「Sol」「Terra」「Luna」「料金表」「ChatGPT/Work/Codex/APIでの提供差」「用途別選択」「注意点」。frontmatterは`category: AI`、タグ`[OpenAI, GPT-5.6, AI]`。

- [ ] **Step 4: ChatGPT Work記事を書く**

構成は「Workとは」「Chatとの違い」「Codexとの違い」「使える環境」「ファイル・アプリ・成果物」「Planと承認」「向く仕事・向かない仕事」。frontmatterは`category: AI`、タグ`[OpenAI, ChatGPT, ChatGPT Work, Codex]`。

- [ ] **Step 5: 誇張と未確認情報を除く**

公式にない推測、個人利用で未検証の断定、転載量の多い引用を除く。引用は必要最小限にし、本文は日本語で再構成する。

- [ ] **Step 6: 4記事テストをgreenにする**

Run: `npm test -- tests/unit/content-fixtures.test.ts && npm run check`

Expected: 4記事すべてPASS。

- [ ] **Step 7: Commit**

```bash
git add src/content/blog/gpt-5-6-sol-terra-luna.md src/content/blog/chatgpt-work-guide.md tests/unit/content-fixtures.test.ts
git commit -m "content: add GPT-5.6 and ChatGPT Work guides"
```

## Task 6: トップページ、記事カード、抽象サムネイル

**Files:**
- Create: `src/components/common/SectionHeading.astro`
- Create: `src/components/common/TagChip.astro`
- Create: `src/components/blog/CategoryArtwork.astro`
- Create: `src/components/blog/ArticleCard.astro`
- Create: `src/components/blog/FeaturedArticle.astro`
- Create: `src/components/home/Hero.astro`
- Create: `src/components/home/LatestArticles.astro`
- Create: `src/components/home/PopularTags.astro`
- Create: `src/components/home/AuthorProfile.astro`
- Modify: `src/pages/index.astro`
- Create: `tests/e2e/home-content.spec.ts`

- [ ] **Step 1: トップ構成の失敗テストを書く**

注目記事、最新4件、人気タグ最大10件、著者名、架空統計がないこと、全ArticleCardがリンクであることを検証する。記事固有の`heroImage`があればそれを使い、未設定・読込失敗時はカテゴリー画像へ戻ることも検証する。

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test:e2e -- tests/e2e/home-content.spec.ts`

Expected: FAIL with missing sections/cards。

- [ ] **Step 3: Cardとカテゴリー画像を実装する**

ArticleCardは表示専用Propsを受ける。`CategoryArtwork`は6カテゴリーごとにCSS変数と独自のSVG/CSS図形を切り替え、公式ロゴを描かない。画像領域は固定aspect ratioを持つ。

- [ ] **Step 4: 注目記事を実装する**

`FeaturedArticle`は`featuredCode`がある場合だけShiki相当のコード領域を描画し、未設定時は余白を残さない。

- [ ] **Step 5: トップの4セクションを実装する**

DesktopではHeroを2カラム、Mobileではサイト紹介→注目記事の順にする。PopularTagsは件数を表示する。AuthorProfileは記事数や閲覧数を表示しない。

- [ ] **Step 6: 検証する**

Run: `npm run check && npm run test:e2e -- tests/e2e/home-content.spec.ts`

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add src/components src/pages/index.astro tests/e2e/home-content.spec.ts
git commit -m "feat: build the Tech Log homepage"
```

## Task 7: 記事・タグ・カテゴリー一覧と静的ページネーション

**Files:**
- Create: `src/layouts/ListingLayout.astro`
- Create: `src/components/common/Pagination.astro`
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/page/[page].astro`
- Create: `src/pages/tags/index.astro`
- Create: `src/pages/tags/[tag].astro`
- Create: `src/pages/categories/index.astro`
- Create: `src/pages/categories/[category].astro`
- Create: `tests/e2e/listings.spec.ts`

- [ ] **Step 1: 一覧の失敗テストを書く**

公開日降順、タグ件数、カテゴリー6件、各詳細一覧、存在しないタグ/カテゴリーの404を検証する。12件超の分割規則はTask 2の単体テストで検証し、E2Eでは現在の4記事に不要なテスト用公開記事を混ぜない。

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test:e2e -- tests/e2e/listings.spec.ts`

Expected: FAIL with missing routes。

- [ ] **Step 3: ListingLayoutとPaginationを実装する**

Paginationは前後リンク、現在ページ、総ページを受ける。先頭は`/blog/`、2ページ以降は`/blog/page/{page}/`とし、`/blog/[slug]/`とのroute衝突を避ける。無効ページは生成しない。

- [ ] **Step 4: タグとカテゴリーrouteを実装する**

`getStaticPaths()`で公開記事から許可されたpathだけを生成する。tag parameterには`normalizeTagSegment()`の生の値を渡し、Astro自身に一度だけURLエンコードさせる。リンクを組み立てるときだけ`tagToHref()`を使い、表示時は元ラベルを使う。E2Eで日本語タグURLに`%25`が混入しないことを検証する。

- [ ] **Step 5: 検証する**

Run: `npm run check && npm run test:e2e -- tests/e2e/listings.spec.ts`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/layouts/ListingLayout.astro src/components/common/Pagination.astro src/pages/blog src/pages/tags src/pages/categories tests/e2e/listings.spec.ts
git commit -m "feat: add article discovery pages"
```

## Task 8: 記事詳細、目次、コードファイル名、コピー

**Files:**
- Create: `src/lib/remark-code-filename.ts`
- Modify: `astro.config.mjs`
- Create: `src/components/blog/ArticleMeta.astro`
- Create: `src/components/blog/ArticleToc.astro`
- Create: `src/components/blog/RelatedArticles.astro`
- Create: `src/layouts/ArticleLayout.astro`
- Create: `src/pages/blog/[slug].astro`
- Create: `src/styles/article.css`
- Create: `src/scripts/code-copy.ts`
- Create: `tests/unit/remark-code-filename.test.ts`
- Create: `tests/e2e/article.spec.ts`

- [ ] **Step 1: remark pluginの失敗テストを書く**

` ```ts title="src/example.ts" `から`data-filename="src/example.ts"`がcode nodeへ付くこと、metaなしでは付かないことを検証する。

- [ ] **Step 2: 記事E2Eの失敗テストを書く**

title、公開/更新日、タグ、読了時間、H2目次、Sticky/Desktopとdetails/Mobile、前後、関連記事最大3件、コピー成功文言、Clipboard失敗文言を検証する。

- [ ] **Step 3: 失敗を確認する**

Run: `npm test -- tests/unit/remark-code-filename.test.ts && npm run test:e2e -- tests/e2e/article.spec.ts`

Expected: FAIL。

- [ ] **Step 4: remark pluginと記事routeを実装する**

`remark-code-filename.ts`はcode metaの`title="..."`または`filename="..."`だけを受理し、HTML escape可能な文字列としてdata属性へ渡す。`[slug].astro`は公開記事だけからpathを生成する。記事Header内のカテゴリーへ`data-pagefind-filter="category"`、各タグへ`data-pagefind-filter="tag"`、タイトルと概要へ`data-pagefind-meta`を付ける。

- [ ] **Step 5: ArticleLayoutと目次を実装する**

Astroのrender結果の`headings`をArticleTocへ渡す。記事全体に`data-pagefind-body`を付け、タイトル、概要、カテゴリー、タグ、本文を同じ索引対象へ含める。Header/Footerは`data-pagefind-ignore`で除外する。本文最大幅760px、行間1.8、コードだけ横スクロールとする。

- [ ] **Step 6: コピー動作を実装する**

各`pre`へbuttonを一度だけ追加する。成功時`コピーしました`、失敗時`コピーできませんでした`、2秒後に元ラベルへ戻す。失敗してもコード選択を妨げない。

- [ ] **Step 7: 検証する**

Run: `npm test -- tests/unit/remark-code-filename.test.ts && npm run check && npm run test:e2e -- tests/e2e/article.spec.ts`

Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add astro.config.mjs src/lib/remark-code-filename.ts src/components/blog src/layouts/ArticleLayout.astro src/pages/blog/'[slug].astro' src/styles/article.css src/scripts/code-copy.ts tests
git commit -m "feat: add readable article pages"
```

## Task 9: Pagefindモーダル検索

**Files:**
- Create: `src/components/blog/SearchModal.astro`
- Create: `src/styles/pagefind.css`
- Create: `src/scripts/search-modal.ts`
- Modify: `src/components/layout/Header.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `scripts/verify-build.mjs`
- Create: `tests/e2e/search.spec.ts`

- [ ] **Step 1: 検索成果物と操作の失敗テストを書く**

`dist/pagefind/pagefind.js`の存在、検索ボタン、dialog、入力focus、`Astro`・`Frontend`・`TypeScript`検索結果、Escape、focus returnを検証する。初期page loadではPagefind script requestがなく、最初の検索button click後にだけrequestされることも検証する。Pagefind出力前の`npm run build:astro`がVite resolve errorなしで成功することも検証する。

- [ ] **Step 2: 失敗を確認する**

Run: `npm run build && npm run test:e2e -- tests/e2e/search.spec.ts`

Expected: FAIL because SearchModal is absent。

- [ ] **Step 3: native dialogとPagefind Search APIを接続する**

`SearchModal.astro`は検索button、native `<dialog>`、検索input、summary、results、close buttonを描画する。`search-modal.ts`は最初のopen操作で初めて`await import(/* @vite-ignore */ '/pagefind/pagefind.js')`し、`pagefind.init()`する。`@vite-ignore`で索引生成前のAstro/Vite buildに解決させない。初期HTMLにPagefind script、link、preloadを出力しない。native dialogの`showModal()`、Escape、backdrop click、close button、focus return、body scroll lockを実装する。

- [ ] **Step 4: テックログ用にスタイルする**

`pagefind.css`でdialog、backdrop、input、result list、`mark`、focus、Mobile close buttonをデザイントークンへ合わせる。検索入力は150ms debounceし、resultのURL、title、excerptを安全なDOM APIで描画する。

- [ ] **Step 5: 失敗フォールバックを実装する**

dynamic import、初期化、検索のいずれかが失敗した場合は、dialog内に`検索を読み込めませんでした`と`/blog/`リンクを表示する。通常ページは操作可能なままにする。

- [ ] **Step 6: 検証する**

Run: `npm run build && npm run test:e2e -- tests/e2e/search.spec.ts`

Expected: PASS。Pagefind bundleは日本語indexを含む。

- [ ] **Step 7: Commit**

```bash
git add src/components/blog/SearchModal.astro src/styles/pagefind.css src/scripts/search-modal.ts src/components/layout/Header.astro src/layouts/BaseLayout.astro scripts/verify-build.mjs tests/e2e/search.spec.ts
git commit -m "feat: add Pagefind modal search"
```

## Task 10: About、Privacy、404、RSS、sitemap、SEO、Analytics

**Files:**
- Create: `src/lib/seo.ts`
- Modify: `src/components/common/SEOHead.astro`
- Create: `src/pages/about.astro`
- Create: `src/pages/privacy.astro`
- Create: `src/pages/404.astro`
- Create: `src/pages/rss.xml.ts`
- Create: `scripts/validate-production-env.mjs`
- Create: `scripts/validate-site-url.mjs`
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Create: `.env.example`
- Create: `public/robots.txt`
- Create: `scripts/generate-og.mjs`
- Create: `public/og-default.png`
- Create: `tests/unit/seo.test.ts`
- Create: `tests/unit/production-env.test.ts`
- Create: `tests/e2e/static-pages.spec.ts`

- [ ] **Step 1: SEOと必須envの失敗テストを書く**

canonical、Blog/BlogPosting/Person JSON-LD、OGP fallback、`SITE_URL`未設定またはHTTPSでない通常buildのfailureを検証する。

- [ ] **Step 2: 静的ページと成果物の失敗テストを書く**

About、Privacy、404の主要見出し、`rss.xml`、`sitemap-index.xml`、`robots.txt`、404復帰リンクを検証する。

- [ ] **Step 3: 失敗を確認する**

Run: `npm test -- tests/unit/seo.test.ts tests/unit/production-env.test.ts && npm run test:e2e -- tests/e2e/static-pages.spec.ts`

Expected: FAIL。

- [ ] **Step 4: SEOとOGPを実装する**

`package.json`へ`"prebuild": "node scripts/validate-site-url.mjs"`を追加する。`validate-site-url.mjs`は`SITE_URL`が有効なHTTPS URLでなければ終了コード1にする。PlaywrightのwebServer commandは既に`SITE_URL=https://example.invalid`を渡す。`SEOHead`はページ別title/description/canonical、OGP、Twitter Card、JSON-LDを描画する。`generate-og.mjs`は1200×630のブランドSVGをSharpでPNG化し、実行結果を`public/og-default.png`としてcommitする。

- [ ] **Step 5: 静的ページ、RSS、sitemapを実装する**

RSSとsitemapは公開記事だけを含める。PrivacyはCloudflare Web Analytics、Cookie/広告/DBを使わないこと、mailtoの扱いを説明する。

- [ ] **Step 6: Analyticsを条件付きで実装する**

`import.meta.env.PROD && import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`のときだけCloudflare beaconを出力する。tokenはログへ出さない。

- [ ] **Step 7: 検証する**

Run: `SITE_URL=https://example.invalid npm run build && npm test && npm run test:e2e -- tests/e2e/static-pages.spec.ts`

Expected: PASS。`env -u SITE_URL npm run build`と`SITE_URL=http://example.invalid npm run build`はprebuildで意図どおりFAIL。

- [ ] **Step 8: Commit**

```bash
git add package.json playwright.config.ts src/lib/seo.ts src/components/common/SEOHead.astro src/pages scripts .env.example public tests
git commit -m "feat: add static pages and metadata"
```

## Task 11: 著者イラストとカンプ忠実度の調整

**Files:**
- Create: `src/assets/images/author.png`
- Modify: `src/components/home/AuthorProfile.astro`
- Modify: `src/pages/about.astro`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`
- Modify: UI component styles as required
- Create: `tests/e2e/visual.spec.ts`

- [ ] **Step 1: 基準カンプを照合する**

`/Users/hiroshiimaizumi/Downloads/ChatGPT Image 2026年7月10日 14_24_24.png`のSHA-256が仕様書記載値と一致することを確認する。異なる場合は作業を止める。

- [ ] **Step 2: レスポンシブの失敗テストを書く**

1440×1200、768×1024、390×844でスクリーンショットを取得し、ページ全体に横スクロールがないこと、MobileのHero順序、4→2→1カラム、目次切替をassertする。

- [ ] **Step 3: カンプに合わせてDesktopを調整する**

`@frontend-design`を使い、Header高さ、Hero比率、カード密度、境界線、青アクセント、余白、プロフィール帯、Footerをカンプへ合わせる。架空統計と公式ロゴは追加しない。

- [ ] **Step 4: TabletとMobileを調整する**

390pxでサイト紹介→注目記事を維持し、本文とコード以外の横スクロールをなくす。`prefers-reduced-motion`でhover/transitionを停止する。

- [ ] **Step 5: 著者参考画像を受け取る**

参考画像が未提供なら、他の検証を続けつつこのStepだけをblockedとしてユーザーへ依頼する。勝手に似顔絵を推測しない。

- [ ] **Step 6: 著者イラストを生成して承認を得る**

`@imagegen`を使い、カンプに合うモノクロ寄りのオリジナルイラストを生成する。ユーザー承認後だけ`author.png`へ採用し、altは`Hiroshi Imaizumiのプロフィール画像`とする。

- [ ] **Step 7: visualとresponsiveを検証する**

Run: `npm run test:e2e -- tests/e2e/visual.spec.ts`

Expected: PASS。3 viewportのスクリーンショットを人間も確認する。

- [ ] **Step 8: Commit**

```bash
git add src/assets/images/author.png src/components/home/AuthorProfile.astro src/pages/about.astro src/styles src/components tests/e2e/visual.spec.ts
git commit -m "feat: polish responsive visual design"
```

## Task 12: アクセシビリティと全導線の回帰テスト

**Files:**
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/navigation.spec.ts`
- Modify: components/styles based on failures

- [ ] **Step 1: axe失敗テストを書く**

`/`、代表記事、`/blog/`、`/tags/`、`/categories/`、`/about/`、`/privacy/`、`/404.html`でcritical/serious違反が0件であることをassertする。

- [ ] **Step 2: キーボード導線テストを書く**

スキップリンク、Header nav、Mobile menu、検索modal、記事目次、コードコピー、Pagination、FooterまでTabで到達できることを検証する。

- [ ] **Step 3: 失敗を確認する**

Run: `npm run test:e2e -- tests/e2e/accessibility.spec.ts tests/e2e/navigation.spec.ts`

Expected: 少なくとも未調整箇所でFAIL。最初からPASSした場合も検査が実際の対象を走査していることをログで確認する。

- [ ] **Step 4: 違反を最小修正する**

ARIAでHTMLの意味を上書きせず、native element、見出し階層、label、focus order、contrastを優先して直す。

- [ ] **Step 5: 全検証を通す**

Run: `SITE_URL=https://example.invalid npm run verify`

Expected: format、Astro check、unit、build、Pagefind、Playwright、axeがすべてPASS。

- [ ] **Step 6: Commit**

```bash
git add tests/e2e src
git commit -m "test: enforce accessible navigation"
```

## Task 13: Cloudflare WorkersとGitHub Actions

**Files:**
- Create: `wrangler.jsonc`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `scripts/smoke-production.mjs`
- Modify: `scripts/validate-production-env.mjs`
- Modify: `tests/unit/production-env.test.ts`

- [ ] **Step 1: production validationの失敗テストを拡張する**

`SITE_URL`がHTTPSでない場合、`CLOUDFLARE_ACCOUNT_ID`または`CLOUDFLARE_API_TOKEN`がないdeploy環境で明確に失敗することを検証する。Analytics tokenはoptionalとする。

- [ ] **Step 2: Wrangler静的設定を作る**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tech-log",
  "compatibility_date": "2026-07-11",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

`main`とCloudflare adapterは追加しない。

- [ ] **Step 3: PR workflowを書く**

`pull_request`でcheckout、Node 24、`npm ci`、Chromium install、`SITE_URL=https://example.invalid npm run verify`を実行する。tokenを参照しない。

- [ ] **Step 4: deploy workflowを書く**

`main` pushで同じverifyを実行後、`cloudflare/wrangler-action@v3`を使う。認証は`secrets.CLOUDFLARE_API_TOKEN`と`secrets.CLOUDFLARE_ACCOUNT_ID`、サイトURLとAnalytics tokenはRepository Variablesから渡す。deploy action成功後の次stepで`node scripts/smoke-production.mjs`を必ず実行し、失敗したらworkflow全体を失敗扱いにする。

- [ ] **Step 5: post-deploy smoke scriptを書く**

`SITE_URL`に対して`/`、代表記事、`/rss.xml`、`/sitemap-index.xml`が2xx、存在しないpathが404になることをfetchで検証する。response bodyやSecretsをログへ出さない。deploy workflow内に`env: SITE_URL: ${{ vars.SITE_URL }}`付きの実行stepを置く。

- [ ] **Step 6: workflow syntaxとローカルbuildを検証する**

Run: `SITE_URL=https://example.invalid npm run verify && npx wrangler deploy --dry-run`

Expected: PASS、dry-runはstatic asset manifestを作り外部公開しない。

- [ ] **Step 7: Commit**

```bash
git add wrangler.jsonc .github scripts tests/unit/production-env.test.ts
git commit -m "ci: deploy static site to Cloudflare Workers"
```

## Task 14: README、公開設定、最終受け入れ

**Files:**
- Create: `README.md`
- Modify: `src/config/site.ts`
- Modify: `.env.example`
- Modify: `docs/superpowers/specs/2026-07-11-tech-blog-design.md` only if approved implementation deviations exist

- [ ] **Step 1: READMEの失敗チェックリストを作る**

Node.js、install、dev、記事追加、frontmatter、test、build、Pagefind、Cloudflare、GitHub Secrets/Variables、公開、トラブルシュートの各見出しが必要であることを確認する。

- [ ] **Step 2: READMEを書く**

秘密値を例示せず、次の設定名だけを記載する。

- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Variables: `SITE_URL`, `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`

- [ ] **Step 3: 公開情報を確定する**

ユーザーから公開メール、GitHub、任意のX/Zenn URLを受け取り`site.ts`へ設定する。空URLは残してよいが、EmailとGitHubはProduction完成条件として確認する。

- [ ] **Step 4: GitHubリポジトリをPublicで作るまたは既存remoteを確認する**

外部操作前にowner/repository名を表示して確認する。作成が承認済みなら`gh repo create ... --public --source=. --remote=origin`を使い、保護ルールでPR必須チェックを有効にする。

- [ ] **Step 5: Cloudflare設定を行う**

最小権限のWorkers API token、Account ID、Workers subdomain、Analytics tokenをユーザーのGitHub Secrets/Variablesへ設定する。値自体をチャット、commit、ログへ出さない。

- [ ] **Step 6: branchをpushしてPRを作る**

CIがすべてPASSすることを確認する。失敗時はログの該当箇所だけを読み、Secretsを再表示しない。

- [ ] **Step 7: mainへマージして公開を検証する**

deploy workflowとsmoke testがPASSし、`*.workers.dev` URLでトップ、4記事、検索、RSS、sitemap、404を確認する。

- [ ] **Step 8: Lighthouseを3回測定する**

Mobileのトップと代表記事で3回測り、中央値がPerformance、Accessibility、Best Practices、SEOの各90以上であることを確認する。未達なら最大要因を修正して再測定する。

- [ ] **Step 9: 最終ローカル検証を実行する**

Run: `npm ci && SITE_URL=https://example.invalid npm run verify`

Expected: all PASS from a clean install。

- [ ] **Step 10: Commit**

```bash
git add README.md src/config/site.ts .env.example docs/superpowers/specs/2026-07-11-tech-blog-design.md
git commit -m "docs: add publishing and authoring guide"
```

## 実装完了時に残してはいけないもの

- 仮記事、Lorem ipsum、未確認の料金・提供プラン
- 架空の閲覧数、記事数、運用期間
- 空href、動かない検索やtheme toggle
- Cloudflare Secrets、メール以外の個人情報、顧客情報
- `draft: true`記事のProduction出力
- Cloudflare adapter、SSR entry point、DB、認証、コメント
- `.only`、意図しない`.skip`、更新されていないsnapshot
