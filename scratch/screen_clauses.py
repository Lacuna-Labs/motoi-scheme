#!/usr/bin/env python3
"""screen_clauses.py — second local pass over the clauses in repair-proposals.

The value in every proposal is correct by construction (the driver pastes what
the interpreter printed). The CLAUSE is model prose and nothing has checked it.
One measured failure: for the output `invalid-lp` the model wrote "an invalid
left parenthesis" — lp is a linear program. Wrong prose in a reference book is
fabrication, so it does not get applied on the strength of having sounded fine.

This asks a local model ONE closed question per row: is every statement in the
clause determinable from the code and the output alone. It never rewrites and
never sees the old note, so it cannot be led. A row it does not clear keeps its
correct value and loses only the clause.

  python3 scratch/screen_clauses.py            # judge every proposal
  python3 scratch/screen_clauses.py --limit 20

Writes scratch/repair-clause-review.jsonl (one verdict per proposal).
"""
from __future__ import annotations

import offline_guard  # noqa: F401  — MUST be first: blocks any outbound socket

import argparse
import json
import sys
import time
from collections import Counter
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
PROPOSALS = REPO / 'scratch' / 'repair-proposals.jsonl'
OUTPUT = REPO / 'scratch' / 'repair-clause-review.jsonl'
DEFAULT_MODEL = 'mlx-community/Qwen2.5-7B-Instruct-4bit'
SEP = ' — '

JUDGE = """You are checking a sentence in a Scheme language reference for
unsupported claims.

Code:
{code}

The code prints exactly: {actual}

Sentence under review: {clause}

Is every statement in that sentence determinable from the code and that output
alone? Answer UNSUPPORTED if it names a meaning, unit, domain or intent that
the code and output do not establish. Answer SUPPORTED otherwise.

Reply with one word: SUPPORTED or UNSUPPORTED."""


def load_done():
    if not OUTPUT.exists():
        return set()
    done = set()
    for line in OUTPUT.read_text().splitlines():
        if line.strip():
            try:
                done.add(json.loads(line)['id'])
            except Exception:
                pass
    return done


def verdict_of(raw):
    up = raw.upper()
    # `UNSUPPORTED` contains `SUPPORTED`, so the negative must be tested first.
    if 'UNSUPPORTED' in up:
        return 'unsupported'
    if 'SUPPORTED' in up:
        return 'supported'
    return 'unclear'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--limit', type=int)
    ap.add_argument('--max-tokens', type=int, default=6)
    args = ap.parse_args()

    if not PROPOSALS.exists():
        sys.exit(f'no proposals — run scratch/repair_local.py first ({PROPOSALS})')
    rows = [json.loads(l) for l in PROPOSALS.read_text().splitlines() if l.strip()]
    done = load_done()
    todo = [r for r in rows if r['id'] not in done]
    if args.limit:
        todo = todo[:args.limit]
    if not todo:
        print(f'nothing to do — {len(done)} already judged in {OUTPUT}')
        return

    from mlx_lm import load, generate
    from mlx_lm.sample_utils import make_sampler
    model, tok = load(args.model)
    sampler = make_sampler(temp=0.0)

    counts = Counter()
    t0 = time.time()
    with OUTPUT.open('a') as fh:
        for i, r in enumerate(todo, 1):
            note = r['note']
            clause = note[len(r['actual']):]
            clause = clause[len(SEP):] if clause.startswith(SEP) else clause.strip()
            if not clause:
                # Value with no prose attached is already the safe form.
                counts['no-clause'] += 1
                fh.write(json.dumps({'id': r['id'], 'verdict': 'no-clause'}) + '\n')
                continue
            prompt = JUDGE.format(code=r['code'], actual=r['actual'], clause=clause)
            try:
                text = tok.apply_chat_template(
                    [{'role': 'user', 'content': prompt}],
                    add_generation_prompt=True, tokenize=False)
            except ValueError:
                text = f'<s>[INST] {prompt} [/INST]'
            raw = generate(model, tok, prompt=text, max_tokens=args.max_tokens,
                           sampler=sampler, verbose=False)
            v = verdict_of(raw)
            counts[v] += 1
            fh.write(json.dumps({
                'id': r['id'], 'source': r['source'], 'verdict': v,
                'clause': clause, 'actual': r['actual'], 'code': r['code'],
                'raw': raw.strip()[:40], 'model': args.model,
            }) + '\n')
            fh.flush()
            if i % 25 == 0 or i == len(todo):
                el = time.time() - t0
                print(f'  {i}/{len(todo)}  {dict(counts)}  {el/i:.1f}s/row',
                      file=sys.stderr)

    el = time.time() - t0
    print(f'\n{args.model}')
    for k in ('supported', 'unsupported', 'unclear', 'no-clause'):
        print(f'  {k:<12s} {counts[k]}')
    print(f'  {el/len(todo):.1f}s per row')
    print(f'  -> {OUTPUT}')
    print('\nOnly `supported` rows are eligible to carry their clause. Every other')
    print('row still gets its corrected value; it just gets it bare.')


if __name__ == '__main__':
    main()
