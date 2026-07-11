import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function siteUrlError(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'SITE_URL must be set to the public HTTPS origin.';
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return 'SITE_URL must be a valid HTTPS URL.';
  }

  if (url.protocol !== 'https:') return 'SITE_URL must use HTTPS.';
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    return 'SITE_URL must be an HTTPS origin without credentials, a path, query, or fragment.';
  }
  return undefined;
}

function main() {
  const error = siteUrlError(process.env.SITE_URL);
  if (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
