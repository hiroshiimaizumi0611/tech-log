import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseJsonc } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const artifactUrls = {
  config: new URL('../../wrangler.jsonc', import.meta.url),
  ci: new URL('../../.github/workflows/ci.yml', import.meta.url),
  deploy: new URL('../../.github/workflows/deploy.yml', import.meta.url),
  smoke: new URL('../../scripts/smoke-production.mjs', import.meta.url),
  productionBuild: new URL('../../scripts/verify-production-build.mjs', import.meta.url),
};

const ACTIONS = {
  checkout: 'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5',
  setupNode: 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
  wrangler: 'cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd',
} as const;

describe('deployment artifacts', () => {
  it('creates every required deployment artifact', async () => {
    for (const url of Object.values(artifactUrls)) await expect(access(url)).resolves.toBeUndefined();
  });

  it('uses the Wrangler 4 static-assets schema without a Worker entrypoint', async () => {
    const config = parseJsonc(await readFile(artifactUrls.config, 'utf8')) as Record<string, unknown>;
    expect(config).toEqual({
      $schema: './node_modules/wrangler/config-schema.json',
      name: 'tech-log',
      compatibility_date: '2026-07-11',
      assets: { directory: './dist', not_found_handling: '404-page' },
    });
    expect(config).not.toHaveProperty('main');
  });

  it('parses CI YAML and defines the exact pull-request verify job without secrets', async () => {
    const source = await readFile(artifactUrls.ci, 'utf8');
    const workflow = parse(source) as any;
    expect(workflow.name).toBe('CI');
    expect(workflow.on).toEqual({ pull_request: {} });
    expect(Object.keys(workflow.jobs)).toEqual(['verify']);
    expect(workflow.jobs.verify.name).toBe('verify');
    expect(workflow.jobs.verify['timeout-minutes']).toBe(20);
    const steps = workflow.jobs.verify.steps as any[];
    expect(steps.some(({ uses }) => uses === ACTIONS.checkout)).toBe(true);
    expect(steps.some(({ uses, with: input }) => uses === ACTIONS.setupNode && input?.['node-version'] === 24)).toBe(true);
    expect(steps.some(({ run }) => run === 'npm ci')).toBe(true);
    expect(steps.some(({ run }) => run === 'sudo apt-get update && sudo apt-get install -y libxml2-utils')).toBe(true);
    expect(steps.some(({ run }) => run === 'npx playwright install --with-deps chromium')).toBe(true);
    expect(steps.some(({ run }) => run === 'SITE_URL=https://example.invalid npm run verify')).toBe(true);
    expect(source).not.toMatch(/\b(?:secrets|vars)\./);
    expect(source).toMatch(new RegExp(`uses: ${ACTIONS.checkout.replace('/', '\\/')} # v4\\.3\\.1`));
    expect(source).toMatch(new RegExp(`uses: ${ACTIONS.setupNode.replace('/', '\\/')} # v4\\.4\\.0`));
    expect(source).not.toMatch(/uses:\s+[^\s]+@v\d/);
  });

  it('parses deploy YAML and orders verify, deploy action, then mandatory smoke', async () => {
    const source = await readFile(artifactUrls.deploy, 'utf8');
    const workflow = parse(source) as any;
    expect(workflow.name).toBe('Deploy');
    expect(workflow.on).toEqual({ push: { branches: ['main'] } });
    expect(workflow.concurrency).toEqual({ group: 'tech-log-production', 'cancel-in-progress': true });
    expect(workflow.jobs.deploy['timeout-minutes']).toBe(25);
    const steps = workflow.jobs.deploy.steps as any[];
    expect(steps.some(({ uses }) => uses === ACTIONS.checkout)).toBe(true);
    expect(steps.some(({ uses, with: input }) => uses === ACTIONS.setupNode && input?.['node-version'] === 24)).toBe(true);
    expect(steps.some(({ run }) => run === 'npm ci')).toBe(true);
    expect(steps.some(({ run }) => run === 'sudo apt-get update && sudo apt-get install -y libxml2-utils')).toBe(true);
    expect(steps.some(({ run }) => run === 'npx playwright install --with-deps chromium')).toBe(true);
    const verifyIndex = steps.findIndex(({ run }) => run === 'npm run verify');
    const validationIndex = steps.findIndex(({ run }) => run === 'npm run validate:production');
    const productionBuildIndex = steps.findIndex(({ run }) => run === 'npm run build');
    const buildCheckIndex = steps.findIndex(({ run }) => run === 'node scripts/verify-production-build.mjs');
    const deployIndex = steps.findIndex(({ uses }) => uses === ACTIONS.wrangler);
    const smokeIndex = steps.findIndex(({ run }) => run === 'node scripts/smoke-production.mjs');
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeGreaterThan(verifyIndex);
    expect(productionBuildIndex).toBeGreaterThan(validationIndex);
    expect(buildCheckIndex).toBeGreaterThan(productionBuildIndex);
    expect(deployIndex).toBeGreaterThan(buildCheckIndex);
    expect(smokeIndex).toBeGreaterThan(deployIndex);
    expect(steps[deployIndex].with).toMatchObject({
      apiToken: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      accountId: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
      command: 'deploy',
    });
    expect(steps[smokeIndex]).toMatchObject({ env: { SITE_URL: '${{ vars.SITE_URL }}' } });
    expect(steps[smokeIndex]).not.toHaveProperty('if');
    expect(steps[smokeIndex]).not.toHaveProperty('continue-on-error');
    expect(workflow.jobs.deploy.env).toEqual({ SITE_URL: '${{ vars.SITE_URL }}' });
    expect(steps[productionBuildIndex]).toMatchObject({
      env: {
        PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: '${{ secrets.CLOUDFLARE_WEB_ANALYTICS_TOKEN }}',
        PUBLIC_GOOGLE_SITE_VERIFICATION: '${{ vars.PUBLIC_GOOGLE_SITE_VERIFICATION }}',
      },
    });
    expect(steps[buildCheckIndex]).toMatchObject({
      env: {
        PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: '${{ secrets.CLOUDFLARE_WEB_ANALYTICS_TOKEN }}',
        PUBLIC_GOOGLE_SITE_VERIFICATION: '${{ vars.PUBLIC_GOOGLE_SITE_VERIFICATION }}',
      },
    });
    expect(source).toMatch(new RegExp(`uses: ${ACTIONS.checkout.replace('/', '\\/')} # v4\\.3\\.1`));
    expect(source).toMatch(new RegExp(`uses: ${ACTIONS.setupNode.replace('/', '\\/')} # v4\\.4\\.0`));
    expect(source).toMatch(new RegExp(`uses: ${ACTIONS.wrangler.replace('/', '\\/')} # v3\\.15\\.0`));
    expect(source).not.toMatch(/uses:\s+[^\s]+@v\d/);
  });
});

