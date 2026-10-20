# Chapter 04 · `animation`

**The tween lifecycle — a value moving through time.**  
_Motoi Scheme Reference · 3 verbs · rendered by `slat2md.py` (spec: `slat-md-presentation-spec.md`)_

---

### Verbs in this chapter

| # | verb | kind | summary |
|---|------|------|---------|
| 1 | `animation/tweens` | pure | The live list of in-flight tweens — every value currently moving toward a target. |
| 2 | `animation/tick` | state-change | Advance the animation clock one frame: step every live tween along its easing curve and redraw. |
| 3 | `animation/clear!` | state-change | Drop every live tween at once — motion stops and the active set becomes empty. |

---

## 1 · `animation/tweens`

> The live list of in-flight tweens — every value currently moving toward a target. Empty when nothing animates.

| | |
|---|---|
| **signature** | `(animation/tweens) -> list` |
| **kind** | pure (no mutation) |
| **tier** | core |
| **std** | Motoi |

### Row 1 · Examples — novice → intermediate → expert

**novice**
```scheme
(animation/tweens)
; ⇒ ()
```
*Empty list when nothing is moving.*

**intermediate**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'star 0 0) (list 60 0))
  (length (animation/tweens)))
; ⇒ 1
```
*One motion in flight — length 1.*

**expert**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (motion/move-to (list 'b 0 0) (list 9 9))
  (length (animation/tweens)))
; ⇒ 2
```
*Count everything animating at once.*

### Row 2 · Audit — reach for the right verb

**eng**
```scheme
(begin
  (animation/clear!)
  (if (null? (animation/tweens))
      (motion/move-to (list 'star 0 0) (list 60 0))
      'busy)
  (length (animation/tweens)))
; ⇒ 1
```

**math**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (= (length (animation/tweens)) 1))
; ⇒ #t
```

**cs**
```scheme
(list? (animation/tweens))
; ⇒ #t
```

- **problem:** Before spawning more motion you need to know whether the screen is already busy — read the live set, don't guess.
- **meta:** Reach for animation/tweens and NOT animation/tick: tweens READS the set; tick ADVANCES it. Reading must not move the clock.

### Row 3 · Dimension — the same idea across engineering · maths · CS

Observe the live animation set so the caller can gate, count, or witness its shape.

**engineering**
```scheme
(begin
  (animation/clear!)
  (if (null? (animation/tweens)) 'idle 'animating))
; ⇒ idle
```

**mathematics**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (length (animation/tweens)))
; ⇒ 1
```

**cs / dispatch**
```scheme
(list? (animation/tweens))
; ⇒ #t
```

### Row 4 · Proof — the invariant that always holds

**eng**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (= (length (animation/tweens))
     (length (animation/tweens))))
; ⇒ #t
```

**math**
```scheme
(begin (animation/clear!) (null? (animation/tweens)))
; ⇒ #t
```

**cs**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (and (list? (animation/tweens))
       (= 1 (length (animation/tweens)))))
; ⇒ #t
```

- **claim:** Pure read within a slice: same result until a tick or a motion mutates the set.
- **invariant:** `∀ t. read(t) = read(t) when no tick ∧ no motion intervenes; (length read) ∈ ℤ≥0`

### Row 5 · Emergence — what it composes into

**eng**
```scheme
(begin
  (animation/clear!)
  (let loop ((n 0))
    (if (or (>= n 3) (>= (length (animation/tweens)) 2))
        (length (animation/tweens))
        (begin
          (motion/move-to (list n 0 0) (list 9 0))
          (loop (+ n 1))))))
; ⇒ 2
```

**math**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (cond ((null? (animation/tweens)) 'still)
        ((= 1 (length (animation/tweens))) 'one)
        (else 'many)))
; ⇒ one
```

**cs**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (map (lambda (_) (length (animation/tweens)))
       (list 1 2 3)))
; ⇒ (1 1 1)
```

- **emergent:** Compositions: eng watermark back-pressure, math size-driven branch, cs per-frame sampler. _Family: bounded producer / observer of a live collection._

---

## 2 · `animation/tick`

> Advance the animation clock one frame: step every live tween along its easing curve and redraw. Returns the number still in flight.

| | |
|---|---|
| **signature** | `(animation/tick) -> integer` |
| **kind** | state-change (mutates) |
| **tier** | core |
| **std** | Motoi |

### Row 1 · Examples — novice → intermediate → expert

**novice**
```scheme
(begin (animation/clear!) (animation/tick))
; ⇒ 0
```
*Advance one frame; 0 when nothing is animating.*

**intermediate**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'star 0 0) (list 60 0))
  (animation/tick))
; ⇒ 1
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
; ⇒ 1
```
*Drive the clock five frames, then read what remains.*

### Row 2 · Audit — reach for the right verb

**eng**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (let loop ((n 0))
    (if (< n 3)
        (begin (animation/tick) (loop (+ n 1)))
        'stepped)))
; ⇒ stepped
```

**math**
```scheme
(map (lambda (frame) (easing/standard (/ frame 4)))
     (list 0 1 2 3 4))
```

**cs**
```scheme
(begin (animation/clear!) (number? (animation/tick)))
; ⇒ #t
```

- **problem:** A tween is a plan; nothing moves until you advance the clock. Each tick samples every tween's curve at the next frame and redraws.
- **meta:** Reach for animation/tick and NOT animation/tweens to make motion happen: tweens only observes; tick is the thing that moves the clock.

### Row 3 · Dimension — the same idea across engineering · maths · CS

Advance discrete time by one frame and observe progress.

**engineering**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/tick))
; ⇒ 1
```

**mathematics**
```scheme
(easing/standard (/ 2 4))
; ⇒ 0.7755613130222939
```

**cs / dispatch**
```scheme
(begin (animation/clear!) (number? (animation/tick)))
; ⇒ #t
```

### Row 4 · Proof — the invariant that always holds

**eng**
```scheme
(begin (animation/clear!) (= 0 (animation/tick)))
; ⇒ #t
```

**math**
```scheme
(and (= 0 (easing/linear 0)) (= 1 (easing/linear 1)))
; ⇒ #t
```

**cs**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (>= (animation/tick) 0))
; ⇒ #t
```

- **claim:** Tick on an empty set returns 0 and changes nothing; on a live set it advances every tween one frame and returns the live count.
- **invariant:** `tick() ∈ ℤ≥0; tweens=∅ ⇒ tick()=0 ∧ state unchanged; easing curve fixes the endpoints c(0)=0, c(1)=1`

### Row 5 · Emergence — what it composes into

**eng**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (let loop ((n 0))
    (if (or (null? (animation/tweens)) (>= n 60))
        n
        (begin (animation/tick) (loop (+ n 1))))))
