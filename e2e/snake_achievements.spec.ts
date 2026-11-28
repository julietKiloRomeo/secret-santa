import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Achievements are not shown in the game. Reached tiers are posted to the server instead.
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

test('shield pickups no longer post achievement tiers', async ({ page }) => {
  const posted: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/achievements') && r.method() === 'POST')
      posted.push(JSON.parse(r.postData() ?? '{}').achievement_id);
  });
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop(); d.restartGame(); d.debugStop();
    for (let i = 0; i < 3; i++) {
      d.placePowerupNextToHead('shield', 1, 0);
      d.setDirection('right');
      d.tickOnce();
    }
  });
  await page.waitForTimeout(600);
  expect(posted).toEqual([]);
  const card = await page.evaluate(() => (window as any).__snakeDebug__.getCard());
  expect(card.name).not.toBe('Insurance Claim');
});
