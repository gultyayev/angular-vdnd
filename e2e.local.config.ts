// LOCAL-ONLY Playwright config (uncommitted). The environment provisions a
// chromium build that does not match the installed Playwright version, and the
// matching browser download is blocked, so we point chromium at the provisioned
// binary. Not for CI — do not commit.
import { devices } from '@playwright/test';
import base from './playwright.config';

base.projects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
    },
    testIgnore: /.*\.mobile\.spec\.ts/,
  },
];

export default base;
