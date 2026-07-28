# Blender 3Dサーバールーム連載 第1回 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** macOS版Blenderを初めて使い、Cubeだけでサーバーラックを1台作り、実体験に基づく連載第1回の下書きを完成させる。

**Architecture:** 3D制作物は新しい`3d-server-room-dashboard`リポジトリで管理し、記事本文と公開用画像は既存の`tech-blog`リポジトリで管理する。Blender操作はユーザーが行い、数値とオブジェクト名はヘッドレス検証スクリプトで確認する。記事は操作後の学習ログを一次情報として書き、未確認の手順や推測を混ぜない。

**Tech Stack:** Blender安定版（macOS Apple Silicon）、Blender Python API、Git、Astro Content Collections、Markdown

---

## 0. 実行前提

- 設計書: `docs/superpowers/specs/2026-07-28-blender-server-room-series-design.md`
- ブログリポジトリ: `/Users/hiroshiimaizumi/Documents/tech blog 2`
- 新規制作リポジトリ: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard`
- ブログ作業ブランチ: `codex/blender-episode-01`
- 制作作業ブランチ: `codex/episode-01-rack`
- Blender UI: 初期状態の英語UIを使用し、日本語記事では英語のメニュー名と日本語の説明を併記する
- 第1回の範囲: Blender導入、基本操作、ラック1台、学習ログ、記事下書き
- 第2回以降の床、壁、マテリアル、照明、GLB出力、Reactは扱わない
- GitHubリポジトリ作成、remote追加、push、Web公開はこの計画に含めない

この計画はユーザー自身のBlender操作を含むため、実行時はInline Executionを推奨する。Blenderの画面操作が必要なステップでは、Codexは次の操作と確認点を提示し、ユーザーの完了報告を待ってから進む。

## 1. ファイル構成

### `3d-server-room-dashboard`

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/
├─ .gitignore
├─ README.md
├─ blender/
│  └─ episode-01-rack.blend
├─ docs/
│  └─ learning-log.md
└─ scripts/
   └─ verify_episode_01.py
```

- `.gitignore`: macOSファイルとBlenderの自動バックアップを除外する。
- `README.md`: プロジェクト目的、使用環境、各回の成果物、検証方法を記録する。
- `blender/episode-01-rack.blend`: 第1回で作るラックの編集可能なBlenderファイル。
- `docs/learning-log.md`: 実際に使った操作、迷った点、確認結果、画像対応を記録する。
- `scripts/verify_episode_01.py`: Blenderをヘッドレス起動し、オブジェクト名、位置、寸法を検査する。

### `tech-blog`

```text
/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/
├─ src/assets/blog/
│  ├─ blender-01-ui-overview.png
│  ├─ blender-01-transform-panel.png
│  ├─ blender-01-rack-frame.png
│  ├─ blender-01-server-duplication.png
│  └─ blender-01-completed-rack.png
└─ src/content/blog/
   └─ blender-server-room-01-rack.md
```

- 画像5枚はmacOS上の実際のBlender画面から取得する。
- `blender-01-completed-rack.png`を記事の`heroImage`にも使用する。
- 記事は`draft: true`で作成し、この計画では公開しない。

## Task 1: Blender環境と制作リポジトリを準備する

**Files:**

- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.gitignore`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/README.md`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/docs/learning-log.md`

- [ ] **Step 1: ブログ用の専用worktreeを作成する**

実行開始前に、計画書と設計書が現在のHEADに含まれることを確認する。

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/tech blog 2"
git cat-file -e HEAD:docs/superpowers/specs/2026-07-28-blender-server-room-series-design.md &&
  git cat-file -e HEAD:docs/superpowers/plans/2026-07-28-blender-server-room-episode-01.md
```

Expected: どちらも出力なし、終了コード`0`。

計画書が未追跡または未コミットなら、worktreeを作らず停止する。実行計画の引き渡し時点では、計画書を意図的にコミット済みにしておく。

確認後、`superpowers:using-git-worktrees`を使用し、現在のHEADから`codex/blender-episode-01`ブランチを作る。worktreeは次へ作成する。

```text
/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01
```

ユーザーの未追跡ファイル`.agents/`と`skills-lock.json`は移動、削除、コミットしない。

Expected: ブログ記事、画像、検証が専用worktreeだけで行われる。

