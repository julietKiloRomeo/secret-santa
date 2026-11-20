import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

test('snake does not leave sticky pixels after resize', async ({ page }) => {
  test.slow();
  // Login
  await loginAsPlaywright(page);

  const viewports = [
    { w: 360, h: 640 },
    { w: 390, h: 844 },
    { w: 414, h: 896 },
    { w: 768, h: 1024 },
    { w: 1024, h: 768 },
  ];

  for (const v of viewports) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.goto('/advent-1');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });
    await page.waitForTimeout(150);

    // sample function
    const sample = await page.evaluate(() => {
      const canvas = document.getElementById('snake-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      // @ts-ignore board size comes from the game, which now matches the screen aspect
      const grid = window.__snakeDebug__?.getGrid?.();
      const cols = grid?.cols ?? 20;
      const rows = grid?.rows ?? 20;
      // Cells are square: the smaller of width/height per cell sets their size on landscape screens.
      // Sample the drawing buffer (canvas.width/height), not the on-screen size: Phaser scales the buffer up to fit.
      const CELL = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
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
      // @ts-ignore board size comes from the game, which now matches the screen aspect
      const grid = window.__snakeDebug__?.getGrid?.();
      const cols = grid?.cols ?? 20;
      const rows = grid?.rows ?? 20;
      // Cells are square: the smaller of width/height per cell sets their size on landscape screens.
      // Sample the drawing buffer (canvas.width/height), not the on-screen size: Phaser scales the buffer up to fit.
      const CELL = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
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
    // Also fetch the game's current snake coordinates and consider any
    // green cells that are not part of the live snake to be sticky.
    const snakeCoords = await page.evaluate(() => {
      // @ts-ignore
      return (window.__snakeDebug__?.getSnakeCoords?.() || []).map((p: any) => `${p.x},${p.y}`);
    });
    const stickyNotSnake = Object.entries(after).filter(([k, hex]) => snakeHexes.has(hex) && !snakeCoords.includes(k)).map(([k]) => k);
    if (stickyNotSnake.length) {
      // Capture debug information from the page and save a screenshot
      const debugInfo = await page.evaluate(() => {
        const c = document.getElementById('snake-canvas') as HTMLCanvasElement;
        return {
          canvasWidth: c.width,
          canvasHeight: c.height,
          clientWidth: c.clientWidth,
          clientHeight: c.clientHeight,
          dpr: window.devicePixelRatio || 1,
          parentClientWidth: c.parentElement ? c.parentElement.clientWidth : null,
        };
      });
      console.log('DEBUG CANVAS:', JSON.stringify(debugInfo, null, 2));
      const details = stillSticky.map(coord => ({ coord, before: sample.map[coord], after: after[coord] || null }));
      console.log('DEBUG STICKY DETAILS:', JSON.stringify(details, null, 2));
      console.log('DEBUG SNAKE COORDS:', JSON.stringify(snakeCoords));
      console.log('DEBUG STICKY_NOT_SNAKE:', JSON.stringify(stickyNotSnake));
      const path = `out/snake_sticky_${v.w}x${v.h}.png`;
      await page.screenshot({ path, fullPage: false });
      throw new Error(`Found sticky snake pixels after resize for viewport ${v.w}x${v.h}: ${stillSticky.slice(0,10).join('; ')} (stickyNotSnake: ${stickyNotSnake.slice(0,10).join('; ')} -- screenshot: ${path})`);
    }
  }
});
