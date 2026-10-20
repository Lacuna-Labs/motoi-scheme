#!/usr/bin/env python3
"""gen.py — author the 4 SRFI-27 reference records for scheme/reference/01-core.slat.

Holds every program as a raw Python string so escaping into SLAT is done once,
mechanically, and correctly. Verifies every program RUNS and is DETERMINISTIC
(same stdout on two runs) before emitting. Emits to records.slat for append.
"""
import json, subprocess, sys, os

REPO = '/Users/alfred/code/motoi-scheme'
MOTOI = os.path.join(REPO, 'bin', 'motoi')
TMP = '/tmp/bezier-srfi27-check.scm'

PROGRAMS = {}   # label -> source, filled as records are built


def P(label, src):
    """Register a program under a unique label and return it."""
    assert label not in PROGRAMS, f'duplicate label {label}'
    PROGRAMS[label] = src
    return src


def esc(s):
    """Escape a string into a SLAT double-quoted string body.

    ensure_ascii=False so em-dashes, ellipses and math symbols land as literal
    UTF-8, matching every other record in the reference.
    """
    return json.dumps(s, ensure_ascii=False)[1:-1]


# ═══════════════════════════════════════════════════════════════════════
# random-integer
# ═══════════════════════════════════════════════════════════════════════

RI = {}
RI['ex-novice'] = P('ri-ex-novice', """(display (with-seed 42 (lambda () (random-integer 6))))
(newline)""")

RI['ex-inter'] = P('ri-ex-inter', """(define (roll-three) (list (random-integer 6) (random-integer 6) (random-integer 6)))
(display (with-seed 7 roll-three))
(newline)
(display (equal? (with-seed 7 roll-three) (with-seed 7 roll-three)))
(newline)""")

RI['ex-expert'] = P('ri-ex-expert', """(define (draws n bound) (map (lambda (_) (random-integer bound)) (iota n)))
(define sample (with-seed 99 (lambda () (draws 200 6))))
(display (list 'count (length sample)
               'all-in-range? (fold (lambda (x acc) (and acc (>= x 0) (< x 6))) #t sample)
               'replays? (equal? sample (with-seed 99 (lambda () (draws 200 6))))))
(newline)""")

RI['r2-eng'] = P('ri-r2-eng', """(define (roll-dice n) (map (lambda (_) (+ 1 (random-integer 6))) (iota n)))
(define run-a (with-seed 2026 (lambda () (roll-dice 5))))
(define run-b (with-seed 2026 (lambda () (roll-dice 5))))
(display (list 'rolled run-a 'replays? (equal? run-a run-b)))
(newline)""")

RI['r2-math'] = P('ri-r2-math', """(define (mean xs) (/ (apply + xs) (length xs)))
(define m (with-seed 1234 (lambda () (mean (map (lambda (_) (random-integer 10)) (iota 4000))))))
(display (list 'expected 4.5 'mean-within-0.3? (< (abs (- m 4.5)) 0.3)))
(newline)""")

RI['r2-cs'] = P('ri-r2-cs', """(define (integer-then-int) (list (random-integer 1000) (random-int 1000)))
(define (int-then-integer) (list (random-int 1000) (random-integer 1000)))
(display (list 'a (with-seed 9 integer-then-int)
               'b (with-seed 9 int-then-integer)
               'one-shared-stream? (equal? (with-seed 9 integer-then-int) (with-seed 9 int-then-integer))))
(newline)""")

RI['r3-a'] = P('ri-r3-a', """(display (with-seed 5 (lambda () (random-integer 100))))
(newline)""")

RI['r3-b'] = P('ri-r3-b', """(define (cup faces n) (map (lambda (_) (+ 1 (random-integer faces))) (iota n)))
(display (with-seed 3 (lambda () (cup 6 5))))
(newline)""")

