# Kimi K3入門記事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kimi K3を初めて知った読者に向け、公式情報とArtificial Analysisの測定・整理結果を区別して説明する日本語記事を公開可能な状態まで作る。

**Architecture:** Astro Content CollectionへMarkdown記事を1件追加し、Kimi公式発表のヒーロー画像をローカルのWebPとして1点だけ保存する。記事固有のVitestでメタデータ、見出し、出典、ベンチマーク値、画像点数、誇張を避ける注意書きを固定し、既存の一覧・SEO・ビルド処理はそのまま利用する。

**Tech Stack:** Astro 7、Markdown、TypeScript、Vitest、remark、YAML、Sharp、Prettier、natural-japanese

---

## 実装前提

- 実装は`origin/main`の`366874b`以降を取り込んだ作業ブランチで行う。HTTP QUERY記事、CloudFront障害記事、SEOクロール導線の変更を失わないこと。
- 設計書は`docs/superpowers/specs/2026-07-22-kimi-k3-overview-article-design.md`を正とする。
- 事実と数値は2026年7月22日時点で固定する。公開直前に参照ページを確認しても、後日の値へ置き換えない。
- 新しいUI、記事テンプレート、画像生成処理は追加しない。

## ファイル構成

- Create: `src/assets/blog/kimi-k3-official-hero.webp` — Kimi公式発表のヒーロー画像を保存する。
- Create: `src/content/blog/kimi-k3-overview.md` — 記事本文、メタデータ、出典、画像キャプションを持つ。
- Create: `tests/unit/kimi-k3-article.test.ts` — 記事と画像が設計どおりかを検証する。

### Task 0: 最新mainから実装用worktreeを作る

**Files:**

- Copy into the new worktree: `docs/superpowers/specs/2026-07-22-kimi-k3-overview-article-design.md`
- Copy into the new worktree: `docs/superpowers/plans/2026-07-22-kimi-k3-overview-article.md`
- Do not modify: `/Users/hiroshiimaizumi/Documents/tech blog 2/.agents/`
- Do not modify: `/Users/hiroshiimaizumi/Documents/tech blog 2/skills-lock.json`

- [ ] **Step 1: origin/mainを更新し、必要な変更を含むことを確認する**

元のリポジトリで実行する。

```bash
git fetch origin
git merge-base --is-ancestor 366874b origin/main
```

Expected: 2番目のコマンドがexit code 0で終了する。失敗した場合は実装を始めず、`origin/main`の状態を確認する。

- [ ] **Step 2: 実装用worktreeを最新mainから作る**

`@superpowers:using-git-worktrees`を使い、次のブランチとパスで作る。ブランチまたはパスがすでに存在する場合は上書きせず、既存worktreeの状態を確認してから再利用可否を判断する。

```bash
git worktree add \
  -b codex/kimi-k3-overview \
  '.worktrees/kimi-k3-overview' \
  origin/main
```

- [ ] **Step 3: 承認済みの設計書と計画書だけを移す**

新しいworktreeで実行する。元ブランチの他のコミットはcherry-pickしない。

```bash
git restore \
  --source=codex/interactive-hero-design \
  -- docs/superpowers/specs/2026-07-22-kimi-k3-overview-article-design.md \
  docs/superpowers/plans/2026-07-22-kimi-k3-overview-article.md
git add \
  docs/superpowers/specs/2026-07-22-kimi-k3-overview-article-design.md \
  docs/superpowers/plans/2026-07-22-kimi-k3-overview-article.md
git commit -m "docs: plan Kimi K3 overview article"
```

- [ ] **Step 4: 実装基点と作業範囲を確認する**

```bash
git merge-base --is-ancestor 366874b HEAD
git status --short
```

Expected: 1番目のコマンドがexit code 0、`git status --short`は空。元のworktreeにある未追跡`.agents/`と`skills-lock.json`は移動、追加、削除しない。

