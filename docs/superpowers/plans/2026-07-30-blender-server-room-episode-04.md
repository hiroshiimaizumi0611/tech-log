# Blender 3Dサーバールーム連載 第4回 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第3回のGLBをReact Three Fiberで表示し、サーバーの選択、詳細表示、アラーム発生と正常復帰による色変更を実装して、第4回の記事を公開できる状態にする。

**Architecture:** `episode-03`タグから独立したworktreeを作り、既存のGLB検証環境を保ったままVite、React、TypeScriptを追加する。GLB内のオブジェクト名をローカル監視データのキーにし、Reactの`useState`から3Dシーンへ状態を一方向に渡す。共有マテリアルはサーバーごとに複製し、正常は緑、障害は赤、選択中は水色の発光で表す。

**Tech Stack:** Node.js 24、React 19、TypeScript 5.9、Vite 8、Three.js、React Three Fiber 9、Drei 10、Vitest 4、Testing Library、ESLint 10、Astro 7

---

## 作業場所と境界

この計画は、次の2リポジトリを扱う。

- 3D制作: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard`
- ブログ: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-04-design`
- スクリーンショット一時保存: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard/.captures/episode-04`

3D制作リポジトリの通常worktreeには、`blender/episode-02-server-room.blend`の未コミット変更がある。削除、stash、checkout、reset、上書き保存を行わない。第4回は`episode-03`タグから次の専用worktreeを作る。

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard
```

ブログ側の設計書は次のファイルを正とする。

```text
/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-04-design/docs/superpowers/specs/2026-07-30-blender-server-room-episode-04-design.md
```

## ファイル構成

### 3D制作リポジトリ

| ファイル | 責務 |
| --- | --- |
| `package.json`、`package-lock.json` | 第3回の検証を残し、React、Vite、テスト、lintの依存とコマンドを固定する |
| `index.html` | ViteのエントリHTML |
| `vite.config.ts` | ReactプラグインとVitestの設定 |
| `tsconfig.json` | ブラウザ向けTypeScriptの厳格な型検査 |
| `eslint.config.js` | React、Hooks、TypeScriptのlint設定 |
| `public/models/server-room.glb` | 第3回GLBと同一内容のブラウザ用モデル |
| `src/types/server.ts` | サーバーID、状態、静的情報の型 |
| `src/data/servers.ts` | 14台分の静的な仮監視データ |
| `src/utils/objectName.ts` | クリックした名前を登録済みサーバーIDへ絞る |
| `src/utils/statusVisual.ts` | 状態ラベル、色、選択時発光の定数 |
| `src/three/serverRoomScene.ts` | シーン複製、個別マテリアル化、状態色の反映、解放 |
| `src/components/three/ServerRoomModel.tsx` | GLB読み込みとクリック通知 |
| `src/components/three/ServerRoomCanvas.tsx` | Canvas、カメラ、ライト、OrbitControls、読み込み表示 |
| `src/components/ModelErrorBoundary.tsx` | GLB読み込み失敗をDOMの案内へ変換 |
| `src/components/dashboard/ServerDetailsPanel.tsx` | 選択中サーバーの詳細と状態変更ボタン |
| `src/App.tsx` | 選択中IDと14台の状態を管理 |
| `src/App.css` | PC向け2カラムと狭い画面の縦並び |
| `src/test/setup.ts` | Testing Libraryの共通設定 |
| `tests/glb-contract.test.ts` | GLB名、監視データ、公開用コピー、ハッシュの契約テスト |

### ブログリポジトリ

| ファイル | 責務 |
| --- | --- |
| `src/content/blog/blender-server-room-04-react-dashboard.md` | 第4回の記事 |
| `src/content/blog/blender-server-room-03-glb.md` | 正常色の予告を灰色から緑へ合わせる |
| `src/assets/blog/blender-04-vite-initial.png` | React初期画面 |
| `src/assets/blog/blender-04-react-viewer.png` | GLB表示とダッシュボード全体 |
| `src/assets/blog/blender-04-server-selected.png` | サーバー選択と詳細パネル |
| `src/assets/blog/blender-04-alarm-state.png` | 選択サーバーだけが赤い状態兼heroImage |
| `tests/unit/blender-episode-04-article.test.ts` | 記事、画像、前後リンク、実装事実の検査 |
| `tests/e2e/home-content.spec.ts` | 最新4記事の順序 |
| `tests/e2e/listings.spec.ts` | 14記事の件数、順序、ページ分割 |
| `tests/unit/pagination.test.ts` | 14件を12件と2件へ分ける回帰テスト |
| `tests/unit/listings.test.ts` | 記事一覧モデルの14件分割 |
| `tests/e2e/visual.spec.ts-snapshots/*.png` | 最新記事カード変更後のホーム基準画像 |

