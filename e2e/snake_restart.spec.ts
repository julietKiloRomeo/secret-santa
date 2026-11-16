import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';


test.describe('Snake restart shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlaywright(page);
  });

  test('spacebar restarts after a stop', async ({ page }) => {
    await page.goto('/advent-1');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });
    await page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

    await page.evaluate(() => {
      // @ts-ignore
      window.__snakeDebug__?.debugStop?.();
    });

    await page.waitForFunction(() => {
      // @ts-ignore
      return window.__snakeDebug__?.isRunning?.() === false;
    });

    await page.keyboard.press('Space');

    await page.waitForFunction(() => {
      // @ts-ignore
      return window.__snakeDebug__?.isRunning?.();
    });
  });

  test('tapping the canvas restarts the game', async ({ page }) => {
    await page.goto('/advent-1');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });
    await page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

    await page.evaluate(() => {
      // @ts-ignore
      window.__snakeDebug__?.debugStop?.();
    });

    await page.waitForFunction(() => {
      // @ts-ignore
      return window.__snakeDebug__?.isRunning?.() === false;
    });

    const canvas = page.locator('#snake-canvas');
    // Click the middle of the board: the HUD overlays the top corners on any shape.
    const box = (await canvas.boundingBox())!;
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });

    await page.waitForFunction(() => {
      // @ts-ignore
      return window.__snakeDebug__?.isRunning?.();
    });
  });
});
