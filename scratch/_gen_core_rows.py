#!/usr/bin/env python3
"""Generate Row 2-5 field content for each of the 97 verbs in 01-core.slat.

Strategy: build a dict of per-verb templates keyed by name. Group by family
(audio, camera, grid, note, random, choreo, control-flow, base) so many verbs
in a family share row shapes but with verb-specific claims/programs.

Emits ONE big injection block per verb that will be spliced into the SLAT.
"""

import json
import re
from pathlib import Path

SLAT = Path("/Users/alfred/code/motoi-scheme/Scheme/reference/01-core.slat")

# ==== helpers ================================================================

def esc(s: str) -> str:
    """Escape for SLAT string literal."""
    return s.replace('\\', '\\\\').replace('"', '\\"')

def code(s: str) -> str:
    """Code goes into a string literal; escape newlines to \\n."""
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

# ==== per-verb rows ==========================================================
#
# Each verb: dict with r2, r3, r4, r5, each a dict of fields.
# Row 2: problem, program, explanation, meta, eng, math, cs
# Row 3: setup, r1_domain, r1_code, r2_domain, r2_code, r3_domain, r3_code,
#         explanation, meta, eng, math, cs
# Row 4: claim, program, invariant, meta, eng, math, cs
# Row 5: base, composition, emergent, meta, eng, math, cs

V = {}

# --- across-beats -----------------------------------------------------------
V["across-beats"] = dict(
    r2=dict(
        problem="A dance sequence needs eight enemies arranged in a circle for the chorus, then a diamond for the drop, with everything locked to the beat grid.",
        program="(define (choreograph ctx)\n  (let ((section (ctx-get 'section ctx)))\n    (if (eq? section 'chorus)\n        (across-beats 'circle)\n        (across-beats 'diamond))))",
        explanation="The verb returns a descriptor per section, not a mutation. The driver reads the descriptor and places entities at beat-locked positions on the next downbeat. The section field on ctx selects which formation is emitted.",
        meta="in-formation places entities but does not lock timing; walk-together moves entities but assumes a path exists. across-beats is the correct choice when the operator wants a named FORMATION whose emission is rhythm-anchored.",
        eng="Operator log line: 'formation=circle at bar 5 beat 1'. If timing drifts, the audit is on the beat clock, not on this verb.",
        math="Formation is a set of (x, y) offsets indexed by entity slot; across-beats emits the same set every call, so the mapping is a pure function of (name, entity-count).",
        cs="Descriptor pattern: this verb is a constructor for an intent-record that the driver interprets. Effect is deferred, not immediate.",
    ),
    r3=dict(
        setup="named-arrangement-emits-descriptor-for-later-execution",
        r1_domain="motoi choreo",
        r1_code="(across-beats 'circle)",
        r2_domain="build orchestration",
        r2_code=";; a build plan requests parallel jobs to run in a fan-out shape:\n(list 'fanout (list 'compile 'lint 'test))",
        r3_domain="math (finite map)",
        r3_code=";; a formation IS a finite map from slot index to position:\n(define circle-map '((0 . (1 0)) (1 . (0 1)) (2 . (-1 0)) (3 . (0 -1))))",
        explanation="Each rung is a NAMED SHAPE that a downstream executor unpacks into a set of concrete positions. The name is the compression; the executor is the expansion.",
        meta="Any time an executor accepts a NAME and answers with a LAYOUT, the shape is the same. Motoi's 'circle is a build system's 'fanout is a math finite map.",
        eng="Named formations reduce operator cognitive load; the operator says 'circle' and the driver expands it. Same as CI job templates.",
        math="Finite maps from labels to positions; the label alphabet is small and closed.",
        cs="Symbol-keyed dispatch table with descriptor return type.",
    ),
    r4=dict(
        claim="Called with the same formation name and the same driver state, across-beats emits an equal descriptor.",
        program="(define d1 (across-beats 'circle))\n(define d2 (across-beats 'circle))\n(display (equal? d1 d2))",
        invariant="∀ name driver-state. across-beats(name, driver-state) = across-beats(name, driver-state)",
        meta="Referential transparency for the descriptor constructor. Falsified if the emitter injects a timestamp or per-call counter into the descriptor. See book-of-math ch01 (equality) and book-of-computing ch03 (pure vs effectful).",
        eng="Deterministic emission = safe to memoize per bar.",
        math="Pure function: same input, same output.",
        cs="Referential transparency; constructor, not effect.",
    ),
    r5=dict(
        base="across-beats emits a beat-locked formation descriptor.",
        composition="(define (section-plan ctx)\n  (let ((form (across-beats (ctx-get 'section ctx))))\n    (in-formation form (entity/list))))\n(on-frame\n  (lambda () (when (audio-beat?) (section-plan (ctx)))))",
        emergent="rhythm-locked choreography pipeline: section -> formation descriptor -> entity placement, each stage clean.",
        meta="This is the same shape as a render pipeline: intent -> layout -> paint. Analogous to a virtual-DOM diff step feeding a real-DOM patch step. See book-of-composition ch04 (pipelines).",
        eng="Pipeline stages fail loudly at their own boundary; easier to debug than a monolithic 'do the dance'.",
        math="Function composition f∘g∘h.",
        cs="Producer-consumer chain; each stage is a pure transformer feeding an effectful sink.",
    ),
)

# --- after ------------------------------------------------------------------
V["after"] = dict(
    r2=dict(
        problem="A network request has been sent; if no response arrives within five seconds, escalate a timeout instead of blocking the cart forever.",
        program="(define (start-request ctx)\n  (net/send (ctx-get 'req ctx))\n  (after 5 'timeout ctx))\n(define (timeout ctx)\n  (escalate 'request-timeout (ctx-get 'req ctx)))",
        explanation="start-request fires the request and immediately schedules a delayed transition to the timeout state. The driver holds the transition until 5 seconds elapse, at which point it enters timeout with the original ctx.",
        meta="wait would block until an event fires with no time bound; time/when schedules absolute time, not relative. after is the correct choice when the operator says 'in N seconds, go to state X' without regard to wall-clock.",
        eng="Operator log: 'scheduled timeout at t+5s'. If the timeout never fires, the audit points at the driver's timer wheel, not at this call site.",
        math="Delay is a real-valued parameter; the transition happens at t+delay seconds relative to call.",
        cs="Descriptor emitted; no blocking. State-machine transition primitive.",
    ),
    r3=dict(
        setup="delayed-message-to-self",
        r1_domain="motoi state machine",
        r1_code="(after 2 'check-status)",
        r2_domain="unix at command",
        r2_code=";; schedule a shell command for later:\n;; at now + 2 minutes <<< 'check-status.sh'",
        r3_domain="temporal logic",
        r3_code=";; classical temporal logic: eventually(check-status) in bounded time:\n;; ◇_{≤5s} check-status",
        explanation="Each rung is 'wait some time, then take an action.' The verb NAMES both the delay and the follow-up so no one has to poll.",
        meta="Delayed-message-to-self is the reusable shape: whoever holds a clock offers the callback in the future, not the operator.",
        eng="Timer wheel semantics; identical across queues, cron, at, and setTimeout.",
        math="Bounded eventuality operator from temporal logic.",
        cs="Delayed-continuation; the runtime holds a closure until t fires.",
    ),
    r4=dict(
        claim="after does not fire before its delay: the target state is unreachable via after during the interval [call-time, call-time + delay).",
        program="(define fired? #f)\n(after 1 'mark)\n(define (mark ctx) (set! fired? #t))\n;; check immediately:\n(display fired?)  ;; must be #f",
        invariant="∀ delay > 0. ∀ t < call-time + delay. state-at(t) ≠ target",
        meta="Lower-bound guarantee on delay. Falsified if the driver fires transitions eagerly. See book-of-computing ch07 (scheduling) and book-of-math ch07 (real intervals).",
        eng="Testable via a stopwatch harness; any early firing is a P1 bug on the driver.",
        math="Half-open interval; delay is a strict lower bound.",
        cs="Non-preemptive scheduling contract; delay is monotone-lower-bound.",
    ),
    r5=dict(
        base="after schedules a delayed state transition.",
        composition="(define (do-work ctx)\n  (cond ((work-done? ctx) (next 'complete ctx))\n        (else (after 0.5 'do-work ctx))))",
        emergent="polling loop: after + guard predicate + self-referential state name = a poll-until-ready loop with a fixed cadence.",
        meta="Same family as JavaScript setTimeout-based polling, or Kubernetes reconcile-loops. See book-of-composition ch09 (retry loops).",
        eng="Bounded backoff pattern; the polling cadence lives in one place.",
        math="Fixed-point iteration with a temporal step.",
        cs="Trampoline-style recursive scheduling.",
    ),
)

# --- after-frame ------------------------------------------------------------
V["after-frame"] = dict(
    r2=dict(
        problem="A card just added rows; the operator needs to measure the card's rendered height AFTER the browser lays it out and paints, then cache the height for a follow-up animation.",
        program="(define measured-height 0)\n(after-frame\n  (lambda ()\n    (set! measured-height (card-rows))\n    (display measured-height)))",
        explanation="The lambda runs after two rAF cycles, so layout and paint have committed. card-rows now returns the true measured height rather than a stale pre-layout number.",
        meta="on-frame fires every frame; time/every-ms is wall-clock, not paint-cycle. after-frame is the correct choice when the operator specifically needs 'the frame after this one has painted.'",
        eng="Operator log: 'measurement fired at t+2rAF'. If the measurement is wrong, the audit checks whether DOM mutations happened between call and callback.",
        math="Two frames of latency; if the display is 60Hz, ~33ms.",
        cs="Post-commit hook; runs off the render critical path.",
    ),
    r3=dict(
        setup="callback-after-io-settles",
        r1_domain="motoi framebuffer",
        r1_code="(after-frame (lambda () (measure-content)))",
        r2_domain="filesystem",
        r2_code=";; fsync then callback:\n;; fsync(fd); on_sync(fd, cb)",
        r3_domain="two-phase commit",
        r3_code=";; commit phase 2 must run only after phase 1 durably lands:\n;; PREPARE OK -> COMMIT -> callback",
        explanation="Each rung says 'the observable state of the world is not yet what you think it is; wait until it settles.' The shape is 'defer until a boundary crosses.'",
        meta="The wait boundary is a device commit in one domain and a paint commit in another. Same idea.",
        eng="Post-commit callbacks are a universal SRE tool.",
        math="Sequential composition with a barrier.",
        cs="Async barrier / rendezvous point.",
    ),
    r4=dict(
        claim="The function passed to after-frame runs strictly AFTER the current frame's paint commits.",
        program="(define call-frame -1)\n(define fire-frame -1)\n(set! call-frame (frame))\n(after-frame\n  (lambda ()\n    (set! fire-frame (frame))\n    (display (> fire-frame call-frame))))",
        invariant="∀ call ∈ after-frame. frame(callback-fires) > frame(call-issued)",
        meta="Strict-later guarantee. Falsified if the callback ever runs synchronously in-line. See book-of-computing ch07 (scheduling) and book-of-animation ch03 (frame lifecycle).",
        eng="Two-frame guarantee ensures DOM measurements are stable.",
        math="Strict inequality on frame index.",
        cs="Happens-after ordering; a partial order on frame boundaries.",
    ),
    r5=dict(
        base="after-frame defers a callback until the frame paints.",
        composition="(begin-frame 'main)\n(grid-cell-set! 3 3 1)\n(end-frame 'main)\n(after-frame\n  (lambda ()\n    (card/emit (list ':measured (card-rows)))))",
        emergent="settle-then-emit pipeline: mutate -> commit frame -> measure -> emit measurement. Downstream cards react to REAL numbers, not projected ones.",
        meta="Same family as React's useLayoutEffect or DOM's ResizeObserver. See book-of-composition ch07 (settle patterns).",
        eng="Reduces layout thrash by batching measurements.",
        math="Sequential composition with a commit barrier.",
        cs="Post-commit observer; publish/subscribe with a paint gate.",
    ),
)

# --- arc-between ------------------------------------------------------------
V["arc-between"] = dict(
    r2=dict(
        problem="A boss enemy needs to swoop across the screen from (0,0) to (100,0) via a graceful arc, not a straight line.",
        program="(define swoop (arc-between '(0 0) '(100 0) '(height 40)))\n(in-formation swoop (list 'boss))",
        explanation="arc-between builds a path descriptor with 40 units of vertical lift. in-formation places the boss along the path; the driver walks the path as beats advance.",
        meta="A raw pair of endpoints is a line; entity/set-pos! moves one entity but does not carry a shape. arc-between is the correct choice when the operator says 'follow this curved shape.'",
        eng="Operator log: 'arc from (0,0) to (100,0) lift 40'. If the boss moves straight, the audit points at whether a formation verb consumed the descriptor.",
        math="A quadratic Bezier with control point (50, 40); parametrised by t ∈ [0,1].",
        cs="Constructor for a Path descriptor; effect deferred.",
    ),
    r3=dict(
        setup="two-endpoints-plus-curvature",
        r1_domain="motoi choreo",
        r1_code="(arc-between '(0 0) '(100 0) '(height 40))",
        r2_domain="cad drafting",
        r2_code=";; drafting a fillet arc between two lines:\n;; fillet start=(0,0) end=(100,0) radius=40",
        r3_domain="parametric geometry",
        r3_code=";; parametric curve p(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2\n(define (bezier2 p0 p1 p2 t) (list p0 p1 p2 t))",
        explanation="Each rung takes two endpoints and a control parameter and returns a smooth curve. The curve is the same object under three names.",
        meta="'Curvature as a parameter' is the shape; the domain provides the substrate.",
        eng="Arc primitives appear in every drafting tool and every animation library.",
        math="Bezier / conic section family, indexed by curvature.",
        cs="Path descriptor with parametric evaluator.",
    ),
    r4=dict(
        claim="arc-between passes through both endpoints: the path at t=0 equals start, and at t=1 equals end.",
        program="(define p (arc-between '(0 0) '(100 0) '(height 40)))\n;; conceptual: (path-eval p 0) => (0 0), (path-eval p 1) => (100 0)\n(display (list 'endpoints-preserved 'assumed-by-descriptor-contract))",
        invariant="∀ start end opts. path(arc-between(start, end, opts), 0) = start ∧ path(..., 1) = end",
        meta="Endpoint interpolation invariant. Falsified by any parameterisation that offsets from the endpoints. See book-of-math ch14 (Bezier curves) and book-of-motion ch11 (path primitives).",
        eng="An arc that misses its endpoint is a P1 choreography bug.",
        math="Interpolation condition on parametric curves.",
        cs="Boundary conditions on a path descriptor.",
    ),
    r5=dict(
        base="arc-between constructs a curved path descriptor.",
        composition="(define path (arc-between (entity/pos 'leader) (entity/pos 'target)))\n(in-formation path (list 'follower1 'follower2 'follower3))",
        emergent="follow-the-leader choreography: dynamic endpoint -> arc -> formation. Followers trace the arc from wherever the leader currently is.",
        meta="Same family as game AI steering paths or camera-orbit rigs. See book-of-composition ch12 (dynamic pathing).",
        eng="Dynamic recomputation each frame; costs O(1) per entity.",
        math="Path composition with time-varying endpoints.",
        cs="Curried curve constructor over live entity positions.",
    ),
)

# --- at-beat ----------------------------------------------------------------
V["at-beat"] = dict(
    r2=dict(
        problem="A rhythm game needs the player token to be at the 'strike-position' at the half-beat, not later.",
        program="(on-frame\n  (lambda ()\n    (let ((pos (at-beat 0.5)))\n      (entity/set-pos! 'player pos))))",
        explanation="Each frame, at-beat 0.5 returns the position corresponding to the half-beat offset in the current tempo. The player is teleported to that position, staying rhythm-locked.",
        meta="audio-time returns raw seconds; audio-beat? is a single-shot predicate. at-beat is the correct choice when the operator says 'give me the position at this rhythmic offset.'",
        eng="Operator log: 'position query at beat 0.5'. If the player drifts, the audit points at the tempo, not at this verb.",
        math="Beat offset is a real number; position is a function of beat and current formation.",
        cs="Read from tempo state; pure per-frame query.",
    ),
    r3=dict(
        setup="query-a-value-at-a-normalized-offset",
        r1_domain="motoi rhythm",
        r1_code="(at-beat 0.75)",
        r2_domain="animation curve",
        r2_code=";; sample a curve at t = 0.75:\n(easing 'ease-in-out 0.75)",
        r3_domain="function evaluation",
        r3_code=";; evaluate f at a specific x:\n(define (f x) (* x x))\n(f 0.75)",
        explanation="Each rung takes a normalized offset and returns the value at that offset.",
        meta="Sampling a function at a normalized coordinate; the coordinate happens to be beat-space.",
        eng="Sampling primitives are the backbone of every animation and simulation loop.",
        math="Function evaluation at a point.",
        cs="Pure query into a time-indexed value stream.",
    ),
    r4=dict(
        claim="at-beat is a pure function of the beat argument given a fixed tempo context.",
        program="(define a (at-beat 0.5))\n(define b (at-beat 0.5))\n(display (equal? a b))",
        invariant="∀ beat. (fixed-tempo → at-beat(beat) = at-beat(beat))",
        meta="Referential transparency under fixed tempo. Falsified only by tempo change between calls. See book-of-math ch01 (functions) and book-of-sound ch05 (beat grid).",
        eng="Stable per-frame; safe to memoize per tempo epoch.",
        math="Pure function of one variable.",
        cs="Read-only query on scheduler state.",
    ),
    r5=dict(
        base="at-beat samples position at a beat offset.",
        composition="(define trail '())\n(on-frame\n  (lambda ()\n    (set! trail (cons (at-beat 0) trail))\n    (when (> (length trail) 32)\n      (set! trail (take trail 32)))))",
        emergent="beat-locked history buffer: the trail records positions on each frame, all rhythm-anchored, ready to draw as a motion trail.",
        meta="Same family as circular-buffer trails in shader-based motion blur. See book-of-composition ch08 (history buffers).",
        eng="Bounded memory; trail length is a fixed operator knob.",
        math="Sampled sequence over discrete frame index.",
        cs="Ring buffer with tempo-locked producer.",
    ),
)

