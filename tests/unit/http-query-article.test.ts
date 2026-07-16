import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const articleUrl = new URL('../../src/content/blog/http-query-method-rfc-10008.md', import.meta.url);

function splitArticle(markdown: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error('Article must start with frontmatter enclosed by --- delimiters');
  return { frontmatter: match[1], body: markdown.slice(match[0].length) };
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
    expect(body).not.toMatch(/!\[[^\]]*\]\(/);
  });

  it('uses primary sources and preserves the important RFC semantics', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));

    for (const url of [
      'https://www.rfc-editor.org/rfc/rfc10008.html',
      'https://www.rfc-editor.org/rfc/rfc9110.html',
      'https://www.iana.org/assignments/http-methods/http-methods.xhtml',
      'https://fetch.spec.whatwg.org/',
      'https://curl.se/docs/manpage.html',
    ]) {
      expect(body).toContain(url);
    }

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
    expect(body).toContain('Locationは同じ問い合わせを再実行できるリソース');
    expect(body).toContain('Content-Locationは返された結果に対応するリソース');
    expect(body).not.toMatch(/GETやPOSTは(?:古い|非推奨|使うべきではない)/);
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
