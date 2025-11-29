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

  test('qualifying score shows leaderboard and entry on the same panel', async ({ page }) => {
    const firstScores = {
      scores: [
        { name: 'AAA', score: 120 },
        { name: 'BBB', score: 110 },
        { name: 'CCC', score: 90 },
      ],
    };
    const savedScores = {
      scores: [...firstScores.scores, { name: 'Neo', score: 888 }],
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
        expect(body).toEqual({ name: 'Neo', score: 888 });
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
        score: 888,
        allowSkip: true,
        title: 'Hall of Fame',
        message: 'Test run',
      });
    });

    const overlay = page.locator('#arcade-overlay.visible');
    await overlay.waitFor();
    await expect(overlay.locator('.arcade-scores')).toBeVisible();
    const input = overlay.locator('input.arcade-input');
    await expect(input).toBeVisible();
    await expect(overlay.locator('.arcade-caret')).toBeVisible();

    const activeIsInput = await page.evaluate(() => {
      const active = document.activeElement;
      return active && active.classList.contains('arcade-input');
    });
    expect(activeIsInput).toBeTruthy();

    await expect(overlay.locator('.arcade-scores')).toContainText('AAA');
    await input.fill('Neo');
    await input.press('Enter');
    await expect(page.locator('#arcade-overlay.visible')).toHaveCount(0);
  });

  test('non-qualifying score only shows the leaderboard', async ({ page }) => {
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
    await expect(overlay.locator('.arcade-panel h2')).toHaveText(/Top\s*10/i);
    await expect(overlay.locator('.arcade-panel')).not.toContainText(/Ny high score/i);
    await expect(overlay.locator('.arcade-scores')).toBeVisible();
    await expect(overlay.locator('input.arcade-input')).toHaveCount(0);

    await overlay.getByRole('button', { name: /Luk/i }).click();
    await expect(page.locator('#arcade-overlay.visible')).toHaveCount(0);
  });
});
