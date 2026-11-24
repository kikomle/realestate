import { defineConfig } from '@playwright/test';

const port = Number(process.env.STAGE3_PREVIEW_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  testMatch: 'stage3-preview.spec.ts',
  outputDir: '../../test-results/stage3-preview',
  reporter: 'list',
  timeout: 25_000,
  workers: 3,
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'laptop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'portrait', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'landscape', use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    command: `node ../../scripts/web/serve-stage3-preview.mjs ${port}`,
    url: baseURL,
    reuseExistingServer: true,
  },
});
