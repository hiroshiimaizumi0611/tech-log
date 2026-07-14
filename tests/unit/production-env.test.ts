import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { productionEnvErrors } from '../../scripts/validate-production-env.mjs';
import { siteUrlError } from '../../scripts/validate-site-url.mjs';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

function run(command: string, args: string[], overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return spawnSync(command, args, { cwd: projectRoot, env, encoding: 'utf8' });
}

describe('SITE_URL validation', () => {
  it('accepts only a valid HTTPS origin without credentials, query, or hash', () => {
    expect(siteUrlError('https://techlog.example')).toBeUndefined();
    expect(siteUrlError(undefined)).toMatch(/SITE_URL/);
    expect(siteUrlError('http://techlog.example')).toMatch(/HTTPS/);
    expect(siteUrlError('not a URL')).toMatch(/HTTPS URL/);
    expect(siteUrlError('https://user:pass@techlog.example')).toMatch(/origin/);
    expect(siteUrlError('https://techlog.example/path')).toMatch(/origin/);
  });

  it('runs its CLI main guard and returns the correct exit code', () => {
    const script = fileURLToPath(new URL('../../scripts/validate-site-url.mjs', import.meta.url));
    expect(run(process.execPath, [script], { SITE_URL: undefined }).status).toBe(1);
    expect(run(process.execPath, [script], { SITE_URL: 'http://techlog.example' }).status).toBe(1);
    expect(run(process.execPath, [script], { SITE_URL: 'https://techlog.example' }).status).toBe(0);
  });

  it('connects validation to npm prebuild and renders one safe analytics beacon', () => {
    expect(run('npm', ['run', 'build'], { SITE_URL: undefined }).status).toBe(1);
    expect(run('npm', ['run', 'build'], { SITE_URL: 'http://techlog.example' }).status).toBe(1);

    const token = 'automated-public-analytics-token';
    const built = run('npm', ['run', 'build'], {
      NODE_ENV: 'production',
      DEV: undefined,
      MODE: undefined,
      PROD: undefined,
      VITEST: undefined,
      VITEST_MODE: undefined,
      VITEST_POOL_ID: undefined,
      VITEST_WORKER_ID: undefined,
      SITE_URL: 'https://example.invalid',
      PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: token,
      PUBLIC_GOOGLE_SITE_VERIFICATION: 'test-verification-token',
    });
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0);
    expect(`${built.stdout}\n${built.stderr}`).not.toContain(token);

    const html = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
    expect(html.match(/name="google-site-verification"/g)).toHaveLength(1);
    expect(html).toContain('name="google-site-verification" content="test-verification-token"');
    expect(html.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g)).toHaveLength(1);
    const encoded = /data-cf-beacon="([^"]+)"/.exec(html)?.[1];
    expect(encoded).toBeDefined();
    expect(JSON.parse(encoded!.replaceAll('&quot;', '"'))).toEqual({ token });

    for (const verification of [undefined, '   ']) {
      const withoutVerification = run('npm', ['run', 'build'], {
        NODE_ENV: 'production',
        DEV: undefined,
        MODE: undefined,
        PROD: undefined,
        VITEST: undefined,
        VITEST_MODE: undefined,
        VITEST_POOL_ID: undefined,
        VITEST_WORKER_ID: undefined,
        SITE_URL: 'https://example.invalid',
        PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: undefined,
        PUBLIC_GOOGLE_SITE_VERIFICATION: verification,
      });
      expect(withoutVerification.status, `${withoutVerification.stdout}\n${withoutVerification.stderr}`).toBe(0);
      const htmlWithoutVerification = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
      expect(htmlWithoutVerification).not.toContain('name="google-site-verification"');
    }
  }, 30_000);
});

describe('production environment validation', () => {
  it('requires Cloudflare credentials and HTTPS SITE_URL but not analytics', () => {
    expect(productionEnvErrors({})).toEqual([
      expect.stringContaining('SITE_URL'),
      expect.stringContaining('CLOUDFLARE_ACCOUNT_ID'),
      expect.stringContaining('CLOUDFLARE_API_TOKEN'),
    ]);
    expect(
      productionEnvErrors({
        SITE_URL: 'https://techlog.example',
        CLOUDFLARE_ACCOUNT_ID: 'account',
        CLOUDFLARE_API_TOKEN: 'token',
      }),
    ).toEqual([]);
  });

  it('never includes credential values in errors', () => {
    const secret = 'do-not-print-this-token';
    expect(
      productionEnvErrors({ SITE_URL: 'http://techlog.example', CLOUDFLARE_ACCOUNT_ID: secret, CLOUDFLARE_API_TOKEN: secret }).join('\n'),
    ).not.toContain(secret);
  });

  it('CLI reports each missing deployment credential and keeps analytics optional', () => {
    const script = fileURLToPath(new URL('../../scripts/validate-production-env.mjs', import.meta.url));
    const base = {
      SITE_URL: 'https://techlog.example',
      CLOUDFLARE_ACCOUNT_ID: 'account-secret-value',
      CLOUDFLARE_API_TOKEN: 'api-secret-value',
      PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: undefined,
    };
    const missingAccount = run(process.execPath, [script], { ...base, CLOUDFLARE_ACCOUNT_ID: undefined });
    expect(missingAccount.status).toBe(1);
    expect(missingAccount.stderr).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(missingAccount.stderr).not.toContain(base.CLOUDFLARE_API_TOKEN);

    const missingToken = run(process.execPath, [script], { ...base, CLOUDFLARE_API_TOKEN: undefined });
    expect(missingToken.status).toBe(1);
    expect(missingToken.stderr).toContain('CLOUDFLARE_API_TOKEN');
    expect(missingToken.stderr).not.toContain(base.CLOUDFLARE_ACCOUNT_ID);

    expect(run(process.execPath, [script], base).status).toBe(0);
  });
});
