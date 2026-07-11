import { describe, expect, it } from 'vitest';

import { buildTagIndex, buildTagPages, getPopularTags, normalizeTagSegment, tagToHref } from '../../src/lib/content/tags';
import type { PostLike } from '../../src/lib/content/posts';

function post(id: string, tags: string[], draft = false): PostLike {
  return {
    id,
    data: {
      publishedAt: new Date('2026-01-01'),
      category: 'Backend',
      tags,
      draft,
      featured: false,
    },
  };
}

describe('getPopularTags', () => {
  it('counts published posts only and sorts by count descending then label ascending', () => {
    const posts = [
      post('one', ['Zod', 'Astro']),
      post('two', ['Astro', 'TypeScript']),
      post('three', ['Zod']),
      post('draft', ['DraftOnly', 'Astro'], true),
    ];

    expect(getPopularTags(posts, 2)).toEqual([
      { label: 'Astro', count: 2 },
      { label: 'Zod', count: 2 },
    ]);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid popular-tag limit %s', (limit) => {
    expect(() => getPopularTags([], limit)).toThrow(/non-negative integer/i);
  });
});

describe('tag paths', () => {
  it('normalizes Unicode tags without URL encoding the segment', () => {
    expect(normalizeTagSegment('生成 AI')).toBe('生成-ai');
  });

  it('URL-encodes only when building the href', () => {
    expect(tagToHref('生成 AI')).toBe('/tags/%E7%94%9F%E6%88%90-ai/');
  });

  it.each(['AWS/CDK', 'why?', 'C#'])('rejects path-sensitive tag %s', (tag) => {
    expect(() => normalizeTagSegment(tag)).toThrow();
  });

  it('detects normalization collisions', () => {
    expect(() => buildTagIndex([{ label: 'ＡＷＳ' }, { label: 'aws' }])).toThrow(/衝突/);
  });

  it('detects normalization collisions while generating tag routes', () => {
    expect(() => buildTagPages([post('wide', ['ＡＷＳ']), post('ascii', ['aws'])])).toThrow(/衝突/);
  });

  it('builds one published-post page per tag with deterministic counts and raw segments', () => {
    const pages = buildTagPages([
      post('newer', ['生成 AI', 'Astro']),
      { ...post('older', ['生成 AI']), data: { ...post('older', ['生成 AI']).data, publishedAt: new Date('2025-01-01') } },
      post('draft', ['Astro'], true),
    ]);

    expect(pages).toEqual([
      {
        label: 'Astro',
        segment: 'astro',
        href: '/tags/astro/',
        count: 1,
        posts: [expect.objectContaining({ id: 'newer' })],
      },
      {
        label: '生成 AI',
        segment: '生成-ai',
        href: '/tags/%E7%94%9F%E6%88%90-ai/',
        count: 2,
        posts: [expect.objectContaining({ id: 'newer' }), expect.objectContaining({ id: 'older' })],
      },
    ]);
  });

  it('returns deterministic entries sorted by normalized segment', () => {
    expect(buildTagIndex([{ label: 'Zod' }, { label: 'Astro' }])).toEqual([
      { label: 'Astro', segment: 'astro', href: '/tags/astro/' },
      { label: 'Zod', segment: 'zod', href: '/tags/zod/' },
    ]);
  });

  it('collapses exact duplicate labels', () => {
    expect(buildTagIndex([{ label: 'Astro' }, { label: 'Astro' }])).toEqual([{ label: 'Astro', segment: 'astro', href: '/tags/astro/' }]);
  });

  it.each(['', '   ', 'AWS/CDK', 'why?', 'C#', 'AWS／CDK'])('rejects invalid indexed tag %s', (label) => {
    expect(() => buildTagIndex([{ label }])).toThrow();
  });
});
