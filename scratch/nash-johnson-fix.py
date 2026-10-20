#!/usr/bin/env python3
"""Rewrite the ops/johnson snippets in 47-ops.slat.

Two independent defects were entangled here:

  1. ops/johnson only implemented the parallel-list form from its :signature,
     so every documented call — all of which pass a single job alist — got the
     empty list back. Fixed in lib/system/ops.js (the reference wins).

  2. Every snippet then piped that sequence through
     `(ops/sequence-metrics seq 'processing)` and read `(car (assoc 'makespan m))`.
     ops/sequence-metrics' own record says it takes single-machine `(p d)` tasks
     and returns the POSITIONAL triple `(makespan total-flow max-lateness)`, so
     `assoc` returned #f and `car` blew up. It is also the wrong instrument:
     Johnson's rule optimises the TWO-MACHINE flow-shop makespan, which
     ops/sequence-metrics does not compute. The snippets now compute that
     makespan directly — c1 += t1; c2 = max(c2, c1) + t2 — which is the
     quantity the :claim and :invariant actually talk about.

Every value written into a :note below was read off `./bin/motoi run`.
"""
import sys

P = 'scheme/reference/47-ops.slat'
s = open(P).read()

MK = ("(define (makespan-of jobs order)\\n"
      "  (let loop ((seq order) (c1 0) (c2 0))\\n"
      "    (if (null? seq)\\n"
      "      c2\\n"
      "      (let* ((j (cdr (assoc (car seq) jobs)))\\n"
      "             (f1 (+ c1 (cdr (assoc 'm1 j)))))\\n"
      "        (loop (cdr seq) f1 (+ (max c2 f1) (cdr (assoc 'm2 j))))))))\\n")

subs = []

# ── :examples novice ────────────────────────────────────────────────────
# The stray 'preprocessing argument is documented nowhere. And the claimed
# order was wrong: j3 has m1=5 > m2=2, so it belongs to the SECOND set, not
# the first. Verified: (j1 j2 j3), makespan 18; the note's (j1 j3 j2) is 20.
subs.append((
    ':code "(ops/johnson \'((j1 . ((m1 . 3) (m2 . 6)))\\n               (j2 . ((m1 . 8) (m2 . 4)))\\n               (j3 . ((m1 . 5) (m2 . 2))))\\n            \'preprocessing)" '
    ':note "Johnson\'s rule partitions into {j1, j3} (short on m1) and {j2} (short on m2); returns optimal sequence j1, j3, j2")',
    ':code "(ops/johnson \'((j1 . ((m1 . 3) (m2 . 6)))\\n               (j2 . ((m1 . 8) (m2 . 4)))\\n               (j3 . ((m1 . 5) (m2 . 2)))))" '
    ':note "j1 is shorter on m1 (3 < 6) so it heads the sequence; j2 and j3 are shorter on m2 so they tail it, in DESCENDING m2 order (j2 at 4, then j3 at 2). Returns (j1 j2 j3), makespan 18 — the order (j1 j3 j2) costs 20.")'))

# ── :examples intermediate ──────────────────────────────────────────────
subs.append((
    ':code "(let* ((jobs \'((task-a . ((m1 . 2) (m2 . 8)))\\n               (task-b . ((m1 . 5) (m2 . 3)))\\n               (task-c . ((m1 . 7) (m2 . 4)))\\n               (task-d . ((m1 . 1) (m2 . 9)))))\\n       (order (ops/johnson jobs))\\n       (metrics (ops/sequence-metrics order \'processing)))\\n  (list \'johnson-sequence order \'makespan (car (assoc \'makespan metrics))))" '
    ':note "Computes Johnson sequence and immediately verifies makespan via ops/sequence-metrics")',
    ':code "' + MK +
    '(let* ((jobs \'((task-a . ((m1 . 2) (m2 . 8)))\\n               (task-b . ((m1 . 5) (m2 . 3)))\\n               (task-c . ((m1 . 7) (m2 . 4)))\\n               (task-d . ((m1 . 1) (m2 . 9)))))\\n       (order (ops/johnson jobs)))\\n  (list \'johnson-sequence order \'makespan (makespan-of jobs order)))" '
    ':note "Johnson order is (task-d task-a task-c task-b), makespan 25. makespan-of walks the two machines: machine 1 finishes job i at c1, machine 2 cannot start it before max(c2, c1), so c2 = max(c2, c1) + t2. Note this is NOT ops/sequence-metrics, which is a single-machine evaluator.")'))

