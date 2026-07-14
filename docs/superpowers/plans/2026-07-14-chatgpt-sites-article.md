# ChatGPT Sites実践記事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ChatGPT Sitesでテックログ紹介ページを生成し、確認・修正・バージョン保存・承認後の限定公開までを、公式情報と実画面で説明する初心者向け記事を完成させる。

**Architecture:** 記事本文、独自ビジュアル、実演画面、記事専用テストを独立した成果物として追加する。Sites上の変更は「保存まで」と「本番デプロイ」を分離し、デプロイと共有範囲変更はユーザーの明示承認後にだけ行う。記事は実測した画面と結果だけを記載し、製品仕様はOpenAI公式情報へ直接リンクする。

**Tech Stack:** Astro 7 Content Collections、Markdown、Vitest、Playwright、Sharp、ChatGPT Desktop Sites、OpenAI公式Docs、imagegen

---

## File Structure

- Create: `src/content/blog/chatgpt-sites-guide.md` — 記事本文、実演プロンプト、公式参照、画像キャプション
- Create: `src/assets/blog/chatgpt-sites-guide-og.png` — 1200×630pxのトップ画像兼OG画像
- Create: `scripts/generate-chatgpt-sites-og.mjs` — imagegenで決めた構図を再現可能な1200×630pxへ描画する専用スクリプト
- Create: `src/assets/blog/chatgpt-sites-save-vs-deploy.svg` — 保存、確認、デプロイ、共有範囲確認の独自図解
- Create: `src/assets/blog/chatgpt-sites-start.png` — 個人情報を含まないSites開始画面
- Create: `src/assets/blog/chatgpt-sites-initial.png` — 初回生成結果
- Create: `src/assets/blog/chatgpt-sites-mobile.png` — Mobileプレビュー
- Create: `src/assets/blog/chatgpt-sites-saved-version.png` — デプロイ前に保存したバージョン
- Create: `src/assets/blog/chatgpt-sites-finished.png` — 修正後の完成画面
- Create after deploy approval: `src/assets/blog/chatgpt-sites-sharing-settings.png` — 実際の共有範囲設定。秘密情報や共有URLは写さない
- Create: `tests/unit/chatgpt-sites-article.test.ts` — frontmatter、公式リンク、プロンプト、画像、秘密情報不掲載の契約
- Create: `tests/e2e/chatgpt-sites-article.spec.ts` — 記事SEO、画像、Mobile表示、アクセシビリティの検証
- Modify only if formatting requires it: no shared production component changes are planned

## Safety Boundaries

- Sitesプロジェクトの生成と、デプロイしないバージョン保存までは実演範囲に含む。
- Sitesへのデプロイ前に、対象バージョン、画面、共有範囲を提示してユーザーの明示承認を得る。
- 「リンクを知る人」などへ共有範囲を広げる場合は、デプロイ承認と分けて再承認を得る。
- プラン、Workspace、管理者設定により希望する限定範囲を選べない場合は、広い範囲へ変更せず停止する。
- GitHubへのpush、PR作成、merge、テックログ本番公開は、ローカル完成後に範囲を提示して承認を得る。
- プロンプト、画面、記事へメールアドレス、会話履歴、秘密情報、非公開URL、共有トークンを含めない。

### Task 1: 公式情報とデモ入力を公開直前の状態へそろえる

**Files:**
- Read: `docs/superpowers/specs/2026-07-14-chatgpt-sites-article-design.md`
- Read: `src/content/blog/chatgpt-codex-plugins-guide.md`
- Read: `src/content/blog/chatgpt-work-guide.md`
- Read: `src/content/blog/build-tech-blog-with-astro-2026.md`
- No repository file changes

- [ ] **Step 1: OpenAI公式情報を再確認する**

Use `@openai-docs` and fetch these exact official pages:

- `https://learn.chatgpt.com/docs/sites`
- `https://learn.chatgpt.com/docs/pricing`
- `https://learn.chatgpt.com/use-cases/build-student-website`

