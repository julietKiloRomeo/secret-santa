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

test('a badge description opens on hover and can be toggled by keyboard', async ({ page }) => {
  await page.request.post('/api/achievements', { data: { achievement_id: 'advent-1:loops:3' } });
  await page.goto('/spillere');
  await page.locator('[data-card-open="playwright"]').click();
  const badge = page.locator('#player-modal [data-badge="advent-1:loops:3"]');
  const detail = page.locator('#player-modal [data-badge-detail]');
  await expect(detail).toBeHidden();
  await badge.hover();
  await expect(detail).toContainText('Tre løkker');
  await expect(detail).toContainText('Belønning: Midgårdsormens ring');
  await detail.hover();
  await expect(detail).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(page.locator('#player-modal')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(detail).toBeHidden();
  await badge.focus();
  await page.keyboard.press('Space');
  await expect(badge).toHaveAttribute('aria-expanded', 'true');
  await expect(detail).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(badge).toBeFocused();
  await expect(page.locator('#player-modal')).toBeVisible();
});

test('badges show as their picture, with the name as label, and the picture loads', async ({ page }) => {
  await page.request.post('/api/achievements', { data: { achievement_id: 'advent-1:loops:3' } });
  await page.goto('/spillere');
  await page.locator('[data-card-open="playwright"]').click();
  const fig = page.locator('#player-modal [data-badge="advent-1:loops:3"]');
  await expect(fig).toBeVisible();
  await expect(fig.locator('img')).toHaveAttribute('src', '/static/badges/jormungandr.png');
  await expect
    .poll(() => fig.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await expect(fig).toHaveAccessibleName('Midgårdsormen');
});

test('switching badges replaces the description and treats its text as text', async ({ page }) => {
  await page.route('**/api/players', (route) =>
    route.fulfill({
      json: {
        players: [
          {
            name: 'playwright',
            avatar: null,
            wish_html: '',
            badges: [
              {
                id: 'one',
                name: 'First',
                image: '/static/badges/nidhogg.png',
                snark: 'First description',
                reward: 'First reward',
              },
              {
                id: 'two',
                name: 'Second',
                image: '/static/badges/ouroboros.png',
                snark: '<img src=x onerror=alert(1)>',
                reward: 'Second reward',
              },
            ],
          },
        ],
      },
    }),
  );
  await page.goto('/spillere');
  const card = page.locator('[data-card="playwright"]');
  const first = card.locator('[data-badge="one"]');
  const second = card.locator('[data-badge="two"]');
  const detail = card.locator('[data-badge-detail]');
  await first.click();
  await expect(detail).toContainText('First description');
  await second.click();
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await expect(second).toHaveAttribute('aria-expanded', 'true');
  await expect(detail).toContainText('<img src=x onerror=alert(1)>');
  await expect(detail.locator('img')).toHaveCount(0);
  await expect(detail).not.toContainText('First description');
});

test.describe('touch badge details', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('a small badge on the card and in the modal reveals and closes its description', async ({ page }) => {
    await page.request.post('/api/achievements', { data: { achievement_id: 'advent-1:loops:3' } });
    await page.goto('/spillere');
    const card = page.locator('[data-card="playwright"]');
    const badge = card.locator('[data-badge="advent-1:loops:3"]');
    const detail = card.locator('[data-badge-detail]');
    const badgeImage = badge.locator('img');
    const avatar = card.locator('[data-card-open] > :first-child');
    expect((await badgeImage.boundingBox())!.width).toBeLessThan((await avatar.boundingBox())!.width / 2 + 1);
    expect((await badge.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await badge.tap();
    await expect(badge).toHaveAttribute('aria-expanded', 'true');
    await expect(detail).toContainText('Tre løkker');
    await expect(detail).toContainText('Belønning: Midgårdsormens ring');
    await badge.tap();
    await expect(detail).toBeHidden();
    await card.locator('[data-card-open]').tap();
    const modal = page.locator('#player-modal');
    await modal.locator('[data-badge="advent-1:loops:3"]').tap();
    await expect(modal.locator('[data-badge-detail]')).toContainText('Tre løkker');
    await expect(modal).toBeVisible();
  });
});

test('Escape closes the modal and focus returns to the card', async ({ page }) => {
  await page.goto('/spillere');
  const card = page.locator('[data-card-open="playwright"]');
  await card.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#player-modal')).toBeHidden();
  await expect(card).toBeFocused();
});
