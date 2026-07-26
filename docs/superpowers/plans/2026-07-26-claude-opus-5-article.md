# Claude Opus 5解説記事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Opus 5について、Opus 4.8からの強化点、料金・性能、Fable 5・Sonnet 5との使い分け、API移行時の注意点を、目を引くオリジナル画像付きで解説する。

**Architecture:** Astro Content CollectionへMarkdown記事を1件追加し、AI生成したオリジナル画像をWebPとして記事本文・ヒーロー・OGPで共用する。記事固有のVitestでメタデータ、構成、主要な事実、出典、画像仕様を固定し、Playwrightで記事表示とホームの最新・注目記事更新を確認する。既存のレイアウト、SEO、画像最適化、一覧生成は変更しない。

**Tech Stack:** Astro 7、Markdown、TypeScript、Vitest、Playwright、Sharp、Prettier、built-in image generation、natural-japanese、stop-ai-slop-jp

---

## 実装前提

- 実装は専用worktree `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/claude-opus-5-article` のブランチ `codex/claude-opus-5-article` で行う。
- 設計書 `docs/superpowers/specs/2026-07-26-claude-opus-5-article-design.md` を正とする。
- 事実と数値は2026年7月26日時点で固定する。Anthropicの公式発表・公式ドキュメントを一次情報とし、Artificial Analysisは第三者評価として分ける。
- ハンズオンは行わない。実際に試していない使用感や「筆者が使ったところ」といった記述は入れない。
- 記事のために既存レイアウト、コンテンツスキーマ、画像コンポーネントは変更しない。
- 画像は`@imagegen`のbuilt-in tool modeで新規生成する。公式ロゴ、製品画面、公式・第三者ベンチマーク画像は転載・模倣しない。
- 本文の仕上げでは`@natural-japanese`と`@stop-ai-slop-jp`を使用する。

## ファイル構成

- Create: `src/assets/blog/claude-opus-5-evolution.webp` — 記事本文・カード・OGPで共用する1600×900のオリジナル画像。
- Create: `src/content/blog/claude-opus-5-overview.md` — 記事本文、メタデータ、比較表、出典を持つ。
- Create: `tests/unit/claude-opus-5-article.test.ts` — 記事と画像の契約を検証する。
- Create: `tests/e2e/claude-opus-5-article.spec.ts` — 記事ページのSEO、画像、構成、モバイル表示を検証する。
- Modify: `tests/e2e/home-content.spec.ts` — 最新記事4件、注目記事、画像付きカードの期待値を更新する。
- Modify: `tests/e2e/listings.spec.ts` — 記事一覧の件数・順序とAIカテゴリー件数を更新する。
- Modify: `tests/e2e/hero-network.spec.ts` — 注目記事リンクの遷移先を更新する。
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-desktop.png` — 新しい注目・最新記事を反映したデスクトップ基準画像。
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-tablet.png` — 新しい注目・最新記事を反映したタブレット基準画像。
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-mobile.png` — 新しい注目・最新記事を反映したモバイル基準画像。
- Create: `docs/superpowers/plans/2026-07-26-claude-opus-5-article.md` — この実装計画。

### Task 0: 実装基点と依存関係を確認する

**Files:**

- Verify: `package.json`
- Verify: `package-lock.json`
- Do not modify: `/Users/hiroshiimaizumi/Documents/tech blog 2/.agents/`
- Do not modify: `/Users/hiroshiimaizumi/Documents/tech blog 2/skills-lock.json`

- [ ] **Step 1: 正しいworktreeとブランチにいることを確認する**

```bash
pwd
git branch --show-current
git status --short --branch
```

Expected:

- `pwd`が`/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/claude-opus-5-article`
- ブランチが`codex/claude-opus-5-article`
- 設計書と計画書以外に意図しない差分がない

- [ ] **Step 2: Node.jsと依存関係を確認する**

```bash
node --version
npm ci
```

Expected: Node.js 24系で、`npm ci`が成功する。

- [ ] **Step 3: 実装前のテスト状態を確認する**

```bash
npm run check
npm test
```

Expected: Astro checkと既存VitestがすべてPASSする。失敗した場合は記事実装を始めず、既存不具合か今回のブランチ差分かを切り分ける。

### Task 1: 画像の契約テストを作り、オリジナル画像を生成する

**Files:**

- Create: `tests/unit/claude-opus-5-article.test.ts`
- Create: `src/assets/blog/claude-opus-5-evolution.webp`

- [ ] **Step 1: 画像の失敗テストを書く**

`tests/unit/claude-opus-5-article.test.ts`を次の内容で作る。

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const heroUrl = new URL('../../src/assets/blog/claude-opus-5-evolution.webp', import.meta.url);

describe('Claude Opus 5 original visual', () => {
  it('stores a 1600x900 WebP suitable for article cards and OGP', async () => {
    const bytes = await readFile(heroUrl);
    const metadata = await sharp(bytes).metadata();

    expect(fileURLToPath(heroUrl)).toContain('claude-opus-5-evolution.webp');
    expect(metadata).toMatchObject({ width: 1600, height: 900, format: 'webp' });
    expect(bytes.byteLength).toBeGreaterThan(80_000);
  });
});
```

