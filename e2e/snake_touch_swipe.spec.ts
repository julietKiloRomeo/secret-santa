import { test, expect, devices } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// On a phone, a swipe must resume the game from the waiting state (after a shield stops it).
test.use({ ...devices['Pixel 5'] });
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('a swipe resumes the game after a shield stop without waiting for release', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  // A shield stops the snake at a wall: the game then waits for a direction.
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
    d.grantEffect('shield');
    d.setDirection('up');
    for (let i = 0; i < 40; i++) d.tickOnce();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
  const box = await page.locator('canvas').first().boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  const touch = await page.context().newCDPSession(page);
  // Swipe right: a short drag does nothing; crossing the threshold resumes before release.
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 40, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30, y }] });
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 40, y }] });
  await expect.poll(() => page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(false);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});