- [ ] **Step 2: 制作リポジトリの作成先が空いていることを確認する**

Run:

```bash
test ! -e "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
```

Expected: 出力なし、終了コード`0`。

パスが存在する場合は上書きせず、内容を確認してユーザーへ報告する。

- [ ] **Step 3: 既存のBlenderがないことを確認する**

Run:

```bash
if [ -e /Applications/Blender.app ]; then
  defaults read /Applications/Blender.app/Contents/Info CFBundleShortVersionString
else
  echo "BLENDER_NOT_INSTALLED"
fi
```

Expected: 現在の環境では`BLENDER_NOT_INSTALLED`。

既存の`/Applications/Blender.app`がある場合は上書きしない。バージョンをユーザーへ示し、既存版を使うか、別名で併存させるか、明示的に更新するかを確認してから進む。

- [ ] **Step 4: Blender公式サイトからmacOS Apple Silicon版の安定版を導入する**

確認先:

- `https://www.blender.org/download/`
- `https://www.blender.org/download/requirements/`
- `https://docs.blender.org/manual/en/latest/getting_started/installing/macos.html`

実行時に公式ダウンロード画面で`Stable`または`LTS`と表示される版を選び、Daily、Alpha、Beta、Release Candidateは選ばない。DMGを開き、`Blender.app`を`/Applications`へ移動する。2026-07-28時点ではBlender 5.2 LTSが候補だが、記事とログには実際にインストールして確認したバージョンを記載する。

- [ ] **Step 5: BlenderとmacOSの実バージョンを確認する**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --version | head -1
sw_vers -productVersion
uname -m
```

Expected:

- 1行目が`Blender `で始まる。
- macOSバージョンが1行で表示される。
- CPUアーキテクチャが`arm64`と表示される。

Blenderが初回確認ダイアログを表示する場合は、Finderから一度起動してmacOSの確認を完了してから再実行する。

- [ ] **Step 6: 新規ローカルリポジトリを初期化する**

Run:

```bash
mkdir -p "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/docs"
mkdir -p "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender"
mkdir -p "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/scripts"
git init -b main "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
git -C "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard" switch -c codex/episode-01-rack
```

Expected:

- Gitリポジトリが初期化される。
- 現在のブランチが`codex/episode-01-rack`になる。

- [ ] **Step 7: `.gitignore`を作成する**

Create `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.gitignore`:

```gitignore
.DS_Store
*.blend1
*.blend2
*.blend@
```

- [ ] **Step 8: `README.md`を作成する**

Create `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/README.md`:

```markdown
# 3D Server Room Dashboard

Blender未経験から3Dサーバールームを作り、Reactで監視画面へ発展させる学習プロジェクトです。

## Episode 01

Cubeを使ってサーバーラックを1台作ります。

成果物:

- `blender/episode-01-rack.blend`

検証:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-01-rack.blend \
  --python scripts/verify_episode_01.py
```
```

- [ ] **Step 9: 学習ログの初期形を作成する**

Create `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/docs/learning-log.md`:

```markdown
# Learning Log

## Episode 01: Cubeでサーバーラックを作る

### 環境

- macOS:
- Blender:
- CPU: Apple Silicon
- 入力機器:

### 完成条件

- ラックのフレームが4個のCubeで構成されている。
- サーバーが6台ある。
- オブジェクト名、位置、寸法が検証スクリプトと一致する。
- 保存後にファイルを開き直せる。

### 実際に使った操作

作業中に、操作名、ショートカット、メニュー位置を事実だけ追記する。

### 迷った点

症状、原因、解決方法がそろったものだけ追記する。

### スクリーンショット

撮影した画像と、記事内で説明する内容の対応を追記する。

### 確認結果

保存、再オープン、検証スクリプトの結果を追記する。
```

- [ ] **Step 10: 実バージョンと入力機器を学習ログへ記録する**

`docs/learning-log.md`の空欄へStep 5の結果を記入する。入力機器は実際に使うものを`3ボタンマウス`、`Magic Mouse`、`トラックパッド`のいずれかで記録する。Magic Mouseまたはトラックパッドを使う場合は、Blenderの`Preferences > Input > Emulate 3 Button Mouse`を有効にしたかどうかも記録する。

- [ ] **Step 11: 初期ファイルをコミットする**

Run:

```bash
git -C "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard" add .gitignore README.md docs/learning-log.md
git -C "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard" diff --cached --check
git -C "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard" commit -m "chore: initialize 3D server room project"
```

Expected: コミットが1件作成される。

## Task 2: 完成条件を検査するスクリプトを先に作る

**Files:**

- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/scripts/verify_episode_01.py`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-01-rack.blend`

- [ ] **Step 1: ラックの期待値を検査するスクリプトを書く**

Create `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/scripts/verify_episode_01.py`:

```python
import math

import bpy


EXPECTED = {
    "rack_01_frame_left": {
        "location": (-0.36, 0.0, 1.0),
        "dimensions": (0.08, 1.0, 2.0),
    },
    "rack_01_frame_right": {
        "location": (0.36, 0.0, 1.0),
        "dimensions": (0.08, 1.0, 2.0),
    },
    "rack_01_frame_top": {
        "location": (0.0, 0.0, 1.96),
        "dimensions": (0.8, 1.0, 0.08),
    },
    "rack_01_frame_bottom": {
        "location": (0.0, 0.0, 0.04),
        "dimensions": (0.8, 1.0, 0.08),
    },
    "server_01_01": {
        "location": (0.0, -0.03, 0.2),
        "dimensions": (0.64, 0.9, 0.12),
    },
    "server_01_02": {
        "location": (0.0, -0.03, 0.4),
        "dimensions": (0.64, 0.9, 0.12),
    },
    "server_01_03": {
        "location": (0.0, -0.03, 0.6),
        "dimensions": (0.64, 0.9, 0.12),
    },
    "server_01_04": {
        "location": (0.0, -0.03, 0.8),
        "dimensions": (0.64, 0.9, 0.12),
    },
    "server_01_05": {
        "location": (0.0, -0.03, 1.0),
        "dimensions": (0.64, 0.9, 0.12),
    },
    "server_01_06": {
        "location": (0.0, -0.03, 1.2),
        "dimensions": (0.64, 0.9, 0.12),
    },
}

EXPECTED_MESHES = set(EXPECTED)


def close_tuple(actual, expected):
    return all(
        math.isclose(actual_value, expected_value, abs_tol=0.001)
        for actual_value, expected_value in zip(actual, expected, strict=True)
    )


errors = []

unit_settings = bpy.context.scene.unit_settings
if unit_settings.system != "METRIC":
    errors.append(f"unit system: expected METRIC, got {unit_settings.system}")
if not math.isclose(unit_settings.scale_length, 1.0, abs_tol=0.001):
    errors.append(
        f"unit scale: expected 1.0, got {round(unit_settings.scale_length, 3)}"
    )
if unit_settings.length_unit != "METERS":
    errors.append(f"length unit: expected METERS, got {unit_settings.length_unit}")

actual_meshes = {
    object_3d.name for object_3d in bpy.data.objects if object_3d.type == "MESH"
}
unexpected_meshes = sorted(actual_meshes - EXPECTED_MESHES)
if unexpected_meshes:
    errors.append(f"unexpected Mesh objects: {', '.join(unexpected_meshes)}")

for object_name, expected in EXPECTED.items():
    object_3d = bpy.data.objects.get(object_name)
    if object_3d is None:
        errors.append(f"missing object: {object_name}")
        continue

    if object_3d.type != "MESH":
        errors.append(f"{object_name}: expected MESH, got {object_3d.type}")

    if not close_tuple(object_3d.location, expected["location"]):
        errors.append(
            f"{object_name}: location={tuple(round(value, 3) for value in object_3d.location)}"
        )

    if not close_tuple(object_3d.dimensions, expected["dimensions"]):
        errors.append(
            f"{object_name}: dimensions={tuple(round(value, 3) for value in object_3d.dimensions)}"
        )

if errors:
    raise SystemExit("EPISODE_01_FAILED\n" + "\n".join(errors))

print("EPISODE_01_OK")
```

- [ ] **Step 2: Blenderを起動し、初期設定を確定する**

Run:

```bash
open -a Blender
```

Blenderの初回画面では、次を選ぶ。

- Language: `English`
- Shortcuts: `Blender`
- Select With: `Left`
- Spacebar: `Play`

既に初回画面を通過している場合は、`Blender > Settings`で同じ状態を確認する。テーマなど、この記事に不要な設定は変更しない。