- [ ] **Step 2: 画像がないためテストが失敗することを確認する**

```bash
npm test -- tests/unit/claude-opus-5-article.test.ts
```

Expected: `ENOENT`でFAILし、`src/assets/blog/claude-opus-5-evolution.webp`が未作成であることを示す。

- [ ] **Step 3: built-in image generationで画像を生成する**

`@imagegen`をbuilt-in tool modeで使い、次のプロンプトを渡す。生成物はプロジェクト用であり、最終的にworktreeへ保存する。

```text
Use case: infographic-diagram
Asset type: 16:9 hero image and OGP image for a Japanese technology blog
Primary request: Create an eye-catching abstract technology visual that communicates a major evolution from Claude Opus 4.8 to Claude Opus 5. The image should feel fast, intelligent, precise, and suitable for a serious engineering article.
Scene/backdrop: black-to-deep-navy background, layered depth, fine luminous lines, flowing particles, abstract code fragments, and a forward-moving energy structure
Subject: a central luminous intelligence core evolving from a smaller “4.8” stage on the left into a larger “5” stage on the right
Style/medium: premium cinematic technology graphic, precise editorial infographic, dark interface aesthetic, not photorealistic
Composition/framing: wide 16:9 composition, strong center focus, generous safe margins, readable at small article-card size
Lighting/mood: controlled orange and violet glow with subtle cyan highlights, high contrast, energetic but not noisy
Text (verbatim):
"CLAUDE OPUS 5"
"4.8 → 5"
"SAME CORE"
"1M CONTEXT · $5 / $25"
"IMPROVED"
"DEEP REASONING · AGENTIC CODING · EFFORT SCALING"
Constraints: Render every text string exactly as written; make CLAUDE OPUS 5 the largest text; visually separate SAME CORE from IMPROVED; make improved capabilities more prominent than unchanged specifications; no Japanese text
Avoid: official Anthropic logo, copied brand marks, product UI screenshots, benchmark charts, people, robots, stock-photo imagery, watermark, illegible microtext, clutter
```

Expected: built-in toolが生成画像と保存パスを返す。

- [ ] **Step 4: 画像を目視確認し、必要なら1回ずつ修正する**

生成画像を表示し、次を確認する。

- `CLAUDE OPUS 5`と`4.8 → 5`が一目で読める
- `SAME CORE`と`IMPROVED`が混同されない
- すべての英数字に誤字がない
- 公式ロゴや製品画面を模倣していない
- 390px幅相当へ縮小しても主題が分かる
- 主な文字と発光要素が端から十分に離れている

誤字や構図の問題がある場合は、同じ画像を対象に`@imagegen`で一度に1点だけ修正する。文字を正確に直せない場合は、生成画像を背景として使い、正確な文字レイヤーを別途重ねる判断へ切り替える。

- [ ] **Step 5: 生成画像を1600×900のWebPに変換して保存する**

tool resultが返した生成画像の絶対パスを`<generated-image-path>`へ置き換えて実行する。

```bash
node --input-type=module -e '
  import sharp from "sharp";
  const [input, output] = process.argv.slice(1);
  await sharp(input)
    .resize(1600, 900, { fit: "cover", position: "centre" })
    .webp({ quality: 90, effort: 6 })
    .toFile(output);
' '<generated-image-path>' 'src/assets/blog/claude-opus-5-evolution.webp'
```

- [ ] **Step 6: 画像テストと最終表示を確認する**

```bash
npm test -- tests/unit/claude-opus-5-article.test.ts
```

Expected: 画像テスト1件がPASSする。続けて`src/assets/blog/claude-opus-5-evolution.webp`を表示し、リサイズ後も文字、端、コントラストに問題がないことを確認する。

- [ ] **Step 7: 画像と画像テストをコミットする**

```bash
git add src/assets/blog/claude-opus-5-evolution.webp tests/unit/claude-opus-5-article.test.ts
git commit -m "test: add Claude Opus 5 visual contract"
```

### Task 2: 記事の契約を失敗テストで固定する

**Files:**

- Modify: `tests/unit/claude-opus-5-article.test.ts`
- Test: `tests/unit/claude-opus-5-article.test.ts`

