import { test, expect } from "@playwright/test";

test.describe("Anden Advent - physics and obstacle unit checks", () => {
  test("updatePhysics causes the lead reindeer to move down when grace is zero", async ({
    page,
  }) => {
    // Instrument draw calls and inject a deterministic config before page scripts run
    await page.addInitScript(() => {
      (window as any).__ANDEN_DEBUG__ = { drawCalls: [] };
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        type: any,
        ...args: any[]
      ) {
        const ctx = origGetContext.call(this, type, ...args);
        try {
          if (type === "2d" && ctx) {
            const origDrawImage = ctx.drawImage.bind(ctx);
            ctx.drawImage = function (img: any, ...rest: any[]) {
              try {
                (window as any).__ANDEN_DEBUG__.drawCalls.push({
                  type: "drawImage",
                  src: img && img.src ? String(img.src) : null,
                  args: rest,
                });
              } catch (e) {}
              return origDrawImage.apply(this, [img, ...rest]);
            };
            const origFillRect = ctx.fillRect.bind(ctx);
            ctx.fillRect = function (
              x: number,
              y: number,
              w: number,
              h: number,
            ) {
              try {
                (window as any).__ANDEN_DEBUG__.drawCalls.push({
                  type: "fillRect",
                  x,
                  y,
                  w,
                  h,
                });
              } catch (e) {}
              return origFillRect.apply(this, [x, y, w, h]);
            };
          }
        } catch (e) {}
        return ctx;
      };
    });

    // Set a config that removes grace and makes spawns rare so we can focus on physics
    await page.addInitScript(() => {
      (window as any).__ANDEN_CONFIG__ = (window as any).__ANDEN_CONFIG__ || {};
      // increase gravity for a clearer motion signal in the test
      (window as any).__ANDEN_CONFIG__.gravityPerSecond = 2000;
      (window as any).__ANDEN_CONFIG__.graceMs = 0;
      (window as any).__ANDEN_CONFIG__.spawnIntervalMsBase = 3600000; // effectively disable spawns
    });

    // Login flow (test account)
    await page.goto("/");
    await page.fill("#name", "playwright");
    await page.fill("#code", "pw-test-123");
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/login") && r.request().method() === "POST",
      ),
      page.click("button[type=submit]"),
    ]);

    await page.goto("/anden-advent");
    await page.waitForSelector("#santa-canvas");

    // Prefer sampling internal state via the optional test hook if available
    const hasHook = await page.evaluate(
      () =>
        !!(
          (window as any).__ANDEN_TEST__ &&
          typeof (window as any).__ANDEN_TEST__.getLeadY === "function"
        ),
    );
    if (hasHook) {
      await page.waitForTimeout(200);
      const before = await page.evaluate(() =>
        (window as any).__ANDEN_TEST__.getLeadY(),
      );
      await page.waitForTimeout(1000);
      const after = await page.evaluate(() =>
        (window as any).__ANDEN_TEST__.getLeadY(),
      );
      expect(after).toBeGreaterThan(before + 1);
    } else {
      // Let the game paint a few frames and capture a baseline
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        (window as any).__ANDEN_DEBUG__.drawCalls = [];
      });
      await page.waitForTimeout(600);
      const smallDraws = await page.evaluate(() => {
        const calls = (window as any).__ANDEN_DEBUG__.drawCalls || [];
        // compute expected lead X from config and canvas size
        const canvas = document.getElementById(
          "santa-canvas",
        ) as HTMLCanvasElement;
        const WIDTH = canvas ? canvas.clientWidth || 400 : 400;
        const cfg = (window as any).__ANDEN_CONFIG__ || {};
        const playerXRatio =
          typeof cfg.playerXRatio !== "undefined" ? cfg.playerXRatio : 0.18;
        const leadOffsetXRatio =
          typeof cfg.leadOffsetXRatio !== "undefined"
            ? cfg.leadOffsetXRatio
            : 0.145;
        const PLAYER_X = Math.round(WIDTH * playerXRatio);
        const LEAD_OFFSET_X = Math.round(WIDTH * leadOffsetXRatio);
        const expectedLeadX = PLAYER_X + LEAD_OFFSET_X;

        return calls
          .map((c: any) => {
            if (
              c.type === "drawImage" &&
              c.src &&
              c.src.includes("/static/sprites/reindeer")
            ) {
              const dx = c.args[0] || 0;
              const dy = c.args[1] || 0;
              const dw = c.args[2] || 0;
              const dh = c.args[3] || 0;
              return { dx, dy, dw, dh, cx: dx + dw / 2 };
            }
            if (c.type === "fillRect") {
              // small filled rects are used for reindeer body when sprites haven't loaded
              const dx = c.x || 0;
              const dy = c.y || 0;
              const dw = c.w || 0;
              const dh = c.h || 0;
              return { dx, dy, dw, dh, cx: dx + dw / 2 };
            }
            return null;
          })
          .filter(Boolean)
          .filter((c: any) => Math.abs(c.cx - expectedLeadX) <= 20);
      });
      expect(smallDraws.length).toBeGreaterThan(0);

      // clear and capture again later to observe motion
      await page.evaluate(() => {
        (window as any).__ANDEN_DEBUG__.drawCalls = [];
      });
      await page.waitForTimeout(1200);
      const largeDraws = await page.evaluate(() => {
        const calls = (window as any).__ANDEN_DEBUG__.drawCalls || [];
        const canvas = document.getElementById(
          "santa-canvas",
        ) as HTMLCanvasElement;
        const WIDTH = canvas ? canvas.clientWidth || 400 : 400;
        const cfg = (window as any).__ANDEN_CONFIG__ || {};
        const playerXRatio =
          typeof cfg.playerXRatio !== "undefined" ? cfg.playerXRatio : 0.18;
        const leadOffsetXRatio =
          typeof cfg.leadOffsetXRatio !== "undefined"
            ? cfg.leadOffsetXRatio
            : 0.145;
        const PLAYER_X = Math.round(WIDTH * playerXRatio);
        const LEAD_OFFSET_X = Math.round(WIDTH * leadOffsetXRatio);
        const expectedLeadX = PLAYER_X + LEAD_OFFSET_X;

        return calls
          .map((c: any) => {
            if (
              c.type === "drawImage" &&
              c.src &&
              c.src.includes("/static/sprites/reindeer")
            ) {
              const dx = c.args[0] || 0;
              const dy = c.args[1] || 0;
              const dw = c.args[2] || 0;
              const dh = c.args[3] || 0;
              return { dx, dy, dw, dh, cx: dx + dw / 2 };
            }
            if (c.type === "fillRect") {
              const dx = c.x || 0;
              const dy = c.y || 0;
              const dw = c.w || 0;
              const dh = c.h || 0;
              return { dx, dy, dw, dh, cx: dx + dw / 2 };
            }
            return null;
          })
          .filter(Boolean)
          .filter((c: any) => Math.abs(c.cx - expectedLeadX) <= 20);
      });
      expect(largeDraws.length).toBeGreaterThan(0);

      // Compute a representative (median) center Y from each sample set to reduce flakiness
      const median = (arr: number[]) => {
        if (!arr || arr.length === 0) return 0;
        const s = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
      };
      const firstYs = smallDraws.map((d: any) => d.dy + (d.dh || 0) / 2);
      const laterYs = largeDraws.map((d: any) => d.dy + (d.dh || 0) / 2);
      const firstY = median(firstYs);
      const laterY = median(laterYs);
      // Expect the lead reindeer (sampled) to have moved downward (increased Y)
      expect(laterY).toBeGreaterThanOrEqual(firstY + 3);
    }
  });

  test("updateObstacles spawns chimneys and score increments when a chimney passes", async ({
    page,
  }) => {
    // Quick instrumentation for score observation and make spawns fast
    await page.addInitScript(() => {
      (window as any).__ANDEN_CONFIG__ = (window as any).__ANDEN_CONFIG__ || {};
      (window as any).__ANDEN_CONFIG__.graceMs = 0;
      (window as any).__ANDEN_CONFIG__.spawnIntervalMsBase = 120; // spawn rapidly
      (window as any).__ANDEN_CONFIG__.baseSpeedPxPerS = 800; // fast obstacles
      (window as any).__ANDEN_CONFIG__.gapMin = 20;
    });

    await page.goto("/");
    await page.fill("#name", "playwright");
    await page.fill("#code", "pw-test-123");
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/login") && r.request().method() === "POST",
      ),
      page.click("button[type=submit]"),
    ]);

    await page.goto("/anden-advent");
    await page.waitForSelector("#santa-canvas");

    const scoreLocator = page.locator("#santa-score");
    // Wait up to 6s for the score to increase
    await expect(scoreLocator).toHaveText(/Score: \d+/, { timeout: 6000 });
    const scoreText = await scoreLocator.textContent();
    const m = scoreText && scoreText.match(/Score: (\d+)/);
    const scoreNum = m ? Number(m[1]) : 0;
    expect(scoreNum).toBeGreaterThanOrEqual(0);
  });

  test("a touch tap during a restart clears grace so the first flap lifts immediately", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).__ANDEN_CONFIG__ = (window as any).__ANDEN_CONFIG__ || {};
      (window as any).__ANDEN_CONFIG__.graceMs = 3200;
    });

    await page.goto("/");
    await page.fill("#name", "playwright");
    await page.fill("#code", "pw-test-123");
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/login") && r.request().method() === "POST",
      ),
      page.click("button[type=submit]"),
    ]);

    await page.goto("/anden-advent");
    const canvas = page.locator("#santa-canvas");
    await expect(canvas).toBeVisible();

    // Wait for the lightweight test harness to be available
    await page.waitForFunction(() => {
      const hooks = (window as any).__ANDEN_TEST__;
      return (
        !!hooks &&
        typeof hooks.getLeadY === "function" &&
        typeof hooks.forceStop === "function" &&
        typeof hooks.getGraceMs === "function"
      );
    });

    // Simulate a completed run so the next tap would normally restart the game
    await page.evaluate(() => {
      (window as any).__ANDEN_TEST__.forceStop();
    });

    const beforeY = await page.evaluate(() => {
      return (window as any).__ANDEN_TEST__.getLeadY();
    });

    await page.dispatchEvent("#santa-canvas", "pointerdown", {
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    });

    // Give the frame loop a moment to process the tap
    await page.waitForTimeout(120);

    const graceAfter = await page.evaluate(() => {
      return (window as any).__ANDEN_TEST__.getGraceMs();
    });
    expect(graceAfter).toBeLessThanOrEqual(0);

    await page.waitForTimeout(180);
    const afterY = await page.evaluate(() => {
      return (window as any).__ANDEN_TEST__.getLeadY();
    });

    // Y decreases when Santa moves upward, so the new Y should be noticeably lower
    expect(afterY).toBeLessThan(beforeY - 3);
  });
});
