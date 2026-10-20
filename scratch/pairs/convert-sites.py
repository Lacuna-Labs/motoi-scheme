#!/usr/bin/env python3
"""convert-sites.py — move `Array.isArray` off JavaScript and onto the list API.

P1 of the cons-cell conversion. Every rewrite here is EXACTLY behaviour
preserving today, because `lib/base/list.js` currently defines

    isList(v)  === Array.isArray(v)
    isNull(v)  === Array.isArray(v) && v.length === 0
    isPair(v)  === v instanceof Pair || (Array.isArray(v) && v.length > 0)

so the four gates stay green through the whole sweep. P2 changes those three
functions and nothing else — which is the point. Converting the sites AFTER the
flip would leave hundreds of guards silently answering `false` for a list, and
the program would still RUN. Wrong beats broken, so the sites move first.

WHAT IS DELIBERATELY NOT CONVERTED
    A `Array.isArray` whose receiver is a JavaScript array that never holds a
    Scheme list — a Values box's `.vals`, a vector's `.items`, an options bag.
    In P1 converting those is harmless; in P2 `isList` would walk them as a cell
    chain and answer `false`. They are listed by hand in SKIP_RECEIVERS and must
    stay JavaScript.

Usage:
    python3 scratch/pairs/convert-sites.py --check FILE...   # report only
    python3 scratch/pairs/convert-sites.py --write FILE...
"""

import re, sys, os, argparse

ROOT = '/Users/alfred/code/motoi-scheme'

# Receivers that are JS arrays, not Scheme lists. Matched against the exact
# text inside `Array.isArray(...)`.
SKIP_RECEIVERS = {
    'v.vals', 'x.vals', 'val.vals', 'r.vals',
    'v.items', 'x.items', 'seq.items',
    'opts', 'options', 'cfg', 'config', 'spec.args', 'json', 'data',
    'parsed', 'raw', 'body', 'rows', 'cols',
}

# A simple receiver: an identifier, or a dotted/indexed path off one. Anything
# with a call or an operator in it is left alone — the rewrite must not have to
# reason about evaluation order or side effects.
RECV = r'[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*|\[[A-Za-z0-9_$]+\])*'


def convert(text):
    """Return (new_text, [(pattern, receiver), ...])."""
    hits = []

    def guard(recv):
        return recv not in SKIP_RECEIVERS

    # Order matters: the compound forms must be recognised before the bare one,
    # or `Array.isArray(x)` eats the head of `Array.isArray(x) && x.length > 0`.

    # 1. the empty list
    def _null(m):
        a, b = m.group(1), m.group(2)
        if a != b or not guard(a):
            return m.group(0)
        hits.append(('isNull', a))
        return f'isNull({a})'
    text = re.sub(r'Array\.isArray\((' + RECV + r')\)\s*&&\s*(' + RECV + r')\.length\s*===\s*0', _null, text)

    # 2. a non-empty list — R7RS `pair?` on the array side
    def _pair(m):
        a, b = m.group(1), m.group(2)
        if a != b or not guard(a):
            return m.group(0)
        hits.append(('isPair', a))
        return f'isPair({a})'
    text = re.sub(r'Array\.isArray\((' + RECV + r')\)\s*&&\s*(' + RECV + r')\.length\s*>\s*0', _pair, text)

    # 3. `x instanceof Pair || isPair(x)` collapses — step 2 just created it.
    def _collapse(m):
        a, b = m.group(1), m.group(2)
        if a != b:
            return m.group(0)
        hits.append(('collapse', a))
        return f'isPair({a})'
    text = re.sub(r'(' + RECV + r')\s+instanceof\s+Pair\s*\|\|\s*\(?isPair\((' + RECV + r')\)\)?', _collapse, text)

    # 4. everything else is a proper-list test
    def _list(m):
        a = m.group(1)
        if not guard(a):
            return m.group(0)
        hits.append(('isList', a))
        return f'isList({a})'
    text = re.sub(r'Array\.isArray\((' + RECV + r')\)', _list, text)

    return text, hits


# The END of an import statement, not its start. A multi-line
# `import {\n  a, b,\n} from '…'` has a first line that looks exactly like a
# whole import, and inserting after it lands INSIDE the brace list — which is a
# syntax error the test suite catches, but only after the whole sweep has run.
IMPORT_RE = re.compile(r"^(?:import\s[^\n]*|\}[^\n]*)from\s*'[^']*'\s*;?\s*$", re.M)


def ensure_import(text, path, needed):
    """Add or widen the `lib/base/list.js` import. Path-relative, no duplicates."""
    rel = os.path.relpath(os.path.join(ROOT, 'lib/base/list.js'), os.path.dirname(path))
    if not rel.startswith('.'):
        rel = './' + rel

    m = re.search(r"import\s*\{([^}]*)\}\s*from\s*'([^']*lib/base/list\.js|\.\./base/list\.js|\./list\.js)'", text)
    if m:
        have = {s.strip() for s in m.group(1).split(',') if s.strip()}
        want = sorted(have | needed)
        return text[:m.start()] + "import { " + ', '.join(want) + " } from '" + m.group(2) + "'" + text[m.end():]

    line = "import { " + ', '.join(sorted(needed)) + " } from '" + rel + "'\n"
    last = None
    for im in IMPORT_RE.finditer(text):
        last = im
    if last:
        return text[:last.end() + 1] + line + text[last.end() + 1:]
    return line + text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    ap.add_argument('files', nargs='+')
    args = ap.parse_args()

    total = 0
    for f in args.files:
        path = f if os.path.isabs(f) else os.path.join(ROOT, f)
        if path.endswith('lib/base/list.js'):
            continue
        src = open(path, encoding='utf-8').read()
        out, hits = convert(src)
        if not hits:
            continue
        needed = {h[0] for h in hits if h[0] != 'collapse'}
        if 'collapse' in {h[0] for h in hits}:
            needed.add('isPair')
        out = ensure_import(out, path, needed)
        rel = os.path.relpath(path, ROOT)
        print(f'{rel:<42}{len(hits):>4}  ' + ' '.join(sorted({h[0] for h in hits})))
        total += len(hits)
        if args.write:
            open(path, 'w', encoding='utf-8').write(out)

    left = 0
    for f in args.files:
        path = f if os.path.isabs(f) else os.path.join(ROOT, f)
        left += open(path, encoding='utf-8').read().count('Array.isArray')
    print(f'\n{total} rewritten; {left} Array.isArray remain in the named files')


if __name__ == '__main__':
    main()
