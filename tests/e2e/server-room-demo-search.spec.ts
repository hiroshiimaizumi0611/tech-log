import { expect, test } from '@playwright/test';

for (const { label, query } of [
  { label: 'title', query: '"3Dサーバールーム監視ダッシュボード"' },
  { label: 'body', query: '"実際の監視APIには接続していません"' },
  { label: 'URL', query: '"/demos/server-room/"' },
]) {
  test(`公開デモの${label}をサイト内検索へ含めない`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '検索を開く' }).click();
    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });

    await dialog.getByRole('searchbox', { name: '記事を検索' }).fill(query);

    await expect(dialog.locator('[data-search-summary]')).toHaveText('0件の結果');
    await expect(dialog.locator('[data-search-results]')).toContainText('該当する記事はありません');
    await expect(dialog.locator('a[href="/demos/server-room/"]')).toHaveCount(0);
  });
}
