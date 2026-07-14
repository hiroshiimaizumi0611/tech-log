# Cloudflare Web Analytics Host Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloudflare Web Analyticsを`SITE_URL`のホストでだけ読み込み、localhostとプレビュー環境からの計測送信を止める。

**Architecture:** Astroコンポーネントが公開tokenと`Astro.site.hostname`を非表示の設定要素として出力し、ブラウザ用ローダーが`window.location.hostname`との完全一致を確認する。一致した場合だけCloudflare Beaconを動的に追加する。本番成果物の検証では設定要素の個数、許可ホスト、tokenを確認し、エラーへ値を含めない。

**Tech Stack:** Astro 7、TypeScript 5.9、Vitest 4、Playwright 1.61、GitHub Actions、Cloudflare Web Analytics

---

## 変更するファイル

- Create: `src/scripts/cloudflare-analytics.ts` — ホスト判定とBeacon追加を担当するブラウザ用ローダー
- Create: `src/components/common/CloudflareAnalytics.astro` — tokenと許可ホストを安全にHTMLへ渡す
- Create: `tests/unit/cloudflare-analytics.test.ts` — ローダーの一致・不一致・重複防止を検証する
- Modify: `src/layouts/BaseLayout.astro` — 直接Beaconを出力せず、Analyticsコンポーネントを呼ぶ
- Modify: `tests/unit/production-env.test.ts` — 本番ビルドに許可ホスト付き設定が出ることを検証する
- Modify: `tests/e2e/fixtures/src/pages/index.astro` — 同一ホスト動作を確認するテスト用ページを用意する
- Modify: `tests/e2e/static-pages.spec.ts` — 同一ホストでは追加、不一致では追加しないことをブラウザで検証する
- Modify: `scripts/verify-production-build.mjs` — 本番成果物のAnalytics設定を値を漏らさず検証する
- Modify: `tests/unit/deployment.test.ts` — 本番成果物検証とworkflowの環境変数配線を検証する
- Modify: `.github/workflows/deploy.yml` — 成果物検証へAnalytics tokenを渡す
- Modify: `README.md` — `SITE_URL`と本番ホスト限定計測の関係を説明する

## Task 1: ホスト一致時だけBeaconを追加するローダー

**Files:**
- Create: `tests/unit/cloudflare-analytics.test.ts`
- Create: `src/scripts/cloudflare-analytics.ts`

- [ ] **Step 1: 失敗する単体テストを書く**

`tests/unit/cloudflare-analytics.test.ts`を作成する。テスト用Documentは、追加されたscript要素を配列へ保存する最小のfakeとする。

```ts
import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_BEACON_SRC, loadCloudflareWebAnalytics } from '../../src/scripts/cloudflare-analytics';

function analyticsDocument() {
  const scripts: HTMLScriptElement[] = [];
  const documentRef = {
    querySelector: () => scripts.find((script) => script.src === CLOUDFLARE_BEACON_SRC) ?? null,
    createElement: () => ({ dataset: {}, defer: false, src: '' }),
    body: { append: (script: HTMLScriptElement) => scripts.push(script) },
  } as unknown as Document;
  return { documentRef, scripts };
}

describe('loadCloudflareWebAnalytics', () => {
  it('hostnameが完全一致するとポートに関係なくBeaconを1つ追加する', () => {
    const { documentRef, scripts } = analyticsDocument();
    expect(
      loadCloudflareWebAnalytics({
        currentHostname: 'tech-log.example',
        allowedHostname: 'tech-log.example',
        token: 'public-token',
        documentRef,
      }),
    ).toBe(true);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({ src: CLOUDFLARE_BEACON_SRC, defer: true });
    expect(JSON.parse(scripts[0].dataset.cfBeacon ?? '{}')).toEqual({ token: 'public-token' });
  });

  it.each(['localhost', '127.0.0.1', 'preview.example.workers.dev'])(
    '許可ホストと異なる%sではBeaconを追加しない',
    (currentHostname) => {
      const { documentRef, scripts } = analyticsDocument();
      expect(
        loadCloudflareWebAnalytics({
          currentHostname,
          allowedHostname: 'tech-log.example',
          token: 'public-token',
          documentRef,
        }),
      ).toBe(false);
      expect(scripts).toHaveLength(0);
    },
  );

  it('空tokenと重複呼び出しではBeaconを追加しない', () => {
    const empty = analyticsDocument();
    expect(
      loadCloudflareWebAnalytics({
        currentHostname: 'tech-log.example',
        allowedHostname: 'tech-log.example',
        token: '   ',
        documentRef: empty.documentRef,
      }),
    ).toBe(false);

    const duplicate = analyticsDocument();
    const input = {
      currentHostname: 'tech-log.example',
      allowedHostname: 'tech-log.example',
      token: 'public-token',
      documentRef: duplicate.documentRef,
    };
    expect(loadCloudflareWebAnalytics(input)).toBe(true);
    expect(loadCloudflareWebAnalytics(input)).toBe(false);
    expect(duplicate.scripts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- tests/unit/cloudflare-analytics.test.ts`

