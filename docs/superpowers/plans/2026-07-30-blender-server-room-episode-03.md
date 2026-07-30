# Blender 3Dサーバールーム連載 第3回 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第2回のBlenderモデルをWeb向けGLBとして書き出し、形式・React向け構造・見た目を検証したうえで、第3回の記事下書きを作る。

**Architecture:** 3D制作リポジトリにGLB、構造検証スクリプト、固定版Khronos Validatorのラッパー、検証レポートを置く。Blender GUIから25個のMeshだけを書き出し、Pythonによる意味検証、Khronos Validatorによる形式検証、ブラウザビューアーによる目視確認を独立して行う。ブログリポジトリには6枚の証跡画像と「です・ます調」の記事下書きを追加する。

**Tech Stack:** Blender 5.2.0 LTS、glTF 2.0 / GLB、Python 3標準ライブラリ、Node.js 24、`gltf-validator@2.0.0-dev.3.10`、Khronos glTF Sample Viewer、Astro 7

---

## 作業場所と境界

この計画は、次の2リポジトリを順に扱う。

- 3D制作: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard`
- ブログ: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design`

第3回ではReactアプリを作らない。GLBをReactへコピーする作業、React Three Fiber、クリック操作、監視JSON、状態色、Draco圧縮は第4回へ送る。

作成・変更するファイルの責務は次のとおり。

| リポジトリ | ファイル | 責務 |
| --- | --- | --- |
| 3D | `scripts/verify_episode_03.py` | GLBのJSONチャンクを読み、Reactで必要な構造上の不変条件を検証する |
| 3D | `tests/test_verify_episode_03.py` | 正常な最小GLBと壊したGLBで構造検証を回帰テストする |
| 3D | `scripts/validate_episode_03.mjs` | 固定版Khronos Validatorを実行し、JSONレポートを保存する |
| 3D | `.gitignore`、`.nvmrc` | 既存のGit除外を保ったままインストール済み依存を対象外にし、Node.js 24を指定する |
| 3D | `package.json`、`package-lock.json` | Validatorのバージョンと再現コマンドを固定する |
| 3D | `models/episode-03-server-room.glb` | Blender GUIから書き出す第3回の成果物 |
| 3D | `reports/episode-03-server-room.validator.json` | Validatorの機械可読な実行結果 |
| 3D | `docs/learning-log.md` | 操作、設定、結果、警告判断、迷った点を記録する |
| 3D | `README.md` | 第3回の成果物と再検証コマンドを案内する |
| ブログ | `src/assets/blog/blender-03-*.png` | 書き出しから検証までの証跡6枚 |
| ブログ | `src/content/blog/blender-server-room-03-glb.md` | 第3回の記事下書き |

### Task 1: 第2回の入力モデルと作業ブランチを固定する

**Files:**
- Verify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend`
- Verify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/scripts/verify_episode_02.py`

- [ ] **Step 1: 3D制作リポジトリがクリーンであることを確認する**

Run:

```sh
cd /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard
git status --short --branch
```

Expected: 未追跡・変更ファイルがなく、`codex/episode-02-server-room`を表示する。想定外の変更がある場合は削除や上書きをせず、実装を止めてユーザーへ確認する。

- [ ] **Step 2: 第3回用ブランチを作る**

Run:

```sh
git switch -c codex/episode-03-glb
```

Expected: `Switched to a new branch 'codex/episode-03-glb'`。

- [ ] **Step 3: 第2回の検証を再実行する**

Run:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-02-server-room.blend \
  --python scripts/verify_episode_02.py
