import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retry failed tests - WebKit has some timing-sensitive tests
  retries: 2,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*\.mobile\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /.*\.mobile\.spec\.ts/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /.*\.mobile\.spec\.ts/,
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
