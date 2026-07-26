import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const articleTitles = [
  'Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説',
  'Kimi K3とは？2.8兆パラメータの新AIモデルを公式情報とベンチマークから解説',
  '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理',
  'HTTP QUERYメソッドとは？GET・POSTとの違いとcurlでの試し方',
  'ChatGPT Sitesの使い方｜実際にWebサイトを作って限定公開するまで',
  'ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方',
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
  await expect(page.getByText('10件の記事')).toBeVisible();
  const cards = page.locator('main [data-article-card]');
  await expect(cards).toHaveCount(10);
  await expect(cards.getByRole('heading')).toHaveText(articleTitles);
  await expect(page.getByRole('navigation', { name: 'ページネーション' })).toHaveCount(0);
  await expectNoHighImpactAxeViolations(page);
});

test('タグ一覧の全リンクが共有ルートの詳細へ解決される', async ({ page, request }) => {
  await page.goto('/tags/');

  await expect(page).toHaveTitle('タグ一覧 | テックログ');
  await expect(page.getByRole('heading', { level: 1, name: 'タグ一覧' })).toBeVisible();
  const tagLinks = page.locator('main [data-tag-index] a');
  expect(await tagLinks.count()).toBeGreaterThan(0);

  const hrefs = await tagLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs.every((href) => href.startsWith('/tags/'))).toBe(true);

  for (const href of hrefs) {
    expect((await request.get(href)).status(), href).toBe(200);
  }

  const openAiLink = page.locator('main [data-tag-index] a', { hasText: 'OpenAI' });
  await expect(openAiLink).toContainText('4件');
  await openAiLink.click();
  await expect(page.getByRole('heading', { level: 1, name: 'OpenAIの記事' })).toBeVisible();
  await expect(page.locator('main [data-article-card]')).toHaveCount(4);
  await expect(page.locator('main')).not.toContainText('Terraform');

  await page.goto('/tags/');
  const awsLink = page.locator('main [data-tag-index] a', { hasText: 'AWS' });
  await expect(awsLink).toContainText('2件');
  await page.goto('/tags/aws/');
  await expect(page.getByRole('heading', { level: 1, name: 'AWSの記事' })).toBeVisible();
  await expect(page.locator('main [data-article-card]').getByRole('heading')).toHaveText([
    '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理',
    'Terraformで手動変更されたリソースを追従する方法',
  ]);

  await page.goto('/tags/ai/');
  await expect(page).toHaveTitle('AIタグの記事一覧 | テックログ');
  await expect(page.getByRole('heading', { level: 1, name: 'AIの記事' })).toBeVisible();
});

test('カテゴリー一覧は0件を含む6種類を表示し、全詳細ルートを生成する', async ({ page, request }) => {
  await page.goto('/categories/');

  await expect(page).toHaveTitle('カテゴリー一覧 | テックログ');
  await expect(page.getByRole('heading', { level: 1, name: 'カテゴリー一覧' })).toBeVisible();
  const categoryLinks = page.locator('main [data-category-index] a');
  await expect(categoryLinks).toHaveCount(6);
  await expect(categoryLinks.filter({ hasText: 'クラウド / AWS' })).toContainText('0件');
  await expect(categoryLinks.filter({ hasText: 'インフラ / IaC' })).toContainText('2件');
  await expect(categoryLinks.filter({ hasText: 'AI' })).toContainText('6件');

  const hrefs = await categoryLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    expect((await request.get(href)).status(), href).toBe(200);
  }

  await page.goto('/categories/cloud/');
  await expect(page.getByRole('heading', { level: 1, name: 'クラウド / AWSの記事' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('該当する記事はまだありません');
  await expect(page.getByRole('status').getByRole('link', { name: 'カテゴリー一覧へ戻る' })).toHaveAttribute('href', '/categories/');

  await page.goto('/categories/infrastructure/');
  await expect(page.getByRole('heading', { level: 1, name: 'インフラ / IaCの記事' })).toBeVisible();
  await expect(page.locator('main [data-article-card]').getByRole('heading')).toHaveText([
    '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理',
    'Terraformで手動変更されたリソースを追従する方法',
  ]);

  await page.goto('/categories/ai/');
  await expect(page).toHaveTitle('AIカテゴリーの記事一覧 | テックログ');
  await expect(page.getByRole('heading', { level: 1, name: 'AIの記事' })).toBeVisible();
});

test('カテゴリーとタグのSEOタイトルはサイト名を一度だけ含み、用途を区別する', async ({ request }) => {
  const paths = ['/categories/', '/tags/', '/categories/ai/', '/tags/ai/'] as const;
  const titles = await Promise.all(
    paths.map(async (path) => {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      return (await response.text()).match(/<title>([^<]+)<\/title>/)?.[1];
    }),
  );

  expect(titles).toEqual([
    'カテゴリー一覧 | テックログ',
    'タグ一覧 | テックログ',
    'AIカテゴリーの記事一覧 | テックログ',
    'AIタグの記事一覧 | テックログ',
  ]);
});

test('未知のタグ・カテゴリーと無効な記事ページは404を返す', async ({ request }) => {
  for (const path of ['/tags/not-a-real-tag/', '/categories/not-a-real-category/', '/blog/page/1/', '/blog/page/999/', '/blog/page/0/']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
