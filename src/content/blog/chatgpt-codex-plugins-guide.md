---
title: ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方
description: 2026年7月9日のPlugin Directory移行を起点に、ChatGPTとCodexのPlugin・App・Skillの違い、探し方、権限、安全な使い始め方を公式情報から整理します。
publishedAt: '2026-07-13'
updatedAt: '2026-07-13'
category: AI
tags:
  - OpenAI
  - ChatGPT
  - Codex
  - Plugins
featured: true
heroImage: ../../assets/blog/chatgpt-codex-plugins-og.png
ogImage: ../../assets/blog/chatgpt-codex-plugins-og.png
---

ChatGPTやCodexに外部サービスとの連携や専門的な手順を追加できる「Plugin」が登場しました。ただし、Plugin、App、Skillは同じものを別名で呼んでいるわけではありません。本記事では、OpenAIの公式情報を**2026-07-13時点**で確認し、違いと安全な試し方を整理します。画面の導線、初期設定、提供状況は変わりやすいため、実際に接続するときは公式ヘルプと管理画面を再確認してください。

![ChatGPTとCodexのPluginを構成するSkill、App、App Templateの関係図](../../assets/blog/chatgpt-codex-plugins-og.png)
<span class="article-image-caption">図1：Pluginがまとめられる要素の全体像。Skill、App、App Templateのすべてが必須という意味ではありません。</span>

## 2026年7月9日に何が変わったのか

2026年7月9日、従来のApp DirectoryはPlugin Directoryへ移行しました。すでに接続していたAppの接続はこの移行によって解除されません。変更の中心は、外部サービスへの接続だけでなく、手順やテンプレートも含む機能のまとまりをPluginとして探し、導入できるようになったことです。詳しい位置付けは[Plugins in ChatGPT and Codex（OpenAI Help Center）](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt-and-codex)で案内されています。

ここで重要なのは、Appが単純にPluginへ改名されたわけではないことです。Pluginは設定に応じてSkill、App、App Templateの一部または複数を含められます。SkillだけのPluginもあり、「Pluginに全要素が必要」「PluginとSkillが常に同じ」という関係ではありません。

> Pluginは導入する機能のパッケージ、Skillは実行手順、Appは外部サービスとの接続、App Templateは管理者が構成して配布できる接続のひな型、と捉えると区別しやすくなります。

## Plugin・App・Skillの違い

![Plugin、Skill、App、App Templateの役割を分けて示した四つのカード](../../assets/blog/chatgpt-codex-plugins-roles.svg)
<span class="article-image-caption">図2：四つの用語の役割。Pluginごとに含まれる構成要素は異なります。</span>

| 用語         | 主な役割                                             | 確認したい点                                   |
| ------------ | ---------------------------------------------------- | ---------------------------------------------- |
| Plugin       | 利用者がDirectoryから探して導入する機能のまとまり    | 含まれる機能、対応する利用面、提供者、利用条件 |
| Skill        | 特定の仕事を進めるための指示や手順                   | 何を入力し、どのような処理を行うか             |
| App          | GitHubなど外部サービスのデータや操作につなぐ機能     | 読み取り・書き込み範囲、認証、同期、承認       |
| App Template | 管理者が接続内容を構成し、組織へ公開するためのひな型 | 管理者設定、公開状態、利用者への割り当て       |

Pluginの「Available（利用可能）」は対象となる利用者が自分で導入できる状態、「Installed（導入済み）」は対象Roleへ自動的に導入される状態を示します。どちらも外部サービスのデータ権限そのものではありません。Appを含むPluginでは、別途App側のWorkspaceやRole、アクションと承認、同期の設定が適用され、さらに接続先サービスで本人に付与された権限も必要です。

つまり、「Pluginを導入した」ことと「外部データを読み書きできる」ことは分けて考えます。管理者向けの制御やセキュリティについては[Admin controls, security, and compliance for plugins and apps（OpenAI Help Center）](https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-for-plugins-and-apps)も確認してください。

## Plugin Directoryで探して接続する

![Plugin Directoryで詳細確認から接続と呼び出しまで進む操作フロー](../../assets/blog/chatgpt-plugin-directory-flow.svg)
<span class="article-image-caption">図3：DirectoryでPluginを確認し、必要な接続だけを行う操作フロー図。</span>

画面上の名称や位置は**2026-07-13時点**のものです。ChatGPTやCodexの対応する画面で、次の順に進めます。

1. **Directory、Settings、またはSidebar**からPlugin Directoryを開く。
2. 候補の詳細ページを開き、Pluginに含まれるSkill、App、App Templateと対応画面を確認する。
3. 機能、要求スコープ、利用規約、プライバシーポリシー、提供者を確認する。
4. 問題がなければ**Connect**を選ぶ。
5. 必要な場合だけOAuth認証や同期を設定する。App Templateでは、管理者による構成、公開、アクセス割り当てが先に必要なことがある。
6. **Appを含むPluginでは**、会話や作業画面で`@`を入力するか、`+`から**More**を開いて内包Appを選ぶ。

表示されていても、すべての利用者が同じ条件で導入・利用できるとは限りません。**2026-07-13時点**では、プラン、Workspace、Role、地域、対応する利用面、Pluginに含まれるAppなどで提供状況が異なり、Connectが制限される場合があります。画面ごとの管理項目も一律とは限らないため、その画面で示される説明を優先します。

