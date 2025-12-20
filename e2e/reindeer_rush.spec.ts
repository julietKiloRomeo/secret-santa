import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

async function stubReindeerScores(page: any) {
  await page.route('**/api/scores/tredje-advent', (route: any) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ scores: [] }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });
}

async function triggerRudolphDeath(page: any, snowmanOffset = 120) {
  await page.evaluate((offset) => {
    const api = (window as any).__reindeerRush__;
    const dbg = (window as any).__reindeerRushDebug__;
    api?.startGame?.();
    dbg?.spawnSnowmanForTest?.(offset);
  }, snowmanOffset);
}

test.beforeEach(async ({ page }) => {
  await loginAsPlaywright(page);
});

test('reindeer rush handles obstacles, scoring, and collision', async ({ page }) => {
  await page.setViewportSize({ width: 450, height: 900 });

  await page.goto('/fjerde-advent');
  const stage = page.locator('#reindeer-immersive-stage');
  await expect(stage).toHaveAttribute('data-active', '1');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.up('Space');

  await page.waitForFunction(() => {
    const helpers = (window as any).__reindeerRush__;
    const state = helpers?.getState();
    return Boolean(state && state.distance > 0 && state.obstacleCount > 0 && state.fps > 20);
  }, { timeout: 20000 });

  const firstPlatform = await page.evaluate(() => {
    const dbg = (window as any).__reindeerRushDebug__;
    const list = dbg?.getPlatforms?.();
    if (!list || !list.length) return null;
    return list[0];
  });
  expect(firstPlatform).not.toBeNull();
  expect(firstPlatform!.width).toBeGreaterThan(180);
  expect(firstPlatform!.surfaceY).toBeGreaterThan(60);

  const scoreLabel = (await page.locator('#reindeer-score').innerText()).trim();
  expect(scoreLabel).toMatch(/^\d+ m$/);
  const scoreValue = parseInt(scoreLabel.replace(/\D/g, ''), 10);
  expect(scoreValue).toBeGreaterThan(0);

  const state = await page.evaluate(() => {
    const helpers = (window as any).__reindeerRush__;
    return helpers ? helpers.getState() : null;
  });
  expect(state).not.toBeNull();
  expect(state?.distance).toBeGreaterThan(0);
  expect(state?.obstacleCount).toBeGreaterThan(0);
  expect(state?.fps).toBeGreaterThan(20);
  expect(state?.running).toBe(true);
});

test('lands back on the starting platform after the first jump', async ({ page }) => {
  await page.setViewportSize({ width: 450, height: 900 });
  await page.goto('/fjerde-advent');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  await page.keyboard.down('Space');
  await page.waitForTimeout(140);
  await page.keyboard.up('Space');

  const landingHandle = await page.waitForFunction(() => {
    const dbg = (window as any).__reindeerRushDebug__;
    const api = (window as any).__reindeerRush__;
    if (!dbg?.getPlayer || !api?.getState) return null;
    const player = dbg.getPlayer();
    const state = api.getState();
    if (!state.running) return { stopped: true, reason: state.lastCollisionReason };
    return player.grounded
      ? { grounded: true, y: player.y, reason: state.lastCollisionReason }
      : false;
  }, { timeout: 2000 });

  const landing = await landingHandle?.jsonValue();
  expect((landing as any)?.stopped).not.toBe(true);
  expect((landing as any)?.grounded).toBe(true);

  const afterLanding = await page.evaluate(async () => {
    const api = (window as any).__reindeerRush__;
    const dbg = (window as any).__reindeerRushDebug__;
    await new Promise((r) => setTimeout(r, 500));
    return {
      player: dbg?.getPlayer?.(),
      state: api?.getState?.(),
    };
  });

  expect(afterLanding?.state?.running).toBe(true);
  expect(afterLanding?.state?.lastCollisionReason).toBeNull();
  expect(afterLanding?.player?.grounded).toBe(true);
});

