# Chapter 04 — `animation`  (rewritten 2026-07-26, #372)

> **Presentation-only Markdown** (rendered per `slat-md-presentation-spec.md`). Canonical source
> stays `scheme/reference/04-animation.slat`. This chapter no longer documents browser DOM reflow
> policy. Its subject is the **real tween lifecycle** — a value moving through time — taught through
> easing curves (ch. 22), interpolation (ch. 20), and velocity as a derivative (ch. 11). The three
> former DOM verbs are preserved as a broken-example (`animation-dom-reflow-not-motoi-subject.slatl`).

`(chapter :number "04" :library "animation" :verb-count 3 :training-eligible #t)`

Animation in Motoi is a value moving through time. A motion verb (`motion/move-to`) creates a
**tween**: a start, an end, a duration, and an easing curve that says HOW the value travels between
the endpoints. The three verbs here are the tween lifecycle — `animation/tweens` READS the live
set, `animation/tick` ADVANCES the clock one frame, `animation/clear!` EMPTIES the set. The
mathematics lives next door: `easing/*` (ch. 22) is the curve, `curve/eval` (ch. 20) is the
position at fraction t, `calc/derivative` (ch. 11) is the velocity.

---

## Verb 1 — `animation/tweens`

`(animation/tweens) -> list` · std Motoi · tier core · **pure**

> The live list of in-flight tweens — every value currently moving toward a target. Empty when nothing animates.

### Row 1 — examples (novice / intermediate / expert)

**novice**
```scheme
(animation/tweens)                              ; ⇒ ()
```
*Empty list when nothing is moving.*

**intermediate**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'star 0 0) (list 60 0))
  (length (animation/tweens)))                  ; ⇒ 1
```
*One motion in flight — length 1.*

**expert**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (motion/move-to (list 'b 0 0) (list 9 9))
  (length (animation/tweens)))                  ; ⇒ 2
```
*Count everything animating at once.*

### Row 2 — audit (eng / math / cs)

**eng**
```scheme
(begin
  (animation/clear!)
  (if (null? (animation/tweens))
      (motion/move-to (list 'star 0 0) (list 60 0))
      'busy)
  (length (animation/tweens)))
```
**math**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (= (length (animation/tweens)) 1))
```
**cs**
```scheme
(list? (animation/tweens))
```
- **problem:** Before spawning more motion you need to know whether the screen is already busy — read the live set, don't guess.
- **meta:** Reach for `animation/tweens` and NOT `animation/tick`: tweens READS the set; tick ADVANCES it. Reading must not move the clock.

### Row 3 — dimension

Observe the live animation set so the caller can gate, count, or witness its shape.

**engineering**
```scheme
(begin
  (animation/clear!)
  (if (null? (animation/tweens)) 'idle 'animating))
```
**mathematics**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (length (animation/tweens)))
```
**cs / dispatch**
```scheme
(list? (animation/tweens))
```

### Row 4 — proof

**eng**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (= (length (animation/tweens)) (length (animation/tweens))))
```
**math**
```scheme
(begin (animation/clear!) (null? (animation/tweens)))
```
**cs**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (and (list? (animation/tweens))
       (= 1 (length (animation/tweens)))))
```
- **claim:** Pure read within a slice — same result until a tick or a motion mutates the set.
- **invariant:** `∀ t. read(t) = read(t)` when no tick ∧ no motion intervenes; `(length read) ∈ ℤ≥0`

### Row 5 — emergence

