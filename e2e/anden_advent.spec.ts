import { test, expect } from '@playwright/test';

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
    await page.goto('/');
    await page.fill('#name', 'playwright');
    await page.fill('#code', 'pw-test-123');
    const [loginResp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST'),
      page.click('button[type=submit]'),
    ]);
    const loginJson = await loginResp.json();
    if (!loginJson || !loginJson.success) throw new Error('Login failed for Playwright test account: ' + JSON.stringify(loginJson));

    await page.goto('/anden-advent');
    const canvas = page.locator('#santa-canvas');
    await expect(canvas).toBeVisible();

    // Let the game run a little so draw calls are emitted
    await page.waitForTimeout(700);

    // Capture reindeer draw widths and leading X positions
    const smallDraws = await page.evaluate(() => {
      const calls = (window as any).__ANDEN_DEBUG__.drawCalls || [];
      const re = calls.filter((c: any) => c.type === 'drawImage' && c.src && c.src.includes('/static/sprites/reindeer'))
        .map((c: any) => ({ dx: c.args[0], dy: c.args[1], dw: c.args[2], dh: c.args[3] }));
      return re;
    });

    // There should be at least one reindeer draw recorded
    expect(smallDraws.length).toBeGreaterThan(0);

    // Compute expected anchor (lead X) from the page's config
    const expectedLeadXSmall = await page.evaluate(() => {
      return (window as any).__ANDEN_TEST__.expectedLeadX((window as any).__ANDEN_CONFIG__ || {});
    });

    // Verify at least one draw occurs near the expected lead X
    const nearSmall = smallDraws.some((d: any) => Math.abs(d.dx - expectedLeadXSmall) <= 8);
    expect(nearSmall).toBeTruthy();

    // Reset recorded calls and change the reindeer scale to be larger, then re-layout
    await page.evaluate(() => { (window as any).__ANDEN_DEBUG__.drawCalls = []; (window as any).__ANDEN_CONFIG__.reindeerSpriteScale = 1.2; (window as any).__ANDEN_CONFIG__.reindeerHitBoxScale = 1.0; window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(700);

    const largeDraws = await page.evaluate(() => {
      const calls = (window as any).__ANDEN_DEBUG__.drawCalls || [];
      return calls.filter((c: any) => c.type === 'drawImage' && c.src && c.src.includes('/static/sprites/reindeer'))
        .map((c: any) => ({ dx: c.args[0], dy: c.args[1], dw: c.args[2], dh: c.args[3] }));
    });

    expect(largeDraws.length).toBeGreaterThan(0);

    // Compare a representative width from the two runs. Expect the second to be larger.
    const smallW = smallDraws[0].dw || 0;
    const largeW = largeDraws[0].dw || 0;
    expect(largeW).toBeGreaterThan(smallW);
  });
});
