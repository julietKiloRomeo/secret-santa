import { test, expect } from '@playwright/test';

// Detects whether canvas cells that previously contained snake pixels
// leave behind colored artifacts after the snake moves away.
test('snake canvas does not leave sticky pixels after movement', async ({ page }) => {
  await page.goto('/forste-advent');
  await page.waitForSelector('#snake-canvas', { state: 'visible' });
  // allow JS resize/init to complete
  await page.waitForTimeout(200);

  // Helper to sample the canvas at integer grid cell centers and return
  // an array of hex colors keyed by x,y.
  const sampleGrid = await page.evaluate(() => {
    const canvas = document.getElementById('snake-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    // derive CELL and GRID from page globals where possible
    // fallback to sampling by inspecting canvas visible size and number of cols
    // The game exposes GRID and CELL as closures; we approximate by using
    // the rendered grid visible via the canvas client size and the known
    // number of columns used by the game (20).
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

  // Find cells currently occupied by snake (head + body) by sampling
  const snakeCells = await page.evaluate(() => {
    // @ts-ignore
    const debug = window.__snakeDebug__;
    if (!debug) return [];
    // We can't access internal snake coords from the closure directly,
    // but the debug API provides tick and some helpers. To be deterministic
    // we will probe the canvas pixels to find the snake color used.
    return [];
  });

  // Instead, find the snake color by inspecting the center where the head
  // is drawn: use the debug API to get head coordinates via reading the
  // rendered pixels across the grid and picking a non-bg color that matches
  // the snake palette roughly.
  const initialColors = sampleGrid.map;

  // Find likely snake cells by picking pixels that match the known snake green
  // (#2c8a2c) or the edge color (#1e5e1e). We'll construct a set of coordinates
  // that have those colors.
  const snakeHexCandidates = new Set(['#2c8a2c', '#1e5e1e']);
  const occupied = Object.entries(initialColors).filter(([, hex]) => snakeHexCandidates.has(hex)).map(([k]) => k);

  // Advance the game several ticks to force the snake to move away from those cells
  await page.evaluate(() => {
    // @ts-ignore
    for (let i = 0; i < 6; i++) window.__snakeDebug__?.tickOnce?.();
  });
  await page.waitForTimeout(50);

  // Resample
  const after = await page.evaluate((_) => {
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

  // For each previously-occupied coordinate ensure it's no longer snake color
  const stillSticky = occupied.filter(coord => after[coord] && ['#2c8a2c', '#1e5e1e'].includes(after[coord]));
  expect(stillSticky).toEqual([]);
});