```

Expected: 終了コード0かつ末尾に`EPISODE_02_OK`。

- [ ] **Step 4: 入力ファイルの基準ハッシュを記録する**

Run:

```sh
shasum -a 256 blender/episode-02-server-room.blend
```

Expected: 64桁のSHA-256値を表示する。この値をTask 5の再確認まで作業メモへ保持する。

### Task 2: GLB構造検証をテスト駆動で作る

**Files:**
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/tests/test_verify_episode_03.py`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/scripts/verify_episode_03.py`

- [ ] **Step 1: 正常な最小GLBを組み立てるテストヘルパーを書く**

`tests/test_verify_episode_03.py`へ、Python標準ライブラリだけを使う`unittest.TestCase`を作る。`scripts`を`sys.path`へ追加して`verify_episode_03`をimportする。

テスト内の`valid_document()`は次を満たす辞書を返す。

- `asset.version`は`2.0`
- `scene`は`0`、`scenes`は1件
- 25個の期待名を持つノードをscene直下へ置く
- ノード`i`はMesh`i`を参照する
- Meshはそれぞれ単一primitiveを持つ
- materialsは次の順で4件:
  `mat_floor_gray`、`mat_wall_light_gray`、`mat_rack_dark_gray`、`mat_server_gray`
- ノード種別に応じてprimitiveのmaterial indexを割り当てる

`write_glb(path, document)`はJSONをUTF-8へ変換し、空白で4バイト境界へpaddingし、次のGLB 2.0バイナリを作る。

```python
json_bytes = json.dumps(document, separators=(",", ":")).encode("utf-8")
json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
json_chunk = struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
payload = struct.pack("<4sII", b"glTF", 2, 12 + len(json_chunk)) + json_chunk
path.write_bytes(payload)
```

- [ ] **Step 2: 正常系と代表的な異常系の失敗テストを書く**

最低限、次のテストを追加する。

```python
def test_valid_document_has_no_errors(self):
    self.assertEqual([], verify.validate_document(valid_document()))

def test_glb_round_trip(self):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "room.glb"
        write_glb(path, valid_document())
        self.assertEqual([], verify.validate_document(verify.read_glb_json(path)))

def test_rejects_duplicate_node_name(self):
    document = valid_document()
    document["nodes"][1]["name"] = document["nodes"][0]["name"]
    self.assertTrue(
        any("node names must be globally unique" in error
            for error in verify.validate_document(document))
    )

def test_rejects_shared_mesh(self):
    document = valid_document()
    document["nodes"][1]["mesh"] = document["nodes"][0]["mesh"]
    self.assertTrue(
        any("25 distinct meshes" in error
            for error in verify.validate_document(document))
    )

def test_rejects_wrong_server_material(self):
    document = valid_document()
    server = next(
        node for node in document["nodes"]
        if node["name"] == "server_01_01"
    )
    document["meshes"][server["mesh"]]["primitives"][0]["material"] = 2
    self.assertTrue(
        any("server_01_01" in error and "mat_server_gray" in error
            for error in verify.validate_document(document))
    )
```

表形式のsubtestまたは個別テストで、さらに次を1件ずつ壊して検出する。

- GLB magic、version、先頭chunk type
- `scenes`が2件、`scene`が範囲外
- sceneから到達できないnode、nodeの循環、不正なchildren index
- node数不足、nodeの`mesh`欠落、不正なmesh index
- 期待名の欠落、想定外名、`.001`を含む名前
- `meshes`が25件でない、primitiveが0件または2件
- material参照欠落、不正なmaterial index、誤った割り当て
- materialsの不足、余分、重複
- `cameras`、nodeの`camera`、`animations`
- `KHR_lights_punctual`
- `KHR_draco_mesh_compression`
- `EXT_mesh_gpu_instancing`

- [ ] **Step 3: テストを実行し、未実装で失敗することを確認する**

Run:

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Expected: `ModuleNotFoundError: No module named 'verify_episode_03'`または未定義関数によるFAIL。

- [ ] **Step 4: GLBパーサーと期待値を実装する**

`scripts/verify_episode_03.py`へ次の公開インターフェースを作る。

```python
def read_glb_json(path: Path) -> dict:
    """GLB 2.0の先頭JSON chunkを読み、dictとして返す。"""

