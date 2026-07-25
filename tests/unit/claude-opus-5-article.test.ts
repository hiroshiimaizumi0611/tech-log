import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Definition, Html, Image, ImageReference, Link, LinkReference } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { parse } from 'yaml';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const heroUrl = new URL('../../src/assets/blog/claude-opus-5-evolution.webp', import.meta.url);
const articleUrl = new URL('../../src/content/blog/claude-opus-5-overview.md', import.meta.url);
const expectedHeadings = [
  'Claude Opus 5とは',
  'Opus 4.8から強化された内容',
  '料金と基本仕様はOpus 4.8から据え置き',
  'ベンチマークは公式評価と第三者評価を分けて読む',
  'Fable 5・Sonnet 5との使い分け',
  'Claude Codeでは難しさと費用で選ぶ',
  'Opus 4.8からAPIを移行するときの確認事項',
  'まとめ',
] as const;

const requiredSources = [
  'https://www.anthropic.com/news/claude-opus-5',
  'https://platform.claude.com/docs/en/about-claude/models/whats-new-opus-5',
  'https://platform.claude.com/docs/en/about-claude/models/migration-guide',
  'https://platform.claude.com/docs/en/about-claude/models/overview',
  'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5',
  'https://artificialanalysis.ai/articles/claude-opus-5-leader-agentic-knowledge-work',
] as const;

function splitArticle(markdown: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error('Article must start with frontmatter enclosed by --- delimiters');

  return { frontmatter: match[1], body: markdown.slice(match[0].length).replace(/\r\n?/g, '\n') };
}

function extractH2Section(body: string, heading: (typeof expectedHeadings)[number]): string {
  const lines = body.split('\n');
  const start = lines.indexOf(`## ${heading}`);
  if (start === -1) throw new Error(`Missing H2 section: ${heading}`);

  const nextHeading = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, nextHeading === -1 ? undefined : nextHeading).join('\n');
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

describe('Claude Opus 5 original visual', () => {
  it('stores a 1600x900 WebP suitable for article cards and OGP', async () => {
    const bytes = await readFile(heroUrl);
    const metadata = await sharp(bytes).metadata();

    expect(fileURLToPath(heroUrl)).toContain('claude-opus-5-evolution.webp');
    expect(metadata).toMatchObject({ width: 1600, height: 900, format: 'webp' });
    expect(bytes.byteLength).toBeGreaterThan(80_000);
  });
});

