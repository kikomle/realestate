import { defineConfig } from "@playwright/test";
import exteriorReview from "./stage3-preview.config";

const port = Number(process.env.STAGE3_PREVIEW_PORT ?? "4174");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  ...exteriorReview,
  testMatch: "facade-plan-journey.spec.ts",
  outputDir: "../../reports/qa/stage2/private/facade-plan-journey",
  workers: 1,
  projects: exteriorReview.projects?.filter(project => project.name === "desktop" || project.name === "portrait"),
  webServer: [
    {
      cwd: "../..",
      command: `node scripts/web/serve-stage3-preview.mjs ${port}`,
      url: baseURL,
      reuseExistingServer: true,
    },
    {
      cwd: "../..",
      command: "npm run dev:exterior",
      url: "http://127.0.0.1:3103/exterior-preview",
      reuseExistingServer: true,
    },
  ],
  use: {
    ...exteriorReview.use,
    baseURL,
  },
});
