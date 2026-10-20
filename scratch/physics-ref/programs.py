#!/usr/bin/env python3
"""programs.py — every runnable program for the 2026-08-02 physics/* +
entity/* reference records, held as raw Scheme so `verify.py` can run each
one through ./bin/motoi before `emit.py` escapes it into the .slat.

Nothing here is authored from memory: every snippet was run first.
"""

# ── 72-world.slat · the physics/* vocabulary ────────────────────────────

PHYSICS_STEP = {
    "ex-novice": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (physics/step)
  (entity/y hero))""",
    "ex-intermediate": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (physics/step) (physics/step) (physics/step)
  (list ':y (entity/y hero) ':frame (world/frame)))""",
    "ex-expert": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (define landed #f)
  (physics/gravity! 2)
  (world/floor! 40)
  (on-collision (lambda (a b) 'touched))
  (let loop ((i 0))
    (when (< i 30)
      (physics/step)
      (when (and (not landed) (= (entity/y hero) 24)) (set! landed #t))
      (loop (+ i 1))))
  (list ':landed landed ':y (entity/y hero)))""",
    "r2-eng": """(begin (world/reset!)
  (define (advance-frames n)
    (let loop ((i 0)) (when (< i n) (physics/step) (loop (+ i 1))))
    (world/frame))
  (advance-frames 5))""",
    "r2-math": """(begin (world/reset!)
  ;; Semi-implicit Euler under constant acceleration g:
  ;; v(n) = n*g and y(n) = g*n*(n+1)/2. Three steps at g=2 give y = 12.
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 2)
  (physics/step) (physics/step) (physics/step)
  (list ':y (entity/y hero) ':closed-form (/ (* 2 3 4) 2)))""",
    "r2-cs": """(begin (world/reset!)
  ;; physics/step is a delegating alias: one call advances the same counter
  ;; world/step advances. Mixing the two names cannot desynchronise a game.
  (physics/step)
  (world/step)
  (= (world/frame) 2))""",
    "r3-world": """(begin (world/reset!) (physics/step) (world/frame))""",
    "r3-clock": """(begin
  (define (tick clock) (+ clock 1))
  (tick (tick 0)))""",
    "r3-numeric": """(begin
  ;; Euler integration of dy/dt = 1 by repeated single steps.
  (define (euler y v n) (if (= n 0) y (euler (+ y v) v (- n 1))))
  (euler 0 1 3))""",
    "r4-eng": """(begin (world/reset!)
  (define f0 (world/frame))
  (physics/step)
  (= (world/frame) (+ f0 1)))""",
    "r4-math": """(begin (world/reset!)
  ;; Falling-body law: after n steps at acceleration g, y = g*n*(n+1)/2.
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (let loop ((i 0)) (when (< i 4) (physics/step) (loop (+ i 1))))
  (= (entity/y hero) (/ (* 1 4 5) 2)))""",
    "r4-cs": """(begin (world/reset!)
  ;; Determinism: the same script from a fresh world gives the same hash.
  (define (run-once)
    (world/reset!)
    (entity/make 'player 0 0)
    (physics/gravity! 3)
    (physics/step) (physics/step)
    (world/hash))
  (= (run-once) (run-once)))""",
    "r5-eng": """(begin (world/reset!)
  (define hits 0)
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (on-collision (lambda (a b) (set! hits (+ hits 1))))
  (physics/step)
  (list ':frame (world/frame) ':hits hits))""",
    "r5-math": """(begin (world/reset!)
  ;; Step until a predicate holds: the trajectory is the orbit of the step map.
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (define (step-until pred)
    (let loop ((n 0))
      (if (or (pred) (> n 100)) n (begin (physics/step) (loop (+ n 1))))))
  (step-until (lambda () (>= (entity/y hero) 10))))""",
    "r5-cs": """(begin (world/reset!)
  ;; Bounded stepping: a frame budget keeps a replay finite.
  (define (step-with-budget n)
    (let ((start (world/frame)))
      (let loop ()
        (when (< (- (world/frame) start) n) (physics/step) (loop)))
      (- (world/frame) start)))
  (step-with-budget 8))""",
}

PHYSICS_GRAVITY_SET = {
    "ex-novice": """(begin (world/reset!) (physics/gravity! 1) (physics/gravity))""",
    "ex-intermediate": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 3)
  (physics/step)
  (entity/y hero))""",
    "ex-expert": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (physics/step) (physics/step)
  (define fast (entity/y hero))
  (physics/gravity! -1)
  (physics/step) (physics/step)
  (list ':down fast ':after-flip (entity/y hero)))""",
    "r2-eng": """(begin (world/reset!)
  (define (moon-gravity!) (physics/gravity! 0.17))
  (moon-gravity!)
  (physics/gravity))""",
    "r2-math": """(begin (world/reset!)
  ;; physics/gravity! g is the scalar form of the vector world/gravity! 0 g:
  ;; it pins the x component at zero, so the field is (0, g).
  (physics/gravity! 4)
  (define hero (entity/make 'player 0 0))
  (physics/step)
  (list ':dx (entity/x hero) ':dy (entity/y hero)))""",
    "r2-cs": """(begin (world/reset!)
  ;; Last write wins: gravity is one cell, not an accumulator.
  (physics/gravity! 2)
  (physics/gravity! 9)
  (physics/gravity))""",
    "r3-world": """(begin (world/reset!) (physics/gravity! 2) (physics/gravity))""",
    "r3-settings": """(begin
  (define (set-volume! box v) (list 'volume v))
  (set-volume! 'radio 7))""",
    "r3-field": """(begin
  ;; A constant field is a function ignoring position: F(x, y) = (0, g).
  (define (field g) (lambda (x y) (list 0 g)))
  ((field 5) 12 34))""",
    "r4-eng": """(begin (world/reset!)
  (physics/gravity! 6)
  (= (physics/gravity) 6))""",
    "r4-math": """(begin (world/reset!)
  ;; Zero gravity is the additive identity of the field: nothing accelerates.
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 0)
  (physics/step) (physics/step)
  (equal? (entity/vel hero) '(0 0)))""",
    "r4-cs": """(begin (world/reset!)
  ;; Idempotent: writing the same value twice leaves one state.
  (physics/gravity! 5)
  (define once (physics/gravity))
  (physics/gravity! 5)
  (= once (physics/gravity)))""",
    "r5-eng": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (define (planet! name g) (physics/gravity! g) name)
  (planet! 'moon 0.17)
  (physics/step)
  (list ':planet 'moon ':vy (cadr (entity/vel hero))))""",
    "r5-math": """(begin (world/reset!)
  ;; Sweep the field strength and read the drop after one step: linear in g.
  (define (drop-after-one-step g)
    (world/reset!)
    (let ((e (entity/make 'player 0 0)))
      (physics/gravity! g)
      (physics/step)
      (entity/y e)))
  (map drop-after-one-step '(1 2 3 4)))""",
    "r5-cs": """(begin (world/reset!)
  ;; Save/restore the field around a stunt, so the stunt cannot leak.
  (define (with-gravity g thunk)
    (let ((saved (physics/gravity)))
      (physics/gravity! g)
      (let ((r (thunk)))
        (physics/gravity! saved)
        r)))
  (physics/gravity! 1)
  (list ':inside (with-gravity 9 physics/gravity) ':after (physics/gravity)))""",
}

PHYSICS_GRAVITY_GET = {
    "ex-novice": """(begin (world/reset!) (physics/gravity))""",
    "ex-intermediate": """(begin (world/reset!) (physics/gravity! 2) (physics/gravity))""",
    "ex-expert": """(begin (world/reset!)
  (define (falling?) (> (physics/gravity) 0))
  (list ':fresh (falling?)
        ':after (begin (physics/gravity! 1) (falling?))))""",
    "r2-eng": """(begin (world/reset!)
  (physics/gravity! 1)
  (define (gravity-report)
    (list ':g (physics/gravity) ':direction (if (> (physics/gravity) 0) 'down 'up)))
  (gravity-report))""",
    "r2-math": """(begin (world/reset!)
  ;; The read returns the y component only: the scalar setter pins x at 0,
  ;; so one number is the whole field.
  (physics/gravity! 7)
  (= (physics/gravity) 7))""",
    "r2-cs": """(begin (world/reset!)
  ;; Pure read: two reads with no write between them must agree.
  (physics/gravity! 3)
  (= (physics/gravity) (physics/gravity)))""",
    "r3-world": """(begin (world/reset!) (physics/gravity! 2) (physics/gravity))""",
    "r3-config": """(begin
  (define (get-setting cfg key) (cdr (assq key cfg)))
  (get-setting '((volume . 7) (bright . 3)) 'volume))""",
    "r3-sensor": """(begin
  ;; A sensor read: sample the ambient value without disturbing it.
  (define (sample cell) (car cell))
  (sample (list 9.8 'metres-per-second-squared)))""",
    "r4-eng": """(begin (world/reset!)
  (physics/gravity! 4)
  (= (physics/gravity) 4))""",
    "r4-math": """(begin (world/reset!)
  ;; Round-trip law: read after write returns exactly what was written,
  ;; for every value tried.
  (define (round-trips? g) (physics/gravity! g) (= (physics/gravity) g))
  (and (round-trips? 0) (round-trips? 1) (round-trips? -2) (round-trips? 0.5)))""",
    "r4-cs": """(begin (world/reset!)
  ;; The read does not advance time.
  (physics/gravity! 2)
  (define f0 (world/frame))
  (physics/gravity) (physics/gravity)
  (= (world/frame) f0))""",
    "r5-eng": """(begin (world/reset!)
  (physics/gravity! 1)
  (define (heavier! k) (physics/gravity! (* k (physics/gravity))) (physics/gravity))
  (heavier! 3))""",
    "r5-math": """(begin (world/reset!)
  ;; Read-modify-write builds a geometric ramp of field strengths.
  (physics/gravity! 1)
  (define (ramp n)
    (if (= n 0) '()
        (begin (physics/gravity! (* 2 (physics/gravity)))
               (cons (physics/gravity) (ramp (- n 1))))))
  (ramp 4))""",
    "r5-cs": """(begin (world/reset!)
  ;; Read the field to decide whether a fall needs simulating at all.
  (define hero (entity/make 'player 0 0))
  (define (settle-or-skip)
    (if (= (physics/gravity) 0) 'nothing-to-simulate
        (begin (physics/step) (entity/y hero))))
  (list ':fresh (settle-or-skip)
        ':pulled (begin (physics/gravity! 2) (settle-or-skip))))""",
}

PHYSICS_FRICTION_SET = {
    "ex-novice": """(begin (world/reset!) (physics/friction! 0.5) (physics/friction))""",
    "ex-intermediate": """(begin (world/reset!)
  (define puck (entity/make 'player 0 0))
  (entity/set-velocity! puck 8 0)
  (physics/friction! 0.5)
  (physics/step)
  (car (entity/vel puck)))""",
    "ex-expert": """(begin (world/reset!)
  (define puck (entity/make 'player 0 0))
  (entity/set-velocity! puck 16 0)
  (physics/friction! 0.5)
  (let loop ((i 0) (out '()))
    (if (= i 4) (reverse out)
        (begin (physics/step) (loop (+ i 1) (cons (car (entity/vel puck)) out))))))""",
    "r2-eng": """(begin (world/reset!)
  (define (ice!) (physics/friction! 0.995))
  (define (mud!) (physics/friction! 0.5))
  (ice!)
  (list ':ice (physics/friction) ':mud (begin (mud!) (physics/friction))))""",
    "r2-math": """(begin (world/reset!)
  ;; Friction is a per-frame multiplier, so speed decays geometrically:
  ;; v(n) = v(0) * f^n. Two frames at f = 0.5 quarter the speed.
  (define puck (entity/make 'player 0 0))
  (entity/set-velocity! puck 12 0)
  (physics/friction! 0.5)
  (physics/step) (physics/step)
  (list ':vx (car (entity/vel puck)) ':closed-form (* 12 0.5 0.5)))""",
    "r2-cs": """(begin (world/reset!)
  ;; A non-numeric argument falls back to the house default 0.98 rather
  ;; than poisoning the integrator with a NaN.
  (physics/friction! 'sticky)
  (physics/friction))""",
    "r3-world": """(begin (world/reset!) (physics/friction! 0.9) (physics/friction))""",
    "r3-audio": """(begin
  ;; A per-frame gain multiplier on a signal: the same decay shape.
  (define (decay v f n) (if (= n 0) v (decay (* v f) f (- n 1))))
  (decay 1 0.5 3))""",
    "r3-money": """(begin
  ;; Geometric depreciation: value retained after n years at rate f.
  (define (depreciate value f years)
    (if (= years 0) value (depreciate (* value f) f (- years 1))))
  (depreciate 1000 0.9 2))""",
    "r4-eng": """(begin (world/reset!)
  (physics/friction! 0.25)
  (= (physics/friction) 0.25))""",
    "r4-math": """(begin (world/reset!)
  ;; f = 1 is the multiplicative identity: motion is untouched.
  (define puck (entity/make 'player 0 0))
  (entity/set-velocity! puck 5 0)
  (physics/friction! 1)
  (physics/step) (physics/step) (physics/step)
  (= (car (entity/vel puck)) 5))""",
    "r4-cs": """(begin (world/reset!)
  ;; f = 0 is the absorbing element: one frame stops everything dead.
  (define puck (entity/make 'player 0 0))
  (entity/set-velocity! puck 99 -99)
  (physics/friction! 0)
  (physics/step)
  (equal? (entity/vel puck) '(0 0)))""",
    "r5-eng": """(begin (world/reset!)
  (define puck (entity/make 'player 0 0))
  (define (slide-until-slow)
    (let loop ((n 0))
      (if (or (< (abs (car (entity/vel puck))) 0.5) (> n 200)) n
          (begin (physics/step) (loop (+ n 1))))))
  (entity/set-velocity! puck 10 0)
  (physics/friction! 0.8)
  (slide-until-slow))""",
    "r5-math": """(begin (world/reset!)
  ;; Total distance under geometric decay converges to v0 * f / (1 - f).
  (define puck (entity/make 'player 0 0))
  (entity/set-velocity! puck 10 0)
  (physics/friction! 0.5)
  (let loop ((i 0)) (when (< i 40) (physics/step) (loop (+ i 1))))
  (list ':travelled (entity/x puck) ':limit (/ (* 10 0.5) 0.5)))""",
    "r5-cs": """(begin (world/reset!)
  ;; Swap the surface under a moving body mid-run and watch the profile bend.
  (define puck (entity/make 'player 0 0))
  (entity/set-velocity! puck 16 0)
  (physics/friction! 1)
  (physics/step) (physics/step)
  (define on-ice (car (entity/vel puck)))
  (physics/friction! 0.5)
  (physics/step)
  (list ':ice on-ice ':then-mud (car (entity/vel puck))))""",
}

PHYSICS_FRICTION_GET = {
    "ex-novice": """(begin (world/reset!) (physics/friction))""",
    "ex-intermediate": """(begin (world/reset!) (physics/friction! 0.75) (physics/friction))""",
    "ex-expert": """(begin (world/reset!)
  (define (surface)
    (let ((f (physics/friction)))
      (cond ((= f 1) 'frictionless)
            ((> f 0.9) 'ice)
            ((> f 0.5) 'ground)
            (else 'mud))))
  (list ':fresh (surface)
        ':ice (begin (physics/friction! 0.95) (surface))
        ':mud (begin (physics/friction! 0.3) (surface))))""",
    "r2-eng": """(begin (world/reset!)
  (physics/friction! 0.9)
  (define (friction-report)
    (list ':f (physics/friction) ':slowing (< (physics/friction) 1)))
  (friction-report))""",
    "r2-math": """(begin (world/reset!)
  ;; An unset world reads 1 — the multiplicative identity — not 0, because
  ;; "no friction" must leave velocity unchanged.
  (= (physics/friction) 1))""",
    "r2-cs": """(begin (world/reset!)
  ;; Pure read: no write between two reads means one answer.
  (physics/friction! 0.4)
  (= (physics/friction) (physics/friction)))""",
    "r3-world": """(begin (world/reset!) (physics/friction! 0.6) (physics/friction))""",
    "r3-config": """(begin
  (define (get-or cfg key fallback)
    (let ((hit (assq key cfg))) (if hit (cdr hit) fallback)))
  (get-or '((bright . 3)) 'volume 1))""",
    "r3-signal": """(begin
  ;; Read a filter's retention coefficient before applying it.
  (define (retention filter) (cadr filter))
  (retention (list 'lowpass 0.6)))""",
    "r4-eng": """(begin (world/reset!)
  (physics/friction! 0.2)
  (= (physics/friction) 0.2))""",
    "r4-math": """(begin (world/reset!)
  ;; Round-trip law plus the unset default: read-after-write is exact, and
  ;; a fresh world reads the identity.
  (define (round-trips? f) (physics/friction! f) (= (physics/friction) f))
  (and (= (physics/friction) 1)
       (round-trips? 0) (round-trips? 0.5) (round-trips? 1)))""",
    "r4-cs": """(begin (world/reset!)
  ;; world/reset! restores the default; the read proves the world is fresh.
  (physics/friction! 0.1)
  (world/reset!)
  (= (physics/friction) 1))""",
    "r5-eng": """(begin (world/reset!)
  (define (grippier! k) (physics/friction! (* k (physics/friction))) (physics/friction))
  (grippier! 0.5))""",
    "r5-math": """(begin (world/reset!)
  ;; Read-modify-write halves the retention each pass: a geometric ladder.
  (define (ladder n)
    (if (= n 0) '()
        (begin (physics/friction! (/ (physics/friction) 2))
               (cons (physics/friction) (ladder (- n 1))))))
  (ladder 4))""",
    "r5-cs": """(begin (world/reset!)
  ;; Guard: skip the whole decay simulation when nothing is decaying.
  (define puck (entity/make 'player 0 0))
  (entity/set-velocity! puck 4 0)
  (define (maybe-decay)
    (if (= (physics/friction) 1) 'no-decay
        (begin (physics/step) (car (entity/vel puck)))))
  (list ':fresh (maybe-decay)
        ':muddy (begin (physics/friction! 0.5) (maybe-decay))))""",
}

PHYSICS_APPLY_FORCE = {
    "ex-novice": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/apply-force hero 3 0)
  (entity/vel hero))""",
    "ex-intermediate": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/apply-force 'player 0 -5)
  (physics/step)
  (entity/y hero))""",
    "ex-expert": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (physics/apply-force 'player 0 -6)
  (let loop ((i 0) (peak 0))
    (if (= i 8) (list ':peak peak ':y (entity/y hero))
        (begin (physics/step)
               (loop (+ i 1) (min peak (entity/y hero)))))))""",
    "r2-eng": """(begin (world/reset!)
  (define ship (entity/make 'player 0 0))
  (define (thrust! dx dy) (physics/apply-force ship dx dy))
  (thrust! 1 0)
  (thrust! 1 0)
  (entity/vel ship))""",
    "r2-math": """(begin (world/reset!)
  ;; Forces add: applying (a b) then (c d) is applying (a+c b+d) once.
  (define one (entity/make 'player 0 0))
  (physics/apply-force one 2 3)
  (physics/apply-force one 4 5)
  (list ':stacked (entity/vel one) ':sum (list (+ 2 4) (+ 3 5))))""",
    "r2-cs": """(begin (world/reset!)
  ;; A name that matches nothing returns #f rather than erroring, so a
  ;; script can push on an entity that may already be despawned.
  (entity/make 'player 0 0)
  (list ':hit (physics/apply-force 'player 1 0)
        ':miss (physics/apply-force 'ghost 1 0)))""",
    "r3-world": """(begin (world/reset!)
  (define e (entity/make 'player 0 0))
  (physics/apply-force e 2 0)
  (entity/vel e))""",
    "r3-vector": """(begin
  ;; The same accumulation on a bare pair of numbers.
  (define (push v dx dy) (list (+ (car v) dx) (+ (cadr v) dy)))
  (push (push '(0 0) 2 0) 0 3))""",
    "r3-budget": """(begin
  ;; Any running total takes deltas the same way.
  (define (credit balance amount) (+ balance amount))
  (credit (credit 0 40) 2))""",
    "r4-eng": """(begin (world/reset!)
  (define e (entity/make 'player 0 0))
  (physics/apply-force e 3 -4)
  (equal? (entity/vel e) '(3 -4)))""",
    "r4-math": """(begin (world/reset!)
  ;; Zero is the identity of the force group, and every push has an inverse.
  (define e (entity/make 'player 0 0))
  (physics/apply-force e 0 0)
  (define untouched (equal? (entity/vel e) '(0 0)))
  (physics/apply-force e 7 -2)
  (physics/apply-force e -7 2)
  (and untouched (equal? (entity/vel e) '(0 0))))""",
    "r4-cs": """(begin (world/reset!)
  ;; Pushing a static body wakes it: a force makes it dynamic.
  (define rock (entity/make 'rock 0 0))
  (define before (entity/static? rock))
  (physics/apply-force rock 1 0)
  (and before (not (entity/static? rock))))""",
    "r5-eng": """(begin (world/reset!)
  (define ship (entity/make 'player 0 0))
  (define (burn! n)
    (let loop ((i 0)) (when (< i n) (physics/apply-force ship 1 0) (physics/step) (loop (+ i 1)))))
  (burn! 3)
  (list ':x (entity/x ship) ':vx (car (entity/vel ship))))""",
    "r5-math": """(begin (world/reset!)
  ;; With the world field switched off, a constant per-frame force IS
  ;; gravity: the same falling-body law y(n) = g*n*(n+1)/2 comes out.
  (define a (entity/make 'a 0 0))
  (physics/gravity! 0)
  (let loop ((i 0))
    (when (< i 4)
      (physics/apply-force a 0 1)
      (physics/step)
      (loop (+ i 1))))
  (list ':by-force (entity/y a) ':closed-form (/ (* 1 4 5) 2)))""",
    "r5-cs": """(begin (world/reset!)
  ;; Fan a single push out over a whole team by name.
  (entity/make 'bird 0 0)
  (entity/make 'bird 40 0)
  (define (gust! kind dx dy)
    (map (lambda (e) (physics/apply-force e dx dy)) (world/find kind)))
  (gust! 'bird 2 0)
  (map (lambda (e) (entity/vel e)) (world/find 'bird)))""",
}

PHYSICS_APPLY_GRAVITY = {
    "ex-novice": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/apply-gravity hero 2)
  (entity/vel hero))""",
    "ex-intermediate": """(begin (world/reset!)
  (define leaf (entity/make 'leaf 0 0))
  (physics/gravity! 1)
  (physics/apply-gravity 'leaf)
  (entity/vel leaf))""",
    "ex-expert": """(begin (world/reset!)
  ;; The hand pull STACKS on the world field rather than replacing it: the
  ;; pulled leaf takes g twice a frame and falls exactly twice as far.
  (define pulled (entity/make 'leaf 0 0))
  (define fielded (entity/make 'player 0 0))
  (physics/gravity! 1)
  (let loop ((i 0))
    (when (< i 3)
      (physics/apply-gravity pulled)
      (physics/step)
      (loop (+ i 1))))
  (list ':pulled (entity/y pulled) ':fielded (entity/y fielded)))""",
    "r2-eng": """(begin (world/reset!)
  (define leaf (entity/make 'leaf 0 0))
  (define (make-it-fall! e) (physics/apply-gravity e 1) (physics/step) (entity/y e))
  (make-it-fall! leaf))""",
    "r2-math": """(begin (world/reset!)
  ;; With no argument the pull IS the world field: one hand call adds
  ;; exactly (physics/gravity) to the body's vertical velocity.
  (define hand (entity/make 'leaf 0 0))
  (physics/gravity! 3)
  (physics/apply-gravity hand)
  (list ':vy (cadr (entity/vel hand)) ':field (physics/gravity)))""",
    "r2-cs": """(begin (world/reset!)
  ;; A missing target reports #f; it never raises.
  (entity/make 'leaf 0 0)
  (list ':hit (physics/apply-gravity 'leaf 1)
        ':miss (physics/apply-gravity 'nothing 1)))""",
    "r3-world": """(begin (world/reset!)
  (define e (entity/make 'leaf 0 0))
  (physics/apply-gravity e 2)
  (entity/vel e))""",
    "r3-kinematics": """(begin
  ;; Velocity accumulating acceleration, with no world at all.
  (define (accelerate v a) (+ v a))
  (accelerate (accelerate 0 2) 2))""",
    "r3-queue": """(begin
  ;; Any default-when-absent read has this shape: use the ambient value
  ;; unless the caller supplies one.
  (define (charge amount ambient) (if amount amount ambient))
  (list (charge 5 2) (charge #f 2)))""",
    "r4-eng": """(begin (world/reset!)
  (define e (entity/make 'leaf 0 0))
  (physics/apply-gravity e 4)
  (equal? (entity/vel e) '(0 4)))""",
    "r4-math": """(begin (world/reset!)
  ;; The pull is purely vertical: x velocity is invariant under it.
  (define e (entity/make 'leaf 0 0))
  (physics/apply-force e 5 0)
  (physics/apply-gravity e 3)
  (equal? (entity/vel e) '(5 3)))""",
    "r4-cs": """(begin (world/reset!)
  ;; A pulled body is always dynamic afterwards, even at zero strength.
  (define rock (entity/make 'rock 0 0))
  (define before (entity/static? rock))
  (physics/apply-gravity rock 0)
  (and before (not (entity/static? rock))))""",
    "r5-eng": """(begin (world/reset!)
  (define leaf (entity/make 'leaf 0 0))
  (define (drift! frames strength)
    (let loop ((i 0))
      (when (< i frames) (physics/apply-gravity leaf strength) (physics/step) (loop (+ i 1))))
    (entity/y leaf))
  (drift! 4 0.5))""",
    "r5-math": """(begin (world/reset!)
  ;; Per-body pull strengths make a feather and a stone without ever
  ;; touching the world field — the ratio of the falls is the ratio of g.
  (define feather (entity/make 'feather 0 0))
  (define stone (entity/make 'stone 0 0))
  (let loop ((i 0))
    (when (< i 3)
      (physics/apply-gravity feather 0.25)
      (physics/apply-gravity stone 2)
      (physics/step)
      (loop (+ i 1))))
  (list ':feather (entity/y feather) ':stone (entity/y stone)))""",
    "r5-cs": """(begin (world/reset!)
  ;; Selective gravity: pull only the bodies carrying a tag.
  (define a (entity/make 'crate 0 0))
  (define b (entity/make 'balloon 40 0))
  (entity/tag! a 'heavy)
  (define (pull-tagged! tag g)
    (map (lambda (e) (physics/apply-gravity e g)) (world/find tag)))
  (pull-tagged! 'heavy 3)
  (physics/step)
  (list ':crate (entity/y a) ':balloon (entity/y b)))""",
}

PHYSICS_APPLY_IMPULSE = {
    "ex-novice": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/apply-impulse hero 0 -4)
  (entity/vel hero))""",
    "ex-intermediate": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (physics/apply-impulse 'player 0 -3)
  (physics/step)
  (entity/y hero))""",
    "ex-expert": """(begin (world/reset!)
  ;; A double jump: two impulses, the second only while still rising.
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (physics/apply-impulse hero 0 -5)
  (physics/step) (physics/step)
  (when (< (cadr (entity/vel hero)) 0) (physics/apply-impulse hero 0 -4))
  (physics/step)
  (list ':y (entity/y hero) ':vy (cadr (entity/vel hero))))""",
    "r2-eng": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (define (jump! h) (physics/apply-impulse hero 0 (- h)))
  (jump! 6)
  (entity/vel hero))""",
    "r2-math": """(begin (world/reset!)
  ;; An impulse is a velocity delta, so impulses compose by addition and
  ;; an equal-and-opposite pair cancels exactly.
  (define e (entity/make 'player 0 0))
  (physics/apply-impulse e 3 -3)
  (physics/apply-impulse e -3 3)
  (entity/vel e))""",
    "r2-cs": """(begin (world/reset!)
  ;; physics/apply-impulse and physics/apply-force agree on entities; the
  ;; name is the difference, and the name is what a reader sees.
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 0 0))
  (physics/apply-impulse a 2 -1)
  (physics/apply-force b 2 -1)
  (equal? (entity/vel a) (entity/vel b)))""",
    "r3-world": """(begin (world/reset!)
  (define e (entity/make 'player 0 0))
  (physics/apply-impulse e 0 -4)
  (entity/vel e))""",
    "r3-mechanics": """(begin
  ;; Impulse-momentum: dv = J / m.
  (define (impulse v j m) (+ v (/ j m)))
  (impulse 0 10 2))""",
    "r3-editing": """(begin
  ;; Any one-shot nudge to a running value has this shape.
  (define (nudge value delta) (+ value delta))
  (nudge 100 -4))""",
    "r4-eng": """(begin (world/reset!)
  (define e (entity/make 'player 0 0))
  (physics/apply-impulse e 1 2)
  (equal? (entity/vel e) '(1 2)))""",
    "r4-math": """(begin (world/reset!)
  ;; Order does not matter: impulse addition is commutative.
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 0 0))
  (physics/apply-impulse a 2 0) (physics/apply-impulse a 0 5)
  (physics/apply-impulse b 0 5) (physics/apply-impulse b 2 0)
  (equal? (entity/vel a) (entity/vel b)))""",
    "r4-cs": """(begin (world/reset!)
  ;; A zero impulse does not wake a sleeping body, but a real one does.
  (define rock (entity/make 'rock 0 0))
  (physics/apply-impulse rock 0 0)
  (define still-static (entity/static? rock))
  (physics/apply-impulse rock 0 -1)
  (and still-static (not (entity/static? rock))))""",
    "r5-eng": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (physics/gravity! 1)
  (define (jump-and-land)
    (physics/apply-impulse hero 0 -4)
    (let loop ((i 0))
      (if (or (= i 20) (and (> i 0) (>= (entity/y hero) 0))) (entity/y hero)
          (begin (physics/step) (loop (+ i 1))))))
  (jump-and-land))""",
    "r5-math": """(begin (world/reset!)
  ;; Impulse then constant field: the classic ballistic arc, apex where
  ;; velocity crosses zero.
  (define ball (entity/make 'player 0 0))
  (physics/gravity! 1)
  (physics/apply-impulse ball 2 -5)
  (let loop ((i 0) (apex 0))
    (if (= i 10) (list ':apex apex ':x (entity/x ball))
        (begin (physics/step) (loop (+ i 1) (min apex (entity/y ball)))))))""",
    "r5-cs": """(begin (world/reset!)
  ;; Collision-driven impulse: the handler reacts to the pair by kicking.
  (define ball (entity/make 'player 0 0))
  (entity/make 'wall 8 0)
  (define kicks 0)
  (on-collision
    (lambda (a b)
      (when (or (eq? a 'wall) (eq? b 'wall))
        (set! kicks (+ kicks 1))
        (physics/apply-impulse ball -2 0))))
  (physics/step)
  (list ':kicks kicks ':vel (entity/vel ball)))""",
}

# ── 24-entity.slat · the name-or-handle entity verbs ────────────────────

ENTITY_SET_VELOCITY = {
    "ex-novice": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (entity/set-velocity! hero 2 0)
  (entity/vel hero))""",
    "ex-intermediate": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (entity/set-velocity! 'player 3 -1)
  (physics/step)
  (list (entity/x hero) (entity/y hero)))""",
    "ex-expert": """(begin (world/reset!)
  ;; Set, don't add: the second call replaces the first outright.
  (define hero (entity/make 'player 0 0))
  (entity/set-velocity! hero 9 9)
  (entity/set-velocity! hero 1 0)
  (physics/step)
  (list ':vel (entity/vel hero) ':x (entity/x hero)))""",
    "r2-eng": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (define (walk-right!) (entity/set-velocity! hero 2 0))
  (define (stop!) (entity/set-velocity! hero 0 0))
  (walk-right!)
  (list ':walking (entity/vel hero) ':stopped (begin (stop!) (entity/vel hero))))""",
    "r2-math": """(begin (world/reset!)
  ;; Assignment, not accumulation: the last write is the whole state, so
  ;; repeating it is idempotent where a force would keep adding.
  (define e (entity/make 'player 0 0))
  (entity/set-velocity! e 4 0)
  (entity/set-velocity! e 4 0)
  (equal? (entity/vel e) '(4 0)))""",
    "r2-cs": """(begin (world/reset!)
  ;; It takes either a handle or a name; both reach the same body.
  (define hero (entity/make 'player 0 0))
  (entity/set-velocity! 'player 1 1)
  (define by-name (entity/vel hero))
  (entity/set-velocity! hero 2 2)
  (list ':by-name by-name ':by-handle (entity/vel hero)))""",
    "r3-world": """(begin (world/reset!)
  (define e (entity/make 'player 0 0))
  (entity/set-velocity! e 3 0)
  (entity/vel e))""",
    "r3-record": """(begin
  ;; Replacing a field in a record: the same overwrite, no world needed.
  (define (set-field rec value) (cons (car rec) value))
  (set-field '(speed . 0) 3))""",
    "r3-control": """(begin
  ;; A setpoint on a controller: write the target, do not nudge it.
  (define (setpoint! current target) target)
  (setpoint! 12 3))""",
    "r4-eng": """(begin (world/reset!)
  (define e (entity/make 'player 0 0))
  (entity/set-velocity! e 5 -6)
  (equal? (entity/vel e) '(5 -6)))""",
    "r4-math": """(begin (world/reset!)
  ;; Overwrite law: after a set, the previous velocity has no influence.
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 0 0))
  (entity/set-velocity! a 100 100)
  (entity/set-velocity! a 1 2)
  (entity/set-velocity! b 1 2)
  (equal? (entity/vel a) (entity/vel b)))""",
    "r4-cs": """(begin (world/reset!)
  ;; Reports #t on a hit and #f on a miss; never raises.
  (entity/make 'player 0 0)
  (list ':hit (entity/set-velocity! 'player 1 0)
        ':miss (entity/set-velocity! 'nobody 1 0)))""",
    "r5-eng": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (define (drive! vx frames)
    (entity/set-velocity! hero vx 0)
    (let loop ((i 0)) (when (< i frames) (physics/step) (loop (+ i 1))))
    (entity/x hero))
  (drive! 3 4))""",
    "r5-math": """(begin (world/reset!)
  ;; Set velocity, integrate N frames: displacement is exactly N * v.
  (define e (entity/make 'player 0 0))
  (entity/set-velocity! e 3 0)
  (let loop ((i 0)) (when (< i 5) (physics/step) (loop (+ i 1))))
  (list ':x (entity/x e) ':n-times-v (* 5 3)))""",
    "r5-cs": """(begin (world/reset!)
  ;; A tiny state machine: each state writes its own velocity.
  (define hero (entity/make 'player 0 0))
  (define (enter! state)
    (case state
      ((run) (entity/set-velocity! hero 4 0))
      ((idle) (entity/set-velocity! hero 0 0))
      ((jump) (entity/set-velocity! hero 0 -6)))
    (entity/vel hero))
  (map enter! '(run idle jump)))""",
}

ENTITY_MOVE = {
    "ex-novice": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (entity/move hero 5 0)
  (list (entity/x hero) (entity/y hero)))""",
    "ex-intermediate": """(begin (world/reset!)
  (define hero (entity/make 'player 10 10))
  (entity/move 'player -4 2)
  (list (entity/x hero) (entity/y hero)))""",
    "ex-expert": """(begin (world/reset!)
  ;; Teleporting does not change velocity: position moves, motion does not.
  (define hero (entity/make 'player 0 0))
  (entity/set-velocity! hero 1 0)
  (entity/move hero 100 0)
  (physics/step)
  (list ':x (entity/x hero) ':vel (entity/vel hero)))""",
    "r2-eng": """(begin (world/reset!)
  (define cursor (entity/make 'cursor 0 0))
  (define (nudge! dx dy) (entity/move cursor dx dy) (list (entity/x cursor) (entity/y cursor)))
  (nudge! 1 0)
  (nudge! 0 1))""",
    "r2-math": """(begin (world/reset!)
  ;; Translation composes by vector addition: two moves equal their sum.
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 0 0))
  (entity/move a 2 3) (entity/move a 4 5)
  (entity/move b 6 8)
  (list ':stacked (list (entity/x a) (entity/y a))
        ':summed (list (entity/x b) (entity/y b))))""",
    "r2-cs": """(begin (world/reset!)
  ;; Displacement now, not velocity: the body arrives without accelerating.
  (define e (entity/make 'player 0 0))
  (entity/move e 7 0)
  (list ':x (entity/x e) ':vel (entity/vel e)))""",
    "r3-world": """(begin (world/reset!)
  (define e (entity/make 'player 0 0))
  (entity/move e 3 4)
  (list (entity/x e) (entity/y e)))""",
    "r3-vector": """(begin
  ;; Translating a bare point.
  (define (translate p dx dy) (list (+ (car p) dx) (+ (cadr p) dy)))
  (translate (translate '(0 0) 3 0) 0 4))""",
    "r3-cursor": """(begin
  ;; Moving an index within a buffer: relative, bounded, the same shape.
  (define (seek pos delta limit) (max 0 (min limit (+ pos delta))))
  (seek 5 -9 20))""",
    "r4-eng": """(begin (world/reset!)
  (define e (entity/make 'player 1 2))
  (entity/move e 3 4)
  (and (= (entity/x e) 4) (= (entity/y e) 6)))""",
    "r4-math": """(begin (world/reset!)
  ;; Translation is invertible and (0 0) is its identity.
  (define e (entity/make 'player 5 5))
  (entity/move e 0 0)
  (define unchanged (and (= (entity/x e) 5) (= (entity/y e) 5)))
  (entity/move e 9 -3)
  (entity/move e -9 3)
  (and unchanged (= (entity/x e) 5) (= (entity/y e) 5)))""",
    "r4-cs": """(begin (world/reset!)
  ;; Reports #t on a hit and #f on a miss; never raises.
  (entity/make 'player 0 0)
  (list ':hit (entity/move 'player 1 1)
        ':miss (entity/move 'nobody 1 1)))""",
    "r5-eng": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (define (walk-path! steps)
    (for-each (lambda (s) (entity/move hero (car s) (cadr s))) steps)
    (list (entity/x hero) (entity/y hero)))
  (walk-path! '((1 0) (1 0) (0 1) (-1 0))))""",
    "r5-math": """(begin (world/reset!)
  ;; A closed loop of translations returns to the origin: the path sums to 0.
  (define e (entity/make 'player 0 0))
  (for-each (lambda (s) (entity/move e (car s) (cadr s)))
            '((3 0) (0 4) (-3 0) (0 -4)))
  (list (entity/x e) (entity/y e)))""",
    "r5-cs": """(begin (world/reset!)
  ;; Move-then-test: a manual sweep that stops when it touches something.
  (define hero (entity/make 'player 0 0))
  (entity/make 'wall 40 0)
  (let loop ((n 0))
    (if (or (entity/collides? hero 'wall) (> n 20)) (list ':steps n ':x (entity/x hero))
        (begin (entity/move hero 4 0) (loop (+ n 1))))))""",
}

ENTITY_COLLIDES = {
    "ex-novice": """(begin (world/reset!)
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (entity/collides? 'player 'coin))""",
    "ex-intermediate": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (define coin (entity/make 'coin 40 0))
  (list ':apart (entity/collides? hero coin)
        ':after-move (begin (entity/move coin -36 0) (entity/collides? hero coin))))""",
    "ex-expert": """(begin (world/reset!)
  ;; Touching edges is not overlapping: entities are 16 wide, so x = 16 abuts.
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 16 0))
  (list ':abutting (entity/collides? a b)
        ':overlapping (begin (entity/move b -1 0) (entity/collides? a b))))""",
    "r2-eng": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (entity/make 'spike 8 0)
  (define (hurt?) (if (entity/collides? hero 'spike) 'ouch 'safe))
  (hurt?))""",
    "r2-math": """(begin (world/reset!)
  ;; AABB overlap is the conjunction of two interval overlaps, one per axis.
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 8 40))
  (list ':x-overlaps (< (abs (- (entity/x a) (entity/x b))) 16)
        ':y-overlaps (< (abs (- (entity/y a) (entity/y b))) 16)
        ':both (entity/collides? a b)))""",
    "r2-cs": """(begin (world/reset!)
  ;; A pure read: asking does not move anything or advance the frame.
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (define f0 (world/frame))
  (entity/collides? 'player 'coin)
  (= (world/frame) f0))""",
    "r3-world": """(begin (world/reset!)
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (entity/collides? 'player 'coin))""",
    "r3-interval": """(begin
  ;; One-dimensional interval overlap, the kernel of the box test.
  (define (overlap? a1 a2 b1 b2) (and (< a1 b2) (< b1 a2)))
  (overlap? 0 16 4 20))""",
    "r3-calendar": """(begin
  ;; Two bookings clash exactly when their time intervals overlap.
  (define (clash? s1 e1 s2 e2) (and (< s1 e2) (< s2 e1)))
  (clash? 9 11 10 12))""",
    "r4-eng": """(begin (world/reset!)
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 4 4))
  (entity/collides? a b))""",
    "r4-math": """(begin (world/reset!)
  ;; Symmetric and reflexive: overlap is a symmetric relation, and every
  ;; live body overlaps itself.
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 4 0))
  (and (eq? (entity/collides? a b) (entity/collides? b a))
       (entity/collides? a a)))""",
    "r4-cs": """(begin (world/reset!)
  ;; Strict inequality: abutting edges read #f, one pixel of overlap reads #t.
  (define a (entity/make 'a 0 0))
  (define b (entity/make 'b 16 0))
  (define abutting (entity/collides? a b))
  (entity/move b -1 0)
  (and (not abutting) (entity/collides? a b)))""",
    "r5-eng": """(begin (world/reset!)
  (define hero (entity/make 'player 0 0))
  (entity/make 'coin 4 0)
  (entity/make 'coin 200 0)
  (define (collect!)
    (length (filter (lambda (c) (entity/collides? hero c)) (world/find 'coin))))
  (collect!))""",
    "r5-math": """(begin (world/reset!)
  ;; The overlap relation over a set of bodies: count the unordered pairs.
  (entity/make 'a 0 0)
  (entity/make 'b 4 0)
  (entity/make 'c 8 0)
  (define all (entity/all))
  (define (pairs-overlapping xs)
    (if (null? xs) 0
        (+ (length (filter (lambda (y) (entity/collides? (car xs) y)) (cdr xs)))
           (pairs-overlapping (cdr xs)))))
  (pairs-overlapping all))""",
    "r5-cs": """(begin (world/reset!)
  ;; Poll before stepping: a manual broad-phase you control, versus
  ;; on-collision's callback from inside the integrator.
  (define hero (entity/make 'player 0 0))
  (entity/make 'wall 8 0)
  (define seen '())
  (for-each (lambda (w) (when (entity/collides? hero w) (set! seen (cons 'wall seen))))
            (world/find 'wall))
  (on-collision (lambda (a b) (set! seen (cons 'callback seen))))
  (physics/step)
  (reverse seen))""",
}

ENTITY_STATIC = {
    "ex-novice": """(begin (world/reset!)
  (entity/make 'wall 0 0)
  (entity/static? 'wall))""",
    "ex-intermediate": """(begin (world/reset!)
  (define wall (entity/make 'wall 0 0))
  (define hero (entity/make 'player 0 0))
  (list ':wall (entity/static? wall) ':player (entity/static? hero)))""",
    "ex-expert": """(begin (world/reset!)
  ;; A push wakes a static body; it stays awake afterwards.
  (define crate (entity/make 'crate 0 0))
  (define before (entity/static? crate))
  (physics/apply-impulse crate 1 0)
  (list ':before before ':after (entity/static? crate)))""",
    "r2-eng": """(begin (world/reset!)
  (entity/make 'wall 0 0)
  (entity/make 'player 40 0)
  (define (movers) (filter (lambda (e) (not (entity/static? e))) (entity/all)))
  (map entity/kind (movers)))""",
    "r2-math": """(begin (world/reset!)
  ;; The predicate partitions the live set into two disjoint classes whose
  ;; sizes sum to the whole.
  (entity/make 'wall 0 0)
  (entity/make 'wall 40 0)
  (entity/make 'player 80 0)
  (define all (entity/all))
  (define fixed (length (filter entity/static? all)))
  (define moving (length (filter (lambda (e) (not (entity/static? e))) all)))
  (list ':fixed fixed ':moving moving ':total (= (+ fixed moving) (length all))))""",
    "r2-cs": """(begin (world/reset!)
  ;; Pure read: asking twice with nothing between gives one answer, and the
  ;; frame counter does not move.
  (entity/make 'wall 0 0)
  (define f0 (world/frame))
  (and (eq? (entity/static? 'wall) (entity/static? 'wall))
       (= (world/frame) f0)))""",
    "r3-world": """(begin (world/reset!)
  (entity/make 'wall 0 0)
  (entity/static? 'wall))""",
    "r3-file": """(begin
  ;; Read-only versus writable: the same "may this change?" question.
  (define (read-only? f) (eq? (cadr f) 'ro))
  (read-only? (list 'notes 'ro)))""",
    "r3-value": """(begin
  ;; Immutable versus mutable binding: a constant cannot be pushed either.
  (define (constant? binding) (eq? (car binding) 'const))
  (constant? '(const . 3)))""",
    "r4-eng": """(begin (world/reset!)
  (entity/make 'wall 0 0)
  (entity/make 'player 40 0)
  (and (entity/static? 'wall) (not (entity/static? 'player))))""",
    "r4-math": """(begin (world/reset!)
  ;; Static bodies are fixed points of the integrator: stepping does not
  ;; move them, whatever the field.
  (define wall (entity/make 'wall 0 0))
  (physics/gravity! 5)
  (physics/step) (physics/step)
  (and (entity/static? wall) (= (entity/y wall) 0)))""",
    "r4-cs": """(begin (world/reset!)
  ;; A missing target reads #f — "not a static body" covers "not a body".
  (entity/make 'wall 0 0)
  (list ':wall (entity/static? 'wall) ':nobody (entity/static? 'nobody)))""",
    "r5-eng": """(begin (world/reset!)
  (entity/make 'wall 0 0)
  (entity/make 'player 40 0)
  (define (wake-everything!)
    (for-each (lambda (e) (when (entity/static? e) (physics/apply-impulse e 0 1)))
              (entity/all))
    (length (filter entity/static? (entity/all))))
  (wake-everything!))""",
    "r5-math": """(begin (world/reset!)
  ;; Count the fixed points before and after a field is switched on: only
  ;; the dynamic bodies leave the origin.
  (entity/make 'wall 0 0)
  (entity/make 'player 40 0)
  (physics/gravity! 2)
  (physics/step)
  (map (lambda (e) (list (entity/kind e) (entity/static? e) (entity/y e)))
       (entity/all)))""",
    "r5-cs": """(begin (world/reset!)
  ;; Budget guard: only dynamic bodies need integrating, so the predicate
  ;; sizes the per-frame work before the frame runs.
  (entity/make 'wall 0 0)
  (entity/make 'wall 40 0)
  (entity/make 'player 80 0)
  (define (dynamic-count) (length (filter (lambda (e) (not (entity/static? e))) (entity/all))))
  (list ':bodies (length (entity/all)) ':integrated (dynamic-count)))""",
}

# ── 28-game.slat · on-collision, re-wired 2026-08-02 ─────────────────────

ON_COLLISION = {
    "ex-novice": """(begin (world/reset!)
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (on-collision (lambda (a b) (display 'hit) (newline)))
  (physics/step))""",
    "ex-intermediate": """(begin (world/reset!)
  (define ball (entity/make 'player 0 0))
  (entity/make 'wall 8 0)
  (on-collision
    (lambda (a b)
      (when (or (eq? a 'wall) (eq? b 'wall))
        (physics/apply-impulse ball -2 0))))
  (physics/step)
  (entity/vel ball))""",
    "ex-expert": """(begin (world/reset!)
  (define scored 0)
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (on-collision
    (lambda (a b)
      (when (or (and (eq? a 'player) (eq? b 'coin))
                (and (eq? a 'coin) (eq? b 'player)))
        (set! scored (+ scored 1)))))
  (physics/step)
  (physics/step)
  (on-collision #f)
  (physics/step)
  scored)""",
    "r2-eng": """(begin (world/reset!)
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (define log '())
  (on-collision (lambda (a b) (set! log (cons (list a b) log))))
  (physics/step)
  log)""",
    "r2-cs": """(begin (world/reset!)
  ;; #f is the clear value; a procedure is the install value. Nothing else
  ;; is meaningful, so guard before handing the slot over.
  (define (safe-install! h)
    (if (or (procedure? h) (eq? h #f))
        (begin (on-collision h) 'installed)
        'refused))
  (list (safe-install! (lambda (a b) 'ok))
        (safe-install! #f)
        (safe-install! 42)))""",
    "r3-collision": """(begin (world/reset!)
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (define hits 0)
  (on-collision (lambda (a b) (set! hits (+ hits 1))))
  (physics/step)
  hits)""",
    "r3-frame": """(begin (world/reset!)
  ;; The sibling registration on the same loop: hand the world a callback,
  ;; the integrator decides when it runs.
  (define fired 0)
  (world/after 1 (lambda () (set! fired 1)))
  (physics/step)
  fired)""",
    "r3-signal": """(begin
  ;; An OS signal handler: one slot, replace on set.
  (define (on-signal sig handler) (list sig handler))
  (car (on-signal 'sigterm (lambda () 'stopped))))""",
    "r4-eng": """(begin (world/reset!)
  ;; Clearing the slot really stops the fires.
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (define hits 0)
  (on-collision (lambda (a b) (set! hits (+ hits 1))))
  (physics/step)
  (define after-one hits)
  (on-collision #f)
  (physics/step) (physics/step)
  (list ':fired after-one ':after-clear hits))""",
    "r4-cs": """(begin (world/reset!)
  ;; Replace-on-set: only the newest handler runs.
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (define seen '())
  (on-collision (lambda (a b) (set! seen (cons 'first seen))))
  (on-collision (lambda (a b) (set! seen (cons 'second seen))))
  (physics/step)
  seen)""",
    "r5-eng": """(begin (world/reset!)
  (define score 0)
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (on-collision
    (lambda (a b)
      (when (or (eq? a 'coin) (eq? b 'coin)) (set! score (+ score 1)))))
  (physics/step)
  score)""",
    "r5-cs": """(begin (world/reset!)
  ;; One slot, many listeners: fan out in Scheme.
  (entity/make 'player 0 0)
  (entity/make 'coin 4 0)
  (define log '())
  (define (multi . handlers)
    (lambda (a b) (for-each (lambda (h) (h a b)) handlers)))
  (on-collision (multi (lambda (a b) (set! log (cons 'logged log)))
                       (lambda (a b) (set! log (cons 'scored log)))))
  (physics/step)
  (reverse log))""",
}

ALL = {
    "physics/step": PHYSICS_STEP,
    "physics/gravity!": PHYSICS_GRAVITY_SET,
    "physics/gravity": PHYSICS_GRAVITY_GET,
    "physics/friction!": PHYSICS_FRICTION_SET,
    "physics/friction": PHYSICS_FRICTION_GET,
    "physics/apply-force": PHYSICS_APPLY_FORCE,
    "physics/apply-gravity": PHYSICS_APPLY_GRAVITY,
    "physics/apply-impulse": PHYSICS_APPLY_IMPULSE,
    "entity/set-velocity!": ENTITY_SET_VELOCITY,
    "entity/move": ENTITY_MOVE,
    "entity/collides?": ENTITY_COLLIDES,
    "entity/static?": ENTITY_STATIC,
    "on-collision": ON_COLLISION,
}
