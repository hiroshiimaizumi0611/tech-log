import { expect, test, type Page } from '@playwright/test';

function captureFeatureErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  return errors;
}

async function instrumentAnimationFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const instrumentedWindow = window as Window & { __heroRafScheduled?: number };
    const requestAnimationFrame = window.requestAnimationFrame.bind(window);
    instrumentedWindow.__heroRafScheduled = 0;
    window.requestAnimationFrame = (callback) => {
      instrumentedWindow.__heroRafScheduled = (instrumentedWindow.__heroRafScheduled ?? 0) + 1;
      return requestAnimationFrame(callback);
    };
  });
}

async function animationFrameScheduleCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as Window & { __heroRafScheduled?: number }).__heroRafScheduled ?? 0);
}

test('renders a decorative, non-interactive canvas network', async ({ page }) => {
  const errors = captureFeatureErrors(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const network = page.locator('[data-hero-network]');
  await expect(network).toBeVisible();
  await expect(network.locator('[data-network-fallback]')).toBeAttached();
  await expect(network.locator('canvas[aria-hidden="true"]')).toBeAttached();
  await expect(network).toHaveAttribute('data-network-state', 'running');

  const styles = await network.evaluate((element) => {
    const rootStyles = getComputedStyle(element);
    const canvasStyles = getComputedStyle(element.querySelector('canvas')!);
    const ringStyles = getComputedStyle(element.querySelector('[data-pointer-ring]')!);

    return {
      canvasPointerEvents: canvasStyles.pointerEvents,
      ringPointerEvents: ringStyles.pointerEvents,
      touchAction: rootStyles.touchAction,
    };
  });

  expect(styles).toEqual({
    canvasPointerEvents: 'none',
    ringPointerEvents: 'none',
    touchAction: 'pan-y',
  });

  const touchMovePrevented = await network.evaluate((element) => {
    const event = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(touchMovePrevented).toBe(false);

  const repeatedStateMutations = await network.evaluate(async (element) => {
    let mutationCount = 0;
    const observer = new MutationObserver((mutations) => {
      mutationCount += mutations.length;
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['data-network-rendered', 'data-network-frame'],
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    observer.disconnect();
    return mutationCount;
  });

  expect(repeatedStateMutations).toBe(0);
  expect(errors).toEqual([]);
});

test('navigates through the Featured link while the network is active', async ({ page }) => {
  const errors = captureFeatureErrors(page);

  await page.goto('/');
  await expect(page.locator('[data-hero-network]')).toHaveAttribute('data-network-state', 'running');

  await page
    .locator('.featured')
    .getByRole('link', { name: /記事を読む/ })
    .click();

  await expect(page).toHaveURL(/\/blog\/chatgpt-codex-plugins-guide\/$/);
  expect(errors).toEqual([]);
});

test('pauses the network while the hero is offscreen', async ({ page }) => {
  const errors = captureFeatureErrors(page);

  await page.goto('/');

  const network = page.locator('[data-hero-network]');
  await expect(network).toHaveAttribute('data-network-state', 'running');

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  await expect(network).toHaveAttribute('data-network-state', 'paused');

  await network.scrollIntoViewIfNeeded();

  await expect(network).toHaveAttribute('data-network-state', 'running');
  expect(errors).toEqual([]);
});

test('classifies particle density from the viewport width', async ({ page }) => {
  const errors = captureFeatureErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/');

  const network = page.locator('[data-hero-network]');
  await expect(network).toHaveAttribute('data-particle-count', '72');

  await page.setViewportSize({ width: 1023, height: 900 });

  await expect(network).toHaveAttribute('data-particle-count', '36');
  expect(errors).toEqual([]);
});

test('draws a static radial frame without scheduling animation when reduced motion is requested', async ({ page }) => {
  const errors = captureFeatureErrors(page);
  await instrumentAnimationFrames(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/');

  const network = page.locator('[data-hero-network]');
  await expect(network).toHaveAttribute('data-network-state', 'static');
  await expect(network).toHaveAttribute('data-network-frame', 'radial');

  const scheduledFrames = await animationFrameScheduleCount(page);
  await page.waitForTimeout(150);
  expect(await animationFrameScheduleCount(page)).toBe(scheduledFrames);
  expect(errors).toEqual([]);
});

test('stops scheduling frames when reduced motion is enabled while running', async ({ page }) => {
  const errors = captureFeatureErrors(page);
  await instrumentAnimationFrames(page);

  await page.goto('/');

  const network = page.locator('[data-hero-network]');
  await expect(network).toHaveAttribute('data-network-state', 'running');
  await expect.poll(() => animationFrameScheduleCount(page)).toBeGreaterThan(1);

  await page.emulateMedia({ reducedMotion: 'reduce' });

  await expect(network).toHaveAttribute('data-network-state', 'static');
  const scheduledFrames = await animationFrameScheduleCount(page);
  await page.waitForTimeout(150);
  expect(await animationFrameScheduleCount(page)).toBe(scheduledFrames);
  expect(errors).toEqual([]);
});
