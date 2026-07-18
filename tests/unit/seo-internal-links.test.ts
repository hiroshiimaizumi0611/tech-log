import { readFile } from 'node:fs/promises';

import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';

const linkContracts = [
  {
    source: 'chatgpt-sites-guide',
    targets: ['/blog/chatgpt-work-guide/'],
  },
  {
    source: 'chatgpt-codex-plugins-guide',
    targets: ['/blog/chatgpt-work-guide/', '/blog/gpt-5-6-sol-terra-luna/'],
  },
] as const;

async function markdownLinks(id: string): Promise<string[]> {
  const markdown = await readFile(new URL(`../../src/content/blog/${id}.md`, import.meta.url), 'utf8');
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  const links: string[] = [];

  visit(unified().use(remarkParse).parse(body), 'link', (node) => {
    links.push(node.url);
  });

  return links;
}

describe('SEO contextual internal links', () => {
  for (const contract of linkContracts) {
    it(`${contract.source}から承認済みの記事へリンクする`, async () => {
      const links = await markdownLinks(contract.source);

      for (const target of contract.targets) {
        expect(target).toMatch(/^\/blog\/[a-z0-9-]+\/$/);
        expect(target).not.toContain('draft-article');
        expect(links).toContain(target);

        const targetId = target.replace(/^\/blog\//, '').replace(/\/$/, '');
        const targetMarkdown = await readFile(new URL(`../../src/content/blog/${targetId}.md`, import.meta.url), 'utf8');
        expect(targetMarkdown).toMatch(/^---\r?\n/);
        expect(targetMarkdown).not.toMatch(/^draft:\s*true\s*$/m);
      }
    });
  }
});
