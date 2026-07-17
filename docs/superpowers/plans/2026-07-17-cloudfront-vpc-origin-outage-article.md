# CloudFront VPC Origins障害記事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 2026年7月16日のCloudFront VPC Origins障害をAWS公式情報から解説し、読み取り系と更新系に分けた回避設計を2枚のAWS構成図付きで公開可能な記事として追加する。

**Architecture:** 記事固有の事実・表現・図解契約をVitestとPlaywrightで先に固定し、Markdownを既存のAstro Content Collectionへ追加する。図解は編集可能なdraw.io原本と記事表示用SVGを対にし、Featured・最新記事・一覧・カテゴリー・タグの期待値だけを更新する。障害記録、AWS仕様、本記事の提案、筆者の立場を分けて書く。

**Tech Stack:** Astro 7、Markdown Content Collections、TypeScript、Vitest、Playwright、draw.io、AWS Architecture Icons、Prettier、Pagefind

---

## ファイル構成

- Create: src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md
  - Frontmatter、10個のH2、公式障害記録、VPC Origins解説、二層の回避設計、ランブック、2枚の図解を保持する。
- Create: docs/diagrams/cloudfront-vpc-origin-outage-path.drawio
  - 障害が起きたリクエスト経路の編集可能な原本を保持する。
- Create: docs/diagrams/cloudfront-vpc-origin-failover.drawio
  - Origin Group候補と手動切り替えを示す編集可能な原本を保持する。
- Create: src/assets/blog/cloudfront-vpc-origin-outage-path.svg
- Create: src/assets/blog/cloudfront-vpc-origin-failover.svg
  - 2枚の構成図を記事内で表示する。
- Create: tests/unit/cloudfront-vpc-origin-diagrams.test.ts
  - draw.io XMLとSVGの整形式、構造、寸法、ラベルを検証する。
- Create: tests/unit/cloudfront-vpc-origin-outage-article.test.ts
  - Frontmatter、見出し、一次情報、障害事実、回避策の制約、筆者の立場、画像・図注を検証する。
- Create: tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts
  - 記事HTMLのSEO、本文構造、画像、アクセシビリティ、390px表示を検証する。
- Modify: tests/e2e/home-content.spec.ts
  - 新記事をFeaturedと最新記事の先頭へ反映する。
- Modify: tests/e2e/hero-network.spec.ts
  - 点群ヒーローから新しいFeatured記事へ遷移する期待値へ変更する。
- Modify: tests/e2e/listings.spec.ts
  - 公開記事8件、Infrastructure 2件、AWSタグ2件と表示順を固定する。
- Modify: tests/e2e/visual.spec.ts-snapshots/home-desktop.png
- Modify: tests/e2e/visual.spec.ts-snapshots/home-tablet.png
- Modify: tests/e2e/visual.spec.ts-snapshots/home-mobile.png
  - Featuredと最新記事カード変更後の見た目を固定する。

既存のUIコンポーネント、CSS、Content Schema、デプロイ設定、分析基盤は変更しない。SVGが既存レイアウトで収まらない場合は範囲を広げず、ユーザーへ相談する。

### Task 1: 図解の失敗する契約を追加する

**Files:**
- Create: tests/unit/cloudfront-vpc-origin-diagrams.test.ts

- [ ] **Step 1: Write the failing diagram contract**

Create tests/unit/cloudfront-vpc-origin-diagrams.test.ts:

~~~ts
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const projectFile = (path: string) => fileURLToPath(new URL('../../' + path, import.meta.url));

const diagrams = [
  {
    drawio: 'docs/diagrams/cloudfront-vpc-origin-outage-path.drawio',
    svg: 'src/assets/blog/cloudfront-vpc-origin-outage-path.svg',
    labels: [
      'CloudFront VPC Origins障害のリクエスト経路',
      'Viewer',
      'Amazon CloudFront',
      'AWS管理のVPC Origin接続レイヤー',
      'サービス管理ENI',
      'Private ALB',
      'アプリケーション',
      '内部制約',
      'ルーティング設定の読み込み失敗',
    ],
  },
  {
    drawio: 'docs/diagrams/cloudfront-vpc-origin-failover.drawio',
    svg: 'src/assets/blog/cloudfront-vpc-origin-failover.svg',
    labels: [
      'VPC Origins障害に備える二層の切り替え',
      '読み取り系',
      'GET / HEAD / OPTIONS',
      'Origin Group',
      'Primary: VPC Origin',
      'Secondary: Public ALB',
      '更新系API',
      'POST / PUT / PATCH / DELETE',
      '監視・切り分け',
      '承認',
      'CloudFront設定を手動変更',
      'CloudFront Prefix List',
      'Custom Header',
    ],
  },
] as const;

