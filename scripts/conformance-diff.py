#!/usr/bin/env python3
"""conformance-diff.py — differential conformance test for the Motoi standard.

CLAUDE.md's five-point gate, point 3: "Every verb implemented correctly. Each
verb is conformance-verified against its cited spec (signature + behavior), not
just present."  This is that check.

`scripts/compliance-check-runnable.py` verifies that a snippet EXECUTES. That is
a liveness check, not a conformance check: `(= 1 1 2)` returns `#t`, which is
flatly wrong per R7RS-small 6.2.6, and it executes perfectly. This script
compares the VALUE against the spec.

Each case is a claim from the standard, written down so a machine can check it:

    C('=', '(= 1 1 2)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS, note='...')
      ^     ^            ^     ^                   ^
      verb  expression   spec-required value       citation

It is deliberately a data table, not clever code. You can add ten cases without
understanding the runner. The value is in the cases.

Usage:
    python3 scripts/conformance-diff.py                 # every case
    python3 scripts/conformance-diff.py --verb =        # one verb
    python3 scripts/conformance-diff.py --list          # table census, no run
    python3 scripts/conformance-diff.py --strict        # FIXED cases also gate
    python3 scripts/conformance-diff.py --all           # print passes too

Exit code = number of NEW divergences (capped at 250), so it can gate a commit.
Known divergences are marked `xfail` and do NOT gate: the point of the manifest
is that the gate is usable on day one instead of uniformly red. A case that is
marked xfail but now PASSES is reported as FIXED — the manifest is stale and
wants updating (with --strict, that gates too).

This script reports only. It never edits a chapter, a spec, or the engine.
"""

import os
import re
import sys
import subprocess
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/alfred/code/motoi-scheme'
MOTOI_BIN = f'{ROOT}/bin/motoi'
DUMP = '/tmp/conformance-diff.tsv'

# ---------------------------------------------------------------------------
# Expectation sentinels
# ---------------------------------------------------------------------------

RAISES = '<raises>'        # the spec says this is an error and it must signal
NOVALUE = '<no-output>'    # the expression printed nothing at all

# ---------------------------------------------------------------------------
# xfail provenance. A known divergence carries WHERE it is known from.
# ---------------------------------------------------------------------------

FINDINGS = 'findings'      # a row or a named claim in R7RS-CONFORMANCE-FINDINGS-2026-08-02.md
NEWFOUND = 'new-2026-08-02'  # measured by this script's first pass; NOT in that report
ASKALFRED = 'needs-alfred'   # divergence is real but the required value is arguable

FINDINGS_DOC = 'scratch/R7RS-CONFORMANCE-FINDINGS-2026-08-02.md'


class C:
    """One conformance claim.

    verb      the procedure under test, for grouping
    expr      a complete Motoi program; its printed result is the observation
    expected  the value the CITED SPEC requires; RAISES if the spec says error
    cite      exact section, e.g. 'R7RS-small 6.2.6', 'SRFI-1', 'SRFI-13'
    xfail     None if this must pass; FINDINGS / NEWFOUND / ASKALFRED otherwise
    note      why it diverges, or what the spec text actually says
    """

    __slots__ = ('verb', 'expr', 'expected', 'cite', 'xfail', 'note')

    def __init__(self, verb, expr, expected, cite, xfail=None, note=''):
        self.verb = verb
        self.expr = expr
        self.expected = expected
        self.cite = cite
        self.xfail = xfail
        self.note = note


# ===========================================================================
# THE CASE TABLE
#
# Every `expected` below is derived from the cited spec text, never from memory
# of what some other Scheme does. Where the standard is genuinely unclear the
# case is marked ASKALFRED and does not gate anything.
#
# Cases marked xfail=FINDINGS come from the tiered tables (and the named prose
# claims) of scratch/R7RS-CONFORMANCE-FINDINGS-2026-08-02.md. Cases marked
# xfail=NEWFOUND were measured while building this gate and are NOT in that
# report -- the report was incomplete.
# ===========================================================================