describe('production build origin verification', () => {
  it('accepts canonical, OGP, RSS, and sitemap output only from SITE_URL', async () => {
    const { productionBuildErrors } = await import('../../scripts/verify-production-build.mjs');
    const origin = 'https://techlog.example';
    const analyticsToken = 'public-analytics-token';
    const googleSiteVerification = 'test-verification-token';
    const analyticsConfig = `<template data-allowed-hostname="${new URL(origin).hostname}" id="cloudflare-web-analytics-config" data-token="${analyticsToken}"></template>`;
    const distDir = await mkdtemp(join(tmpdir(), 'tech-log-production-build-'));
    try {
      await mkdir(join(distDir, 'blog/build-tech-blog-with-astro-2026'), { recursive: true });
      await mkdir(join(distDir, 'about'), { recursive: true });
      await writeFile(
        join(distDir, 'index.html'),
        `<meta name="google-site-verification" content="${googleSiteVerification}"><link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/og-default.png">${analyticsConfig}`,
      );
      await writeFile(
        join(distDir, 'blog/build-tech-blog-with-astro-2026/index.html'),
        `<link rel="canonical" href="${origin}/blog/build-tech-blog-with-astro-2026/"><meta property="og:url" content="${origin}/blog/build-tech-blog-with-astro-2026/">`,
      );
      await writeFile(join(distDir, 'rss.xml'), `<link>${origin}/</link><link>${origin}/blog/build-tech-blog-with-astro-2026/</link>`);
      await writeFile(join(distDir, 'sitemap-index.xml'), `<loc>${origin}/sitemap-0.xml</loc>`);
      await writeFile(join(distDir, 'sitemap-0.xml'), `<loc>${origin}/</loc>`);
      await writeFile(join(distDir, 'about/index.html'), `<link rel="canonical" href="${origin}/about/">`);
      for (const siteUrl of [origin, `${origin}/`]) {
        await expect(productionBuildErrors({ siteUrl, distDir, googleSiteVerification, analyticsToken })).resolves.toEqual([]);
      }

      const missingVerification = await productionBuildErrors({
        siteUrl: origin,
        distDir,
        googleSiteVerification: '   ',
        analyticsToken,
      });
      expect(missingVerification.join('\n')).toMatch(/verification/i);
      expect(missingVerification.join('\n')).not.toContain(googleSiteVerification);

      await writeFile(
        join(distDir, 'index.html'),
        `<meta name="google-site-verification" content="${googleSiteVerification}"><meta name="google-site-verification" content="other"><link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/og-default.png">${analyticsConfig}`,
      );
      const duplicateVerification = await productionBuildErrors({ siteUrl: origin, distDir, googleSiteVerification, analyticsToken });
      expect(duplicateVerification.join('\n')).toMatch(/exactly one verification tag/i);
      expect(duplicateVerification.join('\n')).not.toContain(googleSiteVerification);

      await writeFile(
        join(distDir, 'index.html'),
        `<meta name="google-site-verification" content="wrong"><link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/og-default.png">${analyticsConfig}`,
      );
      const mismatchedVerification = await productionBuildErrors({ siteUrl: origin, distDir, googleSiteVerification, analyticsToken });
      expect(mismatchedVerification.join('\n')).toMatch(/verification tag content/i);
      expect(mismatchedVerification.join('\n')).not.toContain(googleSiteVerification);

      await writeFile(
        join(distDir, 'index.html'),
        `<meta name="google-site-verification" content="${googleSiteVerification}"><link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/og-default.png">${analyticsConfig}`,
      );

      for (const invalidSiteUrl of [
        `${origin}/path`,
        `${origin}/?query=value`,
        `${origin}/#fragment`,
        'https://user:password@techlog.example/',
      ]) {
        const validationErrors = await productionBuildErrors({
          siteUrl: invalidSiteUrl,
          distDir,
          googleSiteVerification,
          analyticsToken,
        });
        expect(validationErrors.join('\n')).toMatch(/origin without credentials, a path, query, or fragment/i);
        expect(validationErrors.join('\n')).not.toContain('password');
      }

      await writeFile(join(distDir, 'about/index.html'), '<link href="https://example.invalid/about/"><secret>body-must-not-leak</secret>');
      const errors = await productionBuildErrors({ siteUrl: origin, distDir, googleSiteVerification, analyticsToken });
      expect(errors.join('\n')).toMatch(/about[/\\]index\.html/);
      expect(errors.join('\n')).not.toContain('body-must-not-leak');
    } finally {
      await rm(distDir, { recursive: true, force: true });
    }
  });

  it('rejects missing, duplicate, or mismatched Cloudflare Web Analytics configuration without leaking secrets', async () => {
    const { productionBuildErrors } = await import('../../scripts/verify-production-build.mjs');
    const origin = 'https://techlog.example';
    const analyticsToken = 'public-analytics-token';
    const googleSiteVerification = 'test-verification-token';
    const fixtureBody = 'fixture-body-must-not-leak';
    const distDir = await mkdtemp(join(tmpdir(), 'tech-log-production-build-'));
    const originalAnalyticsToken = process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
    delete process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
    const baseIndex = `<meta name="google-site-verification" content="${googleSiteVerification}"><link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/og-default.png"><p>${fixtureBody}</p>`;
    const config = (token = analyticsToken, hostname = new URL(origin).hostname) =>
      `<template data-allowed-hostname="${hostname}" data-token="${token}" id="cloudflare-web-analytics-config"></template>`;

    try {
      await mkdir(join(distDir, 'blog/build-tech-blog-with-astro-2026'), { recursive: true });
      await writeFile(
        join(distDir, 'blog/build-tech-blog-with-astro-2026/index.html'),
        `<link rel="canonical" href="${origin}/blog/build-tech-blog-with-astro-2026/"><meta property="og:url" content="${origin}/blog/build-tech-blog-with-astro-2026/">`,
      );
      await writeFile(join(distDir, 'rss.xml'), `<link>${origin}/</link><link>${origin}/blog/build-tech-blog-with-astro-2026/</link>`);
      await writeFile(join(distDir, 'sitemap-index.xml'), `<loc>${origin}/sitemap-0.xml</loc>`);
      await writeFile(join(distDir, 'sitemap-0.xml'), `<loc>${origin}/</loc>`);

      const verify = async (index: string, configuredToken?: string) => {
        await writeFile(join(distDir, 'index.html'), index);
        const errors = await productionBuildErrors({
          siteUrl: origin,
          distDir,
          googleSiteVerification,
          ...(configuredToken === undefined ? {} : { analyticsToken: configuredToken }),
        });
        expect(errors.join('\n')).not.toContain(analyticsToken);
        expect(errors.join('\n')).not.toContain(fixtureBody);
        return errors;
      };

      await expect(verify(`${baseIndex}${config()}`, ` ${analyticsToken} `)).resolves.toEqual([]);
      await expect(verify(baseIndex, analyticsToken)).resolves.toEqual(
        expect.arrayContaining([expect.stringMatching(/exactly one analytics config/i)]),
      );
      await expect(verify(`${baseIndex}${config()}${config()}`, analyticsToken)).resolves.toEqual(
        expect.arrayContaining([expect.stringMatching(/exactly one analytics config/i)]),
      );
      await expect(verify(`${baseIndex}${config(analyticsToken, 'other.example')}`, analyticsToken)).resolves.toEqual(
        expect.arrayContaining([expect.stringMatching(/analytics config hostname/i)]),
      );
      await expect(verify(`${baseIndex}${config('wrong-token')}`, analyticsToken)).resolves.toEqual(
        expect.arrayContaining([expect.stringMatching(/analytics config token/i)]),
      );
      await expect(verify(`${baseIndex}<template data-id="cloudflare-web-analytics-config"></template>`, analyticsToken)).resolves.toEqual(
        expect.arrayContaining([expect.stringMatching(/exactly one analytics config/i)]),
      );
      await expect(
        verify(
          `${baseIndex}<template data-id="not-the-config" id="cloudflare-web-analytics-config" other-data-token="wrong-token" data-token="${analyticsToken}" other-data-allowed-hostname="wrong.example" data-allowed-hostname="${new URL(origin).hostname}"></template>`,
          analyticsToken,
        ),
      ).resolves.toEqual([]);
      await expect(
        verify(
          `${baseIndex}<template title=' id="cloudflare-web-analytics-config" data-token="${analyticsToken}" data-allowed-hostname="${new URL(origin).hostname}"'></template>`,
          analyticsToken,
        ),
      ).resolves.toEqual(expect.arrayContaining([expect.stringMatching(/exactly one analytics config/i)]));
      await expect(
        verify(
          `${baseIndex}<template id="cloudflare-web-analytics-config' data-token="${analyticsToken}" data-allowed-hostname="${new URL(origin).hostname}"></template>`,
          analyticsToken,
        ),
      ).resolves.toEqual(expect.arrayContaining([expect.stringMatching(/exactly one analytics config/i)]));
      const decoyConfig = config();
      const decoyResults = [];
      for (const decoy of [
        `<!-- ${decoyConfig} -->`,
        `<script>const decoy = '${decoyConfig}'</script>`,
        `<div title='${decoyConfig}'></div>`,
        `<noscript>${decoyConfig}</noscript>`,
        `<xmp>${decoyConfig}</xmp>`,
        `<template id="unrelated-wrapper">${decoyConfig}</template>`,
      ]) {
        decoyResults.push(await verify(`${baseIndex}${decoy}`, analyticsToken));
      }
      for (const errors of decoyResults) {
        expect(errors).toEqual(expect.arrayContaining([expect.stringMatching(/exactly one analytics config/i)]));
      }
      for (const configuredToken of [undefined, '   ']) {
        await expect(verify(`${baseIndex}${config()}`, configuredToken)).resolves.toEqual(
          expect.arrayContaining([expect.stringMatching(/analytics config.*not configured/i)]),
        );
      }
    } finally {
      if (originalAnalyticsToken === undefined) delete process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
      else process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN = originalAnalyticsToken;
      await rm(distDir, { recursive: true, force: true });
    }
  });
});

