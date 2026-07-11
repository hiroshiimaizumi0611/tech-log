import { describe, expect, it } from 'vitest';

import { productionEnvErrors } from '../../scripts/validate-production-env.mjs';
import { siteUrlError } from '../../scripts/validate-site-url.mjs';

describe('SITE_URL validation', () => {
  it('accepts only a valid HTTPS origin without credentials, query, or hash', () => {
    expect(siteUrlError('https://techlog.example')).toBeUndefined();
    expect(siteUrlError(undefined)).toMatch(/SITE_URL/);
    expect(siteUrlError('http://techlog.example')).toMatch(/HTTPS/);
    expect(siteUrlError('not a URL')).toMatch(/HTTPS URL/);
    expect(siteUrlError('https://user:pass@techlog.example')).toMatch(/origin/);
    expect(siteUrlError('https://techlog.example/path')).toMatch(/origin/);
  });
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
});