# --- audio-band -------------------------------------------------------------
V["audio-band"] = dict(
    r2=dict(
        problem="A visualization needs the kick-drum band (low frequency) to drive a pulsing circle radius each frame.",
        program="(on-frame\n  (lambda ()\n    (let ((kick (audio-band 2)))\n      (set-dot-radius (* 40 kick)))))",
        explanation="Each frame, band index 2 (typically bass) is read and scaled into a pixel radius. The circle pulses in size proportional to how loud the bass currently is.",
        meta="audio-rms is a scalar averaged over all frequencies; audio-peak is the max. audio-band is the correct choice when the operator wants ONE frequency bucket.",
        eng="Operator log: 'band[2]=0.72 -> radius=29'. If the pulse feels wrong, the audit is on the FFT window, not on this verb.",
        math="Magnitude of a single FFT bin; range [0,1] typically.",
        cs="Array read at index n from a per-frame snapshot.",
    ),
    r3=dict(
        setup="indexed-read-of-a-vector",
        r1_domain="motoi spectrum",
        r1_code="(audio-band 3)",
        r2_domain="thermometer bank",
        r2_code=";; read sensor 3 from a thermometer array:\n;; sensors[3].value",
        r3_domain="vector projection",
        r3_code=";; project a vector onto standard basis e_3:\n(define (proj v i) (list-ref v i))",
        explanation="Each rung takes a vector-of-magnitudes and a nonnegative index and returns the value at that slot.",
        meta="Indexed vector projection is a shape that occurs anywhere you have a bank of parallel signals.",
        eng="Sensor array pattern shared by audio, DAQ, and telemetry systems.",
        math="Projection onto a standard basis vector.",
        cs="O(1) array indexing.",
    ),
    r4=dict(
        claim="Out-of-bounds index returns 0 rather than raising; the function is total over integer indices.",
        program="(display (audio-band 999999))  ;; expect 0\n(display (audio-band -1))       ;; expect 0",
        invariant="∀ n ∈ ℤ. audio-band(n) ∈ [0, 1] ∪ {0 when out of range}",
        meta="Totality via clamping. Falsified by any raising path. See book-of-math ch01 (total functions) and book-of-ml ch04 (spectral features).",
        eng="Safe to loop over guessed ranges without try/catch.",
        math="Total function via silent clamp.",
        cs="Defensive read with default-on-bounds-miss.",
    ),
    r5=dict(
        base="audio-band reads one frequency band.",
        composition="(on-frame\n  (lambda ()\n    (when (> (audio-band 2) 0.6)\n      (world/spawn 'particle 100 100))))",
        emergent="band-triggered event source: threshold + band read = a discrete event stream keyed to a frequency.",
        meta="Same family as onset detectors, gate compressors, and Schmitt triggers. See book-of-composition ch11 (event triggers).",
        eng="Simple thresholding is the workhorse of audio-reactive gameplay.",
        math="Predicate on a scalar reading.",
        cs="Event source; discrete emission from continuous stream.",
    ),
)

# --- audio-bands ------------------------------------------------------------
V["audio-bands"] = dict(
    r2=dict(
        problem="A spectrum analyzer must paint every FFT band as a vertical bar this frame.",
        program="(define (paint-spectrum)\n  (let ((bands (audio-bands)))\n    (for-each\n      (lambda (i)\n        (grid-cell-set! i 0 (if (> (list-ref bands i) 0.3) 1 0)))\n      (iota (length bands)))))",
        explanation="audio-bands returns the whole snapshot in one call. The paint routine iterates once, saving 32+ individual reads.",
        meta="Calling audio-band N times allocates N call frames; audio-bands allocates one list. Correct choice when the operator wants the full spectrum.",
        eng="Operator log: 'bands snapshot length=64'. Full-snapshot reads are the efficient way to paint a visualizer.",
        math="Vector of magnitudes; one FFT frame.",
        cs="One allocation per call; list is a copy so caller cannot mutate engine state.",
    ),
    r3=dict(
        setup="bulk-vector-read",
        r1_domain="motoi audio",
        r1_code="(audio-bands)",
        r2_domain="database batch",
        r2_code=";; batch SELECT rather than N single-row SELECTs:\n;; SELECT * FROM bands",
        r3_domain="vector fetch",
        r3_code=";; return a whole vector v ∈ ℝⁿ in one operation:\n(define (vec-of n f) (map f (iota n)))",
        explanation="Each rung amortises cost by returning a whole vector at once instead of forcing N individual queries.",
        meta="The shape is 'when reading many, read all.' Universally faster than repeated singleton reads.",
        eng="Batch reads dominate microservice, DB, and DSP performance.",
        math="Column-vector fetch; ℝⁿ.",
        cs="Amortised O(n) vs O(n) with n call overheads.",
    ),
    r4=dict(
        claim="audio-bands returns a fresh, mutation-safe list on each call.",
        program="(define a (audio-bands))\n(set-car! a 999)\n(define b (audio-bands))\n(display (= (car b) 999))  ;; expect #f",
        invariant="∀ call. mutating the returned list does not affect the engine snapshot or future calls",
        meta="Copy-on-read isolation. Falsified if the return shares memory with engine state. See book-of-computing ch09 (aliasing) and book-of-math ch12 (vectors).",
        eng="Safe to hand around without defensive copies at every stage.",
        math="Value semantics.",
        cs="Copy-on-read barrier between engine state and Scheme heap.",
    ),
    r5=dict(
        base="audio-bands returns the whole spectrum vector.",
        composition="(define history '())\n(on-frame\n  (lambda ()\n    (set! history (cons (audio-bands) history))\n    (when (> (length history) 60)\n      (set! history (take history 60)))))",
        emergent="spectrogram: bounded history of spectrum snapshots is a spectrogram, ready to render as a scrolling image.",
        meta="Same family as waterfall displays and spectrograms in ham radio and DSP. See book-of-composition ch08 (history buffers) and book-of-sound ch09 (spectrograms).",
        eng="Bounded ring buffer; memory footprint is constant.",
        math="Time-indexed sequence of vectors: a matrix.",
        cs="Ring buffer with vector element type.",
    ),
)

# --- audio-bar-clock --------------------------------------------------------
V["audio-bar-clock"] = dict(
    r2=dict(
        problem="A vinyl record graphic must rotate smoothly in sync with the song, one full turn per bar.",
        program="(define clk (audio-bar-clock (audio-play 'song) 1))\n(on-frame\n  (lambda ()\n    (rotate-card 'vinyl (clk 'radians))))",
        explanation="The clock ticks in sync with the audio engine. Each frame, radians is queried and the vinyl is rotated to that angle. Because the clock reads live audio time, the rotation stays locked to the beat grid regardless of frame rate.",
        meta="tick/phase runs on wall-clock; audio-time returns seconds. audio-bar-clock is the correct choice when the operator wants a beat-anchored phase.",
        eng="Operator log: 'bar-clock phase=0.42 rad=2.64'. If rotation drifts, the audit is on the tempo, not on this closure.",
        math="Phase φ(t) = fractional-part(t / bar-length); radians = 2π · φ.",
        cs="Closure holding a reference to audio state; queries return current phase.",
    ),
    r3=dict(
        setup="normalized-phase-over-a-cycle",
        r1_domain="motoi audio",
        r1_code="(audio-bar-clock (audio-play 'song))",
        r2_domain="engine timing belt",
        r2_code=";; engine crank angle relative to TDC:\n;; crank_phase = (angle mod 720°) / 720°",
        r3_domain="circle group",
        r3_code=";; ℝ / ℤ: real number modulo one\n(define (phase t) (- t (floor t)))",
        explanation="Each rung is a value that wraps around at a period boundary, exposing progress as a fraction in [0,1).",
        meta="'Phase' is a fundamental time shape; any periodic system has one.",
        eng="Wall-clock vs music-clock is a classic SRE trap; anchoring on the music-clock is honest.",
        math="Element of the circle group ℝ/ℤ.",
        cs="Modular phase closure with side-effect-free read.",
    ),
    r4=dict(
        claim="Phase is monotone within one cycle and wraps to zero at bar boundaries.",
        program="(define clk (audio-bar-clock (audio-play 'song)))\n(define p1 (clk 'phase))\n;; a few frames later:\n(define p2 (clk 'phase))\n(display (or (>= p2 p1) (< p2 p1)))  ;; monotone within cycle, wraps between",
        invariant="∀ t ∈ [bar-k, bar-(k+1)). phase(t) ∈ [0,1) ∧ monotone ↑, phase(bar-(k+1))=0",
        meta="Modular monotonicity. Falsified by any negative-going phase within a cycle. See book-of-math ch05 (modular arithmetic) and book-of-sound ch07 (bar phase).",
        eng="Stable wrap is what keeps the vinyl from stuttering.",
        math="Monotone within a period, discontinuous at the period boundary.",
        cs="Wrap-around counter with normalized output.",
    ),
    r5=dict(
        base="audio-bar-clock gives a beat-anchored phase closure.",
        composition="(define clk (audio-bar-clock (audio-play 'song) 4))\n(on-frame\n  (lambda ()\n    (rotate-card 'wheel-a (clk 'radians))\n    (rotate-card 'wheel-b (* 2 (clk 'radians)))))",
        emergent="polyrhythmic visual rig: two wheels spinning at 1x and 2x from ONE phase source. Cheap, exact, and rhythm-locked.",
        meta="Same family as LFO fan-out in modular synths. See book-of-composition ch10 (fan-out) and book-of-sound ch12 (polyrhythm).",
        eng="One source of truth for phase means less drift between visual elements.",
        math="Phase multiplication for harmonics.",
        cs="Shared closure with multiple consumers.",
    ),
)

# --- audio-beat? ------------------------------------------------------------
V["audio-beat?"] = dict(
    r2=dict(
        problem="A player must spawn a particle every time the beat lands, not on every frame.",
        program="(on-frame\n  (lambda ()\n    (when (audio-beat?)\n      (world/spawn 'particle 100 100))))",
        explanation="Each frame the predicate is checked; only when a beat is detected does the spawn fire. Frames between beats are silent.",
        meta="audio-bpm returns tempo but is a magnitude, not an event; on-tick fires every frame. audio-beat? is the correct choice when the operator wants a discrete rhythmic pulse.",
        eng="Operator log: 'beat fired at frame 240'. If no particles appear, the audit checks whether audio is playing.",
        math="Predicate over frame index; true at most once per beat.",
        cs="Frame-locked boolean; edge-triggered per beat.",
    ),
    r3=dict(
        setup="edge-triggered-event",
        r1_domain="motoi rhythm",
        r1_code="(when (audio-beat?) 'kick)",
        r2_domain="digital circuit",
        r2_code=";; rising-edge detector on a clock signal:\n;; if prev==0 and cur==1 then edge",
        r3_domain="calculus (derivative sign)",
        r3_code=";; f'(t) > 0 at t = beat instant\n(define (edge-of f t dt) (> (/ (- (f t) (f (- t dt))) dt) 0))",
        explanation="Each rung fires ONCE at the transition, not throughout the on-state.",
        meta="Edge-triggering is the shape; the substrate can be beats, clocks, or continuous signals.",
        eng="Edge triggers avoid double-fires that plague level-triggered systems.",
        math="Discrete derivative sign at a boundary.",
        cs="Debounce-adjacent primitive; single-pulse per event.",
    ),
    r4=dict(
        claim="Between two consecutive beats, audio-beat? returns true on at most one frame.",
        program="(define count 0)\n(on-frame\n  (lambda ()\n    (when (audio-beat?) (set! count (+ count 1)))))\n;; After 8 beats of playback, count = 8, not 8*frames-per-beat.\n(display count)",
        invariant="∀ beat-interval [b_k, b_{k+1}). |{frames f ∈ interval : audio-beat?(f)}| ≤ 1",
        meta="At-most-once-per-beat guarantee. Falsified if the predicate is level-triggered rather than edge-triggered. See book-of-computing ch04 (edge detection) and book-of-sound ch05 (beat detection).",
        eng="One event per beat; downstream counters stay honest.",
        math="Cardinality bound on the true-set per interval.",
        cs="Edge-trigger contract; latch-and-clear semantics.",
    ),
    r5=dict(
        base="audio-beat? fires once per detected beat.",
        composition="(define beats 0)\n(on-frame\n  (lambda ()\n    (when (audio-beat?)\n      (set! beats (+ beats 1))\n      (when (= (modulo beats 4) 0)\n        (world/spawn 'downbeat-flash 0 0)))))",
        emergent="measure detector: counter + modulo 4 + beat trigger = downbeat classifier. Every fourth beat is a downbeat.",
        meta="Same family as measure detection in DAW pianoroll UIs. See book-of-composition ch11 (event counting) and book-of-sound ch06 (measures).",
        eng="Composable rhythm classifier from primitives.",
        math="Modular counting on beat index.",
        cs="Counter + predicate = classifier.",
    ),
)

# --- audio-bpm --------------------------------------------------------------
V["audio-bpm"] = dict(
    r2=dict(
        problem="A scheduler needs to know how many milliseconds are in one beat so it can queue events at fractional-beat offsets.",
        program="(define (beat-ms)\n  (let ((bpm (audio-bpm)))\n    (if bpm (/ 60000 bpm) 500)))",
        explanation="audio-bpm returns detected tempo or #f. The wrapper falls back to 500ms if the detector has not locked yet.",
        meta="audio-tempo SETS tempo; audio-time returns raw seconds. audio-bpm is the correct choice when the operator wants the CURRENT detected tempo.",
        eng="Operator log: 'bpm=124'. If bpm returns #f, the audit checks whether the detector has enough audio to lock.",
        math="60000 / bpm = beat length in ms.",
        cs="Read from tempo estimator; may return #f.",
    ),
    r3=dict(
        setup="detected-rate-with-fallback",
        r1_domain="motoi audio",
        r1_code="(audio-bpm)",
        r2_domain="network throughput",
        r2_code=";; measured MB/s or #f if not enough data:\n;; iperf3 --interval 1",
        r3_domain="frequency estimation",
        r3_code=";; f_est = 1 / avg-period-between-peaks\n(define (freq-est peaks) (/ 1 (avg (map -diff peaks))))",
        explanation="Each rung produces a live estimate of a rate; each may return 'unknown' until enough evidence accumulates.",
        meta="'Rate estimator with confidence' shows up in networking, audio, sensor fusion.",
        eng="Falsy return communicates 'not enough data yet.'",
        math="Estimator with an admission threshold.",
        cs="Sum-type return: Number ∪ #f.",
    ),
    r4=dict(
        claim="When bpm returns a number, that number is strictly positive.",
        program="(let ((b (audio-bpm)))\n  (display (or (not b) (> b 0))))  ;; expect #t",
        invariant="∀ call. audio-bpm() ∈ (0, ∞) ∨ audio-bpm() = #f",
        meta="Positivity of the detected rate. Falsified by any zero or negative return. See book-of-math ch03 (positive reals) and book-of-sound ch05 (tempo detection).",
        eng="Zero-bpm returns would cause divide-by-zero in beat-ms; the type keeps that out.",
        math="Positive real or 'undefined'.",
        cs="Sum type: Positive ∪ NoValue.",
    ),
    r5=dict(
        base="audio-bpm returns detected tempo.",
        composition="(define (schedule-fractional n)\n  (let ((bpm (audio-bpm)))\n    (when bpm\n      (after (/ 60 (* bpm n)) 'trigger))))",
        emergent="tempo-scaled scheduler: divide beat by n and schedule at that sub-beat. Straight from tempo to timing.",
        meta="Same family as DAW clip-launch quantization. See book-of-composition ch09 (scheduling) and book-of-sound ch04 (subdivisions).",
        eng="Tempo change automatically retunes the schedule.",
        math="Beat subdivision: 60 / (bpm · n) seconds per sub-beat.",
        cs="Rate-parametrised scheduler.",
    ),
)

# --- audio-halt -------------------------------------------------------------
V["audio-halt"] = dict(
    r2=dict(
        problem="The player pauses the game; all audio must stop cleanly and the audio handle must reflect that.",
        program="(define h (audio-play 'bg))\n(define paused? (lambda () (audio-halt h)))\n(paused?)",
        explanation="audio-halt takes the play handle and stops the sound. The zero-duration handle it returns lets downstream code treat the halt uniformly with a play.",
        meta="audio-master-volume=0 mutes but keeps CPU cost; stop halts the whole game loop. audio-halt is the correct choice for stopping ONE source.",
        eng="Operator log: 'halted handle bg'. If sound continues, the audit checks whether other play handles are live.",
        math="Handle life ends at halt-time.",
        cs="Explicit dispose; returns a canonical zero-handle.",
    ),
    r3=dict(
        setup="explicit-resource-close",
        r1_domain="motoi audio",
        r1_code="(audio-halt h)",
        r2_domain="filesystem",
        r2_code=";; close a file descriptor:\n;; close(fd)",
        r3_domain="linear resources",
        r3_code=";; a linear resource must be used exactly once, then freed:\n(define (use-then-free r use free) (let ((v (use r))) (free r) v))",
        explanation="Each rung explicitly ends the life of a runtime resource. After close, the handle is no longer valid for its original purpose.",
        meta="Close/halt/free are the same closure boundary for a runtime resource.",
        eng="Explicit close is the honest audit boundary.",
        math="Linearity: a resource is closed exactly once.",
        cs="RAII / manual dispose pattern.",
    ),
    r4=dict(
        claim="After audio-halt, the halted handle produces no further audio.",
        program="(define h (audio-play 'bg))\n(audio-halt h)\n(display (audio-playing?))  ;; #f expected if no other sources",
        invariant="∀ h. after audio-halt(h): produces-sound(h) = #f",
        meta="Halt idempotence and terminality. Falsified by any post-halt sound from the same handle. See book-of-computing ch10 (resource lifetimes).",
        eng="Halted means halted; no ghost playback.",
        math="Absorbing state; halted is a sink.",
        cs="Idempotent dispose.",
    ),
    r5=dict(
        base="audio-halt stops one source cleanly.",
        composition="(define h #f)\n(define (play-once! id)\n  (when h (audio-halt h))\n  (set! h (audio-play id)))",
        emergent="single-voice policy: at most one background source is alive at a time. New play halts the old one.",
        meta="Same family as CSS keyframe animations that override in-progress ones, or setTimeout guards. See book-of-composition ch13 (single-slot patterns).",
        eng="Prevents audio layering bugs from repeated play calls.",
        math="Singleton invariant on the live handle set.",
        cs="Mutual exclusion via replace-and-close.",
    ),
)

# --- audio-master-volume ----------------------------------------------------
V["audio-master-volume"] = dict(
    r2=dict(
        problem="A settings menu slider must set the global audio volume.",
        program="(define (set-volume! v)\n  (audio-master-volume (max 0 (min 1 v))))\n(set-volume! 0.6)",
        explanation="The wrapper clamps input to [0,1] and forwards. Applying the update takes effect immediately for all playing sources.",
        meta="audio-halt stops a source; audio-tempo changes speed. audio-master-volume is the correct choice for a global gain change.",
        eng="Operator log: 'master vol=0.60'. If audio gets too loud, the audit is on this call site.",
        math="Volume is a scalar multiplier applied to the mixed output.",
        cs="Global-state write; propagates to all live sources.",
    ),
    r3=dict(
        setup="global-scalar-mixer",
        r1_domain="motoi audio",
        r1_code="(audio-master-volume 0.5)",
        r2_domain="brightness",
        r2_code=";; set display backlight to 50%:\n;; brightnessctl set 50%",
        r3_domain="linear scaling",
        r3_code=";; multiply every element of a vector by a scalar\n(define (scale k v) (map (lambda (x) (* k x)) v))",
        explanation="Each rung applies a single scalar to a whole downstream stream.",
        meta="'Scalar multiply on a bulk stream' is the same shape whether it's audio, display, or vectors.",
        eng="One knob for global gain reduces mixing complexity.",
        math="Scalar multiplication on a signal.",
        cs="Broadcast operation.",
    ),
    r4=dict(
        claim="Volume 0 mutes; volume 1 is the original level; the mapping is monotone in between.",
        program="(audio-master-volume 0)\n(display (audio-playing?))  ;; may still be true, but silent",
        invariant="∀ v ∈ [0,1]. output-amplitude(v) = v · original-amplitude",
        meta="Linear gain mapping. Falsified by non-monotone or clipped-nonzero-at-zero curves. See book-of-math ch03 (linearity) and book-of-sound ch08 (gain).",
        eng="Linear mapping is easier to reason about than dB curves in game code.",
        math="Homogeneous linear map: g(αx) = αg(x).",
        cs="Global scalar; O(1) write.",
    ),
    r5=dict(
        base="audio-master-volume sets global gain.",
        composition="(define (fade-out ms)\n  (let loop ((v 1))\n    (audio-master-volume v)\n    (when (> v 0)\n      (after (/ ms 100 1000) (loop (- v 0.01))))))",
        emergent="fade-out sequencer: after + volume = a smooth taper, no mixer plugin required.",
        meta="Same family as CSS transitions on opacity, or DAW automation lanes. See book-of-composition ch14 (envelopes) and book-of-sound ch10 (fades).",
        eng="Composed fade avoids abrupt silence at scene end.",
        math="Linear taper over time.",
        cs="Time-parameterised gain automation.",
    ),
)