describe('post-deploy smoke checks', () => {
  const demoSecurityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
    'X-Robots-Tag': 'noindex, follow',
  } as const;
  const demoCacheControl = 'public, max-age=0, must-revalidate';
  const demoGlbSha256 = '42114017b88bc45862e598de271ca05ce7df0e3f227197fc65941658794e552a';
  const successfulDemoResponse = async (pathname: string) => {
    const headers = (contentType: string) => ({
      ...demoSecurityHeaders,
      'Content-Type': contentType,
      'Cache-Control': demoCacheControl,
    });
    if (pathname === '/demos/server-room') {
      return new Response(null, { status: 307, headers: { Location: '/demos/server-room/' } });
    }
    if (pathname === '/demos/server-room/') {
      return new Response(
        '<link rel="stylesheet" href="/demos/server-room/assets/app.css"><script type="module" src="/demos/server-room/assets/app.js"></script>',
        { headers: headers('text/html; charset=utf-8') },
      );
    }
    if (pathname === '/demos/server-room/assets/app.js') {
      return new Response('export {};', { headers: headers('application/javascript') });
    }
    if (pathname === '/demos/server-room/assets/app.css') {
      return new Response('body {}', { headers: headers('text/css') });
    }
    if (pathname === '/demos/server-room/models/server-room.glb') {
      return new Response(await readFile(new URL('../../demos/server-room/public/models/server-room.glb', import.meta.url)), {
        headers: headers('model/gltf-binary'),
      });
    }
    return undefined;
  };

  it('provides focused helpers for retry, exact headers, same-subpath assets, and response hashing', async () => {
    const { assertHeader, extractDemoAssets, fetchWithRetry, sha256Response } = await import('../../scripts/smoke-production.mjs');
    const attempts: number[] = [];
    const response = await fetchWithRetry(
      async () => {
        attempts.push(attempts.length);
        return new Response(null, { status: attempts.length === 1 ? 503 : 200 });
      },
      {
        path: '/asset.js',
        maxRetries: 1,
        retryDelayMs: 0,
        sleepImpl: async () => undefined,
      },
    );
    expect(response.status).toBe(200);
    expect(attempts).toHaveLength(2);

    await expect(
      fetchWithRetry(async () => new Response(null, { status: 429 }), {
        path: '/asset.js',
        maxRetries: 6,
        retryDelayMs: 0,
        sleepImpl: async () => undefined,
      }),
    ).rejects.toThrow(/expected 2xx, received 429/i);

    expect(() => assertHeader(new Headers({ 'x-test': 'exact' }), 'X-Test', 'exact', '/asset.js')).not.toThrow();
    expect(() => assertHeader(new Headers({ 'x-test': 'almost' }), 'X-Test', 'exact', '/asset.js')).toThrow(/X-Test/i);

    const html = `
      <link rel="stylesheet" href="/demos/server-room/assets/app.abc.css">
      <script type="module" src="/demos/server-room/assets/app.def.js"></script>`;
    expect(extractDemoAssets(html, new URL('https://techlog.example/demos/server-room/'))).toEqual({
      scriptUrl: new URL('https://techlog.example/demos/server-room/assets/app.def.js'),
      stylesheetUrl: new URL('https://techlog.example/demos/server-room/assets/app.abc.css'),
    });
    expect(() =>
      extractDemoAssets(
        '<script type="module" src="https://attacker.invalid/app.js"></script><link rel="stylesheet" href="/app.css">',
        new URL('https://techlog.example/demos/server-room/'),
      ),
    ).toThrow(/same demo subpath/i);

    await expect(sha256Response(new Response('abc'))).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('verifies the complete public demo redirect, asset, header, MIME, cache, and GLB-byte contract', async () => {
    const { smokeProduction, SMOKE_PATHS } = await import('../../scripts/smoke-production.mjs');
    const glb = await readFile(new URL('../../demos/server-room/public/models/server-room.glb', import.meta.url));
    const html = `<!doctype html>
      <link rel="stylesheet" href="/demos/server-room/assets/app.abc.css">
      <script type="module" src="/demos/server-room/assets/app.def.js"></script>`;
    const requested: string[] = [];
    const assetHeaders = (contentType: string) => ({
      ...demoSecurityHeaders,
      'Content-Type': contentType,
      'Cache-Control': demoCacheControl,
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(init?.redirect).toBe('manual');
      const url = new URL(input instanceof Request ? input.url : String(input));
      requested.push(url.href);
      if (url.pathname === SMOKE_PATHS.demo.redirect) {
        return new Response(null, { status: 307, headers: { Location: SMOKE_PATHS.demo.html } });
      }
      if (url.pathname === SMOKE_PATHS.demo.html) {
        return new Response(html, { status: 200, headers: assetHeaders('text/html; charset=utf-8') });
      }
      if (url.pathname === '/demos/server-room/assets/app.def.js') {
        return new Response('export {};', { status: 200, headers: assetHeaders('text/javascript; charset=utf-8') });
      }
      if (url.pathname === '/demos/server-room/assets/app.abc.css') {
        return new Response('body {}', { status: 200, headers: assetHeaders('text/css; charset=utf-8') });
      }
      if (url.pathname === SMOKE_PATHS.demo.glb) {
        return new Response(glb, { status: 200, headers: assetHeaders('model/gltf-binary') });
      }
      return new Response(null, { status: url.pathname === SMOKE_PATHS.missing ? 404 : 204 });
    };

    await expect(smokeProduction({ siteUrl: 'https://techlog.example', fetchImpl })).resolves.toBeUndefined();
    expect(requested).toEqual([
      'https://techlog.example/',
      'https://techlog.example/blog/build-tech-blog-with-astro-2026/',
      'https://techlog.example/rss.xml',
      'https://techlog.example/sitemap-index.xml',
      `https://techlog.example${SMOKE_PATHS.missing}`,
      'https://techlog.example/demos/server-room',
      'https://techlog.example/demos/server-room/',
      'https://techlog.example/demos/server-room/assets/app.def.js',
      'https://techlog.example/demos/server-room/assets/app.abc.css',
      'https://techlog.example/demos/server-room/models/server-room.glb',
    ]);
    expect(demoGlbSha256).toBe('42114017b88bc45862e598de271ca05ce7df0e3f227197fc65941658794e552a');
  });

  it('rejects each mutated demo redirect, MIME, security header, cache value, and GLB body', async () => {
    const { smokeProduction, SMOKE_PATHS } = await import('../../scripts/smoke-production.mjs');
    const demoAssets = [
      SMOKE_PATHS.demo.html,
      '/demos/server-room/assets/app.js',
      '/demos/server-room/assets/app.css',
      SMOKE_PATHS.demo.glb,
    ];
    const mutations = [
      { target: SMOKE_PATHS.demo.redirect, status: 308, error: /expected 307, received 308/i },
      { target: SMOKE_PATHS.demo.redirect, header: ['Location', '/wrong/'], error: /Location header/i },
      ...demoAssets.flatMap((target) =>
        Object.keys(demoSecurityHeaders).map((name) => ({ target, header: [name, 'wrong'], error: new RegExp(name, 'i') })),
      ),
      ...demoAssets.map((target) => ({ target, header: ['Cache-Control', 'no-cache'], error: /Cache-Control header/i })),
      { target: SMOKE_PATHS.demo.html, header: ['Content-Type', 'text/plain'], error: /Content-Type/i },
      { target: '/demos/server-room/assets/app.js', header: ['Content-Type', 'text/plain'], error: /Content-Type/i },
      { target: '/demos/server-room/assets/app.css', header: ['Content-Type', 'text/plain'], error: /Content-Type/i },
      { target: SMOKE_PATHS.demo.glb, header: ['Content-Type', 'application/octet-stream'], error: /Content-Type/i },
      { target: SMOKE_PATHS.demo.glb, body: new TextEncoder().encode('tampered GLB'), error: /SHA-256/i },
    ] as const;

    for (const mutation of mutations) {
      const fetchImpl: typeof fetch = async (input) => {
        const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname;
        const original = await successfulDemoResponse(pathname);
        if (!original) return new Response(null, { status: pathname === SMOKE_PATHS.missing ? 404 : 204 });
        if (pathname !== mutation.target) return original;

        const headers = new Headers(original.headers);
        if ('header' in mutation) headers.set(mutation.header[0], mutation.header[1]);
        const body = 'body' in mutation ? mutation.body : await original.arrayBuffer();
        return new Response(body, {
          status: 'status' in mutation ? mutation.status : original.status,
          headers,
        });
      };

      await expect(
        smokeProduction({
          siteUrl: 'https://techlog.example',
          fetchImpl,
          maxRetries: 0,
        }),
        `${mutation.target} must reject its mutation`,
      ).rejects.toThrow(mutation.error);
    }
  });

  it('checks four public resources as 2xx and a missing resource as 404 without reading bodies', async () => {
    const { smokeProduction, SMOKE_PATHS } = await import('../../scripts/smoke-production.mjs');
    const requested: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(init?.redirect).toBe('manual');
      const url = input instanceof Request ? input.url : String(input);
      const pathname = new URL(url).pathname;
      requested.push(url);
      const demoResponse = await successfulDemoResponse(pathname);
      if (demoResponse) return demoResponse;
      return new Response(null, { status: pathname === SMOKE_PATHS.missing ? 404 : 204 });
    };
    await expect(smokeProduction({ siteUrl: 'https://techlog.example', fetchImpl })).resolves.toBeUndefined();
    expect(requested).toEqual([
      'https://techlog.example/',
      'https://techlog.example/blog/build-tech-blog-with-astro-2026/',
      'https://techlog.example/rss.xml',
      'https://techlog.example/sitemap-index.xml',
      `https://techlog.example${SMOKE_PATHS.missing}`,
      'https://techlog.example/demos/server-room',
      'https://techlog.example/demos/server-room/',
      'https://techlog.example/demos/server-room/assets/app.js',
      'https://techlog.example/demos/server-room/assets/app.css',
      'https://techlog.example/demos/server-room/models/server-room.glb',
    ]);
  });

  it('retries transient 404 and 5xx responses while Workers assets propagate', async () => {
    const { smokeProduction, SMOKE_PATHS } = await import('../../scripts/smoke-production.mjs');
    const transientStatuses = [404, 503, 204];
    const sleepCalls: number[] = [];
    let rootAttempts = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname;
      if (pathname === '/') return new Response(null, { status: transientStatuses[rootAttempts++] ?? 204 });
      const demoResponse = await successfulDemoResponse(pathname);
      if (demoResponse) return demoResponse;
      return new Response(null, { status: pathname === SMOKE_PATHS.missing ? 404 : 204 });
    };

    await expect(
      smokeProduction({
        siteUrl: 'https://techlog.example',
        fetchImpl,
        sleepImpl: async (delayMs: number) => {
          sleepCalls.push(delayMs);
        },
      }),
    ).resolves.toBeUndefined();
    expect(rootAttempts).toBe(3);
    expect(sleepCalls).toEqual([5_000, 5_000]);
  });

  it('stops retrying a transient public-resource failure after a 30 second delay budget', async () => {
    const { smokeProduction } = await import('../../scripts/smoke-production.mjs');
    const sleepCalls: number[] = [];
    let attempts = 0;

    await expect(
      smokeProduction({
        siteUrl: 'https://techlog.example',
        fetchImpl: async () => {
          attempts += 1;
          return new Response(null, { status: 404 });
        },
        sleepImpl: async (delayMs: number) => {
          sleepCalls.push(delayMs);
        },
      }),
    ).rejects.toThrow(/expected 2xx, received 404/i);
    expect(attempts).toBe(7);
    expect(sleepCalls).toEqual(Array(6).fill(5_000));
  });

  it('reports status, timeout, and network failures clearly without leaking a response body', async () => {
    const { smokeProduction } = await import('../../scripts/smoke-production.mjs');
    const bodySecret = 'response-body-must-not-be-logged';
    await expect(
      smokeProduction({
        siteUrl: 'https://techlog.example/',
        fetchImpl: async () => new Response(bodySecret, { status: 500 }),
        maxRetries: 0,
      }),
    ).rejects.not.toThrow(bodySecret);
    await expect(
      smokeProduction({
        siteUrl: 'https://techlog.example',
        fetchImpl: async () => {
          throw Object.assign(new Error('socket details'), { name: 'TimeoutError' });
        },
      }),
    ).rejects.toThrow(/timed out.*\//i);
    await expect(
      smokeProduction({
        siteUrl: 'https://techlog.example',
        fetchImpl: async () => {
          throw new Error('private network details');
        },
      }),
    ).rejects.toThrow(/request failed.*\//i);
  });

  it.each([
    [301, 'https://techlog.example/other'],
    [302, 'https://attacker.invalid/collect'],
  ])('rejects direct-path redirect %s without following or logging its location', async (status, location) => {
    const { smokeProduction } = await import('../../scripts/smoke-production.mjs');
    let error: unknown;
    try {
      await smokeProduction({
        siteUrl: 'https://techlog.example',
        fetchImpl: async (_input, init) => {
          expect(init?.redirect).toBe('manual');
          return new Response(null, { status, headers: { location } });
        },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    const message = error instanceof Error ? error.message : '';
    expect(message).toMatch(/expected 2xx.*received 30[12]/i);
    expect(message).not.toContain(location);
  });

  it('rejects invalid origins and exposes an executable CLI guard', async () => {
    const { smokeProduction } = await import('../../scripts/smoke-production.mjs');
    await expect(smokeProduction({ siteUrl: 'http://techlog.example', fetchImpl: fetch })).rejects.toThrow(/HTTPS/);
    const result = spawnSync(process.execPath, [fileURLToPath(artifactUrls.smoke)], {
      cwd: projectRoot,
      env: { ...process.env, SITE_URL: 'http://techlog.example' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/HTTPS/);
  });
});
