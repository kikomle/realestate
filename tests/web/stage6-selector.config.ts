import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? "3103");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}
const baseURL = `http://127.0.0.1:${port}`;
const reduce = process.env.PW_REDUCED_MOTION === "1";

export default defineConfig({
  testDir: ".",
  testMatch: "stage6-selector.spec.ts",
  outputDir: `../../reports/qa/stage2/private/stage6-d/${reduce ? "reduced" : "normal"}`,
  reporter: "list",
  workers: 4,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL,
    browserName: "chromium",
    reducedMotion: reduce ? "reduce" : "no-preference",
    launchOptions: { args: ["--disable-webgl"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "portrait", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    cwd: "../..",
    command: `MOCIRE_EXTERIOR_PREVIEW=1 npm exec --no -- next dev --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/exterior-preview`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
