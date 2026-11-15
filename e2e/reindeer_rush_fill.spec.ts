import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// The game canvas must cover the screen: no dark bands above/below (phone) or left/right (desktop).
const views = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
];

for (const v of views) {
  test(`reindeer rush canvas fills the ${v.name} screen`, async ({ page }) => {
    await page.setViewportSize(v.viewport);
    await loginAsPlaywright(page);
    await page.route('**/api/scores/advent-4', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { game: 'advent-4', scores: [] } })
        : route.fulfill({ json: { success: true } }),
    );
    await page.goto('/advent-4');
    await page.waitForFunction(() => Boolean((window as any).__rrDebug__));
    const box = await page.locator('#reindeer-canvas canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(v.viewport.height * 0.95);
    expect(box!.width).toBeGreaterThanOrEqual(v.viewport.width * 0.95);
  });
}
