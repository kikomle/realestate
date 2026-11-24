import { expect, test, type Page } from "@playwright/test";
import { readPlanWitnesses, readTestFloors } from "./private-preview-fixtures";

const manifest = readTestFloors();
const exterior = "/exterior-preview";
const route = `${exterior}/plans`;
const shots = `${process.env.MOCIRE_QA_CAPTURE_ROOT ?? "reports/qa/stage2/private"}/stage4-plan-proof`;
const polygons = (page: Page) => page.locator("svg[data-unit-map] polygon");

for (const floor of manifest.floors) {
  for (const plan of floor.plans) {
    test(`${plan.image_id}: source hit tests, select and restore the actual apartment ID`, async ({ page, hasTouch }, info) => {
      const errors: string[] = [];
      const unexpected: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", event => { if (event.type() === "error") errors.push(event.text()); });
      page.on("response", res => {
        if (res.status() >= 400 || /\/models\/|\.glb(?:\?|$)|\/floorplans\/|\/overlays\//.test(res.url())) unexpected.push(res.url());
      });
      await page.goto(`${route}?floor=${floor.floor_id}${plan.variant === "gallery" ? "&plan=gallery" : ""}`);
      await expect(page.getByRole("heading", { name: floor.label, exact: true })).toBeVisible();
      await expect(page.locator("[data-plan-proof]")).toHaveAttribute("data-image-id", plan.image_id);
      const photo = page.locator("[data-plan-image]");
      await expect.poll(() => photo.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]))
        .toEqual([plan.width_px, plan.height_px]);
      await expect(polygons(page)).toHaveCount(floor.unit_ids.length);
      await expect(page.getByRole("navigation", { name: "Stanovi na etaži" }).getByRole("link")).toHaveCount(floor.unit_ids.length);
      await expect(page.locator("svg[data-unit-map]")).toHaveAttribute("viewBox", plan.viewBox);

      if (hasTouch) {
        await expect.poll(() => page.locator("[data-plan-scroll]").evaluate(el => el.scrollWidth - el.clientWidth))
          .toBeGreaterThan(400);
        await page.screenshot({ path: `${shots}/${info.project.name}-${plan.image_id}-reading.png`, scale: "css" });
        await page.getByRole("button", { name: "Cijeli tlocrt" }).tap();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
      await page.locator("svg[data-unit-map]").scrollIntoViewIfNeeded();

      // These checks use independent source witnesses, not centres computed from the polygons.
      const { points } = (await readPlanWitnesses()).find(row => row.id === plan.image_id)!;
      const observed = await page.locator("svg[data-unit-map]").evaluate((svg: SVGSVGElement, { points }) => {
        const matrix = svg.getScreenCTM()!;
        const art = svg.parentElement!.querySelector("img")!.getBoundingClientRect();
        function at(x: number, y: number) {
          const point = new DOMPoint(x, y).matrixTransform(matrix);
          return document.elementFromPoint(point.x, point.y)?.getAttribute("data-unit-id") ?? null;
        }
        return {
          drift: Math.max(Math.abs(matrix.e - art.left), Math.abs(matrix.f - art.top),
            Math.abs(matrix.a * svg.viewBox.baseVal.width - art.width),
            Math.abs(matrix.d * svg.viewBox.baseVal.height - art.height)),
          ids: points.map(([, x, y]) => at(x, y)),
          first: new DOMPoint(points[0][1], points[0][2]).matrixTransform(matrix).toJSON(),
        };
      }, { points });
      expect(observed.drift).toBeLessThan(0.8);
      expect(observed.ids).toEqual(points.map(([id]) => id));
      const id = points[0][0]!;
      const target = polygons(page).and(page.locator(`[data-unit-id="${id}"]`));
      if (hasTouch) {
        await page.touchscreen.tap(observed.first.x, observed.first.y);
      } else {
        await page.mouse.move(observed.first.x, observed.first.y);
        const normal = await polygons(page).last().evaluate(el => getComputedStyle(el).fillOpacity);
        await expect.poll(() => target.evaluate(el => getComputedStyle(el).fillOpacity)).not.toBe(normal);
        const emphasized = await polygons(page).evaluateAll((els, normal) =>
          els.filter(el => getComputedStyle(el).fillOpacity !== normal).map(el => el.getAttribute("data-unit-id")), normal);
        expect(emphasized).toEqual([id]);
        await page.mouse.click(observed.first.x, observed.first.y);
      }
      await expect(page.getByRole("status")).toHaveText(`Odabran stan: ${id}`);
      await expect(target.locator("..")).toHaveAttribute("aria-current", "true");
      expect(new URL(page.url()).searchParams.get("unit")).toBe(id);
      await page.screenshot({ path: `${shots}/${info.project.name}-${plan.image_id}-selected.png`, scale: "css" });
      await page.goBack();
      await expect(page.getByRole("status")).toHaveText("Nijedan stan nije odabran.");
      await page.goForward();
      await expect(page.getByRole("status")).toHaveText(`Odabran stan: ${id}`);
      await page.reload();
      await expect(page.getByRole("status")).toHaveText(`Odabran stan: ${id}`);
      expect(errors).toEqual([]);
      expect(unexpected).toEqual([]);
    });
  }
}

