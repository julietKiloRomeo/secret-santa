import { test, expect } from '@playwright/test';
import { loginAsPlaywright } from './helpers/login';

const sizes = {
  small: { width: 320, height: 568 },
  phone: { width: 390, height: 844 },
  landscape: { width: 667, height: 320 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1382, height: 785 },
};

for (const [size, viewport] of Object.entries(sizes)) {
  test(`Snake overlays fit ${size}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await loginAsPlaywright(page);
    await page.route('**/api/scores/advent-1', (route) =>
      route.fulfill({
        json: {
          scores: Array.from({ length: 9 }, (_, i) => ({
            name: i === 1 ? 'Alexandertestnavne' : `Nisse ${i + 1}`,
            score: 44 - i,
          })),
        },
      }),
    );
    await page.goto('/advent-1');
    await page.waitForFunction(() => Boolean((window as any).__snakeDebug__));
    await page.evaluate(() => {
      const d = (window as any).__snakeDebug__;
      d.restartGame();
      d.debugStop();
      d.placePowerupNextToHead('ghost', 1, 0);
      d.setDirection('right');
      d.tickOnce();
    });
    const loot = page.getByRole('dialog', { name: 'Misteltenens spøgelse' });
    await expect(loot).toBeVisible();
    await expect(loot.getByText('Virkning')).toBeInViewport();
    await expect(loot.getByRole('button', { name: 'Fortsæt' })).toBeInViewport();
    expect(await loot.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('powerup.png') });

    await page.waitForTimeout(300);
    if (size === 'phone') await loot.getByRole('button', { name: 'Fortsæt' }).click();
    else await page.keyboard.press('Space');
    await expect(loot).toBeHidden();
    await page.evaluate(() => {
      const d = (window as any).__snakeDebug__;
      d.restartGame();
      d.debugStop();
      d.placeGiftNextToHead(1, 0);
      d.setDirection('right');
      d.tickOnce();
      d.setDirection('up');
      for (let i = 0; i < 30; i++) d.tickOnce();
    });
    await expect(page.locator('input.arcade-input')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('scores.png') });
    const dialog = page.getByRole('dialog', { name: 'Søde Børn' });
    const geometry = await dialog.evaluate((el) => {
      const panel = el.getBoundingClientRect();
      const title = el.querySelector('h2')!.getBoundingClientRect();
      const action = el.querySelector('[type="submit"]')!.getBoundingClientRect();
      const input = el.querySelector('input')!.getBoundingClientRect();
      return {
        inside: panel.left >= 0 && panel.right <= innerWidth && panel.top >= 0 && panel.bottom <= innerHeight,
        inset: title.top - panel.top >= 12 && panel.bottom - action.bottom >= 12,
        input:
          input.left > panel.left &&
          input.right < panel.right &&
          input.top >= panel.top &&
          input.bottom <= panel.bottom,
        noOverflow: el.scrollWidth <= el.clientWidth,
      };
    });
    expect(geometry).toEqual({ inside: true, inset: true, input: true, noOverflow: true });
    await expect(dialog.getByRole('button', { name: 'Gem point' })).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveCount(9);
  });
}
