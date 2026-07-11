import { getPublishedPosts, type PostLike } from './posts';
import { assertNonNegativeInteger } from './pagination';

const PATH_SENSITIVE_CHARACTER = /[\\/?#\p{Cc}]/u;
const PATH_NORMALIZATION_SEGMENTS = new Set(['.', '..']);

function compareLabels(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeTagSegment(tag: string): string {
  const normalizedTag = tag.normalize('NFKC');
  if (PATH_SENSITIVE_CHARACTER.test(normalizedTag)) {
    throw new Error(`タグにパスで使用できない文字が含まれています: ${tag}`);
  }

  const segment = normalizedTag.trim().toLowerCase().replace(/\s+/gu, '-');
  if (!segment) throw new Error('タグは空にできません');
  if (PATH_SENSITIVE_CHARACTER.test(segment) || PATH_NORMALIZATION_SEGMENTS.has(segment)) {
    throw new Error(`タグを安全なパスに変換できません: ${tag}`);
  }
  return segment;
}

export function tagToHref(tag: string): string {
  return `/tags/${encodeURIComponent(normalizeTagSegment(tag))}/`;
}

export interface TagIndexEntry {
  label: string;
  segment: string;
  href: string;
}

export interface TagLabel {
  label: string;
}

export function buildTagIndex(tags: Iterable<TagLabel>): TagIndexEntry[] {
  const labelsBySegment = new Map<string, string>();

  for (const { label } of tags) {
    const segment = normalizeTagSegment(label);
    const existing = labelsBySegment.get(segment);
    if (existing !== undefined && existing !== label) {
      throw new Error(`タグの正規化結果が衝突しています: ${existing}, ${label}`);
    }
    labelsBySegment.set(segment, label);
  }

  return [...labelsBySegment]
    .map(([segment, label]) => ({
      label,
      segment,
      href: tagToHref(label),
    }))
    .sort((left, right) => compareLabels(left.segment, right.segment));
}

export interface TagPage<T extends PostLike = PostLike> extends TagIndexEntry {
  count: number;
  posts: T[];
}

export function buildTagPages<T extends PostLike>(posts: readonly T[]): TagPage<T>[] {
  const published = getPublishedPosts(posts);
  const tagIndex = buildTagIndex(published.flatMap(({ data }) => data.tags.map((label) => ({ label }))));
  const pagesBySegment = new Map(tagIndex.map((tag) => [tag.segment, { ...tag, posts: [] as T[] }]));

  for (const post of published) {
    const postSegments = new Set<string>();
    for (const label of post.data.tags) {
      const segment = normalizeTagSegment(label);
      if (postSegments.has(segment)) continue;
      postSegments.add(segment);
      pagesBySegment.get(segment)?.posts.push(post);
    }
  }

  return tagIndex.map(({ segment }) => {
    const page = pagesBySegment.get(segment);
    if (!page) throw new Error(`タグページを生成できません: ${segment}`);
    return { ...page, count: page.posts.length };
  });
}

export interface PopularTag {
  label: string;
  count: number;
}

export function getPopularTags(posts: readonly PostLike[], limit: number): PopularTag[] {
  assertNonNegativeInteger(limit, 'limit');
  const counts = new Map<string, number>();

  for (const { data } of posts) {
    if (data.draft) continue;
    for (const tag of new Set(data.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || compareLabels(left.label, right.label))
    .slice(0, limit);
}