- [ ] **Step 3: シーン単位をMetricに変更する**

Blenderの`Scene Properties > Units`で次を設定する。

- Unit System: `Metric`
- Unit Scale: `1.000000`
- Length: `Meters`

- [ ] **Step 4: 回転、移動、ズームを一度ずつ練習する**

3D Viewportへポインターを置き、次を一度ずつ行う。

3ボタンマウス:

- 回転: 中ボタンドラッグ
- 移動: `Shift`を押しながら中ボタンドラッグ
- ズーム: ホイール、または`Control`を押しながら中ボタンドラッグ

`Emulate 3 Button Mouse`を有効にしたMagic Mouseまたはトラックパッド:

- 回転: `Option`を押しながら左ドラッグ
- 移動: `Shift + Option`を押しながら左ドラッグ
- ズーム: `Control + Option`を押しながら左ドラッグ

操作後に`Home`、または`View > Frame All`でCube全体が見える状態へ戻す。実際に使用できた入力方法を`docs/learning-log.md`の`実際に使った操作`へ記録する。

- [ ] **Step 5: 初期画面を撮影する**

3D Viewport、Outliner、Propertiesが分かる範囲へBlenderウィンドウを整える。既存ファイルとの衝突を確認してから、macOS標準の対話型キャプチャを実行する。

Run:

```bash
target="/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-ui-overview.png"
if [ -e "$target" ]; then
  echo "Refusing to overwrite: $target" >&2
  exit 1
fi
/usr/sbin/screencapture -i "$target" || exit 1
test -s "$target"
```

画像には、個人情報、他アプリの通知、不要なウィンドウを含めない。

- [ ] **Step 6: デフォルトCubeだけを残す**

Outlinerで`Camera`と`Light`を一つずつ選択し、`X`で削除する。Cubeは削除しない。

- [ ] **Step 7: 最初の`.blend`を保存する**

`File > Save As`を使い、次へ保存する。

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-01-rack.blend
```

- [ ] **Step 8: 検証が失敗することを確認する**

Blenderを一度終了してから実行する。

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-01-rack.blend \
  --python scripts/verify_episode_01.py
```

Expected: 終了コードが`0`以外で、`EPISODE_01_FAILED`と不足オブジェクト名が表示される。

- [ ] **Step 9: 検証スクリプトと初期`.blend`をコミットする**

Run:

```bash
git add scripts/verify_episode_01.py blender/episode-01-rack.blend
git diff --cached --check
git commit -m "test: define episode 01 rack geometry"
```

Expected: コミットが作成される。

## Task 3: 4個のCubeでラックのフレームを作る

**Files:**

- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-01-rack.blend`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-transform-panel.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-rack-frame.png`

- [ ] **Step 1: `.blend`を開き、正面が分かる視点にする**

Finderまたは`File > Open`から`episode-01-rack.blend`を開く。テンキーがある場合は`Numpad 1`、ない場合は`View > Viewpoint > Front`で正面表示にする。

- [ ] **Step 2: デフォルトCubeを左フレームにする**

Cubeを選び、`N`でSidebarを開く。`Item`タブで次を入力する。

| 項目 | X | Y | Z |
| --- | ---: | ---: | ---: |
| Location | `-0.36` | `0` | `1.0` |
| Dimensions | `0.08` | `1.0` | `2.0` |

Outlinerまたは`Object Properties`で名前を`rack_01_frame_left`へ変更する。

- [ ] **Step 3: Transformの入力状態を撮影する**

左フレームを選択し、3D Viewportと`Item > Transform`が見える状態を撮影する。

Run:

```bash
target="/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-transform-panel.png"
if [ -e "$target" ]; then
  echo "Refusing to overwrite: $target" >&2
  exit 1
fi
/usr/sbin/screencapture -i "$target" || exit 1
test -s "$target"
```

- [ ] **Step 4: 左フレームを複製して右フレームを作る**

`Shift + D`で複製し、右クリックで移動をキャンセルする。名前とLocationだけを変更する。

- Name: `rack_01_frame_right`
- Location X: `0.36`
- Location Y: `0`
- Location Z: `1.0`

Dimensionsは`0.08`, `1.0`, `2.0`のままにする。

- [ ] **Step 5: Cubeを追加して上フレームを作る**

