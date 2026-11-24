import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Point = [number, number];
type Floors = {
  floors: { floor_id: string; status: string; focus: Point | null; polygons: Point[][] }[];
};
type Pose = { x: number; y: number; scale: number };
type Selection = {
  floorId: string; label: string; status: string; viewId: string; sourceSha256: string;
  polygons: Point[][]; focus: Point | null; endpoint: Pose | null;
  planRefs: { image_id: string; variant: string }[];
  viewport: (Pose & { viewportWidth: number; viewportHeight: number; moving: boolean }) | null;
  url: string;
};
declare global {
  interface Window {
    mocireExteriorPreview: { getSelection: () => Selection | null; selectFloor: (floorId: string) => boolean };
  }
}

const output = resolve('reports/qa/stage2/private/stage3-exterior');
const link = (page: Page, floor: string) => page.locator(`[data-floor-id="${floor}"]`);
const band = (page: Page, floor: string) => page.locator(`[data-band-id="${floor}"]`);
const stage = (page: Page) => page.locator('#transformStage');
const state = (page: Page) => page.locator('html');
const overlay = (page: Page) => page.locator('#overlaySvg');
const selection = (page: Page) => page.evaluate(() => window.mocireExteriorPreview.getSelection());
const settled = (page: Page) => expect(stage(page)).toHaveAttribute('data-moving', 'false');

async function openFacade(page: Page) {
  await page.goto('/?view=facade');
  await expect(overlay(page)).toBeVisible();
  await settled(page);
}

async function registered(page: Page): Promise<Floors['floors']> {
  const response = await page.request.get('/data/registration.json');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as Floors).floors;
}

async function spot(page: Page, point: Point) {
  return overlay(page).evaluate((svg, [x, y]) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM();
    if (!matrix) throw new Error('Missing SVG screen matrix');
    const p = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: p.x, y: p.y, hit: document.elementFromPoint(p.x, p.y)?.closest('[data-band-id]')?.getAttribute('data-band-id') };
  }, point);
}

async function assertRegisteredTransform(page: Page) {
  const actual = await overlay(page).evaluate(svg => {
    const image = document.querySelector('#imgFacade') as HTMLImageElement;
    const canvas = document.querySelector('#canvasContainer')?.getBoundingClientRect();
    const bitmap = image.getBoundingClientRect();
    const vector = svg.getBoundingClientRect();
    const { a, b, c, d, e, f } = (svg as SVGSVGElement).getScreenCTM()!;
    const distances = [bitmap.left - vector.left, bitmap.top - vector.top,
      bitmap.right - vector.right, bitmap.bottom - vector.bottom, bitmap.left - e, bitmap.top - f, a - d];
    return { distances, b, c, cover: canvas && [bitmap.left <= canvas.left + 1, bitmap.top <= canvas.top + 1,
      bitmap.right >= canvas.right - 1, bitmap.bottom >= canvas.bottom - 1] };
  });
  expect(Math.max(...actual.distances.map(Math.abs))).toBeLessThan(.75);
  expect(actual.b).toBe(0);
  expect(actual.c).toBe(0);
  expect(actual.cover).toEqual([true, true, true, true]);
}

test('loads the two Sigma stills and captures clean opening and façade frames', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const bad: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) bad.push(response.url()); });
  await page.goto('/');
  await expect(state(page)).toHaveAttribute('data-state', 'OVERVIEW');
  await expect(page.locator('.scene')).toHaveAttribute('data-asset', 'ready');
  await expect(overlay(page)).toBeHidden();
  await expect(page.locator('#imgArrival')).toHaveJSProperty('complete', true);
  const source = await page.locator('#imgArrival').evaluate(img => (img as HTMLImageElement).currentSrc);
  expect(source).toMatch(/\/assets\/arrival-(960|1280|1920)\.(avif|webp)$/);
  await expect(page.locator('.arrival')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: `${output}/${testInfo.project.name}-arrival.png`, scale: 'css' });
  await page.locator('#panelAction').click();
  await expect(page).toHaveURL(/\?view=facade$/);
  await expect(state(page)).toHaveAttribute('data-state', 'BUILDING_FOCUS');
  await expect(overlay(page)).toBeVisible();
  await settled(page);
  await assertRegisteredTransform(page);
  await expect(page.locator('#floorListRail li')).toHaveCount(5);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: `${output}/${testInfo.project.name}-facade.png`, scale: 'css' });
  expect(errors).toEqual([]);
  expect(bad).toEqual([]);
});

