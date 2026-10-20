#!/usr/bin/env python3
"""lovelace-triage.py — three-way triage of fuel-exhausted book blocks.

For every block that fails with `fuel exhausted` at the default 200k budget
(chapter-scoped, exactly as scratch/audit-books-v2.py measures), re-run it at
2,000,000 then 20,000,000 and record what happens.

  bucket A  non-terminating      -> still fuel-exhausted at 20M
  bucket B  heavy-but-terminating-> becomes 'ok' at a larger budget
  bucket C  other-bug            -> a DIFFERENT error surfaces at a larger
                                    budget (the fuel error was a symptom)
"""
from __future__ import annotations
import json, sys, importlib.util
from pathlib import Path
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
_s = importlib.util.spec_from_file_location('lf', str(REPO / 'scratch' / 'lovelace-fuel.py'))
lf = importlib.util.module_from_spec(_s); _s.loader.exec_module(lf)

LADDER = [2_000_000, 20_000_000, 200_000_000]


def triage_file(rel: str, workers=6):
    path = REPO / 'scheme-books' / rel
    items = lf.scoped_items(path)

    def base(it):
        if it['p']['fragment']:
            return it, None
        c1, i1, _, _ = lf.cat(it['standalone'])
        if c1 == 'ok' or it['nprefix'] == 0:
            return it, (c1, i1)
        c2, i2, _, _ = lf.cat(it['scoped'])
        return it, (c2, i2)

    fuelers = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for it, r in ex.map(base, items):
            if r and 'fuel exhausted' in (r[1] or '').lower():
                fuelers.append(it)

    def climb(it):
        code = it['scoped'] if it['nprefix'] else it['standalone']
        trail = []
        for f in LADDER:
            c, i, _, _ = lf.cat(code, fuel=f, timeout=600)
            trail.append((f, c, i))
            if 'fuel exhausted' not in (i or '').lower():
                bucket = 'B-heavy' if c == 'ok' else 'C-otherbug'
                return {'key': it['p']['key'], 'bucket': bucket, 'fuel': f,
                        'cat': c, 'info': i, 'nprefix': it['nprefix']}
        return {'key': it['p']['key'], 'bucket': 'A-nonterminating',
                'fuel': None, 'cat': 'fuel', 'info': 'fuel exhausted @20M',
                'nprefix': it['nprefix']}

    out = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for r in ex.map(climb, fuelers):
            out.append(r)
    return out


if __name__ == '__main__':
    files = sys.argv[1:]
    allres = {}
    for rel in files:
        res = triage_file(rel)
        allres[rel] = res
        c = Counter(r['bucket'] for r in res)
        print(f'{rel}: {len(res)} fuel blocks -> {dict(c)}', flush=True)
        for r in res:
            if r['bucket'] != 'B-heavy':
                print(f"   {r['key']:<22s} {r['bucket']:<18s} {r['info'][:90]}", flush=True)
    Path(REPO / 'scratch' / 'lovelace-triage.json').write_text(json.dumps(allres, indent=2))
    tot = Counter()
    for res in allres.values():
        tot.update(r['bucket'] for r in res)
    print('\nTOTAL', dict(tot))
