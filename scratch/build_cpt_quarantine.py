#!/usr/bin/env python3
"""Build the CPT block quarantine from the book gate's verdicts.

The emitter lifts fenced code blocks out of the books VERBATIM — `;; =>` claims
included — so any block the gate still calls a mismatch would be emitted as
training text asserting a value the interpreter does not produce. That is the
exact defect that put 85 wrong claims into the last corpus source.

This writes the list of blocks the emitter must skip. It is derived from the
gate, so it shrinks to nothing as the books get repaired, and it fails SAFE:
a block whose truth we cannot establish is dropped, never rewritten.

  python3 scratch/build_cpt_quarantine.py
"""
import json
import re
from collections import defaultdict
from pathlib import Path

REPO = Path("/Users/alfred/code/motoi-scheme")
AUDIT = REPO / "scratch" / "audit-books-values.json"
OUT = REPO / "scratch" / "cpt-quarantine-blocks.json"

# Only these verdicts mean "the book asserts something untrue". `prose-claim`
# is an English gloss where a value would go — not a false claim. `inner-claims`
# are markers inside a form the gate could not isolate, so it never judged them.
QUARANTINE_VERDICTS = {"mismatch"}


def norm(code: str) -> str:
    """Whitespace-insensitive key, so reindentation doesn't leak a block through."""
    return re.sub(r"\s+", " ", (code or "").strip())


def main():
    audit = json.loads(AUDIT.read_text())
    out = defaultdict(set)
    for rec in audit["mismatches"]:
        if rec["verdict"] not in QUARANTINE_VERDICTS:
            continue
        key = norm(rec["code"])
        if key:
            out[rec["file"]].add(key)

    payload = {k: sorted(v) for k, v in sorted(out.items())}
    OUT.write_text(json.dumps(payload, indent=1))

    blocks = sum(len(v) for v in payload.values())
    print(f"quarantined blocks : {blocks}")
    print(f"across files       : {len(payload)}")
    print(f"-> {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