test('hits, highlights and selects every provisional floor from the same mapped region and floor list', async ({ page, hasTouch }, testInfo) => {
  await openFacade(page);
  for (const row of await registered(page)) {
    const floorId = row.floor_id;
    if (!row.focus) {
      await expect(band(page, floorId)).toHaveCount(0);
      await link(page, floorId).click();
      await expect(page).toHaveURL(/\?floor=L00$/);
      await expect(page.locator('h1')).toHaveText('Prizemlje');
    const selected = await selection(page);
      expect(selected).toMatchObject({ status: 'unmapped', focus: null, endpoint: null, polygons: [] });
      await page.locator('#btnResetView').click();
      await settled(page);
      continue;
    }
    const p = await spot(page, row.focus);
    expect(p.hit, floorId).toBe(floorId);
    if (!hasTouch) {
      await page.mouse.move(p.x, p.y);
      await expect(state(page)).toHaveAttribute('data-state', 'FLOOR_HOVER');
      await expect(band(page, floorId)).toHaveAttribute('data-hovered', 'true');
      if (floorId === 'L02') {
        await page.waitForFunction(() => document.querySelector('[data-band-id="L02"] polygon')?.getAnimations().length === 0);
        await page.screenshot({ path: `${output}/${testInfo.project.name}-hover.png`, scale: 'css' });
      }
      await page.mouse.click(p.x, p.y);
    } else {
      await page.touchscreen.tap(p.x, p.y);
    }
    await expect(state(page)).toHaveAttribute('data-state', 'FLOOR_SELECTED');
    await expect(band(page, floorId)).toHaveAttribute('data-selected', 'true');
    await expect(link(page, floorId)).toHaveAttribute('aria-current', 'true');
    await settled(page);
    const fromBand = await selection(page);
    expect(fromBand).toMatchObject({ floorId, viewId: 'Mocire_H-Zadar_000', status: 'provisional',
      focus: row.focus, polygons: row.polygons, viewport: { moving: false }, url: `/?floor=${floorId}` });
    expect(fromBand?.viewport?.scale).toBeCloseTo(fromBand!.endpoint!.scale, 4);
    if (floorId === 'L02' || testInfo.project.name === 'desktop' || testInfo.project.name === 'portrait') {
      await page.screenshot({ path: `${output}/${testInfo.project.name}-${floorId}-selected.png`, scale: 'css' });
    }
    await page.locator('#btnResetView').click();
    await expect(state(page)).not.toHaveAttribute('data-floor', floorId);
    await settled(page);
    await link(page, floorId).click();
    await settled(page);
    expect(await selection(page)).toEqual(fromBand);
    await page.locator('#btnResetView').click();
    await settled(page);
  }
});

