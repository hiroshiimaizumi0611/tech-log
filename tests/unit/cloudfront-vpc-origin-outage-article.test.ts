import { readFile } from 'node:fs/promises';

import type { Definition, Image, Link, LinkReference } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const articleUrl = new URL('../../src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md', import.meta.url);
// Fact-checked against AWS public event ARN on 2026-07-17 JST.
const eventArn =
  'arn:aws:health:global::event/CLOUDFRONT/AWS_CLOUDFRONT_OPERATIONAL_ISSUE/AWS_CLOUDFRONT_OPERATIONAL_ISSUE_EDF4C_83808542A4E';
const expectedHeadings = [
  '2026年7月16日のCloudFront障害で何が起きたか',
  '影響を受けた構成・受けなかった構成',
  'そもそもCloudFrontのVPCオリジンとは',
  '障害の原因をリクエスト経路から理解する',
  'AWSが案内した暫定回避策',
  '読み取り系リクエストをOrigin Groupで備える',
  'POST・PUTを含むAPIは手動切り替えを準備する',
  '障害発生時の確認・切り替え手順',
  '復旧後に元へ戻すときの確認事項',
  'VPCオリジンをやめるべきか',
] as const;

function splitArticle(markdown: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error('Article must start with frontmatter enclosed by --- delimiters');
  return { frontmatter: match[1], body: markdown.slice(match[0].length).replace(/\r\n?/g, '\n') };
}

function inspectMarkdown(markdown: string): { images: Array<Pick<Image, 'alt' | 'url'>>; links: string[] } {
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, string>();
  const images: Array<Pick<Image, 'alt' | 'url'>> = [];
  const links: string[] = [];

  visit(tree, 'definition', (node: Definition) => {
    definitions.set(node.identifier, node.url);
  });
  visit(tree, 'link', (node: Link) => links.push(node.url));
  visit(tree, 'linkReference', (node: LinkReference) => {
    const url = definitions.get(node.identifier);
    if (url) links.push(url);
  });
  visit(tree, 'image', (node: Image) => images.push({ alt: node.alt, url: node.url }));

  return { images, links };
}

function normalizedParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function h2Section(body: string, heading: string): string {
  const startMarker = `## ${heading}`;
  const start = body.indexOf(startMarker);
  if (start === -1) throw new Error(`Missing H2 section: ${heading}`);
  const end = body.indexOf('\n## ', start + startMarker.length);
  return body.slice(start, end === -1 ? undefined : end);
}

function hasUnprovenCandidateWording(text: string): boolean {
  return normalizedParagraphs(text).some(
    (paragraph) =>
      /(?:今回の|この)障害/.test(paragraph) &&
      /(?:確認|検証|実証)[^。]{0,40}(?:(?:できてい|してい)ない|できません|不明)/.test(paragraph) &&
      /候補/.test(paragraph),
  );
}

