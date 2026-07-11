import { describe, expect, it } from 'vitest';

import { buildJsonLd, buildSeo, serializeJsonLd } from '../../src/lib/seo';

describe('SEO metadata', () => {
  const base = {
    siteUrl: 'https://example.invalid',
    pathname: '/blog/example/',
    title: '記事タイトル',
    description: '記事の説明',
  } as const;

  it('builds a canonical URL and prefers ogImage, then heroImage, then the site default', () => {
    expect(buildSeo({ ...base, ogImage: '/og-explicit.png', heroImage: '/hero.png' }).image).toBe(
      'https://example.invalid/og-explicit.png',
    );
    expect(buildSeo({ ...base, heroImage: { src: '/hero.png' } }).image).toBe('https://example.invalid/hero.png');
    expect(buildSeo(base)).toMatchObject({
      canonical: 'https://example.invalid/blog/example/',
      image: 'https://example.invalid/og-default.png',
      title: '記事タイトル | テックログ',
    });
  });

  it('describes the site as Blog and an article as BlogPosting by the same Person', () => {
    const blog = buildJsonLd({ ...base, pathname: '/', title: 'テックログ', pageType: 'website' });
    const article = buildJsonLd({
      ...base,
      pageType: 'article',
      publishedAt: '2026-07-11T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    });

    expect(blog['@type']).toBe('Blog');
    expect(blog.author).toMatchObject({ '@type': 'Person', name: 'Hiroshi Imaizumi' });
    expect(article).toMatchObject({
      '@type': 'BlogPosting',
      headline: '記事タイトル',
      datePublished: '2026-07-11T00:00:00.000Z',
      dateModified: '2026-07-12T00:00:00.000Z',
      author: { '@type': 'Person', name: 'Hiroshi Imaizumi' },
    });
  });

  it('serializes JSON-LD without allowing a closing script element', () => {
    const json = serializeJsonLd({ value: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toEqual({ value: '</script><script>alert(1)</script>' });
  });

  it('rejects non-HTTP canonical and image URLs', () => {
    expect(() => buildSeo({ ...base, canonical: 'javascript:alert(1)' })).toThrow(/HTTP/);
    expect(() => buildSeo({ ...base, ogImage: 'data:text/html,<script>alert(1)</script>' })).toThrow(/HTTP/);
  });
});
