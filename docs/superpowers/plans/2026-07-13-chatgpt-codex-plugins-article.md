# ChatGPT・Codex Plugins解説記事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OpenAI公式情報を基に、Plugin・App・Skillの違い、探し方、権限、安全なGitHub Pluginの試し方を5枚の画像付きで解説する日本語記事を公開する。

**Architecture:** 既存のAstro Content CollectionへMarkdown記事を1本追加し、記事固有のOG画像を既存の`heroImage`・`ogImage`経路へ渡す。正確な文字を含む独自ビジュアルはSVGと既存Sharp生成処理で再現可能に作り、公式画面は個人情報を含まない要素単位の取得だけを許可し、安全に取得できなければ同じ意味の独自フロー図へ置き換える。既存のContent fixture、Playwright、Pagefind、SEO、visual goldenで公開面の回帰を検証する。

**Tech Stack:** Node.js 24、Astro 7 Content Collections、Markdown、Sharp、SVG、Vitest、Playwright、Pagefind、GitHub Actions、Cloudflare Workers

---

## 実行前提

- Worktree: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/codex-plugins-article-design`
- Branch: `codex/plugins-article-design`
- Spec: `docs/superpowers/specs/2026-07-13-chatgpt-codex-plugins-article-design.md`
- Node.jsは必ず24系を使用する。現在利用可能なNode 24は次で有効化できる。

```bash
export PATH="/Users/hiroshiimaizumi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --version
```

Expected: `v24.x.x`。Node 25で`npm ci`した`node_modules`は使わず、バージョンを切り替えた後に`npm ci`する。

## ファイル構成

### 作成

- `src/content/blog/chatgpt-codex-plugins-guide.md`: 記事frontmatter、公式確認日、本文、画像、キャプション、公式参照先
- `src/assets/blog/chatgpt-codex-plugins-og.png`: 1200×630のトップ画像兼OG画像
- `src/assets/blog/chatgpt-codex-plugins-roles.svg`: Plugin・Skill・Appの役割図
- `src/assets/blog/chatgpt-codex-plugins-permissions.svg`: 権限が通る段階を示す図
- `src/assets/blog/chatgpt-plugin-directory.webp`: 個人情報を含まないPlugin Directory画面。安全に取得できない場合は`chatgpt-plugin-directory-flow.svg`
- `src/assets/blog/chatgpt-plugin-selection.webp`: 個人情報を含まないPlugin選択画面。安全に取得できない場合は`chatgpt-plugin-selection-flow.svg`
- `tests/unit/plugins-article-assets.test.ts`: 独自画像の形式・寸法・重要ラベルと、公式画面または代替図2枚の存在を検証

### 変更

- `scripts/generate-og.mjs`: 既定OG画像に加え、記事固有OG画像を再生成可能にする
- `tests/unit/content-fixtures.test.ts`: 5本目の記事fixtureと記事固有の画像・安全なプロンプト契約を追加
- `src/styles/article.css`: 本文画像のキャプション表示を追加
- `tests/e2e/article.spec.ts`: 新記事のSEO、5画像、alt、キャプション、権限説明、GitHub読取デモ、Mobile表示を検証
- `tests/e2e/home-content.spec.ts`: 新しい注目記事と最新4記事の期待値へ更新
- `tests/e2e/search.spec.ts`: `Plugins`検索で新記事へ移動できることを検証
- `tests/e2e/visual.spec.ts-snapshots/home-desktop.png`: 新しい注目記事を反映
- `tests/e2e/visual.spec.ts-snapshots/home-tablet.png`: 新しい注目記事を反映
- `tests/e2e/visual.spec.ts-snapshots/home-mobile.png`: 新しい注目記事を反映

## Task 1: 公式情報とGitHubデモの公開直前条件を確定する

**Files:**
- Read: `docs/superpowers/specs/2026-07-13-chatgpt-codex-plugins-article-design.md`
- Read: `src/content/blog/chatgpt-work-guide.md`
- Read: `src/content/blog/gpt-5-6-sol-terra-luna.md`
- No repository files changed

- [ ] **Step 1: OpenAI公式情報を再取得する**

Use `@openai-docs`。Codex manual helperを先に試し、利用できない場合はOpenAI公式ドメインだけへフォールバックする。最低限、次を確認する。

- `https://help.openai.com/en/articles/20001256-plugins-in-chatgpt-and-codex`
- `https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-for-plugins-and-apps`
- `https://help.openai.com/en/articles/11369540-using-codex-with-chatgpt`

