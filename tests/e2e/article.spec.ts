import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const articlePath = '/blog/gpt-5-6-sol-terra-luna/';
const articleTitle = 'GPT-5.6 Sol・Terra・Lunaの違い―特徴・料金・選び方';
const articleDescription =
  'GPT-5.6のSol・Terra・Lunaについて、性能階層、API料金、ChatGPT・Work・Codex・APIでの提供差と選択例を公式情報から整理します。';

async function expectNoHighImpactAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

test('記事の見出し、説明、日付、分類、読了時間と検索属性を表示する', async ({ page }) => {
  await page.goto(articlePath);

  await expect(page).toHaveTitle(`${articleTitle} | テックログ`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', articleDescription);
  const article = page.locator('article[data-pagefind-body]');
  await expect(article.getByRole('heading', { level: 1, name: articleTitle })).toHaveAttribute('data-pagefind-meta', 'title');
  await expect(article.getByText(articleDescription, { exact: true })).toHaveAttribute('data-pagefind-meta', 'description');
  await expect(article.locator('time[datetime="2026-07-10T15:00:00.000Z"]')).toHaveCount(2);
  await expect(article.getByText('公開日 2026年7月11日', { exact: true })).toBeVisible();
  await expect(article.getByText('更新日 2026年7月11日', { exact: true })).toBeVisible();
  await expect(article.locator('[data-pagefind-filter="category"]')).toHaveText('AI');
  await expect(article.locator('[data-pagefind-filter="tag"]')).toHaveText(['OpenAI', 'GPT-5.6', 'AI']);
  await expect(article.getByText('10分で読めます', { exact: true })).toBeVisible();
  for (const landmark of await page.locator('body > header, body > footer').all()) {
    await expect(landmark).toHaveAttribute('data-pagefind-ignore');
  }
  await expect(article.locator('[data-article-body]')).toBeVisible();
  await expect(page.locator('[data-author]')).toContainText('Hiroshi Imaizumi');
  await expectNoHighImpactAxeViolations(page);
});

test('本文の実IDと一致するH2/H3目次をデスクトップとモバイルに表示する', async ({ page }) => {
  await page.goto(articlePath);

  const bodyHeadings = page.locator('[data-article-body] :is(h2, h3)');
  expect(await bodyHeadings.count()).toBeGreaterThan(0);
  for (const heading of await bodyHeadings.all()) {
    const id = await heading.getAttribute('id');
    expect(id).toBeTruthy();
    await expect(heading.getByRole('link', { name: 'この見出しへのリンク' })).toHaveAttribute('href', `#${id}`);
    await expect(
      page.locator('[data-desktop-toc] a').filter({ has: page.locator(`text="${(await heading.innerText()).trim()}"`) }),
    ).toHaveCount(1);
  }

  await expect(page.locator('[data-desktop-toc]')).toBeVisible();
  await expect(page.locator('[data-desktop-toc]')).toHaveCSS('position', 'sticky');
  await expect(page.locator('[data-mobile-toc]')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-desktop-toc]')).toBeHidden();
  const mobileToc = page.locator('details[data-mobile-toc]');
  await expect(mobileToc).toBeVisible();
  await expect(mobileToc).not.toHaveAttribute('open', '');
  await mobileToc.getByText('目次', { exact: true }).click();
  await expect(mobileToc).toHaveAttribute('open', '');
  await expect(mobileToc.getByRole('link', { name: '3モデルの位置付け', exact: true })).toHaveAttribute('href', '#3モデルの位置付け');
});

test('装飾された見出しもAstroの実IDと目次リンクを一致させる', async ({ page }) => {
  await page.goto('/blog/build-tech-blog-with-astro-2026/');

  for (const name of ['Astro静的生成', 'Content Collections', 'Pagefind', 'Workers']) {
    const heading = page.locator('[data-article-body] h2').filter({ hasText: name });
    const id = await heading.getAttribute('id');
    expect(id).toBeTruthy();
    await expect(heading.getByRole('link', { name: 'この見出しへのリンク' })).toHaveAttribute('href', `#${id}`);
    await expect(page.locator('[data-desktop-toc]').getByRole('link', { name, exact: true })).toHaveAttribute('href', `#${id}`);
  }
});

test('本文幅を制限しコード以外でページ全体の横スクロールを発生させない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/blog/build-tech-blog-with-astro-2026/');

  const body = page.locator('[data-article-body]');
  expect((await body.boundingBox())?.width).toBeLessThanOrEqual(760);
  await expect(body).toHaveCSS('line-height', /28\.8px|30\.6px/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  for (const pre of await body.locator('pre').all()) {
    await expect(pre).toHaveCSS('overflow-x', 'auto');
  }
});

