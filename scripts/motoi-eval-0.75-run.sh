#!/usr/bin/env bash
# motoi-eval-0.75-run.sh — one-liner Alfred wrapper for post-training eval.
#
# Usage:
#   bash scripts/motoi-eval-0.75-run.sh                                 # mlx backend, heuristic judge
#   bash scripts/motoi-eval-0.75-run.sh ollama                          # ollama backend
#   bash scripts/motoi-eval-0.75-run.sh mlx /custom/adapter/path        # override checkpoint
#
# Waits (politely) for mlx_lm.lora to exit before firing inference.
# Emits report to engineering/EVAL-0.75-REPORT-<ts>.slat.
# Exit 0 = ship-worthy. Exit 1 = ship-block. Any other = harness problem.

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

BACKEND="${1:-mlx}"
CHECKPOINT="${2:-/Users/alfred/.forge/runs/motoi/adapter}"
JUDGE="${MOTOI_EVAL_JUDGE:-heuristic}"

echo "Motoi 0.75 post-training eval"
echo "  backend:    $BACKEND"
echo "  checkpoint: $CHECKPOINT"
echo "  judge:      $JUDGE"
echo ""

# Wait for training to finish (up to 5 hours) if still running.
if ps -Ao command | grep -q '[m]lx_lm.lora'; then
  echo "Training in progress. Waiting up to 5h for completion..."
  end=$(( $(date +%s) + 5 * 3600 ))
  while ps -Ao command | grep -q '[m]lx_lm.lora'; do
    if (( $(date +%s) > end )); then
      echo "Timed out waiting for training. Aborting eval."
      exit 2
    fi
    sleep 30
  done
  echo "Training finished. Giving adapter 60s to settle..."
  sleep 60
fi

if [[ "$BACKEND" == "mlx" && ! -e "$CHECKPOINT" ]]; then
  echo "Checkpoint not found: $CHECKPOINT"
  echo "If you registered Motoi under ollama, try: bash $0 ollama"
  exit 2
fi

# Fire.
cd "$REPO"
exec node scripts/motoi-eval-0.75.mjs \
  --backend="$BACKEND" \
  --checkpoint="$CHECKPOINT" \
  --judge="$JUDGE"
