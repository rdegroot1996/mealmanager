import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8081',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  projects: [
    {
      name: 'journeys',
      testIgnore: '**/deployment/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'deployment',
      testMatch: '**/deployment/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