RI['r3-c'] = P('ri-r3-c', """(define (histogram n trials)
  (let ((counts (make-vector n 0)))
    (for-each (lambda (_)
                (let ((k (random-integer n)))
                  (vector-set! counts k (+ 1 (vector-ref counts k)))))
              (iota trials))
    (vector->list counts)))
(define h (with-seed 8 (lambda () (histogram 6 3000))))
(display (list 'total (apply + h)
               'every-face-near-500? (fold (lambda (c acc) (and acc (> c 400) (< c 600))) #t h)))
(newline)""")

RI['r4-eng'] = P('ri-r4-eng', """(define (ten) (map (lambda (_) (random-integer 100)) (iota 10)))
(define first-run (with-seed 4242 ten))
(define second-run (with-seed 4242 ten))
(display (list 'run first-run 'identical? (equal? first-run second-run)))
(newline)""")

RI['r4-math'] = P('ri-r4-math', """(define (in-range-for? bound trials)
  (fold (lambda (_ acc)
          (let ((x (random-integer bound)))
            (and acc (>= x 0) (< x bound))))
        #t (iota trials)))
(display (with-seed 77 (lambda () (map (lambda (b) (in-range-for? b 300)) (list 2 6 10 52 1000)))))
(newline)""")

RI['r4-cs'] = P('ri-r4-cs', """(define outer (with-seed 2 (lambda () (list (random-integer 100) (random-integer 100)))))
(define nested (with-seed 2 (lambda ()
  (let ((a (random-integer 100)))
    (let ((inner (with-seed 2 (lambda () (random-integer 100)))))
      (list a inner (random-integer 100)))))))
(display (list 'outer outer
               'nested nested
               'outer-stream-restored? (equal? outer (list (car nested) (caddr nested)))))
(newline)""")

RI['r5-eng'] = P('ri-r5-eng', """(define (scatter n w h) (map (lambda (_) (list (random-integer w) (random-integer h))) (iota n)))
(define level (with-seed 1848 (lambda () (scatter 6 22 13))))
(display (list 'layout level
               'same-level-next-launch? (equal? level (with-seed 1848 (lambda () (scatter 6 22 13))))))
(newline)""")

RI['r5-math'] = P('ri-r5-math', """(define (walk steps)
  (let loop ((i 0) (pos 0))
    (if (>= i steps) pos (loop (+ i 1) (+ pos (- (random-integer 3) 1))))))
(display (list 'endpoint (with-seed 31 (lambda () (walk 500)))
               'same-path-twice? (= (with-seed 31 (lambda () (walk 500)))
                                    (with-seed 31 (lambda () (walk 500))))))
(newline)""")

RI['r5-cs'] = P('ri-r5-cs', """(define (shuffle lst)
  (let loop ((pool lst) (out (list)))
    (if (null? pool)
        (reverse out)
        (let* ((k (random-integer (length pool)))
               (pick (list-ref pool k)))
          (loop (append (take pool k) (drop pool (+ k 1))) (cons pick out))))))
(define deck (iota 10))
(define shuffled (with-seed 5150 (lambda () (shuffle deck))))
(display (list 'shuffled shuffled
               'replays? (equal? shuffled (with-seed 5150 (lambda () (shuffle deck))))
               'same-cards? (equal? (sort shuffled <) deck)))
(newline)""")

# ═══════════════════════════════════════════════════════════════════════
# random-real
# ═══════════════════════════════════════════════════════════════════════

RR = {}
RR['ex-novice'] = P('rr-ex-novice', """(display (with-seed 42 (lambda () (random-real))))
(newline)""")

RR['ex-inter'] = P('rr-ex-inter', """(define x (with-seed 8 (lambda () (random-real))))
(display (list 'strictly-above-0? (> x 0) 'strictly-below-1? (< x 1)))
(newline)""")

RR['ex-expert'] = P('rr-ex-expert', """(define (bernoulli p) (< (random-real) p))
(define hits (with-seed 12 (lambda ()
  (length (filter (lambda (b) b) (map (lambda (_) (bernoulli 0.3)) (iota 2000)))))))
(display (list 'trials 2000 'expected 600 'hits-between-500-and-700? (and (> hits 500) (< hits 700))))
(newline)""")