def validate_document(document: dict) -> list[str]:
    """全不変条件を調べ、エラーメッセージを返す。"""

def main(argv: list[str]) -> int:
    """検証結果を表示し、成功0・失敗1を返す。"""
```

期待ノードは明示的な定数にし、material割り当ては名前から曖昧に推測せず、次の集合で判定する。

```python
FLOOR_NODES = {"room_floor"}
WALL_NODES = {"room_wall_back", "room_wall_left"}
RACK_NODES = {
    f"rack_{rack:02d}_frame_{part}"
    for rack in (1, 2)
    for part in ("bottom", "left", "right", "top")
}
SERVER_NODES = {
    *{f"server_01_{number:02d}" for number in range(1, 7)},
    *{f"server_02_{number:02d}" for number in range(1, 9)},
}
EXPECTED_MATERIAL_BY_NODE = {
    **{name: "mat_floor_gray" for name in FLOOR_NODES},
    **{name: "mat_wall_light_gray" for name in WALL_NODES},
    **{name: "mat_rack_dark_gray" for name in RACK_NODES},
    **{name: "mat_server_gray" for name in SERVER_NODES},
}
```

`read_glb_json`は最低限、次を検証してからJSONをdecodeする。

- ファイル長が12バイト以上
- magicが`b"glTF"`
- versionが`2`
- headerのdeclared lengthが実ファイル長と一致
- 先頭chunk headerが存在
- 先頭chunk typeが`b"JSON"`
- chunk lengthがファイル範囲内
- JSON rootがobject

`validate_document`は設計書6.2の項目をすべて実装する。scene到達性はDFSで求め、訪問中nodeへ戻るedgeはcycleとして報告する。indexは`bool`を整数として受け付けず、`type(value) is int`かつ範囲内であることを確認してから配列を参照する。拡張機能はrootの`extensionsUsed`・`extensionsRequired`に加え、指定された各要素の`extensions`キーも確認する。

成功時のCLI出力は記事画像に使えるよう固定する。

```text
EPISODE_03_OK
nodes=25 meshes=25 materials=4 servers=14
representative_servers=server_01_01,server_02_08
```

失敗時は先頭に`EPISODE_03_FAILED`、続けて1行1件のエラーを出す。予期しない例外のtracebackを通常の検証失敗として隠さない。

- [ ] **Step 5: 全テストが通るまで最小修正する**

Run:

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Expected: 全テストが`ok`、末尾に`OK`。

- [ ] **Step 6: 構造検証の実装をコミットする**

Run:

```sh
git add scripts/verify_episode_03.py tests/test_verify_episode_03.py
git commit -m "test: add episode three GLB structure verification"
```

Expected: 2ファイルを含む新規commit。

### Task 3: 固定版Khronos Validatorの実行環境を作る

**Files:**
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/scripts/validate_episode_03.mjs`
- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.gitignore`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/.nvmrc`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/package.json`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/package-lock.json`
- Create during validation: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/reports/episode-03-server-room.validator.json`

- [ ] **Step 1: Node.js 24とGit除外設定を作る**

`.nvmrc`を次の内容で作る。

```text
24
```

既存`.gitignore`の内容を変更・削除せず、末尾へ次の1行を追記する。

```gitignore
node_modules/
```

Run:

```sh
nvm use
node --version
```

Expected: Node.js 24系を表示する。`nvm`が使えない場合は、そのMacで利用しているNode version managerから24系を有効にし、`node --version`が`v24.*`になるまで`npm install`へ進まない。

- [ ] **Step 2: package metadataと固定依存を作る**

次の`package.json`を作る。

```json
{
  "name": "3d-server-room-dashboard",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24 <25"
  },
  "scripts": {
    "test": "python3 -m unittest discover -s tests -p 'test_*.py' -v",
    "validate:episode-03": "node scripts/validate_episode_03.mjs models/episode-03-server-room.glb reports/episode-03-server-room.validator.json"
  },
  "devDependencies": {
    "gltf-validator": "2.0.0-dev.3.10"
  }
}
```

Run:

```sh
npm install
```

Expected: `package-lock.json`が作られ、`npm ls gltf-validator`に`gltf-validator@2.0.0-dev.3.10`と表示される。

- [ ] **Step 3: 引数と入力ファイルを検証する失敗テストを行う**

`scripts/validate_episode_03.mjs`をまだ作らずに実行する。

Run:

```sh
node scripts/validate_episode_03.mjs
```

Expected: `MODULE_NOT_FOUND`で失敗する。

- [ ] **Step 4: Validatorラッパーを実装する**

`scripts/validate_episode_03.mjs`は次の処理だけを担当する。

1. `inputPath`と`reportPath`の2引数がなければusageをstderrへ出して終了コード2。
2. GLBを`readFile`で読む。
3. `gltf-validator`の`validateBytes(new Uint8Array(bytes), { uri })`へ渡す。
4. report親ディレクトリを`mkdir({ recursive: true })`で作る。
5. 再実行ごとに変わるトップレベルの`validatedAt`だけを結果から削除する。検証日時は`docs/learning-log.md`へJSTで記録する。
6. 結果を末尾改行付き・2スペースindentのJSONで保存する。
7. `issues.numErrors`、`numWarnings`、`numInfos`、`numHints`をstdoutへ表示する。
8. `numErrors > 0`なら終了コード1、それ以外は0。

中心部分は次の形にする。

```js
const result = await validator.validateBytes(new Uint8Array(bytes), {
  uri: path.basename(inputPath),
});

