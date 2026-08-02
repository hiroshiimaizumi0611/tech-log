import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const demoPath = '/demos/server-room/';
const articlePath = '/blog/blender-server-room-04-react-dashboard/';
const workersOrigin = 'http://127.0.0.1:4323';
const modelReadyTimeout = 15_000;
const expectedHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'content-security-policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
  'x-robots-tag': 'noindex, follow',
} as const;
const expectedCacheControl = 'public, max-age=0, must-revalidate';

type BrowserDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  cspViolations: string[];
};

const diagnostics = new WeakMap<Page, BrowserDiagnostics>();

test.beforeEach(async ({ page }) => {
  const current: BrowserDiagnostics = { consoleErrors: [], pageErrors: [], cspViolations: [] };
  diagnostics.set(page, current);
  page.on('console', (message) => {
    if (message.type() === 'error') current.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => current.pageErrors.push(error.message));
  await page.exposeFunction('__recordServerRoomCspViolation', (value: string) => current.cspViolations.push(value));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = `${event.violatedDirective}:${event.blockedURI}`;
      void (
        window as unknown as Window & {
          __recordServerRoomCspViolation: (value: string) => Promise<void>;
        }
      ).__recordServerRoomCspViolation(report);
    });
  });
});

test.afterEach(async ({ page }, testInfo: TestInfo) => {
  const current = diagnostics.get(page);
  if (!current) return;
  await testInfo.attach('browser-diagnostics', {
    body: JSON.stringify(current, null, 2),
    contentType: 'application/json',
  });
  expect(current.consoleErrors, 'console errors').toEqual([]);
  expect(current.pageErrors, 'uncaught page errors').toEqual([]);
  expect(current.cspViolations, 'CSP violations').toEqual([]);
});

async function openReadyDemo(page: Page, url = demoPath) {
  const response = await page.goto(url);
  expect(response?.status()).toBe(200);
  const room = page.getByRole('region', { name: 'サーバールーム', exact: true });
  await expect(room.getByRole('status')).toHaveText('3Dモデルを読み込みました', { timeout: modelReadyTimeout });
}

test('実デモで選択、状態変更、視点操作、記事導線を確認する', async ({ page }) => {
  await openReadyDemo(page);

  const selector = page.getByLabel('サーバーを選択');
  await selector.selectOption('server_01_01');
  const details = page.getByRole('complementary', { name: 'サーバー詳細' });
  await expect(details.getByRole('heading', { name: 'Server 01-01' })).toBeVisible();
  await expect(details.getByText('server_01_01', { exact: true })).toBeVisible();

  const badge = details.getByRole('status');
  await expect(badge).toHaveText('正常');
  await expect(badge).toHaveCSS('color', 'rgb(100, 215, 170)');
  await details.getByRole('button', { name: 'アラーム発生' }).click();
  await expect(badge).toHaveText('障害');
  await expect(badge).toHaveCSS('color', 'rgb(255, 133, 133)');
  await expect(details.getByRole('button', { name: 'アラーム発生' })).toBeDisabled();
  await selector.selectOption('server_01_02');
  await expect(details.getByRole('status')).toHaveText('正常');
  await selector.selectOption('server_01_01');
  await expect(details.getByRole('status')).toHaveText('障害');
  await details.getByRole('button', { name: '正常に戻す' }).click();
  await expect(badge).toHaveText('正常');
  await expect(badge).toHaveCSS('color', 'rgb(100, 215, 170)');

  const scene = page.getByRole('region', { name: '3Dサーバールーム' });
  const canvas = scene.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const before = Number(await scene.getAttribute('data-camera-change-count'));
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await scene.getAttribute('data-camera-change-count'))).toBeGreaterThan(before);
  const afterDrag = Number(await scene.getAttribute('data-camera-change-count'));
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => Number(await scene.getAttribute('data-camera-change-count'))).toBeGreaterThan(afterDrag);

  await expect(page.getByRole('link', { name: '解説記事へ戻る' })).toHaveAttribute('href', articlePath);
  await page.goto(articlePath);
  const cards = page.locator('[data-demo-cta]');
  await expect(cards).toHaveCount(2);
  for (const card of await cards.all()) {
    await expect(card.getByText('INTERACTIVE DEMO', { exact: true })).toBeVisible();
    await expect(card.getByRole('heading', { name: '3Dサーバールームを操作できます' })).toBeVisible();
    await expect(card).toContainText('回転とズーム');
    await expect(card).toContainText('サーバー選択');
    await expect(card).toContainText('アラーム発生と正常復帰');
    await expect(card).toContainText('別タブで開きます');
    await expect(card).toContainText('デスクトップ環境を推奨します');
    const link = card.getByRole('link', { name: /3Dサーバールームを開く/ });
    await expect(link).toHaveAttribute('href', demoPath);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
  }
});

test('記事のデモカードがPC幅で640px以内に収まる', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(articlePath);
  const cards = page.locator('[data-demo-cta]');
  await expect(cards).toHaveCount(2);
  for (const card of await cards.all()) {
    await expect.poll(async () => (await card.boundingBox())?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(640);
  }
});

