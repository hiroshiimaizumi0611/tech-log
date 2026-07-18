import { readFile } from 'node:fs/promises';

import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

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

function parseOpeningFrontmatter(markdown: string): Record<string, unknown> {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!frontmatter) {
    throw new Error('Opening frontmatter block is required');
  }

  const metadata = parse(frontmatter[1]);

  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Opening frontmatter must be a YAML mapping');
  }

  return metadata as Record<string, unknown>;
}

describe('SEO contextual internal links', () => {
  for (const contract of linkContracts) {
    it(`${contract.source}から承認済みの記事へリンクする`, async () => {
      const links = await markdownLinks(contract.source);
      const internalArticleLinks = links.filter((link) => /^\/blog\/[a-z0-9-]+\/$/.test(link));

      expect(internalArticleLinks.sort()).toEqual([...contract.targets].sort());

      for (const target of contract.targets) {
        expect(target).toMatch(/^\/blog\/[a-z0-9-]+\/$/);
        expect(target).not.toContain('draft-article');

        const targetId = target.replace(/^\/blog\//, '').replace(/\/$/, '');
        const targetMarkdown = await readFile(new URL(`../../src/content/blog/${targetId}.md`, import.meta.url), 'utf8');
        const frontmatter = parseOpeningFrontmatter(targetMarkdown);
        expect(frontmatter.draft).not.toBe(true);
      }
    });
  }
});

describe('opening frontmatter', () => {
  it('インラインコメント付きのdraft: trueをbooleanとして読み取る', () => {
    expect(parseOpeningFrontmatter('---\ndraft: true # 非公開\n---\n本文')).toMatchObject({ draft: true });
  });

  it.each([
    ['開始区切りがない本文', 'title: no frontmatter\n'],
    ['終端区切りがないfrontmatter', '---\ntitle: incomplete\n'],
    ['YAMLとして不正なfrontmatter', '---\ndraft: [true\n---\n本文'],
    ['マッピングではないfrontmatter', '---\njust a string\n---\n本文'],
  ])('%sを拒否する', (_description, markdown) => {
    expect(() => parseOpeningFrontmatter(markdown)).toThrow();
  });
});
