import { test, expect } from '@playwright/test';

test('mobile screenshots for games (iPhone-like viewport)', async ({ page }) => {
  // Emulate a typical mobile portrait viewport (iPhone 12-ish)
  await page.setViewportSize({ width: 390, height: 844 });

  // Login first (use a test account added to .env). Use the real UI so the
  // session cookie is set correctly.
  await page.goto('/');
  await page.fill('#name', 'playwright');
  await page.fill('#code', 'pw-test-123');
  const [loginResp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST'),
    page.click('button[type=submit]'),
  ]);
  if (!loginResp.ok()) {
    throw new Error(`Login failed for Playwright test account: status ${loginResp.status()}`);
  }

  // First: Snake
  await page.goto('/forste-advent');
  await page.waitForSelector('#snake-canvas', { state: 'visible' });
  // Give a moment for any JS resize to happen
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'out/forste_advent_mobile.png', fullPage: true });

  // Then: Flappy Santa
  await page.goto('/anden-advent');
  const canvas = await page.waitForSelector('#santa-canvas', { state: 'visible' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'out/anden_advent_mobile.png', fullPage: true });
  await canvas.screenshot({ path: 'out/anden_advent_reindeer_front.png' });
});
