#!/usr/bin/env bash
#
# install-hooks.sh — repo-scoped git hooks install for motoi-scheme.
#
# Sets `git config core.hooksPath .githooks` so this clone runs the hooks
# in .githooks/ instead of .git/hooks/. Repo-scoped: no global side effects.
#
# The hooks themselves live in .githooks/ (tracked in git). See
# .githooks/README.md for what each hook enforces.
#
# Prior version of this script delegated to ~/code/lacuna-git-hooks/install.sh
# if present. That path was never wired up in this repo; the .githooks/ dir
# is authoritative now.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d ".githooks" ]; then
  echo "!! .githooks/ not found — expected at $(pwd)/.githooks"
  exit 1
fi

git config core.hooksPath .githooks

echo "==> core.hooksPath set to .githooks"
echo "    hooks installed:"
for hook in .githooks/*; do
  [ -f "$hook" ] && [ -x "$hook" ] && echo "      $(basename "$hook")"
done
echo
echo "    verify:"
echo "      git config core.hooksPath   # -> .githooks"
