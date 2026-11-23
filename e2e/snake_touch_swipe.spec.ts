import { test, expect, devices } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// On a phone, a swipe must resume the game from the waiting state (after a shield stops it).
test.use({ ...devices['Pixel 5'] });
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('a swipe resumes the game after a shield stop', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  // A shield stops the snake at a wall: the game then waits for a direction.
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop(); d.restartGame(); d.debugStop();
    d.grantEffect('shield');
    d.setDirection('up');
    for (let i = 0; i < 40; i++) d.tickOnce();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
  const box = await page.locator('canvas').first().boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  // Swipe right: finger down, drag 80 px to the right, lift. Dispatched as real pointer events.
  await page.mouse.move(x - 40, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(false);
});
