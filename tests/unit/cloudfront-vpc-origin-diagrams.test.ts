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
  },
] as const;

function rootAttribute(source: string, root: 'svg' | 'mxfile', name: string): string | undefined {
  const attributes = source.match(new RegExp('<' + root + '\\b([^>]*)>'))?.[1];
  return attributes?.match(new RegExp('\\b' + name + '="([^"]+)"'))?.[1];
}

describe('CloudFront VPC Origins article diagrams', () => {
  it.each(diagrams)('$drawio is editable, well-formed, and uses AWS4 shapes', async ({ drawio, labels }) => {
    const path = projectFile(drawio);
    await expect(execFileAsync('/usr/bin/xmllint', ['--noout', path])).resolves.toBeDefined();
    const source = await readFile(path, 'utf8');

    expect(rootAttribute(source, 'mxfile', 'host')).toBeDefined();
    expect(source).toContain('<diagram');
    expect(source).toContain('<mxGraphModel');
    expect(source).toMatch(/<mxCell\s+id="0"\s*\/>/);
    expect(source).toMatch(/<mxCell\s+id="1"\s+parent="0"\s*\/>/);
    expect(source).toContain('mxgraph.aws4.');
    expect(source).not.toMatch(/<diagram[^>]*>\s*[A-Za-z0-9+/=]{100,}\s*<\/diagram>/);

    const ids = [...source.matchAll(/<mxCell\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of source.matchAll(/\b(?:source|target)="([^"]+)"/g)) expect(ids).toContain(match[1]);
    for (const label of labels) expect(source).toContain(label.replaceAll('&', '&amp;'));
  });

  it.each(diagrams)('$svg is a safe, well-formed 1200x675 asset', async ({ svg, labels }) => {
    const path = projectFile(svg);
    await expect(execFileAsync('/usr/bin/xmllint', ['--noout', path])).resolves.toBeDefined();
    const source = await readFile(path, 'utf8');

    expect(rootAttribute(source, 'svg', 'width')).toBe('1200');
    expect(rootAttribute(source, 'svg', 'height')).toBe('675');
    expect(rootAttribute(source, 'svg', 'viewBox')).toBe('0 0 1200 675');
    for (const label of labels) expect(source).toContain(label);
    expect(source).not.toMatch(/<script\b|\bon[a-z][\w:-]*\s*=/i);
  });
});
