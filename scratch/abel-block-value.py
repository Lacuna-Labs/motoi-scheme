#!/usr/bin/env python3
"""abel-block-value.py — print the FULL, untruncated value the gate sees for a
block, with the chapter's accumulated prefix in place.

The gate truncates `value` to 300 chars, which is not enough to splice a long
result back into a book. Same extractor, same prefix rule, same runner — only
the truncation is removed.

Usage: python3 scratch/abel-block-value.py <file-substring> [block-key ...]
"""
from __future__ import annotations
import importlib.util, sys
from pathlib import Path
from collections import OrderedDict

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
_s = importlib.util.spec_from_file_location('abv', str(REPO / 'scratch' / 'audit-books-values.py'))
abv = importlib.util.module_from_spec(_s); _s.loader.exec_module(abv)


def main():
    pat, keys = sys.argv[1], set(sys.argv[2:])
    progs = abv.bv2.extract_prose_blocks()
    by_file = OrderedDict()
    for p in progs:
        by_file.setdefault(p['file'], []).append(p)
    for f, blocks in by_file.items():
        if pat not in f:
            continue
        prefix_parts = []
        for p in blocks:
            if not keys or p['key'] in keys:
                if not p['fragment']:
                    ann = abv.annotate(p['code'])
                    if ann:
                        prog = ('\n'.join(prefix_parts) + '\n' + abv.instrument(p['code'], ann)) \
                            if prefix_parts else abv.instrument(p['code'], ann)
                        rc, out, err = abv.aref.run_one(prog, timeout=60)
                        blob = out + err
                        print(f'--- {f} {p["key"]} rc={rc}')
                        for idx, (s, e, claim, flag) in enumerate(ann):
                            printed, value = abv.carve(blob, idx)
                            print(f'  CODE : {p["code"][s:e]}')
                            print(f'  CLAIM: {claim!r}')
                            print(f'  PRINT: {printed!r}')
                            print(f'  VALUE: {value!r}')
                            print(f'  FLAG : {flag}')
                        if rc != 0:
                            print('  ERR  :', (err or out).strip()[:600])
            if abv.is_output_fence(p['code']) or abv.has_error_claim(p['code']):
                continue
            prefix_parts.append(p['code'])


if __name__ == '__main__':
    main()
