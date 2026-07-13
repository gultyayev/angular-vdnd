#!/usr/bin/env bash

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

npm ci
npx playwright install --with-deps chromium firefox webkit