- [ ] **Step 1: 記事解析用のimport、定数、ヘルパーを追加する**

既存importへ次を加える。

```ts
import type { Definition, Html, Image, ImageReference, Link, LinkReference } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { parse } from 'yaml';
```

`heroUrl`の直後へ次を追加する。

```ts
const articleUrl = new URL('../../src/content/blog/claude-opus-5-overview.md', import.meta.url);
const expectedHeadings = [
  'Claude Opus 5とは',
  'Opus 4.8から強化された内容',
  '料金と基本仕様はOpus 4.8から据え置き',
  'ベンチマークは公式評価と第三者評価を分けて読む',
  'Fable 5・Sonnet 5との使い分け',
  'Claude Codeでは難しさと費用で選ぶ',
  'Opus 4.8からAPIを移行するときの確認事項',
  'まとめ',
] as const;

const requiredSources = [
  'https://www.anthropic.com/news/claude-opus-5',
  'https://platform.claude.com/docs/en/about-claude/models/whats-new-opus-5',
  'https://platform.claude.com/docs/en/about-claude/models/migration-guide',
  'https://platform.claude.com/docs/en/about-claude/models/overview',
  'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5',
  'https://artificialanalysis.ai/articles/claude-opus-5-leader-agentic-knowledge-work',
] as const;

function splitArticle(markdown: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) throw new Error('Article must start with frontmatter enclosed by --- delimiters');

  return { frontmatter: match[1], body: markdown.slice(match[0].length).replace(/\r\n?/g, '\n') };
}

function inspectMarkdown(markdown: string): {
  inlineImages: Array<Pick<Image, 'alt' | 'url'>>;
  imageReferences: Array<Pick<ImageReference, 'alt' | 'identifier'>>;
  htmlImageCount: number;
  links: string[];
} {
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, string>();
  const inlineImages: Array<Pick<Image, 'alt' | 'url'>> = [];
  const imageReferences: Array<Pick<ImageReference, 'alt' | 'identifier'>> = [];
  const links: string[] = [];
  let htmlImageCount = 0;

  visit(tree, 'definition', (node: Definition) => definitions.set(node.identifier, node.url));
  visit(tree, 'link', (node: Link) => links.push(node.url));
  visit(tree, 'linkReference', (node: LinkReference) => {
    const url = definitions.get(node.identifier);
    if (url) links.push(url);
  });
  visit(tree, 'image', (node: Image) => inlineImages.push({ alt: node.alt, url: node.url }));
  visit(tree, 'imageReference', (node: ImageReference) => {
    imageReferences.push({ alt: node.alt, identifier: node.identifier });
  });
  visit(tree, 'html', (node: Html) => {
    htmlImageCount += (node.value.match(/<img\b/gi) ?? []).length;
  });

  return { inlineImages, imageReferences, htmlImageCount, links };
}
```

- [ ] **Step 2: メタデータ、構成、主要事実のテストを追加する**

画像の`describe`の後へ次を加える。

```ts
describe('Claude Opus 5 overview article', () => {
  it('publishes the approved metadata and exact H2 structure', async () => {
    const { frontmatter, body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const metadata = parse(frontmatter) as Record<string, unknown>;
    const headings = [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);

    expect(metadata).toMatchObject({
      title: 'Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説',
      description:
        'Claude Opus 5とは何か。Opus 4.8から強化された推論・コーディング性能、料金、ベンチマーク、Fable 5・Sonnet 5との違い、API移行時の注意点を解説します。',
      publishedAt: '2026-07-26',
      category: 'AI',
      tags: ['Claude', 'Anthropic', 'AIモデル', 'Claude Code'],
      featured: true,
      heroImage: '../../assets/blog/claude-opus-5-evolution.webp',
      ogImage: '../../assets/blog/claude-opus-5-evolution.webp',
    });
    expect(metadata.draft).not.toBe(true);
    expect(headings).toEqual(expectedHeadings);
  });

  it('uses primary sources, separates third-party evaluation, and preserves migration facts', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { links } = inspectMarkdown(body);

    expect(links).toEqual(expect.arrayContaining([...requiredSources]));

    for (const fact of [
      '2026年7月24日',
      '2026年7月26日時点',
      '100万トークン',
      '128k',
      '$5',
      '$25',
      'claude-opus-5',
      'thinking',
      'effort',
      '512トークン',
      '1,024トークン',
      'Web fetch',
      'Priority Tier',
      '1720',
      '1574',
      '$17.79',
      '$22.30',
      '36.2分',
      '24.1分',
    ]) {
      expect(body).toContain(fact);
    }

    expect(body).toContain('公式発表');
    expect(body).toContain('第三者評価');
    expect(body).toMatch(/ハンズオン|実機比較[^を]*(?:行って|実施して)いません/);
    expect(body).not.toMatch(/(?:世界最強|圧倒的|革命的|ゲームチェンジャー|完全に置き換え)/);
  });

  it('uses one original image in the body and no copied benchmark images', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { htmlImageCount, imageReferences, inlineImages } = inspectMarkdown(body);

    expect(inlineImages).toEqual([
      {
        alt: 'Claude Opus 4.8からOpus 5への進化を表したオリジナル画像',
        url: '../../assets/blog/claude-opus-5-evolution.webp',
      },
    ]);
    expect(imageReferences).toEqual([]);
    expect(htmlImageCount).toBe(0);
    expect(inlineImages.length + imageReferences.length + htmlImageCount).toBe(1);
    expect(body).toContain('テックログのオリジナル画像');
    expect(body).not.toMatch(/(?:anthropic|artificial[-_]?analysis)[^\s\])}>]*\.(?:png|jpe?g|webp|svg)/i);
  });
});
```

