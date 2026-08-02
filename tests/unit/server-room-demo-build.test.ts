import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { configDefaults } from 'vitest/config';
import { describe, expect, it } from 'vitest';

const blogRoot = path.resolve(import.meta.dirname, '../..');
const demoRoot = path.join(blogRoot, 'demos/server-room');

async function packageJson() {
  return JSON.parse(await readFile(path.join(blogRoot, 'package.json'), 'utf8'));
}

async function importFresh<T>(file: string): Promise<T> {
  return import(pathToFileURL(file).href) as Promise<T>;
}

describe('server room demo toolchain', () => {
  it('provides dedicated check, test, build, and verification commands', async () => {
    const pkg = await packageJson();

    expect(pkg.scripts['check:demo']).toBe('tsc --noEmit -p demos/server-room/tsconfig.json');
    expect(pkg.scripts['test:demo']).toBe('vitest run --config demos/server-room/vitest.config.ts');
    expect(pkg.scripts['build:demo']).toBe('vite build --config demos/server-room/vite.config.ts');
    expect(pkg.scripts.verify).toContain('node scripts/verify-server-room-demo.mjs');
    expect(pkg.scripts.verify).toContain('npm run check:demo');
    expect(pkg.scripts.verify).toContain('npm run test:demo');
    expect(pkg.scripts.verify).toContain('npm test');
  });

  it('declares the demo runtime and test dependencies without a second React copy', async () => {
    const pkg = await packageJson();

    for (const dependency of ['three', '@react-three/fiber', '@react-three/drei']) {
      expect(pkg.dependencies[dependency], dependency).toBeTypeOf('string');
    }
    for (const dependency of [
      'vite',
      '@vitejs/plugin-react',
      'gltf-validator',
      'jsdom',
      '@testing-library/react',
      '@testing-library/user-event',
      '@testing-library/jest-dom',
      '@types/node',
      '@types/three',
    ]) {
      expect(pkg.devDependencies[dependency], dependency).toBeTypeOf('string');
    }
    expect(pkg.dependencies.react).toBe('^19.2.7');
    expect(pkg.dependencies['react-dom']).toBe('^19.2.7');
  });

  it('builds from absolute demo paths without emptying the Astro output', async () => {
    const previousSiteUrl = process.env.SITE_URL;
    process.env.SITE_URL = 'https://example.invalid';
    try {
      const module = await importFresh<{
        default: (env: { command: 'build'; mode: string }) => {
          root: string;
          base: string;
          publicDir: string;
          build: { outDir: string; emptyOutDir: boolean };
          plugins: Array<{
            name: string;
            transformIndexHtml?: { handler: (html: string) => string };
          }>;
        };
      }>(path.join(demoRoot, 'vite.config.ts'));
      const config = module.default({ command: 'build', mode: 'production' });

      expect(config.root).toBe(demoRoot);
      expect(path.isAbsolute(config.root)).toBe(true);
      expect(config.base).toBe('/demos/server-room/');
      expect(config.publicDir).toBe(path.join(demoRoot, 'public'));
      expect(path.isAbsolute(config.publicDir)).toBe(true);
      expect(config.build).toEqual({
        outDir: path.join(blogRoot, 'dist/demos/server-room'),
        emptyOutDir: false,
      });

      const canonicalPlugin = config.plugins.find(({ name }) => name === 'server-room-canonical');
      expect(canonicalPlugin).toBeDefined();
      expect(canonicalPlugin?.transformIndexHtml?.handler('<link rel="canonical" href="__SERVER_ROOM_CANONICAL_URL__" />')).toContain(
        'href="https://example.invalid/demos/server-room/"',
      );
    } finally {
      if (previousSiteUrl === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = previousSiteUrl;
    }
  });

  it('keeps root and demo Vitest collections separate', async () => {
    const rootModule = await importFresh<{
      default: { test: { include: string[]; exclude: string[] } };
    }>(path.join(blogRoot, 'vitest.config.ts'));
    const demoModule = await importFresh<{
      default: {
        root: string;
        cacheDir: string;
        test: {
          include: string[];
          environment: string;
          setupFiles: string[];
          css: boolean;
        };
      };
    }>(path.join(demoRoot, 'vitest.config.ts'));

    expect(rootModule.default.test.exclude).toEqual(['demos/server-room/**', ...configDefaults.exclude]);
    expect(rootModule.default.test.include).toEqual(['tests/unit/**/*.test.ts']);
    expect(demoModule.default.root).toBe(demoRoot);
    expect(demoModule.default.cacheDir).toBe(path.join(blogRoot, 'node_modules/.vite/server-room-demo'));
    expect(demoModule.default.test.include).toEqual(['src/**/*.test.{ts,tsx}']);
    expect(demoModule.default.test.environment).toBe('jsdom');
    expect(demoModule.default.test.setupFiles).toEqual([path.join(demoRoot, 'src/test/setup.ts')]);
    expect(demoModule.default.test.css).toBe(true);
    expect(rootModule.default.test.include).not.toEqual(demoModule.default.test.include);
  });
});