### Task 1: 第3回から安全な第4回worktreeを作る

**Files:**
- Verify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard`
- Create worktree: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard`

- [ ] **Step 1: 通常worktreeの変更を記録し、触らない対象を確認する**

Run:

```sh
git -C /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard status --short --branch
```

Expected: `blender/episode-02-server-room.blend`の変更を表示する。この変更は以後のコマンド対象にしない。

- [ ] **Step 2: 第3回タグと成果物を確認する**

Run:

```sh
git -C /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard show --no-patch --oneline episode-03
git -C /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard ls-tree -r --name-only episode-03
```

Expected: `98207ba`と、`models/episode-03-server-room.glb`、`package.json`、検証スクリプト、レポートを表示する。

- [ ] **Step 3: 作業先が存在しないことを確認する**

Run:

```sh
test ! -e /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard
```

Expected: 終了コード0。存在する場合は再利用や削除をせず、状態を確認してから進める。

- [ ] **Step 4: `episode-03`から第4回用worktreeを作る**

Run:

```sh
git -C /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard worktree add \
  -b codex/episode-04-react-dashboard \
  /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard \
  episode-03
```

Expected: 新しいworktreeが`episode-03`と同じコミットから作られる。

- [ ] **Step 5: 第3回の検証を再実行する**

Run:

```sh
cd /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard
nvm use
npm ci
npm test
npm run validate:episode-03
python3 scripts/verify_episode_03.py models/episode-03-server-room.glb
```

Expected: Pythonテストが全件成功し、Validatorがerrors 0、warnings 0、構造検証が`EPISODE_03_OK`。

### Task 2: 既存の検証を残してViteとReactを追加する

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Reactと3D表示の依存を固定する**

Run:

```sh
npm install react@19.2.8 react-dom@19.2.8 three@0.185.1 \
  @react-three/fiber@9.6.1 @react-three/drei@10.7.7
npm install -D vite@8.1.5 @vitejs/plugin-react@6.0.4 \
  typescript@5.9.3 vitest@4.1.10 jsdom@30.0.1 \
  @testing-library/react@16.3.2 @testing-library/jest-dom \
  @testing-library/user-event @types/node@24 @types/react @types/react-dom @types/three \
  eslint@10.8.0 @eslint/js@10.0.1 typescript-eslint@8.65.0 \
  eslint-plugin-react-hooks@7.1.1 eslint-plugin-react-refresh@0.5.3 globals
```

Expected: peer dependency errorがなく、既存の`gltf-validator@2.0.0-dev.3.10`も残る。

- [ ] **Step 2: npm scriptsを統合する**

`package.json`の`scripts`を次にする。`validate:episode-03`のコマンドは変更しない。

```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "test:episode-03": "python3 -m unittest discover -s tests -p 'test_*.py' -v",
  "test:unit": "vitest run --passWithNoTests",
  "test": "npm run test:episode-03 && npm run test:unit",
  "validate:episode-03": "node scripts/validate_episode_03.mjs models/episode-03-server-room.glb reports/episode-03-server-room.validator.json"
}
```

- [ ] **Step 3: TypeScript、Vite、Vitestを設定する**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: ESLintを設定する**

`eslint.config.js`:

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
```

- [ ] **Step 5: 最小のVite画面を作る**

`index.html`は`#root`と`/src/main.tsx`だけを持つ。`src/main.tsx`は`createRoot`で`App`を描画し、開発時のマテリアル破棄を予測しやすくするため、この回では`StrictMode`で二重実行しない。

`src/App.tsx`:

```tsx
import './App.css';

export default function App() {
  return (
    <main className="app-shell">
      <h1>3D Server Room Dashboard</h1>
      <p>React Three Fiberの準備ができました。</p>
    </main>
  );
}
```

- [ ] **Step 6: 第1のスクリーンショットを撮る**

Run:

```sh
npm run dev -- --host 127.0.0.1
```

ブラウザで初期画面を1440×1000pxで開き、`.captures/episode-04/blender-04-vite-initial.png`として一時保存する。撮影タイミングをユーザーへ案内する。

- [ ] **Step 7: 既存検証と新しいツールチェーンを確認する**

Run:

```sh
npm run lint
npm test
npm run validate:episode-03
npm run build
```

Expected: 第3回のPythonテストとValidatorを含め、すべて終了コード0。

- [ ] **Step 8: ツールチェーンをコミットする**

