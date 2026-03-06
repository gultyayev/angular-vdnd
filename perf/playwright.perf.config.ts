import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scenarios',
  testMatch: '**/*.perf.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: 'results/latest.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4200',
    ...devices['Desktop Chrome'],
    headless: true,
    video: 'off',
    screenshot: 'off',
    trace: 'off',
  },
  webServer: {
    command: 'npm start -- --host 127.0.0.1 --port 4200 -c production',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
