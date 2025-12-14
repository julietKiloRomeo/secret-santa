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

const demoSong = [
  { time: 0, notes: [{ pitch: 'c4', lane: 2, tied: false }] },
  { time: 1, notes: [{ pitch: 'd4', lane: 3, tied: true }] },
  { time: 2.5, notes: [{ pitch: 'd4', lane: 3, tied: false }] },
];

test.describe('Tredje Advent notes render and scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/static/songs/*.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(demoSong),
      });
    });
    await login(page);
  });

  test('notes appear and move toward the hit line over time', async ({ page }) => {
    await page.goto('/tredje-advent');
    const startButton = page.getByRole('button', { name: /start/i });
    await expect(startButton).toBeEnabled({ timeout: 5000 });
    await startButton.click();

    const notes = page.locator('svg circle');
    await expect.poll(async () => notes.count()).toBeGreaterThan(0);

    const firstNote = notes.first();
    const initialCy = await firstNote.evaluate((el) => parseFloat(el.getAttribute('cy') || '0'));
    expect(initialCy).toBeLessThan(300); // starts above the hit zone

    await page.waitForTimeout(2200); // allow the scroll loop to advance
    const laterCy = await firstNote.evaluate((el) => parseFloat(el.getAttribute('cy') || '0'));
    expect(laterCy).toBeGreaterThan(initialCy);
    expect(Math.abs(laterCy - 500)).toBeLessThan(120); // near the hit zone (y=500)

    // Sustained note should render a line element
    const lines = page.locator('svg line');
    await expect.poll(async () => lines.count()).toBeGreaterThan(0);
  });
});
