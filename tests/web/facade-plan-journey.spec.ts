import { expect, test, type Page } from "@playwright/test";
import { readPlanWitnesses, readTestFloors } from "./private-preview-fixtures";

const { floors } = readTestFloors();
const interactivePlans = "http://127.0.0.1:3103/exterior-preview/plans";
const approach = "/plan-review";
const facade = `${approach}?view=facade`;
const fromReview = (floor: string, view: "facade" | "arrival" = "facade") =>
  `${interactivePlans}?floor=${floor}&via=review-${view}`;

type Step = { phase: string; moving: boolean; planSrc: string | null; planWidth: number; scale: number };

async function observeFlight(page: Page) {
  const steps: Step[] = [];
  await page.exposeFunction("recordPlanFlight", (step: Step) => { steps.push(step); });
  await page.evaluate(() => {
    const scene = document.getElementById("scene")!;
    const stage = document.getElementById("transformStage")!;
    const record = (window as Window & { recordPlanFlight?: (step: Step) => void }).recordPlanFlight;
    if (!record) throw new Error("Missing test flight observer");
    new MutationObserver(() => {
      const phase = scene.dataset.planFlight;
      if (!phase) return;
      const plan = scene.querySelector<HTMLImageElement>("#planReveal img");
      record({
        phase, moving: stage.dataset.moving === "true",
        planSrc: plan?.getAttribute("src") ?? null, planWidth: plan?.naturalWidth ?? 0,
        scale: new DOMMatrixReadOnly(getComputedStyle(stage).transform).a,
      });
    }).observe(scene, { attributes: true, attributeFilter: ["data-plan-flight"] });
  });
  return steps;
}

