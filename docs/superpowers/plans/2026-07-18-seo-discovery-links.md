# SEO Discovery Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索エンジンへサイトマップの場所を明示し、Googleに認識済みの記事から未認識の記事へ本文中の文脈リンクを追加して、クロール導線を強化する。

**Architecture:** 静的な `public/robots.txt` をAstroの動的エンドポイントへ置き換え、設定済みの `site` を唯一のURL基準としてサイトマップURLを生成する。記事の自動関連記事ロジックには触れず、承認済みの6本のリンクだけをMarkdown本文へ追加し、リンク契約テストで送信元・送信先の対応と公開先ファイルの存在を固定する。

**Tech Stack:** Astro 7、TypeScript、Markdown content collections、Vitest、Playwright、Prettier

---

## 実装時に使うスキル

- `@superpowers:test-driven-development`: 各変更をRED → GREEN → REFACTORで進める。
- `@natural-japanese`: 追加する記事本文をquick modeで確認し、既存の文体に合わせる。
- `@superpowers:verification-before-completion`: 完了報告の直前に全検証を実行する。
- `@superpowers:requesting-code-review`: 全タスク完了後に差分レビューを依頼する。

## Task 1: robots.txtをAstroの動的エンドポイントへ移行する

**Files:**

- Create: `src/pages/robots.txt.ts`
- Create: `tests/unit/robots.test.ts`
- Modify: `tests/e2e/static-pages.spec.ts:80-84`
- Delete: `public/robots.txt`

- [ ] **Step 1: URL生成関数の失敗する単体テストを書く**

`tests/unit/robots.test.ts` を作成する。

```ts
import { describe, expect, it } from 'vitest';

import { robotsText } from '../../src/pages/robots.txt';

describe('robots.txt', () => {
  it('Astroのsiteを基準にsitemap-index.xmlを案内する', () => {
    expect(robotsText(new URL('https://example.invalid/'))).toBe(
      ['User-agent: *', 'Allow: /', 'Sitemap: https://example.invalid/sitemap-index.xml', ''].join('\n'),
    );
  });

  it('siteが未設定なら生成を中断する', () => {
    expect(() => robotsText(undefined)).toThrow('SITE_URL is required to generate robots.txt.');
  });
});
```

- [ ] **Step 2: E2Eテストを動的robots.txtの公開契約へ更新する**

`tests/e2e/static-pages.spec.ts` の既存robots検証を次へ置き換える。

```ts
const robots = await request.get('/robots.txt');
expect(robots.ok()).toBe(true);
expect(robots.headers()['content-type']).toContain('text/plain');
expect(await robots.text()).toBe(
  ['User-agent: *', 'Allow: /', 'Sitemap: https://example.invalid/sitemap-index.xml', ''].join('\n'),
);
```

- [ ] **Step 3: テストを実行し、REDを確認する**

Run:

```bash
npx vitest run tests/unit/robots.test.ts
```

Expected: `src/pages/robots.txt.ts` が存在しないためFAIL。

既存の静的robotsが契約を満たしていないことも、対象E2Eで確認する。

```bash
npx playwright test tests/e2e/static-pages.spec.ts --grep 'RSS、sitemap、robots'
```

Expected: `Sitemap: https://example.invalid/sitemap-index.xml` がないためFAIL。

- [ ] **Step 4: 最小実装を追加する**

`public/robots.txt` を削除し、`src/pages/robots.txt.ts` を作成する。

```ts
import type { APIRoute } from 'astro';

export function robotsText(site: URL | undefined): string {
  if (!site) {
    throw new Error('SITE_URL is required to generate robots.txt.');
  }

  const sitemap = new URL('/sitemap-index.xml', site).toString();
  return ['User-agent: *', 'Allow: /', `Sitemap: ${sitemap}`, ''].join('\n');
}

export const GET: APIRoute = ({ site }) =>
  new Response(robotsText(site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
```

- [ ] **Step 5: 単体テストと対象E2EがGREENになることを確認する**

Run:

```bash
npx vitest run tests/unit/robots.test.ts
npx playwright test tests/e2e/static-pages.spec.ts --grep 'RSS、sitemap、robots'
```

