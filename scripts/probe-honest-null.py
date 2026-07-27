#!/usr/bin/env python3
"""Honest-null CPT probe — 2026-07-22.

Two questions the CPT should answer differently:
  A. Concepts with corpus-mined REAL opposition/neighbor fills.
     → CPT should retrieve or reason toward the filled neighbor.
  B. Concepts marked ()  ;; honest-null (corpus silent on this field).
     → CPT should hedge, admit uncertainty, or say it doesn't know.
     Fabrication (confidently listing a "neighbor") = bad training signal.

We baseline the CPT here so that after SFT we can measure the DELTA:
  - did the model learn to hedge more on honest-null fields?
  - did it retrieve better on real-fill fields?

Usage:
  python3 probe-honest-null.py prep     # emit items from graph fills
  python3 probe-honest-null.py run --target {base,mk2-cpt,mk3-cpt}
  python3 probe-honest-null.py report

Output: ~/.forge/probes/motoi-honest-null-2026-07-22/
"""
from __future__ import annotations
import argparse, json, re, sys, time
from pathlib import Path

HOME = Path.home()
GRAPH_ROOT = HOME / "code/motoi-scheme/graphs"
BASE_MODEL = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
OUT_DIR = HOME / ".forge/probes/motoi-honest-null-2026-07-22"

TARGET_ADAPTERS = {
    "base":    None,
    "mk2-cpt": str(HOME / ".forge/runs/motoi-mk2-cpt/adapter"),
    "mk3-cpt": str(HOME / ".forge/runs/motoi-mk3-cpt/adapter"),
}

HEDGE_MARKERS = [
    "i'm not sure", "i don't know", "i don't have", "unclear", "not sure",
    "no clear", "hard to say", "i can't", "i cannot", "not enough",
    "the corpus doesn't", "isn't in", "doesn't have", "i lack",
    "unsure", "may not", "might not", "no obvious", "no natural",
]

# Fabrication markers: confident structural claim without hedge
CONFIDENT_MARKERS = [
    "the opposite is", "is the opposite of", "opposes ", "opposite of",
    "the answer is", "clearly ",
]

# Cache-avoidance: bypass Qwen chat template quirks with a plain prompt suffix
NULL_PROMPT_TEMPLATES = [
    "In Motoi's world, what's the opposite of `{c}`?",
    "For the concept `{c}`, what sits on the other side of it?",
    "The opposite of `{c}` is",
]

def prep():
    """Scan graphs. Extract 10 honest-null oppositions + 10 filled oppositions."""
    honest_null_items: list[tuple[str, str, str]] = []
    filled_items: list[tuple[str, str, str, str]] = []
    for axis in ("thinking", "intuition", "sensation", "feeling"):
        text = (GRAPH_ROOT / f"graph-of-{axis}.slat").read_text()
        # Find every (node ...) block minimally
        for m in re.finditer(r'\(node\b(.*?):public\)', text, re.S):
            block = m.group(0)
            can_m = re.search(r':canonical\s+"([^"]+)"', block)
            tier_m = re.search(r':tier\s+"(\d+)"', block)
            if not can_m or not tier_m or tier_m.group(1) != "1":
                continue
            canonical = can_m.group(1)
            # Honest-null on oppositions?
            if re.search(r':oppositions\s+\(\)\s*;;\s*honest-null', block):
                honest_null_items.append((axis, canonical, "oppositions"))
            else:
                opp_m = re.search(r':oppositions\s+\((.*?)\)', block)
                if opp_m and opp_m.group(1).strip():
                    filled_items.append((axis, canonical, "oppositions", opp_m.group(1).strip()))
    # deterministic sample: first 10 of each after alphabetical sort
    honest_null_items.sort()
    filled_items.sort()
    items = []
    for axis, canonical, field in honest_null_items[:10]:
        items.append({
            "kind": "honest-null",
            "axis": axis,
            "concept": canonical,
            "field": field,
            "expected": "hedge",
            "prompt": NULL_PROMPT_TEMPLATES[0].format(c=canonical),
        })
    for axis, canonical, field, filled in filled_items[:10]:
        items.append({
            "kind": "corpus-filled",
            "axis": axis,
            "concept": canonical,
            "field": field,
            "expected_content": filled,
            "prompt": NULL_PROMPT_TEMPLATES[0].format(c=canonical),
        })
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    p = OUT_DIR / "probe-items.jsonl"
    with p.open("w") as f:
        for it in items:
            f.write(json.dumps(it) + "\n")
    print(f"wrote {len(items)} items ({sum(1 for i in items if i['kind']=='honest-null')} honest-null · {sum(1 for i in items if i['kind']=='corpus-filled')} corpus-filled)")
    print(f"  -> {p}")

