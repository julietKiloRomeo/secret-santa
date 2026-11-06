import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

type Snap = {
  state: string;
  time: number;
  score: number;
  lives: number;
  next: { lane: number; start: number } | null;
} | null;
const snap = (page) => page.evaluate(() => (window as any).__jbhDebug__.snapshot() as Snap);

test.describe('Jingle Bell Hero', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlaywright(page);
    await page.goto('/tredje-advent');
    // Songs are loaded once the start prompt appears; key presses before that are ignored.
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForFunction(() => Boolean((window as any).__jbhDebug__));
    await page.waitForTimeout(800);
  });

  test('pressing a key starts the first level', async ({ page }) => {
    await page.keyboard.press('d');
    await expect.poll(async () => (await snap(page))?.state).toBe('playing');
  });

  test('pressing the right lane on time scores points', async ({ page }) => {
    await page.keyboard.press('d');
    await expect.poll(async () => (await snap(page))?.next).not.toBeNull();
    const first = (await snap(page))!.next!;
    // Wait for the note to reach the hit line, then press its lane key.
    await expect
      .poll(async () => (await snap(page))!.time, { timeout: 10000 })
      .toBeGreaterThan(first.start - 0.05);
    const keyFor = ['d', 'f', 'j', 'k'][first.lane - 1];
    await page.keyboard.press(keyFor);
    await expect.poll(async () => (await snap(page))!.score, { timeout: 2000 }).toBeGreaterThan(0);
  });

  test('a press on an empty lane is a miss, not a score', async ({ page }) => {
    await page.keyboard.press('d');
    await expect.poll(async () => (await snap(page))?.state).toBe('playing');
    await page.keyboard.press('k');
    await expect.poll(async () => (await snap(page))?.lives).toBe(3);
    expect((await snap(page))!.score).toBe(0);
  });
});