test('前後記事と決定的な関連記事を表示し、現在の記事を除外する', async ({ page }) => {
  await page.goto(articlePath);

  const adjacent = page.locator('[data-adjacent-articles]');
  await expect(adjacent.getByRole('link', { name: /ChatGPT Workとは/ })).toHaveAttribute('href', '/blog/chatgpt-work-guide/');
  await expect(adjacent.getByRole('link', { name: /Terraformで手動変更/ })).toHaveAttribute('href', '/blog/terraform-drift-detection/');

  const related = page.locator('[data-related-articles] [data-article-card]');
  await expect(related).toHaveCount(3);
  await expect(related.getByRole('heading')).toHaveText([
    'ChatGPT Workとは？Chat・Codexとの違いと使い分け',
    '2026年版 Astroで技術ブログを構築した',
    'Terraformで手動変更されたリソースを追従する方法',
  ]);
  await expect(page.locator('[data-related-articles]')).not.toContainText(articleTitle);
  await expect(page.locator('[data-related-articles] a a')).toHaveCount(0);
});

test('コードファイル名を本番HTMLへ保持し各コードブロックへコピー操作を一度だけ追加する', async ({ page }) => {
  await page.goto('/blog/build-tech-blog-with-astro-2026/');

  const blocks = page.locator('[data-article-body] pre');
  expect(await blocks.count()).toBeGreaterThan(1);
  await expect(blocks.locator('[data-code-copy]')).toHaveCount(await blocks.count());
  for (const block of await blocks.all()) {
    await expect(block.locator('[data-code-copy]')).toHaveCount(1);
  }
  await expect(blocks.filter({ has: page.locator('[data-filename="src/pages/blog/[slug].astro"]') })).toHaveCount(1);
  await expect(page.locator('[data-code-filename]')).toHaveText('src/pages/blog/[slug].astro');
  await expect(blocks.filter({ hasNot: page.locator('[data-filename]') })).not.toHaveCount(0);
  await expect(
    blocks
      .filter({ hasNot: page.locator('[data-filename]') })
      .first()
      .locator('[data-code-filename]'),
  ).toHaveCount(0);
});

test('コピー成功を通知し約2秒後にラベルを戻す', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
  });
  await page.goto('/blog/build-tech-blog-with-astro-2026/');

  const button = page.locator('[data-code-copy]').first();
  await button.click();
  await expect(button).toHaveText('コピーしました');
  await expect(button).toHaveText('コピー', { timeout: 2_500 });
});

test('Clipboard非対応・失敗時に通知しコードの手動選択を維持する', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await page.goto('/blog/build-tech-blog-with-astro-2026/');

  const firstBlock = page.locator('[data-article-body] pre').first();
  const button = firstBlock.locator('[data-code-copy]');
  await button.click();
  await expect(button).toHaveText('コピーできませんでした');
  expect(
    await firstBlock.locator('code').evaluate((code) => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return selection?.toString().length ?? 0;
    }),
  ).toBeGreaterThan(0);
});

test('下書きと未知の記事ルートを生成しない', async ({ request }) => {
  for (const path of ['/blog/draft-article/', '/blog/not-a-real-article/']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
