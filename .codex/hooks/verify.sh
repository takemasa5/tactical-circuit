#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

base_ref=""
if git show-ref --verify --quiet refs/remotes/origin/develop; then
  base_ref="origin/develop"
elif git show-ref --verify --quiet refs/heads/develop; then
  base_ref="develop"
fi

changed="$({
  if [[ -n "$base_ref" ]]; then
    merge_base="$(git merge-base HEAD "$base_ref")"
    git diff --name-only "$merge_base" HEAD
  fi
  git diff --name-only HEAD
  git ls-files --others --exclude-standard
} | sort -u)"

if echo "$changed" | grep -Eq '\.(ts|tsx|js|jsx)$'; then
  npm run lint >&2
  npm run typecheck >&2
fi

if echo "$changed" | grep -Eq 'package.json|package-lock.json|vite.config|tsconfig'; then
  npm run build >&2
fi
