# Blender 3Dサーバールーム連載 第3回 設計書

作成日: 2026-07-30  
状態: ユーザー承認済み  
対象: 第1連載 第3回

## 1. 第3回ではReactから操作できるGLBを用意する

第2回で完成した3Dサーバールームを、Webブラウザで扱えるGLB形式へ書き出す。第3回ではReactアプリをまだ作らず、GLBの形式、見た目、オブジェクト名、マテリアルを検証する。

最終的な完成形は、React Three FiberでGLBを読み込み、監視データに応じて各サーバーの色を動的に変える3D監視ダッシュボードである。第3回は、そのための受け渡しデータを準備する回と位置付ける。

完成条件は次のとおり。

- 第2回のモデルからGLBを1ファイル書き出している。
- 床、壁、ラック、サーバーだけがGLBに含まれている。
- CameraとLightはGLBに含まれていない。
- デフォルトsceneから到達でき、Meshを参照するノードが25個ある。
- `meshes`配列にも25個のMeshがあり、25ノードから1対1で参照されている。
- 14台のサーバー名が`server_01_*`、`server_02_*`の形式で保持されている。
- 4種類のマテリアルと割り当て先が保持されている。
- Khronos glTF Validatorでエラーがない。
- ブラウザのGLBビューアーで形と色を確認でき、回転とズームができる。

## 2. 第2回のBlendファイルを変更せずに書き出す

入力には`blender/episode-02-server-room.blend`を使う。第2回の完成状態を保つため、Transformの適用、Meshの結合、マテリアルの複製などは行わない。

出力先は次のとおりとする。

```text
models/episode-03-server-room.glb
```

連載時点の成果物を再現できるよう、ファイル名にエピソード番号を含める。Reactアプリで使用するパスへのコピーや配置は第4回で行う。

書き出し前に第2回の検証スクリプトを再実行し、入力となる`.blend`が変更されていないことを確認する。書き出し後も`.blend`のGit差分がないことを確認する。

## 3. Meshだけを選択してglTF Binary形式で書き出す

ユーザーがBlenderの画面から`ファイル > エクスポート > glTF 2.0`を操作する。自動書き出しを主手順にはせず、エクスポート画面の項目とGLBの役割を学べる構成にする。

書き出し前に、シーン内のMeshだけを選択する。対象はラックのフレーム8個、サーバー14個、床1個、壁2個の合計25個である。

書き出し設定は次のとおり。

Blender 5.2.0 LTSのエクスポーターに表示される項目名と状態を、次のように固定する。

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

`Selected Objects`をONにし、25個のMeshオブジェクトだけを選択することで、CameraとArea Lightを対象外にする。`Cameras`と`Punctual Lights`もOFFにし、設定の意図を画面と学習ログへ残す。

CameraとLightは、第4回でReact Three Fiberのシーンに設定する。BlenderとWebでは画面サイズや操作方法が異なるため、Web側で管理したほうが調整しやすい。

## 4. オブジェクト名を監視データとの接続点にする

React側では、GLBのノード名と監視データのIDを対応させる。

```text
GLB node: server_01_01
JSON id:  server_01_01
```

検証では、次の25名がGLBのノード名として重複なく保持され、想定外のMeshノードがないことを確認する。

```text
rack_01_frame_bottom
rack_01_frame_left
rack_01_frame_right
rack_01_frame_top
rack_02_frame_bottom
rack_02_frame_left
rack_02_frame_right
rack_02_frame_top
room_floor
room_wall_back
room_wall_left
server_01_01
server_01_02
server_01_03
server_01_04
server_01_05
server_01_06
server_02_01
server_02_02
server_02_03
server_02_04
server_02_05
server_02_06
server_02_07
server_02_08
```

ノードを統合する最適化やGPU instancingは行わない。各サーバーが一意な名前を持つノードであり、各ノードが別々のMeshを参照する状態を優先する。

## 5. 基本マテリアルは共有し、状態色はReactで設定する

GLBには、第2回で作成した4種類のマテリアルを含める。

- `mat_wall_light_gray`
- `mat_floor_gray`
- `mat_rack_dark_gray`
- `mat_server_gray`

割り当ては次のとおりとする。

