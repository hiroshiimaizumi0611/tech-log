# 2026年7月CloudFront VPC Origins障害記事 Design Spec

## 1. 目的

2026年7月16日に発生したAmazon CloudFrontのVPC Origins接続障害を、AWS実務者向けに解説する。障害時系列の紹介だけで終わらせず、VPCオリジンの仕組み、影響を受けた経路、別オリジン種別への切り替え方、平常時に準備すべき確認項目までつなげる。

記事の主メッセージは次のとおり。

> 今回問題が起きたのはCloudFront全体ではなく、CloudFrontからプライベートVPCオリジンへ接続する経路だった。VPCオリジンの利点を捨てるのではなく、障害時に別のオリジン種別へ切り替えられる準備を平常時に行う。

## 2. 読者と執筆者の立場

### 想定読者

- CloudFront、ALB、VPCを業務で利用しているエンジニア
- VPCオリジンを採用済み、または採用を検討している人
- 2026年7月16日のCloudFront障害の影響範囲と原因を確認したい人
- CDN障害時の代替経路と切り替え手順を設計したい人

CloudFrontを初めて使う読者にもVPCオリジンの役割が分かるように説明するが、記事の中心は用語集ではなく実務上の判断とする。

### 執筆者の立場

筆者の管理環境ではCloudFrontを使用しておらず、今回の障害による直接の影響は受けていない。AWS障害を受けて自分の管理環境を確認し、公式記録と公式ドキュメントを基に構成と回避策を調査した記事として書く。

次の表現は使わない。

- 「自分の環境でVPC Origins障害を経験した」
- 「実際にPublic ALBへ切り替えて復旧した」
- 「Origin Groupで今回の障害を回避できた」
- 実行していない手順を「検証済み」「実証した」とする表現

## 3. 検索意図と公開設定

### 主な検索語

- AWS CloudFront 障害 2026年7月16日
- CloudFront VPCオリジン 障害
- CloudFront VPC Origins とは
- CloudFront VPCオリジン 回避策
- CloudFront Origin Group フェイルオーバー

速報検索を入口にしつつ、障害収束後も参照できる仕組みと運用の記事にする。

### Frontmatter

- Title: `2026年7月AWS CloudFront障害を解説｜VPCオリジンとは？回避策まで整理`
- Slug: `aws-cloudfront-vpc-origin-outage-2026-07-16`
- Description: `2026年7月16日に発生したAWS CloudFrontのVPC Origins障害について、影響範囲と原因、VPCオリジンの仕組み、読み取り系と更新系に分けた回避策を公式情報から整理します。`
- Published: 記事実装と事実確認が完了した日
- Category: `Infrastructure`
- Tags: `AWS`、`CloudFront`、`VPC`、`障害対応`
- Featured: `true`
- Hero image: 設定しない
- OG image: 個別画像を設定せず、既存の`/og-default.png`を使用する

## 4. 公式障害記録

一次情報はAWS Health Dashboardの公開ステータスと、公開イベントデータに記録されたCloudFrontイベントを使用する。

- Service: `Amazon CloudFront`
- Event ARN: `arn:aws:health:global::event/CLOUDFRONT/AWS_CLOUDFRONT_OPERATIONAL_ISSUE/AWS_CLOUDFRONT_OPERATIONAL_ISSUE_EDF4C_83808542A4E`
- Summary: `[RESOLVED] Increased 5xx Errors`
- 発生時間: 2026年7月16日 12:45 AM PDT〜4:18 AM PDT
- 日本時間: 2026年7月16日 16:45〜20:18 JST
- 継続時間: 3時間33分
- 影響: VPC Origins接続を利用するCloudFront顧客で5xxエラーが増加
- 影響外: 他のオリジン種別を利用するCloudFront顧客

AWSの最終更新に基づき、原因を次の順で説明する。

1. プライベートVPCオリジンへの接続を管理するフリートが内部制約へ到達した。
2. ネットワークプロセッサへルーティング設定を配布するシステムが、更新済み設定データを正しく読み込めなくなった。
3. VPC Origin接続のルーティングに影響し、5xxエラーが増加した。
4. AWSは3:52 AM PDTに複数の緩和策を実施し、4:18 AM PDTに全面復旧した。

「容量不足」「設定ミス」など、AWSの最終更新より単純化した断定は避ける。途中更新にあった`routing table capacity`は調査中の説明として扱い、最終原因説明を優先する。

AWSが障害中に案内した暫定策は、VPC Originsが必須でない顧客が一時的に別のオリジン種別へ変更することだった。復旧後は一時変更を安全に戻せると案内した。この暫定策と、本記事が提案する平常時の備えを区別する。

## 5. 記事構成

次の10個のH2を順番に使用する。

