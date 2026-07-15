# インタラクティブヒーローネットワーク Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** トップページのヒーローへ、3形状を循環しデスクトップのカーソルに反応する点と線のCanvas表現を追加し、注目記事をコンパクトな導線へ置き換える。

**Architecture:** 静的なサイト紹介と記事リンクはAstroコンポーネントに残し、Canvasの座標計算と状態遷移はDOMに依存しない純粋関数へ分離する。ブラウザ側コントローラーは`IntersectionObserver`、`visibilitychange`、`matchMedia`を集約し、描画の開始・停止・静止画表示だけを管理する。

**Tech Stack:** Astro 7、TypeScript 5.9、Canvas 2D、Vitest、Playwright。新しいnpm依存は追加しない。

---

参照仕様: `docs/superpowers/specs/2026-07-15-interactive-hero-network-design.md`

## 実装上の固定事項

- 見出し`テックログ`、タグライン`つくる、動かす、改善する。`、説明文、技術一覧は変更しない。
- 記事frontmatterの`heroImage`と`featuredCode`は削除しない。最新記事カードと既存記事の互換性を維持し、ヒーローでは表示しない。
- 粒子の初期値には`Math.random()`を使わない。粒子インデックスから同じ座標を再生成し、visual goldenを安定させる。
- Canvasは装飾に限定し、リンク、フォーカス、ポインターイベントを持たせない。
- `.agents/`と`skills-lock.json`は今回の変更対象に含めない。

## Task 1: 粒子計算と実行条件を純粋関数として固定する

**Files:**

- Create: `src/scripts/hero-network.ts`
- Create: `tests/unit/hero-network.test.ts`

- [ ] **Step 1: 粒子数、解像度、形状座標、補間、反発、実行条件の失敗テストを書く**

```ts
import { describe, expect, it } from 'vitest';

import {
  advanceActiveElapsed,
  animationMode,
  cursorRepulsion,
  interpolatePosition,
  particleCountForWidth,
  pixelRatioForWidth,
  positionForShape,
} from '../../src/scripts/hero-network';

describe('hero network geometry', () => {
  it('uses 72 particles on desktop and 36 on the responsive layout', () => {
    expect(particleCountForWidth(1440)).toBe(72);
    expect(particleCountForWidth(1023)).toBe(36);
  });

  it('caps the backing-store scale by viewport class', () => {
    expect(pixelRatioForWidth(1440, 3)).toBe(2);
    expect(pixelRatioForWidth(390, 3)).toBe(1.5);
  });

  it.each(['radial', 'wave', 'clusters'] as const)('%s returns normalized finite coordinates', (shape) => {
    const point = positionForShape(shape, 12, 72, 0.4);
    expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(1);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(1);
  });

  it('interpolates without overshooting either endpoint', () => {
    expect(interpolatePosition({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('repels only points inside 150px and pushes away from the cursor', () => {
    expect(cursorRepulsion({ x: 301, y: 0 }, { x: 0, y: 0 }, 150)).toEqual({ x: 0, y: 0 });
    const force = cursorRepulsion({ x: 50, y: 0 }, { x: 0, y: 0 }, 150);
    expect(force.x).toBeGreaterThan(0);
    expect(force.y).toBe(0);
  });
});

describe('hero network lifecycle', () => {
  it('runs only while visible, intersecting, and motion is allowed', () => {
    expect(animationMode({ intersecting: true, documentVisible: true, reducedMotion: false })).toBe('running');
    expect(animationMode({ intersecting: false, documentVisible: true, reducedMotion: false })).toBe('paused');
    expect(animationMode({ intersecting: true, documentVisible: false, reducedMotion: false })).toBe('paused');
    expect(animationMode({ intersecting: true, documentVisible: true, reducedMotion: true })).toBe('static');
  });

  it('does not advance the shape clock while paused', () => {
    expect(advanceActiveElapsed(4_800, 30_000, 'paused')).toBe(4_800);
    expect(advanceActiveElapsed(4_800, 16, 'running')).toBe(4_816);
  });
});
```

- [ ] **Step 2: 単体テストを実行し、モジュール未作成で失敗することを確認する**