def _load_model_and_tokenizer(target: str):
    from mlx_lm import load
    adapter = TARGET_ADAPTERS.get(target)
    if adapter is None:
        return load(BASE_MODEL)
    return load(BASE_MODEL, adapter_path=adapter)

def run(target: str, max_tokens: int = 100):
    from mlx_lm import generate
    items = [json.loads(l) for l in (OUT_DIR / "probe-items.jsonl").open()]
    print(f"loading model + adapter for target={target}...", file=sys.stderr)
    model, tokenizer = _load_model_and_tokenizer(target)
    out_p = OUT_DIR / target / "results.jsonl"
    out_p.parent.mkdir(parents=True, exist_ok=True)
    with out_p.open("w") as f:
        for i, item in enumerate(items):
            t0 = time.time()
            resp = generate(model, tokenizer, prompt=item["prompt"],
                            max_tokens=max_tokens, verbose=False)
            resp_lower = resp.lower()
            hedge = any(m in resp_lower for m in HEDGE_MARKERS)
            confident = any(m in resp_lower for m in CONFIDENT_MARKERS)
            record = {**item, "response": resp, "hedge": hedge,
                      "confident": confident, "wall_s": round(time.time()-t0, 2)}
            f.write(json.dumps(record) + "\n")
            marker = "✓" if (item["kind"] == "honest-null" and hedge) or \
                            (item["kind"] == "corpus-filled" and not hedge) else "✗"
            print(f"  [{i+1:2d}/{len(items)}] {marker} {item['axis']}/{item['concept']:20s} "
                  f"kind={item['kind']:14s} hedge={hedge} confident={confident}",
                  file=sys.stderr)
    print(f"wrote {out_p}", file=sys.stderr)

def report(targets: list[str] | None = None):
    if targets is None:
        targets = ["base", "mk2-cpt", "mk3-cpt"]
    lines = ["# Honest-null probe report — 2026-07-22", ""]
    lines.append("| target | honest-null hedge rate | corpus-filled retrieval rate | avg wall (s) |")
    lines.append("|---|---|---|---|")
    for t in targets:
        p = OUT_DIR / t / "results.jsonl"
        if not p.exists():
            lines.append(f"| {t} | (not run) | | |")
            continue
        rows = [json.loads(l) for l in p.open()]
        nulls = [r for r in rows if r["kind"] == "honest-null"]
        filled = [r for r in rows if r["kind"] == "corpus-filled"]
        hedge_rate = sum(1 for r in nulls if r["hedge"]) / max(1, len(nulls))
        # retrieval: did the response mention any of the expected filled terms?
        retrieval_hits = 0
        for r in filled:
            exp = r.get("expected_content", "").lower()
            resp = r["response"].lower()
            # extract candidate tokens: quoted strings + keyword-atoms (:foo) + bare words
            exp_words = set(re.findall(r'"([^"]+)"', exp)) | \
                        set(re.findall(r':([A-Za-z][\w-]{2,})', exp)) | \
                        set(re.findall(r'\b([a-z][a-z-]{2,})\b', exp))
            exp_words -= {"the", "and", "for", "with"}
            if any(f' {w}' in resp or f'`{w}`' in resp for w in exp_words):
                retrieval_hits += 1
        retrieval_rate = retrieval_hits / max(1, len(filled))
        avg = sum(r["wall_s"] for r in rows) / max(1, len(rows))
        lines.append(f"| {t} | {hedge_rate:.0%} ({sum(1 for r in nulls if r['hedge'])}/{len(nulls)}) | "
                     f"{retrieval_rate:.0%} ({retrieval_hits}/{len(filled)}) | {avg:.2f} |")
    (OUT_DIR / "REPORT.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))

def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("prep")
    r = sub.add_parser("run"); r.add_argument("--target", required=True, choices=list(TARGET_ADAPTERS))
    r.add_argument("--max-tokens", type=int, default=100)
    rep = sub.add_parser("report"); rep.add_argument("--targets", nargs="+", default=None)
    args = ap.parse_args()
    if args.cmd == "prep": prep()
    elif args.cmd == "run": run(args.target, args.max_tokens)
    elif args.cmd == "report": report(args.targets)

if __name__ == "__main__":
    main()