describe('Claude Opus 5 overview article', () => {
  it('publishes the approved metadata and exact H2 structure', async () => {
    const { frontmatter, body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const metadata = parse(frontmatter) as Record<string, unknown>;
    const headings = [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);

    expect(metadata).toMatchObject({
      title: 'Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説',
      description:
        'Claude Opus 5とは何か。Opus 4.8から強化された推論・コーディング性能、料金、ベンチマーク、Fable 5・Sonnet 5との違い、API移行時の注意点を解説します。',
      publishedAt: '2026-07-26',
      category: 'AI',
      tags: ['Claude', 'Anthropic', 'AIモデル', 'Claude Code'],
      featured: true,
      heroImage: '../../assets/blog/claude-opus-5-evolution.webp',
      ogImage: '../../assets/blog/claude-opus-5-evolution.webp',
    });
    expect(metadata.draft).not.toBe(true);
    expect(headings).toEqual(expectedHeadings);
  });

  it('uses primary sources, separates third-party evaluation, and preserves migration facts', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { links } = inspectMarkdown(body);
    const overviewSection = extractH2Section(body, 'Claude Opus 5とは');
    const improvementsSection = extractH2Section(body, 'Opus 4.8から強化された内容');
    const pricingSection = extractH2Section(body, '料金と基本仕様はOpus 4.8から据え置き');
    const benchmarkSection = extractH2Section(body, 'ベンチマークは公式評価と第三者評価を分けて読む');
    const migrationSection = extractH2Section(body, 'Opus 4.8からAPIを移行するときの確認事項');

    expect(links).toEqual(expect.arrayContaining([...requiredSources]));

    for (const fact of [
      '2026年7月24日',
      '2026年7月26日時点',
      '100万トークン',
      '128k',
      'thinking',
      'effort',
      '512トークン',
      '1,024トークン',
      'Web fetch',
      'Priority Tier',
      '1720',
      '1574',
      '$17.79',
      '$22.30',
      '36.2分',
      '24.1分',
    ]) {
      expect(body).toContain(fact);
    }

    expect(overviewSection).toMatch(/APIモデルIDは\s*`claude-opus-5`/);
    expect(pricingSection).toMatch(/\|\s*入力料金\s*\|\s*\$5／100万トークン\s*\|\s*\$5／100万トークン\s*\|/);
    expect(pricingSection).toMatch(/\|\s*出力料金\s*\|\s*\$25／100万トークン\s*\|\s*\$25／100万トークン\s*\|/);
    expect(migrationSection).toMatch(/model = "claude-opus-4-8"\s+# 変更前\s*\nmodel = "claude-opus-5"\s+# 変更後/);

    expect.soft(improvementsSection).toMatch(/`thinking`は[^。\n]*回答前[^。\n]*内部[^。\n]*推論[^。\n]*仕組み/);
    expect.soft(improvementsSection).toMatch(/`effort`は[^。\n]*推論[^。\n]*ツール利用[^。\n]*どの程度[^。\n]*力をかける[^。\n]*設定/);
    expect
      .soft(pricingSection)
      .toMatch(
        /コンテキストウィンドウは(?=[^。\n]*入力)(?=[^。\n]*会話履歴)(?=[^。\n]*生成出力)(?=[^。\n]*thinking)(?=[^。\n]*(?:合計|総量|合わせて))[^。\n]*上限/,
      );
    expect.soft(benchmarkSection).toMatch(/Eloは[^。\n]*高いほど[^。\n]*他モデルとの相対評価[^。\n]*高い[^。\n]*指標/);
    expect.soft(migrationSection).toMatch(/Priority Tierは[^。\n]*APIリクエスト[^。\n]*優先して処理[^。\n]*処理枠/);

    expect.soft(benchmarkSection).toMatch(/コーディングを含む[^。\n]*多領域[^。\n]*エージェント作業[^。\n]*Frontier-Bench v0\.1/);
    expect.soft(benchmarkSection).toMatch(/未知の環境[^。\n]*対話型推論[^。\n]*ARC-AGI 3/);
    expect.soft(benchmarkSection).toMatch(/長時間のPC操作[^。\n]*OSWorld 2\.0/);
    expect.soft(benchmarkSection).toMatch(/実際のCursorセッション[^。\n]*曖昧な複数ファイル課題[^。\n]*CursorBench 3\.2/);

    expect(body).toContain('公式発表');
    expect(body).toContain('第三者評価');
    expect(body).toMatch(/(?:ハンズオン|実機比較)[^。\n]*(?:行って|実施して)いません/);
    expect(body).not.toMatch(/(?:世界最強|圧倒的|革命的|ゲームチェンジャー|完全に置き換え)/);
  });

  it('uses one original image in the body and no copied benchmark images', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { htmlImageCount, imageReferences, inlineImages } = inspectMarkdown(body);

    expect(inlineImages).toEqual([
      {
        alt: 'Claude Opus 4.8からOpus 5への進化を表したオリジナル画像',
        url: '../../assets/blog/claude-opus-5-evolution.webp',
      },
    ]);
    expect(imageReferences).toEqual([]);
    expect(htmlImageCount).toBe(0);
    expect(inlineImages.length + imageReferences.length + htmlImageCount).toBe(1);
    expect(body).toContain('テックログのオリジナル画像');
    expect(body).not.toMatch(/(?:anthropic|artificial[-_]?analysis)[^\s\])}>]*\.(?:png|jpe?g|webp|svg)/i);
  });
});
