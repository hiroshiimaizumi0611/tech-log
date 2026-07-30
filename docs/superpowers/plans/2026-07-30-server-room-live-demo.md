# 3D Server Room Live Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第4回で作った3Dサーバールームを、ブログと同じドメインの`/demos/server-room/`で読者が操作できるデモとして公開します。

**Architecture:** ローカルの3Dリポジトリでサブパス・公開シェル・アクセシビリティ対応を実装し、確定commitから公開ファイルを抽出します。ブログリポジトリはmanifest付き同期スクリプトで検証済みソースを取り込み、公開版の正式な保存先として管理します。Astroの後にViteで`dist/demos/server-room/`へ追加出力し、同じCloudflare Workerから配信します。

**Tech Stack:** Blender GLB, React 19, TypeScript 5.9, Three.js, React Three Fiber, Drei, Vite 8, Astro 7, Vitest 4, Testing Library, Playwright 1.61, glTF Validator, Cloudflare Workers Static Assets

---

## 作業場所

### 3D原本

- Worktree: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard`
- 開始点: `episode-04` / `c44b0dba97260f159f0af791338c6bffd5d2f22c`
- 新ブランチ: `codex/episode-04-live-demo`
- 制作来歴のローカルタグ: `episode-04-demo`

### ブログ

- Worktree: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-04-design`
- ブランチ: `codex/server-room-live-demo`
- 開始点: `origin/main` / `327c3afadc307527a555e95c98e052164d763514`

Primary 3D worktreeの既存差分`blender/episode-02-server-room.blend`には触れません。作業前後でSHA-256
`d112facbfe5db3ebf63406e849334a366c490a9ccea04fd2cf7c3d9715991151`
が変わっていないことを確認します。

## ファイル構成

### 3D原本で変更するファイル

- `src/utils/modelUrl.ts`: ViteのbaseからGLB取得URLを作ります。
- `src/utils/modelUrl.test.ts`: ルートとサブパスのURL契約を検証します。
- `src/components/three/ServerRoomModel.tsx`: URL注入とモデルready通知を担当します。
- `src/components/three/ServerRoomCanvas.tsx`: 読み込み状態とカメラ変更通知を担当します。
- `src/components/ModelErrorBoundary.tsx`: 実際の取得URLと失敗通知を扱います。
- `src/App.tsx`: ready状態とデモ画面の公開用案内を接続します。
- `src/App.css`: 静的ヘッダー、モバイル案内、状態表示を整えます。
- `index.html`: robots、canonical、静的な戻るリンク、no-JS案内を追加します。
- `vite.config.ts`: baseとcanonicalを環境変数から生成します。
- `README.md`: 公開版タグと検証方法を記録します。
- 既存の関連テスト: 新しいprops、状態、エラー文言へ更新します。

### ブログで作成するファイル

- `demos/server-room/`: 3D原本から同期した`index.html`、`src/`、`public/`。
- `demos/server-room/upstream.json`: 元タグ、commit、同期ファイル、SHA-256。
- `demos/server-room/vite.config.ts`: ブログのサブパス向けVite adapter。
- `demos/server-room/tsconfig.json`: デモ専用型検査。
- `demos/server-room/vitest.config.ts`: jsdomとsetup fileを指定するテスト設定。
- `vitest.config.ts`: ブログrootのテストからdemo配下を除外します。
- `scripts/sync-server-room-demo.mjs`: allowlist同期とmanifest生成。
- `scripts/verify-server-room-demo.mjs`: manifest、GLB、ビルド成果物を検証。
- `tests/unit/server-room-demo-sync.test.ts`: 同期・drift契約。
- `tests/unit/server-room-demo-build.test.ts`: Vite設定、SEO、成果物契約。
- `tests/e2e/server-room-demo.spec.ts`: 操作、a11y、モバイルE2E。

### ブログで変更するファイル

