#!/usr/bin/env python3
"""Find the first cumulative-prefix index at which a chapter's error appears."""
import sys, importlib.util
from pathlib import Path
sys.path.insert(0, '/Users/alfred/code/motoi-scheme/scratch')
_s = importlib.util.spec_from_file_location('lf', '/Users/alfred/code/motoi-scheme/scratch/lovelace-fuel.py')
lf = importlib.util.module_from_spec(_s); _s.loader.exec_module(lf)

REPO = Path('/Users/alfred/code/motoi-scheme')


def first_bad(rel, fuel=20_000_000, needle=None):
    items = lf.scoped_items(REPO / 'scheme-books' / rel)
    lo, hi = 0, len(items)

    def bad(n):
        code = '\n'.join(it['standalone'] for it in items[:n])
        c, i, o, e = lf.cat(code, fuel=fuel, timeout=600)
        if needle:
            return needle in (i or ''), i
        return c != 'ok', i

    b, i = bad(hi)
    if not b:
        return None, 'chapter clean', items
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        bb, ii = bad(mid)
        if bb:
            hi = mid
        else:
            lo = mid
    return hi, bad(hi)[1], items


if __name__ == '__main__':
    rel = sys.argv[1]
    fuel = int(sys.argv[2]) if len(sys.argv) > 2 else 20_000_000
    needle = sys.argv[3] if len(sys.argv) > 3 else None
    n, info, items = first_bad(rel, fuel, needle)
    if n is None:
        print(rel, 'clean at fuel', fuel)
    else:
        print(f'{rel}: first bad cumulative prefix = {n} blocks; culprit = '
              f'{items[n-1]["p"]["key"]}\n  {info}\n---')
        print(items[n - 1]['standalone'])