Run: `npx vitest run tests/unit/hero-network.test.ts`

Expected: `Failed to load url ../../src/scripts/hero-network`でFAIL。

- [ ] **Step 3: 型、定数、決定的な形状計算、補間、反発、状態判定を実装する**

公開する契約は次に固定する。

```ts
export type ShapeMode = 'radial' | 'wave' | 'clusters';
export type AnimationMode = 'running' | 'paused' | 'static';
export interface Point { x: number; y: number }

export const MOBILE_BREAKPOINT_PX = 1023.84;
export const SHAPE_DURATION_MS = 5_000;
export const POINTER_RANGE_PX = 150;

export function particleCountForWidth(width: number): number;
export function pixelRatioForWidth(width: number, devicePixelRatio: number): number;
export function positionForShape(shape: ShapeMode, index: number, count: number, time: number): Point;
export function interpolatePosition(from: Point, to: Point, progress: number): Point;
export function cursorRepulsion(point: Point, pointer: Point, range?: number): Point;
export function advanceActiveElapsed(elapsed: number, delta: number, mode: AnimationMode): number;
export function animationMode(input: {
  intersecting: boolean;
  documentVisible: boolean;
  reducedMotion: boolean;
}): AnimationMode;
```

`positionForShape`はインデックスと固定saltから0〜1の値を作る小さなハッシュ関数を内部利用する。`radial`は中心から放射、`wave`は横方向の正弦波、`clusters`は3中心へ分配する。座標は5〜95%の範囲へ収める。

- [ ] **Step 4: 単体テストを再実行する**

Run: `npx vitest run tests/unit/hero-network.test.ts`

Expected: 全テストPASS。

- [ ] **Step 5: この単位をコミットする**

```sh
git add src/scripts/hero-network.ts tests/unit/hero-network.test.ts
git commit -m "feat: add deterministic hero network geometry"
```

## Task 2: Canvasコンポーネントと停止可能な描画コントローラーを作る

**Files:**

- Create: `src/components/home/InteractiveHeroNetwork.astro`
- Modify: `src/components/home/Hero.astro`
- Modify: `src/scripts/hero-network.ts`
- Create: `tests/e2e/hero-network.spec.ts`

- [ ] **Step 1: 静的フォールバックとCanvasのDOM契約をE2Eテストに書く**

```ts
import { expect, test } from '@playwright/test';

test('network remains decorative and exposes its runtime state', async ({ page }) => {
  await page.goto('/');
  const network = page.locator('[data-hero-network]');
  await expect(network).toBeVisible();
  await expect(network.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
  await expect(network.locator('[data-network-fallback]')).toBeAttached();
  await expect(network).toHaveAttribute('data-network-state', 'running');
  await expect(network.locator('canvas')).toHaveCSS('pointer-events', 'none');
});

test('network pauses offscreen and becomes a static frame for reduced motion', async ({ page }) => {
  await page.goto('/');
  const network = page.locator('[data-hero-network]');
  await expect(network).toHaveAttribute('data-network-state', 'running');
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
  await expect(network).toHaveAttribute('data-network-state', 'paused');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(network).toHaveAttribute('data-network-state', 'static');
});
```

- [ ] **Step 2: 対象テストを実行し、要素未作成で失敗することを確認する**

Run: `npx playwright test tests/e2e/hero-network.spec.ts`

Expected: `[data-hero-network]`が見つからずFAIL。

- [ ] **Step 3: JavaScriptなしでも見える装飾をAstroで出力する**

`InteractiveHeroNetwork.astro`は次の骨格にする。

```astro
<div class="hero-network" data-hero-network data-network-state="fallback" aria-hidden="true">
  <div class="network-fallback" data-network-fallback></div>
  <canvas aria-hidden="true"></canvas>
  <div class="pointer-ring" data-pointer-ring></div>
</div>

<script>
  import { initHeroNetworks } from '@/scripts/hero-network';

  initHeroNetworks();
</script>
```

`canvas`とリングは`pointer-events: none`にする。ラッパーに`aspect-ratio`と`min-block-size`を設定し、初期化前後でヒーローの高さを変えない。フォールバックには既存アクセント色の放射グラデーションと静的な点をCSSで持たせる。

