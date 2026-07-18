import { expect, test } from '@playwright/test';

const linkContracts = [
  {
    source: '/blog/chatgpt-sites-guide/',
    targets: ['/blog/chatgpt-work-guide/'],
  },
  {
    source: '/blog/chatgpt-codex-plugins-guide/',
    targets: ['/blog/chatgpt-work-guide/', '/blog/gpt-5-6-sol-terra-luna/'],
  },
  {
    source: '/blog/build-tech-blog-with-astro-2026/',
    targets: ['/blog/terraform-drift-detection/', '/blog/http-query-method-rfc-10008/'],
  },
  {
    source: '/blog/terraform-drift-detection/',
    targets: ['/blog/aws-cloudfront-vpc-origin-outage-2026-07-16/'],
  },
] as const;

for (const contract of linkContracts) {
  test(`${contract.source}の本文に承認済みの内部リンクを表示する`, async ({ page }) => {
    await page.goto(contract.source);
    const body = page.locator('[data-article-body]');

    for (const target of contract.targets) {
      await expect(body.locator(`a[href="${target}"]`)).toHaveCount(1);
    }
  });
}
