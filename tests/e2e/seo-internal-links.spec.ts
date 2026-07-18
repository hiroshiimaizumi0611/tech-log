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
