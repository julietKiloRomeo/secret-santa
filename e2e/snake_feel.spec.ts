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

test('an arrow press turns the head on screen before the next movement tick', async ({ page }) => {
  await page.clock.install();
  await page.goto('/advent-1');
  await dbg(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.evaluate(() => (window as any).__snakeDebug__.restartGame());

  await page.keyboard.press('ArrowLeft'); // a reverse must not turn the sprite
  await page.clock.runFor(32);
  const rotation = () => page.evaluate(() => (window as any).__snakeDebug__.getHeadRotation());
  expect(await rotation()).toBe(0);
  // Reset to test a legal turn immediately after a fresh movement interval.
  await page.evaluate(() => (window as any).__snakeDebug__.restartGame());
  const coords = () => page.evaluate(() => (window as any).__snakeDebug__.getSnakeCoords());
  const before = await coords();
  await page.keyboard.press('ArrowUp');
  await page.clock.runFor(32);
  expect(await rotation()).toBeCloseTo(-Math.PI / 2);
  expect(await coords()).toEqual(before);
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
