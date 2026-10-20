#!/usr/bin/env python3
"""verify-fold.py — run every code block in the MK-ULTRA-eligible lanes against
the CURRENT engine and check the row's own claim against what actually happens.

The fold's reversal lanes were generate-then-verify: each row was run against the
engine as it stood on Jul 31, and `oracle_verified` records that. The engine has
changed since (reader patch, five edits). `oracle_verified` is therefore a claim
about a machine that no longer exists. This re-runs it.

Two independent checks per row:

  OUTCOME — the row says `expected_outcome: "ok"`, so the block must still run
            clean. A row that now errors is stale-broken.
  VALUE   — where the response states a value ("It evaluates to `9`", "Value: ok"),
            compare that to what the engine actually prints. This is the check
            whose absence let 85 wrong claims through the reference gate.

Blocks repeat heavily across shards, so results are cached by exact source text;
the run cost is the number of DISTINCT blocks, not the number of rows.

Read-only. Nothing under ~/motoi-corpus is modified.

  python3 scratch/verify-fold.py --limit 500     # pilot
  python3 scratch/verify-fold.py                 # full
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import offline_guard  # noqa: F401  — first import, always

REPO = Path('/Users/alfred/code/motoi-scheme')
CORPUS = Path.home() / 'motoi-corpus'
OUT = REPO / 'scratch' / 'verify-fold.json'

_spec = importlib.util.spec_from_file_location('aref', str(REPO / 'scratch' / 'audit-ref.py'))
aref = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(aref)

# Only lanes authored after the 2026-07-24 stdlib lock. Anything older is
# quarantined and is not re-verified — it is not going into MK-ULTRA at all.
ELIGIBLE = ('sft-fold/', 'sft-staging/', 'haiku-revoice/')

# Files whose names mark them as rejects or caches. They are not fold rows.
def is_reject(rel):
    base = rel.rsplit('/', 1)[-1]
    return base.startswith('_') or base.startswith('.') or '/attic/' in rel


CLAIM_RES = [
    re.compile(r'It evaluates to `([^`]*)`'),
    re.compile(r'Running it yields `([^`]*)`'),
    re.compile(r'yields `([^`]*)`'),
    re.compile(r'^Value:[ \t]*(.+?)$', re.M),
    re.compile(r'evaluates to `([^`]*)`'),
]


def claim_of(response):
    if not isinstance(response, str):
        return None
    for rx in CLAIM_RES:
        m = rx.search(response)
        if m:
            return m.group(1).strip()
    return None


def norm(s):
    return ' '.join((s or '').split())


def matches(claim, out):
    """A block with several top-level expressions prints several values, but the
    row states only the last one — that is the block's value, not a wrong claim.
    So the claim may match the whole output, its last line, or its last token."""
    c = norm(claim)
    if c == norm(out):
        return True
    lines = out.splitlines()
    if lines and c == norm(lines[-1]):
        return True
    toks = out.split()
    return bool(toks) and c == toks[-1]


def load_rows(limit=None):
    rows = []
    for f in sorted(CORPUS.rglob('*.jsonl')):
        rel = str(f.relative_to(CORPUS))
        if not rel.startswith(ELIGIBLE) or is_reject(rel):
            continue
        for i, line in enumerate(f.open(errors='replace')):
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            if not isinstance(r, dict):
                continue
            blocks = r.get('code_blocks')
            if not blocks or not isinstance(blocks, list):
                continue
            rows.append({'file': rel, 'line': i, 'pair_id': r.get('pair_id'),
                         'shape': r.get('shape'),
                         'expected': r.get('expected_outcome'),
                         'code': '\n'.join(str(b) for b in blocks),
                         'claim': claim_of(r.get('response'))})
            if limit and len(rows) >= limit:
                return rows
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int)
    args = ap.parse_args()

    rows = load_rows(args.limit)
    uniq = sorted({r['code'] for r in rows})
    print(f'rows with code {len(rows):,}   distinct blocks {len(uniq):,}', flush=True)

    results = {}
    done = 0

    def work(code):
        rc, o, e = aref.run_one(code)
        cat, info = aref.classify(code, rc, o, e)
        return code, cat, info, norm(o)

    with ThreadPoolExecutor(max_workers=8) as ex:
        for code, cat, info, out in ex.map(work, uniq):
            results[code] = (cat, info, out)
            done += 1
            if done % 1000 == 0:
                print(f'  ...{done}/{len(uniq)}', flush=True)

    outcome = Counter()
    value = Counter()
    stale_broken = []
    wrong_value = []
    per_file = defaultdict(Counter)

    for r in rows:
        cat, info, out = results[r['code']]
        ok = cat == 'ok'
        outcome['ok' if ok else 'broken'] += 1
        per_file[r['file']]['ok' if ok else 'broken'] += 1
        if not ok and r['expected'] == 'ok':
            if len(stale_broken) < 60000:
                stale_broken.append({'file': r['file'], 'line': r['line'],
                                     'pair_id': r['pair_id'], 'cat': cat,
                                     'info': info, 'code': r['code'][:300]})
        if r['claim'] is None:
            value['no-claim'] += 1
        elif not ok:
            value['unrunnable'] += 1
        elif matches(r['claim'], out):
            value['match'] += 1
        else:
            value['mismatch'] += 1
            per_file[r['file']]['value-mismatch'] += 1
            if len(wrong_value) < 60000:
                wrong_value.append({'file': r['file'], 'line': r['line'],
                                    'pair_id': r['pair_id'], 'claim': r['claim'],
                                    'actual': out, 'code': r['code'][:300]})

    print(f'\n== OUTCOME (does the block still run) ==')
    for k, v in outcome.most_common():
        print(f'  {k:<14s} {v:>8,}')
    print(f'== VALUE (does the stated value match) ==')
    for k, v in value.most_common():
        print(f'  {k:<14s} {v:>8,}')
    print(f'\nstale-broken rows : {len(stale_broken):,}'
          f'{" (capped)" if len(stale_broken) >= 60000 else ""}')
    print(f'wrong-value rows  : {len(wrong_value):,}'
          f'{" (capped)" if len(wrong_value) >= 60000 else ""}')
    print('\nby file:')
    for f, c in sorted(per_file.items(), key=lambda kv: -kv[1]['broken']):
        if c['broken'] or c['value-mismatch']:
            print(f'  {f:<48s} broken={c["broken"]:<6} value-mismatch={c["value-mismatch"]}')

    OUT.write_text(json.dumps({
        'rows': len(rows), 'distinct_blocks': len(uniq),
        'outcome': dict(outcome), 'value': dict(value),
        'per_file': {k: dict(v) for k, v in per_file.items()},
        'stale_broken': stale_broken, 'wrong_value': wrong_value,
    }, indent=2))
    print(f'\n-> {OUT}')


if __name__ == '__main__':
    main()
