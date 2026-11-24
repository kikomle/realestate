/** Browser-based automated WCAG check; incomplete rules require manual review. */
import { chromium } from "@playwright/test";
import axe from "axe-core";

const baseURL = "http://127.0.0.1:3103";
const states = {
  exterior: "/exterior-preview",
  "selected exterior": "/exterior-preview?floor=L02",
  floor: "/exterior-preview/plans?floor=L02",
  apartment: "/exterior-preview/plans?floor=L04&plan=gallery&unit=H+4.5",
};
const modes = {
  desktop: { viewport: { width: 1440, height: 900 } },
  portrait: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const browser = await chromium.launch();
try {
  for (const [name, options] of Object.entries(modes)) {
    const context = await browser.newContext({ baseURL, ...options, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      for (const [state, path] of Object.entries(states)) {
        const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
        if (response?.status() !== 200) throw new Error(`${path} returned ${response?.status()}`);
        await page.locator("main h1").waitFor({ state: "visible" });
        await page.addScriptTag({ content: axe.source });
        const result = await page.evaluate(async () => {
          const report = await window.axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
          const summarize = rule => ({ id: rule.id, impact: rule.impact, nodes: rule.nodes.length,
            targets: rule.nodes.slice(0, 4).map(node => node.target) });
          return {
            axe: report.testEngine.version,
            passes: report.passes.length,
            incomplete: report.incomplete.map(summarize),
            violations: report.violations.map(summarize),
          };
        });
        console.log(JSON.stringify({ profile: name, state, ...result }));
        if (result.violations.length) process.exitCode = 1;
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
