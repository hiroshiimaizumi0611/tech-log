import { expect, test } from '@playwright/test';
test('トップにブランド名と日本語langがある', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page).toHaveTitle(/テックログ/);
  await expect(page.getByRole('heading', { level: 1, name: 'テックログ' })).toBeVisible();
});
