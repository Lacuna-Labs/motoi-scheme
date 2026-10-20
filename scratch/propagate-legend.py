#!/usr/bin/env python3
"""Propagate the house-style ROW RULES legend to eligible chapters.

Inserts the canonical legend block (from 39-list.slat lines 5-22) before the
first `(` form in each eligible chapter that lacks it. Backs up originals first.
No deletes; idempotent (skips files that already carry the legend).
"""
from pathlib import Path
import shutil, datetime

REF = Path('/Users/alfred/code/motoi-scheme/scheme/reference')
ATTIC = Path('/Users/alfred/code/motoi-scheme/scratch/attic') / (
    'legend-propagation-' + datetime.date.today().strftime('%Y%m%d'))
ATTIC.mkdir(parents=True, exist_ok=True)

LEGEND = """;;;
;;; ─── THE ROW RULES (summary — full doctrine in 00-intro.slat) ───
;;;
;;; Every verb in this chapter has 5 rows. Each row does ONE job. Row
;;; contamination unbalances training data. If you author or edit a verb,
;;; STAY IN LANE.
;;;
;;;   Row 1 (HOW · Composition) — the verb written well; 1/3/5 module ladder
;;;   Row 2 (WHEN · Audit)      — operator's problem + this-verb-not-a-sibling
;;;   Row 3 (WHERE ELSE · Dim)  — same shape in 3 substrates (verb/metaphor/math)
;;;   Row 4 (WHY · Proof)       — claim + runnable test + ∀-invariant
;;;   Row 5 (WITH WHAT ELSE)    — chained verbs → named emergent pattern
;;;
;;; Every row carries the three-discipline lens: :eng · :math · :cs.
;;; No philosopher names in entries (they live in 00-intro.slat).
;;; Real Motoi domains only (no card/*, shop/*, cine/*, flower/*).
;;; Every code block RUNS through ./bin/motoi (or is marked :runs "spec-only").
;;;
"""

ELIGIBLE = [
    '00b-introspection', '04-animation', '05-artifact', '06-assert', '08-base',
    '09-beat', '13-chem', '14-collision', '16-compare', '21-domain',
    '22-easing', '26-exception', '27-floor', '37-lazy', '43-note', '45-num',
    '46-object', '49-pattern', '53-prefab', '54-route', '58-sprite', '65-tick',
    '68-transport', '71-weather',
]

def process(stem):
    path = REF / (stem + '.slat')
    text = path.read_text()
    if 'THE ROW RULES' in text:
        return f'{stem}: SKIP (already has legend)'
    lines = text.splitlines(keepends=True)
    # find first line whose first non-space char is '('
    idx = None
    for i, ln in enumerate(lines):
        if ln.lstrip().startswith('('):
            idx = i
            break
    if idx is None:
        return f'{stem}: SKIP (no form found)'
    shutil.copy2(path, ATTIC / (stem + '.slat'))
    block = LEGEND + '\n'
    # ensure a blank line before the legend if preceding content isn't blank
    prefix = ''
    if idx > 0 and lines[idx-1].strip() != '':
        prefix = '\n'
    new = ''.join(lines[:idx]) + prefix + block + ''.join(lines[idx:])
    path.write_text(new)
    return f'{stem}: INSERTED before line {idx+1}'

for stem in ELIGIBLE:
    print(process(stem))
