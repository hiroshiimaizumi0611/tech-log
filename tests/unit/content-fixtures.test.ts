import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
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
  {
    id: 'gpt-5-6-sol-terra-luna',
    featured: false,
    referenceHosts: ['openai.com', 'help.openai.com', 'developers.openai.com'],
  },
  {
    id: 'chatgpt-work-guide',
    featured: false,
    referenceHosts: ['openai.com', 'help.openai.com'],
  },
  {
    id: 'chatgpt-codex-plugins-guide',
    featured: true,
    referenceHosts: ['help.openai.com'],
  },
] as const;

async function readArticle(id: string): Promise<string> {
  const articleUrl = new URL(`../../src/content/blog/${id}.md`, import.meta.url);
  expect(fileURLToPath(articleUrl)).toMatch(new RegExp(`${id}\\.md$`));
  return readFile(articleUrl, 'utf8');
}

function splitArticle(markdown: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);

  if (!match) {
    throw new Error('Article must start with frontmatter enclosed by --- delimiters');
  }

  return { frontmatter: match[1], body: markdown.slice(match[0].length) };
}

function featuredValue(frontmatter: string): boolean {
  const match = /^featured:\s*(true|false)\s*$/m.exec(frontmatter);
  return match?.[1] === 'true';
}

function normalizeReferenceIdentifier(identifier: string): string {
  return identifier.trim().replace(/\s+/g, ' ').toLowerCase();
}

function markdownLinkDestinations(body: string): string[] {
  const destinations: string[] = [];
  const definitions = new Map<string, string>();
  const tree = unified().use(remarkParse).parse(body);

  visit(tree, 'definition', (node) => {
    const identifier = normalizeReferenceIdentifier(node.identifier);
    if (!definitions.has(identifier)) {
      definitions.set(identifier, node.url);
    }
  });

  visit(tree, 'link', (node) => {
    destinations.push(node.url);
  });

  visit(tree, 'linkReference', (node) => {
    const destination = definitions.get(normalizeReferenceIdentifier(node.identifier));
    if (destination) {
      destinations.push(destination);
    }
  });

  return destinations;
}

function isInternalLinkDestination(destination: string): boolean {
  if (destination.startsWith('//')) {
    return false;
  }

  try {
    new URL(destination);
    return false;
  } catch {
    try {
      const siteBase = new URL('https://fixture-site.invalid/blog/current');
      return new URL(destination, siteBase).origin === siteBase.origin;
    } catch {
      return false;
    }
  }
}

function linkValidationErrors(destinations: string[], approvedHosts: ReadonlySet<string>): string[] {
  const errors: string[] = [];

  for (const destination of destinations) {
    if (isInternalLinkDestination(destination)) {
      continue;
    }
    if (destination.startsWith('//')) {
      errors.push(`Protocol-relative URL is not allowed: ${destination}`);
      continue;
    }

    let url: URL;
    try {
      url = new URL(destination);
    } catch {
      errors.push(`Link must be an internal path or absolute URL: ${destination}`);
      continue;
    }

    if (url.protocol !== 'https:') {
      errors.push(`External URL must use HTTPS: ${destination}`);
    } else if (!approvedHosts.has(url.hostname)) {
      errors.push(`External hostname is not approved: ${url.hostname}`);
    }
  }

  return errors;
}

