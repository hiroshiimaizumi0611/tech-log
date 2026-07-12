import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { SITE } from '@/config/site';
import { getPublishedPosts } from '@/lib/content/posts';

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('SITE_URL is required to generate RSS.');
  const posts = getPublishedPosts(await getCollection('blog'));
  const items = posts
    .map((post) => {
      const link = new URL(`/blog/${post.id}/`, site).toString();
      return `<item>
        <title>${escapeXml(post.data.title)}</title>
        <description>${escapeXml(post.data.description)}</description>
        <link>${escapeXml(link)}</link>
        <guid isPermaLink="true">${escapeXml(link)}</guid>
        <pubDate>${post.data.publishedAt.toUTCString()}</pubDate>
      </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <description>${escapeXml(SITE.description)}</description>
    <link>${escapeXml(site.toString())}</link>
    <language>ja</language>
    ${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
