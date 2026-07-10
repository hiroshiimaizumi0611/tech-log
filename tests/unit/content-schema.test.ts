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

  it.each(['AWS/CDK', 'why?', 'C#', 'AWS／CDK'])('rejects path-sensitive tag %s', (tag) => {
    expect(blogMetadataSchema.safeParse({ ...validMetadata, tags: [tag] }).success).toBe(false);
  });

  it('rejects tags that collide after shared normalization', () => {
    expect(blogMetadataSchema.safeParse({ ...validMetadata, tags: ['ＡＷＳ', ' aws '] }).success).toBe(false);
  });

  it('accepts Date and string dates and returns Date values', () => {
    const publishedAt = new Date('2026-01-02T00:00:00Z');
    const fromDate = blogMetadataSchema.parse({ ...validMetadata, publishedAt });
    const fromString = blogMetadataSchema.parse(validMetadata);

    expect(fromDate.publishedAt).toEqual(publishedAt);
    expect(fromString.publishedAt).toBeInstanceOf(Date);
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