`Shift + A > Mesh > Cube`でCubeを追加し、次を入力する。

- Name: `rack_01_frame_top`
- Location: `0`, `0`, `1.96`
- Dimensions: `0.8`, `1.0`, `0.08`

- [ ] **Step 6: 上フレームを複製して下フレームを作る**

`Shift + D`で複製し、右クリックで移動をキャンセルする。

- Name: `rack_01_frame_bottom`
- Location: `0`, `0`, `0.04`
- Dimensions: `0.8`, `1.0`, `0.08`

- [ ] **Step 7: フレームだけの状態を撮影する**

`Home`キー、または`View > Frame All`で全体を表示し、少し斜め上から形が分かる視点へ調整する。

Run:

```bash
target="/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-rack-frame.png"
if [ -e "$target" ]; then
  echo "Refusing to overwrite: $target" >&2
  exit 1
fi
/usr/sbin/screencapture -i "$target" || exit 1
test -s "$target"
```

- [ ] **Step 8: 保存して途中検証する**

`Command + S`で保存し、Blenderを終了する。

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-01-rack.blend \
  --python scripts/verify_episode_01.py
```

Expected: `EPISODE_01_FAILED`が表示され、不足対象が`server_01_01`から`server_01_06`までになる。フレーム4個についてはmissing、location、dimensionsエラーが出ない。

- [ ] **Step 9: フレームをコミットする**

Run:

```bash
git add blender/episode-01-rack.blend
git commit -m "feat: build server rack frame"
```

Expected: コミットが作成される。

## Task 4: 6個のCubeでサーバーを作り、ラックを完成させる

**Files:**

- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-01-rack.blend`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-server-duplication.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-completed-rack.png`

- [ ] **Step 1: `.blend`を開き直す**

Finderまたは`File > Open`から次を開き、フレーム4個が表示されることを確認する。

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-01-rack.blend
```

- [ ] **Step 2: 最初のサーバーを作る**

`Shift + A > Mesh > Cube`でCubeを追加し、次を入力する。

- Name: `server_01_01`
- Location: `0`, `-0.03`, `0.2`
- Dimensions: `0.64`, `0.9`, `0.12`

- [ ] **Step 3: サーバーを複製して4台にする**

直前のサーバーを`Shift + D`で複製し、右クリックで移動をキャンセルする。X、Y、Dimensionsは変えず、名前とLocation Zを次の表に合わせる。

| Name | Location Z |
| --- | ---: |
| `server_01_02` | `0.4` |
| `server_01_03` | `0.6` |
| `server_01_04` | `0.8` |

- [ ] **Step 4: 4台時点の複製状態を撮影する**

`server_01_04`まで配置した時点で、Outlinerのオブジェクト名と3D Viewportが見える状態を撮影する。

Run:

```bash
target="/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-server-duplication.png"
if [ -e "$target" ]; then
  echo "Refusing to overwrite: $target" >&2
  exit 1
fi
/usr/sbin/screencapture -i "$target" || exit 1
test -s "$target"
```

- [ ] **Step 5: 残り2台を追加する**

`server_01_04`を複製し、次の2台を追加する。

| Name | Location Z |
| --- | ---: |
| `server_01_05` | `1.0` |
| `server_01_06` | `1.2` |

- [ ] **Step 6: 完成ラックを目視確認する**

次を確認する。

- 左右の柱が平行である。
- 上下のフレームが柱の間をつないでいる。
- 6台のサーバーが重ならず、下から順に並んでいる。
- Outlinerに期待する10個のMeshだけがある。

- [ ] **Step 7: 完成状態を保存する**

`Command + S`で保存する。保存後はモデルを変更しない。

- [ ] **Step 8: 完成状態を撮影する**

斜め前からラック全体が見え、サーバー6台を数えられる状態で撮影する。Properties Sidebarは閉じ、完成物を大きく表示する。

Run:

```bash
target="/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-completed-rack.png"
if [ -e "$target" ]; then
  echo "Refusing to overwrite: $target" >&2
  exit 1
fi
/usr/sbin/screencapture -i "$target" || exit 1
test -s "$target"
```

- [ ] **Step 9: 保存後に開き直す**

Blenderを終了する。Finderから`episode-01-rack.blend`を開き直し、10個のMeshと完成形が残っていることを確認する。確認後、もう一度終了する。

