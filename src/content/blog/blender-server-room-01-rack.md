---
title: Blender完全初心者がCubeだけでサーバーラックを作る
description: Blenderを初めて触るインフラ／Webエンジニア向けに、Macのトラックパッドで視点を動かし、Cubeの変形と複製でサーバーラックを1台作る手順を紹介します。
publishedAt: '2026-07-29'
category: Frontend
tags:
  - Blender
  - 3D
draft: true
heroImage: ../../assets/blog/blender-01-completed-rack.png
---

Blenderの勉強を始めた。目標は、ブラウザで動かせる3Dサーバールーム監視画面を作ること。とはいえ、最初から部屋全体を作ろうとすると操作を覚える前に迷いそうだったので、第1回はサーバーラック1台に絞った。

使った形はCubeだけだ。数値を入力してフレームを組み、同じ形を複製して6台のサーバーを並べた。見た目はまだ灰色の箱だが、Blenderを初めて触った自分にとっては、ここまででも覚えることが多かった。

## 今回作るもの

4個のCubeでラックの外枠を作り、その中へ6個のCubeを並べる。マテリアルや照明はまだ使わない。

作業環境は次のとおり。

- macOS 26.5.2
- Blender 5.2.0 LTS
- Apple Silicon搭載Mac
- Macのトラックパッド
- Blenderの日本語UI

完成条件は、10個のCubeに決めた名前が付き、位置と寸法が想定値に合っていること。最後にBlenderを画面なしで起動する検証スクリプトを実行し、入力ミスがないかも調べた。

## Blenderのインストール

