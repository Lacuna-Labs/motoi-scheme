#!/usr/bin/env python3
"""zain-check.py — run the value gate on ONE book file, chapter-scoped.

Same code path as audit-books-values.main (same prefix accumulation, same
judge), narrowed to a single file so a repair can be re-verified in seconds.

  python3 scratch/zain-check.py book-of-challenges/ch07-numbers-and-stats.book.slatl
"""
from __future__ import annotations
import importlib.util, json, sys
from pathlib import Path
from collections import Counter, OrderedDict
from concurrent.futures import ThreadPoolExecutor

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
sys.path.insert(0, str(REPO / 'scratch' / 'r7rs-conformance'))

_s = importlib.util.spec_from_file_location('abv', str(REPO / 'scratch' / 'audit-books-values.py'))
abv = importlib.util.module_from_spec(_s); _s.loader.exec_module(abv)
bv2 = abv.bv2


def check_file(rel, only_keys=None):
    progs = [p for p in bv2.extract_prose_blocks() if p['file'] == rel]
    if not progs:
        raise SystemExit(f'no blocks for {rel}')
    items, prefix_parts = [], []
    for p in progs:
        items.append({'file': rel, 'key': p['key'], 'code': p['code'],
                      'prefix': '\n'.join(prefix_parts), 'fragment': p['fragment']})
        if abv.is_output_fence(p['code']) or abv.has_error_claim(p['code']):
            continue
        prefix_parts.append(p['code'])

    def work(it):
        if it['fragment']:
            return it, 'fragment', []
        st, rows = abv.check_block(it['prefix'], it['code'])
        return it, st, rows

    status, verdicts, bad = Counter(), Counter(), []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for it, st, rows in ex.map(work, items):
            status[st] += 1
            for r in rows:
                if st == 'run-error':
                    bad.append({'key': it['key'], 'status': 'run-error', **r}); continue
                verdicts[r['verdict']] += 1
                if r['verdict'] != 'pass':
                    bad.append({'key': it['key'], **r})
    return status, verdicts, bad


def main():
    rel = sys.argv[1]
    status, verdicts, bad = check_file(rel)
    print(f'== {rel} ==')
    for k, v in status.most_common():
        print(f'  block {k:<18s} {v}')
    for k, v in verdicts.most_common():
        print(f'    {k:<14s} {v}')
    for b in bad:
        print(f'\n--- {b["key"]}  [{b.get("verdict", b.get("status"))}]')
        print('  CODE:  ', (b.get('code') or b.get('error', ''))[:220].replace('\n', '\n         '))
        print('  CLAIM: ', repr(b.get('claim'))[:220])
        print('  VALUE: ', repr(b.get('value'))[:220])
        print('  PRINT: ', repr(b.get('printed'))[:160])


if __name__ == '__main__':
    main()