test('preserves floor links on cold entry, refresh, Back and Forward', async ({ page }) => {
  await page.goto('/?floor=L04');
  await expect(overlay(page)).toBeVisible();
  await settled(page);
  expect((await selection(page))?.planRefs.map(plan => plan.image_id)).toEqual(['L04', 'L04-gallery']);
  await link(page, 'L02').focus();
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-floor', 'L02');
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Etaža 4');
  await page.goForward();
  await expect(page.locator('h1')).toHaveText('Etaža 2');
  await page.reload();
  await expect(state(page)).toHaveAttribute('data-floor', 'L02');
  await expect(overlay(page)).toBeVisible();
  await settled(page);
  await page.locator('#arrivalLink').click();
  await expect(overlay(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(overlay(page)).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Etaža 2');
  const target = page.getByRole('button', { name: 'Etaža 3 — nepotvrđen položaj na pročelju' });
  await target.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('h1')).toHaveText('Etaža 3');
});

test('finishes the last focus command after interruptions and resize', async ({ page }) => {
  await openFacade(page);
  await page.evaluate(() => {
    document.getElementById('scene')!.addEventListener('mocire:exterior-focus', event => {
      document.documentElement.dataset.lastSettle = (event as CustomEvent<Selection>).detail.floorId;
    });
  });
  await link(page, 'L01').click();
  await expect(stage(page)).toHaveAttribute('data-moving', 'true');
  await assertRegisteredTransform(page);
  await page.evaluate(() => {
    const preview = window.mocireExteriorPreview;
    preview.selectFloor('L04');
    document.querySelector<HTMLButtonElement>('#btnZoomOut')!.click();
    preview.selectFloor('L03');
  });
  await assertRegisteredTransform(page);
  await settled(page);
  await expect(state(page)).toHaveAttribute('data-last-settle', 'L03');
  await expect(page).toHaveURL(/\?floor=L03$/);
  const previous = (await selection(page))!.viewport!;
  await page.setViewportSize({ width: 1000, height: 690 });
  await expect.poll(async () => (await selection(page))?.viewport?.viewportWidth).not.toBe(previous.viewportWidth);
  await assertRegisteredTransform(page);
  const next = (await selection(page))!;
  expect(next.viewport).toMatchObject({ moving: false });
  expect(next.viewport?.scale).toBeCloseTo(next.endpoint!.scale, 4);
});

test('pans without selecting, zooms with controls and keeps native browser scrolling', async ({ page, hasTouch }) => {
  await openFacade(page);
  const before = await stage(page).getAttribute('style');
  await page.locator('#btnZoomIn').click();
  await settled(page);
  const zoomed = await stage(page).getAttribute('style');
  expect(zoomed).not.toBe(before);
  expect(await page.locator('#canvasContainer').evaluate(el => getComputedStyle(el).touchAction)).toContain('pinch-zoom');
  const focus = (await registered(page)).find(row => row.floor_id === "L03")?.focus;
  if (!focus) throw new Error("L03 is missing its private review point");
  const p = await spot(page, focus);
  expect(p.hit).toBe('L03');
  if (hasTouch) {
    const cdp = await page.context().newCDPSession(page);
    const touchPoints = [{ x: p.x, y: p.y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
    for (const dx of [12, 25, 46, 65]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + dx, y: p.y, id: 1 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 65, p.y + 2, { steps: 5 });
    await page.mouse.up();
  }
  expect(await stage(page).getAttribute('style')).not.toBe(zoomed);
  await expect(page).toHaveURL(/\?view=facade$/);
  await assertRegisteredTransform(page);
  await page.locator('#btnResetView').click();
  await settled(page);
  expect(await stage(page).getAttribute('style')).toBe(before);
});

test('snaps under reduced motion and keeps invalid addresses recoverable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?floor=invalid');
  await expect(page.locator('#inspectorContent')).toContainText('Tražena etaža nije pronađena');
  await expect(page).toHaveURL(/\?floor=invalid$/);
  await expect(overlay(page)).toBeVisible();
  const result = await page.evaluate(() => {
    const accepted = window.mocireExteriorPreview.selectFloor('L02');
    const rejected = window.mocireExteriorPreview.selectFloor('does-not-exist');
    return { accepted, rejected, pose: window.mocireExteriorPreview.getSelection()?.viewport };
  });
  expect(result).toMatchObject({ accepted: true, rejected: false, pose: { moving: false } });
  await expect(page).toHaveURL(/\?floor=L02$/);
  await assertRegisteredTransform(page);
});

test('keeps the canonical floor list usable without the map or overlay', async ({ page }) => {
  await page.route('**/data/registration.json', route => route.abort());
  await page.goto('/?floor=L02');
  await expect(page.locator('h1')).toHaveText('Etaža 2');
  await expect(overlay(page)).toBeHidden();
  await expect(page.locator('.rail-note')).toHaveText('Oznake na pročelju nisu dostupne.');
  await link(page, 'L04').click();
  await expect(page.locator('h1')).toHaveText('Etaža 4');
  expect(await selection(page)).toMatchObject({ status: 'map-unavailable', polygons: [], focus: null, endpoint: null });
});

test('falls back from AVIF to WebP and shows a readable error if both fail', async ({ page }) => {
  await page.route('**/assets/facade-*.avif', route => route.abort());
  await openFacade(page);
  expect(await page.locator('#imgFacade').evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\.webp$/);
  await page.route('**/assets/facade*.webp', route => route.abort());
  await page.reload();
  await expect(page.locator('#imageMessage')).toContainText('Pročelje nije dostupno');
  await expect(overlay(page)).toBeHidden();
  await link(page, 'L02').click();
  await expect(page.locator('h1')).toHaveText('Etaža 2');
  expect((await selection(page))?.viewport).toBeNull();
});

test('serves only the private proof allowlist, not raw architectural assets', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Only one HTTP-level check is needed');
  const response = await request.get('/');
  expect(response.ok()).toBe(true);
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect((await request.get('/assets/source/mocire-zadar-h/raw/stage2/exterior/Mocire_H-Zadar_000.jpg')).status()).toBe(404);
  expect((await request.get('/data/apartments.json')).status()).toBe(404);
  expect((await request.get('/assets/facade.webp', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status()).toBe(403);
  expect((await request.get('/assets/review-plans/L02.webp')).status()).toBe(404);
  const floors = await (await request.get('/data/floors.json')).json();
  expect(floors.floors.every((floor: Record<string, unknown>) => !('unit_ids' in floor))).toBe(true);
  expect(await readFile(resolve('reports/qa/stage3-exterior-proof.html'), 'utf8')).not.toContain('data:image');
});