[Blender公式ダウンロードページ](https://www.blender.org/download/)からmacOS版を入手した。今回はApple Silicon搭載Macなので、対応するApple Silicon版を選んでいる。

macOS版はDMGで配布されている。ダウンロードしたDMGを開き、`Blender.app`を`Applications`フォルダへ移動すればインストールできる。この流れは[Blender公式マニュアルのmacOS向け手順](https://docs.blender.org/manual/en/dev/getting_started/installing/macos.html)でも確認できる。

今回実際に起動したバージョンはBlender 5.2.0 LTSだった。バージョンが変わるとメニュー名や配置も変わる可能性があるため、この記事では実際の画面を基準に説明する。

## 画面と視点操作

起動直後の画面には、中央の大きな3D Viewport、右上のOutliner、右下のPropertiesが並んでいる。

![Blender起動直後の3D Viewport、Outliner、Properties](../../assets/blog/blender-01-ui-overview.png)
<span class="article-image-caption">図1：Blender 5.2.0 LTSの初期画面。中央で形を確認し、右側でオブジェクトやシーンの設定を扱う。</span>

3D Viewportはモデルを選んだり、見る角度を変えたりする場所だ。Outlinerにはシーン内のオブジェクトが一覧表示される。Propertiesにはシーン単位などの設定がまとまっている。最初にPropertiesの`シーン > 単位`を開き、単位系をメートル法、長さをメートルにした。

Macのトラックパッドでは、追加設定をせずに次の操作が使えた。

| 操作           | トラックパッド                       |
| -------------- | ------------------------------------ |
| 視点を回転     | 2本指でドラッグ                      |
| 視点を平行移動 | `Shift`を押しながら2本指でドラッグ   |
| ズーム         | `Control`を押しながら2本指でドラッグ |

操作中は、ポインターを3D Viewportの上に置いておく。Blenderのショートカットは、ポインターがある領域に対して働くためだ。視点を見失ったときは、`ビュー > 全てを表示`でモデル全体を表示し直せた。

## ラックのフレーム

最初から置かれているCubeを左側の柱に使った。CameraとLightはOutlinerで選び、`X`キーで削除した。

Cubeを選択して`N`キーを押すと、3D Viewportの右側にSidebarが開く。`アイテム > トランスフォーム`でLocation（位置）とDimensions（寸法）を数値入力できる。

![左フレームのLocationとDimensionsを入力した画面](../../assets/blog/blender-01-transform-panel.png)
<span class="article-image-caption">図2：左フレームを選択し、位置X=-0.36 m、寸法X=0.08 m、Y=1 m、Z=2 mを入力した状態。</span>

フレーム4個の値は次のようにした。

| オブジェクト名         | Location X / Y / Z | Dimensions X / Y / Z |
| ---------------------- | ------------------ | -------------------- |
| `rack_01_frame_left`   | `-0.36 / 0 / 1.0`  | `0.08 / 1.0 / 2.0`   |
| `rack_01_frame_right`  | `0.36 / 0 / 1.0`   | `0.08 / 1.0 / 2.0`   |
| `rack_01_frame_top`    | `0 / 0 / 1.96`     | `0.8 / 1.0 / 0.08`   |
| `rack_01_frame_bottom` | `0 / 0 / 0.04`     | `0.8 / 1.0 / 0.08`   |

左の柱を選び、`Shift + D`で複製した直後に右クリックすると、複製した形を元と同じ場所へ残せる。そのまま名前とLocation Xだけを変えて右の柱にした。

上側のフレームは`Shift + A > メッシュ > 立方体`で追加した。下側は再び`Shift + D`で複製し、Location Zを変えた。

![4個のCubeで組んだサーバーラックのフレーム](../../assets/blog/blender-01-rack-frame.png)
<span class="article-image-caption">図3：左右の柱と上下の横枠を配置した段階。まだ中のサーバーは置いていない。</span>

この作業では、マウスで大きさを合わせるより数値入力のほうが扱いやすかった。少なくとも同じ寸法を何度も使うラックでは、左右のずれを目で探さずに済む。

## サーバーの複製

サーバーもCubeで作る。1台目の寸法は`0.64 / 0.9 / 0.12`、位置は`0 / -0.03 / 0.2`とした。

1台目を`Shift + D`で複製し、右クリックで移動を止める。その後、名前とLocation Zを変えながら上へ積んだ。6台のY座標と寸法は共通で、Z座標だけが変わる。

| オブジェクト名 | Location Z |
| -------------- | ---------: |
| `server_01_01` |      `0.2` |
| `server_01_02` |      `0.4` |
| `server_01_03` |      `0.6` |
| `server_01_04` |      `0.8` |
| `server_01_05` |      `1.0` |
| `server_01_06` |      `1.2` |

![4台目までサーバーを複製した途中の画面](../../assets/blog/blender-01-server-duplication.jpg)
<span class="article-image-caption">図4：4台目を選択した途中経過。Location Y=-0.03 m、Z=0.8 mと、共通の寸法をSidebarで確認している。</span>

図4は4台目まで作った時点を再現して撮影したものだ。この後、同じ手順で5台目と6台目を追加した。

## 符号を間違えたY座標

6台を並べ終えて検証したところ、最初は`EPISODE_01_FAILED`になった。サーバーのY座標へ`0.03`と入力しており、想定した`-0.03`とは符号が逆だったためだ。

画面だけを見るとラックの中には収まっていたので、自分では間違いに気づかなかった。6台すべてのY座標を`-0.03`へ直して保存すると、検証に通った。似たオブジェクトを複製すると、最初の入力ミスまで全部コピーされる。最初の1台を複製前に確認したほうが、後の修正は少なくて済む。

## 完成確認

完成したラックがこちら。

![4個のフレームと6台のサーバーで構成した完成ラック](../../assets/blog/blender-01-completed-rack.png)
<span class="article-image-caption">図5：Cubeだけで作った第1回の完成状態。下から6台のサーバーを数えられる。</span>

`Command + S`で保存した後、`.blend`ファイルを開き直し、フレーム4個とサーバー6台が残っていることを確認した。さらに、Blenderをバックグラウンド起動して検証スクリプトを実行した。

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background blender/episode-01-rack.blend \
  --python scripts/verify_episode_01.py
```

結果は`EPISODE_01_OK`。これは10個のMeshについて、名前、位置、寸法、シーンの単位が予定した値と一致したという意味だ。

## 今回覚えた操作

- 2本指ドラッグによる視点の回転
- `Shift`、`Control`を組み合わせた平行移動とズーム
- `N`キーで開くSidebarからの数値入力
- `Shift + A`でのCube追加
- `Shift + D`での複製
- Outlinerでの選択と名前変更
- `Command + S`での保存

今回は、Cubeを数値で変形し、複製して並べるところまで進めた。最初の成果物としては地味だが、位置と寸法を決めれば同じ形を再現できることは分かった。

## 次回

次回はこのラックを置く床と壁を作り、ラック自体も複製してサーバールームへ広げる。灰色一色の状態から、最低限の色と照明も加える予定だ。
