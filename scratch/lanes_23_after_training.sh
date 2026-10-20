#!/usr/bin/env bash
# Watch the CPT ZERO training PID; when it exits, run Lane 2 then Lane 3
# sequentially so we never contend on GPU with a live full-parameter run.
#
# Fires AFTER training completes. Safe to run in background:
#   nohup bash scratch/lanes_23_after_training.sh > /tmp/lanes-23.log 2>&1 &

set -u
REPO="/Users/alfred/code/motoi-scheme"
PID_FILE="$HOME/.forge/runs/motoi-cpt-zero/pid"
LOG_DIR="$HOME/.forge/data/motoi-cpt-zero"

if [[ ! -f "$PID_FILE" ]]; then
  echo "no pid file at $PID_FILE — is training running?" >&2
  exit 1
fi

TRAIN_PID=$(cat "$PID_FILE")
echo "[watch] waiting on training pid $TRAIN_PID..."
while ps -p "$TRAIN_PID" > /dev/null 2>&1; do
  sleep 60
done

echo "[watch] training pid $TRAIN_PID exited at $(date). Firing Lane 2 (Mistral)..."

# Lane 2: Mistral prose paraphrase — expect 2732 paras × 4 = ~11k records, ~4-8h
python3 "$REPO/scratch/lane2_mistral_prose_paraphrase.py" \
  > "$LOG_DIR/lane2.log" 2>&1

echo "[lane2] done at $(date). Firing Lane 3 (Qwen-30-Coder)..."

# Lane 3: Qwen-30-Coder code variants — bounded 271 verbs, ~12k variants, ~15-20h
python3 "$REPO/scratch/lane3_qwen_coder_variants.py" \
  > "$LOG_DIR/lane3.log" 2>&1

echo "[lane3] done at $(date). All lanes complete."
