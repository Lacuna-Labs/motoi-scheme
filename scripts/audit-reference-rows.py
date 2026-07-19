#!/usr/bin/env python3
"""audit-reference-rows.py

Audit the Motoi Scheme reference for Row 2-5 coverage per intro § 6 + Rule 13.

For each verb across all library chapters:
  - Check :row-2-audit, :row-3-dimension, :row-4-proof, :row-5-emergence present
  - Check per-row three-discipline triplet (:eng :math :cs) present
  - Report per-chapter coverage
  - Report verbs missing rows
  - Report verbs missing disciplines within rows

Writes: _status/audit-reference-rows-2026-07-19.md
"""

import os, re, sys, json
from collections import defaultdict, Counter

REF_DIR = '/Users/alfred/code/motoi-scheme/Scheme/reference'
OUT = '/Users/alfred/code/motoi-scheme/_status/audit-reference-rows-2026-07-19.md'

def extract_records(text, tag='(verb'):
    records = []; i = 0; n = len(text)
    while i < n:
        if (i == 0 or text[i-1] == '\n') and text.startswith(tag, i):
            start = i; depth = 0; in_str = False; esc = False; j = i
            while j < n:
                c = text[j]
                if in_str:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': in_str = False
                else:
                    if c == '"': in_str = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0: j += 1; break
                j += 1
            records.append(text[start:j])
            i = j
        else:
            i += 1
    return records

def verb_name(rec):
    m = re.search(r':name\s+"([^"]+)"', rec)
    return m.group(1) if m else '<unnamed>'

def library(rec):
    m = re.search(r':library\s+"([^"]+)"', rec)
    return m.group(1) if m else '<unknown>'

def has_row(rec, row_key):
    return f':{row_key}' in rec

def has_three_discipline(rec, row_key):
    """Check that within the row's field, :eng :math :cs all appear."""
    i = rec.find(f':{row_key}')
    if i < 0: return False
    depth = 0; in_str = False; esc = False; j = i; end = None
    while j < len(rec):
        c = rec[j]
        if in_str:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': in_str = False
        else:
            if c == '"': in_str = True
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0: end = j+1; break
        j += 1
    if end is None: return False
    row_body = rec[i:end]
    return ':eng' in row_body and ':math' in row_body and ':cs' in row_body

def philosopher_leak(rec):
    """Rule 9: no philosopher names in entries (only in intro)."""
    for name in ['Peirce', 'Popper', 'Wittgenstein', 'Lacan',
                'Aristotle', 'Grice', 'Derrida', 'Quine', 'Sartre',
                'Rawls', 'Dennett']:
        if name in rec: return name
    return None

def sakura_leak(rec):
    """Rule 10: no Sakura verbs in Motoi entries."""
    for prefix in ['card/', 'shop/', 'cine/', 'flower/', 'afford/',
                   'radio/', 'cadence/', 'need/', 'ask/', 'ai-sidecar/',
                   'sys/', 'net/', 'docker/', 'deploy/']:
        if prefix in rec: return prefix
    return None

by_lib = defaultdict(list)
all_records = []
files_scanned = 0

for fname in sorted(os.listdir(REF_DIR)):
    if not fname.endswith('.slat'): continue
    if fname.startswith('00-'): continue
    if fname.startswith('99-'): continue
    if fname == 'MANIFEST.slat': continue
    with open(os.path.join(REF_DIR, fname)) as f:
        text = f.read()
    files_scanned += 1
    records = extract_records(text, '(verb')
    for rec in records:
        lib = library(rec)
        by_lib[lib].append((verb_name(rec), rec, fname))
        all_records.append((verb_name(rec), lib, rec, fname))

total_verbs = len(all_records)
row_keys = ['row-2-audit', 'row-3-dimension', 'row-4-proof', 'row-5-emergence']

# tally
row_present = {k: 0 for k in row_keys}
three_disc = {k: 0 for k in row_keys}
full_coverage_verbs = 0
philosopher_leaks = []
sakura_leaks = []
per_lib_stats = {}

