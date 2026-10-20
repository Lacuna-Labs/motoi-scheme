# Fix one and two — 2026-07-29

## Item 1 — pre-existing broken book blocks (the flags in my ping)

**FIXED (my #461 sprinkle scope, all now cumulative-clean):**
- `ch-advanced-04-groups-symmetry.book.slatl` block 56 (D₆ rosette): replaced
  `math/array`-as-range → `iota`, `(geom/point 'x p)` accessor misuse → `car`/`cadr`,
  `(plot/line curve)` → two parallel lists. Now **93/93** blocks.
- `ch-advanced-14-topology-shape-of-data.book.slatl` block 48: `(const/pi)` was
  calling π as a function → dropped the parens (`const/pi` is a value). Now **66/66**.
- `scratch/verify-book.mjs`: fixed a *verifier* bug — it wasn't unescaping `\"`/`\n`/`\\`
  from SLAT-stored blocks (check-book did), which produced false "unterminated string"
  failures. Not book breakage.
- Motion `ch01-the-still-frame.book.slatl` (shape sprinkle): **99/99**.

**SURFACED but OUT OF the flagged scope (chapters I did not touch; independent
pre-existing failures, previously masked by the verify-book unescape bug):**
- `ch14-calculus-2.book.slatl` @block 12 — `unbound symbol: calc/sin` (genuine gap)
- `ch16-math-major-electives.book.slatl` @block 6 — `unbound symbol: alg/plr` (genuine gap)
- `ch15-multivariable-linear-algebra.book.slatl` @block 70 — `num/nintegrate-2d: bounds must be [lo hi]`
- `ch08-oscillation` / `ch13-style` / `ch15-the-crowd` — `fuel exhausted` (may be verifier
  fuel-limit tuning rather than real infinite loops — needs a look)
  → left for Alfred to scope; not silently repaired.

## ALL 6 NOW FIXED — 2026-07-29 ("fix all of them")

Alfred said "please fix all of them." Done — all six now pass cumulatively.

**Real book-code bugs (3 chapters — used verbs/APIs that don't exist):**
- `ch14-calculus-2.book.slatl` → **64/64**. `calc/sin|cos|tan` never wired →
  swapped to real `geom/sin|cos|tan`; `calc/exp|log|sqrt` → R7RS bare
  `exp|log|sqrt`; `plot/line` given 2 parallel lists (not point-pairs);
  `(calc/taylor 'sin …)` → `(calc/taylor geom/sin …)` (taylor takes a function,
  not a quoted symbol). 2 prose sentences truthfully reframed to geom/*+taylor.
- `ch16-math-major-electives.book.slatl` → **29/29**. `alg/plr` doesn't exist →
  implemented PLR (Parallel/Leading-tone/Relative) in-block as arithmetic mod 12
  (more pedagogical); `alg/wallpaper-group 'p4m` doesn't exist → p4m's point
  group IS D4, used real `(alg/dihedral 4)`; fixed `(alg/triad 'major 0)` arg
  order → `(alg/triad 0 'major)`. No fabricated verbs added.
- `ch15-multivariable-linear-algebra.book.slatl` → **75/75**.
  `num/nintegrate-2d`/`-3d` take per-axis bound-LISTS `(list lo hi)`, not loose
  scalars; fixed all 5 call sites.

**NOT book bugs — verifier artifact (3 motion chapters):**
- `ch08-oscillation` (80/80) · `ch13-style` (142/142) · `ch15-the-crowd` (69/69).
  Root cause: `scratch/verify-book.mjs` created ONE shared core env whose fuel
  object (4M) is closed over by primitives and drained CUMULATIVELY across all
  ~80–142 blocks — it ran dry mid-chapter and reported "fuel exhausted" even
  though every block passes standalone. Proof: block 11 threw at only 25,818
  eval-fuel used; block0+block11 passes at DEFAULT 200K via `./bin/motoi run`;
  whole chapters exit 0 through the real grader at generous fuel. **Fix was to
  the verifier, not the books**: bumped session fuel to 2e9 (documented inline).
  The book animation code was correct all along.

Final: `node scratch/verify-book.mjs <all 6>` → **6/6 chapters run clean.**

## Item 2 — #372 conflict (3 animation DOM verbs)

Conflict: #460 authored full 15-grid entries for `animation/budget`,
`animation/reflow-policy`, `animation/set-reflow-policy` in `04-animation.slat`,
contradicting #372's deliberate decision (broken-examples card
`animation-dom-reflow-not-motoi-subject.slatl`) that these are **dialect leaks**
from Curator's browser host — a framebuffer has no layout reflow, no ms budget —
and were "dropped from the reference 2026-07-26."

**Resolution: honored #372.**
- Removed the 3 DOM verb entries from `04-animation.slat` (6 verbs → 3 real tween-
  lifecycle verbs: tweens/tick/clear!). Archived the removed text to
  `scratch/archive/04-animation-dom-reflow-verbs-removed-2026-07-29.slat` (no git here).
- Rewrote the chapter header to state the 3 DOM verbs are NOT documented and why,
  pointing at the broken-examples card.
- Cleaned incidental references: `72-world.slat` cs-composition (was `(cadr (animation/budget))`
  — a dialect leak *and* buggy: budget returns an integer) → real back-pressure via
  `(length (animation/tweens))`, verified runs. Prose drawbacks in `55-scene.slat` (×3)
  and `48-part.slat` (×1) → dropped `animation/budget`, kept the real advice
  (spread spawns across frames with on-tick; drive with animation/tick).
- Broken-examples teaching card kept intact. Runtime wiring left in place — unwiring
  is code surgery owned by #371.

**FLAG for #426 (retag stream):** `scheme/reference/*.slat.retag-new` sidecars (dated
Jul 29 00:19) still contain the stale 6-verb 04-animation. If that retag is applied
`.retag-new → .slat`, it will RE-INTRODUCE the DOM verbs. Regenerate 04-animation.slat.retag-new
from the current .slat before applying.

All four edited chapters parse cleanly (reader.js). Topo/alg/motion books cumulative-clean.
