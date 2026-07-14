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

describe('ChatGPT Sites guide content', () => {
  it('keeps the approved structure, evidence, prompts, visuals, and publication boundary', async () => {
    const source = await readFile(new URL('../../src/content/blog/chatgpt-sites-guide.md', import.meta.url), 'utf8');
    const [frontmatter, body] = source.replace(/^---\n/, '').split('\n---\n', 2);
    const images = [...body.matchAll(/!\[([^\]]+)\]\(([^)]+)\)/g)];
    const captions = [...body.matchAll(/<span class="article-image-caption">[^<]+<\/span>/g)];
    const textBlocks = [...body.matchAll(/```text\n([\s\S]*?)\n```/g)].map(([, block]) => block);
    const initialPrompt = textBlocks.find((block) => block.includes('「テックログ」') && block.includes('掲載内容:'));
    const headings = [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);
    const mobileFigure = body.match(
      /!\[([^\]]+)\]\(\.\.\/\.\.\/assets\/blog\/chatgpt-sites-mobile\.png\)\n(<span class="article-image-caption">[^<]+<\/span>)/,
    );

    expect(frontmatter).toContain('title: ChatGPT Sitesの使い方｜実際にWebサイトを作って限定公開するまで');
    expect(frontmatter).toContain('description:');
    for (const term of ['初心者', '作成', '修正', '保存', '共有範囲', '限定公開']) {
      expect(frontmatter).toContain(term);
    }
    expect(frontmatter).toContain("publishedAt: '2026-07-14'");
    expect(frontmatter).toContain("updatedAt: '2026-07-14'");
    expect(frontmatter).toContain('category: AI');
    for (const tag of ['OpenAI', 'ChatGPT', 'Sites', 'Web制作']) {
      expect(frontmatter).toContain(`  - ${tag}`);
    }
    expect(frontmatter).toContain('draft: true');
    expect(frontmatter).toContain('heroImage: ../../assets/blog/chatgpt-sites-guide-og.png');
    expect(frontmatter).toContain('ogImage: ../../assets/blog/chatgpt-sites-guide-og.png');

    expect(headings).toEqual([
      'ChatGPT Sitesで何ができるのか',
      '今回作るもの',
      '作る前に情報をそろえる',
      '最初のページを生成する',
      '見た目より先に内容と操作を確認する',
      '修正プロンプトは具体的に書く',
      '公開前にバージョンを保存する',
      '共有範囲を確認して限定公開する',
      '実際に使って分かったこと',
      '公開前チェックリスト',
    ]);

    for (const link of [
      'https://learn.chatgpt.com/docs/sites',
      'https://learn.chatgpt.com/docs/pricing',
      'https://learn.chatgpt.com/use-cases/build-student-website',
    ]) {
      expect(body).toContain(link);
    }
    for (const fact of [
      'Public Beta',
      'プラン、地域、Workspace',
      'デプロイされたURLは本番',
      'デプロイせずにバージョンを保存',
      'ホスティングしただけで自動的に一般公開されるわけではありません',
      'プロンプト、ファイル、コンテンツ、`.openai/hosting.json`',
      '公式仕様',
      '実演結果',
      '筆者の判断',
    ]) {
      expect(body).toContain(fact);
    }

    expect(initialPrompt).toBeDefined();
    const prompt = initialPrompt!;
    for (const requiredPromptText of [
      'サイト名: テックログ',
      'クラウド、バックエンド、フロントエンド、IaC、AI、運用まで。現場で得た技術の実践知を、わかりやすく発信します。',
      '主なテーマ: AI、Cloud、IaC',
      '運営者: Hiroshi Imaizumi',
      'プロフィール: クラウド、バックエンド、フロントエンド、IaC、AI、運用の実践から得た知見を、技術ブログとして記録しています',
      'https://tech-log.hiroshiimaizumi0611.workers.dev/about/',
      'ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方',
      'https://tech-log.hiroshiimaizumi0611.workers.dev/blog/chatgpt-codex-plugins-guide/',
      'ChatGPT Workとは？Chat・Codexとの違いと使い分け',
      'https://tech-log.hiroshiimaizumi0611.workers.dev/blog/chatgpt-work-guide/',
      '2026年版 Astroで技術ブログを構築した',
      'https://tech-log.hiroshiimaizumi0611.workers.dev/blog/build-tech-blog-with-astro-2026/',
      'ブログを見るボタン:\n  https://tech-log.hiroshiimaizumi0611.workers.dev/',
      'ダークテーマと青いアクセント',
      '技術ブログらしい落ち着いた印象',
      '日本語本文を読みやすくする',
      'DesktopとMobileの両方へ対応する',
      '見出しを順序立てる',
      'キーボードだけで主要リンクを操作できるようにする',
      '文字と背景に十分なコントラストを持たせる',
      '外部リンクだと分かる表現にする',
      'Aboutページのメールアドレスや問い合わせ情報は転載しないでください。掲載する運営者情報は、上記の氏名とプロフィール文だけにしてください。',
      '問い合わせフォーム、ログイン・認証、外部API、アクセス解析、ファイルアップロード、データ保存は追加しない。メールアドレス、秘密情報、非公開URLは掲載しない',
    ]) {
      expect(prompt).toContain(requiredPromptText);
    }

    const revisionPrompt = textBlocks.find((block) => block.startsWith('対象: Mobile表示（幅390px前後）。'));
    expect(revisionPrompt).toContain('Mobile幅でプレビューしたところ、サイト本文が空白');
    expect(revisionPrompt).toContain('公開・デプロイ、共有設定や権限の変更を行わない');
    expect(body).toContain(
      '現在の修正済みページを、公開候補のバージョンとして保存してください。公開・デプロイは行わないでください。共有設定や権限を変更しないでください。現在の「自分だけが閲覧可能」な状態を維持してください。保存後は、保存できたことと、公開・デプロイを行っていないことだけを報告してください。',
    );
    expect(body).toContain('保存できました。公開・デプロイは行っていません。');
    expect(body).toContain('最終版を公開します。');
    expect(body).toContain('デプロイ前に応答を停止');
    expect(body).toContain('空白になった状態は観測しましたが、公開用スクリーンショットとして保存していません');
    expect(mobileFigure).not.toBeNull();
    expect(mobileFigure?.slice(1).join('\n')).toContain('修正後');
    expect(mobileFigure?.slice(1).join('\n')).not.toMatch(/初回|修正前|空白/);

    expect(images.map(([, , path]) => path)).toEqual([
      '../../assets/blog/chatgpt-sites-guide-og.png',
      '../../assets/blog/chatgpt-sites-start.png',
      '../../assets/blog/chatgpt-sites-initial.png',
      '../../assets/blog/chatgpt-sites-mobile.png',
      '../../assets/blog/chatgpt-sites-save-vs-deploy.svg',
      '../../assets/blog/chatgpt-sites-finished.png',
      '../../assets/blog/chatgpt-sites-saved-version.png',
    ]);
    expect(captions).toHaveLength(images.length);
    expect(images.every(([, alt]) => alt.trim().length > 0)).toBe(true);
    expect(new Set(images.map(([, alt]) => alt)).size).toBe(images.length);
    expect(body).not.toContain('hiroshiimaizumi0611@gmail.com');
  });
});
