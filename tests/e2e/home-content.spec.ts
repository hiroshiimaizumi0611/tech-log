import { expect, test } from '@playwright/test';

const blenderArticleTitle = 'Blender完全初心者がCubeだけでサーバーラックを作る';
const opusArticleTitle = 'Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説';
const kimiArticleTitle = 'Kimi K3とは？2.8兆パラメータの新AIモデルを公式情報とベンチマークから解説';
const cloudFrontArticleTitle = '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理';

const latestArticleTitles = [blenderArticleTitle, opusArticleTitle, kimiArticleTitle, cloudFrontArticleTitle] as const;

const featuredArticleTitle = opusArticleTitle;

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
  await expect(hero.locator('[data-hero-network]')).toBeVisible();

  const featured = hero.getByRole('article', { name: '注目記事' });
  await expect(featured.getByText('FEATURED', { exact: true })).toBeVisible();
  await expect(featured.getByRole('heading', { name: featuredArticleTitle })).toBeVisible();
  await expect(featured.getByRole('link')).toHaveCount(1);
  await expect(featured.getByRole('link', { name: featuredArticleTitle })).toHaveAttribute('href', '/blog/claude-opus-5-overview/');
  await expect(featured.locator('[data-custom-hero], [data-category-artwork], pre, .description, .tags')).toHaveCount(0);
  await expect(featured.locator('time, .reading-time, .code-panel, .media-layer')).toHaveCount(0);
  await expect(featured.getByText(/\d+分で読めます|featuredCode/i)).toHaveCount(0);
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
  const opusCard = cards.filter({ hasText: opusArticleTitle });
  const customArtwork = opusCard.locator('[data-custom-hero]');

  await expect(cards.locator('[data-category-artwork]')).toHaveCount(4);
  await expect(customArtwork).toBeVisible();
  const customImageUrl = await backgroundImageUrl(customArtwork);
  expect(new URL(customImageUrl).pathname).toMatch(/^\/_astro\//);
  await expect(customArtwork).toHaveAttribute('data-image-width', '640');
  await expect(customArtwork).toHaveAttribute('data-image-height', '360');
  await expect(customArtwork).toHaveAttribute('data-image-format', 'webp');
  await expect(opusCard.locator('[data-category-artwork]')).toBeVisible();
  await expect(page.locator('script[data-image-fallback]')).toHaveCount(0);
});

test('記事カードの画像取得失敗時も固定比率のカテゴリーアートとリンクを利用できる', async ({ page }) => {
  const initialCard = page.getByRole('region', { name: '最新の記事' }).locator('[data-article-card]').filter({ hasText: opusArticleTitle });
  const cardImageUrl = await backgroundImageUrl(initialCard.locator('[data-custom-hero]'));
  let abortedRequests = 0;
  await page.route(cardImageUrl, async (route) => {
    abortedRequests += 1;
    await route.abort('failed');
  });
  await page.goto('/?hero-image=failure');

  const opusCard = page.getByRole('region', { name: '最新の記事' }).locator('[data-article-card]').filter({ hasText: opusArticleTitle });
  const fallback = opusCard.locator('[data-category-artwork]');
  const customArtwork = opusCard.locator('[data-custom-hero]');
  expect(await backgroundImageUrl(customArtwork)).toBe(cardImageUrl);
  await expect(fallback).toBeVisible();
  await expect(customArtwork).toBeVisible();
  expect(await customArtwork.boundingBox()).toEqual(await fallback.boundingBox());
  await expect(opusCard.getByRole('heading', { name: opusArticleTitle })).toBeVisible();
  await expect(opusCard.getByRole('link')).toHaveAttribute('href', '/blog/claude-opus-5-overview/');
  expect(abortedRequests).toBeGreaterThan(0);
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

test('デスクトップではフォント幅が変わっても人気タグを1行に保つ', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.addStyleTag({
    content: '.popular-tags .tag-chip { letter-spacing: 0.02em; }',
  });

  const tagLinks = page.getByRole('region', { name: '人気のタグ' }).getByRole('link');
  const topPositions = await tagLinks.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));

  expect(new Set(topPositions).size).toBe(1);
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

  const hero = page.getByRole('region', { name: 'サイト紹介' });
  await expect(hero.getByRole('heading', { level: 1, name: 'テックログ' })).toBeVisible();
  await expect(hero.getByRole('link', { name: featuredArticleTitle })).toHaveAttribute('href', '/blog/claude-opus-5-overview/');
  await expect(hero.locator('[data-network-fallback]')).toBeVisible();
  await expect(page.getByRole('region', { name: '最新の記事' }).locator('[data-article-card]')).toHaveCount(4);
  await expect(page.getByRole('region', { name: '人気のタグ' }).getByRole('link')).toHaveCount(10);
  await context.close();
});