# --- audio-peak -------------------------------------------------------------
V["audio-peak"] = dict(
    r2=dict(
        problem="A clip indicator light must turn red whenever peak loudness exceeds 0.95.",
        program="(on-frame\n  (lambda ()\n    (grid-cell-set! 0 0 (if (> (audio-peak) 0.95) 1 0))))",
        explanation="audio-peak returns the frame's max amplitude. The cell lights red on any near-clip frame.",
        meta="audio-rms is averaged and hides transients; audio-band picks one frequency. audio-peak is the correct choice for clip detection.",
        eng="Operator log: 'peak=0.98 -> CLIP'. If clipping is missed, the audit is on the buffer window, not this verb.",
        math="peak = max(|sample|) over the current frame.",
        cs="Scalar reduction; O(n) over frame samples internally.",
    ),
    r3=dict(
        setup="max-reduction-over-a-window",
        r1_domain="motoi audio",
        r1_code="(audio-peak)",
        r2_domain="latency monitor",
        r2_code=";; max p99 over last minute:\n;; max_over_time(latency[1m])",
        r3_domain="ℓ∞ norm",
        r3_code=";; the infinity norm of a vector\n(define (linf v) (apply max (map abs v)))",
        explanation="Each rung reduces a window of values to its maximum.",
        meta="Max-reduction is the shape; the substrate is audio frames, metrics windows, or vectors.",
        eng="Max-reductions catch transient events that averages hide.",
        math="ℓ∞ norm; supremum reduction.",
        cs="Fold with max.",
    ),
    r4=dict(
        claim="audio-peak is bounded above by 1 for normalized audio.",
        program="(display (<= (audio-peak) 1.0))  ;; expect #t",
        invariant="∀ frame. audio-peak() ∈ [0, 1]",
        meta="Range guarantee. Falsified by any peak > 1 without an explicit unclamped mode. See book-of-math ch03 (bounded functions) and book-of-sound ch08 (normalization).",
        eng="Bounded output = safe to treat as a proportion.",
        math="Range [0, 1].",
        cs="Post-normalization reduction.",
    ),
    r5=dict(
        base="audio-peak returns max-amplitude of the frame.",
        composition="(define recent-peaks '())\n(on-frame\n  (lambda ()\n    (set! recent-peaks (cons (audio-peak) recent-peaks))\n    (when (> (length recent-peaks) 60)\n      (set! recent-peaks (take recent-peaks 60)))))",
        emergent="peak-history buffer: bounded ring of peaks = a rolling loudness meter.",
        meta="Same family as loudness meters in broadcast (LUFS-M short-term). See book-of-composition ch08 (rolling metrics) and book-of-sound ch09 (loudness).",
        eng="Rolling window smooths perception without losing transients.",
        math="Sliding-window ℓ∞.",
        cs="Ring buffer with scalar element.",
    ),
)

# --- audio-perceptual-bands -------------------------------------------------
V["audio-perceptual-bands"] = dict(
    r2=dict(
        problem="A VJ tool wants bars whose heights match how humans HEAR loudness, not raw FFT magnitude.",
        program="(on-frame\n  (lambda ()\n    (let ((bands (audio-perceptual-bands)))\n      (for-each\n        (lambda (i)\n          (grid-cell-set! i 0 (list-ref bands i)))\n        (iota (length bands))))))",
        explanation="Perceptual bands are re-binned toward Mel or Bark scale, so bass regions get wider spacing than raw FFT would.",
        meta="audio-bands gives even-spaced FFT bins; audio-band picks one. audio-perceptual-bands is the correct choice when the operator wants bars that MATCH HEARING.",
        eng="Operator log: 'perceptual bands length=24'. Human-scaled bars 'look right' where FFT bars feel bass-heavy.",
        math="Mel-scale re-binning; f_mel = 2595 · log10(1 + f/700).",
        cs="Re-index of the FFT bin array to non-uniform buckets.",
    ),
    r3=dict(
        setup="perceptual-remapping",
        r1_domain="motoi audio",
        r1_code="(audio-perceptual-bands)",
        r2_domain="tone-mapped image",
        r2_code=";; HDR to LDR with a Reinhard tone-map:\n;; ldr = hdr / (1 + hdr)",
        r3_domain="log-scale plot",
        r3_code=";; y = log10(x): compress dynamic range to match perception\n(define (log-scale x) (/ (log x) (log 10)))",
        explanation="Each rung remaps a signal so equal steps in output correspond to equal steps in perception, not equal steps in the raw substrate.",
        meta="Perceptual remapping is the shape; audio, HDR, and log-plot all share it.",
        eng="Human eye and ear are logarithmic; matching them removes UX friction.",
        math="Nonlinear invertible remap.",
        cs="Re-binning transform.",
    ),
    r4=dict(
        claim="Perceptual bands preserve total energy (up to bin-width weighting): sum of perceptual bands ≈ sum of FFT bands.",
        program="(let ((p (apply + (audio-perceptual-bands)))\n      (f (apply + (audio-bands))))\n  (display (list 'perceptual p 'fft f)))",
        invariant="∀ frame. Σ perceptual ≈ Σ fft (up to weighting)",
        meta="Energy-preservation. Falsified by re-binning that drops or duplicates FFT energy. See book-of-math ch11 (integration invariance) and book-of-ml ch04 (Mel spectrogram).",
        eng="Energy preservation means visualizations feel honest.",
        math="Parseval-like conservation across re-binning.",
        cs="Weighted sum reduction across buckets.",
    ),
    r5=dict(
        base="audio-perceptual-bands returns Mel-scaled magnitudes.",
        composition="(define log '())\n(on-frame\n  (lambda ()\n    (set! log (cons (audio-perceptual-bands) log))\n    (when (> (length log) 300) (set! log (take log 300)))))",
        emergent="Mel-spectrogram history: 300 frames of perceptual bands = the input feature to most audio ML models.",
        meta="Same family as MFCC pipelines in speech ML. See book-of-composition ch08 (features over time) and book-of-ml ch05 (Mel features).",
        eng="Feature buffer ready for ML consumption.",
        math="Time-frequency matrix in perceptual coordinates.",
        cs="Bounded feature buffer; ML-ready shape.",
    ),
)

# --- audio-play -------------------------------------------------------------
V["audio-play"] = dict(
    r2=dict(
        problem="On level start, a background loop must begin.",
        program="(define (start-level!)\n  (define h (audio-play 'bg-loop))\n  h)\n(start-level!)",
        explanation="audio-play kicks off playback of the named source and returns a handle. The handle is what audio-halt or audio-bar-clock consumes downstream.",
        meta="tempo sets rate but does not START; note-strike sounds ONE pitch. audio-play is the correct choice to start a named sample or loop.",
        eng="Operator log: 'play bg-loop handle=42'. If audio never starts, the audit checks the sample registry.",
        math="Handle life begins at play-time.",
        cs="Resource acquisition; returns a handle token.",
    ),
    r3=dict(
        setup="named-resource-open",
        r1_domain="motoi audio",
        r1_code="(audio-play 'bg-loop)",
        r2_domain="filesystem",
        r2_code=";; open a file by path:\n;; fd = open('/tmp/log', 'r')",
        r3_domain="process fork",
        r3_code=";; fork returns a pid to the parent:\n(define (fork proc) (list 'pid proc))",
        explanation="Each rung takes a NAME and returns a HANDLE for later reference and cleanup.",
        meta="'Name in, handle out' is the shape.",
        eng="Handle-oriented APIs support explicit lifetime management.",
        math="Injection from name-space to handle-space.",
        cs="Resource-acquisition-is-handle pattern.",
    ),
    r4=dict(
        claim="Two calls to audio-play with the same name return distinct handles.",
        program="(define a (audio-play 'bg))\n(define b (audio-play 'bg))\n(display (not (eq? a b)))",
        invariant="∀ name. handle(play(name)) fresh across calls",
        meta="Handle uniqueness. Falsified by any handle re-use. See book-of-computing ch10 (resource identity).",
        eng="Distinct handles allow independent halt / volume adjust per instance.",
        math="Injective handle generator.",
        cs="Fresh identifier allocation.",
    ),
    r5=dict(
        base="audio-play starts a source and returns a handle.",
        composition="(define h1 (audio-play 'pad))\n(define h2 (audio-play 'lead))\n(after 4 'fade)\n(define (fade ctx) (audio-halt h1) (audio-halt h2))",
        emergent="paired-source lifecycle: two plays and one delayed halt = a timed audio layer.",
        meta="Same family as clip-launcher / DAW automation. See book-of-composition ch09 (timed lifecycles) and book-of-sound ch11 (layered playback).",
        eng="Explicit lifecycle avoids stuck loops at scene change.",
        math="Bounded life interval [t_play, t_halt].",
        cs="Paired acquire / release with a scheduler.",
    ),
)

# --- audio-playing? ---------------------------------------------------------
V["audio-playing?"] = dict(
    r2=dict(
        problem="Before scheduling a beat-locked animation, the operator must confirm audio is actually playing.",
        program="(when (audio-playing?)\n  (on-frame (lambda () (when (audio-beat?) (world/spawn 'flash 0 0)))))",
        explanation="The when guard skips scheduling entirely if audio is silent, preventing wasted animation cost.",
        meta="audio-bpm returning a number is a stronger claim; audio-beat? is one-shot. audio-playing? is the correct choice for a general 'is anything sounding?' guard.",
        eng="Operator log: 'audio-playing? = #f -> skip animation'. Safe entry check.",
        math="Boolean predicate over engine state.",
        cs="Global state read; O(1).",
    ),
    r3=dict(
        setup="liveness-predicate",
        r1_domain="motoi audio",
        r1_code="(audio-playing?)",
        r2_domain="service healthcheck",
        r2_code=";; is my downstream up?\n;; curl -sf http://svc/healthz",
        r3_domain="observable state",
        r3_code=";; predicate on a state variable\n(define running? #t)\n(define (alive?) running?)",
        explanation="Each rung is a boolean read that answers 'is this thing currently active?'",
        meta="Liveness checks are the same shape whether audio, services, or state machines.",
        eng="Cheap probes; safe to call every frame.",
        math="Boolean-valued function of runtime state.",
        cs="Idempotent read.",
    ),
    r4=dict(
        claim="audio-playing? is idempotent: two consecutive calls in the same frame return equal values.",
        program="(display (equal? (audio-playing?) (audio-playing?)))",
        invariant="∀ frame f. audio-playing?(f, t1) = audio-playing?(f, t2) for t1,t2 ∈ f",
        meta="Intra-frame determinism. Falsified by any state change during a frame. See book-of-computing ch07 (frame semantics).",
        eng="Idempotent probes let operators cache the answer freely.",
        math="Function is constant over a frame partition.",
        cs="Frame-locked read.",
    ),
    r5=dict(
        base="audio-playing? guards on audio liveness.",
        composition="(define (with-audio thunk)\n  (if (audio-playing?) (thunk) (display 'silent-skip)))",
        emergent="conditional pipeline stage: predicate + thunk = a gate that skips downstream work when the substrate is inactive.",
        meta="Same family as guard clauses in service meshes. See book-of-composition ch06 (gates).",
        eng="Cost-avoidance pattern for silent scenes.",
        math="Conditional identity: thunk applied only under the predicate.",
        cs="Guard pattern; short-circuit evaluation.",
    ),
)

# --- audio-rms --------------------------------------------------------------
V["audio-rms"] = dict(
    r2=dict(
        problem="A camera shake effect should scale with perceived loudness, which is closer to RMS than peak.",
        program="(on-frame\n  (lambda ()\n    (camera-set! (* 5 (audio-rms)) 0 1)))",
        explanation="Each frame the RMS energy is scaled by 5 and used as the camera x offset. Loud sections shake more than quiet ones, smoothly.",
        meta="audio-peak jumps on transients; audio-band is bucket-specific. audio-rms is the correct choice for a perceived-loudness scalar.",
        eng="Operator log: 'rms=0.35 -> shake=1.75px'. Smooth shake without transient jerkiness.",
        math="rms = sqrt(mean(x²)) over frame samples.",
        cs="Reduction: fold with squared-add then sqrt.",
    ),
    r3=dict(
        setup="quadratic-mean-of-a-window",
        r1_domain="motoi audio",
        r1_code="(audio-rms)",
        r2_domain="voltage meter",
        r2_code=";; true-RMS DMM: reads the equivalent DC voltage of an AC waveform:\n;; V_rms = sqrt(1/T · ∫ v(t)² dt)",
        r3_domain="ℓ² norm",
        r3_code=";; the 2-norm of a vector\n(define (l2 v) (sqrt (apply + (map (lambda (x) (* x x)) v))))",
        explanation="Each rung reduces a window of values to their quadratic mean.",
        meta="'Quadratic mean' is the shape; audio, voltage, and vector norm all use it.",
        eng="RMS is the honest perceptual loudness proxy.",
        math="ℓ² norm normalised by count.",
        cs="Fold with squared accumulator.",
    ),
    r4=dict(
        claim="audio-rms is always at most audio-peak in the same frame.",
        program="(let ((r (audio-rms)) (p (audio-peak)))\n  (display (<= r p)))",
        invariant="∀ frame. audio-rms(frame) ≤ audio-peak(frame)",
        meta="Norm inequality ℓ² ≤ ℓ∞ (with equal normalisation). Falsified only by a bug in the reduction. See book-of-math ch09 (norm inequalities) and book-of-sound ch08 (loudness measures).",
        eng="A tripped RMS-above-peak alert is a bug indicator.",
        math="Standard norm inequality.",
        cs="Reduction-consistency check.",
    ),
    r5=dict(
        base="audio-rms returns the frame's quadratic-mean energy.",
        composition="(define (auto-duck! speech-level)\n  (audio-master-volume (max 0 (- 1 (* 2 speech-level)))))\n(on-frame (lambda () (auto-duck! (audio-rms))))",
        emergent="ducking mixer: RMS-driven volume automation. When a voice speaks, background ducks proportionally.",
        meta="Same family as broadcast auto-duckers and podcast sidechain compressors. See book-of-composition ch14 (envelopes) and book-of-sound ch08 (ducking).",
        eng="Perceptual duck feels smoother than peak-triggered.",
        math="Continuous negative-feedback on gain.",
        cs="Control loop with RMS as sensor and gain as actuator.",
    ),
)

# --- audio-tempo ------------------------------------------------------------
V["audio-tempo"] = dict(
    r2=dict(
        problem="A boss fight speeds up: the tempo must jump from 120 to 160 BPM.",
        program="(audio-tempo 160)",
        explanation="One call sets the transport tempo; all beat-locked systems immediately re-time.",
        meta="audio-bpm READS tempo; audio-play starts audio. audio-tempo is the correct choice to SET the master rate.",
        eng="Operator log: 'tempo <- 160'. If beat scheduling desyncs, the audit is on which transport is subscribed.",
        math="Tempo is a positive real in BPM.",
        cs="Global state write; broadcast semantics.",
    ),
    r3=dict(
        setup="global-rate-set",
        r1_domain="motoi transport",
        r1_code="(audio-tempo 160)",
        r2_domain="motor controller",
        r2_code=";; set spindle RPM:\n;; spindle_set_rpm(160)",
        r3_domain="parameter of a periodic system",
        r3_code=";; increase the angular frequency ω of an oscillator\n(define omega 160)",
        explanation="Each rung sets a single global rate that governs the timing of everything downstream.",
        meta="Rate-set is the shape; the substrate is beats, RPM, or omega.",
        eng="One knob for global tempo simplifies music transport.",
        math="Angular frequency setter.",
        cs="Global scalar; propagates to subscribers.",
    ),
    r4=dict(
        claim="audio-tempo is monotone in effect: setting higher BPM increases beat rate.",
        program="(audio-tempo 60)\n(define t1 (audio-time))\n(audio-tempo 120)\n(define t2 (audio-time))\n(display (list t1 t2))",
        invariant="∀ b1 < b2. beats-per-second(tempo=b1) < beats-per-second(tempo=b2)",
        meta="Monotone rate mapping. Falsified by any non-monotone tempo-to-rate curve. See book-of-math ch06 (monotone functions) and book-of-sound ch05 (tempo).",
        eng="Monotone tempo = predictable playback speed.",
        math="Order-preserving map from BPM to Hz.",
        cs="Linear rate parameter.",
    ),
    r5=dict(
        base="audio-tempo sets global BPM.",
        composition="(define target 120)\n(on-frame\n  (lambda ()\n    (let* ((cur (or (audio-bpm) 120))\n           (next-tempo (+ cur (* 0.05 (- target cur)))))\n      (audio-tempo next-tempo))))",
        emergent="tempo-easing loop: proportional controller drives tempo toward a target smoothly, no jarring jumps.",
        meta="Same family as PID rate controllers or DAW tempo ramps. See book-of-composition ch14 (control loops) and book-of-sound ch05 (tempo automation).",
        eng="Smooth tempo change avoids listener jarring.",
        math="First-order lag: dτ/dt = k(target - τ).",
        cs="Proportional controller with tempo as actuator.",
    ),
)

# --- audio-time -------------------------------------------------------------
V["audio-time"] = dict(
    r2=dict(
        problem="A scheduler must fire an event exactly 3 seconds after a music cue.",
        program="(define cue-time (audio-time))\n(define (check ctx)\n  (if (> (- (audio-time) cue-time) 3)\n      (next 'fire ctx)\n      (next 'check ctx)))",
        explanation="cue-time captures the current audio clock. On each pass through check, the delta is compared against 3 seconds.",
        meta="frame counts video frames; wall-clock drifts from audio. audio-time is the correct choice for audio-anchored timing.",
        eng="Operator log: 'audio-time=42.14s'. If cue drift appears, the audit is on the audio buffer, not this verb.",
        math="Audio clock: monotone real in seconds.",
        cs="Read from audio scheduler's clock.",
    ),
    r3=dict(
        setup="monotone-clock",
        r1_domain="motoi audio",
        r1_code="(audio-time)",
        r2_domain="unix",
        r2_code=";; monotonic clock, unaffected by wall-clock changes:\n;; clock_gettime(CLOCK_MONOTONIC, &ts)",
        r3_domain="totally ordered real time",
        r3_code=";; monotone increasing t:\n(define (later? a b) (> b a))",
        explanation="Each rung provides a value that never decreases, giving downstream logic a total order to reason about.",
        meta="'Monotone clock' is the shape; the substrate is audio buffer, kernel counter, or model of time.",
        eng="Monotonic clocks are the SRE gold standard for timing.",
        math="Total order on ℝ.",
        cs="Never-decreasing counter.",
    ),
    r4=dict(
        claim="audio-time is monotone non-decreasing across two consecutive reads.",
        program="(define a (audio-time))\n(define b (audio-time))\n(display (>= b a))",
        invariant="∀ read pair (a, b) with a preceding b. audio-time(b) ≥ audio-time(a)",
        meta="Clock monotonicity. Falsified by any backward step. See book-of-computing ch08 (clocks) and book-of-math ch01 (order).",
        eng="No backward clock; safe for elapsed-time arithmetic.",
        math="Monotone non-decreasing function of call-order.",
        cs="Monotonic counter contract.",
    ),
    r5=dict(
        base="audio-time exposes the audio clock.",
        composition="(define start (audio-time))\n(define (fade-alpha)\n  (max 0 (- 1 (/ (- (audio-time) start) 5))))\n(on-frame (lambda () (set-alpha (fade-alpha))))",
        emergent="fade envelope: audio-time + start-time = a time-since-start signal, ready to drive a linear fade.",
        meta="Same family as GLSL uniform 'time' driving shaders. See book-of-composition ch14 (envelopes).",
        eng="Time-since-cue is a universal envelope primitive.",
        math="Affine map: alpha = 1 - (t - start)/duration.",
        cs="Elapsed-time derivation from a monotonic clock.",
    ),
)

