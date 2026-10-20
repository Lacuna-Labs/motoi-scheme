#!/usr/bin/env python3
"""rewrite-bug-records.py — retire eleven reference records that teach fixed bugs.

Eight of these documented real defects: `(= 1 1 2)` answering #t, `(log 8 2)`
dropping its base, `(exact-integer-sqrt 17)` leaking `[object Object]`,
`(number->string 1/3)` answering NaN. Three explained why an integer-valued
double printed without its `.0`. All eleven are now false — the n-ary
comparisons, the two-argument log, the Values printer and the exactness tower
landed — so each is replaced with the lesson that is still true.

A splice cannot do this: the `'BUG-should-be-#f` symbol is in the CODE, not
just the note. Both sides are rewritten together. Exact-match only; a record
that has drifted is reported, never guessed at.
"""

import sys

PATH = '/Users/alfred/code/motoi-scheme/scheme/reference/40-math.slat'

CHAIN = ("(define (chain op xs)\\n  (or (null? xs) (null? (cdr xs))\\n"
         "      (and (op (car xs) (cadr xs)) (chain op (cdr xs)))))\\n")

PAIRS = [
    # ── = ────────────────────────────────────────────────────────────────
    ('"(define (all-equal? xs)\\n  (or (null? xs) (null? (cdr xs))\\n'
     "      (and (= (car xs) (cadr xs)) (all-equal? (cdr xs)))))\\n"
     "(display (list 'motoi-3arg (= 1 1 2) 'BUG-should-be-#f\\n"
     "               'safe (all-equal? '(1 1 2)) 'safe-true (all-equal? '(4 4 4))))\\n"
     '(newline)" :note "(motoi-3arg #t BUG-should-be-#f safe #f safe-true #t) -- '
     'the three-argument call is wrong and the hand-written chain is right."',

     '"(define (all-equal? xs)\\n  (or (null? xs) (null? (cdr xs))\\n'
     "      (and (= (car xs) (cadr xs)) (all-equal? (cdr xs)))))\\n"
     "(display (list 'three-arg (= 1 1 2) 'all-three (= 4 4 4)\\n"
     "               'from-a-list (all-equal? '(1 1 2)) 'list-true (all-equal? '(4 4 4))))\\n"
     '(newline)" :note "(three-arg #f all-three #t from-a-list #f list-true #t) -- '
     '= takes any number of arguments and answers #t only when EVERY neighbouring '
     'pair matches, so (= 1 1 2) is #f. What it cannot take is a list: all-equal? '
     'is what you write when the count is not known until the program runs."'),

    # ── < ────────────────────────────────────────────────────────────────
    ('"' + CHAIN +
     "(display (list 'motoi-3arg (< 1 3 2) 'BUG-should-be-#f\\n"
     "               'safe (chain < '(1 3 2)) 'sorted (chain < '(1 2 3))))\\n"
     '(newline)" :note "(motoi-3arg #t BUG-should-be-#f safe #f sorted #t) -- '
     'the built-in three-argument call is wrong; the chain helper is right and '
     'works for any length."',

     '"' + CHAIN +
     "(display (list 'three-arg (< 1 3 2) 'sorted (< 1 2 3)\\n"
     "               'from-a-list (chain < '(1 3 2)) 'list-sorted (chain < '(1 2 3))))\\n"
     '(newline)" :note "(three-arg #f sorted #t from-a-list #f list-sorted #t) -- '
     '(< 1 2 3) asks whether the arguments are in strictly increasing order, so it '
     'is a sortedness test for a FIXED number of values. chain does the same job '
     'for a list whose length is only known at run time."'),

    # ── > ────────────────────────────────────────────────────────────────
    ('"' + CHAIN +
     "(display (list 'motoi-3arg (> 3 1 2) 'BUG-should-be-#f\\n"
     "               'safe (chain > '(3 1 2)) 'descending (chain > '(3 2 1))))\\n"
     '(newline)" :note "(motoi-3arg #t BUG-should-be-#f safe #f descending #t) -- '
     'the built-in three-argument call is wrong; the chain helper is right."',

     '"' + CHAIN +
     "(display (list 'three-arg (> 3 1 2) 'descending (> 3 2 1)\\n"
     "               'from-a-list (chain > '(3 1 2)) 'list-descending (chain > '(3 2 1))))\\n"
     '(newline)" :note "(three-arg #f descending #t from-a-list #f list-descending #t) '
     '-- (> 3 2 1) is #t because each argument is greater than the one after it. '
     '(> 3 1 2) breaks that at the second step, so it is #f. chain is the same test '
     'over a list."'),

    # ── <= ───────────────────────────────────────────────────────────────
    ('"(define (in-range? lo x hi) (and (<= lo x) (<= x hi)))\\n'
     "(display (list 'motoi-3arg (<= 5 12 10) 'BUG-should-be-#f\\n"
     "               'guarded (in-range? 5 12 10)\\n"
     "               'inside (in-range? 5 7 10)\\n"
     "               'edges (list (in-range? 5 5 10) (in-range? 5 10 10))))\\n"
     '(newline)" :note "(motoi-3arg #t BUG-should-be-#f guarded #f inside #t edges '
     '(#t #t)) -- the natural three-argument range check is wrong; the two-comparison '
     'version is right and includes both endpoints."',

     '"(define (in-range? lo x hi) (and (<= lo x) (<= x hi)))\\n'
     "(display (list 'three-arg (<= 5 12 10) 'inside (<= 5 7 10)\\n"
     "               'named (in-range? 5 12 10)\\n"
     "               'edges (list (in-range? 5 5 10) (in-range? 5 10 10))))\\n"
     '(newline)" :note "(three-arg #f inside #t named #f edges (#t #t)) -- '
     '(<= lo x hi) IS the range check: it reads left to right as lo <= x and x <= hi. '
     'in-range? spells out the same two comparisons when you want a name for the idea. '
     'Both include the endpoints, which is what the edges pair shows."'),

    # ── >= ───────────────────────────────────────────────────────────────
    ('"' + CHAIN +
     "(display (list 'motoi-3arg (>= 12 5 10) 'BUG-should-be-#f\\n"
     "               'safe (chain >= '(12 5 10))\\n"
     "               'nonincreasing (chain >= '(9 5 5 1))))\\n"
     '(newline)" :note "(motoi-3arg #t BUG-should-be-#f safe #f nonincreasing #t) -- '
     'the built-in three-argument call is wrong; the chain helper is right and accepts '
     'equal neighbours."',

     '"' + CHAIN +
     "(display (list 'three-arg (>= 12 5 10) 'nonincreasing (>= 9 5 5 1)\\n"
     "               'from-a-list (chain >= '(12 5 10))\\n"
     "               'list-nonincreasing (chain >= '(9 5 5 1))))\\n"
     '(newline)" :note "(three-arg #f nonincreasing #t from-a-list #f '
     'list-nonincreasing #t) -- >= allows equal neighbours, so (>= 9 5 5 1) is #t even '
     'with the repeated 5. (>= 12 5 10) is #f because 5 is not >= 10. chain applies the '
     'same rule to a list."'),

    # ── log ──────────────────────────────────────────────────────────────
    ('"(display (list \'two-arg-IGNORES-BASE (log 8 2)\\n'
     "               'change-of-base (/ (log 8) (log 2))\\n"
     "               'motoi-verb (math/log-base 8 2)))\\n"
     '(newline)" :note "(two-arg-IGNORES-BASE 2.0794415416798357 change-of-base 3 '
     'motoi-verb 3) -- the second argument to log is silently dropped. Use the '
     'change-of-base quotient or math/log-base."',

     '"(display (list \'two-arg (log 8 2)\\n'
     "               'change-of-base (/ (log 8) (log 2))\\n"
     "               'motoi-verb (math/log-base 8 2)))\\n"
     '(newline)" :note "(two-arg 3.0 change-of-base 3.0 motoi-verb 3) -- the optional '
     'second argument to log is the BASE, and (log 8 2) computes exactly the '
     'change-of-base quotient shown beside it. Both are inexact, because a logarithm '
     'is. math/log-base is the Motoi-named sibling and rounds to the exact 3 when the '
     'base divides evenly."'),

    # ── exact-integer-sqrt ───────────────────────────────────────────────
    ('"(define (pair n) (call-with-values (lambda () (exact-integer-sqrt n)) list))\\n'
     "(define (perfect-square? n) (= 0 (cadr (pair n))))\\n"
     "(display (list 'WRONG-display (exact-integer-sqrt 17)\\n"
     "               'unpacked (pair 17)\\n"
     "               'squares (filter perfect-square? '(1 2 3 4 5 9 10 16 17 25))))\\n"
     '(newline)" :note "(WRONG-display [object Object] unpacked (4 1) squares '
     '(1 4 9 16 25)) -- displaying the two values directly leaks an internal object. '
     'Unpack them first."',

     '"(define (pair n) (call-with-values (lambda () (exact-integer-sqrt n)) list))\\n'
     "(define (perfect-square? n) (= 0 (cadr (pair n))))\\n"
     "(display (list 'unpacked (pair 17)\\n"
     "               'root (car (pair 17)) 'left-over (cadr (pair 17))\\n"
     "               'squares (filter perfect-square? '(1 2 3 4 5 9 10 16 17 25))))\\n"
     '(newline)" :note "(unpacked (4 1) root 4 left-over 1 squares (1 4 9 16 25)) -- '
     'exact-integer-sqrt returns TWO values, not a list: the whole-number root and what '
     'is left over. call-with-values is how you catch both. 17 is 4 squared plus 1, so '
     'a left-over of 0 is exactly the test for a perfect square."'),

    # ── number->string ───────────────────────────────────────────────────
    ("'hex (hex-label 255) 'BUG (number->string 1/3) 'safe (num->str 1/3)))\\n"
     '(newline)" :note "(hex 0xff BUG NaN safe 1/3) -- the direct call on an exact '
     'rational answers NaN. num->str builds the text from numerator and denominator '
     'instead."',

     "'hex (hex-label 255) 'rational (number->string 1/3) 'by-hand (num->str 1/3)))\\n"
     '(newline)" :note "(hex 0xff rational 1/3 by-hand 1/3) -- number->string writes an '
     'exact rational as numerator/denominator, so the hand-built num->str agrees with it '
     'exactly. The radix argument applies to integers; 2, 8, 10 and 16 are the bases it '
     'accepts."'),

    # ── inexact / truncate: the printing divergence is gone ──────────────
    ('"(inexact 1)" :note "1 — Motoi answers 1, not 1.0. Its numeric tower is exact '
     'integers, exact rationals, and JavaScript doubles, and a double that happens to be '
     'integer-valued prints without a trailing .0. R7RS §6.2 would show 1.0; this is a '
     'known representation divergence, not a claim that the result is exact."',

     '"(inexact 1)" :note "1.0 — the inexact image of the exact 1. The trailing .0 is '
     'not decoration: it is how the printer says INEXACT, and it is what makes the value '
     'read back as a double rather than as the exact 1. (exact? (inexact 1)) is #f."'),

    ('"(truncate 3.7)" :note "3 — toward zero. R7RS §6.2.6 would show 3.0, because '
     'truncate preserves exactness; Motoi prints integer-valued doubles without the '
     'trailing .0. Known representation divergence."',

     '"(truncate 3.7)" :note "3.0 — toward zero. §6.2.6 says truncate PRESERVES '
     'exactness, so an inexact argument gives an inexact answer: 3.0, not 3. Use '
     '(exact (truncate 3.7)) when you want the exact integer."'),

    ('"(truncate -3.7)" :note "-3 — toward zero, NOT down: floor would give -4. Printed '
     'without the trailing .0, as above."',

     '"(truncate -3.7)" :note "-3.0 — toward zero, NOT down: (floor -3.7) is -4.0. '
     'Inexact in, inexact out, as above."'),
]


def main():
    text = open(PATH).read()
    ok = 0
    for old, new in PAIRS:
        if text.count(old) != 1:
            print(f'[DRIFTED — not applied] {text.count(old)} matches for: {old[:70]}…')
            continue
        text = text.replace(old, new)
        ok += 1
    if '--write' in sys.argv:
        open(PATH, 'w').write(text)
    print(f'{ok}/{len(PAIRS)} rewritten · {"WRITTEN" if "--write" in sys.argv else "DRY RUN"}')
    return len(PAIRS) - ok


if __name__ == '__main__':
    sys.exit(main())
