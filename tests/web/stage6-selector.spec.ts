import { writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readTestApartments, readTestFloors } from "./private-preview-fixtures";

const { floors } = readTestFloors();
const apartments = readTestApartments();
const exterior = "/exterior-preview";
const plans = `${exterior}/plans`;
const floorPath = (id: string, variant = "main") => `${plans}?floor=${id}${variant === "gallery" ? "&plan=gallery" : ""}`;
const coldPath = (id: string, variant: string, unitId: string) =>
  `${floorPath(id, variant)}&unit=${encodeURIComponent(unitId)}`;
const detail = (page: Page) => page.locator("[data-apartment-detail]");
const floorView = (page: Page) => page.locator("[data-plan-proof]");
const exteriorView = (page: Page) => page.locator("[data-exterior-explorer]");
const exteriorImage = (page: Page) => page.locator("[data-exterior-viewport]");
const cards = (page: Page) => page.getByRole("navigation", { name: "Stanovi na etaži" });
const card = (page: Page, id: string) => cards(page).getByRole("link", { name: new RegExp(`^${id.replace(".", "\\.")}(?:\\s|$)`) });
const upToFloor = (page: Page) => page.getByRole("link", { name: "Natrag na etažu" });
const upToExterior = (page: Page) => page.getByRole("link", { name: "Natrag na pročelje" });
const pathIs = (path: string) => (url: URL) => `${url.pathname}${url.search}` === path;

function monitor(page: Page) {
  const issues: string[] = [];
  page.on("pageerror", error => issues.push(`pageerror: ${error.message}`));
  page.on("console", msg => { if (msg.type() === "error") issues.push(`console: ${msg.text()}`); });
  page.on("response", response => { if (response.status() >= 400) issues.push(`${response.status()}: ${response.url()}`); });
  page.on("request", request => {
    const { pathname } = new URL(request.url());
    if (/\/(?:models|floorplans|overlays|assets\/source)\/|\.glb$|registration\.json$|\/_next\/image$/.test(pathname)) {
      issues.push(`unexpected request: ${request.url()}`);
    }
  });
  return () => expect(issues).toEqual([]);
}

function pageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  return () => expect(errors).toEqual([]);
}

async function loaded(image: Locator) {
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
}

async function noFacadeTargets(page: Page) {
  await expect(exteriorView(page)).toHaveAttribute("data-handoff", "blocked");
  await expect(exteriorView(page).locator("[data-band-id], [data-overlay-group='exterior-floors'] polygon")).toHaveCount(0);
}

const sourceCases = apartments.units.flatMap(unit => {
  const floor = floors.find(row => row.floor_id === unit.floor_id);
  if (!floor) throw new Error(`Apartment ${unit.unit_id} has no source floor`);
  return floor.plans.map(plan => ({ unit, floor, plan }));
});

test("source matrix covers the five floors, 94 units and 21 gallery addresses", () => {
  expect(floors.map(floor => floor.floor_id)).toEqual(["L00", "L01", "L02", "L03", "L04"]);
  expect(new Set(apartments.units.map(unit => unit.unit_id)).size).toBe(94);
  for (const floor of floors) {
    expect(apartments.units.filter(unit => unit.floor_id === floor.floor_id).map(unit => unit.unit_id).sort())
      .toEqual([...floor.unit_ids].sort());
  }
  expect(sourceCases.filter(({ plan }) => plan.variant === "main")).toHaveLength(94);
  expect(sourceCases.filter(({ plan }) => plan.variant === "gallery")).toHaveLength(21);
  expect(new Set(sourceCases.map(({ unit, floor, plan }) => coldPath(floor.floor_id, plan.variant, unit.unit_id))).size).toBe(115);
});

