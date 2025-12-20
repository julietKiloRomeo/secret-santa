import { test, expect } from '@playwright/test';

async function login(page) {
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

test.describe('Arcade overlay high score flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('qualifying score inserts inline entry at the earned rank and stays visible after saving', async ({ page }) => {
    const firstScores = {
      scores: [
        { name: 'AAA', score: 400 },
        { name: 'BBB', score: 300 },
        { name: 'CCC', score: 150 },
        { name: 'DDD', score: 120 },
        { name: 'EEE', score: 80 },
      ],
    };
    const savedScores = {
      scores: [
        { name: 'AAA', score: 400 },
        { name: 'BBB', score: 300 },
        { name: 'Neo', score: 180 },
        { name: 'CCC', score: 150 },
        { name: 'DDD', score: 120 },
        { name: 'EEE', score: 80 },
      ],
    };
    let getCount = 0;

    await page.route('**/api/scores/forste-advent', async (route) => {
      if (route.request().method() === 'GET') {
        getCount += 1;
        const payload = getCount === 1 ? firstScores : savedScores;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        return;
      }
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        expect(body).toEqual({ name: 'Neo', score: 180 });
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fallback();
    });

    await page.goto('/forste-advent');
    await page.evaluate(() => {
      // @ts-ignore test harness
      window.arcadeOverlay.handleHighScoreFlow({
        gameId: 'forste-advent',
        score: 180,
        allowSkip: true,
        title: 'Hall of Fame',
        message: 'Test run',
      });
    });

    const overlay = page.locator('#arcade-overlay.visible');
    await overlay.waitFor();
    await expect(overlay.locator('.arcade-scores')).toBeVisible();
    await expect(overlay.locator('.arcade-scores li')).toHaveCount(6);
    const pendingRow = overlay.locator('.arcade-pending-entry');
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow).toContainText('03');
    await expect(pendingRow.locator('.arcade-score-points')).toHaveText('180');
    const input = pendingRow.locator('input.arcade-input');
    await expect(input).toBeVisible();
    await expect(overlay.locator('.arcade-caret')).toBeVisible();

    const activeIsInput = await page.evaluate(() => {
      const active = document.activeElement;
      return active && active.classList.contains('arcade-input');
    });
    expect(activeIsInput).toBeTruthy();

    await expect(overlay.locator('.arcade-scores li').nth(3)).toContainText('CCC');
    await expect(overlay.locator('.arcade-scores li').nth(4)).toContainText('DDD');

    await input.fill('Neo');
    await input.press('Enter');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.arcade-pending-entry')).toHaveCount(0);
    await expect(overlay.locator('input.arcade-input')).toHaveCount(0);
    await expect(overlay.locator('.arcade-scores li').nth(2)).toContainText('Neo');
    await expect(overlay.locator('.arcade-scores li').nth(2)).toContainText('180');
    await overlay.getByRole('button', { name: /Luk/i }).waitFor();
    await page.keyboard.press('Space');
    await expect(page.locator('#arcade-overlay.visible')).toHaveCount(0);
  });

  test('pending entry cannot be dismissed accidentally and closes via keyboard once saved', async ({ page }) => {
    const firstScores = {
      scores: [
        { name: 'AAA', score: 400 },
        { name: 'BBB', score: 300 },
        { name: 'CCC', score: 150 },
      ],
    };

    await page.route('**/api/scores/forste-advent', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(firstScores) });
        return;
      }
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        expect(body).toEqual({ name: 'Neo', score: 180 });
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fallback();
    });

    await page.goto('/forste-advent');
    await page.evaluate(() => {
      // @ts-ignore test harness
      window.arcadeOverlay.handleHighScoreFlow({
        gameId: 'forste-advent',
        score: 180,
        allowSkip: true,
        title: 'Hall of Fame',
        message: 'Test run',
      });
    });

    const overlay = page.locator('#arcade-overlay.visible');
    await overlay.waitFor();

    await page.evaluate(() => {
      // Attempt to hide overlay externally
      // @ts-ignore
      window.arcadeOverlay.hideOverlay();
    });
    await expect(overlay).toBeVisible();

    const host = page.locator('#arcade-overlay');
    await host.click({ position: { x: 5, y: 5 } });
    await expect(overlay).toBeVisible();

    await page.keyboard.press('Space');
    await expect(overlay).toBeVisible();

    const input = overlay.locator('input.arcade-input');
    await input.fill('Neo');
    await input.press('Enter');
    await expect(overlay).toBeVisible();
    await overlay.getByRole('button', { name: /Luk/i }).waitFor();

    await page.keyboard.press('Enter');
    await expect(page.locator('#arcade-overlay.visible')).toHaveCount(0);
  });

  test('non-qualifying score only shows the leaderboard and skips name entry', async ({ page }) => {
    const topScores = {
      scores: Array.from({ length: 10 }, (_, idx) => ({
        name: `Player ${idx + 1}`,
        score: 200 - idx * 10,
      })),
    };

    let postRequests = 0;
    await page.route('**/api/scores/forste-advent', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(topScores) });
        return;
      }
      if (route.request().method() === 'POST') {
        postRequests += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fallback();
    });

    await page.goto('/forste-advent');
    await page.evaluate(() => {
      // @ts-ignore test harness
      window.arcadeOverlay.handleHighScoreFlow({
        gameId: 'forste-advent',
        score: 5,
        allowSkip: true,
        title: 'Hall of Fame',
        message: 'Too low',
      });
    });

    const overlay = page.locator('#arcade-overlay.visible');
    await overlay.waitFor();
    await expect(overlay.locator('.arcade-panel h2')).toHaveText(/Hall of Fame/i);
    await expect(overlay.locator('.arcade-panel')).toContainText(/Too low/i);
    await expect(overlay.locator('.arcade-scores')).toBeVisible();
    await expect(overlay.locator('input.arcade-input')).toHaveCount(0);

    await overlay.getByRole('button', { name: /Luk/i }).click();
    await expect(page.locator('#arcade-overlay.visible')).toHaveCount(0);
    expect(postRequests).toBe(0);
  });

  test('non-qualifying leaderboard can be dismissed with enter or tap', async ({ page }) => {
    const topScores = {
      scores: Array.from({ length: 10 }, (_, idx) => ({
        name: `Player ${idx + 1}`,
        score: 200 - idx * 10,
      })),
    };

    await page.route('**/api/scores/forste-advent', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(topScores) });
        return;
      }
      await route.fallback();
    });

    await page.goto('/forste-advent');
    await page.evaluate(() => {
      // @ts-ignore test harness
      window.arcadeOverlay.handleHighScoreFlow({
        gameId: 'forste-advent',
        score: 5,
        allowSkip: true,
        title: 'Hall of Fame',
        message: 'Too low',
      });
    });

    const overlay = page.locator('#arcade-overlay.visible');
    await overlay.waitFor();
    await expect(overlay.locator('input.arcade-input')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('#arcade-overlay.visible')).toHaveCount(0);

    await page.evaluate(() => {
      // @ts-ignore
      window.arcadeOverlay.handleHighScoreFlow({
        gameId: 'forste-advent',
        score: 5,
        allowSkip: true,
        title: 'Hall of Fame',
        message: 'Too low',
      });
    });
    const overlayTwo = page.locator('#arcade-overlay.visible');
    await overlayTwo.waitFor();
    const host = page.locator('#arcade-overlay');
    await host.click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#arcade-overlay.visible')).toHaveCount(0);
  });

  test('pending high score entry ignores arrow keys so snake cannot restart', async ({ page }) => {
    const leaderboard = { scores: [{ name: 'AAA', score: 25 }, { name: 'BBB', score: 10 }] };

    await page.route('**/api/scores/forste-advent', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(leaderboard),
        });
        return;
      }
      if (method === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fallback();
    });

    await page.goto('/forste-advent');
    await page.waitForFunction(() => {
      // @ts-ignore snake debug hook is injected by the game bundle
      return Boolean(window.__snakeDebug__);
    });

    await page.evaluate(() => {
      // @ts-ignore test hook
      const debug = window.__snakeDebug__;
      debug.restartGame();
      debug.placeGiftNextToHead(1, 0);
    });

    const scoreLabel = page.locator('#score');
    await expect(scoreLabel).toHaveText(/Score:\s*1/, { timeout: 5000 });

    await page.evaluate(() => {
      // @ts-ignore test hook
      const debug = window.__snakeDebug__;
      debug.setDirection('up');
      for (let i = 0; i < 80; i += 1) {
        debug.tickOnce();
      }
    });

    const overlay = page.locator('#arcade-overlay.visible');
    await overlay.waitFor();
    await expect(overlay.locator('.arcade-pending-entry')).toBeVisible();
    await expect(overlay.locator('input.arcade-input')).toBeVisible();

    // Pressing arrow keys is how players restart snake; ensure they are ignored while the overlay is active.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');

    await expect.poll(async () =>
      page.evaluate(() => {
        // @ts-ignore test hook
        const debug = window.__snakeDebug__;
        return debug ? debug.isRunning() : true;
      })
    ).toBeFalsy();

    await expect(overlay.locator('.arcade-pending-entry')).toBeVisible();
    await expect(overlay.locator('input.arcade-input')).toBeVisible();
  });
});
