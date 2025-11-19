import { test, expect } from '@playwright/test';

test('snake does not leave sticky pixels after resize', async ({ page }) => {
  test.slow();
  // Login
  await page.goto('/');
  await page.fill('#name', 'playwright');
  await page.fill('#code', 'pw-test-123');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST'),
    page.click('button[type=submit]'),
  ]);

  const viewports = [
    { w: 360, h: 640 },
    { w: 390, h: 844 },
    { w: 414, h: 896 },
    { w: 768, h: 1024 },
    { w: 1024, h: 768 },
  ];

  for (const v of viewports) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.goto('/forste-advent');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });
    await page.waitForTimeout(150);

    // sample function
    const sample = await page.evaluate(() => {
      const canvas = document.getElementById('snake-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const NUM_COLS = 20;
      const CELL = Math.max(6, Math.floor((canvas.clientWidth || 200) / NUM_COLS));
      const cols = NUM_COLS;
      const rows = Math.ceil((canvas.clientHeight || 200) / CELL);
      function rgbaToHex(data: Uint8ClampedArray, idx: number) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
      }
      const out: Record<string, string> = {};
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cx = Math.floor(x * CELL + CELL / 2);
          const cy = Math.floor(y * CELL + CELL / 2);
          const data = ctx.getImageData(cx, cy, 1, 1).data;
          out[`${x},${y}`] = rgbaToHex(data, 0);
        }
      }
      return { CELL, cols, rows, map: out };
    });

    const snakeHexes = new Set(['#2c8a2c', '#1e5e1e']);
    const occupied = Object.entries(sample.map).filter(([, hex]) => snakeHexes.has(hex)).map(([k]) => k);

    // Move the snake several steps away
    await page.evaluate(() => { /* @ts-ignore */ for (let i = 0; i < 8; i++) window.__snakeDebug__?.tickOnce?.(); });
    await page.waitForTimeout(60);

    // Now trigger a resize to a slightly different size to exercise the
    // canvas resize logic (simulate user rotating/resizing device)
    await page.setViewportSize({ width: v.w + 37, height: v.h + 23 });
    await page.waitForTimeout(120);

    const after = await page.evaluate(() => {
      const canvas = document.getElementById('snake-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const NUM_COLS = 20;
      const CELL = Math.max(6, Math.floor((canvas.clientWidth || 200) / NUM_COLS));
      const cols = NUM_COLS;
      const rows = Math.ceil((canvas.clientHeight || 200) / CELL);
      function rgbaToHex(data: Uint8ClampedArray, idx: number) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
      }
      const out: Record<string, string> = {};
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cx = Math.floor(x * CELL + CELL / 2);
          const cy = Math.floor(y * CELL + CELL / 2);
          const data = ctx.getImageData(cx, cy, 1, 1).data;
          out[`${x},${y}`] = rgbaToHex(data, 0);
        }
      }
      return out;
    });

    const stillSticky = occupied.filter(coord => after[coord] && snakeHexes.has(after[coord]));
    if (stillSticky.length) {
      // Save a screenshot for debugging
      const path = `out/snake_sticky_${v.w}x${v.h}.png`;
      await page.screenshot({ path, fullPage: false });
      throw new Error(`Found sticky snake pixels after resize for viewport ${v.w}x${v.h}: ${stillSticky.slice(0,10).join('; ')} (screenshot: ${path})`);
    }
  }
});
