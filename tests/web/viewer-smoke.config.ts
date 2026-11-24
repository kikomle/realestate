import { defineConfig, devices } from "@playwright/test"

const gl = { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }

export default defineConfig({
  testDir: ".",
  testMatch: /viewer-smoke\.spec\.ts/,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000", trace: "off" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: gl },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, launchOptions: gl },
    },
  ],
})
