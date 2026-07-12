import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('README authoring and publishing guide', () => {
  it('documents every required beginner-facing section and local command', async () => {
    const readme = await readProjectFile('README.md');

    for (const heading of [
      'Node.js',
      'インストール',
      'ローカル開発',
      '記事を追加する',
      'frontmatter',
      'テスト',
      'ビルド',
      'Pagefind',
      'Cloudflare',
      'GitHub Secrets / Variables',
      '公開',
      'トラブルシューティング',
    ]) {
      expect(readme).toContain(`## ${heading}`);
    }

    expect(readme).toMatch(/Node\.js 24/);
    for (const command of ['npm ci', 'npm run dev', 'npm run check', 'npm test', 'npm run build', 'npm run verify']) {
      expect(readme).toContain(command);
    }
    expect(readme).toMatch(/SITE_URL.+HTTPS.+origin/is);
    expect(readme.indexOf('Astro build')).toBeLessThan(readme.indexOf('Pagefindで'));
  });

  it('explains article metadata, drafts, publication, and search indexing', async () => {
    const readme = await readProjectFile('README.md');

    for (const field of ['title', 'description', 'publishedAt', 'updatedAt', 'category', 'tags', 'heroImage', 'ogImage', 'draft']) {
      expect(readme).toContain(`\`${field}\``);
    }
    expect(readme).toMatch(/draft: true.+公開.+除外/is);
    expect(readme).toMatch(/draft: false.+公開/is);
    expect(readme).toMatch(/検索.+npm run build/is);
  });

  it('documents exact deployment settings and keeps external publication conditional', async () => {
    const readme = await readProjectFile('README.md');

    for (const secret of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
      expect(readme).toContain(`\`${secret}\``);
    }
    for (const variable of ['SITE_URL', 'PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN']) {
      expect(readme).toContain(`\`${variable}\``);
    }

    expect(readme).toContain('npx wrangler deploy --dry-run');
    expect(readme).toMatch(/target.+authorization.+contact.+設定後/is);
    expect(readme).toMatch(/branch protection.+verify/is);
    expect(readme).toMatch(/smoke/is);
    expect(readme).not.toMatch(/CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)\s*=\s*\S+/);
  });
});

describe('.env.example public configuration', () => {
  it('contains only safe public variables and never deployment secrets', async () => {
    const source = await readProjectFile('.env.example');
    const names = source
      .split('\n')
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => line.slice(0, line.indexOf('=')));

    expect(names).toEqual(['SITE_URL', 'PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN']);
    expect(source).toContain('SITE_URL=https://example.invalid');
    expect(source).not.toMatch(/CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)/);
  });
});
