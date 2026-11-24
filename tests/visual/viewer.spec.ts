import { test, expect } from '@playwright/test';
import path from 'node:path';

const REPORT_DIR = path.join(process.cwd(), 'reports', 'qa');

test.describe('interactive viewer', () => {
  test('loads, shows loading state, selects a mesh and moves the camera', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto('/viewer');

    // Loading state must appear before the model is ready.
    const loading = page.getByTestId('viewer-loading');
    await expect(loading).toBeVisible();
    await page.screenshot({ path: path.join(REPORT_DIR, `viewer-loading-${testInfo.project.name}.png`) });

    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByTestId('viewer-ready')).toBeAttached({ timeout: 60_000 });
    await expect(loading).toBeHidden();

    await page.screenshot({ path: path.join(REPORT_DIR, `viewer-initial-${testInfo.project.name}.png`) });

    // Test hook: a mesh-pick button that selects the first mesh and returns its id.
    const before = await page.getByTestId('viewer-camera').getAttribute('data-position');
    await page.getByTestId('viewer-pick-first-mesh').click();
    await expect(page.getByTestId('viewer-selected')).not.toHaveText('');
    const selected = await page.getByTestId('viewer-selected').textContent();
    expect(selected?.trim().length).toBeGreaterThan(0);

    await page.getByTestId('viewer-focus-selected').click();
    await expect(page.getByTestId('viewer-camera')).not.toHaveAttribute('data-position', before ?? '');
    await page.screenshot({ path: path.join(REPORT_DIR, `viewer-selected-${testInfo.project.name}.png`) });

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
