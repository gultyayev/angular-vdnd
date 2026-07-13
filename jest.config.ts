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
  // `perf/` is tooling run under Node's own test runner (`npm run perf:test`),
  // not the Angular/jest environment — keep jest from picking up its specs.
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/perf/'],
  reporters: [['jest-simple-dot-reporter', { color: true }]],
  // transformIgnorePatterns,
} satisfies Config;