- `package.json`, `package-lock.json`: 依存関係とbuild・verifyコマンド。
- `scripts/verify-build.mjs`: デモ成果物とPagefind除外を検証。
- `scripts/smoke-production.mjs`: 本番のデモHTML、asset、GLB、headerを検証。
- `tests/unit/deployment.test.ts`: 本番smokeの契約を更新。
- `public/_headers`: デモパスのセキュリティヘッダーとして新規作成します。
- `src/content/blog/blender-server-room-04-react-dashboard.md`: 「3Dデモを開く」導線。
- `tests/unit/blender-episode-04-article.test.ts`: デモリンクの契約。
- `README.md`: デモ同期、ローカル確認、公開手順。

---

### Task 1: 3D原本の公開ブランチを作る

**Files:**

- Verify only: 3D dedicated worktree
- Verify only: primary 3D worktree

- [ ] **Step 1: 専用worktreeの開始点とclean状態を確認する**

```bash
git status -sb
git rev-parse HEAD
git rev-parse episode-04^{}
```

Expected: HEADと`episode-04^{}`が`c44b0dba...`で、worktreeはcleanです。

- [ ] **Step 2: Primaryの既存差分を記録する**

```bash
git -C /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard status --short
shasum -a 256 /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend
```

Expected: `.blend` 1件だけがmodifiedで、SHA-256は設計値です。

- [ ] **Step 3: 公開対応ブランチを作る**

```bash
git switch -c codex/episode-04-live-demo episode-04
```

- [ ] **Step 4: Node 24で基準テストを実行する**

```bash
npx -y -p node@24 -c \
  'node --version && npm run lint && npm test && npm run validate:episode-03 && npm run build'
```

Expected: Python 36件、Vitest 48件、GLB errors 0 / warnings 0、build成功です。500KB超のchunk警告は記録します。

---

### Task 2: GLB URLをbase対応にする

**Files:**

- Create: `src/utils/modelUrl.ts`
- Create: `src/utils/modelUrl.test.ts`
- Modify: `src/components/three/ServerRoomModel.tsx`
- Modify: `src/components/ModelErrorBoundary.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/ModelErrorBoundary.test.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: URL契約の失敗テストを書く**

```ts
import { describe, expect, it } from 'vitest'
import { serverRoomModelUrl } from './modelUrl'

describe('serverRoomModelUrl', () => {
  it.each([
    ['/', '/models/server-room.glb'],
    ['/demos/server-room/', '/demos/server-room/models/server-room.glb'],
    ['/demos/server-room', '/demos/server-room/models/server-room.glb'],
  ])('builds the GLB URL from %s', (base, expected) => {
    expect(serverRoomModelUrl(base)).toBe(expected)
  })
})
```

ErrorBoundary testには、同じURLを表示し、`componentDidCatch`から`onError` callbackを一度呼ぶ契約を追加します。このTaskではAppのloading状態を変更しません。

- [ ] **Step 2: REDを確認する**

```bash
npm run test:unit -- src/utils/modelUrl.test.ts src/App.test.tsx
```

Expected: `modelUrl`が存在せず失敗します。

- [ ] **Step 3: 最小実装を書く**

```ts
const MODEL_PATH = 'models/server-room.glb'

export function serverRoomModelUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}${MODEL_PATH}`
}
```

`App`で`serverRoomModelUrl(import.meta.env.BASE_URL)`を一度作り、`ServerRoomCanvas`と`ModelErrorBoundary`へ渡します。`ServerRoomModel`は文字列propを`useGLTF`へ渡し、ErrorBoundaryは同じ文字列を`code`内に表示します。ErrorBoundaryには`modelUrl`と`onError`を明示的なpropsとして追加し、`componentDidCatch`から失敗を一度通知します。Appからは一時的にno-op callbackを渡し、状態管理はTask 3で実装します。

- [ ] **Step 4: GREENを確認する**

```bash
npm run test:unit -- src/utils/modelUrl.test.ts src/App.test.tsx src/components/ModelErrorBoundary.test.tsx
```

Expected: 対象テストが成功します。

- [ ] **Step 5: コミットする**

```bash
git add src
git commit -m "feat: resolve the server room model from the app base"
```

---

### Task 3: ready状態とカメラ操作を観測できるようにする

**Files:**