- [ ] **Step 10: 自動検証を通す**

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-01-rack.blend \
  --python scripts/verify_episode_01.py
```

Expected: 終了コード`0`で`EPISODE_01_OK`が表示される。

- [ ] **Step 11: 完成ラックをコミットする**

Run:

```bash
git add blender/episode-01-rack.blend
git commit -m "feat: complete episode 01 server rack"
```

Expected: コミットが作成される。

## Task 5: 学習ログを事実で埋める

**Files:**

- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/docs/learning-log.md`
- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/README.md`

- [ ] **Step 1: 実際に使った操作をログへ記録する**

最低限、次の各操作について、実際に使ったショートカットとメニュー名を書く。

- 視点の回転、移動、ズーム
- 正面表示
- 全体表示
- オブジェクト選択
- Sidebar表示
- LocationとDimensionsの入力
- Cube追加
- 複製
- 名前変更
- 削除
- 保存

使わなかった操作は書かない。

- [ ] **Step 2: 迷った点を仕分ける**

作業中に起きた問題を次の基準で仕分ける。

- 原因と解決方法を確認できた: `迷った点`へ記録する。
- 再現しなかった、または原因不明: 非公開の作業メモに残し、記事へは載せない。
- 問題がなかった: 無理に失敗談を作らない。

- [ ] **Step 3: 画像と記事内容の対応を記録する**

`スクリーンショット`へ次の5件を記録する。

| ファイル | 説明 |
| --- | --- |
| `blender-01-ui-overview.png` | 初期画面の主要領域 |
| `blender-01-transform-panel.png` | LocationとDimensionsの入力 |
| `blender-01-rack-frame.png` | 4個のCubeで作ったフレーム |
| `blender-01-server-duplication.png` | サーバーの複製と命名 |
| `blender-01-completed-rack.png` | 第1回の完成状態 |

- [ ] **Step 4: 確認結果を記録する**

次を実値で記録する。

- `.blend`を開き直した日時
- 10個のMeshを目視確認した結果
- 検証コマンド
- `EPISODE_01_OK`

- [ ] **Step 5: READMEへ実環境と第1回の状態を追記する**

READMEへ次を追記する。

- 実際のmacOSバージョン
- 実際のBlenderバージョン
- 入力機器
- 第1回が完了していること
- `episode-01`タグが第1回完成時点を示すこと

- [ ] **Step 6: ログとREADMEをコミットする**

Run:

```bash
git add docs/learning-log.md README.md
git diff --cached --check
git commit -m "docs: record episode 01 learning results"
```

Expected: コミットが作成される。

## Task 6: 実体験から第1回の記事下書きを作る

**Files:**

- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/content/blog/blender-server-room-01-rack.md`
- Test: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/content.config.ts`
- Test: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/lib/content/schema.ts`

- [ ] **Step 1: ブログ用worktreeの状態を確認する**

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01"
git branch --show-current
git status --short
```

Expected:

- ブランチが`codex/blender-episode-01`である。
- Task 2〜4で作成した5枚の画像だけが未追跡として表示される。

- [ ] **Step 2: 5枚の画像を確認する**

Task 2〜4でworktreeへ直接保存した5枚を確認する。

Run:

```bash
file src/assets/blog/blender-01-*.png
```

Expected: 5件すべてが`PNG image data`と表示され、ファイルサイズが`0`ではない。

- [ ] **Step 3: 画像の内容とプライバシーを目視確認する**

`view_image`で5枚を一つずつ開き、次を確認する。

- 説明対象がフレーム外へ切れていない。
- BlenderのUI文字と数値を読める。
- 他アプリ、通知、メールアドレス、ユーザー名、不要なローカルパスが写っていない。
- 完成画像にフレーム4個とサーバー6台がある。
- 複製画像がサーバー4台の途中状態を示している。

問題がある画像は編集で隠さず、Blender画面を整えて同じ`/usr/sbin/screencapture -i`手順で撮り直す。既存ファイルは上書きせず、問題画像を別名へ退避してから新しい画像を確認し、問題がなければ退避ファイルを削除する。

- [ ] **Step 4: 完成画像が最終保存後に撮られたことを確認する**

画像を加工する前に実行する。

Run:

```bash
blend_mtime=$(stat -f %m "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-01-rack.blend")
capture_mtime=$(stat -f %m "src/assets/blog/blender-01-completed-rack.png")
test "$capture_mtime" -ge "$blend_mtime"
```

Expected: 出力なし、終了コード`0`。

失敗した場合は完成`.blend`を開き、モデルを変更せずに完成画像を撮り直して、内容とプライバシーを再確認する。

- [ ] **Step 5: Retina画像を記事向けの大きさへ縮小する**

最大辺を1600pxへ制限する。

Run:

```bash
for image in src/assets/blog/blender-01-*.png; do
  sips -Z 1600 "$image" >/dev/null
