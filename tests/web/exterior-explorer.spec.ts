import { expect, test, type Page } from "@playwright/test";

const route = "/exterior-preview";
const shots = `${process.env.MOCIRE_QA_CAPTURE_ROOT ?? "reports/qa/stage2/private"}/stage3-next`;
const explorer = (page: Page) => page.locator("[data-exterior-explorer]");
const camera = (page: Page) => page.locator('[data-exterior-layer][aria-hidden="false"] [data-camera-stage]');
const viewport = (page: Page) => page.locator("[data-exterior-viewport]");
const floor = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^${label}(,|$)`) });

async function assertImage(page: Page, view: "arrival" | "facade") {
  const photo = page.getByRole("img", { name: view === "arrival" ? /kosi pogled/i : /glavno pročelje/i });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const src = await photo.evaluate((img: HTMLImageElement) => img.currentSrc);
  expect(src).toMatch(new RegExp(`${view}-(960|1280|1920)\\.(avif|webp)$`));
}

async function assertContainedControls(page: Page, control = floor(page, "Prizemlje")) {
  const size = page.viewportSize()!;
  const box = (await control.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width + 1);
}

async function assertSharedFrame(page: Page) {
  const drift = await camera(page).evaluate(stage => {
    const image = stage.querySelector("img")!.getBoundingClientRect();
    const svg = stage.querySelector("svg")!;
    const outline = svg.getBoundingClientRect();
    const matrix = svg.getScreenCTM()!;
    return Math.max(...[
      image.left - outline.left, image.top - outline.top,
      image.right - outline.right, image.bottom - outline.bottom,
      image.left - matrix.e, image.top - matrix.f, matrix.a - matrix.d, matrix.b, matrix.c,
    ].map(Math.abs));
  });
  expect(drift).toBeLessThan(0.8);
}

async function readPose(page: Page) {
  return camera(page).evaluate(element => {
    const { m11, m41, m42 } = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return [m11, m41, m42];
  });
}

test("loads the Sigma renders, focuses the building and captures the private compositions", async ({ page }, info) => {
  const errors: string[] = [];
  const failed: string[] = [];
  const requests = new Set<string>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", event => { if (event.type() === "error") errors.push(event.text()); });
  page.on("response", res => {
    requests.add(res.url());
    if (res.status() >= 400) failed.push(res.url());
  });

  await page.goto(route);
  await expect(explorer(page)).toHaveAttribute("data-state", "OVERVIEW");
  await assertImage(page, "arrival");
  await expect(viewport(page)).toHaveAttribute("data-displayed-view", "arrival");
  await expect(viewport(page)).toHaveAttribute("data-moving", "false");
  const overviewTransform = await camera(page).getAttribute("style");
  await page.screenshot({ path: `${shots}/${info.project.name}-arrival.png`, scale: "css" });

  await page.getByRole("button", { name: "Izdvoji zgradu" }).click();
  await expect(page).toHaveURL(/\?view=facade$/);
  await expect(explorer(page)).toHaveAttribute("data-state", "BUILDING_FOCUS");
  await assertImage(page, "facade");
  await expect(viewport(page)).toHaveAttribute("data-displayed-view", "facade");
  await expect(viewport(page)).toHaveAttribute("data-moving", "false");
  expect(await camera(page).getAttribute("style")).not.toBe(overviewTransform);
  await assertContainedControls(page);
  await assertSharedFrame(page);
  await page.screenshot({ path: `${shots}/${info.project.name}-facade.png`, scale: "css" });

  await floor(page, "Etaža 2").click();
  await expect(explorer(page)).toHaveAttribute("data-handoff", "blocked");
  await expect(floor(page, "Etaža 2")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-band-id]")).toHaveCount(0);
  await page.screenshot({ path: `${shots}/${info.project.name}-selected.png`, scale: "css" });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect([...requests].filter(url => /\/models\/|\.glb(?:\?|$)|\/floorplans\//.test(url))).toEqual([]);
});

test("selects every sourced text-only floor, preserves history, and never fabricates a focus", async ({ page, hasTouch }) => {
  await page.goto(`${route}?view=facade`);
  await assertImage(page, "facade");
  await expect(viewport(page)).toHaveAttribute("data-displayed-view", "facade");
  await expect(viewport(page)).toHaveAttribute("data-moving", "false");
  const stableFraming = await camera(page).getAttribute("style");
  const buttons = ["Prizemlje", "Etaža 1", "Etaža 2", "Etaža 3", "Etaža 4"];
  for (const [index, label] of buttons.entries()) {
    const button = floor(page, label);
    if (hasTouch) await button.tap();
    else {
      await button.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page).toHaveURL(new RegExp(`\\?floor=L0${index}$`));
    await expect(explorer(page)).toHaveAttribute("data-state", "FLOOR_SELECTED");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(camera(page)).toHaveAttribute("data-moving", "false");
    expect(await camera(page).getAttribute("style")).toBe(stableFraming);
  }
  await page.goBack();
  await expect(floor(page, "Etaža 3")).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(floor(page, "Etaža 4")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(floor(page, "Etaža 4")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Vrati početni pogled" }).click();
  await expect(page).toHaveURL(/\?view=facade$/);
  await expect(explorer(page)).toHaveAttribute("data-state", "BUILDING_FOCUS");

  await page.getByRole("button", { name: "Cijeli prikaz" }).click();
  await expect(explorer(page)).toHaveAttribute("data-state", "OVERVIEW");
  await expect(viewport(page)).toHaveAttribute("data-displayed-view", "arrival");
  await page.goBack();
  await expect(explorer(page)).toHaveAttribute("data-state", "BUILDING_FOCUS");
  await expect(viewport(page)).toHaveAttribute("data-displayed-view", "facade");
});

test("recovers from an invalid floor and uses the allowlisted WebP fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/exterior-preview/media/*.avif", request => request.abort());
  await page.goto(`${route}?view=facade&floor=INVALID`);
  await expect(page).toHaveURL(/floor=INVALID$/);
  await expect(page.getByText("Etaža iz poveznice nije pronađena. Odaberite je s popisa ili se vratite na prilaz.", { exact: true })).toBeVisible();
  await assertImage(page, "facade");
  const image = page.getByRole("img", { name: /glavno pročelje/i });
  expect(await image.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\.webp$/);
  await floor(page, "Etaža 1").click();
  await expect(explorer(page)).toHaveAttribute("data-floor", "L01");
});

test("applies zoom synchronously when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${route}?view=facade`);
  await expect(viewport(page)).toHaveAttribute("data-displayed-view", "facade");
  await expect(viewport(page)).toHaveAttribute("data-asset-state", "ready");
  const outcome = await page.getByRole("button", { name: "Povećaj prikaz" }).evaluate(button => {
    const stage = document.querySelector<HTMLElement>('[data-camera-stage="facade"]')!;
    const before = stage.style.transform;
    (button as HTMLButtonElement).click();
    return { changed: stage.style.transform !== before, moving: stage.dataset.moving };
  });
  expect(outcome).toEqual({ changed: true, moving: "false" });
});

