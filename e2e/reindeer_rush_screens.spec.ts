import { test } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Visual check only: saves desktop and phone screenshots of Reindeer Rush mid-run.
const views = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
];

for (const v of views) {
  test(`reindeer rush screenshot ${v.name}`, async ({ page }) => {
    await page.setViewportSize(v.viewport);
    await loginAsPlaywright(page);
    await page.route('**/api/scores/advent-4', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { game: 'advent-4', scores: [] } })
        : route.fulfill({ json: { success: true } }),
    );
    await page.goto('/advent-4');
    await page.waitForFunction(() => Boolean((window as any).__rrDebug__));
    // Start the run and jump once early, then capture before the first snowman arrives (~5s).
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `out/reindeer_rush_${v.name}.png`, fullPage: false });
  });
}