test("exterior list → private drawing → keyboard unit selection → floor switch → return", async ({ page }, info) => {
  await page.goto(exterior);
  await page.getByRole("button", { name: "Izdvoji zgradu" }).click();
  await page.getByRole("button", { name: "Etaža 2", exact: true }).click();
  await expect(page.locator("[data-exterior-explorer]")).toHaveAttribute("data-handoff", "blocked");
  await expect(page.locator("[data-band-id]")).toHaveCount(0);
  const proof = page.getByRole("link", { name: "Provjeri tlocrt" });
  await expect(proof).toBeVisible();
  await page.screenshot({ path: `${shots}/${info.project.name}-exterior-blocked.png`, scale: "css" });
  await proof.click();
  await expect(page).toHaveURL(/\/plans\?floor=L02$/);
  const units = page.getByRole("navigation", { name: "Stanovi na etaži" });
  await units.getByRole("link", { name: /^H 2\.1(?:\s|$)/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Odabran stan: H 2.1");
  await page.getByRole("navigation", { name: "Putanja" }).getByRole("link", { name: "Etaža 2" }).click();
  await expect(page.getByRole("status")).toHaveText("Nijedan stan nije odabran.");
  await page.getByRole("navigation", { name: "Promijeni etažu" }).getByRole("link", { name: "Etaža 4" }).click();
  await units.getByRole("link", { name: /^H 4\.5(?:\s|$)/ }).click();
  await page.getByRole("link", { name: "Galerija" }).click();
  await expect(page.locator("[data-plan-proof]")).toHaveAttribute("data-image-id", "L04-gallery");
  await expect(page.getByRole("status")).toHaveText("Odabran stan: H 4.5");
  await page.goBack();
  await expect(page.locator("[data-plan-proof]")).toHaveAttribute("data-image-id", "L04");
  await expect(page.getByRole("heading", { name: "H 4.5", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Natrag na etažu" }).click();
  await expect(page.getByRole("status")).toHaveText("Nijedan stan nije odabran.");
  await page.getByRole("link", { name: "Natrag na pročelje" }).click();
  await expect(page).toHaveURL(/\/exterior-preview\?floor=L04$/);
  await expect(page.getByRole("button", { name: "Etaža 4" })).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(page).toHaveURL(/\/plans\?floor=L04$/);
  await expect(page.locator("[data-plan-proof]")).toHaveAttribute("data-image-id", "L04");
});

test("rejects invalid addresses and preserves text controls when imagery fails", async ({ page, request }) => {
  expect((await request.get(`${route}?floor=L99`)).status()).toBe(404);
  expect((await request.get(`${route}?floor=L00&plan=gallery`)).status()).toBe(404);
  expect((await request.get(`${route}?floor=L00&floor=L01`)).status()).toBe(404);
  await page.route("**/plans/media/*.webp", request => request.abort());
  await page.goto(`${route}?floor=L00&unit=H+4.1`);
  await expect(page.getByText("Stan iz poveznice nije na ovoj etaži.")).toBeVisible();
  await expect(page.getByText("Slika tlocrta nije dostupna. Odaberite stan s popisa.")).toBeVisible();
  await expect(page.locator("svg[data-unit-map]")).toBeHidden();
  await page.getByRole("navigation", { name: "Stanovi na etaži" }).getByRole("link", { name: /^H 0\.1(?:\s|$)/ }).click();
  await expect(page.getByRole("status")).toHaveText("Odabran stan: H 0.1");
});

test("does not serve originals, raw geometry or cross-site drawing requests", async ({ request }) => {
  const media = `${route}/media`;
  const response = await request.get(`${media}/L00.webp`);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/webp");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect((await request.get(`${media}/L00.webp`, { headers: { "sec-fetch-site": "cross-site" } })).status()).toBe(404);
  expect((await request.get(`${route}?floor=L00`, { headers: { "sec-fetch-site": "cross-site" } })).status()).toBe(404);
  expect((await request.get(`${media}/L00.svg`)).status()).toBe(404);
  expect((await request.get(`${media}/L99.webp`)).status()).toBe(404);
  expect((await request.get(`${media}/Mocire-Zadar-H-Tlocrt-prizemlja.png`)).status()).toBe(404);
});

test("native drawing size stays sharp and pans without any overlay drift", async ({ page }, info) => {
  await page.goto(`${route}?floor=L02`);
  await page.getByRole("button", { name: "Izvorna veličina" }).click();
  const scroller = page.locator("[data-plan-scroll]");
  await expect(scroller).toHaveAttribute("data-size", "native");
  expect(await scroller.evaluate(el => el.scrollWidth)).toBe(1920);
  await scroller.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => scroller.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  const rectangles = await page.locator("svg[data-unit-map]").evaluate(svg =>
    [svg, svg.parentElement!.querySelector("img")!].map(el => {
      const { left, top, width, height } = el.getBoundingClientRect();
      return [left, top, width, height];
    }));
  expect(rectangles[0]).toEqual(rectangles[1]);
  await page.screenshot({ path: `${shots}/${info.project.name}-L02-native.png`, scale: "css" });
});

test("unit selection and floor switching also work without client scripts", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${route}?floor=L00`);
    await page.getByRole("navigation", { name: "Stanovi na etaži" }).getByRole("link", { name: /^H 0\.1(?:\s|$)/ }).click();
    await expect(page.getByRole("status")).toHaveText("Odabran stan: H 0.1");
    await page.getByRole("navigation", { name: "Promijeni etažu" }).getByRole("link", { name: "Etaža 1" }).click();
    await expect(page.getByRole("heading", { name: "Etaža 1", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
