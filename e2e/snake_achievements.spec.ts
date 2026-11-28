import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

test.beforeEach(async ({ page }) => loginAsPlaywright(page));

const dbg = (page) => page.waitForFunction(() => Boolean((window as any).__snakeDebug__));

async function makeGhostLoop(page) {
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.grantEffect('ghost');
    d.placeBodyHitAhead();
    d.tickOnce();
  });
}

test('a badge gives a brief, non-blocking hint when earned and re-earned', async ({ page }) => {
  await page.goto('/advent-1');
  await dbg(page);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/achievements') && r.request().method() === 'POST',
  );
  await makeGhostLoop(page);
  expect((await (await response).json()).success).toBe(true);
  const hint = page.getByRole('status', { name: 'Badge' });
  await expect(hint).toContainText('Nidhogg');
  await expect(page.locator('.arcade-panel')).toHaveCount(0);
  await expect(hint).toHaveText('', { timeout: 5000 });

  await page.evaluate(() => (window as any).__snakeDebug__.restartGame());
  const repeat = page.waitForResponse(
    (r) => r.url().endsWith('/api/achievements') && r.request().method() === 'POST',
  );
  await makeGhostLoop(page);
  expect((await (await repeat).json()).success).toBe(true);
  await expect(hint).toContainText('Nidhogg');
});

test('a failed unlock is retried without showing a false achievement', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/achievements', (route) => {
    attempts += 1;
    return attempts === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ json: { success: true } });
  });
  await page.goto('/advent-1');
  await dbg(page);
  await makeGhostLoop(page);
  await expect.poll(() => attempts).toBe(1);
  await expect(page.getByRole('status', { name: 'Badge' })).toHaveText('');
  await page.evaluate(() => (window as any).__snakeDebug__.tickOnce());
  await expect.poll(() => attempts).toBe(2);
  await expect(page.getByRole('status', { name: 'Badge' })).toContainText('Nidhogg');
});

test('shield pickups no longer post achievement tiers', async ({ page }) => {
  const posted: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/achievements') && r.method() === 'POST')
      posted.push(JSON.parse(r.postData() ?? '{}').achievement_id);
  });
  await page.goto('/advent-1');
  await dbg(page);
  await page.evaluate(() => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
    for (let i = 0; i < 3; i++) {
      d.placePowerupNextToHead('shield', 1, 0);
      d.setDirection('right');
      d.tickOnce();
    }
  });
  await page.waitForTimeout(600);
  expect(posted).toEqual([]);
  const card = await page.evaluate(() => (window as any).__snakeDebug__.getCard());
  expect(card.name).not.toBe('Insurance Claim');
});