Expected: FAIL。`src/scripts/cloudflare-analytics.ts`が存在しないため、module not foundになる。

- [ ] **Step 3: 最小のローダーを実装する**

`src/scripts/cloudflare-analytics.ts`を作成する。

```ts
export const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

interface CloudflareAnalyticsOptions {
  currentHostname: string;
  allowedHostname: string;
  token?: string;
  documentRef?: Document;
}

export function loadCloudflareWebAnalytics({
  currentHostname,
  allowedHostname,
  token,
  documentRef = document,
}: CloudflareAnalyticsOptions): boolean {
  const normalizedToken = token?.trim();
  if (!normalizedToken || currentHostname !== allowedHostname) return false;
  if (documentRef.querySelector(`script[src="${CLOUDFLARE_BEACON_SRC}"]`)) return false;

  const script = documentRef.createElement('script');
  script.defer = true;
  script.src = CLOUDFLARE_BEACON_SRC;
  script.dataset.cfBeacon = JSON.stringify({ token: normalizedToken });
  documentRef.body.append(script);
  return true;
}
```

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- tests/unit/cloudflare-analytics.test.ts`

Expected: 3 tests PASS。

- [ ] **Step 5: 変更をコミットする**

```bash
git add src/scripts/cloudflare-analytics.ts tests/unit/cloudflare-analytics.test.ts
git commit -m "feat: guard analytics beacon by hostname"
```

## Task 2: Astroから本番ホスト設定を渡す

**Files:**
- Create: `src/components/common/CloudflareAnalytics.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `tests/unit/production-env.test.ts`

- [ ] **Step 1: 本番ビルドの失敗テストを書く**

`tests/unit/production-env.test.ts`の本番ビルドテストを変更し、次を期待する。

```ts
expect(html.match(/id="cloudflare-web-analytics-config"/g)).toHaveLength(1);
expect(html).toContain('data-allowed-hostname="example.invalid"');
expect(html).toContain('data-token="automated-public-analytics-token"');
expect(html).not.toMatch(/<script[^>]+src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"/);
```

tokenが未設定または空白だけの各ビルドでは、`cloudflare-web-analytics-config`が出力されないことも期待する。既存のGoogle verification検証は維持する。

- [ ] **Step 2: REDを確認する**

Run: `npm test -- tests/unit/production-env.test.ts`

Expected: FAIL。現在のHTMLには設定要素がなく、Cloudflareのscriptが直接出力される。

- [ ] **Step 3: Analyticsコンポーネントを作る**

`src/components/common/CloudflareAnalytics.astro`を作成する。

```astro
---
interface Props {
  token: string;
  allowedHostname: string;
}

const { token, allowedHostname } = Astro.props;
---

<template
  id="cloudflare-web-analytics-config"
  data-token={token}
  data-allowed-hostname={allowedHostname}
></template>

<script>
  import { loadCloudflareWebAnalytics } from '@/scripts/cloudflare-analytics';

  const config = document.querySelector<HTMLTemplateElement>('#cloudflare-web-analytics-config');
  if (config) {
    loadCloudflareWebAnalytics({
      currentHostname: window.location.hostname,
      allowedHostname: config.dataset.allowedHostname ?? '',
      token: config.dataset.token,
    });
  }
</script>
```

- [ ] **Step 4: BaseLayoutをコンポーネント利用へ切り替える**

`src/layouts/BaseLayout.astro`で`CloudflareAnalytics`をimportする。tokenは本番ビルド時だけtrimし、許可ホストには`Astro.site?.hostname`を使う。

```ts
const analyticsToken = import.meta.env.PROD
  ? import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim()
  : undefined;
const analyticsHostname = analyticsToken ? Astro.site?.hostname : undefined;
```

既存の直接script出力を次へ置き換える。

```astro
{analyticsToken && analyticsHostname && (
  <CloudflareAnalytics token={analyticsToken} allowedHostname={analyticsHostname} />
)}
```

- [ ] **Step 5: GREENを確認する**

Run: `npm test -- tests/unit/production-env.test.ts`

Expected: PASS。本番HTMLに許可ホスト付き設定が1つあり、直接Beaconはない。

- [ ] **Step 6: 変更をコミットする**

