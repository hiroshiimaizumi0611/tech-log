import type { Code, Heading, Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';

import remarkCodeFilename, { remarkHeadingLinks } from '../../src/lib/remark-code-filename';

function parseCode(markdown: string): Code {
  const tree = unified().use(remarkParse).use(remarkCodeFilename).runSync(unified().use(remarkParse).parse(markdown)) as Root;
  let code: Code | undefined;
  visit(tree, 'code', (node) => {
    code ??= node;
  });
  if (!code) throw new Error('code node not found');
  return code;
}

function parseHeadings(markdown: string): Heading[] {
  const processor = unified().use(remarkParse).use(remarkHeadingLinks);
  const tree = processor.runSync(processor.parse(markdown)) as Root;
  const headings: Heading[] = [];
  visit(tree, 'heading', (node) => headings.push(node));
  return headings;
}

function headingLink(headings: Heading[], index: number): string | undefined {
  const link = headings[index]?.children.find(
    (child) => child.type === 'link' && child.data?.hProperties?.ariaLabel === 'この見出しへのリンク',
  );
  return link?.type === 'link' ? link.url : undefined;
}

describe('remarkCodeFilename', () => {
  it.each(['title="src/example.ts"', 'filename="src/example.ts"'])('maps quoted %s metadata to a safe AST property', (meta) => {
    const code = parseCode(`\`\`\`ts ${meta}\nexport const answer = 42;\n\`\`\``);

    expect(code.data?.hProperties).toEqual({ 'data-filename': 'src/example.ts' });
    expect(code.data?.hName).toBeUndefined();
  });

  it('does not attach filename data when metadata is absent', () => {
    const code = parseCode('```ts\nexport const answer = 42;\n```');

    expect(code.data?.hProperties).toBeUndefined();
  });

  it.each([
    'title=src/example.ts',
    'filename=src/example.ts',
    'title=""',
    'filename=""',
    'title="src/example.ts',
    "title='src/example.ts'",
  ])('safely rejects malformed or unsupported metadata: %s', (meta) => {
    const code = parseCode(`\`\`\`ts ${meta}\nexport const answer = 42;\n\`\`\``);

    expect(code.data?.hProperties).toBeUndefined();
  });

  it('keeps special characters as an AST value instead of concatenating raw HTML', () => {
    const code = parseCode('```ts title="src/<unsafe>&example.ts"\nexport const answer = 42;\n```');

    expect(code.data?.hProperties).toEqual({ 'data-filename': 'src/<unsafe>&example.ts' });
    expect(code.data?.hName).toBeUndefined();
  });
});

describe('remarkHeadingLinks', () => {
  it('uses the complete visible text from emphasis, inline code, and links', () => {
    const headings = parseHeadings('## Using **Astro** `safely` with [links](https://example.com)');

    expect(headingLink(headings, 0)).toBe('#using-astro-safely-with-links');
  });

  it('includes every heading level in duplicate slug ordering while linking only H2 and H3', () => {
    const headings = parseHeadings('# Same\n\n## Same\n\n#### Same\n\n## Same');

    expect(headings.map((_, index) => headingLink(headings, index))).toEqual([undefined, '#same-1', undefined, '#same-3']);
  });
});