- Modify: `src/components/three/ServerRoomModel.tsx`
- Modify: `src/components/three/ServerRoomCanvas.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`
- Test: `src/components/three/ServerRoomCanvas.test.tsx`

- [ ] **Step 1: 失敗テストを書く**

App testで初期表示に`role="status"`の「3Dモデルを読み込んでいます」があり、canvas bridgeの`onReady`後に「3Dモデルを読み込みました」へ変わることを検証します。`onError`後はloading statusが消え、`role="alert"`とbase付きURLだけが残ることも検証します。Canvas mockはcallbackを自動実行せず、受け取った`onReady`と`onError`を保持し、testの`act()`内から手動実行します。

Canvas testでは`@react-three/fiber`の`Canvas`をchildrenを返すcomponent、Dreiの`Html`をchildrenを返すcomponent、`OrbitControls`を受け取った`onChange`を公開するtest double、`ServerRoomModel`をready通知だけ行うtest doubleへmockします。OrbitControls mockの`onChange`を呼び、ラッパーの`data-camera-change-count`が`0`から`1`へ増えることを検証します。WebGLは起動しません。

- [ ] **Step 2: REDを確認する**

```bash
npm run test:unit -- src/App.test.tsx src/components/three/ServerRoomCanvas.test.tsx
```

Expected: ready文言とdata属性がないため失敗します。

- [ ] **Step 3: ready通知を実装する**

`ServerRoomModel`へ`onReady: () => void`を追加し、prepared sceneがcommitされた後のeffectで一度通知します。既知のrender破棄時のresource leakを避けるため、scene準備とcleanupの所有関係も同じeffectへ寄せるか、commitされなかったrenderで生成物を残さない構成にします。

`App`は`modelState: 'loading' | 'ready' | 'error'`を持ち、loadingとreadyのときだけstatusを表示します。

```tsx
<p className="model-status" role="status" aria-live="polite">
  {modelState === 'ready'
    ? '3Dモデルを読み込みました'
    : '3Dモデルを読み込んでいます'}
</p>
```

error時はこの`p`を描画せず、ErrorBoundaryのalertだけを表示します。

- [ ] **Step 4: カメラ変更契約を実装する**

`ServerRoomCanvas`のsection refを保持し、OrbitControlsの`onChange`ごとにDOMのdatasetだけを更新します。

```ts
function handleCameraChange() {
  const element = containerRef.current
  if (!element) return
  const current = Number(element.dataset.cameraChangeCount ?? '0')
  element.dataset.cameraChangeCount = String(current + 1)
}
```

初期値は`data-camera-change-count="0"`です。

- [ ] **Step 5: GREENと全unitを確認する**

```bash
npm run test:unit
```

Expected: 既存48件を含む全テストが成功します。

- [ ] **Step 6: コミットする**

```bash
git add src
git commit -m "feat: expose model and camera readiness"
```

---

### Task 4: 公開用HTMLシェルとVite設定を追加する

**Files:**

- Modify: `index.html`
- Modify: `vite.config.ts`
- Modify: `src/App.css`
- Modify: `README.md`
- Create or Modify tests: `tests/public-shell.test.ts`

- [ ] **Step 1: HTML契約の失敗テストを書く**

`index.html`をJSDOMで読み、次を検証します。

```ts
expect(html).toContain('name="robots" content="noindex, follow"')
expect(html).toContain('rel="canonical"')
expect(html).toContain('ブログへ戻る')
expect(html).toContain('<noscript')
expect(html).toContain('JavaScript')
expect(html).toContain('デスクトップ')
expect(html).toContain('data-pagefind-ignore')
```

`noscript`要素の中だけを解析し、ページタイトル、正しいブログへ戻るURL、モックデータ、デスクトップ推奨の4項目を個別にassertします。

Vite設定テストでは、`SERVER_ROOM_BASE_PATH=/demos/server-room/`と`SITE_URL=https://example.invalid`でbuildしたHTMLのcanonicalとasset pathを確認します。

- [ ] **Step 2: REDを確認する**

```bash
npm run test:unit -- tests/public-shell.test.ts
```

