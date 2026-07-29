# Blender 3Dサーバールーム連載 第2回 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第1回のサーバーラックを2台へ増やし、床、壁、マテリアル、照明、カメラを備えた3Dサーバールームを作り、実体験に基づく連載第2回の下書きを完成させる。

**Architecture:** 3D制作物と学習ログは`3d-server-room-dashboard`で管理し、記事本文と公開用画像は`tech blog 2`の専用worktreeで管理する。ユーザーがBlenderを操作し、Codexは一手ずつ案内する。完成条件はBlender Pythonの検証スクリプトと目視確認の両方で確かめる。

**Tech Stack:** Blender 5.2.0 LTS、Blender Python API、macOS、Git、Astro Content Collections、Markdown、Sharp

---

## 0. 実行前提

- 設計書: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/docs/superpowers/specs/2026-07-29-blender-server-room-episode-02-design.md`
- 3D制作リポジトリ: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard`
- ブログworktree: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design`
- 3D制作ブランチ: `codex/episode-02-server-room`
- ブログブランチ: `codex/blender-episode-02-design`
- Blender UI: 日本語
- 入力機器: Macのトラックパッド
- 第2回の範囲: ラック2台、サーバー14台、床、壁2面、マテリアル4種類、Area Light 1個、Camera 1個、学習ログ、記事下書き
- GLB出力、React、監視データ連携、ブログ公開は扱わない。

Blenderの画面操作が必要なステップでは、Codexは一つのまとまりだけを案内し、ユーザーの完了報告を待つ。記事は実際の操作と確認結果から書くため、モデル完成前に本文を作らない。

## 1. 変更するファイル

### `3d-server-room-dashboard`

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/
├─ .gitignore                                  # Visual Companionと撮影元画像を除外
├─ .captures/episode-02/                       # 撮影元画像。Git管理しない
├─ README.md                                   # Episode 02の成果物と検証方法
├─ blender/
│  ├─ episode-01-rack.blend                    # 変更しない
│  └─ episode-02-server-room.blend             # 第2回の編集可能なモデル
├─ docs/
│  └─ learning-log.md                          # 実操作、迷った点、確認結果
└─ scripts/
   ├─ verify_episode_01.py                     # 変更しない
   └─ verify_episode_02.py                     # 第2回の完成条件
```

### `tech blog 2`

```text
/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/
├─ docs/superpowers/plans/
│  └─ 2026-07-29-blender-server-room-episode-02.md
├─ src/assets/blog/
│  ├─ blender-02-source-rack.png
│  ├─ blender-02-two-racks.png
│  ├─ blender-02-room-shell.png
│  ├─ blender-02-materials.png
│  └─ blender-02-completed-room.png
└─ src/content/blog/
   └─ blender-server-room-02-room.md
```

記事は`draft: true`で作る。公開、E2Eの公開記事件数更新、ホーム画面のスナップショット更新、PR作成は、ユーザーが下書きを確認した後の別作業とする。

## Task 1: 第2回の制作ブランチと検証スクリプトを準備する

**Files:**

- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.gitignore`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/scripts/verify_episode_02.py`

- [ ] **Step 1: 第1回の完成状態を確認する**

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
git status --short --branch
git tag --list episode-01
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-01-rack.blend \
  --python scripts/verify_episode_01.py
```

Expected:

- 現在のブランチが`codex/episode-01-rack`
- `episode-01`タグが1行表示される。
- 最後に`EPISODE_01_OK`が表示される。
- `.superpowers/`以外の未追跡・変更ファイルがない。

想定外の変更がある場合は、移動や削除をせずユーザーへ報告する。

- [ ] **Step 2: 第2回のブランチを作る**

Run:

```bash
git switch -c codex/episode-02-server-room episode-01
```

Expected: `Switched to a new branch 'codex/episode-02-server-room'`

- [ ] **Step 3: Visual Companionの一時ファイルをGit管理から除外する**

Append to `.gitignore`:

```gitignore
.superpowers/
.captures/
```

Run:

```bash
mkdir -p .captures/episode-02
git diff --check
git status --short
```

Expected: `.gitignore`だけが変更として表示され、`.superpowers/`は表示されない。

- [ ] **Step 4: 完成条件を表す検証スクリプトを書く**

Create `scripts/verify_episode_02.py`:

```python
import math

import bpy


POSITION_TOLERANCE = 0.001
CAMERA_ROTATION_TOLERANCE = 0.002

EXPECTED_MATERIALS = {
    "wall": "mat_wall_light_gray",
    "floor": "mat_floor_gray",
    "rack": "mat_rack_dark_gray",
    "server": "mat_server_gray",
}