RR['r2-eng'] = P('rr-r2-eng', """(define (jitter amount) (* amount (- (random-real) 0.5)))
(define frame-a (with-seed 64 (lambda () (map (lambda (_) (jitter 4)) (iota 5)))))
(define frame-b (with-seed 64 (lambda () (map (lambda (_) (jitter 4)) (iota 5)))))
(display (list 'replays? (equal? frame-a frame-b)
               'bounded? (fold (lambda (v acc) (and acc (> v -2) (< v 2))) #t frame-a)))
(newline)""")

RR['r2-math'] = P('rr-r2-math', """(define (mean xs) (/ (apply + xs) (length xs)))
(define m (with-seed 777 (lambda () (mean (map (lambda (_) (random-real)) (iota 4000))))))
(display (list 'expected 0.5 'mean-within-0.02? (< (abs (- m 0.5)) 0.02)))
(newline)""")

RR['r2-cs'] = P('rr-r2-cs', """(define (all-strictly-open? n)
  (fold (lambda (_ acc) (let ((r (random-real))) (and acc (> r 0) (< r 1)))) #t (iota n)))
(display (with-seed 314 (lambda () (all-strictly-open? 3000))))
(newline)""")

RR['r3-a'] = P('rr-r3-a', """(display (with-seed 99 (lambda () (random-real))))
(newline)""")

RR['r3-b'] = P('rr-r3-b', """(define (spin) (* 360 (random-real)))
(define degrees (with-seed 21 (lambda () (spin))))
(display (list 'degrees degrees 'on-the-dial? (and (> degrees 0) (< degrees 360))))
(newline)""")

RR['r3-c'] = P('rr-r3-c', """(define (exp-variate rate) (/ (- (log (- 1 (random-real)))) rate))
(define (mean xs) (/ (apply + xs) (length xs)))
(define m (with-seed 6 (lambda () (mean (map (lambda (_) (exp-variate 2)) (iota 1000))))))
(display (list 'rate 2 'expected 0.5 'sample-mean-within-0.1? (< (abs (- m 0.5)) 0.1)))
(newline)""")

RR['r4-eng'] = P('rr-r4-eng', """(define (five) (map (lambda (_) (random-real)) (iota 5)))
(define a (with-seed 606 five))
(define b (with-seed 606 five))
(display (list 'draws a 'identical? (equal? a b)))
(newline)""")

RR['r4-math'] = P('rr-r4-math', """(define (bucket r) (min 9 (exact (floor (* 10 r)))))
(define counts (with-seed 4711 (lambda ()
  (let ((v (make-vector 10 0)))
    (for-each (lambda (_)
                (let ((b (bucket (random-real))))
                  (vector-set! v b (+ 1 (vector-ref v b)))))
              (iota 3000))
    (vector->list v)))))
(display (list 'total (apply + counts)
               'every-decile-near-300? (fold (lambda (c acc) (and acc (> c 220) (< c 380))) #t counts)))
(newline)""")

RR['r4-cs'] = P('rr-r4-cs', """(define (real-then-random) (list (random-real) (random)))
(define (random-then-real) (list (random) (random-real)))
(display (list 'a (with-seed 9 real-then-random)
               'b (with-seed 9 random-then-real)
               'one-shared-stream? (equal? (with-seed 9 real-then-random)
                                           (with-seed 9 random-then-real))))
(newline)""")

RR['r5-eng'] = P('rr-r5-eng', """(define (spawn-chance p) (if (< (random-real) p) 'spawn 'skip))
(define wave (with-seed 1701 (lambda () (map (lambda (_) (spawn-chance 0.25)) (iota 12)))))
(display (list 'wave wave
               'replays? (equal? wave (with-seed 1701 (lambda () (map (lambda (_) (spawn-chance 0.25)) (iota 12)))))))
(newline)""")

