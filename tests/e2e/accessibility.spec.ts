import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/blog/build-tech-blog-with-astro-2026/',
  '/blog/',
  '/tags/',
  '/categories/',
  '/about/',
  '/privacy/',
  '/404.html',
] as const;

test('主要8ページを実走査しcriticalとseriousのaxe違反を0件に保つ', async ({ page }) => {
  const scans: Array<{ route: string; status: number; violations: string[] }> = [];

  for (const route of routes) {
    const response = await page.goto(route);
    const status = response?.status() ?? 0;
    // Astro preview serves the explicit generated 404.html file with 200; platform-level not-found handling supplies 404 in production.
    expect(status, route).toBe(200);

    await expect(page.locator('h1'), `${route} must have one page heading`).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page }).analyze();
    scans.push({
      route,
      status,
      violations: violations
        .filter(({ impact }) => impact === 'critical' || impact === 'serious')
        .map(({ id, nodes }) => `${id}:${nodes.length}`),
    });
  }

  console.info(`[axe-scan] ${scans.map(({ route, status }) => `${route}:${status}`).join(', ')}`);
  expect(scans.map(({ route }) => route)).toEqual(routes);
  expect(scans).toHaveLength(8);
  expect(scans.flatMap(({ route, violations }) => violations.map((violation) => `${route}:${violation}`))).toEqual([]);
});
