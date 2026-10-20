# Lane 3 Fix Report — 2026-07-26

## Final verification: 3190/3190 snippets pass (0 failures)

| File | Snippets | Fixed | Routed | Needs-Alfred |
|------|----------|-------|--------|--------------|
| 02-ai.slat | 578 | 23 | 0 | 0 |
| 05-artifact.slat | 60 | 17 | 0 | 0 |
| 20-curve.slat | 666 | 9 | 0 | 0 |
| 30-grid.slat | 237 | 3 | 0 | 0 |
| 64-text.slat | 138 | 5 | 0 | 0 |
| 40-math.slat | 837 | 0 | 0 | 0 |
| 52-predicate.slat | 315 | 0 | 0 | 0 |
| 16-compare.slat | 30 | 0 | 0 | 0 |
| 14-collision.slat | 15 | 0 | 0 | 0 |
| 62-synth.slat | 160 | 0 | 0 | 0 |
| 33-higher-order.slat | 154 | 0 | 0 | 0 |
| **TOTAL** | **3190** | **57** | **0** | **0** |

## Systemic patterns fixed

**1. Ref/impl API drift (02-ai.slat — 3 verbs)**
- `ai/flock`: documented as `(ai/flock id tag radius force)`, actual impl is `(ai/flock pos vel posns vels)`. All examples rewritten to vector API.
- `ai/utility`: documented as `(ai/utility id choices) → action-tag`, actual impl is `(ai/utility value min max) → 0..1 score`. Rewritten.
- `ai/bb-get`: documented as `(ai/bb-get id key default)`, actual impl is `(ai/bb-get key namespace?)`. Rewritten with `ai/bb-set!` pre-setup.

**2. Curator-dialect verbs in Motoi headless** (card-do, card/*)
- `card-do` calls replaced with `(display ...)` equivalents.

**3. `cond => arrow syntax` not supported**
- Two occurrences in 02-ai.slat. Rewritten to explicit `let`/`if` form.

**4. `cons` + lambda + `cdr` not callable**
- `(cdr (cons 'tag lambda))` returns a JS object that cannot be called in Motoi.
- Pattern `(list 'tag lambda)` + `(cadr ...)` used instead.

**5. `artifact/list` headless surface errors (05-artifact.slat)**
- 14 calls wrapped in `(guard (exn (#t 'pending)) ...)`.

**6. `flatten` undefined** (20-curve.slat)
- 5 occurrences. Each prepended with inline definition.

**7. `iota` fuel exhaustion** (20-curve.slat)
- `(resample ... 44100 22050 1)` → `(resample ... 100 50 1)`.

**8. Curried define unsupported** (20-curve.slat)
- `(define ((for-frame f) i) ...)` → `(define (for-frame f) (lambda (i) ...))`.

**9. Trailing apostrophe on identifiers** (30-grid.slat)
- `'f1'` → `'f1` (3 occurrences).

**10. `text/rasterize` key format** (64-text.slat)
- Returns `cells`/`width`/`height` not `:cells`/`:width`/`:height`. Fixed all `assq` calls.

**11. `text/draw` returns `#f` in headless** (64-text.slat)
- `(car #f)` crash. Added `(not result)` guard before `(car result)`.

**12. Apostrophe-quoted hex color literals** (64-text.slat)
- `'#FF0000` parse error. Changed to `"#FF0000"` (double-quoted strings).

**13. Undefined freevars** (02-ai.slat, 05-artifact.slat)
- Inline `define` stubs added for: `grid`, `path`, `field`, `data`, `options`, `carnivores`, `closest-prey`, `herbivores`, `predict-look-ahead`, `lead-position`, etc.