Record only facts supported on the day of execution: Public Beta, availability variation, Desktop entry point, save-version versus deploy, production URL, sharing controls, administrator restrictions, and secrets guidance.

Expected: every product claim planned for the article has a current official source. If a former claim is no longer supported, update the article wording later rather than preserving the old claim.

- [ ] **Step 2: Verify the public demo links**

Check the production blog and these article slugs:

```text
https://tech-log.hiroshiimaizumi0611.workers.dev/
https://tech-log.hiroshiimaizumi0611.workers.dev/about/
https://tech-log.hiroshiimaizumi0611.workers.dev/blog/chatgpt-codex-plugins-guide/
https://tech-log.hiroshiimaizumi0611.workers.dev/blog/chatgpt-work-guide/
https://tech-log.hiroshiimaizumi0611.workers.dev/blog/build-tech-blog-with-astro-2026/
```

Expected: all five URLs return HTTP 200 and their visible titles match the repository. Replace a broken recommendation with another real public article before opening Sites.

- [ ] **Step 3: Prepare the exact initial prompt**

Use this prompt, replacing no public URL unless Step 2 found a broken link:

```text
「テックログ」を初めて訪れた人向けの紹介ランディングページを作ってください。

目的:
- AI、クラウド、IaCに関心がある人へブログの内容を伝える
- おすすめ記事を選び、公開中のテックログへ移動してもらう

掲載内容:
- サイト名: テックログ
- 説明: クラウド、バックエンド、フロントエンド、IaC、AI、運用まで。現場で得た技術の実践知を、わかりやすく発信します。
- 主なテーマ: AI、Cloud、IaC
- 運営者: Hiroshi Imaizumi
- プロフィール: クラウド、バックエンド、フロントエンド、IaC、AI、運用の実践から得た知見を、技術ブログとして記録しています
- プロフィールページ:
  https://tech-log.hiroshiimaizumi0611.workers.dev/about/
- おすすめ記事:
  1. ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方
     https://tech-log.hiroshiimaizumi0611.workers.dev/blog/chatgpt-codex-plugins-guide/
  2. ChatGPT Workとは？Chat・Codexとの違いと使い分け
     https://tech-log.hiroshiimaizumi0611.workers.dev/blog/chatgpt-work-guide/
  3. 2026年版 Astroで技術ブログを構築した
     https://tech-log.hiroshiimaizumi0611.workers.dev/blog/build-tech-blog-with-astro-2026/
- ブログを見るボタン:
  https://tech-log.hiroshiimaizumi0611.workers.dev/

デザイン:
- ダークテーマと青いアクセント
- 技術ブログらしい落ち着いた印象
- 日本語本文を読みやすくする
- DesktopとMobileの両方へ対応する

品質条件:
- 見出しを順序立てる
- キーボードだけで主要リンクを操作できるようにする
- 文字と背景に十分なコントラストを持たせる
- 外部リンクだと分かる表現にする
- Aboutページのメールアドレスや問い合わせ情報は転載しないでください。掲載する運営者情報は、上記の氏名とプロフィール文だけにしてください。
- 問い合わせフォーム、ログイン・認証、外部API、アクセス解析、ファイルアップロード、データ保存は追加しない。メールアドレス、秘密情報、非公開URLは掲載しない
```

Expected: prompt uses the exact public description, contains the public operator name, public profile text, and `/about/` link, explicitly prohibits reproducing the About page's email address or contact information, and excludes forms, login/authentication, external APIs, analytics, file uploads, data storage, email addresses, secrets, and private URLs.

### Task 2: Sitesで非公開の生成・修正・バージョン保存を実演する

**Files:**
- Create: `src/assets/blog/chatgpt-sites-start.png`
- Create: `src/assets/blog/chatgpt-sites-initial.png`
- Create: `src/assets/blog/chatgpt-sites-mobile.png`
- Create: `src/assets/blog/chatgpt-sites-saved-version.png`
- Create: `src/assets/blog/chatgpt-sites-finished.png`

- [ ] **Step 1: ChatGPT DesktopでSitesを開く**

