import GithubSlugger from 'github-slugger';
import type { Code, Heading, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';

const FILENAME_META = /(?:^|\s)(?:title|filename)="([^"]+)"(?:\s|$)/u;

export function codeFilenameFromMeta(meta: unknown): string | undefined {
  if (typeof meta === 'object' && meta !== null && '__raw' in meta) return codeFilenameFromMeta(meta.__raw);
  if (typeof meta !== 'string') return undefined;
  return meta.match(FILENAME_META)?.[1];
}

export default function remarkCodeFilename() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code) => {
      const filename = codeFilenameFromMeta(node.meta);
      if (!filename) return;

      node.data ??= {};
      node.data.hProperties = {
        ...(node.data.hProperties ?? {}),
        'data-filename': filename,
      };
    });
  };
}

export function remarkHeadingLinks() {
  return (tree: Root) => {
    const slugger = new GithubSlugger();
    visit(tree, 'heading', (node: Heading) => {
      const id = slugger.slug(toString(node, { includeHtml: false }));
      node.data ??= {};
      node.data.hProperties = { ...(node.data.hProperties ?? {}), id };
      if (node.depth !== 2 && node.depth !== 3) return;
      node.children.push({
        type: 'link',
        url: `#${id}`,
        children: [],
        data: {
          hProperties: {
            href: `#${id}`,
            className: ['heading-link'],
            ariaLabel: 'この見出しへのリンク',
          },
        },
      });
    });
  };
}
