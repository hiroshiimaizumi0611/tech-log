import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { siteUrlError } from './validate-site-url.mjs';

export const SMOKE_PATHS = Object.freeze({
  public: ['/', '/blog/build-tech-blog-with-astro-2026/', '/rss.xml', '/sitemap-index.xml'],
  missing: '/smoke-check-this-path-must-not-exist/',
});

const sleep = (delayMs) => new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));

export async function smokeProduction({
  siteUrl = process.env.SITE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
  maxRetries = 6,
  retryDelayMs = 5_000,
  sleepImpl = sleep,
} = {}) {
  const validationError = siteUrlError(siteUrl);
  if (validationError) throw new Error(validationError);
  if (typeof fetchImpl !== 'function') throw new Error('Production smoke checks require a fetch implementation.');
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new Error('Production smoke maxRetries must be a non-negative integer.');
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new Error('Production smoke retryDelayMs must be non-negative.');
  if (typeof sleepImpl !== 'function') throw new Error('Production smoke checks require a sleep implementation.');

  const checks = [...SMOKE_PATHS.public.map((path) => ({ path, expected: '2xx' })), { path: SMOKE_PATHS.missing, expected: '404' }];
  let retriesRemaining = maxRetries;

  for (const { path, expected } of checks) {
    for (;;) {
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
        if (response.status !== 404)
          throw new Error(`Production smoke check failed for ${path}: expected 404, received ${response.status}.`);
        break;
      }
      if (response.ok) break;

      const isTransient = response.status === 404 || response.status >= 500;
      if (!isTransient || retriesRemaining === 0) {
        throw new Error(`Production smoke check failed for ${path}: expected 2xx, received ${response.status}.`);
      }
      retriesRemaining -= 1;
      await sleepImpl(retryDelayMs);
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
