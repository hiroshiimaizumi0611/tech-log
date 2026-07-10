import { z } from 'astro/zod';

import { CATEGORY_KEYS } from '../../config/site';
import { normalizeTagSegment } from './tags';

const nonemptyString = z.string().trim().min(1);
const dateInput = z.union([z.string(), z.date()]).pipe(z.coerce.date());

const tags = z.array(nonemptyString).superRefine((labels, context) => {
  const seenSegments = new Set<string>();

  for (const label of labels) {
    let segment: string;
    try {
      segment = normalizeTagSegment(label);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'タグが不正です',
      });
      continue;
    }

    if (seenSegments.has(segment)) {
      context.addIssue({ code: 'custom', message: `タグの正規化結果が重複しています: ${label}` });
    }
    seenSegments.add(segment);
  }
});

export const blogMetadataSchema = z
  .object({
    title: nonemptyString,
    description: nonemptyString,
    publishedAt: dateInput,
    updatedAt: dateInput.optional(),
    category: z.enum(CATEGORY_KEYS),
    tags,
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    featuredCode: z
      .object({
        language: nonemptyString,
        filename: nonemptyString.optional(),
        code: z.string().refine((code) => code.trim().length > 0, {
          message: 'code must not be blank',
        }),
      })
      .optional(),
  })
  .refine(({ publishedAt, updatedAt }) => !updatedAt || updatedAt >= publishedAt, {
    message: 'updatedAt must be on or after publishedAt',
    path: ['updatedAt'],
  });