test("paints the real arrival and opens a floor without client scripts", async ({ browser, baseURL, viewport, hasTouch }, info) => {
  test.skip(!["desktop", "portrait"].includes(info.project.name), "The no-script journey is covered on desktop and touch portrait");
  const context = await browser.newContext({ baseURL, viewport, hasTouch, isMobile: hasTouch, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(route);
    await assertImage(page, "arrival");
    const chooser = page.getByRole("navigation", { name: "Odabir etaže zgrade H" });
    await expect(chooser.getByRole("link")).toHaveCount(5);
    await chooser.getByRole("link", { name: "Etaža 2" }).click();
    await expect(page).toHaveURL("/exterior-preview/plans?floor=L02&via=overview");
    await page.getByRole("navigation", { name: "Stanovi na etaži" })
      .getByRole("link", { name: /^H 2\.1(?:\s|$)/ }).click();
    await expect(page.getByRole("heading", { name: "H 2.1", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("keeps the floor list usable when both image formats are unavailable", async ({ page }) => {
  await page.route("**/exterior-preview/media/*", request => request.abort());
  await page.goto(`${route}?view=facade`);
  await expect(page.getByText(/prikaz nije dostupan|pročelje nije dostupno|slika nije dostupna/i)).toBeVisible();
  await floor(page, "Etaža 4").click();
  await expect(explorer(page)).toHaveAttribute("data-floor", "L04");
  await expect(explorer(page)).toHaveAttribute("data-handoff", "blocked");
});

test("interrupts camera motion, pans without changing floors, and resets after resize", async ({ page, hasTouch }) => {
  await page.goto(`${route}?view=facade`);
  await assertImage(page, "facade");
  await expect(viewport(page)).toHaveAttribute("data-displayed-view", "facade");
  await expect(viewport(page)).toHaveAttribute("data-moving", "false");
  const rest = await readPose(page);
  const zoom = page.getByRole("button", { name: "Povećaj prikaz" });
  const reset = page.getByRole("button", { name: "Vrati početni pogled" });
  await zoom.click();
  await expect(camera(page)).toHaveAttribute("data-moving", "true");
  await assertSharedFrame(page);
  await zoom.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await reset.click();
  await expect(camera(page)).toHaveAttribute("data-moving", "false");
  (await readPose(page)).forEach((value, index) => expect(value).toBeCloseTo(rest[index], 2));

  await zoom.click();
  await expect(camera(page)).toHaveAttribute("data-moving", "false");
  const enlarged = await readPose(page);
  expect(enlarged).not.toBe(rest);

  const size = page.viewportSize()!;
  const x = Math.round(size.width * 0.44);
  const y = Math.round(size.height * 0.40);
  if (hasTouch) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (const offset of [12, 28, 43, 66]) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: x + offset, y }],
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 66, y, { steps: 5 });
    await page.mouse.up();
  }
  await expect.poll(() => readPose(page)).not.toEqual(enlarged);
  await assertSharedFrame(page);
  await expect(explorer(page)).toHaveAttribute("data-state", "BUILDING_FOCUS");
  await expect(page).toHaveURL(/\?view=facade$/);
  await page.setViewportSize({ width: size.width - 34, height: size.height + 14 });
  await reset.click();
  await expect(camera(page)).toHaveAttribute("data-moving", "false");
  await assertSharedFrame(page);
  const photo = page.getByRole("img", { name: /glavno pročelje/i });
  const ratio = await photo.evaluate(img => {
    const { width, height } = img.getBoundingClientRect();
    return width / height;
  });
  expect(ratio).toBeCloseTo(16 / 9, 2);
});

test("never serves raw JPEGs, plans or cross-site media", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "HTTP scope is common to all viewport projects");
  const media = (asset: string) => `${route}/media/${asset}`;
  const response = await request.get(media("facade-1920.avif"));
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/avif");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect((await request.get(media("facade-1920.avif"), { headers: { "sec-fetch-site": "cross-site" } })).status()).toBe(404);
  expect((await request.get(media("Mocire_H-Zadar_000.jpg"))).status()).toBe(404);
  expect((await request.get(media("L02.svg"))).status()).toBe(404);
  expect((await request.get("/assets/source/mocire-zadar-h/raw/stage2/exterior/Mocire_H-Zadar_000.jpg")).status()).toBe(404);
});