RR['r5-math'] = P('rr-r5-math', """(define (estimate-pi n)
  (let loop ((i 0) (inside 0))
    (if (>= i n)
        (/ (* 4.0 inside) n)
        (let ((x (random-real)) (y (random-real)))
          (loop (+ i 1) (if (< (+ (* x x) (* y y)) 1) (+ inside 1) inside))))))
(define p (with-seed 1618 (lambda () (estimate-pi 1500))))
(display (list 'estimate-within-0.2-of-pi? (< (abs (- p 3.14159)) 0.2)
               'replays? (= p (with-seed 1618 (lambda () (estimate-pi 1500))))))
(newline)""")

RR['r5-cs'] = P('rr-r5-cs', """(define (weighted-choice opts weights)
  (let ((r (* (random-real) (apply + weights))))
    (let loop ((os opts) (ws weights) (acc 0))
      (cond ((null? (cdr os)) (car os))
            ((< r (+ acc (car ws))) (car os))
            (else (loop (cdr os) (cdr ws) (+ acc (car ws))))))))
(define (draw-ten) (map (lambda (_) (weighted-choice (list 'common 'rare 'epic) (list 0.7 0.25 0.05))) (iota 10)))
(define loot (with-seed 8086 draw-ten))
(display (list 'loot loot 'replays? (equal? loot (with-seed 8086 draw-ten))))
(newline)""")

# ═══════════════════════════════════════════════════════════════════════
# make-random-source
# ═══════════════════════════════════════════════════════════════════════

MS = {}
MS['ex-novice'] = P('ms-ex-novice', """(define a (make-random-source))
(define b (make-random-source))
(display (list 'a-is-a (eq? a a) 'a-is-b (eq? a b) 'a-is-truthy (if a #t #f)))
(newline)""")

MS['ex-inter'] = P('ms-ex-inter', """(define plain (with-seed 4 (lambda () (list (random-integer 100) (random-integer 100)))))
(define around (with-seed 4 (lambda ()
  (let ((first-draw (random-integer 100)))
    (make-random-source)
    (list first-draw (random-integer 100))))))
(display (list 'stream plain 'making-a-source-drew-nothing? (equal? plain around)))
(newline)""")

MS['ex-expert'] = P('ms-ex-expert', """(define src (make-random-source))
(display (list 'randomize-hands-it-back? (eq? src (random-source-randomize! src))
               'make-integers-bound? (guard (e (#t #f)) random-source-make-integers #t)
               'make-reals-bound? (guard (e (#t #f)) random-source-make-reals #t)))
(newline)""")

MS['r2-eng'] = P('ms-r2-eng', """(define (count-distinct xs)
  (let loop ((rest xs) (seen (list)) (n 0))
    (cond ((null? rest) n)
          ((memq (car rest) seen) (loop (cdr rest) seen n))
          (else (loop (cdr rest) (cons (car rest) seen) (+ n 1))))))
(define pool (map (lambda (_) (make-random-source)) (iota 4)))
(define one (car pool))
(display (list 'made (length pool)
               'all-distinct-objects? (= 4 (count-distinct pool))
               'same-object-counts-once? (= 1 (count-distinct (list one one one)))))
(newline)""")

MS['r2-math'] = P('ms-r2-math', """(define (make-lcg seed)
  (let ((s seed))
    (lambda ()
      (set! s (modulo (+ (* s 1664525) 1013904223) 4294967296))
      (/ s 4294967296))))
(define g1 (make-lcg 1))
(define g2 (make-lcg 1))
(define (five g) (map (lambda (_) (g)) (iota 5)))
(display (list 'two-generators-same-seed-agree? (equal? (five g1) (five g2))))
(newline)""")

MS['r2-cs'] = P('ms-r2-cs', """(define before (with-seed 13 (lambda () (list (random-integer 100) (random-integer 100)))))
(define after (with-seed 13 (lambda ()
  (make-random-source)
  (make-random-source)
  (list (random-integer 100) (random-integer 100)))))
(display (list 'before before 'engine-stream-untouched? (equal? before after)))
(newline)""")