delete result.validatedAt;
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`);

const { numErrors, numWarnings, numInfos, numHints } = result.issues;
console.log(
  `errors=${numErrors} warnings=${numWarnings} infos=${numInfos} hints=${numHints}`,
);
process.exitCode = numErrors > 0 ? 1 : 0;
```

importはNode組み込みの`node:fs/promises`、`node:path`と`gltf-validator`だけに限定する。

- [ ] **Step 5: usageと存在しない入力の失敗を確認する**

Run:

```sh
node scripts/validate_episode_03.mjs
node scripts/validate_episode_03.mjs missing.glb reports/missing.json
```

Expected: 1つ目はusageと終了コード2、2つ目は`ENOENT`と非0終了コード。`reports/missing.json`は作られない。

- [ ] **Step 6: Validator基盤をコミットする**

Run:

```sh
git add .gitignore .nvmrc package.json package-lock.json \
  scripts/validate_episode_03.mjs
git commit -m "build: add pinned GLB validator"
```

Expected: Node.js指定、dependency lock、ラッパーを含む新規commit。`node_modules`は`.gitignore`により`git status`へ出ず、stageもしない。

### Task 4: Blender GUIから25個のMeshをGLBへ書き出す

**Files:**
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/models/episode-03-server-room.glb`
- Preserve unchanged: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend`
- Capture later: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-source-model.png`
- Capture later: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-mesh-selection.png`
- Capture later: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-export-settings.png`

このTaskはユーザーとの対話チェックポイントである。一度に1つの操作まとまりだけ案内し、ユーザーの`ok`または画面確認を受けて次へ進む。Macのキー表記は`Alt`ではなく`Option`と説明する。スクリーンショットの撮り直しは、ユーザーの依頼どおりCodexが操作する。

- [ ] **Step 1: Blenderで入力ファイルを開く**

先に出力ディレクトリを作る。

Run:

```sh
mkdir -p /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/models
```

Open:

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/blender/episode-02-server-room.blend
```

Expected: 床、壁2面、ラック2台、サーバー14台、Camera、Area Lightが見える。

- [ ] **Step 2: 完成モデルとOutlinerを撮る**

Outlinerでオブジェクト名が読め、3D Viewportで全体が見える構図にする。`blender-03-source-model.png`として撮影する。CameraとLightが存在する入力モデルだと分かることを確認する。

