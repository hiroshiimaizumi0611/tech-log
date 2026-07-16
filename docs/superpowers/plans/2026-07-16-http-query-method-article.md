# HTTP QUERYメソッド解説記事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RFC 10008で定義されたHTTP QUERYメソッドをGET・POSTと比較し、`curl`での試し方と導入判断を説明する日本語記事を公開可能な状態で追加する。

**Architecture:** 記事固有の内容契約をVitestとPlaywrightで固定し、Markdown本文を既存のContent Collectionへ追加する。新記事を最新のFeatured記事としてホームへ反映するため、ホームの決定的な期待値とビジュアルゴールデンも同じ変更セットで更新する。本文の仕様説明は一次資料だけを根拠にし、製品ごとの未確認な対応可否は扱わない。

**Tech Stack:** Astro 7、Markdown Content Collections、TypeScript、Vitest、Playwright、Prettier、Pagefind

---

## ファイル構成

- Create: `src/content/blog/http-query-method-rfc-10008.md`
  - 記事のFrontmatter、比較表、HTTP例、`curl`例、RFCに基づく解説を保持する。
- Create: `tests/unit/http-query-article.test.ts`
  - 記事ソースの見出し、公式資料、コード例、図解なし、慎重な採用境界を高速に検証する。
- Create: `tests/e2e/http-query-article.spec.ts`
  - 本番相当のHTMLでSEO、目次、デフォルトOG画像、表、コード、モバイルoverflow、アクセシビリティを検証する。
- Modify: `tests/e2e/home-content.spec.ts`
  - 新記事がFeaturedと最新記事の先頭になる期待値を更新し、Plugins記事の独自画像検証を別定数で維持する。
- Modify: `tests/e2e/hero-network.spec.ts`
  - 点群ヒーロー上のFeaturedリンクの遷移先を新記事へ更新する。
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-desktop.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-tablet.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-mobile.png`
  - Featuredと最新記事の表示変更を承認済みの見た目として固定する。

既存コンポーネント、記事レイアウト、CSS、Content Schemaは変更しない。表とコードのレスポンシブ処理、デフォルトOG画像、カテゴリーアートは既存機能を利用する。

### Task 1: 記事の内容契約をテストで固定する

**Files:**
- Create: `tests/unit/http-query-article.test.ts`
- Create: `tests/e2e/http-query-article.spec.ts`

- [ ] **Step 1: Install the exact workspace dependencies**

Run:

```bash
npm ci
```

Expected: dependencies install successfully under Node 24 with no lockfile changes.

- [ ] **Step 2: Write the failing unit content contract**

Create `tests/unit/http-query-article.test.ts`:

```ts
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const articleUrl = new URL('../../src/content/blog/http-query-method-rfc-10008.md', import.meta.url);

function splitArticle(markdown: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error('Article must start with frontmatter enclosed by --- delimiters');
  return { frontmatter: match[1], body: markdown.slice(match[0].length) };
}