MS['r3-a'] = P('ms-r3-a', """(define s (make-random-source))
(display (list 'stable-identity? (eq? s s)))
(newline)""")

MS['r3-b'] = P('ms-r3-b', """(define (count-distinct xs)
  (let loop ((rest xs) (seen (list)) (n 0))
    (cond ((null? rest) n)
          ((memq (car rest) seen) (loop (cdr rest) seen n))
          (else (loop (cdr rest) (cons (car rest) seen) (+ n 1))))))
(define (seat name) (list name (make-random-source)))
(define table (map seat (list 'ana 'bo 'cy)))
(display (list 'players (map car table)
               'each-holds-own-cup? (= 3 (count-distinct (map cadr table)))))
(newline)""")

MS['r3-c'] = P('ms-r3-c', """(define (source-with-state seed)
  (let ((s seed))
    (list (lambda () s)
          (lambda () (set! s (modulo (+ (* s 1664525) 1013904223) 4294967296)) s))))
(define src (source-with-state 42))
(define peek (car src))
(define step (cadr src))
(define start (peek))
(step)
(display (list 'start start 'after-one-step (peek) 'state-moved? (not (= start (peek)))))
(newline)""")

MS['r4-eng'] = P('ms-r4-eng', """(define (count-distinct xs)
  (let loop ((rest xs) (seen (list)) (n 0))
    (cond ((null? rest) n)
          ((memq (car rest) seen) (loop (cdr rest) seen n))
          (else (loop (cdr rest) (cons (car rest) seen) (+ n 1))))))
(define srcs (map (lambda (_) (make-random-source)) (iota 50)))
(display (list 'made (length srcs) 'distinct (count-distinct srcs)))
(newline)""")

MS['r4-math'] = P('ms-r4-math', """(define (draws n) (map (lambda (_) (random-integer 1000)) (iota n)))
(define clean (with-seed 21 (lambda () (draws 5))))
(define noisy (with-seed 21 (lambda ()
  (map (lambda (_) (make-random-source) (random-integer 1000)) (iota 5)))))
(display (list 'stream clean 'position-unchanged? (equal? clean noisy)))
(newline)""")

MS['r4-cs'] = P('ms-r4-cs', """(define (name-bound? thunk) (guard (e (#t #f)) (thunk) #t))
(display (list 'random-integer (name-bound? (lambda () random-integer))
               'make-random-source (name-bound? (lambda () make-random-source))
               'random-source-make-integers (name-bound? (lambda () random-source-make-integers))
               'random-source-state-ref (name-bound? (lambda () random-source-state-ref))
               'default-random-source (name-bound? (lambda () default-random-source))))
(newline)""")

MS['r5-eng'] = P('ms-r5-eng', """(define players (map (lambda (n) (list n (make-random-source))) (list 'ana 'bo)))
(define (turn) (map (lambda (p) (list (car p) (+ 1 (random-integer 6)))) players))
(define round-one (with-seed 300 turn))
(display (list 'rolls round-one 'whole-match-replays? (equal? round-one (with-seed 300 turn))))
(newline)""")

MS['r5-math'] = P('ms-r5-math', """(define (make-lcg seed)
  (let ((s seed))
    (lambda () (set! s (modulo (+ (* s 1664525) 1013904223) 4294967296)) (/ s 4294967296))))
(define terrain (make-lcg 11))
(define weather (make-lcg 11))
(define t (map (lambda (_) (terrain)) (iota 3)))
(define w (map (lambda (_) (weather)) (iota 3)))
(display (list 'streams-are-independent? (equal? t w)
               'terrain-advanced-alone? (not (= (terrain) (car w)))))
(newline)""")

