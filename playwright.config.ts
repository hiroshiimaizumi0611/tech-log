import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4321',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'SITE_URL=https://example.invalid npm run build && npm run preview -- --host 127.0.0.1',
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: false,
    },
    {
      command: 'npm run test:e2e:fixture',
      url: 'http://127.0.0.1:4322',
      reuseExistingServer: false,
    },
  ],
});
