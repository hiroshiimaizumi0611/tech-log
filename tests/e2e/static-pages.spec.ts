import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const beaconSrc = 'https://static.cloudflareinsights.com/beacon.min.js';

test('About、Privacy、404に必要な内容と復帰導線がある', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByRole('heading', { level: 1, name: 'このブログについて' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '得意分野' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '技術スタック' })).toBeVisible();
  const aboutMain = page.locator('#main-content');
  await expect(aboutMain.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/hiroshiimaizumi0611',
  );
  await expect(aboutMain.getByRole('link', { name: 'メールで問い合わせる' })).toHaveAttribute(
    'href',
    'mailto:hiroshiimaizumi0611@gmail.com',
  );

  await page.goto('/privacy/');
  await expect(page.getByRole('heading', { level: 1, name: 'プライバシーポリシー' })).toBeVisible();
  await expect(page.getByText('Cloudflare Web Analytics', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cookie、広告、データベース' })).toBeVisible();

  const response = await page.goto('/missing-page-for-404/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'ページが見つかりません' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ホームへ戻る' })).toHaveAttribute('href', '/');
});

test('canonical、OGP、Twitter Card、favicon、JSON-LDを出力する', async ({ page }) => {
  await page.goto('/');
  const homeData = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(homeData).toMatchObject({
    '@type': 'Blog',
    '@id': 'https://example.invalid/#blog',
    author: { '@id': 'https://example.invalid/#person' },
  });

  await page.goto('/privacy/');
  const privacyData = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(privacyData).toMatchObject({
    '@type': 'WebPage',
    '@id': 'https://example.invalid/privacy/#webpage',
    isPartOf: { '@id': 'https://example.invalid/#blog' },
  });

  await page.goto('/blog/build-tech-blog-with-astro-2026/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://example.invalid/blog/build-tech-blog-with-astro-2026/',
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://example.invalid/og-default.png');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');

  const structuredData = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(structuredData).toMatchObject({
    '@type': 'BlogPosting',
    '@id': 'https://example.invalid/blog/build-tech-blog-with-astro-2026/#article',
    author: { '@id': 'https://example.invalid/#person' },
    isPartOf: { '@id': 'https://example.invalid/#blog' },
  });
});

test('RSS、sitemap、robotsは公開記事だけを案内する', async ({ request }) => {
  const rss = await request.get('/rss.xml');
  expect(rss.ok()).toBe(true);
  const rssBody = await rss.text();
  expect(rssBody).toContain('<rss');
  expect(rssBody).toContain('build-tech-blog-with-astro-2026');
  expect(rssBody).not.toContain('draft-article');

  const sitemap = await request.get('/sitemap-index.xml');
  expect(sitemap.ok()).toBe(true);
  const index = await sitemap.text();
  expect(index).toContain('sitemap-0.xml');
  const pageMap = await request.get('/sitemap-0.xml');
  expect(await pageMap.text()).not.toContain('draft-article');

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Allow: /');
  await expect(readFile(new URL('../../public/favicon.svg', import.meta.url), 'utf8')).resolves.toContain('<svg');
});

test('Analytics beaconはproductionかつtoken設定時だけ出力する', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#cloudflare-web-analytics-config')).toHaveCount(0);
  await expect(page.locator(`script[src="${beaconSrc}"]`)).toHaveCount(0);
});

test('Analytics beaconは許可hostnameだけで読み込む', async ({ page }) => {
  await page.route(beaconSrc, (route) => route.abort());

  await page.goto('http://127.0.0.1:4322/');
  const allowedBeacon = page.locator(`script[src="${beaconSrc}"]`);
  await expect(allowedBeacon).toHaveCount(1);
  await expect(allowedBeacon).toHaveAttribute('data-cf-beacon', JSON.stringify({ token: 'fixture-public-token' }));

  await page.goto('http://localhost:4322/');
  await expect(page.locator(`script[src="${beaconSrc}"]`)).toHaveCount(0);
});
