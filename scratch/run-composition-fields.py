#!/usr/bin/env python3
"""run-composition-fields.py — execute the row-5 lens composition fields.

verify-reference-records.py matches ':composition "' with a leading colon, so
:eng-composition / :math-composition / :cs-composition are NOT covered by it.
They are still code and still claims, so they still have to run. This closes
that gap.

Usage:
    python3 scratch/run-composition-fields.py 40-math.slat --verb sqrt
"""
import os, re, sys
from importlib.machinery import SourceFileLoader

HERE = os.path.dirname(os.path.abspath(__file__))
V = SourceFileLoader('v', os.path.join(HERE, 'verify-reference-records.py')).load_module()

FIELDS = ('eng-composition', 'math-composition', 'cs-composition')


def main():
    argv = sys.argv[1:]
    only = None
    if '--verb' in argv:
        k = argv.index('--verb'); only = argv[k + 1]; del argv[k:k + 2]
    show = '--show' in argv
    if show:
        argv.remove('--show')
    path = os.path.join(V.REF_DIR, argv[0]) if not argv[0].startswith('/') else argv[0]

    jobs, n = [], 0
    for rec in V.extract_records(open(path).read()):
        m = re.search(r':name\s+"([^"]+)"', rec)
        name = m.group(1) if m else '<unnamed>'
        if only and name != only:
            continue
        for field in FIELDS:
            for mm in re.finditer(rf':{field}\s+"((?:[^"\\]|\\.)*)"', rec):
                code = V.unescape(mm.group(1)).strip()
                if code:
                    # pid-qualified so a concurrent verifier run in another
                    # chapter cannot unlink this snippet's temp file mid-run.
                    jobs.append((f'{os.getpid()}-{n}', name, field, code)); n += 1

    fails = 0
    for j in jobs:
        r = V.run_snippet(j)
        ok = r[3]
        if not ok:
            fails += 1
        if show or not ok:
            print(f'--- [{"ok " if ok else "ERR"}] {r[0]} :{r[1]}\n{r[2]}\n>>> {r[4]!r}\n')
    print(f'composition snippets executed : {len(jobs)}')
    print(f'FAILING                       : {fails}')
    return fails


if __name__ == '__main__':
    sys.exit(main())
