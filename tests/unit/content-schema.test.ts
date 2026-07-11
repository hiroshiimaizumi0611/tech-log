import { describe, expect, it } from 'vitest';

import { blogMetadataSchema } from '../../src/lib/content/schema';

const validMetadata = {
  title: 'テスト記事',
  description: '記事の説明',
  publishedAt: '2026-01-02',
  category: 'Backend',
  tags: [],
};

describe('blogMetadataSchema', () => {
  it('requires the tags key while accepting an empty array', () => {
    const { tags: _tags, ...withoutTags } = validMetadata;

    expect(blogMetadataSchema.safeParse(withoutTags).success).toBe(false);
    expect(blogMetadataSchema.safeParse(validMetadata).success).toBe(true);
  });

  it.each(['.', '..', '．', '．．', '․', '﹒', 'AWS/CDK', 'AWS\\CDK', 'why?', 'C#', 'AWS／CDK', 'AWS＼CDK', 'line\nbreak'])(
    'rejects path-sensitive tag %s',
    (tag) => {
      expect(blogMetadataSchema.safeParse({ ...validMetadata, tags: [tag] }).success).toBe(false);
    },
  );

  it('accepts a percent-sign tag', () => {
    expect(blogMetadataSchema.safeParse({ ...validMetadata, tags: ['%'] }).success).toBe(true);
  });

  it('rejects tags that collide after shared normalization', () => {
    expect(blogMetadataSchema.safeParse({ ...validMetadata, tags: ['ＡＷＳ', ' aws '] }).success).toBe(false);
  });

  it('converts a strict ISO calendar date to JST midnight', () => {
    const result = blogMetadataSchema.parse(validMetadata);

    expect(result.publishedAt).toEqual(new Date('2026-01-02T00:00:00+09:00'));
  });

  it('accepts a valid leap date', () => {
    const result = blogMetadataSchema.parse({ ...validMetadata, publishedAt: '2024-02-29' });

    expect(result.publishedAt).toEqual(new Date('2024-02-29T00:00:00+09:00'));
  });

  it('accepts a valid Date object unchanged in value', () => {
    const publishedAt = new Date('2026-01-02T00:00:00Z');
    const result = blogMetadataSchema.parse({ ...validMetadata, publishedAt });

    expect(result.publishedAt).toEqual(publishedAt);
  });

  it.each(['2026-02-30', '2026/01/02', 'January 2, 2026', '1', '2026-01-02T00:00:00+09:00'])(
    'rejects non-strict or invalid calendar date %s',
    (publishedAt) => {
      expect(blogMetadataSchema.safeParse({ ...validMetadata, publishedAt }).success).toBe(false);
    },
  );

  it('rejects an invalid Date object', () => {
    expect(blogMetadataSchema.safeParse({ ...validMetadata, publishedAt: new Date(Number.NaN) }).success).toBe(false);
  });

  it.each([true, false, 0, 1, 1_700_000_000_000])('rejects non-string, non-Date date input %s', (publishedAt) => {
    expect(blogMetadataSchema.safeParse({ ...validMetadata, publishedAt }).success).toBe(false);
  });

  it('rejects updatedAt before publishedAt', () => {
    expect(blogMetadataSchema.safeParse({ ...validMetadata, updatedAt: '2026-01-01' }).success).toBe(false);
  });

  it('preserves the original non-blank featured code', () => {
    const code = '  function example() {\n    return true;\n  }\n';
    const result = blogMetadataSchema.parse({
      ...validMetadata,
      featuredCode: { language: 'typescript', code },
    });

    expect(result.featuredCode?.code).toBe(code);
  });

  it('rejects featured code containing only whitespace', () => {
    expect(
      blogMetadataSchema.safeParse({
        ...validMetadata,
        featuredCode: { language: 'typescript', code: ' \n\t' },
      }).success,
    ).toBe(false);
  });
});