EXPECTED_BASE_COLORS = {
    "mat_wall_light_gray": "B8BCC2",
    "mat_floor_gray": "555B63",
    "mat_rack_dark_gray": "22262B",
    "mat_server_gray": "4A5562",
}


def expected_rack(rack_number, center_x, server_count):
    rack_id = f"{rack_number:02d}"
    objects = {
        f"rack_{rack_id}_frame_left": {
            "location": (center_x - 0.36, 0.0, 1.0),
            "dimensions": (0.08, 1.0, 2.0),
            "material": EXPECTED_MATERIALS["rack"],
        },
        f"rack_{rack_id}_frame_right": {
            "location": (center_x + 0.36, 0.0, 1.0),
            "dimensions": (0.08, 1.0, 2.0),
            "material": EXPECTED_MATERIALS["rack"],
        },
        f"rack_{rack_id}_frame_top": {
            "location": (center_x, 0.0, 1.96),
            "dimensions": (0.8, 1.0, 0.08),
            "material": EXPECTED_MATERIALS["rack"],
        },
        f"rack_{rack_id}_frame_bottom": {
            "location": (center_x, 0.0, 0.04),
            "dimensions": (0.8, 1.0, 0.08),
            "material": EXPECTED_MATERIALS["rack"],
        },
    }

    for server_number in range(1, server_count + 1):
        objects[f"server_{rack_id}_{server_number:02d}"] = {
            "location": (center_x, -0.03, server_number * 0.2),
            "dimensions": (0.64, 0.9, 0.12),
            "material": EXPECTED_MATERIALS["server"],
        }

    return objects


EXPECTED_MESHES = {
    **expected_rack(1, -0.55, 6),
    **expected_rack(2, 0.55, 8),
    "room_floor": {
        "location": (0.0, 0.5, -0.05),
        "dimensions": (4.0, 4.0, 0.1),
        "material": EXPECTED_MATERIALS["floor"],
    },
    "room_wall_back": {
        "location": (0.0, 2.45, 1.3),
        "dimensions": (4.0, 0.1, 2.6),
        "material": EXPECTED_MATERIALS["wall"],
    },
    "room_wall_left": {
        "location": (-1.95, 0.5, 1.3),
        "dimensions": (0.1, 4.0, 2.6),
        "material": EXPECTED_MATERIALS["wall"],
    },
}


def close_tuple(actual, expected, tolerance=POSITION_TOLERANCE):
    return all(
        math.isclose(actual_value, expected_value, abs_tol=tolerance)
        for actual_value, expected_value in zip(actual, expected, strict=True)
    )


def material_names(object_3d):
    return [
        slot.material.name
        for slot in object_3d.material_slots
        if slot.material is not None
    ]


def srgb_channel_to_linear(value):
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgb(hex_color):
    srgb = tuple(
        int(hex_color[index : index + 2], 16) / 255.0
        for index in (0, 2, 4)
    )
    return tuple(srgb_channel_to_linear(value) for value in srgb)


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

actual_mesh_names = {
    object_3d.name for object_3d in bpy.data.objects if object_3d.type == "MESH"
}
expected_mesh_names = set(EXPECTED_MESHES)

for missing_name in sorted(expected_mesh_names - actual_mesh_names):
    errors.append(f"missing Mesh: {missing_name}")
for unexpected_name in sorted(actual_mesh_names - expected_mesh_names):
    errors.append(f"unexpected Mesh: {unexpected_name}")

for object_name, expected in EXPECTED_MESHES.items():
    object_3d = bpy.data.objects.get(object_name)
    if object_3d is None:
        continue
    if object_3d.type != "MESH":
        errors.append(f"{object_name}: expected MESH, got {object_3d.type}")
        continue
    if not close_tuple(object_3d.location, expected["location"]):
        errors.append(
            f"{object_name}: location="
            f"{tuple(round(value, 3) for value in object_3d.location)}"
        )
    if not close_tuple(object_3d.dimensions, expected["dimensions"]):
        errors.append(
            f"{object_name}: dimensions="
            f"{tuple(round(value, 3) for value in object_3d.dimensions)}"
        )
    actual_materials = material_names(object_3d)
    if actual_materials != [expected["material"]]:
        errors.append(
            f"{object_name}: materials={actual_materials}, "
            f"expected={[expected['material']]}"
        )

