import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

test.beforeEach(async ({ page }) => loginAsPlaywright(page));

test('the profile page loads the editor and saves a wish list', async ({ page }) => {
  await page.goto('/profil');
  await expect(page.locator('#wish-editor')).toBeVisible();
  await page.locator('#wish-editor').click();
  await page.keyboard.type('Sokker og chokolade');
  await page.locator('#wish-save').click();
  await expect(page.locator('#wish-status')).toHaveText('Gemt.');
  await page.reload();
  await expect(page.locator('#wish-editor')).toContainText('Sokker og chokolade');
});

test('Ctrl+K opens the link dialog and inserts a link', async ({ page }) => {
  await page.goto('/profil');
  await page.locator('#wish-editor').click();
  await page.keyboard.type('Køb her');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#link-dialog')).toBeVisible();
  await page.locator('#link-text').fill('Køb her');
  await page.locator('#link-url').fill('https://example.com/gave');
  await page.locator('#link-ok').click();
  await expect(page.locator('#wish-editor a')).toHaveAttribute('href', 'https://example.com/gave');
});

test('a link made in the editor survives save and reload', async ({ page }) => {
  await page.goto('/profil');
  await page.locator('#wish-editor').click();
  await page.keyboard.type('Gave her');
  await page.keyboard.press('Control+k');
  await page.locator('#link-url').fill('https://example.com/roundtrip');
  await page.locator('#link-ok').click();
  await page.locator('#wish-save').click();
  await expect(page.locator('#wish-status')).toHaveText('Gemt.');
  await page.reload();
  await expect(page.locator('#wish-editor a')).toHaveAttribute('href', 'https://example.com/roundtrip');
});