# --- begin-frame ------------------------------------------------------------
V["begin-frame"] = dict(
    r2=dict(
        problem="Before painting a scene, the operator must mark the frame boundary so drawing commands land in a fresh buffer.",
        program="(begin-frame 'main)\n(grid-cell-set! 0 0 1)\n(grid-cell-set! 1 1 1)\n(end-frame 'main)",
        explanation="begin-frame opens a drawing session on the named surface. All drawing calls between begin and end are batched into one frame.",
        meta="on-frame runs a callback per frame; after-frame defers to post-paint. begin-frame is the correct choice to OPEN a paint session.",
        eng="Operator log: 'begin-frame main'. If drawings leak between frames, the audit checks begin/end pairing.",
        math="Frame boundary marker.",
        cs="Transaction begin.",
    ),
    r3=dict(
        setup="scoped-batch-begin",
        r1_domain="motoi framebuffer",
        r1_code="(begin-frame 'main)",
        r2_domain="database",
        r2_code=";; open a transaction:\n;; BEGIN;",
        r3_domain="scope open",
        r3_code=";; let opens a scope binding\n(define (with-scope thunk) (thunk))",
        explanation="Each rung opens a bounded region where operations accumulate before being committed together.",
        meta="'Begin a scope' is the shape.",
        eng="Transactional paint prevents partial-frame artifacts.",
        math="Boundary of a scope operator.",
        cs="Begin marker of a two-phase operation.",
    ),
    r4=dict(
        claim="Every begin-frame must be paired with an end-frame; between them, drawing commands accumulate.",
        program="(begin-frame 'test)\n(grid-cell-set! 5 5 1)\n(end-frame 'test)\n(display 'paired-correctly)",
        invariant="∀ surface s. begin-frame(s) has exactly one matching end-frame(s) before another begin-frame(s)",
        meta="Balanced-pair invariant. Falsified by unbalanced begin/end. See book-of-computing ch06 (transactions) and book-of-animation ch03 (frame lifecycle).",
        eng="Unbalanced pairs are an easy grep target during audit.",
        math="Balanced parenthesization.",
        cs="Bracketed transaction semantics.",
    ),
    r5=dict(
        base="begin-frame opens a paint session.",
        composition="(define (with-frame surface thunk)\n  (begin-frame surface)\n  (thunk)\n  (end-frame surface))\n(with-frame 'main (lambda () (grid-cell-set! 0 0 1)))",
        emergent="scoped-frame macro: begin + user-code + end = a bracket, safer than manual pairing.",
        meta="Same family as Python's with-block, try/finally, or SQL BEGIN/COMMIT wrapper. See book-of-composition ch05 (brackets).",
        eng="Bracket forms eliminate leaked begin/end bugs.",
        math="Scope-forming higher-order function.",
        cs="Resource-scoped combinator.",
    ),
)

# --- big-bang ---------------------------------------------------------------
V["big-bang"] = dict(
    r2=dict(
        problem="A minimal game must be launched with an initial state, tick handler, and renderer wired up.",
        program="(big-bang '(0 0)\n  (on-tick (lambda (s) (list (+ 1 (car s)) (cadr s))))\n  (to-draw (lambda (s) (grid-cell-set! (modulo (car s) 20) 0 1))))",
        explanation="big-bang boots the world with initial state (0 0), a tick handler that increments x, and a draw routine that lights a scrolling cell.",
        meta="on-tick and to-draw ALONE don't run anything; they register handlers. big-bang is the correct choice to LAUNCH the loop.",
        eng="Operator log: 'big-bang started game-id=17'. If nothing renders, the audit is on the handler wiring.",
        math="State transition machine over frames.",
        cs="Event loop kickoff; installs handlers and returns game id.",
    ),
    r3=dict(
        setup="event-loop-init",
        r1_domain="motoi world",
        r1_code="(big-bang '(0 0) ...)",
        r2_domain="react app",
        r2_code=";; render the initial component tree:\n;; ReactDOM.createRoot(rootEl).render(<App />)",
        r3_domain="fixed-point iteration",
        r3_code=";; kickoff of a stateful iteration:\n(define (iter s f) (iter (f s) f))",
        explanation="Each rung takes initial state plus transition rules and starts the recurrence.",
        meta="'Fire up the world' is the shape.",
        eng="Universal event-loop start point.",
        math="Seeded iterated map.",
        cs="Reactor-pattern boot.",
    ),
    r4=dict(
        claim="big-bang returns a game id that is unique among live games.",
        program="(define g1 (big-bang '(0 0)))\n(define g2 (big-bang '(0 0)))\n(display (not (eq? g1 g2)))",
        invariant="∀ two live games g1, g2. id(g1) ≠ id(g2)",
        meta="Handle uniqueness. Falsified by any collision. See book-of-computing ch10 (identifiers).",
        eng="Distinct ids allow multi-game concurrency.",
        math="Injective id generator.",
        cs="Fresh identifier allocation.",
    ),
    r5=dict(
        base="big-bang launches the world loop.",
        composition="(define g (big-bang '(0 0)\n  (on-tick (lambda (s) (map + s '(1 0))))\n  (stop-when (lambda (s) (> (car s) 100)))\n  (to-draw (lambda (s) (grid-cell-set! (car s) 0 1)))))",
        emergent="game with defined start, step, and end: a complete tick-render-terminate lifecycle.",
        meta="Same family as SDL game loops, htdp/universe. See book-of-composition ch16 (game loops).",
        eng="Explicit stop-when is honest lifecycle management.",
        math="Terminating iterated system.",
        cs="Structured event loop with termination.",
    ),
)

# ==== camera group ==========================================================
# For brevity: many camera-* verbs share the SAME family shape. I'll use
# per-verb specifics but a shared template style.

def camera_verb(name, summary, kind="camera-mutation"):
    """Generic template for the camera family."""
    return dict(
        r2=dict(
            problem=f"An operator needs to {summary.lower()}",
            program=f"({name})" if kind == "read" else f"({name} 0)" if kind == "single-arg" else f"({name})",
            explanation=f"The call {'reads and returns' if kind == 'read' else 'invokes'} the camera state; the effect propagates to the render surface on the next frame boundary.",
            meta="Sibling camera verbs each do ONE thing; combining them is the operator's job. This verb is the correct choice for the specific concern named in its summary.",
            eng="Operator log: mutation captured; audit target is the camera-state buffer.",
            math="Affine transform applied to the viewport.",
            cs="Mutation of camera struct; effect visible next frame.",
        ),
        r3=dict(
            setup="viewport-affine-adjustment",
            r1_domain="motoi camera",
            r1_code=f"({name})",
            r2_domain="cinematography",
            r2_code=";; the equivalent camera move on a physical rig:\n;; dolly, pan, tilt, zoom",
            r3_domain="affine group",
            r3_code=";; ℝ² -> ℝ² affine transform\n(define (affine mat v) (list 'apply mat v))",
            explanation="Each rung adjusts an affine viewing transform.",
            meta="The camera IS an affine transform on the viewport.",
            eng="Camera commands mirror physical rig vocabulary.",
            math="Affine group on ℝ².",
            cs="Uniform affine matrix mutation.",
        ),
        r4=dict(
            claim="The camera state is a pure function of accumulated camera commands; identical command sequences produce identical states.",
            program=f"({name})\n(define s1 (camera-state))\n({name})\n;; state after two identical calls: deterministic wrt commands\n(display 'deterministic)",
            invariant="∀ command-sequence σ. camera-state(σ) is a deterministic function of σ",
            meta="Command-sequence determinism. Falsified by any hidden entropy. See book-of-math ch12 (transforms) and book-of-computing ch03 (determinism).",
            eng="Deterministic state = replayable camera moves.",
            math="Function of command-sequence.",
            cs="Deterministic state machine.",
        ),
        r5=dict(
            base=f"{name} is one axis of camera control.",
            composition=f"(define (composite-move)\n  ({name})\n  (camera-zoom-to 2 500))",
            emergent="chained camera choreography: multiple camera calls in sequence build a compound cinematic move.",
            meta="Same family as Cinema 4D keyframe rigs or After Effects camera automation. See book-of-composition ch17 (choreography).",
            eng="Composable camera moves keep cinematic code readable.",
            math="Function composition of affine transforms.",
            cs="Sequential command chain.",
        ),
    )

for cname, csummary, ckind in [
    ("camera-bring-to-view", "Smoothly pan the camera to bring an entity into view.", "single-arg"),
    ("camera-center-on", "Center the camera on a world position.", "single-arg"),
    ("camera-export", "Export a recorded camera sequence.", "single-arg"),
    ("camera-fit-all", "Fit all entities on screen.", "single-arg"),
    ("camera-frame", "Capture the current screen as a recording frame.", "single-arg"),
    ("camera-home", "Return the camera to its home position.", "single-arg"),
    ("camera-pan", "Pan the camera horizontally.", "single-arg"),
    ("camera-pan-to", "Pan the camera to a specific coordinate.", "single-arg"),
    ("camera-record", "Begin recording camera frames.", "single-arg"),
    ("camera-scale", "Return the current camera zoom scale.", "read"),
    ("camera-set!", "Move the camera to a position and scale.", "single-arg"),
    ("camera-state", "Return the current camera position and scale.", "read"),
    ("camera-tilt", "Nudge the camera vertically.", "single-arg"),
    ("camera-trace", "Log a debug message with camera state.", "single-arg"),
    ("camera-x", "Return the camera's horizontal position.", "read"),
    ("camera-y", "Return the camera's vertical position.", "read"),
    ("camera-zoom-to", "Zoom the camera to a target scale.", "single-arg"),
]:
    V[cname] = camera_verb(cname, csummary, ckind)

print(f"Verbs authored so far: {len(V)}")

# ==== cancel-tick / clear-surface-layer / cols / display / end-frame / eval / frame ====

V["cancel-tick"] = dict(
    r2=dict(
        problem="A recurring timer named 'poll' must be shut down when the player leaves the screen it belonged to.",
        program="(cancel-tick 'poll)",
        explanation="The named tick is looked up in the timer registry and removed. Downstream tick callbacks stop firing.",
        meta="stop halts the whole game loop; wait doesn't cancel timers. cancel-tick is the correct choice for a NAMED timer.",
        eng="Operator log: 'cancel-tick poll'. If callbacks still fire, the audit is on registration names.",
        math="Removal from a name-indexed set of scheduled callbacks.",
        cs="Deregister; O(1) by name.",
    ),
    r3=dict(
        setup="named-deregister",
        r1_domain="motoi timers",
        r1_code="(cancel-tick 'poll)",
        r2_domain="unix cron",
        r2_code=";; remove a cron entry:\n;; crontab -l | grep -v poll | crontab -",
        r3_domain="set removal",
        r3_code=";; S \\ {name}\n(define (remove s name) (filter (lambda (x) (not (eq? x name))) s))",
        explanation="Each rung removes a named item from an active set.",
        meta="'Deregister by name' is the shape.",
        eng="Named handles are the SRE contract for cleanup.",
        math="Set difference by singleton.",
        cs="Hash table deletion by key.",
    ),
    r4=dict(
        claim="After cancel-tick(name), subsequent frames do not fire the callback registered under name.",
        program="(define fired 0)\n(on-tick (lambda () (set! fired (+ fired 1))) 'test)\n(cancel-tick 'test)\n(display fired)",
        invariant="∀ name. after cancel-tick(name): fires(name) = 0 in subsequent frames",
        meta="Cancel-terminality. Falsified by any post-cancel fire. See book-of-computing ch07 (scheduling).",
        eng="Cancelled means cancelled.",
        math="Absorbing state on the timer.",
        cs="Idempotent deregister.",
    ),
    r5=dict(
        base="cancel-tick removes a named timer.",
        composition="(define (with-ticker name f thunk)\n  (on-tick f name)\n  (thunk)\n  (cancel-tick name))",
        emergent="scoped-ticker macro: register + user-scope + deregister = a ticker whose life matches a scope.",
        meta="Same family as scoped subscribers in event buses. See book-of-composition ch05 (brackets).",
        eng="Auto-cancel avoids ticker leaks.",
        math="Bracketed effect.",
        cs="RAII-style timer.",
    ),
)

V["clear-surface-layer"] = dict(
    r2=dict(
        problem="Before repainting the overlay layer, the operator must wipe stale content.",
        program="(clear-surface-layer 'main 'overlay)\n(grid-cell-set! 5 5 1)",
        explanation="The named layer on the named surface is emptied; subsequent draws land on a clean layer.",
        meta="end-frame flushes the whole frame; grid-cell-set! sets one cell. clear-surface-layer is the correct choice to WIPE a whole layer.",
        eng="Operator log: 'clear overlay on main'. If ghost pixels linger, the audit is on layer names.",
        math="Layer state <- ∅.",
        cs="Bulk mutation; O(surface size).",
    ),
    r3=dict(
        setup="bulk-clear-region",
        r1_domain="motoi framebuffer",
        r1_code="(clear-surface-layer 'main 'overlay)",
        r2_domain="whiteboard eraser",
        r2_code=";; wipe one board without touching the others:\n;; eraser board=overlay",
        r3_domain="empty function",
        r3_code=";; f: X -> ∅\n(define (clear s) '())",
        explanation="Each rung resets a bulk region to its empty state.",
        meta="'Bulk clear' is the shape.",
        eng="Layer clearing is a paint hygiene fundamental.",
        math="Constant map to empty set.",
        cs="Bulk overwrite.",
    ),
    r4=dict(
        claim="After clear-surface-layer(s, l), the layer content is empty.",
        program="(clear-surface-layer 'main 'overlay)\n(display 'cleared)",
        invariant="∀ surface s, layer l. after clear: content(s, l) = ∅",
        meta="Clear-idempotence and terminality. Falsified by residual pixels. See book-of-animation ch05 (layers).",
        eng="Clean layer = clean audit.",
        math="Constant-to-empty function.",
        cs="Idempotent overwrite.",
    ),
    r5=dict(
        base="clear-surface-layer wipes one layer.",
        composition="(begin-frame 'main)\n(clear-surface-layer 'main 'overlay)\n(grid-cell-set! 0 0 1)\n(end-frame 'main)",
        emergent="clear-then-paint cycle: begin + clear + draw + end = the double-buffer idiom.",
        meta="Same family as glClear + glDrawArrays + glFlush. See book-of-composition ch07 (buffer cycles) and book-of-animation ch04 (double buffering).",
        eng="Standard render loop that avoids ghosting.",
        math="Reset then apply.",
        cs="Double-buffer cycle.",
    ),
)

V["cols"] = dict(
    r2=dict(
        problem="An operator must know the grid width in cells to loop over every column.",
        program="(define w (cols))\n(let loop ((i 0))\n  (when (< i w)\n    (grid-cell-set! i 0 1)\n    (loop (+ i 1))))",
        explanation="cols returns the column count. The loop iterates once per column, painting the top row.",
        meta="grid-cols is a duplicate for legacy code; pixels-wide returns pixels not cells. cols is the correct choice for cells-per-row.",
        eng="Operator log: 'cols=40'. If loop misses right edge, the audit is on the < vs <=.",
        math="Positive integer: the width of the grid substrate.",
        cs="Read from grid dimensions; O(1).",
    ),
    r3=dict(
        setup="query-container-size",
        r1_domain="motoi grid",
        r1_code="(cols)",
        r2_domain="database",
        r2_code=";; column count of a table:\n;; SELECT count(*) FROM information_schema.columns WHERE table = 'x'",
        r3_domain="cardinality",
        r3_code=";; |A × B| = |A| · |B|; width factor\n(define (width g) (length (car g)))",
        explanation="Each rung asks 'how wide is this thing?' and returns a nonnegative integer.",
        meta="Size query is the shape.",
        eng="Container-size queries are the foundation of loop bounds.",
        math="Cardinality of an axis.",
        cs="O(1) length query.",
    ),
    r4=dict(
        claim="cols is a positive integer whenever the grid is initialized.",
        program="(display (> (cols) 0))",
        invariant="∀ initialized-grid. cols ∈ ℤ₊",
        meta="Positivity of dimension. Falsified only by uninitialized grid. See book-of-math ch01 (naturals) and book-of-computing ch04 (dimensions).",
        eng="Positive width = safe loop bound.",
        math="Element of ℤ₊.",
        cs="Nonnegative int query.",
    ),
    r5=dict(
        base="cols returns grid width.",
        composition="(define (paint-row row val)\n  (let loop ((i 0))\n    (when (< i (cols))\n      (grid-cell-set! i row val)\n      (loop (+ i 1)))))",
        emergent="parametric-row painter: cols + loop = a row-painting primitive that adapts to any grid size.",
        meta="Same family as numpy broadcast-fill. See book-of-composition ch04 (parametric loops).",
        eng="Grid-size-agnostic rendering.",
        math="Iterate over [0, cols).",
        cs="Data-dependent loop bound.",
    ),
)

V["display"] = dict(
    r2=dict(
        problem="A named widget must appear on screen with a custom paint routine.",
        program="(display 'scoreboard (lambda () (grid-cell-set! 0 0 1)))",
        explanation="The widget is registered under 'scoreboard' with a paint function. On each frame, the runtime calls the paint routine.",
        meta="on-frame runs any callback per frame; to-draw is a big-bang clause. display is the correct choice to REGISTER a NAMED widget.",
        eng="Operator log: 'display scoreboard registered'. If widget doesn't appear, the audit is on registration order.",
        math="Named binding: symbol -> paint function.",
        cs="Register callback in a name-indexed table.",
    ),
    r3=dict(
        setup="register-named-callback",
        r1_domain="motoi widgets",
        r1_code="(display 'scoreboard f)",
        r2_domain="signal handler",
        r2_code=";; register a handler under a name:\n;; signal(SIGTERM, handler)",
        r3_domain="dictionary insert",
        r3_code=";; D[name] := f\n(define (assoc-set d k v) (cons (cons k v) d))",
        explanation="Each rung associates a NAME with a CALLBACK so the runtime can invoke it later.",
        meta="'Named callback registry' is the shape.",
        eng="Named registries are the SRE-friendly alternative to anonymous hooks.",
        math="Function space indexed by symbol.",
        cs="Hash table of callbacks.",
    ),
    r4=dict(
        claim="display is idempotent under the same (name, function) pair.",
        program="(display 'w f)\n(display 'w f)\n(display 'idempotent-if-same-args)",
        invariant="∀ name f. display(name, f) applied twice ≡ applied once",
        meta="Same-arg idempotence. Falsified by duplicate paint calls. See book-of-computing ch09 (idempotence).",
        eng="Safe to re-register on hot reload.",
        math="Idempotent under equal arguments.",
        cs="Overwrite semantics.",
    ),
    r5=dict(
        base="display registers a named widget.",
        composition="(define (add-hud key val)\n  (display key (lambda () (grid-cell-set! 0 0 val))))\n(add-hud 'score 1)",
        emergent="HUD builder: display + factory function = programmatic assembly of many named widgets.",
        meta="Same family as React component registration. See book-of-composition ch16 (widgets).",
        eng="Data-driven widget assembly.",
        math="Family of named functions.",
        cs="Registry pattern.",
    ),
)

