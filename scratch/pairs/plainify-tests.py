#!/usr/bin/env python3
"""plainify-tests.py — normalize cell SPELLING in test assertions.

These tests call a JS binding directly (`env.vars.get('vec/add')([1,2],[3,4])`)
and assert against a JS array literal. Motoi used to spell a proper list as an
array, so that comparison was against the engine's actual value object. It is
now a `Pair` chain, so the SAME correct value fails the SAME assertion on
spelling alone.

`plain` (tests/_cells.mjs) converts the spelling and nothing else — every
element is still compared, so the assertions keep their full strength. The
semantics an array cannot express (interior identity, set-cdr!, shared tails,
circular lists) are asserted directly in tests/pairs.test.mjs.

Only the ACTUAL side is wrapped. Wrapping the expected side too would let a
test pass by comparing two normalizations of the same wrong thing.

Usage:  python3 scratch/pairs/plainify-tests.py [--write] FILE...
"""

import re, os, sys, argparse

ROOT = '/Users/alfred/code/motoi-scheme'
CALLS = ('assert.deepEqual(', 'assert.deepStrictEqual(', 'assert.notDeepEqual(')


def split_top(s):
    """Index just past the first top-level comma in `s`, or -1."""
    depth = 0
    i = 0
    while i < len(s):
        c = s[i]
        if c in '([{':
            depth += 1
        elif c in ')]}':
            if depth == 0:
                return -1
            depth -= 1
        elif c == ',' and depth == 0:
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
    for call in CALLS:
        pos = 0
        while True:
            j = text.find(call, pos)
            if j < 0:
                break
            start = j + len(call)
            k = split_top(text[start:])
            if k < 0:
                pos = start
                continue
            actual = text[start:start + k]
            if actual.lstrip().startswith('plain('):
                pos = start + k
                continue
            text = text[:start] + 'plain(' + actual + ')' + text[start + k:]
            n += 1
            pos = start + k + 7
    return text, n


IMPORT = "import { plain } from '%s_cells.mjs'\n"


def ensure_import(text, path):
    if '_cells.mjs' in text:
        return text
    rel = os.path.relpath(os.path.join(ROOT, 'tests'), os.path.dirname(path))
    prefix = './' if rel == '.' else rel + '/'
    ims = list(re.finditer(r"^import\s[^\n]*from\s*'[^']*'\s*;?\s*$", text, re.M))
    line = IMPORT % prefix
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
    print(f'\n{total} assertions normalized')


if __name__ == '__main__':
    main()