MS['r5-cs'] = P('ms-r5-cs', """(define srcs (map (lambda (_) (make-random-source)) (iota 3)))
(define registry (map (lambda (s i) (cons s i)) srcs (iota 3)))
(display (list 'ids (map (lambda (s) (cdr (assq s registry))) srcs)
               'lookup-is-by-identity? (equal? (map (lambda (s) (cdr (assq s registry))) srcs) (iota 3))))
(newline)""")

# ═══════════════════════════════════════════════════════════════════════
# random-source-randomize!
# ═══════════════════════════════════════════════════════════════════════

RZ = {}
RZ['ex-novice'] = P('rz-ex-novice', """(define src (make-random-source))
(display (list 'returns-the-same-source? (eq? src (random-source-randomize! src))))
(newline)""")

RZ['ex-inter'] = P('rz-ex-inter', """(define (plain) (list (random-integer 1000) (random-integer 1000)))
(define (with-randomize)
  (let ((a (random-integer 1000)))
    (random-source-randomize! (make-random-source))
    (list a (random-integer 1000))))
(display (list 'plain (with-seed 7 plain)
               'after-randomize (with-seed 7 with-randomize)
               'seed-not-escaped? (equal? (with-seed 7 plain) (with-seed 7 with-randomize))))
(newline)""")

RZ['ex-expert'] = P('rz-ex-expert', """(define (tick)
  (random-source-randomize! (make-random-source))
  (map (lambda (_) (random-integer 64)) (iota 8)))
(define t1 (with-seed 2048 tick))
(define t2 (with-seed 2048 tick))
(display (list 'tick t1 'cart-still-replays? (equal? t1 t2)))
(newline)""")

RZ['r2-eng'] = P('rz-r2-eng', """(define (build-level)
  (random-source-randomize! (make-random-source))
  (map (lambda (_) (random-integer 10)) (iota 6)))
(display (list 'golden (with-seed 1000 build-level)
               'test-would-still-pass? (equal? (with-seed 1000 build-level)
                                               (with-seed 1000 build-level))))
(newline)""")

RZ['r2-math'] = P('rz-r2-math', """(define (clean k) (with-seed 55 (lambda () (map (lambda (_) (random-integer 1000)) (iota k)))))
(define interleaved (with-seed 55 (lambda ()
  (map (lambda (_)
         (random-source-randomize! (make-random-source))
         (random-integer 1000))
       (iota 5)))))
(display (list 'stream (clean 5) 'draws-consumed-by-randomize 0
               'position-identical? (equal? (clean 5) interleaved)))
(newline)""")

RZ['r2-cs'] = P('rz-r2-cs', """(display (list (random-source-randomize! 42)
               (random-source-randomize! 'a-symbol)
               (random-source-randomize! (list 1 2))
               (random-source-randomize! "a string")))
(newline)""")

RZ['r3-a'] = P('rz-r3-a', """(define s (make-random-source))
(display (eq? s (random-source-randomize! s)))
(newline)""")

RZ['r3-b'] = P('rz-r3-b', """(define (deal n) (map (lambda (_) (random-integer 52)) (iota n)))
(define (deal-after-reshuffle n)
  (random-source-randomize! (make-random-source))
  (deal n))
(display (list 'hand (with-seed 88 (lambda () (deal 5)))
               'reshuffle-changed-nothing? (equal? (with-seed 88 (lambda () (deal 5)))
                                                   (with-seed 88 (lambda () (deal-after-reshuffle 5))))))
(newline)""")

RZ['r3-c'] = P('rz-r3-c', """(define (identity-on-every? xs)
  (fold (lambda (x acc) (and acc (equal? x (random-source-randomize! x)))) #t xs))
(display (identity-on-every? (list 1 'a "s" (list 1 2) #t (make-random-source))))
(newline)""")

RZ['r4-eng'] = P('rz-r4-eng', """(define src (make-random-source))
(define once (random-source-randomize! src))
(define twice (random-source-randomize! (random-source-randomize! src)))
(display (list 'idempotent? (and (eq? src once) (eq? src twice))))
(newline)""")

