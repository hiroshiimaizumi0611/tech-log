import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { access, readFile } from 'node:fs/promises';

const pagefindRequest = (url: string) => /\/pagefind\/pagefind\.js(?:\?|$)/.test(url);

test('Pagefindの成果物と日本語インデックスを生成する', async () => {
  await expect(access(new URL('../../dist/pagefind/pagefind.js', import.meta.url))).resolves.toBeUndefined();
  const entryUrl = new URL('../../dist/pagefind/pagefind-entry.json', import.meta.url);
  const entry = JSON.parse(await readFile(entryUrl, 'utf8')) as { languages?: Record<string, { hash?: string; page_count?: number }> };
  expect(entry.languages?.ja?.page_count).toBeGreaterThan(0);
  await expect(
    access(new URL(`../../dist/pagefind/pagefind.${entry.languages?.ja?.hash}.pf_meta`, import.meta.url)),
  ).resolves.toBeUndefined();
});

test('初期表示ではPagefindを取得せず最初の検索操作でだけ読み込む', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (pagefindRequest(request.url())) requests.push(request.url());
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual([]);
  await expect(page.locator('link[href*="/pagefind/"], script[src*="/pagefind/"], link[rel="preload"][href*="/pagefind/"]')).toHaveCount(0);

  await page.getByRole('button', { name: '検索を開く' }).click();
  await expect.poll(() => requests.length).toBe(1);

  await page.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('button', { name: '検索を開く' }).click();
  expect(requests).toHaveLength(1);
});

test('native dialogを開いて入力へfocusし、Escapeで閉じてtriggerへ戻す', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '検索を開く' });
  const dialog = page.getByRole('dialog', { name: 'サイト内検索' });

  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty('open', true);
  await expect(dialog.getByRole('searchbox', { name: '記事を検索' })).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('開いた検索モーダルに重大なアクセシビリティ違反がない', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '検索を開く' }).click();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('Astro・Frontend・TypeScriptの記事を検索して結果へ移動できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '検索を開く' }).click();
  const input = page.getByRole('searchbox', { name: '記事を検索' });
  const results = page.locator('[data-search-results]');

  for (const query of ['Astro', 'Frontend', 'TypeScript']) {
    await input.fill(query);
    await expect(page.locator('[data-search-summary]')).toContainText(/件/);
    await expect(results.getByRole('link').first()).toBeVisible();
    await expect(results).toContainText(new RegExp(query, 'i'));
  }
});

test('close buttonとbackdrop clickで閉じ、focusをtriggerへ戻す', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '検索を開く' });
  const dialog = page.getByRole('dialog', { name: 'サイト内検索' });

  await trigger.click();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Pagefindの読み込み失敗時も記事一覧への導線と通常ページを維持する', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.abort('failed'));
  await page.goto('/');
  await page.getByRole('button', { name: '検索を開く' }).click();

  const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
  await expect(dialog.locator('.search-dialog__error')).toContainText('検索を読み込めませんでした');
  await expect(dialog.getByRole('link', { name: '記事一覧を見る' })).toHaveAttribute('href', '/blog/');
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'テックログ' })).toBeVisible();
});
