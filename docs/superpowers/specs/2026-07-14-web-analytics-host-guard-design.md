# Cloudflare Web Analytics 本番ホスト限定設計

## 結論

Cloudflare Web Analyticsは、閲覧中のホスト名が`SITE_URL`のホスト名と一致するときだけ読み込む。これにより、公開用の成果物をlocalhostやプレビュー環境で確認しても、アクセスとして記録されない。将来独自ドメインへ移行した場合も、`SITE_URL`の変更だけで追従する。

## 背景

現在は、本番ビルドかつ`PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`が設定されていれば、すべてのページにCloudflareのBeaconを直接出力している。この成果物をlocalhostでプレビューすると、同じBeaconが動作するため、開発者の閲覧がCloudflare Web Analyticsへ送信される。

2026年7月14日の確認では、直近24時間の12 visitsのうち9 visitsがlocalhost由来だった。検索や記事改善の効果を判断するには、公開サイトの閲覧だけを計測する必要がある。

## 採用する方式

Astroのビルド時に、`SITE_URL`から許可ホスト名を取得する。本番ビルドかつAnalytics tokenが設定された場合だけ、小さなローダーをHTMLへ出力する。

ローダーはブラウザ上で次の順に動作する。

1. 現在の`window.location.hostname`と許可ホスト名を完全一致で比較する。ポート番号は比較対象にしない。
2. 一致しなければ何もせず終了する。
3. 一致した場合だけ、`https://static.cloudflareinsights.com/beacon.min.js`を読み込むscript要素を追加する。
4. script要素には、現在と同じ`data-cf-beacon`形式で公開tokenを設定する。

tokenはCloudflare Web Analyticsがブラウザへ配信する公開値であり、秘密情報としては扱わない。ただし、CIログへ値を出力しない既存方針は維持する。

## 採用しない方式

### 現在のworkers.devホストをハードコードする

独自ドメイン移行時にコード修正が必要になるため採用しない。許可ホストは`SITE_URL`から取得する。

### Cloudflareのレポート上でlocalhostを除外する

誤った計測データの送信自体は続く。計測前に止める今回の目的を満たさないため採用しない。

### ビルド時の環境判定だけを使う

本番用の静的成果物はlocalhostでも配信できる。閲覧時のホストを判定しなければ混入を防げないため、ブラウザ上の判定を追加する。

## 変更範囲

- `BaseLayout.astro`のAnalytics出力を、ホスト判定付きローダーへ変更する。
- 本番ビルド検証に、許可ホストとローダーの出力確認を追加する。
- 自動テストで本番ホスト、localhost、token未設定の3条件を確認する。
- READMEへ、本番ホストだけを計測する仕様を追記する。

Cloudflare側の設定変更、ダッシュボードのフィルター作成、独自ドメイン対応は今回の範囲に含めない。

## エラー時の動作

`SITE_URL`は既存の事前検証で正しいHTTPS originであることを確認する。Analytics tokenが未設定または空白だけの場合は、ローダーを出力しない。

ブラウザのホスト名が許可ホストと一致しない場合は、警告やエラーを表示せず終了する。Cloudflareのスクリプト取得に失敗した場合も、ブログ本体の表示や操作には影響させない。

## テスト方針

テストは次の動作を保証する。

- 本番ビルドでtokenが設定されると、許可ホスト付きのローダーが1つ出力される。
- 閲覧ホストが許可ホストと一致すると、Cloudflare Beaconのscript要素が1つ追加される。
- localhost、127.0.0.1、プレビュー用ホストではBeaconを追加しない。
- tokenが未設定または空白だけの場合は、Analytics用ローダーを出力しない。
- token、Cloudflare認証情報をテスト結果やCIログへ出さない。
- 既存の単体テスト、Astro check、ビルド、E2Eテストがすべて成功する。

## 完了条件

- 公開サイトではCloudflare Web Analyticsが継続して動作する。
- localhostとプレビュー環境からAnalyticsリクエストが送信されない。
- ホスト判定を自動テストで再現できる。
- デプロイ後の公開サイトをブラウザで開き、Beaconの読み込みを手動で確認する。
