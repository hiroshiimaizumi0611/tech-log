import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { configDefaults } from 'vitest/config';
import { afterEach, describe, expect, it } from 'vitest';

const blogRoot = path.resolve(import.meta.dirname, '../..');
const demoRoot = path.join(blogRoot, 'demos/server-room');
const expectedCanonical = 'https://example.invalid/demos/server-room/';
const fixtureRoots: string[] = [];
const expectedServerNodeNames = [
  'server_01_01',
  'server_01_02',
  'server_01_03',
  'server_01_04',
  'server_01_05',
  'server_01_06',
  'server_02_01',
  'server_02_02',
  'server_02_03',
  'server_02_04',
  'server_02_05',
  'server_02_06',
  'server_02_07',
  'server_02_08',
] as const;
const expectedDemoHeaders = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
  [
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
  ],
  ['X-Robots-Tag', 'noindex, follow'],
] as const;

const validDemoHtml = `<!doctype html>
<html lang="ja">
  <head>
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="${expectedCanonical}">
    <link rel="stylesheet" href="/demos/server-room/assets/app.css">
  </head>
  <body data-pagefind-ignore>
    <div id="root" data-pagefind-ignore></div>
    <script type="module" src="/demos/server-room/assets/app.js"></script>
  </body>
</html>`;

async function writeFixtureFile(root: string, relativePath: string, contents: string | Uint8Array) {
  const destination = path.join(root, ...relativePath.split('/'));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

function glbWithNodeNames(nodeNames: readonly string[]) {
  const encodedJson = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, nodes: nodeNames.map((name) => ({ name })) }));
  const paddedLength = Math.ceil(encodedJson.byteLength / 4) * 4;
  const bytes = new Uint8Array(20 + paddedLength).fill(0x20, 20);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(encodedJson, 20);
  return bytes;
}

async function createValidDistFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'server-room-demo-build-'));
  fixtureRoots.push(root);
  const glb = await readFile(path.join(demoRoot, 'public/models/server-room.glb'));
  await Promise.all([
    writeFixtureFile(root, 'index.html', '<!doctype html><title>Blog</title>'),
    writeFixtureFile(
      root,
      'blog/fixture-article/index.html',
      '<!doctype html><html lang="ja"><body><main data-pagefind-body>Fixture article</main></body></html>',
    ),
    writeFixtureFile(root, 'rss.xml', '<rss><channel><title>Blog</title></channel></rss>'),
    writeFixtureFile(
      root,
      'sitemap-index.xml',
      '<sitemapindex><sitemap><loc>https://example.invalid/sitemap-0.xml</loc></sitemap></sitemapindex>',
    ),
    writeFixtureFile(root, 'sitemap-0.xml', '<urlset><url><loc>https://example.invalid/</loc></url></urlset>'),
    writeFixtureFile(
      root,
      'robots.txt',
      ['User-agent: *', 'Allow: /', 'Sitemap: https://example.invalid/sitemap-index.xml', ''].join('\n'),
    ),
    writeFixtureFile(root, 'og-default.png', 'png'),
    writeFixtureFile(root, 'pagefind/pagefind.js', 'export const search = async () => ({ results: [] });'),
    writeFixtureFile(root, 'pagefind/pagefind-entry.json', JSON.stringify({ languages: { ja: { hash: 'ja_deadbeef', page_count: 1 } } })),
    writeFixtureFile(root, 'pagefind/pagefind.ja_deadbeef.pf_meta', 'fixture'),
    writeFixtureFile(root, 'demos/server-room/index.html', validDemoHtml),
    writeFixtureFile(root, 'demos/server-room/assets/app.js', 'console.log("demo")'),
    writeFixtureFile(root, 'demos/server-room/assets/app.css', 'body { color: white; }'),
    writeFixtureFile(root, 'demos/server-room/models/server-room.glb', glb),
  ]);
  return root;
}

