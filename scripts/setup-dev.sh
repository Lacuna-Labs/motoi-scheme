#!/usr/bin/env bash
# setup-dev.sh — one-shot dev environment bootstrap for motoi-scheme.
# Verifies Node version, installs deps.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> motoi-scheme dev setup"

NODE_VERSION=$(node --version 2>/dev/null || echo 'none')
echo "    node: $NODE_VERSION"

if command -v pnpm >/dev/null 2>&1; then
  echo "    pnpm: $(pnpm --version)"
  echo "==> installing deps with pnpm"
  pnpm install
elif command -v npm >/dev/null 2>&1; then
  echo "    npm: $(npm --version)"
  echo "==> installing deps with npm"
  npm install
else
  echo "!! neither pnpm nor npm found — install Node >= 20.16 and try again"
  exit 1
fi

echo "==> done. try:"
echo "     ./bin/motoi eval '(+ 1 2)'"
echo "     ./bin/motoi repl"