**eng-composition**
```scheme
(begin
  (animation/clear!)
  (let loop ((n 0))
    (if (or (>= n 3) (>= (length (animation/tweens)) 2))
        (length (animation/tweens))
        (begin
          (motion/move-to (list n 0 0) (list 9 0))
          (loop (+ n 1))))))
```
**math-composition**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (cond ((null? (animation/tweens)) 'still)
        ((= 1 (length (animation/tweens))) 'one)
        (else 'many)))
```
**cs-composition**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (map (lambda (_) (length (animation/tweens)))
       (list 1 2 3)))
```
- **emergent:** eng watermark back-pressure · math size-driven branch · cs per-frame sampler. Family: bounded producer / observer of a live collection.

---

## Verb 2 — `animation/tick`

`(animation/tick) -> integer` · std Motoi · tier core · **state-change**

> Advance the animation clock one frame: step every live tween along its easing curve and redraw. Returns the number still in flight.

### Row 1 — examples (novice / intermediate / expert)

**novice**
```scheme
(begin (animation/clear!) (animation/tick))     ; ⇒ 0
```
*Advance one frame; 0 when nothing is animating.*

**intermediate**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'star 0 0) (list 60 0))
  (animation/tick))                             ; ⇒ 1
```
*One tween stepped; still in flight — 1.*

**expert**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'star 0 0) (list 9 0))
  (let loop ((n 0))
    (if (< n 5)
        (begin (animation/tick) (loop (+ n 1)))
        (length (animation/tweens)))))
```
*Drive the clock five frames, then read what remains.*

### Row 2 — audit (eng / math / cs)

**eng**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (let loop ((n 0))
    (if (< n 3)
        (begin (animation/tick) (loop (+ n 1)))
        'stepped)))
```
**math**
```scheme
(map (lambda (frame) (easing/standard (/ frame 4)))
     (list 0 1 2 3 4))
```
**cs**
```scheme
(begin (animation/clear!) (number? (animation/tick)))
```
- **problem:** A tween is a plan; nothing moves until you advance the clock. Each tick samples every tween's curve at the next frame and redraws.
- **meta:** Reach for `animation/tick` and NOT `animation/tweens` to make motion happen: tweens only observes; tick moves the clock.

### Row 3 — dimension

Advance discrete time by one frame and observe progress.

**engineering**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/tick))
```
**mathematics**
```scheme
(easing/standard (/ 2 4))
```
**cs / dispatch**
```scheme
(begin (animation/clear!) (number? (animation/tick)))
```

### Row 4 — proof

**eng**
```scheme
(begin (animation/clear!) (= 0 (animation/tick)))
```
**math**
```scheme
(and (= 0 (easing/linear 0))
     (= 1 (easing/linear 1)))
```
**cs**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (>= (animation/tick) 0))
```
- **claim:** Tick on an empty set returns 0 and changes nothing; on a live set it advances every tween one frame and returns the live count.
- **invariant:** `tick() ∈ ℤ≥0`; `tweens=∅ ⇒ tick()=0 ∧ state unchanged`; easing curve fixes endpoints `c(0)=0, c(1)=1`

### Row 5 — emergence

**eng-composition**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (let loop ((n 0))
    (if (or (null? (animation/tweens)) (>= n 60))
        n
        (begin (animation/tick) (loop (+ n 1))))))
```
**math-composition**
```scheme
(let loop ((f 1) (acc 0))
  (if (> f 4)
      acc
      (loop (+ f 1)
            (+ acc (- (easing/linear (/ f 4))
                      (easing/linear (/ (- f 1) 4)))))))
```
**cs-composition**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (map (lambda (_) (animation/tick)) (list 1 2 3)))
```
- **emergent:** eng bounded settle-driver (tick until idle or a frame cap) · math per-frame deltas telescoping to the whole displacement · cs fixed-step run loop. Family: fixed-step integrator / game loop.

---

## Verb 3 — `animation/clear!`

`(animation/clear!) -> unspecified` · std Motoi · tier core · **state-change**

> Drop every live tween at once — motion stops and the active set becomes empty. The reset at a scene boundary.

### Row 1 — examples (novice / intermediate / expert)

**novice**
```scheme
(begin (animation/clear!) (null? (animation/tweens)))   ; ⇒ #t
```
*Stop all motion; the tween set is now empty.*

**intermediate**
```scheme
(begin
  (motion/move-to (list 'star 0 0) (list 60 0))
  (animation/clear!)
  (null? (animation/tweens)))                   ; ⇒ #t
```
*After clear, nothing is in flight.*

**expert**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (let ((before (length (animation/tweens))))
    (animation/clear!)
    (list before (length (animation/tweens)))))  ; ⇒ (1 0)
```
*Capture the count, clear, confirm it dropped to 0.*

### Row 2 — audit (eng / math / cs)

**eng**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/clear!)
  (length (animation/tweens)))
```
**math**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (motion/move-to (list 'b 0 0) (list 9 9))
  (animation/clear!)
  (null? (animation/tweens)))
```
**cs**
```scheme
(begin
  (animation/clear!)
  (animation/clear!)
  (null? (animation/tweens)))
```
- **problem:** Starting a new scene while old tweens are still in flight makes motion bleed across scenes — clear first.
- **meta:** Reach for `animation/clear!` and NOT `animation/tick` to STOP motion: tick advances it; clear removes it. Opposite intents.

### Row 3 — dimension

Empty the live animation set so the next scene starts clean.

**engineering**
```scheme
(begin (animation/clear!) (length (animation/tweens)))
```
**mathematics**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/clear!)
  (null? (animation/tweens)))
```
**cs / dispatch**
```scheme
(begin
  (animation/clear!)
  (animation/clear!)
  (null? (animation/tweens)))
```

### Row 4 — proof

**eng**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/clear!)
  (= 0 (length (animation/tweens))))
```
**math**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/clear!)
  (let ((once (null? (animation/tweens))))
    (animation/clear!)
    (and once (null? (animation/tweens)))))
```
**cs**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (= 1 (length (animation/tweens))))
```
- **claim:** `clear!` empties the set; it is idempotent and independent of prior size.
- **invariant:** `clear(); tweens=∅; clear∘clear = clear; ∀S. clear(S)=∅`

### Row 5 — emergence

**eng-composition**
```scheme
(define (in-fresh-scene body)
  (animation/clear!)
  (let ((r (body)))
    (animation/clear!)
    r))

(in-fresh-scene
  (lambda ()
    (motion/move-to (list 'a 0 0) (list 9 0))
    (length (animation/tweens))))
```
**math-composition**
```scheme
(define (reset-then f)
  (animation/clear!)
  (f))

(reset-then (lambda () (null? (animation/tweens))))
```
**cs-composition**
```scheme
(define (bracket setup teardown body)
  (setup)
  (let ((r (body)))
    (teardown)
    r))

(bracket (lambda () (animation/clear!))
         (lambda () (animation/clear!))
         (lambda ()
           (motion/move-to (list 'a 0 0) (list 9 0))
           (length (animation/tweens))))
```
- **emergent:** eng fresh-scene wrapper · math reset-to-unit · cs setup/teardown bracket. Family: reset / with-clean-slate / teardown.

---

_All 45 embedded programs verified green via `node bin/motoi run /dev/stdin`._
