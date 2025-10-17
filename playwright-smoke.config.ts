import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for smoke tests (no web server)
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/smoke.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No web server for smoke tests
});