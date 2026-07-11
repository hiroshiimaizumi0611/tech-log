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

  it('describes only the homepage as the stable site Blog', () => {
    const blog = buildJsonLd({ ...base, pathname: '/', title: 'テックログ', pageType: 'website' });
    expect(blog).toMatchObject({
      '@type': 'Blog',
      '@id': 'https://example.invalid/#blog',
      author: { '@type': 'Person', '@id': 'https://example.invalid/#person', name: 'Hiroshi Imaizumi' },
      publisher: { '@id': 'https://example.invalid/#person' },
    });
  });

  it('describes normal routes as WebPage within the stable site Blog', () => {
    const page = buildJsonLd({ ...base, pathname: '/privacy/', title: 'プライバシーポリシー', pageType: 'website' });
    expect(page).toMatchObject({
      '@type': 'WebPage',
      '@id': 'https://example.invalid/privacy/#webpage',
      url: 'https://example.invalid/privacy/',
      isPartOf: {
        '@type': 'Blog',
        '@id': 'https://example.invalid/#blog',
        author: { '@type': 'Person', '@id': 'https://example.invalid/#person' },
        publisher: { '@id': 'https://example.invalid/#person' },
      },
    });
  });

  it('describes an article as BlogPosting linked to the same Blog and Person', () => {
    const article = buildJsonLd({
      ...base,
      pageType: 'article',
      publishedAt: '2026-07-11T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    });

    expect(article).toMatchObject({
      '@type': 'BlogPosting',
      '@id': 'https://example.invalid/blog/example/#article',
      headline: '記事タイトル',
      datePublished: '2026-07-11T00:00:00.000Z',
      dateModified: '2026-07-12T00:00:00.000Z',
      author: { '@id': 'https://example.invalid/#person' },
      publisher: { '@id': 'https://example.invalid/#person' },
      isPartOf: { '@type': 'Blog', '@id': 'https://example.invalid/#blog' },
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
