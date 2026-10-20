#!/usr/bin/env python3
"""anchor_repairs.py — locate every finalized repair in its source file, exactly.

The earlier apply step searched the decoded prose for the old value on its own
and found 74 of 214, because a bare `(100 200)` occurs in several places in the
same block. The value is not free-floating: it is the tail of a `; => …` comment
that sits on (or just after) the line holding the code. So the anchor is the
PAIR — code, then the arrow, then the old value — not the value alone.

Two anchor forms, because the corpus writes values two ways:

  A. inline arrow   `(code)  ; => <value>`        — books, most reference examples
  B. note field     `:code "(code)" :note "<value> — explanation"`  — 19 records

Escaping is POSITIONAL. Book prose lives inside a `:prose "…"` literal, so text
in the file has `\\"` where the decoded snippet has `"`. Whether to escape the
replacement is decided by whether the span sits inside a literal, never by
whether the old value happened to contain a quote — that was the bug.

Only the VALUE is replaced. The finalized rows carry a model-written explaining
clause; splicing that into a `; =>` comment that never had one would put model
prose into the books. The explanation the author wrote stays.

This step ONLY measures and writes a plan. It does not edit a file. A repair
that does not anchor uniquely is reported, never guessed at — applying the ones
that hit and skipping the rest silently is exactly how wrong claims survive.

  python3 scratch/anchor_repairs.py
"""
from __future__ import annotations

import json
import re
import sys
from bisect import bisect_right
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import offline_guard  # noqa: F401  — first import, always

REPO = Path('/Users/alfred/code/motoi-scheme')
BOOKS = REPO / 'scheme-books'
REF = REPO / 'scheme' / 'reference'
FINAL = REPO / 'scratch' / 'repair-final.jsonl'
OUT = REPO / 'scratch' / 'repair-plan.json'

ARROW = r'[ \t]*;+[ \t]*=>[ \t]*'


def escaped(s):
    """The form the text takes inside a SLAT string literal."""
    return s.replace('\\', '\\\\').replace('"', '\\"')


def escaped_nl(s):
    """Same, for the literals that also write newlines and tabs as escapes —
    reference `:code` does, book `:prose` keeps them real."""
    return escaped(s).replace('\n', '\\n').replace('\t', '\\t')


def forms(s):
    """Every spelling this snippet could have on disk, longest-escaped last."""
    out = []
    for f in (s, escaped(s), escaped_nl(s)):
        if f not in out:
            out.append(f)
    return out


def literal_starts(text):
    """Opening offset of every string literal, so a position can be tested for
    being inside one. A `"` preceded by an odd run of backslashes is escaped."""
    starts, i, n, inside = [], 0, len(text), False
    while i < n:
        c = text[i]
        if c == '\\':
            i += 2
            continue
        if c == '"':
            if not inside:
                starts.append(i)
                inside = True
            else:
                starts.append(i + 1)
                inside = False
        i += 1
    return starts


def inside_literal(starts, pos):
    """Literal spans alternate open/close in `starts`, so an odd index means in."""
    return bisect_right(starts, pos) % 2 == 1


def path_of(row):
    f = row['id'].rsplit(':', 1)[0]
    return (BOOKS / f) if row['source'] == 'book' else (REF / f)


def anchor_arrow(text, code, old):
    """Form A: code, optional line break, `; =>`, then the old value.
    Returns (hits, matched_old_form). The code may end on its own line with the
    arrow on the next one, so the separator swallows an optional newline."""
    for c in forms(code):
        for o in forms(old):
            rx = re.compile(re.escape(c.strip()) + r'[ \t]*\n?' + ARROW +
                            re.escape(o.strip()) + r'(?=[ \t]*(?:\n|$))')
            hits = list(rx.finditer(text))
            if hits:
                return hits, o
    return [], None


def anchor_note(text, code, old):
    """Form B: `:code "<code>" … :note "<value> …`. The value is the head of the
    note, so it is bounded by the opening quote on the left and by the em-dash
    clause (or the closing quote) on the right."""
    for c in forms(code):
        for o in forms(old):
            rx = re.compile(r':code[ \t]+"' + re.escape(c.strip()) + r'"' +
                            r'[^\n]{0,600}?:note[ \t]+"' +
                            r'(?P<val>' + re.escape(o.strip()) + r')' +
                            r'(?![^\s"\\])')
            hits = list(rx.finditer(text))
            if hits:
                return hits, o
    return [], None


def main():
    rows = [json.loads(l) for l in FINAL.open() if l.strip()]
    plan, unresolved = [], []
    stats = Counter()
    cache, lits = {}, {}

    for r in rows:
        p = path_of(r)
        if p not in cache:
            cache[p] = p.read_text() if p.is_file() else None
            lits[p] = literal_starts(cache[p]) if cache[p] is not None else []
        text = cache[p]
        if text is None:
            stats['no such file'] += 1
            unresolved.append({**r, 'why': f'no such file: {p}'})
            continue

        hits, old_form = anchor_arrow(text, r['code'], r['old'])
        form = 'arrow'
        if not hits:
            hits, old_form = anchor_note(text, r['code'], r['old'])
            form = 'note'
        if len(hits) != 1:
            key = 'ambiguous' if hits else 'not found'
            stats[key] += 1
            unresolved.append({**r, 'why': f'{len(hits)} anchors' if hits else 'no anchor'})
            continue

        m = hits[0]
        # The value span is the tail of the arrow match, or the named group.
        if form == 'note':
            vs, ve = m.span('val')
        else:
            ve = m.end()
            vs = ve - len(old_form)
        new = escaped(r['actual']) if inside_literal(lits[p], vs) else r['actual']
        plan.append({'id': r['id'], 'path': str(p), 'source': r['source'],
                     'form': form, 'start': vs, 'end': ve,
                     'was': text[vs:ve], 'now': new,
                     'line': text.count('\n', 0, vs) + 1,
                     'context': text[max(0, m.start() - 40):ve + 60],
                     'old': r['old'], 'actual': r['actual'],
                     'dropped_clause': r['note'].strip() != r['actual'].strip(),
                     'clause_verdict': r['clause_verdict']})
        stats[f'unique ({form})'] += 1

    # Two repairs to the same span would silently clobber each other.
    seen = Counter((p['path'], p['start']) for p in plan)
    dupes = [k for k, n in seen.items() if n > 1]
    print(f'repairs {len(rows)}')
    for k, v in stats.most_common():
        print(f'  {k:<18s} {v:>4}')
    if dupes:
        print(f'  !! {len(dupes)} spans targeted more than once')

    OUT.write_text(json.dumps({'plan': plan, 'unresolved': unresolved,
                               'stats': dict(stats)}, indent=2))
    print(f'\n-> {OUT}')
    if unresolved:
        print('\nunresolved:')
        for u in unresolved:
            print(f'  {u["why"]:<14s} {u["id"]:<34s} old={u["old"][:44]!r}')


if __name__ == '__main__':
    main()
