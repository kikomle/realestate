import { expect, test } from "@playwright/test"

const SHOT_DIR = "reports/screenshots"

test.describe("viewer smoke", () => {
  test("loads the placeholder model, selects a named node and flies the camera", async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })

    await page.goto("/viewer")
    await expect(page.getByTestId("scene-viewer")).toBeVisible()
    await page.locator("canvas").first().waitFor({ state: "visible" })
    await page.waitForFunction(() => window.__viewer?.ready === true, undefined, { timeout: 30_000 })
    await page.waitForFunction(() => document.querySelector('[data-testid="scene-viewer"]')?.getAttribute("data-state") === "ready", undefined, { timeout: 30_000 })

    const sizeOk = await page.locator("canvas").first().evaluate((c: HTMLCanvasElement) => c.width > 0 && c.height > 0)
    expect(sizeOk).toBe(true)

    await page.screenshot({ path: `${SHOT_DIR}/viewer-${testInfo.project.name}-loaded.png`, fullPage: true })

    const before = await page.evaluate(() => window.__viewer!.getCameraPosition())

    const target = "B01__L00__U101__wall__003"
    const point = await page.evaluate((name) => window.__viewer!.getNodeScreenPoint(name), target)
    expect(point).not.toBeNull()
    await page.mouse.click(point!.x, point!.y)

    const selectedLabel = page.getByTestId("semantic-id")
    await expect(selectedLabel).toHaveText(/^B\d{2}__L\d{2}__(NONE|U\d{3})__(wall|slab|window|door|balcony|stair|column|roof|site)__\d{3}$/, { timeout: 5_000 })
    const shown = (await selectedLabel.textContent())?.trim() ?? ""
    expect(shown).toBe(await page.evaluate(() => window.__viewer!.getSelected()))
    await page.waitForTimeout(1600)

    const after = await page.evaluate(() => window.__viewer!.getCameraPosition())
    const moved = before.some((v, i) => Math.abs(v - after[i]) > 0.5)
    expect(moved).toBe(true)

    await page.screenshot({ path: `${SHOT_DIR}/viewer-${testInfo.project.name}-selected.png`, fullPage: true })

    const severe = consoleErrors.filter((e) => !/favicon|DevTools|Download the React DevTools/i.test(e))
    expect(severe, `console errors: ${severe.join(" | ")}`).toEqual([])
  })

  test("shows a fallback error when the model URL does not exist", async ({ page }) => {
    await page.goto("/viewer?model=/models/test/does-not-exist.glb")
    await expect(page.getByTestId("viewer-error")).toBeVisible({ timeout: 15_000 })
  })
})