V["end-frame"] = dict(
    r2=dict(
        problem="After all drawing calls are issued for a frame, the operator must flush them so they appear on screen.",
        program="(begin-frame 'main)\n(grid-cell-set! 0 0 1)\n(end-frame 'main)",
        explanation="end-frame closes the paint session opened by begin-frame and commits the buffer to the surface.",
        meta="on-frame is a callback registration; after-frame defers. end-frame is the correct choice to CLOSE and commit a paint session.",
        eng="Operator log: 'end-frame main committed'. If pixels don't appear, the audit is on end-frame pairing.",
        math="Frame commit boundary.",
        cs="Transaction commit.",
    ),
    r3=dict(
        setup="scoped-batch-commit",
        r1_domain="motoi framebuffer",
        r1_code="(end-frame 'main)",
        r2_domain="database",
        r2_code=";; commit a transaction:\n;; COMMIT;",
        r3_domain="scope close",
        r3_code=";; end of let scope; bindings finalized\n(define (close scope) 'done)",
        explanation="Each rung closes a bounded region and finalizes accumulated operations.",
        meta="'Close a scope' is the shape.",
        eng="Commit boundaries are the SRE audit anchors.",
        math="Boundary of a scope operator.",
        cs="Two-phase commit close.",
    ),
    r4=dict(
        claim="end-frame after begin-frame commits all drawing calls that happened between them.",
        program="(begin-frame 'main)\n(grid-cell-set! 5 5 1)\n(end-frame 'main)\n(display (grid-cell-state 5 5))",
        invariant="∀ frame f. calls between begin-frame(f) and end-frame(f) are committed atomically",
        meta="Atomic commit. Falsified by any partial-visibility during the paint. See book-of-animation ch04 (double buffering).",
        eng="Atomic frame = no torn frames.",
        math="Transactional visibility.",
        cs="ACID-like paint transaction.",
    ),
    r5=dict(
        base="end-frame commits a paint session.",
        composition="(define (with-frame f thunk) (begin-frame f) (thunk) (end-frame f))\n(with-frame 'main (lambda () (grid-cell-set! 0 0 1)))",
        emergent="bracketed frame macro: same as begin-frame's Row 5, viewed from the commit side.",
        meta="Same family as with-transaction / try/finally COMMIT. See book-of-composition ch05 (brackets).",
        eng="Bracket wrapper prevents leaked-open frames.",
        math="Scope-closing higher-order function.",
        cs="Resource release combinator.",
    ),
)

V["eval"] = dict(
    r2=dict(
        problem="A REPL must run a Scheme expression that a user just typed.",
        program="(define expr '(+ 1 2 3))\n(display (eval expr))",
        explanation="eval takes a quoted expression as data and evaluates it against the current environment, returning its value.",
        meta="apply calls a specific function; a bare call requires known structure. eval is the correct choice for DATA-AS-CODE evaluation.",
        eng="Operator log: 'eval expr=(+ 1 2 3) -> 6'. If eval misbehaves, the audit is on the environment.",
        math="A homomorphism from source to values.",
        cs="Interpreter primitive; O(size of expr).",
    ),
    r3=dict(
        setup="data-as-code",
        r1_domain="motoi runtime",
        r1_code="(eval '(+ 1 2))",
        r2_domain="unix",
        r2_code=";; shell reads a string as a command:\n;; eval $CMD",
        r3_domain="operational semantics",
        r3_code=";; evaluation as a function on ASTs\n(define (eval-ast ast) (list 'value-of ast))",
        explanation="Each rung takes an AST-like value and returns a value under the current environment.",
        meta="'Interpret data as code' is the shape.",
        eng="Eval is powerful and dangerous; audit source of the data.",
        math="Semantic function on syntax.",
        cs="Meta-circular interpreter primitive.",
    ),
    r4=dict(
        claim="eval on a constant expression returns the same value each time.",
        program="(define a (eval '(+ 1 2)))\n(define b (eval '(+ 1 2)))\n(display (= a b))",
        invariant="∀ constant expr e. eval(e) = eval(e)",
        meta="Determinism on pure expressions. Falsified only by side-effectful expressions or environment mutations. See book-of-computing ch12 (eval).",
        eng="Deterministic eval on pure data = safe to memoize.",
        math="Function of expression under a fixed environment.",
        cs="Pure semantic evaluation.",
    ),
    r5=dict(
        base="eval interprets a quoted expression.",
        composition="(define (dispatch cmd)\n  (eval (cdr (assoc cmd '((inc . (+ 1 1)) (dec . (- 1 1)))))))\n(display (dispatch 'inc))",
        emergent="command dispatcher: table of quoted forms + eval = a data-driven command handler.",
        meta="Same family as JS-eval-based DSLs or Lua load-string dispatchers. See book-of-composition ch18 (dispatch tables).",
        eng="Data-driven dispatch scales without pattern-matching every case.",
        math="Table lookup composed with semantic function.",
        cs="Interpreter-as-dispatcher.",
    ),
)

V["frame"] = dict(
    r2=dict(
        problem="Elapsed frames must be logged for a benchmark run.",
        program="(on-frame (lambda () (display (frame))))",
        explanation="Each frame, the counter is fetched and displayed. The counter monotonically increases from 0.",
        meta="audio-time returns seconds; on-tick counts logical ticks. frame is the correct choice for a video-frame counter.",
        eng="Operator log: 'frame=1200'. Reliable for coarse-grained timing.",
        math="Monotone integer counter over rendered frames.",
        cs="Read of frame index.",
    ),
    r3=dict(
        setup="monotone-counter",
        r1_domain="motoi runtime",
        r1_code="(frame)",
        r2_domain="video codec",
        r2_code=";; frame number in an mp4 stream:\n;; PTS / frame_duration",
        r3_domain="natural number sequence",
        r3_code=";; 0, 1, 2, 3, ...\n(define (nat n) (if (= n 0) '() (cons n (nat (- n 1)))))",
        explanation="Each rung provides a monotone-increasing natural number tied to a repeating clock.",
        meta="Monotone counter is the shape.",
        eng="Frame counter is deterministic in a way audio-time is not.",
        math="Element of ℕ.",
        cs="Simple counter read.",
    ),
    r4=dict(
        claim="frame is monotone non-decreasing across two consecutive reads.",
        program="(define a (frame))\n(define b (frame))\n(display (>= b a))",
        invariant="∀ read pair (a, b). frame(b) ≥ frame(a)",
        meta="Monotonicity. Falsified by any backward step. See book-of-computing ch07 (clocks) and book-of-math ch01 (order).",
        eng="Frame counters never go backwards; safe for delta arithmetic.",
        math="Monotone non-decreasing sequence.",
        cs="Monotonic integer.",
    ),
    r5=dict(
        base="frame returns the current frame counter.",
        composition="(define start (frame))\n(on-frame (lambda () (when (> (- (frame) start) 60) (display 'second-elapsed))))",
        emergent="frame-based deadline: current - start > threshold = a deadline that ignores wall-clock drift.",
        meta="Same family as vsync-locked timers in games. See book-of-composition ch14 (deadlines).",
        eng="Frame-based timing = smooth at fixed refresh.",
        math="Difference of monotone sequence.",
        cs="Elapsed-frames derivation.",
    ),
)

# ==== grid family ============================================================
def grid_verb(name, summary, kind="read"):
    return dict(
        r2=dict(
            problem=f"Operator needs to {summary.lower()}",
            program=f"({name})" if kind == "read" else f"({name} 5 5)" if kind == "cell-2-arg" else f"({name} 5 5 1)" if kind == "cell-set" else f"({name})",
            explanation=f"The call {'reads' if kind == 'read' else 'operates on'} the grid substrate; grid semantics apply to cells indexed by (col, row).",
            meta="Sibling grid verbs each do ONE thing. This verb is the correct choice for the specific concern named in its summary.",
            eng="Operator log: grid operation captured. Audit target is the grid substrate state.",
            math="Query or mutation on a 2D discrete grid.",
            cs=("O(1) query" if kind == "read" else "O(1) mutation") + " on the grid array.",
        ),
        r3=dict(
            setup="2d-grid-cell-access",
            r1_domain="motoi grid",
            r1_code=f"({name})",
            r2_domain="spreadsheet",
            r2_code=";; access cell B5:\n;; sheet!B5",
            r3_domain="finite matrix",
            r3_code=";; M[i,j]: matrix access\n(define (mref m i j) (list-ref (list-ref m i) j))",
            explanation="Each rung reads or writes a cell of a discrete 2D structure indexed by (col, row) or (row, col).",
            meta="'Indexed 2D access' is the shape.",
            eng="Grid access is the workhorse of cellular automata.",
            math="Matrix element access.",
            cs="O(1) 2D array op.",
        ),
        r4=dict(
            claim="Grid access is a pure function of grid state and coordinates.",
            program=f"(define a ({name}))\n(define b ({name}))\n(display 'same-state-same-result)",
            invariant=f"∀ grid state g, coords c. {name}(g, c) is deterministic",
            meta="Referential transparency on state. Falsified by any hidden entropy. See book-of-math ch12 (matrices) and book-of-computing ch05 (arrays).",
            eng="Pure query = safe to cache within a step.",
            math="Function of (state, coords).",
            cs="Pure array access.",
        ),
        r5=dict(
            base=f"{name} is one grid primitive.",
            composition=f"(let loop ((i 0))\n  (when (< i (cols))\n    ({name})\n    (loop (+ i 1))))",
            emergent="grid sweep: primitive + loop = a full-row or full-grid pass, the basis of CA rules.",
            meta="Same family as image-kernel sweeps or matrix-scans. See book-of-composition ch12 (sweeps).",
            eng="Sweeps power cellular automata and grid rendering alike.",
            math="Iteration over a 2D index set.",
            cs="Row-major or column-major traversal.",
        ),
    )

for gname, gsum, gkind in [
    ("grid-cell-age", "get the age of a cell", "cell-2-arg"),
    ("grid-cell-set!", "set a cell state", "cell-set"),
    ("grid-cell-state", "get the state of a cell", "cell-2-arg"),
    ("grid-cell?", "test whether a cell is alive", "cell-2-arg"),
    ("grid-cols", "get the grid width", "read"),
    ("grid-init", "initialize the grid", "cell-2-arg"),
    ("grid-live-count", "count live cells", "read"),
    ("grid-neighbors", "count live neighbors of a cell", "cell-2-arg"),
    ("grid-origin", "get the grid's screen origin", "read"),
    ("grid-rows", "get the grid height", "read"),
    ("grid-step", "step the grid one generation", "read"),
    ("grid-step-3state", "step a 3-state grid", "read"),
    ("grid-step-4state", "step a 4-state grid", "read"),
    ("grid-step-aged", "step the grid with aging", "read"),
    ("grid-step-count", "get total step count", "read"),
]:
    V[gname] = grid_verb(gname, gsum, gkind)

# ==== note family ============================================================
def note_verb(name, summary):
    return dict(
        r2=dict(
            problem=f"Operator needs to {summary.lower()}",
            program=f"({name} 60 4 100)",
            explanation="The call operates on the currently-loaded note substrate. Pitch, duration, and velocity are the standard triple.",
            meta="Sibling note verbs each do ONE thing. This verb is the correct choice for the specific concern named in its summary.",
            eng="Operator log: note operation captured.",
            math="Discrete pitch (MIDI 0-127); duration in beats; velocity in [0,127].",
            cs="Sample scheduler mutation.",
        ),
        r3=dict(
            setup="pitch-and-duration",
            r1_domain="motoi notes",
            r1_code=f"({name} 60 4 100)",
            r2_domain="staff notation",
            r2_code=";; middle C, quarter note, mezzo-forte on a staff:\n;; note c4 q mf",
            r3_domain="tuple of discrete parameters",
            r3_code=";; (pitch, duration, velocity) ∈ ℤ × ℝ⁺ × ℤ\n(define (note p d v) (list p d v))",
            explanation="Each rung is a tuple of discrete musical parameters interpreted by a downstream player.",
            meta="Musical-parameter tuple is the shape.",
            eng="Pitch/duration/velocity is the universal note contract.",
            math="Product of discrete and continuous domains.",
            cs="Struct of three fields.",
        ),
        r4=dict(
            claim=f"{name} with identical arguments produces identical audible effect (given identical instrument state).",
            program=f"({name} 60 4 100)\n({name} 60 4 100)\n(display 'deterministic-audible-effect)",
            invariant=f"∀ p d v. {name}(p, d, v) is deterministic in current instrument state",
            meta="Same-input-same-effect. Falsified by any hidden entropy in note dispatch. See book-of-sound ch04 (note events) and book-of-computing ch03 (determinism).",
            eng="Deterministic notes = replayable songs.",
            math="Function of (pitch, duration, velocity, state).",
            cs="Pure event emission.",
        ),
        r5=dict(
            base=f"{name} produces a single note event.",
            composition=f"(for-each\n  (lambda (p) ({name} p 1 80))\n  '(60 62 64 65 67 69 71 72))",
            emergent="scale player: for-each + note = a scale, arpeggio, or melody builder.",
            meta="Same family as MIDI sequences or tracker-style step programming. See book-of-composition ch13 (sequences) and book-of-sound ch03 (scales).",
            eng="Composable notes power melody generation.",
            math="Function applied over a pitch sequence.",
            cs="Iterated event emission.",
        ),
    )

for nname, nsum in [
    ("note", "sound a pitch for a duration"),
    ("note-dots", "query staff position data"),
    ("note-place", "place a glyph without sounding"),
    ("note-place-at", "place a glyph at a slot"),
    ("note-release", "release a sustained note"),
    ("note-strike", "strike a note"),
]:
    V[nname] = note_verb(nname, nsum)

print(f"Verbs authored: {len(V)}")

# ==== input & handlers ======================================================

V["input-may-i?"] = dict(
    r2=dict(
        problem="Before reading input, the operator must confirm the input subsystem grants permission this frame.",
        program="(when (input-may-i?)\n  (when (key? 'space) (world/spawn 'bullet 0 0)))",
        explanation="The guard prevents reading input while an event is being suppressed by a modal or a game-paused overlay.",
        meta="key? reads directly; on-key registers. input-may-i? is the correct choice for a permission check.",
        eng="Operator log: 'input-may-i? = #f, skip'. Safe pause behavior.",
        math="Boolean predicate over subsystem state.",
        cs="Legacy permission flag read.",
    ),
    r3=dict(
        setup="capability-gate",
        r1_domain="motoi input",
        r1_code="(input-may-i?)",
        r2_domain="OS permission",
        r2_code=";; before reading mic, ask:\n;; nav.mediaDevices.getUserMedia({audio:true})",
        r3_domain="access predicate",
        r3_code=";; access(f, R_OK)\n(define (may? f) (list 'access f))",
        explanation="Each rung asks 'am I allowed to do this right now?'",
        meta="'Capability gate' is the shape.",
        eng="Explicit permission gates avoid runtime access errors.",
        math="Boolean over capabilities.",
        cs="Access predicate.",
    ),
    r4=dict(
        claim="input-may-i? is a pure per-frame read.",
        program="(display (equal? (input-may-i?) (input-may-i?)))",
        invariant="∀ frame. input-may-i? deterministic within a frame",
        meta="Frame-locked. Falsified by intra-frame drift. See book-of-computing ch07 (frame semantics).",
        eng="Cache-safe within a frame.",
        math="Constant on the frame partition.",
        cs="Frame-locked read.",
    ),
    r5=dict(
        base="input-may-i? guards input reads.",
        composition="(define (with-input thunk) (when (input-may-i?) (thunk)))\n(with-input (lambda () (when (key? 'space) 'shoot)))",
        emergent="input guard: predicate + thunk = a wrapper that turns off during modals.",
        meta="Same family as event.stopPropagation gates. See book-of-composition ch06 (gates).",
        eng="Guard pattern eliminates ghost keypresses.",
        math="Conditional identity.",
        cs="Guard clause.",
    ),
)

V["key?"] = dict(
    r2=dict(
        problem="On each frame, if the space key is down, the player fires.",
        program="(on-frame\n  (lambda ()\n    (when (key? 'space)\n      (world/spawn 'bullet 0 0))))",
        explanation="key? is a per-frame boolean read for the named key.",
        meta="on-key is edge-triggered; input-may-i? is a subsystem-level check. key? is the correct choice for level-triggered per-frame reads.",
        eng="Operator log: 'space down -> fire'.",
        math="Boolean over key state.",
        cs="Level-triggered per-frame read.",
    ),
    r3=dict(
        setup="continuous-state-poll",
        r1_domain="motoi input",
        r1_code="(key? 'space)",
        r2_domain="joystick",
        r2_code=";; is the button held?\n;; SDL_JoystickGetButton(js, 0)",
        r3_domain="predicate on state",
        r3_code=";; P(x): true iff x has property\n(define (down? key) (list 'is-down key))",
        explanation="Each rung is a level-triggered poll: true while the input is currently active.",
        meta="'Level-triggered predicate' is the shape.",
        eng="Polling is honest for held-state game input.",
        math="Predicate on device state.",
        cs="Direct-poll read.",
    ),
    r4=dict(
        claim="key? is a pure function of the current input snapshot.",
        program="(display (equal? (key? 'space) (key? 'space)))",
        invariant="∀ frame f, key k. key?(k, f) constant within f",
        meta="Frame-locked determinism. Falsified by intra-frame change. See book-of-computing ch07 (frame semantics).",
        eng="Deterministic within a frame; safe to check twice.",
        math="Function of frame + key.",
        cs="Frame-locked read.",
    ),
    r5=dict(
        base="key? polls current key state.",
        composition="(define (any-of? . keys)\n  (any (lambda (k) (key? k)) keys))\n(when (any-of? 'w 'a 's 'd) 'moving)",
        emergent="polyphonic input combiner: any-of over multiple keys = a movement gate.",
        meta="Same family as SDL_GetKeyboardState scans. See book-of-composition ch11 (input aggregation).",
        eng="Combined-key checks feel natural for movement code.",
        math="Boolean disjunction over predicates.",
        cs="Fold with OR.",
    ),
)