1. `2026年7月16日のCloudFront障害で何が起きたか`
2. `影響を受けた構成・受けなかった構成`
3. `そもそもCloudFrontのVPCオリジンとは`
4. `障害の原因をリクエスト経路から理解する`
5. `AWSが案内した暫定回避策`
6. `読み取り系リクエストをOrigin Groupで備える`
7. `POST・PUTを含むAPIは手動切り替えを準備する`
8. `障害発生時の確認・切り替え手順`
9. `復旧後に元へ戻すときの確認事項`
10. `VPCオリジンをやめるべきか`

### 2026年7月16日のCloudFront障害で何が起きたか

- 16:45〜20:18 JSTの3時間33分という最終報告の時間を示す。
- 症状は「VPC Origins接続利用者で5xxが増加」と書き、全リクエストが失敗したとは断定しない。
- 初回の公開更新時刻と、AWSが最終報告で示した実際の開始時刻を混同しない。
- 障害は解消済みで、記事確認時点ではサービスが正常稼働と報告されたことを書く。

### 影響を受けた構成・受けなかった構成

- 影響を受けたのは、CloudFrontからVPC Origins接続を通じてPrivate ALB、NLB、EC2へ到達する構成。
- S3オリジン、インターネット公開されたカスタムオリジンなど「他のオリジン種別」はAWSの報告上、今回の事象では影響外だったと説明する。
- オリジン側アプリケーションが正常でも、CloudFrontとVPC内リソースの間でルーティングできなければ閲覧者には5xxが返り得ることを示す。

### そもそもCloudFrontのVPCオリジンとは

- Private subnet内のALB、NLB、EC2をCloudFrontのオリジンにできる機能と説明する。
- CloudFrontがサービス管理ENIをサブネット内に作り、プライベート接続でオリジンへ到達する。
- オリジンをインターネットへ直接公開せず、CloudFrontを単一の入口にできるセキュリティ・運用上の利点を説明する。
- 作成要件としてVPCのInternet Gatewayが必要だが、VPCオリジンへの経路にIGWを使用するわけではないという公式上の注意を、必要な範囲で補足する。
- VPCオリジン自体が悪い、または常に可用性が低いという結論にしない。

### 障害の原因をリクエスト経路から理解する

- 図1を掲載する。
- CloudFrontエッジ、VPC接続を管理するAWS内部フリート、ルーティング設定を受け取るネットワークプロセッサ、サービス管理ENI、Private ALB、アプリの順で概念的な経路を示す。
- AWSが公開していない内部実装を図で捏造しない。AWS最終報告で示された範囲を「AWS管理領域」として抽象化する。

### AWSが案内した暫定回避策

- AWSの案内は、可能なら一時的にオリジン種別を変更することだったと記載する。
- 障害発生後に代替オリジンをゼロから作ると、ALB作成、TLS、セキュリティ、CloudFront設定反映、動作確認に時間がかかる。
- 回避経路は平常時に構築・テストしておくべきという本記事の提案へつなぐ。

### 読み取り系リクエストをOrigin Groupで備える

- CloudFront Origin Groupはprimaryとsecondaryの2オリジンを持ち、設定したステータスコード、接続失敗、タイムアウト時にsecondaryへリクエストを送る機能と説明する。
- 選択可能なフェイルオーバー条件として`400`、`403`、`404`、`416`、`429`、`500`、`502`、`503`、`504`がある。
- 自動フェイルオーバーの対象メソッドは`GET`、`HEAD`、`OPTIONS`のみ。`OPTIONS`はCache behaviorのCached HTTP methodsに含める必要がある。
- CloudFrontは以前のリクエストが失敗しても、次のリクエストでは再びprimaryを試す。継続的にsecondaryへ固定する機能とは説明しない。
- PrimaryをVPC origin、secondaryをインターネット公開のカスタムオリジンとする案を図2に示す。
- この構成が2026年7月16日の障害で確実に作動したという公式記録や実証はない。「読み取り系で事前検証する候補」とする。

### POST・PUTを含むAPIは手動切り替えを準備する

- `POST`、`PUT`、`PATCH`、`DELETE`はOrigin Groupの自動フェイルオーバー対象外とする。
- 事前にPublic ALBなど別オリジン種別を作り、CloudFront distribution内へ代替オリジンとして登録し、ステージングまたは非本番で動作確認する案を示す。
- 緊急時はCache behaviorの対象オリジンを変更するなど、承認済みの変更手順で切り替える。
- CloudFront Functionsの`updateRequestOrigin()`ではVPC originsを更新できず、リクエストが失敗するという制約がある。動的な関数切り替えを万能策として提案しない。
- 更新系では二重実行、タイムアウト後の再送、セッション、認証ヘッダー、Host/TLS、データ整合性を確認する。

### 障害発生時の確認・切り替え手順

次の順でランブックを示す。