```sh
git add package.json package-lock.json index.html tsconfig.json vite.config.ts \
  eslint.config.js src/main.tsx src/App.tsx src/App.css src/test/setup.ts
git diff --cached --check
git commit -m "chore: add React dashboard toolchain"
```

### Task 3: 14台の監視データと状態表示をテスト駆動で作る

**Files:**
- Create: `src/types/server.ts`
- Create: `src/data/servers.ts`
- Create: `src/data/servers.test.ts`
- Create: `src/utils/objectName.ts`
- Create: `src/utils/objectName.test.ts`
- Create: `src/utils/statusVisual.ts`
- Create: `src/utils/statusVisual.test.ts`

- [ ] **Step 1: 期待する型とデータの失敗テストを書く**

テストでは、次を先に要求する。

```ts
expect(SERVER_IDS).toHaveLength(14);
expect(new Set(SERVER_IDS).size).toBe(14);
expect(SERVERS.server_01_01).toMatchObject({
  name: 'Server 01-01',
  role: 'Web',
  ipAddress: '10.0.1.11',
});
expect(SERVERS.server_02_08).toMatchObject({
  name: 'Server 02-08',
  role: 'Backup',
  ipAddress: '10.0.2.18',
});
expect(toServerId('server_01_01')).toBe('server_01_01');
expect(toServerId('rack_01_frame_top')).toBeUndefined();
expect(STATUS_VISUALS.healthy).toEqual({ label: '正常', color: '#22C55E' });
expect(STATUS_VISUALS.critical).toEqual({ label: '障害', color: '#EF4444' });
```

- [ ] **Step 2: テストが未実装で失敗することを確認する**

Run:

```sh
npm run test:unit -- src/data/servers.test.ts src/utils/objectName.test.ts src/utils/statusVisual.test.ts
```

Expected: 対象モジュールが存在しないためFAIL。

- [ ] **Step 3: 型とIDを実装する**

`src/types/server.ts`:

```ts
export const SERVER_IDS = [
  'server_01_01', 'server_01_02', 'server_01_03', 'server_01_04',
  'server_01_05', 'server_01_06',
  'server_02_01', 'server_02_02', 'server_02_03', 'server_02_04',
  'server_02_05', 'server_02_06', 'server_02_07', 'server_02_08',
] as const;

export type ServerId = (typeof SERVER_IDS)[number];
export type ServerStatus = 'healthy' | 'critical';

export interface ServerInfo {
  id: ServerId;
  name: string;
  role: 'Web' | 'Application' | 'Worker' | 'Database' | 'Cache' | 'Monitoring' | 'Backup';
  ipAddress: string;
}
```

- [ ] **Step 4: 生成規則と変換処理を実装する**

`servers.ts`は`SERVER_IDS`から`Record<ServerId, ServerInfo>`を作る。ラック1は2台ずつ`Web`、`Application`、`Worker`、ラック2は2台ずつ`Database`、`Cache`、`Monitoring`、`Backup`とする。IP末尾はサーバー番号へ10を足す。

`toServerId`は正規表現だけで受け入れず、`SERVERS`に登録済みかを`hasOwn`で確認する。

`statusVisual.ts`:

```ts
export const STATUS_VISUALS = {
  healthy: { label: '正常', color: '#22C55E' },
  critical: { label: '障害', color: '#EF4444' },
} as const;

export const SELECTED_EMISSIVE = '#38BDF8';
export const SELECTED_EMISSIVE_INTENSITY = 0.45;
```

- [ ] **Step 5: テストを通す**

Run:

```sh
npm run test:unit -- src/data/servers.test.ts src/utils/objectName.test.ts src/utils/statusVisual.test.ts
```

Expected: 全テストPASS。

- [ ] **Step 6: 監視データをコミットする**

```sh
git add src/types src/data src/utils
git diff --cached --check
git commit -m "feat: add mock server monitoring data"
```

### Task 4: ブラウザ用GLBが第3回と同一であることを検査する

**Files:**
- Create: `tests/glb-contract.test.ts`
- Create: `public/models/server-room.glb`

- [ ] **Step 1: GLB契約の失敗テストを書く**

`tests/glb-contract.test.ts`はNodeの`readFile`と`createHash`を使い、GLBヘッダーの先頭JSONチャンクを読む。次を検査する。

```ts
expect(publicHash).toBe(sourceHash);
expect(serverNodeNames).toEqual([...SERVER_IDS]);
expect(serverNodeNames.every((name) => SERVERS[name])).toBe(true);
expect(document.nodes).toHaveLength(25);
expect(document.meshes).toHaveLength(25);
expect(document.materials.map(({ name }) => name)).toEqual([
  'mat_rack_dark_gray',
  'mat_floor_gray',
  'mat_wall_light_gray',
  'mat_server_gray',
]);
```