async function verifyFixture(root: string) {
  const { verifyBuild } = await importFresh<{
    verifyBuild: (options: { distDirectory: string; expectedCanonicalUrl: string }) => Promise<unknown>;
  }>(path.join(blogRoot, 'scripts/verify-build.mjs'));
  return verifyBuild({ distDirectory: root, expectedCanonicalUrl: expectedCanonical });
}

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

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

  it('builds Astro, the demo, and Pagefind before verifying the combined output', async () => {
    const pkg = await packageJson();

    expect(pkg.scripts.build).toBe('npm run build:astro && npm run build:demo && npm run build:search && node scripts/verify-build.mjs');
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

describe('server room demo build output', () => {
  it('publishes the exact demo-only security and robots headers without overriding cache control', async () => {
    const source = await readFile(path.join(blogRoot, 'public/_headers'), 'utf8');
    const lines = source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines[0]).toBe('/demos/server-room/*');
    expect(lines.slice(1)).toEqual(expectedDemoHeaders.map(([name, value]) => `${name}: ${value}`));
    expect(source).not.toMatch(/^\s*Cache-Control\s*:/imu);
  });

  it('accepts a complete combined blog and demo fixture', async () => {
    const root = await createValidDistFixture();

    await expect(verifyFixture(root)).resolves.toMatchObject({ pageCount: 1, serverNodeCount: 14 });
  });

  it('rejects a missing demo index', async () => {
    const root = await createValidDistFixture();
    await unlink(path.join(root, 'demos/server-room/index.html'));

    await expect(verifyFixture(root)).rejects.toThrow(/demo index/i);
  });

  it.each([
    ['JavaScript', validDemoHtml.replace('/demos/server-room/assets/app.js', '/_astro/app.js')],
    ['CSS', validDemoHtml.replace('/demos/server-room/assets/app.css', '/_astro/app.css')],
  ])('rejects %s outside the demo subpath', async (_assetType, html) => {
    const root = await createValidDistFixture();
    await writeFixtureFile(root, 'demos/server-room/index.html', html);

    await expect(verifyFixture(root)).rejects.toThrow(/demo subpath/i);
  });

  it('rejects a missing GLB', async () => {
    const root = await createValidDistFixture();
    await unlink(path.join(root, 'demos/server-room/models/server-room.glb'));

    await expect(verifyFixture(root)).rejects.toThrow(/GLB/i);
  });

  it('rejects a GLB with the wrong SHA-256', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(root, 'demos/server-room/models/server-room.glb', 'not the pinned model');

    await expect(verifyFixture(root)).rejects.toThrow(/GLB SHA-256/i);
  });

  it('rejects an extra GLB outside the demo model path', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(root, 'models/extra.glb', 'extra model');

    await expect(verifyFixture(root)).rejects.toThrow(/exactly one GLB/i);
  });

  it.each(['index.html', 'rss.xml', 'sitemap-index.xml'])('rejects a build that loses the blog artifact %s', async (relativePath) => {
    const root = await createValidDistFixture();
    await unlink(path.join(root, relativePath));

    await expect(verifyFixture(root)).rejects.toThrow(new RegExp(relativePath.replace('.', '\\.')));
  });

  it('rejects the wrong demo robots directive', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(root, 'demos/server-room/index.html', validDemoHtml.replace('noindex, follow', 'index, follow'));

    await expect(verifyFixture(root)).rejects.toThrow(/robots/i);
  });

  it('rejects the wrong demo canonical URL', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(
      root,
      'demos/server-room/index.html',
      validDemoHtml.replace(expectedCanonical, 'https://example.invalid/wrong/'),
    );

    await expect(verifyFixture(root)).rejects.toThrow(/canonical/i);
  });

  it('rejects a Pagefind page_count that differs from the indexable built HTML count', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(
      root,
      'pagefind/pagefind-entry.json',
      JSON.stringify({ languages: { ja: { hash: 'ja_deadbeef', page_count: 2 } } }),
    );

    await expect(verifyFixture(root)).rejects.toThrow(/page_count.*1.*got 2/i);
  });

  it('rejects a build with no indexable HTML pages even when Pagefind page_count is zero', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(root, 'blog/fixture-article/index.html', '<!doctype html><html lang="ja"><body>Not indexed</body></html>');
    await writeFixtureFile(
      root,
      'pagefind/pagefind-entry.json',
      JSON.stringify({ languages: { ja: { hash: 'ja_deadbeef', page_count: 0 } } }),
    );

    await expect(verifyFixture(root)).rejects.toThrow(/at least one.*data-pagefind-body/i);
  });

  it('accepts a newly built indexable article when Pagefind page_count increases with it', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(
      root,
      'blog/new-article/index.html',
      '<!doctype html><html lang="ja"><body><article data-pagefind-body>New article</article></body></html>',
    );
    await writeFixtureFile(
      root,
      'pagefind/pagefind-entry.json',
      JSON.stringify({ languages: { ja: { hash: 'ja_deadbeef', page_count: 2 } } }),
    );

    await expect(verifyFixture(root)).resolves.toMatchObject({ pageCount: 2, serverNodeCount: 14 });
  });

  it('rejects a newly built indexable article when Pagefind page_count does not increase', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(
      root,
      'blog/new-article/index.html',
      '<!doctype html><html lang="ja"><body><article data-pagefind-body>New article</article></body></html>',
    );

    await expect(verifyFixture(root)).rejects.toThrow(/page_count.*2.*got 1/i);
  });

  it.each(['../../outside', '/absolute', '..\\..\\outside', 'ja_deadbeef/../outside', 'ja_deadbeef/./outside'])(
    'rejects an unsafe Pagefind Japanese hash before resolving artifacts: %s',
    async (hash) => {
      const root = await createValidDistFixture();
      await writeFixtureFile(root, 'pagefind/pagefind-entry.json', JSON.stringify({ languages: { ja: { hash, page_count: 1 } } }));

      await expect(verifyFixture(root)).rejects.toThrow(/Invalid Pagefind Japanese hash/i);
    },
  );

  it('rejects data-pagefind-body in the demo HTML', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(
      root,
      'demos/server-room/index.html',
      validDemoHtml.replace('<body data-pagefind-ignore>', '<body data-pagefind-ignore data-pagefind-body>'),
    );

    await expect(verifyFixture(root)).rejects.toThrow(/data-pagefind-body/i);
  });

  it('rejects the demo URL from every sitemap referenced by the sitemap index', async () => {
    const root = await createValidDistFixture();
    await writeFixtureFile(
      root,
      'sitemap-index.xml',
      '<sitemapindex><sitemap><loc>https://example.invalid/sitemap-0.xml</loc></sitemap><sitemap><loc>https://example.invalid/maps/sitemap-1.xml</loc></sitemap></sitemapindex>',
    );
    await writeFixtureFile(root, 'maps/sitemap-1.xml', '<urlset><url><loc>https://example.invalid/demos/server-room/</loc></url></urlset>');

    await expect(verifyFixture(root)).rejects.toThrow(/sitemap.*demo URL/i);
  });

  it('validates the published GLB with no errors or warnings and exactly the 14 expected server nodes', async () => {
    const { validateServerRoomGlb } = await importFresh<{
      validateServerRoomGlb: (bytes: Uint8Array) => Promise<{
        numErrors: number;
        numWarnings: number;
        serverNodeNames: string[];
      }>;
    }>(path.join(blogRoot, 'scripts/verify-server-room-demo.mjs'));
    const bytes = await readFile(path.join(demoRoot, 'public/models/server-room.glb'));

    await expect(validateServerRoomGlb(bytes)).resolves.toEqual({
      numErrors: 0,
      numWarnings: 0,
      serverNodeNames: expectedServerNodeNames,
    });
  });

  it.each([
    ['a missing node', expectedServerNodeNames.slice(0, -1)],
    ['a duplicate node', [...expectedServerNodeNames, expectedServerNodeNames[0]]],
    ['a renamed or unexpected node', [...expectedServerNodeNames.slice(0, -1), 'server_02_09']],
  ])('rejects a validator-clean GLB with %s', async (_scenario, serverNodeNames) => {
    const { __testing } = await importFresh<{
      __testing: {
        validateServerRoomGlb: (
          bytes: Uint8Array,
          validator: () => Promise<{ issues: { numErrors: number; numWarnings: number } }>,
        ) => Promise<unknown>;
      };
    }>(path.join(blogRoot, 'scripts/verify-server-room-demo.mjs'));

    await expect(
      __testing.validateServerRoomGlb(glbWithNodeNames(serverNodeNames), async () => ({
        issues: { numErrors: 0, numWarnings: 0 },
      })),
    ).rejects.toThrow(/server node names/i);
  });
});