- [ ] **Step 3: HTMLとVite設定を実装する**

`index.html`へ日本語title・description・robots・canonical placeholderを追加します。bodyには`data-pagefind-ignore`を付け、root外に戻るリンクとdesktop推奨文、`noscript`案内を置きます。

`vite.config.ts`は`SERVER_ROOM_BASE_PATH`の既定値を`/`とし、末尾slashを正規化します。`SITE_URL`がある場合はHTML変換pluginでcanonical placeholderを絶対URLへ置換します。

- [ ] **Step 4: CSSを追加する**

静的ヘッダーは既存ダークUIと統一し、幅390pxでリンクや案内が折り返されるようにします。Canvas以外の領域では通常の縦スクロールを維持します。

- [ ] **Step 5: GREENとbuildを確認する**

```bash
npm run test:unit
SERVER_ROOM_BASE_PATH=/demos/server-room/ SITE_URL=https://example.invalid npm run build
```

Expected: `dist/index.html`のJS/CSS/GLB参照が`/demos/server-room/`で始まり、canonicalが`https://example.invalid/demos/server-room/`です。

- [ ] **Step 6: コミットする**

```bash
git add index.html vite.config.ts src/App.css README.md tests
git commit -m "feat: prepare the dashboard for public subpath hosting"
```

---

### Task 5: 3D公開版を検証してタグを付ける

**Files:**

- Create: `scripts/validate_demo_glb.mjs`
- Create: `tests/demo-glb-contract.test.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/learning-log.md`
- Tag: `episode-04-demo`

- [ ] **Step 1: 公開GLB validatorの失敗テストを書く**

対象は`public/models/server-room.glb`です。SHA違い、warningあり、server node欠落、重複nodeのfixtureで失敗するテストを作ります。

- [ ] **Step 2: REDを確認する**

```bash
npm run test:unit -- tests/demo-glb-contract.test.ts
```

Expected: validator moduleが存在せず失敗します。

- [ ] **Step 3: validatorとpackage scriptを実装する**

SHA-256、`numErrors === 0`、`numWarnings === 0`、14台のnode名の完全一致と重複なしをメモリまたは一時ファイルで検証します。追跡済みreportは変更しません。`package.json`へ`validate:demo-glb`を追加します。

- [ ] **Step 4: GREENを確認してcommitする**

```bash
npm run test:unit -- tests/demo-glb-contract.test.ts
npm run validate:demo-glb
git add package.json scripts/validate_demo_glb.mjs tests/demo-glb-contract.test.ts
git commit -m "test: validate the public demo GLB"
```

- [ ] **Step 5: Node 24で全検証する**

```bash
npx -y -p node@24 -c \
  'node --version && npm run lint && npm test && npm run validate:demo-glb && SERVER_ROOM_BASE_PATH=/demos/server-room/ SITE_URL=https://example.invalid npm run build'
```

Expected: lint、Python、Vitest、GLB Validator、TypeScript、Vite buildが成功します。

- [ ] **Step 6: 実ブラウザで確認する**

本番相当baseでpreviewし、1440×1000と390×844で次を確認します。

- GLB ready
- selectで`server_01_01`と`server_02_08`を選択
- アラーム発生と正常復帰
- dragとwheelでcount増加
- Canvas外の縦スクロール
- 横overflowなし
- console errorなし

- [ ] **Step 7: 公開対応の来歴を文書へ記録してコミットする**

READMEへbase環境変数、公開用build、`validate:demo-glb`を追記します。学習ログへ公開シェル、ready/camera契約、GLB SHA、テスト件数、既知のchunk警告を記録します。

```bash
git add README.md docs/learning-log.md
git commit -m "docs: record the public demo contract"
```

- [ ] **Step 8: clean状態を確認してannotated tagを作る**

```bash
git status --short
git tag -a episode-04-demo -m "Episode 04 public interactive demo"
git rev-parse episode-04-demo^{}
```

Expected: statusは出力なしで、tagは検証済みHEADを指します。

- [ ] **Step 9: Primaryが未変更であることを再確認する**

Task 1と同じstatus・SHAを確認します。

---

