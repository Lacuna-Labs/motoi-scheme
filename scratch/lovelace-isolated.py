#!/usr/bin/env python3
"""Run every fuel-exhausted block ISOLATED (chapter preamble + that one block)
at the DEFAULT 200k budget.

This separates "the example is too heavy" from "the harness's whole-chapter
concatenation is too heavy". The gate concatenates every preceding block, and
world/spawn accumulates into a global *world* that world/step walks each tick,
so chapter cost is O(blocks^2) even when every individual example is cheap.
"""
import sys, json, importlib.util
from pathlib import Path
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
_s = importlib.util.spec_from_file_location('lf', str(REPO / 'scratch' / 'lovelace-fuel.py'))
lf = importlib.util.module_from_spec(_s); _s.loader.exec_module(lf)


def run(rel, workers=8):
    items = lf.scoped_items(REPO / 'scheme-books' / rel)
    pre = items[0]['standalone']

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

    def iso(it):
        c, i, _, _ = lf.cat(pre + '\n' + it['standalone'], timeout=120)
        return it['p']['key'], c, i

    out = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for k, c, i in ex.map(iso, fuelers):
            out.append({'key': k, 'cat': c, 'info': i})
    return out


if __name__ == '__main__':
    allr = {}
    for rel in sys.argv[1:]:
        res = run(rel)
        allr[rel] = res
        c = Counter('ok' if r['cat'] == 'ok'
                    else ('FUEL' if 'fuel' in r['info'].lower() else r['cat'])
                    for r in res)
        print(f'{rel}: {len(res)} fuel-at-gate blocks; ISOLATED @200k -> {dict(c)}', flush=True)
        for r in res:
            if r['cat'] != 'ok':
                print(f"   {r['key']:<22s} {r['info'][:90]}", flush=True)
    (REPO / 'scratch' / 'lovelace-isolated.json').write_text(json.dumps(allr, indent=2))