for material_name in EXPECTED_MATERIALS.values():
    material = bpy.data.materials.get(material_name)
    if material is None:
        errors.append(f"missing material: {material_name}")
        continue
    if not material.use_nodes:
        errors.append(f"{material_name}: expected use_nodes=True")
        continue
    principled_nodes = [
        node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"
    ]
    if len(principled_nodes) != 1:
        errors.append(
            f"{material_name}: expected one Principled BSDF, "
            f"got {len(principled_nodes)}"
        )
        continue
    actual_color = principled_nodes[0].inputs["Base Color"].default_value[:3]
    expected_color = hex_to_linear_rgb(EXPECTED_BASE_COLORS[material_name])
    if not close_tuple(actual_color, expected_color, 0.003):
        errors.append(
            f"{material_name}: Base Color="
            f"{tuple(round(value, 4) for value in actual_color)}"
        )

light_objects = [
    object_3d for object_3d in bpy.data.objects if object_3d.type == "LIGHT"
]
if [object_3d.name for object_3d in light_objects] != ["room_key_light"]:
    errors.append(
        "Light objects: expected ['room_key_light'], got "
        f"{sorted(object_3d.name for object_3d in light_objects)}"
    )
else:
    light = light_objects[0]
    if light.data.type != "AREA":
        errors.append(f"room_key_light: expected AREA, got {light.data.type}")
    if not close_tuple(light.location, (0.0, -0.5, 4.0)):
        errors.append(
            "room_key_light: location="
            f"{tuple(round(value, 3) for value in light.location)}"
        )
    if not close_tuple(light.rotation_euler, (0.0, 0.0, 0.0)):
        errors.append(
            "room_key_light: rotation="
            f"{tuple(round(value, 3) for value in light.rotation_euler)}"
        )
    if not math.isclose(light.data.energy, 900.0, abs_tol=0.1):
        errors.append(f"room_key_light: energy={light.data.energy}")
    if light.data.shape != "SQUARE":
        errors.append(f"room_key_light: expected SQUARE, got {light.data.shape}")
    if not math.isclose(light.data.size, 5.0, abs_tol=0.001):
        errors.append(f"room_key_light: size={light.data.size}")

camera_objects = [
    object_3d for object_3d in bpy.data.objects if object_3d.type == "CAMERA"
]
if [object_3d.name for object_3d in camera_objects] != ["room_overview_camera"]:
    errors.append(
        "Camera objects: expected ['room_overview_camera'], got "
        f"{sorted(object_3d.name for object_3d in camera_objects)}"
    )
else:
    camera = camera_objects[0]
    if not close_tuple(camera.location, (4.8, -6.5, 3.6)):
        errors.append(
            "room_overview_camera: location="
            f"{tuple(round(value, 3) for value in camera.location)}"
        )
    if not close_tuple(
        camera.rotation_euler,
        (1.257122, 0.0, 0.614663),
        CAMERA_ROTATION_TOLERANCE,
    ):
        errors.append(
            "room_overview_camera: rotation="
            f"{tuple(round(value, 6) for value in camera.rotation_euler)}"
        )
    if not math.isclose(camera.data.lens, 50.0, abs_tol=0.001):
        errors.append(f"room_overview_camera: lens={camera.data.lens}")
    if bpy.context.scene.camera is not camera:
        active_name = (
            bpy.context.scene.camera.name
            if bpy.context.scene.camera is not None
            else None
        )
        errors.append(
            "active camera: expected room_overview_camera, "
            f"got {active_name}"
        )

world = bpy.context.scene.world
if world is None or not world.use_nodes:
    errors.append("World: expected node-based World")
else:
    background_nodes = [
        node for node in world.node_tree.nodes if node.type == "BACKGROUND"
    ]
    if len(background_nodes) != 1:
        errors.append(
            f"World: expected one Background node, got {len(background_nodes)}"
        )
    else:
        world_strength = background_nodes[0].inputs["Strength"].default_value
        if not math.isclose(world_strength, 0.35, abs_tol=0.001):
            errors.append(f"World strength: expected 0.35, got {world_strength}")

if errors:
    raise SystemExit("EPISODE_02_FAILED\n" + "\n".join(errors))

print("EPISODE_02_OK")
```

- [ ] **Step 5: 検証が第1回のファイルに対して失敗することを確認する**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-01-rack.blend \
  --python scripts/verify_episode_02.py
```

Expected:

- 終了コードが`0`以外
- `EPISODE_02_FAILED`
- 少なくとも`missing Mesh: room_floor`と`missing Mesh: rack_02_frame_left`を含む。

- [ ] **Step 6: 検証スクリプトとGit除外設定をコミットする**

Run:

```bash
git add .gitignore scripts/verify_episode_02.py
git diff --cached --check
git commit -m "test: define episode 02 server room"
```

Expected: コミットが1件作成される。

## Task 2: 第1回のファイルを引き継ぎ、ラックを2台にする

