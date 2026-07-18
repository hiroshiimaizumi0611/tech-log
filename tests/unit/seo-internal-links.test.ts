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
  {
    source: 'build-tech-blog-with-astro-2026',
    targets: ['/blog/terraform-drift-detection/', '/blog/http-query-method-rfc-10008/'],
  },
  {
    source: 'terraform-drift-detection',
    targets: ['/blog/aws-cloudfront-vpc-origin-outage-2026-07-16/'],
  },
] as const;

async function markdownLinks(id: string): Promise<string[]> {
  const markdown = await readFile(new URL(`../../src/content/blog/${id}.md`, import.meta.url), 'utf8');
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');

  return markdownLinkDestinations(body);
}

function markdownLinkDestinations(markdown: string): string[] {
  const links: string[] = [];
  const definitions = new Map<string, string>();
  const tree = unified().use(remarkParse).parse(markdown);

  visit(tree, 'definition', (node) => {
    const identifier = node.identifier;

    if (!definitions.has(identifier)) {
      definitions.set(identifier, node.url);
    }
  });

  visit(tree, 'link', (node) => {
    links.push(node.url);
  });

  visit(tree, 'linkReference', (node) => {
    const destination = definitions.get(node.identifier);

    if (destination) {
      links.push(destination);
    }
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

  const publishedTarget = metadata as Record<string, unknown>;

  if (publishedTarget.draft === true) {
    throw new Error('Published target must not be a draft');
  }

  return publishedTarget;
}

describe('Markdown link extraction', () => {
  it('通常のMarkdownリンクを収集する', () => {
    expect(markdownLinkDestinations('[guide](/blog/direct-guide/)')).toEqual(['/blog/direct-guide/']);
  });

  it('大小文字と空白が異なる使用済み参照リンクを定義先へ解決する', () => {
    const markdown = ['[guide][  Related   Guide  ]', '', '[related guide]: /blog/reference-guide/'].join('\n');

    expect(markdownLinkDestinations(markdown)).toEqual(['/blog/reference-guide/']);
  });

  it('NBSPを含む参照識別子を通常空白の識別子と区別する', () => {
    const nbsp = '\u00a0';
    const markdown = [`[guide][a${nbsp}b]`, '', '[a b]: /blog/wrong/', `[a${nbsp}b]: /blog/right/`].join('\n');

    expect(markdownLinkDestinations(markdown)).toEqual(['/blog/right/']);
  });

  it('同じ参照リンクの出現を重複したまま収集する', () => {
    const markdown = ['[first][guide]', '[second][GUIDE]', '', '[guide]: /blog/reference-guide/'].join('\n');

    expect(markdownLinkDestinations(markdown)).toEqual(['/blog/reference-guide/', '/blog/reference-guide/']);
  });

  it('コード、画像、画像参照、未使用定義のURLを収集しない', () => {
    const markdown = [
      '`[inline](/blog/inline-code/)`',
      '',
      '```md',
      '[fenced](/blog/fenced-code/)',
      '```',
      '',
      '![image](/blog/image/)',
      '![image reference][image target]',
      '',
      '[image target]: /blog/image-reference/',
      '[unused]: /blog/unused-definition/',
    ].join('\n');

    expect(markdownLinkDestinations(markdown)).toEqual([]);
  });

  it('重複する定義では最初の定義を使用する', () => {
    const markdown = ['[guide][reference]', '', '[reference]: /blog/first-definition/', '[REFERENCE]: /blog/second-definition/'].join('\n');

    expect(markdownLinkDestinations(markdown)).toEqual(['/blog/first-definition/']);
  });
});

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
  it('インラインコメント付きのdraft: trueを公開対象として拒否する', () => {
    expect(() => parseOpeningFrontmatter('---\ndraft: true # 非公開\n---\n本文')).toThrow('Published target must not be a draft');
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