function rootAttribute(source: string, root: 'svg' | 'mxfile', name: string): string | undefined {
  const attributes = source.match(new RegExp('<' + root + '\\b([^>]*)>'))?.[1];
  return attributes?.match(new RegExp('\\b' + name + '="([^"]+)"'))?.[1];
}

describe('CloudFront VPC Origins article diagrams', () => {
  it.each(diagrams)('$drawio is editable, well-formed, and uses AWS4 shapes', async ({ drawio, labels }) => {
    const path = projectFile(drawio);
    await expect(execFileAsync('/usr/bin/xmllint', ['--noout', path])).resolves.toBeDefined();
    const source = await readFile(path, 'utf8');

    expect(rootAttribute(source, 'mxfile', 'host')).toBeDefined();
    expect(source).toContain('<diagram');
    expect(source).toContain('<mxGraphModel');
    expect(source).toMatch(/<mxCell\s+id="0"\s*\/>/);
    expect(source).toMatch(/<mxCell\s+id="1"\s+parent="0"\s*\/>/);
    expect(source).toContain('mxgraph.aws4.');
    expect(source).not.toMatch(/<diagram[^>]*>\s*[A-Za-z0-9+/=]{100,}\s*<\/diagram>/);

    const ids = [...source.matchAll(/<mxCell\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of source.matchAll(/\b(?:source|target)="([^"]+)"/g)) expect(ids).toContain(match[1]);
    for (const label of labels) expect(source).toContain(label.replaceAll('&', '&amp;'));
  });

  it.each(diagrams)('$svg is a safe, well-formed 1200x675 asset', async ({ svg, labels }) => {
    const path = projectFile(svg);
    await expect(execFileAsync('/usr/bin/xmllint', ['--noout', path])).resolves.toBeDefined();
    const source = await readFile(path, 'utf8');

    expect(rootAttribute(source, 'svg', 'width')).toBe('1200');
    expect(rootAttribute(source, 'svg', 'height')).toBe('675');
    expect(rootAttribute(source, 'svg', 'viewBox')).toBe('0 0 1200 675');
    for (const label of labels) expect(source).toContain(label);
    expect(source).not.toMatch(/<script\b|\bon\w+=/i);
  });
});
~~~

- [ ] **Step 2: Run the contract to verify it fails**

Run:

~~~bash
npm test -- tests/unit/cloudfront-vpc-origin-diagrams.test.ts
~~~

Expected: FAIL with ENOENT for the first missing draw.io file.

### Task 2: 2枚のAWS構成図を作成する

**Files:**
- Create: docs/diagrams/cloudfront-vpc-origin-outage-path.drawio
- Create: docs/diagrams/cloudfront-vpc-origin-failover.drawio
- Create: src/assets/blog/cloudfront-vpc-origin-outage-path.svg
- Create: src/assets/blog/cloudfront-vpc-origin-failover.svg
- Test: tests/unit/cloudfront-vpc-origin-diagrams.test.ts

- [ ] **Step 1: Check the export prerequisite without installing anything**

Run:

~~~bash
if command -v drawio >/dev/null 2>&1; then
  command -v drawio
elif [ -x /Applications/draw.io.app/Contents/MacOS/draw.io ]; then
  printf '%s\n' /Applications/draw.io.app/Contents/MacOS/draw.io
else
  printf '%s\n' 'draw.io CLI is not installed'
  exit 1
fi
~~~

Expected in the current environment: exits 1 with draw.io CLI is not installed.

Pause and request explicit approval before installing a desktop application. If approved, run brew install --cask drawio and verify the CLI exists. Do not silently replace the editable-source requirement with a screenshot or raster image.

- [ ] **Step 2: Generate the editable sources with the AWS diagram skill**

Use @aws-architecture-diagram in brainstorming mode. Treat the approved design spec as the answers to the skill's architecture questions; do not pause to ask the user to reconfirm the purpose, services, traffic paths, or security controls. Read the skill's required xml-rules.md, style-guide.md, xml-templates-structure.md, layout-guidelines.md, and aws4-shapes-services.md before writing XML. The installed skill does not contain its optional scripts directory, so do not call missing fixer or preview helpers; use xmllint and the repository contract.

Both files must be uncompressed mxfile/diagram/mxGraphModel XML with:

- a 1200x675 page and full-page background shape;
- official mxgraph.aws4 icons for CloudFront, ENI, Elastic Load Balancing, and application compute where applicable;
- the exact Japanese labels from Task 1;
- Helvetica text, descriptive unique IDs, orthogonal labeled edges, and no invented internal AWS service;
- primary labels large enough to remain legible around 350px display width;
- visual distinctions using line style and labels, not color alone.

The outage-path diagram shows Viewer → CloudFront → abstract AWS-managed VPC Origin connection layer → service-managed ENI → Private ALB → application. Put internal constraint and routing-configuration-load failure annotations only in the AWS-managed layer.

The failover diagram uses two lanes. The read lane shows GET/HEAD/OPTIONS → Origin Group → Primary VPC Origin, then configured failover to Secondary Public ALB. The write lane shows POST/PUT/PATCH/DELETE → monitoring and triage → approval → manual CloudFront distribution change → Public ALB. Show CloudFront Prefix List and Custom Header next to the Public ALB.

- [ ] **Step 3: Validate the draw.io XML**

Run:

~~~bash
/usr/bin/xmllint --noout \
  docs/diagrams/cloudfront-vpc-origin-outage-path.drawio \
  docs/diagrams/cloudfront-vpc-origin-failover.drawio
npm test -- tests/unit/cloudfront-vpc-origin-diagrams.test.ts
~~~

Expected: xmllint passes; Vitest fails only because SVG exports are missing.

- [ ] **Step 4: Export editable SVGs**

Run:

~~~bash
DRAWIO="$(command -v drawio 2>/dev/null || true)"
if [ -z "$DRAWIO" ] && [ -x /Applications/draw.io.app/Contents/MacOS/draw.io ]; then
  DRAWIO=/Applications/draw.io.app/Contents/MacOS/draw.io
fi
if [ -z "$DRAWIO" ]; then
  printf '%s\n' 'draw.io CLI is not installed'
  exit 1
fi
"$DRAWIO" -x -f svg -e -b 0 --width 1200 \
  -o src/assets/blog/cloudfront-vpc-origin-outage-path.svg \
  docs/diagrams/cloudfront-vpc-origin-outage-path.drawio
"$DRAWIO" -x -f svg -e -b 0 --width 1200 \
  -o src/assets/blog/cloudfront-vpc-origin-failover.svg \
  docs/diagrams/cloudfront-vpc-origin-failover.drawio
~~~

Expected: two SVGs with embedded draw.io data. If draw.io adds unit suffixes or another root viewBox, use apply_patch only on each root SVG tag so it reads width="1200" height="675" viewBox="0 0 1200 675". Do not stretch the artwork or remove embedded diagram data.

- [ ] **Step 5: Validate and inspect all four files**

Run:

~~~bash
/usr/bin/xmllint --noout \
  docs/diagrams/cloudfront-vpc-origin-outage-path.drawio \
  docs/diagrams/cloudfront-vpc-origin-failover.drawio \
  src/assets/blog/cloudfront-vpc-origin-outage-path.svg \
  src/assets/blog/cloudfront-vpc-origin-failover.svg
npm test -- tests/unit/cloudfront-vpc-origin-diagrams.test.ts
~~~

Expected: all diagram tests pass. Inspect both SVGs with the image viewer for clipping, overlap, fabricated AWS internals, color-only meaning, and unreadable labels.

- [ ] **Step 6: Commit**

~~~bash
git add docs/diagrams/cloudfront-vpc-origin-outage-path.drawio \
  docs/diagrams/cloudfront-vpc-origin-failover.drawio \
  src/assets/blog/cloudfront-vpc-origin-outage-path.svg \
  src/assets/blog/cloudfront-vpc-origin-failover.svg \
  tests/unit/cloudfront-vpc-origin-diagrams.test.ts
git commit -m "feat: add CloudFront VPC origin diagrams"
~~~

### Task 3: 記事の失敗する内容・表示契約を追加する

**Files:**
- Create: tests/unit/cloudfront-vpc-origin-outage-article.test.ts
- Create: tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts

- [ ] **Step 1: Write the unit content contract**

Create tests/unit/cloudfront-vpc-origin-outage-article.test.ts using the same splitArticle and remark AST helpers as tests/unit/http-query-article.test.ts. Define these exact constants:

~~~ts
const articleUrl = new URL('../../src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md', import.meta.url);
// Fact-checked against AWS public event ARN on 2026-07-17 JST.
const eventArn =
  'arn:aws:health:global::event/CLOUDFRONT/AWS_CLOUDFRONT_OPERATIONAL_ISSUE/AWS_CLOUDFRONT_OPERATIONAL_ISSUE_EDF4C_83808542A4E';

const expectedHeadings = [
  '2026年7月16日のCloudFront障害で何が起きたか',
  '影響を受けた構成・受けなかった構成',
  'そもそもCloudFrontのVPCオリジンとは',
  '障害の原因をリクエスト経路から理解する',
  'AWSが案内した暫定回避策',
  '読み取り系リクエストをOrigin Groupで備える',
  'POST・PUTを含むAPIは手動切り替えを準備する',
  '障害発生時の確認・切り替え手順',
  '復旧後に元へ戻すときの確認事項',
  'VPCオリジンをやめるべきか',
] as const;
~~~

Add four tests:

1. Metadata and headings:
   - exact title and description from the design spec;
   - publishedAt 2026-07-17, Infrastructure, AWS/CloudFront/VPC/障害対応, featured true;
   - no heroImage or ogImage;
   - exact expectedHeadings order.

2. Primary sources:
   - body contains eventArn;
   - links include AWS Health status and VPC Origins/Origin Failover docs;
   - every external URL is HTTPS and hostname is only health.aws.amazon.com or docs.aws.amazon.com.

3. Facts and boundaries:
   - require 2026年7月16日16:45, 20:18, 3時間33分, 5xx, VPC Origins, 他のオリジン種別, 内部制約, 更新済みの設定データを正しく読み込めなくなった, 3:52 AM PDT, 4:18 AM PDT, 一時的に別のオリジン種別へ変更;
   - require that the managed environment did not use CloudFront and had no direct impact;
   - reject CloudFront全体が停止, 全リクエストが失敗, Origin Groupで今回の障害を回避できた, Public ALBへ切り替えて復旧した, VPC Origins障害を経験した.

4. Mitigation and figures:
   - require GET, HEAD, OPTIONS, Cached HTTP methods, connection failure with 503, timeout with 504, retrying primary on the next request, POST/PUT/PATCH/DELETE, manual change, AWS-managed prefix list, custom header, 403, Deploying, double execution, data consistency, updateRequestOrigin(), and wording that the Origin Group proposal is unproven for this event;
   - assert exactly these two image objects and both captions:

~~~ts
expect(images).toEqual([
  {
    alt: 'CloudFrontからVPCオリジンへ接続する経路と2026年7月16日の障害箇所',
    url: '../../assets/blog/cloudfront-vpc-origin-outage-path.svg',
  },
  {
    alt: '読み取り系の自動フェイルオーバー候補と更新系APIの手動切り替え構成',
    url: '../../assets/blog/cloudfront-vpc-origin-failover.svg',
  },
]);
expect(body).toContain('図1：CloudFrontからVPCオリジンへ到達する概念的な経路');
expect(body).toContain('図2：読み取り系と更新系を分けた二層の切り替え');
~~~

- [ ] **Step 2: Write the browser contract**

Create tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts from the pattern in tests/e2e/http-query-article.spec.ts with these constants:

~~~ts
const articlePath = '/blog/aws-cloudfront-vpc-origin-outage-2026-07-16/';
const articleTitle = '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理';
const articleDescription =
  '2026年7月16日に発生したAWS CloudFrontのVPC Origins障害について、影響範囲と原因、VPCオリジンの仕組み、読み取り系と更新系に分けた回避策を公式情報から整理します。';
~~~

First test must assert:

- page title, description, canonical ending in the article path;
- OG and Twitter image pathname /og-default.png;
- H1, category Infrastructure, tags, public date 2026年7月17日;
- exact ten H2 values from the unit contract;
- exactly two images with the two approved alt texts;
- the two exact captions;
- no serious or critical Axe violations.

Second test sets 390x844, asserts document and article body have no horizontal overflow, both images are visible, and each rendered width is no more than the body client width.

- [ ] **Step 3: Verify the contracts fail for the missing article**

~~~bash
npm test -- tests/unit/cloudfront-vpc-origin-outage-article.test.ts
npx playwright test tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts
~~~

Expected: Vitest fails with ENOENT; Playwright fails because the article route is 404.

### Task 4: 記事本文とサイト内一覧を実装する

**Files:**
- Create: src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md
- Modify: tests/e2e/home-content.spec.ts
- Modify: tests/e2e/hero-network.spec.ts
- Modify: tests/e2e/listings.spec.ts
- Test: tests/unit/cloudfront-vpc-origin-outage-article.test.ts
- Test: tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts

- [ ] **Step 1: Re-check the official incident record**

Re-open AWS Health status and currentevents. The public event response begins with a UTF-16BE BOM; decode it and select the exact Event ARN with:

~~~bash
EVENT_ARN='arn:aws:health:global::event/CLOUDFRONT/AWS_CLOUDFRONT_OPERATIONAL_ISSUE/AWS_CLOUDFRONT_OPERATIONAL_ISSUE_EDF4C_83808542A4E'
curl -fsSL https://health.aws.amazon.com/public/currentevents \
  | iconv -f UTF-16BE -t UTF-8 \
  | perl -CS -pe 's/^\x{FEFF}//' \
  | jq --arg arn "$EVENT_ARN" '.[] | select(.arn == $arn)'
~~~

Expected: exactly one CloudFront event object. Confirm its final period, JST conversion, duration, affected VPC Origins connectivity, unaffected other origin types, final root-cause wording, 3:52/4:18 mitigation times, and AWS's temporary origin-type workaround.

If the record differs from the approved spec, stop and report it before changing tests or prose.

- [ ] **Step 2: Add the exact Frontmatter**

~~~yaml
---
title: 2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理
description: 2026年7月16日に発生したAWS CloudFrontのVPC Origins障害について、影響範囲と原因、VPCオリジンの仕組み、読み取り系と更新系に分けた回避策を公式情報から整理します。
publishedAt: '2026-07-17'
category: Infrastructure
tags:
  - AWS
  - CloudFront
  - VPC
  - 障害対応
featured: true
---
~~~

Do not add heroImage or ogImage.

- [ ] **Step 3: Write the introduction and ten approved sections**

Follow docs/superpowers/specs/2026-07-17-cloudfront-vpc-origin-outage-article-design.md exactly:

- Open with the official symptom and narrow impact boundary. State that the author's managed environment did not use CloudFront, had no direct impact, and was checked after the AWS incident.
- Put the Event ARN in a compact source note, not the title or lead.
- Translate the final AWS cause accurately; do not reduce it to only 容量不足 or 設定ミス.
- Explain service-managed ENI and why an IGW is required but not used for the VPC-origin path.
- Describe Figure 1 as conceptual and AWS-managed; do not invent fleet names, counts, or topology.
- Separate AWS's actual incident workaround from this article's pre-provisioned proposal.
- State that Origin Group is a pre-tested candidate, not proven for this exact incident.
- Explain connection failure requires configured 503, response timeout requires 504, and each new eligible request tries primary again.
- Keep automatic failover to GET, HEAD, and cached OPTIONS. Use a human-approved manual distribution change for POST, PUT, PATCH, and DELETE.
- Explain that CloudFront Functions updateRequestOrigin() cannot update VPC origins.
- Require both the CloudFront AWS-managed prefix list and a secret custom header/listener rule returning fixed 403 for the standby Public ALB.
- Include an ordered incident runbook and separate recovery checklist with 5xxErrorRate, ALB health, AWS Health, Deploying, double execution, retry, authentication, session, and data consistency.
- End with a trade-off decision, not a blanket recommendation to abandon VPC Origins.

Use only Section 8 links from the design spec. Clearly mark operational recommendations with 本記事では or 備えるなら.

- [ ] **Step 4: Insert the two exact figures**

~~~markdown
![CloudFrontからVPCオリジンへ接続する経路と2026年7月16日の障害箇所](../../assets/blog/cloudfront-vpc-origin-outage-path.svg)

*図1：CloudFrontからVPCオリジンへ到達する概念的な経路*
~~~

~~~markdown
![読み取り系の自動フェイルオーバー候補と更新系APIの手動切り替え構成](../../assets/blog/cloudfront-vpc-origin-failover.svg)

*図2：読み取り系と更新系を分けた二層の切り替え*
~~~

Place Figure 1 in the cause section and Figure 2 at the transition into the two mitigation sections.

- [ ] **Step 5: Update homepage and hero-network expectations**

In tests/e2e/home-content.spec.ts add:

~~~ts
const cloudFrontArticleTitle = '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理';

const latestArticleTitles = [
  cloudFrontArticleTitle,
  httpQueryArticleTitle,
  'ChatGPT Sitesの使い方｜実際にWebサイトを作って限定公開するまで',
  pluginsArticleTitle,
] as const;

const featuredArticleTitle = cloudFrontArticleTitle;
~~~

Update both Featured href assertions to /blog/aws-cloudfront-vpc-origin-outage-2026-07-16/. Keep custom-image failure checks scoped to pluginsArticleTitle.

In tests/e2e/hero-network.spec.ts change the Featured navigation expectation to:

~~~ts
await expect(page).toHaveURL(/\/blog\/aws-cloudfront-vpc-origin-outage-2026-07-16\/$/);
~~~

- [ ] **Step 6: Update listings, category, and tag expectations**

In tests/e2e/listings.spec.ts:

- prepend the new title to articleTitles;
- change 7件の記事 and card count 7 to 8;
- keep Cloud category 0件;
- assert Infrastructure is 2件 and /categories/infrastructure/ shows the new article then Terraform;
- assert AWS tag is 2件 and /tags/aws/ shows the same two titles in descending date order.

Use exact title assertions:

~~~ts
await expect(page.locator('main [data-article-card]').getByRole('heading')).toHaveText([
  '2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理',
  'Terraformで手動変更されたリソースを追従する方法',
]);
~~~

- [ ] **Step 7: Format and run focused tests**

~~~bash
npx prettier --write src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md \
  tests/unit/cloudfront-vpc-origin-outage-article.test.ts \
  tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/hero-network.spec.ts \
  tests/e2e/listings.spec.ts
npm test -- \
  tests/unit/cloudfront-vpc-origin-diagrams.test.ts \
  tests/unit/cloudfront-vpc-origin-outage-article.test.ts
npx playwright test \
  tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/hero-network.spec.ts \
  tests/e2e/listings.spec.ts
~~~

Expected: all focused tests pass. No component, CSS, schema, deployment, or analytics change is needed.

- [ ] **Step 8: Commit**

~~~bash
git add src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md \
  tests/unit/cloudfront-vpc-origin-outage-article.test.ts \
  tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/hero-network.spec.ts \
  tests/e2e/listings.spec.ts
git commit -m "feat: add CloudFront VPC origins outage guide"
~~~

### Task 5: ホームのビジュアルゴールデンを更新する

**Files:**
- Modify: tests/e2e/visual.spec.ts-snapshots/home-desktop.png
- Modify: tests/e2e/visual.spec.ts-snapshots/home-tablet.png
- Modify: tests/e2e/visual.spec.ts-snapshots/home-mobile.png

- [ ] **Step 1: Run comparisons before updating**

~~~bash
npx playwright test tests/e2e/visual.spec.ts -g 'ホームを.*で表示できる'
~~~

Expected: comparisons normally fail due to new Featured/latest content; network coverage and overflow still pass. A tolerance-level pass does not remove the need to regenerate and inspect baselines.

- [ ] **Step 2: Regenerate only home snapshots**

~~~bash
npx playwright test tests/e2e/visual.spec.ts -g 'ホームを.*で表示できる' --update-snapshots
~~~

- [ ] **Step 3: Inspect all snapshots**

Use the image viewer on all three PNGs. Confirm the CloudFront title is readable, the new Infrastructure card is first, the 390x844 capture contains the compact Featured card, and the point network/card grid remain intact. Do not raise visual tolerances.

- [ ] **Step 4: Run complete visual tests and commit**

~~~bash
npx playwright test tests/e2e/visual.spec.ts
git add tests/e2e/visual.spec.ts-snapshots/home-desktop.png \
  tests/e2e/visual.spec.ts-snapshots/home-tablet.png \
  tests/e2e/visual.spec.ts-snapshots/home-mobile.png
git commit -m "test: update home goldens for CloudFront article"
~~~

Expected: all visual, responsive, overflow, and reduced-motion tests pass before commit.

### Task 6: 日本語と技術内容を最小限レビューする

**Files:**
- Modify: src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md

- [ ] **Step 1: Review with natural-japanese**

Use @natural-japanese in technical-article mode. Fix unclear subjects, overloaded sentences, unexplained terms, and unnatural transitions. Preserve official times, final causal chain, method restrictions, source URLs, image syntax, and exact H2 order.

- [ ] **Step 2: Review with stop-ai-slop-jp**

Use @stop-ai-slop-jp. Remove repetitive conclusions, inflated lessons, uniform openings, vague importance statements, and unsupported experience. Keep the real author position: no CloudFront in the managed environment, no direct impact, environment checked after the incident.

- [ ] **Step 3: Re-run focused contracts**

~~~bash
npx prettier --write src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md
npm test -- \
  tests/unit/cloudfront-vpc-origin-diagrams.test.ts \
  tests/unit/cloudfront-vpc-origin-outage-article.test.ts
npx playwright test \
  tests/e2e/cloudfront-vpc-origin-outage-article.spec.ts \
  tests/e2e/home-content.spec.ts \
  tests/e2e/hero-network.spec.ts \
  tests/e2e/listings.spec.ts
~~~

Expected: all contracts pass without weakening assertions.

- [ ] **Step 4: Commit only material editorial changes**

~~~bash
git add src/content/blog/aws-cloudfront-vpc-origin-outage-2026-07-16.md
git commit -m "docs: refine CloudFront outage guide wording"
~~~

Skip this commit if reviews produce no material change.

### Task 7: 全体検証と引き渡しを行う

**Files:**
- Verify all changed files; create no new implementation files here.

- [ ] **Step 1: Check scope and whitespace**

~~~bash
git diff --check origin/main...HEAD
git status --short
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
~~~

Expected: only the approved spec/plan, article, two draw.io sources, two SVGs, article/diagram tests, home/listing expectations, and three snapshots appear.

- [ ] **Step 2: Run the same verification as CI**

~~~bash
NODE24_BIN=/Users/hiroshiimaizumi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin
PATH="$NODE24_BIN:$PATH"
hash -r
node --version
SITE_URL=https://example.invalid npm run verify
~~~

Expected: node reports v24.14.0; Prettier, Astro check, Vitest, build, sitemap, RSS, Pagefind, and all Playwright tests pass. The Node 24 runtime is already bundled with Codex, so no runtime installation or additional approval is needed. If that exact executable no longer exists, stop and report the missing bundled runtime instead of running final verification on Node 25 or installing another version without approval.

- [ ] **Step 3: Review the final article and diff**

Preview /blog/aws-cloudfront-vpc-origin-outage-2026-07-16/ at desktop and 390px. Confirm both diagrams load, links resolve, captions are unique, default OG metadata is used, and no statement implies direct impact or proven Origin Group mitigation.

- [ ] **Step 4: Hand off for publication approval**

Report branch, commits, tests, fact-check date, and any draw.io installation. Do not merge, deploy, or publish without separate user approval.
