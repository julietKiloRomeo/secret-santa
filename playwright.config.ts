import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'bash e2e/serve.sh',
    url: 'http://localhost:5001/healthz',
    timeout: 120000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://localhost:5001',
  },
});