RZ['r4-math'] = P('rz-r4-math', """(define (draws n) (map (lambda (_) (random-integer 100)) (iota n)))
(define baseline (with-seed 2718 (lambda () (draws 20))))
(define peppered (with-seed 2718 (lambda ()
  (random-source-randomize! (make-random-source))
  (let ((half (draws 10)))
    (random-source-randomize! (make-random-source))
    (append half (draws 10))))))
(display (list 'length (length baseline) 'sequence-unshifted? (equal? baseline peppered)))
(newline)""")

RZ['r4-cs'] = P('rz-r4-cs', """(define (body)
  (let ((a (random-integer 100)))
    (random-source-randomize! (make-random-source))
    (let ((inner (with-seed 2 (lambda ()
                   (random-source-randomize! (make-random-source))
                   (random-integer 100)))))
      (list a inner (random-integer 100)))))
(display (list 'nested (with-seed 2 body)
               'outer-extent-restored? (equal? (with-seed 2 (lambda () (list (random-integer 100) (random-integer 100))))
                                               (let ((n (with-seed 2 body))) (list (car n) (caddr n))))))
(newline)""")

RZ['r5-eng'] = P('rz-r5-eng', """(define (run-tick n)
  (random-source-randomize! (make-random-source))
  (map (lambda (_) (random-integer 100)) (iota n)))
(define (bug-report seed ticks) (list 'seed seed 'ticks ticks 'output (with-seed seed (lambda () (run-tick ticks)))))
(define report (bug-report 31337 5))
(display (list 'report report
               'reproducible-from-report? (equal? report (bug-report 31337 5))))
(newline)""")

RZ['r5-math'] = P('rz-r5-math', """(define (strategy-score bias)
  (random-source-randomize! (make-random-source))
  (fold + 0 (map (lambda (_) (if (< (random-real) bias) 1 0)) (iota 500))))
(define a (with-seed 4096 (lambda () (strategy-score 0.4))))
(define b (with-seed 4096 (lambda () (strategy-score 0.6))))
(display (list 'common-random-numbers? (< a b)
               'a-replays? (= a (with-seed 4096 (lambda () (strategy-score 0.4))))))
(newline)""")

RZ['r5-cs'] = P('rz-r5-cs', """(define (golden seed)
  (with-seed seed (lambda ()
    (random-source-randomize! (make-random-source))
    (map (lambda (_) (random-integer 16)) (iota 6)))))
(define suite (map golden (list 1 2 3)))
(display (list 'golden-master suite
               'stable-across-runs? (equal? suite (map golden (list 1 2 3)))))
(newline)""")


# ═══════════════════════════════════════════════════════════════════════
# Verify every program: runs, and is deterministic across two runs.
# ═══════════════════════════════════════════════════════════════════════

def run_once(src):
    with open(TMP, 'w') as f:
        f.write(src)
    r = subprocess.run([MOTOI, 'run', TMP], capture_output=True, text=True, cwd=REPO)
    return r.returncode, r.stdout, r.stderr


def verify():
    bad = []
    for label, src in PROGRAMS.items():
        c1, o1, e1 = run_once(src)
        c2, o2, e2 = run_once(src)
        if c1 != 0:
            bad.append((label, 'EXIT %d' % c1, (e1 or o1).strip()[:300]))
        elif o1 != o2:
            bad.append((label, 'NONDETERMINISTIC', repr(o1)[:150] + ' vs ' + repr(o2)[:150]))
        else:
            print('  ok   %-22s %s' % (label, o1.strip().replace('\n', ' | ')[:110]))
    return bad


if __name__ == '__main__':
    print('checking %d programs (each run twice)...' % len(PROGRAMS))
    bad = verify()
    if bad:
        print('\nFAILURES (%d):' % len(bad))
        for b in bad:
            print('  %-22s %-18s %s' % b)
        sys.exit(1)
    print('\nall %d programs run and are deterministic.' % len(PROGRAMS))
