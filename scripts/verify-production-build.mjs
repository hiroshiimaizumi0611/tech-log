import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { siteUrlError } from './validate-site-url.mjs';

const ARTICLE_PATH = '/blog/build-tech-blog-with-astro-2026/';

function quotedAttributeValue(element, attributeName) {
  return new RegExp(`(?:^|\\s)${attributeName}\\s*=\\s*["']([^"']*)["']`, 'iu').exec(element)?.[1];
}

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

export async function productionBuildErrors({
  siteUrl = process.env.SITE_URL,
  distDir = resolve('dist'),
  googleSiteVerification = process.env.PUBLIC_GOOGLE_SITE_VERIFICATION,
  analyticsToken = process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
} = {}) {
  const validationError = siteUrlError(siteUrl);
  if (validationError) return [validationError];
  const site = new URL(siteUrl);
  const origin = site.origin;
  const verificationToken = googleSiteVerification?.trim();
  const normalizedAnalyticsToken = analyticsToken?.trim();
  const errors = new Set();

  if (!verificationToken) errors.add('index.html: Google site verification value is missing.');

  const checks = [
    {
      file: 'index.html',
      expected: [
        [`rel="canonical" href="${origin}/"`, 'canonical'],
        [`property="og:url" content="${origin}/"`, 'OG URL'],
        [`property="og:image" content="${origin}/og-default.png"`, 'OG image'],
      ],
    },
    {
      file: `blog${ARTICLE_PATH.slice('/blog'.length)}index.html`,
      expected: [
        [`rel="canonical" href="${origin}${ARTICLE_PATH}"`, 'article canonical'],
        [`property="og:url" content="${origin}${ARTICLE_PATH}"`, 'article OG URL'],
      ],
    },
    {
      file: 'rss.xml',
      expected: [
        [`<link>${origin}/</link>`, 'RSS site link'],
        [`${origin}${ARTICLE_PATH}`, 'RSS article link'],
      ],
    },
    { file: 'sitemap-index.xml', expected: [[`${origin}/sitemap-0.xml`, 'sitemap index origin']] },
    { file: 'sitemap-0.xml', expected: [[`<loc>${origin}/</loc>`, 'sitemap URL origin']] },
  ];

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
    if (file === 'index.html' && verificationToken) {
      const verificationTags = content.match(/<meta\b[^>]*\bname=["']google-site-verification["'][^>]*>/giu) ?? [];
      if (verificationTags.length !== 1) {
        errors.add('index.html: expected exactly one verification tag.');
      } else {
        const contentValue = /\bcontent=["']([^"']*)["']/iu.exec(verificationTags[0])?.[1];
        if (contentValue !== verificationToken) errors.add('index.html: verification tag content does not match the configured value.');
      }
    }
    if (file === 'index.html') {
      const configElements = (content.match(/<template\b[^>]*>/giu) ?? []).filter(
        (element) => quotedAttributeValue(element, 'id') === 'cloudflare-web-analytics-config',
      );
      if (normalizedAnalyticsToken) {
        if (configElements.length !== 1) {
          errors.add('index.html: expected exactly one analytics config element.');
        } else {
          const token = quotedAttributeValue(configElements[0], 'data-token');
          const hostname = quotedAttributeValue(configElements[0], 'data-allowed-hostname');
          if (token !== normalizedAnalyticsToken) errors.add('index.html: analytics config token does not match the configured value.');
          if (hostname !== site.hostname) errors.add('index.html: analytics config hostname does not match the SITE_URL hostname.');
        }
      } else if (configElements.length !== 0) {
        errors.add('index.html: analytics config must be absent when analytics is not configured.');
      }
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
