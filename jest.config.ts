import type { Config } from 'jest';
import { createCjsPreset } from 'jest-preset-angular/presets/index.js';

// Uncomment and add packages that need to be transformed (e.g., ESM-only packages)
// const packagesToTransform = [
//   "@angular",
//   "@ngrx",
// ];
// const transformIgnorePatterns = [
//   `node_modules/(?!.pnpm|(${packagesToTransform.join("|")}))`,
// ];

export default {
  ...createCjsPreset(),
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
  // transformIgnorePatterns,
} satisfies Config;