JSONチャンクの読み込みはテスト内ヘルパーに閉じ、アプリ本体へGLBパーサーを追加しない。

- [ ] **Step 2: 公開用GLBがなくて失敗することを確認する**

Run:

```sh
npm run test:unit -- tests/glb-contract.test.ts
```

Expected: `public/models/server-room.glb`の`ENOENT`でFAIL。

- [ ] **Step 3: 第3回GLBを公開用パスへコピーする**

```sh
mkdir -p public/models
cp models/episode-03-server-room.glb public/models/server-room.glb
```

- [ ] **Step 4: 契約テストと第3回Validatorを通す**

Run:

```sh
npm run test:unit -- tests/glb-contract.test.ts
shasum -a 256 models/episode-03-server-room.glb public/models/server-room.glb
npm run validate:episode-03
```

Expected: テストPASS、2つのSHA-256が一致、Validator errors 0・warnings 0。

- [ ] **Step 5: GLB契約をコミットする**

```sh
git add tests/glb-contract.test.ts public/models/server-room.glb
git diff --cached --check
git commit -m "test: preserve the episode three GLB contract"
```

### Task 5: サーバーごとのマテリアル複製と状態色をテスト駆動で作る

**Files:**
- Create: `src/three/serverRoomScene.ts`
- Create: `src/three/serverRoomScene.test.ts`

- [ ] **Step 1: 共有マテリアルの回帰テストを書く**

Three.jsで2個のMeshに同じ`MeshStandardMaterial`を割り当て、次を検査する。

```ts
const sourceMaterial = new MeshStandardMaterial({ color: '#4A5562' });
const scene = new Group();
const first = new Mesh(new BoxGeometry(), sourceMaterial);
first.name = 'server_01_01';
const second = new Mesh(new BoxGeometry(), sourceMaterial);
second.name = 'server_01_02';
scene.add(first, second);

const prepared = prepareServerRoomScene(scene);
const firstMaterials = prepared.materials.server_01_01;
const secondMaterials = prepared.materials.server_01_02;
if (!firstMaterials || !secondMaterials) {
  throw new Error('Expected prepared materials for both test servers');
}
expect(firstMaterials[0]).not.toBe(secondMaterials[0]);

const statuses = Object.fromEntries(
  SERVER_IDS.map((id) => [id, 'healthy']),
) as Record<ServerId, ServerStatus>;
statuses.server_01_01 = 'critical';
applyServerVisuals(prepared.materials, statuses, 'server_01_01');

expect(firstMaterials[0].color.getHexString()).toBe('ef4444');
expect(secondMaterials[0].color.getHexString()).toBe('22c55e');
expect(firstMaterials[0].emissive.getHexString()).toBe('38bdf8');
expect(secondMaterials[0].emissiveIntensity).toBe(0);
```

ラックMeshは元マテリアルを維持すること、`disposePreparedScene`が複製マテリアルを解放することもspyで確認する。

- [ ] **Step 2: 未実装で失敗することを確認する**

Run:

```sh
npm run test:unit -- src/three/serverRoomScene.test.ts
```

Expected: `serverRoomScene`が存在せずFAIL。

- [ ] **Step 3: シーン準備と状態反映を実装する**

公開インターフェースは次に限定する。

```ts
export interface PreparedServerRoom {
  root: Object3D;
  materials: Partial<Record<ServerId, MeshStandardMaterial[]>>;
}

export function prepareServerRoomScene(source: Object3D): PreparedServerRoom;
export function applyServerVisuals(
  materials: PreparedServerRoom['materials'],
  statuses: Record<ServerId, ServerStatus>,
  selectedId?: ServerId,
): void;
export function disposePreparedScene(prepared: PreparedServerRoom): void;
```

`prepareServerRoomScene`は`source.clone(true)`後に登録済みサーバーMeshだけを走査し、単一・配列の両方のマテリアルを個別にcloneする。現在のGLBが`MeshStandardMaterial`以外を返した場合は、オブジェクト名を含む明示的なエラーを投げる。

- [ ] **Step 4: テストを通す**

Run:

```sh
npm run test:unit -- src/three/serverRoomScene.test.ts
```

Expected: 全テストPASS。

- [ ] **Step 5: マテリアル制御をコミットする**

```sh
git add src/three
git diff --cached --check
git commit -m "feat: isolate server status materials"
```

### Task 6: 詳細パネルをテスト駆動で作る

**Files:**
- Create: `src/components/dashboard/ServerDetailsPanel.tsx`
- Create: `src/components/dashboard/ServerDetailsPanel.test.tsx`

