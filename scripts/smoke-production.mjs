import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { siteUrlError } from './validate-site-url.mjs';

export const SMOKE_PATHS = Object.freeze({
  public: ['/', '/blog/build-tech-blog-with-astro-2026/', '/rss.xml', '/sitemap-index.xml'],
  missing: '/smoke-check-this-path-must-not-exist/',
});

export async function smokeProduction({ siteUrl = process.env.SITE_URL, fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  const validationError = siteUrlError(siteUrl);
  if (validationError) throw new Error(validationError);
  if (typeof fetchImpl !== 'function') throw new Error('Production smoke checks require a fetch implementation.');

  const checks = [...SMOKE_PATHS.public.map((path) => ({ path, expected: '2xx' })), { path: SMOKE_PATHS.missing, expected: '404' }];

  for (const { path, expected } of checks) {
    let response;
    try {
      response = await fetchImpl(new URL(path, siteUrl), {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : '';
      if (errorName === 'AbortError' || errorName === 'TimeoutError') {
        throw new Error(`Production smoke check timed out for ${path}.`);
      }
      throw new Error(`Production smoke check request failed for ${path}.`);
    }

    if (expected === '404') {
      if (response.status !== 404) throw new Error(`Production smoke check failed for ${path}: expected 404, received ${response.status}.`);
    } else if (!response.ok) {
      throw new Error(`Production smoke check failed for ${path}: expected 2xx, received ${response.status}.`);
    }
  }
}

async function main() {
  try {
    await smokeProduction();
    console.log('Production smoke checks passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Production smoke checks failed.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
