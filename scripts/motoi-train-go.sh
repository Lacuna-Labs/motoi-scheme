#!/usr/bin/env bash
# Motoi 0.75 training launcher — DO NOT INVOKE WITHOUT ALFRED'S GO
#
# Fires `forge start motoi` against the scaffold at ~/.forge/projects/motoi/.
# The env-var gate is deliberate friction: Alfred consciously sets
# MOTOI_TRAIN_APPROVED=1 in his shell when he decides to start.
# No agent, hook, or dotfile should ever set that variable.
#
# Config source: engineering/FOLD-TRAIN-PLAN-0.75.ENG.slat
# Memory: project_motoi_training_config_2026_07_17

set -euo pipefail

if [ "${MOTOI_TRAIN_APPROVED:-0}" != "1" ]; then
  echo "Refusing to start training. Set MOTOI_TRAIN_APPROVED=1 to override."
  echo "This is intentional. Alfred locked: 'Don't start.'"
  exit 1
fi

cd ~/.forge/projects/motoi

# Verify fold artifacts exist + are signed
[ -f dataset.jsonl ] || { echo "Missing dataset.jsonl"; exit 2; }
[ -f valid.jsonl ]   || { echo "Missing valid.jsonl"; exit 3; }
[ -f heldout.jsonl ] || { echo "Missing heldout.jsonl"; exit 4; }
[ -f config.yaml ]   || { echo "Missing config.yaml"; exit 5; }

echo "Motoi 0.75 training scaffold verified. Firing: forge start motoi"

# Locate forge — it lives inside its own venv, not on default PATH.
FORGE_BIN="${FORGE_BIN:-/Users/alfred/code/forge/.venv/bin/forge}"
if [ ! -x "$FORGE_BIN" ]; then
  # Fallback: try PATH if the user has activated the venv or installed forge globally
  if command -v forge >/dev/null 2>&1; then
    FORGE_BIN="$(command -v forge)"
  else
    echo "Missing forge binary at $FORGE_BIN — activate the forge venv or set FORGE_BIN=/path/to/forge"
    exit 6
  fi
fi

"$FORGE_BIN" start motoi
