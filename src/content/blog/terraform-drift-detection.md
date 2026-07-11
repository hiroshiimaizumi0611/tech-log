---
title: Terraformで手動変更されたリソースを追従する方法
description: Terraform管理外で変更されたリソースを検出し、コードへ戻す場合と実環境を正とする場合を安全に判断する手順を整理します。
publishedAt: '2026-07-11'
updatedAt: '2026-07-11'
category: Infrastructure
tags:
  - AWS
  - Terraform
  - IaC
featured: false
---

Terraformで管理するリソースをコンソールやCLIから変更すると、設定コード、state、実環境の間に差が生まれます。重要なのは、差を見つけた直後にstateを書き換えることではありません。まず変更理由と影響を確認し、設定コードを正とするのか、現在の実環境を正とするのかをチームで決めます。

> stateの更新は、実環境を変更しない操作でも、次回以降のplanの意味を変えます。

## driftとは

driftは、Terraformの通常ワークフロー外で実環境が変わり、Terraformが記録している状態と一致しなくなった状態です。HashiCorp公式の[drift管理チュートリアル](https://developer.hashicorp.com/terraform/tutorials/state/resource-drift)は、設定・state・実リソースが一致しないまま操作すると、意図しない再作成や削除につながる可能性を説明しています。

Terraformのstateは単なる属性の控えではありません。設定中のリソースアドレスと実オブジェクトを対応付けるために使われます。公式の[stateの目的](https://developer.hashicorp.com/terraform/language/state/purpose)にあるとおり、Terraformはこの対応関係を基に変更対象を決めます。そのため、実ファイルを直接編集して差を消す方法は採りません。

driftを見つけたら、まず次を記録します。

- 誰が、いつ、何のために手動変更したか
- インシデント対応など、変更を維持すべき理由があるか
- セキュリティ、可用性、費用へどのような影響があるか
- 同じstateを使う別の作業や未適用planが進行していないか

## まずplan

通常の `terraform plan` は、実環境を読み取る暗黙のrefreshを行い、その結果と設定コードを比較します。ここで表示される変更は「設定コードに実環境を戻すための案」です。最初はplanを保存して、人と機械の両方で確認できる形にします。

```sh
umask 077
PLAN_FILE=$(mktemp "${TMPDIR:-/tmp}/terraform-plan.XXXXXX") || exit 1
trap 'rm -f "$PLAN_FILE"' 0
trap 'exit 1' 1 2 15

terraform init || exit 1
terraform validate || exit 1
terraform plan -out="$PLAN_FILE" || exit 1
terraform show "$PLAN_FILE" || exit 1
# この時点ではapplyせず、レビュー終了後にplanを削除する
rm -f "$PLAN_FILE" || exit 1
trap - 0 1 2 15
```

HashiCorpの[`terraform plan` リファレンス](https://developer.hashicorp.com/terraform/cli/commands/plan)では、通常モードとrefresh-onlyモードの目的が区別されています。`-refresh=false` は外部変更を無視して不完全なplanになり得るため、drift調査の最初には使いません。また、`-target` も日常的なdrift解消の近道として使うと全体の差を見落とすため、限定理由なしには使いません。

この時点ではapplyしません。planに置換、削除、アクセス制御の緩和、出力値の変更が含まれるなら、対象リソースだけでなく依存先も調べます。保存済みplanには機密値が平文で含まれ得るため、`umask 077` と `mktemp` で他ユーザーから読めない一時ファイルを作り、trapで失敗・中断時にも削除します。レビュー後は保持せず削除します。

## コードへ戻す

手動変更が誤操作、暫定対応の終了、または組織の標準から外れた変更なら、設定コードを正として実環境を戻します。たとえばAWSセキュリティグループへ一時的に追加されたルールを取り消す場合、コードを勝手にそのルールへ合わせず、通常planが示す差をレビューします。

```sh
umask 077
PLAN_FILE=$(mktemp "${TMPDIR:-/tmp}/terraform-plan.XXXXXX") || exit 1
trap 'rm -f "$PLAN_FILE"' 0
trap 'exit 1' 1 2 15

terraform plan -out="$PLAN_FILE" || exit 1
terraform show "$PLAN_FILE" || exit 1
# 変更理由、置換・削除、依存先をチームでレビューする
terraform apply "$PLAN_FILE" || exit 1
rm -f "$PLAN_FILE" || exit 1
trap - 0 1 2 15
```

保存したplanをapplyすれば、レビュー対象と適用対象を対応させやすくなります。ただし、plan作成後に環境が変わればapplyが失敗したり、再計画が必要になったりします。承認済みという理由だけで古いplanを使い続けず、実行直前の状態とロック状況を確認します。applyが失敗した場合は `exit 1` により後続処理へ進まず、trapが機密情報を含み得るplanを削除します。

## 実環境を正とする

障害対応で必要だった変更など、実環境の値を今後も維持するなら、最終的にはその意図を設定コードへ表現します。たとえば手動で追加したタグを維持する場合は、対応するresourceまたはmoduleの入力を更新します。

```hcl
resource "aws_instance" "app" {
  # 既存の設定は省略

  tags = {
    Name        = "app"
    Maintenance = "approved"
  }
}
```

コード変更後に通常の `terraform plan` を実行し、実環境を壊す差が残っていないことを確認します。providerが返す値のうち、設定可能な属性と計算専用属性を混同しないことも重要です。実環境を正とすることは「stateだけ合わせる」ことではなく、次回のplanでも意図が再現されるコードを残すことです。

stateへ現在の実環境だけを記録する必要がある場合は、`-refresh-only` を使えます。公式の[refresh-only解説](https://developer.hashicorp.com/terraform/tutorials/state/refresh)によると、このモードは実リソースを変更せず、stateとroot moduleのoutputを現在値へ合わせる計画を作ります。

```sh
umask 077
BACKUP_DIR=${BACKUP_DIR:-.} # アクセス制限された既存ディレクトリを指定する
BACKUP_FILE="$BACKUP_DIR/terraform.tfstate.backup-$(date +%Y%m%d-%H%M%S)"
STATE_TMP=$(mktemp "$BACKUP_DIR/.terraform-state.XXXXXX") || exit 1
PLAN_FILE=$(mktemp "${TMPDIR:-/tmp}/terraform-plan.XXXXXX") || {
  rm -f "$STATE_TMP"
  exit 1
}
trap 'rm -f "$STATE_TMP" "$PLAN_FILE"' 0
trap 'exit 1' 1 2 15

if ! terraform state pull > "$STATE_TMP" || [ ! -s "$STATE_TMP" ]; then
  rm -f "$STATE_TMP"
  exit 1
fi
mv "$STATE_TMP" "$BACKUP_FILE" || exit 1

terraform plan -refresh-only -out="$PLAN_FILE" || exit 1
terraform show "$PLAN_FILE" || exit 1
# バックアップ、plan内容、下流outputへの影響をチームでレビューする
terraform apply "$PLAN_FILE" || exit 1
rm -f "$PLAN_FILE" || exit 1
trap - 0 1 2 15

terraform plan || exit 1
```

`terraform apply -refresh-only` を無条件に実行してはいけません。誤った認証情報やregion設定では、存在するリソースを「消えた」と誤認し、stateから対応関係を落とす計画になる場合があります。バックアップを取得し、refresh-only planをレビューし、チーム承認を得た場合だけ適用します。上の例では `state pull` の終了状態とファイルが空でないことを確認し、失敗時は一時ファイルを削除して中止します。成功した一時ファイルだけを同じディレクトリ内で最終名へ原子的にrenameするため、不完全な出力をバックアップとして残しません。

state backupと保存済みplanはいずれも機密値を平文で含み得ます。backupは暗号化・アクセス制御された場所で復旧に必要な期間だけ保持し、保持期限後は組織の安全な削除手順に従います。planはレビュー・適用後すぐ削除します。非推奨の `terraform refresh` は自動承認相当であり、公式の[`terraform refresh` リファレンス](https://developer.hashicorp.com/terraform/cli/commands/refresh)もreview可能なrefresh-only plan/applyを推奨しています。

## import・state操作の注意

実環境に存在するがTerraformがまだ管理していないリソースは、refresh-onlyでは管理対象になりません。この場合は設定コードとimportを使います。宣言的なimport blockなら、通常のplanでimport内容と他の変更を合わせて確認できます。

```hcl
import {
  to = aws_s3_bucket.logs
  id = "example-log-bucket"
}

resource "aws_s3_bucket" "logs" {
  bucket = "example-log-bucket"
}
```

HashiCorp公式の[import概要](https://developer.hashicorp.com/terraform/language/import)では、import先のresource blockと、providerが定める一意なIDが必要です。同じ実オブジェクトを複数のリソースアドレスへimportしてはいけません。CLIの[`terraform import` 手順](https://developer.hashicorp.com/terraform/cli/import/usage)を使う場合も、先にresource blockを用意し、import後に必ず通常planを実行して、想定外の更新や削除が出ないようコードを調整します。

`terraform state rm` や `terraform state mv` は、クラウド上のリソースではなく管理上の対応関係を変えます。誤操作するとTerraformが実リソースを追跡できなくなります。公式の[state手動更新ガイド](https://developer.hashicorp.com/terraform/cli/state)も、通常のplan/apply外でstateを変更する場合はバックアップを保持するよう求めています。

したがって、import、stateサブコマンド、refresh-only applyの前には、例外なく次を行います。

- remote backendのロックと、同時実行中の作業がないことを確認する
- `terraform state pull` でアクセス制限されたバックアップを取得する
- resource address、実リソースID、provider設定を照合する
- planとstate変更の影響をチームでレビューする
- 復旧担当者とバックアップから戻す手順を決める

stateには機密値が含まれ得ます。バックアップをGitへ追加せず、暗号化、アクセス制御、保存期限と安全な削除方法を組織の規定に合わせます。チーム利用では、共有とロックを提供するremote stateを選ぶ考え方が公式の[Remote Stateガイド](https://developer.hashicorp.com/terraform/language/state/remote)に示されています。

## 事故を避ける確認手順

drift対応は、次の順序に固定すると判断の飛躍を減らせます。

1. インシデントや変更履歴を確認し、追加の手動変更を止める
2. backend、workspace、account、region、provider認証先を読み上げ確認する
3. 通常planで、コードへ戻した場合の変更を保存・確認する
4. コードと実環境のどちらを正とするか、所有チームが決める
5. コードを正とするなら、承認済みの通常planをapplyする
6. 実環境を正とするなら、まずコードへ意図を反映して再planする
7. import、state操作、refresh-onlyが必要なら、バックアップ取得後に専用planをチームレビューする
8. 適用後に通常planを再実行し、未説明の差がないことを確認する
9. コード、判断理由、plan結果、承認記録を同じ変更管理単位へ残す

目標は一度だけ `No changes` を表示することではありません。手動変更の意図をコードと履歴へ戻し、次の担当者が同じ判断を再現できる状態にすることです。state操作を最後の選択肢として扱い、バックアップ、planレビュー、チームレビューを省略しないことが、追従作業を通常運用へ戻すための基本です。
