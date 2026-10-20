#!/usr/bin/env python3
"""plainify-guards.py — `Array.isArray(x)` in a TEST is asking "is this a list?"

A test written against the old spelling asks JavaScript. A list is a chain of
cons cells now, so JavaScript answers `false` for a perfectly good list. The
question the test MEANT is still the right question; only the spelling moved.

Rewrites `Array.isArray(EXPR)` to `Array.isArray(plain(EXPR))` inside
tests/ only. `plain` passes a non-list straight through, so a guard that
SHOULD fail still fails — this widens the spelling, not the assertion.

Usage:  python3 scratch/pairs/plainify-guards.py [--write] FILE...
"""

import re, os, argparse

ROOT = '/Users/alfred/code/motoi-scheme'


def close_paren(s, i):
    """Index of the `)` matching the `(` at s[i], or -1."""
    depth = 0
    while i < len(s):
        c = s[i]
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                return i
        elif c in '\'"`':
            q = c
            i += 1
            while i < len(s) and s[i] != q:
                i += 2 if s[i] == '\\' else 1
        i += 1
    return -1


def convert(text):
    n = 0
    pos = 0
    key = 'Array.isArray('
    while True:
        j = text.find(key, pos)
        if j < 0:
            break
        op = j + len(key) - 1
        cp = close_paren(text, op)
        if cp < 0:
            pos = j + len(key)
            continue
        inner = text[op + 1:cp]
        if inner.lstrip().startswith('plain('):
            pos = cp
            continue
        text = text[:op + 1] + 'plain(' + inner + ')' + text[cp:]
        n += 1
        pos = cp + 7
    return text, n


def ensure_import(text, path):
    if '_cells.mjs' in text:
        return text
    rel = os.path.relpath(os.path.join(ROOT, 'tests'), os.path.dirname(path))
    prefix = './' if rel == '.' else rel + '/'
    line = "import { plain } from '%s_cells.mjs'\n" % prefix
    ims = list(re.finditer(r"^import\s[^\n]*from\s*'[^']*'\s*;?\s*$", text, re.M))
    if not ims:
        return line + text
    return text[:ims[-1].end() + 1] + line + text[ims[-1].end() + 1:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    ap.add_argument('files', nargs='+')
    a = ap.parse_args()
    total = 0
    for f in a.files:
        p = f if os.path.isabs(f) else os.path.join(ROOT, f)
        src = open(p, encoding='utf-8').read()
        out, n = convert(src)
        if not n:
            continue
        out = ensure_import(out, p)
        print(f'{os.path.relpath(p, ROOT):<56}{n:>4}')
        total += n
        if a.write:
            open(p, 'w', encoding='utf-8').write(out)
    print(f'\n{total} guards widened')


if __name__ == '__main__':
    main()
