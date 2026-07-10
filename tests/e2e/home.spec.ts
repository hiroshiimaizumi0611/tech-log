import { expect, test } from '@playwright/test';

const primaryLinks = [
  { name: 'Home', href: '/' },
  { name: '記事', href: '/blog/' },
  { name: 'カテゴリー', href: '/categories/' },
  { name: 'タグ', href: '/tags/' },
  { name: 'プロフィール', href: '/about/' },
] as const;

test('ブランドとランドマークを備えたサイトシェルを表示する', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page).toHaveTitle('テックログ');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'メインナビゲーション' })).toBeVisible();
  await expect(page.locator('main#main-content')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();

  await expect(page.locator('header').getByRole('link', { name: 'テックログ', exact: true })).toBeVisible();
  await expect(page.getByText('つくる、動かす、改善する。', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'テックログ' })).toBeVisible();
  await expect(page.locator('header > .site-header__inner')).toHaveCSS('display', 'flex');
  await expect(page.locator('main .home-intro')).toHaveCSS('min-height', '448px');
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
  await expect(page.getByRole('button', { name: /検索/ })).toHaveCount(0);
});

test('フッターに説明と必須リンクを表示し空のSNSリンクは描画しない', async ({ page }) => {
  await page.goto('/');

  const footer = page.locator('footer');
  await expect(
    footer.getByText('クラウド、バックエンド、フロントエンド、IaC、AI、運用まで。現場で得た技術の実践知を、わかりやすく発信します。', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(footer.getByRole('link', { name: '記事', exact: true })).toHaveAttribute('href', '/blog/');
  await expect(footer.getByRole('link', { name: 'カテゴリー', exact: true })).toHaveAttribute('href', '/categories/');
  await expect(footer.locator('a[href=""]')).toHaveCount(0);
  await expect(footer.getByRole('link', { name: /GitHub|X|Zenn|メール/ })).toHaveCount(0);
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

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(mobileNav).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
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
  });
});
