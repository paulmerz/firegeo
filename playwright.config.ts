import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// Charger .env.local pour les tests
dotenv.config({ path: '.env.local' });

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    headless:  false,
    /*launchOptions: {
      slowMo: 1000,
    },*/
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