- [ ] **Step 3: Meshだけを25個選択する**

Outlinerの種別フィルターまたはオブジェクト種別による選択を使い、Mesh 25個だけを選ぶ。Cameraの`room_overview_camera`とLightの`room_key_light`は選択しない。

Expected: BlenderのstatusまたはOutlinerで選択数25を確認できる。`blender-03-mesh-selection.png`として撮影する。

- [ ] **Step 4: glTF 2.0書き出し画面を開く**

Blender UI:

```text
ファイル > エクスポート > glTF 2.0 (.glb/.gltf)
```

出力先を次にする。

```text
/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/models/episode-03-server-room.glb
```

- [ ] **Step 5: 設計どおりの書き出し設定にする**

| Blender 5.2の項目 | 状態 |
| --- | --- |
| Format | `glTF Binary (.glb)` |
| Include > Selected Objects | ON |
| Include > Cameras | OFF |
| Include > Punctual Lights | OFF |
| Transform > +Y Up | ON |
| Data > Mesh > Apply Modifiers | OFF |
| Data > Materials | `Export` |
| Data > Draco Mesh Compression | OFF |
| Animations | OFF |

設定が読める状態で`blender-03-export-settings.png`を撮る。1画面に収まらない場合は、記事で使う8項目が判別できるようパネルを畳み、解像度を落とさない。

- [ ] **Step 6: GLBを書き出す**

`Export glTF 2.0`を押す。

Run:

```sh
test -s models/episode-03-server-room.glb
file models/episode-03-server-room.glb
```

Expected: ファイルが0バイトより大きく、`glTF binary model, version 2`相当と判定される。

- [ ] **Step 7: `.blend`を保存せずにBlenderを閉じる**

書き出し操作で選択状態や設定が変わっても、第2回ファイルを上書き保存しない。保存確認が出た場合は`保存しない`を選ぶ。

### Task 5: GLBを形式・構造・見た目の順に検証する

**Files:**
- Verify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/models/episode-03-server-room.glb`
- Create: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/reports/episode-03-server-room.validator.json`
- Capture later: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-validator-result.png`
- Capture later: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-browser-viewer.png`
- Capture later: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-node-names.png`

- [ ] **Step 1: 単体テストを再実行する**

Run:

```sh
npm test
```

Expected: 全`unittest`が成功する。

- [ ] **Step 2: Khronos Validatorを実行する**

Run:

```sh
npm run validate:episode-03
```

Expected: 終了コード0、`errors=0`、レポートが作成される。

- [ ] **Step 3: 保存レポートの件数と固定バージョンを確認する**

Run:

```sh
node -e '
const report = require("./reports/episode-03-server-room.validator.json");
console.log(report.validatorVersion);
console.log(report.issues);
if (report.issues.numErrors !== 0) process.exit(1);
'
npm ls gltf-validator
```

Expected: `numErrors: 0`、dependencyは`2.0.0-dev.3.10`。警告が0でない場合はコード、JSON pointer、修正要否を確認し、判断をTask 6の学習ログへ記載する。Validator結果が読める画面を`blender-03-validator-result.png`として撮る。

- [ ] **Step 4: React向け構造検証を実行する**

Run:

```sh
python3 scripts/verify_episode_03.py models/episode-03-server-room.glb
```

Expected:

```text
EPISODE_03_OK
nodes=25 meshes=25 materials=4 servers=14
representative_servers=server_01_01,server_02_08
```

この3行が読める画面を`blender-03-node-names.png`として撮る。

- [ ] **Step 5: Khronos glTF Sample Viewerで見た目を確認する**

ブラウザで次を開く。

```text
https://github.khronos.org/glTF-Sample-Viewer-Release/
```

`models/episode-03-server-room.glb`をドラッグ＆ドロップし、次をユーザーと確認する。

- 床、壁2面、ラック2台、サーバー14台が見える
- 壁、床、ラック、サーバーの4色を見分けられる
- 回転とズームができる
- 上下、前後が反転していない
- Blenderと明るさが違っても、Viewer独自の照明による差として説明できる

全体が読み取りやすい角度で`blender-03-browser-viewer.png`を撮る。ローカルGLBを外部サーバーへアップロードしない。

- [ ] **Step 6: 入力`.blend`が変わっていないことを確認する**

Run:

```sh
shasum -a 256 blender/episode-02-server-room.blend
git diff --exit-code -- blender/episode-02-server-room.blend
```

Expected: SHA-256がTask 1と一致し、`git diff`は終了コード0。

- [ ] **Step 7: 成果物をコミットする**

Run:

```sh
git add models/episode-03-server-room.glb \
  reports/episode-03-server-room.validator.json
