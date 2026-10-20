#!/usr/bin/env python3
"""verify-reference-prose.py — the tier BELOW verify-reference-notes.py.

verify-reference-notes checks the 1,006 examples whose note OPENS with a
self-delimiting literal. That is the honest machine-checkable subset, and it
leaves 1,803 examples where the code IS runnable but the note is prose.

Prose is not automatically safe. emit_cpt_v5's S02 shape ships the note as
free text right beside the code, so a note reading "expect (-3, 4)" or
"it stays at (50, 50)" or "count is 1" is a value claim in sentence clothing —
exactly as trainable, and never once checked.

This runs each one and asks a narrower question than the notes gate:

    does the note mention a value at all, and if so, does the value the
    engine actually printed appear anywhere in it?

Three verdicts:
  CONSISTENT — the printed value occurs in the note. Nothing to do.
  PROSE      — the note names no value. Honest skip; a human has to read it.
  REVIEW     — the note names a value and the printed one is NOT in it.

REVIEW is a candidate, not a verdict. Numbers get rounded ("≈ 1.5708"),
reformatted ("(3, 4)" for `(3 4)`), and described rather than quoted, so a
human still has to read the list. It is a search beam, not a gate — which is
why it exits 0 and never edits a chapter.

    python3 scratch/verify-reference-prose.py
    python3 scratch/verify-reference-prose.py 40-math.slat
"""

import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path('/Users/alfred/code/motoi-scheme')
OUT = ROOT / 'scratch' / 'reference-prose-review.json'

_spec = importlib.util.spec_from_file_location(
    'refnotes', ROOT / 'scratch' / 'verify-reference-notes.py')
_argv, sys.argv = sys.argv, ['verify-reference-notes.py']
g = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(g)
sys.argv = _argv

# Every run gets its OWN empty MOTOI_HOME. Cortex and verb-stats persist under
# $MOTOI_HOME, so a shared sandbox lets each example read back what the previous
# ones wrote: `(length (cortex/query ...))` climbed 12 → 34 → 45 across identical
# code in one sitting. That is the worst kind of answer-shaped nothing, because
# it is plausible — splicing it would write a machine-and-date-specific number
# into the corpus as a fact about the language.

# A token in a note that reads as a VALUE rather than as English. Bare small
# integers are deliberately included even though they are noisy: "count is 1"
# is the whole point of this pass.
_VALUE_TOKEN = re.compile(
    r'\([^()]*\)'          # a parenthesised group — (3, 4), (blank blank blank)
    r'|"[^"]*"'            # a string literal
    r'|#[tf]\b'            # a boolean
    r'|#\\\S'              # a character
    r'|-?\d+/\d+'          # a rational
    r'|-?\d+\.\d+'         # a decimal
    r'|\b-?\d+\b'          # an integer
)

# Words that mark the sentence as making a claim about the result. A note with
# a number but none of these is usually describing an ARGUMENT ("set it to
# 100"), not an outcome.
_CLAIM_WORD = re.compile(
    r'\b(?:expect|expects|returns?|gives?|yields?|prints?|shows?|is|are|was|'
    r'becomes?|stays?|equals?|produces?|answers?|result|output)\b', re.I)


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').strip())


def collect():
    """Every example whose code is runnable-to-one-value but whose note is prose."""
    only = set(sys.argv[1:])
    rows = []
    for path in sorted((ROOT / 'scheme' / 'reference').rglob('*.slat')):
        if only and path.name not in only:
            continue
        text = path.read_text(errors='replace')
        for m in g.EXAMPLE_RE.finditer(text):
            code = g.unescape(m.group(1))
            note = g.unescape(m.group(2))
            if not (not g.NOT_BARE.search(code) or g.single_emit(code)):
                continue
            if g.leading_literal(note) is not None:
                continue          # already covered by the notes gate
            line = text[:m.start()].count('\n') + 1
            rows.append({'file': path.name, 'line': line,
                         'code': code, 'note': note})
    return rows


def run_one(row):
    try:
        with tempfile.TemporaryDirectory(prefix='motoi-prose-') as home:
            tmp = os.path.join(home, 'ex.scm')
            with open(tmp, 'w') as f:
                f.write(row['code'])
            r = subprocess.run([str(ROOT / 'bin' / 'motoi'), 'run', tmp],
                               capture_output=True, text=True, timeout=25,
                               cwd=ROOT, env={**os.environ, 'MOTOI_HOME': home})
        got = norm(r.stdout)
        if r.returncode != 0 or re.search(r'^\s*error:', r.stdout + r.stderr, re.M):
            row['verdict'] = 'ERROR'
            row['got'] = norm(r.stderr)[:160] or got[:160]
            return row
    except subprocess.TimeoutExpired:
        row['verdict'] = 'ERROR'
        row['got'] = '(timeout)'
        return row

    row['got'] = got
    note = row['note']
    if not got:
        row['verdict'] = 'NO-OUTPUT'
    elif got in norm(note):
        row['verdict'] = 'CONSISTENT'
    elif not (_VALUE_TOKEN.search(note) and _CLAIM_WORD.search(note)):
        row['verdict'] = 'PROSE'
    else:
        row['verdict'] = 'REVIEW'
    return row


def main():
    rows = collect()
    print(f'{len(rows)} prose-note examples with runnable code', file=sys.stderr)
    with ThreadPoolExecutor(max_workers=8) as ex:
        done = list(ex.map(run_one, rows))

    counts = {}
    for r in done:
        counts[r['verdict']] = counts.get(r['verdict'], 0) + 1
    review = [r for r in done if r['verdict'] in ('REVIEW', 'ERROR')]
    OUT.write_text(json.dumps(review, indent=1))

    for k in ('CONSISTENT', 'PROSE', 'REVIEW', 'NO-OUTPUT', 'ERROR'):
        if k in counts:
            print(f'{k:11} {counts[k]}')
    print(f'-> {OUT.relative_to(ROOT)}  ({len(review)} to read)')


if __name__ == '__main__':
    main()