### Task 6: ブログへ同期スクリプトとmanifestを追加する

**Files:**

- Create: `scripts/sync-server-room-demo.mjs`
- Create: `scripts/verify-server-room-demo.mjs`
- Create: `tests/unit/server-room-demo-sync.test.ts`
- Create: `demos/server-room/upstream.json`
- Create by sync: `demos/server-room/index.html`
- Create by sync: `demos/server-room/src/**`
- Create by sync: `demos/server-room/public/models/server-room.glb`

- [ ] **Step 1: allowlistとdriftの失敗テストを書く**

一時ディレクトリへ偽のsourceを作り、次を検証します。

- 許可ファイルだけをコピーする
- sourceのtag/commitが違えば失敗する
- manifestに相対pathとSHA-256を昇順で書く
- 同期後に1 byte変えるとverifyが失敗する
- 削除・余分なファイルでもverifyが失敗する

- [ ] **Step 2: REDを確認する**

```bash
npm test -- tests/unit/server-room-demo-sync.test.ts
```

- [ ] **Step 3: 同期スクリプトを実装する**

CLI契約:

```bash
node scripts/sync-server-room-demo.mjs \
  --source /absolute/path/to/episode-04-react-dashboard \
  --tag episode-04-demo
```

allowlistは`index.html`、`src/**/*.{ts,tsx,css}`、`public/models/server-room.glb`です。スクリプトは`git rev-parse <tag>^{}`と`git ls-tree`でcommitとfile modeを確認し、`git show <commit>:<path>`でimmutable treeから同一filesystem上の一時ディレクトリへ抽出します。working treeは読みません。symlink、絶対path、`..`を拒否します。source repositoryにあるallowlist外の通常ファイルは無視し、抽出候補やmanifestにallowlist外pathが入った場合は拒否します。

一時領域でsnapshotとmanifestの検証が完了してから、ブログrootとdestinationのrealpath、各祖先がsymlinkでないことを確認し、`index.html`、`src`、`public`、`upstream.json`を1つのtransactionとして置換します。置換途中に失敗した場合は4対象すべてを旧状態へrollbackします。source不正や途中失敗時は既存snapshotをbyte-for-byte維持します。

- [ ] **Step 4: verifyスクリプトを実装する**

`upstream.json`のschema、tag、commit、path、SHA、GLB期待SHAを検証します。manifest管理範囲は`index.html`、`src/**`、`public/**`です。`upstream.json`とブログ所有の`vite.config.ts`、`vitest.config.ts`、`tsconfig.json`は別の許可集合とし、それ以外の未知ファイルを拒否します。

テストにはdirty working treeがtag同期へ混ざらないこと、source検証失敗と4対象の各置換段階で既存snapshot全体が不変またはrollbackされること、Task 7のconfig追加後もverifyが通り未知ファイルでは失敗することを含めます。

- [ ] **Step 5: GREENを確認し、本物を同期する**

```bash
npm test -- tests/unit/server-room-demo-sync.test.ts
node scripts/sync-server-room-demo.mjs \
  --source /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard \
  --tag episode-04-demo
node scripts/verify-server-room-demo.mjs
```

- [ ] **Step 6: コミットする**

```bash
git add scripts/sync-server-room-demo.mjs scripts/verify-server-room-demo.mjs \
  tests/unit/server-room-demo-sync.test.ts demos/server-room
git commit -m "feat: sync the interactive server room demo"
```

---

