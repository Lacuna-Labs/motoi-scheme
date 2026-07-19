#!/usr/bin/env bash
# serve-docs.sh — live doc site for local editing.
set -euo pipefail
cd "$(dirname "$0")/.."
npx vitepress dev site
