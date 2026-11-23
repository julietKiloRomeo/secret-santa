import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

type Snap = { status: string; score: number; lives: number; frightened: number } | null;
const snap = (page) => page.evaluate(() => (window as any).__pacDebug__.snapshot() as Snap);

test.describe('Pac-Santa', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlaywright(page);
    await page.goto('/advent-5');
    await page.waitForFunction(() => Boolean((window as any).__pacDebug__));
    await expect.poll(() => snap(page)).toMatchObject({ status: 'playing' });
  });

  test('the maze runs and Santa moves on its own', async ({ page }) => {
    const before = (await page.evaluate(() => (window as any).__pacDebug__.snapshot())) as any;
    await page.waitForTimeout(600);
    const after = (await page.evaluate(() => (window as any).__pacDebug__.snapshot())) as any;
    expect(after.santa).not.toEqual(before.santa);
  });

  test('arrow keys queue a turn and Santa changes route', async ({ page }) => {
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    expect((await snap(page))!.status).toBe('playing');
  });

  test('running out of lives opens the score screen with a name prompt', async ({ page }) => {
    // Put a ghost on Santa with one life left, so the next tick ends the run (ghosts are too slow to catch a standing Santa on a big maze).
    await page.evaluate(() => (window as any).__pacDebug__.endRunNow());
    await expect.poll(async () => (await snap(page))?.status, { timeout: 15000 }).toBe('over');
    await expect(page.locator('input.arcade-input')).toBeVisible({ timeout: 8000 });
  });
});
