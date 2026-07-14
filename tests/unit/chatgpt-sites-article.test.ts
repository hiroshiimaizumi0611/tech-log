import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const asset = (name: string) => fileURLToPath(new URL(`../../src/assets/blog/${name}`, import.meta.url));

describe('ChatGPT Sites article visuals', () => {
  it('builds a 1200x630 PNG', async () => {
    const metadata = await sharp(asset('chatgpt-sites-guide-og.png')).metadata();

    expect(metadata).toMatchObject({ width: 1200, height: 630, format: 'png' });
  });

  it('exposes the save-before-deploy flow in a scalable SVG', async () => {
    const source = await readFile(asset('chatgpt-sites-save-vs-deploy.svg'), 'utf8');
    const rootAttributes = source.match(/<svg\b([^>]*)>/)?.[1];
    const attribute = (key: string) => rootAttributes?.match(new RegExp(`\\b${key}="([^"]+)"`))?.[1];

    expect(attribute('width')).toBe('1200');
    expect(attribute('height')).toBe('675');
    expect(attribute('viewBox')).toBe('0 0 1200 675');
    for (const label of ['バージョンを保存', '内容とアクセスを確認', '承認してから進む', 'デプロイ', '共有範囲を確認']) {
      expect(source).toContain(label);
    }
  });
});