- [ ] **Step 3: 記事がないためテストが失敗することを確認する**

```bash
npm test -- tests/unit/claude-opus-5-article.test.ts
```

Expected: 画像テストだけがPASSし、記事テストは`src/content/blog/claude-opus-5-overview.md`の`ENOENT`でFAILする。

### Task 3: Claude Opus 5解説記事を書く

**Files:**

- Create: `src/content/blog/claude-opus-5-overview.md`
- Modify: `tests/unit/claude-opus-5-article.test.ts`（事実に反しない範囲でテスト表現を調整する場合だけ）

- [ ] **Step 1: Frontmatterと導入を書く**

`src/content/blog/claude-opus-5-overview.md`を次のFrontmatterで作る。

```yaml
---
title: Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説
description: Claude Opus 5とは何か。Opus 4.8から強化された推論・コーディング性能、料金、ベンチマーク、Fable 5・Sonnet 5との違い、API移行時の注意点を解説します。
publishedAt: '2026-07-26'
category: AI
tags:
  - Claude
  - Anthropic
  - AIモデル
  - Claude Code
featured: true
heroImage: ../../assets/blog/claude-opus-5-evolution.webp
ogImage: ../../assets/blog/claude-opus-5-evolution.webp
---
```

導入の1段落目で、Opus 5が2026年7月24日に公開されたOpus 4.8の後継であり、同じAPI単価のまま深い推論、長時間のエージェント作業、コーディングを強化したことを答える。2段落目で、記事が2026年7月26日時点の公式情報と第三者評価を整理したもので、ハンズオンを実施していないと明記する。

- [ ] **Step 2: オリジナル画像を本文へ1点だけ配置する**

導入直後へ次を置く。

```markdown
![Claude Opus 4.8からOpus 5への進化を表したオリジナル画像](../../assets/blog/claude-opus-5-evolution.webp)

<!-- prettier-ignore -->
*Opus 4.8から据え置かれた条件と、Opus 5で強化された領域を表したテックログのオリジナル画像*
```

- [ ] **Step 3: 「Claude Opus 5とは」と4.8からの変更点を書く**

見出し`## Claude Opus 5とは`では、次を説明する。

- 複雑なエージェント型コーディングと企業向け知識作業を想定したモデル
- Claude Maxのデフォルト、Claude Proで利用できる最上位モデル
- Claude API、Amazon Bedrock、Google Cloud、Microsoft Foundryで利用可能
- APIモデルIDは`claude-opus-5`

見出し`## Opus 4.8から強化された内容`では、能力面として深い推論、長時間作業、effortに応じた性能向上、低effortの効率、コードレビュー、画像理解、長い文脈、文書作成、複数エージェントの調整を平易に説明する。

続けて次の比較表を入れる。

```markdown
| 項目 | Opus 4.8 | Opus 5 | 移行時の意味 |
| --- | --- | --- | --- |
| APIモデルID | `claude-opus-4-8` | `claude-opus-5` | 呼び出し先を変更する |
| thinking | 明示しなければ無効 | デフォルトで有効 | 同じリクエストでも思考トークンを使う場合がある |
| effort | 利用可能 | 5段階をより性能へ反映 | `high`を基準に実測する |
| thinkingの無効化 | effortと独立 | `high`以下だけ | `xhigh`・`max`との併用は400エラーになる |
| キャッシュ対象の最小長 | 1,024トークン | 512トークン | 短いプロンプトもキャッシュしやすい |
```

