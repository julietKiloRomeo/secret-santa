import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'uv run python app.py',
    url: 'http://localhost:5000',
    timeout: 120000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:5000',
  },
});

