import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const asset = (name: string) => fileURLToPath(new URL(`../../src/assets/blog/${name}`, import.meta.url));

describe('plugins article visuals', () => {
  it('builds a 1200x630 PNG without the misleading equality claim', async () => {
    const metadata = await sharp(asset('chatgpt-codex-plugins-og.png')).metadata();

    expect(metadata).toMatchObject({ width: 1200, height: 630, format: 'png' });

    const generator = await readFile(new URL('../../scripts/generate-og.mjs', import.meta.url), 'utf8');
    expect(generator).toContain('Pluginに含められるもの');
    expect(generator).not.toMatch(/Plugin\s*=\s*Skill/);
  });

  it.each([
    ['chatgpt-codex-plugins-roles.svg', ['Plugin', 'Skill', 'App', 'まとめる', '教える', 'つなぐ']],
    ['chatgpt-codex-plugins-permissions.svg', ['Plugin', 'App', '接続先', '確認']],
  ])('%s exposes the required labels and scalable viewBox', async (name, labels) => {
    const source = await readFile(asset(name), 'utf8');

    expect(source).toMatch(/<svg[^>]+viewBox=/);
    for (const label of labels) expect(source).toContain(label);
  });
});