describe('initial production article fixtures', () => {
  it('collects only real Markdown links, excluding code and images', () => {
    const markdown = [
      '```md',
      '[fenced](https://code.example/fenced)',
      '```',
      '',
      '`[inline](https://code.example/inline)`',
      '',
      '![image](https://images.example/example.png)',
      '',
      '[real link](https://docs.example/guide)',
    ].join('\n');

    expect(markdownLinkDestinations(markdown).map(String)).toEqual(['https://docs.example/guide']);
  });

  it('collects used reference-style Markdown links by normalized identifier', () => {
    const markdown = [
      '[approved][OpenAI Docs]',
      '[unapproved][BAD   REF]',
      '',
      '[openai docs]: https://openai.com/guide',
      '[bad ref]: https://unapproved.example/guide',
      '[unused]: https://unused.example/guide',
    ].join('\n');

    expect(markdownLinkDestinations(markdown).map(String)).toEqual(['https://openai.com/guide', 'https://unapproved.example/guide']);
  });

  it('preserves an unsafe first definition when a later duplicate is approved', () => {
    const markdown = ['[guide][docs]', '', '[docs]: https://unapproved.example/first', '[DOCS]: https://openai.com/second'].join('\n');
    const destinations = markdownLinkDestinations(markdown);

    expect(destinations).toEqual(['https://unapproved.example/first']);
    expect(linkValidationErrors(destinations, new Set(['openai.com']))).toEqual(['External hostname is not approved: unapproved.example']);
  });

  it('preserves an approved first definition when a later duplicate is unsafe', () => {
    const markdown = ['[guide][docs]', '', '[docs]: https://openai.com/first', '[DOCS]: https://unapproved.example/second'].join('\n');
    const destinations = markdownLinkDestinations(markdown);

    expect(destinations).toEqual(['https://openai.com/first']);
    expect(linkValidationErrors(destinations, new Set(['openai.com']))).toEqual([]);
  });

  it('collects internal relative and fragment links without requiring an external URL', () => {
    const markdown = ['[root](/blog/article)', '[same directory](./article)', '[parent directory](../article)', '[section](#section)'].join(
      '\n',
    );

    expect(markdownLinkDestinations(markdown).map(String)).toEqual(['/blog/article', './article', '../article', '#section']);
  });

  it('allows internal links and reports unsafe or unapproved external links', () => {
    const approvedHosts = new Set(['openai.com']);

    expect(
      linkValidationErrors(
        ['/path', './path', '../path', '#section', 'other-article', '?view=compact', 'https://openai.com/docs'],
        approvedHosts,
      ),
    ).toEqual([]);
    expect(linkValidationErrors(['//openai.com/docs', 'http://openai.com/docs', 'https://unapproved.example/docs'], approvedHosts)).toEqual(
      [
        'Protocol-relative URL is not allowed: //openai.com/docs',
        'External URL must use HTTPS: http://openai.com/docs',
        'External hostname is not approved: unapproved.example',
      ],
    );
    expect(linkValidationErrors(['javascript:alert(1)', 'mailto:reader@example.com'], approvedHosts)).toEqual([
      'External URL must use HTTPS: javascript:alert(1)',
      'External URL must use HTTPS: mailto:reader@example.com',
    ]);
  });

  it('rejects missing or unclosed frontmatter delimiters', () => {
    expect(() => splitArticle('title: missing delimiters\n\nBody')).toThrow(/frontmatter enclosed/i);
    expect(() => splitArticle('---\ntitle: missing closing delimiter\n\nBody')).toThrow(/frontmatter enclosed/i);
  });

  it('contains the exact requested article IDs with their expected featured values', async () => {
    const articles = await Promise.all(
      articleFixtures.map(async ({ id, featured }) => ({
        id,
        expectedFeatured: featured,
        ...splitArticle(await readArticle(id)),
      })),
    );

    expect(articles.map(({ id }) => id)).toEqual([
      'build-tech-blog-with-astro-2026',
      'terraform-drift-detection',
      'gpt-5-6-sol-terra-luna',
      'chatgpt-work-guide',
      'chatgpt-codex-plugins-guide',
    ]);
    for (const article of articles) {
      expect(featuredValue(article.frontmatter), article.id).toBe(article.expectedFeatured);
    }
    expect(featuredValue('title: featured defaults to false')).toBe(false);
  });

  it.each(articleFixtures)('$id is a substantial, structured article backed by primary references', async (fixture) => {
    const source = await readArticle(fixture.id);
    const { body } = splitArticle(source);
    const contentCharacters = body.replace(/[\s#>`*_[\](){}|+-]/g, '').length;
    const linkDestinations = markdownLinkDestinations(body);
    const approvedHosts = new Set<string>(fixture.referenceHosts);
    const externalDestinations = linkDestinations.filter((destination) => !isInternalLinkDestination(destination));

    expect(contentCharacters).toBeGreaterThanOrEqual(600);
    expect(body).toMatch(/^##\s+\S+/m);
    const hasConcreteFormat =
      /```[a-z]+\n[\s\S]+?```/.test(body) ||
      /^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+/m.test(body) ||
      (/^##\s+具体(?:例|的な\S*)/m.test(body) && /^\d+\.\s+\S+/m.test(body));

    expect(hasConcreteFormat, `${fixture.id} needs a code fence, Markdown table, or ordered concrete-example section`).toBe(true);
    expect(body).toMatch(/^[-*]\s+\S+/m);
    expect(body).toMatch(/^>\s+\S+/m);

    expect(externalDestinations.length, `${fixture.id} needs at least one external primary reference`).toBeGreaterThan(0);
    expect(linkValidationErrors(linkDestinations, approvedHosts), `${fixture.id} has an invalid Markdown link`).toEqual([]);

    for (const host of fixture.referenceHosts) {
      expect(
        externalDestinations.some((destination) => new URL(destination).hostname === host),
        host,
      ).toBe(true);
    }
  });

  it('uses the Astro 7 content collection imports', async () => {
    const source = await readArticle('build-tech-blog-with-astro-2026');
    const { body } = splitArticle(source);

    expect(body).toContain("import { defineCollection } from 'astro:content';");
    expect(body).toContain("import { z } from 'astro/zod';");
    expect(body).not.toContain("import { defineCollection, z } from 'astro:content';");
  });

  it('plugins guide uses five accessible visuals and a read-only GitHub example', async () => {
    const source = await readArticle('chatgpt-codex-plugins-guide');
    const { frontmatter, body } = splitArticle(source);
    const images = [...body.matchAll(/!\[([^\]]+)\]\(([^)]+)\)/g)];

    expect(frontmatter).toContain('featured: true');
    expect(frontmatter).toMatch(/heroImage:\s+\.\.\/\.\.\/assets\/blog\/chatgpt-codex-plugins-og\.png/);
    expect(frontmatter).toMatch(/ogImage:\s+\.\.\/\.\.\/assets\/blog\/chatgpt-codex-plugins-og\.png/);
    expect(images).toHaveLength(5);
    expect(images.every(([, alt]) => alt.trim().length > 0)).toBe(true);
    expect(new Set(images.map(([, alt]) => alt)).size).toBe(5);
    expect(body).toContain('Issueの作成・更新・コメント・クローズは行わないでください');
    expect(body).not.toMatch(/Plugin\s*=\s*Skill/);
  });

  it('protects every saved Terraform plan and state backup artifact', async () => {
    const source = await readArticle('terraform-drift-detection');
    const { body } = splitArticle(source);
    const shellBlocks = [...body.matchAll(/```sh\n([\s\S]*?)```/g)].map(([, commands]) => commands);
    const savedPlanBlocks = shellBlocks.filter((commands) => commands.includes('terraform plan') && commands.includes('-out='));
    const stateBackupBlock = shellBlocks.find((commands) => commands.includes('terraform state pull'));

    expect(savedPlanBlocks.length).toBeGreaterThan(0);
    for (const commands of savedPlanBlocks) {
      expect(commands).toContain('umask 077');
      expect(commands).toMatch(/PLAN_FILE=/);
      expect(commands).toMatch(/trap ['"]rm -f/);
      expect(commands).toMatch(/rm -f "\$PLAN_FILE"/);
    }

    expect(stateBackupBlock).toMatch(/STATE_TMP=.*mktemp/);
    expect(stateBackupBlock).toMatch(/if ! terraform state pull > "\$STATE_TMP"/);
    expect(stateBackupBlock).toMatch(/\[ ! -s "\$STATE_TMP" \]/);
    expect(stateBackupBlock).toMatch(/mv "\$STATE_TMP" "\$BACKUP_FILE"/);
  });
});
