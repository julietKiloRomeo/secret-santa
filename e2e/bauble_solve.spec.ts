import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';
import { WORLD, LEVELS } from '../static/bauble_levels.js';

// Plays every level's solution in order, from a fresh page, and checks each one is won.
test('every Nissen & Kuglen level is solvable with its listed cuts', async ({ page }) => {
  test.setTimeout(240000);
  await loginAsPlaywright(page);
  await page.route('**/api/scores/advent-6', (r) =>
    r.request().method() === 'GET' ? r.fulfill({ json: { game: 'advent-6', scores: [] } }) : r.fulfill({ json: { success: true } }));
  await page.goto('/advent-6');
  await page.waitForFunction(() => Boolean((window as any).__baubleDebug__));
  const box = (await page.locator('#bauble-wrap canvas').boundingBox())!;
  const k = box.width / WORLD.width;
  const snap = () => page.evaluate(() => (window as any).__baubleDebug__.snapshot());
  for (let li = 0; li < LEVELS.length; li++) {
    await page.waitForTimeout(400);
    await expect.poll(async () => (await snap()).state, { timeout: 8000 }).toBe("playing");
    expect((await snap()).level).toBe(li);
    for (const s of LEVELS[li].solution) {
      await page.mouse.move(box.x + s.from.x * k, box.y + s.from.y * k);
      await page.mouse.down();
      await page.mouse.move(box.x + s.to.x * k, box.y + s.to.y * k, { steps: 12 });
      await page.mouse.up();
    }
    await expect.poll(async () => (await snap()).scores.length, { timeout: 8000 }).toBe(li + 1);
  }
});
