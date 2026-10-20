#!/usr/bin/env python3
"""feyn-audit.py — per-file/per-dir wrapper around audit-books-v2's chapter-scoped gate.

usage: python3 scratch/feyn-audit.py <substring-of-relpath> [...]
Prints failing blocks with their code + error for the matching files only.
"""
from __future__ import annotations
import sys, importlib.util, json
from pathlib import Path
from collections import OrderedDict

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
_s = importlib.util.spec_from_file_location('av2', str(REPO / 'scratch' / 'audit-books-v2.py'))
av2 = importlib.util.module_from_spec(_s); _s.loader.exec_module(av2)
aref = av2.aref

pats = sys.argv[1:]
if not pats:
    print('need a path substring'); sys.exit(2)

progs = [p for p in av2.extract_prose_blocks()
         if any(pat.replace('scheme-books/', '') in p['file'] for pat in pats)]

by_file = OrderedDict()
for p in progs:
    by_file.setdefault(p['file'], []).append(p)

nfail = 0
summary = {}
for f, blocks in by_file.items():
    prefix_parts = []
    ff = 0
    for p in blocks:
        prefix = '\n'.join(prefix_parts)
        scoped = (prefix + '\n' + p['code']) if prefix else p['code']
        if p['fragment']:
            prefix_parts.append(p['code'])
            continue
        rc1, o1, e1 = aref.run_one(p['code'])
        c1, i1 = aref.classify(p['code'], rc1, o1, e1)
        cat, info, blob = c1, i1, (e1 + o1)
        if c1 != 'ok' and prefix_parts:
            rc2, o2, e2 = aref.run_one(scoped)
            cat, info = aref.classify(scoped, rc2, o2, e2)
            blob = (e2 + o2)
        if cat != 'ok':
            nfail += 1; ff += 1
            print('=' * 78)
            print(f'FAIL {f} :: {p["key"]}  [{cat}] {info}')
            print('--- code ---')
            print(p['code'].rstrip())
            print('--- output ---')
            print(blob.strip()[:1500])
        prefix_parts.append(p['code'])
    summary[f] = ff

print('\n==== SUMMARY ====')
for f, n in summary.items():
    if n:
        print(f'  {n:3d}  {f}')
print(f'TOTAL FAIL: {nfail} across {len(by_file)} files')
