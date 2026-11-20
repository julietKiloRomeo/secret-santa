import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Behaviour that the rebuilt Snake must keep: a real keypress is honoured, two quick turns
// both land, and a death opens the score screen with the snake frozen.
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('two quick keypresses are both queued in order', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
  });
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  // Timing-free: both turns are in the queue, in press order (up, then left).
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getQueue())).toEqual(['up', 'left']);
});

test('a wall death opens the score screen and freezes the snake', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
    d.setDirection('up');
    for (let i = 0; i < 30; i += 1) d.tickOnce();
  });
  await expect
    .poll(() => page.evaluate(() => ((window as any).__arcadeScores__ ? 'open' : null)))
    .toBe('open');
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(false);
});
