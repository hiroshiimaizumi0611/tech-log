import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const primaryLinks = [
  { name: 'Home', href: '/' },
  { name: '記事', href: '/blog/' },
  { name: 'カテゴリー', href: '/categories/' },
  { name: 'タグ', href: '/tags/' },
  { name: 'プロフィール', href: '/about/' },
] as const;

const expectNoHighImpactAxeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const highImpactViolations = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');

  expect(highImpactViolations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }))).toEqual([]);
};

test('ブランドとランドマークを備えたサイトシェルを表示する', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page).toHaveTitle('テックログ');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'メインナビゲーション' })).toBeVisible();
  await expect(page.locator('main#main-content')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();

  await expect(page.locator('header').getByRole('link', { name: 'テックログ', exact: true })).toBeVisible();
  await expect(page.locator('header').getByText('つくる、動かす、改善する。', { exact: true })).toBeVisible();
  const heading = page.getByRole('heading', { level: 1, name: 'テックログ' });
  await expect(heading).toBeVisible();

  const headerBox = await page.locator('header').boundingBox();
  const headingBox = await heading.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(headingBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
});

test('デスクトップのサイトシェルに重大なアクセシビリティ違反がない', async ({ page }) => {
  await page.goto('/');
  await expectNoHighImpactAxeViolations(page);
});

test('スキップリンクが最初のフォーカス先で本文へ移動する', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: '本文へスキップ' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveAttribute('href', '#main-content');
});

test('デスクトップナビゲーションに主要リンクだけを表示する', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
  for (const link of primaryLinks) {
    await expect(nav.getByRole('link', { name: link.name, exact: true })).toHaveAttribute('href', link.href);
  }

  await expect(page.getByRole('button', { name: /テーマ/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '検索を開く' })).toHaveCount(1);
});

test('フッターに説明、公開連絡先、必須リンクを表示し未設定SNSは描画しない', async ({ page }) => {
  await page.goto('/');

  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'テックログ', exact: true })).toHaveAttribute('href', '/');
  await expect(
    footer.getByText('クラウド、バックエンド、フロントエンド、IaC、AI、運用まで。現場で得た技術の実践知を、わかりやすく発信します。', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(footer.getByRole('link', { name: '記事', exact: true })).toHaveAttribute('href', '/blog/');
  await expect(footer.getByRole('link', { name: 'カテゴリー', exact: true })).toHaveAttribute('href', '/categories/');
  await expect(footer.getByRole('navigation', { name: 'カテゴリーナビゲーション' }).getByRole('link')).toHaveCount(6);
  await expect(footer.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', '/privacy/');
  await expect(footer.getByRole('link', { name: 'RSS', exact: true })).toHaveAttribute('href', '/rss.xml');
  await expect(footer.getByText(`© ${new Date().getFullYear()} Hiroshi Imaizumi`, { exact: true })).toBeVisible();
  await expect(footer.locator('a[href=""]')).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/hiroshiimaizumi0611');
  await expect(footer.getByRole('link', { name: 'メール', exact: true })).toHaveAttribute('href', 'mailto:hiroshiimaizumi0611@gmail.com');
  await expect(footer.getByRole('link', { name: /X|Zenn/ })).toHaveCount(0);
});

test('モバイルメニューを開閉しフォーカスとスクロールを復元する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const trigger = page.locator('[data-mobile-menu-trigger]');
  const desktopNav = page.getByRole('navigation', { name: 'メインナビゲーション' });
  const mobileNav = page.getByRole('navigation', { name: 'モバイルナビゲーション' });

  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName('メニューを開く');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(desktopNav).toBeHidden();
  await expect(mobileNav).toBeHidden();

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(mobileNav).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  for (const link of primaryLinks) {
    await expect(mobileNav.getByRole('link', { name: link.name, exact: true })).toHaveAttribute('href', link.href);
  }

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(mobileNav).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(mobileNav).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(mobileNav).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('開いたモバイルメニューに重大なアクセシビリティ違反がない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('[data-mobile-menu-trigger]').click();

  await expect(page.getByRole('navigation', { name: 'モバイルナビゲーション' })).toBeVisible();
  await expectNoHighImpactAxeViolations(page);
});

test('開いたメニューのままデスクトップ幅になると表示中のヘッダー要素へフォーカスを移す', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const trigger = page.locator('[data-mobile-menu-trigger]');
  const mobileNav = page.getByRole('navigation', { name: 'モバイルナビゲーション' });
  const brand = page.locator('header').getByRole('link', { name: 'テックログ', exact: true });

  await trigger.click();
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 900, height: 844 });

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeHidden();
  await expect(mobileNav).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(brand).toBeFocused();
});

test('デスクトップ幅への変更時にメニュー外のフォーカスを保つ', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const trigger = page.locator('[data-mobile-menu-trigger]');
  const main = page.locator('main#main-content');
  await trigger.click();
  await main.focus();
  await expect(main).toBeFocused();

  await page.setViewportSize({ width: 900, height: 844 });

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(main).toBeFocused();
});

test.describe('JavaScriptが無効な場合', () => {
  test.use({ javaScriptEnabled: false });

  test('モバイルナビゲーションのリンクを通常のリンクとして表示する', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const trigger = page.locator('[data-mobile-menu-trigger]');
    const mobileNav = page.getByRole('navigation', { name: 'モバイルナビゲーション' });

    await expect(trigger).toBeHidden();
    await expect(mobileNav).toBeVisible();

    for (const link of primaryLinks) {
      await expect(mobileNav.getByRole('link', { name: link.name, exact: true })).toHaveAttribute('href', link.href);
    }

    const heading = page.getByRole('heading', { level: 1, name: 'テックログ' });
    const navBox = await mobileNav.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(navBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(headingBox!.y);
    await expect(heading).toBeVisible();
    await expect(
      heading.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return hit === element || element.contains(hit);
      }),
    ).resolves.toBe(true);
  });

  test('モバイルのフォールバックをキーボードで利用できる', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const mobileNav = page.getByRole('navigation', { name: 'モバイルナビゲーション' });
    const firstLink = mobileNav.getByRole('link', { name: 'Home', exact: true });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '本文へスキップ' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('header').getByRole('link', { name: 'テックログ', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(firstLink).toBeFocused();
    await expect(firstLink).toBeVisible();
  });
});
