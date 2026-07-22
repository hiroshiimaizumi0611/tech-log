import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Definition, Html, Image, ImageReference, Link, LinkReference } from 'mdast';
import remarkParse from 'remark-parse';
import sharp from 'sharp';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const heroUrl = new URL('../../src/assets/blog/kimi-k3-official-hero.webp', import.meta.url);
const articleUrl = new URL('../../src/content/blog/kimi-k3-overview.md', import.meta.url);
const expectedHeadings = [
  'Kimi K3はMoonshot AIの最新モデル',
  '大規模な情報を扱うための設計が目立つ',
  '第三者評価では知能が高く、速度と料金には弱点がある',
  '長いコードや資料を扱う仕事が有力な用途になる',
  '料金と利用条件は使う場所によって異なる',
  '「オープン」の現状には注意が必要',
  '高い評価と現在の制約をセットで見る',
] as const;

function splitArticle(markdown: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error('Article must start with frontmatter enclosed by --- delimiters');

  return { frontmatter: match[1], body: markdown.slice(match[0].length).replace(/\r\n?/g, '\n') };
}

function inspectMarkdown(markdown: string): {
  inlineImages: Array<Pick<Image, 'alt' | 'url'>>;
  imageReferences: Array<Pick<ImageReference, 'alt' | 'identifier'>>;
  htmlImageCount: number;
  links: string[];
} {
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, string>();
  const inlineImages: Array<Pick<Image, 'alt' | 'url'>> = [];
  const imageReferences: Array<Pick<ImageReference, 'alt' | 'identifier'>> = [];
  const links: string[] = [];
  let htmlImageCount = 0;

  visit(tree, 'definition', (node: Definition) => {
    definitions.set(node.identifier, node.url);
  });
  visit(tree, 'link', (node: Link) => links.push(node.url));
  visit(tree, 'linkReference', (node: LinkReference) => {
    const url = definitions.get(node.identifier);
    if (url) links.push(url);
  });
  visit(tree, 'image', (node: Image) => inlineImages.push({ alt: node.alt, url: node.url }));
  visit(tree, 'imageReference', (node: ImageReference) => {
    imageReferences.push({ alt: node.alt, identifier: node.identifier });
  });
  visit(tree, 'html', (node: Html) => {
    htmlImageCount += (node.value.match(/<img\b/gi) ?? []).length;
  });

  return { inlineImages, imageReferences, htmlImageCount, links };
}

function h2Section(body: string, heading: string): string {
  const startMarker = `## ${heading}`;
  const start = body.indexOf(startMarker);
  if (start === -1) throw new Error(`Missing H2 section: ${heading}`);

  const end = body.indexOf('\n## ', start + startMarker.length);
  return body.slice(start, end === -1 ? undefined : end);
}

describe('Kimi K3 official visual', () => {
  it('stores the official hero as a real 1920x879 WebP', async () => {
    const bytes = await readFile(heroUrl);
    const metadata = await sharp(bytes).metadata();

    expect(fileURLToPath(heroUrl)).toContain('kimi-k3-official-hero.webp');
    expect(metadata).toMatchObject({ width: 1920, height: 879, format: 'webp' });
  });
});