describe('CloudFront VPC Origins outage article', () => {
  it.each([
    ['今回の障害でOrigin Groupが実際にフェイルオーバーできたことは確認できていないため、将来の障害に備える候補です。', true],
    ['この障害でOrigin Groupが実際にフェイルオーバーできたかは検証できません。将来に向けた候補として扱います。', true],
    ['今回の障害でOrigin Groupが実際にフェイルオーバーできたことを確認できたため、有効な候補です。', false],
  ] as const)('classifies unproven candidate wording as %s', (text, expected) => {
    expect(hasUnprovenCandidateWording(text)).toBe(expected);
  });

  it('publishes the approved metadata and exact H2 structure', async () => {
    const { frontmatter, body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const metadata = parse(frontmatter) as Record<string, unknown>;
    const headings = [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);

    expect(metadata).toMatchObject({
      title: '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理',
      description:
        '2026年7月16日に発生したAWS CloudFrontのVPC Origins障害について、影響範囲と原因、VPCオリジンの仕組み、読み取り系と更新系に分けた回避策を公式情報から整理します。',
      publishedAt: '2026-07-17',
      category: 'Infrastructure',
      tags: ['AWS', 'CloudFront', 'VPC', '障害対応'],
      featured: true,
    });
    expect(metadata).not.toHaveProperty('heroImage');
    expect(metadata).not.toHaveProperty('ogImage');
    expect(headings).toEqual(expectedHeadings);
  });

  it('uses only AWS primary sources for the event and documented mechanisms', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { links } = inspectMarkdown(body);
    const expectedUrls = [
      'https://health.aws.amazon.com/health/status',
      'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html',
      'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html',
    ];
    const externalUrls = links.filter((href) => new URL(href, 'https://relative.invalid').origin !== 'https://relative.invalid');

    expect(body).toContain(eventArn);
    expect(links).toEqual(expect.arrayContaining(expectedUrls));
    for (const href of externalUrls) {
      const url = new URL(href, 'https://relative.invalid');
      expect(url.protocol).toBe('https:');
      expect(['health.aws.amazon.com', 'docs.aws.amazon.com']).toContain(url.hostname);
    }
  });

  it('states the incident scope and timing without overstating what failed', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const paragraphs = normalizedParagraphs(body);

    for (const fact of [
      '2026年7月16日16:45',
      '20:18',
      '3時間33分',
      '5xx',
      'VPC Origins',
      '他のオリジン種別',
      '内部制約',
      '更新済みの設定データを正しく読み込めなくなった',
      '3:52 AM PDT',
      '4:18 AM PDT',
      '一時的に別のオリジン種別へ変更',
    ]) {
      expect(body).toContain(fact);
    }
    expect(
      paragraphs.some(
        (paragraph) =>
          paragraph.includes('管理環境') &&
          /CloudFrontを(?:利用|使用)していな/.test(paragraph) &&
          /直接(?:的)?な?影響(?:は)?(?:ありません|ない)/.test(paragraph),
      ),
    ).toBe(true);
    for (const overstatement of [
      'CloudFront全体が停止',
      '全リクエストが失敗',
      'Origin Groupで今回の障害を回避できた',
      'Public ALBへ切り替えて復旧した',
      'VPC Origins障害を経験した',
    ]) {
      expect(body).not.toContain(overstatement);
    }
  });

  it('separates documented failover behavior from this event and gives safe mitigation guidance', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const paragraphs = normalizedParagraphs(body);

    for (const fact of ['AWS-managed prefix list', 'custom header', '403', 'Deploying', '二重実行', 'データ整合性']) {
      expect(body).toContain(fact);
    }
    expect(body).toMatch(/(?:接続(?:失敗)?[^。\n]{0,60}503|503[^。\n]{0,60}接続(?:失敗)?)/);
    expect(body).toMatch(/(?:timeout[^。\n]{0,60}504|504[^。\n]{0,60}timeout)/i);
    expect(
      paragraphs.some(
        (paragraph) =>
          /(?:自動(?:フェイルオーバー|切り替え)|Origin Group)/.test(paragraph) &&
          /GET[^。]{0,30}HEAD[^。]{0,30}OPTIONS/.test(paragraph) &&
          /(?:のみ|だけ|に限(?:る|られ(?:る|ている))?|限定|(?:GET[^。]{0,60}OPTIONS|OPTIONS[^。]{0,60}GET)[^。]{0,40}以外[^。]{0,40}(?:対象外|適用されない|非対応))/.test(
            paragraph,
          ) &&
          !/(?:POST[^。]{0,40}自動(?:フェイルオーバー|切り替え)(?![^。]{0,40}(?:対象外|適用されない|非対応|できない))|自動(?:フェイルオーバー|切り替え)[^。]{0,40}POST(?![^。]{0,40}(?:対象外|適用されない|非対応|できない)))/.test(
            paragraph,
          ),
      ),
    ).toBe(true);
    expect(
      paragraphs.some((paragraph) => /(?:OPTIONS[^。]{0,50}Cached HTTP methods|Cached HTTP methods[^。]{0,50}OPTIONS)/.test(paragraph)),
    ).toBe(true);
    expect(
      paragraphs.some(
        (paragraph) =>
          /POST[^。]{0,30}PUT[^。]{0,30}PATCH[^。]{0,30}DELETE/.test(paragraph) &&
          /手動/.test(paragraph) &&
          /変更|切り替え/.test(paragraph),
      ),
    ).toBe(true);
    expect(
      paragraphs.some(
        (paragraph) =>
          /updateRequestOrigin\(\)/.test(paragraph) &&
          /VPC Origins?/.test(paragraph) &&
          /(?:定義|更新)/.test(paragraph) &&
          /(?:でき(?:ない|ません|ず)|対応していない|利用できない|使えない|対象外|未対応|cannot|not supported?)/i.test(paragraph) &&
          /(?:失敗|fail)/i.test(paragraph),
      ),
    ).toBe(true);
    expect(
      paragraphs.some(
        (paragraph) =>
          /selectRequestOriginById\(\)/.test(paragraph) &&
          /(?:事前|あらかじめ)[^。]{0,40}(?:登録|設定)/.test(paragraph) &&
          /VPC origin/i.test(paragraph),
      ),
    ).toBe(true);
    expect(
      paragraphs.some(
        (paragraph) => /createRequestOriginGroup\(\)/.test(paragraph) && /VPC origins?/i.test(paragraph) && /含(?:め|む)/.test(paragraph),
      ),
    ).toBe(true);
    expect(
      paragraphs.some((paragraph) => paragraph.includes('次のリクエスト') && /primary/i.test(paragraph) && /再試行|retry/i.test(paragraph)),
    ).toBe(true);
    expect(hasUnprovenCandidateWording(body)).toBe(true);
  });

  it('connects Public ALB access controls and zero-downtime header rotation', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const writeSection = h2Section(body, 'POST・PUTを含むAPIは手動切り替えを準備する');
    const publicAlbStart = writeSection.indexOf('待機用Public ALB');
    expect(publicAlbStart).toBeGreaterThanOrEqual(0);
    const publicAlbGuidance = writeSection.slice(publicAlbStart).replace(/\s+/g, ' ');

    expect(publicAlbGuidance).toContain('AWS-managed prefix list');
    expect(publicAlbGuidance).toMatch(/(?:Origin Protocol Policy[^。]{0,40}https-only|https-only[^。]{0,40}Origin Protocol Policy)/i);
    expect(publicAlbGuidance).toMatch(/(?:ALB[^。]{0,50}HTTPS listener|HTTPS listener[^。]{0,50}ALB)[^。]{0,50}(?:必要|必須)/i);
    expect(publicAlbGuidance).toMatch(/(?:証明書|certificate)[^。]{0,100}Origin Domain[^。]{0,80}(?:一致|cover|対象)/i);
    expect(publicAlbGuidance).toMatch(
      /(?:viewer[^。]{0,20})?Host[^。]{0,120}origin request policy[^。]{0,120}(?:場合|とき|のみ)[^。]{0,120}(?:証明書|hostname|ホスト名|オリジン)/i,
    );
    expect(publicAlbGuidance).toMatch(
      /(?:ランダム|random)[^。]{0,250}(?:header|ヘッダー)[^。]{0,250}(?:名前|name)[^。]{0,40}(?:値|value)/i,
    );
    expect(publicAlbGuidance).toMatch(/(?:header|ヘッダー)[^。]{0,250}(?:名前|name)[^。]{0,40}(?:値|value)[^。]{0,60}(?:秘密|secret)/i);
    expect(publicAlbGuidance).toMatch(/listener rule[^。]{0,100}(?:不一致|一致しない)[^。]{0,40}403/i);
    expect(publicAlbGuidance).toMatch(
      /(?:新しい|追加)[^。]{0,120}(?:header|ヘッダー)[^。]{0,80}(?:名前|name)[^。]{0,40}(?:値|value)[^。]{0,60}(?:ペア|組)/i,
    );
    expect(publicAlbGuidance).toMatch(
      /(?:新しい|追加)[^。]{0,160}ALB[^。]{0,120}(?:rule|ルール)[\s\S]*CloudFront[^。]{0,160}(?:新旧|両方|双方|古い[^。]{0,40}新しい)[\s\S]*Deploying[^。]{0,100}(?:完了|終了)[\s\S]*CloudFront[^。]{0,120}(?:古い|元の)[^。]{0,100}(?:削除|停止)[\s\S]*ALB[^。]{0,120}(?:古い|元の)[^。]{0,100}(?:削除|除去)/i,
    );
  });

  it('uses distribution metrics for detection and request logs for breakdowns', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const runbook = h2Section(body, '障害発生時の確認・切り替え手順').replace(/\s+/g, ' ');

    expect(runbook).toMatch(
      /CloudWatch[^。]{0,100}distribution[^。]{0,100}5xxErrorRate|5xxErrorRate[^。]{0,100}distribution[^。]{0,100}CloudWatch/i,
    );
    expect(runbook).toMatch(/(?:standard|標準)[^。]{0,30}(?:access )?logs?|(?:access )?logs?[^。]{0,30}(?:standard|標準)/i);
    expect(runbook).toMatch(/real-time[^。]{0,30}(?:access )?logs?/i);
    for (const field of ['cs-uri-stem', 'x-edge-location', 'cache-behavior-path-pattern', 'c-country']) {
      expect(runbook).toContain(field);
    }
  });

  it('uses two accessible diagrams with their approved captions', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { images } = inspectMarkdown(body);

    expect(images).toEqual([
      {
        alt: 'CloudFrontからVPCオリジンへ接続する経路と2026年7月16日の障害箇所',
        url: '../../assets/blog/cloudfront-vpc-origin-outage-path.svg',
      },
      {
        alt: '読み取り系の自動フェイルオーバー候補と更新系APIの手動切り替え構成',
        url: '../../assets/blog/cloudfront-vpc-origin-failover.svg',
      },
    ]);
    for (const caption of ['図1：CloudFrontからVPCオリジンへ到達する概念的な経路', '図2：読み取り系と更新系を分けた二層の切り替え']) {
      expect(body).toContain(`*${caption}*`);
    }
  });
});