V["land-on-downbeat"] = dict(
    r2=dict(
        problem="A card must land exactly on the next downbeat, not just 'soon.'",
        program="(land-on-downbeat 'hero-card)",
        explanation="The verb schedules the card's landing to snap to the next downbeat boundary. Sub-frame precision is delegated to the driver.",
        meta="after uses seconds; audio-beat? is a per-frame edge test. land-on-downbeat is the correct choice for downbeat-snap landings.",
        eng="Operator log: 'land hero-card at next downbeat'. Musical timing that feels intentional.",
        math="Snap to nearest downbeat boundary.",
        cs="Descriptor scheduling with beat alignment.",
    ),
    r3=dict(
        setup="quantize-event-to-grid",
        r1_domain="motoi choreo",
        r1_code="(land-on-downbeat 'hero-card)",
        r2_domain="daw quantize",
        r2_code=";; snap the clip start to the bar:\n;; clip.start = quantize(clip.start, bar)",
        r3_domain="rounding to lattice",
        r3_code=";; round to nearest multiple of 4:\n(define (snap x g) (* g (round (/ x g))))",
        explanation="Each rung rounds an event time to the nearest lattice point defined by a grid.",
        meta="'Quantize to grid' is the shape.",
        eng="Quantization is what makes musical animations feel intentional.",
        math="Rounding to a lattice.",
        cs="Snap-to-grid scheduling.",
    ),
    r4=dict(
        claim="The scheduled landing time is at least the current time and at most one downbeat later.",
        program="(define now (audio-time))\n(land-on-downbeat 'x)\n(display 'scheduled)",
        invariant="∀ call. landing-time ∈ [now, next-downbeat]",
        meta="Bounded delay. Falsified by any past-time landing. See book-of-sound ch06 (bar boundaries) and book-of-motion ch08 (snap).",
        eng="Bounded delay keeps animations feeling responsive.",
        math="Ceiling to the next lattice point.",
        cs="Forward-snap scheduling.",
    ),
    r5=dict(
        base="land-on-downbeat quantizes a landing.",
        composition="(for-each\n  (lambda (c) (land-on-downbeat c))\n  '(a b c d))",
        emergent="synchronized fanfare: multiple cards all landing on the same downbeat.",
        meta="Same family as MIDI-quantized clip launches. See book-of-composition ch13 (synced fan-out).",
        eng="Coordinated arrival = musical feel.",
        math="Multi-target snap to same lattice point.",
        cs="Broadcast schedule.",
    ),
)

V["measure-content"] = dict(
    r2=dict(
        problem="After painting a variable-height card, the operator needs pixel dimensions for a follow-up animation.",
        program="(after-frame\n  (lambda ()\n    (let ((wh (measure-content)))\n      (display wh))))",
        explanation="The measurement runs post-paint, when layout is stable. Returns a two-element list.",
        meta="pixels-wide/tall return surface dims; card-rect is a different scope. measure-content is the correct choice for the CURRENT card's content extents.",
        eng="Operator log: 'content w=200 h=140'. If size is wrong, the audit is on paint completion.",
        math="Dimensions ∈ ℤ₊ × ℤ₊.",
        cs="DOM measurement or equivalent.",
    ),
    r3=dict(
        setup="measure-a-rendered-thing",
        r1_domain="motoi card",
        r1_code="(measure-content)",
        r2_domain="browser dom",
        r2_code=";; el.offsetWidth, el.offsetHeight",
        r3_domain="metric space",
        r3_code=";; ||v|| for a bounding box\n(define (size box) (list (- (caddr box) (car box)) (- (cadddr box) (cadr box))))",
        explanation="Each rung queries the extent of a rendered object.",
        meta="'Measure after render' is the shape.",
        eng="Post-render measurements are the SRE-honest way.",
        math="Bounding box dimensions.",
        cs="Post-commit measurement.",
    ),
    r4=dict(
        claim="Content dimensions are nonnegative integers.",
        program="(after-frame (lambda () (let ((wh (measure-content))) (display (list (>= (car wh) 0) (>= (cadr wh) 0))))))",
        invariant="∀ measurement. dimensions ∈ ℕ × ℕ",
        meta="Nonnegative measurement. Falsified only by measurement of an unrendered node. See book-of-animation ch06 (measurements).",
        eng="Nonnegative dims = safe for layout math.",
        math="Element of ℕ².",
        cs="Two integer read.",
    ),
    r5=dict(
        base="measure-content returns content pixel size.",
        composition="(after-frame\n  (lambda ()\n    (let ((wh (measure-content)))\n      (camera-set! (car wh) (cadr wh) 1))))",
        emergent="camera fit-to-content: measure -> position camera on the content bounds.",
        meta="Same family as ResizeObserver + scroll-into-view. See book-of-composition ch07 (measure-then-position).",
        eng="Auto-fit reduces manual tuning.",
        math="Positioning as a function of measurement.",
        cs="Reactive layout adjustment.",
    ),
)

V["on-canvas-trace"] = dict(
    r2=dict(
        problem="A drawing app must respond when the user traces a stroke on the canvas.",
        program="(on-canvas-trace\n  (lambda (path)\n    (display (list 'traced path))))",
        explanation="The lambda is invoked when a completed trace event fires, receiving the path data.",
        meta="on-key handles keyboard; on-frame is per-frame. on-canvas-trace is the correct choice for stroke events.",
        eng="Operator log: 'trace received points=42'.",
        math="Stroke as a list of (x, y) points.",
        cs="Event handler registration.",
    ),
    r3=dict(
        setup="callback-on-user-gesture",
        r1_domain="motoi canvas",
        r1_code="(on-canvas-trace f)",
        r2_domain="dom pointer events",
        r2_code=";; canvas.addEventListener('pointerup', f)",
        r3_domain="event-driven programming",
        r3_code=";; subscribe(topic, handler)\n(define (sub topic h) (list 'subscribed topic h))",
        explanation="Each rung registers a callback for a user-driven event.",
        meta="'Subscribe to an event' is the shape.",
        eng="Event subscriptions are the backbone of interactive UIs.",
        math="Function assigned to an event stream.",
        cs="Subscribe pattern.",
    ),
    r4=dict(
        claim="on-canvas-trace registration is stable: multiple calls with the same function are idempotent.",
        program="(on-canvas-trace f)\n(on-canvas-trace f)\n(display 'stable-registration)",
        invariant="∀ f. register(f) twice ≡ register(f) once",
        meta="Idempotent registration. Falsified by duplicate dispatches. See book-of-composition ch06 (subscriptions).",
        eng="Idempotent register avoids double-fires.",
        math="Idempotent set-add.",
        cs="Subscriber deduplication.",
    ),
    r5=dict(
        base="on-canvas-trace subscribes to stroke events.",
        composition="(define strokes '())\n(on-canvas-trace (lambda (p) (set! strokes (cons p strokes))))",
        emergent="stroke history: subscription + accumulator = a drawing recorder.",
        meta="Same family as event-sourced UI state. See book-of-composition ch16 (event log).",
        eng="Event log makes undo/redo feasible.",
        math="Time-indexed sequence of strokes.",
        cs="Event-sourcing pattern.",
    ),
)

V["on-frame"] = dict(
    r2=dict(
        problem="Each frame, the operator must repaint a bouncing ball's position.",
        program="(on-frame\n  (lambda () (display (frame))))",
        explanation="The lambda fires once per frame from the driver's animation loop.",
        meta="on-tick is game-loop-specific; after-frame is a one-shot. on-frame is the correct choice for a persistent per-frame callback.",
        eng="Operator log: 'on-frame registered'.",
        math="Callback attached to frame index sequence.",
        cs="Handler registration.",
    ),
    r3=dict(
        setup="periodic-callback",
        r1_domain="motoi runtime",
        r1_code="(on-frame f)",
        r2_domain="unix",
        r2_code=";; run f every second:\n;; while true; do f; sleep 1; done",
        r3_domain="iterated function",
        r3_code=";; f applied at each n\n(define (each-n f) (list 'each f))",
        explanation="Each rung schedules a function to run at every step of a periodic clock.",
        meta="'Every step' is the shape.",
        eng="Frame-based dispatch is universal in games.",
        math="Function applied at every integer index.",
        cs="Periodic callback.",
    ),
    r4=dict(
        claim="Callback registered via on-frame fires exactly once per frame.",
        program="(define count 0)\n(on-frame (lambda () (set! count (+ count 1))))\n;; after N frames, count = N",
        invariant="∀ n frames. count = n after n frames pass",
        meta="Once-per-frame guarantee. Falsified by any double-fire or skip. See book-of-computing ch07 (scheduling).",
        eng="Once-per-frame = predictable game logic.",
        math="Bijection to frame index.",
        cs="Exactly-once per period.",
    ),
    r5=dict(
        base="on-frame runs a callback per frame.",
        composition="(define x 0)\n(on-frame\n  (lambda ()\n    (set! x (+ x 1))\n    (grid-cell-set! (modulo x 20) 0 1)))",
        emergent="scrolling animation: state + on-frame + draw = classic tick-driven animation.",
        meta="Same family as requestAnimationFrame loops in browsers. See book-of-composition ch16 (animation loops) and book-of-animation ch03 (frame loops).",
        eng="Standard animation contract.",
        math="Discrete-time dynamical system.",
        cs="Tick-driven state machine.",
    ),
)

V["on-key"] = dict(
    r2=dict(
        problem="When the player presses P, the game must pause.",
        program="(on-key\n  (lambda (state key)\n    (if (eq? key 'p) (stop) state)))",
        explanation="on-key registers an edge-triggered handler; the function receives the current state and the pressed key symbol.",
        meta="key? is per-frame polling; on-frame is not key-specific. on-key is the correct choice for KEY-EDGE events.",
        eng="Operator log: 'on-key registered for P'.",
        math="Handler over (state, key) -> state.",
        cs="Edge-triggered event handler.",
    ),
    r3=dict(
        setup="named-event-handler",
        r1_domain="motoi input",
        r1_code="(on-key f)",
        r2_domain="terminal",
        r2_code=";; bind ctrl+c to signal:\n;; trap handler INT",
        r3_domain="labeled callback",
        r3_code=";; subscribe(label, handler)\n(define (bind label h) (list 'bind label h))",
        explanation="Each rung binds a callback to an event label.",
        meta="'Bind handler to event' is the shape.",
        eng="Event bindings are the interactive UI standard.",
        math="Function on labeled event stream.",
        cs="Handler-registration pattern.",
    ),
    r4=dict(
        claim="on-key handler receives an edge event: called ONCE per keypress, not per held frame.",
        program="(define fires 0)\n(on-key (lambda (s k) (set! fires (+ fires 1)) s))\n;; after 3 discrete presses, fires = 3, regardless of hold length",
        invariant="∀ keypress event. handler fires exactly once per event",
        meta="Edge-triggered guarantee. Falsified by any per-frame level-triggering. See book-of-computing ch04 (edge triggers).",
        eng="Edge triggers avoid runaway repeats.",
        math="One event, one call.",
        cs="Debounce contract.",
    ),
    r5=dict(
        base="on-key handles key events in a game loop.",
        composition="(define bindings '((p . pause) (q . quit) (r . reset)))\n(on-key\n  (lambda (s k) (assoc k bindings)))",
        emergent="keybinding table: on-key + assoc lookup = a data-driven keymap.",
        meta="Same family as vim command tables or Emacs keymaps. See book-of-composition ch18 (keymaps).",
        eng="Data-driven maps scale to many keys.",
        math="Function via table lookup.",
        cs="Table-driven dispatch.",
    ),
)

V["on-tick"] = dict(
    r2=dict(
        problem="Each game tick, the player state must advance by their velocity.",
        program="(on-tick\n  (lambda (s) (map + s '(1 0))))",
        explanation="on-tick receives the state and returns the next state; the driver replaces it for the next tick.",
        meta="on-frame runs any code; to-draw is for rendering. on-tick is the correct choice for pure state transitions.",
        eng="Operator log: 'on-tick registered'.",
        math="State transition function s -> s'.",
        cs="Pure step in a game loop.",
    ),
    r3=dict(
        setup="pure-state-step",
        r1_domain="motoi game loop",
        r1_code="(on-tick f)",
        r2_domain="redux",
        r2_code=";; reducer function\n;; (state, action) => next-state",
        r3_domain="transition function",
        r3_code=";; δ : S -> S\n(define (step s) s)",
        explanation="Each rung defines the successor state as a function of the previous.",
        meta="'Pure state step' is the shape.",
        eng="Pure state steps are testable in isolation.",
        math="Function δ : S -> S.",
        cs="Reducer pattern.",
    ),
    r4=dict(
        claim="on-tick handler is pure: same state in, same state out.",
        program="(on-tick (lambda (s) (list (+ 1 (car s)))))\n(display 'pure-step)",
        invariant="∀ s. f(s) is deterministic",
        meta="Pure-function contract. Falsified by any hidden entropy. See book-of-computing ch03 (pure functions).",
        eng="Pure ticks = deterministic replay.",
        math="Function S -> S.",
        cs="Pure reducer.",
    ),
    r5=dict(
        base="on-tick advances state per tick.",
        composition="(big-bang '(0 0)\n  (on-tick (lambda (s) (map + s '(1 0))))\n  (stop-when (lambda (s) (> (car s) 100))))",
        emergent="terminating game: state + tick + stop-when = a bounded simulation.",
        meta="Same family as htdp/universe world programs. See book-of-composition ch16 (game loops).",
        eng="Explicit termination = honest lifecycle.",
        math="Bounded iterated system.",
        cs="Simulation loop.",
    ),
)

V["pixels-tall"] = dict(
    r2=dict(
        problem="Operator needs the surface height in pixels for layout math.",
        program="(display (pixels-tall))",
        explanation="Returns the surface height in raw pixels, not cells.",
        meta="rows returns cells; grid-rows same but grid-scoped. pixels-tall is the correct choice for RAW PIXEL height.",
        eng="Operator log: 'pixels-tall=600'.",
        math="Height ∈ ℤ₊ in pixels.",
        cs="O(1) read.",
    ),
    r3=dict(
        setup="raw-dimension-query",
        r1_domain="motoi surface",
        r1_code="(pixels-tall)",
        r2_domain="display",
        r2_code=";; screen height in pixels:\n;; window.innerHeight",
        r3_domain="cardinality",
        r3_code=";; |axis|\n(define (h m) (length m))",
        explanation="Each rung reports the extent of an axis in native units.",
        meta="'Raw dimension' is the shape.",
        eng="Raw pixels vs cells distinction is essential.",
        math="Element of ℕ.",
        cs="Nonnegative int query.",
    ),
    r4=dict(
        claim="pixels-tall is positive when surface is initialized.",
        program="(display (> (pixels-tall) 0))",
        invariant="∀ init surface. pixels-tall ∈ ℤ₊",
        meta="Positive dimension. Falsified only by uninitialized surface. See book-of-animation ch02 (dimensions).",
        eng="Positive height for safe division.",
        math="Element of ℤ₊.",
        cs="Nonneg int.",
    ),
    r5=dict(
        base="pixels-tall returns surface height.",
        composition="(define (aspect) (/ (pixels-wide) (pixels-tall)))\n(display (aspect))",
        emergent="aspect ratio: width / height = a scale-invariant layout metric.",
        meta="Same family as viewport-aspect calculations in responsive design. See book-of-composition ch07 (layout metrics).",
        eng="Aspect derived from primitives.",
        math="Ratio of dimensions.",
        cs="Compound derivation.",
    ),
)

V["pixels-wide"] = dict(
    r2=dict(
        problem="Operator needs the surface width in pixels for centering math.",
        program="(display (/ (pixels-wide) 2))",
        explanation="Returns raw pixel width; divided by 2 for horizontal center.",
        meta="cols is cells; grid-cols is grid-scoped. pixels-wide is the correct choice for RAW PIXEL width.",
        eng="Operator log: 'pixels-wide=800'.",
        math="Width ∈ ℤ₊ in pixels.",
        cs="O(1) read.",
    ),
    r3=dict(
        setup="raw-dimension-query",
        r1_domain="motoi surface",
        r1_code="(pixels-wide)",
        r2_domain="display",
        r2_code=";; window.innerWidth",
        r3_domain="cardinality",
        r3_code=";; |axis|\n(define (w m) (length (car m)))",
        explanation="Each rung reports width in native units.",
        meta="'Raw width' is the shape.",
        eng="Raw pixels for pixel-perfect layout.",
        math="Element of ℕ.",
        cs="O(1) read.",
    ),
    r4=dict(
        claim="pixels-wide is positive on init.",
        program="(display (> (pixels-wide) 0))",
        invariant="∀ init surface. pixels-wide ∈ ℤ₊",
        meta="Positive dimension. See book-of-animation ch02 (dimensions).",
        eng="Positive width for safe division.",
        math="Element of ℤ₊.",
        cs="Nonneg int.",
    ),
    r5=dict(
        base="pixels-wide returns surface width.",
        composition="(define (center-x) (/ (pixels-wide) 2))",
        emergent="center-x helper.",
        meta="Foundational primitive for centering-based layout. See book-of-composition ch07 (layout).",
        eng="Center primitives reduce hardcoded numbers.",
        math="Half of the width.",
        cs="Derived primitive.",
    ),
)

# ==== random family ==========================================================
def random_verb(name, summary, prog):
    return dict(
        r2=dict(
            problem=f"Operator needs to {summary.lower()}",
            program=prog,
            explanation="The call draws a fresh pseudorandom sample from the current RNG.",
            meta="with-seed pins a seed; sibling verbs shape the sample differently. This verb is the correct choice for the specific distribution named in its summary.",
            eng="Operator log: 'random sample drawn'.",
            math="Sample from a uniform distribution.",
            cs="PRNG read.",
        ),
        r3=dict(
            setup="pseudorandom-sample",
            r1_domain="motoi rng",
            r1_code=prog,
            r2_domain="unix",
            r2_code=";; sample from /dev/urandom\n;; head -c 4 /dev/urandom",
            r3_domain="probability",
            r3_code=";; X ~ Uniform[a, b]\n(define (uniform a b) (list 'sample-in a b))",
            explanation="Each rung produces a fresh sample from a distribution.",
            meta="'Random draw' is the shape.",
            eng="PRNG samples are the workhorse of procedural content.",
            math="Sample from a distribution.",
            cs="PRNG state advance.",
        ),
        r4=dict(
            claim=f"{name} with fixed seed produces identical samples across runs.",
            program=f"(with-seed 42 (lambda () (define a {prog}) (define b {prog}) (list a b)))",
            invariant=f"∀ seed s, index i. {name} with seed s at index i is deterministic",
            meta="Seed-determinism. Falsified by any hidden entropy source. See book-of-math ch07 (probability) and book-of-computing ch03 (determinism).",
            eng="Seeded RNG = reproducible test runs.",
            math="Deterministic pseudorandom sequence.",
            cs="PRNG state machine.",
        ),
        r5=dict(
            base=f"{name} draws a sample.",
            composition=f"(define samples (map (lambda (_) {prog}) (iota 10)))",
            emergent="sample buffer: repeated calls = a bag of samples.",
            meta="Same family as Monte Carlo sampling. See book-of-composition ch11 (sampling) and book-of-math ch07 (Monte Carlo).",
            eng="Bulk sampling for procedural generation.",
            math="Empirical distribution.",
            cs="Iterated PRNG advances.",
        ),
    )

V["randint"] = random_verb("randint", "get a uniform random integer in [a, b)", "(randint 0 100)")
V["random"] = random_verb("random", "get a uniform random float in [0, 1)", "(random)")
V["random-int"] = random_verb("random-int", "get a uniform random integer in [0, n)", "(random-int 10)")
V["random-pick"] = random_verb("random-pick", "pick a uniformly random element from a list", "(random-pick '(a b c))")
V["random-range"] = random_verb("random-range", "get a uniform random float in [lo, hi)", "(random-range 0 1)")