describe('Kimi K3 overview article', () => {
  it('publishes the approved metadata and exact H2 structure', async () => {
    const { frontmatter, body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const metadata = parse(frontmatter) as Record<string, unknown>;
    const headings = [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);

    expect(metadata).toMatchObject({
      title: 'Kimi K3とは？2.8兆パラメータの新AIモデルを公式情報とベンチマークから解説',
      description:
        'Moonshot AIが発表したKimi K3とは何か。2.8兆パラメータ、100万トークンのコンテキスト、得意分野、料金、Artificial Analysisによる第三者評価を公式情報に基づいて解説します。',
      publishedAt: '2026-07-22',
      category: 'AI',
      tags: ['Kimi', 'Moonshot AI', '生成AI', 'AIモデル'],
      featured: true,
    });
    expect(metadata.draft).not.toBe(true);
    expect(metadata).not.toHaveProperty('heroImage');
    expect(metadata).not.toHaveProperty('ogImage');
    expect(headings).toEqual(expectedHeadings);
  });

  it('uses required sources, preserves facts, and avoids overclaiming', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { links } = inspectMarkdown(body);

    expect(links).toEqual(
      expect.arrayContaining([
        'https://www.moonshot.ai/',
        'https://www.kimi.com/blog/kimi-k3',
        'https://www.kimi.com/help/getting-started/overview',
        'https://artificialanalysis.ai/models/kimi-k3',
      ]),
    );
    for (const fact of [
      '2026年7月16日',
      '2.8兆',
      '100万トークン',
      'Intelligence Index',
      '57',
      '35.2 tokens/s',
      '$0.30',
      '$3.00',
      '$15.00',
      '2026年7月22日時点',
      '7月27日',
      'フルウェイト',
      '開発元による評価',
      '第三者評価',
    ]) {
      expect(body).toContain(fact);
    }
    expect(body).toMatch(/単一の指標[^。]*(?:決まら|表さ)/);
    expect(body).not.toMatch(/最強|圧倒的|革命的|ゲームチェンジャー/);

    const modelSection = h2Section(body, 'Kimi K3はMoonshot AIの最新モデル');
    expect(inspectMarkdown(modelSection).links).toContain('https://www.kimi.com/blog/kimi-k3');
    expect(modelSection).toContain('2026年7月16日');
    expect(modelSection).toContain('2.8兆');
    expect(modelSection).toMatch(/発表|公開|リリース/);

    const evaluationSection = h2Section(body, '第三者評価では知能が高く、速度と料金には弱点がある');
    expect(inspectMarkdown(evaluationSection).links).toContain('https://artificialanalysis.ai/models/kimi-k3');
    for (const fact of ['Intelligence Index', '57', '35.2 tokens/s', '$3.00', '$15.00']) {
      expect(evaluationSection).toContain(fact);
    }
    expect(evaluationSection).toMatch(/単一の指標[^。]*(?:決まら|表さ)/);

    const pricingSection = h2Section(body, '料金と利用条件は使う場所によって異なる');
    expect(inspectMarkdown(pricingSection).links).toContain('https://www.kimi.com/blog/kimi-k3');
    for (const fact of ['$0.30', '$3.00', '$15.00', '100万トークン']) {
      expect(pricingSection).toContain(fact);
    }

    const openSection = h2Section(body, '「オープン」の現状には注意が必要');
    for (const fact of ['2026年7月22日時点', '7月27日', 'フルウェイト', '未公開']) {
      expect(openSection).toContain(fact);
    }
  });

  it('uses exactly one attributed official image and no third-party image assets', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { inlineImages, imageReferences, htmlImageCount } = inspectMarkdown(body);

    expect(inlineImages).toEqual([
      {
        alt: 'Kimi公式が公開したKimi K3の発表ビジュアル',
        url: '../../assets/blog/kimi-k3-official-hero.webp',
      },
    ]);
    expect(imageReferences).toEqual([]);
    expect(htmlImageCount).toBe(0);
    expect(inlineImages.length + imageReferences.length + htmlImageCount).toBe(1);
    expect(body).toMatch(
      /!\[Kimi公式が公開したKimi K3の発表ビジュアル\]\(\.\.\/\.\.\/assets\/blog\/kimi-k3-official-hero\.webp\)\n\n<!-- prettier-ignore -->\n\*Kimi K3の公式発表ビジュアル。出典：\[Kimi K3公式発表\]\(https:\/\/www\.kimi\.com\/blog\/kimi-k3\)\*/,
    );
    expect(body).not.toMatch(/artificial[-_]?analysis[^\s\])}>]*\.(?:png|jpe?g|webp|svg)(?=$|[\s\])}>.,;:!?])/i);
  });
});
