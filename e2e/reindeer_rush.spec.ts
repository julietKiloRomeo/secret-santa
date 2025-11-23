import { test, expect } from '@playwright/test';

test('reindeer rush handles obstacles, scoring, and collision', async ({ page }) => {
  await page.setViewportSize({ width: 450, height: 900 });

  await page.goto('/');
  await page.fill('#name', 'playwright');
  await page.fill('#code', 'pw-test-123');
  const loginResponsePromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/login') && r.request().method() === 'POST'
  );
  await page.click('button[type=submit]');
  const loginResp = await loginResponsePromise;
  expect(loginResp.ok()).toBe(true);
  await page.waitForLoadState('networkidle');

  await page.goto('/reindeer-rush');
  const canvas = page.locator('#reindeer-canvas canvas');
  await canvas.waitFor({ state: 'visible' });
  await canvas.click();

  await page.waitForFunction(() => {
    const helpers = (window as any).__reindeerRush__;
    const state = helpers?.getState();
    return Boolean(state && state.distance > 0 && state.obstacleCount > 0 && state.fps > 20);
  }, { timeout: 20000 });

  await page.waitForSelector('#reindeer-game-over-overlay', { timeout: 30000 });
  const overlay = page.locator('#reindeer-game-over-overlay');
  await expect(overlay).toHaveAttribute('data-reason', /collision/);
  await expect(overlay).toHaveAttribute('data-distance', /\d+/);
  await expect(overlay).toHaveAttribute('data-fps', /\d+/);

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
  expect(state?.running).toBe(false);
});
