import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { readPlanWitnesses, readTestApartments, readTestFloors, readTestLedger } from "./private-preview-fixtures";

const apartments = readTestApartments();
const floors = readTestFloors();
const ledger = readTestLedger();
const route = "/exterior-preview/plans";
const shots = `${process.env.MOCIRE_QA_CAPTURE_ROOT ?? "reports/qa/stage2/private"}/stage5-apartment-detail`;
const details = (page: Page) => page.locator("[data-apartment-detail]");
const drawing = (page: Page) => page.locator("[data-apartment-image]");
const back = (page: Page) => page.getByRole("link", { name: "Natrag na etažu" });
const format = (n: number, decimals = 2) =>
  n.toLocaleString("hr-HR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

for (const floor of floors.floors) {
  for (const plan of floor.plans) {
    test(`${plan.image_id} · every registered outline opens its exact drawing and measurements`, async ({ page, hasTouch }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const query = `floor=${floor.floor_id}${plan.variant === "gallery" ? "&plan=gallery" : ""}`;
      await page.goto(`${route}?${query}`);
      if (hasTouch) await page.getByRole("button", { name: "Cijeli tlocrt" }).click();
      const svg = page.locator("svg[data-unit-map]");
      await expect(svg).toBeVisible();
      const witnesses = (await readPlanWitnesses()).find(source => source.id === plan.image_id)!.points;
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
      page.on("request", req => { if (/\/models\/|\.glb|\/floorplans\/|\/overlays\//.test(req.url())) errors.push(req.url()); });
      for (const unitId of floor.unit_ids) {
        const unit = apartments.units.find(row => row.floor_id === floor.floor_id && row.unit_id === unitId)!;
        const asset = ledger.assets.find(row => row.kind === "unit-plan" && row.unit_id === unitId)!;
        const [, x, y] = witnesses.find(([id]) => id === unitId)!;
        await svg.scrollIntoViewIfNeeded();
        const hit = await svg.evaluate((el: SVGSVGElement, { x, y }) => {
          const p = new DOMPoint(x, y).matrixTransform(el.getScreenCTM()!);
          return { x: p.x, y: p.y, id: document.elementFromPoint(p.x, p.y)?.getAttribute("data-unit-id") };
        }, { x, y });
        expect(hit.id).toBe(unitId);
        const image = page.waitForResponse(res => res.url().endsWith(`/unit-media/${unitId.replace(" ", "-")}.webp`));
        if (hasTouch) await page.touchscreen.tap(hit.x, hit.y);
        else await page.mouse.click(hit.x, hit.y);
        const media = await image;
        expect(media.ok()).toBe(true);
        expect(createHash("sha256").update(await media.body()).digest("hex")).toBe(asset.optimized!.sha256);
        await expect(drawing(page)).toHaveJSProperty("naturalWidth", asset.width);
        await expect(drawing(page)).toHaveJSProperty("naturalHeight", asset.height);
        await expect(details(page).getByRole("heading", { name: unitId, exact: true })).toBeVisible();
        await expect(details(page).locator("[data-unit-floor]")).toHaveText(floor.label);
        await expect(details(page).locator("[data-unit-type]")).toHaveText(unit.unit_type_source_label);
        await expect(details(page).locator("[data-listing-area]")).toHaveText(`${unit.listing_area_raw} m²`);
        await expect(details(page).locator("[data-source-status]")).toHaveText(unit.status);
        await expect(details(page).locator("time")).toHaveAttribute("datetime", unit.status_as_of.slice(0, 10));
        await expect(details(page).getByRole("link", { name: "Otvori izvorni PDF" })).toHaveAttribute("href", unit.sheet.source_url);
        expect(await details(page).locator("tbody tr").allTextContents()).toEqual(
          unit.sheet.rooms.map(room =>
            [room.number, room.label, format(room.np_m2), format(room.coefficient), format(room.nkp_m2)].join("")),
        );
        await expect(details(page).locator("tfoot tr")).toHaveText(
          `Ukupno prema PDF-u${format(unit.sheet.np_total_m2)}—${format(unit.sheet.nkp_total_m2)}`,
        );
        if (unit.flags.includes("DETAIL_AND_SHEET_NP_DIFFER")) {
          await expect(details(page).getByText(
            `NP u oglasu iznosi ${format(unit.detail_page.np_total_m2)} m², a u PDF-u ${format(unit.sheet.np_total_m2)} m².`,
            { exact: true },
          )).toBeVisible();
        }
        if (unit.flags.includes("LISTING_AND_SHEET_NKP_DIFFER")) {
          await expect(details(page).getByText(
            `Obračunska površina u oglasu iznosi ${unit.listing_area_raw} m², a NKP u PDF-u ${format(unit.sheet.nkp_total_m2)} m².`,
            { exact: true },
          )).toBeVisible();
        }
        await expect(svg.getByRole("link", { name: `Stan ${unitId}`, exact: true })).toHaveAttribute("aria-current", "true");
        const address = new URL(page.url());
        expect(address.searchParams.get("unit")).toBe(unitId);
        expect(address.searchParams.get("floor")).toBe(floor.floor_id);
        await back(page).click();
        await expect(page).toHaveURL(url => url.search.slice(1) === query);
        await expect(details(page)).toHaveCount(0);
        await expect(page.locator("[data-plan-proof]")).toHaveAttribute("data-image-id", plan.image_id);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("a real exterior-to-plan selection zooms before opening, with history and keyboard focus", async ({ page }, info) => {
  await page.goto("/exterior-preview");
  await page.getByRole("button", { name: "Izdvoji zgradu" }).click();
  await page.getByRole("button", { name: "Etaža 2", exact: true }).click();
  await page.getByRole("link", { name: "Provjeri tlocrt" }).click();
  const cards = page.getByRole("navigation", { name: "Stanovi na etaži" });
  const card = cards.getByRole("link", { name: /^H 2\.1(?:\s|$)/ });
  await expect(page.locator("svg[data-unit-map]")).toBeVisible();
  await page.screenshot({ path: `${shots}/${info.project.name}-L02-floor.png`, scale: "css" });
  await page.evaluate(() => {
    const root = document.querySelector("[data-plan-proof]")!;
    const first = document.querySelector("[data-plan-image]")!.getBoundingClientRect().width;
    let peak = first;
    const inspect = () => {
      const art = document.querySelector("[data-plan-image]")!;
      if (root.getAttribute("data-phase") === "zoom") {
        peak = Math.max(peak, art.getBoundingClientRect().width);
        root.setAttribute("data-observed-zoom", (peak / first).toString());
        const selected = root.querySelector("svg[data-unit-map] a[aria-current] polygon");
        if (selected && Number(getComputedStyle(selected).fillOpacity) > 0.15) {
          root.setAttribute("data-observed-highlight", selected.getAttribute("data-unit-id")!);
        }
      }
      requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => Number(await page.locator("[data-plan-proof]").getAttribute("data-observed-zoom")),
    { intervals: [16, 33, 50] })
    .toBeGreaterThan(1.1);
  await expect(page.locator("[data-plan-proof]")).toHaveAttribute("data-observed-highlight", "H 2.1");
  await page.screenshot({ path: `${shots}/${info.project.name}-L02-selection-zoom.png`, scale: "css" });
  await expect(details(page).getByRole("heading", { name: "H 2.1" })).toBeFocused();
  await expect(drawing(page)).toHaveJSProperty("complete", true);
  await page.screenshot({ path: `${shots}/${info.project.name}-L02-H-2.1.png`, scale: "css" });
  await page.goBack();
  await expect(card).toBeFocused();
  await page.goForward();
  await expect(details(page).getByRole("heading", { name: "H 2.1" })).toBeFocused();
  await page.reload();
  await expect(details(page)).toBeVisible();
  await back(page).click();
  await page.getByRole("link", { name: "Natrag na pročelje" }).click();
  await expect(page.getByRole("button", { name: "Etaža 2", exact: true })).toHaveAttribute("aria-pressed", "true");
});

for (const [floor, variant, unit] of [
  ["L00", "", "H 0.14"], ["L01", "", "H 1.16"], ["L03", "", "H 3.18"],
  ["L04", "", "H 4.20"], ["L04", "&plan=gallery", "H 4.5"],
]) {
  test(`${unit} · source detail composition`, async ({ page }, info) => {
    await page.goto(`${route}?floor=${floor}${variant}&unit=${encodeURIComponent(unit)}`);
    await expect(drawing(page)).toBeVisible();
    await expect.poll(() => drawing(page).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Pošalji upit za stan" })).toHaveAttribute(
      "href", "https://www.sigma.hr/upit-za-stan/",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await page.screenshot({ path: `${shots}/${info.project.name}-${unit.replace(" ", "-")}.png`, scale: "css" });
    if (unit === "H 0.14" || unit === "H 4.5") {
      await details(page).getByRole("region", { name: "Prostori i površine" })
        .screenshot({ path: `${shots}/${info.project.name}-${unit.replace(" ", "-")}-schedule.png`, scale: "css" });
    }
    if (unit === "H 4.5") {
      await page.getByRole("link", { name: "Glavni tlocrt" }).click();
      await expect(details(page).getByRole("heading", { name: unit, exact: true })).toBeVisible();
      await page.goBack();
      await back(page).click();
      await expect(page).toHaveURL(/floor=L04&plan=gallery$/);
    }
  });
}

test("plan controls zoom, pan and reset on a narrow or wide viewport", async ({ page, hasTouch }, info) => {
  await page.goto(`${route}?floor=L04&unit=H+4.5`);
  const view = page.getByRole("region", { name: "Interaktivni tlocrt stana" });
  const img = drawing(page);
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const frame = (await view.boundingBox())!;
  const initial = (await img.boundingBox())!;
  expect(initial.height / initial.width).toBeCloseTo(await img.evaluate((el: HTMLImageElement) => el.naturalHeight / el.naturalWidth), 2);
  expect(initial.width).toBeLessThanOrEqual(frame.width);
  expect(initial.height).toBeLessThanOrEqual(frame.height);
  const reset = page.getByRole("button", { name: "Vrati cijeli tlocrt" });
  if (hasTouch) {
    const session = await page.context().newCDPSession(page);
    const cx = frame.x + frame.width / 2;
    const cy = frame.y + frame.height / 2;
    const fingers = (span: number) => [{ x: cx - span, y: cy, id: 1 }, { x: cx + span, y: cy, id: 2 }];
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingers(33) });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: fingers(48) });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: fingers(75) });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => Number(await view.getAttribute("data-zoom"))).toBeGreaterThan(1.25);
    await reset.click();
    await expect.poll(async () => Math.abs((await img.boundingBox())!.width - initial.width)).toBeLessThan(1);
    await session.detach();
  }
  const plus = page.getByRole("button", { name: "Povećaj tlocrt" });
  for (let i = 0; i < 4; i++) await plus.click();
  await expect(view).toHaveAttribute("data-zoom", "4");
  await expect.poll(async () => Math.round((await img.boundingBox())!.width / initial.width)).toBe(4);
  await view.focus();
  const zoomed = (await img.boundingBox())!;
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => (await img.boundingBox())!.y).toBeLessThan(zoomed.y - 15);
  if (!hasTouch) {
    await expect.poll(async () => (await img.boundingBox())!.y).toBeLessThan(zoomed.y - 50);
    const before = (await img.boundingBox())!;
    const box = (await view.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await img.boundingBox())!.y).toBeGreaterThan(before.y + 30);
  }
  await page.screenshot({ path: `${shots}/${info.project.name}-H-4.5-zoomed.png`, scale: "css" });
  await reset.click();
  await expect(view).toHaveAttribute("data-zoom", "1");
  await expect.poll(async () => Math.abs((await img.boundingBox())!.width - initial.width)).toBeLessThan(1);
});

test("invalid or missing art does not substitute another unit, and private originals aren't served", async ({ page, request }) => {
  const media = `${route}/unit-media/H-0.1.webp`;
  expect((await request.get(media)).ok()).toBe(true);
  expect((await request.get(media, { headers: { "sec-fetch-site": "cross-site" } })).status()).toBe(404);
  expect((await request.get(`${route}/unit-media/H-0.1.pdf`)).status()).toBe(404);
  expect((await request.get(`${route}/unit-media/H-0.99.webp`)).status()).toBe(404);
  await page.route("**/unit-media/*.webp", intercepted => intercepted.abort());
  await page.goto(`${route}?floor=L00&unit=H+4.1`);
  await expect(details(page)).toHaveCount(0);
  await expect(page.getByText("Stan iz poveznice nije na ovoj etaži.")).toBeVisible();
  await page.getByRole("navigation", { name: "Stanovi na etaži" }).getByRole("link", { name: /^H 0\.1(?:\s|$)/ }).click();
  await expect(page.getByText("Pojedinačni tlocrt nije dostupan.")).toBeVisible();
  await expect(details(page).locator("[data-listing-area]")).toHaveText("56,41 m²");
  await back(page).click();
  await expect(page).toHaveURL(/floor=L00$/);
});

test("apartment cards expose their visible text as the link name", async ({ page }) => {
  await page.goto(`${route}?floor=L02`);
  const cards = page.getByRole("navigation", { name: "Stanovi na etaži" });
  const firstUnit = cards.getByRole("link", { name: /^H 2\.1(?:\s|$)/ });
  await expect(firstUnit).toHaveAccessibleName("H 2.1 Trosoban 56,16 m²");
  await firstUnit.focus();
  await page.keyboard.press("Enter");
  await expect(details(page).getByRole("heading", { name: "H 2.1", exact: true })).toBeFocused();
});

test("browser history can interrupt a gallery zoom without leaving stale art or selection", async ({ page }) => {
  await page.goto(`${route}?floor=L04&plan=gallery`);
  const root = page.locator("[data-plan-proof]");
  const map = page.locator("svg[data-unit-map]");
  await expect(map).toBeVisible();
  const initialWidth = await page.locator("[data-plan-image]").evaluate(image => image.getBoundingClientRect().width);
  const card = page.getByRole("navigation", { name: "Stanovi na etaži" })
    .getByRole("link", { name: /^H 4\.5(?:\s|$)/ });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-phase", "zoom");
  await page.goBack();
  await expect(page).toHaveURL(/floor=L04&plan=gallery$/);
  await expect(root).toHaveAttribute("data-phase", "floor");
  await expect(root).toHaveAttribute("data-image-id", "L04-gallery");
  await expect(map.getByRole("link", { name: "Stan H 4.5" })).not.toHaveAttribute("aria-current", "true");
  await expect.poll(() => page.locator("[data-plan-image]").evaluate(image => image.getBoundingClientRect().width))
    .toBeCloseTo(initialWidth);
  await page.goForward();
  await expect(details(page).getByRole("heading", { name: "H 4.5", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/floor=L04&plan=gallery&unit=H\+4\.5$/);
});

test("explicit return retraces the registered gallery footprint and respects a live motion preference", async ({ page }, info) => {
  await page.goto(`${route}?floor=L04&plan=gallery`);
  const root = page.locator("[data-plan-proof]");
  const photo = page.locator("[data-plan-image]");
  const map = page.locator("svg[data-unit-map]");
  await expect(map).toBeVisible();
  const frameWidth = await photo.evaluate(image => image.getBoundingClientRect().width);
  const card = page.getByRole("navigation", { name: "Stanovi na etaži" })
    .getByRole("link", { name: /^H 4\.5(?:\s|$)/ });
  await card.press("Enter");
  await expect(details(page).getByRole("heading", { name: "H 4.5", exact: true })).toBeFocused();
  const returnFrame = await root.evaluateHandle(root => {
    const sample = { unit: null as string | null, current: false, width: 0 };
    const observer = new MutationObserver(() => {
      if (root.getAttribute("data-phase") !== "return") return;
      sample.unit = root.querySelector("[data-motion-highlight] polygon")?.getAttribute("data-unit-id") ?? null;
      sample.current = !!root.querySelector("[data-unit-map] [aria-current]");
      sample.width = root.querySelector("[data-plan-image]")?.getBoundingClientRect().width ?? 0;
      observer.disconnect();
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-phase"] });
    return sample;
  });
  await back(page).click();
  await expect(page).toHaveURL(/floor=L04&plan=gallery$/);
  await expect.poll(async () => (await returnFrame.jsonValue()).unit).toBe("H 4.5");
  const frame = await returnFrame.jsonValue();
  expect(frame.current).toBe(false);
  expect(frame.width).toBeGreaterThan(frameWidth * 1.1);
  if (await root.getAttribute("data-phase") === "return") {
    await page.screenshot({ path: `${shots}/${info.project.name}-L04-gallery-return.png`, scale: "css" });
  }
  await expect(root).toHaveAttribute("data-phase", "floor");
  await expect(card).toBeFocused();
  await expect(photo.locator("..")).toHaveCSS("transform", "none");

  await card.press("Enter");
  await expect(details(page).getByRole("heading", { name: "H 4.5", exact: true })).toBeFocused();
  await back(page).click();
  await expect(root).toHaveAttribute("data-phase", "return");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(card).toBeFocused();
  await expect(photo.locator("..")).toHaveCSS("transform", "none");
  await expect(page).toHaveURL(/floor=L04&plan=gallery$/);
});

test("keyboard zoom keeps focus at the limit and announces the value", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${route}?floor=L04&unit=H+4.5`);
  const viewport = page.getByRole("region", { name: "Interaktivni tlocrt stana" });
  await viewport.focus();
  await page.keyboard.press("Tab");
  const plus = page.getByRole("button", { name: "Povećaj tlocrt" });
  await expect(plus).toBeFocused();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Enter");
  await expect(plus).toBeFocused();
  await expect(plus).toBeDisabled();
  await expect(viewport).toHaveAttribute("data-zoom", "4");
  await expect(page.getByRole("group", { name: "Kontrole tlocrta" }).locator("[aria-live]"))
    .toHaveText("Povećanje tlocrta: 400%");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Vrati cijeli tlocrt" })).toBeFocused();
});

test("an oversized native footprint fits both motion endpoints on a phone", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "The native footprint only exceeds the portrait aperture.");
  await page.goto(`${route}?floor=L00`);
  await page.getByRole("button", { name: "Izvorna veličina" }).click();
  const root = page.locator("[data-plan-proof]");
  await page.locator("svg[data-unit-map][data-ready='true']").waitFor();
  const card = page.getByRole("navigation", { name: "Stanovi na etaži" })
    .getByRole("link", { name: /^H 0\.4(?:\s|$)/ });
  const samples = await root.evaluateHandle(root => {
    const viewport = root.querySelector<HTMLElement>("[data-plan-scroll]")!;
    const polygon = root.querySelector<SVGPolygonElement>("[data-unit-id='H 0.4']")!;
    const results = { zoom: false, return: false };
    const sample = () => {
      const phase = root.getAttribute("data-phase");
      if (phase === "zoom" || phase === "return") {
        const frame = viewport.getBoundingClientRect();
        const box = polygon.getBoundingClientRect();
        const centerError = Math.abs((box.left + box.right) / 2 - (frame.left + viewport.clientWidth / 2));
        const safelyInside = box.left >= frame.left + 10 && box.right <= frame.left + viewport.clientWidth - 10;
        if (centerError <= 3 && safelyInside) results[phase] = true;
      }
      if (!results.zoom || !results.return) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    return results;
  });
  await card.press("Enter");
  await expect(details(page).getByRole("heading", { name: "H 0.4", exact: true })).toBeFocused();
  expect((await samples.jsonValue()).zoom).toBe(true);
  await back(page).press("Enter");
  await expect.poll(async () => (await samples.jsonValue()).return).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(card).toBeFocused();
  await expect(root).toHaveAttribute("data-phase", "floor");
  await expect(page.locator("[data-plan-image]").locator("..")).toHaveCSS("transform", "none");
  await expect(page).toHaveURL(/floor=L00$/);
});

test("apartment and its original-document links remain readable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${route}?floor=L03`);
    await page.getByRole("navigation", { name: "Stanovi na etaži" }).getByRole("link", { name: "H 3.18" }).click();
    await expect(details(page).getByRole("heading", { name: "H 3.18" })).toBeVisible();
    await expect(drawing(page)).toBeVisible();
    await expect(details(page).getByText("40,72 m²", { exact: true })).toBeVisible();
    await expect(details(page).getByRole("link", { name: "Preuzimanje na Sigmi" })).toBeVisible();
    await back(page).click();
    await expect(page).toHaveURL(/floor=L03$/);
    await page.getByRole("navigation", { name: "Stanovi na etaži" }).getByRole("link", { name: "H 3.18" }).click();
    const facade = details(page).getByRole("link", { name: "Pročelje zgrade H", exact: true });
    await expect(facade.locator("img")).toHaveCount(0);
    await facade.press("Enter");
    await expect(page).toHaveURL(/exterior-preview\?floor=L03$/);
  } finally {
    await context.close();
  }
});
