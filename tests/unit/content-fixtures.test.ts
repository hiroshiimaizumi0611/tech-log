import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const articleFixtures = [
  {
    id: 'build-tech-blog-with-astro-2026',
    featured: true,
    referenceHosts: ['docs.astro.build', 'tailwindcss.com', 'pagefind.app', 'developers.cloudflare.com'],
  },
  {
    id: 'terraform-drift-detection',
    featured: false,
    referenceHosts: ['developer.hashicorp.com'],
  },
] as const;

async function readArticle(id: string): Promise<string> {
  const articleUrl = new URL(`../../src/content/blog/${id}.md`, import.meta.url);
  expect(fileURLToPath(articleUrl)).toMatch(new RegExp(`${id}\\.md$`));
  return readFile(articleUrl, 'utf8');
}

function bodyOf(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
}

describe('initial production article fixtures', () => {
  it('contains the exact requested article IDs and only features the Astro article', async () => {
    const articles = await Promise.all(articleFixtures.map(async ({ id }) => ({ id, source: await readArticle(id) })));

    expect(articles.map(({ id }) => id)).toEqual(['build-tech-blog-with-astro-2026', 'terraform-drift-detection']);
    expect(articles.filter(({ source }) => /^featured: true$/m.test(source)).map(({ id }) => id)).toEqual([
      'build-tech-blog-with-astro-2026',
    ]);
  });

  it.each(articleFixtures)('$id is a substantial, structured article backed by primary references', async (fixture) => {
    const source = await readArticle(fixture.id);
    const body = bodyOf(source);
    const contentCharacters = body.replace(/[\s#>`*_[\](){}|+-]/g, '').length;

    expect(contentCharacters).toBeGreaterThanOrEqual(600);
    expect(body).toMatch(/^##\s+\S+/m);
    expect(body).toMatch(/```[a-z]+\n[\s\S]+?```/);
    expect(body).toMatch(/^[-*]\s+\S+/m);
    expect(body).toMatch(/^>\s+\S+/m);

    for (const host of fixture.referenceHosts) {
      expect(body).toContain(`https://${host}/`);
    }
  });
});
