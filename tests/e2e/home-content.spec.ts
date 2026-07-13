import { expect, test } from '@playwright/test';

const latestArticleTitles = [
  'ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方',
  '2026年版 Astroで技術ブログを構築した',
  'ChatGPT Workとは？Chat・Codexとの違いと使い分け',
  'GPT-5.6 Sol・Terra・Lunaの違い―特徴・料金・選び方',
] as const;

const backgroundImageUrl = async (locator: import('@playwright/test').Locator) => {
  const backgroundImage = await locator.evaluate((element) => getComputedStyle(element).backgroundImage);
  const match = backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
  expect(match).not.toBeNull();
  return match![1];
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('最新の注目記事とサイト紹介をヒーローに表示する', async ({ page }) => {
  const hero = page.getByRole('region', { name: 'サイト紹介' });

  await expect(hero.getByRole('heading', { level: 1, name: 'テックログ' })).toBeVisible();
  await expect(hero.getByText('つくる、動かす、改善する。', { exact: true })).toBeVisible();
  await expect(hero.getByText('AWS / React / TypeScript / Terraform / Java / AI / Ops', { exact: true })).toBeVisible();

  const featured = hero.getByRole('article', { name: '注目記事' });
  await expect(featured.getByRole('heading', { name: latestArticleTitles[0] })).toBeVisible();
  await expect(featured.getByRole('link', { name: /続きを読む/ })).toHaveAttribute('href', '/blog/chatgpt-codex-plugins-guide/');
  await expect(featured.locator('pre, [data-featured-code]')).toHaveCount(0);
  const customArtwork = featured.locator('[data-custom-hero]');
  await expect(customArtwork).toBeVisible();
  expect(new URL(await backgroundImageUrl(customArtwork)).pathname).toMatch(/^\/_astro\//);
  await expect(page.getByRole('region', { name: '最新の記事' }).locator('pre > code')).toHaveCount(0);
});

test('最新記事を公開日順に4件だけ表示しカード全体を一つのリンクにする', async ({ page }) => {
  const latest = page.getByRole('region', { name: '最新の記事' });
  const cards = latest.locator('[data-article-card]');

  await expect(cards).toHaveCount(4);
  await expect(cards.getByRole('heading')).toHaveText(latestArticleTitles);

  for (let index = 0; index < latestArticleTitles.length; index += 1) {
    const card = cards.nth(index);
    await expect(card.locator('a')).toHaveCount(1);
    await expect(card.getByRole('link')).toHaveAttribute('href', /^\/blog\/[a-z0-9-]+\/$/);
    await expect(card.getByText(/分で読めます$/)).toBeVisible();
    await expect(card.locator('[data-category-artwork]')).toBeVisible();
  }
});

test('記事画像をカテゴリーアート上の装飾レイヤーとして表示する', async ({ page }) => {
  const cards = page.getByRole('region', { name: '最新の記事' }).locator('[data-article-card]');
  const pluginsCard = cards.filter({ hasText: latestArticleTitles[0] });
  const customArtwork = pluginsCard.locator('[data-custom-hero]');

  await expect(cards.locator('[data-category-artwork]')).toHaveCount(4);
  await expect(customArtwork).toBeVisible();
  const customImageUrl = await backgroundImageUrl(customArtwork);
  expect(new URL(customImageUrl).pathname).toMatch(/^\/_astro\//);
  await expect(customArtwork).toHaveAttribute('data-image-width', '640');
  await expect(customArtwork).toHaveAttribute('data-image-height', '360');
  await expect(customArtwork).toHaveAttribute('data-image-format', 'webp');
  await expect(pluginsCard.locator('[data-category-artwork]')).toBeVisible();
  await expect(page.locator('script[data-image-fallback]')).toHaveCount(0);
});

test('記事画像の取得失敗時も固定比率のカテゴリーアートとカードリンクを利用できる', async ({ page }) => {
  const initialCard = page
    .getByRole('region', { name: '最新の記事' })
    .locator('[data-article-card]')
    .filter({ hasText: latestArticleTitles[0] });
  const optimizedImageUrl = await backgroundImageUrl(initialCard.locator('[data-custom-hero]'));
  let abortedRequests = 0;
  await page.route(optimizedImageUrl, async (route) => {
    abortedRequests += 1;
    await route.abort('failed');
  });
  await page.goto('/?hero-image=failure');

  const pluginsCard = page
    .getByRole('region', { name: '最新の記事' })
    .locator('[data-article-card]')
    .filter({ hasText: latestArticleTitles[0] });
  const fallback = pluginsCard.locator('[data-category-artwork]');
  const customArtwork = pluginsCard.locator('[data-custom-hero]');

  expect(await backgroundImageUrl(customArtwork)).toBe(optimizedImageUrl);
  await expect(fallback).toBeVisible();
  expect(abortedRequests).toBeGreaterThan(0);

  const fallbackBox = await fallback.boundingBox();
  const customBox = await customArtwork.boundingBox();
  expect(fallbackBox).not.toBeNull();
  expect(customBox).not.toBeNull();
  expect(customBox).toEqual(fallbackBox);
  await expect(pluginsCard.getByRole('link')).toHaveAttribute('href', '/blog/chatgpt-codex-plugins-guide/');
  await expect(pluginsCard.getByRole('heading', { name: latestArticleTitles[0] })).toBeVisible();
  await expect(page.locator('script[data-image-fallback], [onerror]')).toHaveCount(0);
});

test('ホーム内のSVG定義IDをすべて一意にする', async ({ page }) => {
  const ids = await page.locator('svg [id]').evaluateAll((elements) => elements.map((element) => element.id));

  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
});

test('人気タグを件数付きで最大10件表示する', async ({ page }) => {
  const popularTags = page.getByRole('region', { name: '人気のタグ' });
  const tagLinks = popularTags.getByRole('link');

  await expect(tagLinks).toHaveCount(10);
  await expect(tagLinks.first()).toContainText(/\d+件$/);
  await expect(tagLinks.first()).toHaveAttribute('href', /^\/tags\//);
});

test('著者名を表示し根拠のない統計を表示しない', async ({ page }) => {
  const author = page.getByRole('region', { name: '著者プロフィール' });

  await expect(author.getByRole('heading', { name: 'Hiroshi Imaizumi' })).toBeVisible();
  await expect(author.getByText(/記事数|閲覧数|総閲覧数|運用期間/)).toHaveCount(0);
});

test('JavaScriptなしでもホームのコンテンツとリンクを利用できる', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');

  await expect(page.getByRole('region', { name: '最新の記事' }).locator('[data-article-card]')).toHaveCount(4);
  await expect(page.getByRole('region', { name: '人気のタグ' }).getByRole('link')).toHaveCount(10);
  await context.close();
});