Expected: どちらもPASS。E2Eのビルドは `SITE_URL=https://example.invalid` を使うため、公開レスポンスのSitemap行も同じoriginになる。

- [ ] **Step 6: Task 1をコミットする**

```bash
git add public/robots.txt src/pages/robots.txt.ts tests/unit/robots.test.ts tests/e2e/static-pages.spec.ts
git commit -m "feat: advertise sitemap in robots.txt"
```

## Task 2: AI関連記事へ文脈リンクを追加する

**Files:**

- Create: `tests/unit/seo-internal-links.test.ts`
- Create: `tests/e2e/seo-internal-links.spec.ts`
- Modify: `src/content/blog/chatgpt-sites-guide.md`
- Modify: `src/content/blog/chatgpt-codex-plugins-guide.md`

- [ ] **Step 1: AI関連記事のリンク契約テストを書く**

`tests/unit/seo-internal-links.test.ts` を作成する。コードブロック内のURLでは合格しないよう、`remark-parse` で本文中の実リンクだけを収集する。

```ts
import { readFile } from 'node:fs/promises';

import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';

const linkContracts = [
  {
    source: 'chatgpt-sites-guide',
    targets: ['/blog/chatgpt-work-guide/'],
  },
  {
    source: 'chatgpt-codex-plugins-guide',
    targets: ['/blog/chatgpt-work-guide/', '/blog/gpt-5-6-sol-terra-luna/'],
  },
] as const;

async function markdownLinks(id: string): Promise<string[]> {
  const markdown = await readFile(new URL(`../../src/content/blog/${id}.md`, import.meta.url), 'utf8');
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  const links: string[] = [];

  visit(unified().use(remarkParse).parse(body), 'link', (node) => {
    links.push(node.url);
  });

  return links;
}

describe('SEO contextual internal links', () => {
  for (const contract of linkContracts) {
    it(`${contract.source}から承認済みの記事へリンクする`, async () => {
      const links = await markdownLinks(contract.source);

      for (const target of contract.targets) {
        expect(target).toMatch(/^\/blog\/[a-z0-9-]+\/$/);
        expect(target).not.toContain('draft-article');
        expect(links).toContain(target);

        const targetId = target.replace(/^\/blog\//, '').replace(/\/$/, '');
        const targetMarkdown = await readFile(new URL(`../../src/content/blog/${targetId}.md`, import.meta.url), 'utf8');
        expect(targetMarkdown).toMatch(/^---\r?\n/);
        expect(targetMarkdown).not.toMatch(/^draft:\s*true\s*$/m);
      }
    });
  }
});
```

- [ ] **Step 2: 生成後HTMLを検証するE2E契約を書く**

`tests/e2e/seo-internal-links.spec.ts` を作成する。`[data-article-body]` の内側だけを対象にすることで、関連記事カードに同じURLが出ても本文リンクの代わりにはならない。

```ts
import { expect, test } from '@playwright/test';

const linkContracts = [
  {
    source: '/blog/chatgpt-sites-guide/',
    targets: ['/blog/chatgpt-work-guide/'],
  },
  {
    source: '/blog/chatgpt-codex-plugins-guide/',
    targets: ['/blog/chatgpt-work-guide/', '/blog/gpt-5-6-sol-terra-luna/'],
  },
] as const;

for (const contract of linkContracts) {
  test(`${contract.source}の本文に承認済みの内部リンクを表示する`, async ({ page }) => {
    await page.goto(contract.source);
    const body = page.locator('[data-article-body]');

    for (const target of contract.targets) {
      await expect(body.locator(`a[href="${target}"]`)).toHaveCount(1);
    }
  });
}
```

- [ ] **Step 3: AI関連記事のテストがREDになることを確認する**

Run:

```bash
npx vitest run tests/unit/seo-internal-links.test.ts
npx playwright test tests/e2e/seo-internal-links.spec.ts
```