for (name, lib, rec, fname) in all_records:
    all_rows_present = True
    all_rows_3disc = True
    for k in row_keys:
        if has_row(rec, k):
            row_present[k] += 1
        else:
            all_rows_present = False
        if has_three_discipline(rec, k):
            three_disc[k] += 1
        else:
            all_rows_3disc = False
    if all_rows_present and all_rows_3disc:
        full_coverage_verbs += 1
    pn = philosopher_leak(rec)
    if pn: philosopher_leaks.append((name, lib, pn))
    sn = sakura_leak(rec)
    if sn: sakura_leaks.append((name, lib, sn))

# per-library stats
for lib, entries in by_lib.items():
    n_full = 0
    n_partial = 0
    for (name, rec, fname) in entries:
        rows_present = sum(1 for k in row_keys if has_row(rec, k))
        if rows_present == 4: n_full += 1
        elif rows_present > 0: n_partial += 1
    per_lib_stats[lib] = (len(entries), n_full, n_partial)

# report
with open(OUT, 'w') as f:
    f.write('# Motoi Reference Row 2-5 Coverage Audit\n\n')
    f.write(f'Generated: 2026-07-19\n')
    f.write(f'Files scanned: {files_scanned}\n')
    f.write(f'Total verbs: {total_verbs}\n\n')
    f.write('## Overall row coverage\n\n')
    f.write(f'| Row | Present | 3-Discipline | Coverage % |\n')
    f.write(f'|---|---|---|---|\n')
    for k in row_keys:
        pct = 100.0 * row_present[k] / total_verbs if total_verbs else 0
        pct3 = 100.0 * three_disc[k] / total_verbs if total_verbs else 0
        f.write(f'| {k} | {row_present[k]} | {three_disc[k]} | {pct:.1f}% / {pct3:.1f}% |\n')
    f.write(f'\n**Verbs with FULL 4-row + 3-discipline coverage: {full_coverage_verbs} / {total_verbs}** ({100.0*full_coverage_verbs/total_verbs:.1f}%)\n\n')

    f.write('## Per-library coverage\n\n')
    f.write(f'| Library | Total | Full | Partial | Missing |\n')
    f.write(f'|---|---|---|---|---|\n')
    for lib in sorted(per_lib_stats):
        n, nf, np = per_lib_stats[lib]
        missing = n - nf - np
        f.write(f'| {lib} | {n} | {nf} | {np} | {missing} |\n')

    f.write('\n## Rule 9 violations (philosopher names in entries)\n\n')
    if philosopher_leaks:
        for name, lib, pn in philosopher_leaks[:50]:
            f.write(f'- {lib}/{name}: mentions "{pn}"\n')
        if len(philosopher_leaks) > 50:
            f.write(f'\n...and {len(philosopher_leaks) - 50} more.\n')
    else:
        f.write('None found. ✓\n')

    f.write('\n## Rule 10 violations (Sakura verbs in Motoi entries)\n\n')
    if sakura_leaks:
        # dedupe by verb
        by_verb = {}
        for name, lib, sn in sakura_leaks:
            by_verb.setdefault((lib, name), set()).add(sn)
        for (lib, name), prefixes in sorted(by_verb.items())[:80]:
            f.write(f'- {lib}/{name}: mentions {sorted(prefixes)}\n')
        if len(by_verb) > 80:
            f.write(f'\n...and {len(by_verb) - 80} more verbs.\n')
    else:
        f.write('None found. ✓\n')

    f.write('\n## Verdict\n\n')
    if full_coverage_verbs == total_verbs and not philosopher_leaks and not sakura_leaks:
        f.write('✓ FULL COVERAGE. Ready for fold.\n')
    elif full_coverage_verbs / total_verbs >= 0.95 and not philosopher_leaks:
        f.write(f'~ NEAR-FULL COVERAGE ({100.0*full_coverage_verbs/total_verbs:.1f}%). Enrichment pass recommended before fold. No hard blockers.\n')
    else:
        f.write(f'✗ INCOMPLETE ({100.0*full_coverage_verbs/total_verbs:.1f}%). More authoring needed before fold.\n')

print(f"audit written to {OUT}")
print(f"full-coverage verbs: {full_coverage_verbs} / {total_verbs}")
print(f"philosopher leaks: {len(philosopher_leaks)}")
print(f"sakura leaks: {len(sakura_leaks)}")
