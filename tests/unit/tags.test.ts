import { describe, expect, it } from 'vitest';

import { buildTagIndex, getPopularTags, normalizeTagSegment, tagToHref } from '../../src/lib/content/tags';
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
      { label: 'Astro', count: 2, href: '/tags/astro/' },
      { label: 'Zod', count: 2, href: '/tags/zod/' },
    ]);
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
    expect(() => buildTagIndex(['ＡＷＳ', 'aws'])).toThrow(/衝突/);
  });
});