test('記事のデモカードが390px幅で横overflowを起こさずキーボード操作できる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);
  const cards = page.locator('[data-demo-cta]');
  await expect(cards).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const links = cards.getByRole('link', { name: /3Dサーバールームを開く/ });
  await expect(links).toHaveCount(2);
  const articleBodyBox = await page.locator('.article-body').boundingBox();
  expect(articleBodyBox).not.toBeNull();
  for (const card of await cards.all()) {
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(Math.abs(cardBox!.width - articleBodyBox!.width)).toBeLessThanOrEqual(1);

    const link = card.getByRole('link', { name: /3Dサーバールームを開く/ });
    const linkBox = await link.boundingBox();
    expect(linkBox).not.toBeNull();
    const cardContentWidth = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        element.getBoundingClientRect().width -
        parseFloat(style.paddingInlineStart) -
        parseFloat(style.paddingInlineEnd) -
        parseFloat(style.borderInlineStartWidth) -
        parseFloat(style.borderInlineEndWidth)
      );
    });
    expect(Math.abs(linkBox!.width - cardContentWidth)).toBeLessThanOrEqual(1);
  }

  const focusedCtas: number[] = [];
  for (let attempt = 0; attempt < 80 && focusedCtas.length < 2; attempt += 1) {
    await page.keyboard.press('Tab');
    const focusedIndex = await links.evaluateAll((elements) =>
      elements.findIndex((element) => element === document.activeElement),
    );
    if (focusedIndex >= 0 && !focusedCtas.includes(focusedIndex)) {
      focusedCtas.push(focusedIndex);
      await expect(links.nth(focusedIndex)).toHaveCSS('outline-style', 'solid');
    }
  }
  expect(focusedCtas).toEqual([0, 1]);
});

test('第4回記事にcriticalまたはseriousのaxe違反がない', async ({ page }) => {
  await page.goto(articlePath);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
});

test('キーボードだけでサーバー選択と状態変更を操作する', async ({ page }) => {
  await openReadyDemo(page);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '解説記事へ戻る' })).toBeFocused();
  await page.keyboard.press('Tab');
  const selector = page.getByLabel('サーバーを選択');
  await expect(selector).toBeFocused();
  await page.keyboard.type('Server 01-01');
  await expect(selector).toHaveValue('server_01_01');
  await page.keyboard.press('Tab');
  const alarm = page.getByRole('button', { name: 'アラーム発生' });
  await expect(alarm).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'サーバー詳細' }).getByRole('status')).toHaveText('障害');
  await page.keyboard.press('Tab');
  const restore = page.getByRole('button', { name: '正常に戻す' });
  await expect(restore).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('complementary', { name: 'サーバー詳細' }).getByRole('status')).toHaveText('正常');
});

test('JavaScript無効でもタイトル、記事導線、モック表示、推奨環境を案内する', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:4321' });
  const page = await context.newPage();
  try {
    const response = await page.goto(demoPath);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle('3Dサーバールーム監視ダッシュボード');
    await expect(page.getByRole('link', { name: '解説記事へ戻る' })).toHaveAttribute('href', articlePath);
    await expect(page.getByText(/ローカルのモックデータ/)).toBeVisible();
    await expect(page.getByText(/3D操作にはデスクトップ環境を推奨します/)).toBeVisible();
  } finally {
    await context.close();
  }
});

test('実デモにcriticalまたはseriousのaxe違反がない', async ({ page }) => {
  await openReadyDemo(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
});

test('390×844で横overflowを起こさずCanvas外から縦スクロールできる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReadyDemo(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight)).toBe(true);
  const header = page.locator('.public-shell');
  const box = await header.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 8, box!.y + 8);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('Workers配信でredirect、MIME、security header、cache、CSPを維持する', async ({ page, request }) => {
  const redirect = await request.get(`${workersOrigin}/demos/server-room`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers().location).toBe('/demos/server-room/');

  const html = await request.get(`${workersOrigin}${demoPath}`);
  expect(html.status()).toBe(200);
  expect(html.headers()['content-type']?.split(';', 1)[0]).toBe('text/html');
  const body = await html.text();
  const scriptPath = body.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
  const stylesheetPath = body.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1];
  expect(scriptPath).toMatch(/^\/demos\/server-room\/assets\/.+\.js$/);
  expect(stylesheetPath).toMatch(/^\/demos\/server-room\/assets\/.+\.css$/);

  const assets = [
    { path: demoPath, mime: ['text/html'] },
    { path: scriptPath!, mime: ['text/javascript', 'application/javascript'] },
    { path: stylesheetPath!, mime: ['text/css'] },
    { path: '/demos/server-room/models/server-room.glb', mime: ['model/gltf-binary'] },
  ] as const;
  for (const asset of assets) {
    const response = asset.path === demoPath ? html : await request.get(`${workersOrigin}${asset.path}`);
    expect(response.ok(), asset.path).toBe(true);
    const headers = response.headers();
    expect(asset.mime, `${asset.path} MIME`).toContain(headers['content-type']?.split(';', 1)[0]);
    expect(headers['cache-control'], `${asset.path} Cache-Control`).toBe(expectedCacheControl);
    for (const [name, value] of Object.entries(expectedHeaders)) {
      expect(headers[name], `${asset.path} ${name}`).toBe(value);
    }
  }

  await openReadyDemo(page, `${workersOrigin}${demoPath}`);
});