```bash
git add src/components/common/CloudflareAnalytics.astro src/layouts/BaseLayout.astro tests/unit/production-env.test.ts
git commit -m "feat: configure analytics from production host"
```

## Task 3: ブラウザ上の一致・不一致を検証する

**Files:**
- Modify: `tests/e2e/fixtures/src/pages/index.astro`
- Modify: `tests/e2e/static-pages.spec.ts`

- [ ] **Step 1: 失敗するE2Eテストを書く**

`tests/e2e/static-pages.spec.ts`へ、fixtureを`127.0.0.1`と`localhost`の両方で開くテストを追加する。

```ts
const beaconSrc = 'https://static.cloudflareinsights.com/beacon.min.js';

test('Analytics beaconは許可hostnameだけで読み込む', async ({ page }) => {
  await page.route(beaconSrc, (route) => route.abort());

  await page.goto('http://127.0.0.1:4322/');
  const allowedBeacon = page.locator(`script[src="${beaconSrc}"]`);
  await expect(allowedBeacon).toHaveCount(1);
  await expect(allowedBeacon).toHaveAttribute('data-cf-beacon', JSON.stringify({ token: 'fixture-public-token' }));

  await page.goto('http://localhost:4322/');
  await expect(page.locator(`script[src="${beaconSrc}"]`)).toHaveCount(0);
});
```

既存の`http://127.0.0.1:4321`のテストではtoken未設定のため、設定要素もBeaconも0件であることを維持する。

- [ ] **Step 2: REDを確認する**

Run: `npx playwright test tests/e2e/static-pages.spec.ts --grep 'Analytics beacon'`

Expected: FAIL。fixtureにAnalyticsコンポーネントがないため、許可ホストでもBeaconが0件になる。

- [ ] **Step 3: fixtureへAnalyticsコンポーネントを追加する**

`tests/e2e/fixtures/src/pages/index.astro`でコンポーネントをimportし、`body`末尾へ追加する。

```astro
<CloudflareAnalytics token="fixture-public-token" allowedHostname="127.0.0.1" />
```

- [ ] **Step 4: GREENを確認する**

Run: `npx playwright test tests/e2e/static-pages.spec.ts --grep 'Analytics beacon'`

Expected: PASS。ポート付きの`127.0.0.1`では1件、`localhost`では0件になる。

- [ ] **Step 5: 変更をコミットする**

```bash
git add tests/e2e/fixtures/src/pages/index.astro tests/e2e/static-pages.spec.ts
git commit -m "test: verify analytics host guard in browser"
```

## Task 4: 本番成果物のAnalytics設定を検証する

**Files:**
- Modify: `tests/unit/deployment.test.ts`
- Modify: `scripts/verify-production-build.mjs`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: verifierとworkflowの失敗テストを書く**

`tests/unit/deployment.test.ts`で以下を追加する。

- Build production assetsとVerify production asset originの両stepへ、同じ`PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` secretが渡る。
- `productionBuildErrors`へ`analyticsToken`を渡す。
- 正しい設定要素が1つならエラーなし。
- 設定要素の欠落、重複、許可ホスト不一致、token不一致を検出する。
- `analyticsToken`が空なのに設定要素が残っている場合も検出する。
- 返却エラーへAnalytics tokenを含めない。

テスト用HTMLの設定要素は次の形にする。

```html
<template id="cloudflare-web-analytics-config" data-token="public-analytics-token" data-allowed-hostname="techlog.example"></template>
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- tests/unit/deployment.test.ts`

Expected: FAIL。verifierが`analyticsToken`を受け取らず、workflowの検証stepにもsecretが配線されていない。

- [ ] **Step 3: productionBuildErrorsへAnalytics検証を追加する**

`scripts/verify-production-build.mjs`の引数へ次を追加する。

```js
analyticsToken = process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
```

`index.html`について、trim済みtokenがある場合は`cloudflare-web-analytics-config`が正確に1件あることを確認する。`data-token`はtrim済みtoken、`data-allowed-hostname`は`new URL(siteUrl).hostname`と一致させる。値そのものはエラーメッセージへ入れない。tokenが空の場合は設定要素がないことを確認する。

- [ ] **Step 4: deploy workflowへtokenを配線する**

`.github/workflows/deploy.yml`の`Verify production asset origin`へ、既存のGoogle verificationと並べて次を追加する。

```yaml
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: ${{ secrets.CLOUDFLARE_WEB_ANALYTICS_TOKEN }}
```

- [ ] **Step 5: GREENを確認する**

Run: `npm test -- tests/unit/deployment.test.ts`

Expected: PASS。正常成果物は0 errors、各不正成果物は値を漏らさず拒否される。