**Files:**

- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend`

- [ ] **Step 1: 第1回のファイルをBlenderで開く**

Run:

```bash
open -a /Applications/Blender.app \
  "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-01-rack.blend"
```

Expected: Blenderに第1回のラック1台が表示される。

右手前からラック1台が見える視点へ移動し、次のコマンドを実行する。十字カーソルになったらBlenderウィンドウをクリックする。

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
screencapture -i -W \
  ".captures/episode-02/blender-02-source-rack.png"
```

Raw screenshot label: `blender-02-source-rack`

- [ ] **Step 2: 第2回の名前で別名保存する**

Blenderで`ファイル > 名前を付けて保存`を選び、次へ保存する。

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend
```

Expected: Blenderのタイトルバーまたは保存先表示が`episode-02-server-room.blend`になる。`episode-01-rack.blend`の更新時刻は変わらない。

- [ ] **Step 3: 10個のラック部品を選択する**

Outlinerで次の10個だけを複数選択する。

```text
rack_01_frame_left
rack_01_frame_right
rack_01_frame_top
rack_01_frame_bottom
server_01_01
server_01_02
server_01_03
server_01_04
server_01_05
server_01_06
```

Expected: 3D Viewportでラック全体だけが選択色になる。

- [ ] **Step 4: 1台目を左へ`0.55 m`移動する**

ポインターを3D Viewportへ置き、`G`、`X`、`-0.55`、`Enter`の順に操作する。

Expected:

- `server_01_01`のLocation Xが`-0.55`
- `rack_01_frame_left`のLocation Xが`-0.91`
- 10個の相対配置が変わらない。

- [ ] **Step 5: ラック一式を右へ複製する**

10個を選択したまま、`Shift + D`、`X`、`1.1`、`Enter`の順に操作する。

Expected:

- 複製した10個だけが選択された状態になる。
- 複製側のサーバー中心Xが`0.55`
- ラック同士のフレーム間に`0.30 m`の隙間がある。

- [ ] **Step 6: 複製側の名前を`02`へ変更する**

Outlinerで、Blenderが付けた`.001`形式の名前を次へ変更する。

| 複製元 | 変更後 |
| --- | --- |
| `rack_01_frame_left.001` | `rack_02_frame_left` |
| `rack_01_frame_right.001` | `rack_02_frame_right` |
| `rack_01_frame_top.001` | `rack_02_frame_top` |
| `rack_01_frame_bottom.001` | `rack_02_frame_bottom` |
| `server_01_01.001`〜`server_01_06.001` | `server_02_01`〜`server_02_06` |

Expected: OutlinerのMesh名に`.001`が残らない。

- [ ] **Step 7: 右のラックへサーバーを2台追加する**

`server_02_06`を選び、次を2回行う。

1. `Shift + D`を押す。
2. 右クリックで移動を止める。
3. Outlinerで名前を変える。
4. SidebarのLocation Zを変える。

| 名前 | Location X / Y / Z | Dimensions X / Y / Z |
| --- | --- | --- |
| `server_02_07` | `0.55 / -0.03 / 1.4` | `0.64 / 0.9 / 0.12` |
| `server_02_08` | `0.55 / -0.03 / 1.6` | `0.64 / 0.9 / 0.12` |

Expected: 左に6台、右に8台のサーバーが見える。

- [ ] **Step 8: 保存して2台配置のスクリーンショットを撮る**

`Command + S`で保存する。右手前から2台が見える視点へ移動し、次を実行してBlenderウィンドウをクリックする。撮影時点では、床、壁、色、ライト、カメラはまだ追加しない。

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
screencapture -i -W \
  ".captures/episode-02/blender-02-two-racks.png"
```

- [ ] **Step 9: ラック2台の状態をコミットする**

Run:

```bash
git add blender/episode-02-server-room.blend
git diff --cached --check
git commit -m "feat: duplicate server rack for episode 02"
```

Expected: `.blend`を含むコミットが1件作成される。

## Task 3: 床と2面の壁を作る

**Files:**

- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend`

- [ ] **Step 1: 床を追加する**

`Shift + A > メッシュ > 立方体`でCubeを追加し、Outlinerで`room_floor`へ変更する。Sidebarから次を入力する。

```text
Location:   X=0.0, Y=0.5, Z=-0.05
Dimensions: X=4.0, Y=4.0, Z=0.1
```

Expected: ラックの底面が床の上面`Z = 0`に接する。

- [ ] **Step 2: 奥の壁を追加する**

Cubeを追加して`room_wall_back`へ変更し、次を入力する。

```text
Location:   X=0.0, Y=2.45, Z=1.3
Dimensions: X=4.0, Y=0.1, Z=2.6
```

Expected: ラックの背後に横長の壁ができる。

- [ ] **Step 3: 左の壁を追加する**

Cubeを追加して`room_wall_left`へ変更し、次を入力する。

```text
Location:   X=-1.95, Y=0.5, Z=1.3
Dimensions: X=0.1, Y=4.0, Z=2.6
```

Expected: 奥と左の壁が角を作り、右と手前は開いている。

- [ ] **Step 4: 保存して部屋の形を撮影する**

`Command + S`で保存する。右手前から床、壁、ラック2台が見える視点にし、次を実行してBlenderウィンドウをクリックする。

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
screencapture -i -W \
  ".captures/episode-02/blender-02-room-shell.png"
```

- [ ] **Step 5: 床と壁をコミットする**

Run:

```bash
git add blender/episode-02-server-room.blend
git diff --cached --check
git commit -m "feat: add floor and walls to server room"
```

Expected: コミットが1件作成される。

## Task 4: 4種類のマテリアルを作って割り当てる

**Files:**

- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend`

- [ ] **Step 1: Material Previewへ切り替える**

3D Viewport右上のViewport Shadingから`マテリアルプレビュー`を選ぶ。

Expected: 色を確認できる表示へ切り替わる。

- [ ] **Step 2: 壁用マテリアルを作る**

`room_wall_back`を選び、Material Propertiesで新規マテリアルを作る。

```text
Name: mat_wall_light_gray
Base Color Hex: B8BCC2
```

`room_wall_left`にも同じ`mat_wall_light_gray`を割り当てる。

- [ ] **Step 3: 床用マテリアルを作る**

`room_floor`へ次を作成して割り当てる。

```text
Name: mat_floor_gray
Base Color Hex: 555B63
```

- [ ] **Step 4: ラック用マテリアルを作る**

いずれか1個のフレームへ次を作成する。

```text
Name: mat_rack_dark_gray
Base Color Hex: 22262B
```

残り7個のフレームにも同じマテリアルを割り当てる。複数選択でリンクする場合は、`mat_rack_dark_gray`を持つオブジェクトを最後に選択してアクティブにし、`Control + L > マテリアルをリンク`を使う。

- [ ] **Step 5: サーバー用マテリアルを作る**

いずれか1個のサーバーへ次を作成する。

```text
Name: mat_server_gray
Base Color Hex: 4A5562
```

残り13個のサーバーにも同じマテリアルを割り当てる。リンクする場合は、`mat_server_gray`を持つオブジェクトを最後に選択する。

- [ ] **Step 6: マテリアルの割り当てを画面で確認する**

Outlinerから壁、床、ラック、サーバーを1個ずつ選び、Material Propertiesの名前を確認する。

Expected:

- 壁: `mat_wall_light_gray`
- 床: `mat_floor_gray`
- ラック: `mat_rack_dark_gray`
- サーバー: `mat_server_gray`
- 各MeshのMaterial Slotが1個だけ

- [ ] **Step 7: 保存してマテリアル画面を撮影する**

`mat_server_gray`を割り当てたサーバーを選択し、Material Propertiesの名前と完成途中の部屋が同時に見える状態にする。次を実行してBlenderウィンドウをクリックする。

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
screencapture -i -W \
  ".captures/episode-02/blender-02-materials.png"
```

- [ ] **Step 8: マテリアルをコミットする**

Run:

```bash
git add blender/episode-02-server-room.blend
git diff --cached --check
git commit -m "feat: add server room materials"
```

Expected: コミットが1件作成される。

## Task 5: Area LightとCameraを追加する

**Files:**

- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend`

- [ ] **Step 1: Area Lightを追加する**

`Shift + A > ライト > エリア`で追加し、`room_key_light`へ変更する。SidebarとLight Propertiesで次を入力する。

```text
Location: X=0.0, Y=-0.5, Z=4.0
Rotation: X=0°, Y=0°, Z=0°
Power: 900 W
Shape: Square
Size: 5.0 m
```

Expected: OutlinerにLightが1個だけあり、名前が`room_key_light`になる。

- [ ] **Step 2: Worldの強さを調整する**

World Propertiesの`サーフェス > 背景 > 強さ`を`0.35`にする。

Expected: 暗部が黒くつぶれず、壁が白飛びしない。

- [ ] **Step 3: Cameraを追加する**

`Shift + A > カメラ`で追加し、`room_overview_camera`へ変更する。

- [ ] **Step 4: 使用カメラに設定する**

`room_overview_camera`を選択し、`ビュー > カメラ > アクティブオブジェクトをカメラに設定`を選ぶ。表示名が異なる場合はScene PropertiesのCamera欄で`room_overview_camera`を選ぶ。

Expected: SceneのCameraが`room_overview_camera`になる。

- [ ] **Step 5: トラックパッドの視点へカメラを揃える**

トラックパッドで右手前からラック2台を見る視点を作る。`room_overview_camera`を選択したまま、`ビュー > 視点を揃える > アクティブカメラをビューに揃える`を実行し、現在の視点へカメラを合わせる。

操作を確認した後、再現可能な完成値へそろえるため、SidebarとCamera Propertiesで次を入力する。

```text
Location: X=4.8, Y=-6.5, Z=3.6
Rotation: X=72.028°, Y=0°, Z=35.218°
Focal Length: 50 mm
```

Blender内部での予定ラジアン値:

```text
X=1.257122, Y=0.0, Z=0.614663
```

- [ ] **Step 6: Camera ViewとRendered表示を確認する**

`ビュー > カメラ > アクティブカメラ`でCamera Viewへ切り替え、Viewport Shadingを`レンダー`へ切り替える。

Expected:

- ラック2台が画面内に収まる。
- 床、奥の壁、左の壁が見える。
- 右と手前が開いた構成に見える。
- ラックとサーバーの色を区別できる。

想定値で構図が欠ける場合は、作業を止めてCodexへ画面を共有する。勝手にCameraの値を変えない。変更が必要なら、設計値、検証スクリプト、学習ログを同じ値へそろえる。

- [ ] **Step 7: 保存して完成画像を撮影する**

Camera ViewのRendered表示で、Blender UIを含む画像を撮影する。次を実行してBlenderウィンドウをクリックする。

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
screencapture -i -W \
  ".captures/episode-02/blender-02-completed-room.png"
```

`blender-02-source-rack`に不足がある場合は、第1回ファイルを別ウィンドウで開いて撮り直す。第2回の完成ファイルからラックや部屋を削除して再現しない。

- [ ] **Step 8: ライトとカメラをコミットする**

Run:

```bash
git add blender/episode-02-server-room.blend
git diff --cached --check
git commit -m "feat: light and frame the server room"
```

Expected: コミットが1件作成される。

## Task 6: 第2回のモデルを検証して学習ログを完成させる

**Files:**

- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/docs/learning-log.md`
- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/README.md`

- [ ] **Step 1: Blenderを保存して終了する**

`Command + S`で保存し、Blenderを終了する。

Expected: 未保存確認が表示されない。

- [ ] **Step 2: バックグラウンド検証を実行する**

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard"
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-02-server-room.blend \
  --python scripts/verify_episode_02.py
```

Expected: `EPISODE_02_OK`

失敗した場合は、エラーに出た対象だけをBlenderで確認する。原因、誤った値、修正後の値を記録し、`EPISODE_02_OK`になるまで次へ進まない。

- [ ] **Step 3: ファイルを開き直して目視確認する**

Run:

```bash
open -a /Applications/Blender.app \
  "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend"
```

Camera ViewのRendered表示へ切り替える。

Expected:

- ラック2台、サーバー14台、床、壁2面が残っている。
- マテリアルと照明が保存されている。
- `room_overview_camera`の構図が保存されている。

- [ ] **Step 4: 学習ログへEpisode 02を追記する**

Append to `docs/learning-log.md`:

```markdown
## Episode 02: ラックを並べてサーバールームを作る

### 環境

- macOS: 26.5.2
- Blender: 5.2.0 LTS
- CPU: Apple Silicon
- 入力機器: Macのトラックパッド
- Blender UI: 日本語

### 完成条件

- ラック2台を中央へ横並びに配置する。
- 左のラックにサーバー6台、右のラックに8台を配置する。
- 床、奥の壁、左の壁を作る。
- マテリアル4種類、Area Light 1個、Camera 1個を設定する。
- 保存後に開き直し、検証スクリプトに合格する。

### 実際に使った操作

作業中に確認した操作だけを記録する。

### マテリアルと照明

- `mat_wall_light_gray`: `#B8BCC2`
- `mat_floor_gray`: `#555B63`
- `mat_rack_dark_gray`: `#22262B`
- `mat_server_gray`: `#4A5562`
- `room_key_light`: Area、900 W、5.0 m
- World Strength: 0.35
- `room_overview_camera`: 50 mm

### 迷った点

症状、原因、解決方法がそろったものだけ記録する。該当がなければ「公開記事へ載せる問題はなかった」と記録する。

### スクリーンショット

