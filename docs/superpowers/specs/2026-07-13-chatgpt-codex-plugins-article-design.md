# ChatGPT・Codex Plugins解説記事 設計

## 1. 目的

2026年7月9日のPlugin Directory移行を入口に、ChatGPTとCodexのPlugin、App、Skillの違いを日本語で整理する。速報の要点だけで終わらせず、読者が自分に合うPluginを探し、権限を確認し、低リスクな依頼から安全に使い始められる記事にする。

既存の「ChatGPT Workとは？Chat・Codexとの違いと使い分け」と重複する製品全体の比較は繰り返さない。この記事はPluginsの構造、発見、接続、権限、安全な初回利用に集中する。

## 2. 想定読者と読了後の状態

想定読者は、ChatGPTまたはCodexを利用していて、次の疑問を持つ個人ユーザーと業務ユーザーである。

- AppsはPluginsへ名前変更されたのか
- Plugin、App、Skillは何が違うのか
- Pluginを導入すると、どのデータや操作へアクセスされるのか
- Plugin Directoryから何を確認して接続すればよいのか

読了後、読者は次のことができる。

- Plugin、App、Skill、App Templateの役割を区別して説明できる
- Plugin Directoryで必要なPluginを探し、含まれる機能と必要な接続を確認できる
- 読取、書込、実行時確認、同期の設定を接続前に確認できる
- 対象と操作を限定した読取依頼から安全に試せる
- 利用できない場合に、プラン、Workspace、Role、App、接続先サービス、対応画面の順で原因を切り分けられる

## 3. 記事メタデータ

- タイトル: `ChatGPTとCodexのPluginsとは？Apps・Skillsとの違い、探し方、権限の見方`
- slug: `chatgpt-codex-plugins-guide`
- category: `AI`
- tags: `OpenAI`、`ChatGPT`、`Codex`、`Plugins`
- featured: `true`
- 公開日と更新日: 公開作業日に設定する
- 公式情報の確認日: 公開作業日に設定し、本文冒頭にも明記する
- description: Plugin Directoryへの移行、Plugin・App・Skillの違い、探し方、権限、安全な初回利用を要約する

## 4. 記事の中心メッセージ

冒頭で次の3点を短く提示する。

1. Appが単純にPluginへ改名されたわけではない。
2. Pluginはワークフローのまとまり、Skillは再利用可能な手順、Appは外部サービスのデータや操作との接続である。
3. Pluginの導入と、内包されるAppの権限は別の制御である。

既存のApp接続は維持され、Plugin DirectoryがChatGPTとCodexにおけるワークフロー機能の主な発見場所になったことを、2026年7月9日の変更として説明する。

## 5. 記事構成

### 5.1 2026年7月9日に何が変わったのか

- App DirectoryからPlugin Directoryへ移行した
- 既存のApp接続は維持される
- Plugin DirectoryではSkills、Apps、App Templatesを含むワークフローを探せる
- Directoryが見えても、導入や利用可否はプラン、Workspace設定、Role、対応画面、地域、内包Appに左右される

この節は速報部分として短く保ち、古いAppsがすべて削除されたという誤解を解く。

### 5.2 Plugin・App・Skillの違い

本文と比較表で次を説明する。

| 用語 | 役割 | 外部データ・操作 | 記事内の短い表現 |
| --- | --- | --- | --- |
| Plugin | 1つの仕事に必要な機能をまとめて配布する単位 | 内包するAppによる | まとめる |
| Skill | 再利用できる指示、プロンプト、作業手順 | Skill単体では付与しない | 教える |
| App | 外部システム、データ、操作へ接続する | 設定と接続先権限の範囲で行う | つなぐ |
| App Template | Workspace固有のApp設定を作るための雛形 | 管理者の構成と公開後に利用可能 | 設定の雛形 |

Pluginが複数のSkillやAppを含められること、SkillのみのPluginもあり得ることを補足する。

### 5.3 Plugin Directoryで探して接続する

一般ユーザー向けの基本フローを示す。

1. ChatGPT WebまたはDesktopでPlugin Directoryを開く
2. Pluginの詳細から、含まれるSkill、必須App、任意App、App Templateを確認する
3. Appがアクセスするシステム、データ、操作、利用規約、プライバシーポリシーを確認する
4. Connectが利用可能なら認証し、必要な場合だけ同期を有効にする
5. チャットの`@`メンションまたは追加メニューから選択する
6. 最初は低リスクな読取依頼で確認する

画面やプランによって入口が異なる可能性があるため、特定のボタン位置を記事の主説明にしない。画面撮影日と公式確認日を明記する。

### 5.4 接続前に見る4つの権限

次の4点をチェックリスト化する。

- 読取: 何を検索、取得、同期できるか
- 書込: 何を作成、更新、送信、削除できるか
- 確認: 重要な操作の前にユーザー確認が必要か
- 同期: どのRepository、Drive、Channelなどが索引対象になるか

さらに、実際のアクセス可否は次の段階をすべて通る必要があると説明する。

`Pluginの導入方針 → AppのWorkspace・Role設定 → ユーザー認証 → 接続先サービスの元権限 → 操作確認`

Pluginを導入しても、GitHubなどの接続先でユーザーが元から持っていない権限は追加されない。

### 5.5 GitHub Pluginを安全に試す

テックログのPublic Repositoryを使い、読取だけの実例を示す。

```text
hiroshiimaizumi0611/tech-logの未解決Issueを3件だけ要約してください。
Issueの作成・更新・コメント・クローズは行わないでください。
```

