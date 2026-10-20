#!/usr/bin/env python3
"""Final quarantine sweep: any row still in wrong_value after repair goes to
_corpus-reversal-broken.jsonl (only-add, never delete).
"""
import json, shutil
from pathlib import Path
from collections import defaultdict

REPO = Path('/Users/alfred/code/motoi-scheme')
CORPUS = Path.home() / 'motoi-corpus'
VF = json.load(open(REPO / 'scratch' / 'verify-fold.json'))

by_file = defaultdict(set)
for w in VF['wrong_value']:
    by_file[w['file']].add(w['line'])

total_q = 0
qout = []
for f, line_set in by_file.items():
    fpath = CORPUS / f
    lines = fpath.read_text().splitlines()
    new_lines = []
    for i, ln in enumerate(lines):
        if i in line_set:
            try:
                row = json.loads(ln)
                row.setdefault('tags', {})['quarantined_2026_08_07'] = 'final-sweep-remaining-mismatch'
                qout.append(row)
                total_q += 1
                continue
            except Exception:
                pass
        new_lines.append(ln)
    fpath.write_text('\n'.join(new_lines) + ('\n' if new_lines else ''))
    print(f'{f}: quarantined={total_q}')

if qout:
    outp = CORPUS / 'sft-fold' / '_corpus-reversal-broken.jsonl'
    with open(outp, 'a') as fh:
        for r in qout:
            fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'Appended {len(qout)} to {outp}')

print(f'TOTAL final-sweep quarantined: {total_q}')
