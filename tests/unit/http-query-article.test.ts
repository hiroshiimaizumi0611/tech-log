import { readFile } from 'node:fs/promises';

import type { Definition, Html, Image, ImageReference, Link, LinkReference } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';

const articleUrl = new URL('../../src/content/blog/http-query-method-rfc-10008.md', import.meta.url);

function splitArticle(markdown: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error('Article must start with frontmatter enclosed by --- delimiters');
  return { frontmatter: match[1], body: markdown.slice(match[0].length).replace(/\r\n?/g, '\n') };
}

function inspectMarkdown(markdown: string): { links: string[]; imageCount: number } {
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, string>();
  const links: string[] = [];
  let imageCount = 0;

  visit(tree, 'definition', (node: Definition) => {
    definitions.set(node.identifier, node.url);
  });
  visit(tree, 'link', (node: Link) => links.push(node.url));
  visit(tree, 'linkReference', (node: LinkReference) => {
    const url = definitions.get(node.identifier);
    if (url) links.push(url);
  });
  visit(tree, 'image', (_node: Image) => imageCount++);
  visit(tree, 'imageReference', (_node: ImageReference) => imageCount++);
  visit(tree, 'html', (node: Html) => {
    if (/<img(?:\s|>)/i.test(node.value)) imageCount++;
  });

  return { links, imageCount };
}

describe('HTTP QUERY article', () => {
  it('publishes the approved metadata and problem-driven structure', async () => {
    const { frontmatter, body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const headings = [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);

    expect(frontmatter).toContain('title: HTTP QUERYメソッドとは？GET・POSTとの違いとcurlでの試し方');
    expect(frontmatter).toContain(
      'description: HTTP QUERYメソッドの目的、GET・POSTとの違い、curlでの送信例、対応状況を確認して採用する際の注意点をRFC 10008に基づいて解説します。',
    );
    expect(frontmatter).toContain("publishedAt: '2026-07-16'");
    expect(frontmatter).toContain('category: Backend');
    for (const tag of ['HTTP', 'API', 'RFC', 'Web']) expect(frontmatter).toContain(`  - ${tag}`);
    expect(frontmatter).toContain('featured: true');
    expect(frontmatter).not.toMatch(/^(?:heroImage|ogImage):/m);

    expect(headings).toEqual([
      'HTTP QUERYメソッドが正式公開された',
      'GETとPOSTだけでは何が困るのか',
      'GET・QUERY・POSTの違い',
      'QUERYリクエストを書いてみる',
      'QUERYで押さえる仕様',
      'すぐ本番採用できるとは限らない',
      'QUERYを選ぶ判断基準',
    ]);
    expect(inspectMarkdown(body).imageCount).toBe(0);
  });

  it('uses primary sources and preserves the important RFC semantics', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { links } = inspectMarkdown(body);
    const paragraphs = body.split(/\n{2,}/).map((paragraph) => paragraph.replace(/\s+/g, ' '));
    const approvedUrls = [
      'https://www.rfc-editor.org/rfc/rfc10008.html',
      'https://www.rfc-editor.org/rfc/rfc9110.html',
      'https://www.iana.org/assignments/http-methods/http-methods.xhtml',
      'https://fetch.spec.whatwg.org/',
      'https://curl.se/docs/manpage.html',
    ];
    const approvedHosts = new Set(['www.rfc-editor.org', 'www.iana.org', 'fetch.spec.whatwg.org', 'curl.se']);

    expect(links).toEqual(expect.arrayContaining(approvedUrls));
    const externalHosts = links.flatMap((href) => {
      const url = new URL(href, 'https://relative.invalid');
      return ['http:', 'https:'].includes(url.protocol) && url.hostname !== 'relative.invalid' ? [url.hostname] : [];
    });
    expect(new Set(externalHosts)).toEqual(approvedHosts);

    for (const fact of [
      '安全',
      '冪等',
      'Content-Type',
      'Accept-Query',
      '415 Unsupported Media Type',
      '422 Unprocessable Content',
      'CORSプリフライト',
      'OPTIONS',
      'Allow',
      '条件付きリクエスト',
      'Location',
      'Content-Location',
      'リクエスト内容と関連メタデータ',
    ]) {
      expect(body).toContain(fact);
    }
    expect(body).toMatch(
      /QUERY(?:メソッド)?は[^。\n]{0,60}安全(?:」|』|\*\*)?(?:なメソッド|です|である|であり|で(?!は?(?:ない|ありません))|かつ)/,
    );
    expect(body).toMatch(/QUERY(?:メソッド)?は[^。\n]{0,80}冪等(?:」|』|\*\*)?(?:なメソッド|です|である|と定義され)/);
    expect(body).not.toMatch(
      /QUERY(?:メソッド)?は[^。\n]{0,80}(?:安全|冪等)(?:」|』|\*\*)?(?:ではない|でない|ではありません|とは限らない)/,
    );
    expect(
      paragraphs.some(
        (paragraph) =>
          paragraph.includes('安全') &&
          /サーバー?/.test(paragraph) &&
          /(?:状態|リソース)/.test(paragraph) &&
          /(?:変更|変化|変え)/.test(paragraph) &&
          /(?:意図しない|意図していない|目的としない)/.test(paragraph),
      ),
    ).toBe(true);
    expect(
      paragraphs.some(
        (paragraph) =>
          paragraph.includes('冪等') &&
          /(?:同じ|同一)[^。]{0,30}リクエスト/.test(paragraph) &&
          /(?:繰り返|反復)/.test(paragraph) &&
          /(?:意図した|意図する)[^。]{0,20}(?:効果|作用)[^。]{0,20}(?:同じ|同一|変わらない)/.test(paragraph),
      ),
    ).toBe(true);
    expect(body).toContain('Locationは同じ問い合わせを再実行できるリソース');
    expect(body).toContain('Content-Locationは返された結果に対応するリソース');
    expect(body).not.toMatch(
      /\b(?:GET|POST)(?:メソッド)?(?:は|が|を|も|ともに|の利用(?:は|を)|の使用(?:は|を))[^。\n]{0,30}(?:古い|非推奨|使うべきではない)/,
    );
  });

  it('contains one comparison table and runnable-looking HTTP and curl examples', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const tables = [...body.matchAll(/^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+/gm)];
    const httpBlocks = [...body.matchAll(/```http\n([\s\S]*?)\n```/g)].map(([, block]) => block);
    const bashBlocks = [...body.matchAll(/```bash\n([\s\S]*?)\n```/g)].map(([, block]) => block);

    expect(tables).toHaveLength(1);
    expect(body).toContain('| 観点 | GET | QUERY | POST |');
    expect(httpBlocks).toHaveLength(1);
    expect(bashBlocks).toHaveLength(1);
    expect(httpBlocks[0]).toContain('QUERY /products/search HTTP/1.1');
    expect(httpBlocks[0]).toContain('Content-Type: application/json');
    expect(bashBlocks[0]).toContain("curl --request QUERY 'https://api.example.com/products/search'");
    expect(bashBlocks[0]).toContain("--header 'Content-Type: application/json'");
    expect(bashBlocks[0]).toContain('--data');
  });
});