test("Prilaz has the floor selector and no duplicate Pregled tab", async ({ page, baseURL, hasTouch }) => {
  await page.goto(facade);
  const views = page.getByRole("navigation", { name: "Pogled na zgradu" });
  await expect(views.getByRole("link")).toHaveCount(2);
  await expect(views.getByRole("link", { name: "Pregled", exact: true })).toHaveCount(0);
  const arrival = views.getByRole("link", { name: "Prilaz", exact: true });
  if (hasTouch) await arrival.tap();
  else await arrival.press("Enter");
  await expect(page).toHaveURL(`${baseURL}${approach}`);
  await expect(page.locator("#scene")).toHaveAttribute("data-image", "arrival");
  await expect(page.locator("#overlaySvg")).toBeHidden();
  const chooser = page.getByRole("list", { name: "Popis etaža" });
  await expect(page.getByRole("heading", { name: "Odaberite etažu", exact: true })).toBeVisible();
  await expect(chooser.getByRole("link")).toHaveCount(floors.length);
  for (const floor of floors) {
    await expect(chooser.getByRole("link", { name: floor.label, exact: true }))
      .toHaveAttribute("href", fromReview(floor.floor_id, "arrival"));
  }
  const flight = await observeFlight(page);
  const floor = chooser.getByRole("link", { name: "Etaža 2", exact: true });
  if (hasTouch) await floor.tap();
  else await floor.press("Enter");
  await expect(page).toHaveURL(fromReview("L02", "arrival"));
  await expect(page.locator("[data-unit-map]")).toHaveAttribute("data-ready", "true");
  expect(flight).toEqual([expect.objectContaining({ phase: "plan-reveal", moving: false })]);
  await page.getByRole("link", { name: "Natrag na prilaz" }).click();
  await expect(page).toHaveURL(`${baseURL}/plan-review`);
  await expect(chooser).toBeVisible();
  await chooser.getByRole("link", { name: "Etaža 4", exact: true }).click();
  await expect(page).toHaveURL(fromReview("L04", "arrival"));
  await page.getByRole("link", { name: "Galerija", exact: true }).click();
  await expect(page).toHaveURL(`${interactivePlans}?floor=L04&plan=gallery&via=review-arrival`);
  await page.getByRole("navigation", { name: "Stanovi na etaži" }).getByRole("link", { name: /^H 4\.5(?:\s|$)/ }).click();
  await expect(page.getByRole("heading", { name: "H 4.5", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Natrag na etažu" }).click();
  await expect(page).toHaveURL(`${interactivePlans}?floor=L04&plan=gallery&via=review-arrival`);
  await page.getByRole("link", { name: "Natrag na prilaz" }).click();
  await expect(page).toHaveURL(`${baseURL}/plan-review`);
  await expect(chooser.getByRole("link")).toHaveCount(floors.length);
});

test("an older Pregled floor-plan URL still returns to the current Prilaz chooser", async ({ page, baseURL }) => {
  await page.goto(`${interactivePlans}?floor=L02&via=review-overview`);
  await page.getByRole("link", { name: "Natrag na prilaz" }).click();
  await expect(page).toHaveURL(`${baseURL}${approach}`);
  await expect(page.locator("#overlaySvg")).toBeHidden();
  await expect(page.getByRole("list", { name: "Popis etaža" }).getByRole("link")).toHaveCount(floors.length);
});

for (const { view, path, back } of [
  { view: "facade", path: facade, back: "Natrag na pročelje" },
  { view: "arrival", path: approach, back: "Natrag na prilaz" },
] as const) for (const floor of floors) {
  test(`${view}: ${floor.label} opens its exact plan`, async ({ page, hasTouch, baseURL }, info) => {
    const issues: string[] = [];
    page.on("pageerror", error => issues.push(error.message));
    await page.goto(path);
    const overlay = page.locator("#overlaySvg");
    const stage = page.locator("#transformStage");
    if (view === "facade") await expect(overlay).toBeVisible();
    else await expect(overlay).toBeHidden();
    await expect(page.locator("#scene")).toHaveAttribute("data-image", view);
    await expect(stage).toHaveAttribute("data-moving", "false");
    const flight = await observeFlight(page);

    const target = overlay.locator(`[data-band-id="${floor.floor_id}"]`);
    if (view === "arrival" || floor.floor_id === "L00") {
      if (floor.floor_id === "L00") await expect(target).toHaveCount(0);
      const option = page.getByRole("link", { name: floor.label, exact: true });
      if (hasTouch) await option.tap();
      else await option.click();
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

    const url = fromReview(floor.floor_id, view);
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: floor.label, exact: true })).toBeVisible();
    await expect(page.locator("[data-plan-proof]")).toHaveAttribute("data-image-id", floor.floor_id);
    const map = page.locator("[data-unit-map]");
    await expect(map).toHaveAttribute("data-ready", "true");
    await expect(map.locator("polygon")).toHaveCount(floor.unit_ids.length);
    const reveal = {
      phase: "plan-reveal", planSrc: `/assets/plan-${floor.floor_id}.webp`,
      planWidth: floor.plans[0].width_px,
    };
    if (view === "arrival" || floor.floor_id === "L00") {
      expect(flight).toEqual([expect.objectContaining({ ...reveal, moving: false })]);
    } else {
      expect(flight).toEqual([
        expect.objectContaining({ phase: "facade-zoom", moving: true }),
        expect.objectContaining(reveal),
      ]);
      expect(flight[1].scale).toBeGreaterThan(flight[0].scale);
    }

    if (view === "facade" && floor.floor_id === "L03") {
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
    if (floor.floor_id === "L01") await page.getByRole("link", { name: back }).click();
    else await page.goBack();
    await expect(page).toHaveURL(`${baseURL}${path}`);
    if (view === "facade") await expect(overlay).toBeVisible();
    else await expect(overlay).toBeHidden();
    await expect(page.locator("#planReveal")).toBeHidden();
    if (floor.floor_id === "L01") {
      if (view === "facade") await page.getByRole("button", { name: /^Etaža 2 —/ }).press("Enter");
      else await page.getByRole("link", { name: "Etaža 2", exact: true }).press("Enter");
      await expect(page).toHaveURL(fromReview("L02", view));
    }
    expect(issues).toEqual([]);
  });
}

test("reduced motion opens the plan without requesting the animation image", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animationImages: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/assets/plan-")) animationImages.push(request.url());
  });
  await page.goto(facade);
  await page.getByRole("button", { name: /^Etaža 2 —/ }).press("Enter");
  await expect(page).toHaveURL(fromReview("L02"));
  await expect(page.locator("[data-unit-map]")).toHaveAttribute("data-ready", "true");
  expect(animationImages).toEqual([]);
});

test("the original floor link still works if the animation image cannot load", async ({ page }) => {
  await page.route("**/assets/plan-L02.webp", request => request.abort());
  await page.goto(facade);
  await page.getByRole("link", { name: "Etaža 2", exact: true }).press("Enter");
  await expect(page).toHaveURL(fromReview("L02"));
  await expect(page.locator("[data-unit-map]")).toHaveAttribute("data-ready", "true");
});
