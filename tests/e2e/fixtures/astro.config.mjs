import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  srcDir: fileURLToPath(new URL('./src/', import.meta.url)),
  outDir: fileURLToPath(new URL('./.dist/', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./.astro/', import.meta.url)),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../../../src/', import.meta.url)),
      },
    },
  },
});
