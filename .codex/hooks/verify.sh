#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

changed="$(git diff --name-only HEAD || true)"

if echo "$changed" | grep -Eq '\.(ts|tsx|js|jsx)$'; then
  npm run lint
  npm run typecheck
fi

if echo "$changed" | grep -Eq 'package.json|package-lock.json|vite.config|tsconfig'; then
  npm run build
fi
