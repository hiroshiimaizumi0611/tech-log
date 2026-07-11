import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { access, readFile } from 'node:fs/promises';

const pagefindRequest = (url: string) => /\/pagefind\/pagefind\.js(?:\?|$)/.test(url);
const fakeResultModule = `
globalThis.__fakeSearchEvents = [];
export const init = async () => {};
export const search = async (query) => {
  globalThis.__fakeSearchEvents.push(query + ':start');
  if (query === 'closed') await new Promise((resolve) => { globalThis.__releaseClosedSearch = resolve; });
  if (query === 'old') await new Promise((resolve) => { globalThis.__releaseOldSearch = resolve; });
  globalThis.__fakeSearchEvents.push(query + ':end');
  return {
    results: [{
      data: async () => ({
        url: '/blog/build-tech-blog-with-astro-2026/',
        plain_excerpt: query + ' excerpt',
        meta: { title: query + ' result' },
      }),
    }],
  };
};
`;

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

  await input.fill('Astro');
  const astroResult = results.getByRole('link', { name: /2026年版 Astroで技術ブログを構築した/ });
  await expect(astroResult).toHaveAttribute('href', '/blog/build-tech-blog-with-astro-2026/');
  await astroResult.click();
  await expect(page).toHaveURL(/\/blog\/build-tech-blog-with-astro-2026\/$/);
  await expect(page.getByRole('heading', { level: 1, name: '2026年版 Astroで技術ブログを構築した' })).toBeVisible();
});

test('close後に完了した検索を破棄し再open時に古い結果を表示しない', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fakeResultModule }));
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '検索を開く' });
  const dialog = page.getByRole('dialog', { name: 'サイト内検索' });

  await trigger.click();
  await dialog.getByRole('searchbox', { name: '記事を検索' }).fill('closed');
  await expect
    .poll(() => page.evaluate(() => (globalThis as { __fakeSearchEvents?: string[] }).__fakeSearchEvents ?? []))
    .toContain('closed:start');
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await page.evaluate(() => (globalThis as { __releaseClosedSearch?: () => void }).__releaseClosedSearch?.());
  await expect
    .poll(() => page.evaluate(() => (globalThis as { __fakeSearchEvents?: string[] }).__fakeSearchEvents ?? []))
    .toContain('closed:end');
  await trigger.click();

  await expect(dialog.getByRole('link', { name: 'closed result' })).toHaveCount(0);
});

test('新入力時点で進行中の旧検索を無効化して結果の上書きを防ぐ', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fakeResultModule }));
  await page.goto('/');
  await page.getByRole('button', { name: '検索を開く' }).click();
  const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
  const input = dialog.getByRole('searchbox', { name: '記事を検索' });

  await input.fill('old');
  await expect
    .poll(() => page.evaluate(() => (globalThis as { __fakeSearchEvents?: string[] }).__fakeSearchEvents ?? []))
    .toContain('old:start');
  await input.fill('new');
  await page.evaluate(() => (globalThis as { __releaseOldSearch?: () => void }).__releaseOldSearch?.());
  await expect
    .poll(() => page.evaluate(() => (globalThis as { __fakeSearchEvents?: string[] }).__fakeSearchEvents ?? []))
    .toContain('old:end');
  await page.waitForTimeout(20);
  expect(await dialog.getByRole('link', { name: 'old result' }).count()).toBe(0);
  await expect(dialog.getByRole('link', { name: 'new result' })).toBeVisible();
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

for (const failure of ['import', 'init', 'search', 'data'] as const) {
  test(`Pagefindの${failure}失敗時も通知と記事一覧導線と通常ページを維持する`, async ({ page }) => {
    await page.route('**/pagefind/pagefind.js', (route) => {
      if (failure === 'import') return route.abort('failed');
      const init = failure === 'init' ? `throw new Error('init failed')` : '';
      const search = failure === 'search' ? `throw new Error('search failed')` : '';
      const data = failure === 'data' ? `throw new Error('data failed')` : `return { url: '/blog/', meta: { title: 'result' } }`;
      return route.fulfill({
        contentType: 'text/javascript',
        body: `
          export const init = async () => { ${init} };
          export const search = async () => {
            ${search}
            return { results: [{ data: async () => { ${data} } }] };
          };
        `,
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '検索を開く' }).click();

    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
    if (failure === 'search' || failure === 'data') await dialog.getByRole('searchbox', { name: '記事を検索' }).fill('failure');
    const liveSummary = dialog.locator('[data-search-summary]');
    await expect(liveSummary).toHaveAttribute('aria-live', 'polite');
    await expect(liveSummary).toHaveText('検索を読み込めませんでした');
    await expect(dialog.getByRole('link', { name: '記事一覧を見る' })).toHaveAttribute('href', '/blog/');
    await dialog.getByRole('button', { name: '閉じる' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'テックログ' })).toBeVisible();
  });
}
