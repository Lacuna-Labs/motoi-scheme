#!/usr/bin/env bash
# install.sh — one-line install for Motoi Scheme.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/Lacuna-Labs/motoi-scheme/main/install.sh | bash
#
# What it does:
#   1. Clones motoi-scheme to $MOTOI_HOME (default: ~/.motoi)
#   2. Runs npm install
#   3. Symlinks bin/motoi to ~/.local/bin/motoi (or prints instructions
#      if that dir isn't in PATH)
#
# Env:
#   MOTOI_HOME   install dir (default: ~/.motoi)
#   MOTOI_REF    git ref to check out (default: main)

set -euo pipefail

MOTOI_HOME="${MOTOI_HOME:-$HOME/.motoi}"
MOTOI_REF="${MOTOI_REF:-main}"
BIN_TARGET="$HOME/.local/bin"
REPO_URL="https://github.com/Lacuna-Labs/motoi-scheme.git"

say() { printf '\033[1;35m[motoi]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[motoi]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[motoi]\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required. Install git and re-run."
command -v node >/dev/null 2>&1 || die "node is required (>= 20.16). Install Node.js and re-run."
command -v npm >/dev/null 2>&1 || die "npm is required. Install Node.js and re-run."

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "node $NODE_MAJOR is too old — need >= 20.16. Update Node and re-run."
fi

say "installing Motoi Scheme to $MOTOI_HOME"

if [ -d "$MOTOI_HOME/.git" ]; then
  say "existing install found — pulling latest"
  (cd "$MOTOI_HOME" && git fetch origin && git checkout "$MOTOI_REF" && git pull --ff-only)
elif [ -d "$MOTOI_HOME" ] && [ -z "$(ls -A "$MOTOI_HOME" 2>/dev/null)" ]; then
  # Empty dir (common: a prior install died before .git was created).
  # Remove it silently — no cruft, nothing to preserve.
  rmdir "$MOTOI_HOME"
  say "cloning $REPO_URL"
  git clone --depth 1 --branch "$MOTOI_REF" "$REPO_URL" "$MOTOI_HOME"
elif [ -e "$MOTOI_HOME" ]; then
  # Something's there and it's not ours. Don't touch it; tell the user what to do.
  die "$MOTOI_HOME exists but is not a Motoi git checkout.
       Move it aside or delete it, then re-run this installer:
         mv $MOTOI_HOME $MOTOI_HOME.old
       or (if you're sure it's not yours):
         rm -rf $MOTOI_HOME"
else
  say "cloning $REPO_URL"
  git clone --depth 1 --branch "$MOTOI_REF" "$REPO_URL" "$MOTOI_HOME"
fi

say "installing npm dependencies (this is a few seconds)"
(cd "$MOTOI_HOME" && npm install --silent --no-audit --no-fund)

say "linking motoi to $BIN_TARGET/motoi"
mkdir -p "$BIN_TARGET"
ln -sf "$MOTOI_HOME/bin/motoi" "$BIN_TARGET/motoi"

if ! echo ":$PATH:" | grep -q ":$BIN_TARGET:"; then
  warn "$BIN_TARGET is not in your PATH."
  warn "Add this to your shell rc file (~/.zshrc or ~/.bashrc):"
  warn "  export PATH=\"$BIN_TARGET:\$PATH\""
fi

say "done. Try:"
say "  motoi run $MOTOI_HOME/carts/cart-pico8-demo/pico8-dots.scm"
say ""
say "or start the REPL:"
say "  motoi repl"
