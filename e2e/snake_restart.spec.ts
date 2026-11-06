import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';


test.describe('Snake restart shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlaywright(page);
  });

  test('spacebar restarts after a stop', async ({ page }) => {
    await page.goto('/advent-1');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });

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

    await page.evaluate(() => {
      // @ts-ignore
      window.__snakeDebug__?.debugStop?.();
    });

    await page.waitForFunction(() => {
      // @ts-ignore
      return window.__snakeDebug__?.isRunning?.() === false;
    });

    const canvas = page.locator('#snake-canvas');
    await canvas.click({ position: { x: 20, y: 20 } });

    await page.waitForFunction(() => {
      // @ts-ignore
      return window.__snakeDebug__?.isRunning?.();
    });
  });
});