# ── :examples expert ────────────────────────────────────────────────────
subs.append((
    ':code "(define my-job-list \'my-job-list)\\n(define (flow-shop-analysis jobs)\\n  (let* ((johnson-seq (ops/johnson jobs))\\n         (johnson-metrics (ops/sequence-metrics johnson-seq \'processing))\\n         (spt-seq (ops/spt jobs))\\n         (spt-metrics (ops/sequence-metrics spt-seq \'processing)))\\n    (list \'johnson-makespan (car (assoc \'makespan johnson-metrics))\\n          \'spt-makespan (car (assoc \'makespan spt-metrics))\\n          \'winner (if (< (car (assoc \'makespan johnson-metrics))\\n                        (car (assoc \'makespan spt-metrics)))\\n                     \'johnson\\n                     \'spt))))\\n  (flow-shop-analysis my-job-list)" '
    ':note "Compares Johnson\'s rule (optimal for 2 machines) with SPT heuristic; Johnson dominates when applicable")',
    ':code "(define my-job-list \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4))) (c . ((m1 . 5) (m2 . 2)))))\\n' + MK +
    '(define (flow-shop-analysis jobs)\\n'
    '  (let* ((johnson-seq (ops/johnson jobs))\\n'
    '         (spt-seq (map car (sort jobs (lambda (x y)\\n'
    '                                        (< (cdr (assoc \'m1 (cdr x)))\\n'
    '                                           (cdr (assoc \'m1 (cdr y))))))))\\n'
    '         (j-mk (makespan-of jobs johnson-seq))\\n'
    '         (s-mk (makespan-of jobs spt-seq)))\\n'
    '    (list \'johnson-makespan j-mk\\n'
    '          \'spt-makespan s-mk\\n'
    '          \'winner (if (<= j-mk s-mk) \'johnson \'spt))))\\n'
    '(flow-shop-analysis my-job-list)" '
    ':note "Johnson gives (a b c) at makespan 18; SPT-on-machine-1 gives (a c b) at 20, so Johnson wins. SPT is spelled out here rather than calling ops/spt, because ops/spt sorts on a task\'s FIRST element and the first element of a job entry is its id, not a time.")'))

# ── row-2 :eng-program ──────────────────────────────────────────────────
subs.append((
    ':eng-program "(let* ((jobs \'((cut . ((m1 . 3) (m2 . 6)))\\n               (fold . ((m1 . 8) (m2 . 4)))\\n               (pack . ((m1 . 5) (m2 . 2)))))\\n       (seq (ops/johnson jobs))\\n       (mk (car (assoc \'makespan (ops/sequence-metrics seq \'processing)))))\\n  (list \'sequence seq \'makespan mk))"',
    ':eng-program "' + MK +
    '(let* ((jobs \'((cut . ((m1 . 3) (m2 . 6)))\\n               (fold . ((m1 . 8) (m2 . 4)))\\n               (pack . ((m1 . 5) (m2 . 2)))))\\n       (seq (ops/johnson jobs)))\\n  (list \'sequence seq \'makespan (makespan-of jobs seq)))"'))

# ── row-4 :eng-program ──────────────────────────────────────────────────
subs.append((
    ':eng-program "(let* ((jobs \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4))) (c . ((m1 . 5) (m2 . 2)))))\\n       (johnson-mk (car (assoc \'makespan (ops/sequence-metrics (ops/johnson jobs) \'processing))))\\n       (spt-mk (car (assoc \'makespan (ops/sequence-metrics (ops/spt jobs) \'processing)))))\\n  (<= johnson-mk spt-mk))"',
    ':eng-program "' + MK +
    '(let* ((jobs \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4))) (c . ((m1 . 5) (m2 . 2)))))\\n'
    '       (spt-seq (map car (sort jobs (lambda (x y)\\n'
    '                                      (< (cdr (assoc \'m1 (cdr x)))\\n'
    '                                         (cdr (assoc \'m1 (cdr y))))))))\\n'
    '       (johnson-mk (makespan-of jobs (ops/johnson jobs)))\\n'
    '       (spt-mk (makespan-of jobs spt-seq)))\\n'
    '  (<= johnson-mk spt-mk))"'))

# ── row-4 :cs-program ───────────────────────────────────────────────────
subs.append((
    ':cs-program "(define (johnson-optimal? jobs heuristic-seq)\\n  (let ((j-mk (car (assoc \'makespan (ops/sequence-metrics (ops/johnson jobs) \'processing))))\\n        (h-mk (car (assoc \'makespan (ops/sequence-metrics heuristic-seq \'processing)))))\\n    (<= j-mk h-mk)))\\n(johnson-optimal? \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4)))) \'(b a))"',
    ':cs-program "' + MK +
    '(define (johnson-optimal? jobs heuristic-seq)\\n'
    '  (<= (makespan-of jobs (ops/johnson jobs))\\n'
    '      (makespan-of jobs heuristic-seq)))\\n'
    '(johnson-optimal? \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4)))) \'(b a))"'))

# ── row-5 :eng-composition ──────────────────────────────────────────────
subs.append((
    ':eng-composition "(define jobs \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4)))))\\n(define seq (ops/johnson jobs))\\n(ops/sequence-metrics seq \'processing)"',
    ':eng-composition "' + MK +
    '(define jobs \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4)))))\\n'
    '(define seq (ops/johnson jobs))\\n'
    '(list \'sequence seq \'makespan (makespan-of jobs seq))"'))

# ── row-5 :cs-composition ───────────────────────────────────────────────
subs.append((
    ':cs-composition "(define (schedule-and-report jobs)\\n  (let* ((seq (ops/johnson jobs))\\n         (m (ops/sequence-metrics seq \'processing)))\\n    (list \'order seq \'makespan (car (assoc \'makespan m)))))\\n(map schedule-and-report (list \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4))))))"',
    ':cs-composition "' + MK +
    '(define (schedule-and-report jobs)\\n'
    '  (let ((seq (ops/johnson jobs)))\\n'
    '    (list \'order seq \'makespan (makespan-of jobs seq))))\\n'
    '(map schedule-and-report (list \'((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4))))))"'))

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
