import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const articlePath = '/blog/aws-cloudfront-vpc-origin-outage-2026-07-16/';
const articleTitle = '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理';
const articleDescription =
  '2026年7月16日に発生したAWS CloudFrontのVPC Origins障害について、影響範囲と原因、VPCオリジンの仕組み、読み取り系と更新系に分けた回避策を公式情報から整理します。';
const articleHeadings = [
  '2026年7月16日のCloudFront障害で何が起きたか',
  '影響を受けた構成・受けなかった構成',
  'そもそもCloudFrontのVPCオリジンとは',
  '障害の原因をリクエスト経路から理解する',
  'AWSが案内した暫定回避策',
  '読み取り系リクエストをOrigin Groupで備える',
  'POST・PUTを含むAPIは手動切り替えを準備する',
  '障害発生時の確認・切り替え手順',
  '復旧後に元へ戻すときの確認事項',
  'VPCオリジンをやめるべきか',
] as const;
const imageAlts = [
  'CloudFrontからVPCオリジンへ接続する経路と2026年7月16日の障害箇所',
  '読み取り系の自動フェイルオーバー候補と更新系APIの手動切り替え構成',
] as const;
const imageCaptions = ['図1：CloudFrontからVPCオリジンへ到達する概念的な経路', '図2：読み取り系と更新系を分けた二層の切り替え'] as const;

test('CloudFront VPC Origins障害記事のSEO、構成、図を公開する', async ({ page }) => {
  await page.goto(articlePath);

  await expect(page).toHaveTitle(`${articleTitle} | テックログ`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', articleDescription);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog\/aws-cloudfront-vpc-origin-outage-2026-07-16\/$/);
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const imageUrl = await page.locator(selector).getAttribute('content');
    expect(imageUrl).not.toBeNull();
    if (imageUrl === null) throw new Error(`${selector} must have a content attribute`);
    expect(new URL(imageUrl).pathname).toBe('/og-default.png');
  }

  const article = page.locator('article[data-pagefind-body]');
  const body = article.locator('[data-article-body]');
  await expect(article.getByRole('heading', { level: 1, name: articleTitle })).toBeVisible();
  await expect(article.locator('[data-pagefind-filter="category"]')).toHaveText('Infrastructure');
  await expect(article.locator('[data-pagefind-filter="tag"]')).toHaveText(['AWS', 'CloudFront', 'VPC', '障害対応']);
  await expect(article.getByText('公開日 2026年7月17日', { exact: true })).toBeVisible();
  await expect(body.getByRole('heading', { level: 2 })).toHaveText(articleHeadings);
  await expect(body.locator('img')).toHaveCount(2);
  expect(await body.locator('img').evaluateAll((images) => images.map((image) => image.getAttribute('alt')))).toEqual(imageAlts);
  const captions = body.locator('p > em:only-child').filter({ hasText: /^図[12]：/ });
  await expect(captions).toHaveCount(2);
  await expect(captions).toHaveText(imageCaptions);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('CloudFront VPC Origins障害記事を390pxで図をはみ出さず表示する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);

  const body = page.locator('[data-article-body]');
  const images = body.locator('img');
  await expect(body).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    await expect(image).toBeVisible();
    expect(await image.evaluate((element) => element.clientWidth <= (element.closest('[data-article-body]')?.clientWidth ?? 0))).toBe(true);
  }
});
