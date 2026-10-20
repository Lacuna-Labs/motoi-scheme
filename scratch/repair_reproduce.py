#!/usr/bin/env python3
"""repair_reproduce.py — run every planned repair twice, keep only what reproduces.

`repair-final.jsonl` says what the engine returned once. That is not enough to
splice a value into a book. Some of these blocks touch `cortex/*`, `stats/*`,
`random`, `now` or a uuid mint, and their output is different on the next run —
`"uuid-1785714615400-2"` is in the plan right now. Writing one of those down
makes the book wrong tomorrow instead of today, which is worse, not better.

So: run each block in TWO fresh MOTOI_HOMEs. If the two runs disagree, the value
is non-deterministic and the repair is refused. If they agree but neither matches
the recorded `actual`, the recorded value is stale and the repair is refused too.

  python3 scratch/repair_reproduce.py

Writes scratch/repair-reproduce.json. Edits nothing.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import offline_guard  # noqa: F401  — first import, always

REPO = Path('/Users/alfred/code/motoi-scheme')
PLAN = REPO / 'scratch' / 'repair-plan.json'
OUT = REPO / 'scratch' / 'repair-reproduce.json'
WORKERS = 8

# Verbs whose value is a fact about this instant or this process, not about the
# program. Recorded for reporting; the two-run diff is the actual test.
VOLATILE = re.compile(r'\b(random|now|current-(?:time|second|jiffy)|'
                      r'uuid|cortex/|stats/|gensym)', re.I)


def run(code, home):
    with tempfile.NamedTemporaryFile('w', suffix='.scm', delete=False) as fh:
        fh.write(code)
        path = fh.name
    try:
        p = subprocess.run([str(REPO / 'bin' / 'motoi'), 'run', path],
                           capture_output=True, text=True, timeout=30,
                           env=dict(os.environ, MOTOI_HOME=home), cwd=REPO)
        return (p.stdout or '').strip(), (p.stderr or '').strip(), p.returncode
    except subprocess.TimeoutExpired:
        return '', 'TIMEOUT', -1
    finally:
        os.unlink(path)


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').strip())


def claims(out, want):
    """A block with several top-level expressions prints several values while the
    row states only the last one. Compare against the whole output, its last
    line, and its last token, or ~17% of 'mismatches' are comparison artifacts."""
    w = norm(want)
    if not w:
        return False
    o = norm(out)
    if w == o:
        return True
    lines = [l for l in out.strip().splitlines() if l.strip()]
    if lines and norm(lines[-1]) == w:
        return True
    toks = o.split(' ')
    return bool(toks) and toks[-1] == w


def probe(item):
    code = item['code']
    a = run(code, tempfile.mkdtemp(prefix='repro-a-'))
    b = run(code, tempfile.mkdtemp(prefix='repro-b-'))
    stable = norm(a[0]) == norm(b[0]) and a[2] == b[2]
    return {**item, 'out': a[0], 'err': a[1], 'rc': a[2],
            'out2': b[0], 'stable': stable,
            'matches_actual': claims(a[0], item['actual']),
            'volatile_verb': bool(VOLATILE.search(code))}


def main():
    plan = json.load(PLAN.open())['plan']
    src = {r['id'] + '|' + r['old']: r for r in
           (json.loads(l) for l in (REPO / 'scratch' / 'repair-final.jsonl').open() if l.strip())}
    items = []
    for p in plan:
        r = src.get(p['id'] + '|' + p['old'])
        if r:
            items.append({**p, 'code': r['code']})

    print(f'probing {len(items)} planned repairs, two runs each')
    with ThreadPoolExecutor(WORKERS) as ex:
        res = list(ex.map(probe, items))

    keep, refuse = [], []
    stats = Counter()
    for r in res:
        if not r['stable']:
            stats['REFUSE non-deterministic'] += 1
            refuse.append({**r, 'why': 'two runs disagree'})
        elif r['rc'] != 0:
            stats['REFUSE block errors'] += 1
            refuse.append({**r, 'why': f'exit {r["rc"]}: {r["err"][:120]}'})
        elif not r['matches_actual']:
            stats['REFUSE actual is stale'] += 1
            refuse.append({**r, 'why': f'engine now says {r["out"][:120]!r}'})
        else:
            stats['KEEP reproduces'] += 1
            keep.append(r)

    for k, v in stats.most_common():
        print(f'  {k:<26s} {v:>4}')
    OUT.write_text(json.dumps({'keep': keep, 'refuse': refuse,
                               'stats': dict(stats)}, indent=2))
    print(f'\n-> {OUT}')


if __name__ == '__main__':
    main()
