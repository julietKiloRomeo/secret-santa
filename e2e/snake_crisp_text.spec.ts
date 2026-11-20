import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Score screen and loot card text is DOM, so it is crisp like the name input.
test.use({ deviceScaleFactor: 2, viewport: { width: 1024, height: 700 } });
test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const boxed = (page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, text: el.textContent };
  }, sel);

test('loot card text is DOM and laid out with real size', async ({ page }) => {
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
  await expect.poll(() => boxed(page, '.arcade-card-title')).not.toBeNull();
  const title = await boxed(page, '.arcade-card-title');
  expect(title!.w).toBeGreaterThan(0);
  expect(title!.text).toContain('Ward of the Frost Hearth');
});

test('score screen title and rows are DOM text', async ({ page }) => {
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
  await expect.poll(() => boxed(page, '.arcade-title')).not.toBeNull();
  expect((await boxed(page, '.arcade-title'))!.text).toContain('Søde Børn');
  expect(await page.locator('.arcade-score-row, .arcade-text').count()).toBeGreaterThan(3);
});
