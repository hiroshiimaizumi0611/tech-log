import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const articleTitles = [
  '2026年版 Astroで技術ブログを構築した',
  'ChatGPT Workとは？Chat・Codexとの違いと使い分け',
  'GPT-5.6 Sol・Terra・Lunaの違い―特徴・料金・選び方',
  'Terraformで手動変更されたリソースを追従する方法',
] as const;

async function expectNoHighImpactAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

test('記事一覧は公開日の降順で公開記事を表示する', async ({ page }) => {
  await page.goto('/blog/');

  await expect(page.getByRole('heading', { level: 1, name: '記事一覧' })).toBeVisible();
  await expect(page.getByText('4件の記事')).toBeVisible();
  const cards = page.locator('main [data-article-card]');
  await expect(cards).toHaveCount(4);
  await expect(cards.getByRole('heading')).toHaveText(articleTitles);
  await expect(page.getByRole('navigation', { name: 'ページネーション' })).toHaveCount(0);
  await expectNoHighImpactAxeViolations(page);
});

test('タグ一覧と詳細は同じルートを使いエンコードを重複させない', async ({ page, request }) => {
  await page.goto('/tags/');

  await expect(page.getByRole('heading', { level: 1, name: 'タグ一覧' })).toBeVisible();
  const tagLinks = page.locator('main [data-tag-index] a');
  expect(await tagLinks.count()).toBeGreaterThan(0);

  const hrefs = await tagLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs.every((href) => href.startsWith('/tags/') && !href.includes('%25'))).toBe(true);

  for (const href of hrefs) {
    expect((await request.get(href)).status(), href).toBe(200);
  }

  const openAiLink = page.locator('main [data-tag-index] a', { hasText: 'OpenAI' });
  await expect(openAiLink).toContainText('2件');
  await openAiLink.click();
  await expect(page.getByRole('heading', { level: 1, name: 'OpenAIの記事' })).toBeVisible();
  await expect(page.locator('main [data-article-card]')).toHaveCount(2);
  await expect(page.locator('main')).not.toContainText('Terraform');
});

test('カテゴリー一覧は0件を含む6種類を表示し、全詳細ルートを生成する', async ({ page, request }) => {
  await page.goto('/categories/');

  await expect(page.getByRole('heading', { level: 1, name: 'カテゴリー一覧' })).toBeVisible();
  const categoryLinks = page.locator('main [data-category-index] a');
  await expect(categoryLinks).toHaveCount(6);
  await expect(categoryLinks.filter({ hasText: 'クラウド / AWS' })).toContainText('0件');
  await expect(categoryLinks.filter({ hasText: 'AI' })).toContainText('2件');

  const hrefs = await categoryLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    expect((await request.get(href)).status(), href).toBe(200);
  }

  await page.goto('/categories/cloud/');
  await expect(page.getByRole('heading', { level: 1, name: 'クラウド / AWSの記事' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('該当する記事はまだありません');
});

test('未知のタグ・カテゴリーと無効な記事ページは404を返す', async ({ request }) => {
  for (const path of ['/tags/not-a-real-tag/', '/categories/not-a-real-category/', '/blog/page/1/', '/blog/page/2/', '/blog/page/0/']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
