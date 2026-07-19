#!/usr/bin/env bash
# build-docs.sh — build the VitePress doc site into site/.vitepress/dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
npx vitepress build site
