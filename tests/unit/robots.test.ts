import { describe, expect, it } from 'vitest';

import { robotsText } from '../../src/pages/robots.txt';

describe('robots.txt', () => {
  it('Astroのsiteを基準にsitemap-index.xmlを案内する', () => {
    expect(robotsText(new URL('https://example.invalid/'))).toBe(
      ['User-agent: *', 'Allow: /', 'Sitemap: https://example.invalid/sitemap-index.xml', ''].join('\n'),
    );
  });

  it('siteが未設定なら生成を中断する', () => {
    expect(() => robotsText(undefined)).toThrow('SITE_URL is required to generate robots.txt.');
  });
});