describe('HTTP QUERY article', () => {
  it('publishes the approved metadata and problem-driven structure', async () => {
    const { frontmatter, body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const headings = [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);

    expect(frontmatter).toContain('title: HTTP QUERYメソッドとは？GET・POSTとの違いとcurlでの試し方');
    expect(frontmatter).toContain(
      'description: HTTP QUERYメソッドの目的、GET・POSTとの違い、curlでの送信例、対応状況を確認して採用する際の注意点をRFC 10008に基づいて解説します。',
    );
    expect(frontmatter).toContain("publishedAt: '2026-07-16'");
    expect(frontmatter).toContain('category: Backend');
    for (const tag of ['HTTP', 'API', 'RFC', 'Web']) expect(frontmatter).toContain(`  - ${tag}`);
    expect(frontmatter).toContain('featured: true');
    expect(frontmatter).not.toMatch(/^(?:heroImage|ogImage):/m);

    expect(headings).toEqual([
      'HTTP QUERYメソッドが正式公開された',
      'GETとPOSTだけでは何が困るのか',
      'GET・QUERY・POSTの違い',
      'QUERYリクエストを書いてみる',
      'QUERYで押さえる仕様',
      'すぐ本番採用できるとは限らない',
      'QUERYを選ぶ判断基準',
    ]);
    expect(body).not.toMatch(/!\[[^\]]*\]\(/);
  });

  it('uses primary sources and preserves the important RFC semantics', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));

    for (const url of [
      'https://www.rfc-editor.org/rfc/rfc10008.html',
      'https://www.rfc-editor.org/rfc/rfc9110.html',
      'https://www.iana.org/assignments/http-methods/http-methods.xhtml',
      'https://fetch.spec.whatwg.org/',
      'https://curl.se/docs/manpage.html',
    ]) {
      expect(body).toContain(url);
    }

    for (const fact of [
      '安全',
      '冪等',
      'Content-Type',
      'Accept-Query',
      '415 Unsupported Media Type',
      '422 Unprocessable Content',
      'CORSプリフライト',
      'OPTIONS',
      'Allow',
      '条件付きリクエスト',
      'Location',
      'Content-Location',
      'リクエスト内容と関連メタデータ',
    ]) {
      expect(body).toContain(fact);
    }
    expect(body).toContain('Locationは同じ問い合わせを再実行できるリソース');
    expect(body).toContain('Content-Locationは返された結果に対応するリソース');
    expect(body).not.toMatch(/GETやPOSTは(?:古い|非推奨|使うべきではない)/);
  });

  it('contains one comparison table and runnable-looking HTTP and curl examples', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const tables = [...body.matchAll(/^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+/gm)];
    const httpBlocks = [...body.matchAll(/```http\n([\s\S]*?)\n```/g)].map(([, block]) => block);
    const bashBlocks = [...body.matchAll(/```bash\n([\s\S]*?)\n```/g)].map(([, block]) => block);

    expect(tables).toHaveLength(1);
    expect(body).toContain('| 観点 | GET | QUERY | POST |');
    expect(httpBlocks).toHaveLength(1);
    expect(bashBlocks).toHaveLength(1);
    expect(httpBlocks[0]).toContain('QUERY /products/search HTTP/1.1');
    expect(httpBlocks[0]).toContain('Content-Type: application/json');
    expect(bashBlocks[0]).toContain("curl --request QUERY 'https://api.example.com/products/search'");
    expect(bashBlocks[0]).toContain("--header 'Content-Type: application/json'");
    expect(bashBlocks[0]).toContain('--data');
  });
});
```

- [ ] **Step 3: Write the failing browser contract**

Create `tests/e2e/http-query-article.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const articlePath = '/blog/http-query-method-rfc-10008/';
const articleTitle = 'HTTP QUERYメソッドとは？GET・POSTとの違いとcurlでの試し方';
const articleDescription =
  'HTTP QUERYメソッドの目的、GET・POSTとの違い、curlでの送信例、対応状況を確認して採用する際の注意点をRFC 10008に基づいて解説します。';
const articleHeadings = [
  'HTTP QUERYメソッドが正式公開された',
  'GETとPOSTだけでは何が困るのか',
  'GET・QUERY・POSTの違い',
  'QUERYリクエストを書いてみる',
  'QUERYで押さえる仕様',
  'すぐ本番採用できるとは限らない',
  'QUERYを選ぶ判断基準',
] as const;