会話中のツール変更はOpus 5と同時期に導入されたがOpus 4.8でも使えるベータ機能として、固有の能力差と分ける。Fast modeも両モデルに対応する継続機能であり、最大約2.5倍の出力速度、入力$10・出力$50／100万トークン、Claude APIだけで利用可能という条件を記載する。回答や文書が長くなりやすい、進捗説明とサブエージェント委任が増えやすい、自発的な検証が強いという挙動差も説明する。

- [ ] **Step 4: 料金、ベンチマーク、モデル比較を書く**

見出し`## 料金と基本仕様はOpus 4.8から据え置き`へ次の表を入れる。

```markdown
| 項目 | Claude Opus 4.8 | Claude Opus 5 |
| --- | ---: | ---: |
| 入力料金 | $5 / 100万トークン | $5 / 100万トークン |
| 出力料金 | $25 / 100万トークン | $25 / 100万トークン |
| コンテキスト | 100万トークン | 100万トークン |
| 最大出力 | 128kトークン | 128kトークン |
```

単価が同じでもthinkingとeffortでタスク全体の時間・費用が変わると補足する。

見出し`## ベンチマークは公式評価と第三者評価を分けて読む`では、公式評価としてFrontier-Bench v0.1、ARC-AGI 3、OSWorld 2.0、CursorBench 3.2を紹介し、すべて「Anthropicの発表による評価」と明示する。

Artificial Analysisは別の段落と表で扱う。

```markdown
| AA-Briefcaseの指標 | Opus 5 max | 比較対象 |
| --- | ---: | ---: |
| 総合Elo | 1720 | Fable 5: 1574 |
| 1タスク当たり費用 | $17.79 | Fable 5: $22.30 |
| 平均処理時間 | 36.2分 | Opus 4.8 max: 24.1分 |
```

AA-Briefcaseが、複数ファイルからレポート、表計算、スライドなどを作るエージェント型知識作業の評価であること、高いeffortは高性能でも短時間とは限らないこと、単一のベンチマークは実務のすべてを表さないことを書く。

見出し`## Fable 5・Sonnet 5との使い分け`へ次の表を入れる。

```markdown
| モデル | 標準API料金（入力 / 出力、100万トークン） | 向く用途 |
| --- | --- | --- |
| Claude Fable 5 | $10 / $50 | 費用より最高水準の能力を優先する難しい長時間作業 |
| Claude Opus 5 | $5 / $25 | 複雑なコーディングや知識作業を日常的に任せる |
| Claude Sonnet 5 | $3 / $15 | 応答速度、処理量、費用のバランスを優先する |
```

Sonnet 5は2026年8月31日まで$2 / $10の導入価格であると注記する。「常にFable 5が勝つ」「Opus 5が完全に置き換えた」とは書かない。

- [ ] **Step 5: Claude Codeの選び方とAPI移行手順を書く**

見出し`## Claude Codeでは難しさと費用で選ぶ`では、次を「公式仕様と料金から筆者が整理した目安」として書く。

- Sonnet 5: 一般的な修正、調査、繰り返し回数が多い作業
- Opus 5: 複数ファイルの変更、難しい不具合調査、長時間の自律作業
- Fable 5: 最も難しく、費用より能力を優先する作業

見出し`## Opus 4.8からAPIを移行するときの確認事項`では、モデルIDの変更例を示す。

```python
model = "claude-opus-4-8"  # 変更前
model = "claude-opus-5"    # 変更後
```

続けて次をチェックリストとして説明する。

1. thinkingがデフォルトで有効になるため`max_tokens`を見直す
2. `high`を基準にeffortごとの品質・時間・費用を測る
3. thinkingを無効にする場合は`high`以下にし、本文へツール呼び出しや内部XMLが出ないか確認する
4. 回答の長さ、進捗説明、サブエージェント委任を必要に応じて制御する
5. 旧モデル向けの明示的な再検証指示を外し、過剰検証を避ける
6. Web fetchとPriority Tierへ依存している場合は代替策を用意する
7. ツール呼び出し、構造化出力、長時間タスクを回帰テストする
8. Bedrock、Google Cloud、Microsoft FoundryではFast modeやベータ機能などの提供差を確認する

会話中のツール変更と自動フォールバックはベータ機能なので、基本移行コードには含めず公式ドキュメントへのリンクだけを置く。

- [ ] **Step 6: まとめと出典の結び付けを仕上げる**

見出し`## まとめ`では、料金と基本条件は据え置き、難しい推論・コーディング・長時間作業は強化、高effortは時間と費用が増える場合がある、API移行ではthinkingの変更が重要、という4点を再統合する。

事実が出る段落へ次のリンクを自然に置き、末尾へURLだけを並べない。

