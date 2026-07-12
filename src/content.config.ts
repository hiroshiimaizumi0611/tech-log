import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { blogMetadataSchema } from '@/lib/content/schema';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '*.{md,mdx}' }),
  schema: ({ image }) =>
    blogMetadataSchema.safeExtend({
      heroImage: image().optional(),
      ogImage: image().optional(),
    }),
});

export const collections = { blog };