test('HTTP QUERY記事のSEO、構成、比較表、コード例を公開する', async ({ page }) => {
  await page.goto(articlePath);

  await expect(page).toHaveTitle(`${articleTitle} | テックログ`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', articleDescription);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog\/http-query-method-rfc-10008\/$/);
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const imageUrl = await page.locator(selector).getAttribute('content');
    expect(new URL(imageUrl!).pathname).toBe('/og-default.png');
  }

  const article = page.locator('article[data-pagefind-body]');
  const body = article.locator('[data-article-body]');
  await expect(article.getByRole('heading', { level: 1, name: articleTitle })).toBeVisible();
  await expect(article.locator('[data-pagefind-filter="category"]')).toHaveText('Backend');
  await expect(article.locator('[data-pagefind-filter="tag"]')).toHaveText(['HTTP', 'API', 'RFC', 'Web']);
  await expect(article.getByText('公開日 2026年7月16日', { exact: true })).toBeVisible();
  await expect(body.getByRole('heading', { level: 2 })).toHaveText(articleHeadings);
  await expect(body.locator('table')).toHaveCount(1);
  await expect(body.locator('pre')).toHaveCount(2);
  await expect(body.locator('pre code')).toContainText(['QUERY /products/search HTTP/1.1', 'curl --request QUERY']);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('HTTP QUERY記事を390pxで表とコードをはみ出さず表示する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);

  const body = page.locator('[data-article-body]');
  await expect(body).toBeVisible();
  expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  for (const pre of await body.locator('pre').all()) await expect(pre).toHaveCSS('overflow-x', 'auto');
  for (const table of await body.locator('table').all()) {
    expect(await table.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});
```

- [ ] **Step 4: Run the contracts to verify they fail for the missing article**

Run:

```bash
npm test -- tests/unit/http-query-article.test.ts
npx playwright test tests/e2e/http-query-article.spec.ts
```

Expected: Vitest fails with `ENOENT` for `http-query-method-rfc-10008.md`; Playwright fails because the article route is 404.

### Task 2: 記事本文とFeatured統合を実装する

**Files:**
- Create: `src/content/blog/http-query-method-rfc-10008.md`
- Modify: `tests/e2e/home-content.spec.ts`
- Modify: `tests/e2e/hero-network.spec.ts`

- [ ] **Step 1: Write the exact Frontmatter**

Start `src/content/blog/http-query-method-rfc-10008.md` with:

```yaml
---
title: HTTP QUERYメソッドとは？GET・POSTとの違いとcurlでの試し方
description: HTTP QUERYメソッドの目的、GET・POSTとの違い、curlでの送信例、対応状況を確認して採用する際の注意点をRFC 10008に基づいて解説します。
publishedAt: '2026-07-16'
category: Backend
tags:
  - HTTP
  - API
  - RFC
  - Web
featured: true
---
```

Do not add `heroImage` or `ogImage`.

- [ ] **Step 2: Write the introduction and the seven approved sections**

Follow `docs/superpowers/specs/2026-07-16-http-query-method-article-design.md` exactly. Keep these content boundaries:

- State that RFC 10008 was published in June 2026 on the Standards Track; do not call it an Internet Standard.
- Explain that the method name `QUERY` is distinct from the URI query component such as `?q=...`.
- Explain safe and idempotent at first use; do not imply that safe means unauthenticated or harmless data.
- Describe GET and POST as valid choices for their appropriate cases, not obsolete workarounds.
- Attribute protocol semantics to RFC 10008 and separate recommendations with phrasing such as「本記事では」「採用前に確認します」.
- Use only the five approved primary-source hosts in the design spec.
- Include one short blockquote that states the article's central distinction so the existing substantial-article convention remains consistent.
- Include a final checklist as a Markdown bullet list.

- [ ] **Step 3: Add the single comparison table**

Use this structure and semantics:

```markdown
| 観点 | GET | QUERY | POST |
| --- | --- | --- | --- |
| 安全 | はい | はい | メソッドとしては保証されない |
| 冪等 | はい | はい | メソッドとしては保証されない |
| リクエストボディ | 意味は定義されていない | 問い合わせ内容を入れる | 対象リソースの意味に従う |
| キャッシュ | 可能 | 可能 | 制約付きで可能 |
| 主な用途 | 短く単純な取得条件 | 複雑な読み取り専用検索 | 状態変更を含み得る処理 |
```

Follow the table with a note that QUERY cache keys need to account for request content and relevant metadata; method and URI alone are insufficient.

- [ ] **Step 4: Add the exact request examples**

Use one `http` block:

```http
QUERY /products/search HTTP/1.1
Host: api.example.com
Content-Type: application/json
Accept: application/json

{
  "price": { "min": 1000, "max": 10000 },
  "tags": ["http", "api"],
  "inStock": true
}
```

Use one `bash` block:

```bash
curl --request QUERY 'https://api.example.com/products/search' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --data '{
    "price": { "min": 1000, "max": 10000 },
    "tags": ["http", "api"],
    "inStock": true
  }'
```

State that `api.example.com` is illustrative and succeeds only when the complete path supports QUERY.

- [ ] **Step 5: Explain discovery, response URIs, and adoption checks precisely**

Include all of the following:

- An `OPTIONS` response can advertise `QUERY` in `Allow`.
- `Accept-Query` can list supported query media types.
- `Location` identifies a resource that can repeat the same query with GET.
- `Content-Location` identifies a resource corresponding to the returned result.
- Cross-origin browser use requires CORS preflight because QUERY is not CORS-safelisted.
- Before adoption, verify client, router, reverse proxy, CDN, WAF, cache, logging, monitoring, authentication, and authorization behavior end-to-end.

- [ ] **Step 6: Update homepage Featured and latest-article expectations**

In `tests/e2e/home-content.spec.ts`:

```ts
const httpQueryArticleTitle = 'HTTP QUERYメソッドとは？GET・POSTとの違いとcurlでの試し方';
const pluginsArticleTitle = 'ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方';

const latestArticleTitles = [
  httpQueryArticleTitle,
  'ChatGPT Sitesの使い方｜実際にWebサイトを作って限定公開するまで',
  pluginsArticleTitle,
  '2026年版 Astroで技術ブログを構築した',
] as const;

const featuredArticleTitle = httpQueryArticleTitle;
```

Update Featured link assertions to `/blog/http-query-method-rfc-10008/`. Keep the custom-image and image-failure tests scoped to `pluginsArticleTitle`, because the new Featured article intentionally uses only the Backend category artwork. Update the JavaScript-disabled Featured assertion at the bottom of the file to the new title and URL.

- [ ] **Step 7: Update the active-network navigation expectation**

In `tests/e2e/hero-network.spec.ts`, change only the expected URL in `navigates through the Featured link while the network is active`:

```ts
await expect(page).toHaveURL(/\/blog\/http-query-method-rfc-10008\/$/);
```

- [ ] **Step 8: Format and run the focused non-visual tests**

Run:

```bash
npx prettier --write src/content/blog/http-query-method-rfc-10008.md \
  tests/unit/http-query-article.test.ts \
  tests/e2e/http-query-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/hero-network.spec.ts
npm test -- tests/unit/http-query-article.test.ts
npx playwright test tests/e2e/http-query-article.spec.ts tests/e2e/home-content.spec.ts tests/e2e/hero-network.spec.ts
```

Expected: the unit contract passes; the new article E2E tests pass; home content and hero-network tests pass. No existing article source or UI component changes are required.

- [ ] **Step 9: Commit the article, contracts, and homepage integration**

```bash
git add src/content/blog/http-query-method-rfc-10008.md \
  tests/unit/http-query-article.test.ts \
  tests/e2e/http-query-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/hero-network.spec.ts
git commit -m "feat: add HTTP QUERY method guide"
```

### Task 3: ホームのビジュアルゴールデンを更新する

**Files:**
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-desktop.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-tablet.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-mobile.png`

- [ ] **Step 1: Run the visual tests before updating snapshots**

Run:

```bash
npx playwright test tests/e2e/visual.spec.ts -g 'ホームを.*で表示できる'
```

Expected: the three home screenshot comparisons normally fail because the Featured title and latest article cards changed; geometry and overflow assertions still pass. A small content-only change can remain within the configured cross-platform tolerance, so a passing result does not remove the need to regenerate and inspect the approved baselines in Step 2.

- [ ] **Step 2: Regenerate only the three home snapshots**

Run:

```bash
npx playwright test tests/e2e/visual.spec.ts -g 'ホームを.*で表示できる' --update-snapshots
```

Expected: `home-desktop.png`, `home-tablet.png`, and `home-mobile.png` are regenerated and the three tests pass.

- [ ] **Step 3: Inspect every regenerated image**

Use the image viewer on all three files and confirm:

- the new QUERY title is readable in the compact Featured card;
- the latest article card uses the Backend category artwork;
- the mobile image remains exactly `390x844` and contains the complete compact Featured card;
- no title, tag, or card content is clipped;
- the interactive point network remains visually intact.

If only font rasterization differs, do not update tolerances. If layout is clipped, fix the responsible article title/layout expectation instead of masking the difference.

- [ ] **Step 4: Re-run the complete visual test file**

Run:

```bash
npx playwright test tests/e2e/visual.spec.ts
```

Expected: all visual, responsive, overflow, and reduced-motion tests pass.

- [ ] **Step 5: Commit the approved goldens**

```bash
git add tests/e2e/visual.spec.ts-snapshots/home-desktop.png \
  tests/e2e/visual.spec.ts-snapshots/home-tablet.png \
  tests/e2e/visual.spec.ts-snapshots/home-mobile.png
git commit -m "test: update home goldens for HTTP QUERY article"
```

### Task 4: 日本語と技術内容を最小限レビューする

**Files:**
- Modify: `src/content/blog/http-query-method-rfc-10008.md`

- [ ] **Step 1: Re-check the primary sources at implementation time**

Verify the publication status and relevant sections against the five URLs in the design spec. Confirm these claims before editing prose:

- RFC 10008 is dated June 2026 and is on the Standards Track.
- QUERY is safe, idempotent, cacheable, and expects request content with target-defined semantics.
- missing/inconsistent media type handling and the cited `415`/`422` examples match RFC 10008.
- `Location`, `Content-Location`, `Accept-Query`, conditional request, and CORS statements match the RFC.

Do not expand the article with framework support claims during this pass.

- [ ] **Step 2: Review with the natural-japanese skill**

Use `@natural-japanese` on the article body. Fix only problems that materially improve readability: unclear subjects, overloaded sentences, unexplained terms, or unnatural transitions. Preserve all tested technical distinctions and exact code examples.

- [ ] **Step 3: Review with the stop-ai-slop-jp skill**

Use `@stop-ai-slop-jp` to remove repetitive conclusions, inflated claims, uniform sentence rhythm, and generic AI-like section openings. Do not add personal experience that did not occur.

- [ ] **Step 4: Run the article contracts after editorial changes**

Run:

```bash
npx prettier --write src/content/blog/http-query-method-rfc-10008.md
npm test -- tests/unit/http-query-article.test.ts
npx playwright test tests/e2e/http-query-article.spec.ts tests/e2e/home-content.spec.ts tests/e2e/hero-network.spec.ts
```

Expected: all focused tests pass without weakening assertions.

- [ ] **Step 5: Commit only if the review changed the article**

```bash
git add src/content/blog/http-query-method-rfc-10008.md
git commit -m "docs: refine HTTP QUERY guide wording"
```

If the review produces no material changes, skip this commit.

### Task 5: 全体検証と引き渡しを行う

**Files:**
- Verify all changed files; no new files should be added in this task.

- [ ] **Step 1: Run whitespace and diff checks**

Run:

```bash
git diff --check origin/main...HEAD
git status --short
```

Expected: no whitespace errors; only the planned article, tests, snapshots, spec, and plan are present.

- [ ] **Step 2: Run the same verification command as CI**

Run:

```bash
SITE_URL=https://example.invalid npm run verify
```

Expected:

- Prettier check passes;
- Astro check reports zero diagnostics;
- all Vitest tests pass;
- static build, sitemap, RSS, and Pagefind verification pass;
- all Playwright tests pass, including the new article and updated home goldens.

- [ ] **Step 3: Review the final branch diff**

Run:

```bash
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Confirm that there are no unrelated UI, deployment, analytics, or infrastructure changes. Confirm that no custom article image was added.

- [ ] **Step 4: Prepare the branch for code review**

Use `@superpowers:requesting-code-review` for the full `origin/main...HEAD` diff. Address only validated blockers, rerun the affected tests, and leave the branch ready for the user's push/PR/merge decision. Do not merge or deploy without explicit approval.
