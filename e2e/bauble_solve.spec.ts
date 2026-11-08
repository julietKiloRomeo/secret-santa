import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';
import { WORLD, LEVELS } from '../static/bauble_levels.js';

// Plays each level's cut solution from a fresh page, one level at a time. Each level is its own
// step, so a failure names the level it broke on.
for (let li = 0; li < LEVELS.length; li++) {
  test(`level ${li + 1} (${LEVELS[li].name}) is solved by its listed cuts`, async ({ page }) => {
    test.setTimeout(120000);
    await loginAsPlaywright(page);
    await page.route('**/api/scores/advent-6', (r) =>
      r.request().method() === 'GET' ? r.fulfill({ json: { game: 'advent-6', scores: [] } }) : r.fulfill({ json: { success: true } }));
    await page.goto('/advent-6');
    await page.waitForFunction(() => Boolean((window as any).__baubleDebug__));
    const box = (await page.locator('#bauble-wrap canvas').boundingBox())!;
    const k = box.width / WORLD.width;
    const snap = () => page.evaluate(() => (window as any).__baubleDebug__.snapshot());
    // Reach this level by playing the earlier ones in order, so this test matches real play.
    for (let prev = 0; prev < li; prev++) {
      await expect.poll(async () => (await snap()).level, { timeout: 8000 }).toBe(prev);
      await expect.poll(async () => (await snap()).state, { timeout: 8000 }).toBe('playing');
      for (const s of LEVELS[prev].solution) {
        await page.mouse.move(box.x + s.from.x * k, box.y + s.from.y * k);
        await page.mouse.down();
        await page.mouse.move(box.x + s.to.x * k, box.y + s.to.y * k, { steps: 12 });
        await page.mouse.up();
      }
      await expect.poll(async () => (await snap()).scores.length, { timeout: 15000 }).toBe(prev + 1);
    }
    await expect.poll(async () => (await snap()).state, { timeout: 8000 }).toBe('playing');
    expect((await snap()).level).toBe(li);
    await page.waitForTimeout(1200); // let the bauble settle before the player cuts, as in real play
    for (const s of LEVELS[li].solution) {
      await page.mouse.move(box.x + s.from.x * k, box.y + s.from.y * k);
      await page.mouse.down();
      await page.mouse.move(box.x + s.to.x * k, box.y + s.to.y * k, { steps: 12 });
      await page.mouse.up();
    }
    await expect.poll(async () => (await snap()).scores.length, { timeout: 15000 }).toBe(li + 1);
  });
}