Record for the implementation turn, without creating a separate research file:

- 2026年7月9日のDirectory移行
- 既存App接続の扱い
- Plugin、Skill、App、App Templateの定義
- Plugin導入とApp権限が別であること
- Directory、接続、`@`メンションの現在の導線
- プラン、Workspace、Role、地域、対応画面による提供差

Expected: 重要な主張を3つの公式ページだけで裏付けられる。裏付けられない主張は記事へ入れない。

- [ ] **Step 2: 既存記事との重複を確認する**

Run:

```bash
rg -n "Plugin|App|Skill|権限|GitHub" src/content/blog/chatgpt-work-guide.md src/content/blog/gpt-5-6-sol-terra-luna.md
```

Expected: 製品全体の比較は既存記事へ任せ、新記事はPluginsの構造・発見・権限・初回利用へ集中できる。

- [ ] **Step 3: Public Repositoryのデモ前提を確認する**

Run:

```bash
gh issue list --repo hiroshiimaizumi0611/tech-log --state open --limit 10 --json number,title,url
```

Expected: 1件以上のPublic Issueが返る。3件未満なら本文のプロンプトを「未解決Issueを最大3件」にする。Issueの作成・更新は行わない。

- [ ] **Step 4: 記事で使う確定descriptionを固定する**

Use exactly:

```text
2026年7月9日のPlugin Directory移行を起点に、ChatGPTとCodexのPlugin・App・Skillの違い、探し方、権限、安全な使い始め方を公式情報から整理します。
```

Expected: frontmatter、記事ヘッダー、meta description、テストで同じ文字列を使用する。

## Task 2: 再現可能な独自ビジュアル3枚を作る

**Files:**
- Create: `tests/unit/plugins-article-assets.test.ts`
- Create: `src/assets/blog/chatgpt-codex-plugins-og.png`
- Create: `src/assets/blog/chatgpt-codex-plugins-roles.svg`
- Create: `src/assets/blog/chatgpt-codex-plugins-permissions.svg`
- Modify: `scripts/generate-og.mjs`

- [ ] **Step 1: 画像契約の失敗テストを書く**

Create `tests/unit/plugins-article-assets.test.ts` with these checks:

```ts
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
```

- [ ] **Step 2: 失敗を確認する**

Run:

```bash
npx vitest run tests/unit/plugins-article-assets.test.ts
```

Expected: FAIL because the three assets do not exist.

- [ ] **Step 3: OG生成処理を複数出力へ拡張する**

Refactor `scripts/generate-og.mjs` so it keeps generating `public/og-default.png` and also generates `src/assets/blog/chatgpt-codex-plugins-og.png` from a second SVG string. Use this shape:

```js
const outputs = [
  { output: resolve(here, '../public/og-default.png'), svg: defaultSvg },
  { output: resolve(here, '../src/assets/blog/chatgpt-codex-plugins-og.png'), svg: pluginsArticleSvg },
];

await Promise.all(outputs.map(({ output, svg }) => sharp(Buffer.from(svg)).png().toFile(output)));
```

The article SVG must use the existing colors `#07090d`, `#0b0f14`, `#202936`, `#f5f7fa`, `#a6afbc`, `#4ea1ff`, `#8cc5ff`; show `Pluginに含められるもの` and three non-mandatory capability boxes `Skills`、`Apps`、`App Templates`; and must not use `=`.

- [ ] **Step 4: 本文用SVGを作る**

Create both SVGs with `viewBox="0 0 1200 675"`, dark background, 40px以上の本文ラベル、十分なcontrast, and no embedded external images.

`chatgpt-codex-plugins-roles.svg`:

- Plugin: `仕事に必要な機能をまとめる`
- Skill: `手順を教える`
- App: `外部サービスにつなぐ`
- App Template: `Workspace固有の設定を作る雛形`

`chatgpt-codex-plugins-permissions.svg`:

