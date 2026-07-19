#!/usr/bin/env bash
# Motoi LLM environment setup — sources for Motoi runtime.
# Usage: source scripts/motoi-llm-up.sh
#
# Sets the env vars lib/ai/llm.js reads at every call:
#   MOTOI_LLM_ENDPOINT       — full URL for chat completions
#   MOTOI_LLM_MODEL          — model name
#   MOTOI_LLM_EMBED_ENDPOINT — full URL for embeddings (optional)
#
# Note: llm.js POSTs directly to MOTOI_LLM_ENDPOINT (does not append
# /chat/completions). So point at the FULL chat-completions path.
# Same for embeddings.
#
# Default backend: local ollama, OpenAI-compatible surface.
# Alternate backends (llama.cpp server, vLLM) also expose /v1/chat/completions
# and /v1/embeddings — flip the port/host and it works.

export MOTOI_LLM_ENDPOINT='http://localhost:11434/v1/chat/completions'
export MOTOI_LLM_MODEL='qwen2.5-coder:1.5b'
export MOTOI_LLM_EMBED_ENDPOINT='http://localhost:11434/v1/embeddings'

echo "Motoi LLM env set:"
echo "  MOTOI_LLM_ENDPOINT=$MOTOI_LLM_ENDPOINT"
echo "  MOTOI_LLM_MODEL=$MOTOI_LLM_MODEL"
echo "  MOTOI_LLM_EMBED_ENDPOINT=$MOTOI_LLM_EMBED_ENDPOINT"
echo ""
echo "Prereq: ollama serve must be running (background)."
echo "Verify: bin/motoi eval '(llm/ask \"say hi in 3 words\")'"
