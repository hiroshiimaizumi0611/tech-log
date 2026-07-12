import type { ImageMetadata } from 'astro';

import type { CategoryKey } from '../../config/site';
import { buildPaginationModel, listingPageHref, paginate, type PaginationModel } from './pagination';
import { getPublishedPosts, type PostLike } from './posts';
import { readingMinutes } from './reading-time';

export const LISTING_PAGE_SIZE = 12;

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Tokyo',
});

export interface ArticleView {
  href: string;
  title: string;
  description: string;
  publishedDate: string;
  publishedLabel: string;
  category: CategoryKey;
  tags: readonly string[];
  readingMinutes: number;
  heroImage?: ImageMetadata;
}

export interface ArticleSource extends PostLike {
  body?: string;
  data: PostLike['data'] & {
    title: string;
    description: string;
    heroImage?: ImageMetadata;
  };
}

export function toArticleView(entry: ArticleSource): ArticleView {
  return {
    href: `/blog/${entry.id}/`,
    title: entry.data.title,
    description: entry.data.description,
    publishedDate: entry.data.publishedAt.toISOString(),
    publishedLabel: dateFormatter.format(entry.data.publishedAt),
    category: entry.data.category,
    tags: entry.data.tags,
    readingMinutes: readingMinutes(entry.body ?? ''),
    heroImage: entry.data.heroImage,
  };
}

export interface BlogListingPage<T extends PostLike> {
  page: number;
  path: string;
  posts: T[];
  count: number;
  pagination: PaginationModel;
}

export function buildBlogListingPages<T extends PostLike>(posts: readonly T[]): BlogListingPage<T>[] {
  const published = getPublishedPosts(posts);
  const chunks = paginate(published, LISTING_PAGE_SIZE);
  const pagePosts = chunks.length > 0 ? chunks : [[]];
  const total = pagePosts.length;

  return pagePosts.map((postsForPage, index) => {
    const page = index + 1;
    return {
      page,
      path: listingPageHref(page, '/blog/'),
      posts: postsForPage,
      count: published.length,
      pagination: buildPaginationModel(page, total, '/blog/'),
    };
  });
}