このTaskではE2Eから到達できるよう、`Hero.astro`へコンポーネントをimportし、`.intro`と現在の`FeaturedArticle`の間に配置する。最終的な重なりとレスポンシブ配置はTask 3とTask 4で整える。

- [ ] **Step 4: 初期化、描画、停止、破棄を一つのコントローラーへ実装する**

`src/scripts/hero-network.ts`へ次の公開関数を追加する。

```ts
export function initHeroNetworks(root: ParentNode = document): void;
```

各ネットワークでは以下を行う。

1. `ResizeObserver`で表示サイズと上限付きDPRを更新する。
2. 5秒単位で`radial → wave → clusters`を循環し、切り替え区間をsmoothstepで補間する。
3. 各粒子から距離の近い最大3点だけへ線を描く。
4. `(hover: hover) and (pointer: fine)`のときだけラッパーの`pointermove`を読み、150px以内へ反発を加える。イベントはpreventDefaultしない。
5. `IntersectionObserver`、`document.visibilityState`、`matchMedia('(prefers-reduced-motion: reduce)')`を`animationMode`へ渡す。
6. 形状の時計にはページ読み込みからの時刻ではなく、`activeElapsedMs`を使う。`running`のフレーム間だけdeltaを加算し、`paused`へ入ると`lastFrameTime`を破棄する。再開後の最初のフレームは基準時刻の保存だけを行い、停止中の時間を加算しない。
7. `running`だけで`requestAnimationFrame`を継続し、`paused`では予約を解除する。`static`では放射形状を1回だけ描く。
8. `pointermove`でリングをカーソル位置へ移して表示し、`pointerleave`とfine pointer無効時にリングと反発位置を解除する。
9. 状態変更時に`data-network-state`を`running`、`paused`、`static`へ更新する。
10. Astroの`astro:before-swap`でobserver、listener、animation frameを破棄し、二重初期化を防ぐ。

- [ ] **Step 5: 単体テストとE2Eテストを実行する**

Run: `npx vitest run tests/unit/hero-network.test.ts && npx playwright test tests/e2e/hero-network.spec.ts`

Expected: 両方PASS。Playwrightのconsoleに未処理例外なし。

- [ ] **Step 6: この単位をコミットする**

```sh
git add src/components/home/Hero.astro src/components/home/InteractiveHeroNetwork.astro src/scripts/hero-network.ts tests/e2e/hero-network.spec.ts
git commit -m "feat: add pausable canvas hero network"
```

## Task 3: ヒーローをネットワーク中心の配置へ変更する

**Files:**

- Modify: `src/components/home/Hero.astro`
- Modify: `src/components/blog/FeaturedArticle.astro`
- Modify: `src/pages/index.astro`
- Modify: `tests/e2e/home-content.spec.ts`

- [ ] **Step 1: 新しい静的コンテンツ契約へE2Eテストを更新する**

最初のホームテストは、既存文言を維持しながら次を確認する。

```ts
const featured = hero.getByRole('article', { name: '注目記事' });
await expect(featured.getByText('FEATURED', { exact: true })).toBeVisible();
await expect(featured.getByRole('heading', { name: featuredArticleTitle })).toBeVisible();
await expect(featured.getByRole('link', { name: new RegExp(featuredArticleTitle) })).toHaveAttribute(
  'href',
  '/blog/chatgpt-codex-plugins-guide/',
);
await expect(featured.locator('[data-custom-hero], [data-category-artwork], pre, .description, .tags')).toHaveCount(0);
await expect(hero.locator('[data-hero-network]')).toBeVisible();
```

画像取得失敗テストは注目記事側のルート処理を削除し、最新記事内のPluginsカードだけで、カスタム画像が失敗してもカテゴリーアートと記事リンクを利用できることを確認する。JavaScript無効テストにはH1、注目記事リンク、`[data-network-fallback]`の表示を追加する。

- [ ] **Step 2: 対象テストを実行し、古い大カード契約との差で失敗することを確認する**

Run: `npx playwright test tests/e2e/home-content.spec.ts`

