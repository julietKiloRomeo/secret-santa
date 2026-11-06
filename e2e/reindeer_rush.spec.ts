import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

type Snap = { state: string; score: number; y: number; snowmen: number } | null;
const snap = (page) => page.evaluate(() => (window as any).__rrDebug__.snapshot() as Snap);

test.describe('Reindeer Rush', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlaywright(page);
    await page.route('**/api/scores/advent-4', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { game: 'advent-4', scores: [] } })
        : route.fulfill({ json: { success: true } }),
    );
    await page.goto('/advent-4');
    await page.waitForFunction(() => Boolean((window as any).__rrDebug__));
  });

  test('space starts the run and the score climbs', async ({ page }) => {
    await page.keyboard.press('Space');
    await expect.poll(async () => (await snap(page))?.state).toBe('running');
    await expect.poll(async () => (await snap(page))!.score, { timeout: 5000 }).toBeGreaterThan(0);
  });

  test('a jump lifts the reindeer off the ground', async ({ page }) => {
    await page.keyboard.press('Space');
    await expect.poll(async () => (await snap(page))?.state).toBe('running');
    await page.waitForTimeout(150);
    const before = (await snap(page))!.y;
    await page.keyboard.press('Space');
    await expect.poll(async () => (await snap(page))!.y).toBeLessThan(before - 20);
  });

  test('running into a snowman without dashing ends the run and shows the score screen', async ({ page }) => {
    // Jump on a timer so the reindeer clears the gaps and survives until the first snowman (~5s).
    await page.keyboard.press('Space');
    const jumper = setInterval(() => page.keyboard.press('Space').catch(() => {}), 650);
    try {
      await expect.poll(async () => (await snap(page))!.snowmen, { timeout: 20000 }).toBeGreaterThan(0);
      await expect.poll(async () => (await snap(page))?.state, { timeout: 30000 }).toBe('dead');
    } finally {
      clearInterval(jumper);
    }
    await expect(page.locator('input.arcade-input')).toBeVisible({ timeout: 8000 });
  });
});
