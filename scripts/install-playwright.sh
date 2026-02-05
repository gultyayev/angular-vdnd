#!/usr/bin/env bash

# Only run in remote (web) environments
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

# Install Playwright browsers (only needed in cloud, already available locally)
npx playwright install --with-deps chromium
npm install