1. CloudFrontの`5xxErrorRate`などでエラー増加を検知する。
2. オリジンALBのリクエスト数・5xx・ターゲット健全性を確認し、アプリ障害とCloudFrontからオリジンまでの障害を切り分ける。
3. AWS Health Dashboardとアカウント固有のAWS Health情報を確認する。
4. 読み取り系のOrigin Groupがsecondaryへフェイルオーバーしているか確認する。
5. 更新系APIは、代替オリジンの健全性とアクセス制限を確認してから手動切り替えを承認する。
6. CloudFront経由で代表的な読み取り・更新・認証操作を確認する。
7. CloudFrontの設定が`Deploying`の間はエッジごとに旧設定と新設定が混在し得るため、反映完了まで監視する。

CloudFrontだけを見て切り替えない。オリジンアプリケーション自体の障害、データベース障害、認証障害を先に除外する。

### 復旧後に元へ戻すときの確認事項

- AWSのステータスが解消済みになっただけで即時に戻さない。
- VPCオリジンの疎通、ALBターゲット、代表API、ログとメトリクスを確認する。
- 書き込みが二重化・欠落していないか、待機系との差を確認する。
- 段階的に戻せる場合はステージングdistributionや限定的なトラフィックで確認する。
- 緊急変更、実際の切り替え時間、検知漏れ、手作業を振り返り、IaCとランブックへ反映する。

### VPCオリジンをやめるべきか

- 今回の一事象だけで採用・不採用を断定しない。
- VPCオリジンの非公開性と管理負荷削減に対し、AWS管理の接続経路へ依存することをトレードオフとして示す。
- Public ALB待機構成には追加コストと公開面が生まれる。
- 可用性要件、許容停止時間、更新系トラフィックの有無、切り替え時間、セキュリティ要件から判断する。

## 6. 二層の回避設計

### 読み取り系

- Primary: CloudFront VPC origin
- Secondary: 事前に動作確認したinternet-facing ALBなどのcustom origin
- Mechanism: Origin Group
- Methods: `GET`、`HEAD`、必要なら`OPTIONS`
- Failover criteria: アプリケーションの性質に応じて接続失敗、タイムアウト、`500`、`502`、`503`、`504`などを選ぶ
- Limitation: 今回の障害への有効性は未実証。次リクエストもprimaryから試す。

### 更新系

- Primary: CloudFront VPC origin
- Standby: 事前に登録・検証したcustom origin
- Mechanism: 人による切り分けと承認後、CloudFront distribution設定を変更
- Methods: `POST`、`PUT`、`PATCH`、`DELETE`を含む
- Checks: 冪等性、二重送信、認証、Host/TLS、Cookie、セッション、データストア整合性
- Limitation: 設定反映には時間がかかり、エッジへ一斉反映されない。

### Public ALBのアクセス制限

代替のinternet-facing ALBを、インターネットから誰でも利用できる状態にしない。

- ALB security groupの受信元をAWS-managed prefix list for CloudFrontへ限定する。
- CloudFrontからcustom headerを付け、ALB listener ruleで一致するリクエストだけを転送する。
- ヘッダー不一致は固定`403`レスポンスとする。
- Prefix listだけでは特定のCloudFront distributionに限定できないため、custom headerと組み合わせる。
- ヘッダー値はソースコードや記事へ掲載せず、秘密情報として保管・変更する。
- 必要に応じてAWS WAF、ログ、アラームも維持する。

## 7. 図解

生成画像や障害画面のスクリーンショットは使わず、AWS公式アイコンを利用した編集可能な構成図を2枚作成する。実装時は`aws-architecture-diagram`スキルでdraw.io XMLを作成・検証し、記事用画像へ書き出す。

### 図1：障害が起きたVPCオリジン経路

- Source: `docs/diagrams/cloudfront-vpc-origin-outage-path.drawio`
- Article asset: `src/assets/blog/cloudfront-vpc-origin-outage-path.svg`
- Flow: Viewer → CloudFront edge → AWS-managed VPC origin connection layer → service-managed ENI → Private ALB → application
- AWS最終報告で説明された内部制約とルーティング設定配布失敗を、AWS管理領域の注釈として示す。
- 非公開の内部コンポーネント名、台数、実ネットワーク構造を推測しない。

### 図2：読み取り系と更新系を分けた回避構成

- Source: `docs/diagrams/cloudfront-vpc-origin-failover.drawio`
- Article asset: `src/assets/blog/cloudfront-vpc-origin-failover.svg`
- 左側: `GET`、`HEAD`、`OPTIONS`をOrigin GroupでPrimary VPC originからSecondary Public ALBへ送る候補。
- 右側: `POST`、`PUT`、`PATCH`、`DELETE`を、監視・判断・承認後に手動でPublic ALBへ切り替える流れ。
- Public ALBにprefix listとcustom headerの二段階制限を表示する。
- 自動経路と手動経路を色だけに依存せず、線種、ラベル、アイコンで区別する。