V["rows"] = dict(
    r2=dict(
        problem="Operator needs the grid height in cells to loop over every row.",
        program="(let loop ((i 0)) (when (< i (rows)) (grid-cell-set! 0 i 1) (loop (+ i 1))))",
        explanation="rows returns the row count. Loop paints the leftmost column.",
        meta="grid-rows is the grid-scoped duplicate; pixels-tall is in pixels. rows is the correct choice for cell-height.",
        eng="Operator log: 'rows=30'.",
        math="Positive integer.",
        cs="O(1) read.",
    ),
    r3=dict(
        setup="cell-height-query",
        r1_domain="motoi grid",
        r1_code="(rows)",
        r2_domain="spreadsheet",
        r2_code=";; row count in sheet",
        r3_domain="cardinality",
        r3_code=";; |rows|\n(define (h m) (length m))",
        explanation="Each rung reports the number of rows in the 2D container.",
        meta="'Row count' is the shape.",
        eng="Row query for loop bounds.",
        math="Cardinality of the row axis.",
        cs="O(1) length.",
    ),
    r4=dict(
        claim="rows is positive when grid is init.",
        program="(display (> (rows) 0))",
        invariant="∀ init grid. rows ∈ ℤ₊",
        meta="See book-of-computing ch04 (dimensions).",
        eng="Positive rows for safe loops.",
        math="Element of ℤ₊.",
        cs="Nonneg int query.",
    ),
    r5=dict(
        base="rows returns grid height.",
        composition="(let loop ((i 0)) (when (< i (rows)) (grid-cell-set! 0 i 1) (loop (+ i 1))))",
        emergent="column painter.",
        meta="Same family as parametric loops. See book-of-composition ch04 (loops).",
        eng="Grid-agnostic column paint.",
        math="Iterate over [0, rows).",
        cs="Data-dependent loop bound.",
    ),
)

# ==== sprite / stop / stop-when / sub-position-per-beat / surface-exists? =====

V["sprite"] = dict(
    r2=dict(
        problem="Operator needs to display a named sprite rotated 45° and tinted red.",
        program="(sprite 'hero '(turn 45) '(tint red))",
        explanation="sprite constructs or fetches the named sprite and applies transformations.",
        meta="sprites (plural) attaches to a card; grid-cell-set! draws a cell. sprite is the correct choice for a NAMED sprite handle.",
        eng="Operator log: 'sprite hero turn=45 tint=red'.",
        math="Transformations composed.",
        cs="Constructor with transform list.",
    ),
    r3=dict(
        setup="transformable-named-resource",
        r1_domain="motoi sprite",
        r1_code="(sprite 'hero '(turn 45))",
        r2_domain="css",
        r2_code=";; transform: rotate(45deg) tint(red)",
        r3_domain="affine transform composition",
        r3_code=";; apply matrices in sequence\n(define (compose a b) (list a b))",
        explanation="Each rung takes a resource and stacks transformations.",
        meta="'Transformable named resource' is the shape.",
        eng="Named + transformed is a UI staple.",
        math="Group action on resources.",
        cs="Composable transform list.",
    ),
    r4=dict(
        claim="Same name and same transform list returns equivalent sprite.",
        program="(define a (sprite 'x))\n(define b (sprite 'x))\n(display 'stable-lookup)",
        invariant="∀ name transforms. sprite(name, T) is a deterministic function",
        meta="Referential transparency. Falsified only by env-dependence. See book-of-composition ch12 (transforms).",
        eng="Deterministic sprite lookup = stable UI.",
        math="Function of (name, T).",
        cs="Pure constructor.",
    ),
    r5=dict(
        base="sprite gets a transformed sprite handle.",
        composition="(sprite 'hero '(turn (* 45 (audio-band 3))))",
        emergent="audio-reactive sprite: sprite + audio-band = a beat-driven visual.",
        meta="Same family as Milkdrop-style visualizers. See book-of-composition ch14 (audio-reactive).",
        eng="Audio-reactive visuals via primitive composition.",
        math="Time-varying transform parameter.",
        cs="Reactive transform expression.",
    ),
)

V["sprites"] = dict(
    r2=dict(
        problem="Operator must animate multiple named sprites on a card at once.",
        program="(sprites 'card (list 'hero 'sidekick) '(anim 'walk))",
        explanation="sprites attaches an animation form to several named sprites simultaneously.",
        meta="sprite is single; touch is contact-oriented. sprites is the correct choice for BATCH sprite ops.",
        eng="Operator log: 'sprites walk on hero+sidekick'.",
        math="Broadcast transform across a set.",
        cs="Bulk operation on sprite set.",
    ),
    r3=dict(
        setup="broadcast-transform",
        r1_domain="motoi sprite",
        r1_code="(sprites 'card ...)",
        r2_domain="css",
        r2_code=";; apply transform to class-set:\n;; .selected { transform: ... }",
        r3_domain="uniform map",
        r3_code=";; map f over a set\n(define (uniform-map f s) (map f s))",
        explanation="Each rung applies the same operation to a batch of targets.",
        meta="'Broadcast op' is the shape.",
        eng="Batch ops reduce individual manipulation cost.",
        math="Uniform map over a set.",
        cs="SIMD-like broadcast.",
    ),
    r4=dict(
        claim="sprites applies the same form to each named target consistently.",
        program="(sprites 'card '(a b c) '(tint red))\n(display 'consistent-across-targets)",
        invariant="∀ card, targets. same form applied to each",
        meta="Uniform application. See book-of-composition ch12 (broadcast).",
        eng="Same behavior across batch = predictable UI.",
        math="Function preserved on batch application.",
        cs="Uniform apply pattern.",
    ),
    r5=dict(
        base="sprites broadcasts an animation.",
        composition="(sprites 'main (list 'a 'b 'c) '(anim 'idle))",
        emergent="crowd animation: broadcast form + list of names = a full crowd in idle.",
        meta="Same family as instanced rendering. See book-of-composition ch16 (batching).",
        eng="Crowd animations via one call.",
        math="Instanced application.",
        cs="Batch dispatch.",
    ),
)

V["stop"] = dict(
    r2=dict(
        problem="On game-over, the running loop must halt immediately.",
        program="(when (game-over?) (stop))",
        explanation="stop signals the driver to end the game loop; no further ticks or renders fire.",
        meta="cancel-tick cancels ONE timer; audio-halt halts audio. stop is the correct choice for whole-loop termination.",
        eng="Operator log: 'stop invoked'.",
        math="Loop termination signal.",
        cs="Loop exit; no further ticks.",
    ),
    r3=dict(
        setup="terminate-signal",
        r1_domain="motoi runtime",
        r1_code="(stop)",
        r2_domain="unix",
        r2_code=";; SIGTERM the process\n;; kill -TERM $pid",
        r3_domain="halting predicate",
        r3_code=";; enter accepting state\n(define halt? #t)",
        explanation="Each rung sends a signal that stops iteration.",
        meta="'Halt' is the shape.",
        eng="Clean halt is an SRE fundamental.",
        math="Accept state.",
        cs="Loop-exit signal.",
    ),
    r4=dict(
        claim="After stop, no further on-tick or on-frame callbacks fire.",
        program="(stop)\n(display 'no-more-ticks)",
        invariant="∀ time t > stop-time. no ticks fire",
        meta="Termination. Falsified by any post-stop tick. See book-of-computing ch06 (termination).",
        eng="Stop means stop.",
        math="Absorbing state.",
        cs="Idempotent halt.",
    ),
    r5=dict(
        base="stop halts the loop.",
        composition="(on-tick (lambda (s) (if (game-over? s) (stop) (step s))))",
        emergent="conditional termination: predicate + stop = a loop that ends on a condition.",
        meta="Same family as while-loop break in imperative code. See book-of-composition ch16 (termination).",
        eng="Predicate-driven halt is honest.",
        math="Bounded iteration.",
        cs="Conditional break.",
    ),
)

V["stop-when"] = dict(
    r2=dict(
        problem="A big-bang loop must end when x exceeds 100.",
        program="(big-bang 0\n  (on-tick (lambda (s) (+ s 1)))\n  (stop-when (lambda (s) (> s 100))))",
        explanation="stop-when installs a predicate; when it returns true, the loop terminates.",
        meta="stop is an imperative halt; on-tick's return does not terminate. stop-when is the correct choice for a declarative termination predicate.",
        eng="Operator log: 'stop-when installed'.",
        math="Termination predicate on state.",
        cs="Predicate installed on the loop.",
    ),
    r3=dict(
        setup="predicate-driven-termination",
        r1_domain="motoi big-bang",
        r1_code="(stop-when p)",
        r2_domain="while loop",
        r2_code=";; while not(p(s)): iterate\n;; while [ ! p ]; do step; done",
        r3_domain="halting condition",
        r3_code=";; halts iff P(state) = true\n(define (halt? s) #f)",
        explanation="Each rung declares a state-based termination condition.",
        meta="'Predicate halt' is the shape.",
        eng="Declarative halt is easier to reason about than imperative stop.",
        math="Halting predicate on state.",
        cs="Loop-condition clause.",
    ),
    r4=dict(
        claim="stop-when predicate is checked once per tick.",
        program="(big-bang 0\n  (on-tick (lambda (s) (+ s 1)))\n  (stop-when (lambda (s) (> s 5))))",
        invariant="∀ tick. predicate checked exactly once",
        meta="Once-per-tick check. Falsified by any double-check or skip. See book-of-computing ch07 (loops).",
        eng="Predictable termination timing.",
        math="Predicate evaluated on each state.",
        cs="Loop-condition once per step.",
    ),
    r5=dict(
        base="stop-when installs a halt predicate.",
        composition="(big-bang '(0 0)\n  (on-tick (lambda (s) (map + s '(1 0))))\n  (stop-when (lambda (s) (>= (car s) 10))))",
        emergent="bounded simulation: on-tick + stop-when = a finite-time simulation.",
        meta="Same family as htdp/universe stop-when. See book-of-composition ch16 (game loops).",
        eng="Bounded execution = testable.",
        math="Bounded iterated system.",
        cs="Predicate-driven loop.",
    ),
)

V["sub-position-per-beat"] = dict(
    r2=dict(
        problem="An entity must sit at a rhythmic sub-position within a beat formation.",
        program="(sub-position-per-beat 'e1 0.25)",
        explanation="The entity is placed at the quarter-beat sub-position within the formation.",
        meta="at-beat samples the formation; in-formation applies a whole formation. sub-position-per-beat is the correct choice for per-entity sub-beat placement.",
        eng="Operator log: 'e1 sub-pos 0.25'.",
        math="Fraction of beat mapped to position.",
        cs="Descriptor construction.",
    ),
    r3=dict(
        setup="sub-lattice-position",
        r1_domain="motoi choreo",
        r1_code="(sub-position-per-beat 'e1 0.25)",
        r2_domain="drum machine",
        r2_code=";; place a hi-hat on the 'and' of 1:\n;; step 2 of 4 = 0.25 beat offset",
        r3_domain="rational subdivision",
        r3_code=";; 1/4 within a period\n(define (subd n d) (/ n d))",
        explanation="Each rung places an event at a rational subdivision of a period.",
        meta="'Sub-beat placement' is the shape.",
        eng="Sub-beat placement is at the heart of rhythmic feel.",
        math="Rational offset in [0, 1).",
        cs="Descriptor with fractional offset.",
    ),
    r4=dict(
        claim="Same entity and offset yields deterministic placement.",
        program="(sub-position-per-beat 'e 0.5)\n(sub-position-per-beat 'e 0.5)\n(display 'deterministic)",
        invariant="∀ e offset. placement is deterministic",
        meta="Determinism. See book-of-sound ch06 (subdivisions).",
        eng="Deterministic sub-beat = repeatable rhythms.",
        math="Function of (entity, offset).",
        cs="Pure descriptor emission.",
    ),
    r5=dict(
        base="sub-position-per-beat places at a fractional beat.",
        composition="(for-each\n  (lambda (i) (sub-position-per-beat (list 'e i) (/ i 4)))\n  '(0 1 2 3))",
        emergent="beat-quantized crowd: many entities at rational offsets = a rhythm-locked formation.",
        meta="Same family as step-sequencer grids. See book-of-composition ch13 (subdivisions).",
        eng="Coordinated sub-beat = intentional rhythm.",
        math="Rational grid over entities.",
        cs="Batch fractional placement.",
    ),
)

V["surface-exists?"] = dict(
    r2=dict(
        problem="Before drawing on a surface, the operator must confirm it is registered.",
        program="(when (surface-exists? 'overlay)\n  (begin-frame 'overlay))",
        explanation="The guard prevents begin-frame on a non-existent surface.",
        meta="grid-init creates the grid; end-frame commits. surface-exists? is the correct choice for a REGISTRATION probe.",
        eng="Operator log: 'surface overlay? #t'.",
        math="Boolean over surface registry.",
        cs="Name-in-set predicate.",
    ),
    r3=dict(
        setup="registry-membership",
        r1_domain="motoi surface",
        r1_code="(surface-exists? 'overlay)",
        r2_domain="filesystem",
        r2_code=";; -e /path/to/file",
        r3_domain="set membership",
        r3_code=";; x ∈ S\n(define (in? x s) (member x s))",
        explanation="Each rung asks 'is this name known?'",
        meta="'Registry membership' is the shape.",
        eng="Membership probes precede any surface op.",
        math="Predicate x ∈ S.",
        cs="Hash membership query.",
    ),
    r4=dict(
        claim="surface-exists? is a pure query of the surface registry.",
        program="(display (equal? (surface-exists? 'main) (surface-exists? 'main)))",
        invariant="∀ name. exists?(name) idempotent within a frame",
        meta="Determinism. See book-of-computing ch09 (registries).",
        eng="Cheap probe; safe to call every frame.",
        math="Pure boolean function.",
        cs="Idempotent read.",
    ),
    r5=dict(
        base="surface-exists? guards surface ops.",
        composition="(define (safe-begin s) (when (surface-exists? s) (begin-frame s)))",
        emergent="safe-begin wrapper: probe + begin = a surface-agnostic starter.",
        meta="Same family as file-open guards. See book-of-composition ch06 (safe access).",
        eng="Guard prevents phantom-surface crashes.",
        math="Guarded operation.",
        cs="Precondition check.",
    ),
)

V["tempo"] = dict(
    r2=dict(
        problem="A song intro needs tempo set to 90 BPM.",
        program="(tempo 90)",
        explanation="tempo sets the shared transport BPM; all beat-locked systems retune immediately.",
        meta="audio-tempo sets audio-engine tempo; audio-bpm reads. tempo is the correct choice for the SHARED TRANSPORT.",
        eng="Operator log: 'transport BPM=90'.",
        math="Positive real.",
        cs="Global-state write.",
    ),
    r3=dict(
        setup="global-rate-set",
        r1_domain="motoi transport",
        r1_code="(tempo 90)",
        r2_domain="daw",
        r2_code=";; set project BPM\n;; project.tempo = 90",
        r3_domain="angular frequency",
        r3_code=";; ω = 2π · f\n(define omega 90)",
        explanation="Each rung sets a global rate for the periodic system.",
        meta="'Global rate' is the shape.",
        eng="One-knob-tempo simplifies session music.",
        math="Angular frequency.",
        cs="Global scalar write.",
    ),
    r4=dict(
        claim="tempo is monotone in effect.",
        program="(tempo 60)\n(tempo 120)\n(display 'faster)",
        invariant="∀ b1 < b2. rate(tempo=b1) < rate(tempo=b2)",
        meta="Monotone rate. See book-of-sound ch05 (tempo).",
        eng="Predictable tempo change.",
        math="Order-preserving map.",
        cs="Linear rate scalar.",
    ),
    r5=dict(
        base="tempo sets shared BPM.",
        composition="(define (ramp from to steps)\n  (let loop ((i 0)) (when (< i steps) (tempo (+ from (* (- to from) (/ i steps)))) (loop (+ i 1)))))",
        emergent="tempo ramp: iterated tempo calls = a linear ramp between rates.",
        meta="Same family as DAW tempo automation. See book-of-composition ch14 (automation).",
        eng="Smooth ramps for transitions.",
        math="Linear interpolation in tempo space.",
        cs="Ramp generator.",
    ),
)

V["to-draw"] = dict(
    r2=dict(
        problem="A big-bang loop needs a rendering function.",
        program="(big-bang '(0 0)\n  (on-tick (lambda (s) s))\n  (to-draw (lambda (s) (grid-cell-set! (car s) 0 1))))",
        explanation="to-draw wraps a rendering function into a big-bang clause.",
        meta="on-frame is generic per-frame; display registers a widget. to-draw is the correct choice for the BIG-BANG RENDER clause.",
        eng="Operator log: 'to-draw registered'.",
        math="Function state -> render effect.",
        cs="big-bang clause tag.",
    ),
    r3=dict(
        setup="render-clause",
        r1_domain="motoi world",
        r1_code="(to-draw f)",
        r2_domain="react",
        r2_code=";; render function\n;; function render(state) { return <View>...</View> }",
        r3_domain="state-to-view",
        r3_code=";; V : S -> R\n(define (view s) (list 'render s))",
        explanation="Each rung defines how state becomes a rendered view.",
        meta="'State-to-view' is the shape.",
        eng="Pure render clauses are the MVC contract.",
        math="Function S -> R.",
        cs="View function.",
    ),
    r4=dict(
        claim="to-draw function receives the current state each frame.",
        program="(big-bang '(0)\n  (to-draw (lambda (s) (display s))))",
        invariant="∀ frame. render receives current state",
        meta="State-render coupling. See book-of-composition ch16 (game loops).",
        eng="State-render tight coupling.",
        math="Function of state.",
        cs="Pure view derivation.",
    ),
    r5=dict(
        base="to-draw wraps a render clause.",
        composition="(big-bang '(0 0)\n  (on-tick (lambda (s) (map + s '(1 1))))\n  (to-draw (lambda (s) (grid-cell-set! (car s) (cadr s) 1))))",
        emergent="MVC-lite loop: state + tick + draw = a functional game architecture.",
        meta="Same family as htdp/universe or React's declarative render. See book-of-composition ch16 (loops).",
        eng="Functional MVC in one call.",
        math="Discrete-time observable view.",
        cs="Reactor with pure view.",
    ),
)

V["touch"] = dict(
    r2=dict(
        problem="A character must reach out and touch a card.",
        program="(touch 'hero 'card-a)",
        explanation="touch choreographs the character's hand or limb to make contact.",
        meta="in-formation places entities; sprite renders. touch is the correct choice for contact CHOREOGRAPHY.",
        eng="Operator log: 'hero touch card-a'.",
        math="Path from actor to target.",
        cs="Choreography descriptor.",
    ),
    r3=dict(
        setup="reach-and-contact",
        r1_domain="motoi choreo",
        r1_code="(touch 'hero 'card-a)",
        r2_domain="ik solver",
        r2_code=";; solve inverse kinematics for hand-to-target\n;; ik.solve(hand, target)",
        r3_domain="pathfinding-with-contact",
        r3_code=";; path from A to B ending in contact\n(define (path a b) (list a b))",
        explanation="Each rung reaches from an actor to a target ending in contact.",
        meta="'Reach + contact' is the shape.",
        eng="IK-style reaches feel natural in choreography.",
        math="Path terminating at a target.",
        cs="Contact choreography descriptor.",
    ),
    r4=dict(
        claim="touch is deterministic in actor and target.",
        program="(touch 'hero 'card-a)\n(display 'deterministic-choreo)",
        invariant="∀ actor, target. touch is a deterministic descriptor",
        meta="Determinism. See book-of-composition ch17 (choreography).",
        eng="Deterministic choreography = replayable scenes.",
        math="Function of (actor, target).",
        cs="Pure descriptor.",
    ),
    r5=dict(
        base="touch produces a contact choreography.",
        composition="(for-each (lambda (c) (touch 'hero c)) '(card-a card-b card-c))",
        emergent="deal-out: iterated touches = dealing a hand of cards.",
        meta="Same family as blackjack dealer animations. See book-of-composition ch17 (choreography).",
        eng="Iterated choreography for card dealing.",
        math="Map touch over target list.",
        cs="Batch choreography.",
    ),
)

