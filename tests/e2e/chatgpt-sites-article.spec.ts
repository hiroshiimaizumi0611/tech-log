import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const articlePath = '/blog/chatgpt-sites-guide/';
const articleTitle = 'ChatGPT Sitesの使い方｜実際にWebサイトを作って限定公開するまで';
const articleDescription =
  'ChatGPT Sitesでの生成、修正、バージョン保存、共有範囲の確認、「自分のみ」での限定公開までを初心者向けにたどる実践ガイドです。';
const articleHeadings = [
  'ChatGPT Sitesで何ができるのか',
  '今回作るもの',
  '作る前に情報をそろえる',
  '最初のページを生成する',
  '見た目より先に内容と操作を確認する',
  '修正プロンプトは具体的に書く',
  '公開前にバージョンを保存する',
  '共有範囲を確認して限定公開する',
  '実際に使って分かったこと',
  '公開前チェックリスト',
] as const;

async function expectNoHighImpactAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

test('ChatGPT Sites記事のSEOと承認済みの本文構成を公開する', async ({ page }) => {
  await page.goto(articlePath);

  await expect(page).toHaveTitle(`${articleTitle} | テックログ`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', articleDescription);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog\/chatgpt-sites-guide\/$/);
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const imageUrl = await page.locator(selector).getAttribute('content');
    expect(imageUrl).toBeTruthy();
    expect(new URL(imageUrl!).pathname).toMatch(/^\/_astro\/chatgpt-sites-guide-og\..+\.png$/);
    expect(new URL(imageUrl!).pathname).not.toBe('/og-default.png');
  }

  const article = page.locator('article[data-pagefind-body]');
  const body = article.locator('[data-article-body]');
  await expect(article.getByRole('heading', { level: 1, name: articleTitle })).toBeVisible();
  await expect(body.getByRole('heading', { level: 2 })).toHaveText(articleHeadings);
  await expectNoHighImpactAxeViolations(page);
});

test('本文画像8点以上に一意の代替テキスト、寸法、表示キャプションを付ける', async ({ page }) => {
  await page.goto(articlePath);

  const body = page.locator('[data-article-body]');
  const images = body.locator('img');
  const imageCount = await images.count();
  expect(imageCount).toBeGreaterThanOrEqual(8);

  const imageMetadata = await images.evaluateAll((elements) =>
    elements.map((element) => ({
      alt: element.getAttribute('alt') ?? '',
      height: Number(element.getAttribute('height')),
      width: Number(element.getAttribute('width')),
    })),
  );
  expect(imageMetadata.every(({ alt, height, width }) => alt.trim().length > 0 && height > 0 && width > 0)).toBe(true);
  expect(new Set(imageMetadata.map(({ alt }) => alt)).size).toBe(imageCount);

  const captions = body.locator('.article-image-caption');
  await expect(captions).toHaveCount(imageCount);
  for (const caption of await captions.all()) await expect(caption).toBeVisible();
});

test('390x844でdocumentと記事本文に横方向のoverflowを発生させない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);

  const body = page.locator('[data-article-body]');
  await expect(body).toBeVisible();
  expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
