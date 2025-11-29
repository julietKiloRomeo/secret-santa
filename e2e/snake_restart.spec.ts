import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/');
  await page.fill('#name', 'playwright');
  await page.fill('#code', 'pw-test-123');
  const [loginResp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST'),
    page.click('button[type=submit]'),
  ]);
  if (!loginResp.ok()) {
    throw new Error(`Login failed with status ${loginResp.status()}`);
  }
}

test.describe('Snake restart shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('spacebar restarts after a stop', async ({ page }) => {
    await page.goto('/forste-advent');
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
    await page.goto('/forste-advent');
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