| 対象 | 個数 | マテリアル |
| --- | ---: | --- |
| `room_floor` | 1 | `mat_floor_gray` |
| `room_wall_back`、`room_wall_left` | 2 | `mat_wall_light_gray` |
| `rack_01_frame_*`、`rack_02_frame_*` | 8 | `mat_rack_dark_gray` |
| `server_01_*`、`server_02_*` | 14 | `mat_server_gray` |

14台のサーバーは`mat_server_gray`を共有したまま書き出す。Blender側でサーバーごとにマテリアルを複製すると、GLB内に同じ内容のマテリアルが増えるためである。

React側で共有マテリアルの色を直接変更すると、同じマテリアルを使うサーバーがまとめて変色する可能性がある。第4回では読み込み後に各サーバーのマテリアルを複製し、監視状態に応じて個別に色を設定する。第3回では方針の説明にとどめ、Reactの実装コードは載せない。

第3回の検証では、サーバーが共有マテリアルを使っていることも記録する。形状と基本色はBlender、動的な状態色はReactという役割分担にする。

## 6. 形式、意味、見た目を別々に検証する

GLBは3段階で検証する。

### 6.1 形式の検証

Khronos Groupの`gltf-validator` npmパッケージ`2.0.0-dev.3.10`を固定して使い、glTF 2.0として解釈できることを確認する。3D制作リポジトリへNode.js用の実行スクリプトを置き、JSONレポートを次の場所へ保存する。

```text
reports/episode-03-server-room.validator.json
```

Validatorの`numErrors`が0であることを完成条件とする。警告が出た場合は、警告コード、対象、採用または修正の判断理由を学習ログへ記録する。ブラウザ版Validatorは補助確認に使えるが、合否判定と保存レポートは固定バージョンのローカル実行を正とする。

### 6.2 React向け構造の検証

`scripts/verify_episode_03.py`を追加し、GLBのJSONチャンクを読み取る。検証では`scenes[scene].nodes`のルートだけでなく、`children`を再帰的にたどり、デフォルトsceneから到達できるノードを対象にする。

- GLB 2.0である。
- `scenes`配列が1件で、トップレベルの`scene`がその有効なindexを参照する。
- `nodes`配列がちょうど25件で、全ノードがデフォルトsceneから到達できる。
- Meshを参照するノードがちょうど25個あり、想定した25名と完全一致する。
- 25個のノード名がグローバルに一意である。
- `meshes`配列がちょうど25個あり、25ノードが別々のMeshを参照する。
- サーバーノードが14個あり、想定した14個のID集合と完全一致する。
- `.001`形式の名前が残っていない。
- `materials`配列に4種類のマテリアルがあり、想定外のマテリアルがない。
- 各形状ノードについて、`node.mesh`から`meshes[meshIndex]`を参照できる。
- 各Meshは単一のprimitiveを持ち、その`primitive.material`から想定したマテリアルを参照できる。
- 14個のサーバーノードすべてが`mat_server_gray`を参照する。
- `cameras`が存在しないか空であり、全ノードに`camera`プロパティがない。
- `animations`が存在しないか空である。
- `KHR_lights_punctual`が`extensionsUsed`、`extensionsRequired`、トップレベルと各ノードの`extensions`に存在しない。
- `KHR_draco_mesh_compression`が`extensionsUsed`、`extensionsRequired`、全primitiveの`extensions`に存在しない。
- `EXT_mesh_gpu_instancing`が`extensionsUsed`、`extensionsRequired`、全ノードの`extensions`に存在しない。

この検証は、GLBが壊れていないことだけでなく、第4回で名前によるノード検索ができることを保証する。

### 6.3 見た目の検証

Khronos glTF Sample Viewer（`https://github.khronos.org/glTF-Sample-Viewer-Release/`）へローカルのGLBをドラッグ＆ドロップし、次を目視で確認する。

- 床、壁、ラック2台、サーバー14台が表示される。
- 壁、床、ラック、サーバーの色を見分けられる。
- モデルを回転、ズームできる。
- 上下や前後が反転していない。
- Viewer独自の環境光で表示するため、BlenderのArea Lightを使った完成画像と明るさが完全に一致することは求めない。

