import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const articlePath = '/blog/claude-opus-5-overview/';
const articleTitle = 'Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説';
const articleDescription =
  'Claude Opus 5とは何か。Opus 4.8から強化された推論・コーディング性能、料金、ベンチマーク、Fable 5・Sonnet 5との違い、API移行時の注意点を解説します。';
const articleImageAlt = 'Claude Opus 4.8からOpus 5への進化を表したオリジナル画像';

test('Claude Opus 5記事のSEO、メタデータ、本文構成を公開する', async ({ page }) => {
  await page.goto(articlePath);

  await expect(page).toHaveTitle(`${articleTitle} | テックログ`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', articleDescription);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog\/claude-opus-5-overview\/$/);
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const imageUrl = await page.locator(selector).getAttribute('content');
    expect(imageUrl).not.toBeNull();
    if (imageUrl === null) throw new Error(`${selector} must have a content attribute`);
    expect(new URL(imageUrl).pathname).toMatch(/^\/_astro\/claude-opus-5-evolution\..+\.webp$/);
  }

  const article = page.locator('article[data-pagefind-body]');
  const body = article.locator('[data-article-body]');
  await expect(article).toBeVisible();
  await expect(body).toBeVisible();
  await expect(article.getByRole('heading', { level: 1, name: articleTitle })).toBeVisible();
  await expect(article.getByText('公開日 2026年7月26日', { exact: true })).toBeVisible();
  await expect(article.locator('[data-pagefind-filter="category"]')).toHaveText('AI');
  await expect(article.locator('[data-pagefind-filter="tag"]')).toHaveText(['Claude', 'Anthropic', 'AIモデル', 'Claude Code']);
  await expect(body.getByRole('heading', { level: 2 })).toHaveCount(8);
  await expect(body.locator('img')).toHaveCount(1);
  await expect(body.locator('img')).toHaveAttribute('alt', articleImageAlt);
  await expect(body.locator('table')).toHaveCount(4);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('Claude Opus 5記事を390x844で横方向にはみ出さず表示する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);

  const body = page.locator('[data-article-body]');
  await expect(body).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth)).toBe(true);
  expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  const overflowCandidates = body.locator('img, table');
  expect(await overflowCandidates.count()).toBeGreaterThan(0);
  for (const element of await overflowCandidates.all()) {
    expect(await element.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }

  const bodyBox = (await body.boundingBox())!;
  const codeBlocks = body.locator('pre');
  expect(await codeBlocks.count()).toBeGreaterThan(0);
  for (const codeBlock of await codeBlocks.all()) {
    const box = (await codeBlock.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bodyBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bodyBox.x + bodyBox.width + 1);
    await expect(codeBlock).toHaveCSS('overflow-x', 'auto');
  }
});
