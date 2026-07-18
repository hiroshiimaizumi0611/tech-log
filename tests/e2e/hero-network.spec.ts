import { expect, test, type Page } from '@playwright/test';
import { POINTER_RANGE_PX } from '../../src/scripts/hero-network';

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

test('shows the full cursor repulsion range on fine pointers', async ({ page }) => {
  const errors = captureFeatureErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const network = page.locator('[data-hero-network]');
  const pointerRing = network.locator('[data-pointer-ring]');
  const bounds = await network.boundingBox();
  expect(bounds).not.toBeNull();

  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await expect(pointerRing).toHaveClass(/is-visible/);
  await expect.poll(() => pointerRing.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);

  const styles = await pointerRing.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      width: computed.width,
      height: computed.height,
      opacity: computed.opacity,
      pointerEvents: computed.pointerEvents,
    };
  });

  const expectedDiameter = `${POINTER_RANGE_PX * 2}px`;
  expect(styles.width).toBe(expectedDiameter);
  expect(styles.height).toBe(expectedDiameter);
  expect(Number(styles.opacity)).toBeGreaterThan(0);
  expect(styles.pointerEvents).toBe('none');
  expect(errors).toEqual([]);
});

test('resets cursor bounds when the page scrolls', async ({ page }) => {
  const errors = captureFeatureErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const network = page.locator('[data-hero-network]');
  const pointerRing = network.locator('[data-pointer-ring]');
  const initialBounds = await network.boundingBox();
  expect(initialBounds).not.toBeNull();

  const initialPointer = {
    x: initialBounds!.x + initialBounds!.width / 2,
    y: initialBounds!.y + initialBounds!.height / 2,
  };
  await page.mouse.move(initialPointer.x, initialPointer.y);
  await expect(pointerRing).toHaveClass(/is-visible/);

  const initialRing = await pointerRing.boundingBox();
  expect(initialRing).not.toBeNull();
  expect(Math.abs(initialRing!.x + initialRing!.width / 2 - initialPointer.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(initialRing!.y + initialRing!.height / 2 - initialPointer.y)).toBeLessThanOrEqual(2);

  await page.evaluate(() => window.scrollTo(0, 100));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(100);
  await expect(pointerRing).not.toHaveClass(/is-visible/);

  const scrolledBounds = await network.boundingBox();
  expect(scrolledBounds).not.toBeNull();
  expect(scrolledBounds!.y).toBeLessThan(900);
  expect(scrolledBounds!.y + scrolledBounds!.height).toBeGreaterThan(0);

  const movedPointer = {
    x: scrolledBounds!.x + scrolledBounds!.width / 2 + 1,
    y: scrolledBounds!.y + scrolledBounds!.height / 2 + 1,
  };
  await page.mouse.move(movedPointer.x, movedPointer.y);
  await expect(pointerRing).toHaveClass(/is-visible/);

  const movedRing = await pointerRing.boundingBox();
  expect(movedRing).not.toBeNull();
  expect(Math.abs(movedRing!.x + movedRing!.width / 2 - movedPointer.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(movedRing!.y + movedRing!.height / 2 - movedPointer.y)).toBeLessThanOrEqual(2);
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

  await expect(page).toHaveURL(/\/blog\/aws-cloudfront-vpc-origin-outage-2026-07-16\/$/);
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
