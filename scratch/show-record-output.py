#!/usr/bin/env python3
"""show-record-output.py — print the EXACT output of every snippet in a verb record.

The verifier answers pass/fail. This answers "what did it actually print?", which
is what a :note must match byte-for-byte.

Usage:
    python3 scratch/show-record-output.py 40-math.slat --verb sqrt
"""
import os, re, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib.machinery import SourceFileLoader

V = SourceFileLoader('v', os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       'verify-reference-records.py')).load_module()

def main():
    argv = sys.argv[1:]
    only = None
    if '--verb' in argv:
        k = argv.index('--verb'); only = argv[k + 1]; del argv[k:k + 2]
    path = os.path.join(V.REF_DIR, argv[0]) if not argv[0].startswith('/') else argv[0]
    text = open(path).read()
    for rec in V.extract_records(text):
        m = re.search(r':name\s+"([^"]+)"', rec)
        name = m.group(1) if m else '<unnamed>'
        if only and name != only:
            continue
        for i, (field, code) in enumerate(V.snippets(rec)):
            r = V.run_snippet((f'show{i}', name, field, code))
            status = 'ok ' if r[3] else 'ERR'
            print(f'--- [{status}] {name} :{field}\n{code}\n>>> {r[4]!r}\n')
    return 0

if __name__ == '__main__':
    sys.exit(main())