Sample Viewerはブラウザ内でローカルファイルを読み込む。サーバーへファイルを保存する操作は行わない。代表ノード名は構造検証スクリプトの出力で`server_01_01`と`server_02_08`を確認し、画面を証跡として残す。

## 7. 問題は書き出し設定とGLB構造を照合して直す

作業対象は3D制作リポジトリ`/Users/hiroshiimaizumi/Documents/3d-server-room-dashboard`とする。Blenderは第2回と同じ5.2.0 LTSを使う。

基本の再現コマンドは次のとおり。

```sh
cd /Users/hiroshiimaizumi/Documents/3d-server-room-dashboard

/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-02-server-room.blend \
  --python scripts/verify_episode_02.py

npm run validate:episode-03
python3 scripts/verify_episode_03.py models/episode-03-server-room.glb
```

確認時の切り分けは次のとおり。

| 症状 | 最初に確認する項目 |
| --- | --- |
| オブジェクトが足りない | 書き出し前の選択範囲 |
| CameraやLightが入っている | 選択したオブジェクトのみを書き出す設定 |
| 色が表示されない | Materialの書き出し設定とBase Color |
| 名前が変わっている | BlenderのOutlinerとGLBのノード一覧 |
| サーバーが統合されている | Meshの結合や最適化を行っていないか |
| Validatorでエラーが出る | エラーのJSONパスと該当する書き出し設定 |
| 上下や前後が反転している | ビューアーの軸表示とglTFの座標変換 |

原因を確認できない現象は記事へ載せない。修正後はValidator、構造検証、ブラウザ確認を最初からやり直す。

## 8. ユーザーが書き出しとブラウザ確認を担当する

Blenderのエクスポート画面とブラウザビューアーはユーザーが操作する。Codexは一度に一つのまとまりを案内し、完了報告を受けてから次へ進む。

Codexは次を担当する。

- 第2回モデルの事前検証
- GLB構造検証スクリプトの作成
- Khronos glTF Validatorの実行
- GLB内部の名前とマテリアルの確認
- 反復的な確認作業
- 必要に応じた記事画像の撮り直し

各段階で、操作、設定値、結果、迷った点を`docs/learning-log.md`へ記録する。

## 9. 記事画像は書き出しから確認までの6枚に絞る

記事用の画像は次の6枚を基本とする。

1. 第2回の完成モデルとOutliner
2. 25個のMeshだけを選択した状態
3. GLBの書き出し設定
4. Validatorの結果
5. ブラウザビューアーで表示した完成モデル
6. 構造検証で`server_01_01`と`server_02_08`を確認した結果

公開画像はブログ用に軽量化し、設定項目やノード名を読める解像度を保つ。

記事は丁寧な「です・ます調」で書く。AIに相談しながらBlenderとWeb 3Dの境界を学ぶ流れは残すが、第1回と第2回の導入を長く繰り返さない。

## 10. 成果物と記事を検証後に記録する

3D制作リポジトリには次を追加または更新する。

```text
models/episode-03-server-room.glb
reports/episode-03-server-room.validator.json
scripts/verify_episode_03.py
scripts/validate_episode_03.mjs
docs/learning-log.md
README.md
package.json
package-lock.json
```

検証がすべて完了した時点で`episode-03`タグを付ける。

ブログリポジトリには次を追加する。

```text
src/content/blog/blender-server-room-03-glb.md
src/assets/blog/blender-03-*.png
```

記事は下書きとして作成し、本文、画像、ローカル検証、ユーザー確認を経てからPRと公開へ進む。

## 11. 第3回ではReactアプリを作らない

次の内容は第3回に含めない。

- ViteやReactプロジェクトの作成
- React Three FiberによるGLB読み込み
- OrbitControlsの実装
- サーバーのクリック選択
- 監視JSONとの接続
- 状態に応じた色変更
- 詳細パネルやグラフ
- Draco圧縮
- Meshの結合や軽量化

これらは第4回で扱う。第3回では、Reactから個別に扱える名前と構造を保ったGLBを作ることに集中する。

## 12. 参照資料

- [Blender Manual: glTF 2.0](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Khronos glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [KhronosGroup/glTF-Validator](https://github.com/KhronosGroup/glTF-Validator)
- [Khronos glTF Sample Viewer](https://github.khronos.org/glTF-Sample-Viewer-Release/)