git commit -m "feat: export validated episode three GLB"
```

Expected: GLBとValidatorレポートを含む新規commit。

### Task 6: 学習ログとREADMEへ再現手順を残す

**Files:**
- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/docs/learning-log.md`
- Modify: `/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard/README.md`

記事・学習ログの日本語を整えるため、編集前に`@natural-japanese`を使う。

- [ ] **Step 1: 学習ログへEpisode 03を追記する**

`docs/learning-log.md`へ、既存のEpisode 01・02と同じ構造で次を追記する。

```markdown
## Episode 03: サーバールームをGLBで書き出す

### 環境
### 完成条件
### 実際に使った操作
### 書き出し設定
### 迷った点
### スクリーンショット
### 確認結果
```

必ず次を記録する。

- Blender 5.2.0 LTS、日本語UI、Macのトラックパッド
- 25個のMeshだけを選択し、CameraとArea Lightを除外したこと
- 8項目の書き出し設定
- 4マテリアルを共有したまま書き出したこと
- Validatorのversion、errors/warnings件数
- warningsがある場合のコード、対象、採用または修正理由
- 構造検証の25 nodes / 25 meshes / 4 materials / 14 servers
- Sample Viewerの確認結果と、明るさがBlenderと完全一致しない理由
- 実際に迷った操作や再書き出しがあれば、その事実
- 6枚の画像ファイル名
- 確認日時をJSTで具体的に記録

- [ ] **Step 2: READMEへEpisode 03を追記する**

次の内容を含む`## Episode 03`を追加する。

- 成果物`models/episode-03-server-room.glb`
- 25個のMesh、Camera/Lightなし、4マテリアル
- `npm ci`
- `npm test`
- `npm run validate:episode-03`
- `python3 scripts/verify_episode_03.py models/episode-03-server-room.glb`
- Validator reportの場所
- React表示と動的な状態色はEpisode 04で扱うこと

- [ ] **Step 3: ドキュメントの事実とコマンドを再確認する**

Run:

```sh
npm ci
npm test
npm run validate:episode-03
python3 scripts/verify_episode_03.py models/episode-03-server-room.glb
git diff --check
```

Expected: 全コマンド成功、`git diff --check`は出力なし。

- [ ] **Step 4: ドキュメントをコミットする**

Run:

```sh
git add README.md docs/learning-log.md
git commit -m "docs: record episode three GLB workflow"
```

Expected: READMEと学習ログを含む新規commit。

- [ ] **Step 5: 3D成果物全体を最終検証する**

Run:

```sh
git status --short
npm test
npm run validate:episode-03
python3 scripts/verify_episode_03.py models/episode-03-server-room.glb
git diff --exit-code
```

Expected: worktreeがクリーンで、テストと両検証が成功する。

- [ ] **Step 6: 検証済みcommitへEpisode 03タグを付ける**

Run:

```sh
git tag -a episode-03 -m "Episode 03: validated GLB export"
git show --stat --oneline episode-03
```

Expected: `episode-03`が現在の検証済みcommitを指す。既に同名タグがある場合は上書きせず、実装を止めて確認する。