Use `@computer-use:computer-use`. Before operating, read that skill completely. Open Sites in the existing logged-in ChatGPT Desktop session and confirm the feature is available.

Expected: Sites start screen is visible. If Sites is unavailable, stop and report the visible plan, region, Workspace, or application restriction without attempting a workaround.

- [ ] **Step 2: Capture the safe start screen**

Capture only the Sites work area directly to `src/assets/blog/chatgpt-sites-start.png`. Do not capture the account menu, email address, conversation list, Workspace name, or unrelated windows. Inspect the full-resolution image with `view_image`.

Expected: the image explains where the reader starts and contains no private information.

- [ ] **Step 3: Generate the first version**

Paste the exact prompt from Task 1 and start generation. Do not add integrations, authentication, analytics, storage, or a form if Sites suggests them.

Expected: a preview is generated without a production deploy. Capture the safe preview as `src/assets/blog/chatgpt-sites-initial.png`.

- [ ] **Step 4: Review before revising**

Check and record observable results in this order:

1. site name, description, themes, operator profile, article titles, and URLs
2. Desktop layout
3. Mobile preview, captured as `src/assets/blog/chatgpt-sites-mobile.png`
4. heading order and main call to action
5. keyboard access to major links
6. text/background contrast
7. absence of email addresses, secrets, private URLs, forms, login/authentication, external APIs, analytics, file uploads, and data storage

Expected: findings are based on the actual preview. Do not invent a failure to make the article more dramatic.

- [ ] **Step 5: Issue one concrete revision prompt**

Build the prompt from observed problems only, using this fixed structure:

```text
現在のページから、次に挙げる確認済みの問題だけを修正してください。

- 対象と現状: 実画面で確認した内容
- 変更内容: 具体的に直す内容
- 残すもの: 正しく表示されている文章、リンク、色、構成
- 完了条件: Desktop、Mobile、キーボード操作、コントラストで再確認できる状態

フォーム、ログイン・認証、外部API、アクセス解析、ファイルアップロード、データ保存は追加しないでください。メールアドレス、秘密情報、非公開URLは掲載しないでください。
```

Expected: the final prompt includes concrete observed text instead of the four explanatory labels alone. Use `chatgpt-sites-initial.png` and the new `src/assets/blog/chatgpt-sites-finished.png` as the before-and-after pair; do not synthesize a comparison screen.

- [ ] **Step 6: Save a version without deploying**

Use Sites' save-version action. Do not select Deploy and do not widen sharing.

Expected: a deployable candidate is saved while the production URL remains unchanged. Capture a safe confirmation screen as `src/assets/blog/chatgpt-sites-saved-version.png`.

- [ ] **Step 7: Inspect every screenshot**

Open all five images with `view_image` at original detail.

Expected: each screenshot shows the intended decision point, contains no email address, account identity, conversation history, non-public Workspace, secret, or share token, and remains readable at article width. Recapture unsafe images; do not blur or fabricate UI.

Post-capture cropping is normally prohibited. Narrow exception: on 2026-07-14, the user explicitly approved non-generative Sharp `extract`-only crops of `chatgpt-sites-start.png` and `chatgpt-sites-initial.png` because those historical UI states were no longer available for direct recapture. This exception does not permit resizing, resampling, rotation, color changes, blur, compositing, regeneration, text alteration, or cropping any other screenshot.

- [ ] **Step 8: Commit the safe screenshots**

```bash
git add src/assets/blog/chatgpt-sites-start.png \
  src/assets/blog/chatgpt-sites-initial.png \
  src/assets/blog/chatgpt-sites-mobile.png \
  src/assets/blog/chatgpt-sites-saved-version.png \
  src/assets/blog/chatgpt-sites-finished.png
git commit -m "docs: capture ChatGPT Sites walkthrough"
```

Expected: one commit containing only the five inspected screenshots.

### Task 3: 独自ビジュアルをテスト駆動で追加する

**Files:**
- Create: `tests/unit/chatgpt-sites-article.test.ts`
- Create: `src/assets/blog/chatgpt-sites-guide-og.png`
- Create: `src/assets/blog/chatgpt-sites-save-vs-deploy.svg`
- Create: `scripts/generate-chatgpt-sites-og.mjs`

