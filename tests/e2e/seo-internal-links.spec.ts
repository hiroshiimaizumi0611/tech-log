import { expect, test, type Page } from '@playwright/test';

const siteUrl = new URL('https://example.invalid/');

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

async function renderedArticleDestinations(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator('[data-article-body] a[href]')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')).filter((href): href is string => href !== null));

  return hrefs.flatMap((href) => {
    const url = new URL(href, siteUrl);

    if (url.origin !== siteUrl.origin || !url.pathname.startsWith('/blog/')) {
      return [];
    }

    return [`${url.pathname}${url.search}${url.hash}`];
  });
}

test('本文内の同一オリジン記事リンクを正規化したmultisetとして収集する', async ({ page }) => {
  await page.setContent(`
    <main data-article-body>
      <a href="/blog/approved/">approved</a>
      <a href="/blog/unapproved/?from=test">query</a>
      <a href="/blog/unapproved/#section">fragment</a>
      <a href="https://example.invalid/blog/absolute/">same-site absolute</a>
      <a href="/blog/duplicate/">duplicate one</a>
      <a href="/blog/duplicate/">duplicate two</a>
      <a href="/blog/duplicate/#section">duplicate fragment</a>
      <a href="https://external.invalid/blog/external/">external</a>
    </main>
  `);

  const destinations = await renderedArticleDestinations(page);

  expect(destinations.sort()).toEqual(
    [
      '/blog/approved/',
      '/blog/unapproved/?from=test',
      '/blog/unapproved/#section',
      '/blog/absolute/',
      '/blog/duplicate/',
      '/blog/duplicate/',
      '/blog/duplicate/#section',
    ].sort(),
  );
});

for (const contract of linkContracts) {
  test(`${contract.source}の本文に承認済みの内部リンクだけを表示する`, async ({ page }) => {
    await page.goto(contract.source);
    const destinations = await renderedArticleDestinations(page);

    expect(destinations.sort()).toEqual([...contract.targets].sort());
  });
}
