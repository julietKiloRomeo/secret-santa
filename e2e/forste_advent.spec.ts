import { test, expect } from '@playwright/test';

test.describe('Første Advent - Snake', () => {
  test('loads page with canvas and score and picks up a present', async ({ page }) => {
    await page.goto('/forste-advent');
    const canvas = page.locator('#snake-canvas');
    await expect(canvas).toBeVisible();
    const score = page.locator('#score');
    await expect(score).toHaveText(/Score:\s*0/);

    // Position gift one cell to the right of the head and set direction to right
    await page.evaluate(() => {
      // @ts-ignore
      window.__snakeDebug__?.placeGiftNextToHead?.(1, 0);
      // @ts-ignore
      window.__snakeDebug__?.setDirection?.('right');
    });

    // Move right to pick up the gift
    await page.keyboard.press('ArrowRight');

    // Wait a moment for the game tick to process
    await page.waitForTimeout(300);

    await expect(score).toHaveText(/Score:\s*1/);

    // Verify snake length increased via debug API
    const length = await page.evaluate(() => {
      // @ts-ignore
      return window.__snakeDebug__?.getSnakeLength?.();
    });
    expect(length).toBeGreaterThan(1);
  });
});

