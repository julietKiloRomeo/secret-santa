import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/');
  await page.fill('#name', 'playwright');
  await page.fill('#code', 'pw-test-123');
  const [loginResp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST'),
    page.click('button[type=submit]'),
  ]);
  if (!loginResp.ok()) {
    throw new Error(`Login failed with status ${loginResp.status()}`);
  }
}

test.describe('Snake grid integrity', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('grid rows align with the visible canvas area', async ({ page }) => {
    await page.goto('/forste-advent');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });

    const metrics = await page.evaluate(() => {
      const canvas = document.getElementById('snake-canvas');
      // @ts-ignore debug accessor is injected by the game script
      const grid = window.__snakeDebug__?.getGrid?.();
      return {
        rows: grid?.rows,
        cols: grid?.cols,
        cell: grid?.cell,
        boardHeight: grid ? grid.rows * grid.cell : null,
        boardWidth: grid ? grid.cols * grid.cell : null,
        canvasHeight: canvas?.clientHeight || null,
      };
    });

    expect(metrics.rows).toBe(metrics.cols);
    expect(metrics.rows).toBeGreaterThanOrEqual(10);
    expect(metrics.boardHeight).toBeLessThanOrEqual((metrics.canvasHeight || 0) + 2);
  });

  test('gifts never spawn on the snake or outside the grid', async ({ page }) => {
    await page.goto('/forste-advent');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });

    const stats = await page.evaluate(() => {
      // @ts-ignore debug accessor is injected by the game script
      const debug = window.__snakeDebug__;
      if (!debug) {
        return { overlap: -1, outOfBounds: -1 };
      }
      let overlap = 0;
      let outOfBounds = 0;
      const grid = debug.getGrid?.();
      const snake = debug.getSnakeCoords?.() || [];
      for (let i = 0; i < 150; i++) {
        const gift = debug.rerollGift?.();
        if (!gift) continue;
        if (gift.x < 0 || gift.y < 0 || !grid || gift.x >= grid.cols || gift.y >= grid.rows) {
          outOfBounds += 1;
        }
        if (snake.some((seg) => seg.x === gift.x && seg.y === gift.y)) {
          overlap += 1;
        }
      }
      return { overlap, outOfBounds };
    });

    expect(stats.overlap).toBe(0);
    expect(stats.outOfBounds).toBe(0);
  });
});
