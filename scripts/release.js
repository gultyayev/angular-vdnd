#!/usr/bin/env node

/**
 * Release script for ngx-virtual-dnd
 *
 * Usage: npm run release [patch|minor|major|<version>]
 *        npm run release:dry-run [patch|minor|major]
 *
 * Steps:
 * 1. Verify clean git working directory on master
 * 2. Run linting
 * 3. Run unit tests
 * 4. Run e2e tests
 * 5. Build the library
 * 6. Run commit-and-tag-version (bumps version, updates changelog, commits, tags)
 * 7. Push commit and tag to origin
 * 8. Publish to npm from dist/ngx-virtual-dnd
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST_PATH = 'dist/ngx-virtual-dnd';

function run(command, options = {}) {
  console.log(`\n> ${command}\n`);
  try {
    execSync(command, { stdio: 'inherit', ...options });
  } catch {
    process.exit(1);
  }
}

function runWithOutput(command) {
  return execSync(command, { encoding: 'utf-8' }).trim();
}

function validateGitState() {
  console.log('\n=== Validating git state ===');

  const branch = runWithOutput('git branch --show-current');
  if (branch !== 'master') {
    console.error(`Error: Must be on master branch. Currently on: ${branch}`);
    process.exit(1);
  }

  const status = runWithOutput('git status --porcelain');
  if (status) {
    console.error('Error: Working directory is not clean. Commit or stash changes first.');
    console.error(status);
    process.exit(1);
  }

  console.log('Git state OK: on master, working directory clean');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const releaseType = args.find((arg) => !arg.startsWith('--'));

  return { dryRun, releaseType };
}

function main() {
  const { dryRun, releaseType } = parseArgs();

  if (dryRun) {
    console.log('\n*** DRY RUN MODE - No publish or push will occur ***\n');
  }

  // Step 1: Validate git state
  validateGitState();

  // Step 2: Run linting
  console.log('\n=== Running linting ===');
  run('npm run lint');

  // Step 3: Run unit tests
  console.log('\n=== Running unit tests ===');
  run('npm test');

  // Step 4: Run e2e tests
  console.log('\n=== Running e2e tests ===');
  run('npm run e2e');

  // Step 5: Build the library
  console.log('\n=== Building library ===');
  run('npm run build:lib');

  // Verify build output exists
  const distPath = resolve(process.cwd(), DIST_PATH);
  if (!existsSync(distPath)) {
    console.error(`Error: Build output not found at ${distPath}`);
    process.exit(1);
  }

  // Step 6: Bump version and generate changelog
  console.log('\n=== Bumping version and generating changelog ===');
  const versionCmd = releaseType
    ? `npx commit-and-tag-version --release-as ${releaseType}`
    : 'npx commit-and-tag-version';
  run(versionCmd);

  if (dryRun) {
    console.log('\n*** DRY RUN COMPLETE ***');
    console.log('Skipped: git push and npm publish');
    console.log('\nTo complete the release, run without --dry-run');
    return;
  }

  // Step 7: Push to origin
  console.log('\n=== Pushing to origin ===');
  run('git push --follow-tags origin master');

  // Step 8: Publish to npm
  console.log('\n=== Publishing to npm ===');
  run('npm publish --access public', { cwd: distPath });

  console.log('\n=== Release complete! ===');
}

main();