### Task 7: 6枚の画像をブログ用に整える

**Files:**
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-source-model.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-mesh-selection.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-export-settings.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-validator-result.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-browser-viewer.png`
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-node-names.png`

- [ ] **Step 1: 6枚がそろっていることを確認する**

Run:

```sh
cd "/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design"
for image in \
  blender-03-source-model.png \
  blender-03-mesh-selection.png \
  blender-03-export-settings.png \
  blender-03-validator-result.png \
  blender-03-browser-viewer.png \
  blender-03-node-names.png
do
  test -s "src/assets/blog/$image" || exit 1
done
```

Expected: 終了コード0。

- [ ] **Step 2: 各画像を目視確認する**

次を確認し、読めない画像だけCodexが撮り直す。

- UIやterminalの秘密情報、不要な通知、個人情報が写っていない
- 画像ごとの主題が1つに絞られている
- export設定と代表node名を100%表示でも読める
- Sample Viewerのモデルが切れていない

- [ ] **Step 3: ブログ向けに軽量化する**

既存ブログの画像処理方針に合わせ、文字の可読性を保ったまま過度に大きいPNGだけを最適化する。機械的な最適化後は全6枚を再度目視する。元画像より容量が増える場合は置き換えない。

- [ ] **Step 4: 画像を先にコミットする**

Run:

```sh
git add src/assets/blog/blender-03-*.png
git commit -m "assets: add episode three GLB screenshots"
```

Expected: 6枚だけを含む新規commit。

### Task 8: 第3回の記事下書きを作る

**Files:**
- Create: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/content/blog/blender-server-room-03-glb.md`

記事の執筆・推敲では`@natural-japanese`を使い、その後`@stop-ai-slop-jp`で不自然なAI調を確認する。技術用語を無理に日本語化せず、丁寧な「です・ます調」にそろえる。

- [ ] **Step 1: frontmatterと記事の骨組みを書く**

frontmatterは次を基準にする。実際の執筆日が変わった場合だけ`publishedAt`をその日時へ更新する。

```yaml
---
title: Blenderの3DサーバールームをGLBで書き出して検証する
description: Blender初心者が、3DサーバールームをGLB形式へ書き出し、Khronos Validatorと構造検証、ブラウザビューアーでReact表示の準備を確認します。
publishedAt: '2026-07-30T21:00:00+09:00'
category: Frontend
tags:
  - Blender
  - 3D