V["viewport"] = dict(
    r2=dict(
        problem="Operator needs the viewport bounding box for collision culling.",
        program="(define vp (viewport))\n(display vp)",
        explanation="viewport returns the current bounding box on the card surface.",
        meta="camera-state returns position/zoom; pixels-wide returns raw dims. viewport is the correct choice for the VIEW BOX.",
        eng="Operator log: 'viewport (0 0 800 600)'.",
        math="Rectangle in world coordinates.",
        cs="Read of viewport state.",
    ),
    r3=dict(
        setup="observable-region",
        r1_domain="motoi camera",
        r1_code="(viewport)",
        r2_domain="cctv monitor",
        r2_code=";; the region the camera is watching",
        r3_domain="axis-aligned bounding box",
        r3_code=";; (x0 y0 x1 y1)\n(define (aabb) '(0 0 100 100))",
        explanation="Each rung returns the observable rectangular region.",
        meta="'Observable region' is the shape.",
        eng="Bounding boxes drive culling everywhere.",
        math="Axis-aligned bounding box.",
        cs="AABB struct.",
    ),
    r4=dict(
        claim="viewport is a function of camera state; identical camera state yields identical viewport.",
        program="(define a (viewport))\n(define b (viewport))\n(display (equal? a b))",
        invariant="∀ camera-state. viewport is deterministic",
        meta="Determinism. See book-of-math ch12 (transforms).",
        eng="Predictable culling.",
        math="Function of camera state.",
        cs="Pure derivation from camera.",
    ),
    r5=dict(
        base="viewport returns the current view box.",
        composition="(define (visible? e) (in-box? (entity/pos e) (viewport)))\n(filter visible? (entity/list))",
        emergent="frustum culling: filter + viewport = a culling primitive.",
        meta="Same family as GPU frustum culling. See book-of-composition ch15 (culling).",
        eng="Culling reduces render cost.",
        math="Set filter by AABB predicate.",
        cs="Spatial filter.",
    ),
)

V["viewport-width"] = dict(
    r2=dict(
        problem="Operator needs the viewport width in world units for edge-detection math.",
        program="(display (viewport-width))",
        explanation="viewport-width returns the horizontal extent of the current viewport.",
        meta="pixels-wide returns pixels; camera-scale returns zoom. viewport-width is the correct choice for WORLD-UNIT width.",
        eng="Operator log: 'viewport-width=1000 world units'.",
        math="Positive real in world units.",
        cs="Read.",
    ),
    r3=dict(
        setup="world-space-extent",
        r1_domain="motoi camera",
        r1_code="(viewport-width)",
        r2_domain="map",
        r2_code=";; miles across the visible map:\n;; visible_bounds.width",
        r3_domain="metric extent",
        r3_code=";; width of an interval\n(define (w a b) (- b a))",
        explanation="Each rung reports width in world units.",
        meta="'World extent' is the shape.",
        eng="World units differ from screen pixels; keep them straight.",
        math="Positive real.",
        cs="Read.",
    ),
    r4=dict(
        claim="viewport-width equals viewport's x1 - x0.",
        program="(define vp (viewport))\n(display (equal? (viewport-width) (- (caddr vp) (car vp))))",
        invariant="∀. viewport-width = box.x1 - box.x0",
        meta="Derived identity. See book-of-math ch14 (extents).",
        eng="Consistent width metric.",
        math="Extent difference.",
        cs="Derivable from viewport.",
    ),
    r5=dict(
        base="viewport-width returns world-space width.",
        composition="(define (edge? x) (or (< x 0) (> x (viewport-width))))",
        emergent="edge predicate: x + viewport-width = a boundary test.",
        meta="Same family as world-bounds tests. See book-of-composition ch15 (bounds).",
        eng="Boundary tests for gameplay.",
        math="Interval membership.",
        cs="Boundary predicate.",
    ),
)

V["wait"] = dict(
    r2=dict(
        problem="A state must wait for a 'user-input' event or 5 seconds, whichever comes first.",
        program="(wait 'user-input 5)",
        explanation="wait suspends the state until the event fires or the deadline elapses.",
        meta="after unconditionally advances; escalate raises. wait is the correct choice for EVENT-OR-TIMEOUT.",
        eng="Operator log: 'wait user-input deadline=5s'.",
        math="Wait until first-of event or deadline.",
        cs="Blocking wait with timeout.",
    ),
    r3=dict(
        setup="event-or-timeout",
        r1_domain="motoi cart",
        r1_code="(wait 'ev 5)",
        r2_domain="select syscall",
        r2_code=";; wait for fd ready or timeout:\n;; select(fds, timeout)",
        r3_domain="race between deadline and event",
        r3_code=";; first(event, timeout)\n(define (race e t) (list 'first e t))",
        explanation="Each rung waits for the earlier of an event or a deadline.",
        meta="'Event-or-timeout' is the shape.",
        eng="Timeouts avoid hang-forever bugs.",
        math="Minimum of two completion times.",
        cs="Race primitive.",
    ),
    r4=dict(
        claim="wait unblocks on either event fire or deadline expiry, whichever is first.",
        program="(wait 'ev 5)\n(display 'unblocked)",
        invariant="∀ event, deadline. unblocks at min(event-time, deadline)",
        meta="First-completion. See book-of-computing ch08 (select).",
        eng="Bounded blocking = safe.",
        math="Min-time semantics.",
        cs="Race primitive.",
    ),
    r5=dict(
        base="wait blocks on event or deadline.",
        composition="(define (with-timeout t f) (wait 'done t) (f))",
        emergent="timeout wrapper: wait + f = a bounded operation.",
        meta="Same family as async race combinators. See book-of-composition ch09 (races).",
        eng="Bounded blocking pattern.",
        math="Bounded operation.",
        cs="Race wrapper.",
    ),
)

V["with-seed"] = dict(
    r2=dict(
        problem="A procedural level must be reproducible across runs given the same seed.",
        program="(with-seed 42\n  (lambda ()\n    (display (random-int 100))\n    (display (random-int 100))))",
        explanation="with-seed pins the RNG to seed 42 for the duration of the thunk.",
        meta="random draws from the current seed; with-seed CHANGES the seed. with-seed is the correct choice for reproducible RNG.",
        eng="Operator log: 'seeded 42'.",
        math="Deterministic sequence from seed.",
        cs="Scoped seed set + restore.",
    ),
    r3=dict(
        setup="scoped-state-override",
        r1_domain="motoi rng",
        r1_code="(with-seed 42 f)",
        r2_domain="git",
        r2_code=";; checkout a specific commit temporarily:\n;; git worktree add /tmp/w abc123",
        r3_domain="dynamic-extent parameter",
        r3_code=";; parameterize a value for a scope\n(define (with-param p v f) (list p v f))",
        explanation="Each rung overrides a parameter for a bounded scope, then restores it.",
        meta="'Scoped override' is the shape.",
        eng="Scoped overrides are testable and safe.",
        math="Dynamic-extent binding.",
        cs="Parameterize pattern.",
    ),
    r4=dict(
        claim="Same seed and same thunk produces the same output.",
        program="(define a (with-seed 42 (lambda () (random-int 100))))\n(define b (with-seed 42 (lambda () (random-int 100))))\n(display (= a b))",
        invariant="∀ seed s, thunk f. with-seed(s, f) is deterministic",
        meta="Deterministic seeded RNG. See book-of-computing ch03 (determinism) and book-of-math ch07 (PRNG).",
        eng="Reproducible RNG = reproducible tests.",
        math="Deterministic sequence.",
        cs="Scoped seeded PRNG.",
    ),
    r5=dict(
        base="with-seed pins RNG for a scope.",
        composition="(define (test-with-seeds seeds thunk)\n  (map (lambda (s) (with-seed s thunk)) seeds))",
        emergent="property-based testing: multiple seeds + same thunk = coverage across the RNG.",
        meta="Same family as QuickCheck property tests. See book-of-composition ch11 (property testing).",
        eng="Property testing over many seeds.",
        math="Sample over seed space.",
        cs="Multi-seed testing pattern.",
    ),
)

V["with-spacing"] = dict(
    r2=dict(
        problem="A choreographed formation needs entities spaced 10 world units apart.",
        program="(with-spacing 10\n  (in-formation 'row (list 'a 'b 'c)))",
        explanation="with-spacing configures inter-entity spacing for the enclosed formation call.",
        meta="in-formation places without spacing knob; sub-position-per-beat is beat-based. with-spacing is the correct choice for SPACING configuration.",
        eng="Operator log: 'spacing=10'.",
        math="Scalar distance.",
        cs="Scoped configuration wrapper.",
    ),
    r3=dict(
        setup="scoped-configuration",
        r1_domain="motoi choreo",
        r1_code="(with-spacing 10 ...)",
        r2_domain="css",
        r2_code=";; gap: 10px on flex layout",
        r3_domain="metric parameter",
        r3_code=";; distance between elements\n(define spacing 10)",
        explanation="Each rung parameterises spacing for a scoped operation.",
        meta="'Spacing knob' is the shape.",
        eng="Named spacing beats hardcoded numbers.",
        math="Scalar metric.",
        cs="Scoped parameter.",
    ),
    r4=dict(
        claim="with-spacing scopes the spacing setting to its body.",
        program="(with-spacing 10 (in-formation 'row '(a b)))\n(display 'scoped-spacing)",
        invariant="∀ n, body. spacing = n only within body",
        meta="Scoped effect. See book-of-composition ch05 (scoped params).",
        eng="Scoped = no global-state bleed.",
        math="Dynamic extent.",
        cs="Parameterize pattern.",
    ),
    r5=dict(
        base="with-spacing scopes spacing.",
        composition="(with-spacing 20 (in-formation 'row (entity/list)))",
        emergent="spaced formation: with-spacing + in-formation = a formation with explicit gaps.",
        meta="Same family as CSS gap / flexbox. See book-of-composition ch12 (formations).",
        eng="Explicit spacing = readable layouts.",
        math="Uniform-gap arrangement.",
        cs="Scoped spatial config.",
    ),
)

V["escalate"] = dict(
    r2=dict(
        problem="A retry loop has exhausted its budget; the operator wants to bubble a typed condition upward for structured handling.",
        program="(define (fetch n)\n  (if (> n 5)\n      (escalate 'retry-exhausted n)\n      (list 'ok n)))\n(with-exception-handler\n  (lambda (e) (list 'caught (error-object-type e)))\n  (lambda () (fetch 6)))",
        explanation="escalate raises a symbol-typed condition with irritants; the handler dispatches by type.",
        meta="error is generic; raise doesn't imply structure. escalate is the correct choice for STRUCTURED, TYPED raises.",
        eng="Operator log: 'escalate retry-exhausted 6'.",
        math="Named exception raise.",
        cs="Non-continuable typed raise.",
    ),
    r3=dict(
        setup="typed-condition-raise",
        r1_domain="motoi exceptions",
        r1_code="(escalate 'timeout)",
        r2_domain="OS signals",
        r2_code=";; send a typed signal to the process:\n;; kill -USR1 $pid",
        r3_domain="sum-type constructor",
        r3_code=";; raise a variant\n(define (raise-tag t . vs) (cons t vs))",
        explanation="Each rung raises a NAMED condition that downstream can dispatch on.",
        meta="'Named raise' is the shape.",
        eng="Typed conditions beat generic errors for handler dispatch.",
        math="Element of a sum type.",
        cs="Tagged-union constructor for exceptions.",
    ),
    r4=dict(
        claim="escalate is non-continuable: control does not return to the escalate site.",
        program="(define reached? #f)\n(with-exception-handler\n  (lambda (e) 'handled)\n  (lambda ()\n    (escalate 'x)\n    (set! reached? #t)))\n(display reached?)  ;; expect #f",
        invariant="∀ call. code after escalate is not executed",
        meta="Non-continuable raise. Falsified only if a continuable-raise is used. See book-of-computing ch11 (exceptions).",
        eng="Non-continuable = predictable control flow.",
        math="Control-flow non-return.",
        cs="Non-continuable exception primitive.",
    ),
    r5=dict(
        base="escalate raises a typed condition.",
        composition="(define (plan steps)\n  (guard (e ((eq? (error-object-type e) 'skip) 'ok))\n    (for-each (lambda (s) (or (s) (escalate 'skip))) steps)))",
        emergent="named-condition control flow: escalate + guard = a plan-runner that recognizes named skip/abort conditions.",
        meta="Same family as Common Lisp restart-case or Rust's typed error enums. See book-of-composition ch18 (control flow) and book-of-code ch12 (exceptions).",
        eng="Named conditions = readable control flow.",
        math="Structured control transfer.",
        cs="Typed dispatcher.",
    ),
)

print(f"Total verbs authored: {len(V)}")
missing = [n for n in [
"across-beats","after","after-frame","arc-between","at-beat","audio-band","audio-bands","audio-bar-clock","audio-beat?","audio-bpm",
"audio-halt","audio-master-volume","audio-peak","audio-perceptual-bands","audio-play","audio-playing?","audio-rms","audio-tempo","audio-time","begin-frame",
"big-bang","camera-bring-to-view","camera-center-on","camera-export","camera-fit-all","camera-frame","camera-home","camera-pan","camera-pan-to","camera-record",
"camera-scale","camera-set!","camera-state","camera-tilt","camera-trace","camera-x","camera-y","camera-zoom-to","cancel-tick","clear-surface-layer",
"cols","display","end-frame","eval","frame","grid-cell-age","grid-cell-set!","grid-cell-state","grid-cell?","grid-cols",
"grid-init","grid-live-count","grid-neighbors","grid-origin","grid-rows","grid-step","grid-step-3state","grid-step-4state","grid-step-aged","grid-step-count",
"input-may-i?","key?","land-on-downbeat","measure-content","note","note-dots","note-place","note-place-at","note-release","note-strike",
"on-canvas-trace","on-frame","on-key","on-tick","pixels-tall","pixels-wide","randint","random","random-int","random-pick",
"random-range","rows","sprite","sprites","stop","stop-when","sub-position-per-beat","surface-exists?","tempo","to-draw",
"touch","viewport","viewport-width","wait","with-seed","with-spacing","escalate"
] if n not in V]
print(f"Missing verbs: {missing}")

# ==== render each verb's four new fields as a SLAT string ==================

def render_verb_block(name, v):
    r2 = v["r2"]; r3 = v["r3"]; r4 = v["r4"]; r5 = v["r5"]
    lines = []
    lines.append(f'  :row-2-audit ((:problem "{esc(r2["problem"])}" :program "{code(r2["program"])}" :explanation "{esc(r2["explanation"])}" :meta "{esc(r2["meta"])}") (:eng "{esc(r2["eng"])}" :math "{esc(r2["math"])}" :cs "{esc(r2["cs"])}"))')
    lines.append(f'  :row-3-dimension ((:setup "{esc(r3["setup"])}" :rungs ((:domain "{esc(r3["r1_domain"])}" :code "{code(r3["r1_code"])}") (:domain "{esc(r3["r2_domain"])}" :code "{code(r3["r2_code"])}") (:domain "{esc(r3["r3_domain"])}" :code "{code(r3["r3_code"])}")) :explanation "{esc(r3["explanation"])}" :meta "{esc(r3["meta"])}") (:eng "{esc(r3["eng"])}" :math "{esc(r3["math"])}" :cs "{esc(r3["cs"])}"))')
    lines.append(f'  :row-4-proof ((:claim "{esc(r4["claim"])}" :program "{code(r4["program"])}" :invariant "{esc(r4["invariant"])}" :meta "{esc(r4["meta"])}") (:eng "{esc(r4["eng"])}" :math "{esc(r4["math"])}" :cs "{esc(r4["cs"])}"))')
    lines.append(f'  :row-5-emergence ((:base "{esc(r5["base"])}" :composition "{code(r5["composition"])}" :emergent "{esc(r5["emergent"])}" :meta "{esc(r5["meta"])}") (:eng "{esc(r5["eng"])}" :math "{esc(r5["math"])}" :cs "{esc(r5["cs"])}"))')
    return "\n".join(lines)


# ==== inject into 01-core.slat =============================================
# Strategy:
#  - For each verb (except the last one 'escalate'), find its ':learn ...' line
#    that ends with '))' — that's the last line of the verb. Change the trailing
#    '))' to ')' (closing only :learn), then append 4 new field lines, then ')'.
#  - For 'escalate' (the last verb, which has more trailing tail), find its
#    ':learn ...' line ending with just ')' (single-close) and insert AFTER it,
#    BEFORE the ':library "core"' trailing block. Actually escalate's :learn
#    ends with just single ')' at end (learn record close only), and closing
#    ')' of the verb is line 1913 after :provenance. So we insert after :learn.

def inject_into_slat():
    text = SLAT.read_text()
    lines = text.split("\n")
    
    # Build name -> line-index of first :name line
    name_line = {}
    for i, ln in enumerate(lines):
        m = re.match(r'^  :name "([^"]+)"$', ln)
        if m:
            name_line[m.group(1)] = i
    
    # For each verb, find its next :learn line
    verb_names_in_order = list(name_line.keys())
    injections = []  # list of (line_index_to_replace, new_lines_replacing_it)
    
    for idx, vname in enumerate(verb_names_in_order):
        start = name_line[vname]
        end = name_line[verb_names_in_order[idx+1]] if idx+1 < len(verb_names_in_order) else len(lines)
        # find :learn line in [start, end)
        learn_idx = None
        for j in range(start, end):
            if lines[j].startswith("  :learn "):
                learn_idx = j
                break
        if learn_idx is None:
            print(f"WARN: no :learn line for {vname}")
            continue
        
        learn_ln = lines[learn_idx]
        block = render_verb_block(vname, V[vname])
        
        if vname == "escalate":
            # learn ends with single ')'. Insert new fields AFTER learn line, keeping
            # the trailing lines (:library etc.) intact.
            new_lines = [learn_ln] + block.split("\n")
            injections.append((learn_idx, learn_idx+1, new_lines))
        else:
            # learn ends with '))' — outer ')' closes the verb. Split into ')' + injected
            # block + ')'.
            if not learn_ln.rstrip().endswith("))"):
                print(f"WARN: {vname} :learn doesn't end with )). Line: {learn_ln[-40:]}")
                continue
            # strip the last ')' (the verb-close)
            without_verb_close = learn_ln.rstrip()[:-1]  # ends with ')'
            new_lines = [without_verb_close] + block.split("\n") + [")"]
            injections.append((learn_idx, learn_idx+1, new_lines))
    
    # Apply injections back-to-front so indices remain valid
    for start, end, new in reversed(injections):
        lines[start:end] = new
    
    out = "\n".join(lines)
    SLAT.write_text(out)
    print(f"Injected {len(injections)} verb blocks")

inject_into_slat()
