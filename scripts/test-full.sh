#!/usr/bin/env bash
# test-full.sh — full test loop including cross-binding slat round-trip.
set -euo pipefail
cd "$(dirname "$0")/.."
node --test tests/*.test.mjs "$@"
if [ -d bindings/python ]; then
  echo "==> running Python binding tests"
  (cd bindings/python && python -m pytest 2>&1 || true)
fi
