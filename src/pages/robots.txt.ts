import type { APIRoute } from 'astro';

export function robotsText(site: URL | undefined): string {
  if (!site) {
    throw new Error('SITE_URL is required to generate robots.txt.');
  }

  const sitemap = new URL('/sitemap-index.xml', site).toString();
  return ['User-agent: *', 'Allow: /', `Sitemap: ${sitemap}`, ''].join('\n');
}

export const GET: APIRoute = ({ site }) =>
  new Response(robotsText(site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
