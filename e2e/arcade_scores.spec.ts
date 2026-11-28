import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

// Kill the snake against the top wall after eating `gifts` presents.
async function dieWithScore(page, gifts: number) {
  await page.goto('/advent-1');
  await page.waitForFunction(() => (window as any).__snakeDebug__);
  await page.evaluate((n) => {
    const d = (window as any).__snakeDebug__;
    d.debugStop();
    d.restartGame();
    d.debugStop();
    for (let i = 0; i < n; i += 1) {
      d.placeGiftNextToHead(1, 0);
      d.tickOnce();
    }
    d.placeGiftNextToHead(1, 0); // keep the randomly spawned floor item off the path to the top wall
    d.setDirection('up');
    for (let i = 0; i < 30; i += 1) d.tickOnce();
  }, gifts);
}

const scene = (page) => page.evaluate(() => (window as any).__arcadeScores__?.state ?? null);

test.beforeEach(async ({ page }) => loginAsPlaywright(page));

test('qualifying score asks for a name, saves it and closes on Enter', async ({ page }) => {
  await dieWithScore(page, 3);
  const input = page.locator('input.arcade-input');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('playwright');

  // Arrows must not restart the snake while typing.
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => (window as any).__snakeDebug__.isRunning())).toBe(false);

  await input.fill('Neo');
  const [post] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/api/scores/advent-1') && r.method() === 'POST'),
    input.press('Enter'),
  ]);
  expect(post.postDataJSON()).toEqual({ name: 'Neo', score: 3 });
  await expect(input).toBeHidden();
  await expect.poll(() => scene(page)).toBe('list');
  const top = await page.request.get('/api/scores/advent-1');
  expect((await top.json()).scores[0]).toMatchObject({ name: 'Neo', score: 3 });

  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page)).toBe(null);
  // Resume lands on the next frame, so retry the key until the snake runs again.
  // After a card or a shield wait, only a direction resumes the game (Space does not).
  await expect
    .poll(async () => {
      await page.keyboard.press('ArrowRight');
      return page.evaluate(() => (window as any).__snakeDebug__.isRunning());
    })
    .toBe(true);
});

test('zero score skips name entry and closes on tap', async ({ page }) => {
  await dieWithScore(page, 0);
  await expect.poll(() => scene(page)).toBe('list');
  await expect(page.locator('input.arcade-input')).toBeHidden();
  await page.mouse.click(4, 4); // tap the backdrop outside the score panel
  await expect.poll(() => scene(page)).toBe(null);
});

test('a failed submission gives a retry without losing the name', async ({ page }) => {
  await page.route('**/api/scores/advent-1', (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 503 });
    return route.fulfill({ json: { scores: [] } });
  });
  await dieWithScore(page, 1);
  const input = page.getByLabel('Dit navn på julemandens liste');
  await input.fill('Nisse');
  const save = page.getByRole('button', { name: 'Gem point' });
  await save.click();
  await expect(page.getByRole('status')).toHaveText('Kunne ikke gemme dine point. Prøv igen.');
  await expect(input).toHaveValue('Nisse');
  await expect(input).toBeFocused();
  await expect(save).toBeEnabled();
  await page.getByRole('button', { name: 'Spring over' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('an unavailable ranking shows an error and can be closed by keyboard', async ({ page }) => {
  await page.route('**/api/scores/advent-1', (route) => route.fulfill({ status: 503 }));
  await dieWithScore(page, 1);
  await expect(page.getByRole('status')).toHaveText('Kunne ikke hente ranglisten.');
  await expect(page.getByRole('button', { name: 'Luk' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