for (const { unit, floor, plan } of sourceCases) {
  test(`cold ${plan.image_id} · ${unit.unit_id} resolves and returns to its exact drawing`, async ({ page }, info) => {
    const clean = monitor(page);
    const path = coldPath(floor.floor_id, plan.variant, unit.unit_id);
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page).toHaveURL(pathIs(path));
    await expect(detail(page).getByRole("heading", { name: unit.unit_id, exact: true })).toBeVisible();
    await expect(floorView(page)).toHaveAttribute("data-image-id", plan.image_id);
    await expect(floorView(page)).toHaveAttribute("data-phase", "apartment");
    await expect(detail(page).locator("[data-unit-floor]")).toHaveText(floor.label);
    await expect(detail(page).locator("[data-listing-area]")).toHaveText(`${unit.listing_area_raw} m²`);
    const image = page.locator("[data-apartment-image]");
    await expect(image).toHaveAttribute("src", `${plans}/unit-media/${unit.unit_id.replace(" ", "-")}.webp`);
    await loaded(image);
    await expect(page.locator("svg[data-unit-map] a[aria-current]"))
      .toHaveAccessibleName(`Stan ${unit.unit_id}`);
    await expect(card(page, unit.unit_id)).toHaveAttribute("aria-current", "true");

    if (unit.unit_id === "H 4.5" && plan.variant === "gallery") {
      await page.screenshot({ path: info.outputPath("cold-gallery-H-4.5.png"), scale: "css" });
    }
    const parent = floorPath(floor.floor_id, plan.variant);
    await expect(upToFloor(page)).toHaveAttribute("href", parent);
    await upToFloor(page).click();
    await expect(page).toHaveURL(pathIs(parent));
    await expect(detail(page)).toHaveCount(0);
    await expect(floorView(page)).toHaveAttribute("data-image-id", plan.image_id);
    await expect(upToExterior(page)).toHaveAttribute("href", `${exterior}?floor=${floor.floor_id}`);
    clean();
  });
}

test("Pregled links directly to each interactive floor and Back restores the overview", async ({ page, hasTouch }) => {
  test.setTimeout(60_000);
  const clean = monitor(page);
  await page.goto(`${exterior}?view=facade`);
  await page.getByRole("button", { name: "Pregled", exact: true }).click();
  await expect(page).toHaveURL(pathIs(exterior));
  const chooser = page.getByRole("navigation", { name: "Odabir etaže zgrade H" });
  await expect(chooser.getByRole("link")).toHaveCount(floors.length);
  await expect(page.locator("[data-band-id]")).toHaveCount(0);
  for (const floor of floors) {
    const option = chooser.getByRole("link", { name: floor.label, exact: true });
    await expect(option).toHaveAttribute("href", floorPath(floor.floor_id));
    if (hasTouch) await option.tap();
    else await option.press("Enter");
    await expect(page).toHaveURL(pathIs(floorPath(floor.floor_id)));
    await expect(floorView(page)).toHaveAttribute("data-image-id", floor.floor_id);
    await expect(cards(page).getByRole("link")).toHaveCount(floor.unit_ids.length);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(pathIs(exterior));
  }
  clean();
});

for (const floor of floors) {
  test(`exterior list ${floor.floor_id} · opens the correct plan and restores the selected floor`, async ({ page, hasTouch }, info) => {
    test.setTimeout(60_000);
    const clean = monitor(page);
    await page.goto(`${exterior}?view=facade`);
    const list = page.getByRole("navigation", { name: "Odabir etaže zgrade H" });
    await expect(list.getByRole("button")).toHaveCount(floors.length);
    const option = list.getByRole("button", { name: floor.label, exact: true });
    if (hasTouch) await option.tap();
    else await option.press("Space");

    const exteriorFloor = `${exterior}?floor=${floor.floor_id}`;
    await expect(page).toHaveURL(pathIs(exteriorFloor));
    await expect(option).toHaveAttribute("aria-pressed", "true");
    await noFacadeTargets(page);
    await expect(page.getByText("Oznake na pročelju nisu potvrđene", { exact: true })).toBeVisible();
    await expect(exteriorImage(page)).toHaveAttribute("data-asset-state", "ready");
    await expect(exteriorImage(page)).toHaveAttribute("data-displayed-view", "facade");
    if (floor.floor_id === "L02") {
      await page.screenshot({ path: info.outputPath("exterior-L02-list-only.png"), scale: "css" });
    }

    const entrance = page.getByRole("link", { name: "Provjeri tlocrt", exact: true });
    const floorURL = floorPath(floor.floor_id);
    await expect(entrance).toHaveAttribute("href", floorURL);
    await Promise.all([
      page.waitForURL(pathIs(floorURL), { waitUntil: "commit", timeout: 15_000 }),
      hasTouch ? entrance.tap() : entrance.press("Enter"),
    ]);
    await expect(page.getByRole("heading", { name: floor.label, exact: true, level: 1 })).toBeVisible();
    await expect(floorView(page)).toHaveAttribute("data-image-id", floor.floor_id);
    await expect(cards(page).getByRole("link")).toHaveCount(floor.unit_ids.length);
    await loaded(page.locator("[data-plan-image]"));
    if (floor.floor_id === "L02") {
      await page.screenshot({ path: info.outputPath("floor-L02.png"), scale: "css" });
    }

    // These anchors start full document navigations. The URL and selected
    // controls matter here; don't couple them to every image's load event.
    const back = upToExterior(page);
    await Promise.all([
      page.waitForURL(pathIs(exteriorFloor), { waitUntil: "commit", timeout: 15_000 }),
      hasTouch ? back.tap() : back.press("Enter"),
    ]);
    await expect(option).toHaveAttribute("aria-pressed", "true");
    await noFacadeTargets(page);
    await page.goBack({ waitUntil: "commit" });
    await page.waitForURL(pathIs(floorURL), { waitUntil: "commit", timeout: 15_000 });
    await expect(floorView(page)).toHaveAttribute("data-image-id", floor.floor_id);
    await page.goForward({ waitUntil: "commit" });
    await page.waitForURL(pathIs(exteriorFloor), { waitUntil: "commit", timeout: 15_000 });
    await expect(option).toHaveAttribute("aria-pressed", "true");
    clean();
  });
}

