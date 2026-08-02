# 3Dサーバールーム デモ導線改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第4回記事の冒頭側と末尾に説明付きの3Dデモカードを配置し、読者が操作できるデモの存在とリンク先を迷わず理解できるようにする。

**Architecture:** 公開済み記事のMarkdownへ同じsemantic HTMLカードを2つ置き、共通の見た目は既存の`article.css`へ閉じ込める。raw HTMLの`h3`を使って意味構造を保ちつつ、Markdownの目次抽出には含めない。記事ソースの契約はVitest、レンダリング後の配置・レスポンシブ・キーボード操作・axeは既存Playwrightスイートで検証する。

**Tech Stack:** Astro 7、Markdown、CSS、Vitest 4、Playwright 1.61、axe-core

---

## File map

- `src/content/blog/blender-server-room-04-react-dashboard.md`: 説明付きデモカードを冒頭側と末尾へ配置する。
- `src/styles/article.css`: デモカードだけに適用する外観、レスポンシブ、フォーカス表示を定義する。
- `tests/unit/blender-episode-04-article.test.ts`: Markdownソース上のカード件数、文言、リンク属性、配置を契約化する。
- `tests/e2e/server-room-demo.spec.ts`: レンダリング後の2カード、画面幅、横overflow、キーボードフォーカス、axeを検証する。

設計書は`docs/superpowers/specs/2026-08-02-server-room-demo-cta-design.md`を参照する。

### Task 1: 記事ソースに2つの説明付きカードを追加する

**Files:**
- Modify: `tests/unit/blender-episode-04-article.test.ts:64-78`
- Modify: `src/content/blog/blender-server-room-04-react-dashboard.md:24-32`
- Modify: `src/content/blog/blender-server-room-04-react-dashboard.md:末尾`

- [ ] **Step 1: 2カードの契約を表す失敗テストを書く**

既存の`links to the interactive demo before the first result image`を、次の内容に置き換える。

```ts
it('shows the interactive demo card near the introduction and at the end', () => {
  const cards = [...body.matchAll(/<aside data-demo-cta>([\s\S]*?)<\/aside>/g)].map((match) => match[1]);

  expect(cards).toHaveLength(2);
  expect(body).not.toContain('>3Dデモを開く</a>');
  expect([...body.matchAll(/href="\/demos\/server-room\/"/g)]).toHaveLength(2);
  expect(cards[1].replace(/\s+/g, ' ').trim()).toBe(cards[0].replace(/\s+/g, ' ').trim());
  for (const card of cards) {
    expect(card).toContain('INTERACTIVE DEMO');
    expect(card).toContain('<h3>3Dサーバールームを操作できます</h3>');
    expect(card).toMatch(/回転[^<]+ズーム[^<]+サーバー選択[^<]+アラーム/);
    expect(card).toContain('別タブで開きます');
    expect(card).toContain('デスクトップ環境を推奨します');
    expect(card).toMatch(
      /<a href="\/demos\/server-room\/" target="_blank" rel="noopener">\s*3Dサーバールームを開く/,
    );
  }

  const firstCardPosition = body.indexOf('<aside data-demo-cta>');
  const resultImagePosition = body.indexOf('![React Three Fiberを組み込む前のVite初期画面]');
  const summaryPosition = body.indexOf('## 4回のまとめ');
  const lastCardPosition = body.lastIndexOf('<aside data-demo-cta>');

  expect(firstCardPosition).toBeGreaterThan(-1);
  expect(firstCardPosition).toBeLessThan(resultImagePosition);
  expect(lastCardPosition).toBeGreaterThan(summaryPosition);
});
```

既存の回転・ズーム・モックデータ・推奨環境に関する本文のassertは残す。

- [ ] **Step 2: 単体テストが意図した理由で失敗することを確認する**

Run:

```bash
npx vitest run tests/unit/blender-episode-04-article.test.ts
```

Expected: `cards`が0件または1件であるため、`toHaveLength(2)`でFAILする。

- [ ] **Step 3: 冒頭側の旧テキストリンクを説明付きカードへ置き換える**

既存の`3Dデモを開く`アンカーを、次のHTMLへ置き換える。

```html
<aside data-demo-cta>
  <p class="demo-cta__eyebrow">INTERACTIVE DEMO</p>
  <h3>3Dサーバールームを操作できます</h3>
  <p>視点の回転とズーム、サーバー選択、アラーム発生と正常復帰をブラウザで試せます。</p>
  <p class="demo-cta__note">別タブで開きます。デスクトップ環境を推奨します。</p>
  <a href="/demos/server-room/" target="_blank" rel="noopener">
    3Dサーバールームを開く <span aria-hidden="true">→</span>
  </a>
</aside>
```

- [ ] **Step 4: 同じカードを記事末尾へ追加する**

