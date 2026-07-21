"""Preflight validation for the CPT stream.

Checks:
  - File exists and is non-empty
  - Every doc has a MeCo prefix line at start
  - No doc exceeds max token length (2048 default — LLM context safety)
  - No empty docs (< N tokens)
  - No contamination (blacklist of forbidden strings)
  - Provenance chain intact (manifest doc count == stream doc count)
  - Ratios within tolerance of target

Prints PASS/FAIL per check + summary.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path
from collections import Counter

REPO = Path("/Users/alfred/code/motoi-scheme")
DEFAULT_JSONL = REPO / "training-data" / "cpt-mk2" / "cpt-stream.jsonl"
DEFAULT_MANIFEST = REPO / "training-data" / "cpt-mk2" / "cpt-manifest.jsonl"

# Updated for Qwen-native + FIM (G) inclusion per doctrine
TARGET_RATIOS = {"A": 0.18, "E": 0.28, "F": 0.07, "B": 0.14, "C": 0.14, "D": 0.09, "G": 0.10}
RATIO_TOLERANCE = 0.02  # allow ±2 percentage points
MIN_DOC_TOKENS = 5
MAX_DOC_TOKENS = 2048

CONTAMINATION_BLACKLIST = [
    "sudo rm -rf",
    "curl http://",
    "ANTHROPIC_API_KEY",
]


def approx_tokens(s: str) -> int:
    return len(s.split())


def load_stream_docs(jsonl_path: Path) -> list[str]:
    docs = []
    with jsonl_path.open() as f:
        for line in f:
            if line.strip():
                d = json.loads(line)
                if "text" in d:
                    docs.append(d["text"])
    return docs


def check_meco_prefix(docs: list[str]) -> tuple[bool, int]:
    """Every doc should either:
       - Start with a MeCo prefix line like [axis:X], OR
       - Start with Qwen's <|repo_name|> native token (E/F/G docs after
         Qwen wrapping doctrine adopted 2026-07-21).

    Both are acceptable — the MeCo prefix will be on line 2 for Qwen-wrapped
    docs (right after the <|repo_name|>...<|file_sep|>... header).
    """
    missing = 0
    for d in docs:
        first_line = d.split("\n", 1)[0]
        # Case 1: MeCo prefix on line 1
        if re.match(r"^\[[a-z-]+:[^\]]+\]", first_line):
            continue
        # Case 2: Qwen native header on line 1; MeCo prefix should be on line 2
        if first_line.startswith("<|repo_name|>"):
            lines = d.split("\n", 2)
            if len(lines) >= 2 and re.match(r"^\[[a-z-]+:[^\]]+\]", lines[1]):
                continue
        # Case 3: FIM docs start with <|fim_prefix|> — those have header line 1
        # and [type:fim] on line 2 (also acceptable)
        # Fall through: MISSING
        missing += 1
    return missing == 0, missing


def check_token_lengths(docs: list[str]) -> tuple[bool, int, int]:
    too_short = 0
    too_long = 0
    for d in docs:
        n = approx_tokens(d)
        if n < MIN_DOC_TOKENS:
            too_short += 1
        elif n > MAX_DOC_TOKENS:
            too_long += 1
    return (too_short == 0 and too_long == 0), too_short, too_long


def check_contamination(docs: list[str]) -> tuple[bool, list[tuple[int, str]]]:
    hits: list[tuple[int, str]] = []
    for i, d in enumerate(docs):
        for pat in CONTAMINATION_BLACKLIST:
            if pat in d:
                hits.append((i, pat))
    return len(hits) == 0, hits


def check_provenance(manifest_path: Path, stream_doc_count: int) -> tuple[bool, int]:
    n_manifest = 0
    with manifest_path.open() as f:
        for _ in f:
            n_manifest += 1
    return n_manifest == stream_doc_count, n_manifest


def check_ratios(manifest_path: Path, docs: list[str]) -> tuple[bool, dict[str, float]]:
    types_by_idx: dict[int, str] = {}
    with manifest_path.open() as f:
        for line in f:
            m = json.loads(line)
            types_by_idx[m["doc_idx"]] = m.get("type", "?")

    tok_by_type: Counter[str] = Counter()
    for i, d in enumerate(docs):
        t = types_by_idx.get(i, "?")
        tok_by_type[t] += approx_tokens(d)

    total = sum(tok_by_type.values())
    actual = {t: tok_by_type[t] / total if total else 0 for t in TARGET_RATIOS}
    within_tolerance = all(
        abs(actual[t] - TARGET_RATIOS[t]) <= RATIO_TOLERANCE for t in TARGET_RATIOS
    )
    return within_tolerance, actual


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--jsonl", type=Path, default=DEFAULT_JSONL)
    p.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = p.parse_args()

    fails = 0

    def report(name: str, ok: bool, detail: str = ""):
        nonlocal fails
        mark = "PASS" if ok else "FAIL"
        line = f"[{mark}] {name}"
        if detail:
            line += f"  ({detail})"
        print(line)
        if not ok:
            fails += 1

    # File exists
    if not args.jsonl.exists():
        print(f"[FAIL] JSONL stream does not exist: {args.jsonl}")
        sys.exit(1)
    if not args.manifest.exists():
        print(f"[FAIL] Manifest does not exist: {args.manifest}")
        sys.exit(1)

    docs = load_stream_docs(args.jsonl)
    n_docs = len(docs)
    total_tokens = sum(approx_tokens(d) for d in docs)
    print(f"Stream: {args.jsonl}")
    print(f"  {n_docs:,} docs · {total_tokens:,} approx tokens · "
          f"{args.jsonl.stat().st_size / 1_000_000:.1f} MB")
    print(f"Manifest: {args.manifest}")
    print()

    # MeCo prefix
    ok, missing = check_meco_prefix(docs)
    report("MeCo prefix present on every doc", ok,
           f"{missing:,} missing" if not ok else f"all {n_docs:,} have prefix")

    # Token lengths
    ok, ts, tl = check_token_lengths(docs)
    report("Doc token lengths in [5, 2048]", ok,
           f"too_short={ts} too_long={tl}" if not ok else "all within bounds")

    # Contamination
    ok, hits = check_contamination(docs)
    report("No contamination patterns", ok,
           f"{len(hits)} hits" if not ok else "clean")

    # Provenance chain
    ok, n_manifest = check_provenance(args.manifest, n_docs)
    report("Provenance manifest matches stream count", ok,
           f"stream={n_docs:,} manifest={n_manifest:,}" if not ok else
           f"{n_docs:,} == {n_docs:,}")

    # Ratios
    ok, actual = check_ratios(args.manifest, docs)
    detail = " ".join(
        f"{t}:{actual[t]*100:.1f}%(target {TARGET_RATIOS[t]*100:.0f}%)"
        for t in sorted(TARGET_RATIOS)
    )
    report(f"Ratios within ±{RATIO_TOLERANCE*100:.0f}pp of target", ok, detail)

    print()
    if fails == 0:
        print(f"✓ All preflight checks PASSED. Stream ready for CPT.")
    else:
        print(f"✗ {fails} preflight check(s) FAILED. Fix before firing CPT.")
        sys.exit(1)


if __name__ == "__main__":
    main()
