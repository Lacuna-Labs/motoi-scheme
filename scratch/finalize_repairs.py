#!/usr/bin/env python3
"""finalize_repairs.py — join the proposals to the clause verdicts.

A proposal's VALUE is correct by construction. Its CLAUSE is model prose that
`screen_clauses.py` judged. A clause the judge did not clear is dropped, and the
row keeps its corrected value bare — still a strict improvement on a note that
stated a value the engine does not produce, with nothing invented.

Nothing here writes to a `.slat`, `.slatl` or book file. It produces the exact
text an apply step would use, so that step has no decisions left to make.

  python3 scratch/finalize_repairs.py
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
PROPOSALS = REPO / 'scratch' / 'repair-proposals.jsonl'
REVIEW = REPO / 'scratch' / 'repair-clause-review.jsonl'
OUTPUT = REPO / 'scratch' / 'repair-final.jsonl'
SEP = ' — '


def main():
    verdicts = {}
    for line in REVIEW.read_text().splitlines():
        if line.strip():
            d = json.loads(line)
            verdicts[d['id']] = d['verdict']

    counts = Counter()
    out = []
    for line in PROPOSALS.read_text().splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        v = verdicts.get(r['id'], 'unjudged')
        keep = v == 'supported'
        note = r['note'] if keep else r['actual']
        counts[f"{v}/{'clause' if keep else 'bare'}"] += 1
        out.append({
            'id': r['id'], 'source': r['source'], 'tier': r['tier'],
            'clause_verdict': v, 'note': note, 'old': r['old'],
            'actual': r['actual'], 'code': r['code'],
        })

    OUTPUT.write_text(''.join(json.dumps(r) + '\n' for r in out))
    for k in sorted(counts):
        print(f'  {k:<22s} {counts[k]}')
    print(f'\n  {len(out)} notes ready   -> {OUTPUT}')
    print('  every note leads with the value the interpreter actually printed')


if __name__ == '__main__':
    main()
