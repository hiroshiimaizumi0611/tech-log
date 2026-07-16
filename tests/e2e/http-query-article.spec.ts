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
    expect(imageUrl).not.toBeNull();
    if (imageUrl === null) throw new Error(`${selector} must have a content attribute`);
    expect(new URL(imageUrl).pathname).toBe('/og-default.png');
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
  await expect(body.locator('img')).toHaveCount(0);
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
