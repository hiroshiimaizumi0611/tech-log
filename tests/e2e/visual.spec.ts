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

test('モバイルではintro、network、Featuredの順で重ならずに表示する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const intro = await page.locator('.hero .intro').boundingBox();
  const network = await page.locator('.hero [data-hero-network]').boundingBox();
  const featuredSlot = await page.locator('.hero .featured-slot').boundingBox();
  const featured = await page.locator('.hero .featured').boundingBox();
  expect(intro).not.toBeNull();
  expect(network).not.toBeNull();
  expect(featuredSlot).not.toBeNull();
  expect(featured).not.toBeNull();
  expect(intro!.y + intro!.height).toBeLessThanOrEqual(network!.y + 0.5);
  expect(network!.y + network!.height).toBeLessThanOrEqual(featuredSlot!.y + 0.5);
  expect(featuredSlot!.y).toBeLessThanOrEqual(featured!.y + 0.5);
  expect(featured!.x + featured!.width).toBeLessThanOrEqual(390);

  const layout = await page.locator('.hero').evaluate((hero) => {
    const network = hero.querySelector<HTMLElement>('[data-hero-network]')!;
    const featuredSlot = hero.querySelector<HTMLElement>('.featured-slot')!;
    return {
      networkInlineSize: getComputedStyle(network).inlineSize,
      networkMinInlineSize: getComputedStyle(network).minInlineSize,
      featuredPosition: getComputedStyle(featuredSlot).position,
    };
  });
  expect(layout.featuredPosition).toBe('static');
  expect(layout.networkInlineSize).toBe(`${network!.width}px`);
  expect(layout.networkMinInlineSize).toBe('0px');
  await expectNoPageOverflow(page);
});

test('レスポンシブのカード列数を維持する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

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

test('compact Featuredの長い英数字を1024pxと390pxでカード内に収める', async ({ page }) => {
  const longText = 'ExtremelyLongUnbrokenTechnicalIdentifier'.repeat(12);
  for (const viewport of [
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const heading = page.locator('.featured h2');
    await heading.evaluate((element, text) => {
      element.textContent = text;
    }, longText);
    await expect(heading).toBeVisible();
    const headingSize = await heading.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    expect(headingSize.scroll).toBeLessThanOrEqual(headingSize.client);

    const featured = page.locator('.featured');
    const featuredSize = await featured.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    expect(featuredSize.scroll).toBeLessThanOrEqual(featuredSize.client);
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

  const featuredLink = page.locator('.featured').getByRole('link', { name: /記事を読む/ });
  const featuredArrow = featuredLink.locator('.read-more > span');
  await featuredLink.hover();
  await expect(featuredLink).toHaveCSS('transform', 'none');
  await expect(featuredArrow).toHaveCSS('transform', 'none');

  const entranceTargets = page.locator(
    '[data-hero-entrance], .intro > .kicker, .intro > h1, .intro > .tagline, .intro > .description, .intro > .accent-line, .intro > .tech-list',
  );
  await expect(entranceTargets).toHaveCount(8);
  for (const target of await entranceTargets.all()) {
    await expect(target).toBeVisible();
    await expect(target).toHaveCSS('opacity', '1');
    await expect(target).toHaveCSS('transform', 'none');
    const durations = await target.evaluate((element) =>
      getComputedStyle(element)
        .animationDuration.split(',')
        .map((value) => Number.parseFloat(value)),
    );
    expect(durations.every((value) => value <= 0.001)).toBe(true);
  }

  await expect(page.locator('[data-hero-network]')).toHaveAttribute('data-network-state', 'static');
  await expect(featuredLink).toBeVisible();

  await page.getByRole('button', { name: '検索を開く' }).click();
  await page.getByRole('searchbox', { name: '記事を検索' }).fill('Astro');
  const searchResult = page.getByRole('dialog').getByRole('link', { name: /Astro result/ });
  await expect(searchResult).toBeVisible();
  await searchResult.hover();
  await expect(searchResult).toHaveCSS('transform', 'none');

  for (const target of [card, sectionArrow, featuredLink, featuredArrow, searchResult]) {
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