### Task 7: デモの依存関係・型検査・unit testをブログへ統合する

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vitest.config.ts`
- Create: `demos/server-room/vite.config.ts`
- Create: `demos/server-room/tsconfig.json`
- Create: `demos/server-room/vitest.config.ts`
- Test: `tests/unit/server-room-demo-build.test.ts`

- [ ] **Step 1: package scriptsとVite契約の失敗テストを書く**

次を検証します。

- `check:demo`が`tsc --noEmit`を使う
- `test:demo`が専用Vitest configを使う
- `build:demo`が専用Vite configを使う
- `verify`にsync verify、型、unit、GLBが含まれる
- root/base/publicDir/outDir/emptyOutDirが設計値
- root Vitestが`demos/server-room/**`を除外し、demo Vitestと対象ファイルが重複しない

- [ ] **Step 2: REDを確認する**

```bash
npm test -- tests/unit/server-room-demo-build.test.ts
```

- [ ] **Step 3: 依存関係を追加する**

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D vite @vitejs/plugin-react gltf-validator jsdom \
  @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom @types/node @types/three
```

ReactとReact DOMはブログルートの版を使い、peer dependency warningがないことを確認します。

- [ ] **Step 4: configとscriptsを実装する**

`demos/server-room/vite.config.ts`は`fileURLToPath`と`resolve`でブログroot・demo root・outDirを絶対化します。`base`は固定、`publicDir`は`public`、`emptyOutDir`はfalseです。canonical placeholderは`SITE_URL`から置換します。

ブログrootの`vitest.config.ts`へ`exclude: ['demos/server-room/**', ...configDefaults.exclude]`を追加します。`demos/server-room/vitest.config.ts`はjsdom、`src/test/setup.ts`、CSS、demo配下の`.test.ts/.test.tsx`だけを対象にします。契約テストでrootとdemoの収集ファイルが重複しないことを確認します。

- [ ] **Step 5: 型とunitを実行する**

```bash
npm run check:demo
npm run test:demo
```

Expected: 同期した3Dテストがすべて成功します。

- [ ] **Step 6: コミットする**

```bash
git add package.json package-lock.json vitest.config.ts demos/server-room/*.config.ts \
  demos/server-room/tsconfig.json tests/unit/server-room-demo-build.test.ts
git commit -m "build: integrate the server room demo toolchain"
```

---

### Task 8: ブログbuildとGLB検証へデモを統合する

**Files:**

- Modify: `package.json`
- Modify: `scripts/verify-build.mjs`
- Modify: `scripts/verify-server-room-demo.mjs`
- Test: `tests/unit/server-room-demo-build.test.ts`
- Create: `tests/e2e/server-room-demo-search.spec.ts`

- [ ] **Step 1: 成果物検査の失敗テストを書く**

一時dist fixtureで次の欠落・誤りを1件ずつ作り、verifyが失敗することを検証します。

- demo indexなし
- JS/CSSがdemo subpath外
- GLBなしまたはSHA違い
- demo外に余分なGLBがある
- blog index/RSS/sitemap消失
- robots/canonical誤り
- Pagefind実行後の`page_count`が15へ増える
- sitemapにdemo URLが入る

- [ ] **Step 2: REDを確認する**

```bash
npm test -- tests/unit/server-room-demo-build.test.ts
```

- [ ] **Step 3: build順序を変更する**

```json
{
  "scripts": {
    "build": "npm run build:astro && npm run build:demo && npm run build:search && node scripts/verify-build.mjs"
  }
}
```

`verify-build.mjs`は既存のブログ検査を保ったまま、デモ検査関数を呼びます。Pagefind実行後の日本語`page_count`が公開記事数14から増えていないこと、demo HTMLに`data-pagefind-body`がないこと、sitemap indexが参照する全sitemapにdemo URLがないことを検証します。`dist/**/*.glb`を再帰列挙し、集合が`demos/server-room/models/server-room.glb`の1件だけであることもassertします。

- [ ] **Step 4: GLB Validator契約を追加する**

公開コピーをメモリまたは一時ファイルで検証し、`numErrors === 0 && numWarnings === 0`をassertします。node名は期待する14件と完全一致し、重複がないことを検証します。追跡済みreportへは出力しません。

- [ ] **Step 5: GREENと本番buildを確認する**

```bash
npm test -- tests/unit/server-room-demo-build.test.ts
SITE_URL=https://example.invalid npm run build
npm run test:e2e -- tests/e2e/server-room-demo-search.spec.ts
```

Expected: 既存ブログ成果物とデモ成果物が共存し、Pagefindは14記事のままです。

`tests/e2e/server-room-demo-search.spec.ts`でbuild済みサイトの検索UIを開き、デモ固有title、本文語、URLを検索して結果が0件であることを検証します。unit fixtureは`page_count`、`data-pagefind-body`不存在、全sitemapでのURL不存在に限定します。

- [ ] **Step 6: コミットする**

```bash
git add package.json scripts tests/unit/server-room-demo-build.test.ts \
  tests/e2e/server-room-demo-search.spec.ts