- [ ] **Step 1: Write the failing visual tests**

Create `tests/unit/chatgpt-sites-article.test.ts` with these initial tests:

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const asset = (name: string) => fileURLToPath(new URL(`../../src/assets/blog/${name}`, import.meta.url));

describe('ChatGPT Sites article assets', () => {
  it('uses an exact 1200x630 PNG for the article OGP', async () => {
    await expect(sharp(asset('chatgpt-sites-guide-og.png')).metadata()).resolves.toMatchObject({
      width: 1200,
      height: 630,
      format: 'png',
    });
  });

  it('explains save, review, deploy, and sharing in a scalable SVG', async () => {
    const source = await readFile(asset('chatgpt-sites-save-vs-deploy.svg'), 'utf8');
    expect(source).toMatch(/<svg[^>]+width="1200"[^>]+height="675"[^>]+viewBox="0 0 1200 675"/);
    for (const label of ['バージョンを保存', '内容とアクセスを確認', 'デプロイ', '共有範囲を確認']) {
      expect(source).toContain(label);
    }
  });
});
```

- [ ] **Step 2: Run the tests and verify the missing-assets failure**

Run:

```bash
npm test -- tests/unit/chatgpt-sites-article.test.ts
```

Expected: FAIL because `chatgpt-sites-guide-og.png` and `chatgpt-sites-save-vs-deploy.svg` do not exist.

- [ ] **Step 3: Design the OGP composition with imagegen**

Use `@imagegen`; read the skill completely first. Generate a composition reference with a dark technical-blog background, restrained blue accent, an abstract browser frame, and the progression `指示 → プレビュー → 修正 → 保存 → 限定公開`. Do not imitate the ChatGPT interface or OpenAI logo. Inspect the result for hierarchy, contrast, and safe margins; use it as the visual direction rather than relying on its output dimensions.

- [ ] **Step 4: Generate the exact 1200×630 OGP deterministically**

Create `scripts/generate-chatgpt-sites-og.mjs` with `apply_patch`, following the Japanese-font selection and Sharp SVG-rendering pattern in `scripts/generate-og.mjs`. Recreate the approved imagegen composition with native vector shapes and text, render directly to `src/assets/blog/chatgpt-sites-guide-og.png`, and export callable functions without writing files on module import.

Run:

```bash
node scripts/generate-chatgpt-sites-og.mjs
node -e "import('sharp').then(({default:s})=>s('src/assets/blog/chatgpt-sites-guide-og.png').metadata().then(console.log))"
```

Expected: the metadata reports `width: 1200`, `height: 630`, and `format: 'png'`. Because the final raster is rendered from a fixed 1200×630 SVG canvas, no crop or resize of the imagegen output is required.

- [ ] **Step 5: Implement the save-versus-deploy SVG**

Create `src/assets/blog/chatgpt-sites-save-vs-deploy.svg` with `apply_patch`. Use a 1200×675 viewBox, large Japanese labels, dark background, and four left-to-right steps. Include a visible stop marker before deploy labeled `承認してから進む`.

- [ ] **Step 6: Run visual tests**

Run:

```bash
npm test -- tests/unit/chatgpt-sites-article.test.ts
```

Expected: PASS for both visual tests.

- [ ] **Step 7: Commit the tested visuals**

```bash
git add tests/unit/chatgpt-sites-article.test.ts \
  scripts/generate-chatgpt-sites-og.mjs \
  src/assets/blog/chatgpt-sites-guide-og.png \
  src/assets/blog/chatgpt-sites-save-vs-deploy.svg