```text
Pluginの導入方針
  → AppのWorkspace・Role設定
  → ユーザー認証
  → 接続先サービスの元権限
  → 操作確認
```

- [ ] **Step 5: 画像を生成してテストを通す**

Run:

```bash
npm run generate:og
npx vitest run tests/unit/plugins-article-assets.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 6: 3画像を目視確認する**

Use `view_image` for the PNG. Render the two SVGs through the normal Astro build or a browser before final approval. Verify clipped text, garbled Japanese, false equality, low contrast, and text smaller than readable mobile size are absent.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-og.mjs tests/unit/plugins-article-assets.test.ts src/assets/blog/chatgpt-codex-plugins-og.png src/assets/blog/chatgpt-codex-plugins-roles.svg src/assets/blog/chatgpt-codex-plugins-permissions.svg
git commit -m "feat: add plugins article diagrams"
```

## Task 3: 公式画面2枚を安全に取得するか独自フロー図へ切り替える

**Files:**
- Create one of:
  - `src/assets/blog/chatgpt-plugin-directory.webp`
  - `src/assets/blog/chatgpt-plugin-directory-flow.svg`
- Create one of:
  - `src/assets/blog/chatgpt-plugin-selection.webp`
  - `src/assets/blog/chatgpt-plugin-selection-flow.svg`
- Modify: `tests/unit/plugins-article-assets.test.ts`

- [ ] **Step 1: Browser skillの安全手順を読む**

Use `@browser:control-in-app-browser` for a logged-in ChatGPT surface only if the tool can capture the relevant central UI element without including account chrome. Do not use arbitrary web images or third-party screenshots.

- [ ] **Step 2: 公式画面を要素単位で取得できるか判定する**

Required captures:

1. Plugin Directoryの一覧またはPlugin詳細
2. Pluginを選ぶ`@`メンションまたは追加メニュー

Reject a capture if it contains any account name, email, avatar, conversation title/history, private Workspace name, private Repository, or unrelated browser chrome. Do not crop or generatively reconstruct a screenshot after personal data has been captured.

- [ ] **Step 3A: 安全に取得できる場合はWebPへ保存する**

Use the browser tool's element/region export so the output itself contains only the approved UI. Save as the two exact `.webp` paths above. Keep the UI unaltered; annotations belong in the caption, not inside the screenshot.

- [ ] **Step 3B: 安全に取得できない場合は即座に独自SVGへ切り替える**

Do not pause the whole implementation. Create:

- `chatgpt-plugin-directory-flow.svg`: `Directory → Plugin詳細 → 必須App確認 → Connect`
- `chatgpt-plugin-selection-flow.svg`: `@ Plugin選択 → 対象を限定 → 読取依頼 → 結果確認`

Use the blog tokens and label them clearly as `操作フロー図` rather than official UI.

- [ ] **Step 4: 選択した2画像の失敗テストを追加する**

Extend `tests/unit/plugins-article-assets.test.ts` with the exact chosen filenames. For WebP, assert `format: 'webp'`, positive width/height, and width at least 800px. For SVG fallback, assert `viewBox` plus all required step labels.

- [ ] **Step 5: テストと目視確認を行う**

Run:

```bash
npx vitest run tests/unit/plugins-article-assets.test.ts
```

