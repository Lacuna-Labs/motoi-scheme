#!/usr/bin/env python3
"""flag-broken-carts.py — mark every cart that does not run, by WHY.

The census (scratch/cart-broken-census.json) splits the 10,762 automations carts
three ways, and the two failing kinds are not the same problem:

  843    do not parse at all             -> IMPORTANT-BROKEN-CARTS
  9,917  parse, but call unbound verbs   -> BLOCKED-ON-RUNTIME
  2      resolve fully today             -> unflagged

They get separate flags because they take different work. An unparseable cart is
broken in itself and someone has to fix that file. A blocked cart is correct
Scheme written against a runtime contract (`ctx-get`, `act`, `next`, …) that was
never built — 6,232 of them need nothing but those 15 verbs. Collapsing both into
"broken" would point repair at 9,917 files instead of at one missing harness.

Both flags record measured facts only: the reader's verbatim error, or the exact
list of names that do not resolve. Nothing is diagnosed and nothing is guessed.
No cart source (`.sks`) is touched — flags go in the `.slatl` record, which is
what the book is compiled from.

  python3 scratch/flag-broken-carts.py            # dry run, prints samples
  python3 scratch/flag-broken-carts.py --write
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
CENSUS = REPO / 'scratch' / 'cart-broken-census.json'
CARTS = Path('/Users/alfred/code/scheme-carts/automations-carts')
BROKEN = 'IMPORTANT-BROKEN-CARTS'
BLOCKED = 'BLOCKED-ON-RUNTIME'
MARKERS = (BROKEN, BLOCKED)
DETECTED = '2026-08-02'

# The runtime contract the carts were written against and nobody built. Named
# here so a cart blocked ONLY by these can say so — that set needs no cart edit
# at all, just the harness.
CONTRACT = {
    'ctx-get', 'ctx-set', 'ctx-result', 'act', 'next', 'done', 'check-act-result',
    'cart', 'surface', 'card-emit', 'envelope-queue', 'table', 'with-loam-gate',
    'assoc-ref', 'format',
}

SLUG_LINE = re.compile(r'^(\s*:slug\s+\S+\s*)$', re.MULTILINE)


def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')


def flag_for(entry):
    if entry['status'] == 'unparseable':
        return (f'  ({BROKEN} :reason "source does not parse"\n'
                f'    :error "{esc(entry["why"])}"\n'
                f'    :detected "{DETECTED}" :by "motoi reader"\n'
                f'    :note "the cart body could not be read; every claim below this '
                f'line was derived before the parse failure and may be incomplete")')

    missing = sorted(entry['missing'])
    beyond = sorted(set(missing) - CONTRACT)
    scope = ('runtime-contract-only' if not beyond else 'runtime-contract-plus')
    lines = [f'  ({BLOCKED} :reason "parses, but calls verbs nothing binds"',
             f'    :scope "{scope}"',
             f'    :unbound-count {len(missing)}',
             f'    (unbound {" ".join(missing)})']
    if beyond:
        lines.append(f'    (beyond-the-runtime-contract {" ".join(beyond)})')
    else:
        lines.append('    :note "needs no edit to this cart — building the runtime '
                     'contract is sufficient"')
    lines.append(f'    :detected "{DETECTED}" :by "motoi engine v0.75.0-beta")')
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    census = json.loads(CENSUS.read_text())
    targets = [c for c in census['carts'] if c['status'] != 'resolves']

    counts = Counter()
    shown = set()
    for c in targets:
        slatl = CARTS / c['slug'] / f"{c['slug']}.slatl"
        if not slatl.is_file():
            counts['no .slatl'] += 1
            continue
        text = slatl.read_text()
        if any(m in text for m in MARKERS):
            counts['already flagged'] += 1
            continue
        m = SLUG_LINE.search(text)
        if not m:
            # No anchor means an unexpected record shape. Skipped, not guessed at.
            counts['no :slug anchor'] += 1
            continue
        new = text[:m.end()] + '\n' + flag_for(c) + text[m.end():]
        if args.write:
            slatl.write_text(new)
        elif c['status'] not in shown:
            shown.add(c['status'])
            print(f'--- sample ({c["status"]}): {slatl.name}\n')
            print('\n'.join(new.splitlines()[:10]))
            print()
        counts[c['status']] += 1

    verb = 'flagged' if args.write else 'would flag'
    print(f'carts not running        : {len(targets)}')
    print(f'  {verb} IMPORTANT-BROKEN-CARTS : {counts["unparseable"]}')
    print(f'  {verb} BLOCKED-ON-RUNTIME     : {counts["unbound-verbs"]}')
    for k in ('already flagged', 'no .slatl', 'no :slug anchor'):
        if counts[k]:
            print(f'  {k:<22s} : {counts[k]}')
    if not args.write:
        print('\ndry run — nothing written. Re-run with --write.')
    else:
        print('\nNow recompile the book:')
        print('  python3 ~/code/sakura-scheme/scratch/compile_automations_book.py '
              '~/code/scheme-carts')


if __name__ == '__main__':
    main()
