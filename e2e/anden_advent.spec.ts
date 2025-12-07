import { test, expect } from '@playwright/test';

async function loginAndVisitAnden(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.fill('#name', 'playwright');
  await page.fill('#code', 'pw-test-123');
  const [loginResp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST'),
    page.click('button[type=submit]'),
  ]);
  const loginJson = await loginResp.json();
  if (!loginJson || !loginJson.success) {
    throw new Error('Login failed for Playwright test account: ' + JSON.stringify(loginJson));
  }

  await page.goto('/anden-advent');
}

test.describe('Anden Advent - config-driven rendering', () => {
  test('respects `reindeerSpriteScale` and computes anchors from config', async ({ page }) => {
    // Inject a small harness before any page script runs: wrap canvas context
    // to record draw calls and expose a helper to compute expected anchors.
    await page.addInitScript(() => {
      // lightweight debug log
      (window as any).__ANDEN_DEBUG__ = { drawCalls: [] };

      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: any, ...args: any[]) {
        const ctx = origGetContext.call(this, type, ...args);
        try {
          if (type === '2d' && ctx) {
            const origDrawImage = ctx.drawImage.bind(ctx);
            ctx.drawImage = function (img: any, ...rest: any[]) {
              try {
                // record: src (if available) and the dest args [dx,dy,dw,dh]
                (window as any).__ANDEN_DEBUG__.drawCalls.push({
                  type: 'drawImage',
                  src: img && img.src ? String(img.src) : null,
                  args: rest,
                });
              } catch (e) {}
              return origDrawImage.apply(this, [img, ...rest]);
            };

            const origFillRect = ctx.fillRect.bind(ctx);
            ctx.fillRect = function (x: number, y: number, w: number, h: number) {
              try {
                (window as any).__ANDEN_DEBUG__.drawCalls.push({ type: 'fillRect', x, y, w, h });
              } catch (e) {}
              return origFillRect.apply(this, [x, y, w, h]);
            };
          }
        } catch (e) {
          // ignore
        }
        return ctx;
      };

      // Helper to compute the expected leading reindeer X coordinate from config
      (window as any).__ANDEN_TEST__ = {
        expectedLeadX: (cfg: any) => {
          const canvas = document.getElementById('santa-canvas') as HTMLCanvasElement;
          const WIDTH = canvas ? (canvas.clientWidth || 400) : 400;
          const playerXRatio = cfg && typeof cfg.playerXRatio !== 'undefined' ? cfg.playerXRatio : 0.18;
          const leadOffsetXRatio = cfg && typeof cfg.leadOffsetXRatio !== 'undefined' ? cfg.leadOffsetXRatio : 0.145;
          const PLAYER_X = Math.round(WIDTH * playerXRatio);
          const LEAD_OFFSET_X = Math.round(WIDTH * leadOffsetXRatio);
          return PLAYER_X + LEAD_OFFSET_X;
        }
      };
    });

    // Start with a small reindeer scale so we can observe a change
    await page.addInitScript(() => {
      (window as any).__ANDEN_CONFIG__ = (window as any).__ANDEN_CONFIG__ || {};
      (window as any).__ANDEN_CONFIG__.reindeerSpriteScale = 0.5;
      (window as any).__ANDEN_CONFIG__.reindeerHitBoxScale = 0.5;
    });

    // Login first so the game route is accessible (pages are behind a simple login)
    await loginAndVisitAnden(page);
    const canvas = page.locator('#santa-canvas');
    await expect(canvas).toBeVisible();

    // Let the game run a little so draw calls are emitted
    await page.waitForTimeout(700);

    // Capture reindeer draw widths and leading X positions
    const smallDraws = await page.evaluate(() => {
      const calls = (window as any).__ANDEN_DEBUG__.drawCalls || [];
      const re = calls.filter((c: any) => c.type === 'drawImage' && c.src && c.src.includes('/static/sprites/reindeer'))
        .map((c: any) => ({ src: c.src, dx: c.args[0], dy: c.args[1], dw: c.args[2], dh: c.args[3] }));
      return re;
    });

    // There should be at least one reindeer draw recorded
    expect(smallDraws.length).toBeGreaterThan(0);

    // Compute expected anchor (lead X) from the page's config
    const expectedLeadXSmall = await page.evaluate(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      if (hooks && typeof hooks.getLeadAnchorX === 'function') {
        return hooks.getLeadAnchorX();
      }
      if (hooks && typeof hooks.expectedLeadX === 'function') {
        return hooks.expectedLeadX((window as any).__ANDEN_CONFIG__ || {});
      }
      return 0;
    });

    // Verify at least one draw occurs near the expected lead X
    const leadSmall = smallDraws.filter((d: any) => typeof d.src === 'string' && d.src.includes('reindeer1'));
    const nearSmall = leadSmall.some(
      (d: any) => Math.abs((d.dx || 0) + (d.dw || 0) / 2 - expectedLeadXSmall) <= 12,
    );
    expect(nearSmall).toBeTruthy();

    // Reset recorded calls and change the reindeer scale to be larger, then re-layout
    await page.evaluate(() => { (window as any).__ANDEN_DEBUG__.drawCalls = []; (window as any).__ANDEN_CONFIG__.reindeerSpriteScale = 1.2; (window as any).__ANDEN_CONFIG__.reindeerHitBoxScale = 1.0; window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(700);

    const largeDraws = await page.evaluate(() => {
      const calls = (window as any).__ANDEN_DEBUG__.drawCalls || [];
      return calls.filter((c: any) => c.type === 'drawImage' && c.src && c.src.includes('/static/sprites/reindeer'))
        .map((c: any) => ({ src: c.src, dx: c.args[0], dy: c.args[1], dw: c.args[2], dh: c.args[3] }));
    });

    expect(largeDraws.length).toBeGreaterThan(0);

    // Compare a representative width from the two runs. Expect the second to be larger.
    const smallW = smallDraws[0].dw || 0;
    const largeW = largeDraws[0].dw || 0;
    expect(largeW).toBeGreaterThan(smallW);

    const aspectRatios = [...smallDraws, ...largeDraws]
      .filter((d: any) => (d.dw || 0) > 0)
      .map((d: any) => (d.dh || 0) / (d.dw || 1));
    expect(aspectRatios.length).toBeGreaterThan(0);
    aspectRatios.forEach((ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(1.3);
    });
  });

  test('renders a tall canvas that spans the full width of its holder', async ({ page }) => {
    await loginAndVisitAnden(page);
    const canvas = page.locator('#santa-canvas');
    await expect(canvas).toBeVisible();

    const metrics = await canvas.evaluate((el) => {
      const parent = el.parentElement as HTMLElement | null;
      const computedWidth = parseFloat(getComputedStyle(el).width || '0');
      const clientWidth = el.clientWidth;
      const clientHeight = el.clientHeight;
      const rect = el.getBoundingClientRect();
      return {
        computedWidth,
        clientWidth,
        clientHeight,
        boundingWidth: rect.width,
        boundingHeight: rect.height,
        parentWidth: parent ? parent.clientWidth : null,
      };
    });

    expect(metrics.clientWidth).toBeGreaterThan(0);
    // Allow minor rounding error when comparing width vs parent width.
    if (metrics.parentWidth !== null) {
      expect(Math.abs(metrics.computedWidth - metrics.parentWidth)).toBeLessThanOrEqual(1.5);
    }
    // Height must be at least twice the width (rounded to avoid DPR drift).
    expect(metrics.clientHeight).toBeGreaterThanOrEqual(metrics.clientWidth * 2 - 1);
    expect(metrics.boundingHeight).toBeGreaterThanOrEqual(metrics.boundingWidth * 2 - 1);

    const viewportHeight = await page.evaluate(() => window.innerHeight || 0);
    expect(metrics.boundingHeight).toBeLessThanOrEqual(Math.max(0, viewportHeight - 40));

    const pixelMapping = await canvas.evaluate((el) => {
      const dpr = window.devicePixelRatio || 1;
      return {
        attrWidth: el.width,
        attrHeight: el.height,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        dpr,
      };
    });
    const tolerance = Math.max(4, pixelMapping.dpr * 2.5);
    expect(Math.abs(pixelMapping.attrWidth - pixelMapping.clientWidth * pixelMapping.dpr)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(pixelMapping.attrHeight - pixelMapping.clientHeight * pixelMapping.dpr)).toBeLessThanOrEqual(tolerance);
    expect(pixelMapping.attrHeight).toBeGreaterThanOrEqual(pixelMapping.attrWidth * 2 - tolerance);
  });

  test('chimney gaps gain 50% more height for the taller canvas', async ({ page }) => {
    await loginAndVisitAnden(page);
    await page.waitForFunction(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      return hooks && typeof hooks.getGapInfo === 'function';
    });
    const info = await page.evaluate(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      return hooks.getGapInfo();
    });
    expect(info).toBeTruthy();
    const EXPECTED_RATIO = 0.275 * 1.5;
    const expectedGap = info.width * EXPECTED_RATIO;
    const tolerance = Math.max(2, info.width * 0.01);
    expect(info.gap).toBeGreaterThanOrEqual(expectedGap - tolerance);
    expect(info.gap).toBeLessThanOrEqual(expectedGap + tolerance);
  });

  test('can drop from a top gap to a bottom gap between chimneys', async ({ page }) => {
    await loginAndVisitAnden(page);
    await page.waitForFunction(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      return (
        hooks &&
        typeof hooks.setLeadState === 'function' &&
        typeof hooks.getGapInfo === 'function'
      );
    });
    const traversed = await page.evaluate(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      const info = hooks.getGapInfo();
      const spanMs = (hooks.getSpawnIntervalMs() || 3200) * 1.1;
      hooks.forceStop();
      hooks.setLeadState(info.gap / 2 + 4, 0);
      const bottomTarget = info.height - info.gap / 2 - 4;
      const step = 16;
      let elapsed = 0;
      let reached = false;
      while (elapsed < spanMs) {
        hooks.stepPhysics(step);
        const state = hooks.getLeadState();
        if (state.y >= bottomTarget) {
          reached = true;
          break;
        }
        elapsed += step;
      }
      hooks.setRunning(true);
      return reached;
    });
    expect(traversed).toBeTruthy();
  });

  test('can rise from a bottom gap to a top gap with timely taps', async ({ page }) => {
    await loginAndVisitAnden(page);
    await page.waitForFunction(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      return (
        hooks &&
        typeof hooks.flapNow === 'function' &&
        typeof hooks.setLeadState === 'function' &&
        typeof hooks.getLeadState === 'function'
      );
    });
    const climbed = await page.evaluate(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      const info = hooks.getGapInfo();
      const spanMs = (hooks.getSpawnIntervalMs() || 3200) * 1.1;
      const targetY = info.gap / 2 + 6;
      const startY = info.height - info.gap / 2 - 6;
      hooks.forceStop();
      hooks.setLeadState(startY, 0);
      const step = 16;
      let elapsed = 0;
      let reached = false;
      let nextFlap = 0;
      while (elapsed < spanMs) {
        const state = hooks.getLeadState();
        if (state.y <= targetY) {
          reached = true;
          break;
        }
        if (elapsed >= nextFlap) {
          hooks.flapNow();
          nextFlap = elapsed + 110;
        }
        hooks.stepPhysics(step);
        elapsed += step;
      }
      hooks.setRunning(true);
      return reached;
    });
    expect(climbed).toBeTruthy();
  });

  test('tapping at the bottom edge of a gap keeps Santa inside the gap', async ({ page }) => {
    await loginAndVisitAnden(page);
    await page.waitForFunction(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      return (
        hooks &&
        typeof hooks.flapNow === 'function' &&
        typeof hooks.setLeadState === 'function'
      );
    });
    const stayedInside = await page.evaluate(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      const info = hooks.getGapInfo();
      const topEdge = 30;
      const bottomEdge = topEdge + info.gap;
      hooks.forceStop();
      hooks.setLeadState(bottomEdge - 1, 0);
      hooks.flapNow();
      let safe = true;
      const step = 16;
      const duration = 420;
      let elapsed = 0;
      while (elapsed < duration) {
        hooks.stepPhysics(step);
        const state = hooks.getLeadState();
        if (state.y < topEdge - 2 || state.y > bottomEdge + 2) {
          safe = false;
          break;
        }
        elapsed += step;
      }
      hooks.setRunning(true);
      return safe;
    });
    expect(stayedInside).toBeTruthy();
  });

  test('chimneys spawn farther apart to match the taller arena', async ({ page }) => {
    await loginAndVisitAnden(page);
    const spawnInterval = await page.evaluate(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      if (hooks && typeof hooks.getSpawnIntervalMs === 'function') {
        return hooks.getSpawnIntervalMs();
      }
      return null;
    });

    expect(spawnInterval).not.toBeNull();
    expect(spawnInterval || 0).toBeGreaterThanOrEqual(2800);
  });
});