Expected: PASS. Then use `view_image` or browser rendering to verify that no personal/private data is visible and text remains readable.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/plugins-article-assets.test.ts src/assets/blog/chatgpt-plugin-*
git commit -m "feat: add plugins article walkthrough visuals"
```

## Task 4: 記事本文とキャプションをTDDで追加する

**Files:**
- Create: `src/content/blog/chatgpt-codex-plugins-guide.md`
- Modify: `tests/unit/content-fixtures.test.ts`
- Modify: `src/styles/article.css`

- [ ] **Step 1: 5本目の記事fixtureを追加する**

Add to `articleFixtures` in `tests/unit/content-fixtures.test.ts`:

```ts
{
  id: 'chatgpt-codex-plugins-guide',
  featured: true,
  referenceHosts: ['help.openai.com'],
},
```

Update the exact ID expectation to include the fifth ID. Add this article-specific test:

```ts
it('plugins guide uses five accessible visuals and a read-only GitHub example', async () => {
  const source = await readArticle('chatgpt-codex-plugins-guide');
  const { frontmatter, body } = splitArticle(source);
  const images = [...body.matchAll(/!\[([^\]]+)\]\(([^)]+)\)/g)];

  expect(frontmatter).toContain('featured: true');
  expect(frontmatter).toMatch(/heroImage:\s+\.\.\/\.\.\/assets\/blog\/chatgpt-codex-plugins-og\.png/);
  expect(frontmatter).toMatch(/ogImage:\s+\.\.\/\.\.\/assets\/blog\/chatgpt-codex-plugins-og\.png/);
  expect(images).toHaveLength(5);
  expect(images.every(([, alt]) => alt.trim().length > 0)).toBe(true);
  expect(new Set(images.map(([, alt]) => alt)).size).toBe(5);
  expect(body).toContain('Issueの作成・更新・コメント・クローズは行わないでください');
  expect(body).not.toMatch(/Plugin\s*=\s*Skill/);
});
```

- [ ] **Step 2: 失敗を確認する**

Run:

```bash
npx vitest run tests/unit/content-fixtures.test.ts
```

Expected: FAIL with missing `chatgpt-codex-plugins-guide.md`.

- [ ] **Step 3: 記事frontmatterを作る**

Create `src/content/blog/chatgpt-codex-plugins-guide.md`:

```yaml
---
title: ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方
description: 2026年7月9日のPlugin Directory移行を起点に、ChatGPTとCodexのPlugin・App・Skillの違い、探し方、権限、安全な使い始め方を公式情報から整理します。
publishedAt: '2026-07-13'
updatedAt: '2026-07-13'
category: AI
tags:
  - OpenAI
  - ChatGPT
  - Codex
  - Plugins
featured: true
heroImage: ../../assets/blog/chatgpt-codex-plugins-og.png
ogImage: ../../assets/blog/chatgpt-codex-plugins-og.png
---
```

If implementation occurs after 2026-07-13, use the actual publication date consistently in frontmatter, body confirmation date, and tests.

- [ ] **Step 4: 設計どおりの本文を書く**

Use these H2 headings exactly so the TOC and E2E remain stable:

```markdown
## 2026年7月9日に何が変わったのか
## Plugin・App・Skillの違い
## Plugin Directoryで探して接続する
## 接続前に見る4つの権限
## GitHub Pluginを安全に試す
## 使えないときの確認順
## まとめ：接続前チェックリスト
```

Requirements:

- 冒頭に`公式情報はYYYY-MM-DD時点`を明記する
- Appが単純にPluginへ改名されたのではないと説明する
- PluginはSkill、App、App Templateを構成に応じて含められると説明し、必須の等式にしない
- 役割比較表、Directoryの番号付き手順、権限4項目、5段階のアクセス経路、トラブルシューティング表を含める
- GitHub promptはTask 1で確認したIssue数に合わせ、読取だけと禁止操作を明記する
- 3つの公式リンクを本文の関連主張の近くに置く
- 公式文面の長い引用は行わず、日本語で再構成する
- 既存fixture要件を満たすため、引用、箇条書き、表、番号付き具体例、600文字以上の実質本文を含める

- [ ] **Step 5: 5画像とキャプションを本文へ配置する**

Order:

1. 導入直後: `chatgpt-codex-plugins-og.png`
2. 用語説明: `chatgpt-codex-plugins-roles.svg`
3. Directory手順: Task 3で選んだDirectory画像
4. 権限説明: `chatgpt-codex-plugins-permissions.svg`
5. GitHubデモ: Task 3で選んだSelection画像

Use Markdown images followed by:

```html
<span class="article-image-caption">図1：Pluginに含められる要素。すべてのPluginに3要素が必須という意味ではありません。</span>
```

Use unique, descriptive Japanese alt text. Official screenshot captions must include capture date and the official source link; fallback diagrams must say `操作フロー図`.

- [ ] **Step 6: キャプションCSSを追加する**

Add after `.article-body img` in `src/styles/article.css`:

```css
.article-body .article-image-caption {
  display: block;
  margin-block: calc(var(--space-3) * -1) var(--space-6);
  color: var(--color-text-weak);
  font-family: var(--font-ui);
  font-size: 0.78rem;
  line-height: 1.65;
  text-align: center;
}
```

- [ ] **Step 7: Unit testとAstro checkを通す**

Run:

```bash
npx vitest run tests/unit/content-fixtures.test.ts tests/unit/plugins-article-assets.test.ts
npm run check
```

Expected: all targeted tests PASS; Astro check reports 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/content/blog/chatgpt-codex-plugins-guide.md src/styles/article.css tests/unit/content-fixtures.test.ts
git commit -m "feat: add ChatGPT and Codex plugins guide"
```

