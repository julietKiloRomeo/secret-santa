import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

test.beforeEach(async ({ page }) => loginAsPlaywright(page));

test('the players page renders a card for each player', async ({ page }) => {
  await page.goto('/spillere');
  await expect(page.locator('[data-card="playwright"]')).toBeVisible();
  await expect(page.locator('#players-status')).toHaveCount(0);
});

test('a badge shows its name and carries the snark and reward as hover text', async ({ page }) => {
  // Unlock a shield tier for the test player, through the real API.
  await page.request.post('/api/achievements', { data: { achievement_id: 'advent-1:shield:3' } });
  await page.goto('/spillere');
  const badge = page.locator('[data-card="playwright"] span[title]', { hasText: 'Buckler' });
  await expect(badge).toBeVisible();
  const tip = await badge.getAttribute('title');
  expect(tip).toContain('Three shields');
  expect(tip).toContain('One Buckler');
});
