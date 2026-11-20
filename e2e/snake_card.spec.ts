import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Powerup loot cards: the first pickup of a kind pauses the game and shows a card.
// A key or tap dismisses it. Later pickups of the same kind do not show it again.
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

async function pickShield(page) {
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.placePowerupNextToHead('shield', 1, 0);
    d.setDirection('right');
    d.tickOnce();
  });
}

test('first shield pickup pauses the game with a card; a key dismisses it', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
  });
  // Start the game, then pick up a shield.
  await page.evaluate(() => (window as any).__snakeDebug__.setDirection('right'));
  await page.evaluate(() => (window as any).__snakeDebug__.debugStop());
  await page.evaluate(() => (window as any).__snakeDebug__.restartGame());
  await pickShield(page);
  await expect.poll(() => page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(false);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getCard())).toEqual({
    open: true,
    name: 'Ward of the Frost Hearth',
  });
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(true);
});

test('a second shield pickup does not open the card again', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
  });
  await pickShield(page);
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.evaluate(() => (window as any).__snakeDebug__.restartGame());
  await pickShield(page);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getCard())).toEqual({ open: false });
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(true);
});