git commit -m "test: add ChatGPT Sites article visuals"
```

### Task 4: 記事本文をテスト駆動で作成する

**Files:**
- Modify: `tests/unit/chatgpt-sites-article.test.ts`
- Create: `src/content/blog/chatgpt-sites-guide.md`

- [ ] **Step 1: Add the failing article contract**

Append this test to `tests/unit/chatgpt-sites-article.test.ts`:

```ts
describe('ChatGPT Sites guide content', () => {
  it('publishes the approved structure, sources, prompts, visuals, and safety boundary', async () => {
    const source = await readFile(new URL('../../src/content/blog/chatgpt-sites-guide.md', import.meta.url), 'utf8');
    const [frontmatter, body] = source.replace(/^---\n/, '').split('\n---\n', 2);
    const images = [...body.matchAll(/!\[([^\]]+)\]\(([^)]+)\)/g)];
    const captions = [...body.matchAll(/<span class="article-image-caption">[^<]+<\/span>/g)];
    const textBlocks = [...body.matchAll(/```text\n([\s\S]*?)\n```/g)].map(([, block]) => block);
    const initialPrompt = textBlocks.find(
      (block) => block.trimStart().startsWith('「テックログ」') && block.includes('掲載内容:'),
    );

    expect(frontmatter).toContain('title: ChatGPT Sitesの使い方｜実際にWebサイトを作って保存するまで');
    expect(frontmatter).toMatch(/heroImage:\s+\.\.\/\.\.\/assets\/blog\/chatgpt-sites-guide-og\.png/);
    expect(frontmatter).toMatch(/ogImage:\s+\.\.\/\.\.\/assets\/blog\/chatgpt-sites-guide-og\.png/);
    expect(frontmatter).toContain('draft: true');

    for (const heading of [
      'ChatGPT Sitesで何ができるのか',
      '今回作るもの',
      '作る前に情報をそろえる',
      '最初のページを生成する',
      '見た目より先に内容と操作を確認する',
      '修正プロンプトは具体的に書く',
      '公開前にバージョンを保存する',
      '限定公開は内容と共有範囲を確認してから行う',
      '実際に使って分かったこと',
      '公開前チェックリスト',
    ]) {
      expect(body).toContain(`## ${heading}`);
    }

    expect(body).toContain('https://learn.chatgpt.com/docs/sites');
    expect(body).toContain('https://learn.chatgpt.com/docs/pricing');
    expect(body).toContain('https://learn.chatgpt.com/use-cases/build-student-website');
    expect(body).toContain('デプロイされたURLは本番');
    expect(body).toContain('デプロイせずにバージョンを保存');

    expect(initialPrompt).toBeDefined();
    const prompt = initialPrompt!;
    for (const requiredPromptText of [
      'サイト名: テックログ',
      'クラウド、バックエンド、フロントエンド、IaC、AI、運用まで。現場で得た技術の実践知を、わかりやすく発信します。',
      '主なテーマ: AI、Cloud、IaC',
      'Hiroshi Imaizumi',
      'クラウド、バックエンド、フロントエンド、IaC、AI、運用の実践から得た知見を、技術ブログとして記録しています',
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

    expect(images.length).toBeGreaterThanOrEqual(8);
    expect(captions).toHaveLength(images.length);
    expect(images.every(([, alt]) => alt.trim().length > 0)).toBe(true);
    expect(new Set(images.map(([, alt]) => alt)).size).toBe(images.length);
    expect(body).not.toContain('hiroshiimaizumi0611@gmail.com');
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-article failure**

Run:

```bash
npm test -- tests/unit/chatgpt-sites-article.test.ts
```

Expected: FAIL with `ENOENT` for `src/content/blog/chatgpt-sites-guide.md`.

- [ ] **Step 3: Write the draft article**

Use `@natural-japanese` in quick write mode. Create `src/content/blog/chatgpt-sites-guide.md` with `draft: true`, the temporary title `ChatGPT Sitesの使い方｜実際にWebサイトを作って保存するまで`, a description limited to generation, revision, version save, and pre-deploy checks, the current execution date, AI category, `OpenAI`/`ChatGPT`/`Sites`/`Web制作` tags, and the OGP asset for both `heroImage` and `ogImage`. While the walkthrough stops at save, use the temporary H2 `限定公開は内容と共有範囲を確認してから行う`. Frame the OGP figure as the planned end-to-end workflow and state that the current hands-on progress stops at version save.

Use the ten headings from the contract. Include:

- official facts with the three direct official links
- the exact initial prompt from Task 1
- the exact revision prompt actually used in Task 2
- the observed first-version problems and changes, without fabricated results
- OGP, save/deploy diagram, and five safe screenshots, each followed by a unique caption。実演画面のキャプションには撮影日、画面を載せる目的、UIが変わる可能性を明記する
- a clear note that the walkthrough is still saved but not deployed until the approval checkpoint
- a final checklist covering content, links, Desktop, Mobile, keyboard, contrast, secrets, version, and sharing scope

Do not claim that limited publication succeeded before Task 6.

- [ ] **Step 4: Run the article contract**

Run:

```bash
npm test -- tests/unit/chatgpt-sites-article.test.ts
```

Expected: FAIL only because the sharing-settings image is intentionally absent before deploy approval. Change the temporary minimum from `8` to `7`, rerun, and expect PASS. Task 6 restores the final minimum to `8` before removing `draft: true`.

- [ ] **Step 5: Run the Japanese quick lint and manual read**

Run from the installed natural-japanese skill directory if its scripts are present:

```bash
uv run scripts/lint.py --json --genre tech \
  '/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/chatgpt-sites-article/src/content/blog/chatgpt-sites-guide.md'
```

Expected: all findings are classified as fix or keep. If `uv` or the bundled script is unavailable, use the skill's manual checklist; then read headings and each paragraph's first sentence in sequence. Ensure the article states conclusions early, varies section depth naturally, explains terms on first use, and separates official fact, observed result, and opinion.

- [ ] **Step 6: Run content validation and commit the private draft**

```bash
npm run check
npm test -- tests/unit/chatgpt-sites-article.test.ts
git add src/content/blog/chatgpt-sites-guide.md tests/unit/chatgpt-sites-article.test.ts
git commit -m "docs: draft ChatGPT Sites walkthrough"
```

Expected: Astro check passes, the article unit test passes with seven or more images, and the draft remains excluded from production listings.

### Task 5: Review the saved version and stop for deploy approval

**Files:**
- No file changes required

- [ ] **Step 1: Present the deploy candidate**

Show the user:

- the final preview screenshot
- the saved-version confirmation
- the exact version or project identifier visible in Sites
- the actual sharing options visible in their Workspace
- the intended narrowest practical sharing option
- the statement that every deployment URL is production

- [ ] **Step 2: Stop and request explicit approval**

Ask whether to deploy that exact saved version using the stated sharing option.

Expected: no Deploy click and no sharing change until the user explicitly approves. A general `ok` given before this checkpoint is not reused as deploy authorization.

### Task 6: 承認後に限定公開し、記事を完成させる

**Files:**
- Create: `src/assets/blog/chatgpt-sites-sharing-settings.png`
- Modify: `src/content/blog/chatgpt-sites-guide.md`
- Modify: `tests/unit/chatgpt-sites-article.test.ts`

- [ ] **Step 1: Deploy the approved saved version**

Use `@computer-use:computer-use` with the existing Sites session. Confirm the saved version and intended sharing option again immediately before clicking Deploy.

Expected: the exact approved version receives a production URL. If the sharing option differs from the approved scope, cancel instead of broadening access.

- [ ] **Step 2: Set and verify the approved limited scope**

Select only the approved scope. If changing to `Anyone with the link` or an equivalent wider option was not separately approved, do not select it.

Verify the production URL from a separate signed-out or isolated session where appropriate. Record whether the intended audience can open it and whether an unintended audience is denied.

Expected: observed access matches the approved scope. On mismatch, return to the narrowest available scope when that change is safe, report the result, and stop all further Sites publication changes. Continue Steps 3–6 only as local documentation work: capture the safe settings state, record the displayed choices and limitation, and do not claim that the intended limited publication succeeded.

- [ ] **Step 3: Capture and inspect sharing settings**

Capture the safe settings area directly as `src/assets/blog/chatgpt-sites-sharing-settings.png`. Exclude the production URL, share token, account identity, email address, and unrelated Workspace details. Inspect it with `view_image` at original detail.

Expected: the screenshot proves which kind of setting was checked without exposing a usable token or personal data.

- [ ] **Step 4: Make the final article contract fail**

In `tests/unit/chatgpt-sites-article.test.ts`:

- restore `expect(images.length).toBeGreaterThanOrEqual(8)`
- add `expect(frontmatter).not.toContain('draft: true')`
- replace the temporary title assertion with `ChatGPT Sitesの使い方｜実際にWebサイトを作って限定公開するまで`
- replace the temporary H2 assertion with `共有範囲を確認して限定公開する`
- require the final description and OGP framing to describe the observed limited-publication outcome without overstating an unavailable or failed scope
- add `expect(body).toContain('chatgpt-sites-sharing-settings.png')`
- add one assertion for the exact observed sharing label

Run:

```bash
npm test -- tests/unit/chatgpt-sites-article.test.ts
```

Expected: FAIL because the article is still draft and does not yet contain the final sharing result.

- [ ] **Step 5: Finalize the article**

Update `src/content/blog/chatgpt-sites-guide.md`:

- remove `draft: true`
- switch the title to `ChatGPT Sitesの使い方｜実際にWebサイトを作って限定公開するまで`
- replace the temporary description with a final description covering generation, revision, version save, sharing-scope verification, and the observed limited-publication outcome
- switch H2 `限定公開は内容と共有範囲を確認してから行う` to `共有範囲を確認して限定公開する`
- change the OGP alt and caption from a planned workflow to final framing only after the actual outcome has been observed
- replace the pre-deploy note with the observed limited-publication result; if the intended scope was unavailable, avoid success wording and state where external changes stopped and what restriction appeared
- add the inspected sharing-settings image and unique caption
- explain the actual option selected and the separate-session access result
- document any plan, region, Workspace, or administrator limitation without guessing
- distinguish what Sites did automatically from what the author reviewed or changed
- state which small landing-page uses suited Sites and which stateful or operational uses were outside this demo

Do not publish the production Sites URL if it contains a token or if including it was not approved.

- [ ] **Step 6: Rerun article checks and commit**

```bash
npm test -- tests/unit/chatgpt-sites-article.test.ts
npm run check
git add src/assets/blog/chatgpt-sites-sharing-settings.png \
  src/content/blog/chatgpt-sites-guide.md \
  tests/unit/chatgpt-sites-article.test.ts
git commit -m "docs: complete ChatGPT Sites publishing guide"
```

Expected: all article unit tests and Astro check pass.

### Task 7: 記事専用E2Eをテスト駆動で追加する

**Files:**
- Create: `tests/e2e/chatgpt-sites-article.spec.ts`

- [ ] **Step 1: Write the article E2E test**

Create `tests/e2e/chatgpt-sites-article.spec.ts` using the existing `tests/e2e/article.spec.ts` conventions. Cover exactly:

- route `/blog/chatgpt-sites-guide/`
- full title and description
- canonical ending in `/blog/chatgpt-sites-guide/`
- `og:image` and `twitter:image` using `chatgpt-sites-guide-og`, not `og-default.png`
- the ten approved H2 headings in order
- at least eight body images, each with nonempty unique alt, positive width and height, and a visible caption
- no serious or critical Axe violations
- no document or article-body horizontal overflow at 390×844

Use this shared helper inside the file:

```ts
async function expectNoHighImpactAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}
```

- [ ] **Step 2: Run E2E against the missing or incomplete behavior**

Run:

```bash
npx playwright test tests/e2e/chatgpt-sites-article.spec.ts
```

Expected: the new test either passes immediately because the final article already satisfies the contract, or fails with a specific metadata, image, caption, accessibility, or overflow mismatch. Do not weaken the requirement; correct the article or asset.

- [ ] **Step 3: Fix only observed E2E failures**

Use `apply_patch` for Markdown, SVG, or test changes. Recapture a screenshot if its safe direct capture is unreadable. Do not alter shared layouts unless the same defect reproduces on an existing article and the scope change is separately justified.

- [ ] **Step 4: Rerun and commit**

```bash
npx playwright test tests/e2e/chatgpt-sites-article.spec.ts
git add tests/e2e/chatgpt-sites-article.spec.ts \
  src/content/blog/chatgpt-sites-guide.md \
  src/assets/blog/
git commit -m "test: verify ChatGPT Sites article"
```

Expected: article E2E passes and the commit contains only relevant fixes and the new test.

### Task 8: 全体検証と独立レビューを行う

**Files:**
- Modify only files implicated by a failing check or actionable review finding

- [ ] **Step 1: Format the scoped files**

```bash
npx prettier --write \
  docs/superpowers/specs/2026-07-14-chatgpt-sites-article-design.md \
  docs/superpowers/plans/2026-07-14-chatgpt-sites-article.md \
  src/content/blog/chatgpt-sites-guide.md \
  src/assets/blog/chatgpt-sites-save-vs-deploy.svg \
  tests/unit/chatgpt-sites-article.test.ts \
  tests/e2e/chatgpt-sites-article.spec.ts
```

Expected: only scoped text files change.

- [ ] **Step 2: Use verification-before-completion and run the full suite**

Read and use `@superpowers:verification-before-completion`, then run:

```bash
npm run verify
git diff --check
git status --short
```

Expected: format check, Astro check, 16 or more unit-test files, 194 or more unit tests, build, Pagefind, build verification, and all Playwright tests pass. The only working-tree changes are intended formatting fixes, if any.

- [ ] **Step 3: Inspect the built article**

Start preview:

```bash
npm run preview -- --host 127.0.0.1
```

Open `/blog/chatgpt-sites-guide/` at Desktop and 390px Mobile widths. Verify title, dates, all images and captions, prompts, official links, table or checklist layout, and no horizontal overflow.

Expected: the built article matches the final Markdown and all external links point to intended official or public pages.

- [ ] **Step 4: Request independent code and content review**

Read and use `@superpowers:requesting-code-review`. Ask the reviewer to compare the branch against `origin/main` and focus on:

- official-claim accuracy and date qualifiers
- no fabricated Sites behavior
- screenshot privacy
- save-versus-deploy clarity
- approval boundary accuracy
- alt/caption quality and Mobile readability
- test strength without brittle UI assumptions

Expected: no high- or medium-severity unresolved findings. Fix actionable findings, rerun affected tests and `npm run verify`, then commit fixes.

- [ ] **Step 5: Commit final verification changes**

```bash
git add docs/superpowers src/content/blog src/assets/blog tests
git commit -m "docs: polish ChatGPT Sites guide"
```

Expected: create the commit only if verification or review produced changes; otherwise leave history unchanged.

### Task 9: Stop for repository publication approval, then publish the branch

**Files:**
- No planned source changes

- [ ] **Step 1: Present the local completion evidence**

Report:

- article path and local preview URL
- Sites production scope actually verified
- screenshot count and privacy inspection result
- natural-Japanese lint/manual result
- unit, build, and E2E totals from the fresh verification run
- commits and diff summary against `origin/main`

- [ ] **Step 2: Request explicit approval for GitHub publication**

Ask whether to push `codex/chatgpt-sites-article`, create a PR, merge it, and allow the existing production workflow to publish the article.

Expected: no push, PR, merge, or blog production deployment before approval at this checkpoint.

- [ ] **Step 3: Publish only the approved scope**

After approval, read and use `@github:yeet` for intentional commit/push/PR creation. Keep the PR ready for review unless the user explicitly approved merge in the same checkpoint. If merge is approved, merge only after required checks pass.

Expected: branch push and PR URL are reported. If merged, the production workflow succeeds and the public article returns HTTP 200 with the correct canonical and article-specific OGP.

- [ ] **Step 4: Verify production after an approved merge**

Check:

```text
https://tech-log.hiroshiimaizumi0611.workers.dev/blog/chatgpt-sites-guide/
```

Expected: HTTP 200, correct title/description/canonical, article-specific OGP, all images load, and the page appears in sitemap and Pagefind-backed search after deployment.
