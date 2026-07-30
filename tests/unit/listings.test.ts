import { describe, expect, it } from 'vitest';

import { buildBlogListingPages, LISTING_PAGE_SIZE, toArticleView } from '../../src/lib/content/listings';
import type { PostLike } from '../../src/lib/content/posts';

function post(id: string, index: number, draft = false): PostLike {
  return {
    id,
    data: {
      publishedAt: new Date(Date.UTC(2026, 0, index + 1)),
      category: 'Backend',
      tags: [],
      draft,
    },
  };
}

describe('listing policy', () => {
  it('uses one 12-item policy to build page 1 and page 2 route models', () => {
    const posts = Array.from({ length: 14 }, (_, index) => post(`post-${String(index + 1).padStart(2, '0')}`, index));
    const pages = buildBlogListingPages(posts);

    expect(LISTING_PAGE_SIZE).toBe(12);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ page: 1, path: '/blog/', pagination: { previousHref: undefined, nextHref: '/blog/page/2/' } });
    expect(pages[0].posts).toHaveLength(12);
    expect(pages[1]).toMatchObject({ page: 2, path: '/blog/page/2/', pagination: { previousHref: '/blog/', nextHref: undefined } });
    expect(pages[1].posts).toHaveLength(2);
  });

  it('excludes drafts and still returns an empty first-page model', () => {
    expect(buildBlogListingPages([post('draft', 0, true)])).toEqual([
      {
        page: 1,
        path: '/blog/',
        posts: [],
        count: 0,
        pagination: { current: 1, total: 1, previousHref: undefined, nextHref: undefined },
      },
    ]);
  });

  it('maps post content into the shared Japanese article view', () => {
    const article = toArticleView({
      ...post('example', 0),
      body: '文字'.repeat(501),
      data: {
        ...post('example', 0).data,
        title: 'テスト記事',
        description: '説明',
      },
    });

    expect(article).toMatchObject({
      href: '/blog/example/',
      title: 'テスト記事',
      publishedLabel: '2026年1月1日',
      readingMinutes: 3,
    });
  });
});
