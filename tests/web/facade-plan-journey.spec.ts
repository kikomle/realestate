import { expect, test } from "@playwright/test";
import { readPlanWitnesses, readTestFloors } from "./private-preview-fixtures";

const { floors } = readTestFloors();
const interactivePlans = "http://127.0.0.1:3103/exterior-preview/plans";
const facade = "/plan-review?view=facade";

test("Pregled in the private façade review offers direct floor links without placing bands on the angled image", async ({ page, baseURL, hasTouch }) => {
  await page.goto(facade);
  const overview = page.getByRole("link", { name: "Pregled", exact: true });
  if (hasTouch) await overview.tap();
  else await overview.press("Enter");
  await expect(page).toHaveURL(`${baseURL}/plan-review`);
  await expect(page.locator("#overlaySvg")).toBeHidden();
  const chooser = page.getByRole("list", { name: "Popis etaža" });
  await expect(chooser.getByRole("link")).toHaveCount(floors.length);
  for (const floor of floors) {
    await expect(chooser.getByRole("link", { name: floor.label, exact: true }))
      .toHaveAttribute("href", `${interactivePlans}?floor=${floor.floor_id}`);
  }
  const floor = chooser.getByRole("link", { name: "Etaža 2", exact: true });
  if (hasTouch) await floor.tap();
  else await floor.press("Enter");
  await expect(page).toHaveURL(`${interactivePlans}?floor=L02`);
  await expect(page.locator("[data-unit-map]")).toHaveAttribute("data-ready", "true");
  await page.goBack();
  await expect(page).toHaveURL(`${baseURL}/plan-review`);
  await expect(chooser).toBeVisible();
});

for (const floor of floors) {
  test(`${floor.label}: open the interactive plan from the private façade review`, async ({ page, hasTouch, baseURL }, info) => {
    const issues: string[] = [];
    page.on("pageerror", error => issues.push(error.message));
    await page.goto(facade);
    const overlay = page.locator("#overlaySvg");
    await expect(overlay).toBeVisible();
    await expect(page.locator("#transformStage")).toHaveAttribute("data-moving", "false");

    const target = overlay.locator(`[data-band-id="${floor.floor_id}"]`);
    if (floor.floor_id === "L00") {
      await expect(target).toHaveCount(0);
      const ground = page.getByRole("link", { name: "Prizemlje", exact: true });
      if (hasTouch) await ground.tap();
      else await ground.press("Enter");
    } else {
      const response = await page.request.get("/data/registration.json");
      expect(response.ok()).toBe(true);
      const bands = (await response.json()).floors as { floor_id: string; focus: [number, number] }[];
      const point = bands.find(band => band.floor_id === floor.floor_id)!.focus;
      const hit = await overlay.evaluate((svg: SVGSVGElement, [x, y]) => {
        const screen = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!);
        const band = document.elementFromPoint(screen.x, screen.y)?.closest("[data-band-id]");
        return { x: screen.x, y: screen.y, id: band?.getAttribute("data-band-id") };
      }, point);
      expect(hit.id).toBe(floor.floor_id);
      if (hasTouch) await page.touchscreen.tap(hit.x, hit.y);
      else await page.mouse.click(hit.x, hit.y);
    }

    const url = `${interactivePlans}?floor=${floor.floor_id}`;
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: floor.label, exact: true })).toBeVisible();
    await expect(page.locator("[data-plan-proof]")).toHaveAttribute("data-image-id", floor.floor_id);
    const map = page.locator("[data-unit-map]");
    await expect(map).toHaveAttribute("data-ready", "true");
    await expect(map.locator("polygon")).toHaveCount(floor.unit_ids.length);

    if (floor.floor_id === "L03") {
      const { points } = (await readPlanWitnesses()).find(plan => plan.id === floor.floor_id)!;
      const [unit, x, y] = points[0];
      if (!unit) throw new Error("The first L03 witness must be inside a unit.");
      if (hasTouch) await page.getByRole("button", { name: "Cijeli tlocrt" }).tap();
      await map.scrollIntoViewIfNeeded();
      const hit = await map.evaluate((svg: SVGSVGElement, [x, y]) => {
        const point = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!);
        return { x: point.x, y: point.y, unit: document.elementFromPoint(point.x, point.y)?.getAttribute("data-unit-id") };
      }, [x, y]);
      expect(hit.unit).toBe(unit);
      if (hasTouch) await page.touchscreen.tap(hit.x, hit.y);
      else await page.mouse.click(hit.x, hit.y);
      await expect(page.getByRole("heading", { name: unit, exact: true })).toBeVisible();
      const plan = page.locator("[data-apartment-image]");
      await expect(plan).toBeVisible();
      await expect.poll(() => plan.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: info.outputPath("selected-apartment.png"), scale: "css" });
      await page.goBack();
      await expect(page).toHaveURL(url);
    }
    await page.goBack();
    await expect(page).toHaveURL(`${baseURL}${facade}`);
    await expect(overlay).toBeVisible();
    expect(issues).toEqual([]);
  });
}