```text
https://www.anthropic.com/news/claude-opus-5
https://platform.claude.com/docs/en/about-claude/models/whats-new-opus-5
https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8
https://platform.claude.com/docs/en/about-claude/models/migration-guide
https://platform.claude.com/docs/en/about-claude/models/overview
https://platform.claude.com/docs/en/build-with-claude/effort
https://platform.claude.com/docs/en/build-with-claude/fast-mode
https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages
https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
https://artificialanalysis.ai/articles/claude-opus-5-leader-agentic-knowledge-work
```

- [ ] **Step 7: 記事契約テストを通す**

```bash
npm test -- tests/unit/claude-opus-5-article.test.ts
```

Expected: 画像と記事の全テストがPASSする。テストが公式情報と矛盾する場合だけテストを直し、本文を誤った期待値へ合わせない。

- [ ] **Step 8: 記事と契約テストをコミットする**

```bash
git add src/content/blog/claude-opus-5-overview.md tests/unit/claude-opus-5-article.test.ts
git commit -m "docs: add Claude Opus 5 overview article"
```

### Task 4: 記事ページとホーム表示をE2Eで検証する

**Files:**

- Create: `tests/e2e/claude-opus-5-article.spec.ts`
- Modify: `tests/e2e/home-content.spec.ts`
- Modify: `tests/e2e/listings.spec.ts`
- Modify: `tests/e2e/hero-network.spec.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-desktop.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-tablet.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-mobile.png`

- [ ] **Step 1: 記事ページのE2Eテストを書く**

`tests/e2e/claude-opus-5-article.spec.ts`を次の内容で作る。

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const articlePath = '/blog/claude-opus-5-overview/';
const articleTitle = 'Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説';
const articleDescription =
  'Claude Opus 5とは何か。Opus 4.8から強化された推論・コーディング性能、料金、ベンチマーク、Fable 5・Sonnet 5との違い、API移行時の注意点を解説します。';

