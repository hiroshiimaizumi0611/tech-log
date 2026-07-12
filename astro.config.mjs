import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import remarkCodeFilename, { codeFilenameFromMeta, remarkHeadingLinks } from './src/lib/remark-code-filename.ts';

const filenameTransformer = {
  name: 'code-filename',
  code(node) {
    const filename = codeFilenameFromMeta(this.options.meta);
    if (filename) node.properties['data-filename'] = filename;
  },
};

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  integrations: [mdx(), react(), sitemap()],
  markdown: {
    processor: unified({ remarkPlugins: [remarkCodeFilename, remarkHeadingLinks] }),
    shikiConfig: { transformers: [filenameTransformer] },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
