import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const projectFile = (path: string) => fileURLToPath(new URL('../../' + path, import.meta.url));

const diagrams = [
  {
    drawio: 'docs/diagrams/cloudfront-vpc-origin-outage-path.drawio',
    svg: 'src/assets/blog/cloudfront-vpc-origin-outage-path.svg',
    labels: [
      'CloudFront VPC Origins障害のリクエスト経路',
      'Viewer',
      'Amazon CloudFront',
      'AWS管理のVPC Origin接続レイヤー',
      'サービス管理ENI',
      'Private ALB',
      'アプリケーション',
      '内部制約',
      'ルーティング設定の読み込み失敗',
    ],
    requiredEdges: [
      ['viewer-container', 'cloudfront-icon'],
      ['cloudfront-icon', 'routing-constraint'],
      ['routing-constraint', 'eni-icon'],
      ['eni-icon', 'alb-icon'],
      ['alb-icon', 'application-icon'],
    ],
    requiredAwsShapes: [
      'resIcon=mxgraph.aws4.cloudfront',
      'shape=mxgraph.aws4.elastic_network_interface',
      'resIcon=mxgraph.aws4.elastic_load_balancing',
      'resIcon=mxgraph.aws4.ec2',
    ],
  },
  {
    drawio: 'docs/diagrams/cloudfront-vpc-origin-failover.drawio',
    svg: 'src/assets/blog/cloudfront-vpc-origin-failover.svg',
    labels: [
      'VPC Origins障害に備える二層の切り替え',
      '読み取り系',
      'GET / HEAD / OPTIONS',
      'Origin Group',
      'Primary: VPC Origin',
      'Secondary: Public ALB',
      '更新系API',
      'POST / PUT / PATCH / DELETE',
      '監視・切り分け',
      '承認',
      'CloudFront設定を手動変更',
      'CloudFront Prefix List',
      'Custom Header',
    ],
    requiredEdges: [
      ['read-methods', 'origin-group'],
      ['origin-group', 'primary-origin-icon'],
      ['origin-group', 'secondary-alb-icon'],
      ['write-methods', 'monitor-triage'],
      ['monitor-triage', 'approval'],
      ['approval', 'manual-cloudfront-change'],
      ['manual-cloudfront-change', 'secondary-alb-icon'],
    ],
    requiredAwsShapes: ['resIcon=mxgraph.aws4.cloudfront', 'resIcon=mxgraph.aws4.vpc', 'resIcon=mxgraph.aws4.elastic_load_balancing'],
  },
] as const;

function rootAttribute(source: string, root: 'svg' | 'mxfile', name: string): string | undefined {
  const attributes = source.match(new RegExp('<' + root + '\\b([^>]*)>'))?.[1];
  return attributes?.match(new RegExp('\\b' + name + '="([^"]+)"'))?.[1];
}

function mxCellAttributes(source: string): Array<Record<string, string>> {
  return [...source.matchAll(/<mxCell\b[^>]*>/g)].map(([tag]) =>
    Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]])),
  );
}

describe('CloudFront VPC Origins article diagrams', () => {
  it.each(diagrams)(
    '$drawio is editable, well-formed, and uses AWS4 shapes',
    async ({ drawio, labels, requiredEdges, requiredAwsShapes }) => {
      const path = projectFile(drawio);
      await expect(execFileAsync('/usr/bin/xmllint', ['--noout', path])).resolves.toBeDefined();
      const source = await readFile(path, 'utf8');

      expect(rootAttribute(source, 'mxfile', 'host')).toBeDefined();
      expect(source).toContain('<diagram');
      expect(source).toContain('<mxGraphModel');
      expect(source).toMatch(/<mxCell\s+id="0"\s*\/>/);
      expect(source).toMatch(/<mxCell\s+id="1"\s+parent="0"\s*\/>/);
      expect(source).not.toMatch(/<diagram[^>]*>\s*[A-Za-z0-9+/=]{100,}\s*<\/diagram>/);
      for (const awsShape of requiredAwsShapes) expect(source).toContain(awsShape);

      const cells = mxCellAttributes(source);
      const ids = cells.map(({ id }) => id).filter((id): id is string => id !== undefined);
      expect(new Set(ids).size).toBe(ids.length);
      for (const { source: edgeSource, target: edgeTarget } of cells) {
        if (edgeSource) expect(ids).toContain(edgeSource);
        if (edgeTarget) expect(ids).toContain(edgeTarget);
      }
      for (const label of labels) expect(source).toContain(label.replaceAll('&', '&amp;'));
      for (const [edgeSource, edgeTarget] of requiredEdges) {
        expect(cells).toContainEqual(expect.objectContaining({ edge: '1', source: edgeSource, target: edgeTarget }));
      }
    },
  );

  it.each(diagrams)('$svg is a safe, well-formed 1200x675 asset', async ({ svg, labels }) => {
    const path = projectFile(svg);
    await expect(execFileAsync('/usr/bin/xmllint', ['--noout', path])).resolves.toBeDefined();
    const source = await readFile(path, 'utf8');

    expect(rootAttribute(source, 'svg', 'width')).toBe('1200');
    expect(rootAttribute(source, 'svg', 'height')).toBe('675');
    expect(rootAttribute(source, 'svg', 'viewBox')).toBe('0 0 1200 675');
    const visibleMarkup = source.slice(source.indexOf('<defs'));
    expect(visibleMarkup).not.toBe(source);
    for (const label of labels) expect(visibleMarkup).toContain(label);
    expect(source).not.toMatch(/<!DOCTYPE\b/i);
    expect(source).not.toMatch(/<script\b|\bon[a-z][\w:-]*\s*=/i);
    expect(source).not.toMatch(/\b(?:href|xlink:href)\s*=\s*["']\s*javascript:/i);
    expect(source).not.toMatch(/\b(?:href|xlink:href)\s*=\s*["']\s*https?:\/\//i);
    expect(source).not.toMatch(/url\(\s*["']?\s*https?:\/\//i);
  });
});