test('dash nudges forward then eases back', async ({ page }) => {
  await page.setViewportSize({ width: 450, height: 900 });
  await page.goto('/fjerde-advent');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  await page.keyboard.down('Space');
  await page.waitForTimeout(140);
  await page.keyboard.up('Space');
  await page.waitForTimeout(200);

  const { before, during, after } = await page.evaluate(async () => {
    const dbg = (window as any).__reindeerRushDebug__;
    const getX = () => dbg?.getPlayer?.().x ?? 0;
    const beforeX = getX();
    dbg?.triggerDash?.();
    await new Promise((r) => setTimeout(r, 120));
    const midX = getX();
    await new Promise((r) => setTimeout(r, 500));
    const endX = getX();
    return { before: beforeX, during: midX, after: endX };
  });

  expect(during).toBeGreaterThan(before);
  expect(after).toBeLessThanOrEqual(during);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(20);
});

test('falls off if there is no ground', async ({ page }) => {
  await page.setViewportSize({ width: 450, height: 900 });
  await page.goto('/fjerde-advent');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  const result = await page.evaluate(async () => {
    const dbg = (window as any).__reindeerRushDebug__;
    if (!dbg?.dropAllPlatforms) return null;
    (window as any).__reindeerRush__?.startGame?.();
    dbg.dropAllPlatforms();
    await new Promise((r) => setTimeout(r, 2500));
    const state = (window as any).__reindeerRush__?.getState?.();
    return state;
  });

  expect(result).not.toBeNull();
  expect(result?.running).toBe(false);
  expect(result?.lastCollisionReason).toBe('fell-off-island');
});

test('snowmen are spaced at least one screen apart', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto('/fjerde-advent');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  const spacing = await page.evaluate(() => {
    const dbg = (window as any).__reindeerRushDebug__;
    return dbg?.testSnowmanSpacing?.() ?? null;
  });

  expect(spacing).not.toBeNull();
  expect(spacing?.minGap).toBeGreaterThanOrEqual(spacing?.screenWidth || 0);
  expect(spacing?.count).toBeGreaterThanOrEqual(3);
});

test('snowman collision without dash ends the run', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto('/fjerde-advent');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  const outcome = await page.evaluate(async () => {
    const api = (window as any).__reindeerRush__;
    const dbg = (window as any).__reindeerRushDebug__;
    api?.startGame?.();
    dbg?.spawnSnowmanForTest?.(140);
    await new Promise((r) => setTimeout(r, 1400));
    return api?.getState?.();
  });

  expect(outcome?.running).toBe(false);
  expect(outcome?.lastCollisionReason).toBe('hit-snowman');
});

test('dashing through a snowman awards bonus and destroys it', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto('/fjerde-advent');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  const result = await page.evaluate(async () => {
    const api = (window as any).__reindeerRush__;
    const dbg = (window as any).__reindeerRushDebug__;
    api?.startGame?.();
    dbg?.spawnSnowmanForTest?.(100);
    await new Promise((r) => setTimeout(r, 40));
    dbg?.triggerDash?.();
    await new Promise((r) => setTimeout(r, 1000));
    return {
      state: api?.getState?.(),
      snowmen: dbg?.getSnowmen?.(),
    };
  });

  expect(result?.state?.running).toBe(true);
  expect(result?.state?.lastCollisionReason).toBeNull();
  expect(result?.state?.bonus).toBeGreaterThan(0);
  expect((result?.snowmen || []).length).toBe(0);
});

test('shows RIP screen before high score flow and respects delay', async ({ page }) => {
  await stubReindeerScores(page);
  await page.setViewportSize({ width: 420, height: 820 });
  await page.goto('/fjerde-advent');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  const start = Date.now();
  await triggerRudolphDeath(page, 90);

  // Death screen should be active immediately
  await expect.poll(async () => {
    return page.evaluate(() => {
      const dbg = (window as any).__reindeerRushDebug__;
      return dbg?.isDeathScreenActive?.() || false;
    });
  }).toBe(true);

  const input = page.locator('.arcade-input');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThanOrEqual(1400);
  expect(elapsed).toBeLessThan(3200);

  await expect(page.locator('#arcade-overlay')).toHaveClass(/visible/);
});

test('high score name field focuses on tap', async ({ page }) => {
  await stubReindeerScores(page);
  await page.setViewportSize({ width: 420, height: 820 });
  await page.goto('/fjerde-advent');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });

  await triggerRudolphDeath(page, 100);

  const input = page.locator('.arcade-input');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.click();
  await expect(input).toBeFocused();
});
