#!/usr/bin/env python3
"""stale-prepass.py — decide, WITHOUT a model, which notes are stale.

A model must never be asked "is this warning still true?". Some `needs-alfred`
notes are correct, and a model told "the engine is fixed, un-stale this" erases a
true warning and leaves a record that lies in the safe direction — undetectable
by any later run-based check.

So the decision is made here, by execution, and the model is only ever handed
rows where the interpreter's output DEMONSTRABLY differs from what the note
claims. Each row carries the new output as literal text for the model to conform
to; it never chooses a value and never judges whether anything is true.

Anything carrying a live warning marker is routed to a HUMAN queue instead, even
when its output changed, because rewriting that prose is a judgement call.

  NOTE_JSONL=/tmp/ref-notes-full.jsonl python3 scratch/verify-reference-notes.py
  python3 scratch/audit-books-values.py
  python3 scratch/stale-prepass.py

Writes scratch/repair-worklist.jsonl and scratch/repair-human-queue.jsonl.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from collections import Counter

REPO = Path('/Users/alfred/code/motoi-scheme')
REF_MISMATCHES = Path('/tmp/ref-notes-full.jsonl')
BOOK_AUDIT = REPO / 'scratch' / 'audit-books-values.json'
OUT_WORK = REPO / 'scratch' / 'repair-worklist.jsonl'
OUT_HUMAN = REPO / 'scratch' / 'repair-human-queue.jsonl'

# A note carrying any of these is making a claim about the STATE OF THE PROJECT,
# not about a value. Whether it is still true is not decidable by running code.
WARNING_MARKERS = re.compile(
    r'needs-alfred|BUG-should|known-broken|not-implemented|unimplemented|'
    r'\bTODO\b|\bFIXME\b|do not use|unsafe|deprecated',
    re.I,
)


def row(source, ident, code, actual, old, reason=None):
    r = {'source': source, 'id': ident, 'code': code, 'actual': actual, 'old': old}
    if reason:
        r['reason'] = reason
    return r


def load_reference():
    if not REF_MISMATCHES.exists():
        print(f'!! {REF_MISMATCHES} missing — run verify-reference-notes.py with '
              f'NOTE_JSONL set first', file=sys.stderr)
        return []
    out = []
    for line in REF_MISMATCHES.read_text().splitlines():
        if not line.strip():
            continue
        d = json.loads(line)
        if d.get('status') != 'MISMATCH':
            continue
        out.append(row('reference', d['name'], d['code'], d['actual'], d['claimed']))
    return out


def load_books():
    if not BOOK_AUDIT.exists():
        print(f'!! {BOOK_AUDIT} missing — run audit-books-values.py first', file=sys.stderr)
        return []
    d = json.loads(BOOK_AUDIT.read_text())
    out = []
    for m in d.get('mismatches', []):
        # Only `mismatch` is a proven divergence. `prose-claim` and
        # `inner-claims` were never checked, so they are not repairable material
        # — sending them to a model would be asking it to invent a verdict.
        if m.get('verdict') != 'mismatch':
            continue
        actual = m.get('printed') or ''
        if not actual.strip():
            actual = m.get('value') or ''
        out.append(row('book', f"{m['file']}:{m['key']}", m.get('code', ''),
                       actual, m.get('claim', '')))
    return out


def main():
    rows = load_reference() + load_books()
    work, human = [], []
    for r in rows:
        blob = f"{r['old']}\n{r['code']}"
        if WARNING_MARKERS.search(blob):
            r['reason'] = 'carries a live warning — a human decides whether it is still true'
            human.append(r)
            continue
        if not r['actual'].strip():
            r['reason'] = 'the code now produces no output — nothing to conform the note to'
            human.append(r)
            continue
        work.append(r)

    OUT_WORK.write_text(''.join(json.dumps(r) + '\n' for r in work))
    OUT_HUMAN.write_text(''.join(json.dumps(r) + '\n' for r in human))

    by_src = Counter(r['source'] for r in work)
    print(f'candidates examined     : {len(rows)}')
    print(f'  -> model worklist     : {len(work)}   {dict(by_src)}')
    print(f'  -> human queue        : {len(human)}   {dict(Counter(r["source"] for r in human))}')
    print(f'\n{OUT_WORK}')
    print(f'{OUT_HUMAN}')
    print('\nEvery worklist row carries `actual` verbatim. The repair driver pastes')
    print('that text; the model only writes the explaining clause after it.')


if __name__ == '__main__':
    main()
