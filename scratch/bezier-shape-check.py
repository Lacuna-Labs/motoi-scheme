#!/usr/bin/env python3
"""bezier-shape-check.py — structural sanity for authored verb records.

Paren balance alone does not catch a rung closed one paren early: the sexp
still balances, the rung just silently leaves the :rungs list. This walks the
record as a tree and reports, per verb, the keys present and the arity of the
nested row structures, so a misplaced paren shows up as a wrong count.

Usage: python3 scratch/bezier-shape-check.py 70-vector.slat [more.slat ...]
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'scheme', 'reference')

REQUIRED = [':name', ':std', ':library', ':tier', ':kind', ':signature', ':summary',
            ':examples', ':provenance', ':row-2-audit', ':row-3-dimension',
            ':row-4-proof', ':row-5-emergence']


def tokenize(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == ';':
            while i < n and s[i] != '\n':
                i += 1
        elif c in '()':
            out.append(c); i += 1
        elif c == '"':
            j = i + 1
            while j < n:
                if s[j] == '\\':
                    j += 2; continue
                if s[j] == '"':
                    break
                j += 1
            out.append(s[i:j + 1]); i = j + 1
        elif c.isspace():
            i += 1
        else:
            j = i
            while j < n and not s[j].isspace() and s[j] not in '()";':
                j += 1
            out.append(s[i:j]); i = j
    return out


def parse(tokens, k=0):
    node = []
    while k < len(tokens):
        t = tokens[k]
        if t == '(':
            sub, k = parse(tokens, k + 1)
            node.append(sub)
        elif t == ')':
            return node, k + 1
        else:
            node.append(t); k += 1
    return node, k


def records(path):
    top, _ = parse(tokenize(open(path).read()))
    return [f for f in top if isinstance(f, list) and f and f[0] == 'verb']


def kv(rec):
    d, i = {}, 1
    while i < len(rec):
        k = rec[i]
        if isinstance(k, str) and k.startswith(':'):
            d[k] = rec[i + 1] if i + 1 < len(rec) else None
            i += 2
        else:
            i += 1
    return d


def main():
    args = sys.argv[1:] or [f for f in sorted(os.listdir(REF))
                            if f.endswith('.slat') and f != 'MANIFEST.slat']
    bad = 0
    for a in args:
        path = a if a.startswith('/') else os.path.join(REF, a)
        recs = records(path)
        print(f'\n== {os.path.basename(path)} — {len(recs)} verb records')
        for rec in recs:
            d = kv(rec)
            name = (d.get(':name') or '"?"').strip('"')
            missing = [k for k in REQUIRED if k not in d]
            notes = []
            ex = d.get(':examples')
            notes.append(f'examples={len(ex) if isinstance(ex, list) else "?"}')
            r3 = d.get(':row-3-dimension')
            rungs = '?'
            if isinstance(r3, list) and r3 and isinstance(r3[0], list):
                sub = kv(['x'] + r3[0])
                rg = sub.get(':rungs')
                rungs = len(rg) if isinstance(rg, list) else '?'
            notes.append(f'rungs={rungs}')
            for row in (':row-2-audit', ':row-3-dimension', ':row-4-proof', ':row-5-emergence'):
                v = d.get(row)
                notes.append(f'{row[1:6]}={len(v) if isinstance(v, list) else "?"}')
            flag = ''
            if missing:
                flag = '  MISSING: ' + ' '.join(missing); bad += 1
            if rungs != 3:
                flag += f'  RUNGS!={3}'; bad += 1
            print(f'  {name:24s} ' + ' '.join(notes) + flag)
    print(f'\nstructural complaints: {bad}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
