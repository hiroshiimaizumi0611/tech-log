import type { CategoryKey } from '../../config/site';

export interface PostLike {
  id: string;
  data: {
    publishedAt: Date;
    category: CategoryKey;
    tags: readonly string[];
    draft?: boolean;
    featured?: boolean;
  };
}

export interface PublicationOptions {
  production?: boolean;
  includeDrafts?: boolean;
}

function compareIds(left: PostLike, right: PostLike): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function sortPosts<T extends PostLike>(posts: readonly T[]): T[] {
  return [...posts].sort((left, right) => right.data.publishedAt.getTime() - left.data.publishedAt.getTime() || compareIds(left, right));
}

export function getPublishedPosts<T extends PostLike>(posts: readonly T[], options: PublicationOptions = { production: true }): T[] {
  const includeDrafts = options.production === false && options.includeDrafts === true;
  return sortPosts(includeDrafts ? posts : posts.filter(({ data }) => !data.draft));
}

export function getFeaturedPost<T extends PostLike>(posts: readonly T[], options?: PublicationOptions): T | undefined {
  const published = getPublishedPosts(posts, options);
  return published.find(({ data }) => data.featured) ?? published[0];
}

export function getLatestPosts<T extends PostLike>(posts: readonly T[], limit: number, options?: PublicationOptions): T[] {
  return getPublishedPosts(posts, options).slice(0, Math.max(0, limit));
}

function commonTagCount(left: PostLike, right: PostLike): number {
  const leftTags = new Set(left.data.tags);
  return new Set(right.data.tags.filter((tag) => leftTags.has(tag))).size;
}

export function getRelatedPosts<T extends PostLike>(current: T, posts: readonly T[], limit: number): T[] {
  return posts
    .filter(({ id, data }) => id !== current.id && !data.draft)
    .sort(
      (left, right) =>
        Number(right.data.category === current.data.category) - Number(left.data.category === current.data.category) ||
        commonTagCount(current, right) - commonTagCount(current, left) ||
        right.data.publishedAt.getTime() - left.data.publishedAt.getTime() ||
        compareIds(left, right),
    )
    .slice(0, Math.max(0, limit));
}

export interface AdjacentPosts<T extends PostLike> {
  previous?: T;
  next?: T;
}

export function getAdjacentPosts<T extends PostLike>(current: T, posts: readonly T[]): AdjacentPosts<T> {
  const published = getPublishedPosts(posts);
  const currentIndex = published.findIndex(({ id }) => id === current.id);

  if (currentIndex === -1) return {};

  return {
    previous: published[currentIndex + 1],
    next: published[currentIndex - 1],
  };
}
