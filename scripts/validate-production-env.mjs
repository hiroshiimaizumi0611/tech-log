import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { siteUrlError } from './validate-site-url.mjs';

export function productionEnvErrors(env) {
  const errors = [];
  const siteError = siteUrlError(env.SITE_URL);
  if (siteError) errors.push(siteError);
  if (typeof env.CLOUDFLARE_ACCOUNT_ID !== 'string' || env.CLOUDFLARE_ACCOUNT_ID.trim() === '') {
    errors.push('CLOUDFLARE_ACCOUNT_ID is required for deployment.');
  }
  if (typeof env.CLOUDFLARE_API_TOKEN !== 'string' || env.CLOUDFLARE_API_TOKEN.trim() === '') {
    errors.push('CLOUDFLARE_API_TOKEN is required for deployment.');
  }
  return errors;
}

function main() {
  const errors = productionEnvErrors(process.env);
  if (errors.length > 0) {
    console.error(`Production environment validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
