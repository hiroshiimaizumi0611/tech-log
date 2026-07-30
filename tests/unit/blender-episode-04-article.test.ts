import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = process.cwd();
const articlePath = path.join(root, 'src/content/blog/blender-server-room-04-react-dashboard.md');
const episodeThreePath = path.join(root, 'src/content/blog/blender-server-room-03-glb.md');

function splitArticle(source: string) {
  const match = source.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Expected YAML frontmatter followed by an article body');
  }

  return {
    metadata: parse(match[1]) as Record<string, unknown>,
    body: match[2],
  };
}

const source = await readFile(articlePath, 'utf8');
const { metadata, body } = splitArticle(source);

describe('Blender server room episode four article', () => {
  it('keeps the approved frontmatter as a draft', () => {
    expect(metadata).toMatchObject({
      title: 'React Three Fiberで3Dサーバールームを表示し、アラームで色を変える',
      publishedAt: '2026-07-30',
      category: 'Frontend',
      draft: true,
      heroImage: '../../assets/blog/blender-04-alarm-state.png',
    });
    expect(metadata.description).toEqual(expect.any(String));
    expect((metadata.description as string).trim().length).toBeGreaterThan(20);
    expect(metadata.tags).toEqual(expect.arrayContaining(['Blender', 'React', '3D']));
  });

  it('uses all four screenshots with unique alt text and captions', () => {
    const assets = [
      'blender-04-vite-initial.png',
      'blender-04-react-viewer.png',
      'blender-04-server-selected.png',
      'blender-04-alarm-state.png',
    ];
    const images = [
      ...body.matchAll(
        /!\[([^\]]*)\]\(\.\.\/\.\.\/assets\/blog\/(blender-04-[^)]+\.png)\)\n(<span class="article-image-caption">[^<]+<\/span>)/g,
      ),
    ];

    expect(images.map((match) => match[2])).toEqual(assets);
    const altTexts = images.map((match) => match[1].trim());
    expect(altTexts.every(Boolean)).toBe(true);
    expect(new Set(altTexts).size).toBe(assets.length);
    expect(images.every((match) => match[3].includes('図'))).toBe(true);
  });

  it('links to each earlier article in the series', () => {
    for (const href of ['/blog/blender-server-room-01-rack/', '/blog/blender-server-room-02-room/', '/blog/blender-server-room-03-glb/']) {
      expect(body).toContain(`](${href})`);
    }
  });

  it('explains the React and GLB implementation', () => {
    for (const term of [
      'public',
      'Vite',
      'React Three Fiber',
      'Drei',
      'useGLTF',
      'OrbitControls',
      'event.object.name',
      '14台',
      'select',
      'material.clone()',
    ]) {
      expect(body).toContain(term);
    }
    expect(body).toMatch(/第4回[\s\S]{0,80}Blender(?:自体)?は触ら/);
  });

  it('records alarm behavior and the limits of the local prototype', () => {
    for (const term of ['#22C55E', '#EF4444', 'アラーム発生', '正常に戻す', '読み込み中', '読み込み失敗', 'Production build', '500KB']) {
      expect(body).toContain(term);
    }
    expect(body).toMatch(/AWS[\s\S]{0,100}接続していません/);
    expect(body).toContain('CloudWatch');
    expect(body).toMatch(/ローカル(?:の)?state/);
    expect(body).toMatch(/実際のブラウザ|実ブラウザ/);
  });

  it('updates episode three to describe healthy servers as green', async () => {
    const episodeThree = await readFile(episodeThreePath, 'utf8');

    expect(episodeThree).not.toContain('正常なサーバーは灰色');
    expect(episodeThree).toContain('正常なサーバーは緑');
  });
});
