import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3103";

export default defineConfig({
  testDir: ".",
  testMatch: "exterior-explorer.spec.ts",
  outputDir: "../../test-results/exterior-explorer",
  reporter: "list",
  timeout: 30_000,
  workers: 3,
  use: { baseURL, browserName: "chromium", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "laptop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "portrait", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "landscape", use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    cwd: "../..",
    command: "npm run dev:exterior",
    url: `${baseURL}/exterior-preview`,
    reuseExistingServer: true,
  },
});
