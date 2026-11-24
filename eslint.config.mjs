import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-exterior-preview/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Other agents' vendored/generated output (not part of the web app).
    "video/**",
    "assets/**",
    "scripts/**",
    ".venv-bim/**",
    ".opencode/**",
    "public/models/**",
    "public/media/**",
  ]),
]);

export default eslintConfig;
