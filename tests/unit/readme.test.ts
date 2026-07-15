import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { blogMetadataSchema } from '../../src/lib/content/schema';

const readProjectFile = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const shellCommands = (source: string) =>
  [...source.matchAll(/```sh\s*([\s\S]*?)```/g)].flatMap((match) =>
    match[1]
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );

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
    const commands = shellCommands(readme);
    for (const command of [
      'npm ci',
      'npx playwright install chromium',
      'npx playwright install --with-deps chromium',
      'npm run dev',
      'npm run check',
      'npm test',
      'SITE_URL=https://example.invalid npm run build',
      'npm run preview',
      'SITE_URL=https://example.invalid npm run verify',
    ]) {
      expect(commands).toContain(command);
    }
    expect(readme).toMatch(/SITE_URL.+HTTPS.+origin/is);
    expect(readme.indexOf('Astro build')).toBeLessThan(readme.indexOf('Pagefindで'));
  });

  it('explains article metadata, drafts, publication, and search indexing', async () => {
    const readme = await readProjectFile('README.md');
    const frontmatterSection = readme.match(/## frontmatter\s*([\s\S]*?)(?=\n## )/)?.[1] ?? '';
    const documentedFields = [...frontmatterSection.matchAll(/^- `([A-Za-z]+)`:/gm)].map((match) => match[1]);
    const schemaFields = Object.keys(blogMetadataSchema.shape);
    const requiredFields = ['title', 'description', 'publishedAt', 'category', 'tags'] as const;
    const optionalFields = ['updatedAt', 'draft', 'featured', 'featuredCode', 'heroImage', 'ogImage'] as const;

    expect(new Set(documentedFields)).toEqual(new Set([...schemaFields, 'heroImage', 'ogImage']));
    const validMetadata = {
      title: '記事',
      description: '説明',
      publishedAt: '2026-07-12',
      category: 'Frontend',
      tags: [],
    } as const;
    for (const field of requiredFields) {
      const withoutField = { ...validMetadata } as Record<string, unknown>;
      delete withoutField[field];
      expect(blogMetadataSchema.safeParse(withoutField).success, field).toBe(false);
      expect(frontmatterSection).toMatch(new RegExp('^- `' + field + '`: 必須', 'm'));
    }
    for (const field of optionalFields) expect(frontmatterSection).toMatch(new RegExp('^- `' + field + '`: 任意', 'm'));

    const parsedDefaults = blogMetadataSchema.parse(validMetadata);
    expect(parsedDefaults).toMatchObject({ draft: false, featured: false });
    expect(frontmatterSection).toMatch(/`draft`.+省略.+`false`.+公開対象/is);
    expect(frontmatterSection).toMatch(/`featured`.+省略.+`false`/is);
    expect(frontmatterSection).toMatch(/`featuredCode`.+`language`.+`filename`.+`code`/is);
    const featuredCodeBlock = frontmatterSection.match(/^- `featuredCode`:[\s\S]*?(?=^- `heroImage`:)/m)?.[0] ?? '';
    expect(featuredCodeBlock).toMatch(/`language`.+コードの言語.+空でない/is);
    expect(featuredCodeBlock).toMatch(/`filename`.+互換性.+メタデータ.+現在の表示.+使用しない/is);
    expect(featuredCodeBlock).not.toMatch(/コードパネルのファイル名/);
    expect(featuredCodeBlock).not.toMatch(/省略時[^。\n]*`language`[^。\n]*表示/);
    expect(frontmatterSection).toMatch(/複数.+featured.+公開日.+新しい.+ID.+昇順/is);
    expect(frontmatterSection).toMatch(/`ogImage`.+`heroImage`.+既定画像/is);
    expect(frontmatterSection).toMatch(/`heroImage`.+記事カード.+OG画像.+コンパクトな注目記事.+表示しない/is);
    expect(frontmatterSection).toMatch(/`featuredCode`.+互換性.+コンパクトな注目記事.+表示しない/is);
    expect(frontmatterSection).not.toMatch(/選ばれた記事に\s*`featuredCode`\s*があれば[^。]*コードパネルを優先/is);
    expect(readme).toMatch(/draft: true.+公開.+除外/is);
    expect(readme).toMatch(/検索.+npm run build/is);
  });

  it('explains Playwright installation and production preview boundaries in the relevant sections', async () => {
    const readme = await readProjectFile('README.md');
    const installSection = readme.match(/## インストール\s*([\s\S]*?)(?=\n## )/)?.[1] ?? '';
    const buildSection = readme.match(/## ビルド\s*([\s\S]*?)(?=\n## )/)?.[1] ?? '';
    const localSection = readme.match(/## ローカル開発\s*([\s\S]*?)(?=\n## )/)?.[1] ?? '';

    expect(installSection).toContain('npx playwright install chromium');
    expect(installSection).toContain('npx playwright install --with-deps chromium');
    expect(installSection).toMatch(/npm ci.+ブラウザー.+インストールしません/is);
    expect(buildSection).toContain('npm run preview');
    expect(buildSection).toMatch(/表示された.+URL.+検索.+RSS.+sitemap/is);
    expect(localSection).toMatch(/npm run dev.+Production.+Pagefind.+確認できません/is);
  });

  it('mentions only npm run scripts that exist in package.json', async () => {
    const readme = await readProjectFile('README.md');
    const packageJson = JSON.parse(await readProjectFile('package.json')) as { scripts: Record<string, string> };
    const documentedScripts = [...readme.matchAll(/\bnpm run ([a-z0-9:-]+)/gi)].map((match) => match[1]);

    expect(documentedScripts.length).toBeGreaterThan(0);
    for (const script of documentedScripts) expect(packageJson.scripts).toHaveProperty(script);
  });

  it('keeps the minimal frontmatter copyable and explains optional local images without inventing assets', async () => {
    const readme = await readProjectFile('README.md');
    const minimalExample = readme.match(/最小例です。\s*```yaml\s*([\s\S]*?)```/)?.[1];

    expect(minimalExample).toBeDefined();
    expect(minimalExample).not.toMatch(/^(?:heroImage|ogImage):/m);
    expect(readme).toContain('`src/assets/blog/` に画像ファイルを先に追加');
    expect(readme).toContain('`src/content/blog/` の記事から `../../assets/blog/<ファイル名>`');
    expect(readme).toMatch(/`heroImage`.+`ogImage`.+任意.+省略/is);
  });

  it('documents exact deployment settings and keeps external publication conditional', async () => {
    const readme = await readProjectFile('README.md');
    const githubSettingsSection = readme.match(/## GitHub Secrets \/ Variables\s*([\s\S]*?)(?=\n## )/)?.[1] ?? '';
    const secretsSection = githubSettingsSection.match(/Secrets:\s*([\s\S]*?)(?=\nVariables:)/)?.[1] ?? '';
    const variablesSection = githubSettingsSection.match(/Variables:\s*([\s\S]*?)(?=\n\nCloudflare Web Analytics)/)?.[1] ?? '';

    for (const secret of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_WEB_ANALYTICS_TOKEN']) {
      expect(secretsSection).toContain(`\`${secret}\``);
    }
    for (const variable of ['SITE_URL', 'PUBLIC_GOOGLE_SITE_VERIFICATION']) {
      expect(variablesSection).toContain(`\`${variable}\``);
    }
    expect(variablesSection).not.toContain('`PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`');
    expect(readme).toContain('`SITE_URL`のホストと一致する場合だけ');
    expect(variablesSection).toMatch(/PUBLIC_GOOGLE_SITE_VERIFICATION.+content.+値.+production/is);

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

    expect(names).toEqual(['SITE_URL', 'PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN', 'PUBLIC_GOOGLE_SITE_VERIFICATION']);
    expect(source).toContain('SITE_URL=https://example.invalid');
    expect(source).not.toMatch(/CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)/);
  });
});