## Task 5: ホーム、記事、検索、SEOの統合をE2Eで固定する

**Files:**
- Modify: `tests/e2e/article.spec.ts`
- Modify: `tests/e2e/home-content.spec.ts`
- Modify: `tests/e2e/search.spec.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-desktop.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-tablet.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-mobile.png`

- [ ] **Step 1: Production buildを作る**

Run:

```bash
SITE_URL=https://example.invalid npm run build
```

Expected: Astro build、Pagefind、成果物検査がPASSし、`/blog/chatgpt-codex-plugins-guide/`が生成される。

- [ ] **Step 2: 新記事のE2Eを追加して現状の失敗を確認する**

Add constants to `tests/e2e/article.spec.ts`:

```ts
const pluginsArticlePath = '/blog/chatgpt-codex-plugins-guide/';
const pluginsArticleTitle = 'ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方';
const pluginsArticleDescription =
  '2026年7月9日のPlugin Directory移行を起点に、ChatGPTとCodexのPlugin・App・Skillの違い、探し方、権限、安全な使い始め方を公式情報から整理します。';
```

Add tests asserting:

- title、description、canonical、`og:image`、`twitter:image`
- 記事本文に5つの`img`と5つの非空alt、5つの`.article-image-caption`
- 各imgの`width`と`height`が正の数
- H2が設計した7件
- `Pluginの導入方針`から`操作確認`までの説明
- GitHub promptと4つの禁止操作
- serious/critical axe violations 0
- 390pxでpage overflowなし、各画像が本文幅以内

Run:

```bash
npx playwright test tests/e2e/article.spec.ts --grep "Plugins"
```

Expected: FAIL before the exact expectations and integration fixtures are updated.

- [ ] **Step 3: ホームの新しい注目記事へ期待値を更新する**

In `tests/e2e/home-content.spec.ts` set:

```ts
const latestArticleTitles = [
  'ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方',
  '2026年版 Astroで技術ブログを構築した',
  'ChatGPT Workとは？Chat・Codexとの違いと使い分け',
  'GPT-5.6 Sol・Terra・Lunaの違い―特徴・料金・選び方',
] as const;
```

Update the featured test to expect the new title, link `/blog/chatgpt-codex-plugins-guide/`, no code panel, and a visible `[data-custom-hero]` whose optimized URL is under `/_astro/`.

Update any article adjacency or related-article expectations in `tests/e2e/article.spec.ts` only where the deterministic published order genuinely changed.

- [ ] **Step 4: 検索E2Eを追加する**

In `tests/e2e/search.spec.ts`, after the existing search navigation test, add a search for `Plugins`, expect the new article title and href, click it, and expect the article H1.

- [ ] **Step 5: E2Eを通す**

Run:

```bash
npx playwright test tests/e2e/article.spec.ts tests/e2e/home-content.spec.ts tests/e2e/search.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Visual goldenを更新して確認する**

Run:

```bash
npx playwright test tests/e2e/visual.spec.ts --grep "ホームを" --update-snapshots
```

Inspect all three generated PNGs with `view_image`. Confirm the new featured image is readable, cards do not overflow, and unrelated layout changes are absent.

Then run:

```bash
npx playwright test tests/e2e/visual.spec.ts
```

Expected: PASS with desktop、tablet、mobile goldens.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/article.spec.ts tests/e2e/home-content.spec.ts tests/e2e/search.spec.ts tests/e2e/visual.spec.ts-snapshots/
git commit -m "test: cover plugins article publication"
```

## Task 6: 全体検証と公開前レビューを行う

**Files:**
- Modify only files changed by formatter or evidence-backed corrections

