import { expect, test, type Page } from '@playwright/test';
import { readdir } from 'node:fs/promises';

const reducedMotionSearchModule = `
export const init = async () => {};
export const search = async () => ({
  results: [{
    data: async () => ({
      url: '/blog/build-tech-blog-with-astro-2026/',
      plain_excerpt: 'Astro excerpt',
      meta: { title: 'Astro result' },
    }),
  }],
});
`;

const viewports = [
  { name: 'desktop', width: 1440, height: 1200 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const routes = ['/', '/blog/', '/tags/', '/categories/', '/about/', '/privacy/', '/blog/build-tech-blog-with-astro-2026/'] as const;

// macOS と Linux では同じレイアウトでもフォントのラスタライズに約3%の差が出る。
// 配置・overflow・列数・表示順は、このファイル内の個別アサーションで厳密に検証する。
const crossPlatformPixelTolerance = 0.04;

test('visual goldensをplatform非依存名で管理する', async () => {
  const files = await readdir(new URL('./visual.spec.ts-snapshots/', import.meta.url));
  expect(files.sort()).toEqual(['home-desktop.png', 'home-mobile.png', 'home-tablet.png']);
});

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

for (const viewport of viewports) {
  test(`ホームを${viewport.name}で表示できる`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expectNoPageOverflow(page);
    await expect(page).toHaveScreenshot(`home-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: crossPlatformPixelTolerance,
    });
  });

  test(`${viewport.name}で全ページが横スクロールを起こさない`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      await expectNoPageOverflow(page);
    }
  });
}

test('レスポンシブの情報順とカード列数を維持する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const intro = await page.locator('.hero .intro').boundingBox();
  const featured = await page.locator('.hero .featured').boundingBox();
  expect(intro).not.toBeNull();
  expect(featured).not.toBeNull();
  expect(intro!.y).toBeLessThan(featured!.y);
  expect(featured!.x + featured!.width).toBeLessThanOrEqual(390);

  const mobileCards = await page.locator('[data-article-card]').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().x));
  expect(new Set(mobileCards.map(Math.round)).size).toBe(1);

  await page.setViewportSize({ width: 768, height: 1024 });
  const tabletCards = await page.locator('[data-article-card]').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().x));
  expect(new Set(tabletCards.map(Math.round)).size).toBe(2);

  await page.setViewportSize({ width: 1440, height: 1200 });
  const desktopCards = await page
    .locator('[data-article-card]')
    .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().x));
  expect(new Set(desktopCards.map(Math.round)).size).toBe(4);
});

test('記事目次をdesktopとmobileで切り替える', async ({ page }) => {
  await page.goto('/blog/build-tech-blog-with-astro-2026/');
  await page.setViewportSize({ width: 1440, height: 1200 });
  await expect(page.locator('[data-desktop-toc]')).toBeVisible();
  await expect(page.locator('[data-mobile-toc]')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-desktop-toc]')).toBeHidden();
  await expect(page.locator('[data-mobile-toc]')).toBeVisible();
  await expectNoPageOverflow(page);
});

test('390pxではコードだけが内部スクロールを受け持つ', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/blog/build-tech-blog-with-astro-2026/');
  const codeBlocks = page.locator('.article-body pre');
  expect(await codeBlocks.count()).toBeGreaterThan(0);
  await expect(codeBlocks.first()).toHaveCSS('overflow-x', 'auto');
});

test('Featuredの長い英数字と画像を1024pxと390pxでカード内に収める', async ({ page }) => {
  const longText = 'ExtremelyLongUnbrokenTechnicalIdentifier'.repeat(12);
  for (const viewport of [
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const targets = [page.locator('.featured h2'), page.locator('.featured .description')];
    for (const target of targets) {
      await target.evaluate((element, text) => {
        element.textContent = text;
      }, longText);
      await expect(target).toBeVisible();
      const size = await target.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
      expect(size.scroll).toBeLessThanOrEqual(size.client);
    }

    const featured = page.locator('.featured');
    const featuredSize = await featured.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    expect(featuredSize.scroll).toBeLessThanOrEqual(featuredSize.client);
    const featuredBox = (await featured.boundingBox())!;
    const mediaBox = (await featured.locator('.media-layer').boundingBox())!;
    expect(mediaBox.x).toBeGreaterThanOrEqual(featuredBox.x);
    expect(mediaBox.x + mediaBox.width).toBeLessThanOrEqual(featuredBox.x + featuredBox.width);
    await expectNoPageOverflow(page);
  }
});

test('reduced motionでは全hover移動とtransitionを停止する', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/pagefind/pagefind.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: reducedMotionSearchModule }),
  );
  await page.goto('/');

  const card = page.locator('[data-article-card]').first();
  await card.hover();
  await expect(card).toHaveCSS('transform', 'none');

  const sectionArrow = page.getByRole('link', { name: /すべての記事を見る/ }).locator('span');
  await sectionArrow.locator('..').hover();
  await expect(sectionArrow).toHaveCSS('transform', 'none');

  const featuredArrow = page
    .locator('.featured')
    .getByRole('link', { name: /続きを読む/ })
    .locator('span');
  await featuredArrow.locator('..').hover();
  await expect(featuredArrow).toHaveCSS('transform', 'none');

  await page.getByRole('button', { name: '検索を開く' }).click();
  await page.getByRole('searchbox', { name: '記事を検索' }).fill('Astro');
  const searchResult = page.getByRole('dialog').getByRole('link', { name: /Astro result/ });
  await expect(searchResult).toBeVisible();
  await searchResult.hover();
  await expect(searchResult).toHaveCSS('transform', 'none');

  for (const target of [card, sectionArrow, featuredArrow, searchResult]) {
    const durations = await target.evaluate((element) => {
      const style = getComputedStyle(element);
      return [...style.transitionDuration.split(','), ...style.animationDuration.split(',')];
    });
    expect(durations.every((value) => Number.parseFloat(value) <= 0.001)).toBe(true);
  }

  await page.keyboard.press('Escape');
  await page.goto('/categories/');
  const categoryCard = page.locator('.category-index > a').first();
  await categoryCard.hover();
  await expect(categoryCard).toHaveCSS('transform', 'none');
  const categoryDurations = await categoryCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return [...style.transitionDuration.split(','), ...style.animationDuration.split(',')];
  });
  expect(categoryDurations.every((value) => Number.parseFloat(value) <= 0.001)).toBe(true);
});