### Task 1: 公式画像を保存し、画像契約をテストする

**Files:**

- Create: `src/assets/blog/kimi-k3-official-hero.webp`
- Create: `tests/unit/kimi-k3-article.test.ts`

- [ ] **Step 1: 画像テストを書く**

`tests/unit/kimi-k3-article.test.ts`を次の内容で作る。

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const articleUrl = new URL('../../src/content/blog/kimi-k3-overview.md', import.meta.url);
const heroUrl = new URL('../../src/assets/blog/kimi-k3-official-hero.webp', import.meta.url);

describe('Kimi K3 official visual', () => {
  it('stores the official hero as a real 1920x879 WebP', async () => {
    const bytes = await readFile(heroUrl);
    const metadata = await sharp(bytes).metadata();

    expect(fileURLToPath(heroUrl)).toContain('kimi-k3-official-hero.webp');
    expect(metadata).toMatchObject({ width: 1920, height: 879, format: 'webp' });
  });
});
```

- [ ] **Step 2: 画像テストが失敗することを確認する**

Run:

```bash
npm test -- tests/unit/kimi-k3-article.test.ts
```

Expected: `ENOENT`で失敗し、`src/assets/blog/kimi-k3-official-hero.webp`が未作成であることを示す。

- [ ] **Step 3: 公式画像を取得する**

公式記事`https://www.kimi.com/blog/kimi-k3`の「Kimi K3 hero visual」から得た次のURLを使う。取得前にURLが公式記事のヒーロー画像を指していることを再確認し、別画像へリダイレクトされた場合は保存しない。

```bash
curl -L --fail --silent --show-error \
  'https://kimi-file.moonshot.cn/prod-chat-kimi/kfs/4/2/2026-07-17/d9cs7176rtp4tqfofnsg?x-tos-process=image%2Fauto-orient%2C1%2Fstrip%2Fignore-error%2C1' \
  -o src/assets/blog/kimi-k3-official-hero.webp
```

- [ ] **Step 4: 画像テストが通ることを確認する**

Run:

```bash
npm test -- tests/unit/kimi-k3-article.test.ts
```

Expected: 画像テスト1件がPASSする。

- [ ] **Step 5: 画像と画像テストをコミットする**

```bash
git add src/assets/blog/kimi-k3-official-hero.webp tests/unit/kimi-k3-article.test.ts
git commit -m "test: add Kimi K3 official visual contract"
```

### Task 2: 記事契約をテストで固定する

**Files:**

- Modify: `tests/unit/kimi-k3-article.test.ts`
- Test: `tests/unit/kimi-k3-article.test.ts`

- [ ] **Step 1: 記事解析用のimportとヘルパーを追加する**

既存importへ次を加える。

```ts
import type { Definition, Html, Image, ImageReference, Link, LinkReference } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { parse } from 'yaml';
```

テスト本体の前へ次を追加する。

