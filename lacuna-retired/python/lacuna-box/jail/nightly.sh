#!/bin/bash
# nightly — Lacuna tends its own memory while the house sleeps (2026-10-11; launchd ai.lacunalabs.lacuna-nightly, 03:30).
# On the 8B, inside the jail: tidy PROFILE.md (merge, drop what's stale, keep it short, commit) and make sure today has a
# journal entry. Skipped when the GPU is busy. Its words land in ~/.lacuna/logs/nightly.log.
LOG="$HOME/.lacuna/logs/nightly.log"; echo "── $(date '+%F %T')" >> "$LOG"
[ -f "$HOME/.lacuna/jail/gpu-busy" ] && { echo "skipped: the GPU is busy" >> "$LOG"; exit 0; }
# the brain may be reloading (launchd brings it back in ~20 s): wait for OUR OWN port up to three minutes, then say so
for i in $(seq 1 36); do curl -sf -o /dev/null --max-time 3 http://127.0.0.1:8091/health && break; sleep 5; done
curl -sf -o /dev/null --max-time 3 http://127.0.0.1:8091/health || { echo "skipped: the brain did not answer in 3 minutes" >> "$LOG"; exit 0; }
"$HOME/.local/bin/lacuna-pi" --model ollama/lacuna-worker-lite -p "Nightly tending, no one is watching — work quietly and briefly.
1. Read ~/lacuna-world/PROFILE.md and the last two journal entries (ls ~/lacuna-world/journal | tail -2).
2. Tidy PROFILE.md: fold in anything lasting from the journal, merge duplicates, remove what is no longer true, keep it under 80 lines. Never add anything you are not sure of.
3. If today's journal entry (date +%F) does not exist and the journal shows work today, write a short one.
4. cd ~/lacuna-world && git add -A PROFILE.md journal && git commit -qm 'nightly: tended memory' (fine if there is nothing to commit).
Reply with one line saying what you changed." >> "$LOG" 2>&1
