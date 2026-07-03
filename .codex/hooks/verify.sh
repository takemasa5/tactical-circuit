#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

base_ref=""
if git show-ref --verify --quiet refs/remotes/origin/develop; then
  base_ref="origin/develop"
elif git show-ref --verify --quiet refs/heads/develop; then
  base_ref="develop"
elif git symbolic-ref --quiet refs/remotes/origin/HEAD >/dev/null; then
  base_ref="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD)"
elif git show-ref --verify --quiet refs/remotes/origin/main; then
  base_ref="origin/main"
elif git show-ref --verify --quiet refs/heads/main; then
  base_ref="main"
fi

changed="$({
  if git rev-parse --verify --quiet HEAD >/dev/null; then
    if [[ -n "$base_ref" ]]; then
      merge_base="$(git merge-base HEAD "$base_ref")"
      git diff --name-only "$merge_base" HEAD
    else
      empty_tree="$(git hash-object -t tree /dev/null)"
      git diff --name-only "$empty_tree" HEAD
    fi
    git diff --name-only HEAD
  fi
  git ls-files --others --exclude-standard
} | sort -u)"

block_stop() {
  printf '%s\n' '{"decision":"block","reason":"品質検査に失敗しました。stderrのログを確認して修正してください。"}'
  exit 0
}

if echo "$changed" | grep -Eq '\.(ts|tsx|js|jsx)$'; then
  npm run lint >&2 || block_stop
  npm run typecheck >&2 || block_stop
fi

if echo "$changed" | grep -Eq 'package.json|package-lock.json|vite.config|tsconfig'; then
  npm run build >&2 || block_stop
fi