### 表示要件

- SVGに明示的な`width`、`height`、`viewBox`を設定する。
- すべてのテキストを日本語で読めるサイズにする。
- 本文中に一意で具体的な日本語altと図注を付ける。
- 390px幅で画像と本文に横方向のoverflowを発生させない。
- 図はモバイルで縮小しても主要ラベルを読み取れる情報量に抑える。

## 8. 公式資料

本文の仕様と事実は、次の一次情報を優先する。

- AWS Health Dashboard: `https://health.aws.amazon.com/health/status`
- AWS public health event data: `https://health.aws.amazon.com/public/currentevents`
- VPC origins: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html`
- Origin failover: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html`
- Origin groups behavior: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorOriginGroups.html`
- Restrict ALB access: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/restrict-access-to-load-balancer.html`
- Origin custom headers: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/add-origin-custom-headers.html`
- Distribution update propagation: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HowToUpdateDistribution.html`
- CloudFront continuous deployment: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/continuous-deployment.html`
- Origin modification helper limitations: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/helper-functions-origin-modification.html`

ニュース記事、SNS、個人ブログは、利用者の反応や補助的な発見に使う場合でも障害原因の根拠にはしない。本文の障害時間、影響範囲、原因、AWSの暫定策はAWS公式記録へ直接結び付ける。

## 9. 実装範囲

想定する変更は次のとおり。

- 記事Markdownを1件追加
- draw.io原本2件を追加
- 記事表示用SVG2件を追加
- 記事固有のunit/E2E契約を追加
- Featured、最新4件、記事一覧、カテゴリー・タグ件数の期待値を更新
- ホームのdesktop、tablet、mobileビジュアルゴールデンを更新

既存のUIコンポーネント、CSS、Content Schema、デプロイ設定、分析基盤は変更しない。SVG表示で既存レイアウトの不具合が見つかった場合は、範囲を広げる前にユーザーへ相談する。

## 10. 検証

### 記事契約

- Frontmatterのtitle、description、公開日、category、tags、featuredを確認する。
- `heroImage`と`ogImage`がなく、OG/Twitter画像が`/og-default.png`になることを確認する。
- H2が設計した10件と順序に一致することを確認する。
- 障害時間、3時間33分、5xx、影響対象・影響外、最終原因、暫定策を確認する。
- 筆者が直接影響を受けた、切り替えを実証した、Origin Groupで今回確実に回避できた、という誤った主張がないことを確認する。
- Origin Groupの対象メソッド、フェイルオーバー条件、primary再試行、設定伝播の制約を確認する。
- 公式リンクのhostをAWS公式ドメインへ限定する。

### 図解契約

- draw.io XMLが開け、AWS公式アイコンライブラリを使い、想定ノードと接続を持つことを`aws-architecture-diagram`の検証手順で確認する。
- SVG2件が有効なXMLで、明示的な寸法と`viewBox`を持つことを確認する。
- Markdownに2枚の画像、2件の一意なalt、2件の図注があることを確認する。

### E2E

- 記事URL、title、description、canonical、default OG/Twitter imageを確認する。
- H1、category、tags、公開日、H2、2枚の画像、図注を確認する。
- serious/criticalのAxe違反がないことを確認する。
- 390x844でdocument、記事本文、画像が横にはみ出さないことを確認する。
- 新記事がFeatured、最新記事の先頭、全記事一覧の先頭に表示されることを確認する。

### 文章

- `natural-japanese`の技術記事向けレビューを行う。
- `stop-ai-slop-jp`で、壮大化、同じ結論の反復、主体不明、均一な段落、根拠のない教訓を修正する。
- AWS公式文の長い逐語引用は避け、日本語で正確に要約する。
- 公式事実、公式仕様、本記事の設計提案、筆者の立場を混同しない。

### 全体

- `SITE_URL=https://example.invalid npm run verify`を実行する。
- 変更が承認範囲に限られていることを確認する。
- merge、公開、デプロイは別途ユーザー承認を得る。

## 11. 完了条件

- AWS公式記録に基づく障害時間、影響、原因、暫定策が正確に掲載されている。
- VPCオリジンの接続経路と利点が、非公開実装を推測せず説明されている。
- 読み取り系のOrigin Groupと更新系の手動切り替えが、制約とともに分けて説明されている。
- Public ALBを待機させる場合のアクセス制限と運用コストが説明されている。
- 実体験ではない検証や効果を断定していない。
- 編集可能なdraw.io原本2件と記事用図2件が掲載されている。
- 記事契約、表示テスト、全体verifyが通る。
- PRとしてレビュー可能なブランチが用意されている。
