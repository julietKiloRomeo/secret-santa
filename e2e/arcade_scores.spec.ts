import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Kill the snake against the top wall after eating `gifts` presents.
async function dieWithScore(page, gifts: number) {
  await page.goto('/forste-advent');
  await page.waitForFunction(() => (window as any).__snakeDebug__);
  await page.evaluate((n) => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
    for (let i = 0; i < n; i += 1) {
      d.placeGiftNextToHead(1, 0);
      d.tickOnce();
    }
    d.setDirection('up');
    for (let i = 0; i < 30; i += 1) d.tickOnce();
  }, gifts);
}

const scene = (page) => page.evaluate(() => (window as any).__arcadeScores__?.state ?? null);

test.beforeEach(async ({ page }) => loginAsPlaywright(page));

test('qualifying score asks for a name, saves it and closes on Enter', async ({ page }) => {
  await dieWithScore(page, 3);
  const input = page.locator('input.arcade-input');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('playwright');

  // Arrows must not restart the snake while typing.
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(false);

  await input.fill('Neo');
  const [post] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/api/scores/forste-advent') && r.method() === 'POST'),
    input.press('Enter'),
  ]);
  expect(post.postDataJSON()).toEqual({ name: 'Neo', score: 3 });
  await expect(input).toHaveCount(0);
  await expect.poll(() => scene(page)).toBe('list');
  const top = await page.request.get('/api/scores/forste-advent');
  expect((await top.json()).scores[0]).toMatchObject({ name: 'Neo', score: 3 });

  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page)).toBe(null);
  // Resume lands on the next frame, so retry the key until the snake runs again.
  await expect
    .poll(async () => {
      await page.keyboard.press('Space');
      return page.evaluate(() => (window as any).__snakeDebug__.isRunning());
    })
    .toBe(true);
});

test('zero score skips name entry and closes on tap', async ({ page }) => {
  await dieWithScore(page, 0);
  await expect.poll(() => scene(page)).toBe('list');
  await expect(page.locator('input.arcade-input')).toHaveCount(0);
  await page.locator('#snake-canvas').click();
  await expect.poll(() => scene(page)).toBe(null);
});