Expected: VitestとPlaywrightの両方が、`chatgpt-sites-guide` と `chatgpt-codex-plugins-guide` の本文に実リンクがないためFAIL。Sites記事のコードブロック内URLはリンクとして数えられない。

- [ ] **Step 4: ChatGPT Sites記事からChatGPT Work記事へリンクする**

`src/content/blog/chatgpt-sites-guide.md` のまとめ付近に、次の一文を文脈に合わせて追加する。

```md
Sitesを含む成果物作成の進め方や、Chat・Codexとの役割分担は、[ChatGPT Workとは？Chat・Codexとの違いと使い分け](/blog/chatgpt-work-guide/)で整理しています。
```

- [ ] **Step 5: Plugins記事からChatGPT WorkとGPT-5.6の記事へリンクする**

`src/content/blog/chatgpt-codex-plugins-guide.md` のまとめ付近に、次の一文を文脈に合わせて追加する。

```md
Pluginをどの作業面で使うかは[ChatGPT WorkとChat・Codexの使い分け](/blog/chatgpt-work-guide/)を、用途ごとのモデル選択は[GPT-5.6 Sol・Terra・Lunaの違い](/blog/gpt-5-6-sol-terra-luna/)を参照してください。
```

- [ ] **Step 6: 日本語をquick modeで確認し、テストをGREENにする**

`@natural-japanese` のquick modeで、追加した2文について主語、接続、過剰な宣伝調、既存文との重複を確認する。意味やリンク先は変えず、必要な場合だけ最小限修正する。

Run:

```bash
npx vitest run tests/unit/seo-internal-links.test.ts
npx playwright test tests/e2e/seo-internal-links.spec.ts
```

Expected: VitestとPlaywrightのAI関連記事2ケースがすべてPASS。

- [ ] **Step 7: Task 2をコミットする**

```bash
git add tests/unit/seo-internal-links.test.ts tests/e2e/seo-internal-links.spec.ts src/content/blog/chatgpt-sites-guide.md src/content/blog/chatgpt-codex-plugins-guide.md
git commit -m "content: link related AI guides"
```

## Task 3: 技術・インフラ記事へ文脈リンクを追加する

**Files:**

- Modify: `tests/unit/seo-internal-links.test.ts`
- Modify: `tests/e2e/seo-internal-links.spec.ts`
- Modify: `src/content/blog/build-tech-blog-with-astro-2026.md`
- Modify: `src/content/blog/terraform-drift-detection.md`

- [ ] **Step 1: 技術・インフラ記事のリンク契約を追加する**

`tests/unit/seo-internal-links.test.ts` の `linkContracts` に次の2要素を追加する。

```ts
{
  source: 'build-tech-blog-with-astro-2026',
  targets: ['/blog/terraform-drift-detection/', '/blog/http-query-method-rfc-10008/'],
},
{
  source: 'terraform-drift-detection',
  targets: ['/blog/aws-cloudfront-vpc-origin-outage-2026-07-16/'],
},
```

- [ ] **Step 2: E2E契約にも技術・インフラ記事を追加する**

`tests/e2e/seo-internal-links.spec.ts` の `linkContracts` に次の2要素を追加する。

```ts
{
  source: '/blog/build-tech-blog-with-astro-2026/',
  targets: ['/blog/terraform-drift-detection/', '/blog/http-query-method-rfc-10008/'],
},
{
  source: '/blog/terraform-drift-detection/',
  targets: ['/blog/aws-cloudfront-vpc-origin-outage-2026-07-16/'],
},
```

- [ ] **Step 3: 技術・インフラ記事のテストがREDになることを確認する**

Run:

```bash
npx vitest run tests/unit/seo-internal-links.test.ts
npx playwright test tests/e2e/seo-internal-links.spec.ts
```

Expected: VitestとPlaywrightのどちらも、Astro記事とTerraform記事の新しい2ケースがFAIL。Task 2の2ケースはPASSのまま。

- [ ] **Step 4: Astro記事からTerraform driftとHTTP QUERYの記事へリンクする**

`src/content/blog/build-tech-blog-with-astro-2026.md` のまとめ付近へ、既存の結論から自然につながる次の段落を追加する。

