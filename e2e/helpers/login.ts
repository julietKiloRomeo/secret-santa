import type { Page } from '@playwright/test';

export async function loginAsPlaywright(page: Page) {
  const resp = await page.request.post('/api/login', {
    data: { name: 'playwright', code: 'pw-test-123' },
  });
  if (!resp.ok()) throw new Error(`Login failed with status ${resp.status()}`);
}
