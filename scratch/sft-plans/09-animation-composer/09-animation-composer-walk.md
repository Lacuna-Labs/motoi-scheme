# Lane #9 — Animation Composer SFT (make-a-scene from scratch)

**Status: OPEN — design locked here, authoring DEFERRED.** Design-only #418. No fold,
no pairs authored until Alfred says go (2026-07-29).

This lane is the **Animation composer** sibling of lane #7 (Game composer) and lane #8
(Music composer). Boot splash (#373): IDE / Music / Animation / Game. Games got a rich
make-from-scratch lane; this is Animation's.

Not a duplicate of lane #4 §24–§25 (book-of-motion / book-of-animation). Those teach the
**subject** (Tier-2, sealed). This lane teaches **"help me make an animation"** — the
lane-#7 10-family / 3-tier machinery, domain-swapped to the surface/grid + frame counter.

---

## §0 — one breath

Take the scene/animation make-from-scratch material, build it up rung by rung (each rung
RUNS), decompose every construct back to the reference manual + book-of-animation, explode
WHY each motion decision, reverse write⇄identify, and link every animation-specific ERROR
back to its construct. Then climb into ship-it: refine-and-extend a scene, give sage advice
about what motion actually reads well, tell the truth about the machine (framebuffer
redraw, cells-per-frame, headless render), and — the keystone — **break "make me an
animation" into a dialogue** ("a bouncing ball needs an arc — squash on the floor? top-down
or side-on?"). Cap with the philosophical lens: what animation IS, why motion moves us.

## §1 — why this lane exists

Same rationale as lane #8 (game engine = vehicle to teach Scheme generally; composers are
the on-ramp; error-finding generalizes). Animation is the **visual** proof of the same
build/decompose/debug loop — and it's where the **framebuffer/color/perspective** skills
from the word-books drawing-primitives work cash out into moving pictures.

## §1.5 — the emphasis: CONSTRUCT ⇄ DECONSTRUCT, errors, and the on-ramp

**Making animation from code is hard — any help is good** (Alfred, 2026-07-29). The heavy
weight sits on the **construct/deconstruct pair + errors + the subtleties**:

- **CONSTRUCT (A1)** — expand hard on *how to build a scene up*: paint one cell → a shape →
  a shape placed with math → a shape that moves with the frame → a whole scene with layers
  and a delight beat (per `dancing-flower`). Each rung a runnable step.
- **DECONSTRUCT (A2)** — expand equally hard on *taking a scene apart*: name every construct,
  point each back at the reference manual + book-of-animation, say what it contributes (this
  `sway(frame)` keys motion to the frame; `begin/end-frame` bracket a draw; `tick-frame`
  advances without wall-clock). Take it apart "by mutilating" — remove `clear`, watch it
  flicker; freeze `sway`, watch it stop.
- **ERRORS + SUBTLETIES (A5, A8)** — animation has *lots* of subtleties and a rich error
  surface: mutate-in-render, missing `clear`, off-by-one bounds, motion not keyed to the
  frame, redraw cost, easing/arcs/secondary-motion (the difference between reads-good and
  reads-bad, book-of-motion ch21). This is where the generalizing debugging skill is drilled.

**Why the lane exists (on-ramp + fork, Alfred):** same as lane #8 — the engine teaches
Scheme *generally*; composers are the on-ramp; graduation = fork Motoi and write your own
Scheme, Motoi warns what's dangerous and gives an honest no where it doesn't know, stays the
kid-friendly one, forks come back — Motoi is not mad. See
[[project_composer_lanes_music_animation]].

## §2 — substrate on disk (grab-don't-generate)

- **Ground-truth builds:** `carts/cart-maker-1-scenes/` — `astronaut-in-space`,
  `city-sunset`, `dancing-flower`, `friendly-face`, `house-on-a-hill` (each `*.scm` +
  captured `*.out.txt`). `dancing-flower` is the reference animation ground truth: `set-mode`
  → `sway` triangle-wave → `draw-flower(frame)` → `on-frame` + `tick-frame` loop → `render`.
  NOTE: **no standalone animation `.sks` program carts** — unit = the cart-maker scene + the
  book ladder.