Expected: ネットワーク不在、注目記事内の画像・説明表示によりFAIL。

- [ ] **Step 3: FeaturedArticleを一つのリンクで包むコンパクトカードへ置き換える**

`FeaturedArticle.astro`のPropsは`href`と`title`だけにする。

```astro
<article class="featured" aria-label="注目記事">
  <a class="featured-link" href={href}>
    <span class="eyebrow">FEATURED</span>
    <h2>{title}</h2>
    <span class="read-more">記事を読む <span aria-hidden="true">→</span></span>
  </a>
</article>
```

カード全体を一つのリンクにし、`overflow-wrap: anywhere`、見えるfocus ring、44px以上の操作領域を確保する。Shiki、画像、カテゴリーアート、タグ関連のimportと処理は削除する。

- [ ] **Step 4: Heroへネットワークを配置し、デスクトップの重なり順を実装する**

`Hero.astro`で`InteractiveHeroNetwork`をimportし、featured Propsを`{ href: string; title: string }`へ絞る。DOM順は常に次のとおりにする。

```astro
<div class="intro" data-hero-entrance>...</div>
<InteractiveHeroNetwork />
<div class="featured-slot" data-hero-entrance>
  <FeaturedArticle {...featured} />
</div>
```

デスクトップではintroを左側、networkを右側64%程度、featured-slotを右下の絶対配置にする。z-indexはintroとfeatured-slotをCanvasより前にする。入口アニメーションはCSSだけで約0.7秒に収め、kicker、H1、tagline、description、tech-listを80〜100msずつずらす。カードは最後に一度だけ下から表示する。

- [ ] **Step 5: indexページからヒーローへ必要最小限のfeatured情報だけ渡す**

```ts
const featured = {
  href: `/blog/${featuredEntry.id}/`,
  title: featuredEntry.data.title,
};
```

`toArticleView`は最新記事カード用として残す。記事コレクションのschemaとfrontmatterは変更しない。

- [ ] **Step 6: 対象テストを再実行する**

Run: `npx playwright test tests/e2e/home-content.spec.ts tests/e2e/hero-network.spec.ts`

Expected: 全テストPASS。

- [ ] **Step 7: この単位をコミットする**

```sh
git add src/components/home/Hero.astro src/components/blog/FeaturedArticle.astro src/pages/index.astro tests/e2e/home-content.spec.ts
git commit -m "feat: make the network the hero focal point"
```

## Task 4: モバイル順序、長文、動きを減らす設定を固定する

**Files:**

- Modify: `src/components/home/Hero.astro`
- Modify: `src/components/blog/FeaturedArticle.astro`
- Modify: `tests/e2e/visual.spec.ts`
- Modify: `tests/e2e/hero-network.spec.ts`

- [ ] **Step 1: レスポンシブ順序と長文契約を新しい構造へ書き換える**

390pxで`.intro`、`[data-hero-network]`、`.featured-slot`のbounding boxを取得し、Y座標がこの順で、互いに重ならないことを確認する。既存のカード列数テストは残す。

長文テストは`.featured h2`だけへ長い英数字を設定し、カードと見出しの`scrollWidth <= clientWidth`を1024pxと390pxで確認する。削除済み`.description`と`.media-layer`の検査は外す。

- [ ] **Step 2: モバイルのタッチ操作を占有しないテストを追加する**

```ts
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('/');
const network = page.locator('[data-hero-network]');
await expect(network).toHaveCSS('touch-action', 'pan-y');
await expect(network.locator('canvas')).toHaveCSS('pointer-events', 'none');
```

タッチ反発用listenerは実装しない。ラッパーは`touch-action: pan-y`を明示する。

- [ ] **Step 3: reduced-motionの検査対象をコンパクトカードとネットワークへ変更する**

古い`続きを読む`矢印のlocatorを`記事を読む`へ変更する。`[data-hero-entrance]`とその子要素のanimation durationが0.001秒以下、ネットワーク状態が`static`、H1と注目記事リンクが即座に表示されることを確認する。

- [ ] **Step 4: 対象テストを実行し、レイアウト未調整箇所が失敗することを確認する**

