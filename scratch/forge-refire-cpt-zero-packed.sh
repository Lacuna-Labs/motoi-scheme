#!/bin/bash
# CPT ZERO packed re-fire — 2026-08-08. One command, gated at both ends.
# Sequence: stop watcher+lane3 -> stage packs -> archive misfire run ->
#           pre-fire gates (hard stop on fail) -> fire -> verify first reports.
set -euo pipefail

DATA_RAW=~/.forge/data/motoi-cpt-zero
DATA_PACKED=~/.forge/data/motoi-cpt-zero-packed
RUN=~/.forge/runs/motoi-cpt-zero
CFG_SRC=~/code/motoi-scheme/scratch/mlx-cpt-config-packed.yaml
CFG=~/.forge/projects/motoi-cpt-zero/mlx-cpt-config-packed.yaml
GATES=~/code/motoi-scheme/scratch/cpt_fire_gates.py
PY=~/code/forge/.venv/bin/python3
ARCHIVE="$RUN/_archive-2026-08-08-misfire"

echo "=== 1. stop watcher + lane 3 (output on disk is kept) ==="
kill 68759 2>/dev/null && echo "watcher 68759 stopped" || echo "watcher already gone"
pkill -f lane3_qwen_code_variants && echo "lane3 stopped" || echo "lane3 already gone"
sleep 2

echo "=== 2. stage packs under the names mlx_lm loads ==="
mkdir -p "$DATA_PACKED"
cp "$DATA_RAW/train-packed.jsonl" "$DATA_PACKED/train.jsonl"
cp "$DATA_RAW/valid-packed.jsonl" "$DATA_PACKED/valid.jsonl"
wc -l "$DATA_PACKED/train.jsonl" "$DATA_PACKED/valid.jsonl"

echo "=== 3. archive the misfire run (no deletes) ==="
mkdir -p "$ARCHIVE"
[ -f "$RUN/train.log" ] && mv "$RUN/train.log" "$ARCHIVE/train.log"
[ -d "$RUN/adapter" ] && mv "$RUN/adapter" "$ARCHIVE/adapter"

echo "=== 4. PRE-FIRE GATES (hard stop) ==="
"$PY" "$GATES" --data "$DATA_PACKED"

echo "=== 5. fire ==="
cp "$CFG_SRC" "$CFG"
bash ~/code/forge/scripts/forge-fire-cpt.sh "$CFG" motoi-cpt-zero

echo "=== 6. verify the trainer is eating packs (90s settle) ==="
sleep 90
tail -5 "$RUN/train.log"
TOK=$(grep -oE "Iter 10: .*Trained Tokens [0-9]+" "$RUN/train.log" | grep -oE "[0-9]+$" || true)
if [ -n "$TOK" ] && [ "$TOK" -ge 35000 ]; then
  echo "OK: iter 10 trained tokens = $TOK (~4096/iter — packs confirmed)"
elif [ -n "$TOK" ]; then
  echo "!! MISFIRE AGAIN: iter 10 trained tokens = $TOK (raw records would show ~2000). KILL IT."
  exit 1
else
  echo "iter 10 not reached yet — re-check: grep 'Iter 10:' $RUN/train.log"
fi
echo "Post-run gate when done: $PY $GATES --post --data $DATA_PACKED --epochs 2"
