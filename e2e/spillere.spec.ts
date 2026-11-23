import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

test.beforeEach(async ({ page }) => loginAsPlaywright(page));

test('the players page renders a card for each player', async ({ page }) => {
  await page.goto('/spillere');
  await expect(page.locator('[data-card="playwright"]')).toBeVisible();
  await expect(page.locator('#players-status')).toHaveCount(0);
});

test('a card is a button that opens a modal with Badges and Ønskeliste tabs', async ({ page }) => {
  await page.goto('/spillere');
  await page.locator('[data-card-open="playwright"]').click();
  const modal = page.locator('#player-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('tab', { name: 'Badges' })).toHaveAttribute('aria-selected', 'true');
  await modal.getByRole('tab', { name: 'Ønskeliste' }).click();
  await expect(modal.getByRole('tab', { name: 'Ønskeliste' })).toHaveAttribute('aria-selected', 'true');
  await expect(modal.locator('[data-panel="wish"]')).toBeVisible();
  await expect(modal.locator('[data-panel="badges"]')).toBeHidden();
});

test('the modal shows the wish list the player saved', async ({ page }) => {
  await page.request.put('/api/profile/playwright', {
    data: { wish_html: '<ul><li>Sokker</li><li>Chokolade</li></ul>' },
  });
  await page.goto('/spillere');
  await page.locator('[data-card-open="playwright"]').click();
  await page.locator('#player-modal').getByRole('tab', { name: 'Ønskeliste' }).click();
  await expect(page.locator('#player-modal [data-panel="wish"] li')).toHaveCount(2);
  await expect(page.locator('#player-modal [data-panel="wish"]')).toContainText('Chokolade');
});

test('a badge in the modal carries the snark and reward as hover text', async ({ page }) => {
  await page.request.post('/api/achievements', { data: { achievement_id: 'advent-1:shield:3' } });
  await page.goto('/spillere');
  await page.locator('[data-card-open="playwright"]').click();
  const badge = page.locator('#player-modal [data-badge="advent-1:shield:3"]');
  await expect(badge).toBeVisible();
  const tip = await badge.getAttribute('title');
  expect(tip).toContain('Three shields');
  expect(tip).toContain('One Buckler');
});

test('badges show as their picture, with the name as label, and the picture loads', async ({ page }) => {
  await page.request.post('/api/achievements', { data: { achievement_id: 'advent-1:loops:3' } });
  await page.goto('/spillere');
  await page.locator('[data-card-open="playwright"]').click();
  const fig = page.locator('#player-modal [data-badge="advent-1:loops:3"]');
  await expect(fig).toBeVisible();
  await expect(fig.locator('img')).toHaveAttribute('src', '/static/badges/jormungandr.png');
  await expect.poll(() => fig.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await fig.getAttribute('title')).toContain('World Serpent');
});

test('Escape closes the modal and focus returns to the card', async ({ page }) => {
  await page.goto('/spillere');
  const card = page.locator('[data-card-open="playwright"]');
  await card.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#player-modal')).toBeHidden();
  await expect(card).toBeFocused();
});