git commit -m "build: publish the server room demo with the blog"
```

---

### Task 9: セキュリティヘッダーと記事導線を追加する

**Files:**

- Create: `public/_headers`
- Modify: `src/content/blog/blender-server-room-04-react-dashboard.md`
- Modify: `tests/unit/blender-episode-04-article.test.ts`
- Test: `tests/unit/server-room-demo-build.test.ts`

- [ ] **Step 1: headerと記事リンクの失敗テストを書く**

記事テスト:

```ts
expect(article).toMatch(
  /<a[^>]+href="\/demos\/server-room\/"[^>]+target="_blank"[^>]+rel="noopener"[^>]*>3Dデモを開く<\/a>/,
)
expect(article).toMatch(/回転.+ズーム.+サーバー選択.+アラーム/s)
expect(article).toMatch(/モックデータ/)
expect(article).toMatch(/デスクトップ.+推奨/)
```

headerテストでは設計した6ヘッダーのpathと完全値を検証します。

- [ ] **Step 2: REDを確認する**

```bash
npm test -- tests/unit/blender-episode-04-article.test.ts tests/unit/server-room-demo-build.test.ts
```

- [ ] **Step 3: `_headers`を実装する**

`/demos/server-room/*`へ設計書のCSP、nosniff、DENY、Referrer-Policy、Permissions-Policy、X-Robots-Tagを追加します。Cache-Controlは上書きせずWorkersの既定値を使います。

- [ ] **Step 4: 記事にCTAを追加する**

「今回作るもの」の画像より前へ、短い説明と「3Dデモを開く」リンクを追加します。ですます調を保ち、実監視ではないことを明記します。

- [ ] **Step 5: GREEN、日本語lint、Astro checkを確認する**

```bash
npm test -- tests/unit/blender-episode-04-article.test.ts tests/unit/server-room-demo-build.test.ts
uv run /Users/hiroshiimaizumi/Documents/tech\\ blog\\ 2/.agents/skills/natural-japanese/scripts/lint.py \
  --json --genre tech src/content/blog/blender-server-room-04-react-dashboard.md
npm run check
```

- [ ] **Step 6: コミットする**

```bash
git add public/_headers src/content/blog/blender-server-room-04-react-dashboard.md tests
git commit -m "feat: link the article to the interactive demo"
```

---

### Task 10: E2Eと本番smokeを追加する

**Files:**

- Create: `tests/e2e/server-room-demo.spec.ts`
- Modify: `scripts/smoke-production.mjs`
- Modify: `tests/unit/deployment.test.ts`
- Modify: `playwright.config.ts`
- Modify: `README.md`

- [ ] **Step 1: 本番smokeの失敗テストを書く**

mock fetchで次を検証します。

- slashなしURLはcanonical URLへredirect
- HTML 200
- HTMLから同一subpathのmodule scriptとstylesheetを抽出
- JS/CSS 2xxとMIME
- GLB 2xx、MIME、SHA
- 6つのheader完全値
- 4種類のassetのCache-Control完全値
- 一時404/5xxだけを既存方針でretry

- [ ] **Step 2: REDを確認する**

```bash
npm test -- tests/unit/deployment.test.ts
```

- [ ] **Step 3: smoke実装を小さく分割する**

`fetchWithRetry`、`assertHeader`、`extractDemoAssets`、`sha256Response`を個別関数にし、既存ブログsmokeを壊さずdemo checksを追加します。

- slashなしURLは307、`Location`は正確な`/demos/server-room/`
- HTMLは`text/html`
- JavaScriptは`text/javascript`または`application/javascript`
- CSSは`text/css`
- GLBは`model/gltf-binary`
- charsetは分離してMIMEだけを比較
- 6つのsecurity headerはHTML、JS、CSS、GLBのすべてで完全一致
- 4 assetのCache-Controlは`public, max-age=0, must-revalidate`
- GLBは取得bytesからSHA-256を計算

- [ ] **Step 4: E2Eを書く**

Playwrightで次を実行します。

1. `/demos/server-room/`を開く
2. ready statusを待つ
3. selectで`server_01_01`を選ぶ
4. 「アラーム発生」と「正常に戻す」を押し、文字状態とstatus badgeのcomputed colorを確認
5. Canvasをdragしwheelを送り、camera count増加を確認
6. 戻るリンクと記事CTAを確認
7. keyboardだけでselectとbuttonを操作
8. JavaScript無効contextでページタイトル、正しい戻るURL、モックデータ、デスクトップ推奨を個別確認
9. axe検査
10. 390×844で横overflowなし、Canvas外の縦スクロールを確認
11. console errorとpageerrorが0

HTML badgeの期待色は既存CSSの実値を取得して契約化します。3D materialのhealthy `#22C55E`とcritical `#EF4444`はscene unit testの責務とし、E2Eでは選択中1台だけの状態更新とDOM badgeを確認します。`securitypolicyviolation`を収集し、本番CSPと同じheaderを適用した環境および公開後の実環境で0件であることを確認します。

`playwright.config.ts`へ`wrangler dev --port 4323`のwebServerを追加します。通常の操作はAstro previewの4321で検証し、header、CSP、末尾slash redirect、MIMEはWorkers Static Assetsを再現する4323で検証します。

- [ ] **Step 5: GREENを確認する**

```bash
npm test -- tests/unit/deployment.test.ts
SITE_URL=https://example.invalid npm run build
npm run test:e2e -- tests/e2e/server-room-demo.spec.ts
```

- [ ] **Step 6: READMEを更新してコミットする**

同期、ローカルpreview、検証、mock data、noindex、公開URLを記録します。

```bash
git add playwright.config.ts scripts/smoke-production.mjs tests README.md
git commit -m "test: verify the public server room demo"
```

---

### Task 11: 全検証、PR、デプロイ、本番受入

**Files:**

- Verify all changes
- No new source file unless a verified defect requires a focused fix

- [ ] **Step 1: Node 24でclean installと全検証を行う**

```bash
npx -y -p node@24 -c \
  'node --version && npm ci && SITE_URL=https://example.invalid npm run verify'
git diff --check
git status --short
```

Expected: format、Astro check、ブログunit、demo unit、demo typecheck、GLB、build、Pagefind、全E2Eが成功し、worktreeはcleanです。

- [ ] **Step 2: 3D原本と同期manifestを再照合する**

```bash
node scripts/verify-server-room-demo.mjs
git -C /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard \
  rev-parse episode-04-demo^{}
```

Expected: ローカルtagの制作来歴とmanifestのcommitが一致し、ブログ内のmanifest管理ファイルがすべて一致します。公開版の正式な保存先はブログremoteです。

- [ ] **Step 3: 最終コードレビューを行う**

両リポジトリのbase差分をレビューし、Critical/Importantが0になるまで修正・再検証します。修正は失敗テストを追加してから実装し、対象repoごとにcommitします。両repoの関連検証を再実行します。

- [ ] **Step 4: ブログbranchをpushしDraft PRを作る**

PR本文へ設計、同期元tag/commit、テスト件数、GLB SHA、既知のchunk警告、mock data/noindexを記載します。

- [ ] **Step 5: CI成功後にReady化してsquash mergeする**

ユーザーの公開承認を確認してから`main`へマージします。

- [ ] **Step 6: Deploy workflowを完了まで監視する**

Verify、build、asset origin、deploy、production smokeの全step成功を確認します。

- [ ] **Step 7: 本番ブラウザ受入を行う**

公開URLでdesktopとmobileを確認し、ready、選択、alarm、restore、drag、wheel、記事CTA、戻るリンク、header、noindex、consoleを検証します。

- [ ] **Step 8: Primary 3Dの既存差分を最終確認する**

既存`.blend`だけがmodifiedでSHAが不変であることを報告します。