- [ ] **Step 1: Formatする**

Run:

```bash
npm run format
git diff --check
```

Expected: no whitespace errors. Review formatter changes before staging.

- [ ] **Step 2: 全検証を実行する**

Run:

```bash
SITE_URL=https://example.invalid npm run verify
```

Expected: format、Astro check、171件以上のunit tests、build、Pagefind、68件以上のPlaywright testsがすべてPASS。

- [ ] **Step 3: Production previewを目視確認する**

Run:

```bash
npm run preview
```

Check at desktop 1440px and mobile 390px:

- `/blog/chatgpt-codex-plugins-guide/`
- `/`
- `/blog/`
- `/tags/plugins/`
- `/categories/ai/`
- Search query `Plugins`

Verify all five images, captions, TOC, table, links, cards, and no horizontal overflow.

- [ ] **Step 4: 画像のprivacyと内容を再確認する**

Use `view_image` for every raster and browser rendering for every SVG. Confirm:

- no account name、email、avatar、history、private Workspace、private Repository
- no `Plugin = Skill + App` false equality
- Japanese text is not clipped or garbled
- each screenshot caption contains the capture date, or each fallback says操作フロー図

- [ ] **Step 5: OpenAI公式情報を最終照合する**

Re-open the three official sources from Task 1. Compare the article's change date、definitions、Directory path、permission model、availability caveats. If official content changed during implementation, update the article and rerun targeted unit/E2E tests.

- [ ] **Step 6: Final diffを確認する**

Run:

```bash
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected: only the planned article、images、generator、CSS、tests、goldens、spec、plan are changed; no `.env`、token、browser profile、personal screenshot is present.

- [ ] **Step 7: Commit formatter or review corrections if needed**

```bash
git add <only-reviewed-files>
git commit -m "chore: finalize plugins article"
```

Skip this commit if the worktree is already clean.

## Task 7: Draft PR、ユーザーレビュー、本番公開

**Files:**
- No new source files expected

- [ ] **Step 1: 実装完了レビューを行う**

Use `@superpowers:requesting-code-review` and `@superpowers:verification-before-completion`. Address only validated findings, then rerun the smallest relevant tests plus full `npm run verify` if code/content changed.

- [ ] **Step 2: BranchをpushしてDraft PRを作る**

Use `@github:yeet`.

```bash
git push -u origin codex/plugins-article-design
gh pr create --repo hiroshiimaizumi0611/tech-log --draft --base main --head codex/plugins-article-design \
  --title "feat: publish ChatGPT and Codex plugins guide" \
  --body "画像付きのPlugins解説記事を追加し、公式情報、権限、安全なGitHub読取デモを検証します。"
```

Expected: Draft PR URL is returned and the required `verify` check starts.

- [ ] **Step 3: GitHub Actionsを確認する**

```bash
gh pr checks --repo hiroshiimaizumi0611/tech-log --watch
```

Expected: required `verify` succeeds. If it fails, use `@github:gh-fix-ci`; do not guess from summary status alone.

- [ ] **Step 4: ユーザーへ公開前レビューを依頼する**

Provide the PR URL and preview evidence. Ask the user to confirm article wording and all five images. Do not merge before explicit approval because merge triggers the public Cloudflare deployment.

- [ ] **Step 5: 承認後にmergeしてDeployを監視する**

After explicit user approval, merge the PR using the repository's protected-branch workflow. Use `@cloudflare-deploy` and `@wrangler` guidance to inspect the existing Deploy workflow; do not print secrets.

Expected: verify、build、deploy、production smoke all succeed.

- [ ] **Step 6: 本番を確認する**

Verify:

- `https://tech-log.hiroshiimaizumi0611.workers.dev/blog/chatgpt-codex-plugins-guide/`
- Home featured article and latest list
- Search query `Plugins`
- RSS and sitemap contain the new URL
- canonical、OGP、Twitter Card use the production origin and article image
- all five images return 2xx

Run the existing production smoke command as an additional site-wide check:

```bash
SITE_URL=https://tech-log.hiroshiimaizumi0611.workers.dev node scripts/smoke-production.mjs
```

Expected: PASS. Report the article URL, PR, deploy run, tests, and any intentional screenshot fallback.
