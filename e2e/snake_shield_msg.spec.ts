import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// A shield save shows one of the message lines and waits for a direction.
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('a wall save shows a wall line and waits for a direction', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.grantEffect('shield');
    d.setDirection('up');
  });
  for (let i = 0; i < 14; i += 1) await page.evaluate(() => (window as any).__snakeDebug__.tickOnce());
  const status = await page.locator('#status').textContent();
  expect(status).toMatch(/arrow|pil/i);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
});

test('a body save stops the snake in place and waits', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.grantEffect('shield');
  });
  // Drive the head into its own body: the test hook sets a body layout, then ticks once.
  await page.evaluate(() => (window as any).__snakeDebug__.placeBodyHitAhead());
  await page.evaluate(() => (window as any).__snakeDebug__.tickOnce());
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isAlive())).toBe(true);
});
