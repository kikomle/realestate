/** Local preview diagnostic, not a production Web Vitals benchmark. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseURL = "http://127.0.0.1:3103";
const exterior = "/exterior-preview";
const floor = `${exterior}/plans?floor=L02`;
const detail = `${floor}&unit=H+2.1`;
const cases = [
  ["exterior", exterior, '[data-exterior-image="arrival"] img'],
  ["floor", floor, "[data-plan-image]"],
  ["unit", detail, "[data-apartment-image]"],
];
const viewports = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  portrait: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const round = n => Math.round(n * 10) / 10;
const browser = await chromium.launch();

async function openAndDecode(page, path, selector) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(response?.status(), 200, path);
  const image = page.locator(selector);
  await image.evaluate(img => img.decode());
  return page.evaluate(async (selector) => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const image = document.querySelector(selector);
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    return {
      decodeMs: performance.now(),
      ttfbMs: nav.responseStart,
      canonicalImage: new URL(image.currentSrc).pathname.split("/").at(-1),
      media: resources
        .filter(entry => /\/exterior-preview\/.*\.(?:avif|webp)$/.test(new URL(entry.name).pathname))
        .map(entry => ({ file: new URL(entry.name).pathname.split("/").at(-1), bytes: entry.encodedBodySize })),
      glbs: resources.filter(entry => /\.glb(?:$|\?)/.test(entry.name)).length,
    };
  }, selector);
}

async function observeZoom(page, motionPreference) {
  await page.emulateMedia({ reducedMotion: motionPreference });
  await openAndDecode(page, floor, "[data-plan-image]");
  await page.locator('[data-unit-map][data-ready="true"]').waitFor();
  const link = page.getByRole("navigation", { name: "Stanovi na etaži" })
    .getByRole("link", { name: /^H 2\.1(?:\s|$)/ });
  await link.evaluate(element => {
    const root = document.querySelector("[data-plan-proof]");
    element.addEventListener("click", () => {
      const start = performance.now();
      const gaps = [];
      let last = start;
      let enteredZoom = false;
      const tick = now => {
        enteredZoom ||= root.dataset.phase === "zoom";
        gaps.push(Math.max(0, now - last));
        last = now;
        if (root.dataset.phase === "apartment") {
          root.dataset.profileMotion = JSON.stringify({ ms: now - start, gaps, enteredZoom });
        } else if (now - start < 2500) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { once: true });
  });
  await link.focus();
  await page.keyboard.press("Enter");
  const sample = await page.locator("[data-plan-proof][data-profile-motion]").getAttribute("data-profile-motion");
  const { ms, gaps, enteredZoom } = JSON.parse(sample);
  const frameGaps = gaps.slice(1).sort((a, b) => a - b);
  return { revealMs: round(ms), frames: gaps.length, p95FrameGapMs: frameGaps.length
    ? round(frameGaps[Math.ceil(frameGaps.length * 0.95) - 1]) : null, animated: enteredZoom };
}

try {
  // Warm the dev compiler first. Each measured visit starts in a fresh browser context.
  const warm = await browser.newContext({ baseURL });
  const warmPage = await warm.newPage();
  for (const [, path, selector] of cases) await openAndDecode(warmPage, path, selector);
  await warm.close();
  const result = {};
  for (const [profile, options] of Object.entries(viewports)) {
    result[profile] = {};
    for (const [state, path, selector] of cases) {
      const samples = [];
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext({ baseURL, ...options });
        try {
          samples.push(await openAndDecode(await context.newPage(), path, selector));
        } finally {
          await context.close();
        }
      }
      assert(samples.every(row => row.glbs === 0), "Private selector pulled a GLB");
      result[profile][state] = {
        ttfbMs: round(median(samples.map(row => row.ttfbMs))),
        observedImageDecodeByMs: round(median(samples.map(row => row.decodeMs))),
        canonicalImage: samples[1].canonicalImage,
        media: samples[1].media,
      };
    }
    const context = await browser.newContext({ baseURL, ...options });
    try {
      const page = await context.newPage();
      result[profile].motion = await observeZoom(page, "no-preference");
      result[profile].reducedMotion = await observeZoom(page, "reduce");
      assert(result[profile].motion.animated && !result[profile].reducedMotion.animated);
    } finally {
      await context.close();
    }
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
