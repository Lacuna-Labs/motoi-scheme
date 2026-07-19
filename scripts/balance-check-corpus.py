#!/usr/bin/env python3
"""balance-check-corpus.py

Check the JSONL training corpus for balance:
  - Row-1/2/3/4/5 pair proportion (should be roughly even, ~20% each)
  - Per-library distribution (no library should dominate to the exclusion of others)
  - Kind distribution (reference-intro / row-N / book-chapter)
  - Token-length distribution per kind

If any imbalance exceeds threshold, print REFOLD RECOMMENDED.

Writes: _status/balance-check-corpus-2026-07-19.md
"""

import os, sys, json, re
from collections import Counter, defaultdict

CORPUS = '/Users/alfred/code/motoi-scheme/training-data/motoi-mk1-corpus-2026-07-19.jsonl'
OUT = '/Users/alfred/code/motoi-scheme/_status/balance-check-corpus-2026-07-19.md'

if not os.path.exists(CORPUS):
    print(f"ERROR: corpus not found at {CORPUS}. Run fold-training-corpus.py first.")
    sys.exit(1)

pairs = []
with open(CORPUS) as f:
    for line in f:
        line = line.strip()
        if not line: continue
        try:
            pairs.append(json.loads(line))
        except json.JSONDecodeError:
            pass

kinds = Counter(p['kind'] for p in pairs)
total = sum(kinds.values())

# per-library from source field
lib_pattern = re.compile(r'reference/(\d+)-(\S+?)\.slat')
libs_by_kind = defaultdict(Counter)
for p in pairs:
    m = lib_pattern.match(p.get('source', ''))
    if m: libs_by_kind[p['kind']][m.group(2)] += 1

# token length approximation (chars/4)
def toklen(p):
    return (len(p.get('prompt','')) + len(p.get('completion',''))) // 4

lengths_by_kind = defaultdict(list)
for p in pairs:
    lengths_by_kind[p['kind']].append(toklen(p))

def stats(xs):
    if not xs: return (0, 0, 0)
    xs = sorted(xs)
    n = len(xs)
    return (xs[n//4], xs[n//2], xs[3*n//4])

# refold check
row_kinds = ['row-1-composition', 'row-2-audit', 'row-3-dimension', 'row-4-proof', 'row-5-emergence']
row_counts = [kinds.get(k, 0) for k in row_kinds]
row_min = min(row_counts) if row_counts else 0
row_max = max(row_counts) if row_counts else 0
imbalance_ratio = (row_max / row_min) if row_min > 0 else float('inf')

with open(OUT, 'w') as f:
    f.write(f'# Motoi Mk 1 Corpus Balance Check\n\n')
    f.write(f'Corpus: `{CORPUS}`\n')
    f.write(f'Total pairs: {total}\n\n')

    f.write('## Distribution by kind\n\n')
    f.write('| Kind | Count | % |\n|---|---|---|\n')
    for kind, n in kinds.most_common():
        pct = 100.0 * n / total
        f.write(f'| {kind} | {n} | {pct:.1f}% |\n')

    f.write('\n## Row-2/3/4/5 balance\n\n')
    for k, n in zip(row_kinds, row_counts):
        f.write(f'- {k}: {n}\n')
    if row_min > 0:
        f.write(f'\nMin/Max row count: {row_min} / {row_max}. Imbalance ratio: {imbalance_ratio:.2f}\n')
        if imbalance_ratio > 2.0:
            f.write('\n**⚠ IMBALANCE > 2× — REFOLD RECOMMENDED.** Some verbs are missing rows.\n')
        elif imbalance_ratio > 1.3:
            f.write('\n~ Mild imbalance. Acceptable but note in report.\n')
        else:
            f.write('\n✓ Balanced within tolerance.\n')
    else:
        f.write(f'\n**⚠ At least one row category has zero pairs — REFOLD REQUIRED.**\n')

    f.write('\n## Per-library distribution (reference chapters)\n\n')
    all_libs = set()
    for lbc in libs_by_kind.values():
        all_libs.update(lbc.keys())
    f.write('| Library | Row-1 | Row-2 | Row-3 | Row-4 | Row-5 |\n|---|---|---|---|---|---|\n')
    for lib in sorted(all_libs):
        row = [lib]
        for k in row_kinds:
            row.append(str(libs_by_kind.get(k, {}).get(lib, 0)))
        f.write(f'| ' + ' | '.join(row) + ' |\n')

    f.write('\n## Token length (approximate, chars/4)\n\n')
    f.write('| Kind | Q1 | Median | Q3 |\n|---|---|---|---|\n')
    for kind, lens in lengths_by_kind.items():
        q1, m, q3 = stats(lens)
        f.write(f'| {kind} | {q1} | {m} | {q3} |\n')

    f.write('\n## Verdict\n\n')
    if row_min > 0 and imbalance_ratio <= 1.5:
        f.write('✓ CORPUS BALANCED. Ready for Alfred go-signal.\n')
    elif row_min > 0 and imbalance_ratio <= 2.5:
        f.write('~ CORPUS ACCEPTABLE. Some libraries under-covered but overall workable.\n')
    else:
        f.write('✗ CORPUS UNBALANCED. Refold recommended — likely means authoring incomplete for some libraries.\n')

print(f"balance report: {OUT}")
print(f"total pairs: {total}")
print(f"row imbalance ratio: {imbalance_ratio if row_min else 'inf'}")
