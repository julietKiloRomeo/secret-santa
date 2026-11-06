import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

const tap = (page) => page.locator('canvas').first().click();

type Snap = { state: string; y: number; score: number; chimneys: number; scale: number } | null;

const snap = (page) => page.evaluate(() => (window as any).__andenDebug__.snapshot() as Snap);

test.describe('Flappy Santa', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlaywright(page);
    await page.goto('/anden-advent');
    await expect.poll(() => snap(page)).toMatchObject({ state: 'grace' });
  });

  test('a tap during grace starts the run and lifts the bird at once', async ({ page }) => {
    await tap(page);
    await expect.poll(async () => (await snap(page))?.state).toBe('playing');
    const afterTap = (await snap(page))!.y;
    await page.waitForTimeout(120);
    expect((await snap(page))!.y).toBeLessThan(afterTap + 1);
  });

  test('without taps the bird falls and the run ends on the floor', async ({ page }) => {
    await tap(page);
    await expect.poll(async () => (await snap(page))?.state, { timeout: 8000 }).toBe('dead');
  });

  test('a qualifying game over opens the score screen with a name prompt', async ({ page }) => {
    await page.route('**/api/scores/anden-advent', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { game: 'anden-advent', scores: [] } })
        : route.fulfill({ json: { success: true } }),
    );
    // Fly into the floor: the run ends with score 0, which must not qualify.
    await tap(page);
    await expect.poll(async () => (await snap(page))?.state, { timeout: 8000 }).toBe('dead');
    await expect(page.locator('input.arcade-input')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => (window as any).__arcadeScores__?.state), { timeout: 5000 })
      .toBe('list');
  });

  test('canvas keeps its run when the window is resized', async ({ page }) => {
    await tap(page);
    await expect.poll(async () => (await snap(page))?.state).toBe('playing');
    await page.setViewportSize({ width: 390, height: 700 });
    await page.waitForTimeout(200);
    expect((await snap(page))?.state).toBe('playing');
  });
});
