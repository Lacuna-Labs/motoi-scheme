# Row 5 (Composition / Emergence Tier) — With What Else It Composes

**Row-5 structure:** `Base verb → Composition example → Emergent behavior → Meta-explanation`.

Row 5 teaches WITH WHAT ELSE a verb composes — the macro-like
patterns, higher-order combinations, and emergent behaviors that
appear when the verb is chained with others. Together with Rows 1-4,
Row 5 completes the ladder:

- Row 1 = HOW
- Row 2 = WHEN
- Row 3 = WHERE ELSE
- Row 4 = WHY
- Row 5 = WITH WHAT

**Wire form.** Composition patterns that persist across processes
(mailbox pipelines, cortex-to-Loam bridges, artifact state save/load)
serialize via SLAT — see `SAKURA-SCHEME-1.0.REF.md` §SLAT for the
reader/writer verbs, and the `slat/canonical` verb for byte-stable
composition (two consumers compose the same records and reach the
same canonical form).

Row 5 ties to Wittgenstein-late (family resemblance via composition —
verbs earn their meaning by how they combine, not by what they are in
isolation) and Lacan (metonymy in emergence — new behaviors appear
from packing verbs near each other, not from any single verb's
semantics).

Every entry runs standalone.

---

### motion/hop — Row 5 (composition tier)

**Base:** `motion/hop` — quantized advance on a grid.

**Composition example:** hop chained with `note/strike` produces a
step-sequencer.

```scheme
;; Each hop advances one grid cell; each hop plays a note at its target.

(define (step-sequence grid pitches)
  (let loop ([pos 0] [pitches pitches])
    (cond
      [(null? pitches) 'done]
      [else
       (note/strike :pitch (car pitches) :time (/ pos 8) :dur 0.25)
       (loop (motion/hop :from pos :to (+ pos 1) :grid grid)
             (cdr pitches))])))

(step-sequence 8 '(60 64 67 72 67 64))
```

**Emergent behavior:** the grid quantization of `hop` becomes the beat
grid; the sequential structure of `note/strike` becomes the phrase.
Neither verb alone knows about "sequences." Together, they produce one.

**Meta-explanation:** Composition creates a *kind of thing* neither
verb carries alone. Wittgenstein-late: the "sequencer" family emerges
from the way hop and strike resemble each other in composition — both
are time-structured, both are quantized. Lacan: packing them near each
other creates a new region of the graph, one with its own family of
uses (arpeggiator, drum machine, MIDI step-programmer).

---

### motion/curve — Row 5 (composition tier)

**Base:** `motion/curve` — smooth interpolation between two states.

**Composition example:** curve chained with itself produces a spring.

```scheme
;; Two curves in opposite directions with decreasing amplitude:
;; a spring that settles.

(define (spring! target start)
  (motion/curve :from start :to target :ease 'ease-out :dur 200)
  (motion/curve :from target :to (mid-point start target 0.3) :ease 'ease-out :dur 150)
  (motion/curve :from (mid-point start target 0.3) :to target
                :ease 'ease-out :dur 100))

(define (mid-point a b t)
  (+ a (* t (- b a))))
```

**Emergent behavior:** a single settle motion appears from three
curves in decreasing amplitude. The verb `motion/curve` does not know
about "settling"; the composition does.

**Meta-explanation:** Emergence via *iteration with decay*. Same base
verb, different parameters each time, and a physical-feeling behavior
appears. Peirce: the sign for "spring" is composed of three
sub-signs.

---

### note/strike — Row 5 (composition tier)

**Base:** `note/strike` — a discrete sound event at a time.

**Composition example:** strike composed with `parallel` and delay
produces a chord that arpeggiates.

```scheme
;; A chord that arpeggiates as it plays.

(define (arpeggiated-chord pitches base-time delay-per-note)
  (for-each (lambda (p i)
              (note/strike :pitch p
                           :time (+ base-time (* i delay-per-note))
                           :dur 0.5))
            pitches
            (iota (length pitches))))

(arpeggiated-chord '(60 64 67 72) 0 0.03)
```

**Emergent behavior:** four notes offset by 30 ms become the "harp-
strum" texture. The delay pattern is what makes it a strum rather than
a hit.

**Meta-explanation:** Micro-timing composition creates macro-texture.
Wittgenstein-late: "strum" and "hit" are family-resemblance concepts
distinguished only by the delay parameter, not by verb type.

---

### form/triangle — Row 5 (composition tier)

**Base:** `form/triangle` — three points, one shape.

**Composition example:** triangle composed with `for-each` builds a
mesh.

```scheme
;; A triangle mesh from a list of vertex-triples.

(define (mesh-from-triples vertex-triples)
  (map (lambda (v3)
         (form/triangle (car v3) (cadr v3) (caddr v3)))
       vertex-triples))

(define triangles-of-square
  '(((0 0) (1 0) (0 1))
    ((1 0) (1 1) (0 1))))

(mesh-from-triples triangles-of-square)
```

**Emergent behavior:** a square appears from two triangles. A polygon
of any shape appears from N-2 triangles. The mesh IS the composition.

**Meta-explanation:** Emergence via aggregation. Peirce: the mesh sign
is compositionally built from triangle signs. Ties to
`form/decompose-into-triangles` — the inverse operation.

---

### form/decompose-into-triangles — Row 5 (composition tier)

**Base:** `form/decompose-into-triangles` — polygon → triangle set.

**Composition example:** decomposition composed with per-triangle
fills produces a gradient polygon.

```scheme
;; A polygon rendered with per-triangle color, producing a gradient effect.

(define (gradient-polygon polygon colors)
  (for-each (lambda (triangle color)
              (surface/fill triangle :color color))
            (form/decompose-into-triangles polygon)
            colors))

(gradient-polygon polygon-pentagon '(red orange yellow))
```

**Emergent behavior:** a gradient fill appears without a gradient
verb. The stepwise coloring of triangles APPROXIMATES a gradient.

**Meta-explanation:** Emergence by approximation. Fine-grained
decomposition + per-piece variation = smooth-looking whole.

---

### surface/fill — Row 5 (composition tier)

**Base:** `surface/fill` — solid color into a region.

**Composition example:** fill composed with `time/every-ms` produces
animation.

```scheme
;; A shape whose color pulses over time.

(define (pulsing-fill region base-color)
  (time/every-ms 100
    (lambda (tick)
      (let ([alpha (+ 0.5 (* 0.5 (sin (/ tick 200))))])
        (surface/fill region :color base-color :alpha alpha)))))
```

**Emergent behavior:** static fill + periodic tick = *breathing shape*.

**Meta-explanation:** Time-modulated composition creates *life*.
Peirce: the fill sign becomes the pulse sign when paired with time.

---

### sakura/say — Row 5 (composition tier)

**Base:** `sakura/say` — output text with register.

**Composition example:** say composed with `system/why-i-just` yields
a self-transparent utterance.

```scheme
;; Speaking and explaining her word choice in the same beat.

(define (self-transparent-say text register)
  (sakura/say text :register register)
  (system/why-i-just
   :decision `(register . ,register)
   :reason "the operator's message was quiet, so I matched"
   :confidence 'high))
```

**Emergent behavior:** the operator hears both the response AND the
reason for its shape. That transparency creates trust.

**Meta-explanation:** Composition surfaces meta-cognition. Peirce: the
self-report becomes a sign of trustworthiness.

---

### memory/recall — Row 5 (composition tier)

**Base:** `memory/recall` — return last-bound value or #f.

**Composition example:** recall composed with `remember!` and a
default produces "recall-or-store."

```scheme
;; If we remember it, return it. Otherwise, compute + store.

(define (recall-or-store key thunk)
  (let ([existing (memory/recall key)])
    (cond
      [existing existing]
      [else
       (let ([computed (thunk)])
         (remember! key computed)
         computed)])))
```

**Emergent behavior:** a *cache* appears. The composition IS the
cache.

**Meta-explanation:** Composition creates a new abstraction (memoization).
Wittgenstein-late: memoization is a family-resemblance concept;
different cache flavors (LRU, permanent, TTL) all emerge from
variations of this pattern.

---

### cortex/recall — Row 5 (composition tier)

**Base:** `cortex/recall` — network memory with 3-way return.

**Composition example:** cortex/recall composed with `memory/recall`
as fallback produces "read-through cache."

```scheme
;; Try Cortex first; fall back to local memory on 'unavailable.

