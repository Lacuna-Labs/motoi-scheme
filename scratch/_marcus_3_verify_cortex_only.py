#!/usr/bin/env python3
"""Pre-run cortex-snippet verification only (does NOT write final output)."""
import sys
sys.path.insert(0, "/Users/alfred/code/motoi-scheme/scratch")
from gen_marcus_3_persona_lite_2026_07_17 import (
    CORTEX_TEMPLATES, verify_cortex_snippet,
)

ok = 0
fail = 0
fail_log = []
for prompt, snippet, note in CORTEX_TEMPLATES:
    good, err = verify_cortex_snippet(snippet)
    if good:
        ok += 1
    else:
        fail += 1
        fail_log.append((prompt, snippet, err))

print(f"Cortex verification: {ok} pass / {fail} fail (of {len(CORTEX_TEMPLATES)})")
for p, s, e in fail_log:
    print(f"  FAIL: {p!r}\n    snippet: {s}\n    err: {e[:200]}")