CASES = [

    # -- 6.2.6 numeric comparison: n-ary, transitive ------------------------
    # "These procedures return #t if and only if their arguments are
    #  monotonically nondecreasing" -- so EVERY adjacent pair must hold.
    C('=', '(= 1 1)', '#t', 'R7RS-small 6.2.6'),
    C('=', '(= 1 2)', '#f', 'R7RS-small 6.2.6'),
    C('=', '(= 1 1 1)', '#t', 'R7RS-small 6.2.6'),
    C('=', '(= 5 5 5 5)', '#t', 'R7RS-small 6.2.6'),
    C('=', '(= 1 2 1)', '#f', 'R7RS-small 6.2.6',
      note='passes only because the FIRST pair already differs'),
    C('=', '(= 1 1 2)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='Tier 1. bound as a 2-arg JS arrow (src/base.js:118-122); tail dropped'),
    C('=', '(= 1)', '#t', 'R7RS-small 6.2.6',
      note='SETTLED 2026-08-02 (ruling R2-2): a chain with no adjacent pairs is '
           'vacuously satisfied. Chez, Guile and Racket all answer #t. Zero '
           'arguments still raises -- there is no chain at all to be vacuous about'),

    C('<', '(< 1 2)', '#t', 'R7RS-small 6.2.6'),
    C('<', '(< 2 1)', '#f', 'R7RS-small 6.2.6'),
    C('<', '(< 1 2 3)', '#t', 'R7RS-small 6.2.6'),
    C('<', '(< 1 0 2)', '#f', 'R7RS-small 6.2.6'),
    C('<', '(< 1 3 2)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS, note='Tier 1'),
    C('<', '(< 1)', '#t', 'R7RS-small 6.2.6',
      note='SETTLED 2026-08-02 (ruling R2-2); see (= 1)'),

    C('>', '(> 3 2)', '#t', 'R7RS-small 6.2.6'),
    C('>', '(> 3 2 1)', '#t', 'R7RS-small 6.2.6'),
    C('>', '(> 1 2 0)', '#f', 'R7RS-small 6.2.6'),
    C('>', '(> 3 2 4)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='same n-ary defect as = and <; report names the whole family'),

    C('<=', '(<= 1 1)', '#t', 'R7RS-small 6.2.6'),
    C('<=', '(<= 1 1 2)', '#t', 'R7RS-small 6.2.6'),
    C('<=', '(<= 5 12 10)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS, note='Tier 1'),
    C('<=', '(<= 1 2 0)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='same n-ary defect'),

    C('>=', '(>= 2 2)', '#t', 'R7RS-small 6.2.6'),
    C('>=', '(>= 2 2 1)', '#t', 'R7RS-small 6.2.6'),
    C('>=', '(>= 3 2 4)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='same n-ary defect'),
    C('>=', '(>= 1 0 2)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='same n-ary defect'),

    # -- 6.2.6 + - * / ------------------------------------------------------
    # "(+) => 0 ... (*) => 1" are given as examples in the report text.
    C('+', '(+)', '0', 'R7RS-small 6.2.6'),
    C('+', '(+ 3)', '3', 'R7RS-small 6.2.6'),
    C('+', '(+ 3 4)', '7', 'R7RS-small 6.2.6'),
    C('+', '(+ 1 2 3 4 5)', '15', 'R7RS-small 6.2.6'),
    C('+', '(+ 1 2.5)', '3.5', 'R7RS-small 6.2.6'),
    C('+', "(+ 1 'a)", RAISES, 'R7RS-small 6.2.6', note='it is an error: not a number'),
    C('+', '(+ 1/2 1/2)', '1', 'R7RS-small 6.2.6', note='exact rational arithmetic'),

    C('*', '(*)', '1', 'R7RS-small 6.2.6'),
    C('*', '(* 4)', '4', 'R7RS-small 6.2.6'),
    C('*', '(* 2 3 4)', '24', 'R7RS-small 6.2.6'),
    C('*', '(* 1/2 2)', '1', 'R7RS-small 6.2.6'),

    C('-', '(- 3)', '-3', 'R7RS-small 6.2.6', note='unary minus negates'),
    C('-', '(- 3 4)', '-1', 'R7RS-small 6.2.6'),
    C('-', '(- 3 4 5)', '-6', 'R7RS-small 6.2.6'),
    C('-', '(- 0 -5)', '5', 'R7RS-small 6.2.6'),

    C('/', '(/ 6 3)', '2', 'R7RS-small 6.2.6'),
    C('/', '(/ 1 0)', RAISES, 'R7RS-small 6.2.6',
      note='"it is an error if any argument other than the first is an EXACT zero"'),
    C('/', '(/ 3)', '1/3', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='unary / is reciprocal and exact args must give an exact result. '
           'Motoi -> 0.3333333333333333. Rationals DO exist ((exact 0.5) -> 1/2), '
           'so 1/3 is representable. Not in the findings report'),
    C('/', '(/ 1 3)', '1/3', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='exact/exact must stay exact when representable. Motoi -> 0.3333333333333333'),
    C('/', '(/ 3 4 5)', '3/20', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='Motoi -> 0.15'),
    C('/', '(/ 1.0 0.0)', '+inf.0', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='only an EXACT zero divisor is an error; an inexact zero must yield '
           'an infinity. Motoi raises "division by zero". Not in the report'),

    # -- 6.2.6 abs min max --------------------------------------------------
    C('abs', '(abs -7)', '7', 'R7RS-small 6.2.6'),
    C('abs', '(abs 7)', '7', 'R7RS-small 6.2.6'),
    C('abs', '(abs -7.5)', '7.5', 'R7RS-small 6.2.6'),
    C('abs', '(abs 0)', '0', 'R7RS-small 6.2.6'),

    C('min', '(min 3 1 2)', '1', 'R7RS-small 6.2.6'),
    C('min', '(min 1 2)', '1', 'R7RS-small 6.2.6'),
    C('min', '(min 3 1.0 2)', '1.0', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='"If any argument is inexact, then the result will also be inexact." '
           'Motoi -> 1 (exact). Not in the findings report'),
    C('min', '(min)', RAISES, 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='signature (min x1 x2 ...) requires at least one argument. '
           'Motoi -> Infinity, the JS reduce identity leaking out'),

    C('max', '(max 3 1 2)', '3', 'R7RS-small 6.2.6'),
    C('max', '(max 3 4)', '4', 'R7RS-small 6.2.6'),
    C('max', '(max 3 4.0)', '4.0', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='inexactness is contagious in min/max. Motoi -> 4'),
    C('max', '(max)', RAISES, 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='Motoi -> -Infinity'),

    # -- 6.2.6 expt sqrt ----------------------------------------------------
    C('expt', '(expt 2 10)', '1024', 'R7RS-small 6.2.6'),
    C('expt', '(expt 2 0)', '1', 'R7RS-small 6.2.6'),
    C('expt', '(expt 0 0)', '1', 'R7RS-small 6.2.6', note='(expt 0 0) is defined to be 1'),
    C('expt', '(expt 2 -1)', '1/2', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='exact base and exact integer exponent must give an exact result. '
           'Motoi -> 0.5. Same exactness family as Tier 3 but a different verb'),
    C('expt', '(expt 2 100)', '1267650600228229401496703205376', 'R7RS-small 6.2.1',
      xfail=ASKALFRED,
      note='Motoi -> 1.2676506002282294e+30. 6.2.1 lets an implementation carry a '
           'limited exact range, but silently going inexact rather than signalling '
           'is a choice Alfred should make explicitly'),

    C('sqrt', '(sqrt 16)', '4', 'R7RS-small 6.2.6',
      note='"if z is a perfect square the result should be exact"'),
    C('sqrt', '(sqrt 25)', '5', 'R7RS-small 6.2.6'),
    C('sqrt', '(sqrt 0)', '0', 'R7RS-small 6.2.6'),
    C('sqrt', '(sqrt 2)', '1.4142135623730951', 'R7RS-small 6.2.6'),
    C('sqrt', '(sqrt 1/4)', '1/2', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='1/4 is a perfect square rational. Motoi -> NaN, same rational blind '
           'spot as (round 9/10). Not in the report'),
    C('sqrt', '(sqrt -1)', '+i', 'R7RS-small 6.2.6', xfail=ASKALFRED,
      note='Motoi -> NaN. Motoi has no complex numbers; 6.2.1 permits omitting '
           'them, but then the required behaviour is unclear'),

    # -- 6.2.6 floor ceiling round truncate ---------------------------------
    C('floor', '(floor 3.5)', '3', 'R7RS-small 6.2.6'),
    C('floor', '(floor -3.5)', '-4', 'R7RS-small 6.2.6'),
    C('floor', '(floor 5)', '5', 'R7RS-small 6.2.6'),
    C('floor', '(floor 7/2)', '3', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='floor is defined on RATIONALS, not just flonums. Motoi -> NaN. The '
           'report records only (round 9/10); floor/ceiling/truncate are equally '
           'blind and are NOT in the report'),
    C('floor', '(floor 9/10)', '0', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='Motoi -> NaN'),

    C('ceiling', '(ceiling 3.2)', '4', 'R7RS-small 6.2.6'),
    C('ceiling', '(ceiling -3.2)', '-3', 'R7RS-small 6.2.6'),
    C('ceiling', '(ceiling 7/2)', '4', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='Motoi -> NaN. Not in the report'),

    C('round', '(round 3.5)', '4', 'R7RS-small 6.2.6', note='rounds to even'),
    C('round', '(round 2.5)', '2', 'R7RS-small 6.2.6', note='2.5 rounds to even -> 2'),
    C('round', '(round -2.5)', '-2', 'R7RS-small 6.2.6'),
    C('round', '(round 3)', '3', 'R7RS-small 6.2.6'),
    C('round', '(round 9/10)', '1', 'R7RS-small 6.2.6', xfail=FINDINGS, note='Tier 1'),
    C('round', '(round 7/2)', '4', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='Motoi -> NaN; same rational blind spot, different input'),

    C('truncate', '(truncate 3.7)', '3', 'R7RS-small 6.2.6'),
    C('truncate', '(truncate -3.7)', '-3', 'R7RS-small 6.2.6'),
    C('truncate', '(truncate 7/2)', '3', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='Motoi -> NaN. Not in the report'),

    # -- 6.2.6 integer division --------------------------------------------
    # remainder takes the sign of the dividend; modulo takes the sign of the divisor.
    C('quotient', '(quotient 7 2)', '3', 'R7RS-small 6.2.6'),
    C('quotient', '(quotient -7 2)', '-3', 'R7RS-small 6.2.6', note='truncates toward zero'),
    C('quotient', '(quotient 7 -2)', '-3', 'R7RS-small 6.2.6'),
    C('quotient', '(quotient 7 0)', RAISES, 'R7RS-small 6.2.6'),

    C('remainder', '(remainder 13 4)', '1', 'R7RS-small 6.2.6'),
    C('remainder', '(remainder -13 4)', '-1', 'R7RS-small 6.2.6', note='sign of the dividend'),
    C('remainder', '(remainder 13 -4)', '1', 'R7RS-small 6.2.6'),
    C('remainder', '(remainder -13 -4)', '-1', 'R7RS-small 6.2.6'),

    C('modulo', '(modulo 13 4)', '1', 'R7RS-small 6.2.6'),
    C('modulo', '(modulo -13 4)', '3', 'R7RS-small 6.2.6', note='sign of the divisor'),
    C('modulo', '(modulo 13 -4)', '-3', 'R7RS-small 6.2.6'),
    C('modulo', '(modulo -13 -4)', '-1', 'R7RS-small 6.2.6'),
    C('modulo', '(modulo 7 0)', RAISES, 'R7RS-small 6.2.6'),

    C('gcd', '(gcd 32 -36)', '4', 'R7RS-small 6.2.6', note='gcd always returns non-negative'),
    C('gcd', '(gcd)', '0', 'R7RS-small 6.2.6'),
    C('lcm', '(lcm 32 -36)', '288', 'R7RS-small 6.2.6'),
    C('lcm', '(lcm)', '1', 'R7RS-small 6.2.6'),

    # -- 6.2.2 exactness ----------------------------------------------------
    C('exact?', '(exact? 1/2)', '#t', 'R7RS-small 6.2.6'),
    C('exact?', '(exact? 2)', '#t', 'R7RS-small 6.2.6'),
    C('exact?', '(exact? 2.0)', '#f', 'R7RS-small 6.2.6', xfail=FINDINGS, note='Tier 3'),
    C('inexact?', '(inexact? 2.0)', '#t', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='Tier 3; exact? and inexact? contradict each other on the same value'),
    C('exact', '(exact 0.5)', '1/2', 'R7RS-small 6.2.6'),
    C('exact', '(exact 1.5)', '3/2', 'R7RS-small 6.2.6'),
    C('exact', '(exact 3.14)', '157/50', 'R7RS-small 6.2.6'),
    C('inexact', '(inexact 1)', '1.0', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='the result must be inexact, and 6.10.3 requires an inexact integer to '
           'print with a decimal point. Motoi -> 1, indistinguishable from exact 1'),
    C('exact-integer?', '(exact-integer? 2)', '#t', 'R7RS-small 6.2.6'),
    C('exact-integer?', '(exact-integer? 2.5)', '#f', 'R7RS-small 6.2.6'),
    C('exact-integer?', '(exact-integer? 2.0)', '#f', 'R7RS-small 6.2.6', xfail=NEWFOUND,
      note='2.0 is an integer but it is INEXACT. Motoi -> #t. Exactness family, '
           'but this verb is not in the report'),

    # -- 6.2.7 numeric i/o --------------------------------------------------
    C('string->number', '(string->number "12")', '12', 'R7RS-small 6.2.7'),
    C('string->number', '(string->number "1.5")', '1.5', 'R7RS-small 6.2.7'),
    C('string->number', '(string->number "-3")', '-3', 'R7RS-small 6.2.7'),
    C('string->number', '(string->number "+5")', '5', 'R7RS-small 6.2.7'),
    C('string->number', '(string->number "abc")', '#f', 'R7RS-small 6.2.7'),
    C('string->number', '(string->number "")', '#f', 'R7RS-small 6.2.7'),
    C('string->number', '(string->number "ff" 16)', '255', 'R7RS-small 6.2.7'),
    C('string->number', '(string->number "10" 2)', '2', 'R7RS-small 6.2.7'),
    C('string->number', '(string->number "12abc")', '#f', 'R7RS-small 6.2.7', xfail=FINDINGS,
      note='Tier 1. "Returns #f if string is not a syntactically valid notation '
           'for a number"'),
    C('string->number', '(string->number "1/2")', '1/2', 'R7RS-small 6.2.7', xfail=FINDINGS,
      note='Tier 1'),
    C('string->number', '(string->number " 12")', '#f', 'R7RS-small 6.2.7', xfail=NEWFOUND,
      note='leading whitespace is not valid number notation. Motoi -> 12. The '
           'report records trailing garbage only'),
    C('string->number', '(string->number "12 ")', '#f', 'R7RS-small 6.2.7', xfail=NEWFOUND,
      note='trailing whitespace. Motoi -> 12'),
    C('string->number', '(string->number "#xff")', '255', 'R7RS-small 6.2.7', xfail=NEWFOUND,
      note='the #x radix prefix is part of number syntax. Motoi -> #f'),
    C('number->string', '(number->string 255)', '"255"', 'R7RS-small 6.2.7'),
    C('number->string', '(number->string 255 16)', '"ff"', 'R7RS-small 6.2.7'),
    C('number->string', '(number->string 1/2)', '"1/2"', 'R7RS-small 6.2.7', xfail=NEWFOUND,
      note='the READER accepts 1/2 and the PRINTER emits 1/2, but number->string '
           '-> "NaN". A round-trip hole nobody has recorded'),

    C('log', '(log 8 2)', '3', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='Tier 1; the two-argument (log z b) base is ignored'),
    C('log', '(log 100 10)', '2', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='same defect, different base'),

    C('floor/', '(call-with-values (lambda () (floor/ 7 2)) list)', '(3 1)',
      'R7RS-small 6.2.6'),
    C('truncate/', '(call-with-values (lambda () (truncate/ 7 2)) list)', '(3 1)',
      'R7RS-small 6.2.6'),
    C('exact-integer-sqrt', '(call-with-values (lambda () (exact-integer-sqrt 17)) list)',
      '(4 1)', 'R7RS-small 6.2.6'),
    C('floor/', '(floor/ 7 2)', '3 1', 'R7RS-small 6.2.6', xfail=ASKALFRED,
      note='Motoi prints "[object Object]" -- a raw JS Values object leaking to '
           'the console. 6.2.6 does not specify top-level printing of multiple '
           'values, but [object Object] cannot be right'),

    # -- 6.2.6 number predicates -------------------------------------------
    C('number?', '(number? 1)', '#t', 'R7RS-small 6.2.6'),
    C('number?', '(number? 1.5)', '#t', 'R7RS-small 6.2.6'),
    C('number?', '(number? 1/2)', '#t', 'R7RS-small 6.2.6'),
    C('number?', '(number? "1")', '#f', 'R7RS-small 6.2.6'),
    C('number?', "(number? 'a)", '#f', 'R7RS-small 6.2.6'),
    C('zero?', '(zero? 0)', '#t', 'R7RS-small 6.2.6'),
    C('zero?', '(zero? 0.0)', '#t', 'R7RS-small 6.2.6'),
    C('zero?', '(zero? 1)', '#f', 'R7RS-small 6.2.6'),
    C('even?', '(even? 2)', '#t', 'R7RS-small 6.2.6'),
    C('even?', '(even? 3)', '#f', 'R7RS-small 6.2.6'),
    C('even?', '(even? 2.0)', '#t', 'R7RS-small 6.2.6', note='integer-valued inexact'),
    C('even?', '(even? 4/2)', '#t', 'R7RS-small 6.2.6', xfail=FINDINGS,
      note='Tier 3; (integer? 4/2) is #t, so even? must accept it'),
    C('odd?', '(odd? 3)', '#t', 'R7RS-small 6.2.6'),
    C('odd?', '(odd? 2)', '#f', 'R7RS-small 6.2.6'),
    C('integer?', '(integer? 4/2)', '#t', 'R7RS-small 6.2.6'),
    C('rational?', '(rational? 1/2)', '#t', 'R7RS-small 6.2.6'),

    # -- 6.1 equivalence ----------------------------------------------------
    C('eq?', "(eq? 'a 'a)", '#t', 'R7RS-small 6.1'),
    C('eq?', '(eq? (list 1) (list 1))', '#f', 'R7RS-small 6.1'),
    C('eq?', '(eq? #t #t)', '#t', 'R7RS-small 6.1'),
    C('eq?', "(eq? '() '())", '#t', 'R7RS-small 6.1', xfail=FINDINGS,
      note='Tier 3; "eq? returns #t if obj1 and obj2 are both the empty list"'),
    C('eqv?', '(eqv? 100 100)', '#t', 'R7RS-small 6.1'),
    C('eqv?', '(eqv? 100.0 100.0)', '#t', 'R7RS-small 6.1'),
    C('eqv?', '(eqv? (list 1) (list 1))', '#f', 'R7RS-small 6.1'),
    C('eqv?', '(eqv? #\\a #\\a)', '#t', 'R7RS-small 6.1'),
    C('eqv?', '(eqv? 2 2.0)', '#f', 'R7RS-small 6.1', xfail=FINDINGS,
      note='Tier 3; "returns #f if one is exact and the other inexact"'),
    C('eqv?', "(eqv? '() '())", '#t', 'R7RS-small 6.1', xfail=NEWFOUND,
      note='the report records eq? on the empty list; eqv? has the SAME defect '
           'and is not recorded'),
    C('equal?', '(equal? (list 1 2) (list 1 2))', '#t', 'R7RS-small 6.1'),
    C('equal?', '(equal? "abc" "abc")', '#t', 'R7RS-small 6.1'),
    C('equal?', '(equal? (vector 1 2) (vector 1 2))', '#t', 'R7RS-small 6.1'),
    C('equal?', '(equal? 2 2)', '#t', 'R7RS-small 6.1'),
    C('equal?', '(equal? 1/2 1/2)', '#t', 'R7RS-small 6.1', xfail=FINDINGS,
      note='Tier 3; eqv? implies equal?, and (eqv? 1/2 1/2) is #t here'),
    C('equal?', '(equal? 2 2.0)', '#f', 'R7RS-small 6.1', xfail=NEWFOUND,
      note='"equal? returns the same as eqv? for numbers", and eqv? on 2 vs 2.0 '
           'must be #f. Motoi -> #t. The report records the eqv? half only'),

    # -- 6.3 booleans -------------------------------------------------------
    C('not', '(not #f)', '#t', 'R7RS-small 6.3'),
    C('not', '(not #t)', '#f', 'R7RS-small 6.3'),
    C('not', '(not 0)', '#f', 'R7RS-small 6.3', note='only #f is false in Scheme'),
    C('not', "(not '())", '#f', 'R7RS-small 6.3', note='the empty list is TRUE'),
    C('boolean?', '(boolean? #t)', '#t', 'R7RS-small 6.3'),
    C('boolean?', '(boolean? 0)', '#f', 'R7RS-small 6.3'),
    C('boolean?', "(boolean? '())", '#f', 'R7RS-small 6.3'),
    C('boolean=?', '(boolean=? #t #t)', '#t', 'R7RS-small 6.3'),
    C('boolean=?', '(boolean=? #f #f #f)', '#t', 'R7RS-small 6.3'),
    C('boolean=?', '(boolean=? #t #f #t)', '#f', 'R7RS-small 6.3'),
    C('boolean=?', '(boolean=? #t #t #f)', '#f', 'R7RS-small 6.3', xfail=NEWFOUND,
      note='signature is (boolean=? b1 b2 b3 ...) -- n-ary. Motoi -> #t, the same '
           '2-arg truncation as =. The report names ONLY numeric comparison and '
           'case-sensitive string comparison as broken; boolean=? is a third family'),

    # -- 6.5 symbols --------------------------------------------------------
    C('symbol->string', "(symbol->string 'abc)", '"abc"', 'R7RS-small 6.5'),
    C('string->symbol', '(string->symbol "abc")', 'abc', 'R7RS-small 6.5'),
    C('symbol=?', "(symbol=? 'a 'a 'a)", '#t', 'R7RS-small 6.5'),
    C('symbol=?', "(symbol=? 'a 'b 'a)", '#f', 'R7RS-small 6.5'),
    C('symbol=?', "(symbol=? 'a 'a 'b)", '#f', 'R7RS-small 6.5', xfail=NEWFOUND,
      note='signature (symbol=? s1 s2 s3 ...). Motoi -> #t. A FOURTH n-ary family '
           'not named in the report'),

    # -- 6.4 pairs and lists ------------------------------------------------
    C('car', '(car (list 1 2 3))', '1', 'R7RS-small 6.4'),
    C('car', '(car (cons 1 2))', '1', 'R7RS-small 6.4'),
    C('car', "(car '())", RAISES, 'R7RS-small 6.4', note='it is an error to take the car of ()'),
    C('car', '(car 5)', RAISES, 'R7RS-small 6.4'),
    C('cdr', '(cdr (list 1 2 3))', '(2 3)', 'R7RS-small 6.4'),
    C('cdr', '(cdr (cons 1 2))', '2', 'R7RS-small 6.4'),
    C('cdr', '(cdr (list 1))', '()', 'R7RS-small 6.4'),
    C('cdr', "(cdr '())", RAISES, 'R7RS-small 6.4'),
    C('cons', '(cons 1 2)', '(1 . 2)', 'R7RS-small 6.4', note='a dotted pair'),
    C('cons', '(cons 1 (list 2 3))', '(1 2 3)', 'R7RS-small 6.4'),
    C('cons', '(cons (list 1) (list 2))', '((1) 2)', 'R7RS-small 6.4'),
    C('list', '(list)', '()', 'R7RS-small 6.4'),
    C('list', '(list 1)', '(1)', 'R7RS-small 6.4'),
    C('list', '(list 1 2 3)', '(1 2 3)', 'R7RS-small 6.4'),
    C('length', '(length (list))', '0', 'R7RS-small 6.4'),
    C('length', '(length (list 1 2 3))', '3', 'R7RS-small 6.4'),
    C('length', '(length (cons 1 2))', RAISES, 'R7RS-small 6.4',
      note='length is defined on PROPER lists only'),
    C('length', '(length 5)', RAISES, 'R7RS-small 6.4'),
    C('append', '(append)', '()', 'R7RS-small 6.4'),
    C('append', '(append (list 1))', '(1)', 'R7RS-small 6.4'),
    C('append', '(append (list 1) (list 2 3))', '(1 2 3)', 'R7RS-small 6.4'),
    C('append', '(append (list 1) (list 2) (list 3))', '(1 2 3)', 'R7RS-small 6.4'),
    C('append', '(append (list) (list))', '()', 'R7RS-small 6.4'),
    C('append', '(append (list 1 2) 3)', '(1 2 . 3)', 'R7RS-small 6.4',
      note='the LAST argument may be any object'),
    C('append', "(append 7 '(1))", RAISES, 'R7RS-small 6.4', xfail=FINDINGS,
      note='Tier 2; every argument except the last must be a proper list'),
    C('reverse', '(reverse (list 1 2 3))', '(3 2 1)', 'R7RS-small 6.4'),
    C('reverse', '(reverse (list))', '()', 'R7RS-small 6.4'),
    C('reverse', '(reverse 5)', RAISES, 'R7RS-small 6.4'),
    C('list-ref', "(list-ref '(1 2 3) 0)", '1', 'R7RS-small 6.4'),
    C('list-ref', "(list-ref '(1 2 3) 2)", '3', 'R7RS-small 6.4'),
    C('list-ref', "(list-ref '(1 2 3) 99)", RAISES, 'R7RS-small 6.4', xfail=FINDINGS,
      note='Tier 1; "it is an error if list has fewer than k elements". '
           'Motoi returns a non-value that is TRUTHY'),
    C('list-ref', "(list-ref '(1 2 3) -1)", RAISES, 'R7RS-small 6.4', xfail=NEWFOUND,
      note='k must be a non-negative exact integer. Motoi -> no value'),
    C('list-tail', "(list-tail '(1 2 3) 1)", '(2 3)', 'R7RS-small 6.4'),
    C('list-tail', "(list-tail '(1 2 3) 99)", RAISES, 'R7RS-small 6.4', xfail=NEWFOUND,
      note='"it is an error if list has fewer than k elements". Motoi -> ()'),
    C('list?', "(list? '())", '#t', 'R7RS-small 6.4'),
    C('list?', '(list? (list 1 2))', '#t', 'R7RS-small 6.4'),
    C('list?', '(list? (cons 1 2))', '#f', 'R7RS-small 6.4'),
    C('pair?', '(pair? (cons 1 2))', '#t', 'R7RS-small 6.4'),
    C('pair?', '(pair? (list 1))', '#t', 'R7RS-small 6.4'),
    C('pair?', "(pair? '())", '#f', 'R7RS-small 6.4'),
    C('pair?', '(pair? (vector 1))', '#f', 'R7RS-small 6.4'),
    C('null?', "(null? '())", '#t', 'R7RS-small 6.4'),
    C('null?', '(null? (list 1))', '#f', 'R7RS-small 6.4'),
    C('null?', '(null? 0)', '#f', 'R7RS-small 6.4'),
    C('memq', "(memq 'b '(a b c))", '(b c)', 'R7RS-small 6.4'),
    C('member', "(member 2 '(1 2 3))", '(2 3)', 'R7RS-small 6.4'),
    C('member', '(member "b" (list "a" "b"))', '("b")', 'R7RS-small 6.4'),
    C('member', "(member 2 '(1 2 3) =)", '(2 3)', 'R7RS-small 6.4',
      note='the 3-argument form takes a comparator'),
    C('member', "(member 2 '(1 2 3) (lambda (a b) #f))", '#f', 'R7RS-small 6.4',
      xfail=FINDINGS, note='Tier 2; the comparator is ignored'),
    C('assq', "(assq 'b '((a . 1) (b . 2)))", '(b . 2)', 'R7RS-small 6.4'),
    C('assoc', "(assoc 2 '((1 . a) (2 . b)))", '(2 . b)', 'R7RS-small 6.4'),
    C('assoc', "(assoc 5 '((1 . a)))", '#f', 'R7RS-small 6.4'),
    C('assoc', "(assoc 2 '((1 . a) (2 . b)) (lambda (a b) #f))", '#f', 'R7RS-small 6.4',
      xfail=FINDINGS, note='Tier 2; the comparator is ignored'),
    C('set-car!', '(let ((p (cons 1 2))) (set-car! p 9) p)', '(9 . 2)', 'R7RS-small 6.4',
      xfail=NEWFOUND,
      note='UNBOUND. Required by 6.4. The report records set-cdr! as missing but '
           'not set-car!'),
    C('set-cdr!', '(let ((p (cons 1 2))) (set-cdr! p 3) p)', '(1 . 3)', 'R7RS-small 6.4',
      xfail=FINDINGS, note='reported unbound in the ports section, found incidentally'),

    # -- 6.10 control features ---------------------------------------------
    C('map', '(map (lambda (x) (* x x)) (list 1 2 3))', '(1 4 9)', 'R7RS-small 6.10'),
    C('map', '(map + (list 1 2) (list 10 20))', '(11 22)', 'R7RS-small 6.10'),
    C('map', '(map car (list (list 1 2) (list 3 4)))', '(1 3)', 'R7RS-small 6.10'),
    C('map', '(map (lambda (x) x) (list))', '()', 'R7RS-small 6.10'),
    C('map', '(map + (list 1 2 3) (list 10 20))', '(11 22)', 'SRFI-1',
      note='DELIBERATE: SRFI-1 shortest-stop. R7RS leaves unequal lengths '
           'unspecified, so this is a strict superset. Recorded in CLAUDE.md'),
    C('for-each', '(for-each display (list 1 2 3))', '123', 'R7RS-small 6.10'),
    C('for-each',
      '(let ((n 0)) (for-each (lambda (x) (set! n (+ n x))) (list 1 2 3)) n)',
      '6', 'R7RS-small 6.10', note='for-each is for effect, left to right'),
    C('apply', '(apply + (list 1 2 3))', '6', 'R7RS-small 6.10'),
    C('apply', '(apply + 1 2 (list 3 4))', '10', 'R7RS-small 6.10',
      note='leading arguments are consed onto the final list'),
    C('apply', '(apply list (list))', '()', 'R7RS-small 6.10'),
    C('apply', '(apply max (list 3 1 2))', '3', 'R7RS-small 6.10'),
    C('apply', '(apply + 5)', RAISES, 'R7RS-small 6.10',
      note='the last argument must be a list'),
    C('values', '(call-with-values (lambda () (values 1 2)) list)', '(1 2)',
      'R7RS-small 6.10'),
    C('string-map', '(string-map char-upcase "abc")', '"ABC"', 'R7RS-small 6.10'),
    C('vector-map', '(vector-map + (vector 1 2) (vector 10 20))', '#(11 22)',
      'R7RS-small 6.10'),

    # -- SRFI-1 -------------------------------------------------------------
    C('filter', '(filter even? (list 1 2 3 4))', '(2 4)', 'SRFI-1'),
    C('filter', '(filter odd? (list))', '()', 'SRFI-1'),
    C('filter', '(filter (lambda (x) #t) (list 1 2))', '(1 2)', 'SRFI-1'),
    C('fold', "(fold cons '() (list 1 2 3))", '(3 2 1)', 'SRFI-1',
      note='SRFI-1 fold is element-first; it reverses when konsed'),
    C('fold', "(fold-right cons '() (list 1 2 3))", '(1 2 3)', 'SRFI-1'),
    C('fold', '(fold + 0 (list 1 2) (list 10 20))', '33', 'SRFI-1', xfail=NEWFOUND,
      note='n-ary fold must call (kons e1 e2 acc). Motoi -> 3: the second list is '
           'silently dropped. Same shape as the list-index row in Tier 2, but fold '
           'itself is NOT in the report'),
    C('list-index', '(list-index even? (list 1 3 5))', '#f', 'SRFI-1'),
    C('list-index', '(list-index even? (list 1 2 3) (list 4 5 6))', '#f', 'SRFI-1',
      xfail=FINDINGS,
      note='Tier 2; walks the lists in step -- (even? 1 4) is false, (even? 2 5) '
           'is false ... so no index qualifies. Motoi ignores list 2 and answers 1'),
    C('take', '(take (list 1 2 3) 2)', '(1 2)', 'SRFI-1'),
    C('drop', '(drop (list 1 2 3) 2)', '(3)', 'SRFI-1'),
    C('last', '(last (list 1 2 3))', '3', 'SRFI-1'),
    C('any', '(any even? (list 1 2 3))', '#t', 'SRFI-1'),
    C('every', '(every even? (list 2 4))', '#t', 'SRFI-1'),
    C('count', '(count even? (list 1 2 3 4))', '2', 'SRFI-1'),
    C('remove', '(remove even? (list 1 2 3 4))', '(1 3)', 'SRFI-1'),
    C('delete', '(delete 2 (list 1 2 3))', '(1 3)', 'SRFI-1'),
    C('find', '(find even? (list 1 3 4))', '4', 'SRFI-1'),
    C('iota', '(iota 3)', '(0 1 2)', 'SRFI-1'),
    C('list-tabulate', '(list-tabulate 3 (lambda (i) i))', '(0 1 2)', 'SRFI-1'),
    C('append-map', '(append-map (lambda (x) (list x x)) (list 1 2))', '(1 1 2 2)', 'SRFI-1'),
    C('delete-duplicates', '(delete-duplicates (list 1 1 2))', '(1 2)', 'SRFI-1'),
    C('concatenate', '(concatenate (list (list 1) (list 2)))', '(1 2)', 'SRFI-1'),
    C('fold-left', '(fold-left + 0 (list 1 2))', RAISES, 'CLAUDE.md EXCLUDED',
      note='R6RS/Racket accumulator-first fold is deliberately NOT bound'),
    C('foldl', '(foldl + 0 (list 1 2))', RAISES, 'CLAUDE.md EXCLUDED',
      note='Racket foldl is deliberately NOT bound'),

    # -- 6.7 strings --------------------------------------------------------
    C('string-append', '(string-append)', '""', 'R7RS-small 6.7'),
    C('string-append', '(string-append "a")', '"a"', 'R7RS-small 6.7'),
    C('string-append', '(string-append "a" "b")', '"ab"', 'R7RS-small 6.7'),
    C('string-append', '(string-append "a" "b" "c")', '"abc"', 'R7RS-small 6.7'),
    C('string-append', '(string-append "" "")', '""', 'R7RS-small 6.7'),
    C('string-append', '(string-append "a" 1)', RAISES, 'R7RS-small 6.7', xfail=ASKALFRED,
      note='signature is (string-append string ...). Motoi -> "a1", silently '
           'coercing. 1.3.2 lets an implementation behave arbitrarily on "it is an '
           'error", so whether to signal is a policy call'),
    C('string-length', '(string-length "")', '0', 'R7RS-small 6.7'),
    C('string-length', '(string-length "abc")', '3', 'R7RS-small 6.7'),
    C('string-length', '(string-length 5)', RAISES, 'R7RS-small 6.7', xfail=NEWFOUND,
      note='Motoi -> 1: it stringifies the number and measures THAT. A silent '
           'wrong answer on a type error. Not in the report'),
    C('string-ref', '(string-ref "abc" 0)', '#\\a', 'R7RS-small 6.7'),
    C('string-ref', '(string-ref "abc" 2)', '#\\c', 'R7RS-small 6.7'),
    C('string-ref', '(string-ref "abc" 3)', RAISES, 'R7RS-small 6.7', xfail=FINDINGS,
      note='"it is an error if k is not a valid index". Motoi -> an empty '
           'character object. Named in the findings "Ordering" section item 2, '
           'but absent from every tier table'),
    C('string-ref', '(string-ref "abc" -1)', RAISES, 'R7RS-small 6.7', xfail=FINDINGS,
      note='same bounds hole, negative index'),
    C('substring', '(substring "abcdef" 1 3)', '"bc"', 'R7RS-small 6.7'),
    C('substring', '(substring "abcdef" 0 0)', '""', 'R7RS-small 6.7'),
    C('substring', '(substring "abcdef" 0 6)', '"abcdef"', 'R7RS-small 6.7'),
    C('substring', '(substring "abcdef" 4 2)', RAISES, 'R7RS-small 6.7',
      note='requires 0 <= start <= end <= length'),
    C('substring', '(substring "abcdef" 0 99)', RAISES, 'R7RS-small 6.7'),
    C('string=?', '(string=? "a" "a")', '#t', 'R7RS-small 6.7'),
    C('string=?', '(string=? "a" "b")', '#f', 'R7RS-small 6.7'),
    C('string=?', '(string=? "a" "a" "a")', '#t', 'R7RS-small 6.7'),
    C('string=?', '(string=? "a" "b" "a")', '#f', 'R7RS-small 6.7'),
    C('string=?', '(string=? "a" "a" "b")', '#f', 'R7RS-small 6.7', xfail=FINDINGS,
      note='Tier 1'),
    C('string<?', '(string<? "a" "b")', '#t', 'R7RS-small 6.7'),
    C('string<?', '(string<? "a" "b" "c")', '#t', 'R7RS-small 6.7'),
    C('string<?', '(string<? "a" "c" "b")', '#f', 'R7RS-small 6.7', xfail=FINDINGS,
      note='the report names the whole case-sensitive string family as broken'),
    C('string>?', '(string>? "b" "a")', '#t', 'R7RS-small 6.7'),
    C('string>?', '(string>? "c" "a" "b")', '#f', 'R7RS-small 6.7', xfail=FINDINGS,
      note='case-sensitive string family'),
    C('string<=?', '(string<=? "a" "a" "b")', '#t', 'R7RS-small 6.7'),
    C('string<=?', '(string<=? "a" "b" "a")', '#f', 'R7RS-small 6.7', xfail=FINDINGS,
      note='case-sensitive string family'),
    C('string>=?', '(string>=? "c" "b" "c")', '#f', 'R7RS-small 6.7', xfail=FINDINGS,
      note='case-sensitive string family'),
    C('string-ci=?', '(string-ci=? "A" "a")', '#t', 'R7RS-small 6.7'),
    C('string-ci=?', '(string-ci=? "A" "a" "b")', '#f', 'R7RS-small 6.7',
      note='the -ci family IS n-ary correct (pairwise loops in lib/base/r7rs-small.js)'),
    C('string-ci<?', '(string-ci<? "A" "b" "a")', '#f', 'R7RS-small 6.7'),
    C('string-ci<=?', '(string-ci<=? "A" "b" "a")', '#f', 'R7RS-small 6.7'),
    C('string-upcase', '(string-upcase "aBc")', '"ABC"', 'R7RS-small 6.7'),
    C('string-downcase', '(string-downcase "AbC")', '"abc"', 'R7RS-small 6.7'),
    C('string-copy', '(string-copy "abcdef" 1 3)', '"bc"', 'R7RS-small 6.7'),
    C('make-string', '(make-string 3 #\\a)', '"aaa"', 'R7RS-small 6.7'),
    C('string->list', '(string->list "abc")', '(#\\a #\\b #\\c)', 'R7RS-small 6.7'),
    C('list->string', '(list->string (list #\\a #\\b))', '"ab"', 'R7RS-small 6.7'),
    C('string-set!', '(let ((s (make-string 3 #\\a))) (string-set! s 0 #\\z) s)',
      '"zaa"', 'R7RS-small 6.7', xfail=NEWFOUND,
      note='UNBOUND. string-set! is a required 6.7 procedure. Not in the report'),
    C('string-fill!', '(let ((s (make-string 3 #\\a))) (string-fill! s #\\z) s)',
      '"zzz"', 'R7RS-small 6.7', xfail=NEWFOUND,
      note='UNBOUND. Required by 6.7. Not in the report'),
    C('string-copy!',
      '(let ((s (make-string 3 #\\a))) (string-copy! s 0 "xyz") s)',
      '"xyz"', 'R7RS-small 6.7', xfail=NEWFOUND,
      note='UNBOUND. Required by 6.7. Not in the report'),

    # -- SRFI-13 ------------------------------------------------------------
    C('string-pad', '(string-pad "7" 3)', '"  7"', 'SRFI-13',
      note='SRFI-13 string-pad right-justifies'),
    C('string-pad-right', '(string-pad-right "7" 3)', '"7  "', 'SRFI-13'),
    C('string-index', '(string-index "abc" (lambda (c) (char=? c #\\b)))', '1', 'SRFI-13'),
    C('string-contains', '(string-contains "abcdef" "cd")', '2', 'SRFI-13'),
    C('string-join', '(string-join (list "a" "b") ",")', '"a,b"', 'SRFI-13'),
    C('string-null?', '(string-null? "")', '#t', 'SRFI-13'),
    C('string-null?', '(string-null? "a")', '#f', 'SRFI-13'),
    C('string-trim', '(string-trim "  a  ")', '"a  "', 'SRFI-13', xfail=ASKALFRED,
      note='SRFI-13 string-trim removes the LEFT end only (string-trim-both does '
           'both). Motoi -> "a", i.e. it trims both ends under the left-trim name'),
    C('string-reverse', '(string-reverse "abc")', '"cba"', 'SRFI-13'),

    # -- 6.6 characters (the -ci and char families are n-ary CORRECT) -------
    C('char<?', '(char<? #\\a #\\b)', '#t', 'R7RS-small 6.6'),
    C('char<?', '(char<? #\\b #\\a)', '#f', 'R7RS-small 6.6'),
    C('char<?', '(char<? #\\A #\\a)', '#t', 'R7RS-small 6.6', note='uppercase sorts first'),
    C('char<?', '(char<? #\\a #\\b #\\c)', '#t', 'R7RS-small 6.6'),
    C('char<?', '(char<? #\\a #\\c #\\b)', '#f', 'R7RS-small 6.6',
      note='n-ary IS correct for chars -- the defect is split, not uniform'),
    C('char=?', '(char=? #\\a #\\a #\\b)', '#f', 'R7RS-small 6.6'),
    C('char>?', '(char>? #\\c #\\b #\\a)', '#t', 'R7RS-small 6.6'),
    C('char<=?', '(char<=? #\\a #\\b #\\a)', '#f', 'R7RS-small 6.6'),
    C('char>=?', '(char>=? #\\c #\\b #\\c)', '#f', 'R7RS-small 6.6'),
    C('char-ci<?', '(char-ci<? #\\A #\\b)', '#t', 'R7RS-small 6.6'),
    C('char-ci<?', '(char-ci<? #\\B #\\a)', '#f', 'R7RS-small 6.6'),
    C('char-ci<?', '(char-ci<? #\\A #\\b #\\C)', '#t', 'R7RS-small 6.6'),
    C('char-ci<?', '(char-ci<? #\\A #\\C #\\b)', '#f', 'R7RS-small 6.6'),
    C('char-ci=?', '(char-ci=? #\\A #\\a)', '#t', 'R7RS-small 6.6'),
    C('char-ci=?', '(char-ci=? #\\A #\\a #\\B)', '#f', 'R7RS-small 6.6'),
    C('char->integer', '(char->integer #\\a)', '97', 'R7RS-small 6.6'),
    C('char->integer', '(char->integer 5)', RAISES, 'R7RS-small 6.6'),
    C('integer->char', '(integer->char 97)', '#\\a', 'R7RS-small 6.6'),
    C('char-upcase', '(char-upcase #\\a)', '#\\A', 'R7RS-small 6.6'),
    C('char-numeric?', '(char-numeric? #\\5)', '#t', 'R7RS-small 6.6'),
    C('char?', '(char? #\\a)', '#t', 'R7RS-small 6.6'),
    C('char?', '(char? "a")', '#f', 'R7RS-small 6.6',
      note='12-char.slat claims #t here; the REFERENCE is wrong, not the engine'),

    # -- 6.8 vectors --------------------------------------------------------
    C('vector-ref', '(vector-ref (vector 1 2 3) 0)', '1', 'R7RS-small 6.8'),
    C('vector-ref', '(vector-ref (vector 1 2 3) 2)', '3', 'R7RS-small 6.8'),
    C('vector-ref', '(vector-ref (vector 1 2 3) 99)', RAISES, 'R7RS-small 6.8',
      xfail=FINDINGS,
      note='Tier 1; the returned non-value is TRUTHY, so (if (number? x) ...) '
           'takes the number branch and the real error surfaces far away'),
    C('vector-ref', '(vector-ref (vector 1 2 3) -1)', RAISES, 'R7RS-small 6.8',
      xfail=NEWFOUND, note='negative index, same bounds hole. Motoi -> no value'),
    C('vector-length', '(vector-length (vector))', '0', 'R7RS-small 6.8'),
    C('vector-length', '(vector-length (vector 1 2 3))', '3', 'R7RS-small 6.8'),
    C('vector-length', '(vector-length 5)', RAISES, 'R7RS-small 6.8', xfail=NEWFOUND,
      note='Motoi -> 0, a plausible-looking lie. Not in the report'),
    C('vector-append', '(vector-append)', '#()', 'R7RS-small 6.8'),
    C('vector-append', '(vector-append (vector 1) (vector 2 3))', '#(1 2 3)',
      'R7RS-small 6.8'),
    C('vector-append', '(vector-append (vector) (vector))', '#()', 'R7RS-small 6.8'),
    C('vector-append', '(vector-append (vector 1 2))', '#(1 2)', 'R7RS-small 6.8'),
    C('vector-append', '(vector-append (vector 1) (list 2 3))', RAISES, 'R7RS-small 6.8',
      xfail=FINDINGS, note='Tier 2; the non-vector argument is silently skipped'),
    C('vector-set!', '(let ((v (vector 1 2 3))) (vector-set! v 0 9) v)', '#(9 2 3)',
      'R7RS-small 6.8'),
    C('vector-set!', '(let ((v (vector 1 2 3))) (vector-set! v 99 9) v)', RAISES,
      'R7RS-small 6.8', xfail=NEWFOUND,
      note='"it is an error if k is not a valid index". Motoi silently GROWS the '
           'vector, leaving a hole-filled sparse array. Not in the report'),
    C('vector-fill!', '(let ((v (vector 1 2 3))) (vector-fill! v 9) v)', '#(9 9 9)',
      'R7RS-small 6.8'),
    C('vector-copy', '(vector-copy (vector 1 2 3) 1)', '#(2 3)', 'R7RS-small 6.8'),
    C('vector-copy!', '(let ((v (vector 1 2 3 4 5))) (vector-copy! v 1 v 0 4) v)',
      '#(1 1 2 3 4)', 'R7RS-small 6.8', xfail=FINDINGS,
      note='Tier 2; "the destination is filled as if by copying to a temporary" -- '
           'a forward loop with no temporary smears on a right shift'),
    C('vector->list', '(vector->list (vector 1 2))', '(1 2)', 'R7RS-small 6.8'),
    C('list->vector', '(list->vector (list 1 2))', '#(1 2)', 'R7RS-small 6.8'),
    C('make-vector', '(make-vector 3 0)', '#(0 0 0)', 'R7RS-small 6.8'),
    C('vector->string', '(vector->string (vector 1 2 3))', RAISES, 'R7RS-small 6.8',
      xfail=FINDINGS, note='Tier 2; the vector must contain CHARACTERS'),
    C('string->vector', '(string->vector "abcdef" -2)', RAISES, 'R7RS-small 6.8',
      xfail=FINDINGS, note='Tier 2; start must satisfy 0 <= start; Motoi treats '
                           'a negative start as an offset from the end'),

    # -- 6.11 exceptions ----------------------------------------------------
    C('guard', "(guard (e (#t (list 'caught e))) (raise 42))", '(caught 42)',
      'R7RS-small 6.11'),
    C('with-exception-handler',
      "(with-exception-handler (lambda (e) 'handled) (lambda () (raise 1)))",
      'handled', 'R7RS-small 6.11'),

    # -- 6.10.3 write / display --------------------------------------------
    C('write', '(write "a\\nb")', '"a\\nb"', 'R7RS-small 6.10.3',
      note='write is machine-readable: the string is quoted and the newline escaped'),
    C('display', '(display #\\a)', 'a', 'R7RS-small 6.10.3',
      note='display is human-readable: no #\\ prefix'),
    C('write', '(write #\\a)', '#\\a', 'R7RS-small 6.10.3'),
    C('write', '(write (list 1 "a" #\\b))', '(1 "a" #\\b)', 'R7RS-small 6.10.3'),

    # -- 6.13 ports ---------------------------------------------------------
    C('read', '(read (open-input-string "(1 2)"))', '(1 2)', 'R7RS-small 6.13.2',
      xfail=FINDINGS, note='Tier 4; read is UNBOUND'),
    C('flush-output-port', '(flush-output-port 5)', RAISES, 'R7RS-small 6.13.3',
      xfail=FINDINGS, note='Tier 4; a bare no-op that ignores its argument'),
    C('input-port-open?',
      '(let ((p (open-input-string "ab")))'
      ' (close-input-port p) (list (input-port-open? p) (read-char p)))',
      RAISES, 'R7RS-small 6.13.1', xfail=FINDINGS,
      note='Tier 4; the predicate says #f but the CLOSED port still reads. '
           'Motoi -> (#f #\\a)'),
    C('output-port-open?',
      '(let ((p (open-output-string)))'
      ' (close-output-port p)'
      ' (list (output-port-open? p) (begin (write-char #\\x p) (get-output-string p))))',
      RAISES, 'R7RS-small 6.13.1', xfail=FINDINGS,
      note='Tier 4; the closed port still WRITES. Motoi -> (#f "x")'),
    C('char-ready?', '(let ((p (open-input-string ""))) (char-ready? p))', '#t',
      'R7RS-small 6.13.2', xfail=FINDINGS,
      note='Tier 4; "if the port is at end of file then char-ready? returns #t". '
           'Motoi -> #f'),
    C('char-ready?', '(let ((p (open-output-string))) (char-ready? p))', RAISES,
      'R7RS-small 6.13.2',
      note='"it is an error if port is not a textual INPUT port" -- so raising '
           'conforms. The findings report lists this under Tier 4, but the '
           'complaint there is message QUALITY (a raw JS "Cannot read properties '
           'of null"), which is not a value-level conformance claim'),
    C('char-ready?', '(char-ready? 5)', RAISES, 'R7RS-small 6.13.2', xfail=FINDINGS,
      note='Tier 4; a non-port answers #t'),
    C('u8-ready?', '(u8-ready? 5)', RAISES, 'R7RS-small 6.13.2', xfail=FINDINGS,
      note='Tier 4; a non-port answers #t'),
    C('read-string', '(let ((p (open-input-string "abc"))) (read-string -1 p))',
      RAISES, 'R7RS-small 6.13.2', xfail=FINDINGS,
      note='Tier 4; k must be a non-negative exact integer. Motoi returns "ab" '
           'AND advances the port'),
    C('write-u8', '(let ((p (open-output-string))) (write-u8 300 p) (get-output-string p))',
      RAISES, 'R7RS-small 6.13.3', xfail=FINDINGS,
      note='Tier 4; 300 is not a byte, and this is a TEXTUAL port. Motoi masks '
           'mod 256 and silently discards'),
    C('get-output-bytevector', '(get-output-bytevector 5)', RAISES, 'R7RS-small 6.13.3',
      xfail=FINDINGS,
      note='Tier 4; a non-port yields #u8(), indistinguishable from an empty sink'),
    C('get-output-bytevector', '(get-output-bytevector (open-output-string))', RAISES,
      'R7RS-small 6.13.3', xfail=FINDINGS,
      note='Tier 4; a TEXTUAL port yields #u8()'),
    C('write-shared',
      '(let ((p (open-output-string))) (write-shared (list 1 2) p) (get-output-string p))',
      '"(1 2)"', 'R7RS-small 6.13.3',
      note='no shared structure here, so labels are not required; the divergence '
           'needs a cycle, and set-cdr! is unbound so one cannot be built'),
    C('write-simple',
      '(let ((p (open-output-string))) (write-simple (list 1 2) p) (get-output-string p))',
      '"(1 2)"', 'R7RS-small 6.13.3', note='vacuously conformant'),
    C('eof-object', '(eof-object? (eof-object))', '#t', 'R7RS-small 6.13.2'),
    C('eof-object', '(eof-object)', '#<eof>', 'R7RS-small 6.13.2', xfail=ASKALFRED,
      note='Motoi prints "[object Object]". 6.13 does not fix an external '
           'representation for the eof object, but a raw JS object cannot be it'),

    # -- Motoi-own (recorded so nobody "conforms" them by mistake) ----------
    C('sort', '(sort (list 3 1 2) <)', '(1 2 3)', 'Motoi-own',
      note='matches no adopted standard: not R7RS, not SRFI-132 (list-sort), '
           'argument order is SRFI-95 but with no vector or key support'),
    C('sort', '(sort (vector 3 1 2) <)', '#(1 2 3)', 'Motoi-own',
      note='FIXED 2026-08-02: sorts vectors and returns a fresh vector. It used '
           'to hand back the vector UNSORTED with no error'),
    C('rationalize', '(rationalize 3 1/10)', '3', 'R7RS-small 6.2.6',
      note='3 is already the simplest rational within 1/10 of 3'),
    C('rationalize', '(rationalize 3/10 1/10)', '1/3', 'R7RS-small 6.2.6',
      xfail=FINDINGS, note='Tier 2; identity stub, any tolerance'),
]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def unescape(s):
    """Single pass. Sequential .replace() calls corrupt a literal backslash-n."""
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '\\' and i + 1 < n:
            nxt = s[i + 1]
            out.append({'n': '\n', 't': '\t', 'r': '\r',
                        '"': '"', '\\': '\\'}.get(nxt, '\\' + nxt))
            i += 2
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def run_case(args):
    """Execute one case. Returns (index, actual, raised)."""
    idx, case = args
    tmp = f'/tmp/motoi-conformance-{os.getpid()}-{idx}.scm'
    with open(tmp, 'w') as f:
        f.write(case.expr)
    try:
        r = subprocess.run([MOTOI_BIN, 'run', tmp], capture_output=True,
                           timeout=20, cwd=ROOT, text=True)
        out = (r.stdout or '').strip()
        err = (r.stderr or '').strip()
        raised = bool(err) or r.returncode != 0
        if raised:
            first = err.splitlines()[0] if err else f'<exit {r.returncode}>'
            actual = re.sub(r'^error:\s*', '', first)
        else:
            actual = out if out else NOVALUE
    except subprocess.TimeoutExpired:
        actual, raised = '<timeout>', False
    except Exception as e:                                   # noqa: BLE001
        actual, raised = f'<exception: {e}>', False
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    return (idx, actual, raised)


def conforms(case, actual, raised):
    if case.expected is RAISES or case.expected == RAISES:
        return raised
    if raised:
        return False
    return actual == case.expected


# Verdict buckets.
PASS = 'PASS'
KNOWN = 'KNOWN'          # xfail as expected -- a documented divergence
FIXED = 'FIXED'          # xfail but it PASSES now -- the manifest is stale
NEW = 'NEW'              # was supposed to conform and does not -- this gates
OPEN = 'OPEN'            # needs-alfred: divergence is real, required value arguable


def verdict(case, ok):
    if case.xfail is None:
        return PASS if ok else NEW
    if case.xfail == ASKALFRED:
        return PASS if ok else OPEN
    return FIXED if ok else KNOWN


def main():
    argv = list(sys.argv[1:])
    only_verb = None
    if '--verb' in argv:
        k = argv.index('--verb')
        if k + 1 >= len(argv):
            print('!! --verb needs a name')
            return 1
        only_verb = argv[k + 1]
        del argv[k:k + 2]
    show_all = '--all' in argv
    strict = '--strict' in argv
    listing = '--list' in argv
    for flag in ('--all', '--strict', '--list'):
        while flag in argv:
            argv.remove(flag)
    if argv:
        print(f'!! unknown arguments: {argv}')
        return 1

    cases = [c for c in CASES if only_verb is None or c.verb == only_verb]
    if not cases:
        known = sorted({c.verb for c in CASES})
        print(f'no cases for verb {only_verb!r}. Known verbs:\n  ' + '  '.join(known))
        return 1

    if listing:
        by_verb = OrderedDict()
        for c in cases:
            by_verb.setdefault(c.verb, []).append(c)
        for verb, group in by_verb.items():
            marks = ''.join('.' if c.xfail is None else
                            'A' if c.xfail == ASKALFRED else
                            'N' if c.xfail == NEWFOUND else 'K' for c in group)
            print(f'{verb:22s} {len(group):3d}  {marks}')
        print(f'\n{len(cases)} cases over {len(by_verb)} verbs '
              f'(. must-pass  K known-from-findings  N known-new  A needs-alfred)')
        return 0

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run_case, list(enumerate(cases))))

    rows = []
    for idx, actual, raised in results:
        case = cases[idx]
        ok = conforms(case, actual, raised)
        shown = f'raises: {actual}' if raised else actual
        rows.append((case, shown, verdict(case, ok)))

    counts = {PASS: 0, KNOWN: 0, FIXED: 0, NEW: 0, OPEN: 0}
    for _, _, v in rows:
        counts[v] += 1

    with open(DUMP, 'w') as f:
        f.write('verdict\tverb\texpression\texpected\tactual\tcitation\tnote\n')
        for case, shown, v in rows:
            f.write(f'{v}\t{case.verb}\t{case.expr}\t{case.expected}\t'
                    f'{shown}\t{case.cite}\t{case.note}\n')

    def report(bucket, heading, blurb):
        group = [r for r in rows if r[2] == bucket]
        if not group:
            return
        print(f'\n{"=" * 74}\n{heading}  ({len(group)})\n{blurb}\n{"=" * 74}')
        by_verb = OrderedDict()
        for case, shown, _ in group:
            by_verb.setdefault(case.verb, []).append((case, shown))
        for verb, items in by_verb.items():
            print(f'\n  {verb}')
            for case, shown in items:
                print(f'    {case.expr}')
                print(f'      expected : {case.expected}')
                print(f'      actual   : {shown}')
                print(f'      citation : {case.cite}')
                if case.note:
                    print(f'      note     : {case.note}')

    report(NEW, 'NEW DIVERGENCE', 'Not in the manifest. This breaks the build.')
    report(FIXED, 'FIXED',
           'Marked as a known divergence but it CONFORMS now. Clear the xfail\n'
           f'and update {FINDINGS_DOC}.')
    report(OPEN, 'NEEDS-ALFRED',
           'A real divergence whose required value is arguable. Never gates.')
    report(KNOWN, 'KNOWN DIVERGENCE',
           'Documented. Does not gate. Sourced from the findings report or from\n'
           "this gate's own first measuring pass.")
    if show_all:
        report(PASS, 'CONFORMING', 'Locked in. A regression here becomes NEW.')

    known_src = OrderedDict()
    for case, _, v in rows:
        if v == KNOWN:
            known_src[case.xfail] = known_src.get(case.xfail, 0) + 1

    print(f'\n{"=" * 74}')
    print(f'cases run           : {len(rows)}')
    print(f'  PASS (conforming) : {counts[PASS]}')
    print(f'  KNOWN divergence  : {counts[KNOWN]}'
          + (f'   ({", ".join(f"{k}={v}" for k, v in known_src.items())})'
             if known_src else ''))
    print(f'  FIXED (stale mark): {counts[FIXED]}')
    print(f'  NEEDS-ALFRED      : {counts[OPEN]}')
    print(f'  NEW divergence    : {counts[NEW]}')
    print(f'full table          : {DUMP}')

    gate = counts[NEW] + (counts[FIXED] if strict else 0)
    print(f'exit code           : {min(gate, 250)}'
          + ('  (--strict: FIXED counts too)' if strict else ''))
    return min(gate, 250)


if __name__ == '__main__':
    sys.exit(main())