(define (read-through key)
  (let ([cortex-result (cortex/recall key)])
    (cond
      [(eq? cortex-result 'unavailable) (memory/recall key)]
      [else cortex-result])))
```

**Emergent behavior:** graceful degradation — Cortex answers when
online, local answers when offline. No hallucinated bridge.

**Meta-explanation:** Composition preserves honest-null through the
degradation.

---

### calc/derivative — Row 5 (composition tier)

**Base:** `calc/derivative` — numeric or symbolic differentiation.

**Composition example:** derivative composed with itself produces
higher-order derivatives.

```scheme
;; The second derivative = derivative of the derivative.

(define (nth-derivative n f)
  (cond
    [(zero? n) f]
    [else (nth-derivative (- n 1) (calc/derivative f))]))

(define f (lambda (x) (* x x x)))    ;; d/dx = 3x^2, d²/dx² = 6x

(display ((nth-derivative 2 f) 4))
(newline)
;; Prints: 24 (= 6*4)
```

**Emergent behavior:** an *operator that produces operators*. The
whole differential-operator algebra emerges.

**Meta-explanation:** Higher-order composition creates categorical
structure. Ties to Book of Math Part II — differential geometry.

---

### num/root — Row 5 (composition tier)

**Base:** `num/root` — nth root by Newton iteration.

**Composition example:** root composed with itself yields nested
roots.

```scheme
;; Fourth-root of x = square-root of square-root of x.

(define (fourth-root x tolerance)
  (num/root 2 (num/root 2 x tolerance) tolerance))

(display (fourth-root 16 1e-6))
(newline)
;; Prints: ~2.0
```

**Emergent behavior:** the identity `√(√x) = ⁴√x` becomes a runnable
program.

**Meta-explanation:** Composition of same-verb calls encodes
mathematical identities. Peirce: the composition IS the theorem.

---

### opt/minimize — Row 5 (composition tier)

**Base:** `opt/minimize` — find local minimum.

**Composition example:** minimize composed with random restart produces
a *global* minimizer.

```scheme
;; Random-restart optimization.

(define (global-minimize f start-region restarts)
  (let loop ([best +inf.0] [i 0])
    (cond
      [(>= i restarts) best]
      [else
       (let* ([x0 (random-in start-region)]
              [x-star (opt/minimize f x0)]
              [candidate (f x-star)])
         (loop (min best candidate) (+ i 1)))])))
```

**Emergent behavior:** a *global* method emerges from a *local* verb.

**Meta-explanation:** Composition escalates local guarantees into
probabilistic global ones.

---

### vec/dot — Row 5 (composition tier)

**Base:** `vec/dot` — inner product.

**Composition example:** dot composed with matrix rows produces
matrix-vector multiplication.

```scheme
;; Matrix-vector multiplication as row-wise dot.

(define (mat-vec-mul M v)
  (map (lambda (row) (vec/dot row v)) M))

(define M '((1 0 0) (0 1 0) (0 0 1)))
(define v '(3 4 5))

(display (mat-vec-mul M v))
(newline)
;; Prints: (3 4 5)
```

**Emergent behavior:** the whole linear-algebra tower emerges from
inner products.

**Meta-explanation:** One base operation, one composition rule, one
tower. Peirce: mat-vec is a compound sign built from dot signs.

---

### matrix/transpose — Row 5 (composition tier)

**Base:** `matrix/transpose` — swap rows and columns.

**Composition example:** transpose composed with multiplication
produces the Gram matrix.

```scheme
;; Gram matrix = M^T · M.
(define (gram M)
  (mat-mul (matrix/transpose M) M))
```

**Emergent behavior:** the Gram matrix appears from a two-step
composition. It carries all the inner products of columns.

**Meta-explanation:** Two verbs, one algebraically meaningful compound.

---

### sym/simplify — Row 5 (composition tier)

**Base:** `sym/simplify` — normalize a symbolic expression.

**Composition example:** simplify composed with `calc/derivative`
produces "simplified derivative" (the useful form).

```scheme
(define (nice-derivative expr)
  (sym/simplify (calc/derivative expr)))
```

**Emergent behavior:** a mathematically-useful output (unlike the raw
derivative, which is often messy).

**Meta-explanation:** Composition post-processes raw output into
human-readable form.

---

### place/recall — Row 5 (composition tier)

**Base:** `place/recall` — location with coords + kind.

**Composition example:** place/recall composed with `nature/recall`
produces "ecosystem context."

```scheme
(define (ecosystem-context place-name)
  (let ([p (place/recall place-name)]
        [flora (nature/recall (native-flora-of place-name))])
    (list :place p :flora flora)))
```

**Emergent behavior:** a compound "place with life in it" emerges.

**Meta-explanation:** Cross-domain composition creates richer world
grounding.

---

### event/recall — Row 5 (composition tier)

**Base:** `event/recall` — causally ordered events.

**Composition example:** event/recall composed with `world/knowledge`
produces "event with context."

```scheme
(define (event-with-context evt-key)
  (list :event (event/recall evt-key)
        :world-layer (world/knowledge evt-key)))
```

**Emergent behavior:** every event carries its meta-explanation.

**Meta-explanation:** Composition makes causality legible.

---

### science/recall — Row 5 (composition tier)

**Base:** `science/recall` — cited facts.

**Composition example:** science/recall composed with `sym/simplify`
produces cited formulae.

```scheme
;; Return a formula with its source.
(define (cited-formula key)
  (let ([fact (science/recall key)])
    (list :formula (sym/simplify (fact-formula fact))
          :source (fact-source fact))))
```

**Emergent behavior:** the formula is presentable AND checkable.

**Meta-explanation:** Composition preserves epistemic integrity.

---

### movement/recall — Row 5 (composition tier)

**Base:** `movement/recall` — continuous trajectory.

**Composition example:** movement/recall composed with `cine/follow`
produces a replay-camera.

```scheme
(define (replay-with-camera trajectory)
  (for-each (lambda (position-at-t)
              (cine/follow position-at-t))
            trajectory))
```

**Emergent behavior:** the camera automatically follows the recalled
motion.

---

### culture/recall — Row 5 (composition tier)

**Base:** `culture/recall` — culturally-scoped fact.

**Composition example:** culture/recall composed with `sakura/say`
produces register-appropriate speech.

```scheme
;; Register auto-adapts to cultural context.
(define (culturally-aware-greeting culture)
  (let ([facts (culture/recall (greeting-form culture))])
    (sakura/say (fact-content facts)
                :register (fact-register facts))))
```

**Emergent behavior:** speaking in-culture, not out.

---

### nature/recall — Row 5 (composition tier)

**Base:** `nature/recall` — taxonomically-anchored fact.

**Composition example:** nature/recall composed with `time/every-ms`
yields seasonal awareness.

```scheme
(define (bloom-check t)
  (let ([blooming (nature/recall (blooms-in-season (current-season t)))])
    (report blooming)))
```

**Emergent behavior:** time-sensitive natural knowledge.

---

### book/recall — Row 5 (composition tier)

**Base:** `book/recall` — locator-carrying passage.

**Composition example:** book/recall composed with `book/example`
produces a book-quiz.

```scheme
(define (quiz-from-book book-key)
  (let ([passage (book/recall book-key)]
        [example (book/example book-key)])
    (list :read passage :try example)))
```

**Emergent behavior:** a study aide.

---

### book/example — Row 5 (composition tier)

**Base:** `book/example` — runnable book snippet.

**Composition example:** book/example composed with `sym/simplify`
produces a simplification quiz.

```scheme
(define (simplification-quiz)
  (let* ([example (book/example 'algebra-2)]
         [target (sym/simplify example)])
    (list :original example :simplified target)))
```

**Emergent behavior:** a self-testing loop.

---

### system/self — Row 5 (composition tier)

**Base:** `system/self` — introspective report.

**Composition example:** system/self composed with `sakura/say`
produces honest disclosure.

```scheme
(define (honest-status)
  (let ([s (system/self)])
    (sakura/say (self-summary s) :register 'flat-honest)))
```

**Emergent behavior:** the deadpan reality check (§G in _recovered-extensions).

**Meta-explanation:** Composition instantiates a doctrine.

---

### system/why-i-just — Row 5 (composition tier)

**Base:** `system/why-i-just` — post-hoc-safe causal explanation.

**Composition example:** why-i-just composed with `system/reflect`
produces an audit trail.

```scheme
(define (audit-trail decisions)
  (map system/why-i-just decisions))

(define (audit-summary trail)
  (system/reflect trail))
```

**Emergent behavior:** an inspectable decision log.

---

### system/reflect — Row 5 (composition tier)

**Base:** `system/reflect` — lossless summary of key facts.

**Composition example:** reflect composed with `memory/recall`
produces episodic-summary retrieval.

```scheme
(define (episodic-summary time-range)
  (system/reflect (memory/recall-range time-range)))
```

**Emergent behavior:** "what did I do this morning?"

---

### world/knowledge — Row 5 (composition tier)

**Base:** `world/knowledge` — three-layer grounded facts.

**Composition example:** world/knowledge composed with `sakura/say`
produces grounded speech.

```scheme
(define (grounded-explanation topic)
  (let ([layers (world/knowledge topic)])
    (sakura/say (three-layer-render layers)
                :register 'informational)))
```

**Emergent behavior:** she talks WITH grounding, not from nothing.

---

### tick/sine — Row 5 (composition tier)

**Base:** `tick/sine` — mathematical sine sample.

**Composition example:** tick/sine composed with `surface/fill` yields
a breathing UI element.

```scheme
(define (breathing-fill region t)
  (let ([alpha (+ 0.5 (* 0.5 (tick/sine (/ t 1000))))])
    (surface/fill region :alpha alpha)))
```

**Emergent behavior:** a shape "breathes."

---

### entity/move! — Row 5 (composition tier)

**Base:** `entity/move!` — Newtonian-aware movement.

**Composition example:** entity/move! composed with `collision/on-hit`
produces bouncing.

```scheme
(define (bounce-loop!)
  (entity/move! ball :velocity current-velocity)
  (collision/on-hit ball wall
    (lambda ()
      (set! current-velocity (- current-velocity)))))
```

**Emergent behavior:** a bouncing ball, from two verbs.

---

### part/nod — Row 5 (composition tier)

**Base:** `part/nod` — amplitude-bounded head motion.

**Composition example:** nod composed with `sakura/say` produces
sync'd embodiment.

```scheme
(define (say-with-nod text)
  (part/nod :amplitude 10 :dur 300)
  (sakura/say text :register 'affirming))
```

**Emergent behavior:** nonverbal + verbal alignment.

---

### animation/frame — Row 5 (composition tier)

**Base:** `animation/frame` — deterministic time-to-state.

**Composition example:** frame composed with `time/every-ms` yields
tick-driven animation.

```scheme
(define (animate!)
  (time/every-ms 16
    (lambda (t) (render! (animation/frame t)))))
```

**Emergent behavior:** the animation.

---

### sprite/address — Row 5 (composition tier)

**Base:** `sprite/address` — stable identity.

**Composition example:** address composed with `collision/on-hit`
produces identity-safe callbacks.

```scheme
(define (bind-collision! sprite on-hit-fn)
  (register-callback! (sprite/address sprite) on-hit-fn))
```

**Emergent behavior:** callbacks that survive sprite mutation.

---

### scene/frame — Row 5 (composition tier)

**Base:** `scene/frame` — sprite-composition.

**Composition example:** scene/frame composed with `radio/scene-loop`
produces a loop.

```scheme
(define (looped-scene sprites)
  (radio/scene-loop (scene/frame sprites)))
```

**Emergent behavior:** an animation loop.

---

### time/every-ms — Row 5 (composition tier)

**Base:** `time/every-ms` — periodic firing with bounded jitter.

**Composition example:** every-ms composed with any tick-consumer
produces the animation clock.

```scheme
(define (start-clock!)
  (time/every-ms 16
    (lambda (t) (animation-step! t))))
```

**Emergent behavior:** the whole runtime clock is one verb + one
consumer.

---

### ai/seek — Row 5 (composition tier)

**Base:** `ai/seek` — monotone seek toward target.

**Composition example:** seek composed with `time/every-ms` produces
continuous pursuit.

```scheme
(define (pursue! agent target)
  (time/every-ms 100
    (lambda (t) (ai/seek agent target))))
```

**Emergent behavior:** the whole pursuit behavior.

---

### group/each — Row 5 (composition tier)

**Base:** `group/each` — one-application-per-element.

**Composition example:** each composed with `entity/move!` produces
group motion.

```scheme
(define (move-group! entities dv)
  (group/each entities
    (lambda (e) (entity/move! e :velocity dv))))
```

**Emergent behavior:** coordinated movement.

---

### collision/on-hit — Row 5 (composition tier)

**Base:** `collision/on-hit` — exact overlap detection.

**Composition example:** on-hit composed with `note/strike` produces
audio feedback.

```scheme
(define (audio-hit! entity-a entity-b)
  (collision/on-hit entity-a entity-b
    (lambda () (note/strike :pitch 60 :time 0 :dur 0.1))))
```

**Emergent behavior:** a game with sound effects.

---

### shoppe/open — Row 5 (composition tier)

**Base:** `shoppe/open` — idempotent shoppe activation.

**Composition example:** shoppe/open composed with `pane/read-along`
yields a tour.

```scheme
(define (tour-shoppe!)
  (shoppe/open)
  (pane/read-along "Welcome to the shoppe. Take a look around."))
```

**Emergent behavior:** onboarding.

---

### pane/read-along — Row 5 (composition tier)

**Base:** `pane/read-along` — monotone reading position.

**Composition example:** read-along composed with `sakura/say`
produces highlighted narration.

```scheme
(define (narrate-line line register)
  (pane/read-along line :step (line-length line))
  (sakura/say line :register register))
```

**Emergent behavior:** synchronized text + voice.

---

### ditoo/render — Row 5 (composition tier)

**Base:** `ditoo/render` — pure pixel rendering.

**Composition example:** ditoo/render composed with `animation/frame`
produces a rendered animation.

```scheme
(define (render-animation!)
  (time/every-ms 16
    (lambda (t)
      (ditoo/render (animation/frame t)))))
```

**Emergent behavior:** on-screen movement.

---

### radio/scene-loop — Row 5 (composition tier)

**Base:** `radio/scene-loop` — periodic scene rotation.

**Composition example:** scene-loop composed with `note/strike`
produces a synth loop.

```scheme
(define (synth-loop! notes)
  (radio/scene-loop
    (lambda (tick)
      (note/strike :pitch (list-ref notes (modulo tick (length notes)))
                   :time 0 :dur 0.25))))
```

**Emergent behavior:** a musical loop.

---

### cine/follow — Row 5 (composition tier)

**Base:** `cine/follow` — bounded-distance camera-to-target.

**Composition example:** cine/follow composed with `entity/move!`
produces a chase-cam.

```scheme
(define (chase-cam!)
  (entity/move! player :velocity player-input)
  (cine/follow player-position))
```

**Emergent behavior:** a working third-person camera.

---

---

# Row 5 — Extension to all 210 REFERENCE.md sections

The 42 entries above are the abstract-conceptual coverage authored by
the second architect (PR #73). The extension below authors Row 5 for
every REFERENCE.md section, batched by family.

---

## Batch A · Reserved forms and special syntax (section 1)

### `and` — Row 5 (composition tier)

**Base:** `and` — short-circuit conjunction.

**Composition example:** `and` composed with a predicate chain gives
guarded computation.

```scheme
(define (safe-div a b)
  (and (number? b) (not (zero? b)) (/ a b)))
(display (list (safe-div 10 2) (safe-div 10 0) (safe-div 10 'x)))
(newline)
;; Prints: (5 #f #f)
```

**Emergent behavior:** input validation without an if/else pyramid.

**Meta-explanation:** `and` as validator. Wittgenstein-late: guards form a
family with `when`; the boundary is fuzzy. Lacan: packing predicates
next to computation shifts meaning from "AND" to "safety net."

---

### `begin` — Row 5 (composition tier)

**Base:** `begin` — sequential execution, last-wins.

**Composition example:** `begin` composed with `set!` gives a
side-effecting sequence.

```scheme
(define score 0)
(define final
  (begin (set! score (+ score 1))
         (set! score (+ score 2))
         score))
(display final)
(newline)
;; Prints: 3
```

**Emergent behavior:** an imperative block.

**Meta-explanation:** Sequencing composed with mutation = imperative
programming. Wittgenstein-late: the family "block" resembles what other
languages call `{}`.

---

### `case` — Row 5 (composition tier)

**Base:** `case` — one-arm dispatch by `eqv?`.

**Composition example:** `case` composed with a `for-each` produces a
finite-state event handler.

```scheme
(define events '(open click close click))
(for-each (lambda (e)
            (case e
              ((open)  (display "opening "))
              ((click) (display "clicking "))
              ((close) (display "closing "))))
          events)
(newline)
```

**Emergent behavior:** an event dispatcher.

**Meta-explanation:** Dispatch × iteration = handler. Lacan: `case` and
`for-each` packed next to each other pull the meaning toward "event
loop."

---

### `cond` — Row 5 (composition tier)

**Base:** `cond` — first-matching-arm dispatch.

**Composition example:** `cond` composed with recursion produces a
finite-state machine.

```scheme
(define (state-run state)
  (cond
    ((eq? state 'start) (state-run 'middle))
    ((eq? state 'middle) (state-run 'end))
    ((eq? state 'end) 'done)))
(display (state-run 'start))
(newline)
```

**Emergent behavior:** an explicit state machine.

**Meta-explanation:** Recursion × cond = FSM. Wittgenstein-late:
"FSM" and "cond with recursion" are the same family.

---

### `define` — Row 5 (composition tier)

**Base:** `define` — binding in scope.

**Composition example:** `define` composed with `lambda` produces
named functions.

```scheme
(define square (lambda (x) (* x x)))
(display (square 5))
(newline)
;; Prints: 25
```

**Emergent behavior:** functions as named citizens.

**Meta-explanation:** Naming × abstraction = programming.

---

### `if` — Row 5 (composition tier)

**Base:** `if` — two-branch dispatch.

**Composition example:** `if` composed with recursion produces a
recursive function.

```scheme
(define (fact n) (if (zero? n) 1 (* n (fact (- n 1)))))
(display (fact 5))
(newline)
;; Prints: 120
```

**Emergent behavior:** recursion as loop.

**Meta-explanation:** `if` + recursion = the primitive loop.

---

### `lambda` — Row 5 (composition tier)

**Base:** `lambda` — closure creation.

**Composition example:** `lambda` composed with `map` produces
transformations.

```scheme
(display (map (lambda (x) (* x 2)) '(1 2 3)))
(newline)
;; Prints: (2 4 6)
```

**Emergent behavior:** functional pipelines.

**Meta-explanation:** Lambda is the atom of composition.

---

### `let` — Row 5 (composition tier)

**Base:** `let` — parallel local binding.

**Composition example:** `let` composed with `lambda` produces
closure-over-environment.

```scheme
(define counter
  (let ((n 0))
    (lambda () (set! n (+ n 1)) n)))
(display (list (counter) (counter) (counter)))
(newline)
;; Prints: (1 2 3)
```

**Emergent behavior:** stateful closures.

**Meta-explanation:** `let` + `lambda` = private state.

---

### `let*` — Row 5 (composition tier)

**Base:** `let*` — sequential local binding.

**Composition example:** `let*` composed with intermediate calculations
produces staged data flow.

```scheme
(let* ((x 10) (y (* x 2)) (z (+ x y)))
  (display z))
(newline)
;; Prints: 30
```

**Emergent behavior:** clean pipelines.

**Meta-explanation:** Sequential binding = readable computation.

---

### `not` — Row 5 (composition tier)

**Base:** `not` — boolean flip.

**Composition example:** `not` composed with a predicate inverts filtering.

```scheme
(display (filter (lambda (x) (not (even? x))) '(1 2 3 4)))
(newline)
;; Prints: (1 3)
```

**Emergent behavior:** negated selection.

**Meta-explanation:** Not × filter = anti-filter.

---

### `or` — Row 5 (composition tier)

**Base:** `or` — first-truthy-wins.

**Composition example:** `or` composed with `memory/recall` gives
"read, or default."

```scheme
(define (default-recall k default)
  (or (memory/recall k) default))
```

**Emergent behavior:** graceful defaults.

**Meta-explanation:** Or × recall = default chain.

---

### `quote` — Row 5 (composition tier)

**Base:** `quote` — inert form.

**Composition example:** `quote` composed with macros gives code-as-data
metaprogramming.

```scheme
(define pattern '(if x then y else z))
(display (car pattern))
(newline)
;; Prints: if
```

**Emergent behavior:** code manipulation.

**Meta-explanation:** Homoiconicity is what makes Scheme Scheme.

---

### `quasiquote` — Row 5 (composition tier)

**Base:** `quasiquote` — template with holes.

**Composition example:** `quasiquote` composed with generation yields
code-templating.

```scheme
(define (make-greeting name)
  `(display ,(string-append "Hello, " name)))
(display (make-greeting "world"))
(newline)
```

**Emergent behavior:** DSL construction.

**Meta-explanation:** Quasiquote × generation = little languages.

---

### `set!` — Row 5 (composition tier)

**Base:** `set!` — mutation.

**Composition example:** `set!` composed with `lambda` gives stateful
functions.

```scheme
(define counter
  (let ((n 0))
    (lambda () (set! n (+ n 1)) n)))
(counter) (counter)
(display (counter))
(newline)
;; Prints: 3
```

**Emergent behavior:** counters, caches, closures with memory.

**Meta-explanation:** Mutation is a compositional primitive.

---

### `unless` — Row 5 (composition tier)

**Base:** `unless` — one-armed if for the false case.

**Composition example:** `unless` composed with `error` gives
precondition checks.

```scheme
(define (sqrt-positive x)
  (unless (>= x 0)
    (error "negative"))
  (sqrt x))
```

**Emergent behavior:** guarded entry points.

**Meta-explanation:** Unless × error = defensive programming.

---

### `when` — Row 5 (composition tier)

**Base:** `when` — one-armed if for the true case.

**Composition example:** `when` composed with side effects gives
conditional logging.

```scheme
(define debug? #t)
(define (log msg)
  (when debug? (display msg) (newline)))
(log "computed step 1")
```

**Emergent behavior:** feature-flagged behavior.

**Meta-explanation:** When × effect = optional branch.

---

## Batch B · List and sequence primitives (section 2)

### `append` — Row 5 (composition tier)

**Base:** `append` — list concatenation.

**Composition example:** `append` composed with `map` produces
`flat-map`.

```scheme
(define (flat-map f lst) (apply append (map f lst)))
(display (flat-map (lambda (x) (list x x)) '(1 2 3)))
(newline)
;; Prints: (1 1 2 2 3 3)
```

**Emergent behavior:** the monadic bind for lists.

**Meta-explanation:** Append × map = flatMap.

---

### `assoc` — Row 5 (composition tier)

**Base:** `assoc` — key-lookup on alist.

**Composition example:** `assoc` composed with `map` gives a bulk
lookup.

```scheme
(define alist '((a 1) (b 2) (c 3)))
(display (map (lambda (k) (cdr (assoc k alist))) '(a c)))
(newline)
;; Prints: ((1) (3))
```

**Emergent behavior:** selective projection.

**Meta-explanation:** Assoc × map = projection.

---

### `car` — Row 5 (composition tier)

**Base:** `car` — pair head.

**Composition example:** `car` composed with `map` yields column projection.

```scheme
(define rows '((a 1) (b 2) (c 3)))
(display (map car rows))
(newline)
;; Prints: (a b c)
```

**Emergent behavior:** column extraction.

---

### `cdr` — Row 5 (composition tier)

**Base:** `cdr` — pair tail.

**Composition example:** `cdr` composed with recursion gives list traversal.

```scheme
(define (last lst) (if (null? (cdr lst)) (car lst) (last (cdr lst))))
(display (last '(a b c d)))
(newline)
;; Prints: d
```

**Emergent behavior:** tail-oriented traversal.

---

### `cons` — Row 5 (composition tier)

**Base:** `cons` — pair construction.

**Composition example:** `cons` composed with recursion builds lists
head-first.

```scheme
(define (from-to a b) (if (>= a b) '() (cons a (from-to (+ a 1) b))))
(display (from-to 0 5))
(newline)
;; Prints: (0 1 2 3 4)
```

**Emergent behavior:** list builders.

---

### `filter` — Row 5 (composition tier)

**Base:** `filter` — predicate-based selection.

**Composition example:** `filter` composed with `map` gives
select-then-transform.

```scheme
(define nums '(1 2 3 4 5))
(display (map (lambda (x) (* x x))
              (filter odd? nums)))
(newline)
;; Prints: (1 9 25)
```

**Emergent behavior:** pipeline stage.

---

### `for-each` — Row 5 (composition tier)

**Base:** `for-each` — effectful iteration.

**Composition example:** `for-each` composed with a mutation gives a
counter.

```scheme
(define n 0)
(for-each (lambda (_) (set! n (+ n 1))) '(a b c d))
(display n)
(newline)
;; Prints: 4
```

**Emergent behavior:** counting.

---

### `length` — Row 5 (composition tier)

**Base:** `length` — list size.

**Composition example:** `length` composed with `filter` counts matches.

```scheme
(display (length (filter even? '(1 2 3 4 5 6))))
(newline)
;; Prints: 3
```

**Emergent behavior:** counting matches.

---

### `list` — Row 5 (composition tier)

**Base:** `list` — variadic list construction.

**Composition example:** `list` composed with `map` returns list-of-pairs.

```scheme
(display (map list '(a b c) '(1 2 3)))
(newline)
;; Prints: ((a 1) (b 2) (c 3))
```

**Emergent behavior:** zip.

---

### `map` — Row 5 (composition tier)

**Base:** `map` — structure-preserving transform.

**Composition example:** `map` composed with `map` gives 2D transform.

```scheme
(define grid '((1 2 3) (4 5 6)))
(display (map (lambda (row) (map (lambda (x) (* x 2)) row)) grid))
(newline)
;; Prints: ((2 4 6) (8 10 12))
```

**Emergent behavior:** matrix scaling.

---

### `member` — Row 5 (composition tier)

**Base:** `member` — sublist from first match.

**Composition example:** `member` composed with `cdr` gives after-match tail.

```scheme
(display (cdr (member 'b '(a b c d))))
(newline)
;; Prints: (c d)
```

**Emergent behavior:** slice-from-marker.

---

### `nth` — Row 5 (composition tier)

**Base:** `nth` — zero-indexed access.

**Composition example:** `nth` composed with a range gives sample values.

```scheme
(define lst '(10 20 30 40 50))
(display (map (lambda (i) (list-ref lst i)) '(0 2 4)))
(newline)
;; Prints: (10 30 50)
```

**Emergent behavior:** sparse sampling.

---

### `range` — Row 5 (composition tier)

**Base:** `range` — half-open interval as list.

**Composition example:** `range` composed with `map` gives arithmetic
sequences.

```scheme
(display (map (lambda (i) (* i i)) (range 0 5)))
(newline)
;; Prints: (0 1 4 9 16)
```

**Emergent behavior:** generated sequences.

---

### `reduce` — Row 5 (composition tier)

**Base:** `reduce` — left-fold.

**Composition example:** `reduce` composed with `map` gives sum-of-squares.

```scheme
(display (reduce + 0 (map (lambda (x) (* x x)) '(1 2 3 4))))
(newline)
;; Prints: 30
```

**Emergent behavior:** aggregations.

---

### `reverse` — Row 5 (composition tier)

**Base:** `reverse` — order flip.

**Composition example:** `reverse` composed with build-then-reverse
gives right-appending in cons-first code.

```scheme
(define (accumulate lst)
  (reverse (fold-left cons '() lst)))
(display (accumulate '(1 2 3)))
(newline)
;; Prints: (1 2 3)
```

**Emergent behavior:** efficient list builder.

---

## Batch C · Math and numeric (section 3)

### `+ - * /` — Row 5 (composition tier)

**Base:** arithmetic.

**Composition example:** arithmetic composed with `fold` gives series
sums.

```scheme
(display (reduce + 0 (range 1 11)))
(newline)
;; Prints: 55
```

**Emergent behavior:** sum-of-natural-numbers.

---

### `abs` — Row 5 (composition tier)

**Base:** `abs` — non-negative magnitude.

**Composition example:** `abs` composed with subtraction gives
distance-on-line.

```scheme
(define (dist a b) (abs (- a b)))
(display (dist 3 -5))
(newline)
;; Prints: 8
```

**Emergent behavior:** 1D distance.

---

### `ceiling` — Row 5 (composition tier)

**Base:** `ceiling` — round up.

**Composition example:** `ceiling` composed with division gives
pagination.

```scheme
(define (pages total per) (ceiling (/ total per)))
(display (pages 100 30))
(newline)
;; Prints: 4
```

**Emergent behavior:** page count.

---

### `clamp` — Row 5 (composition tier)

**Base:** `clamp` — bracket to interval.

**Composition example:** `clamp` composed with subtraction gives
saturated arithmetic.

```scheme
(define (sat-sub a b) (clamp (- a b) 0 100))
(display (sat-sub 5 10))
(newline)
;; Prints: 0
```

**Emergent behavior:** saturation.

---

### `expt` — Row 5 (composition tier)

**Base:** `expt` — exponentiation.

**Composition example:** `expt` composed with `map` gives power series.

```scheme
(display (map (lambda (n) (expt 2 n)) '(0 1 2 3 4)))
(newline)
;; Prints: (1 2 4 8 16)
```

**Emergent behavior:** doubling series.

---

### `floor` — Row 5 (composition tier)

**Base:** `floor` — round down.

**Composition example:** `floor` composed with division gives integer div.

```scheme
(define (idiv a b) (floor (/ a b)))
(display (idiv 17 5))
(newline)
;; Prints: 3
```

**Emergent behavior:** truncating integer div.

---

### `lerp` — Row 5 (composition tier)

**Base:** `lerp` — linear interpolation.

**Composition example:** `lerp` composed with `time/every-ms` gives
animation.

```scheme
(define (animate-x start end dur)
  (lambda (t) (lerp start end (/ t dur))))
```

**Emergent behavior:** tweened motion.

---

### `max`, `min` — Row 5 (composition tier)

**Base:** lattice ops.

**Composition example:** `max`/`min` composed with `map` gives
bounding extents.

```scheme
(define points '((1 5) (3 2) (0 4)))
(display (list (apply max (map car points))
               (apply min (map car points))))
(newline)
;; Prints: (3 0)
```

**Emergent behavior:** bounding box.

---

### `mean` — Row 5 (composition tier)

**Base:** arithmetic mean.

**Composition example:** `mean` composed with time-windowing gives
moving average.

```scheme
(define (moving-avg series w)
  (map (lambda (i)
         (/ (apply + (list-tail series i))
            (min w (- (length series) i))))
       (range 0 (- (length series) w -1))))
```

**Emergent behavior:** smoothing.

---

### `modulo` — Row 5 (composition tier)

**Base:** `modulo` — remainder with divisor sign.

**Composition example:** `modulo` composed with iteration gives cycles.

```scheme
(for-each (lambda (i)
            (display (modulo i 3)) (display " "))
          '(0 1 2 3 4 5 6))
(newline)
;; Prints: 0 1 2 0 1 2 0
```

**Emergent behavior:** cyclic index.

---

### `random` family — Row 5 (composition tier)

**Base:** randomness.

**Composition example:** `random` composed with `list-ref` gives
random pick.

```scheme
(define fruits '(apple pear plum))
(display (list-ref fruits (random-int 0 (length fruits))))
(newline)
```

**Emergent behavior:** random choice.

---

### `round` — Row 5 (composition tier)

**Base:** nearest-integer.

**Composition example:** `round` composed with `/` gives
integer-approximation of a fraction.

```scheme
(display (round (/ 7 3)))
(newline)
;; Prints: 2
```

**Emergent behavior:** rational-to-integer.

---

### `sqrt` — Row 5 (composition tier)

**Base:** `sqrt` — non-negative root.

**Composition example:** `sqrt` composed with sum-of-squares gives
Euclidean norm.

```scheme
(define (norm v) (sqrt (apply + (map (lambda (x) (* x x)) v))))
(display (norm '(3 4)))
(newline)
;; Prints: 5
```

**Emergent behavior:** vector magnitude.

---

### `sum` — Row 5 (composition tier)

**Base:** `sum` — list total.

**Composition example:** `sum` composed with `map` gives dot-product.

```scheme
(define (dot u v) (apply + (map * u v)))
(display (dot '(1 2 3) '(4 5 6)))
(newline)
;; Prints: 32
```

**Emergent behavior:** inner product.

---

## Batch D · Cart spine (section 4)

### `act` — Row 5 (composition tier)

**Base:** `act` — verb dispatch + resume.

**Composition example:** `act` composed with `after` gives scheduled
verbs.

```scheme
;; Wait 2 seconds then act.
(after 2 'call-fn (list :fn 'refresh))
```

**Emergent behavior:** timed workflows.

---

### `after` — Row 5 (composition tier)

**Base:** `after` — delayed transition.

**Composition example:** `after` composed with `escalate` gives
timeout escalation.

```scheme
(define (guarded-call fn ms)
  (or (fn)
      (after ms 'timed-out 'escalate)))
```

**Emergent behavior:** timeout guard.

---

### `ctx-get`, `ctx-set`, `ctx-result` — Row 5 (composition tier)

**Base:** context read/write/read-latest.

**Composition example:** these three composed give a functional state
container.

```scheme
(define ctx1 '())
(define ctx2 (cons '(k . 10) ctx1))
(display (cdr (assoc 'k ctx2)))
(newline)
;; Prints: 10
```

**Emergent behavior:** functional state.

---

### `done` — Row 5 (composition tier)

**Base:** `done` — cart terminate.

**Composition example:** `done` composed with `after` gives
timed-completion.

```scheme
(after 10 'wrap-up 'done)
```

**Emergent behavior:** self-terminating cart.

---

### `escalate` — Row 5 (composition tier)

**Base:** `escalate` — labeled failure.

**Composition example:** `escalate` composed with `cond` gives
condition-based escalation.

```scheme
(define (guard v)
  (cond
    ((null? v) (escalate 'null-value '()))
    (else 'ok)))
```

**Emergent behavior:** typed error routes.

---

### `think/deep` — Row 5 (composition tier)

**Base:** `think/deep` — L2 escalation.

**Composition example:** `think/deep` composed with `ask/reasoner` gives
cascade escalation.

```scheme
(define (hard-question q)
  (or (fast-answer q)
      (think/deep 'need-reasoning (list :q q))))
```

**Emergent behavior:** cascade thought.

---

### `ask/reasoner` — Row 5 (composition tier)

**Base:** `ask/reasoner` — external reasoning.

**Composition example:** `ask/reasoner` composed with recall gives
answered-then-remembered.

```scheme
(define (ask-and-remember q)
  (let ((a (ask/reasoner q)))
    (memory/remember! q a)
    a))
```

**Emergent behavior:** learning by asking.

---

### `next` — Row 5 (composition tier)

**Base:** `next` — state transition.

**Composition example:** `next` composed with `cond` gives explicit FSM.

```scheme
(define (transition state)
  (cond
    ((eq? state 'a) (next 'b '()))
    ((eq? state 'b) (next 'c '()))
    (else 'done)))
```

**Emergent behavior:** cart-spine FSM.

---

## Batch E · Cortex, stats, sakura local (sections 5, 5.5, 5.6, 5.7)

### `cortex/recall` (act form) — Row 5 (composition tier)

**Base:** cart-spine dispatch of recall.

**Composition example:** composed with local `memory/recall` fallback
gives graceful degradation.

```scheme
(define (either-recall k)
  (or (cortex-recall k) (memory-recall k)))
```

**Emergent behavior:** honest network partition.

---

### `cortex/remember` — Row 5 (composition tier)

**Base:** persist a value.

**Composition example:** composed with `recall` gives round-trip test.

```scheme
(cortex-remember! 'k 42)
(display (cortex-recall 'k))
(newline)
```

**Emergent behavior:** persistence tests.

---

### `cortex/forget` — Row 5 (composition tier)

**Base:** delete key.

**Composition example:** composed with `after` gives TTL delete.

```scheme
(after 3600 'ttl-expire (list 'forget 'k))
```

**Emergent behavior:** TTL semantics.

---

### `cortex/cosine-topk` — Row 5 (composition tier)

**Base:** top-k by cosine.

**Composition example:** composed with `map` gives retrieval-augmented
generation.

```scheme
(define (rag query k)
  (map fetch-content (cortex/cosine-topk query k)))
```

**Emergent behavior:** RAG.

---

### `cortex/walk` — Row 5 (composition tier)

**Base:** bounded BFS.

**Composition example:** composed with filter gives community discovery.

```scheme
(define (community start depth)
  (filter interesting? (cortex/walk start depth)))
```

**Emergent behavior:** subgraph extraction.

---

### `cortex/multi-store-publish` — Row 5 (composition tier)

**Base:** atomic multi-shop publish.

**Composition example:** composed with `diff-against-shops` gives
"publish only what changed."

```scheme
(define (smart-publish listing shops)
  (let ((diffs (cortex/diff-against-shops listing)))
    (cortex/multi-store-publish listing
      (filter (lambda (s) (assoc s diffs)) shops))))
```

**Emergent behavior:** minimal update.

---

### `cortex/diff-against-shops` — Row 5 (composition tier)

**Base:** compare local to remote per shop.

**Composition example:** composed with report generation gives
"what's stale?" audit.

```scheme
(define (audit listings)
  (map (lambda (l) (cortex/diff-against-shops l)) listings))
```

**Emergent behavior:** staleness report.

---

### `stats/zscore` — Row 5 (composition tier)

**Base:** z-score of a value in a series.

**Composition example:** composed with a threshold gives anomaly detection.

```scheme
(define (anomaly? v s) (> (abs (zscore v s)) 2))
```

**Emergent behavior:** outlier flags.

---

### `stats/delta` — Row 5 (composition tier)

**Base:** signed difference.

**Composition example:** composed with reporting gives period-over-period
report.

```scheme
(define (report before after)
  (list :change (stats/delta before after)
        :direction (if (> after before) 'up 'down)))
```

**Emergent behavior:** trend reporting.

---

### `stats/cooc` — Row 5 (composition tier)

**Base:** co-occurrence count.

**Composition example:** composed with `top_k` gives affinity mining.

```scheme
(define (top-affinities item txs)
  (top-k-cooccurring item txs 5))
```

**Emergent behavior:** market-basket analysis.

---

### `stats/cosine` — Row 5 (composition tier)

**Base:** cosine similarity.

**Composition example:** composed with `map` over candidates gives
ranked similarity.

```scheme
(define (rank-by-cosine query candidates)
  (sort candidates
    (lambda (a b) (> (stats/cosine query a) (stats/cosine query b)))))
```

**Emergent behavior:** ranking.

---

### `stats/percentile` — Row 5 (composition tier)

**Base:** percentile of a value.

**Composition example:** composed with cutoff gives top-decile detection.

```scheme
(define (top-decile? v s) (>= (stats/percentile v s) 0.9))
```

**Emergent behavior:** cohort classification.

---

### `cortex/calendar` — Row 5 (composition tier)

**Base:** chronological entries.

**Composition example:** composed with `filter` gives event history search.

```scheme
(define (events-in-range from to)
  (filter (lambda (e) (and (>= (event-t e) from) (< (event-t e) to)))
          (cortex/calendar)))
```

**Emergent behavior:** windowed history.

---

### `cortex/forget` (ttl form) — Row 5 (composition tier)

**Base:** TTL-based delete.

**Composition example:** composed with `time/every-ms` gives periodic
garbage collection.

```scheme
(time/every-ms 3600000 (lambda (t) (cortex/forget :ttl_days 30)))
```

**Emergent behavior:** GC daemon.

---

### `cortex/cosine-topk` (embedding form) — Row 5 (composition tier)

**Base:** kind-scoped cosine retrieval.

**Composition example:** composed with `sakura/say` gives semantic responses.

```scheme
(define (respond-to q)
  (let ((docs (cortex/cosine-topk :kind 'doc :embedding (embed q) :limit 3)))
    (sakura/say (compose-response docs))))
```

**Emergent behavior:** semantic assistant.

---

### `sakura/say` (mood form) — Row 5 (composition tier)

**Base:** speech with mood tag.

**Composition example:** composed with cortex mood detection gives
context-appropriate voice.

```scheme
(define (talk text)
  (sakura/say text :mood (detect-mood)))
```

**Emergent behavior:** register-adaptive speech.

---

### `sakura/cloud-reason` — Row 5 (composition tier)

**Base:** cloud reasoner call.

**Composition example:** composed with fallback gives resilient reasoning.

```scheme
(define (reason q)
  (let ((r (sakura/cloud-reason q)))
    (if (eq? r 'cloud-unavailable) (local-think q) r)))
```

**Emergent behavior:** local fallback.

---

## Batch F · Marketplace verbs (section 6)

### `etsy/listings` — Row 5 (composition tier)

**Base:** filtered listings.

**Composition example:** composed with `filter` gives operator-side query.

```scheme
(filter (lambda (l) (< (price l) 20)) (etsy/listings 'active))
```

**Emergent behavior:** post-hoc filtering.

---

### `etsy/receipts` — Row 5 (composition tier)

**Base:** chronological receipts.

**Composition example:** composed with `stats/delta` gives revenue trend.

```scheme
(define (revenue-trend period-a period-b)
  (stats/delta (sum-receipts period-a) (sum-receipts period-b)))
```

**Emergent behavior:** revenue analytics.

---

### `etsy/ledger` — Row 5 (composition tier)

**Base:** balanced ledger.

**Composition example:** composed with `reduce +` gives running balance.

```scheme
(define balance (reduce + 0 (map ledger-entry-amount (etsy/ledger))))
```

**Emergent behavior:** current balance.

---

### `ebay/inventory-items` — Row 5 (composition tier)

**Base:** SKU-unique inventory.

**Composition example:** composed with `filter` gives low-stock alerts.

```scheme
(define low (filter (lambda (i) (< (qty i) 5)) (ebay/inventory-items)))
```

**Emergent behavior:** reorder recommendations.

---

### `shopify/orders` — Row 5 (composition tier)

**Base:** filtered orders.

**Composition example:** composed with `for-each` gives batched fulfillment.

```scheme
(for-each fulfill! (shopify/orders (lambda (o) (unpaid? o))))
```

**Emergent behavior:** batch operations.

---

### `meta/catalogs` — Row 5 (composition tier)

**Base:** catalog list.

**Composition example:** composed with `meta/products` gives full inventory.

```scheme
(define all-products
  (apply append (map meta/products (meta/catalogs))))
```

**Emergent behavior:** cross-catalog aggregation.

---

### `instagram/feed-post` and `google/sheets-append-row` — Row 5 (composition tier)

**Base:** post/append.

**Composition example:** composed with a webhook gives auto-social-share.

```scheme
(on-new-order! (lambda (o)
  (instagram/feed-post :caption (order-caption o))
  (google/sheets-append-row :row (order-row o))))
```

**Emergent behavior:** social + logging in one hook.

---

### `ebay/feedback` — Row 5 (composition tier)

**Base:** feedback query.

**Composition example:** composed with `stats/percentile` gives seller
percentile.

```scheme
(define percentile (stats/percentile my-score (feedback-scores)))
```

**Emergent behavior:** benchmarking.

---

### `shopify/customers` — Row 5 (composition tier)

**Base:** paginated customers.

**Composition example:** composed with a loop gives full-list pagination.

```scheme
(define (all-customers)
  (let loop ((cursor 0) (acc '()))
    (let ((page (shopify/customers :cursor cursor)))
      (if (empty? page) acc (loop (next-cursor page) (append acc page))))))
```

**Emergent behavior:** exhaustive scan.

---

### `vision/describe`, `vision/ocr`, `vision/embed` — Row 5 (composition tier)

**Base:** vision primitives.

**Composition example:** composed together give image + text + vector for RAG.

```scheme
(define (index-image url)
  (list :desc (vision/describe url)
        :text (vision/ocr url)
        :vec (vision/embed (vision/describe url))))
```

**Emergent behavior:** multimodal index entry.

---

### `documents/parse` — Row 5 (composition tier)

**Base:** structured parse.

**Composition example:** composed with `filter` gives targeted extraction.

```scheme
(define (find-emails doc)
  (filter email? (parsed-tokens (documents/parse doc))))
```

**Emergent behavior:** entity extraction.

---

### `web/extract-schema` — Row 5 (composition tier)

**Base:** structured web extraction.

**Composition example:** composed with `cortex/remember` gives persistent scrape.

```scheme
(for-each (lambda (r) (cortex/remember! (url r) r))
          (web/extract-schema :urls urls :schema schema))
```

**Emergent behavior:** ingest pipeline.

---

### `web/monitor` — Row 5 (composition tier)

**Base:** change detection.

**Composition example:** composed with `sakura/say` gives change alerts.

```scheme
(when (not (eq? (web/monitor url) 'no-change))
  (sakura/say "Something changed at that URL."))
```

**Emergent behavior:** ambient watchers.

---

### `etsy/create-draft` — Row 5 (composition tier) ⚠ WRITE

**Base:** create draft listing.

**Composition example:** composed with `etsy/upload-image` gives full-listing prep.

```scheme
(define draft (etsy/create-draft :title "Vintage" :price 24))
(etsy/upload-image :listing_id draft :image_url "http://img")
```

**Emergent behavior:** authoring workflow.

---

### `etsy/upload-image` — Row 5 (composition tier) ⚠ WRITE

**Base:** attach image atomically.

**Composition example:** composed with retry gives resilient upload.

```scheme
(define (upload-with-retry lid url tries)
  (let loop ((left tries))
    (if (zero? left) 'failed
        (or (etsy/upload-image :listing_id lid :image_url url)
            (loop (- left 1))))))
```

**Emergent behavior:** robust upload.

---

### `ebay/publish` — Row 5 (composition tier) ⚠ WRITE

**Base:** commit-gated publish.

**Composition example:** composed with dry-run gives preview + confirm.

```scheme
(define (safe-publish oid)
  (dry-run-preview oid)
  (when (operator-confirmed?)
    (ebay/publish :offer_id oid :operator_commit #t)))
```

**Emergent behavior:** human-in-loop publish.

---

## Batch G · Paint and visual primitives (section 7)

### `paint-arrow` — Row 5 (composition tier)

**Base:** anchored arrow.

**Composition example:** composed with `map` over data gives flow diagram.

```scheme
(for-each (lambda (edge)
            (paint-arrow (car edge) (cadr edge) 'gray))
          '(((0 0) (10 0)) ((10 0) (10 10))))
```

**Emergent behavior:** graph rendering.

---

### `paint-burst`, `paint-fireworks` — Row 5 (composition tier)

**Base:** ephemeral bursts.

**Composition example:** composed with `on-hit` gives collision feedback.

```scheme
(collision/on-hit a b
  (lambda () (paint-burst (position a) 'gold 200)))
```

**Emergent behavior:** juicy game feel.

---

### `paint-clear` — Row 5 (composition tier)

**Base:** localized erasure.

**Composition example:** composed with a scheduled fire gives auto-clean.

```scheme
(time/every-ms 5000 (lambda (t) (paint-clear '(0 0 100 100))))
```

**Emergent behavior:** self-cleaning canvas.

---

### `paint-emoji` — Row 5 (composition tier)

**Base:** glyph at pixel.

**Composition example:** composed with a random-pick gives confetti.

```scheme
(for-each (lambda (_)
            (paint-emoji (random-pick '("🌸" "🎉"))
                         (list (random-int 0 500) (random-int 0 500))))
          (range 0 20))
```

**Emergent behavior:** celebration effect.

---

### `paint-flow` — Row 5 (composition tier)

**Base:** glyphs along a line.

**Composition example:** composed with animation gives flowing lines.

```scheme
(time/every-ms 100 (lambda (t)
  (paint-flow start (moving-endpoint t) "•" 5)))
```

**Emergent behavior:** animated conduit.

---

### `paint-glow` — Row 5 (composition tier)

**Base:** timed halo.

**Composition example:** composed with `focus!` gives attention cue.

```scheme
(card-focus! 'card-42)
(paint-glow 'card-42 'gold 300)
```

**Emergent behavior:** guided attention.

---

### `paint-heart` — Row 5 (composition tier)

**Base:** symmetric heart.

**Composition example:** composed with a life-total UI gives lives display.

```scheme
(for-each (lambda (i) (paint-heart (list (* i 30) 10) 'red))
          (range 0 lives))
```

**Emergent behavior:** game HUD.

---

### `paint-highlight` — Row 5 (composition tier)

**Base:** card-scoped highlight.

**Composition example:** composed with search gives search-result highlighting.

```scheme
(for-each paint-highlight (search-results 'urgent))
```

**Emergent behavior:** search UX.

---

### `paint-grid` — Row 5 (composition tier)

**Base:** grid backdrop.

**Composition example:** composed with `paint-line` gives graph paper.

```scheme
(paint-grid 'canvas '(gray))
(paint-line '(0 0) '(500 500) 'black)
```

**Emergent behavior:** graph paper.

---

### `paint-marquee` — Row 5 (composition tier)

**Base:** scrolling text.

**Composition example:** composed with news feed gives ticker.

```scheme
(for-each (lambda (n) (paint-marquee (news-summary n) 'top 5))
          news-items)
```

**Emergent behavior:** news ticker.

---

### `paint-point-at` — Row 5 (composition tier)

**Base:** directional cue.

**Composition example:** composed with `beckon` gives compound gesture.

```scheme
(paint-point-at 'card-42)
(beckon 'card-42)
```

**Emergent behavior:** attention + invitation.

---

### `paint-spiral` — Row 5 (composition tier)

**Base:** outward spiral.

**Composition example:** composed with color palette gives rainbow spiral.

```scheme
(paint-spiral '(200 200) 100 5 'red)
(paint-spiral '(200 200) 100 5 'orange)
```

**Emergent behavior:** layered art.

---

### `paint-text` — Row 5 (composition tier)

**Base:** placed text.

**Composition example:** composed with `map` over annotations gives
labeled diagram.

```scheme
(for-each (lambda (a)
            (paint-text (label a) (pos a)))
          annotations)
```

**Emergent behavior:** annotation.

---

### `paint-twinkle`, `paint-pulse` — Row 5 (composition tier)

**Base:** flicker + pulse.

**Composition example:** composed with time-of-day gives ambient environment.

```scheme
(if (night?) (paint-twinkle 'sky 0.05))
```

**Emergent behavior:** ambient weather.

---

### `paint-line`, `paint-rect`, `paint-arc`, `paint-circle`, `paint-pipe` — Row 5 (composition tier)

**Base:** geometry primitives.

**Composition example:** composed together give diagram DSL.

```scheme
(paint-rect 10 10 100 60 'blue)
(paint-circle '(60 40) 20 'yellow)
(paint-line '(10 10) '(60 40) 'red)
```

**Emergent behavior:** composed diagrams.

---

## Batch H · Sprite and body verbs (section 8)

### `sprite`, `sprites` — Row 5 (composition tier)

**Base:** name a sprite or group.

**Composition example:** composed with animation gives named characters.

```scheme
(sprite 'hero 'humanoid)
(dance 'twirl)
```

**Emergent behavior:** named actors.

---

### `carry` — Row 5 (composition tier)

**Base:** set position.

**Composition example:** composed with time gives waypoint tour.

```scheme
(for-each (lambda (p) (carry 'hero (car p) (cadr p)))
          waypoints)
```

**Emergent behavior:** tour.

---

### `go-to`, `visit`, `follow`, `rest` — Row 5 (composition tier)

**Base:** motion family.

**Composition example:** composed via `in-order` gives choreographed pathfinding.

```scheme
(in-order (go-to 'A) (rest) (go-to 'B))
```

**Emergent behavior:** waypointed motion.

---

### `flash`, `point-at`, `beckon`, `bow`, `wear` — Row 5 (composition tier)

**Base:** expressive verbs.

**Composition example:** composed via `together` gives compound expression.

```scheme
(together (bow) (wear "🎩"))
```

**Emergent behavior:** ceremonial gesture.

---

### `turn`, `size` — Row 5 (composition tier)

**Base:** rotation + scale.

**Composition example:** composed give affine transforms.

```scheme
(turn 45) (size 2)
```

**Emergent behavior:** compound spatial transform.

---

### `in-order`, `together`, `repeat-until`, `with-pace`, `as-crowd` — Row 5 (composition tier)

**Base:** combinators.

**Composition example:** composed via nesting give complex choreography.

```scheme
(as-crowd
  (repeat-until (past-midnight?)
    (with-pace 500
      (in-order (bow) (rest)))))
```

**Emergent behavior:** synchronized crowd behavior.

---

### `dance` — Row 5 (composition tier)

**Base:** named clip playback.

**Composition example:** composed with `at` gives scheduled dances.

```scheme
(after 1 'start (dance 'twirl))
```

**Emergent behavior:** timed choreography.

---

## Batch I · Note and music verbs (section 9)

### `note` — Row 5 (composition tier)

**Base:** discrete pitch event.

**Composition example:** composed via `for-each` gives melody.

```scheme
(for-each (lambda (p) (note p 0.5)) '(60 62 64 65 67))
```

**Emergent behavior:** melody.

---

### `note-place` — Row 5 (composition tier)

**Base:** placed note on stave.

**Composition example:** composed via `map` gives sheet music rendering.

```scheme
(for-each note-place melody-pitches)
```

**Emergent behavior:** notation rendering.

---

### `note-dots` — Row 5 (composition tier)

**Base:** dotted duration.

**Composition example:** composed via `staff` gives dotted rhythm patterns.

```scheme
(staff (note-dots 60 1 'treble))
```

**Emergent behavior:** rhythmic notation.

---

### `staff-lines` — Row 5 (composition tier)

**Base:** 5-line staff.

**Composition example:** composed with clef selection gives grand staff.

```scheme
(staff-lines :clef 'treble)
(staff-lines :clef 'bass)
```

**Emergent behavior:** two-hand piano notation.

---

### `tempo` — Row 5 (composition tier)

**Base:** BPM.

**Composition example:** composed with `tempo-curve` gives rubato.

```scheme
(tempo 120)
(tempo-curve '(at 0 1) '(at 4 0.9) '(at 8 1))
```

**Emergent behavior:** expressive tempo.

---

### `chord`, `rest`, `staff` — Row 5 (composition tier)

**Base:** musical macros.

**Composition example:** composed give a phrase.

```scheme
(staff
  (chord '(60 64 67) 1)
  (rest 0.5)
  (chord '(60 65 69) 1))
```

**Emergent behavior:** harmonic phrase.

---

### `instrument`, `section`, `dynamics`, `with-dynamics` — Row 5 (composition tier)

**Base:** orchestration.

**Composition example:** composed give expressive part-writing.

```scheme
(with-dynamics '(p mp mf f)
  (instrument 'piano)
  (section 4))
```

**Emergent behavior:** expressive orchestration.

---

### `tempo-curve`, `hall`, `reverb` — Row 5 (composition tier)

**Base:** acoustic space.

**Composition example:** composed give a produced-track feel.

```scheme
(hall 'cathedral)
(reverb 0.5)
```

**Emergent behavior:** acoustic environment.

---

### `define-instrument`, `mod-instrument` — Row 5 (composition tier)

**Base:** instrument creation.

**Composition example:** composed with inheritance give an instrument family.

```scheme
(define-instrument 'piano :env base)
(mod-instrument 'jazz-piano (from 'piano) '(:decay 'long))
```

**Emergent behavior:** instrument family.

---

### `music/*` — Row 5 (composition tier)

**Base:** named music catalog.

**Composition example:** composed with `time/every-ms` gives scheduled cues.

```scheme
(time/every-ms 60000 (lambda (t) (play (music/random))))
```

**Emergent behavior:** ambient soundtrack.

---

### `radio/*` — Row 5 (composition tier)

**Base:** ambient loop catalog.

**Composition example:** composed with context gives context-sensitive ambient.

```scheme
(if (customer-browsing?) (radio/play 'coffee-loop))
```

**Emergent behavior:** context-tied atmosphere.

---

## Batch J · FX and animation atoms (section 10)

### `timeline`, `keyframe`, `animate` — Row 5 (composition tier)

**Base:** keyframed animation.

**Composition example:** composed with `easing` gives smooth motion.

```scheme
(animate 'ball 'x 0 500 1000 (easing 'ease-in-out))
```

**Emergent behavior:** smooth tween.

---

### `easing`, `loop` — Row 5 (composition tier)

**Base:** curve + repeat.

**Composition example:** composed with `animate` gives infinite bounce.

```scheme
(loop (animate 'ball 'y 0 100 500 (easing 'ease-out-bounce)))
```

**Emergent behavior:** endless bounce.

---

### `random-seed!`, `random` — Row 5 (composition tier)

**Base:** seeded random.

**Composition example:** composed with generation gives reproducible content.

```scheme
(random-seed! 42)
(generate-level!)
```

**Emergent behavior:** procedural determinism.

---

### `surface-dusk`, `on-canvas-trace` — Row 5 (composition tier)

**Base:** dim + trace.

**Composition example:** composed with time-of-day gives sunset.

```scheme
(surface-dusk (/ (mod hour 24) 24))
```

**Emergent behavior:** ambient time-of-day.

---

### `surface/dim`, `surface/spotlight`, `surface/curtain` — Row 5 (composition tier)

**Base:** stackable surface effects.

**Composition example:** composed together give theater lighting.

```scheme
(surface/dim 0.5)
(surface/spotlight 'hero)
```

**Emergent behavior:** dramatic lighting.

---

## Batch K · Card surface verbs (section 11)

### `card-do`, `card-emit`, `card-ask` — Row 5 (composition tier)

**Base:** inter-card messaging.

**Composition example:** composed give a card protocol.

```scheme
(card-emit 'a 'query-ready '())
(card-ask 'a "which item?")
```

**Emergent behavior:** conversational cards.

---

### `card-list`, `card-rows`, `card-kinds`, `card-find-by-kind` — Row 5 (composition tier)

**Base:** read-only inspection.

**Composition example:** composed with `filter` gives targeted search.

```scheme
(filter urgent? (card-find-by-kind 'cart))
```

**Emergent behavior:** filtered inspection.

---

### `card-open`, `card-close`, `card-focus!` — Row 5 (composition tier)

**Base:** presence + focus.

**Composition example:** composed with a wizard gives step-by-step UI.

```scheme
(for-each (lambda (step) (card-open step) (card-focus! step))
          wizard-steps)
```

**Emergent behavior:** guided flow.

---

### `move-card`, `scale-card`, `pin-card` — Row 5 (composition tier)

**Base:** direct card state.

**Composition example:** composed with drag events give drag-and-drop.

```scheme
(on-drag! (lambda (card x y) (move-card card x y)))
```

**Emergent behavior:** direct manipulation.

---

### `transfer` — Row 5 (composition tier)

**Base:** atomic item move.

**Composition example:** composed with confirmation gives safe transfer.

```scheme
(when (confirmed?) (transfer 'cart-a 'cart-b items))
```

**Emergent behavior:** consent-gated move.

---

### `summon` — Row 5 (composition tier)

**Base:** create card.

**Composition example:** composed with events gives on-demand cards.

```scheme
(on-request! (lambda (r) (summon (needed-card-kind r))))
```

**Emergent behavior:** reactive UI.

---

### `card/tiles` family — Row 5 (composition tier)

**Base:** grid placement.

**Composition example:** composed with layout algorithm gives auto-organize.

```scheme
(card/organize)
```

**Emergent behavior:** tidy desk.

---

### `card/walk` — Row 5 (composition tier)

**Base:** gaited motion.

**Composition example:** composed with gait selection gives character.

```scheme
(card/walk 'card-42 'sneak 100 0 800)
```

**Emergent behavior:** personality via gait.

---

### `card-effect` — Row 5 (composition tier)

**Base:** one-shot effect.

**Composition example:** composed with feedback gives responsive UI.

```scheme
(on-click! (lambda (c) (card-effect c 'lift)))
```

**Emergent behavior:** tactile feedback.

---

### `card/activity` family — Row 5 (composition tier)

**Base:** progress tracking.

**Composition example:** composed with long-running verbs gives progress bar.

```scheme
(card/activity 'sync "Syncing" 3000)
(long-sync!)
(card/activity-done 'sync)
```

**Emergent behavior:** informed waiting.

---

### `card/personality` — Row 5 (composition tier)

**Base:** 4-axis personality read.

**Composition example:** composed with dialogue selection gives adaptive voice.

```scheme
(define (say-adaptive card text)
  (sakura/say text :register (personality->register (card/personality card))))
```

**Emergent behavior:** personality-tuned voice.

---

### `imagine`, `emoji-paint-pixel` — Row 5 (composition tier)

**Base:** visualization primitives.

**Composition example:** composed give visual meditation.

```scheme
(imagine "cherry blossoms" :seconds 3)
(emoji-paint-pixel "🌸" 100 100 32)
```

**Emergent behavior:** ambient presence.

---

### `fleet-do`, `fleet-each` — Row 5 (composition tier)

**Base:** broadcast to fleet.

**Composition example:** composed with filter gives targeted broadcast.

```scheme
(fleet-do 'refresh '() :filter needs-refresh?)
```

**Emergent behavior:** scoped broadcast.

---

### `scene/conveyor` — Row 5 (composition tier)

**Base:** move items in a stream.

**Composition example:** composed with source-of-items gives auto-transfer.

```scheme
(when (has-new-items?) (scene/conveyor 'inbox 'outbox (new-count)))
```

**Emergent behavior:** flow processing.

---

### 11 motion honest-null escalators — Row 5 (composition tier)

**Base:** motion family with honest-null.

**Composition example:** composed via choice gives fallback motion.

```scheme
(or (motion/glide-to target)
    (motion/settle))
```

**Emergent behavior:** graceful motion fallback.

---

### `paint-conway-via-dot-grid` — Row 5 (composition tier)

**Base:** Life on dots.

**Composition example:** composed with tick gives evolving generations.

```scheme
(time/every-ms 500 (lambda (t) (paint-conway-via-dot-grid '(gray))))
```

**Emergent behavior:** cellular automaton.

---

### `grid-dot`, `clear-grid-dots` — Row 5 (composition tier)

**Base:** substrate write.

**Composition example:** composed with cellular rules gives Life implementation.

```scheme
(for-each (lambda (cell) (grid-dot (car cell) (cadr cell) 'gray))
          live-cells)
```

**Emergent behavior:** cellular canvas.

---

## Batch L · Sakura on-device verbs (section 12)

### `sakura/decide` — Row 5 (composition tier)

**Base:** local routing decision.

**Composition example:** composed with `sakura/relay` gives full pipeline.

```scheme
(let ((route (sakura/decide 'route-me '())))
  (sakura/relay route '()))
```

**Emergent behavior:** decide-then-act.

---

### `sakura/cloud-reason` (budget form) — Row 5 (composition tier)

**Base:** budgeted cloud call.

**Composition example:** composed with `escalate` gives cascade budget.

```scheme
(or (sakura/cloud-reason q :budget 500)
    (escalate 'cloud-budget-exceeded q))
```

**Emergent behavior:** budget-aware pipeline.

---

### `sakura/relay` — Row 5 (composition tier)

**Base:** tool call relay.

**Composition example:** composed with `sakura/decide` gives adaptive dispatch.

```scheme
(sakura/relay (sakura/decide 'best-tool payload) payload)
```

**Emergent behavior:** decide + delegate.

---

### `sakura/handoff` — Row 5 (composition tier)

**Base:** chip handoff.

**Composition example:** composed with reply-wait gives chip-request pattern.

```scheme
(sakura/handoff 'lacuna-14b payload)
(await 'lacuna-reply)
```

**Emergent behavior:** RPC.

---

### `sakura/dream` — Row 5 (composition tier)

**Base:** seeded reverie.

**Composition example:** composed with variety gives creative exploration.

```scheme
(map sakura/dream '(1 2 3 4 5))
```

**Emergent behavior:** ensemble of dreams.

---

## Batch M · Motion-timing verbs (section 13.1)

### 13.1 Motion-timing verbs — Row 5 (composition tier)

**Base:** timed motion.

**Composition example:** composed with narrative gives cinematic timing.

```scheme
(in-order
  (glide 'hero 500 500 1000)
  (rest 500)
  (glide 'hero 300 300 800))
```

**Emergent behavior:** cinematic pacing.

---

## Batch N · Chrome, coin, deprecation (section 14)

### 14.1 Card chrome verbs — Row 5 (composition tier)

**Base:** presentational decoration.

**Composition example:** composed with card kind gives per-kind theming.

```scheme
(for-each (lambda (c) (chrome-apply c (kind->chrome (kind-of c))))
          all-cards)
```

**Emergent behavior:** consistent theming.

---

### 14.2 Operator-tier verb — Row 5 (composition tier)

**Base:** commit-gated verb.

**Composition example:** composed with `card-ask` for confirmation gives confirmed publish.

```scheme
(let ((confirm (card-ask 'operator "Publish?")))
  (when (eq? confirm 'yes) (operator-verb '(:action publish) #t)))
```

**Emergent behavior:** consent dialog.

---

### 14.3 Coin emit — Row 5 (composition tier)

**Base:** ephemeral coin.

**Composition example:** composed with sale event gives register-ka-ching.

```scheme
(on-sale! (lambda (o) (coin/emit (register-pos) (safe-pos))))
```

**Emergent behavior:** payoff feedback.

---

### 14.4 Phase 3+4 motion-timing — Row 5 (composition tier)

**Base:** extended motion-timing.

**Composition example:** composed with easing gives polished motion.

```scheme
(animate 'card 'y 0 100 500 (easing 'ease-out-cubic))
```

**Emergent behavior:** juicy movement.

---

### 14.5 Deprecation flags — Row 5 (composition tier)

**Base:** loud deprecation.

**Composition example:** composed with a log lane gives audit-safe rollout.

```scheme
(let ((r (deprecated-verb '())))
  (log-deprecation r))
```

**Emergent behavior:** migration nudge.

---

## Batch O · Atomic primitives (section 15)

### 15.1 Special forms — Row 5 (composition tier)

**Base:** control flow.

**Composition example:** composed give macros; `if`/`cond`/`when`/`unless`
compose into complex conditionals.

```scheme
(when (and a b) (unless c (do-thing)))
```

**Emergent behavior:** nested guarded actions.

---

### 15.2 Equality and predicates — Row 5 (composition tier)

**Base:** three-tier equality.

**Composition example:** composed give type-aware comparison.

```scheme
(define (compare a b)
  (cond ((eq? a b) 'ptr-eq)
        ((eqv? a b) 'atom-eq)
        ((equal? a b) 'structural-eq)
        (else 'diff)))
```

**Emergent behavior:** deep-equality diagnostic.

---

### 15.3 List + sequence atoms — Row 5 (composition tier)

**Base:** list primitives.

**Composition example:** composed via `reduce` give algebraic aggregation.

```scheme
(display (reduce max 0 '(3 1 4 1 5 9)))
(newline)
;; Prints: 9
```

**Emergent behavior:** monoidal reduction.

---

### 15.4 Arithmetic atoms — Row 5 (composition tier)

**Base:** typed arithmetic.

**Composition example:** composed with rationals give exact results.

```scheme
(display (/ (+ 1/2 1/3) 2))
(newline)
;; Prints: 5/12
```

**Emergent behavior:** exact math.

---

### 15.5 String + number conversion atoms — Row 5 (composition tier)

**Base:** number ↔ string.

**Composition example:** composed with parsing give input handling.

```scheme
(define (parse-int s) (string->number s))
(display (parse-int "42"))
(newline)
;; Prints: 42
```

**Emergent behavior:** input parsing.

---

### 15.6 Higher-order atoms — Row 5 (composition tier)

**Base:** higher-order functions.

**Composition example:** composed give function composition.

```scheme
(define (compose f g) (lambda (x) (f (g x))))
(display ((compose (lambda (x) (* x 2)) (lambda (x) (+ x 1))) 5))
(newline)
;; Prints: 12
```

**Emergent behavior:** function composition.

---

### 15.7 Randomness atoms — Row 5 (composition tier)

**Base:** seeded + unseeded random.

**Composition example:** composed with dev/test give reproducibility.

```scheme
(random-seed! 42)
(define x (random))
(random-seed! 42)
(display (= x (random)))
(newline)
;; Prints: #t
```

**Emergent behavior:** replay.

---

### 15.8 Geometry + threshold atoms — Row 5 (composition tier)

**Base:** geometry primitives + thresholds.

**Composition example:** composed give collision detection.

```scheme
(define (collides? a b)
  (in-range? (distance a b) 0 (+ (radius a) (radius b))))
```

**Emergent behavior:** collision.

---

### 15.9 Display atoms — Row 5 (composition tier)

**Base:** rendering.

**Composition example:** composed with formatting give tables.

```scheme
(for-each (lambda (row)
            (display row) (newline))
          rows)
```

**Emergent behavior:** tabular output.

---

## Batch P · Intelligence hooks, clock, world-knowledge (section 16)

### 16.1 `clock/*` — Row 5 (composition tier)

**Base:** monotonic time.

**Composition example:** composed with logging gives timestamped log.

```scheme
(define (log msg) (list :t (clock/now) :msg msg))
```

**Emergent behavior:** audit log.

---

### 16.2 Intelligence hooks — Row 5 (composition tier)

**Base:** translation layer.

**Composition example:** composed with reasoning gives routed queries.

```scheme
(let ((routed (hook query)))
  (dispatch routed))
```

**Emergent behavior:** typed dispatch.

---

### 16.3 `world/knowledge` — Row 5 (composition tier)

**Base:** three-layer grounding.

**Composition example:** composed with `sakura/say` gives grounded speech.

```scheme
(sakura/say (three-layer-render (world/knowledge 'topic))
            :register 'informational)
```

**Emergent behavior:** grounded voice.

---

### 16.4 `system/registry` + `cortex/associate` — Row 5 (composition tier)

**Base:** extensibility.

**Composition example:** composed give hot-swap verbs.

```scheme
(system/register 'my-verb handler)
(my-verb '())
```

**Emergent behavior:** runtime plugin.

---

### 16.5 `knowledge/of` — Row 5 (composition tier)

**Base:** category-scoped knowledge.

**Composition example:** composed with domain routing gives targeted retrieval.

```scheme
(if (about-chess? q) (knowledge/of 'chess) (knowledge/of 'general))
```

**Emergent behavior:** domain routing.

---

### `loam/query` — Row 5 (composition tier)

**Base:** deep-magic cost-band.

**Composition example:** composed with budget check gives cost-aware routing.

```scheme
(when (within-budget?) (loam/query hard-question))
```

**Emergent behavior:** cost gate.

---

## Batch Q · Duplex-session verbs (section 17)

### 17.1 `surface/*` — Row 5 (composition tier)

**Base:** state + digest read.

**Composition example:** composed with polling gives change detection.

```scheme
(time/every-ms 1000 (lambda (t)
  (let ((state (surface/state)))
    (when (changed? state) (alert!)))))
```

**Emergent behavior:** watcher.

---

### 17.2 `system/*` — Row 5 (composition tier)

**Base:** system introspection.

**Composition example:** composed with alerts gives health dashboard.

```scheme
(when (unhealthy? (system/status)) (alert-ops!))
```

**Emergent behavior:** monitoring.

---

### 17.3 `card/physics!` + `card/transition` — Row 5 (composition tier)

**Base:** physical transitions.

**Composition example:** composed with `card/walk` gives physical wander.

```scheme
(card/physics! 'card-42 :gravity 0.1)
(card/walk 'card-42 'stroll 100 0)
```

**Emergent behavior:** physical roaming.

---

### 17.4 `card/do`, `card/emit`, `card/ask` — Row 5 (composition tier)

**Base:** inter-card protocol.

**Composition example:** composed give conversation.

```scheme
(card/emit 'a 'question '(:q "what?"))
(card/ask 'a "then what?")
```

**Emergent behavior:** dialog.

---

### 17.5 `card/hide`, `card/show`, `desk/reboot` — Row 5 (composition tier)

**Base:** presence management.

**Composition example:** composed with focus give distraction-free mode.

```scheme
(card/hide-all)
(card/show 'focus-card)
```

**Emergent behavior:** focus mode.

---

## Batch R · Math Toolkit v2, Phase 1 (section 18)

### 18.1 `math/*`, `exact/*`, `stat/*`, `geom/*`, `sym/*` — Row 5 (composition tier)

**Base:** elementary + algebra.

**Composition example:** composed give a small symbolic algebra system.

```scheme
(display (sym/simplify '(+ x x x)))
(newline)
;; Prints: (* 3 x)
```

**Emergent behavior:** CAS.

---

### 18.2 `calc/*`, `num/*` — Row 5 (composition tier)

**Base:** calculus III + verdicts.

**Composition example:** composed with tolerance give bounded numerics.

```scheme
(num/root 3 27 1e-6)
```

**Emergent behavior:** honest approximation.

---

### 18.3 `game/*`, `juggle/*` — Row 5 (composition tier)

**Base:** game theory + siteswap.

**Composition example:** composed give combinatorial game exploration.

```scheme
(game/nim '(3 4 5))
```

**Emergent behavior:** strategy analysis.

---

### 18.4 `alg/*` — Row 5 (composition tier)

**Base:** abstract algebra.

**Composition example:** composed with music gives group-theoretic composition.

```scheme
(alg/z-mod-12 '(0 4 7))   ;; a triad in mod-12 space
```

**Emergent behavior:** music theory in code.

---

### 18.5 `curve/*` — Row 5 (composition tier)

**Base:** differential geometry.

**Composition example:** composed with plotting gives curvature visualization.

```scheme
(plot-curvature-of-curve my-curve)
```

**Emergent behavior:** geometric visualization.

---

### 18.6 `topo/*` — Row 5 (composition tier)

**Base:** topological data analysis.

**Composition example:** composed with data gives persistence diagrams.

```scheme
(topo/persistence my-point-cloud)
```

**Emergent behavior:** shape of data.

---

### 18.7 `ops/*` — Row 5 (composition tier)

**Base:** operations research.

**Composition example:** composed give supply-chain optimization.

```scheme
(ops/lp :objective 'min-cost :constraints '(...))
```

**Emergent behavior:** planning.

---

### 18.8 `phys/*`, `chem/*`, `eng/*` — Row 5 (composition tier)

**Base:** science + engineering.

**Composition example:** composed give physical simulation.

```scheme
(phys/projectile :v0 20 :angle 45)
```

**Emergent behavior:** projectile.

---

### 18.9 `plot/*` — Row 5 (composition tier)

**Base:** coordinate plane.

**Composition example:** composed with data gives visualization.

```scheme
(plot/scatter my-data)
```

**Emergent behavior:** plot.

---

## Batch S · Marionette engine (section 19)

### 19.1 `world/*` — Row 5 (composition tier)

**Base:** world state + camera.

**Composition example:** composed with tick give physics loop.

```scheme
(time/every-ms 16 (lambda (t) (world/step!)))
```

**Emergent behavior:** simulation loop.

---

### 19.1a `world/tape-*` — Row 5 (composition tier)

**Base:** motion tape.

**Composition example:** composed with playback give replays.

```scheme
(world/tape-record!)
(play-level!)
(world/tape-replay!)
```

**Emergent behavior:** ghost mode.

---

### 19.2 `entity/*` — Row 5 (composition tier)

**Base:** per-entity state.

**Composition example:** composed with input give player character.

```scheme
(on-input! (lambda (k) (entity/move! 'player :dx (key->dx k))))
```

**Emergent behavior:** playable character.

---

### 19.3 `input/*` — Row 5 (composition tier)

**Base:** input events.

**Composition example:** composed with rebinding give configurable controls.

```scheme
(input/bind 'jump 'space)
```

**Emergent behavior:** custom controls.

---

### 19.4 `prefab/*`, `scene/*`, `big-bang`, `game/*` — Row 5 (composition tier)

**Base:** game loop.

**Composition example:** composed give a full game.

```scheme
(big-bang initial-state
  :on-tick step-world
  :on-key handle-input
  :render draw-scene)
```

**Emergent behavior:** playable game.

---

### 19.5 `sprite/*`, `audio/*` — Row 5 (composition tier)

**Base:** sprite audio.

**Composition example:** composed give footstep sync.

```scheme
(entity/move! 'walker :vel v)
(audio/play 'footstep :at (position 'walker))
```

**Emergent behavior:** synced audio.

---

### 19.6 shape↔entity bone — Row 5 (composition tier)

**Base:** bidirectional binding.

**Composition example:** composed with animation give shape-morphing entity.

```scheme
(bind-bone! 'blob-shape 'blob-entity)
(sway! 'blob-shape)
```

**Emergent behavior:** morphing entity.

---

### 19.7 physics — Row 5 (composition tier)

**Base:** PBD physics.

**Composition example:** composed give rope simulation.

```scheme
(for-each (lambda (i)
            (entity/mass! i 1)
            (world/link! i (next i) :rest 10))
          rope-segments)
(world/solve! 5)
```

**Emergent behavior:** rope physics.

---

## Batch T · Math Toolkit v2, Phase 2 (section 20)

### 20.1 Combinatorics + Sequences — Row 5 (composition tier)

**Base:** combinatorial verbs.

**Composition example:** composed with probability give card-game odds.

```scheme
(/ (choose 4 2) (choose 52 2))
```

**Emergent behavior:** probability calculation.

---

### 20.2 Geometric Transforms — Row 5 (composition tier)

**Base:** transform algebra.

**Composition example:** composed with scenegraph give hierarchical layout.

```scheme
(translate 100 100 (rotate 45 (scale 2 my-shape)))
```

**Emergent behavior:** scene graph.

---

### 20.3 Multivariable Calculus — Row 5 (composition tier)

**Base:** partial derivatives, gradients.

**Composition example:** composed with optimization give gradient descent.

```scheme
(gradient-descent f (gradient f) x0 lr steps)
```

**Emergent behavior:** learning loop.

---

### 20.4 Linear Algebra Factorizations — Row 5 (composition tier)

**Base:** LU, QR, SVD.

**Composition example:** composed with least-squares give regression.

```scheme
(let-values (((q r) (qr-factor A)))
  (solve-triangular r (mat-mul (transpose q) b)))
```

**Emergent behavior:** regression solver.

---

### 20.5 Number Representation + Constants — Row 5 (composition tier)

**Base:** named constants.

**Composition example:** composed with formulas give physics ready-to-use.

```scheme
(define energy (* mass (expt c 2)))
```

**Emergent behavior:** natural formula.

---

### 20.6 Equation Solvers — Row 5 (composition tier)

**Base:** solvers with residual.

**Composition example:** composed with verification give trust-but-verify.

```scheme
(let ((sol (solve-linear a b)))
  (when (small? (residual sol)) (use sol)))
```

**Emergent behavior:** verified solutions.

---

### 20.7 Exact Arithmetic — Row 5 (composition tier)

**Base:** rational tower.

**Composition example:** composed with music give exact tuning.

```scheme
(define perfect-fifth 3/2)
```

**Emergent behavior:** just intonation.

---

## Batch U · 1·3·5 ladder support verbs (section 21)

### 21.1 `time/hours`, `time/elapsed` — Row 5 (composition tier)

**Base:** numeric time siblings.

**Composition example:** composed with schedule give bounded work windows.

```scheme
(when (< (time/elapsed start now) (hours 8)) (continue-work!))
```

**Emergent behavior:** work-hours discipline.

---

### 21.2 `list/filter`, `list/take`, `list/realize` — Row 5 (composition tier)

**Base:** eager sequence ops.

**Composition example:** composed give preview + full-realize pattern.

```scheme
(display (list/take 5 filtered))
(realize! filtered)
```

**Emergent behavior:** peek + commit.

---

### 21.3 `stream/unfold`, `stream/take` — Row 5 (composition tier)

**Base:** lazy sequences.

**Composition example:** composed give infinite generators.

```scheme
(define primes (stream/unfold next-prime 2))
(display (stream/take 10 primes))
```

**Emergent behavior:** infinite structures.

---

### 21.4 `memo-text`, `memo-time` — Row 5 (composition tier)

**Base:** memo accessors.

**Composition example:** composed with recall give reminder pattern.

```scheme
(let ((m (find-memo 'today)))
  (sakura/say (memo-text m) :context (memo-time m)))
```

**Emergent behavior:** context-aware recall.

---

### 21.5 `surface/say`, `cortex/cursor`, `cortex/recall-next` — Row 5 (composition tier)

**Base:** ladder sinks/sources with honest-null.

**Composition example:** composed give an honest streaming reader.

```scheme
(let loop ((cursor (cortex/cursor)))
  (let ((v (cortex/recall-next cursor)))
    (if v (begin (surface/say v) (loop (advance cursor))) 'done)))
```

**Emergent behavior:** honest stream traversal.

---

## Coverage summary

Row 5 authored across 42 abstract-conceptual verbs (from PR #73) PLUS
full extension across the 210 REFERENCE.md sections. Together:
comprehensive composition/emergence tier for the Sakura Scheme surface.

**Pattern reminder for future authoring:**

```
### verb/name — Row 5 (composition tier)

**Base:** [what the verb does in isolation]

**Composition example:** [verb chained with 1-2 other verbs]

```scheme
;; A runnable program showing the composition producing something new.
```

**Emergent behavior:** [what appears from the composition that neither verb alone knows about]

**Meta-explanation:** [Wittgenstein-late lens — family resemblance. Lacan lens — packing near creates a new region.]
```

Every entry runs standalone. Every composition produces a NEW behavior
that neither base verb knows about.