test('Claude Opus 5記事のSEO、画像、構成を公開する', async ({ page }) => {
  await page.goto(articlePath);

  await expect(page).toHaveTitle(`${articleTitle} | テックログ`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', articleDescription);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog\/claude-opus-5-overview\/$/);
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    await expect(page.locator(selector)).toHaveAttribute('content', /\/_astro\/claude-opus-5-evolution\..+\.webp$/);
  }

  const article = page.locator('article[data-pagefind-body]');
  const body = article.locator('[data-article-body]');
  await expect(article.getByRole('heading', { level: 1, name: articleTitle })).toBeVisible();
  await expect(article.getByText('公開日 2026年7月26日', { exact: true })).toBeVisible();
  await expect(article.locator('[data-pagefind-filter="category"]')).toHaveText('AI');
  await expect(article.locator('[data-pagefind-filter="tag"]')).toHaveText([
    'Claude',
    'Anthropic',
    'AIモデル',
    'Claude Code',
  ]);
  await expect(body.getByRole('heading', { level: 2 })).toHaveCount(8);
  await expect(body.locator('img')).toHaveCount(1);
  await expect(body.locator('img')).toHaveAttribute(
    'alt',
    'Claude Opus 4.8からOpus 5への進化を表したオリジナル画像',
  );
  await expect(body.locator('table')).toHaveCount(4);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('Claude Opus 5記事を390px幅ではみ出さず表示する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);

  const body = page.locator('[data-article-body]');
  expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  for (const element of await body.locator('img, table, pre').all()) {
    expect(await element.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
});
```

- [ ] **Step 2: ホームの期待値を新記事へ更新する**

`tests/e2e/home-content.spec.ts`で、タイトル定数と最新記事配列を次へ変更する。

```ts
const opusArticleTitle = 'Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説';
const kimiArticleTitle = 'Kimi K3とは？2.8兆パラメータの新AIモデルを公式情報とベンチマークから解説';
const cloudFrontArticleTitle = '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理';
const httpQueryArticleTitle = 'HTTP QUERYメソッドとは？GET・POSTとの違いとcurlでの試し方';

const latestArticleTitles = [
  opusArticleTitle,
  kimiArticleTitle,
  cloudFrontArticleTitle,
  httpQueryArticleTitle,
] as const;

const featuredArticleTitle = opusArticleTitle;
```

注目記事リンクの期待値を次へ変える。

```ts
await expect(featured.getByRole('link', { name: featuredArticleTitle })).toHaveAttribute(
  'href',
  '/blog/claude-opus-5-overview/',
);
```

画像表示と画像取得失敗の2テストでは、`sitesArticleTitle`と`/blog/chatgpt-sites-guide/`を`opusArticleTitle`と`/blog/claude-opus-5-overview/`へ置き換える。変数名も`sitesCard`から`opusCard`へ変更する。

JavaScript無効時のテストでも、注目記事リンクの期待値を次へ変更する。

```ts
await expect(hero.getByRole('link', { name: featuredArticleTitle })).toHaveAttribute(
  'href',
  '/blog/claude-opus-5-overview/',
);
```

- [ ] **Step 3: 記事一覧とAIカテゴリーの期待値を更新する**

`tests/e2e/listings.spec.ts`の`articleTitles`先頭へ次を追加する。

```ts
'Claude Opus 5とは？Opus 4.8からの進化・料金・性能を分かりやすく解説',
```

記事一覧テストの件数を9件から10件へ変更する。

```ts
await expect(page.getByText('10件の記事')).toBeVisible();
await expect(cards).toHaveCount(10);
```

カテゴリー一覧テストのAI件数を5件から6件へ変更する。

```ts
await expect(categoryLinks.filter({ hasText: 'AI' })).toContainText('6件');
```

- [ ] **Step 4: 注目記事リンクの遷移テストを更新する**

`tests/e2e/hero-network.spec.ts`の`navigates through the Featured link while the network is active`で、遷移先を次へ変更する。

```ts
await expect(page).toHaveURL(/\/blog\/claude-opus-5-overview\/$/);
```

- [ ] **Step 5: 対象の機能E2Eを実行する**

```bash
npx playwright test \
  tests/e2e/claude-opus-5-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/listings.spec.ts \
  tests/e2e/hero-network.spec.ts
```

Expected: 記事、ホーム、一覧、ヒーローネットワークの対象E2EがすべてPASSする。

- [ ] **Step 6: ホームのビジュアル基準画像を更新して目視確認する**

```bash
npx playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Expected: visual specがPASSし、3枚のホーム基準画像が更新される。更新後のPNGをすべて表示し、差分が新しい注目記事タイトル、最新記事、画像に限定され、レイアウト崩れを含まないことを確認する。

- [ ] **Step 7: E2Eテストと基準画像をコミットする**

```bash
git add \
  tests/e2e/claude-opus-5-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/listings.spec.ts \
  tests/e2e/hero-network.spec.ts \
  tests/e2e/visual.spec.ts-snapshots/home-desktop.png \
  tests/e2e/visual.spec.ts-snapshots/home-tablet.png \
  tests/e2e/visual.spec.ts-snapshots/home-mobile.png
git commit -m "test: cover Claude Opus 5 article pages"
```

### Task 5: 日本語と事実関係を仕上げる

**Files:**

- Modify: `src/content/blog/claude-opus-5-overview.md`
- Modify: `tests/unit/claude-opus-5-article.test.ts`（正しい事実に合わせる必要がある場合だけ）

- [ ] **Step 1: natural-japaneseの指示を読み、静的検査する**

`@natural-japanese`を使用し、`SKILL.md`と同スキルが指定する必要な参照ファイルを読んでから実行する。

```bash
uv run '/Users/hiroshiimaizumi/.codex/skills/natural-japanese/scripts/lint.py' \
  --json \
  --genre tech \
  src/content/blog/claude-opus-5-overview.md
```

Expected: findingごとに「修正」または「技術文脈上残す」を判断できる。禁止語、直訳調、同じ文型の反復、過剰な名詞化は本文で解消する。

- [ ] **Step 2: stop-ai-slop-jpで手動レビューする**

`@stop-ai-slop-jp`の`SKILL.md`を完全に読み、次を確認する。

- 主体のない「注目されています」「期待されます」を使っていない
- 「単なる〜ではなく」「〜と言えるでしょう」などの定型表現を重ねていない
- すべての節を同じ長さ・同じ結論にそろえていない
- 箇条書きで済ませず、比較の読み方を文章で説明している
- 必要な技術用語、留保、出典まで機械的に削っていない

- [ ] **Step 3: 公式情報と第三者評価を再照合する**

設計書の出典を開き、本文が次を満たすか確認する。

- Opus 5の発表日は2026年7月24日
- API単価は入力$5、出力$25／100万トークン
- Opus 4.8とOpus 5は100万トークン、最大128k出力
- thinkingのデフォルト有効化と`high`を超える無効化の400エラーを区別している
- 会話中のツール変更とFast modeをOpus 5だけの機能と書いていない
- Web fetchとPriority Tierの非対応を移行注意として扱っている
- Artificial Analysisの1720、1574、$17.79、$22.30、36.2分、24.1分を2026年7月24日公開の第三者評価として扱っている
- ハンズオン結果や実利用の体験談を追加していない

- [ ] **Step 4: 本文の表示文字数を確認する**

Frontmatter、画像、URL、Markdown記号、表を除いた本文がおおむね3,500〜4,500字に収まることを確認する。次のコマンドは編集上の目安であり、自動テストの合否には使わない。

```bash
node --input-type=module -e '
  import { readFile } from "node:fs/promises";
  let text = await readFile("src/content/blog/claude-opus-5-overview.md", "utf8");
  text = text.replace(/^---[\s\S]*?---\s*/, "");
  text = text.replace(/^!\[[^\]]*\]\([^)]+\)$/gm, "");
  text = text.replace(/^\|.*\|$/gm, "");
  text = text.replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.replace(/\]\([^)]+\)$/, "").slice(1));
  text = text.replace(/<!--[\s\S]*?-->/g, "").replace(/[*_`#>-]/g, "");
  console.log([...text.replace(/\s/g, "")].length);
'
```

Expected: おおむね3,500〜4,500。範囲外でも冗長化や重要情報の削除は行わず、設計上の目安として内容を見直す。

- [ ] **Step 5: 修正後の対象テストを実行する**

```bash
npm test -- tests/unit/claude-opus-5-article.test.ts
npx playwright test \
  tests/e2e/claude-opus-5-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/listings.spec.ts \
  tests/e2e/hero-network.spec.ts
```

Expected: すべてPASSする。

- [ ] **Step 6: 文章レビューの修正をコミットする**

変更がある場合だけ実行する。

```bash
git add src/content/blog/claude-opus-5-overview.md tests/unit/claude-opus-5-article.test.ts
git commit -m "docs: refine Claude Opus 5 article wording"
```

### Task 6: サイト全体を検証する

**Files:**

- Modify only if needed: `src/content/blog/claude-opus-5-overview.md`
- Modify only if needed: `tests/unit/claude-opus-5-article.test.ts`
- Modify only if needed: `tests/e2e/claude-opus-5-article.spec.ts`
- Modify only if needed: `tests/e2e/home-content.spec.ts`
- Modify only if needed: `tests/e2e/listings.spec.ts`
- Modify only if needed: `tests/e2e/hero-network.spec.ts`
- Modify: `docs/superpowers/plans/2026-07-26-claude-opus-5-article.md`（チェック状態または整形だけ）

- [ ] **Step 1: 対象テキストファイルを整形する**

```bash
npx prettier --write \
  src/content/blog/claude-opus-5-overview.md \
  tests/unit/claude-opus-5-article.test.ts \
  tests/e2e/claude-opus-5-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/listings.spec.ts \
  tests/e2e/hero-network.spec.ts \
  docs/superpowers/plans/2026-07-26-claude-opus-5-article.md
```

- [ ] **Step 2: 画像と差分を最終確認する**

`src/assets/blog/claude-opus-5-evolution.webp`を表示し、文字、端、コントラスト、1600×900の構図を再確認する。

```bash
git diff --check
git diff --stat origin/main...HEAD
git status --short
```

Expected: 設計書、計画書、記事、オリジナル画像1点、記事テスト、ホームE2E以外に意図しない変更がない。

- [ ] **Step 3: 型・コンテンツ・ユニットテストを確認する**

```bash
npm run format:check
npm run check
npm test
```

Expected: Prettier、Astro check、全VitestがPASSする。

- [ ] **Step 4: 本番ビルドと全E2Eを確認する**

```bash
npm run build
npm run test:e2e
```

Expected:

- ビルドとPagefind生成が成功する
- `dist/blog/claude-opus-5-overview/index.html`が生成される
- 全PlaywrightテストがPASSする
- 記事固有のOGP画像が`/_astro/claude-opus-5-evolution.*.webp`として参照される

- [ ] **Step 5: 検証で生じた修正をコミットする**

変更がある場合だけ実行する。

```bash
git add \
  src/content/blog/claude-opus-5-overview.md \
  src/assets/blog/claude-opus-5-evolution.webp \
  tests/unit/claude-opus-5-article.test.ts \
  tests/e2e/claude-opus-5-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/listings.spec.ts \
  tests/e2e/hero-network.spec.ts \
  tests/e2e/visual.spec.ts-snapshots/home-desktop.png \
  tests/e2e/visual.spec.ts-snapshots/home-tablet.png \
  tests/e2e/visual.spec.ts-snapshots/home-mobile.png \
  docs/superpowers/plans/2026-07-26-claude-opus-5-article.md
git commit -m "chore: verify Claude Opus 5 article"
```

- [ ] **Step 6: 完了状態を確認する**

`@superpowers:verification-before-completion`を使い、次を実行する。

```bash
git status --short
git log -6 --oneline
```

Expected: 今回の作業に関する未コミット変更がなく、画像、記事、E2E、文章調整のコミットが確認できる。PR作成、マージ、公開は別途ユーザーの指示を受けて行う。
