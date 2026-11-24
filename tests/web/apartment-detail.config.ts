import { defineConfig } from "@playwright/test";
import base from "./floor-plan-proof.config";

export default defineConfig({
  ...base,
  testMatch: "apartment-detail.spec.ts",
  outputDir: "../../reports/qa/stage2/private/stage5-failures",
});
