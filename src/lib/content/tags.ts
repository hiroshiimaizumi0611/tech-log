import type { PostLike } from './posts';
import { assertNonNegativeInteger } from './pagination';

const PATH_SENSITIVE_CHARACTER = /[/?#]/;

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
      href: `/tags/${encodeURIComponent(segment)}/`,
    }))
    .sort((left, right) => compareLabels(left.segment, right.segment));
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