done

for image in src/assets/blog/blender-01-*.png; do
  sips -g pixelWidth -g pixelHeight "$image"
done

find src/assets/blog -maxdepth 1 -name 'blender-01-*.png' -size +3M -print
```

Expected:

- すべての画像の最大辺が1600px以下である。
- 最後の`find`に出力がない。

3MBを超える画像がある場合は、説明対象を狭く選択して撮り直す。文字が読めなくなるほど縮小しない。

縮小後に5枚を`view_image`でもう一度開き、UIラベルとTransformの数値を読めることを確認する。

- [ ] **Step 6: 記事のfrontmatterを作成する**

Create `src/content/blog/blender-server-room-01-rack.md`:

```markdown
---
title: Blender完全初心者がCubeだけでサーバーラックを作る
description: Blenderを初めて触るインフラ／Webエンジニア向けに、画面操作、Cubeの変形と複製を使ってサーバーラックを1台作る手順を紹介します。
publishedAt: '2026-07-28'
category: Frontend
tags:
  - Blender
  - 3D
draft: true
heroImage: ../../assets/blog/blender-01-completed-rack.png
---
```

公開日が実際の公開日と異なる場合は、公開前に変更する。この計画では`draft: true`を外さない。

- [ ] **Step 7: 導入と「今回作るもの」を書く**

`learning-log.md`を参照し、次を書く。

```markdown
Blender未経験の筆者が、Cubeだけでサーバーラックを1台作った記事であることを2段落以内で説明する。

## 今回作るもの

完成物、使用環境、扱う操作、扱わない内容を書く。
```

使用環境は実値を使い、第2回以降の内容を「今回作るもの」へ含めない。

- [ ] **Step 8: インストールと画面操作の節を書く**

次の2節を書く。

```markdown
## Blenderをインストールする

実際に使った安定版、Apple Silicon版を選んだ理由、DMGからの導入手順を書く。

## 最初に画面と視点操作を確認する

`blender-01-ui-overview.png`を置き、3D Viewport、Outliner、Propertiesを説明する。
実際に成功した回転、移動、ズームの操作を書く。
```

公式情報と実演結果を分け、ダウンロード画面で確認していないバージョン情報を書かない。

- [ ] **Step 9: ラックフレーム制作の節を書く**

次の節を書く。

```markdown
## Cubeを変形してラックのフレームを作る

`blender-01-transform-panel.png`と`blender-01-rack-frame.png`を置く。
LocationとDimensionsの実値を表で示す。
```

4個のオブジェクト名と数値を`verify_episode_01.py`へ照合してから書く。

- [ ] **Step 10: サーバー複製の節を書く**

次の節を書く。

```markdown
## Cubeを複製してサーバーを並べる

`blender-01-server-duplication.png`を置く。
6台の名前とLocation Zを表で示す。
```

読者が4台時点の画像から6台完成まで追えるよう、画像の撮影時点を明記する。

- [ ] **Step 11: 迷った点と完成確認を書く**

次の2節を書く。

```markdown
## 初心者が迷った点

learning-logで原因と解決方法を確認できた項目だけを書く。
該当がなければ、この見出し自体を削除する。

## 完成状態を確認する

`blender-01-completed-rack.png`を置き、再オープンと検証結果を書く。
```

問題がなかった場合は失敗談を作らない。検証結果には`EPISODE_01_OK`の意味を1文で説明する。

- [ ] **Step 12: 学んだ操作と次回予告を書く**

次の2節を書く。

```markdown
## 今回覚えた操作

実際に使った操作だけを短くまとめる。

## 次回はサーバールームへ広げる

