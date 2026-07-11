import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { siteUrlError } from './validate-site-url.mjs';

const ARTICLE_PATH = '/blog/build-tech-blog-with-astro-2026/';

async function textArtifacts(directory, prefix = '') {
  const artifacts = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) artifacts.push(...(await textArtifacts(absolutePath, relativePath)));
    else if (/\.(?:html|xml)$/u.test(entry.name)) artifacts.push({ file: relativePath, absolutePath });
  }
  return artifacts;
}

export async function productionBuildErrors({ siteUrl = process.env.SITE_URL, distDir = resolve('dist') } = {}) {
  const validationError = siteUrlError(siteUrl);
  if (validationError) return [validationError];

  const checks = [
    {
      file: 'index.html',
      expected: [
        [`rel="canonical" href="${siteUrl}/"`, 'canonical'],
        [`property="og:url" content="${siteUrl}/"`, 'OG URL'],
        [`property="og:image" content="${siteUrl}/og-default.png"`, 'OG image'],
      ],
    },
    {
      file: `blog${ARTICLE_PATH.slice('/blog'.length)}index.html`,
      expected: [
        [`rel="canonical" href="${siteUrl}${ARTICLE_PATH}"`, 'article canonical'],
        [`property="og:url" content="${siteUrl}${ARTICLE_PATH}"`, 'article OG URL'],
      ],
    },
    {
      file: 'rss.xml',
      expected: [
        [`<link>${siteUrl}/</link>`, 'RSS site link'],
        [`${siteUrl}${ARTICLE_PATH}`, 'RSS article link'],
      ],
    },
    { file: 'sitemap-index.xml', expected: [[`${siteUrl}/sitemap-0.xml`, 'sitemap index origin']] },
    { file: 'sitemap-0.xml', expected: [[`<loc>${siteUrl}/</loc>`, 'sitemap URL origin']] },
  ];

  const errors = new Set();
  for (const { file, expected } of checks) {
    let content;
    try {
      content = await readFile(resolve(distDir, file), 'utf8');
    } catch {
      errors.add(`${file}: required production artifact is missing.`);
      continue;
    }
    if (content.includes('https://example.invalid')) errors.add(`${file}: placeholder origin remains in the production artifact.`);
    for (const [value, label] of expected) {
      if (!content.includes(value)) errors.add(`${file}: ${label} does not use the SITE_URL origin.`);
    }
  }

  try {
    for (const { file, absolutePath } of await textArtifacts(distDir)) {
      if ((await readFile(absolutePath, 'utf8')).includes('https://example.invalid')) {
        errors.add(`${file}: placeholder origin remains in the production artifact.`);
      }
    }
  } catch {
    errors.add('dist: production asset directory could not be scanned.');
  }

  return [...errors];
}

async function main() {
  const errors = await productionBuildErrors();
  if (errors.length > 0) {
    console.error(`Production build verification failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
