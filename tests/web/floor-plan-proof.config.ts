import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3103";

export default defineConfig({
  testDir: ".",
  testMatch: "floor-plan-proof.spec.ts",
  outputDir: "../../reports/qa/stage2/private/stage4-failures",
  reporter: "list",
  workers: 2,
  use: { baseURL, browserName: "chromium", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "portrait", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    cwd: "../..",
    command: "npm run dev:exterior",
    url: `${baseURL}/exterior-preview`,
    reuseExistingServer: true,
  },
});
