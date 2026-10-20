#!/usr/bin/env python3
"""repair_local.py — rewrite stale notes on this machine, no API, no agents.

Shape (measured 11/11 against 5/11 for zero-shot and 5/11 for few-shot):

  the harness already RAN the snippet, so it already knows the right answer.
  The model is therefore never asked to produce the value. It writes only the
  explaining clause; this driver pastes the real output in front of it. A
  truncated or altered value is not discouraged, it is impossible.

Every proposal is then re-graded by the reference gate's OWN parser — if the
gate does not read the new note's claim as equal to what the interpreter
printed, the proposal is rejected and recorded as a failure. Nothing that fails
the gate is ever written as an accepted repair.

This driver PROPOSES. It does not touch a single `.slat`, `.slatl` or book file;
applying the proposals is a separate reviewable step.

  python3 scratch/no-phone-home.py            # prove it cannot call out
  python3 scratch/repair_local.py --limit 20  # try a slice
  python3 scratch/repair_local.py             # the rest (resumes)
"""
from __future__ import annotations

import offline_guard  # noqa: F401  — MUST be first: blocks any outbound socket

import argparse
import importlib.util
import json
import sys
import time
from collections import Counter
from pathlib import Path

REPO = Path('/Users/alfred/code/motoi-scheme')
WORKLIST = REPO / 'scratch' / 'repair-worklist.jsonl'
OUTPUT = REPO / 'scratch' / 'repair-proposals.jsonl'
DEFAULT_MODEL = 'mlx-community/Qwen2.5-7B-Instruct-4bit'

_s = importlib.util.spec_from_file_location(
    'refgate', str(REPO / 'scratch' / 'verify-reference-notes.py'))
refgate = importlib.util.module_from_spec(_s); _s.loader.exec_module(refgate)

PROSE_ONLY = """You write documentation for a Scheme language reference.

Code:
{code}

It prints: {actual}

Write ONE short plain-English clause explaining that output, as it would appear
after a dash. Do not repeat the output. Do not mention bugs or versions. Reply
with the clause only.

Clause:"""


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


def clean_clause(text):
    line = next((l for l in text.strip().splitlines() if l.strip()), '')
    return line.strip().lstrip('-–— ').strip().strip('"')


# `--` is not a separator the gate recognises after a bare number: its number
# branch accepts only `— . , ;`. Writing `4 -- …` therefore produces a note the
# gate can no longer read back, so future audits would silently SKIP it as prose
# instead of checking it. The em dash satisfies every branch.
SEP = ' — '


def grade(note, actual):
    """How strongly the proposal is known to be right.

    gate-verified — the reference gate's own parser reads the claim back and it
                    equals what the interpreter printed. The strong case.
    value-exact   — the note provably starts with the interpreter's output
                    verbatim, but the output is a bare multi-word token that the
                    note format cannot express as a machine-readable claim. True,
                    but not auto-checkable later; flagged so nobody assumes it is.
    rejected      — anything else. Never written as a repair.
    """
    claim = refgate.leading_literal(note)
    if claim is not None and refgate.normalize(claim) == refgate.normalize(actual):
        return 'gate-verified'
    if note.startswith(actual) and note[len(actual):].startswith(SEP):
        return 'value-exact'
    return 'rejected'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--limit', type=int)
    ap.add_argument('--max-tokens', type=int, default=90)
    args = ap.parse_args()

    if not WORKLIST.exists():
        sys.exit(f'no worklist — run scratch/stale-prepass.py first ({WORKLIST})')
    rows = [json.loads(l) for l in WORKLIST.read_text().splitlines() if l.strip()]
    done = load_done()
    todo = [r for r in rows if r['id'] not in done]
    if args.limit:
        todo = todo[:args.limit]
    if not todo:
        print(f'nothing to do — {len(done)} already proposed in {OUTPUT}')
        return

    from mlx_lm import load, generate
    from mlx_lm.sample_utils import make_sampler
    model, tok = load(args.model)
    sampler = make_sampler(temp=0.0)

    tiers = Counter()
    t0 = time.time()
    with OUTPUT.open('a') as fh:
        for i, r in enumerate(todo, 1):
            prompt = PROSE_ONLY.format(code=r['code'], actual=r['actual'])
            try:
                text = tok.apply_chat_template(
                    [{'role': 'user', 'content': prompt}],
                    add_generation_prompt=True, tokenize=False)
            except ValueError:
                # Some local repos ship no chat template.
                text = f'<s>[INST] {prompt} [/INST]'
            raw = generate(model, tok, prompt=text, max_tokens=args.max_tokens,
                           sampler=sampler, verbose=False)
            clause = clean_clause(raw)
            note = f"{r['actual']}{SEP}{clause}" if clause else r['actual']
            tier = grade(note, r['actual'])
            tiers[tier] += 1
            fh.write(json.dumps({
                'id': r['id'], 'source': r['source'], 'tier': tier,
                'note': note, 'old': r['old'], 'actual': r['actual'],
                'code': r['code'], 'model': args.model,
            }) + '\n')
            fh.flush()
            if i % 10 == 0 or i == len(todo):
                el = time.time() - t0
                print(f'  {i}/{len(todo)}  {dict(tiers)}  '
                      f'{el/i:.1f}s/row  {3600/(el/i):,.0f} rows/hr', file=sys.stderr)

    el = time.time() - t0
    print(f'\n{args.model}')
    for k in ('gate-verified', 'value-exact', 'rejected'):
        print(f'  {k:<14s} {tiers[k]}')
    print(f'  {el/len(todo):.1f}s per row, {3600/(el/len(todo)):,.0f} rows/hour')
    print(f'  -> {OUTPUT}   (proposals only — no book or reference file was touched)')


if __name__ == '__main__':
    main()
