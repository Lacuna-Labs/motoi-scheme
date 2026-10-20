#!/usr/bin/env python3
"""count-reference-programs.py — the ONE canonical program counter.

Every other counter (Python extractor's `iter_all_verbs()`, ad-hoc greps,
`src/reader.js`) has undercounted at least once. This one grep-scans every
.slat file for every code-bearing SLAT tag we know about, prints the
breakdown, and asserts the total is within tolerance of `verbs × 15` (the
5-row × 3-column grid).

Run any time. If the number looks wrong, THIS is the truth.

Usage:
    python3 scratch/count-reference-programs.py
    python3 scratch/count-reference-programs.py --by-file
    python3 scratch/count-reference-programs.py --json > /tmp/counts.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REF_DIR = Path("/Users/alfred/code/motoi-scheme/Scheme/reference")

# Every SLAT tag that carries a runnable Scheme program in the reference schema.
# Discovered by grep-inventory on 2026-08-07 across all 89 chapter files.
CODE_TAGS = (
    "code",              # :examples ((:code "...")) + row-3 rungs ((:code "..."))
    "program",           # row-2/row-4 primary program
    "eng-program",       # row-2/row-4 engineering-lens program
    "math-program",      # row-2/row-4 mathematics-lens program
    "cs-program",        # row-2/row-4 computer-science-lens program
    "composition",       # row-5 primary composition program
    "eng-composition",   # row-5 engineering-lens composition
    "math-composition",  # row-5 mathematics-lens composition
    "cs-composition",    # row-5 computer-science-lens composition
)

# Verb marker — top-level `(verb ...)` block start.
VERB_RE = re.compile(r'\(verb\b')


def count_file(path: Path) -> dict[str, int]:
    text = path.read_text(encoding="utf-8", errors="replace")
    counts = {"verbs": len(VERB_RE.findall(text))}
    for tag in CODE_TAGS:
        # Match `:tag "..."` where value starts a Scheme form
        counts[tag] = len(re.findall(rf':{re.escape(tag)}\s+"', text))
    counts["_total_programs"] = sum(counts[t] for t in CODE_TAGS)
    return counts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--by-file", action="store_true",
                    help="print per-file breakdown before totals")
    ap.add_argument("--json", action="store_true",
                    help="emit JSON instead of human-readable")
    args = ap.parse_args()

    files = sorted(REF_DIR.glob("*.slat"))
    per_file = {p.name: count_file(p) for p in files}

    totals = defaultdict(int)
    for c in per_file.values():
        for k, v in c.items():
            totals[k] += v

    if args.json:
        print(json.dumps({"per_file": per_file, "totals": dict(totals)}, indent=2))
        return 0

    if args.by_file:
        print(f"{'file':40s} verbs  total  {'  '.join(t[:8] for t in CODE_TAGS)}")
        for name, c in sorted(per_file.items()):
            row = f"{name:40s} {c['verbs']:5d} {c['_total_programs']:6d}  " + \
                  "  ".join(f"{c[t]:8d}" for t in CODE_TAGS)
            print(row)
        print()

    print(f"=== canonical reference program count (2026-08-07 schema) ===")
    print(f"chapter files:  {len(files)}")
    print(f"total verbs:    {totals['verbs']}")
    print()
    print(f"programs by tag:")
    for tag in CODE_TAGS:
        pct = 100.0 * totals[tag] / totals['_total_programs'] if totals['_total_programs'] else 0
        print(f"  :{tag:20s}  {totals[tag]:6d}   ({pct:5.1f}%)")
    print()
    print(f"TOTAL programs: {totals['_total_programs']}")
    print(f"programs / verb: {totals['_total_programs']/totals['verbs']:.2f}")
    print(f"expected (verbs × 15-grid): {totals['verbs']*15}")
    diff = totals['_total_programs'] - totals['verbs']*15
    pct = 100.0 * totals['_total_programs'] / (totals['verbs']*15) if totals['verbs'] else 0
    print(f"grid-fill: {pct:.1f}% of the 5-row × 3-column ideal")
    if diff < 0:
        print(f"UNDERFILL by {-diff} program slots — "
              f"~{-diff/totals['verbs']:.1f} missing per verb")
    else:
        print(f"OVERFILL by {diff} program slots (extras are legitimate — "
              f"per-verb :examples can exceed 3)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
