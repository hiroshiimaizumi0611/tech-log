import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'parse5';

import { siteUrlError } from './validate-site-url.mjs';

export const SMOKE_PATHS = Object.freeze({
  public: ['/', '/blog/build-tech-blog-with-astro-2026/', '/rss.xml', '/sitemap-index.xml'],
  missing: '/smoke-check-this-path-must-not-exist/',
  demo: Object.freeze({
    redirect: '/demos/server-room',
    html: '/demos/server-room/',
    glb: '/demos/server-room/models/server-room.glb',
  }),
});

export const DEMO_GLB_SHA256 = '42114017b88bc45862e598de271ca05ce7df0e3f227197fc65941658794e552a';

const DEMO_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const DEMO_SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
  'X-Robots-Tag': 'noindex, follow',
});

const sleep = (delayMs) => new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));

/**
 * @param {() => Promise<Response>} fetchOperation
 * @param {{
 *   path: string,
 *   maxRetries?: number,
 *   retryDelayMs?: number,
 *   sleepImpl?: (delayMs: number) => Promise<void>,
 *   retryBudget?: {remaining: number},
 *   accepts?: (response: Response) => boolean,
 *   expected?: string,
 * }} options
 */
export async function fetchWithRetry(
  fetchOperation,
  { path, maxRetries = 6, retryDelayMs = 5_000, sleepImpl = sleep, retryBudget, accepts = (response) => response.ok, expected = '2xx' },
) {
  const budget = retryBudget ?? { remaining: maxRetries };

  for (;;) {
    let response;
    try {
      response = await fetchOperation();
    } catch (error) {
      const errorName = error instanceof Error ? error.name : '';
      if (errorName === 'AbortError' || errorName === 'TimeoutError') {
        throw new Error(`Production smoke check timed out for ${path}.`);
      }
      throw new Error(`Production smoke check request failed for ${path}.`);
    }

    if (accepts(response)) return response;

    const isTransient = response.status === 404 || response.status >= 500;
    if (!isTransient || budget.remaining === 0) {
      throw new Error(`Production smoke check failed for ${path}: expected ${expected}, received ${response.status}.`);
    }
    budget.remaining -= 1;
    await sleepImpl(retryDelayMs);
  }
}

export function assertHeader(headers, name, expectedValue, path) {
  const actualValue = headers.get(name);
  if (actualValue !== expectedValue) {
    throw new Error(`Production smoke check failed for ${path}: ${name} header did not match the public contract.`);
  }
}

function attributes(node) {
  return Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
}

function descendants(node) {
  return [node, ...(node.childNodes ?? []).flatMap(descendants)];
}

export function extractDemoAssets(html, demoUrl) {
  const document = parse(html);
  const nodes = descendants(document);
  const scripts = nodes.filter((node) => node.nodeName === 'script' && attributes(node).type === 'module' && attributes(node).src);
  const stylesheets = nodes.filter(
    (node) => node.nodeName === 'link' && attributes(node).rel?.toLowerCase().split(/\s+/u).includes('stylesheet') && attributes(node).href,
  );

  if (scripts.length !== 1 || stylesheets.length !== 1) {
    throw new Error('Production smoke check failed for the demo HTML: expected one module script and one stylesheet.');
  }

  const scriptUrl = new URL(attributes(scripts[0]).src, demoUrl);
  const stylesheetUrl = new URL(attributes(stylesheets[0]).href, demoUrl);
  for (const assetUrl of [scriptUrl, stylesheetUrl]) {
    if (assetUrl.origin !== demoUrl.origin || !assetUrl.pathname.startsWith(demoUrl.pathname) || assetUrl.search || assetUrl.hash) {
      throw new Error('Production smoke check failed for the demo HTML: assets must use the same demo subpath.');
    }
  }

  return { scriptUrl, stylesheetUrl };
}

export async function sha256Response(response) {
  return createHash('sha256')
    .update(Buffer.from(await response.arrayBuffer()))
    .digest('hex');
}

function normalizedMime(response) {
  return (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
}

function assertMime(response, allowedMimes, path) {
  const mime = normalizedMime(response);
  if (!allowedMimes.includes(mime)) {
    throw new Error(`Production smoke check failed for ${path}: Content-Type did not match the public contract.`);
  }
}

function assertDemoAssetHeaders(response, path) {
  for (const [name, value] of Object.entries(DEMO_SECURITY_HEADERS)) assertHeader(response.headers, name, value, path);
  assertHeader(response.headers, 'Cache-Control', DEMO_CACHE_CONTROL, path);
}

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
  const retryBudget = { remaining: maxRetries };
  const request = (path) =>
    fetchImpl(new URL(path, siteUrl), {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

  for (const { path, expected } of checks) {
    await fetchWithRetry(() => request(path), {
      path,
      retryDelayMs,
      sleepImpl,
      retryBudget,
      accepts: expected === '404' ? (response) => response.status === 404 : (response) => response.ok,
      expected,
    });
  }

  const redirectResponse = await fetchWithRetry(() => request(SMOKE_PATHS.demo.redirect), {
    path: SMOKE_PATHS.demo.redirect,
    retryDelayMs,
    sleepImpl,
    retryBudget,
    accepts: (response) => response.status === 307,
    expected: '307',
  });
  assertHeader(redirectResponse.headers, 'Location', SMOKE_PATHS.demo.html, SMOKE_PATHS.demo.redirect);

  const htmlResponse = await fetchWithRetry(() => request(SMOKE_PATHS.demo.html), {
    path: SMOKE_PATHS.demo.html,
    retryDelayMs,
    sleepImpl,
    retryBudget,
  });
  assertMime(htmlResponse, ['text/html'], SMOKE_PATHS.demo.html);
  assertDemoAssetHeaders(htmlResponse, SMOKE_PATHS.demo.html);
  const demoUrl = new URL(SMOKE_PATHS.demo.html, siteUrl);
  const { scriptUrl, stylesheetUrl } = extractDemoAssets(await htmlResponse.text(), demoUrl);

  const assetContracts = [
    { url: scriptUrl, mimes: ['text/javascript', 'application/javascript'] },
    { url: stylesheetUrl, mimes: ['text/css'] },
    { url: new URL(SMOKE_PATHS.demo.glb, siteUrl), mimes: ['model/gltf-binary'] },
  ];
  for (const { url, mimes } of assetContracts) {
    const response = await fetchWithRetry(
      () =>
        fetchImpl(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs),
        }),
      {
        path: url.pathname,
        retryDelayMs,
        sleepImpl,
        retryBudget,
      },
    );
    assertMime(response, mimes, url.pathname);
    assertDemoAssetHeaders(response, url.pathname);
    if (url.pathname === SMOKE_PATHS.demo.glb) {
      const actualSha = await sha256Response(response);
      if (actualSha !== DEMO_GLB_SHA256) {
        throw new Error(`Production smoke check failed for ${url.pathname}: SHA-256 did not match the public contract.`);
      }
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