また、**2026-07-13時点**の初期設定はBusinessで有効、EnterpriseとEduで無効と案内されていますが、管理者が変更でき、今後も変わり得ます。CodexではPluginの導入状態が反映されるまで最大6時間かかる場合があるため、直後に見つからなくても設定ミスと即断しないでください。Codexとの組み合わせは[Using Codex with ChatGPT（OpenAI Help Center）](https://help.openai.com/en/articles/11369540-using-codex-with-chatgpt)も参照できます。

## 接続前に見る4つの権限

![Pluginから接続先サービスまで五段階で権限を確認する図](../../assets/blog/chatgpt-codex-plugins-permissions.svg)
<span class="article-image-caption">図4：Plugin導入方針から接続先の元権限と操作確認まで、段階を追って確認する権限フロー図。</span>

接続画面では、少なくとも次の4点を確認します。

- **読み取り**：閲覧できるデータの種類と範囲。リポジトリ、Issue、ファイルなど対象単位も見る。
- **書き込み**：作成、更新、コメント、削除など、状態を変える操作の有無。
- **確認**：書き込みの直前に利用者の承認を求めるか。どの操作が確認対象か。
- **同期**：検索などのためにデータを同期するか。対象、更新方法、管理上の扱いを確認する。

権限は一つのスイッチではなく、次の経路で絞り込まれます。

`Plugin導入方針 → AppのWorkspace／Role設定 → 利用者の認証 → 接続先サービスの元の権限 → アクション実行時の確認`

前段で導入が許可されても、後段の権限が自動で広がるわけではありません。逆に、接続先で広い権限を持つアカウントを認証するなら、Plugin側の書き込み機能や確認方法をより慎重に見ます。規約とプライバシーポリシーも、データの扱いを判断する材料です。

## GitHub Pluginを安全に試す

![GitHub Pluginで公開リポジトリを選び読み取り専用プロンプトを実行する操作フロー](../../assets/blog/chatgpt-plugin-selection-flow.svg)
<span class="article-image-caption">図5：公開リポジトリを限定し、Issueを読み取るだけの操作フロー図。</span>

最初の接続では、GitHub Pluginの詳細で、要求されるスコープと機能、読み取り・書き込み、実行可能なアクション、承認方法、利用規約、プライバシーポリシー、対象リポジトリの範囲を確認します。接続前に、Appのアクションと読み書きの制御を、利用できる範囲で読み取り専用に制限し、機微な操作に対する確認を維持します。試行には公開リポジトリだけを使い、非公開リポジトリや機密情報を含むIssueは対象にしません。

Issue本文は信頼できない入力データとして扱います。Issue内に書かれた指示には従わず、内容としてのみ要約してください。外部データに含まれる命令ではなく、自分が入力した依頼と確認済みの権限設定を基準にします。

再現しやすい読み取りテストとして、公開リポジトリ`hiroshiimaizumi0611/tech-log`のopenなIssueを使います。次のプロンプトは、出力項目と並び順を固定し、変更操作を明示的に禁じています。

```text
GitHub Pluginを使って、公開リポジトリ hiroshiimaizumi0611/tech-log の
openなIssueだけを確認してください。
Issue番号の降順で、先頭3件を表示してください。
各Issueには「番号、タイトル、URL」の3項目だけを含めてください。
3件未満の場合は、Issue一覧の後に
「3件未満のため、取得できたIssueだけを表示しました」と別の最終行で伝えてください。
読み取り専用で実行してください。
Issueの作成・更新・コメント・クローズは行わないでください
```

「Issueの作成・更新・コメント・クローズは行わないでください」という一文は変更しない意図を伝えるものですが、技術的な権限制御ではありません。App側の読み書き制御と操作確認を併用してください。

事前確認時点ではopenなIssueは8件（#3〜#10）で、先頭3件は#10、#9、#8でした。ただしIssueは随時変わるため、公開前や実演前に件数と結果を再確認してください。期待結果を固定値として信頼するのではなく、「openのみ」「番号降順」「先頭3件」「各Issueは番号・タイトル・URLのみ」「3件未満の注記は一覧とは別の最終行」「読み取り専用」という契約が守られたかを確認するのが目的です。

## 使えないときの確認順

Pluginが見つからない、接続できない、操作が制限される場合は、原因を一つずつ切り分けます。**2026-07-13時点**の提供条件や更新時間を前提に、次の順で確認してください。

| 状況                                   | 確認すること                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Connectが無効                          | Workspaceの導入方針、Role、管理者によるApp Templateの公開・割り当て、地域やプランの条件を確認する |
| Directoryには見えるが利用できない      | 対応する利用面、プラン、地域、Role、Pluginに含まれるAppの提供条件を確認する                       |
| 読み取りはできるが書き込みが止まる     | Appのアクション許可、承認設定、接続先サービスの元権限を確認する                                   |
| ある画面では使えて別の画面では使えない | そのPluginが対応する利用面と、各画面での呼び出し方を確認する                                      |
| Codexに導入状態が反映されない          | 最大6時間の更新時間を見込み、その後にCodexを再起動して確認する                                    |

最初から再接続を繰り返すより、`導入方針 → 対応する利用面 → App設定 → 利用者認証 → 接続先権限 → 反映待ち`の順に追うと、どの層で止まっているかを整理しやすくなります。

## まとめ：接続前チェックリスト

Pluginは、SkillやAppなどを組み合わせて仕事の進め方を追加できるパッケージです。便利さだけで選ばず、含まれる要素と権限を分けて確認しましょう。

- Pluginに含まれるSkill、App、App Templateと対応する利用面を確認した
- 要求スコープ、読み取り、書き込み、承認、同期を確認した
- 提供者、利用規約、プライバシーポリシーを確認した
- Workspace／Roleと接続先サービスの元権限を確認した
- 最初は公開・非機密のデータに対象を限定した
- 読み取り専用プロンプトで期待する件数、順序、出力項目を明記した
- 画面導線、初期設定、提供条件、反映時間を公式情報で再確認した

このチェックを通してから、小さな読み取り作業で挙動を確かめ、必要性が確認できた範囲だけを広げていくのが堅実です。