- [ ] **Step 1: 未選択、正常、障害の失敗テストを書く**

Testing Libraryで次を検査する。

- 未選択時は「3D画面からサーバーを選択してください」を表示する。
- `server_01_01`選択時に名前、ID、`Web`、`10.0.1.11`、`正常`を表示する。
- 正常時は「正常に戻す」がdisabled、「アラーム発生」がenabled。
- 「アラーム発生」を押すと`onStatusChange('server_01_01', 'critical')`を1回呼ぶ。
- 障害時はボタンのenabled/disabledが逆になる。

- [ ] **Step 2: 未実装で失敗することを確認する**

Run:

```sh
npm run test:unit -- src/components/dashboard/ServerDetailsPanel.test.tsx
```

Expected: コンポーネントが存在せずFAIL。

- [ ] **Step 3: セマンティックな詳細パネルを実装する**

`aside`へ`aria-label="サーバー詳細"`を付け、状態には`role="status"`と日本語ラベルを使う。ボタンは現在と同じ状態への操作をdisabledにする。色だけに依存しない。

- [ ] **Step 4: テストを通す**

Run:

```sh
npm run test:unit -- src/components/dashboard/ServerDetailsPanel.test.tsx
```

Expected: 全テストPASS。

- [ ] **Step 5: 詳細パネルをコミットする**

```sh
git add src/components/dashboard
git diff --cached --check
git commit -m "feat: add server details controls"
```

### Task 7: GLB表示、選択、アラーム状態をReactでつなぐ

**Files:**
- Create: `src/components/three/ServerRoomModel.tsx`
- Create: `src/components/three/ServerRoomCanvas.tsx`
- Create: `src/components/ModelErrorBoundary.tsx`
- Create: `src/components/ModelErrorBoundary.test.tsx`
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Error Boundaryの失敗テストを書く**

子コンポーネントが`throw new Error('load failed')`したとき、次を表示するテストを書く。

```text
3Dモデルを読み込めませんでした
/models/server-room.glb
```

- [ ] **Step 2: Appの状態連携を失敗テストで定義する**

`ServerRoomCanvas`をmockし、`server_01_01`を選択するボタンとして描画する。選択後に詳細パネルからアラームを発生させ、mockへ渡った`statuses.server_01_01`が`critical`になること、正常復帰で`healthy`になることを確認する。

- [ ] **Step 3: テストが失敗することを確認する**

Run:

```sh
npm run test:unit -- src/components/ModelErrorBoundary.test.tsx src/App.test.tsx
```

Expected: 対象実装がないためFAIL。

- [ ] **Step 4: `ServerRoomModel`を実装する**

`useGLTF('/models/server-room.glb')`で読み込む。`useMemo`で`prepareServerRoomScene`を1回呼び、`statuses`または`selectedId`が変わるたびに`applyServerVisuals`を呼ぶ。

`primitive`の`onClick`では、`event.object.name`を`toServerId`へ渡す。登録済みサーバーだけ`stopPropagation()`して`onSelect`を呼ぶ。コンポーネント破棄時は`disposePreparedScene`を呼ぶ。

- [ ] **Step 5: Canvasと読み込み表示を実装する**

`ServerRoomCanvas`は次を持つ。

- `camera={{ position: [4.8, 4.5, 4.2], fov: 45 }}`
- `ambientLight`と`directionalLight`
- `Suspense`とDreiの`Html`による「3Dモデルを読み込んでいます」
- `OrbitControls`の回転、ズーム、パン
- `minDistance`、`maxDistance`、`target`を固定し、モデルを見失いにくくする

値は実機表示で調整するが、調整理由と最終値を`docs/learning-log.md`へ記録する。

- [ ] **Step 6: Appの状態管理を実装する**

初期状態は14台すべて`healthy`とする。

```ts
const initialStatuses = Object.fromEntries(
  SERVER_IDS.map((id) => [id, 'healthy']),
) as Record<ServerId, ServerStatus>;
```

左に`ModelErrorBoundary`で囲んだ`ServerRoomCanvas`、右に`ServerDetailsPanel`を置く。状態更新は選択された1台のキーだけを置き換える。

- [ ] **Step 7: テスト、lint、buildを通す**

Run:

```sh
npm run test:unit -- src/components/ModelErrorBoundary.test.tsx src/App.test.tsx
npm run lint
npm test
npm run build
```

Expected: 全コマンド終了コード0。第3回Pythonテストも`npm test`内で成功する。

- [ ] **Step 8: 3D連携をコミットする**

```sh
git add src/components src/App.tsx src/App.test.tsx
git diff --cached --check
git commit -m "feat: connect server selection and alarms"
```

