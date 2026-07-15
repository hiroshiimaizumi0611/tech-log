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

// macOS と Linux では同じレイアウトでもフォントのラスタライズや改行位置に差が出る。
// モバイルの全ページ画像は差が広がりやすいため許容値を分ける一方、
// 配置・overflow・列数・表示順は、このファイル内の個別アサーションで厳密に検証する。
const crossPlatformPixelTolerance = {
  desktop: 0.04,
  tablet: 0.04,
  mobile: 0.07,
} as const;
// Chromiumでの基準値は、desktop/tablet/mobileの順に
// line 0.00948/0.00646/0.02094、particle 0.00124/0.00105/0.00393。
// 下限は描画差を許容しつつ、線や粒子が大きく欠けた場合に失敗する値にする。
const networkCoverageBounds = {
  desktop: { line: { minimum: 0.006, maximum: 0.025 }, particle: { minimum: 0.00065, maximum: 0.003 } },
  tablet: { line: { minimum: 0.0038, maximum: 0.025 }, particle: { minimum: 0.00055, maximum: 0.003 } },
  mobile: { line: { minimum: 0.012, maximum: 0.05 }, particle: { minimum: 0.0022, maximum: 0.009 } },
} as const;

test('visual goldensをplatform非依存名で管理する', async () => {
  const files = await readdir(new URL('./visual.spec.ts-snapshots/', import.meta.url));
  expect(files.sort()).toEqual(['home-desktop.png', 'home-mobile.png', 'home-tablet.png']);
});

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function measureNetworkCanvasCoverage(page: Page) {
  return page.locator('[data-hero-network] canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Hero network Canvas 2D context is unavailable');

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let linePixels = 0;
    let particlePixels = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index];
      if (alpha > 8 && alpha <= 128) linePixels += 1;
      if (alpha > 128) particlePixels += 1;
    }

    const totalPixels = canvas.width * canvas.height;
    return {
      lineRatio: linePixels / totalPixels,
      particleRatio: particlePixels / totalPixels,
    };
  });
}

for (const viewport of viewports) {
  test(`ホームを${viewport.name}で表示できる`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const network = page.locator('[data-hero-network]');
    await expect(network).toHaveAttribute('data-network-state', 'static');
    await expect(network).toHaveAttribute('data-network-rendered', 'true');

    const coverage = await measureNetworkCanvasCoverage(page);
    const bounds = networkCoverageBounds[viewport.name];
    expect(coverage.lineRatio, `${viewport.name} line coverage`).toBeGreaterThanOrEqual(bounds.line.minimum);
    expect(coverage.lineRatio, `${viewport.name} line coverage`).toBeLessThanOrEqual(bounds.line.maximum);
    expect(coverage.particleRatio, `${viewport.name} particle coverage`).toBeGreaterThanOrEqual(bounds.particle.minimum);
    expect(coverage.particleRatio, `${viewport.name} particle coverage`).toBeLessThanOrEqual(bounds.particle.maximum);

    await expectNoPageOverflow(page);
    await expect(page).toHaveScreenshot(`home-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: crossPlatformPixelTolerance[viewport.name],
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
