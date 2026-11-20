import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Powerups: the floor holds one item, pickups stack, and the HUD shows the stacked counts.
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('a shield pickup stacks and shows on the HUD', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
  });
  for (let i = 0; i < 2; i += 1) {
    await page.evaluate(() => {
      const d = (window as any).__snakeDebug__;
      d.placePowerupNextToHead('shield', 1, 0);
      d.setDirection('right');
      d.tickOnce();
    });
  }
  const effects = await page.evaluate(() => (window as any).__snakeDebug__.getEffects());
  expect(effects.shield).toBe(2);
  await expect(page.locator('.game-status').last()).toContainText('🛡 2');
  expect(errors).toEqual([]);
});