### Task 8: ダッシュボードを整え、ブラウザで操作を確認する

**Files:**
- Modify: `src/App.css`
- Modify if required: `src/components/three/ServerRoomCanvas.tsx`

- [ ] **Step 1: PC向け2カラムを実装する**

1440×1000pxで左70%、右30%を基本にする。3D領域には十分な高さを確保し、詳細パネルは状態バッジと2ボタンを縦に並べる。色は文字ラベルと併用し、フォーカスリングを消さない。

- [ ] **Step 2: 狭い画面では上下に並べる**

900px以下で1カラムへ切り替える。390pxで横スクロールがないことだけを確認し、モバイルの3Dジェスチャー最適化は追加しない。

- [ ] **Step 3: 開発サーバーを起動して実機確認する**

Run:

```sh
npm run dev -- --host 127.0.0.1
```

ブラウザで次を順に確認する。

1. GLBが表示される。
2. 回転とズームができる。
3. `server_01_01`を選択できる。
4. 詳細パネルが`Web`と`10.0.1.11`を表示する。
5. アラーム発生で選択中の1台だけが赤くなる。
6. 正常に戻すと緑へ戻る。
7. `server_02_08`も選択できる。
8. コンソールに未処理エラーがない。

- [ ] **Step 4: 読み込み失敗時の表示を確認する**

コードやGLBを移動せず、ブラウザ開発時だけモデルURLを一時的に存在しないパスへ差し替えてエラー表示を確認する。確認後は必ず元へ戻し、`git diff`が意図したCSS以外を含まないことを確認する。

- [ ] **Step 5: 記事用の完成画像を撮る**

1440×1000pxを基準に、次を撮る。各タイミングでユーザーへ案内する。

- `.captures/episode-04/blender-04-react-viewer.png`: 未選択の全体画面
- `.captures/episode-04/blender-04-server-selected.png`: `server_01_01`を選択した画面
- `.captures/episode-04/blender-04-alarm-state.png`: `server_01_01`だけが赤い画面

- [ ] **Step 6: ブラウザ確認後の全検証を実行する**

Run:

```sh
npm run lint
npm test
npm run validate:episode-03
npm run build
git diff --check
```

Expected: すべて終了コード0。

- [ ] **Step 7: UI調整をコミットする**

```sh
git add src/App.css src/components/three/ServerRoomCanvas.tsx
git diff --cached --check
git commit -m "style: finish the 3D monitoring dashboard"
```

### Task 9: 第4回の学習記録と配布状態を完成させる

**Files:**
- Modify: `README.md`
- Modify: `docs/learning-log.md`

- [ ] **Step 1: 実際に使った環境と操作を学習ログへ記録する**

次を事実として記録する。

- Node.js、React、Vite、React Three Fiber、Dreiの実バージョン
- 起動、build、検証コマンド
- カメラ、ライト、OrbitControlsの最終値
- 共有マテリアルで全台の色が変わる問題と、個別cloneによる解決
- クリック対象をオブジェクト名で識別した方法
- 読み込み失敗時の確認結果
- ユーザーが回転、ズーム、選択、アラーム、正常復帰を確認した結果

- [ ] **Step 2: READMEへEpisode 04を追加する**

成果物、起動方法、完成状態、検証コマンドを追加する。AWSや実データとは未接続であることを明記する。

- [ ] **Step 3: 全検証を再実行する**

Run:

```sh
npm run lint
npm test
npm run validate:episode-03
npm run build
git diff --check
```

Expected: すべて終了コード0。

- [ ] **Step 4: 記録をコミットする**

```sh
git add README.md docs/learning-log.md
git diff --cached --check
git commit -m "docs: record episode four learning results"
```

- [ ] **Step 5: タグを付ける前にクリーン状態を確認する**

Run:

```sh
git status --short --branch
git log -1 --oneline
```

Expected: 未コミット変更なし。

- [ ] **Step 6: 第4回タグを付ける**

```sh
git tag -a episode-04 -m "Episode 04: interactive React monitoring dashboard"
git show --no-patch episode-04
```

Expected: `episode-04`が記録コミットを指す。

### Task 10: 記事画像と記事の失敗テストをブログへ追加する

**Files:**
- Create: `src/assets/blog/blender-04-vite-initial.png`
- Create: `src/assets/blog/blender-04-react-viewer.png`
- Create: `src/assets/blog/blender-04-server-selected.png`
- Create: `src/assets/blog/blender-04-alarm-state.png`
- Create: `tests/unit/blender-episode-04-article.test.ts`

- [ ] **Step 1: 4枚の画像をブログのassetsへコピーする**

