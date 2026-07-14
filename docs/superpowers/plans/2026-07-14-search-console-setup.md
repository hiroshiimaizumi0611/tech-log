# Search Console Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テックログをGoogle Search Consoleで所有権確認し、production sitemapを送信できる状態にする。

**Architecture:** GitHub Repository Variable `PUBLIC_GOOGLE_SITE_VERIFICATION`へGoogleタグの`content`値だけを保存し、production buildへ渡す。共通`SEOHead.astro`はtrim後の値がある場合だけ確認タグを1件出力し、本番成果物検査がタグ欠落をデプロイ前に検出する。

**Tech Stack:** Astro 7、Vitest、GitHub Actions、Cloudflare Workers、Google Search Console

---

### Task 1: Build出力の所有権確認タグ

**Files:**
- Modify: `tests/unit/production-env.test.ts`
- Modify: `src/components/common/SEOHead.astro`
- Modify: `src/env.d.ts`

- [ ] **Step 1: 失敗テストを書く**

  production buildへ`PUBLIC_GOOGLE_SITE_VERIFICATION: 'test-verification-token'`を渡し、`dist/index.html`に`name="google-site-verification"`と同じcontentのタグがちょうど1件あることを検証する。未設定の場合と空白だけ（`'   '`）の場合は0件であることも検証する。

- [ ] **Step 2: REDを確認する**

  Run: `npx vitest run tests/unit/production-env.test.ts`

  Expected: 確認タグが0件のため新規assertionがFAILする。

- [ ] **Step 3: 最小実装を書く**

  `SEOHead.astro`で次を定義する。

  ```astro
  const googleSiteVerification = import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  ```

  `<head>`内へ次を1件だけ条件出力する。

  ```astro
  {googleSiteVerification && <meta name="google-site-verification" content={googleSiteVerification} />}
  ```

  `src/env.d.ts`へ`ImportMetaEnv.PUBLIC_GOOGLE_SITE_VERIFICATION?: string`を追加する。

- [ ] **Step 4: GREENを確認する**

  Run: `npx vitest run tests/unit/production-env.test.ts`

  Expected: PASS。

### Task 2: Deploy workflowと本番成果物のfail-safe

**Files:**
- Modify: `tests/unit/deployment.test.ts`
- Modify: `.github/workflows/deploy.yml`
- Modify: `scripts/verify-production-build.mjs`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `tests/unit/readme.test.ts`

- [ ] **Step 1: workflow契約と成果物検査の失敗テストを書く**

  Deploy workflowのproduction build stepへ次があることを検証する。

  ```yaml
  PUBLIC_GOOGLE_SITE_VERIFICATION: ${{ vars.PUBLIC_GOOGLE_SITE_VERIFICATION }}
  ```

  後続の`node scripts/verify-production-build.mjs` stepにも同じ環境変数が渡ることを検証する。

  `productionBuildErrors`へ確認値を渡し、`dist/index.html`内にある`meta[name="google-site-verification"]`の総数が1件、かつそのcontentがtrim済みの期待値と一致する場合だけ成功するfixtureを追加する。欠落・重複・不一致はエラーとし、エラー本文に確認値を含めない。既存の成功fixtureはすべてテスト用tokenを渡し、`index.html`へ対応タグを含める。

- [ ] **Step 2: REDを確認する**

  Run: `npx vitest run tests/unit/deployment.test.ts`

  Expected: workflow環境変数と確認タグ検査が未実装のためFAILする。

- [ ] **Step 3: workflowと成果物検査を実装する**

  production build stepと後続のproduction-verification stepの両方へRepository Variableを渡す。`productionBuildErrors`は`googleSiteVerification = process.env.PUBLIC_GOOGLE_SITE_VERIFICATION`を受け、trim後が空なら一般化した欠落エラーを返す。`index.html`の確認タグ総数が1件で、そのcontentが期待値と一致しなければ、値を出さずに失敗する。

  `.env.example`とREADMEへ、値はタグ全体ではなく`content`値だけであること、production deployに必要であることを記載する。README契約テストも更新する。

- [ ] **Step 4: GREENを確認する**

  Run: `npx vitest run tests/unit/deployment.test.ts tests/unit/readme.test.ts`

  Expected: PASS。

### Task 3: Repository Variable、検証、GitHub公開

**Files:**
- GitHub Repository Variable `PUBLIC_GOOGLE_SITE_VERIFICATION`

- [x] **Step 1: URLプレフィックスプロパティと確認方式を選ぶ**

  `https://tech-log.hiroshiimaizumi0611.workers.dev/`のURLプレフィックスプロパティを作成し、HTMLタグ方式を選ぶ。Googleが示したタグから`content`値だけを取得し、「確認」はデプロイ完了まで押さない。