draft: true
heroImage: ../../assets/blog/blender-03-browser-viewer.png
---
```

本文は次の順にする。

1. 導入: AIに相談しながら3Dを学ぶ流れを短く引き継ぐ
2. 今回作るもの: 第3回はGLBの準備と検証まで、Reactは第4回
3. GLBとは何か: `.blend`との役割の違い
4. 書き出すオブジェクトを選ぶ: 25 Mesh、Camera/Light除外
5. glTF Binaryで書き出す: 8項目の設定と理由
6. Khronos Validatorで形式を確認する
7. Pythonでnode名とmaterial割り当てを確認する
8. Sample Viewerで形・色・向きを確認する
9. 共有materialとReactでの個別色変更の関係
10. 今回覚えたこと
11. 次回: React Three Fiberで読み込み、監視状態で色を変える

- [ ] **Step 2: 6枚の画像とcaptionを配置する**

画像は作業の流れに沿って1〜6の順で使う。

```markdown
![第2回で完成した3DサーバールームとOutliner](../../assets/blog/blender-03-source-model.png)
<span class="article-image-caption">図1：...</span>
```

同じ形式で全6枚へ具体的な代替テキストとcaptionを付ける。代替テキストは「画像」「スクリーンショット」だけにせず、画面から分かる内容を書く。

- [ ] **Step 3: 実測結果と学習ログを反映する**

記事へ推測値を書かず、次を3Dリポジトリの成果物から転記する。

- Validator version、errors/warnings件数
- `nodes=25 meshes=25 materials=4 servers=14`
- `server_01_01`と`server_02_08`
- 実際に迷った点と解決
- Sample Viewerで確認した見た目

共有materialはGLBの欠陥ではないこと、第4回で各サーバーのmaterialをcloneして個別色を付けることを、実装コードなしで説明する。

- [ ] **Step 4: 日本語と事実関係を推敲する**

次を確認する。

- 全文が「です・ます調」
- 大げさな成功表現や、実測していない感想がない
- AIによって3Dへのハードルが下がり、勉強を始めたという軸が自然に残る
- 第1回・第2回の導入を繰り返しすぎない
- GLBとglTFの使い分けが一貫している
- Reactで動的に色を変えるのは第4回だと誤解なく伝わる

- [ ] **Step 5: formatとAstro検証を行う**

Run:

```sh
nvm use
node --version
npm run format -- src/content/blog/blender-server-room-03-glb.md
npm run format:check
npm run check
npm test
SITE_URL=https://example.invalid npm run build
```

Expected: Node.js 24系を使用し、Prettier、Astro check、Vitest、production buildがすべて成功する。draft記事がproduction buildに出ない既存仕様も維持される。

- [ ] **Step 6: 記事下書きをコミットする**

Run:

```sh
git add src/content/blog/blender-server-room-03-glb.md
git commit -m "docs: draft Blender server room episode three"
```

Expected: 記事1ファイルを含む新規commit。

### Task 9: ユーザー確認用のローカルプレビューを行う

**Files:**
- Verify: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/content/blog/blender-server-room-03-glb.md`
- Verify: `/Users/hiroshiimaizumi/Documents/tech blog 2/.worktrees/blender-episode-02-design/src/assets/blog/blender-03-*.png`

- [ ] **Step 1: 確認中だけ記事を表示できる方法を選ぶ**

既存サイトがdraft表示用の環境変数やrouteを持つ場合はそれを使う。持たない場合は、ユーザー確認用の一時変更として`draft: false`へ変更し、commitせずにpreviewする。確認後は必ず`draft: true`へ戻し、記事本文以外の差分を残さない。

- [ ] **Step 2: ローカルサーバーを起動する**

Run:

```sh
npm run dev -- --host 127.0.0.1
```

Expected: Astro dev serverが起動し、記事URLをローカルで開ける。

- [ ] **Step 3: デスクトップ幅とモバイル幅で確認する**

最低限、次を確認する。

- タイトル、description、公開日、タグ
- 6枚すべての画像、caption、alt
- 表とコードブロックの横はみ出し
- 前後記事への導線
- 見出し階層
- モバイル幅での可読性

- [ ] **Step 4: ユーザーへ本文と画像の確認を依頼する**

この時点ではPR作成や公開を行わない。ユーザーにローカル記事を見てもらい、口調、画像、技術内容を確認してもらう。修正指示があれば、記事・画像だけを変更してTask 8 Step 5の検証を再実行する。

- [ ] **Step 5: 下書き状態とclean worktreeを確認する**

Run:

```sh
rg -n '^draft: true$' src/content/blog/blender-server-room-03-glb.md
git status --short
git log -5 --oneline
```

Expected: `draft: true`が1件あり、worktreeがクリーン。第3回記事と画像のcommitが確認できる。

## 完了条件

- 3D制作リポジトリで`episode-03-server-room.glb`を再検証できる
- Khronos Validatorは固定版で`numErrors=0`
- GLBは25 named nodes / 25 distinct meshes / 4 materials / 14 servers
- Camera、Light、animation、Draco、GPU instancingが含まれない
- 第2回の`.blend`は変更されていない
- Sample Viewerで形、色、向き、回転、ズームを確認済み
- 6枚の画像が読み取れる
- 第3回の記事は丁寧な「です・ます調」のdraft
- React実装と公開はまだ行っていない