Run: `npx playwright test tests/e2e/visual.spec.ts tests/e2e/hero-network.spec.ts --grep-invert "ホームを(desktop|tablet|mobile)で表示できる"`

Expected: モバイル順序、旧locator、または長文検査がFAIL。

- [ ] **Step 5: 63.99rem以下を通常フローへ切り替える**

`Hero.astro`の既存ブレークポイントを維持し、モバイルでは`position: static`、intro → network → featured-slotの1列にする。Canvasとカードを重ねない。390pxでネットワークに固定px幅を与えず、`inline-size: 100%`、`min-inline-size: 0`を使う。

`prefers-reduced-motion: reduce`では入口アニメーションを`none`にし、初期opacityやtransformを残さない。

- [ ] **Step 6: 対象テストを再実行する**

Run: `npx playwright test tests/e2e/visual.spec.ts tests/e2e/hero-network.spec.ts --grep-invert "ホームを(desktop|tablet|mobile)で表示できる"`

Expected: snapshot以外の対象テストがすべてPASS。

- [ ] **Step 7: snapshot以外がPASSした状態をコミットする**

```sh
git add src/components/home/Hero.astro src/components/blog/FeaturedArticle.astro tests/e2e/visual.spec.ts tests/e2e/hero-network.spec.ts
git commit -m "test: cover responsive interactive hero behavior"
```

## Task 5: 執筆ガイドを現在の表示契約へ合わせる

**Files:**

- Modify: `README.md`
- Modify: `tests/unit/readme.test.ts`

- [ ] **Step 1: READMEの期待値を先に変更する**

`heroImage`の期待値を「記事カードとOG画像で利用し、コンパクトな注目記事では表示しない」へ変更する。`featuredCode`は既存frontmatterとの互換性のため任意項目として残るが、現在のコンパクトな注目記事では表示しないことを検査する。

```ts
expect(frontmatterSection).toMatch(/`heroImage`.+記事カード.+OG画像.+コンパクトな注目記事.+表示しない/is);
expect(frontmatterSection).toMatch(/`featuredCode`.+互換性.+コンパクトな注目記事.+表示しない/is);
```

- [ ] **Step 2: READMEテストを実行し、古い説明との差で失敗することを確認する**

Run: `npx vitest run tests/unit/readme.test.ts`

Expected: 新しい説明文がなくFAIL。

- [ ] **Step 3: frontmatter説明を実装と一致させる**

frontmatterの項目自体とYAML例は削除しない。`featuredCode`が現在のヒーローでコードパネルを出すという説明と、`heroImage`が注目記事に表示されるという説明を削除し、実際の利用先と非表示範囲を明記する。

- [ ] **Step 4: READMEテストを再実行する**

Run: `npx vitest run tests/unit/readme.test.ts`

Expected: PASS。

- [ ] **Step 5: この単位をコミットする**

```sh
git add README.md tests/unit/readme.test.ts
git commit -m "docs: align article metadata guide with compact hero"
```

## Task 6: visual goldenを更新し、見た目を調整する

**Files:**

- Modify: `src/components/home/Hero.astro`
- Modify: `src/components/home/InteractiveHeroNetwork.astro`
- Modify: `src/components/blog/FeaturedArticle.astro`
- Modify: `src/scripts/hero-network.ts`
- Modify: `tests/e2e/visual.spec.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-desktop.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-tablet.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-mobile.png`

- [ ] **Step 1: ローカルでヒーローをデスクトップとモバイル表示する**

Run: `npm run dev -- --host 127.0.0.1`

Inspect:

- 1440×1200: 点群が右側の主役になり、一部が中央へ広がる。
- 390×844: intro → network → featuredの順で、カードはCanvasへ重ならない。
- カーソルをネットワーク上で動かすと150px前後の範囲が押し分けられ、薄いリングが追従する。
- カーソルを外すと粒子が通常の補間位置へ戻る。
- 見出し、説明、カードのコントラストとリンク操作を点群が妨げない。

- [ ] **Step 2: 仕様の調整可能範囲だけを調整する**

必要なら粒子サイズ、明度、青・シアン・紫・白の配分、線の透明度、最大3本以内の接続数、補間曲線を調整する。72/36個、3形状、約5秒、150px、Canvas 2Dという固定条件は変えない。