- [ ] **Step 6: 変更をコミットする**

```bash
git add scripts/verify-production-build.mjs tests/unit/deployment.test.ts .github/workflows/deploy.yml
git commit -m "test: verify production analytics configuration"
```

## Task 5: 運用説明と全体検証

**Files:**
- Modify: `README.md`

- [ ] **Step 1: READMEテストへ期待値を追加する**

既存のREADMEテストが環境変数説明を検証している箇所へ、`SITE_URL`のホストだけでAnalyticsを読み込む説明を期待するテストを追加する。該当テストが文字列固定ではない場合は、`tests/unit/readme.test.ts`へ次の意図を表す期待値を加える。

```ts
expect(readme).toContain('`SITE_URL`のホストと一致する場合だけ');
```

- [ ] **Step 2: REDを確認する**

Run: `npm test -- tests/unit/readme.test.ts`

Expected: FAIL。READMEに本番ホスト限定の説明がない。

- [ ] **Step 3: READMEを更新する**

環境変数の節へ次の内容を追記する。

```md
Cloudflare Web Analyticsは、閲覧中のホストが`SITE_URL`のホストと一致する場合だけ読み込みます。localhostやプレビューURLで本番成果物を確認しても、Analyticsへ送信しません。
```

- [ ] **Step 4: GREENを確認する**

Run: `npm test -- tests/unit/readme.test.ts`

Expected: PASS。

- [ ] **Step 5: フォーマットを整える**

Run: `npm run format`

Expected: Prettierが変更対象を整形する。

- [ ] **Step 6: 全検証を実行する**

Run: `SITE_URL=https://example.invalid npm run verify`

Expected:
- Prettier: PASS
- Astro check: 0 errors
- Vitest: 全テストPASS
- BuildとPagefind: PASS
- Playwright: 全テストPASS

- [ ] **Step 7: 本番相当の成果物検証を実行する**

実際のtokenは使わず、テスト値でビルドする。

```bash
SITE_URL=https://tech-log.hiroshiimaizumi0611.workers.dev \
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=test-public-token \
PUBLIC_GOOGLE_SITE_VERIFICATION=test-verification-token \
npm run build

SITE_URL=https://tech-log.hiroshiimaizumi0611.workers.dev \
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=test-public-token \
PUBLIC_GOOGLE_SITE_VERIFICATION=test-verification-token \
node scripts/verify-production-build.mjs
```

Expected: Buildとproduction verificationがexit 0。標準出力へ`test-public-token`を表示しない。

- [ ] **Step 8: 変更をコミットする**

```bash
git add README.md tests/unit/readme.test.ts
git commit -m "docs: explain production-only analytics"
```

## Task 6: PR、CI、公開後確認

**Files:**
- No additional source files expected

- [ ] **Step 1: 差分と履歴を確認する**

Run: `git status --short && git diff origin/main...HEAD --check && git log --oneline origin/main..HEAD`

Expected: 意図したファイルだけが変更され、whitespace errorがない。

- [ ] **Step 2: branchをpushしてPRを作成する**

```bash
git push -u origin codex/web-analytics-host-guard
gh pr create --repo hiroshiimaizumi0611/tech-log \
  --base main \
  --head codex/web-analytics-host-guard \
  --title "Cloudflare Analyticsを本番ホストだけで送信する" \
  --body "Closes #14"
```

- [ ] **Step 3: CIを確認する**

Run: `gh pr checks --watch`

Expected: verifyとGitGuardianがPASS。

- [ ] **Step 4: ユーザー承認後にマージする**

マージと公開は外部状態を変更するため、PR URLと検証結果を示して明示承認を得てから実行する。

- [ ] **Step 5: デプロイを確認する**

Deploy workflowのverify、production asset verification、deploy、smokeがすべてPASSすることを確認する。

- [ ] **Step 6: 公開サイトをブラウザで確認する**

公開サイトでCloudflare Beaconのscriptが1件読み込まれることを確認する。Cloudflareの公開token値は報告へ載せない。

localhost確認用の本番成果物は、テスト値を使って次のように起動する。

```bash
SITE_URL=https://tech-log.hiroshiimaizumi0611.workers.dev \
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=test-public-token \
PUBLIC_GOOGLE_SITE_VERIFICATION=test-verification-token \
npm run build
npm run preview -- --host 127.0.0.1
```

`http://127.0.0.1:4321/`をブラウザで開き、Cloudflare Beaconのscriptが0件であることを確認する。

- [ ] **Step 7: Issue #14を確認する**

PRの`Closes #14`によりIssueがcloseされたことを確認し、公開後確認の結果をPRまたはIssueへ残す。