- **Concept ladder:** `scheme-books/book-of-animation/` (16ch + app: the surface/grid →
  vectors → forces → oscillation → particles → bodies → locomotion → steering → flocking →
  wayfinding → scenes → camera → director → living-garden; "animation is a function from
  frame number to paint"). `book-of-motion/` (physics-of-movement + Disney 12 principles +
  animation history; easing = proper-lens).
- **Verb identity:** reference manual — `paint-cell`/`put-pixel`/`plot-pixel`, `disc`,
  `circle`, `rect-fill`, `line`, `set-color`, `set-mode`, `clear`, `begin-frame`/`end-frame`,
  `on-frame`, `tick-frame`, `render`, `motion/*`.
- **Errors:** `error-cards/` + animation-specific runtime errors (below).
- **Composer runtime:** #380 (`motion/*` on framebuffer/scheduler); #371 "rebuild motion +
  animation on framebuffer/scheduler" is PENDING — verify which motion verbs actually run
  before assigning depth; honest-null where the framebuffer path isn't there.

## §3 — the ten families in three tiers (A1–A10, mirroring C1–C10)

**Tier A — MAKE & READ THE CODE (A1–A5):**
- **A1 BUILD-A-SCENE LADDER** — empty surface → paint one cell → a shape → a shape that
  moves with the frame → a full swaying scene, each rung RUNS. Grab rungs from
  cart-maker-1-scenes (dancing-flower: set-mode → static sky/ground → stem/leaves → swayed
  head via `sway(frame)` → bee delight-beat → render). Unit = the whole scene.
- **A2 DECOMPOSE-AND-DESCRIBE** — construct-by-construct against the reference grid +
  book-of-animation's frame ("the surface is a grid, time is a counter"; `on-frame` hooks
  the loop, `tick-frame` advances without wall-clock so it finishes in CI). Helpers by role.
- **A3 THE WHY — EXPLODE** — why a triangle wave for sway not sine (deterministic, easier to
  read), why amplitude 3 / period 8, why two side-by-side lines = a thicker stem, why a
  one-pixel bee (a delight beat). Multi-angle. Taste-bottom-out → honest-null.
- **A4 REVERSAL bidirectional** — (a) intent→code WRITE ("a flower that sways"); (b)
  code→identify+OUTCOME READ ("this `sway` — what motion, what period?"). InverseCoder.
- **A5 ERROR-LINK — including ANIMATION-SPECIFIC errors** — abductive symptom→cause→fix.
  Animation errors: **nothing moves** (mutate-in-render / forgot `tick-frame` / drew outside
  begin/end-frame), **flicker/tearing** (no `clear` or wrong frame boundaries), **off-screen**
  (coords past `set-mode` bounds / off-by-one), **wrong color** (unbound color symbol →
  reader), **frozen/hang** (un-guarded frame loop → fuel-exhausted), **all-frames-identical**
  (motion not keyed to the frame number). Silent-non-errors: runs but paints nothing.

**Tier B — MAKE IT GOOD & MAKE IT REAL (A6–A9):**
- **A6 REFINE-AND-EXTEND** — "how do I make this scene better?" tighten (extract `draw-X`
  helpers, name colors), extend (add a second flower, a moving cloud, secondary motion on
  the leaves), each RUNS. Done = checkpoint.