「4回のまとめ」の最後の段落の直後へ、Step 3と同じHTMLを追加する。`id`は追加しない。

- [ ] **Step 5: 単体テストが成功することを確認する**

Run:

```bash
npx vitest run tests/unit/blender-episode-04-article.test.ts
```

Expected: 対象ファイルの全テストがPASSする。

- [ ] **Step 6: 記事ソース変更をコミットする**

```bash
git add src/content/blog/blender-server-room-04-react-dashboard.md tests/unit/blender-episode-04-article.test.ts
git commit -m "feat: clarify server room demo links"
```

### Task 2: カードの表示とアクセシビリティを実装する

**Files:**
- Modify: `tests/e2e/server-room-demo.spec.ts:66-115`
- Modify: `src/styles/article.css:98-120`
- Modify: `src/styles/article.css:244-260`

- [ ] **Step 1: 既存E2Eを2リンク対応へ変更する**

記事へ戻った後の旧`3Dデモを開く`単一リンク検証を、次へ置き換える。

```ts
const cards = page.locator('[data-demo-cta]');
await expect(cards).toHaveCount(2);
for (const card of await cards.all()) {
  await expect(card.getByText('INTERACTIVE DEMO', { exact: true })).toBeVisible();
  await expect(card.getByRole('heading', { name: '3Dサーバールームを操作できます' })).toBeVisible();
  await expect(card).toContainText('回転とズーム');
  await expect(card).toContainText('サーバー選択');
  await expect(card).toContainText('アラーム発生と正常復帰');
  await expect(card).toContainText('別タブで開きます');
  await expect(card).toContainText('デスクトップ環境を推奨します');
  const link = card.getByRole('link', { name: /3Dサーバールームを開く/ });
  await expect(link).toHaveAttribute('href', demoPath);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
}
```

- [ ] **Step 2: レスポンシブ、フォーカス、axeの失敗テストを追加する**

```ts
test('記事のデモカードがPC幅で640px以内に収まる', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(articlePath);
  const cards = page.locator('[data-demo-cta]');
  await expect(cards).toHaveCount(2);
  for (const card of await cards.all()) {
    await expect.poll(async () => (await card.boundingBox())?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(640);
  }
});

test('記事のデモカードが390px幅で横overflowを起こさずキーボード操作できる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);
  const cards = page.locator('[data-demo-cta]');
  await expect(cards).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const links = cards.getByRole('link', { name: /3Dサーバールームを開く/ });
  await expect(links).toHaveCount(2);
  const articleBodyBox = await page.locator('.article-body').boundingBox();
  expect(articleBodyBox).not.toBeNull();
  for (const card of await cards.all()) {
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(Math.abs(cardBox!.width - articleBodyBox!.width)).toBeLessThanOrEqual(1);

    const link = card.getByRole('link', { name: /3Dサーバールームを開く/ });
    const linkBox = await link.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    const cardContentWidth = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        element.getBoundingClientRect().width -
        parseFloat(style.paddingInlineStart) -
        parseFloat(style.paddingInlineEnd) -
        parseFloat(style.borderInlineStartWidth) -
        parseFloat(style.borderInlineEndWidth)
      );
    });
    expect(Math.abs(linkBox!.width - cardContentWidth)).toBeLessThanOrEqual(1);
  }

  const focusedCtas: number[] = [];
  for (let attempt = 0; attempt < 80 && focusedCtas.length < 2; attempt += 1) {
    await page.keyboard.press('Tab');
    const focusedIndex = await links.evaluateAll((elements) =>
      elements.findIndex((element) => element === document.activeElement),
    );
    if (focusedIndex >= 0 && !focusedCtas.includes(focusedIndex)) {
      focusedCtas.push(focusedIndex);
      await expect(links.nth(focusedIndex)).toHaveCSS('outline-style', 'solid');
    }
  }
  expect(focusedCtas).toEqual([0, 1]);
});

test('第4回記事にcriticalまたはseriousのaxe違反がない', async ({ page }) => {
  await page.goto(articlePath);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
});
```

- [ ] **Step 3: E2Eがスタイル不足のため失敗することを確認する**

Run:

```bash
npx playwright test tests/e2e/server-room-demo.spec.ts --grep "デモカード|第4回記事"
```

Expected: カード幅、モバイルのボタン幅、またはカード専用表示のassertでFAILする。ブラウザ起動自体の失敗ではないことを確認する。

- [ ] **Step 4: カードの共通スタイルを追加する**

`article.css`の通常リンクと画像のルール付近へ次を追加する。

