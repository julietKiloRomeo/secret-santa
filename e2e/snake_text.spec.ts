import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Text on the card and score screen must be drawn at screen density, not stretched (blurry).
test.use({ deviceScaleFactor: 2, viewport: { width: 1024, height: 700 } });

test('loot card text is drawn at screen resolution', async ({ page }) => {
  await loginAsPlaywright(page);
  await page.goto('/advent-1');
  await page.waitForFunction(() => Boolean((window as any).__snakeDebug__));
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
    d.placePowerupNextToHead('shield', 1, 0);
    d.setDirection('right');
    d.tickOnce();
  });
  const res = await page.evaluate(() => (window as any).__snakeDebug__.getTextResolution());
  expect(res).toBeGreaterThanOrEqual(2);
});

test('score screen text is drawn at screen resolution', async ({ page }) => {
  await loginAsPlaywright(page);
  await page.goto('/advent-1');
  await page.waitForFunction(() => Boolean((window as any).__snakeDebug__));
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
    d.placeGiftNextToHead(1, 0);
    d.setDirection('right');
    d.tickOnce();
    for (let i = 0; i < 30; i += 1) {
      d.setDirection('up');
      d.tickOnce();
    }
  });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__arcadeScores__))).toBe(true);
  const res = await page.evaluate(() => {
    const scene = (window as any).__arcadeScores__;
    const first = scene.children.list.find((o: any) => o.type === 'Text');
    return first?.style?.resolution ?? null;
  });
  expect(res).toBeGreaterThanOrEqual(2);
});
