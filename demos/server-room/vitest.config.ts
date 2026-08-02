import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const demoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const blogRoot = resolve(demoRoot, '../..');

export default defineConfig({
  root: demoRoot,
  cacheDir: resolve(blogRoot, 'node_modules/.vite/server-room-demo'),
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(demoRoot, 'src/test/setup.ts')],
    css: true,
  },
});
