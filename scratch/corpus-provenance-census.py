#!/usr/bin/env python3
"""corpus-provenance-census.py — who made every row in ~/motoi-corpus, and may
it go into MK-ULTRA.

Two questions, one pass:

  1. CLASSIFY. Every row carries `tags.provenance`. That field, not the file
     name and not the mtime (every mtime is the 2026-08-02 copy date), says
     where the row came from. Rows sort into ELIGIBLE (authored against the
     current language) and QUARANTINE (authored against an older, broken one).

  2. CENSUS THE VOICE WORK. The re-voiced rows are not "model output" — they
     are books and reference verbs read through and re-spoken in three
     registers. So count what got finished: which books, which verbs, which
     registers. What is missing is the work list.

Read-only. Writes one report + one JSON index into scratch/.
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import offline_guard  # noqa: F401  — first import, always

CORPUS = Path.home() / 'motoi-corpus'
OUT_MD = Path(__file__).parent / 'CORPUS-PROVENANCE-2026-08-03.md'
OUT_JSON = Path(__file__).parent / 'corpus-provenance.json'

# The CPT that MK-ULTRA must descend from. Anything authored before the stdlib
# lock (2026-07-24) was written against a language that has since changed under
# it, so its outputs cannot be trusted as ground truth.
STDLIB_LOCK = '2026-07-24'


def tags_of(row):
    if not isinstance(row, dict):
        return {}
    t = row.get('tags')
    return t if isinstance(t, dict) else {}


def scan():
    files = sorted(CORPUS.rglob('*.jsonl'))
    per_file = []
    prov_rows = Counter()
    prov_files = defaultdict(set)
    fam_rows = Counter()
    # (family, book) -> {register: n}
    book_reg = defaultdict(Counter)
    verb_reg = defaultdict(set)
    chapters = defaultdict(set)

    for f in files:
        rel = str(f.relative_to(CORPUS))
        top = rel.split('/')[0]
        n = 0
        provs = Counter()
        fams = Counter()
        src_files = Counter()
        for line in f.open(errors='replace'):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                n += 1
                provs['<unparseable>'] += 1
                continue
            n += 1
            t = tags_of(row)
            p = t.get('provenance') or '<none>'
            fam = t.get('family') or '<none>'
            provs[p] += 1
            fams[fam] += 1
            prov_rows[p] += 1
            prov_files[p].add(rel)
            fam_rows[fam] += 1
            if isinstance(row, dict):
                sf = row.get('_source_file')
                if sf:
                    src_files[str(sf).split('/')[0]] += 1
            reg = t.get('register') or t.get('audience') or _reg_from_name(rel)
            book = t.get('book')
            if book:
                book_reg[book][reg] += 1
                ch = t.get('chapter')
                if ch:
                    chapters[book].add(ch)
            sv = t.get('seed_verb')
            if sv:
                verb_reg[sv].add(reg)
        per_file.append({'file': rel, 'top': top, 'rows': n,
                         'prov': dict(provs), 'family': dict(fams),
                         'source_dirs': dict(src_files)})
    return (per_file, prov_rows, prov_files, fam_rows, book_reg, verb_reg,
            chapters)


def _reg_from_name(rel):
    for r in ('kid', 'layperson', 'phd'):
        if f'.{r}.' in rel:
            return r
    return '<none>'


def main():
    (per_file, prov_rows, prov_files, fam_rows, book_reg, verb_reg,
     chapters) = scan()
    total = sum(p['rows'] for p in per_file)

    by_top = defaultdict(lambda: {'rows': 0, 'files': 0, 'prov': Counter()})
    for p in per_file:
        b = by_top[p['top']]
        b['rows'] += p['rows']
        b['files'] += 1
        for k, v in p['prov'].items():
            b['prov'][k] += v

    print(f'files {len(per_file)}  rows {total:,}')
    print('\nprovenance:')
    for p, n in prov_rows.most_common():
        print(f'  {n:>9,}  {p}  ({len(prov_files[p])} files)')
    print('\nby folder:')
    for t, b in sorted(by_top.items(), key=lambda kv: -kv[1]['rows']):
        top_p = b['prov'].most_common(1)[0]
        print(f'  {b["rows"]:>9,}  {t:<20s} {b["files"]:>3} files  '
              f'top-prov={top_p[0]} ({top_p[1]:,})')
    print(f'\nbooks touched by revoice: {len(book_reg)}')
    print(f'reference verbs revoiced : {len(verb_reg)}')

    OUT_JSON.write_text(json.dumps({
        'total_rows': total,
        'files': per_file,
        'provenance_rows': dict(prov_rows),
        'provenance_files': {k: sorted(v) for k, v in prov_files.items()},
        'family_rows': dict(fam_rows),
        'book_registers': {b: dict(c) for b, c in book_reg.items()},
        'book_chapters': {b: sorted(c) for b, c in chapters.items()},
        'verb_registers': {v: sorted(r) for v, r in verb_reg.items()},
    }, indent=2))
    print(f'\n-> {OUT_JSON}')


if __name__ == '__main__':
    main()
