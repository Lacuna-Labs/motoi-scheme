#!/usr/bin/env bash
# test-fast.sh — quick test loop for iterative work.
set -euo pipefail
cd "$(dirname "$0")/.."
node --test --test-reporter=dot tests/*.test.mjs "$@"