```css
.article-body [data-demo-cta] {
  inline-size: 100%;
  max-inline-size: 40rem;
  margin-block: var(--space-8);
  padding: clamp(var(--space-5), 4vw, var(--space-8));
  border: 1px solid color-mix(in srgb, var(--color-accent) 34%, var(--color-border));
  border-radius: var(--radius-card-lg);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 56%),
    var(--color-card);
}
.article-body [data-demo-cta] > * {
  margin-block: 0;
}
.article-body [data-demo-cta] > * + * {
  margin-block-start: var(--space-3);
}
.article-body [data-demo-cta] .demo-cta__eyebrow {
  color: var(--color-accent-soft);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}
.article-body [data-demo-cta] h3 {
  font-size: clamp(1.2rem, 3vw, 1.55rem);
}
.article-body [data-demo-cta] .demo-cta__note {
  color: var(--color-text-muted);
  font-size: 0.82rem;
}
.article-body [data-demo-cta] a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  inline-size: fit-content;
  margin-block-start: var(--space-5);
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-accent-soft);
  border-radius: var(--radius-sm);
  color: var(--color-background);
  background: var(--color-accent-soft);
  font-family: var(--font-ui);
  font-weight: 700;
  line-height: 1.4;
  text-decoration: none;
}
.article-body [data-demo-cta] a:hover {
  color: var(--color-background);
  background: color-mix(in srgb, var(--color-accent-soft) 88%, white);
}
.article-body [data-demo-cta] a:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
```

既存の`@media (max-width: 39.99rem)`内へ次を追加する。

```css
.article-body [data-demo-cta] a {
  inline-size: 100%;
}
```

- [ ] **Step 5: 該当E2Eと単体テストを実行する**

Run:

```bash
npx vitest run tests/unit/blender-episode-04-article.test.ts
npx playwright test tests/e2e/server-room-demo.spec.ts --grep "実デモで選択|デモカード|第4回記事"
```

Expected: 該当テストがすべてPASSし、console error、page error、CSP violationも0件のままである。

- [ ] **Step 6: カード表示とE2Eをコミットする**

```bash
git add src/styles/article.css tests/e2e/server-room-demo.spec.ts
git commit -m "test: cover server room demo cards"
```

### Task 3: 全体検証と公開前確認を行う

**Files:**
- Verify: `src/content/blog/blender-server-room-04-react-dashboard.md`
- Verify: `src/styles/article.css`
- Verify: `tests/unit/blender-episode-04-article.test.ts`
- Verify: `tests/e2e/server-room-demo.spec.ts`

- [ ] **Step 1: フォーマットを適用する**

Run:

```bash
npx prettier --write src/content/blog/blender-server-room-04-react-dashboard.md src/styles/article.css tests/unit/blender-episode-04-article.test.ts tests/e2e/server-room-demo.spec.ts
```

Expected: 4ファイルがPrettier形式になる。差分が発生した場合は、該当ファイルを直前の関連コミットへ追加せず、新しい整形コミットとして残す。

- [ ] **Step 2: 型・記事・デモ・ビルドの全検証を実行する**

Run:

```bash
npm run verify
```

Expected:

- Prettier checkが成功する
- Astro checkがerrors 0、warnings 0、hints 0で成功する
- GLB検証がerrors 0、warnings 0で成功する
- root Vitestとdemo Vitestがすべて成功する
- Astro、Vite demo、Pagefindを含むbuildが成功する
- Playwright E2Eがすべて成功する

- [ ] **Step 3: 整形差分がある場合だけコミットする**

```bash
git add src/content/blog/blender-server-room-04-react-dashboard.md src/styles/article.css tests/unit/blender-episode-04-article.test.ts tests/e2e/server-room-demo.spec.ts
git commit -m "style: format server room demo cards"
```

Expected: Step 1で差分がなければ、このStepは実行しない。

- [ ] **Step 4: 生成HTMLの件数とSEO契約が変わっていないことを確認する**

Run:

```bash
article_html=dist/blog/blender-server-room-04-react-dashboard/index.html
test "$(rg -o '<link rel="canonical"' "$article_html" | wc -l | tr -d ' ')" = 1
test "$(rg -o 'data-demo-cta' "$article_html" | wc -l | tr -d ' ')" = 2
test "$(rg -o 'href="/demos/server-room/"' "$article_html" | wc -l | tr -d ' ')" = 2
```

Expected: 3コマンドがすべて終了コード0になる。既存canonicalが1つ、デモカードが2つ、CTA内リンクが2つである。デモページのnoindexとサイトマップ除外は、Step 2の`npm run verify`内で`verify-build.mjs`が検証済みである。

- [ ] **Step 5: 最終差分を確認する**

Run:

```bash
git diff origin/main...HEAD --check
git diff --stat origin/main...HEAD
git status --short
```

Expected: whitespace errorがなく、変更対象が設計書・計画書と4つの実装ファイルに限定され、worktreeがcleanである。
