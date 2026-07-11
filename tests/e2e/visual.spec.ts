import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1440, height: 1200 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const routes = ['/', '/blog/', '/tags/', '/categories/', '/about/', '/privacy/', '/blog/build-tech-blog-with-astro-2026/'] as const;

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

test('reduced motionではtransitionを停止する', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const card = page.locator('[data-article-card]').first();
  const duration = await card.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration.split(',').every((value) => Number.parseFloat(value) <= 0.001)).toBe(true);
  await card.hover();
  await expect(card).toHaveCSS('transform', 'none');
});
