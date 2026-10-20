#!/usr/bin/env python3
"""Lane 4 — Haiku judgment (batched, cached prefixes).

Three sub-jobs:
  (a) 116 book prose-claim + inner-claim triage → keep-prose vs re-author
  (b) Mistral paraphrase reviews for cosine-borderline (0.80-0.85) pairs
  (c) Qwen-Coder variant sanity checks for weird-but-passing code

Requires ANTHROPIC_API_KEY in env. Uses prompt caching (cache_control:
ephemeral) on the system prompt + template + task-specific rubric.

Fire AFTER Lane 2 + Lane 3 have run. Non-blocking on training.
"""
from __future__ import annotations
import argparse, json, os, sys
from pathlib import Path

try:
    from anthropic import Anthropic
except ImportError:
    print("ERROR: pip install anthropic (in whichever venv you run this from)",
          file=sys.stderr)
    sys.exit(2)

REPO = Path("/Users/alfred/code/motoi-scheme")
OUT = Path.home() / ".forge/data/motoi-cpt-zero/lane4-haiku-triage.jsonl"
MODEL = "claude-haiku-4-5-20251001"

SYS = """You are Haiku, a judgment-only helper. You return short labels only,
no explanation. Your job is triage — read the input, apply the rubric, emit
the single-word verdict from the allowed set. If unsure, emit "unsure".
Never speculate; never elaborate."""

RUBRICS = {
    "prose_claim": {
        "prompt": ("Rubric: Is the following text a legitimate PROSE description "
                   "of a value (keep) or a stale claim that should be re-authored "
                   "as an explicit value (re-author)? Allowed labels: keep · "
                   "re-author · unsure."),
        "max_tokens": 8,
    },
    "paraphrase_meaning": {
        "prompt": ("Rubric: Does the rewrite preserve the exact meaning of the "
                   "original? Same technical facts, same code references, same "
                   "invariants. Allowed labels: same · different · unsure."),
        "max_tokens": 8,
    },
    "code_variant_taste": {
        "prompt": ("Rubric: Is this an idiomatic Scheme variant worth teaching, "
                   "or a weird/pathological form that would confuse a learner? "
                   "Allowed labels: good · weird · unsure."),
        "max_tokens": 8,
    },
}


def call_haiku(client, rubric_key: str, batch: list[dict]) -> list[str]:
    """Return one label per batch item. Uses cache_control on the shared prefix."""
    r = RUBRICS[rubric_key]
    labels = []
    for item in batch:
        content = f"{r['prompt']}\n\nInput:\n{item['payload']}\n\nVerdict:"
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=r["max_tokens"],
                system=[
                    {"type": "text", "text": SYS,
                     "cache_control": {"type": "ephemeral"}},
                ],
                messages=[{"role": "user", "content": content}],
            )
            labels.append(resp.content[0].text.strip().lower().split()[0])
        except Exception as e:
            labels.append(f"error:{type(e).__name__}")
    return labels


def load_prose_claims():
    """The 116 book prose-claim + inner-claim rows from audit-books-values.json."""
    p = REPO / "scratch" / "audit-books-values.json"
    if not p.exists():
        return []
    d = json.load(p.open())
    items = []
    for m in d.get("mismatches", []):
        if m.get("verdict") in ("prose-claim", "inner-claims"):
            items.append({
                "kind": "prose_claim",
                "id": f"{m['file']}::{m['key']}",
                "payload": f"Claim text: {m.get('claim', '')}\n"
                           f"Actual value: {m.get('value', '')}",
            })
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=("prose_claim", "paraphrase_meaning",
                                       "code_variant_taste", "all"),
                    default="prose_claim")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        print("ERROR: set ANTHROPIC_API_KEY env var to fire Lane 4",
              file=sys.stderr)
        sys.exit(2)

    client = Anthropic(api_key=key)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    if args.kind in ("prose_claim", "all"):
        items = load_prose_claims()
        if args.limit:
            items = items[:args.limit]
        print(f"[lane4/prose_claim] {len(items)} items", flush=True)
        BATCH = 20
        with OUT.open("a") as out:
            for start in range(0, len(items), BATCH):
                batch = items[start:start + BATCH]
                labels = call_haiku(client, "prose_claim", batch)
                for item, label in zip(batch, labels):
                    out.write(json.dumps({
                        "kind": "prose_claim",
                        "id": item["id"],
                        "label": label,
                        "_lane": 4,
                    }) + "\n")
                out.flush()
                print(f"[lane4] {start+len(batch)}/{len(items)}", flush=True)


if __name__ == "__main__":
    main()
