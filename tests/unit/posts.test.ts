import { describe, expect, it } from 'vitest';

import {
  getAdjacentPosts,
  getFeaturedPost,
  getLatestPosts,
  getPublishedPosts,
  getRelatedPosts,
  sortPosts,
  type PostLike,
} from '../../src/lib/content/posts';

function post(id: string, publishedAt: string, overrides: Partial<PostLike['data']> = {}): PostLike {
  return {
    id,
    data: {
      publishedAt: new Date(publishedAt),
      category: 'Backend',
      tags: [],
      draft: false,
      featured: false,
      ...overrides,
    },
  };
}

describe('sortPosts', () => {
  it('sorts by publishedAt descending, then id ascending without mutating input', () => {
    const posts = [post('z-post', '2026-01-03'), post('b-post', '2026-01-05'), post('a-post', '2026-01-05')];

    expect(sortPosts(posts).map(({ id }) => id)).toEqual(['a-post', 'b-post', 'z-post']);
    expect(posts.map(({ id }) => id)).toEqual(['z-post', 'b-post', 'a-post']);
  });
});

describe('getPublishedPosts', () => {
  const posts = [post('published', '2026-01-01'), post('draft', '2026-01-02', { draft: true })];

  it('excludes drafts in production', () => {
    expect(getPublishedPosts(posts, { production: true, includeDrafts: true }).map(({ id }) => id)).toEqual(['published']);
  });

  it('includes drafts only when explicitly requested in development', () => {
    expect(getPublishedPosts(posts, { production: false, includeDrafts: true }).map(({ id }) => id)).toEqual(['draft', 'published']);
    expect(getPublishedPosts(posts, { production: false }).map(({ id }) => id)).toEqual(['published']);
  });
});

describe('post selections', () => {
  const posts = [
    post('older-featured', '2026-01-01', { featured: true }),
    post('newer-featured', '2026-01-03', { featured: true }),
    post('newest', '2026-01-04'),
  ];

  it('selects the newest featured post', () => {
    expect(getFeaturedPost(posts)?.id).toBe('newer-featured');
  });

  it('falls back to the newest published post', () => {
    expect(getFeaturedPost(posts.map((entry) => ({ ...entry, data: { ...entry.data, featured: false } })))?.id).toBe('newest');
  });

  it('returns the requested number of latest posts in published order', () => {
    expect(getLatestPosts(posts, 2).map(({ id }) => id)).toEqual(['newest', 'newer-featured']);
  });
});

describe('getRelatedPosts', () => {
  it('ranks category, common tags, date, and id and excludes drafts and the current post', () => {
    const current = post('current', '2026-01-10', {
      category: 'Backend',
      tags: ['TypeScript', 'API'],
    });
    const posts = [
      current,
      post('same-two-old', '2026-01-05', { category: 'Backend', tags: ['TypeScript', 'API'] }),
      post('same-one-new', '2026-01-09', { category: 'Backend', tags: ['API'] }),
      post('other-two-new', '2026-01-11', { category: 'Cloud', tags: ['TypeScript', 'API'] }),
      post('same-two-a', '2026-01-08', { category: 'Backend', tags: ['TypeScript', 'API'] }),
      post('same-two-b', '2026-01-08', { category: 'Backend', tags: ['TypeScript', 'API'] }),
      post('draft-related', '2026-01-12', {
        category: 'Backend',
        tags: ['TypeScript', 'API'],
        draft: true,
      }),
    ];

    expect(getRelatedPosts(current, posts, 4).map(({ id }) => id)).toEqual(['same-two-a', 'same-two-b', 'same-two-old', 'same-one-new']);
  });
});

describe('getAdjacentPosts', () => {
  it('returns neighbors in published order while excluding drafts and self', () => {
    const current = post('middle', '2026-01-02');
    const posts = [post('oldest', '2026-01-01'), post('draft', '2026-01-04', { draft: true }), current, post('newest', '2026-01-03')];

    expect(getAdjacentPosts(current, posts)).toEqual({
      previous: expect.objectContaining({ id: 'newest' }),
      next: expect.objectContaining({ id: 'oldest' }),
    });
  });
});