; ⇒ 60
```

**math**
```scheme
(let loop ((f 1) (acc 0))
  (if (> f 4)
      acc
      (loop (+ f 1)
            (+ acc
               (- (easing/linear (/ f 4))
                  (easing/linear (/ (- f 1) 4)))))))
; ⇒ 1
```

**cs**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (map (lambda (_) (animation/tick)) (list 1 2 3)))
; ⇒ (1 1 1)
```

- **emergent:** Compositions: eng bounded settle-driver (tick until idle or a frame cap), math per-frame deltas summing to the whole displacement, cs fixed-step run loop. _Family: fixed-step integrator / game loop._

---

## 3 · `animation/clear!`

> Drop every live tween at once — motion stops and the active set becomes empty. The reset at a scene boundary.

| | |
|---|---|
| **signature** | `(animation/clear!) -> unspecified` |
| **kind** | state-change (mutates) |
| **tier** | core |
| **std** | Motoi |

### Row 1 · Examples — novice → intermediate → expert

**novice**
```scheme
(begin (animation/clear!) (null? (animation/tweens)))
; ⇒ #t
```
*Stop all motion; the tween set is now empty.*

**intermediate**
```scheme
(begin
  (motion/move-to (list 'star 0 0) (list 60 0))
  (animation/clear!)
  (null? (animation/tweens)))
; ⇒ #t
```
*After clear, nothing is in flight.*

**expert**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (let ((before (length (animation/tweens))))
    (animation/clear!)
    (list before (length (animation/tweens)))))
; ⇒ (1 0)
```
*Capture the count, clear, confirm it dropped to 0 — result (1 0).*

### Row 2 · Audit — reach for the right verb

**eng**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/clear!)
  (length (animation/tweens)))
; ⇒ 0
```

**math**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (motion/move-to (list 'b 0 0) (list 9 9))
  (animation/clear!)
  (null? (animation/tweens)))
; ⇒ #t
```

**cs**
```scheme
(begin
  (animation/clear!)
  (animation/clear!)
  (null? (animation/tweens)))
; ⇒ #t
```

- **problem:** Starting a new scene while old tweens are still in flight makes motion bleed across scenes — clear first.
- **meta:** Reach for animation/clear! and NOT animation/tick to STOP motion: tick advances it; clear removes it. Opposite intents.

### Row 3 · Dimension — the same idea across engineering · maths · CS

Empty the live animation set so the next scene starts clean.

**engineering**
```scheme
(begin (animation/clear!) (length (animation/tweens)))
; ⇒ 0
```

**mathematics**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/clear!)
  (null? (animation/tweens)))
; ⇒ #t
```

**cs / dispatch**
```scheme
(begin
  (animation/clear!)
  (animation/clear!)
  (null? (animation/tweens)))
; ⇒ #t
```

### Row 4 · Proof — the invariant that always holds

**eng**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/clear!)
  (= 0 (length (animation/tweens))))
; ⇒ #t
```

**math**
```scheme
(begin
  (motion/move-to (list 'a 0 0) (list 9 0))
  (animation/clear!)
  (let ((once (null? (animation/tweens))))
    (animation/clear!)
    (and once (null? (animation/tweens)))))
; ⇒ #t
```

**cs**
```scheme
(begin
  (animation/clear!)
  (motion/move-to (list 'a 0 0) (list 9 0))
  (= 1 (length (animation/tweens))))
; ⇒ #t
```

- **claim:** clear! empties the set; it is idempotent and independent of prior size.
- **invariant:** `clear(); tweens=∅; clear∘clear = clear; ∀S. clear(S)=∅`

### Row 5 · Emergence — what it composes into

**eng**
```scheme
(define (in-fresh-scene body)
  (animation/clear!)
  (let ((r (body))) (animation/clear!) r))

(in-fresh-scene (lambda ()
                  (motion/move-to (list 'a 0 0)
                                  (list 9 0))
                  (length (animation/tweens))))
; ⇒ 1
```

**math**
```scheme
(define (reset-then f) (animation/clear!) (f))

(reset-then (lambda () (null? (animation/tweens))))
; ⇒ #t
```

**cs**
```scheme
(define (bracket setup teardown body)
  (setup)
  (let ((r (body))) (teardown) r))

(bracket (lambda () (animation/clear!))
         (lambda () (animation/clear!))
         (lambda ()
           (motion/move-to (list 'a 0 0) (list 9 0))
           (length (animation/tweens))))
; ⇒ 1
```

- **emergent:** Compositions: eng fresh-scene wrapper, math reset-to-unit, cs setup/teardown bracket. _Family: reset / with-clean-slate / teardown._

---

_All 45 embedded programs verified: **45/45 green** via `node bin/motoi run /dev/stdin`._