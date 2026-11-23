import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// A shield absorbs a wall hit: the game waits, paused, until a direction is pressed.
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('shield saves you from a wall, pauses, and waits for a direction', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.grantEffect('shield');
    d.setDirection('up');
  });
  for (let i = 0; i < 14; i += 1) {
    await page.evaluate(() => (window as any).__snakeDebug__.tickOnce());
  }
  // A random save line is shown (see shield_messages.js); it always asks for an arrow.
  await expect(page.locator('#status')).toContainText(/arrow|pil/i);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isAlive())).toBe(true);
  // Space does not start it; a direction does.
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(true);
});