実行前後に次を確認する。

- 対象Repositoryが正しい
- 依頼は未解決Issueの読取と要約だけである
- 返答が参照したIssueを人が確認できる
- Issueの作成、更新、コメント、クローズが発生していない

書込操作はこの記事の実例に含めない。

### 5.6 使えないときの確認順

次の症状を、原因確認の順序とともに整理する。

- Connectが押せない
- Pluginは見えるがGitHubへアクセスできない
- 読取はできるが書込できない
- ChatGPTでは使えるが別の画面では選択できない
- 設定変更後もCodex側へ反映されない

確認順は`プラン・提供状況 → Workspace設定 → Role → 必須Appの有効化と認証 → 接続先サービスの権限 → 対応画面 → 更新・再起動`とする。断定できない提供差は公式情報の確認を案内し、推測で回避策を書かない。

### 5.7 まとめ

接続前チェックリストを再掲する。

- Pluginに含まれるSkillとAppを確認したか
- 必須Appと任意Appを区別したか
- 読取と書込の範囲を確認したか
- 同期対象を必要最小限にしたか
- 接続先サービスの権限を確認したか
- 最初の依頼で対象と禁止操作を明示したか
- 実行結果と変更の有無を人が確認したか

## 6. 画像設計

独自図解3枚と、個人情報を含まない公式画面2枚を基本構成とする。

### 6.1 トップ画像兼OG画像

- 内容: `Plugin = Skill + App + App Template`
- サイズ: 1200×630px
- 形式: PNG
- デザイン: テックログのダーク背景、青いアクセント、既存のデザイントークンに合わせる
- 用途: 記事カード、記事OGP、Twitter Card
- 公式ロゴを模倣せず、文字と抽象的な箱・接続線で表現する

### 6.2 独自図解

1. Plugin、Skill、Appの役割を「まとめる・教える・つなぐ」で示す関係図
2. Plugin導入から接続先権限、操作確認までのアクセス経路図

本文幅とMobile表示で文字が読めるよう、横長すぎる構成を避ける。図解はSVGを基本とし、本文中の具体的なaltと直後のキャプションで同じ意味を文章でも伝える。

### 6.3 公式画面

1. Plugin Directoryの一覧またはPlugin詳細
2. Pluginを選択する`@`メンションまたは追加メニュー

画面にはアカウント名、メール、アイコン、会話履歴、非公開Workspace、非公開Repositoryなどを含めない。必要部分だけを切り出し、撮影日と公式ページへのリンクをキャプションに記載する。安全に取得できない場合やUIが記事構成と一致しない場合は、架空の公式画面を作らず、独自の操作フロー図へ置き換える。

### 6.4 画像品質

- 全画像に内容を説明するaltを付ける
- 装飾だけの画像は使用しない
- widthとheightを確定し、CLSを防ぐ
- 本文画像は初期表示に不要なら遅延読み込みする
- DesktopとMobileで文字の判読性を確認する
- 画像の下に図番号、内容、撮影日または作成目的を示すキャプションを置く

## 7. 公式情報と更新方針

記事の事実確認にはOpenAI公式情報だけを使用する。少なくとも次を公開直前に再確認する。

- [Plugins in ChatGPT and Codex](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt-and-codex)
- [Admin controls, security, and compliance for plugins and apps](https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-for-plugins-and-apps)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-chatgpt)

公式説明の更新時刻、提供プラン、対応画面、Directoryの導線は変わりやすい情報として扱う。本文冒頭に公式情報の確認日を明記し、断定は確認できた範囲に限定する。価格表は掲載しない。

短い引用が必要な場合も、本文は日本語で再構成し、公式文面の長い転載は行わない。

## 8. 対象外

- 自作Pluginの構築、manifest、配布方法
- Apps SDK、MCP Server、Agents SDKの実装
- Pluginごとの網羅的な一覧やランキング
- 料金比較
- GitHub Issueへの書込デモ
- 管理者向けの完全な導入・監査手順
- 既存のChatGPT Work記事と重複するChat、Work、Codex全体の比較

## 9. 公開前検証

### 9.1 内容

- 公式情報の確認日が公開日と一致する
- Plugin、App、Skill、App Templateの定義が公式説明と矛盾しない
- Pluginの導入とApp権限を混同していない
- プラン、Role、地域、対応画面の差を断定しすぎていない
- GitHubの例が読取だけで、実際の変更を要求していない
- 既存のChatGPT Work記事との内容重複を確認する

### 9.2 画像とプライバシー

- 公式画面に個人情報、会話履歴、非公開データが写っていない
- すべての画像に適切なalt、サイズ、キャプションがある
- DesktopとMobileで文字が判読できる
- OGPとTwitter Cardが記事固有画像を参照する

### 9.3 サイト動作

- frontmatterと記事本文がContent Collectionsの検証を通る
- 記事詳細、トップ、一覧、タグ、カテゴリー、検索、RSS、sitemapに表示される
- 外部リンクが正しい公式ページを参照する
- コードブロック、目次、関連記事、前後記事が既存レイアウトを壊さない
- format、Astro check、unit test、build、Playwright E2Eが成功する

## 10. 完了条件

- 6つの本文セクションとまとめが、設計どおり公開可能な日本語記事として完成している
- 独自図解3枚を掲載している
- 個人情報を含まない公式画面2枚、または承認済みの独自操作フロー図への代替を掲載している
- すべての重要な事実にOpenAI公式の参照先がある
- 低リスクなGitHub Plugin実例が、読者自身で再現できる
- 公開前検証をすべて通過している
