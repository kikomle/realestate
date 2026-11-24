/** Capture a real private selector journey. Never write source imagery into public/. */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const baseURL = "http://127.0.0.1:3103";
const output = "reports/qa/stage2/private/stage6-final/screens";
const exterior = "/exterior-preview";
const gallery = `${exterior}/plans?floor=L04&plan=gallery`;
const apartment = `${gallery}&unit=H+4.5`;
const profiles = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-webgl"] });
try {
  for (const [profile, options] of Object.entries(profiles)) {
    const context = await browser.newContext({ baseURL, ...options });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (message.type() === "error") errors.push(message.text());
      });
      const shot = async name => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(options.viewport.width);
        await page.screenshot({ path: join(output, `${profile}-${name}.png`), scale: "css" });
      };
      const activate = locator => options.hasTouch ? locator.tap() : locator.click();
      expect((await page.goto(exterior, { waitUntil: "domcontentloaded", timeout: 60_000 }))?.status()).toBe(200);
      const facade = page.locator("[data-exterior-viewport]");
      await expect(facade).toHaveAttribute("data-displayed-view", "arrival");
      await expect(facade).toHaveAttribute("data-asset-state", "ready");
      await shot("01-arrival");

      await activate(page.getByRole("button", { name: "Pročelje", exact: true }));
      const floor = page.getByRole("navigation", { name: "Odabir etaže zgrade H" })
        .getByRole("button", { name: "Etaža 4" });
      await activate(floor);
      await expect(floor).toHaveAttribute("aria-pressed", "true");
      await expect(facade).toHaveAttribute("data-displayed-view", "facade");
      await expect(facade).toHaveAttribute("data-moving", "false");
      await shot("02-floor-selected");
      await activate(page.getByRole("link", { name: "Provjeri tlocrt" }));
      await activate(page.getByRole("link", { name: "Galerija", exact: true }));
      await expect(page).toHaveURL(`${baseURL}${gallery}`);
      await expect(page.locator("svg[data-unit-map]")).toHaveAttribute("data-ready", "true");
      await shot("03-gallery-floor-plan");

      const unit = page.getByRole("navigation", { name: "Stanovi na etaži" })
        .getByRole("link", { name: /^H 4\.5(?:\s|$)/ });
      await activate(unit);
      await expect(page).toHaveURL(`${baseURL}${apartment}`);
      await expect(page.getByRole("heading", { name: "H 4.5", exact: true })).toBeFocused();
      await expect(page.locator("[data-listing-area]")).toHaveText("91,05 m²");
      const viewer = page.getByRole("region", { name: "Interaktivni tlocrt stana" });
      await expect(viewer).toBeVisible();
      await page.locator("[data-apartment-image]").evaluate(image => image.decode());
      await shot("04-apartment");

      await activate(page.getByRole("button", { name: "Povećaj tlocrt" }));
      await expect(viewer).not.toHaveAttribute("data-zoom", "1");
      await activate(page.getByRole("button", { name: "Vrati cijeli tlocrt" }));
      await expect(viewer).toHaveAttribute("data-zoom", "1");
      await activate(page.getByRole("link", { name: "Natrag na etažu" }));
      await expect(page).toHaveURL(`${baseURL}${gallery}`);
      await expect(unit).toBeFocused();
      await page.goBack();
      await expect(page.getByRole("heading", { name: "H 4.5", exact: true })).toBeVisible();
      await page.goForward();
      await expect(page).toHaveURL(`${baseURL}${gallery}`);
      await expect(unit).toBeFocused();
      expect(errors).toEqual([]);
      console.log(`${profile}: captured four journey states; verified zoom, reset, history and focus`);

      // Block just the decorative thumbnail, not the exact plan the visitor chose.
      await page.route("**/exterior-preview/media/**", route => route.abort());
      expect((await page.goto(apartment, { waitUntil: "domcontentloaded", timeout: 60_000 }))?.status()).toBe(200);
      const facadeLink = page.getByRole("link", { name: "Pročelje zgrade H" });
      await expect(facadeLink).toBeVisible();
      await facadeLink.scrollIntoViewIfNeeded();
      await expect(facadeLink.locator("picture")).toBeHidden();
      await expect(viewer).toBeVisible();
      await expect(facadeLink).toHaveAttribute("href", `${exterior}?floor=L04`);
      console.log(`${profile}: missing decorative image leaves the plan and façade link usable`);
    } finally {
      await context.close();
    }
  }

  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1920, height: 1080 }]) {
    const page = await browser.newPage({ baseURL, viewport, reducedMotion: "reduce" });
    try {
      const response = await page.goto(`${exterior}?floor=L04`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      expect(response?.status()).toBe(200);
      const link = page.getByRole("link", { name: "Provjeri tlocrt", exact: true });
      await expect(link).toBeInViewport();
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
      const detail = await page.goto(apartment, { waitUntil: "domcontentloaded", timeout: 60_000 });
      expect(detail?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "H 4.5", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      console.log(`${viewport.width}×${viewport.height}: exterior CTA in view and apartment detail without horizontal overflow`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