- `blender-02-source-rack.png`: 第1回のラックを引き継いだ状態
- `blender-02-two-racks.png`: ラック2台を横並びにした状態
- `blender-02-room-shell.png`: 床と壁を追加した状態
- `blender-02-materials.png`: マテリアルを割り当てた状態
- `blender-02-completed-room.png`: 照明とカメラを含む完成状態

### 確認結果

- 確認日時:
- 保存した`.blend`を開き直した結果:
- 検証結果: `EPISODE_02_OK`
```

空欄と指示文は、実際の操作記録へ置き換える。問題がなかった場合に架空の失敗を作らない。

- [ ] **Step 5: READMEへEpisode 02を追記する**

Append after Episode 01:

```markdown
## Episode 02

第1回のラックを2台へ増やし、床、壁、マテリアル、照明、カメラを追加しました。

成果物:

- `blender/episode-02-server-room.blend`

完成状態:

- 左にサーバー6台、右に8台を収めたラック2台
- 床、奥の壁、左の壁
- マテリアル4種類
- Area Light 1個とCamera 1個

検証:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-02-server-room.blend \
  --python scripts/verify_episode_02.py
```

`episode-02`タグは、第2回のモデル、学習ログ、検証結果がそろった時点を示します。
```

- [ ] **Step 6: READMEと学習ログをコミットする**

Run:

```bash
git add README.md docs/learning-log.md blender/episode-02-server-room.blend
git diff --cached --check
git commit -m "docs: record episode 02 learning results"
```

Expected: コミットが1件作成される。

- [ ] **Step 7: 最終検証後に`episode-02`タグを付ける**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-02-server-room.blend \
  --python scripts/verify_episode_02.py
git status --short
git tag -a episode-02 -m "Episode 02 server room"
git show --stat --oneline episode-02
```

Expected:

- `EPISODE_02_OK`
- `git status --short`が空
- タグが直前の学習ログコミットを指す。

## Task 7: スクリーンショットを記事用に整える

**Files:**

- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-02-source-rack.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-02-two-racks.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-02-room-shell.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-02-materials.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-02-completed-room.png`

- [ ] **Step 1: 5枚の元画像を目視確認する**

Raw image directory:

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.captures/episode-02
```

各画像で次を確認する。

- Blender 5.2.0 LTSの実画面である。
- 選択対象と説明内容が一致する。
- 通知、個人情報、別アプリが写っていない。
- 完成画像ではラック2台、床、壁2面を判別できる。
- 同じ場面の不要な差分がない。

不足がある場合は、CodexがBlenderを操作して撮り直す。元の`.blend`は撮影後に保存せず、モデルの状態を変えない。

- [ ] **Step 2: ブログworktreeの依存関係をインストールする**

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design"
npm ci
```

Expected: 終了コード`0`。`package-lock.json`に差分が生じない。

- [ ] **Step 3: Sharpで長辺1600px以内へ縮小する**

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design"
for episode02_image_name in \
  blender-02-source-rack \
  blender-02-two-racks \
  blender-02-room-shell \
  blender-02-materials \
  blender-02-completed-room
do
  node --input-type=module -e \
    "import sharp from 'sharp'; await sharp(process.argv[1]).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toFile(process.argv[2])" \
    "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.captures/episode-02/${episode02_image_name}.png" \
    "src/assets/blog/${episode02_image_name}.png"
done
```

Expected:

- 各画像の長辺が1600px以下
- 向きが正しい。
- 文字と選択対象を判別できる。

- [ ] **Step 4: 画像情報と容量を確認する**

Run:

```bash
sips -g pixelWidth -g pixelHeight src/assets/blog/blender-02-*.png
ls -lh src/assets/blog/blender-02-*.png
```

Expected: 5枚が表示され、各画像の長辺が1600px以下。極端な画質劣化や空画像がない。

- [ ] **Step 5: 画像をコミットする**

Run:

```bash
git add src/assets/blog/blender-02-*.png
git diff --cached --check
git commit -m "docs: add Blender episode 02 screenshots"
```

Expected: 画像5枚を含むコミットが1件作成される。

## Task 8: 実体験から第2回の記事下書きを作る

**Files:**

- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/content/blog/blender-server-room-02-room.md`

- [ ] **Step 1: 学習ログと画像を照合する**

Read:

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/docs/learning-log.md
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/README.md
/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/content/blog/blender-server-room-01-rack.md
```

Expected:

- 記事へ書く数値が検証済みの値と一致する。
- 迷った点は、症状、原因、解決方法がそろっている。
- 5枚の画像に対応する説明がある。

- [ ] **Step 2: `@natural-japanese`を使って記事を書く**

Create `src/content/blog/blender-server-room-02-room.md` with this frontmatter:

```yaml
---
title: Blenderでラックを並べて3Dサーバールームを作る
description: Blender初心者が、第1回で作ったサーバーラックを複製し、床と壁、マテリアル、照明、カメラを加えて3Dサーバールームへ広げる手順を紹介します。
publishedAt: '2026-07-29'
category: Frontend
tags:
  - Blender
  - 3D
