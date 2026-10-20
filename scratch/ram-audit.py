#!/usr/bin/env python3
"""ram-audit.py — per-file wrapper around audit-books-v2's chapter-scoped gate.

Usage: python3 scratch/ram-audit.py scheme-books/book-of-math/ch01-....book.slatl [...]
Prints PASS/FAIL counts for just those files plus each failing block's index,
error, and code. Read-only; does not overwrite scratch/audit-books-v2.json.
"""
from __future__ import annotations
import json, sys, importlib.util
from pathlib import Path
from collections import OrderedDict, Counter
from concurrent.futures import ThreadPoolExecutor

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
_s = importlib.util.spec_from_file_location('av2', str(REPO / 'scratch' / 'audit-books-v2.py'))
av2 = importlib.util.module_from_spec(_s); _s.loader.exec_module(av2)
aref = av2.aref

VERBOSE = '-q' not in sys.argv
targets = [a for a in sys.argv[1:] if not a.startswith('-')]
want = set()
for t in targets:
    p = Path(t).resolve()
    want.add(str(p.relative_to(REPO / 'scheme-books')))

progs = [p for p in av2.extract_prose_blocks() if p['file'] in want]
by_file = OrderedDict()
for p in progs:
    by_file.setdefault(p['file'], []).append(p)

items = []
for f, blocks in by_file.items():
    prefix_parts = []
    for p in blocks:
        prefix = '\n'.join(prefix_parts)
        scoped = (prefix + '\n' + p['code']) if prefix else p['code']
        items.append({'p': p, 'standalone': p['code'], 'scoped': scoped,
                      'nprefix': len(prefix_parts)})
        prefix_parts.append(p['code'])


def work(it):
    if it['p']['fragment']:
        return it, 'fragment', ''
    rc1, o1, e1 = aref.run_one(it['standalone'])
    c1, i1 = aref.classify(it['standalone'], rc1, o1, e1)
    if c1 == 'ok' or it['nprefix'] == 0:
        return it, c1, i1
    rc2, o2, e2 = aref.run_one(it['scoped'])
    return (it,) + aref.classify(it['scoped'], rc2, o2, e2)


fails = []
cats = Counter()
with ThreadPoolExecutor(max_workers=8) as ex:
    for it, c, i in ex.map(work, items):
        if c == 'fragment':
            cats['fragment'] += 1
            continue
        cats[c] += 1
        if c != 'ok':
            fails.append({'file': it['p']['file'], 'key': it['p']['key'],
                          'cat': c, 'info': i, 'code': it['p']['code']})

per_file = Counter(f['file'] for f in fails)
print(f'files={len(by_file)} blocks={len(items)} frag={cats["fragment"]} '
      f'PASS={cats["ok"]} FAIL={len(fails)}')
for f in sorted(by_file):
    print(f'  {per_file.get(f,0):4d} fail   {f}')
if VERBOSE:
    for f in fails:
        print('\n' + '=' * 70)
        print(f'{f["file"]}  {f["key"]}  [{f["cat"]}] {f["info"]}')
        print('-' * 70)
        print(f['code'])
Path('scratch/ram-audit-last.json').write_text(json.dumps(fails, indent=2))