`/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard/.captures/episode-04/`から4枚を`src/assets/blog/`へコピーし、長辺1440px以下、各画像500KB以下を目安に最適化する。元画像は確認が終わるまで削除しない。

- [ ] **Step 2: 画像と記事構造の失敗テストを書く**

テストでは、まだ存在しない記事に次を要求する。

- frontmatterのtitle、description、`category: Frontend`、BlenderとReactのtags
- `draft: true`
- heroImageが`blender-04-alarm-state.png`
- 本文画像4枚と重複しないalt
- 画像ごとのcaption
- 第1〜3回への内部リンク
- `useGLTF`、`OrbitControls`、`event.object.name`、`material.clone()`の説明
- 正常`#22C55E`、障害`#EF4444`
- 「アラーム発生」と「正常に戻す」
- Production buildの確認結果
- AWSやCloudWatchへ未接続であること

第3回記事の「正常なサーバーは灰色」が残っていないことも検査する。

- [ ] **Step 3: 記事が存在せず失敗することを確認する**

Run:

```sh
npm test -- tests/unit/blender-episode-04-article.test.ts
```

Expected: 記事ファイルの`ENOENT`でFAIL。

- [ ] **Step 4: 画像とテストをコミットする**

テストがREDであることを記録したうえで、画像とテストを先にコミットする。

```sh
git add src/assets/blog/blender-04-*.png tests/unit/blender-episode-04-article.test.ts
git diff --cached --check
git commit -m "test: define Blender episode four article"
```

### Task 11: 実体験から第4回の記事下書きを作る

**Files:**
- Create: `src/content/blog/blender-server-room-04-react-dashboard.md`
- Modify: `src/content/blog/blender-server-room-03-glb.md`

- [ ] **Step 1: `@natural-japanese quick`で記事を書く**

です・ます調を使い、大げさな表現を避ける。AIに相談できることで3DとWeb 3Dへのハードルが下がり、勉強を始めたという連載の導入を維持する。

記事は次の順にする。

1. 今回作るもの
2. 第3回のGLBをReactへ配置する
3. Vite、React Three Fiber、Dreiの準備
4. `useGLTF`で表示する
5. OrbitControlsで回転・ズームする
6. オブジェクト名からサーバーを選択する
7. 詳細パネルへ仮データを表示する
8. 共有マテリアルを複製する
9. アラームで緑から赤へ変える
10. 読み込み失敗とProduction buildを確認する
11. 4回連載のまとめ

コードは理解に必要な抜粋だけを載せ、生成した全ファイルを転載しない。実際に起きていない失敗や推測は追加しない。

- [ ] **Step 2: 第3回の予告を実装結果へ合わせる**

次の文だけを意味が変わらない範囲で更新する。

```text
正常なサーバーは緑、アラーム中のサーバーは赤色
```

- [ ] **Step 3: 記事テストをGREENにする**

Run:

```sh
npm test -- tests/unit/blender-episode-04-article.test.ts
```

Expected: 全テストPASS。

- [ ] **Step 4: 日本語lintとMarkdown整形を確認する**

Run:

```sh
uv run .agents/skills/natural-japanese/scripts/lint.py --json --genre tech \
  src/content/blog/blender-server-room-04-react-dashboard.md
npx prettier --check src/content/blog/blender-server-room-04-react-dashboard.md \
  src/content/blog/blender-server-room-03-glb.md \
  tests/unit/blender-episode-04-article.test.ts
```

Expected: 日本語lintの未判断findingがなく、Prettier PASS。

- [ ] **Step 5: 下書き状態でブログ全体を検証する**

Run:

```sh
npm run check
npm test
npm run build
```

Expected: `draft: true`の第4回を一覧へ出さず、全コマンド終了コード0。

- [ ] **Step 6: 記事下書きをコミットする**

```sh
git add src/content/blog/blender-server-room-04-react-dashboard.md \
  src/content/blog/blender-server-room-03-glb.md
git diff --cached --check
git commit -m "docs: draft Blender server room episode four"
```

### Task 12: 記事をブラウザで確認して公開状態へ切り替える

**Files:**
- Modify: `src/content/blog/blender-server-room-04-react-dashboard.md`
- Modify: `tests/e2e/home-content.spec.ts`
- Modify: `tests/e2e/listings.spec.ts`
- Modify: `tests/unit/blender-episode-04-article.test.ts`
- Modify: `tests/unit/pagination.test.ts`
- Modify: `tests/unit/listings.test.ts`
- Modify as required: `tests/e2e/visual.spec.ts-snapshots/home-*.png`

- [ ] **Step 1: 下書き記事をローカルで直接確認できる状態にする**