```md
構築後のインフラ運用では、[Terraformのdriftを安全に解消する手順](/blog/terraform-drift-detection/)も押さえておくと安心です。バックエンドAPIの設計を広げたい場合は、[HTTP QUERYメソッドの用途と対応状況](/blog/http-query-method-rfc-10008/)も参考にしてください。
```

- [ ] **Step 5: Terraform記事からCloudFront障害記事へリンクする**

`src/content/blog/terraform-drift-detection.md` のまとめ付近へ、構成差分とAWSサービス障害を区別する文脈で次の段落を追加する。

```md
AWS側の障害が疑われるときは、構成差分とサービス側の問題を切り分ける必要があります。具体例は、[2026年7月のCloudFront VPC Origins障害と確認手順](/blog/aws-cloudfront-vpc-origin-outage-2026-07-16/)で整理しています。
```

- [ ] **Step 6: 日本語をquick modeで確認し、テストをGREENにする**

`@natural-japanese` のquick modeで、リンクの前後が元記事の論旨から飛躍していないか、検索語を不自然に詰め込んでいないかを確認する。必要な場合だけ最小限修正する。

Run:

```bash
npx vitest run tests/unit/seo-internal-links.test.ts
npx playwright test tests/e2e/seo-internal-links.spec.ts
```

Expected: VitestとPlaywrightの全4ケースがPASSし、6本すべてのリンク先Markdownが存在して `draft: true` ではなく、生成後HTMLの本文にも正しい `href` で表示される。

- [ ] **Step 7: Task 3をコミットする**

```bash
git add tests/unit/seo-internal-links.test.ts tests/e2e/seo-internal-links.spec.ts src/content/blog/build-tech-blog-with-astro-2026.md src/content/blog/terraform-drift-detection.md
git commit -m "content: strengthen article discovery links"
```

## Task 4: 全体検証とレビューを行う

**Files:**

- Verify only; unexpected formatting changesが発生した場合は、対象ファイルだけを確認して追加コミットする。

- [ ] **Step 1: 差分に空白エラーがないことを確認する**

```bash
git diff --check origin/main...HEAD
```

Expected: 出力なし、exit code 0。

- [ ] **Step 2: 全検証を実行する**

Node 24のワークスペース依存ランタイムをPATHへ追加してから実行する。

```bash
export PATH="/Users/hiroshiimaizumi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
SITE_URL=https://example.invalid npm run verify
```

Expected: Prettier、Astro check、Vitest、production build、全PlaywrightテストがPASS。

- [ ] **Step 3: 生成物のrobots.txtを目視確認する**

```bash
sed -n '1,10p' dist/robots.txt
```

Expected:

```text
User-agent: *
Allow: /
Sitemap: https://example.invalid/sitemap-index.xml
```

- [ ] **Step 4: 自動関連記事の回帰がないことを確認する**

全E2Eに含まれる既存関連記事テストがPASSしていることを確認する。追加確認が必要な場合だけ次を単独実行する。

```bash
npx playwright test tests/e2e/article.spec.ts
```

Expected: PASS。`src/lib/content/posts.ts` に差分がなく、既存の関連記事表示が維持される。

- [ ] **Step 5: コードレビューを依頼する**

`@superpowers:requesting-code-review` を使い、`origin/main...HEAD` を対象に次を重点確認する。

- robots.txtのURL基準が `site` に一本化されていること
- 公開記事本文に承認済み6リンクだけが追加されていること
- 自動関連記事ロジックへ不要な変更がないこと
- テストがコードブロック内URLを誤って実リンク扱いしないこと

- [ ] **Step 6: レビュー指摘を反映して再検証する**

重大な指摘があれば修正し、対象テストと `SITE_URL=https://example.invalid npm run verify` を再実行する。修正がある場合のみ、内容に合う小さなコミットを追加する。

- [ ] **Step 7: 最終状態を確認する**

```bash
git status --short --branch
git log --oneline --decorate -6
```

Expected: 意図しない未コミット変更がなく、Task 1〜3のコミットと必要なレビュー修正コミットだけが並ぶ。
