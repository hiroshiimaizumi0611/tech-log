import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { EXPECTED_GLB_SHA256, validateServerRoomGlb } from './verify-server-room-demo.mjs';

const DEMO_PATH = 'demos/server-room';
const DEMO_BASE = `/${DEMO_PATH}/`;
const EXPECTED_PAGE_COUNT = 14;

async function requireRegularFile(root, relativePath, label = relativePath) {
  const absolute = join(root, ...relativePath.split('/'));
  const stat = await lstat(absolute).catch(() => undefined);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Missing required ${label}: ${relativePath}`);
  }
  return absolute;
}

async function listFiles(root) {
  const files = [];
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Build output must not contain symbolic links: ${relativePath}`);
      if (entry.isDirectory()) await visit(absolute, relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  }
  await visit(root);
  return files.sort();
}

function elements(document) {
  const found = [];
  function visit(node) {
    if (node.tagName) found.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(document);
  return found;
}

function attributes(node) {
  return Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
}

async function verifyDemoHtml(root, expectedCanonicalUrl) {
  const indexPath = await requireRegularFile(root, `${DEMO_PATH}/index.html`, 'demo index');
  const html = await readFile(indexPath, 'utf8');
  if (/\bdata-pagefind-body(?:\s|=|>)/i.test(html)) {
    throw new Error('Demo HTML must not contain data-pagefind-body');
  }

  const nodes = elements(parse(html));
  const canonical = nodes
    .filter(({ tagName }) => tagName === 'link')
    .map(attributes)
    .find(({ rel }) => rel?.toLowerCase() === 'canonical');
  if (canonical?.href !== expectedCanonicalUrl) {
    throw new Error(`Demo canonical must be ${expectedCanonicalUrl}; got ${canonical?.href ?? 'missing'}`);
  }
  const robots = nodes
    .filter(({ tagName }) => tagName === 'meta')
    .map(attributes)
    .find(({ name }) => name?.toLowerCase() === 'robots');
  if (robots?.content?.toLowerCase() !== 'noindex, follow') {
    throw new Error(`Demo robots meta must be noindex, follow; got ${robots?.content ?? 'missing'}`);
  }

  const moduleScripts = nodes
    .filter(({ tagName }) => tagName === 'script')
    .map(attributes)
    .filter(({ type, src }) => type?.toLowerCase() === 'module' && src)
    .map(({ src }) => src);
  const stylesheets = nodes
    .filter(({ tagName }) => tagName === 'link')
    .map(attributes)
    .filter(({ rel, href }) => rel?.toLowerCase() === 'stylesheet' && href)
    .map(({ href }) => href);
  if (moduleScripts.length === 0) throw new Error('Demo index must reference a module JavaScript asset');
  if (stylesheets.length === 0) throw new Error('Demo index must reference a CSS stylesheet asset');

  const expectedOrigin = new URL(expectedCanonicalUrl).origin;
  for (const assetUrl of [...moduleScripts, ...stylesheets]) {
    const parsed = new URL(assetUrl, expectedCanonicalUrl);
    if (parsed.origin !== expectedOrigin || !parsed.pathname.startsWith(DEMO_BASE) || parsed.search || parsed.hash) {
      throw new Error(`Demo asset must stay inside the demo subpath: ${assetUrl}`);
    }
    let relativePath;
    try {
      relativePath = decodeURIComponent(parsed.pathname.slice(1));
    } catch {
      throw new Error(`Demo asset URL is not valid UTF-8: ${assetUrl}`);
    }
    if (relativePath.split('/').some((part) => part === '.' || part === '..')) {
      throw new Error(`Demo asset must stay inside the demo subpath: ${assetUrl}`);
    }
    await requireRegularFile(root, relativePath, 'demo asset');
  }
}

async function verifyPagefind(root) {
  await requireRegularFile(root, 'pagefind/pagefind.js');
  const entryPath = await requireRegularFile(root, 'pagefind/pagefind-entry.json');
  const entry = JSON.parse(await readFile(entryPath, 'utf8'));
  const japaneseIndex = entry.languages?.ja;
  if (!japaneseIndex?.hash || japaneseIndex.page_count !== EXPECTED_PAGE_COUNT) {
    throw new Error(`Pagefind Japanese page_count must remain ${EXPECTED_PAGE_COUNT}; got ${japaneseIndex?.page_count ?? 'missing'}`);
  }
  await requireRegularFile(root, `pagefind/pagefind.${japaneseIndex.hash}.pf_meta`);
  return japaneseIndex.page_count;
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/giu)].map((match) => match[1]);
}

