import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const asset = (name: string) => fileURLToPath(new URL(`../../src/assets/blog/${name}`, import.meta.url));

const expectReadableLabels = (source: string, labels: string[]) => {
  const textElements = [...source.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((match) => ({
    fontSize: Number(match[1].match(/font-size="(\d+)"/)?.[1] ?? 0),
    text: match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ''),
  }));

  for (const label of labels) {
    const normalizedLabel = label.replace(/\s+/g, '');
    const element = textElements.find(({ text }) => text.includes(normalizedLabel));

    expect(element, `${label} must be contained in one scalable text element`).toBeDefined();
    expect(element?.fontSize, `${label} must use a source font size of at least 40px`).toBeGreaterThanOrEqual(40);
  }
};

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
    const rootAttributes = source.match(/<svg\b([^>]*)>/)?.[1];
    const attribute = (key: string) => rootAttributes?.match(new RegExp(`\\b${key}="([^"]+)"`))?.[1];

    expect(attribute('width')).toBe('1200');
    expect(attribute('height')).toBe('675');
    expect(attribute('viewBox')).toBe('0 0 1200 675');
    for (const label of labels) expect(source).toContain(label);
  });

  it.each([
    [
      'chatgpt-codex-plugins-roles.svg',
      [
        '仕事に必要な機能をまとめる',
        'Skill: 手順を教える',
        'App: 外部サービスにつなぐ',
        'App Template: Workspace固有の設定を作る雛形',
        'すべてを含める必要はありません',
      ],
    ],
    [
      'chatgpt-codex-plugins-permissions.svg',
      ['Pluginの導入方針', 'AppのWorkspace・Role設定', 'ユーザー認証', '接続先サービスの元権限', '操作確認'],
    ],
  ])('%s keeps required labels readable at mobile width', async (name, labels) => {
    const source = await readFile(asset(name), 'utf8');

    expectReadableLabels(source, labels);
  });

  it('keeps rendered text inside the 390px canvas without overlaps', async () => {
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 300 } });

      for (const name of ['chatgpt-codex-plugins-roles.svg', 'chatgpt-codex-plugins-permissions.svg']) {
        const source = await readFile(asset(name), 'utf8');
        await page.setContent(`<style>body{margin:0}svg{display:block;width:390px;height:auto}</style>${source}`);

        const result = await page.evaluate(() => {
          const svg = document.querySelector('svg');
          if (!svg) throw new Error('SVG root is missing');

          const canvas = svg.getBoundingClientRect();
          const texts = [...svg.querySelectorAll('text')].map((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              bounds: { bottom: bounds.bottom, left: bounds.left, right: bounds.right, top: bounds.top },
              label: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            };
          });
          const clipped = texts.filter(
            ({ bounds }) =>
              bounds.left < canvas.left - 0.5 ||
              bounds.top < canvas.top - 0.5 ||
              bounds.right > canvas.right + 0.5 ||
              bounds.bottom > canvas.bottom + 0.5,
          );
          const overlaps = texts.flatMap((text, index) =>
            texts.slice(index + 1).flatMap((other) => {
              const horizontal = Math.min(text.bounds.right, other.bounds.right) - Math.max(text.bounds.left, other.bounds.left);
              const vertical = Math.min(text.bounds.bottom, other.bounds.bottom) - Math.max(text.bounds.top, other.bounds.top);
              return horizontal > 0.5 && vertical > 0.5 ? [[text.label, other.label]] : [];
            }),
          );

          return { clipped: clipped.map(({ label }) => label), overlaps };
        });

        expect(result.clipped, `${name} has clipped or off-canvas text`).toEqual([]);
        expect(result.overlaps, `${name} has overlapping text`).toEqual([]);
      }
    } finally {
      await browser.close();
    }
  });

  it('does not write generated PNGs when the generator module is imported', async () => {
    const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
    const temporaryRoot = await mkdtemp(resolve(projectRoot, '.tmp-generate-og-import-'));
    const temporaryGenerator = resolve(temporaryRoot, 'scripts/generate-og.mjs');
    const outputPaths = [
      resolve(temporaryRoot, 'public/og-default.png'),
      resolve(temporaryRoot, 'src/assets/blog/chatgpt-codex-plugins-og.png'),
    ];
    const sentinels = outputPaths.map((_, index) => Buffer.from(`import-only-sentinel-${index}`));

    try {
      await Promise.all(outputPaths.map((path) => mkdir(dirname(path), { recursive: true })));
      await mkdir(dirname(temporaryGenerator), { recursive: true });
      await copyFile(resolve(projectRoot, 'scripts/generate-og.mjs'), temporaryGenerator);
      await Promise.all(outputPaths.map((path, index) => writeFile(path, sentinels[index])));

      const generatorUrl = pathToFileURL(temporaryGenerator);
      generatorUrl.searchParams.set('import-only', crypto.randomUUID());
      await import(generatorUrl.href);

      const afterImport = await Promise.all(outputPaths.map((path) => readFile(path)));
      for (const [index, content] of afterImport.entries()) {
        expect(Buffer.compare(content, sentinels[index]), `${outputPaths[index]} was rewritten during import`).toBe(0);
      }
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }

    await expect(access(temporaryRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    ['a missing file', { family: 'Missing Test Font', path: '/definitely/missing/japanese-font.ttf' }],
    ['a directory', { family: 'Directory Test Font', path: fileURLToPath(new URL('../../scripts', import.meta.url)) }],
  ])('rejects %s as a Japanese font candidate', async (_description, candidate) => {
    const { selectJapaneseFont } = await import('../../scripts/generate-og.mjs');

    await expect(selectJapaneseFont([candidate])).rejects.toThrow(
      new RegExp(`Japanese font unavailable.*${candidate.family}.*${candidate.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
  });
});
