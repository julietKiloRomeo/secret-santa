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
  await page.keyboard.press('Space'); // dismisses the card only
  await expect(page.locator('#status')).toContainText('Good luck. Press a direction to start again');
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(false);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
  // Space is not a direction: the game stays waiting.
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isWaiting())).toBe(true);
  // A direction starts it again, and the powerup state is kept.
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(true);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getEffects())).toMatchObject({ shield: 1 });
});

test('a second shield pickup in the same game does not open the card again', async ({ page }) => {
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
  // Same game, second pickup: no card.
  await page.evaluate(() => (window as any).__snakeDebug__.setDirection('right'));
  await pickShield(page);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getCard())).toEqual({ open: false });
});

test('a new game shows the loot card again for the same powerup kind', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
  });
  await pickShield(page);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getCard().open)).toBe(true);
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  // Start a new game: the cards reset, so the first shield pickup opens the card again.
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
  });
  await pickShield(page);
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getCard().open)).toBe(true);
});
