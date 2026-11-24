#!/usr/bin/env node
// Fills a video/templates/*.html template from a JSON data file and writes a
// composition into video/compositions/. Fails if any {{PLACEHOLDER}} is left.
// Usage: node scripts/video/build-composition.mjs <data.json> [--out <file>]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const VIDEO_ROOT = resolve(here, "../../video");

export function fillTemplate(templateHtml, values) {
  const missing = [];
  const out = templateHtml.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in values) || values[key] === null || values[key] === undefined) {
      missing.push(key);
      return `{{${key}}}`;
    }
    return String(values[key]);
  });
  if (missing.length) {
    throw new Error(`Missing template values: ${[...new Set(missing)].join(", ")}`);
  }
  return out;
}

export function buildComposition({ template, values, outFile }) {
  const tplPath = join(VIDEO_ROOT, "templates", `${template}.html`);
  const html = fillTemplate(readFileSync(tplPath, "utf8"), values);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
  return outFile;
}

function main() {
  const args = process.argv.slice(2);
  const dataPath = args[0];
  if (!dataPath) {
    console.error("usage: build-composition.mjs <data.json> [--out <file>]");
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const outIdx = args.indexOf("--out");
  const outFile =
    outIdx >= 0
      ? resolve(args[outIdx + 1])
      : join(VIDEO_ROOT, "compositions", `${basename(dataPath, ".json")}.html`);
  const { template, values } = data;
  if (!template || !values) {
    console.error("data.json must contain { template, values }");
    process.exit(2);
  }
  const written = buildComposition({ template, values, outFile });
  console.log(written);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