- [ ] **Step 3: visual goldenを意図的に更新する**

`tests/e2e/visual.spec.ts`の3つのホームsnapshotテストでは、`page.goto('/')`の前に次を追加する。

```ts
await page.emulateMedia({ reducedMotion: 'reduce' });
```

Canvasの`requestAnimationFrame`はPlaywrightの`animations: 'disabled'`では止まらない。visual goldenだけはreduced-motionで放射形状の静止画を撮り、通常の`running`状態は`hero-network.spec.ts`で検証する。

Run: `npx playwright test tests/e2e/visual.spec.ts --update-snapshots`

Expected: desktop、tablet、mobileの3枚だけが更新され、全visualテストPASS。

- [ ] **Step 4: 更新画像を目視確認する**

3枚を開き、横スクロール、文字切れ、カードの重なり、点群の密度を確認する。`git diff --stat`で3枚以外の予期しないsnapshot追加がないことも確認する。

- [ ] **Step 5: visual更新をコミットする**

```sh
git add src/components/home/Hero.astro src/components/home/InteractiveHeroNetwork.astro src/components/blog/FeaturedArticle.astro src/scripts/hero-network.ts tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots
git commit -m "test: update home visual goldens for interactive hero"
```

## Task 7: 総合検証と公開前レビューを行う

**Files:**

- Verify only; failuresがあれば該当ファイルを修正する。

- [ ] **Step 1: フォーマットを適用する**

Run: `npm run format`

Expected: Prettierが対象ファイルを整形する。整形差分を確認し、意図しないユーザーファイルを含めない。

- [ ] **Step 2: 総合検証を実行する**

Run: `SITE_URL=https://example.invalid npm run verify`

Expected: format check、Astro check、Vitest、Astro build、Pagefind、build verification、PlaywrightがすべてPASS。

- [ ] **Step 3: ブラウザの最終確認を行う**

確認項目:

- 通常表示でconsole errorが0件。
- デスクトップでヘッダーと注目記事リンクをクリックできる。
- モバイルでネットワーク上から縦スクロールできる。
- ヒーローを画面外へ出すと`data-network-state="paused"`になる。
- 別タブへ移ると`data-network-state="paused"`になり、戻った直後に形状が飛ばず続きから動く。
- reduced-motionで`data-network-state="static"`となり、文字とカードが待たずに表示される。
- JavaScript無効でもH1、説明、注目記事リンク、静的フォールバックが見える。

- [ ] **Step 4: 最終差分を確認する**

Run: `git status --short && git diff --check && git diff origin/main...HEAD --stat`

Expected: `.agents/`と`skills-lock.json`以外に意図しない未追跡ファイルがなく、空白エラーがなく、変更範囲がヒーロー、テスト、README、仕様・計画に限定される。

- [ ] **Step 5: 検証で生じた整形・修正だけをコミットする**

```sh
git add README.md src/components/home/Hero.astro src/components/home/InteractiveHeroNetwork.astro src/components/blog/FeaturedArticle.astro src/pages/index.astro src/scripts/hero-network.ts tests/e2e/home-content.spec.ts tests/e2e/hero-network.spec.ts tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots tests/unit/hero-network.test.ts tests/unit/readme.test.ts
git commit -m "chore: verify interactive hero network"
```

差分がなければ、このコミットは作らない。

## 完了判定

- [ ] 3形状が約5秒ごとに滑らかに循環する。
- [ ] デスクトップ72個、モバイル36個を上限とする。
- [ ] デスクトップのカーソル反発とリングが動作する。
- [ ] モバイルにタッチ反発がなく、縦スクロールを妨げない。
- [ ] 画面外・非表示タブで停止し、reduced-motionでは静止画になる。
- [ ] H1、説明、技術一覧、注目記事リンクは静的HTMLで利用できる。
- [ ] intro → network → compact featuredのモバイル順序が保証される。
- [ ] 既存frontmatterと最新記事カードの画像表示を壊していない。
- [ ] `SITE_URL=https://example.invalid npm run verify`が成功する。
