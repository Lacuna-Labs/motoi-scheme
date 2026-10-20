#!/usr/bin/env python3
"""check.py <module> [...] — run every code cell in the given verb modules."""
import sys, importlib, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import cells, run, esc

mods = sys.argv[1:]
fails = 0
total = 0
for m in mods:
    V = importlib.import_module(m).VERBS
    for v in V:
        n = 0
        for label, code in cells(v):
            total += 1
            n += 1
            try:
                esc(code)
            except ValueError as e:
                fails += 1
                print('BACKSLASH %s %s: %s' % (v['name'], label, e))
                continue
            ok, out = run(code)
            if not ok:
                fails += 1
                print('FAIL %-16s %-28s\n----code----\n%s\n----out----\n%s\n' % (v['name'], label, code, out))
        if n != 15:
            print('CELLCOUNT %s has %d cells (expected 15)' % (v['name'], n))
print('total cells: %d  failures: %d' % (total, fails))
sys.exit(1 if fails else 0)
