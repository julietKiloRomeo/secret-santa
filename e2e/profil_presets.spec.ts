import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

test.beforeEach(async ({ page }) => loginAsPlaywright(page));

test('choosing a festive preset sets the avatar and it survives a reload', async ({ page }) => {
  await page.goto('/profil');
  await expect(page.locator('[data-preset]')).toHaveCount(25);
  await page.locator('[data-preset="robin"]').click();
  await expect(page.locator('#avatar-status')).toHaveText('Portræt valgt.');
  await page.reload();
  await expect(page.locator('#avatar-preview')).toHaveAttribute('src', /presets\/robin\.png/);
});
