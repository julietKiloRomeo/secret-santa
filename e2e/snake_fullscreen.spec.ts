import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';


test.describe('Snake fullscreen experience', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlaywright(page);
  });

  test('renders fullscreen stage without legacy controls', async ({ page }) => {
    await page.goto('/forste-advent');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });

    const hasFullscreenClass = await page.evaluate(() => document.body.classList.contains('arcade-fullscreen'));
    expect(hasFullscreenClass).toBeTruthy();

    const bodyOverflowY = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    expect(['hidden', 'clip']).toContain(bodyOverflowY);

    await expect(page.locator('#snake-controls')).toHaveCount(0);

    const stageCoverage = await page.evaluate(() => {
      const stage = document.getElementById('snake-stage');
      if (!stage) return 0;
      const rect = stage.getBoundingClientRect();
      return rect.height / window.innerHeight;
    });
    expect(stageCoverage).toBeGreaterThan(0.8);
  });

  test('swiping on canvas changes direction without scrolling', async ({ page }) => {
    await page.goto('/forste-advent');
    const canvas = page.locator('#snake-canvas');
    await canvas.waitFor({ state: 'visible' });

    const initialScroll = await page.evaluate(() => window.scrollY);
    expect(initialScroll).toBe(0);

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    const centerX = box.x + box.width / 2;
    const startY = box.y + box.height - 10;
    const endY = box.y + 10;

    await page.mouse.move(centerX, startY);
    await page.mouse.down();
    await page.mouse.move(centerX, endY, { steps: 5 });
    await page.mouse.up();

    const pending = await page.evaluate(() => {
      // @ts-ignore
      return window.__snakeDebug__?.getPendingDirection?.();
    });
    expect(pending).toBe('up');

    const scrollAfterSwipe = await page.evaluate(() => window.scrollY);
    expect(scrollAfterSwipe).toBe(0);
  });
});