test("invalid routes do not substitute another unit or plan", async ({ page, request }) => {
  for (const suffix of ["", "?floor=L99", "?floor=L01&floor=L02", "?floor=L00&plan=gallery", "?floor=L04&plan=gallery&plan=main"]) {
    expect((await request.get(`${plans}${suffix}`)).status(), suffix).toBe(404);
  }
  for (const suffix of ["unit=H+0.1", "unit=H+4.5&unit=H+4.5", "unit=", "unit=h+4.5"]) {
    const path = `${floorPath("L04", "gallery")}&${suffix}`;
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page).toHaveURL(pathIs(path));
    await expect(detail(page)).toHaveCount(0);
    await expect(page.getByText("Stan iz poveznice nije na ovoj etaži.", { exact: true })).toBeVisible();
    await expect(cards(page).locator("[aria-current]")).toHaveCount(0);
    await page.getByRole("navigation", { name: "Putanja" }).getByRole("link", { name: "Etaža 4" }).click();
    await expect(page).toHaveURL(pathIs(floorPath("L04", "gallery")));
  }
  await page.goto(`${exterior}?floor=L99`);
  await expect(page).toHaveURL(pathIs(`${exterior}?floor=L99`));
  await expect(page.getByText(/Etaža iz poveznice nije pronađena/, { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Provjeri tlocrt" })).toHaveCount(0);
  await page.getByRole("button", { name: "Vrati se na pregled" }).click();
  await expect(page).toHaveURL(pathIs(exterior));
});

test("exterior, floor and unit list remain usable if all imagery and WebGL are unavailable", async ({ page }, info) => {
  const clean = pageErrors(page);
  await page.route("**/exterior-preview/**", intercepted =>
    intercepted.request().resourceType() === "image" ? intercepted.abort() : intercepted.continue());
  await page.goto(exterior);
  await expect(exteriorImage(page)).toHaveAttribute("data-asset-state", "error");
  expect(await page.evaluate(() => document.createElement("canvas").getContext("webgl") === null)).toBe(true);
  await expect(page.locator("[data-band-id]")).toHaveCount(0);
  await page.getByRole("link", { name: "Prizemlje", exact: true }).press("Enter");
  await expect(page.getByText("Slika tlocrta nije dostupna. Odaberite stan s popisa.")).toBeVisible();
  await expect(page.locator("svg[data-unit-map]")).toBeHidden();
  const unit = card(page, "H 0.1");
  await unit.press("Enter");
  await expect(detail(page).getByRole("heading", { name: "H 0.1", exact: true })).toBeFocused();
  await expect(detail(page).getByText("Pojedinačni tlocrt nije dostupan.")).toBeVisible();
  await expect(detail(page).getByRole("link", { name: "Otvori izvorni PDF" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("media-unavailable.png"), scale: "css" });
  await upToFloor(page).press("Enter");
  await expect(unit).toBeFocused();
  clean();
});

test("a loaded gallery can still open a text detail and return while offline", async ({ page, context }) => {
  const clean = pageErrors(page);
  await page.goto(floorPath("L04", "gallery"));
  await expect(page.locator("svg[data-unit-map]")).toHaveAttribute("data-ready", "true");
  await context.setOffline(true);
  try {
    await card(page, "H 4.5").press("Enter");
    await expect(detail(page).getByRole("heading", { name: "H 4.5", exact: true })).toBeVisible();
    await expect(detail(page).getByText("Pojedinačni tlocrt nije dostupan.")).toBeVisible();
    await expect(detail(page).getByRole("link", { name: "Otvori izvorni PDF" })).toHaveAttribute("href", /^https:\/\/www\.sigma\.hr\//);
    await upToFloor(page).press("Enter");
    await expect(page).toHaveURL(pathIs(floorPath("L04", "gallery")));
    await expect(detail(page)).toHaveCount(0);
    clean();
  } finally {
    await context.setOffline(false);
  }
});

test("reduced motion selection never enters the plan zoom phase and restores focus through history", async ({ page }) => {
  const clean = monitor(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(floorPath("L02"));
  await expect(page.locator("svg[data-unit-map]")).toHaveAttribute("data-ready", "true");
  const phaseLog = await floorView(page).evaluateHandle(el => {
    const phases: (string | null)[] = [];
    new MutationObserver(records => {
      phases.push(...records.map(record => record.oldValue), el.getAttribute("data-phase"));
    }).observe(el, { attributes: true, attributeFilter: ["data-phase"], attributeOldValue: true });
    return phases;
  });
  const unit = card(page, "H 2.1");
  const heading = detail(page).getByRole("heading", { name: "H 2.1", exact: true });
  await unit.press("Enter");
  await expect(heading).toBeFocused();
  await page.goBack();
  await expect(unit).toBeFocused();
  await page.goForward();
  await expect(heading).toBeFocused();
  const phases = await phaseLog.jsonValue();
  expect(phases).toContain("apartment");
  expect(phases).not.toContain("zoom");
  await phaseLog.dispose();
  clean();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("floor list, unit detail and gallery return use real links", async ({ page }) => {
    await page.goto(floorPath("L04", "gallery"));
    await card(page, "H 4.5").click();
    await expect(detail(page).getByRole("heading", { name: "H 4.5", exact: true })).toBeVisible();
    await expect(detail(page).getByRole("link", { name: "Otvori izvorni PDF" })).toBeVisible();
    await upToFloor(page).click();
    await expect(page).toHaveURL(pathIs(floorPath("L04", "gallery")));
  });
});

for (const [name, path, readyImage] of [
  ["arrival", exterior, "[data-exterior-image='arrival'] img"],
  ["floor", floorPath("L02"), "[data-plan-image]"],
  ["apartment", coldPath("L04", "gallery", "H 4.5"), "[data-apartment-image]"],
]) {
  test(`resource sample · ${name}`, async ({ page }, info) => {
    const clean = monitor(page);
    await page.goto(path);
    await loaded(page.locator(readyImage));
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
      const resources = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map(entry => ({
        path: new URL(entry.name).pathname,
        type: entry.initiatorType,
        encodedBytes: entry.encodedBodySize,
        transferBytes: entry.transferSize,
      }));
      const sum = (items: typeof resources) => ({
        count: items.length,
        encodedBytes: items.reduce((total, item) => total + item.encodedBytes, 0),
        transferBytes: items.reduce((total, item) => total + item.transferBytes, 0),
      });
      const images = resources.filter(item => item.type === "img" || /\.(?:avif|webp)$/.test(item.path));
      const scripts = resources.filter(item => item.path.endsWith(".js"));
      return {
        viewport: [innerWidth, innerHeight],
        dpr: devicePixelRatio,
        document: { encodedBytes: navigation.encodedBodySize, transferBytes: navigation.transferSize },
        fcpMs: fcp === null ? null : Math.round(fcp),
        loadMs: Math.round(navigation.loadEventEnd),
        resources: sum(resources),
        scripts: sum(scripts),
        images,
      };
    });
    const output = info.outputPath("resources.json");
    await writeFile(output, `${JSON.stringify({ name, project: info.project.name, ...metrics }, null, 2)}\n`);
    await info.attach("resource-sample", { path: output, contentType: "application/json" });
    clean();
  });
}