async function verifySitemaps(root, allFiles) {
  const indexPath = await requireRegularFile(root, 'sitemap-index.xml');
  const indexXml = await readFile(indexPath, 'utf8');
  const referenced = sitemapLocations(indexXml);
  if (referenced.length === 0) throw new Error('sitemap-index.xml must reference at least one sitemap');

  const referencedPaths = [];
  for (const location of referenced) {
    const url = new URL(location);
    const relativePath = url.pathname.replace(/^\/+/, '');
    if (!relativePath || isAbsolute(relativePath) || relativePath.split('/').some((part) => part === '.' || part === '..')) {
      throw new Error(`Invalid sitemap location: ${location}`);
    }
    await requireRegularFile(root, relativePath, 'referenced sitemap');
    referencedPaths.push(relativePath);
  }

  const sitemapFiles = new Set([...allFiles.filter((file) => /^sitemap(?:-[^/]+)?\.xml$/u.test(file)), ...referencedPaths]);
  for (const sitemap of sitemapFiles) {
    const xml = await readFile(join(root, sitemap), 'utf8');
    if (xml.includes(DEMO_BASE)) {
      throw new Error(`Sitemap contains the demo URL: ${sitemap}`);
    }
  }
}

async function verifyGlb(root, allFiles) {
  const glbFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.glb'));
  const expectedPath = `${DEMO_PATH}/models/server-room.glb`;
  if (glbFiles.length !== 1 || glbFiles[0] !== expectedPath) {
    throw new Error(`Build must contain exactly one GLB at ${expectedPath}; got ${glbFiles.join(', ') || 'none'}`);
  }
  const bytes = await readFile(await requireRegularFile(root, expectedPath, 'GLB'));
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== EXPECTED_GLB_SHA256) {
    throw new Error(`GLB SHA-256 mismatch: expected ${EXPECTED_GLB_SHA256}, got ${actualSha256}`);
  }
  return validateServerRoomGlb(bytes);
}

export async function verifyBuild({ distDirectory = fileURLToPath(new URL('../dist', import.meta.url)), expectedCanonicalUrl } = {}) {
  const root = resolve(distDirectory);
  if (!expectedCanonicalUrl) throw new Error('expectedCanonicalUrl is required to verify the demo canonical');

  for (const required of ['index.html', 'rss.xml', 'sitemap-index.xml', 'robots.txt', 'og-default.png']) {
    await requireRegularFile(root, required);
  }
  const allFiles = await listFiles(root);
  await verifyDemoHtml(root, expectedCanonicalUrl);
  const pageCount = await verifyPagefind(root);
  await verifySitemaps(root, allFiles);
  const glb = await verifyGlb(root, allFiles);
  return { pageCount, serverNodeCount: glb.serverNodeNames.length, glb };
}

function expectedCanonicalFromEnvironment() {
  if (!process.env.SITE_URL) throw new Error('SITE_URL is required to verify the build');
  return new URL(DEMO_BASE, process.env.SITE_URL).href;
}

async function main() {
  try {
    const result = await verifyBuild({ expectedCanonicalUrl: expectedCanonicalFromEnvironment() });
    console.log(
      `Verified combined build: Pagefind ${result.pageCount} pages; GLB ${result.glb.numErrors} errors, ${result.glb.numWarnings} warnings, ${result.serverNodeCount} server nodes.`,
    );
  } catch (error) {
    console.error(`Build verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