draft: true
heroImage: ../../assets/blog/blender-02-completed-room.png
---
```

本文は次の順にする。

```text
導入
今回作るもの
第1回のファイルを引き継ぐ
ラックを2台へ増やす
床と壁を作る
マテリアルで色を付ける
Area Lightで照らす
カメラを合わせる
迷った点（確認済みの問題がある場合だけ）
完成確認
今回覚えた操作
次回
```

執筆条件:

- 全文を落ち着いた「です・ます調」にする。
- AIへ相談しながら学ぶ連載の文脈を導入で短く引き継ぐ。
- 第1回と同じ説明を長く繰り返さない。
- 前回記事へ`/blog/blender-server-room-01-rack/`でリンクする。
- 画像5枚へ具体的なaltと図番号のキャプションを付ける。
- 操作名は日本語UIを基準にし、実機で確認した表記だけを書く。
- 確認していないショートカットや失敗を追加しない。
- 第3回ではオブジェクト名とTransformを確認し、GLBへ書き出すと予告する。

- [ ] **Step 3: 記事内の数値とファイル参照を確認する**

Run:

```bash
rg -n \
  "episode-02-server-room|EPISODE_02_OK|room_|rack_02|server_02|blender-02-" \
  src/content/blog/blender-server-room-02-room.md
```

Expected:

- `.blend`名と検証結果が正しい。
- 5枚の画像参照がある。
- 記事の数値が学習ログと検証スクリプトに反しない。

- [ ] **Step 4: natural-japaneseの静的検査を実行する**

Run:

```bash
uv run \
  "/Users/hiroshiimaizumi/Documents/tech blog 2/.agents/skills/natural-japanese/scripts/lint.py" \
  --json \
  --genre tech \
  src/content/blog/blender-server-room-02-room.md
```

Expected: 禁止語、翻訳調、過度な同型反復に関する未判断のfindingがない。findingが出た場合は、文脈に応じて修正または残す理由を判断し、再実行する。

- [ ] **Step 5: Prettierで記事を整形する**

Run:

```bash
npx prettier --write src/content/blog/blender-server-room-02-room.md
npx prettier --check src/content/blog/blender-server-room-02-room.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 6: 記事下書きをコミットする**

Run:

```bash
git add src/content/blog/blender-server-room-02-room.md
git diff --cached --check
git commit -m "docs: draft Blender server room episode two"
```

Expected: 記事下書きのコミットが1件作成される。

## Task 9: ブログ全体を検証して下書きを引き渡す

**Files:**

- Verify: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/content/blog/blender-server-room-02-room.md`
- Verify: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-02-*.png`

- [ ] **Step 1: Content CollectionとTypeScriptを検査する**

Run:

```bash
cd "/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design"
npm run check
```

Expected: `0 errors`

- [ ] **Step 2: Unit testsを実行する**

Run:

```bash
npm test
```

Expected: 全テスト成功

- [ ] **Step 3: Production buildを実行する**

Run:

```bash
npm run build
```

Expected:

- 終了コード`0`
- Build検証とPagefind生成が成功する。
- `draft: true`のため、`dist/blog/blender-server-room-02-room/index.html`は生成されない。

- [ ] **Step 4: E2E testsを実行する**

Run:

```bash
npm run test:e2e
```

Expected: 全テスト成功。第2回は下書きのため、公開記事数、最新記事、Visual snapshotは変わらない。

- [ ] **Step 5: 両リポジトリの最終状態を確認する**

Run:

```bash
git status --short --branch
git log -5 --oneline
git -C "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard" status --short --branch
git -C "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard" log -7 --oneline
git -C "/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard" tag --list episode-02
```

Expected:

- 両リポジトリがclean
- ブログが`codex/blender-episode-02-design`
- 3D制作が`codex/episode-02-server-room`
- `episode-02`タグが1行表示される。

- [ ] **Step 6: ユーザーへ下書き確認を依頼する**

報告内容:

- `episode-02-server-room.blend`の検証結果
- 記事ファイルへのリンク
- 画像5枚へのリンク
- ブログの`check`、unit、build、E2E結果
- 第2回記事はまだ`draft: true`で、公開もPR作成もしていないこと

ユーザーが記事と画像を承認するまで、`draft: false`への変更、PR作成、マージ、デプロイは行わない。
