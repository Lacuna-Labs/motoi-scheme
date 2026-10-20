# Remaining gap verbs — ground truth (2026-07-29)

Probed live via `./bin/motoi run /dev/stdin`. Floor doctrine: the reference
cannot lie. Only document inputs where output is verified correct. The original
census said "37 across 12 libs"; live probing shows only **24 are genuinely
wired + runnable + undocumented**. The rest were spec-only names (unwired) and
are CORRECTLY excluded — documenting them as working would be fabrication.

## EXCLUDED (spec-only / unwired — do NOT author as reference records)
- `artifact/*` — artifact.js wires only cite/delete/save, and all three are
  already documented. `artifact/list` is documented but UNWIRED (spec-only).
  Gap = 0. The census's "artifact 10" were spec names, not wired verbs.
- `entity/static? has-tag? collides? hits-tag move set-velocity! turn unpin!` —
  these live in `lib/game/game.js`, which is NOT loaded in the default env.
  All 8 are UNBOUND (`error: unbound symbol`). Do not author.
- `bezier-ease named-ease spring-ease` — already documented; they are curried
  HOFs (return a function of t), not the gap.

## AUTHOR THESE 24 (verified runnable + undocumented)

### matrix (4) — chapter 41-matrix.slat — pure, deterministic, gradeable
- `(matrix/make (list (list 1 2) (list 3 4)))` → 2×2 matrix (list of rows).
- `matrix/row` : `(matrix/row (matrix/make (list (list 1 2)(list 3 4))) 0)` → `(1 2)`. Returns a COPY of row r.
- `matrix/col` : `(matrix/col (matrix/make (list (list 1 2)(list 3 4))) 1)` → `(2 4)`. Column c as a list.
- `matrix/zero`: `(matrix/zero 2 3)` → `((0 0 0)(0 0 0))`. r×c all-zeros.
- `matrix/matvec`: `(matrix/matvec (matrix/make (list (list 1 2)(list 3 4))) (list 5 6))` → `(17 39)`. M·v. (1·5+2·6=17, 3·5+4·6=39).

### cortex (5) — chapter 19-cortex.slat — stateful within one process, deterministic per fresh run
- `cortex/record`: `(cortex/record "sky is blue")` → `#t`. Stores a knowledge string.
- `cortex/search`: `(cortex/search "sky" 1)` → list of knowledge records; seeded KB returns
  `(((:kind :knowledge)(:id "sensation/sky")(:axis "sensation")(:key "sky")(:text "")(:synonyms ())(:associations ())))`.
  DETERMINISTIC across runs (verified x2). 2nd arg = top-k.
- `cortex/associate`: `(cortex/associate "a" "b" "likes")` → `#t`. Adds a labeled edge from→to.
- `cortex/lookup`: `(begin (cortex/associate "a" "b" "likes") (cortex/lookup "a" "likes"))` → `("b" "b")`.
  NOTE: returns duplicate "b" (impl adds edge twice or reads both dirs) — document the ACTUAL output honestly, or use a membership check `(member "b" (cortex/lookup "a" "likes"))` → non-#f to avoid asserting the dup.
- `cortex/prune`: `(cortex/prune)` → `0` (count pruned; nothing stale in fresh KB).

### ai (1) — chapter 02-ai.slat
- `ai/embed`: `(ai/embed "hello world")` → deterministic 33-dim vector, first entries
  `(0.087 0.182 0.046 0.23 0.171 0.209 0.082 0.007 0.047 0.121 0.167 0 0 ...)`.
  Deterministic hash embed. For a runnable assertion use `(= (length (ai/embed "hi")) 33)` → #t,
  or `(number? (car (ai/embed "hi")))` → #t. Don't assert exact floats.

### animation (3) — chapter 04-animation.slat
- `animation/budget`: `(animation/budget 16)` → `16` (sets + returns ms budget); `(animation/budget)` reads current.
- `animation/reflow-policy`: `(animation/reflow-policy)` → `auto` (current policy symbol; default auto).
- `animation/set-reflow-policy`: valid policies are **'auto 'stable 'reset** (others silently rejected).
  `(animation/set-reflow-policy (quote stable))` → `stable`. Returns the (new) policy symbol.

### easing (1) — chapter 22-easing.slat
- `easing/apply`: `(easing/apply (quote ease-in) 0.5)` → `0.31535681250589304`. (name, t, opts?) → eased value.
  For clean assertions: `(= (easing/apply (quote linear) 0.5) 0.5)` → check linear; `(easing/apply (quote ease-in) 0)` → 0; `(easing/apply (quote ease-in) 1)` → 1. Endpoints are exact.

### text (2) — chapter 64-text.slat
- `text/overlay`: `(text/overlay)` → `()` (current overlay text lines; empty by default).
- `text/overlay-clear`: `(text/overlay-clear)` → undefined/empty (clears overlay; side-effect verb).

### world (1) — chapter 72-world.slat
- `world/camera-pan-to`: `(world/camera-pan-to 10 20)` → undefined (side-effect: pans camera to x,y). Runs clean.

### sprite (1) — chapter 58-sprite.slat
- `sprite/define`: `(sprite/define (quote hero) (list (list 1 0)(list 0 1)) (list))` → `#t`. (name, cells, petals) → registers a sprite.

### floor (1) — chapter 27-floor.slat
- `floor/mark!`: `(floor/mark! (quote spill))` → `#t`. Marks a floor-problem kind. Side-effect + returns #t.

### transport (1) — chapter 68-transport.slat
- `transport/bpm`: `(transport/bpm)` → `120` (current tempo, default 120). Zero-arg reader.

### entity (4) — chapter 24-entity.slat — object-based (world.js); needs a spawned entity
- `entity/spawn`: `(entity/spawn (quote ball) 10 20)` → entity object (displays `[object Object]`; do NOT
  assert its raw display — feed it to an accessor). (kind x y).
- `entity/id`: `(entity/id (entity/spawn (quote ball) 10 20))` → `1` (first spawn gets id 1). Integer id.
- `entity/hp`: `(entity/hp (entity/spawn (quote ball) 10 20))` → `1` (default hp).
- `entity/team`: reader/setter overload. `(entity/team e)` reads (→ undefined if unset);
  `(entity/team e (quote red))` sets and returns the entity. Honest example:
  `(let ((e (entity/spawn (quote ball) 0 0))) (entity/team e (quote red)) (entity/team e))` → `red`.

## Honest authoring rules (same as alg/topo lanes)
1. Every runnable slot must pass `./bin/motoi run`. Verify with `scratch/verify-slat-code.py`.
2. Never assert a nondeterministic or object-display value. Use accessors / membership / length / endpoints.
3. Side-effect verbs (overlay-clear, camera-pan-to): wrap in a `begin` that returns a checkable value,
   e.g. `(begin (text/overlay-clear) (text/overlay))` → `()`.
4. Standard = R7RS-small + SRFI-1/13/125/27. Use `fold`/`fold-right` (elem-first), never fold-left/foldl/foldr.
5. No philosopher names in reference entries. No names except "Built by Alfred Borden".
6. Match the existing record shape in each target chapter (copy a sibling record as the template).
