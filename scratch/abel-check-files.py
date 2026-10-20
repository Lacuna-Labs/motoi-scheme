#!/usr/bin/env python3
"""abel-check-files.py — run the SAME value gate as audit-books-values.py, but
only over the files named on the command line.

No independent logic: it imports the real gate module and the real block
extractor, so a verdict here is the verdict the corpus gate will produce.
Usage:  python3 scratch/abel-check-files.py <path-substring> [...]
"""
from __future__ import annotations
import importlib.util, json, sys
from pathlib import Path
from collections import Counter, OrderedDict

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))

_s = importlib.util.spec_from_file_location('abv', str(REPO / 'scratch' / 'audit-books-values.py'))
abv = importlib.util.module_from_spec(_s); _s.loader.exec_module(abv)
bv2 = abv.bv2


def main():
    pats = [a for a in sys.argv[1:] if not a.startswith('--')]
    progs = bv2.extract_prose_blocks()
    by_file = OrderedDict()
    for p in progs:
        by_file.setdefault(p['file'], []).append(p)

    items = []
    for f, blocks in by_file.items():
        if pats and not any(p in f for p in pats):
            continue
        prefix_parts = []
        for p in blocks:
            items.append({'file': f, 'key': p['key'], 'code': p['code'],
                          'prefix': '\n'.join(prefix_parts), 'fragment': p['fragment']})
            if abv.is_output_fence(p['code']) or abv.has_error_claim(p['code']):
                continue
            prefix_parts.append(p['code'])

    status, verdicts = Counter(), Counter()
    bad = []
    for it in items:
        if it['fragment']:
            status['fragment'] += 1
            continue
        st, rows = abv.check_block(it['prefix'], it['code'])
        status[st] += 1
        for r in rows:
            if st == 'run-error':
                bad.append({'file': it['file'], 'key': it['key'], **r})
                continue
            verdicts[r['verdict']] += 1
            if r['verdict'] != 'pass':
                bad.append({'file': it['file'], 'key': it['key'], **r})

    print(f'== {len(items)} blocks ==')
    for k, v in status.most_common():
        print(f'  block {k:<18s} {v}')
    for k, v in verdicts.most_common():
        print(f'    {k:<14s} {v}')
    out = REPO / 'scratch' / 'abel-check-files.json'
    out.write_text(json.dumps(bad, indent=2))
    print(f'  -> {out}  ({len(bad)} non-pass)')


if __name__ == '__main__':
    main()