- **A7 SAGE ADVICE** — motion FEEL + taste, grounded in SURVEYED "what reads as good motion"
  (cited K7 + book-of-motion's good-vs-bad-animation ch21, not invented): arcs over straight
  lines, squash/stretch, easing over linear, anticipation, secondary motion; age axis
  (simple delight / snappy / subtle-and-calm); taste-forks → honest-null.
- **A8 TRUTH ABOUT THE MACHINE** — framebuffer redraw is O(cells); "I painted every cell
  every frame at 200×200 and it crawled" → clear-only-what-changed, cells-per-frame budget,
  headless render (why you see `.out.txt` not a window), fuel = seatbelt. What to do when it
  hangs. Deep version of A5's frozen-loop.
- **A9 BREAK-THE-WANT-INTO-A-DIALOGUE (keystone)** — "make me a bouncing ball" = one small
  cart. "make me an animation" = part-by-part ("I can't picture exactly what's in your head
  — walk me through it: what's the subject? a ball. side-on or top-down? it needs an arc —
  fast down, slow at the top; squash when it hits the floor? here's the surface with the
  ball, want it bigger?"). Fuses the word-books **drawing primitives + color + perspective**
  work ("I've never seen a road — here are shapes it might be: a rectangle with a dashed line;
  perspective = pull the far edge to a triangle near the top that doesn't vanish"). Each step
  RUNS.

**Tier C — WHAT ANIMATION IS (A10):**
- **A10 WHAT IS ANIMATION** — persistence of vision / why motion moves us (told true); the
  16 philosophers pass on motion/time/illusion/life (honest-null where silent; Bergson-style
  duration if in-corpus, else skip); animation in CS (a function from frame → paint;
  deterministic motion as a program); the deceit-that-delights (a flip-book is 6 stills).

## §3.5 — knowledge weave (animation K-set)

K1 animation history (McCay/Fleischer/Ghibli/Kon/McLaren — world-knowledge, KEEP; grab
from book-of-motion, never invent film history) · K2 motion-design fundamentals (the 12
principles) · K3 how-a-frame-loop-works/why (function from frame → paint; the scheduler) ·
**K4 what the FRAMEBUFFER is doing** — the SAME weave lane #7 asked for, linked to the
engineering manual's framebuffer chapter (`src/lib-loader.js` fb, `fb/dump`, pixel) · K5
COLOR of things (16 named + any color; wheel=black, road=black+dashed-line; unseen → "here
are shapes it might be") + PERSPECTIVE (pull far edge to a triangle that doesn't disappear)
· K6 where complexity belongs (scene state, the director, particle systems).

## §4 — the units (finale artifacts)

The cart-maker-1-scenes scenes ARE the units: astronaut-in-space · city-sunset ·
dancing-flower · friendly-face · house-on-a-hill. **Hold 1 out** (candidate:
`house-on-a-hill`) as a never-trained validation scene. Book-of-animation's living-garden is
the far-horizon finale referenced, not authored as a cart.

## §5 — depth / register

**COVERAGE WIDTH: 5–8 pairs per unit, DIALOGUE-HEAVY** (Alfred, 2026-07-29). This is where
the dialogue volume lives — "lots of dialogue, that's just the way it is." Expand it richly:

- **BACKGROUND INFO + GREAT ANIMATORS + HISTORY are first-class**, not decoration (K1 —
  McCay, Fleischer, Ghibli, Kon, McLaren; the 12 principles; the deceit-that-delights). A
  scene should be taught with the craft-lineage behind it, grabbed from book-of-motion /
  book-of-animation, never invented.
- **KNOWS HOW MOTION WORKS** — the science: motion as a **function from frame → paint**, the
  math of arcs/easing/velocity, the framebuffer. Live it in WITH science, same as sound.

Depth ~3–4 rounds (A1 longer, discrete rungs; A9 long with stacked context + drawing
primitives). Register rides `:audience "kid"` and CLIMBS. A7 age axis; A10 philosopher
register. Novelty & interest axis (a surprising secondary motion, a delight beat like the
bee). Proper-lens (easing = the shape of the motion; sway = a wave). Abductive,
grab-don't-generate, interpreter-graded. Over-include then scale back.

## §6 — compliance

Reference + book = authority (gap → `:status needs-alfred`; never invent animation history
or film facts). Cited-not-invented for A7/K7. Scrub wall holds (animation HISTORY = world
knowledge, KEEP; only who built the MODEL is forbidden; sole surviving name = "Built by
Alfred Borden"). Every block must `./bin/motoi run`; honest-null where the #371 framebuffer
path isn't wired yet. Design doc; scenes are the execution surface, authored on Alfred's go.

## §7 — open questions

1. Author all 5 scenes or hold `house-on-a-hill` out (default: hold 1 out)?
2. How much word-books drawing-primitives machinery folds in here vs staying its own lane?
3. Error-link only own-construct errors, or also near-miss adjacent?
4. #371 framebuffer rebuild is PENDING — author against current ASCII/cell path now, or
   wait for the real framebuffer layer? (honest-null in the meantime.)
5. K7 sourcing without internet — which cited source for "what reads as good motion"
   (book-of-motion ch21 good-vs-bad is on-disk; enough, or supplement?).