- [ ] **Step 2: Repository Variableを登録する**

  Googleが提示した`content`値だけを標準入力で登録し、値をログやshell historyへ表示しない。

  Run:

  ```bash
  read -rs GOOGLE_SITE_VERIFICATION
  printf '%s' "$GOOGLE_SITE_VERIFICATION" | gh variable set PUBLIC_GOOGLE_SITE_VERIFICATION -R hiroshiimaizumi0611/tech-log
  unset GOOGLE_SITE_VERIFICATION
  ```

  Expected: GitHub上に同名のRepository Variableが作成される。

- [ ] **Step 3: 全検証を実行する**

  Run: `SITE_URL=https://example.invalid npm run verify`

  Expected: format、Astro check、unit、build、E2EがすべてPASS。

- [ ] **Step 4: commit、push、PRを作成する**

  Run:

  ```bash
  git add .github/workflows/deploy.yml .env.example README.md src/components/common/SEOHead.astro src/env.d.ts scripts/verify-production-build.mjs tests/unit/deployment.test.ts tests/unit/production-env.test.ts tests/unit/readme.test.ts docs/superpowers/specs/2026-07-14-search-console-setup-design.md docs/superpowers/plans/2026-07-14-search-console-setup.md
  git commit -m "feat: add Search Console verification"
  git push -u origin codex/search-console-setup
  gh pr create -R hiroshiimaizumi0611/tech-log --base main --head codex/search-console-setup --title "Add Google Search Console verification" --body "Search Consoleの所有権確認タグをproduction buildへ追加し、デプロイ前の成果物検査で欠落・重複・不一致を検出します。"
  gh pr checks --watch
  gh pr merge --merge --delete-branch
  ```

  Expected: CI成功後にPRがmainへ統合される。

- [ ] **Step 5: Deploy workflowを確認する**

  mainのDeploy workflowが本番成果物検査を含めて成功することを確認する。

### Task 4: Search Console所有権確認とsitemap送信

**Files:**
- Google Search Console URLプレフィックスプロパティ

- [ ] **Step 1: 本番HTMLを確認する**

  `/`がHTTP 200で、`<head>`に確認タグが正しいcontentで1件だけあり、canonicalが本番originを指すことを確認する。値は報告ログへ出さない。

  Run:

  ```bash
  EXPECTED="$(gh variable get PUBLIC_GOOGLE_SITE_VERIFICATION -R hiroshiimaizumi0611/tech-log)" node --input-type=module -e 'const origin="https://tech-log.hiroshiimaizumi0611.workers.dev"; const r=await fetch(origin+"/"); if(!r.ok) throw new Error(`home HTTP ${r.status}`); const h=await r.text(); const tags=[...h.matchAll(/<meta name="google-site-verification" content="([^"]+)"/g)]; if(tags.length!==1||tags[0][1]!==process.env.EXPECTED) throw new Error("verification tag mismatch"); if(!h.includes(`rel="canonical" href="${origin}/"`)) throw new Error("canonical mismatch");'
  ```

  Expected: exit 0、確認値は出力されない。

- [ ] **Step 2: sitemap成果物を確認する**

  `/sitemap-index.xml`がHTTP 200で本番originの`/sitemap-0.xml`を参照し、子sitemapもHTTP 200で本番originの絶対URLだけを含むことを確認する。

  Run:

  ```bash
  node --input-type=module -e 'const o="https://tech-log.hiroshiimaizumi0611.workers.dev"; const i=await fetch(o+"/sitemap-index.xml"); if(!i.ok) throw new Error(`index HTTP ${i.status}`); const ix=await i.text(); if(!ix.includes(`<loc>${o}/sitemap-0.xml</loc>`)) throw new Error("index origin mismatch"); const c=await fetch(o+"/sitemap-0.xml"); if(!c.ok) throw new Error(`child HTTP ${c.status}`); const x=await c.text(); const locs=[...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]); if(!locs.length||locs.some(u=>!u.startsWith(o+"/"))) throw new Error("child origin mismatch");'
  ```

  Expected: exit 0。

- [ ] **Step 3: 所有権を確認する**

  URLプレフィックスプロパティでHTMLタグ方式の「確認」を実行し、成功状態を確認する。

- [ ] **Step 4: sitemapを送信する**

  Sitemaps画面で`sitemap-index.xml`を送信し、fetch・解析エラーのない処理結果を確認する。受理はインデックス登録の保証ではない。

### Task 5: 後続作業

- [ ] Cloudflare Analyticsを本番hostだけで送信する変更を別Issueにする。
- [ ] 28日後にSearch Consoleの表示回数、クリック、検索語、掲載順位を確認する運用を記録する。
