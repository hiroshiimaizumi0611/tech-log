import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { CATEGORY_KEYS } from '@/config/site';

const nonemptyString = z.string().trim().min(1);

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '*.{md,mdx}' }),
  schema: ({ image }) =>
    z
      .object({
        title: nonemptyString,
        description: nonemptyString,
        publishedAt: z.coerce.date(),
        updatedAt: z.coerce.date().optional(),
        category: z.enum(CATEGORY_KEYS),
        tags: z
          .array(nonemptyString)
          .default([])
          .refine((tags) => new Set(tags).size === tags.length, {
            message: 'tags must not contain duplicates',
          }),
        draft: z.boolean().default(false),
        featured: z.boolean().default(false),
        heroImage: image().optional(),
        ogImage: image().optional(),
        featuredCode: z
          .object({
            language: nonemptyString,
            filename: nonemptyString.optional(),
            code: nonemptyString,
          })
          .optional(),
      })
      .refine(({ publishedAt, updatedAt }) => !updatedAt || updatedAt >= publishedAt, {
        message: 'updatedAt must be on or after publishedAt',
        path: ['updatedAt'],
      }),
});

export const collections = { blog };