```ts
const expectedHeadings = [
  'Kimi K3はMoonshot AIの最新モデル',
  '大規模な情報を扱うための設計が目立つ',
  '第三者評価では知能が高く、速度と料金には弱点がある',
  '長いコードや資料を扱う仕事が有力な用途になる',
  '料金と利用条件は使う場所によって異なる',
  '「オープン」の現状には注意が必要',
  '高い評価と現在の制約をセットで見る',
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
  let htmlImageCount = 0;
  const links: string[] = [];

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

- [ ] **Step 2: メタデータと構成のテストを追加する**

```ts
describe('Kimi K3 overview article', () => {
  it('publishes the approved metadata and structure', async () => {
    const { frontmatter, body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const metadata = parse(frontmatter) as Record<string, unknown>;
    const headings = [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);

    expect(metadata).toMatchObject({
      title: 'Kimi K3とは？2.8兆パラメータの新AIモデルを公式情報とベンチマークから解説',
      description:
        'Moonshot AIが発表したKimi K3とは何か。2.8兆パラメータ、100万トークンのコンテキスト、得意分野、料金を公式情報とArtificial Analysisの第三者評価をもとに解説します。',
      publishedAt: '2026-07-22',
      category: 'AI',
      tags: ['Kimi', 'Moonshot AI', '生成AI', 'AIモデル'],
      featured: true,
    });
    expect(metadata).not.toHaveProperty('heroImage');
    expect(metadata).not.toHaveProperty('ogImage');
    expect(headings).toEqual(expectedHeadings);
  });
```

- [ ] **Step 3: 出典、数値、画像点数、注意書きのテストを追加する**

同じ`describe`へ次のテストを加えて閉じる。

```ts
  it('separates official claims from independent measurements', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { links } = inspectMarkdown(body);

    for (const url of [
      'https://www.moonshot.ai/',
      'https://www.kimi.com/blog/kimi-k3',
      'https://www.kimi.com/help/getting-started/overview',
      'https://artificialanalysis.ai/models/kimi-k3',
    ]) {
      expect(links).toContain(url);
    }

    for (const fact of [
      '2026年7月16日',
      '2.8兆',
      '100万トークン',
      'Intelligence Index',
      '57',
      '37.3 tokens/s',
      '$3.00',
      '$15.00',
      '2026年7月22日時点',
      '7月27日',
      'フルウェイト',
    ]) {
      expect(body).toContain(fact);
    }

    expect(body).toContain('開発元による評価');
    expect(body).toContain('第三者評価');
    expect(body).toMatch(/単一の指標[^。]*(?:決まら|表さ)/);
    expect(body).not.toMatch(/(?:世界最強|圧倒的|革命的|ゲームチェンジャー)/);
  });

  it('uses exactly one attributed official image and no benchmark screenshot', async () => {
    const { body } = splitArticle(await readFile(articleUrl, 'utf8'));
    const { htmlImageCount, imageReferences, inlineImages } = inspectMarkdown(body);

    expect(inlineImages).toEqual([
      {
        alt: 'Kimi公式が公開したKimi K3の発表ビジュアル',
        url: '../../assets/blog/kimi-k3-official-hero.webp',
      },
    ]);
    expect(imageReferences).toEqual([]);
    expect(htmlImageCount).toBe(0);
    expect(inlineImages.length + imageReferences.length + htmlImageCount).toBe(1);
    expect(body).toMatch(
      /Kimi K3の公式発表ビジュアル[^\n]*出典[^\n]*\[Kimi K3公式発表\]\(https:\/\/www\.kimi\.com\/blog\/kimi-k3\)/,
    );
    expect(body).not.toMatch(/artificial-analysis[^\s)]*\.(?:png|jpe?g|webp|svg)/i);
  });
});
```

- [ ] **Step 4: 記事契約が失敗することを確認する**

Run:

```bash
npm test -- tests/unit/kimi-k3-article.test.ts
```

Expected: 画像テストだけがPASSし、記事テストは`src/content/blog/kimi-k3-overview.md`の`ENOENT`でFAILする。

### Task 3: Kimi K3入門記事を書く

**Files:**

- Create: `src/content/blog/kimi-k3-overview.md`
- Modify: `tests/unit/kimi-k3-article.test.ts`（事実に反しない範囲で正規表現だけを調整する場合）

- [ ] **Step 1: Frontmatterと導入を書く**

`src/content/blog/kimi-k3-overview.md`を作り、次のFrontmatterを使う。公式画像は本文中だけに置き、`heroImage`と`ogImage`は指定しない。

```yaml
---
title: Kimi K3とは？2.8兆パラメータの新AIモデルを公式情報とベンチマークから解説
description: Moonshot AIが発表したKimi K3とは何か。2.8兆パラメータ、100万トークンのコンテキスト、得意分野、料金を公式情報とArtificial Analysisの第三者評価をもとに解説します。
publishedAt: '2026-07-22'
category: AI
tags:
  - Kimi
  - Moonshot AI
  - 生成AI
  - AIモデル
