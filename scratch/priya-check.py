#!/usr/bin/env python3
"""priya-check.py — run the VALUE gate over ONE book file (or a few).

Same machinery as audit-books-values.py (imported, not reimplemented, so it
cannot drift): chapter-scoped accumulating prefix, instrumented forms, claim
compared against both printed output and returned value.

  python3 scratch/priya-check.py scheme-books/book-of-sound/ch16-*.book.slatl
"""
from __future__ import annotations
import json, sys, importlib.util
from pathlib import Path
from collections import Counter, OrderedDict

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
sys.path.insert(0, str(REPO / 'scratch' / 'r7rs-conformance'))

_s = importlib.util.spec_from_file_location('abv', str(REPO / 'scratch' / 'audit-books-values.py'))
abv = importlib.util.module_from_spec(_s); _s.loader.exec_module(abv)
bv2 = abv.bv2


def main():
    targets = [a for a in sys.argv[1:] if not a.startswith('--')]
    show_pass = '--all' in sys.argv
    progs = bv2.extract_prose_blocks()
    by_file = OrderedDict()
    for p in progs:
        by_file.setdefault(p['file'], []).append(p)

    verdicts = Counter()
    for f, blocks in by_file.items():
        if targets and not any(t in f or f.endswith(t) for t in targets):
            continue
        print(f'\n=== {f}')
        prefix_parts = []
        for p in blocks:
            prefix = '\n'.join(prefix_parts)
            if not p['fragment']:
                st, rows = abv.check_block(prefix, p['code'])
                if st == 'run-error':
                    print(f"  [{p['key']}] RUN-ERROR {rows}")
                    verdicts['run-error'] += 1
                for r in rows:
                    v = r.get('verdict')
                    if v is None:
                        continue
                    verdicts[v] += 1
                    if v != 'pass' or show_pass:
                        print(f"  [{p['key']}] {v}")
                        print(f"    CODE   : {r.get('code','')}")
                        print(f"    CLAIM  : {r.get('claim','')}")
                        print(f"    PRINTED: {r.get('printed','')}")
                        print(f"    VALUE  : {r.get('value','')}")
            if abv.is_output_fence(p['code']) or abv.has_error_claim(p['code']):
                continue
            prefix_parts.append(p['code'])
    print('\n--', dict(verdicts))


if __name__ == '__main__':
    main()
