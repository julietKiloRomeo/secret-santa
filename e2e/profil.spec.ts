import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

test.beforeEach(async ({ page }) => loginAsPlaywright(page));

test('the wish list is one row per wish, added with Enter or the plus button', async ({ page }) => {
  await page.goto('/profil');
  await page.locator('#wish-rows [contenteditable]').first().click();
  await page.keyboard.type('Sokker');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Chokolade');
  await page.locator('#wish-add').click();
  await page.keyboard.type('Bog');
  await expect(page.locator('#wish-rows > li')).toHaveCount(3);
  await page.locator('#wish-save').click();
  await expect(page.locator('#wish-status')).toHaveText('Gemt.');
  await page.reload();
  await expect(page.locator('#wish-rows > li')).toHaveCount(3);
  await expect(page.locator('#wish-rows > li').nth(1)).toContainText('Chokolade');
});

test('the avatar stays hidden until the portrait is clicked, then the modal opens', async ({ page }) => {
  await page.goto('/profil');
  await expect(page.locator('#preset-grid')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Vælg billede' })).toHaveCount(0);
  await page.locator('#avatar-open').click();
  await expect(page.locator('#avatar-modal')).toBeVisible();
  await expect(page.locator('[data-preset]')).toHaveCount(25);
});

test('choosing a festive preset in the modal sets the avatar and it survives a reload', async ({ page }) => {
  await page.goto('/profil');
  await page.locator('#avatar-open').click();
  await page.locator('[data-preset="robin"]').click();
  await expect(page.locator('#avatar-modal')).toBeHidden();
  await page.reload();
  await expect(page.locator('#avatar-preview')).toHaveAttribute('src', /presets\/robin\.png/);
});

test('Ctrl+K in a row opens the link dialog and inserts a link', async ({ page }) => {
  await page.goto('/profil');
  await page.locator('#wish-rows [contenteditable]').first().click();
  await page.keyboard.type('Køb her');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#link-dialog')).toBeVisible();
  await page.locator('#link-text').fill('Køb her');
  await page.locator('#link-url').fill('https://example.com/gave');
  await page.locator('#link-ok').click();
  await expect(page.locator('#wish-rows a')).toHaveAttribute('href', 'https://example.com/gave');
});

test('a link made in a row survives save and reload', async ({ page }) => {
  await page.goto('/profil');
  await page.locator('#wish-rows [contenteditable]').first().click();
  await page.keyboard.type('Gave her');
  await page.keyboard.press('Control+k');
  await page.locator('#link-url').fill('https://example.com/roundtrip');
  await page.locator('#link-ok').click();
  await page.locator('#wish-save').click();
  await expect(page.locator('#wish-status')).toHaveText('Gemt.');
  await page.reload();
  await expect(page.locator('#wish-rows a')).toHaveAttribute('href', 'https://example.com/roundtrip');
});
