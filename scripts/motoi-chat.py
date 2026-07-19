#!/usr/bin/env python
"""Motoi chat — kick the tires.

Usage:
  PATH=~/code/forge/.venv/bin:$PATH python motoi-chat.py                 # 0.75 SFT
  PATH=~/code/forge/.venv/bin:$PATH python motoi-chat.py --mkA           # Grand Reveal Mk A
  PATH=~/code/forge/.venv/bin:$PATH python motoi-chat.py --base          # base Qwen, no adapter
  PATH=~/code/forge/.venv/bin:$PATH python motoi-chat.py --adapter PATH  # custom adapter
"""
import sys
import os
import argparse
from mlx_lm import load, generate

TREE = "🌳"
BASE = "Qwen/Qwen2.5-Coder-1.5B-Instruct"

SFT_ADAPTER = "/Users/alfred/.forge/runs/motoi/adapter"
MKA_ADAPTER = "/Users/alfred/.forge/runs/motoi-grand-reveal-mkA/adapter"

DEFAULT_SYSTEM = "You are Motoi, a Scheme interpreter and tutor for kids. Answer plainly. Terse. Honest about what you don't know."


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--mkA", action="store_true", help="Grand Reveal Mk A adapter")
    g.add_argument("--base", action="store_true", help="Base Qwen (no adapter)")
    g.add_argument("--adapter", type=str, default=None, help="Custom adapter path")
    ap.add_argument("--system", type=str, default=DEFAULT_SYSTEM, help="System prompt")
    ap.add_argument("--max-tokens", type=int, default=300)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    if args.base:
        adapter = None
        label = "base Qwen (no adapter)"
    elif args.mkA:
        adapter = MKA_ADAPTER
        label = "Motoi Grand Reveal Mk A"
    elif args.adapter:
        adapter = args.adapter
        label = adapter
    else:
        adapter = SFT_ADAPTER
        label = "Motoi 0.75 (SFT baseline)"

    print(f"{TREE}  loading {label} ...")
    if adapter:
        model, tok = load(BASE, adapter_path=adapter)
    else:
        model, tok = load(BASE)
    print(f"{TREE}  ready. type 'q' or ctrl-C to exit. type 'reset' to clear history.")
    print(f"{TREE}  system prompt: {args.system[:60]}{'...' if len(args.system) > 60 else ''}")
    print()

    history = [{"role": "system", "content": args.system}]

    try:
        while True:
            try:
                user = input("you  > ").strip()
            except EOFError:
                print()
                break
            if not user:
                continue
            if user.lower() in ("q", "quit", "exit"):
                break
            if user.lower() == "reset":
                history = [{"role": "system", "content": args.system}]
                print(f"{TREE}  history cleared.")
                continue

            history.append({"role": "user", "content": user})
            prompt = tok.apply_chat_template(history, tokenize=False, add_generation_prompt=True)
            out = generate(model, tok, prompt=prompt, max_tokens=args.max_tokens, verbose=False)
            print(f"{TREE}  {out}")
            print()
            history.append({"role": "assistant", "content": out})
    except KeyboardInterrupt:
        print()
    print(f"{TREE}  bye.")


if __name__ == "__main__":
    main()