featured: true
---
```

導入の最初の段落で、Kimi K3がMoonshot AIによって2026年7月16日に発表されたモデルであり、2.8兆パラメータ、100万トークン、画像入力を特徴とすることを答える。続く段落で、記事の情報は2026年7月22日時点であり、公式情報と第三者評価を分けると宣言する。

- [ ] **Step 2: 公式画像を1点だけ配置する**

導入直後へ次を置く。

```markdown
![Kimi公式が公開したKimi K3の発表ビジュアル](../../assets/blog/kimi-k3-official-hero.webp)

<!-- prettier-ignore -->
*Kimi K3の公式発表ビジュアル。出典：[Kimi K3公式発表](https://www.kimi.com/blog/kimi-k3)*
```

- [ ] **Step 3: 設計書どおりの7節を書く**

見出しはテストの`expectedHeadings`と完全に一致させる。本文は次の濃淡で約2,500〜3,000字にまとめる。

1. 「Kimi K3はMoonshot AIの最新モデル」では、発表日、開発元、Kimi製品群での位置づけを書く。
2. 「大規模な情報を扱うための設計が目立つ」を最も厚くし、2.8兆パラメータ、Mixture of Expertsで16/896 expertを有効化すること、Kimi Delta Attention、Attention Residuals、100万トークン、画像入力を平易に説明する。パラメータ数だけで性能は決まらないと補足する。
3. 「第三者評価では知能が高く、速度と料金には弱点がある」へ、設計書の4行の比較表を置く。2026年7月22日（公開前最終確認時点）の値として、Intelligence Index 57はArtificial Analysis独自の複合評価、37.3 tokens/sはKimi APIでの速度測定、キャッシュミス入力$3.00と出力$15.00は同ページが報告するKimi API価格として分けて記載する。速度と料金は、同価格帯の推論モデルにおける中央値79.0 tokens/sとの比較であることも示す。開発元の自己評価とは別であること、単一指標は実務能力のすべてを表さないことを書く。
4. 「長いコードや資料を扱う仕事が有力な用途になる」では、公式が挙げる長時間のコーディング、知識作業、推論を紹介し、大規模コード、長い資料、複数段階の調査は仕様から導いた筆者の整理だと示す。
5. 「料金と利用条件は使う場所によって異なる」では、Kimi.com、Kimi Work、Kimi Code、Kimi APIを紹介する。API料金はキャッシュヒット入力$0.30、通常入力$3.00、出力$15.00／100万トークンとする。会員プランの細かな料金表は転載しない。
6. 「『オープン』の現状には注意が必要」では、公式の`open 3T-class model`という表現と、7月22日時点でフルウェイト未公開、7月27日までに公開予定という事実を隣接させる。すでにローカル実行できるとは書かない。
7. 「高い評価と現在の制約をセットで見る」では、巨大なコンテキストと高い知能評価に加え、速度、料金、ウェイトの状態も判断材料になると再統合して締める。

- [ ] **Step 4: すべての事実へ出典を結び付ける**

本文中の該当段落へ、次のリンクを自然に配置する。末尾へURLだけを並べない。

```text
https://www.moonshot.ai/
https://www.kimi.com/blog/kimi-k3
https://www.kimi.com/help/getting-started/overview
https://artificialanalysis.ai/models/kimi-k3
```

- [ ] **Step 5: 記事テストを通す**

Run:

```bash
npm test -- tests/unit/kimi-k3-article.test.ts
```

Expected: 画像と記事の全テストがPASSする。テストが事実に反する場合だけテストを直し、本文をテストへ無理に合わせない。

- [ ] **Step 6: 記事と契約テストをコミットする**

```bash
git add src/content/blog/kimi-k3-overview.md tests/unit/kimi-k3-article.test.ts
git commit -m "docs: add Kimi K3 overview article"
```

### Task 4: 日本語と事実関係を仕上げる

**Files:**

- Modify: `src/content/blog/kimi-k3-overview.md`

- [ ] **Step 1: natural-japaneseで静的検査する**

`@natural-japanese`をクイックモードで使う。プロジェクトに導入済みのスクリプトを実行する。

```bash
uv run '/Users/hiroshiimaizumi/Documents/tech blog 2/.agents/skills/natural-japanese/scripts/lint.py' --json --genre tech src/content/blog/kimi-k3-overview.md
```

Expected: findingごとに「修正」または「文脈上残す」を判断できる。禁止語、翻訳調、同じ文型の反復は本文で解消する。

- [ ] **Step 2: AIらしい定型表現を目視で確認する**

`@stop-ai-slop-jp`を使い、主体のない評価、大げさな比喩、不要な「〜ではなく」、均一な節構成を確認する。技術用語や必要な留保まで機械的に削らない。

- [ ] **Step 3: 数値と公開状態を再照合する**

設計書の4出典を開き、本文が次を満たすか確認する。

- Kimi公式の主張とArtificial Analysisの測定を別の段落で扱っている。
- Artificial Analysisの数値を2026年7月22日時点と明示している。
- 公式の「open」という表現とウェイト未公開を同じ節で扱っている。
- 使っていない機能を実体験として書いていない。

- [ ] **Step 4: 修正後のテストを再実行する**

Run:

```bash
npm test -- tests/unit/kimi-k3-article.test.ts
```

Expected: 全テストがPASSする。

- [ ] **Step 5: レビュー修正をコミットする**

変更がある場合だけ実行する。

```bash
git add src/content/blog/kimi-k3-overview.md tests/unit/kimi-k3-article.test.ts
git commit -m "docs: refine Kimi K3 article wording"
```

### Task 5: サイト全体で検証する

**Files:**

- Modify: `src/content/blog/kimi-k3-overview.md`（整形または検証で問題が出た場合だけ）
- Modify: `tests/unit/kimi-k3-article.test.ts`（事実に反しないテスト修正が必要な場合だけ）

- [ ] **Step 1: 対象ファイルを整形する**

```bash
npx prettier --write src/content/blog/kimi-k3-overview.md tests/unit/kimi-k3-article.test.ts docs/superpowers/plans/2026-07-22-kimi-k3-overview-article.md
```

- [ ] **Step 2: 差分と画像点数を確認する**

```bash
git diff --check
git diff --stat origin/main...HEAD
```

Expected: 空白エラーがなく、記事、公式画像1点、記事テスト、設計・計画文書以外に意図しない変更がない。

- [ ] **Step 3: 型・コンテンツ・ユニットテストを確認する**

```bash
npm run check
npm test
```

Expected: Astro checkと全VitestがPASSする。

- [ ] **Step 4: 本番ビルドとE2Eを確認する**

```bash
npm run build
npm run test:e2e
```

Expected: ビルドが成功し、既存E2EがすべてPASSする。生成された`dist/blog/kimi-k3-overview/index.html`にタイトル、説明文、本文、公式画像が含まれる。

- [ ] **Step 5: 最終差分をコミットする**

整形または検証対応で変更がある場合だけ実行する。

```bash
git add src/content/blog/kimi-k3-overview.md tests/unit/kimi-k3-article.test.ts docs/superpowers/plans/2026-07-22-kimi-k3-overview-article.md
git commit -m "chore: verify Kimi K3 article"
```

- [ ] **Step 6: 完了状態を確認する**

```bash
git status --short
git log -5 --oneline
```

Expected: 今回の作業に関する未コミット変更がなく、画像契約、記事追加、必要に応じた文章調整のコミットが確認できる。ユーザー所有の`.agents/`と`skills-lock.json`が未追跡のまま残っていても、この作業では追加・削除しない。
