#!/usr/bin/env python3
"""probe-mlx-worker.py — persistent MLX generator worker.

Reads JSON prompts from stdin, one per line, of the form:
    {"id": "...", "prompt": "..."}

For each, generates a response through the adapter and writes JSON to stdout:
    {"id": "...", "text": "..."}
or
    {"id": "...", "error": "..."}

Usage:
    probe-mlx-worker.py --adapter <adapter-dir> [--base <model>] [--max-tokens N]

Adapter path must be a DIRECTORY containing adapter_config.json + adapters.safetensors.
"""
import argparse
import json
import sys
import traceback

BASE_MODEL_DEFAULT = "Qwen/Qwen2.5-Coder-1.5B-Instruct"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--adapter", required=True, help="Adapter DIR (has adapter_config.json + adapters.safetensors)")
    p.add_argument("--base", default=BASE_MODEL_DEFAULT)
    p.add_argument("--max-tokens", type=int, default=160)
    args = p.parse_args()

    # Import + load model
    try:
        from mlx_lm import load, generate
    except Exception as e:
        print(json.dumps({"_startup_error": f"mlx_lm import: {e}"}), flush=True)
        sys.exit(2)

    try:
        model, tokenizer = load(args.base, adapter_path=args.adapter)
    except Exception as e:
        print(json.dumps({"_startup_error": f"model load failed: {e}\n{traceback.format_exc()}"}), flush=True)
        sys.exit(2)

    # Ready signal
    print(json.dumps({"_ready": True, "adapter": args.adapter, "base": args.base}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except Exception as e:
            print(json.dumps({"error": f"bad json input: {e}"}), flush=True)
            continue
        prompt = row.get("prompt", "")
        rid = row.get("id", "")
        try:
            messages = [{"role": "user", "content": prompt}]
            try:
                templated = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            except Exception:
                templated = prompt
            text = generate(
                model, tokenizer,
                prompt=templated,
                max_tokens=args.max_tokens,
                verbose=False,
            )
            print(json.dumps({"id": rid, "text": text}), flush=True)
        except Exception as e:
            print(json.dumps({"id": rid, "error": f"generate failed: {e}"}), flush=True)


if __name__ == "__main__":
    main()
