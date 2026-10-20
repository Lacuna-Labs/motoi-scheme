#!/bin/sh
# Preserve raw Mistral output before the editor's pass overwrites it.
while pgrep -f draft_records >/dev/null; do
  for f in drafts/*.slat; do
    [ -f "$f" ] || continue
    b=$(basename "$f")
    if grep -q 'draft_records.py (model:' "$f" 2>/dev/null && [ ! -f "drafts/_raw/$b" ]; then
      cp "$f" "drafts/_raw/$b"
    fi
  done
  sleep 10
done
