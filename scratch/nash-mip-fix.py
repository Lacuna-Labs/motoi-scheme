#!/usr/bin/env python3
"""Rewrite the two broken ops/mip-solve examples in 47-ops.slat.

Both were malformed against the verb's own signature:

  * intermediate — `facility-assign` was DEFINED with three parameters
    (costs demands fixed-cost) and CALLED with two. That was only a latent
    text bug until R7RS arity checking landed. Supplying the third argument
    is not enough: the constraint rows impose no lower bound of any kind, so
    a minimisation over non-negative variables is optimal at all-zero and the
    :note's "size them to meet demand" describes nothing the snippet does.

  * expert — built the objective by multiplying a cost by `(list ':int 0 100)`,
    i.e. a variable DESCRIPTOR rather than a coefficient, so it died in `*`.
    It also hand-defined `fold-left` (R6RS/Racket, excluded by the locked
    standard) and shadowed SRFI-1 `iota`.

Both are re-posed in the standard form ops/simplex actually documents
(Ax <= b, x >= 0) and every value in the notes was read off ./bin/motoi run.
"""
import sys

P = 'scheme/reference/47-ops.slat'
s = open(P).read()

subs = []

# ── :examples intermediate ──────────────────────────────────────────────
subs.append((
    ':code "(define (facility-assign costs demands fixed-cost)\\n  (ops/mip-solve\\n    (append\\n      (map (lambda (d) (list 1 \'<= d)) demands)  ; demand constraints\\n      (list (list -100 -100 \'<= 0)))              ; capacity slack\\n    (map (lambda (c) (+ c fixed-cost)) costs)    ; total cost\\n    (list \':integers (list 0 1) \':min? #t)))\\n(facility-assign (list 50 60) (list 10 15))" '
    ':note "Facility location: decide which depots to open (binary 0/1) and size them to meet demand at minimum cost.")',

    ':code "(define (facility-select fixed-costs coverage budget)\\n'
    '  (ops/mip-solve\\n'
    '    (cons (append fixed-costs (list \'<= budget))          ; total spend <= budget\\n'
    '          (map (lambda (i)                                 ; each depot is 0/1\\n'
    '                 (append (map (lambda (j) (if (= i j) 1 0)) (iota (length coverage)))\\n'
    '                         (list \'<= 1)))\\n'
    '               (iota (length coverage))))\\n'
    '    coverage                                               ; maximize demand covered\\n'
    '    (list \':integers (iota (length coverage)))))\\n'
    '(facility-select (list 50 80 35) (list 40 60 30) 120)" '
    ':note "Facility location posed as a 0/1 selection: one row caps total fixed cost at the budget, one row per depot caps it at 1, and the objective is demand covered. Returns (0 1 1) — open depots 2 and 3, spending 115 of 120 to cover 90. Opening depot 1 instead of depot 2 is cheaper (85) but covers only 70. Every row is written <= with a non-negative right-hand side because ops/simplex has no phase 1; see the caveats.")'))

# ── :examples expert ────────────────────────────────────────────────────
subs.append((
    ':code "(define (fold-left f init xs)\\n  (let loop ((xs xs) (acc init))\\n    (if (null? xs) acc (loop (cdr xs) (f acc (car xs))))))\\n(define (iota n)\\n  (let loop ((i 0) (acc \'()))\\n    (if (= i n) (reverse acc) (loop (+ i 1) (cons i acc)))))\\n(define (production-schedule demand unit-cost holding-cost initial)\\n  (let* ((periods (length demand))\\n         (produce (map (lambda (i) (list \':int 0 100)) (iota periods)))\\n         (inventory (cons initial (map (lambda (i) 0) (iota periods)))))\\n    (ops/mip-solve\\n      (map (lambda (t)\\n             (list 1 1 \'= (list-ref demand t)))  ; balance: inventory(t-1) + produce(t) = demand(t) + inventory(t)\\n             (iota periods))\\n      (fold-left (lambda (cost t)\\n                   (+ cost\\n                      (* unit-cost (list-ref produce t))\\n                      (* holding-cost (list-ref inventory (+ t 1)))))\\n                 0 (iota periods))\\n      (list \':integers (list-ref produce 0) \':min? #t))))\\n(production-schedule (list 10 20 15) 5 2 0)"',

    ':code "(define (cumulative xs)\\n'
    '  (let loop ((rest xs) (run 0) (acc \'()))\\n'
    '    (if (null? rest)\\n'
    '      (reverse acc)\\n'
    '      (loop (cdr rest) (+ run (car rest)) (cons (+ run (car rest)) acc)))))\\n'
    '(define (production-plan demand cap unit-cost holding-cost)\\n'
    '  ;; Decide on IDLE capacity u(t) = cap - produce(t). That turns each\\n'
    '  ;; \\"cumulative production >= cumulative demand\\" row into a <= row with a\\n'
    '  ;; non-negative right-hand side, which is the only form ops/simplex takes.\\n'
    '  (let* ((n (length demand))\\n'
    '         (cum (cumulative demand))\\n'
    '         (rows (map (lambda (t)\\n'
    '                      (append (map (lambda (i) (if (<= i t) 1 0)) (iota n))\\n'
    '                              (list \'<= (- (* cap (+ t 1)) (list-ref cum t)))))\\n'
    '                    (iota n)))\\n'
    '         (obj (map (lambda (t) (+ unit-cost (* holding-cost (- n t)))) (iota n)))\\n'
    '         (idle (ops/mip-solve rows obj (list \':integers (iota n)))))\\n'
    '    (if (pair? idle)\\n'
    '      (list \'produce (map (lambda (u) (- cap u)) idle))\\n'
    '      (list \'no-plan idle))))\\n'
    '(production-plan (list 10 20 15) 25 5 2)" '
    ':note "Multi-period production: integer batch sizes that meet demand at least cost. A unit made in period t costs unit-cost and is then held for (n - t) periods, so its coefficient in total cost is unit-cost + holding-cost*(n - t) — 11, 9, 7 here. Minimising that over production is maximising it over idle capacity, which is what is actually handed to the solver. Returns (produce (10 20 15)): make each period exactly what it owes, 45 units at 5 = 225 with no holding cost.")'))

# ── :caveats — record the standard-form restriction the solver enforces ──
subs.append((
    ':caveats ("Requires some variables to be declared integer; unmarked variables stay continuous."',
    ':caveats ("Constraint rows must be in standard form: <= with a non-negative right-hand side. ops/simplex has no phase 1, so a >= row (negated to <=) or an = row (split into two <=) yields a negative right-hand side and the node is discarded; reformulate such problems, as the expert example does." "Requires some variables to be declared integer; unmarked variables stay continuous."'))

bad = 0
for a, b in subs:
    n = s.count(a)
    print(n, a[:70].replace('\\n', '~'))
    if n != 1:
        bad += 1
        continue
    s = s.replace(a, b)
if bad:
    print(f'!! {bad} patterns did not match exactly once — nothing written')
    sys.exit(1)
open(P, 'w').write(s)
print('written')
