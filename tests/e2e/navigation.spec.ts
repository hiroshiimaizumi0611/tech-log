import { expect, test, type Locator, type Page } from '@playwright/test';

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

async function tabFromDocumentStartTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  const tabCount = await target.evaluate((targetElement, selector) => {
    const candidates = [...document.querySelectorAll<HTMLElement>(selector)].filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    });
    return candidates.indexOf(targetElement as HTMLElement) + 1;
  }, focusableSelector);
  expect(tabCount, 'target must participate in the sequential focus order').toBeGreaterThan(0);
  for (let index = 0; index < tabCount; index += 1) await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}

async function expectVisibleFocus(target: Locator) {
  const focusStyle = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth), boxShadow: style.boxShadow };
  });
  expect(focusStyle.outlineStyle !== 'none' || focusStyle.outlineWidth > 0 || focusStyle.boxShadow !== 'none').toBe(true);
}

test('skip linkをTabとEnterで本文へ移動する', async ({ page }) => {
  await page.goto('/');
  const skipLink = page.getByRole('link', { name: '本文へスキップ' });
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await expectVisibleFocus(skipLink);
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('desktop Header navとFooterをTabとEnterで利用する', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const articlesLink = page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('link', { name: '記事' });
  await tabFromDocumentStartTo(page, articlesLink);
  await expectVisibleFocus(articlesLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/blog\/$/);

  await page.goto('/');
  const footerPrivacy = page.getByRole('navigation', { name: 'フッターナビゲーション' }).getByRole('link', { name: 'Privacy' });
  await tabFromDocumentStartTo(page, footerPrivacy);
  await expectVisibleFocus(footerPrivacy);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/privacy\/$/);
});

test('mobile menuをSpaceで開き、Tabで移動し、Escapeでtriggerへ戻す', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.locator('[data-mobile-menu-trigger]');
  await expect(trigger).toHaveAccessibleName('メニューを開く');
  await tabFromDocumentStartTo(page, trigger);
  await expectVisibleFocus(trigger);
  await page.keyboard.press('Space');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const mobileNav = page.getByRole('navigation', { name: 'モバイルナビゲーション' });
  const homeLink = mobileNav.getByRole('link', { name: 'Home' });
  await page.keyboard.press('Tab');
  await expect(homeLink).toBeFocused();
  await expectVisibleFocus(homeLink);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const articlesLink = mobileNav.getByRole('link', { name: '記事' });
  await expect(articlesLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/blog\/$/);
});

test('search modalをEnterで開き、inputへfocusし、Escapeでtriggerへ戻す', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '検索を開く' });
  await tabFromDocumentStartTo(page, trigger);
  await page.keyboard.press('Enter');
  const input = page.getByRole('searchbox', { name: '記事を検索' });
  await expect(input).toBeFocused();
  await expectVisibleFocus(input);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('article desktop/mobile TOCをTab、Space、Enterで利用する', async ({ page }) => {
  const articlePath = '/blog/build-tech-blog-with-astro-2026/';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(articlePath);
  const desktopLink = page.locator('[data-desktop-toc] a').first();
  const desktopHref = await desktopLink.getAttribute('href');
  await tabFromDocumentStartTo(page, desktopLink);
  await expectVisibleFocus(desktopLink);
  await page.keyboard.press('Enter');
  await expect.poll(() => decodeURIComponent(page.url())).toMatch(new RegExp(`${desktopHref}$`));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);
  const summary = page.locator('[data-mobile-toc] summary');
  await tabFromDocumentStartTo(page, summary);
  await expectVisibleFocus(summary);
  await page.keyboard.press('Space');
  await expect(page.locator('[data-mobile-toc]')).toHaveAttribute('open', '');
  const mobileLink = page.locator('[data-mobile-toc] a').first();
  await page.keyboard.press('Tab');
  await expect(mobileLink).toBeFocused();
  await expectVisibleFocus(mobileLink);
  const mobileHref = await mobileLink.getAttribute('href');
  await page.keyboard.press('Enter');
  await expect.poll(() => decodeURIComponent(page.url())).toMatch(new RegExp(`${mobileHref}$`));
});

test('code copyへTabで到達しEnterで実行する', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
  });
  await page.goto('/blog/build-tech-blog-with-astro-2026/');
  const copyButton = page.locator('[data-code-copy]').first();
  await tabFromDocumentStartTo(page, copyButton);
  await expectVisibleFocus(copyButton);
  await page.keyboard.press('Enter');
  await expect(copyButton).toHaveText('コピーしました');
});

test('実Pagination componentの表示条件、focus、href、Enter遷移を検証する', async ({ page }) => {
  await page.goto('http://127.0.0.1:4322/');
  const paginations = page.getByRole('navigation', { name: 'ページネーション' });
  await expect(paginations).toHaveCount(2);
  await expect(page.locator('[data-pagination-state="single"]')).not.toContainText('ページ');

  const firstPage = page.locator('[data-pagination-state="first"]');
  await expect(firstPage.getByRole('link', { name: /前のページ/ })).toHaveCount(0);
  const nextLink = firstPage.getByRole('link', { name: '次のページ →' });
  await expect(nextLink).toHaveAttribute('href', 'http://127.0.0.1:4321/blog/');
  await expect(nextLink).toHaveAttribute('rel', 'next');

  const lastPage = page.locator('[data-pagination-state="last"]');
  const previousLink = lastPage.getByRole('link', { name: '← 前のページ' });
  await expect(previousLink).toHaveAttribute('href', 'http://127.0.0.1:4321/tags/');
  await expect(previousLink).toHaveAttribute('rel', 'prev');
  await expect(lastPage.getByRole('link', { name: /次のページ/ })).toHaveCount(0);

  await tabFromDocumentStartTo(page, nextLink);
  await expectVisibleFocus(nextLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/blog\/$/);
});
