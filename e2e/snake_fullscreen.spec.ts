import { test, expect } from '@playwright/test';

async function loginAsPlaywright(page) {
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

test.describe('Snake fullscreen experience', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlaywright(page);
  });

  test('renders fullscreen stage without legacy controls', async ({ page }) => {
    await page.goto('/forste-advent');
    await page.waitForSelector('#snake-canvas', { state: 'visible' });

    const hasFullscreenClass = await page.evaluate(() => document.body.classList.contains('arcade-fullscreen'));
    expect(hasFullscreenClass).toBeTruthy();

    const bodyOverflowY = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    expect(['hidden', 'clip']).toContain(bodyOverflowY);

    await expect(page.locator('#snake-controls')).toHaveCount(0);

    const stageCoverage = await page.evaluate(() => {
      const stage = document.getElementById('snake-stage');
      if (!stage) return 0;
      const rect = stage.getBoundingClientRect();
      return rect.height / window.innerHeight;
    });
    expect(stageCoverage).toBeGreaterThan(0.8);
  });

  test('swiping on canvas changes direction without scrolling', async ({ page }) => {
    await page.goto('/forste-advent');
    const canvas = page.locator('#snake-canvas');
    await canvas.waitFor({ state: 'visible' });

    const initialScroll = await page.evaluate(() => window.scrollY);
    expect(initialScroll).toBe(0);

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    const centerX = box.x + box.width / 2;
    const startY = box.y + box.height - 10;
    const endY = box.y + 10;

    await page.dispatchEvent('#snake-canvas', 'pointerdown', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: centerX,
      clientY: startY,
      buttons: 1,
    });
    await page.dispatchEvent('#snake-canvas', 'pointermove', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: centerX,
      clientY: endY,
      buttons: 1,
    });
    await page.dispatchEvent('#snake-canvas', 'pointerup', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: centerX,
      clientY: endY,
      buttons: 0,
    });

    const pending = await page.evaluate(() => {
      // @ts-ignore
      return window.__snakeDebug__?.getPendingDirection?.();
    });
    expect(pending).toBe('up');

    const scrollAfterSwipe = await page.evaluate(() => window.scrollY);
    expect(scrollAfterSwipe).toBe(0);
  });
});
