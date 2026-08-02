import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const BASE = '/demos/server-room/';
const CANONICAL_PLACEHOLDER = '__SERVER_ROOM_CANONICAL_URL__';
const demoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const blogRoot = resolve(demoRoot, '../..');

function canonicalUrl(siteUrl: string | undefined): string {
  if (!siteUrl) throw new Error('SITE_URL is required to build the server room demo');

  const site = new URL(siteUrl);
  if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) {
    throw new Error('SITE_URL must be an HTTPS origin');
  }

  return new URL(BASE, `${site.origin}/`).href;
}

export default defineConfig(() => {
  const canonical = canonicalUrl(process.env.SITE_URL);

  return {
    root: demoRoot,
    base: BASE,
    publicDir: resolve(demoRoot, 'public'),
    build: {
      outDir: resolve(blogRoot, 'dist/demos/server-room'),
      emptyOutDir: false,
    },
    plugins: [
      react(),
      {
        name: 'server-room-canonical',
        transformIndexHtml: {
          order: 'post',
          handler(html: string) {
            if (!html.includes(CANONICAL_PLACEHOLDER)) {
              throw new Error('Canonical URL placeholder is missing from index.html');
            }
            return html.replace(CANONICAL_PLACEHOLDER, canonical);
          },
        },
      },
    ],
  };
});