公開前確認用に一時的に`draft: false`へ変更してローカルサーバーを起動する。公開時刻はまだ確定しない。

Run:

```sh
npm run dev -- --host 127.0.0.1
```

記事ページをdesktop 1440pxとmobile 390pxで確認する。

- [ ] **Step 2: 記事表示を目視確認する**

次を確認する。

- title、description、公開日
- 4枚の画像、alt、caption
- コードブロックと色コード
- 第1〜3回への内部リンク
- 目次
- 横スクロールがない
- 画像と記事が同じ完成状態を示す

修正が必要なら記事を直し、Task 11の日本語lintとテストを再実行する。

- [ ] **Step 3: 公開時刻を確定する**

JSTの現在時刻をISO 8601形式で取得し、`publishedAt`へ設定する。`draft: false`を確定する。

- [ ] **Step 4: 14記事の失敗テストへ更新する**

期待値を次へ変更する。

- 最新4記事: 第4回、第3回、第2回、第1回
- 一覧: `14件の記事`
- 1ページ目: 12件
- 2ページ目: 2件
- paginationの入力: 14件、末尾`[13, 14]`
- 第4回記事テストのfrontmatter期待値: `draft: false`

Run:

```sh
npm test -- tests/unit/pagination.test.ts tests/unit/listings.test.ts
npx playwright test tests/e2e/home-content.spec.ts tests/e2e/listings.spec.ts
```

Expected: 記事公開により旧期待値または未更新箇所がFAILし、更新後はPASS。

- [ ] **Step 5: ホームのvisual goldenを必要な範囲だけ更新する**

Run:

```sh
npx playwright test tests/e2e/visual.spec.ts --update-snapshots
```

3枚の差分を画像で確認し、最新記事カードの変更以外にレイアウト崩れがないことを確かめる。無関係な差分があればgoldenを採用せず原因を直す。

- [ ] **Step 6: 公開前の全検証を実行する**

Run:

```sh
npm run format:check
npm run check
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: Unit、Astro check、build、E2Eがすべて成功する。

- [ ] **Step 7: 公開状態をコミットする**

```sh
git add src/content/blog/blender-server-room-04-react-dashboard.md \
  src/content/blog/blender-server-room-03-glb.md \
  tests/e2e/home-content.spec.ts tests/e2e/listings.spec.ts \
  tests/unit/blender-episode-04-article.test.ts \
  tests/unit/pagination.test.ts tests/unit/listings.test.ts \
  tests/e2e/visual.spec.ts-snapshots
git diff --cached --check
git commit -m "docs: publish Blender server room episode four"
```

### Task 13: 最終照合と公開準備を行う

**Files:**
- Verify: 3D制作リポジトリ全体
- Verify: ブログリポジトリ全体

- [ ] **Step 1: 3D制作物をタグから再検証する**

Run:

```sh
cd /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.worktrees/episode-04-react-dashboard
git status --short --branch
npm ci
npm run lint
npm test
npm run validate:episode-03
npm run build
git show --no-patch episode-04
```

Expected: 作業ツリーがクリーンで、全検証が成功し、`episode-04`がHEADを指す。

- [ ] **Step 2: ブログをクリーンインストールから再検証する**

Run:

```sh
cd /Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-04-design
npm ci
npm run verify
git status --short --branch
```

Expected: Unit、Astro check、build、E2Eが成功し、設計書・計画書を含む意図したコミットだけがある。

- [ ] **Step 3: 記事と成果物を照合する**

次を1項目ずつ確認する。

- 記事のGLB名と実際の`public/models/server-room.glb`
- 14台のID、役割、IPアドレス
- 正常と障害の色コード
- スクリーンショットの選択サーバー
- テスト、build、Validatorの実測結果
- README、学習ログ、記事のコマンド
- 第3回記事の正常色

- [ ] **Step 4: GitHubへ出す差分を確認する**

Run:

```sh
git diff origin/main...HEAD --stat
git diff origin/main...HEAD --check
git log --oneline origin/main..HEAD
```

Expected: 第4回の設計、計画、記事、画像、記事一覧テストだけを含む。3D制作リポジトリのGLBやReactコードは、別リポジトリのローカル成果物としてブログPRへ混ぜない。

- [ ] **Step 5: ユーザー承認後にブログブランチをpushしてPRを作る**

PR本文には次を記載する。

- 第4回記事と4枚の画像
- 第3回の正常色予告の修正
- 14記事に対応した一覧とテスト更新
- 3D制作側の`episode-04`タグ
- 実行した検証と結果

PR作成後はCIを確認し、ユーザーの指示を受けてマージ・公開する。
