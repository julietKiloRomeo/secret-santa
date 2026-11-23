import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Eating the first present unlocks "Gift Receipt" once, and the unlock is kept after a reload.
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('the first present unlocks an achievement that survives a reload', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    localStorage.removeItem('snake-achievements:playwright');
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
    d.placeGiftNextToHead(1, 0);
    d.setDirection('right');
    d.tickOnce();
  });
  expect(await page.evaluate(() => (window as any).__snakeDebug__.getCard())).toMatchObject({ open: true });
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.reload();
  await dbg(page);
  const kept = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('snake-achievements:playwright') || '[]'),
  );
  expect(kept).toContain('first-present');
});
