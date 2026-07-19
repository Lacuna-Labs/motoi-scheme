#!/usr/bin/env bash
# Motoi LLM end-to-end verifier.
# Sources motoi-llm-up.sh, then calls (llm/ask ...) via bin/motoi eval.
# Exits nonzero on failure.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

# shellcheck disable=SC1091
source "$HERE/motoi-llm-up.sh"

# Confirm ollama endpoint is reachable before firing the verb.
if ! curl -s --max-time 3 "$MOTOI_LLM_ENDPOINT" -o /dev/null; then
  echo "WARN: $MOTOI_LLM_ENDPOINT did not respond to a probe. Is 'ollama serve' running?"
fi

echo ""
echo "Running: bin/motoi eval '(llm/ask \"say hi in 3 words\")'"
echo "---"
"$REPO/bin/motoi" eval '(llm/ask "say hi in 3 words")'
echo "---"
echo "Verify complete."
