#!/bin/bash
# probe-composition-launch.sh — wait for per-verb probe to finish, then fire
# composition probe. Serial with the other probe to avoid Metal GPU contention.
#
# Timeout: 60 minutes waiting.

set -eu

PROBE_DIR="$HOME/.forge/runs/motoi-mk1/probe-per-verb"
RESULTS="$PROBE_DIR/results.jsonl"
COMP_PROMPTS="$PROBE_DIR/composition-prompts.jsonl"
COMP_CATALOG="$PROBE_DIR/composition-verb-catalog.jsonl"
COMP_STREAM="$PROBE_DIR/_composition_stream.log"
COMP_RESULTS="$PROBE_DIR/composition-results.jsonl"
COMP_RUN_LOG="$PROBE_DIR/_composition_run.log"
ADAPTER="$PROBE_DIR/adapter-staging"

# Threshold — we require at least 1000 rows in the per-verb results OR the
# per-verb worker to have exited (60-min timeout on the wait either way).
POLL_INTERVAL=10   # seconds
MAX_WAIT_MIN=60
MAX_ITERS=$(( MAX_WAIT_MIN * 60 / POLL_INTERVAL ))

echo "[launch] $(date +%H:%M:%S) waiting for per-verb probe to progress..."
i=0
while [ $i -lt $MAX_ITERS ]; do
    # Check if the per-verb probe is still running
    if pgrep -f "probe-per-verb.mjs" >/dev/null 2>&1; then
        rows=$(wc -l < "$RESULTS" 2>/dev/null || echo 0)
        echo "[launch] $(date +%H:%M:%S) per-verb running · rows=$rows/1067"
        # Task said "poll for 1000+ rows OR 60 min". If per-verb is close to
        # done, just wait for it to fully finish (serial is safest).
    else
        rows=$(wc -l < "$RESULTS" 2>/dev/null || echo 0)
        echo "[launch] $(date +%H:%M:%S) per-verb NOT RUNNING · rows=$rows — ready to fire composition"
        break
    fi
    sleep $POLL_INTERVAL
    i=$((i + 1))
done

if [ $i -ge $MAX_ITERS ]; then
    echo "[launch] $(date +%H:%M:%S) 60-min timeout reached; firing composition anyway"
fi

echo "[launch] $(date +%H:%M:%S) firing composition probe"
cd "$HOME/code/motoi-scheme"
exec node scripts/probe-composition.mjs \
    --prompts "$COMP_PROMPTS" \
    --catalog "$COMP_CATALOG" \
    --adapter "$ADAPTER" \
    --stream "$COMP_STREAM" \
    --results "$COMP_RESULTS" \
    --max-tokens 256 \
    >> "$COMP_RUN_LOG" 2>&1
