import { test, expect } from '@playwright/test';

test.describe('Snake gift order and no flooding', () => {
  test('keeps gift order stable and no duplicate flooding', async ({ page }) => {
    await page.goto('/forste-advent');

    // Helper to eat a gift with a specific skin by placing it ahead
    async function eatGiftWithSkin(skin: string) {
      await page.evaluate((skinArg) => {
        // @ts-ignore
        window.__snakeDebug__?.setNextGiftSkin?.(skinArg);
        // @ts-ignore
        window.__snakeDebug__?.placeGiftNextToHead?.(1, 0);
        // @ts-ignore
        window.__snakeDebug__?.setDirection?.('right');
      }, skin);
      // Move and let a couple of ticks process
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
    }

    // Eat three distinct gifts in sequence
    const gifts = ['🎁', '🍬', '🧦'];
    for (const g of gifts) {
      await eatGiftWithSkin(g);
    }

    // Verify the skins on body segments match the eaten order (head excluded)
    let skins = await page.evaluate(() => {
      // @ts-ignore
      return window.__snakeDebug__?.getSkinsFiltered?.();
    });
    // We started length 5; after 3 gifts, some body skins should exist but order must start with first eaten
    expect(skins.slice(0, gifts.length)).toEqual(gifts);

    // Advance movement without eating and verify order unchanged
    await page.evaluate(() => {
      // @ts-ignore
      for (let i = 0; i < 5; i++) window.__snakeDebug__?.tickOnce?.();
    });
    let skinsAfter = await page.evaluate(() => {
      // @ts-ignore
      return window.__snakeDebug__?.getSkinsFiltered?.();
    });
    // Filter might have grown due to movement, but prefix must still equal gifts in same order
    expect(skinsAfter.slice(0, gifts.length)).toEqual(gifts);

    // Ensure no flooding: the count of the last eaten gift emoji equals exactly 1
    const last = gifts[gifts.length - 1];
    const countLast = skinsAfter.filter((s: string) => s === last).length;
    expect(countLast).toBe(1);
  });
});

