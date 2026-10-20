#!/usr/bin/env python3
"""roundtrip.py — re-extract code from the WRITTEN slat and run it."""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import reextract, run, TARGET

MODS = ['verbs_a', 'verbs_b', 'verbs_c', 'verbs_d']
names = set()
for m in MODS:
    for v in importlib.import_module(m).VERBS:
        names.add(v['name'])

cells = reextract(TARGET, only_names=names)
print('re-extracted %d code cells across %d verbs' % (len(cells), len(names)))

from collections import Counter
per = Counter(n for (n, f, c) in cells)
for n in sorted(per):
    if per[n] != 15:
        print('CELLCOUNT %s = %d' % (n, per[n]))

fails = 0
for (n, field, code) in cells:
    ok, out = run(code)
    if not ok:
        fails += 1
        print('FAIL %s / %s\n---code---\n%s\n---out---\n%s\n' % (n, field, code, out))
print('POST-ROUND-TRIP: %d cells, %d failures' % (len(cells), fails))
sys.exit(1 if fails else 0)
