import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Behaviour that the rebuilt Snake must keep: a real keypress is honoured, two quick turns
// both land, and a death opens the score screen with the snake frozen.
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('a key press reaches the queue (the two-turn order is covered in Jest)', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
  });
  // One press: a single key event is not sensitive to the timing of the second one.
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getQueue())).toEqual(['up']);
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
