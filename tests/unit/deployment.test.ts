import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
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
};

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
    const steps = workflow.jobs.verify.steps as any[];
    expect(steps.some(({ uses }) => uses === 'actions/checkout@v4')).toBe(true);
    expect(steps.some(({ uses, with: input }) => uses === 'actions/setup-node@v4' && input?.['node-version'] === 24)).toBe(true);
    expect(steps.some(({ run }) => run === 'npm ci')).toBe(true);
    expect(steps.some(({ run }) => run === 'npx playwright install --with-deps chromium')).toBe(true);
    expect(steps.some(({ run }) => run === 'SITE_URL=https://example.invalid npm run verify')).toBe(true);
    expect(source).not.toMatch(/\b(?:secrets|vars)\./);
  });

  it('parses deploy YAML and orders verify, deploy action, then mandatory smoke', async () => {
    const source = await readFile(artifactUrls.deploy, 'utf8');
    const workflow = parse(source) as any;
    expect(workflow.name).toBe('Deploy');
    expect(workflow.on).toEqual({ push: { branches: ['main'] } });
    const steps = workflow.jobs.deploy.steps as any[];
    expect(steps.some(({ uses }) => uses === 'actions/checkout@v4')).toBe(true);
    expect(steps.some(({ uses, with: input }) => uses === 'actions/setup-node@v4' && input?.['node-version'] === 24)).toBe(true);
    expect(steps.some(({ run }) => run === 'npm ci')).toBe(true);
    expect(steps.some(({ run }) => run === 'npx playwright install --with-deps chromium')).toBe(true);
    const verifyIndex = steps.findIndex(({ run }) => run === 'npm run verify');
    const deployIndex = steps.findIndex(({ uses }) => uses === 'cloudflare/wrangler-action@v3');
    const smokeIndex = steps.findIndex(({ run }) => run === 'node scripts/smoke-production.mjs');
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(deployIndex).toBeGreaterThan(verifyIndex);
    expect(smokeIndex).toBeGreaterThan(deployIndex);
    expect(steps[deployIndex].with).toMatchObject({
      apiToken: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      accountId: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
      command: 'deploy',
    });
    expect(steps[smokeIndex]).toMatchObject({ env: { SITE_URL: '${{ vars.SITE_URL }}' } });
    expect(steps[smokeIndex]).not.toHaveProperty('if');
    expect(steps[smokeIndex]).not.toHaveProperty('continue-on-error');
    expect(workflow.jobs.deploy.env).toMatchObject({
      SITE_URL: '${{ vars.SITE_URL }}',
      PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: '${{ vars.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN }}',
    });
  });
});

describe('post-deploy smoke checks', () => {
  it('checks four public resources as 2xx and a missing resource as 404 without reading bodies', async () => {
    const { smokeProduction, SMOKE_PATHS } = await import('../../scripts/smoke-production.mjs');
    const requested: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      const pathname = new URL(url).pathname;
      requested.push(url);
      return new Response(null, { status: pathname === SMOKE_PATHS.missing ? 404 : 204 });
    };
    await expect(smokeProduction({ siteUrl: 'https://techlog.example', fetchImpl })).resolves.toBeUndefined();
    expect(requested).toEqual([
      'https://techlog.example/',
      'https://techlog.example/blog/build-tech-blog-with-astro-2026/',
      'https://techlog.example/rss.xml',
      'https://techlog.example/sitemap-index.xml',
      `https://techlog.example${SMOKE_PATHS.missing}`,
    ]);
  });

  it('reports status, timeout, and network failures clearly without leaking a response body', async () => {
    const { smokeProduction } = await import('../../scripts/smoke-production.mjs');
    const bodySecret = 'response-body-must-not-be-logged';
    await expect(
      smokeProduction({ siteUrl: 'https://techlog.example/', fetchImpl: async () => new Response(bodySecret, { status: 500 }) }),
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
