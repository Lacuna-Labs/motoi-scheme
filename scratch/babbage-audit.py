#!/usr/bin/env python3
"""babbage-audit.py — chapter-scoped audit for ONE book file (same logic as
audit-books-v2.py, restricted to a path so it runs in seconds).

Usage: python3 scratch/babbage-audit.py <path-to-slatl> [--verbose]
"""
from __future__ import annotations
import re, sys
from pathlib import Path
from collections import Counter, OrderedDict
from concurrent.futures import ThreadPoolExecutor
import importlib.util

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
_spec = importlib.util.spec_from_file_location('aref', str(REPO / 'scratch' / 'audit-ref.py'))
aref = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(aref)
_s2 = importlib.util.spec_from_file_location('av2', str(REPO / 'scratch' / 'audit-books-v2.py'))
av2 = importlib.util.module_from_spec(_s2); _s2.loader.exec_module(av2)

PROMPT_RE = av2.PROMPT_RE
FENCE_RE = av2.FENCE_RE
PROSE_KEY_RE = av2.PROSE_KEY_RE


def blocks_for(path: Path):
    text = path.read_text()
    progs = []
    idx = 0
    for pm in PROSE_KEY_RE.finditer(text):
        prose, _ = aref.read_string_literal(text, pm.end() - 1)
        for lang, body in FENCE_RE.findall(prose):
            idx += 1
            if PROMPT_RE.search(body):
                continue
            if not body.strip():
                continue
            progs.append({'key': f'{lang}-block-{idx}', 'code': body,
                          'fragment': av2.code_has_ellipsis(body)})
    return progs


def main():
    path = Path(sys.argv[1])
    if not path.is_absolute():
        path = REPO / path
    verbose = '--verbose' in sys.argv
    progs = blocks_for(path)
    items = []
    prefix_parts = []
    for p in progs:
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
        return it, *aref.classify(it['scoped'], rc2, o2, e2)

    cats = Counter(); fails = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for it, c, i in ex.map(work, items):
            if c == 'fragment':
                cats['fragment'] += 1; continue
            cats[c] += 1
            if c != 'ok':
                fails.append((it['p']['key'], c, i))
    testable = sum(v for k, v in cats.items() if k != 'fragment')
    print(f'{path.name}: {testable} testable, PASS {cats.get("ok",0)}, FAIL {len(fails)}'
          f'  (fragments {cats.get("fragment",0)})')
    agg = Counter(i[:70] for _, _, i in fails)
    for msg, n in agg.most_common(30):
        print(f'   {n:4d}  {msg}')
    if verbose:
        for k, c, i in fails:
            print(f'      {k}: {i[:110]}')


if __name__ == '__main__':
    main()