床、壁、ラック複製、最低限の色と照明を次回扱うと予告する。
```

- [ ] **Step 13: 5枚の画像とキャプションを本文へ配置する**

各画像の直後に`<span class="article-image-caption">`を置き、何を確認する画像かを1文で書く。画像を順に開き、本文と撮影時点が一致することを確認する。

- [ ] **Step 14: 記事を初見の読者として通読する**

記事では「簡単」「すぐ」「誰でも」など、未経験者の負荷を過小評価する表現を使わない。見出しだけを順に読み、完成までの流れが追えることを確認する。

- [ ] **Step 15: 手順と数値を制作物へ照合する**

次を一つずつ照合する。

- 記事のBlenderバージョンが`learning-log.md`と一致する。
- 記事のオブジェクト名が`verify_episode_01.py`と一致する。
- 記事のLocationとDimensionsが`verify_episode_01.py`と一致する。
- 記事で説明するショートカットを実際に使用している。
- 5枚の画像が本文の説明と同じ状態を示している。
- 第2回以降のマテリアル、照明、GLB、Reactへ踏み込んでいない。

## Task 7: 記事と2つのリポジトリを検証して区切る

**Files:**

- Test: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/content/blog/blender-server-room-01-rack.md`
- Test: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-01/src/assets/blog/blender-01-*.png`
- Test: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-01-rack.blend`

- [ ] **Step 1: 記事の日本語を検査する**

Run from the blog worktree:

```bash
uv run "/Users/hiroshiimaizumi/Documents/tech blog 2/.agents/skills/natural-japanese/scripts/lint.py" \
  --json \
  --genre tech \
  src/content/blog/blender-server-room-01-rack.md
```

Expected: JSONが出力される。findingsは文脈ごとに「直す」「残す」を判断し、修正後にもう一度実行する。未判断のfindingを残さない。

- [ ] **Step 2: Astroの型とコンテンツを確認する**

依存関係がworktreeにない場合だけ、先に`npm ci`を実行する。

Run:

```bash
npm run check
```

Expected: エラー`0`。

- [ ] **Step 3: 単体テストを実行する**

Run:

```bash
npm test
```

Expected: すべてのVitestテストが成功する。

- [ ] **Step 4: Production buildを確認する**

Run:

```bash
SITE_URL=https://example.invalid npm run build
```

Expected: Astro build、Pagefind、成果物検査が成功する。記事は`draft: true`のためProduction出力には含まれない。

- [ ] **Step 5: 記事と画像だけをコミットする**

Run:

```bash
git add \
  src/content/blog/blender-server-room-01-rack.md \
  src/assets/blog/blender-01-ui-overview.png \
  src/assets/blog/blender-01-transform-panel.png \
  src/assets/blog/blender-01-rack-frame.png \
  src/assets/blog/blender-01-server-duplication.png \
  src/assets/blog/blender-01-completed-rack.png
git diff --cached --check
git commit -m "docs: draft Blender server rack tutorial"
```

Expected: 指定した記事と画像だけを含むコミットが作成される。

- [ ] **Step 6: 制作リポジトリの最終検証を再実行する**

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-01-rack.blend \
  --python scripts/verify_episode_01.py
git status --short
```

Expected:

- `EPISODE_01_OK`が表示される。
- `git status --short`に出力がない。

- [ ] **Step 7: 制作リポジトリへ第1回のGitタグを付ける**

Run:

```bash
git tag -a episode-01 -m "Episode 01: Cubeでサーバーラックを作る"
git show --stat --oneline episode-01
```

Expected: `episode-01`が第1回の最終コミットを指す。

- [ ] **Step 8: ブログリポジトリの状態を確認する**

Run from the blog worktree:

```bash
git status --short
git log -1 --oneline
```

Expected:

- `git status --short`に出力がない。
- 最新コミットが`docs: draft Blender server rack tutorial`である。

## 完了時に残るもの

- Blender安定版が`/Applications/Blender.app`にある。
- `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard`が独立したGitリポジトリになっている。
- `blender/episode-01-rack.blend`に、4個のフレームと6台のサーバーがある。
- `scripts/verify_episode_01.py`が`EPISODE_01_OK`を返す。
- `docs/learning-log.md`に、実際の操作と確認結果がある。
- 制作リポジトリに`episode-01`タグがある。
- テックログに5枚の実画面画像と、`draft: true`の記事下書きがある。
- 第2回以降の機能、remote、push、公開は行われていない。
