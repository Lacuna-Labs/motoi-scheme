---
slug: marionette-1.0-eng
title: Marionette — Engineering
category: engineering
canonical: true
version: 1.0
last-reviewed: 2026-07-11
covers-through: 2026-07-11
owner: Zain (motion + timing verbs) + Marcus (runtime)
codename: marionette
supersedes:
  - all-docs-lane-ac/MARIONETTE-1.0-STAMP.md (FOLDED — §STAMP)
  - all-docs-lane-ac/MARIONETTE-1.0-FINISH-DESIGN.md (FOLDED — §FINISH-DESIGN)
  - all-docs-lane-ac/MARIONETTE-RESEARCH-BRIEF.md (FOLDED — §RESEARCH)
  - all-docs-lane-ac/SAKURA-MARIONETTE-BOOK-PLAN.md (FOLDED — §BOOK-PLAN)
  - all-docs-lane-ac/SRE-VOICE-MARIONETTE-GROUNDTRUTH-2026-07-04.md (FOLDED — §GROUNDTRUTH)
  - all-docs-lane-ac/SRE-VOICE-MARIONETTE-BUILD-BURNDOWN-2026-07-04.md (FOLDED — §BURNDOWN)
  - all-docs-lane-ac/SRE-VOICE-MARIONETTE-GATE-2026-07-04.md (FOLDED — §GATE)
  - all-docs-lane-ac/SRE-VOICE-MARIONETTE-REMAINDER-BUILD-2026-07-04.md (FOLDED — §REMAINDER)
theme: marionette
memory-anchor: project_blossom_control_is_marionette_2026_07_04 (Alfred: entire Blossom section → Marionette; Marionette carries the full gamut of who/moods/personalities/control/sounds/roll-dash/simple→complex-timed-via-counter/seeing-each-other/grid-anticipation-math/code×runtime matrix + reasoning-for-tradeoff)
---

<!-- covers-through: 2026-07-11 -->

# Marionette 1.0 — Engineering

> **Canonical engineering doc #11 of 12** per `docs-consolidation-plan-2026-07-11.md`. NEW canonical doc elevated 2026-07-11 from recovery-lane sources.

## §OVERVIEW — What Marionette is

Marionette is Sakura's control surface: the strings-and-moods system by which she directs sprites, timing, personality expression, and inter-sprite awareness. It carries:

- **Who + moods + personalities** — the 6D personality vector + 24-context decision matrix (from Motion Finale §10, §13).
- **Control** — the strings: how Sakura moves a sprite, holds its hand, times its walk.
- **Sounds** — voice-of-marionette (per SRE-VOICE-MARIONETTE-GROUNDTRUTH).
- **Roll-dash primitives** — the low-level physics loop.
- **Simple → complex timed via counter** — teach the model that timing is a counter, not a wall clock.
- **Seeing each other** — inter-sprite awareness (grid-anticipation-math).
- **Code × runtime matrix + reasoning-for-tradeoff** — the decision surface.

Marionette absorbs the entire Blossom section per Alfred 2026-07-04 reversal: *"that was my mistake"* — Blossom control lives here, not in Miscellany.

## §STAMP — Marionette 1.0 Stamp (folded)

# MARIONETTE 1.0 — THE STAMP

*The training seal. Everything a model must know to emit valid Marionette Scheme, and nothing it must not. Distilled from `MARIONETTE-1.0-FINISH-DESIGN.md` (2026-07-03) and verified line-by-line against the live interpreter on the same day. Where the design doc said "proposed / P0-unbuilt," this stamp records the truth: the binding bone is **built and wired** (`grid.js:926-1019`). Train on THIS, not the design doc's future tense.*

A stamp, not a tutorial: it fixes the vocabulary, the arities, the return alphabet, and the shapes. Corpus pairs are generated against it; a GRPO verifier rejects any emission that violates a rule below.

---

## 0. The one idea (train this first)

**Controlling a flower ⟺ controlling anything.** A flower and a PICO-8 player are one arrangement of cells through one stamper (`_stampLimbs`, `grid.js:635`). Every object is up to four independent facets — only the first is mandatory:

| Facet | Is | Verb(s) | Mandatory? |
|---|---|---|---|
| **SHAPE** | a cluster of `[x y]` cells (+ opt per-cell alpha) | `entity/shape!`, `entity/shape-flower!`, `sprite/rasterize`, `flower/paint` | yes |
| **POSE** | a transform: `spin sx sy dy` | `entity/pose!`, `sway!` | no (identity default) |
| **ENTITY** | a live body: `x y vx vy w h team hp layer mask state data` | `world/spawn` + `entity/*` | no (decor needs none) |
| **BEHAVIOR** | a force/decision each frame | `ai/*` | no (ballistic/static need none) |

The model emits the SAME six binding calls in different arrangements to make grass, a bullet, a blossom, or a playable character. It does not invent a verb per object type.

---

## 1. The canonical render loop (memorize verbatim)

Four steps. This IS the video game, the song, and the chimes — only the world's contents differ.

```scheme
(begin-frame)                  ; clear the grid
(world/step)                   ; integrate + collide + fire timers/tweens → returns frame
(world/render)                 ; stamp every SHAPED entity at its live pos + pose
(paint-grid-4state 'main PAL)  ; flush the g_alive ramp to the surface
```

**Contract — clear every frame.** `world/render`/`_stampLimbs` never writes state 0, so a moving entity would smear if you skipped `begin-frame`. Full-clear each frame is mandatory, not optional (`FINISH-DESIGN §5 [render] P1`).

`world/render` collapses the entire draw pass to ONE call — the single biggest token win in the whole surface. Train the model to reach for it, never a per-entity manual re-stamp.

---

## 2. The six binding verbs — VERIFIED signatures + return alphabet

All six are live in `grid.js`. Every one returns an **honest-null symbol** on failure, never throws.

| Verb | Signature | Returns | Honest-null | Source |
|---|---|---|---|---|
| `entity/shape!` | `(id cells [alphas])` | `#t` | `'entity-not-found` (bad id) · `'bad-arg` (empty cells) | `grid.js:926` |
| `entity/shape-flower!` | `(id N)` | `#t` | `'entity-not-found` | `grid.js:944` |
| `entity/pose!` | `(id spin sx sy)` | `#t` | `'entity-not-found` | `grid.js:953` |
| `world/render` | `([pitch])` | cells lit (int) | — (0 when nothing shaped) | `grid.js:966` |
| `sway!` | `(id period amp)` | `#t` | `'entity-not-found` | `grid.js:993` |
| `world/sway-all!` | `(tag period amp)` | count swayed (int) | — (0 when tag empty) | `grid.js:1006` |

**Defaults that the model may rely on:** `entity/pose!` absent spin→0, sx→1, sy→1. `world/render` absent pitch→1 (world unit = grid cell). `sway!`/`world/sway-all!` absent period→60. `world/sway-all!` phase-offsets each entity by `bornSeq * 0.37` so a field ripples instead of moving as one rigid block — the model never emits that offset by hand.

**Determinism:** `sway!` phase = `amp · dsin(2π · (world/frame)/period)` — `dsin` is fround-shimmed (`detMath.js`), so identical replays give byte-identical grids. This is what makes the motion tape re-renderable.

---

## 3. Three worked shapes (the corpus spine)

### 3a. A field of swaying grass — pure-math pose, no behavior

```scheme
(prefab/define 'grass '((kind grass) (w 2) (h 6)))
(scene/grid 'grass 20 1 8 0 4 40)          ; 20 blades along a row
(define (frame)
  (begin-frame)
  (world/each (lambda (id) (entity/shape! id '((0 0)(0 -1)(0 -2)))))
  (world/sway-all! 'grass 120 0.25)         ; one ripple across the field
  (world/render)
  (paint-grid-4state 'main PAL))
```

### 3b. A controllable player — input → force → render

```scheme
(define p (world/spawn 'player 100 100 6 6))
(entity/solid! p #t) (entity/max-speed! p 4) (entity/friction! p 0.2)
(entity/shape! p '((0 0)(1 0)(0 1)(1 1)(-1 0)(0 -1)))
(define (frame)
  (begin-frame)
  (when (input/down? 'left)  (entity/accel! p -1 0))
  (when (input/down? 'right) (entity/accel! p  1 0))
  (when (input/down? 'up)    (entity/accel! p 0 -1))
  (when (input/down? 'down)  (entity/accel! p 0  1))
  (world/step) (world/render) (paint-grid-4state 'main PAL))
```

### 3c. An autonomous walker — set-and-check-in (Sakura never touches velocity)

```scheme
(define w (world/spawn 'walker 20 20 6 6))
(entity/max-speed! w 3)
(entity/shape! w '((0 0)(1 0)(0 1)(1 1)))
(ai/bb-set! w 'tx 400) (ai/bb-set! w 'ty 300)      ; goal on the blackboard
(define brain
  (ai/bt-selector
    (ai/bt-sequence (ai/bt-condition 'arrived?) (ai/bt-action 'stop))
    (ai/bt-action 'arrive)))
(define (frame)
  (begin-frame)
  (ai/bt-tick brain w)   ; brain pushes force ONLY while not arrived
  (world/step) (world/render) (paint-grid-4state 'main PAL))
```

---

## 4. The set-and-check-in autonomy pattern (train the register)

The idiom that keeps Sakura from puppeteering: **set a goal, attach a behavior, then QUERY state — never write velocity per frame.**

```scheme
; SET (once)
(ai/bb-set! id 'tx gx) (ai/bb-set! id 'ty gy)
(define route (ai/waypoints grid (ai/path grid sx sy tx ty)))   ; route around walls

; RUN (behavior decides — Sakura is not in this loop)
(ai/follow-path id route)     ; or (ai/bt-tick brain id)

; CHECK IN (whenever she wants to know)
(entity/state id)             ; FSM state symbol; none → 'nan
(entity/pos id)               ; [x y] now
(world/nearest id 'enemy)     ; who's near; none → 'nan
(ai/bb-get id 'arrived? #f)   ; did the behavior mark itself done
```

Reactive completion fires on the bus — `(on 'tween/done …)`, `(on 'path/arrived …)` — so she reacts, never polls.

---

## 5. Closed vocabularies (typos become `'bad-arg`, never silent dead keys)

- **Buttons** — the six-symbol set only: `'left 'right 'up 'down 'a 'b` (`marionetteWorld.js:64`). `input/down?` / `input/pressed?` take one of these; anything else → `'bad-arg`.
- **Easings** — the `EASING_NAMES` set only. Reuse it; never pass a free string.
- The model reuses these sets; it never invents a free-string param where a closed vocabulary exists.

---

## 6. The 4B-emittability rules (the GRPO verifier enforces these)

1. **Regular naming.** `namespace/verb`; mutators end `!`; predicates end `?`. Group twin of `foo!` is `foo-all!` with the tag as arg 1 and identical trailing args (`sway!` → `world/sway-all!`).
2. **Predictable arg order.** Always `(verb id …targets… …options…)`: entity id first, target coords next, force/ease/optional last.
3. **Low nesting.** Flat `begin` sequences over deep composition. `world/render` (one call) beats a per-entity draw loop; `(sway! t 180 0.1)` beats `(entity/pose! t (tick/sine (world/frame) …) 1 1)`.
4. **Honest-null returns, never throws.** Every verb returns a symbol on failure (`'entity-not-found` `'bad-arg` `'no-path` `'nan`). The model pattern-matches the symbol and escalates; it never assumes success.
5. **No ambiguous overloads.** One name = one behavior. (`entity/set!` is canonical; the old `entity/get-set!` alias is deprecated — do not emit it.)
6. **Small closed vocabularies over free strings** (see §5).
7. **Composition over new verbs.** Motion is `tick/*` + `dsin`/`dcos`. A new verb must replace a *multi-line* idiom the model would fumble — that is why `world/render` and `world/sway-all!` earn their place and a `bullet/spawn` would not (it is just `world/spawn` + three setters).

---

## 7. What NOT to emit (the negative corpus)

- **`entity/get-set!`** — deprecated alias of `entity/set!`. One name only.
- **Rotated-hitbox assumptions.** `world/render`'s `spin/sx/sy` is cosmetic; a spun sprite still collides as an axis-aligned box. Never write code that assumes a rotated AABB.
- **Per-frame velocity puppeteering** when a behavior exists — use §4, not `entity/set-vel!` every frame.
- **Skipping `begin-frame`** — smears. Full-clear each frame (§1).
- **Free-string buttons/easings** — closed vocabularies only (§5).
- **Out-of-scope vendors / vendor names anywhere** — capability verbs only (CLAUDE.md vendor lock).

---

## 8. Net verb count

Six binding verbs (`entity/shape!`, `entity/shape-flower!`, `world/render`, `entity/pose!`, `sway!`, `world/sway-all!`) sit atop an already-general object model. That is the whole finish: the model was never missing 5000 verbs — it was missing the one bone binding SHAPE to ENTITY. Bind it, and a blossom and a PICO-8 game are the same six calls in a different arrangement.

**Stamp status:** binding bone WIRED (`grid.js:926-1019`, verified 2026-07-03). Reference-doc entries for these verbs land in `SAKURA-SCHEME-1.0-REFERENCE.md` per CLAUDE.md (3 examples each). Golden carts (one per §3 example) belong under `carts/scenes/` as the living regression + training spine.

---

## §FINISH-DESIGN — Marionette 1.0 Finish Design (folded)

# MARIONETTE 1.0 — FINISH DESIGN

*Lead architect design pass, 2026-07-03. Buildable spec + honest gap list + prioritized queue. Not production code.*

Marionette is the live-object system: a deterministic Scheme program that spawns actors, decides their motion, and paints them onto the 8px dot-matrix grid. Five layers already exist and are wired (`scheme/index.js:718-758`): a bus, a world runtime (`marionetteWorld.js`), steering (`marionetteSteer.js`), pathfinding (`marionettePath.js`), a brain (`marionetteBrain.js`), and a scene/big-bang layer (`marionetteScene.js`). The render substrate just gained the two seams that make "render anything" real: `sprite/rasterize` and `flower/paint` (`grid.js:857-905`), both funnelling through `_stampLimbs` (`grid.js:635-678`).

**The one missing bone: nothing binds a rasterized SHAPE to a world ENTITY.** An entity knows where it is (`entity/x`, `entity/y`, `entity/pos` — `marionetteWorld.js:232-234`); a rasterizer knows how to stamp cells at a point. But the render loop must *manually* read each entity's pos and re-issue the stamp. That per-frame glue is the finish work. Everything else is polish and top-layer ergonomics.

---

## 1. The unified object model

An object is up to four independent facets. Only the first is mandatory.

| Facet | What it is | Where it lives today | Verb |
|---|---|---|---|
| **SHAPE** | a cluster of `[x,y]` cells (+ optional per-cell alpha) | Scheme list, or `generateFlower(N)` geometry | `sprite/rasterize`, `flower/paint` |
| **POSE** | transform: `col row spin sx sy dy` | Scheme numbers per frame | args to the render verb |
| **ENTITY** | a live body: `x,y,vx,vy,w,h,team,hp,layer,mask,state,data` | `marionetteWorld._entities` | `world/spawn` + `entity/*` |
| **BEHAVIOR** | force/decision each frame | steer/path/brain registries | `ai/*` |

The claim "control a flower ⟺ control anything" is literally true here: `flower/paint` is `sprite/rasterize` with the cells pre-supplied by `generateFlower` and six limb-pivots for petal rotation. They share `_stampLimbs` byte-for-byte (`grid.js:633`). So every object is *one arrangement of cells through one stamper*:

- **Flower** — SHAPE=`generateFlower(24)`, POSE=`spin`+`petals`, no ENTITY (decorative), BEHAVIOR=none. `(flower/paint 24 col row spin 1 1 dy petals)`.
- **Swaying tree** — SHAPE=a hand-authored trunk+canopy cell list, POSE=`spin = (tick/sine frame 180 0.1)` (a gentle lean), no ENTITY, no BEHAVIOR. Pure math pose.
- **Grass blade** — SHAPE=a 3-cell vertical stalk, POSE=`spin` driven by a shared wind phase, ENTITY optional. A field = one prefab stamped across a lattice.
- **Bullet** — SHAPE=a 1–2 cell dot, POSE=follows ENTITY, ENTITY=`solid` body with `vel`, BEHAVIOR=none (ballistic), `entity/damage!` on collision.
- **PICO-8 player** — SHAPE=a 6×6 cell sprite, POSE=follows ENTITY, ENTITY=`solid` body, BEHAVIOR=`input/*` reads → `entity/accel!`.

### The binding gap — propose `entity/shape!` (+ `world/render`)

Bind a SHAPE to an ENTITY once, then let the world stamp every bound entity at its own pos each frame. This is the finish primitive.

```
(entity/shape! id cells [alphas])       ; store cells on the entity's data map
(entity/shape-flower! id N)             ; store a generateFlower(N) shape
(world/render [spin-key sx-key sy-key]) ; stamp every shaped entity at its pos
```

`entity/shape!` writes the coerced cells into `e.data` under a reserved key (`__shape`), reusing the existing `data` Map so it snapshots/restores for free (mirrors how `ai/bb-*` and `__pathi` already live there — `marionetteBrain.js:80`, `marionettePath.js:255`). `world/render` iterates `sortedEntities()`, and for each with a `__shape` calls the same `_stampLimbs` path with `col=e.x/pitch, row=e.y/pitch` and pose pulled from optional `e.data` keys (`__spin`, `__sx`, `__sy`) — defaulting to identity. **One verb per frame renders the whole world.** `entity/shape-flower!` stores an `{flower:N}` marker so `world/render` routes it through `paintFlowerPose` with the entity's `__petals`/`__spin`.

Rationale for putting the binding on the ENTITY (not a parallel sprite table): the entity already IS the identity+state row (`marionetteWorld.js` header calls itself "the runtime sibling of spriteRegistry — this holds LIVE STATE"). Adding a shape slot keeps one lookup, one snapshot, one lifecycle (a despawn drops the shape automatically). No new store, no new reset hook.

---

## 2. The "render anything" render loop

The canonical per-frame program is four steps:

```scheme
(begin-frame)                 ; clear the grid (existing surface verb)
(world/step)                  ; integrate + collide + fire timers/tweens
(world/render)                ; stamp every shaped entity at its pos
(paint-grid-4state 'main PAL) ; flush the g_alive ramp to the canvas
```

That loop *is* the video game, the song, and the chimes — the difference is only what fills the world and what reads it. Below, three tiny worked examples, each independently verifiable through the real interpreter (`game/step` drives them headless — `marionetteScene.js:325`).

### 2a. A field of swaying grass (pure-math pose, no behavior)

```scheme
(prefab/define 'grass '((kind grass) (w 2) (h 6)))
(scene/grid 'grass 20 1 8 0 4 40)          ; 20 blades along a row
(define (frame)
  (begin-frame)
  (let ((wind (tick/sine (world/frame) 120 0.25)))   ; one shared phase
    (world/each (lambda (id) (entity/shape! id '((0 0)(0 -1)(0 -2))))))
  (world/render 'wind)                       ; each blade leans by `wind`
  (paint-grid-4state 'main PAL))
```

The wind is ONE `tick/sine` shared by every blade — no per-blade state. Substituting `(tick/pattern (world/frame) '(0 0.2 0 -0.2))` turns the same field into a stepped 4-beat sway: **arrangement, not new verbs.**

### 2b. A controllable player (input → force → render)

```scheme
(define p (world/spawn 'player 100 100 6 6))
(entity/solid! p #t) (entity/max-speed! p 4) (entity/friction! p 0.2)
(entity/shape! p '((0 0)(1 0)(0 1)(1 1)(-1 0)(0 -1)))   ; a little 6-cell body
(define (frame)
  (begin-frame)
  (when (input/down? 'left)  (entity/accel! p -1 0))
  (when (input/down? 'right) (entity/accel! p  1 0))
  (when (input/down? 'up)    (entity/accel! p 0 -1))
  (when (input/down? 'down)  (entity/accel! p 0  1))
  (world/step)
  (world/render)
  (paint-grid-4state 'main PAL))
```

### 2c. An autonomous walker (set-and-check-in)

```scheme
(define w (world/spawn 'walker 20 20 6 6))
(entity/max-speed! w 3)
(entity/shape! w '((0 0)(1 0)(0 1)(1 1)))
(ai/bb-set! w 'tx 400) (ai/bb-set! w 'ty 300)         ; goal on the blackboard
(define brain
  (ai/bt-selector
    (ai/bt-sequence (ai/bt-condition 'arrived?) (ai/bt-action 'stop))
    (ai/bt-action 'arrive)))
(define (frame)
  (begin-frame)
  (ai/bt-tick brain w)     ; brain pushes a force ONLY while not arrived
  (world/step) (world/render) (paint-grid-4state 'main PAL))
```

Sakura sets the goal once, then the tree decides every frame whether to steer or rest. She never touches velocity.

---

## 3. The ergonomic, 4B-emittable top layer

The layers below are already regular. The finish work is a *small* sugar cap so a 4B model emits the common shapes in the fewest tokens. Every verb below earns its place by replacing a multi-line idiom that a 4B would otherwise botch.

| Verb (arity) | One-line | Example | Why (vs plain Scheme) |
|---|---|---|---|
| `entity/shape!` (id cells [alphas]) | bind a cell cluster to an entity | `(entity/shape! p body-cells)` | **the binding gap.** Without it, render is a per-frame manual re-stamp — high token, easy to desync. |
| `entity/shape-flower!` (id N) | bind real blossom geometry | `(entity/shape-flower! f 24)` | flower ⊂ object model, one token instead of pulling `generateFlower` cells by hand. |
| `world/render` (\[spin-key\]) | stamp all shaped entities | `(world/render)` | collapses the whole draw pass to ONE call. The single biggest token win. |
| `entity/pose!` (id spin sx sy) | set an entity's render pose | `(entity/pose! t (tick/sine f 180 0.1) 1 1)` | one call vs three `entity/set!`; regular arg order. |
| `sway!` (id period amp) | shorthand for a sine lean | `(sway! t 180 0.1)` | "make a tree sway" in the fewest tokens (see below). Desugars to `entity/pose!` + `tick/sine`. |
| `world/sway-all!` (tag period amp) | sway a whole tagged group | `(world/sway-all! 'tree 180 0.1)` | "make MULTIPLE trees sway" — one call, no `group/each` lambda. |

**"Make a tree sway"** — fewest, most regular tokens:

```scheme
(sway! t 180 0.1)
```

**"Make multiple trees sway"** — the group form is symmetric, same three trailing args:

```scheme
(world/sway-all! 'tree 180 0.1)
```

`world/sway-all!` internally does `group/each` + per-entity phase offset by `bornSeq` (so the trees don't sway in lockstep) — a detail the 4B never has to emit. The regularity rule: **a single-actor verb `foo!` has a group twin `foo-all!` taking a tag as arg 1 and the identical trailing args.** A 4B that learns `sway!` gets `world/sway-all!` almost for free.

Everything else stays plain Scheme composition. Pose math is `tick/*` (`tickMath.js:229-237`) + `dsin/dcos` (`detMath.js:29-30`) — no new motion verbs. A field is `scene/grid` (`marionetteScene.js:176`). A level is `scene/load` from a quoted list. The 4B composes these; it does not need bespoke verbs for each.

---

## 4. The autonomous "set-and-check-in" pattern

The idiom Sakura uses so she doesn't puppeteer: **set a goal into the blackboard, attach a behavior, then query state — never write velocity per frame.**

```scheme
; SET (once)
(ai/bb-set! id 'tx gx) (ai/bb-set! id 'ty gy)   ; marionetteBrain.js:83
; or route around walls:
(define route (ai/waypoints grid (ai/path grid sx sy tx ty)))  ; path.js:290,195

; RUN (behavior decides each frame — Sakura is not in this loop)
(ai/follow-path id route)          ; marionettePath.js:256
; or a brain:
(ai/bt-tick tree id)               ; marionetteBrain.js:177

; CHECK IN (whenever Sakura wants to know)
(entity/state id)                  ; FSM state symbol — marionetteWorld.js:236
(entity/pos id)                    ; where is it now
(world/nearest id 'enemy)          ; who's near it — marionetteWorld.js:289
(ai/bb-get id 'arrived? #f)        ; did the behavior mark itself done
```

The check-in surface is already complete: `entity/state`, `entity/pos`, `entity/distance`, `world/nearest`, `world/count`, `group/count`, `ai/bb-get`, and bus events (`entity/state-change`, `tween/done`, `collision` — `marionetteWorld.js:537,751,770`). Sakura's "she knows where they are, she checks in" is `(on 'tween/done …)` + `world/nearest`, not a per-frame poll.

**Missing glue:** a completion signal for `ai/follow-path`/`ai/follow-flow`. They *return* `'arrived` (`marionettePath.js:264`) but don't `emit` it onto the bus, so Sakura must poll instead of react. Propose: on the arriving frame, `emit('path/arrived', String(id), {id})` so `(on 'path/arrived …)` closes the check-in loop reactively. Same one-line fix pattern the world already uses for `tween/done`.

---

## 5. Honest gap list

- **[entity-bind]** No shape↔entity binding. `world/render` and `entity/shape!`/`entity/shape-flower!`/`entity/pose!` do not exist. This is *the* finish primitive. New code in `marionetteWorld.js` (data-map slot) + a render fan-out; cells coerced via the existing `_coerceCells` (`grid.js:701`). **P0.**
- **[render]** `_stampLimbs` writes directly to `g_alive` with no world→grid coordinate mapping. `world/render` must decide pitch (world px → grid cell). Today carts pass grid coords straight to `sprite/rasterize`; entities live in world px. Needs an explicit `world/render` pitch arg or a `world/pitch!` config. **P0.**
- **[render]** `_stampLimbs` never writes state 0, so a moving entity leaves its previous cells lit until `begin-frame` clears — fine for the full-clear loop (§2) but a partial-redraw optimization would smear. Document the "clear every frame" contract. **P1.**
- **[top-layer]** `sway!` / `world/sway-all!` sugar unbuilt. Pure desugar over `entity/pose!` + `tick/sine`. **P1.**
- **[autonomy]** `ai/follow-path` and `ai/follow-flow` return `'arrived` but don't `emit` it (`marionettePath.js:264,389`). No reactive completion. **P1.**
- **[4B-emit]** Alias drift: `entity/set!` and `entity/get-set!` are the SAME function (`marionetteWorld.js:941-942`). Two names for one verb is exactly the ambiguous overload a 4B mis-selects. Deprecate `entity/get-set!`. **P1.**
- **[4B-emit]** `entity/parent!` detaches on `'()` but the summary says "child '()" (`marionetteWorld.js:954`) — a 4B reading the null-arg convention as an empty list vs symbol is a coin-flip. Standardize the honest-null/detach arg. **P2.**
- **[collision]** `world/render`'s pose (`spin/sx/sy`) is cosmetic and does NOT rotate the AABB — a spun sprite still collides as an axis-aligned box. Correct for arcade feel; must be *documented* so nobody assumes rotated hitboxes. **P2.**
- **[render]** No emoji-glyph→cells bridge into `sprite/rasterize`. `emojiTreeVerbs.js` + `paint/primitives/emoji.js` already rasterize glyphs; a `sprite/from-emoji` that returns a cell list would make "lift a shape from an emoji" one call (owner's stated want). **P2.**
- **[docs]** None of `world/render`, `sprite/rasterize`, `flower/paint`, or the ai/* layers appear in `SAKURA-SCHEME-1.0-REFERENCE.md` yet (per CLAUDE.md the reference must carry every verb with 3 examples). **P1.**
- **[4B-emit]** `flower` namespace is not in `FROZEN_NAMESPACES` (`VerbRegistry.js:30`). **Verified non-issue for dispatch:** core verbs resolve by name via `env.get` (`interp.js:283`); `env.define` registers perm metadata unconditionally (`interp.js:112-132`). The whitelist gates only card-manifest *tier-permission* dispatch, not `(flower/paint …)` calls. Still, add `flower` + `sprite` (as render ns) to the list for catalog/introspection completeness and to silence the perm-audit path. **P2.**

---

## 6. Prioritized build queue

Ordered so each step is independently verifiable through `game/step` + `world/hash` + `grid-live-count`.

**P0 — the binding bone (makes "render anything" real):**
1. `entity/shape! (id cells [alphas])` — coerce via `_coerceCells`, store on `e.data.__shape`. Verify: spawn, shape, `entity/get id '__shape` round-trips through `world/snapshot`.
2. `entity/shape-flower! (id N)` — store `{flower:N}` marker.
3. `world/render ([pitch])` — iterate `sortedEntities()`, route each `__shape` through `_stampLimbs` (or `paintFlowerPose`) at `e.x/pitch, e.y/pitch` with pose from `__spin/__sx/__sy`. Verify: spawn two shaped entities, `world/render`, assert `grid-live-count` > 0 and stable across identical replays (`world/hash`).

**P1 — ergonomics + reactive autonomy:**
4. `entity/pose! (id spin sx sy)` — three data-map writes.
5. `sway!` + `world/sway-all!` — desugar over `entity/pose!` + `tick/sine`, `bornSeq`-offset phase.
6. `emit('path/arrived' …)` in `aiFollowPath`/`aiFollowFlow` on the arriving frame.
7. Deprecate `entity/get-set!` alias (keep one canonical `entity/set!`).
8. Reference-doc entries (bulk-generatable via the Claude API): `world/render`, `entity/shape*`, `entity/pose!`, `sprite/rasterize`, `flower/paint`, the `ai/*` catalog — 3 examples each per CLAUDE.md.

**P2 — completeness + polish:**
9. `sprite/from-emoji (glyph)` → cell list, bridging `emojiTreeVerbs.js`.
10. Add `flower`, `sprite` to `FROZEN_NAMESPACES`.
11. Standardize `entity/parent!` detach arg; document AABB-not-rotated collision contract.
12. Three golden carts (one per §2 example) under `carts/scenes/` as the living regression + 4B training corpus.

---

## 7. 4B-emittability audit

Rules the whole surface must obey so a 4B Qwen emits valid Marionette reliably:

1. **Regular verb naming.** `namespace/verb`, mutators end `!`, predicates end `?`. Group twin of `foo!` is `foo-all!` with a tag as arg 1. *Violation:* `entity/get-set!` ≡ `entity/set!` (dup). `input/pressed?` vs `input/down?` is fine (distinct meanings).
2. **Predictable arg order.** Always `(verb id …targets… …options…)`. Entity id first, target coords next, force/ease/optional last. The whole `ai/*` layer already obeys this (`marionetteSteer.js:116`). Keep `world/render` and the shape verbs in the same mold.
3. **Low nesting depth.** Prefer flat `begin` sequences over deep composition. `world/render` collapsing the draw pass to one call is the flagship low-nest win. `sway!` beats a nested `(entity/pose! id (tick/sine (world/frame) …) 1 1)`.
4. **Honest-null returns, never throws.** Every existing verb returns a symbol (`'bad-arg`, `'entity-not-found`, `'no-path`, `'nan`) on failure — the 4B pattern-matches the symbol and escalates. New verbs MUST follow (`entity/shape!` on unknown id → `'entity-not-found`; empty cells → `'bad-arg`).
5. **No ambiguous overloads.** One name = one behavior. *Violation to fix:* the `entity/set!`/`entity/get-set!` alias. *Acceptable polymorphism:* `grid-cols` with/without a surface arg (`grid.js:916`) — distinct, documented.
6. **Small closed vocabularies over free strings.** Buttons are the six-symbol `BUTTONS` set (`marionetteWorld.js:64`), easings are `EASING_NAMES`. A typo is a caught `'bad-arg`, not a silent dead key. New verbs reuse these sets, never invent free-string params.
7. **Prefer composition to new verbs.** Motion = `tick/*` + `dsin`. A new verb must replace a *multi-line* idiom the 4B would fumble (that's why `world/render` and `world/sway-all!` earn their place, but a `bullet/spawn` would not — it's just `world/spawn` + three setters).

Net new verbs proposed: **six** (`entity/shape!`, `entity/shape-flower!`, `world/render`, `entity/pose!`, `sway!`, `world/sway-all!`) plus one optional bridge (`sprite/from-emoji`) and one bus emit. Far under the "5000 verbs" ceiling — because the object model was already general; it only lacked the bone connecting SHAPE to ENTITY. Bind that, and controlling a flower and building a PICO-8 game become the same six calls in a different arrangement.

---

## §RESEARCH — Marionette Research Brief (folded)

# MARIONETTE RESEARCH BRIEF
**Author:** Zane (external-research pass) · **Date:** 2026-07-03
**Goal:** Make a Scheme-authored fantasy console + live-desktop "better than PICO-8," where the runtime game-author is a **4B Qwen** and Sakura (on-device LLM) co-plays via autonomous, directable actors.

**Governing constraint on every finding:** *Can a 4B emit this correctly, first try, low-token, no ambiguity?* Small, regular, low-branching wins over expressive.

---

## 1. Fantasy console API surfaces — what the core actually is

| Console | Loop | Sprite / draw | Input | Collision | Sound | Core verb count |
|---|---|---|---|---|---|---|
| **PICO-8** | `_init` / `_update`(30fps) / `_update60`(60fps) / `_draw` | `spr(id,x,y,[w,h,flipx,flipy])`, `map(cx,cy,sx,sy,cw,ch,[layer])`, `pset/pget`, `circ/rect/line`, `pal` | `btn(i,[p])`, `btnp(i,[p])` (autorepeat: 15f delay, 4f rate) | **none built in** — you write `fget`/`mget` flag checks yourself | `sfx(n)`, `music(n)` | ~30 you touch daily |
| **TIC-80** | single `TIC()` @60fps (+ optional `BOOT`, `OVR`, `BDR`) | `spr`, `map`, `cls`, `pix`, `circ`, `rect` | `btn`, `btnp` | none built in; `mget`/`mset` for tile lookup | `sfx`, `music` | ~30 |
| **WASM-4** | export `update()` @60fps | `blit(sprite,x,y,w,h,flags)`, `rect`, `text` | 4 gamepads = **1 byte each**, memory-mapped at fixed addresses | none — raw framebuffer | `tone(freq,dur,vol,flags)` | ~8 |
| **PuzzleScript** | **no loop** — declarative tick: rules fire on each move | tiles + legend, no draw calls | movement only (arrows/action) | **the rules ARE collision** (`[> Player | Crate] -> [> Player | > Crate]`) | `sfx` events bound to rules | ~5 sections |
| **Bitsy** | menu-driven, no code loop | tile/avatar/sprite objects | movement only | walls = tile property | note-editor | ~0 (no DSL) |

**Sources:** [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html), [PICO-8 API cheatsheet](https://pico-8.github.io/pico8-api/), [TIC-80 API wiki](https://github.com/nesbox/TIC-80/wiki/API), [WASM-4 memory layout](https://wasm4.org/docs/reference/memory/) + [wasm4.h](https://github.com/aduros/wasm4/blob/main/cli/assets/templates/c/src/wasm4.h), [PuzzleScript rules101](https://www.puzzlescript.net/Documentation/rules101.html), [ScriptButler empirical study of PuzzleScript](https://dl.acm.org/doi/fullHtml/10.1145/3582437.3582467).

**Smallest viable loop:**
- PICO-8: `function _draw() cls() spr(1,x,y) end` + `_update` reading `btn`. ~4 lines.
- WASM-4: one `update()` exporting `blit`. ~3 lines.
- PuzzleScript: one rule + a legend. Zero imperative code.

**Why PICO-8 is beloved & learnable:** hard limits (128×128, 16 colors, 30fps) remove decisions; the loop is *four named callbacks*; every verb is a short lowercase word taking positional numeric args; the integrated editor closes the fetch→see loop. **Where each is awkward:** PICO-8/TIC-80 give you **no collision or entity model** — every game re-implements AABB + tile flags by hand (repetitive, error-prone). WASM-4's memory-mapped I/O is powerful but hostile to a language model (magic addresses). PuzzleScript is *maximally* LM-friendly (pure pattern rewrite) but only expresses grid-logic puzzles. Bitsy has no DSL at all → nothing for a 4B to emit.

**→ For our 4B DSL:** Copy PICO-8's *named-callback loop* and *short-positional-verb* shape. But since we already ship an entity/collision/pathfinding world layer, **do NOT make the 4B hand-roll collision** (PICO-8's worst tax) — expose it as declarative properties on entities (PuzzleScript's lesson: let the engine own the rules). Aim for a ~20–30 verb surface, all lowercase, all regular arity.

---

## 2. A DSL a small LM can emit reliably

**Finding:** Grammar-Constrained Decoding (GCD) masks any token that can't continue a valid parse (logits → −∞), *guaranteeing* syntactic validity without fine-tuning. Modern engines (XGrammar) make this near-zero-overhead at runtime. Papers note LLMs "still struggle to reliably generate complex output structures when not fine-tuned" — i.e., **the smaller/simpler the grammar, the higher the first-try success**, and GCD closes the remaining gap.
**Sources:** [Grammar-Constrained Decoding for Structured NLP (arXiv 2305.13971)](https://arxiv.org/abs/2305.13971), [XGrammar-2 (arXiv 2601.04426)](https://arxiv.org/pdf/2601.04426), [Draft-Conditioned Constrained Decoding (arXiv 2603.03305)](https://arxiv.org/pdf/2603.03305), [Memelang axial grammar for LLM queries (arXiv 2512.17967)](https://arxiv.org/pdf/2512.17967).

**Key second finding (Memelang):** a deliberately *axial, low-branching* grammar was designed specifically so LLMs emit it reliably — the design lever is **reducing the branching factor at every position**, not adding sugar. DCCD's split ("plan semantically first, then constrain structure") mirrors how we'd want Sakura to *decide intent* then emit *constrained Scheme*.

**Concrete design rules that fall out (all directly usable):**
1. **Ship an EBNF grammar and decode against it** (GCD/XGrammar). Non-negotiable — turns "usually valid" into "always valid."
2. **One name, one meaning.** No overloaded verbs (`spr` doing 3 things by arity is a 4B trap). Distinct verbs beat optional-arg polymorphism.
3. **Fixed, regular arity.** Prefer `(move e dx dy)` over variadic tails; optional args explode the branching factor.
4. **Small vocabulary, uniform casing.** Lowercase, kebab or single-word verbs; a closed enum for constants (directions, layers) so the grammar can *list* the valid next tokens.
5. **Flat > nested where possible.** Deep nesting costs tokens and raises paren-matching error rate; Scheme's uniform `(verb args)` is already ideal *if* nesting stays shallow.
6. **Declarative properties over imperative wiring** (see PuzzleScript): `(:collides wall)` not a hand-written collision loop.
7. **Token efficiency = keep the common path short.** The 90% game (spawn, move-toward, on-hit) should be 1-line forms.

**→ For our DSL:** Sakura Scheme already gives us homoiconic `(verb args)`. Win comes from (a) writing an **EBNF + running XGrammar-style constrained decode** on the 4B, (b) a **closed, ~25-verb vocabulary with fixed arity and enum constants**, (c) banning arity-overloading. This is the single highest-leverage item in the brief.

---

## 3. Game AI for autonomous, directable enemies

### 3a. Movement — Reynolds steering (the whole minimal kit)
Vehicle model: `mass, position, velocity, max_force, max_speed`; integrate forward-Euler:
```
steering = truncate(steering, max_force)
velocity = truncate(velocity + steering/mass, max_speed)
position = position + velocity
```
Behaviors, each just a `desired_velocity` then `steering = desired - velocity`:
- **seek:** `desired = normalize(target-pos)*max_speed`
- **flee:** `desired = normalize(pos-target)*max_speed`
- **arrive:** ramp speed down inside `slowing_distance`
- **pursue:** seek `target_pos + target_vel*T`
- **wander:** small constrained random walk
- **flocking:** separation `Σ (offset / r²)` + alignment `mean(neighbor vel)` + cohesion `seek(mean neighbor pos)`

**Source:** [Reynolds, "Steering Behaviors For Autonomous Characters" GDC99](https://www.red3d.com/cwr/steer/gdc99/) (+ [Nature of Code ch.5](https://natureofcode.com/autonomous-agents/)). Note: **flow-field pathfinding composes cleanly with steering** (one shared velocity vector) and scales to many actors sharing one field — ideal for hordes.

**→** These six behaviors + A* (we have it) cover ~all enemy motion. Each reduces to *one target vector*, so the DSL verb is simply `(seek e target)` / `(arrive e target)` — trivially 4B-emittable.

### 3b. Decision — director sets a goal, checks in (not per-frame)
Three canonical planners, ranked by 4B/authoring friendliness:
- **Utility AI:** score each candidate action, pick the max. *Fastest to author, most tunable* (a single scalar per action = the knob Sakura turns). Reported ~4h to implement vs 8h BT vs 12h GOAP.
- **Behavior Trees:** sequence/selector/decorator nodes — readable, modular, but *static* and verbose (bad token cost for a 4B).
- **GOAP:** chains actions to satisfy a goal ("flank the player") — most emergent, most expensive, hardest to make deterministic.
**Source:** [GOBT / JMIS synergy paper](https://www.jmis.org/archive/view_article_pubreader?pid=jmis-10-4-321), [Utility vs BT vs GOAP comparison](https://tonogameconsultants.com/game-ai-planning/), [Nez framework AI docs](https://anshuman-kumar.gitbook.io/nez-doc/ai-fsm-behavior-tree-goap-utility-ai).

**→** Adopt a **goal + utility** model, not per-frame puppeteering. Sakura issues `(actor/goal boss :approach player)` and the deterministic world runs steering+A* toward it every frame; Sakura *checks in* on a slow cadence and re-scores. This is exactly the "set an actor off and check in" primitive she needs — and utility scores are the difficulty knob.

### 3c. Director AI — the L4D pattern (canonical reference)
Valve's Director does **"procedural narrative"**: it tracks a per-survivor **Intensity** value that rises with damage/threat and decays over time, and runs an **ebb-and-flow cycle**:
- **Build Up** — normal spawns until intensity crosses a threshold
- **Peak / Sustain Peak** — at max intensity, *stop spawning* (let the fight resolve)
- **Relax / Fade** — quiet window (~30s ballpark) so players recover before the next build
It also places items/specials by current stress and reroutes paths (linear when struggling, complex when steamrolling).
**Sources:** [L4D Wiki: The Director](https://left4dead.fandom.com/wiki/The_Director), [AI and Games #07 breakdown](https://www.youtube.com/watch?v=WbHMxo11HcU), [Game Developer: Dynamic Difficulty](https://www.gamedeveloper.com/design/game-changers-dynamic-difficulty). *(Caveat: exact intensity numbers are not officially published — treat thresholds/timers as design parameters, confirmed pattern is the Build/Peak/Relax loop.)*

**→** Give Sakura a **per-player intensity scalar** (rises on damage/near-miss, decays on time) and a **Build→Peak→Relax state machine** as first-class DSL. She spawns/eases via intensity, and — crucially — **Peak means BACK OFF**. This is the mechanical core of "make bosses fun, laugh along": pacing, not just numbers.

---

## 4. The co-play / companion feel (short, grounded)
Research on companion/assistant AI converges on: adapt to *keep it fun*, not to win. RL-designed co-op assistants optimize for a "satisfying" partner, not optimal play; companion frameworks explicitly target **complementary** behavior. Practical levers designers actually tune: encounter pacing, resource generosity, hint timing, optional challenge routes — companion as **"invisible pacing editor,"** not a second gun.
**Sources:** [RL for a satisfying co-op AI assistant (arXiv 2105.03414)](https://arxiv.org/pdf/2105.03414), [Framework for Complementary Companion Behavior (arXiv 1808.09079)](https://arxiv.org/pdf/1808.09079), [Adaptive game difficulty overview](https://www.mimicgaming.com/post/adaptive-game-difficulty-player-challenge).

**→** Sakura's win condition is the *player's* fun, expressed as a target intensity band she steers toward (nudge up when bored, ease off after a loss). Her "laughing along" = commentary hooks fired on Director state transitions (Peak reached, clutch survival), not on raw frame events.

---

## 5. Rendering swaying/natural motion cheaply
Standard, cheap technique = **sine displacement + per-instance phase offset**, optionally modulated by scrolling **value/Perlin noise** for gusts:
```
sway_x = amplitude * sin(time*freq + phase)      // phase = f(worldX, worldY) so blades differ
gust   = noise(worldPos*scale + windDir*time)    // low-freq large-scale gust envelope
offset = sway_x * mask                            // mask = 0 at root, 1 at tip (top of blade only)
```
Key tricks: **phase offset from world position** so everything doesn't sway in lockstep; **root-anchored mask** so only tips move; **scrolling noise** for organic gusts vs pure sine's mechanical feel.
**Sources:** [GPU Gems ch.7: Rendering Countless Blades of Waving Grass](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-7-rendering-countless-blades-waving-grass), [Waving Grass Shader (Linden Reid)](https://lindenreidblog.com/2018/01/07/waving-grass-shader-in-unity/), [GameDev.net swaying grass formula](https://www.gamedev.net/forums/topic/686315-good-formula-for-swaying-grass/).

**→** On an 8px dot grid, per-cell sway = one `sin(t*f + phase(cell))` term, phase seeded by cell coords; add a slow shared noise gust. Costs one sin per animated cell, deterministic, and needs no DSL surface — it's a render property (`:sway`) the 4B just flags on, matching our existing `flower/paint` parametric stamp.

---

## Top 10 design takeaways
1. **Steal PICO-8's shape, not its gaps.** Four named callbacks + short positional verbs = the learnable core. But *don't* make the 4B hand-roll collision — that's PICO-8's biggest tax; we already own an entity/collision layer.
2. **Ship an EBNF grammar and constrained-decode the 4B against it** (XGrammar-style). This converts "usually valid Scheme" into "always valid" — highest-leverage single change.
3. **One name, one meaning; fixed arity; no overloading.** Arity-polymorphic verbs (PICO-8 `spr`) are a small-LM trap. Distinct verbs + closed enum constants beat optional args.
4. **Declarative properties over imperative wiring** (PuzzleScript's lesson): `(:collides wall)`, `(:sway)` — the engine owns the rules, the 4B just tags entities.
5. **Keep the 90% path one-line.** Spawn / move-toward / on-hit must each be a single short form; token cost and paren-depth drive error rate.
6. **Movement = 6 Reynolds behaviors, each a single target vector.** `(seek e t)`, `(arrive e t)`, `(flee e t)`, pursue, wander, flock. Trivially emittable; A* + flow fields already in place for hordes.
7. **Direct actors by GOAL + UTILITY, never per-frame.** `(actor/goal boss :approach player)`; deterministic world runs it; Sakura re-scores on a slow check-in cadence. Utility scores are the difficulty dial.
8. **Adopt L4D's Build→Peak→Relax intensity loop as first-class DSL.** Track a per-player intensity scalar; at Peak, *stop spawning*. Pacing is the fun, not raw counts.
9. **Sakura optimizes for the player's fun, expressed as a target intensity band** — nudge up when bored, ease off after a loss; fire "laughing along" commentary on Director state transitions, not frame events.
10. **Natural motion is free:** `sin(t*f + phase(worldPos))` + a slow scrolling noise gust + tip-only mask. Expose as a render flag (`:sway`), zero added DSL branching.

---

## §BOOK-PLAN — Sakura Marionette Book Plan (folded)

# The Sakura Book of Marionette — Plan

*Authored 2026-07-04 by Lacuna Engineering. Task #652. TRAINING-CORPUS PREP
ONLY — no model training fires from this plan.*

The Book of Marionette is the seat for the **Blossom** knowledge/control
section (architect ruling 2026-07-04). The 16 canvas Blossom sprites are the
flowers Sakura — the corner flower, herself — directs. There is no Book of
Blossoms; canon stays exactly 16 books and Marionette holds this material.

The book has two clusters:

- **ch01–ch16 — the tape/camera/sound/recording spine (ALREADY AUTHORED).**
  The marionette as a filmstrip: spawn a world, place an entity, step it,
  point a camera, lay a tone on the tape, record positions, encode a GIF.
  Do NOT re-author these.
- **ch17–ch32 — the BLOSSOM cluster (THIS PLAN).** Who the 16 are, their
  moods + how to deal with each, how to control them in place, the sounds
  they make, roll/dash locomotion, simple→complex timed motion on the
  counter, seeing each other, carrying cards in sync, where they live in
  code, the grid-anticipation math, and the complexity-orthogonality matrix
  with the reasoning for every tradeoff.

Both clusters live under `docs/marionette-book/chNN-<slug>.md`. Output is
Markdown (non-cart) → never touches `index.json` → safe under the
single-writer HOLD. The driver runs `SKIP_REGEN=1`.

---

## Gap analysis — what is WIRED vs what must be COMPOSED / flagged

The corpus uses only real registered verbs, or clearly-flagged honest-null
(`*[needs: ...]*` + `<!-- BUILD -->`). Grounding:

### WIRED — safe to use directly

| Surface | Verbs (registered) | Source |
|---|---|---|
| World + step | `world/spawn` `world/step` `world/frame` `world/count` `world/each` `world/find` `world/nearest` `world/after` `world/reset!` `world/snapshot` `world/restore!` `world/hash` `world/collisions` | `marionetteWorld.js:1217+` |
| Entity state + motion | `entity/pos` `entity/x` `entity/y` `entity/vel` `entity/set-pos!` `entity/set-vel!` `entity/move!` `entity/glide!` `entity/goto!` `entity/accel!` `entity/max-speed!` `entity/friction!` `entity/sprite!` `entity/state` `entity/set!` `entity/get` `entity/distance` `entity/overlaps?` `entity/collisions` `entity/despawn!` `entity/alive?` `entity/tag!` `entity/untag!` | `marionetteWorld.js:1231+` |
| Physics / weight (parameter regime) | `world/gravity!` `world/wind!` `world/attract!` `world/repel!` `world/impulse!` `world/floor!` `world/link!` `world/link-rest!` `world/solve!` `entity/mass!` `entity/drag!` `entity/bounce!` `entity/pin!` `entity/gravity-scale!` | `marionetteWorld.js:1273+` |
| Groups | `group/each` `group/find` `group/count` (tag-membership iteration) | `marionetteWorld.js:1290+` |
| Camera | `world/camera` `world/camera-follow!` `world/camera-bounds!` `world/camera-shake!` `world/camera-snap!` | `marionetteWorld.js:1295+` |
| Steering (the loco engine) | `ai/seek` `ai/flee` `ai/arrive` `ai/wander` `ai/pursue` `ai/evade` `ai/separate` `ai/align` `ai/cohere` `ai/flock` `ai/max-force!` | `marionetteSteer.js` |
| Pathing / grid | `ai/grid` `ai/wall!` `ai/clear!` `ai/passable?` `ai/path` `ai/waypoints` `ai/follow-path` `ai/flow-field` `ai/flow-at` `ai/follow-flow` | `marionettePath.js` |
| Brain | `ai/bb-*` `ai/bt-*` `ai/utility` `ai/decide` `ai/policy` `ai/policy-act` | `marionetteBrain.js` |
| Scene / loop | `prefab/define` `prefab/spawn` `scene/spawn-many` `scene/grid` `scene/load` `scene/clear` `on-tick` `to-draw` `big-bang` `game/step` `game/frame` `game/running?` `game/state` | `marionetteScene.js` |
| Tape (positions, not pixels) | `world/tape-record!` `world/tape-stop!` `world/tape-recording?` `world/tape-frames` `world/tape-hash` `world/tape-lcamera` `world/tape-clear!` `world/tape-save` `world/tape-audio` `world/tape-replay` | `marionetteTape.js` |
| Audio / sound (DONE) | `sprite/footstep` `sprite/sfx` `audio/play` `audio/stop` `audio/mix` `audio/volume` `audio/applause` `audio/duck` | `marionetteAudio.js` |
| Synth kit | `synth/orch` `synth/orchestra` `synth/chord` `synth/808` `synth/kit` `synth/sp1200` `synth/play` `synth/load-score` `synth/onset-tap` | `audio/synth/index.js` |
| Voice | `voice/say` `voice/tone` `voice/listen` `voice/state` (+ backchannel/bridge/dictate) | `marionetteVoice.js` |
| The 16 as identity | `(sprite <hue> ...)` atoms: `go-to visit follow wander circle line-up gather scatter slip-under perch pick-up carry set-down hand-to nudge stack wear flash point-at beckon bow wait-for watch rest recruit turn size`; combinators `in-order together repeat-until when with-pace as-crowd` | `spriteBehaviors.js:92`, `spriteVerbs.js` |
| Sprite registry | `define-sprite` `mod-sprite` (register kind/hue/traits/footstep/sfx) | `spriteRegistry.js:263,281` |
| The roster (WHERE they live) | `ROSTER` / `ROSTER_HUES` / `rosterEntryFor` / `rosterByScheme` | `sprites/spriteRoster.js` |

The 16 hues (bare ids used inside verbs): `blossom rose coral amber butter
mint fern sky ocean lilac grape cedar gray slate black white` (the ghost is
`white` in the palette; operator-facing display name "Pearl Blossom" per
`spriteRoster.js` — corpus addresses it as the bare hue id).

### NOT wired as distinct verbs — COMPOSE + flag honestly

| Gamut point | Reality | How the corpus handles it |
|---|---|---|
| **"Seeing each other" (#585)** | There is NO `sprite/see?` / `can-see?` / line-of-sight verb. Sprite-to-sprite sensing is COMPOSED from `entity/distance`, `world/nearest`, `entity/pos`, `entity/x/y`, and a user-defined `in-line-of-sight?` predicate (exactly the pattern the games-book uses). | Author the sensing predicates FROM the wired primitives; where a first-class vision verb would help, flag `*[needs: sprite/see? vision verb]*` + `<!-- BUILD -->`. Never invent `sprite/see?`. |
| **The counter / timed motion** | There is NO `counter/*` namespace. The counter IS the world-frame integer: `(world/frame w)` and `(game/frame)`. `world/after` fires a bus event N frames out; timers/tweens are frame-counted. | Teach the counter AS `world/frame`. "Come back to it via the counter" = re-derive position deterministically from the frame integer with `dsin/dcos` + arithmetic, or schedule with `world/after`. |
| **sway / spin / jitter (in place)** | NOT sprite atoms. Achieved via world oscillation: `entity/set-pos!` driven by `dsin/dcos(world/frame · ω)`, `entity/accel!`, small `entity/glide!` loops. In-place = never leave the perch (bounded oscillation around an anchor). | Author sway/spin/jitter as bounded oscillation programs on the counter. `(sprite ...)` atoms `turn`/`circle`/`wander` cover some; flag any missing first-class `sprite/sway` as `*[needs: ...]*`. |
| **roll / dash** | NOT sprite atoms. `dash` = a short high-velocity `entity/set-vel!` / `entity/impulse!` burst then `entity/friction!` settle; `roll` = velocity + `turn`/spin composed. | Compose from wired velocity/impulse/friction primitives. |
| **scatter / gather** | `(sprite ...)` atoms `scatter` + `gather` EXIST; also composable via `world/repel!` (scatter) / `world/attract!` (gather) over a group. | Use both — the atom for the high-level call, the force verbs for the timed/precise version. |
| **Multi-form names** (`nameResolver.js`) | STUB / FIXME. Inside a verb, ONLY the bare hue id resolves; "Pearl Blossom" / "the Blossoms" throw. | Corpus addresses sprites by bare hue id inside `(sprite ...)` / registry verbs; the pretty forms appear only in operator-facing NARRATION prose. Flag `*[needs: multi-form name resolver]*` where a program would want it. |
| **Cart-errand rainbow-edge signature** | The 8px rainbow edge + lift-hold-move-hold-place easing is a RENDER signature; the motion (walk→lift→carry→set-down) is authored with `entity/glide!` + easing + `pick-up`/`carry`/`set-down` atoms. | Author the motion + timing in Scheme; flag the rainbow-edge render as `*[needs: rainbow-edge render]*`. |
| **Personality micro-mods / timing-tensor** | The `tempo-multiplier` / `micro-mods` (anticipation/hesitation/swing/stretch) from FLOWER-PERSONALITIES are AUTHORED DATA that biases easing + duration. The timing-tensor applier may be partly unwired in the headless harness. | Teach the personalities by SHOWING each Blossom's feel in a runnable program (different `entity/glide!` durations + easing per sprite); flag timing-tensor seams `*[needs: timing-tensor wiring]*`. |

### The honesty boundary (baked into the voice)

Per FLOWER-PERSONALITIES §5 + SAKURA-PERSONALITY-DISCIPLINE: the flowers have
**roles, not feelings**. Sakura calls them by name as friends ("Rose, come
close this one"); she never claims they feel. The corpus SHOWS the friends
framing in the prose and the role-based pick in the code — never
anthropomorphizes inner lives.

---

## The ch17–ch32 BLOSSOM spine (16 chapters)

| Ch | Title | What it drills | Gamut pt |
|----|-------|----------------|----------|
| 17 | Meet the Sixteen | who they are — the 16 Blossoms by hue-id; corner-flower-is-Sakura; they're HERS; spawn each, name it, place it | 1 |
| 18 | Moods & How to Meet Them | each Blossom's trait + tempo + micro-mods from the personality table; SHOW the feel in a runnable move; how to deal with each mood (pair the right one to the moment) | 2 |
| 19 | Calling Them by Name | address by bare hue-id inside a verb; the friends framing in prose; single vs collective; the name resolver gap | 1,3 |
| 20 | Sway, Spin, Jitter — In Place | bounded oscillation on the counter; never leave the perch; `dsin/dcos(world/frame)` around an anchor | 3 |
| 21 | Scatter & Gather | the two atoms + the force-verb version (`world/repel!`/`world/attract!`) over a group; tempo + count | 3 |
| 22 | The Sounds They Make | `sprite/footstep`, `sprite/sfx`, `synth/*` tied to motion; a step that speaks; sound synced to a move | 4 |
| 23 | Roll, Dash, Move | locomotion — dash as an impulse burst + friction settle; roll as velocity + spin; move-to with feel | 5 |
| 24 | The Counter | the world-frame integer AS the timing mechanism; `world/frame`, `world/after`; simple motion first | 6 |
| 25 | Timed Sequences on the Counter | complex timed motion — re-derive position from the frame; "come back to it via the counter"; deterministic replay | 6 |
| 26 | Seeing Each Other | sprite-to-sprite sensing (#585) composed from `entity/distance` + `world/nearest` + a line-of-sight predicate; what "seeing" means | 7 |
| 27 | Carrying Cards | the errand — walk→lift→carry→set-down with lift-hold-move-hold-place easing; `pick-up`/`carry`/`set-down`; the rainbow-edge render gap | 8 |
| 28 | Coordinating in Sync | many Blossoms timed together on ONE counter; named choreographies from a library; in-sync placement | 8 |
| 29 | Where They Live in Code | the roster files; `define-sprite`/`mod-sprite`; how to access + register a Blossom; the identity table | 9 |
| 30 | Grid Math — Anticipation | INSANELY PRECISE: predict where a Blossom is on the 8px dot grid at frame t; interception/lead math; re-derive from the counter | 10 |
| 31 | The Complexity Matrix | the (runtime: short↔long) × (code: little↔lots) orthogonality; all four quadrants as runnable programs; runtime decoupled from program length | 11 |
| 32 | The Judgment | teach the REASONING for each tradeoff — precompute vs stream, unroll vs loop-on-counter, when precision demands more code; SHOW the judgment in the program | 12 |

Each chapter: ~24 complete standalone runnable Sakura-Scheme programs, ~12k
tokens. 16 chapters × ~24 ≈ ~380 programs from this cluster toward the
~1000-program book target (the ch01–16 spine already carries its share; refill
r-passes grow both).

---

## Build + dispatch

The queue is built by `scripts/build_marionette_blossoms_queue.py` (mirrors
`build_new_books_queues.py`: 16-ch spine + a cached `prefix_file` carrying the
overview/spine/verb-allowlist, per-chapter delta prompt files, output to
`docs/marionette-book/chNN-<slug>.md`). Launch:

```bash
SKIP_REGEN=1 bash scripts/api-burndown.sh scripts/.marionette-blossoms-queue.jsonl
```

`SKIP_REGEN=1` because output is `.md` (non-cart) and to keep the cart index
untouched under the single-writer HOLD. The wire-call model boundary is the
workhorse cloud model; no vendor name appears in any corpus line.

---

## The ch33–ch40 EXTENSION cluster (8 chapters) — cards, orchestration, scenes, cartoon SFX, math-drawing

*Appended 2026-07-04. The operator streamed in FIVE MORE facets (#13–#17 of
`project_blossom_control_is_marionette_2026_07_04.md`) that the ch17–ch32 spine
does NOT cover. Marionette is the CONTROL book — routing · composition ·
orchestration — so cards, multi-actor staging, scene-through-owned-objects,
the cartoon-SFX gamut, and fast procedural math-drawing all seat HERE, not in
the Book of Animation. This cluster is ch33+, so it never overwrites ch17–ch32.*

### What ch17–ch32 already covered (do NOT re-author)

Blossom identity, moods, in-place control, the sounds a flower makes, roll/dash,
the counter + timed sequences, sprite-to-sprite sensing, *carrying a card* (the
errand, ch27), sync choreography, the roster, grid-anticipation math, the
complexity matrix, the judgment. The NEW cluster promotes **cards** and
**whole-board orchestration** to first-class citizens, adds **scene composition
through owned objects**, the **cartoon-foley gamut**, and **procedural
math-drawing** — none of which the earlier spine touches.

### Gap analysis — the card + desk + SFX surface (grounded)

| Surface | WIRED verbs (registered) | Source |
|---|---|---|
| Card hide/show (#578) | `card/hide` `card/show` `card/hide-all` `card/show-all` | `deskDirectVerbs.js:375,389,403,409` |
| Card locomotion (a card that walks) | `card/walk` + 8 gaits `amble prowl stomp skip waddle bounce-stride run-and-slow glide-pause`; `card/walk-beats` (tempo-synced on the shared clock) | `cardWalkVerbs.js:136,270,308` |
| Card transition physics | `card/physics!` (set active transition: slide / no-slide / dematerialize / waft / chubby-walk); `card/transition` | `cardTransitions.js:84` |
| Card focus / zoom | `card-zoom` (open/focus a card by camera-zoom, NOT fullscreen) · `card-detach` | `cardMotionVerbs.js:131,149` |
| Card foley + activity | `card/hero` `card/audio-pulse` `card/audio-pulse-off` `card/activity` `card/activity-done` `card/activity-progress` | `cardVerbs.js:178,211,233,1162,1187,1210` |
| Desk-through-objects (#15) | `desk/clear` `desk/scatter` `desk/spin` `desk/zoom-out` `desk/reboot` · `sprite/summon` `sprite/dismiss` `sprite/tempo` | `deskDirectVerbs.js` |
| Card ↔ Blossom ↔ primitive physics (#610/#597) | reuse `world/gravity! world/wind! world/attract! world/repel! world/impulse! world/floor! world/link! world/solve!` + `entity/mass! entity/drag! entity/bounce! entity/pin!` + `world/collisions entity/collisions entity/overlaps?` + `collision/define-layers! collision/overlaps?` | `marionetteWorld.js`, `collisionLayers` |
| Cartoon-foley SFX (#16) | `sprite/footstep` `sprite/sfx` `audio/play` `audio/mix` `audio/volume` `audio/duck` `synth/*`; tape-audio seam `world/tape-audio` (#640 done) | `marionetteAudio.js`, `marionetteTape.js` |

**NOT wired — COMPOSE + flag honestly (never invent a verb in a shipped example):**

| Want | Reality | Corpus handling |
|---|---|---|
| **`card/move`** (reposition a card) | No first-class `card/move`. A card walks with `card/walk` (a gait) or is placed by re-anchoring. | Author card repositioning with `card/walk` + a gait; where a plain glide-place is wanted, flag `*[needs: card/move]*` + `<!-- BUILD: needs verb card/move (lift→hold→move→hold→place, rainbow-edge) -->`. The rainbow-edge signature stays a render detail: `*[needs: rainbow-edge render]*`. |
| **`card/open` / `card/close`** | No `card/open`; opening = camera-zoom focus. | Use `card-zoom` for the open/focus (NOT fullscreen — camera zoom per `flat_paper_cards_no_fullscreen`); flag `*[needs: card/open]*` + `<!-- BUILD -->` where a semantic open verb is wanted. |
| **`card/disappear` / `card/reappear`** | Hide/show (#578) is the shipped mechanism. | Use `card/hide` / `card/show` (and `card/hide-all` / `card/show-all`); if a dematerialize *transition* is wanted, `card/physics! 'dematerialize` then hide. |
| **Blossom moves a card** | No `sprite→card` grab verb. | Compose: a Blossom `pick-up`/`carry`/`set-down` (the ch27 errand atoms) walks to the card's anchor; the card follows via `card/walk` on the same counter beat. Flag `*[needs: sprite-carries-card binding]*`. |
| **Broadcast to all cards** | `card/hide-all` / `card/show-all` broadcast; no general `card/broadcast`. | Address-all via the `*-all` verbs + `world/each` / `group/each` fan-out; flag `*[needs: card/broadcast]*` for a general message bus. |
| **Blossom stage-exit signatures** | The 10 entrance/exit signatures (shoo / bye-bye / parade / tree-perch) are choreographies, `sprite/dismiss` is the wired clear. | Compose exits from `sprite/dismiss` + `(sprite ...)` atoms (`scatter`, `go-to` offstage, `perch`) on the counter; never-vanish invariant honored (they walk off, not blink out). |

### The ch33–ch40 spine

| Ch | Title | Gap statement (what it drills that ch17–32 do NOT) | Facet |
|----|-------|-----------------------------------------------------|-------|
| 33 | Moving a Card | reposition a flat-paper card on the world surface — the lift→hold→move→hold→place easing signature via `card/walk` + a gait; cards are canvas-first flat paper anchored to the world. `*[needs: card/move]*` `*[needs: rainbow-edge render]*` | 13 |
| 34 | Open, Close, Hide, Show | open a card by camera-zoom focus (NOT fullscreen), close it, **hide** it (#578 shipped), disappear/reappear; hide vs a dematerialize transition | 13 |
| 35 | Blossoms Move Cards | a Blossom sprite as the AGENT that carries/pushes/places a card — the ch27 errand generalized to cards; the Blossom + card share ONE counter beat | 13 |
| 36 | Card Physics & Collision | marry sprite-space and card-space into ONE physics/collision model — collide card↔card, **Blossom↔card**, **Blossom↔primitive** via PBD (#610) + collision layers/masks (#597) | 13 |
| 37 | Sensing & Broadcast | fetch a card's position/state/bounds — the HOW and *WHEN* (close-data-close-paren timing judgment: read-before-act, staleness, poll vs event); broadcast / address-all-cards vs addressing one; **tell Blossoms to EXIT THE STAGE** (shoo / bye-bye / parade / tree-perch, never-vanish) | 14 |
| 38 | Orchestrating the Board | multi-card × multi-Blossom — several cards moving WHILE several Blossoms do various things at once; choreography of the whole board, easy → complex/complicated (ties the complexity matrix, ch31–32) | 14 |
| 39 | Scenes Through Owned Objects | every desktop-control verb routes THROUGH owned actors (`desk/*`, `sprite/summon`/`dismiss`, cards, primitives, props) to compose/direct/tear-down a SCENE on the 4096 dot-matrix — never abstract desktop commands, always enacted through what Marionette owns | 15 |
| 40 | Cartoon SFX & Fast Math-Drawing | the cartoon-foley gamut (footsteps / trumpets-horns / anime chirps / whistles / screech-brakes / boings) as SFX primitives fired FAST in code (terse, counter-synced, layered with motion) via `sprite/sfx` + the tape-audio seam #640 — the *control-through-Blossoms* angle (Book of Sound owns the primitive craft); PLUS fast procedural DRAWING with math — a couple of trees + a building (not a whole jungle) + repeating patterns REALLY FAST via loops/modulo/symmetry/tiling on the dot-matrix, deterministic + `world/frame`-driven | 16, 17 |

Each chapter: ~24 complete standalone runnable Sakura-Scheme programs, ~12k
tokens — 8 chapters × ~24 ≈ ~190 more programs toward the ~1000-program book.
Ch40 pairs facets #16 (cartoon SFX) and #17 (math-drawing) so the extension
lands in a clean 8 chapters; both are meaty enough to hold ~24 programs across
the two halves. Chapters address Blossoms by **bare hue id** inside verbs
(`nameResolver.js` is a FIXME stub — pretty names are narration only), the
8px dot pitch on the 4096 world, `world/frame` as the one counter (no
`counter/*` namespace), and reuse the shipped card / physics / audio seams.

### Representative snippets (each a complete standalone program)

**ch33 — Moving a Card** (repositions via a gait; the plain-glide place is flagged):
```scheme
;; Move a collection card across the stage with the 'glide-pause gait —
;; the lift→hold→move→hold→place feel. *[needs: card/move]* for a plain place.
(let ((w (world/spawn)))
  (let ((c (world/spawn w 'card 'collection 400 400)))
    (card/walk c 'glide-pause 1800 900 90)   ; walk the card, ease at the ends
    (world/step w 90)))
```
<!-- BUILD: needs verb card/move (lift→hold→move→hold→place, rainbow-edge render) -->

**ch34 — Open, Close, Hide, Show** (camera-zoom open, then hide #578):
```scheme
;; Open a card by camera-zoom (NOT fullscreen), hold, then hide it (#578).
(let ((w (world/spawn)))
  (let ((c (world/spawn w 'card 'etsy 1024 1024)))
    (card-zoom c 'in 45)          ; focus by zoom — flat paper stays anchored
    (world/after w 60 (lambda () (card/hide c)))
    (world/step w 120)))
```
<!-- BUILD: needs verb card/open (semantic open distinct from camera-zoom focus) -->

**ch35 — Blossoms Move Cards** (the Blossom is the agent; card rides the beat):
```scheme
;; Rose walks to a card's anchor and carries it home — the ch27 errand on a card.
(let ((w (world/spawn)))
  (let ((rose (world/spawn w 'blossom 'rose 200 1000))
        (c    (world/spawn w 'card 'inventory 200 1000)))
    (entity/glide! w rose 1600 1000 60 'ease-in-out)  ; Rose walks the route
    (card/walk c 'amble 1600 1000 60)                 ; the card ambles alongside
    (world/step w 60)))
```
*[needs: sprite-carries-card binding]* <!-- BUILD: bind a card's transform to a carrying sprite -->

**ch36 — Card Physics & Collision** (Blossom↔card in ONE model, layers #597):
```scheme
;; A Blossom nudges a card; both live in one collision world (#610/#597).
(let ((w (world/spawn)))
  (collision/define-layers! w '((blossom card) (card card)))
  (let ((mint (world/spawn w 'blossom 'mint 300 500))
        (c    (world/spawn w 'card 'note 700 500)))
    (entity/mass! w c 3.0)
    (entity/set-vel! w mint 6.0 0.0)      ; Mint drifts into the card
    (world/solve! w)                       ; PBD resolves the contact
    (world/step w 40)
    (list (entity/x w c) (entity/overlaps? w mint c))))
```

**ch37 — Sensing & Broadcast + stage-exit** (read-when-fresh; shoo all off):
```scheme
;; Read a card's live bounds THE MOMENT before acting (close-data-close-paren),
;; then shoo every Blossom offstage — they WALK off, never blink out.
(let ((w (world/spawn)))
  (let ((c    (world/spawn w 'card 'hero 1024 1024))
        (rose (world/spawn w 'blossom 'rose 900 900))
        (sky  (world/spawn w 'blossom 'sky 1100 900)))
    (let ((cx (entity/x w c)) (cy (entity/y w c)))   ; fresh read, used at once
      (entity/glide! w rose (- cx 400) 2200 50 'ease-in) ; each exits stage-left
      (entity/glide! w sky  (+ cx 400) 2200 50 'ease-in))
    (world/step w 50)))
```
*[needs: card/broadcast]* <!-- BUILD: a general address-all-cards message bus -->

**ch38 — Orchestrating the Board** (multi-card × multi-Blossom on one counter):
```scheme
;; Two cards slide while three Blossoms gather — the whole board on ONE counter.
(let ((w (world/spawn)))
  (let ((a (world/spawn w 'card 'etsy 300 300))
        (b (world/spawn w 'card 'ebay 300 700))
        (r (world/spawn w 'blossom 'rose 2000 400))
        (m (world/spawn w 'blossom 'mint 2000 800))
        (s (world/spawn w 'blossom 'sky 2000 1200)))
    (card/walk a 'skip 1500 300 80)
    (card/walk b 'skip 1500 700 80)
    (for-each (lambda (id) (ai/arrive w id 1500 500 90.0 60.0)) (list r m s))
    (world/step w 80)))
```

**ch39 — Scenes Through Owned Objects** (desk verbs enacted via owned actors):
```scheme
;; Compose a scene, then tear it down — all THROUGH owned objects, never abstract.
(let ((w (world/spawn)))
  (sprite/summon w 'amber 800 800)          ; bring an owned actor onstage
  (sprite/summon w 'fern 1600 800)
  (world/spawn w 'card 'hero 1200 1200)     ; an owned card sets the scene
  (world/step w 60)
  (desk/scatter w)                           ; direct the board via the actors
  (world/step w 30)
  (sprite/dismiss w 'amber)                  ; strike the set through the actors
  (sprite/dismiss w 'fern)
  (world/step w 30))
```

**ch40a — Cartoon SFX fired fast** (counter-synced foley, one line each):
```scheme
;; A pratfall: boing on the bounce frame, screech on the stop — fired terse.
(let ((w (world/spawn)))
  (let ((coral (world/spawn w 'blossom 'coral 200 600)))
    (entity/set-vel! w coral 9.0 0.0)
    (world/after w 12 (lambda () (sprite/sfx w coral 'boing)))   ; the bounce
    (world/after w 24 (lambda () (sprite/sfx w coral 'screech))) ; the skid-stop
    (entity/friction! w coral 0.4)
    (world/step w 40)))
```
*[needs: cartoon-foley sample set (boing/screech/trumpet/whistle/anime-chirp)]* <!-- BUILD: register the cartoon-foley bank behind sprite/sfx -->

**ch40b — Fast math-drawing** (a grove + a building from a modulo loop):
```scheme
;; A whole little grove from ONE loop — tiled on the 8px dot grid via modulo.
(let ((w (world/spawn)))
  (for-each
    (lambda (i)
      (let ((x (* 256 (+ 1 (modulo i 6))))    ; six columns, wrap with modulo
            (y (* 320 (+ 1 (quotient i 6)))))  ; new row every six
        (world/spawn w 'prop 'tree x y)))
    (list 0 1 2 3 4 5 6 7 8 9 10 11))
  (world/spawn w 'prop 'building 1400 1600)   ; one building anchors the set
  (world/step w 1))
```
<!-- BUILD: register 'tree / 'building props if the prop kind is unbound -->

### Build + dispatch (extension)

Built by `scripts/build_marionette_extension_queue.py` (same shape as the
blossoms builder: a cached `prefix_file` carrying the overview + this ch33–ch40
spine + the extension verb-allowlist, per-chapter delta prompt files, output to
`docs/marionette-book/chNN-<slug>.md`, `BASE = 33` so it never overwrites
ch17–ch32). Emits `scripts/.marionette-extension-queue.jsonl`. Launch (PREP
ONLY — held):

```bash
SKIP_REGEN=1 bash scripts/api-burndown.sh scripts/.marionette-extension-queue.jsonl
```

`SKIP_REGEN=1` because output is `.md` (non-cart) → the cart index stays
untouched under the single-writer HOLD. No vendor name appears in any corpus
line; the model boundary is the workhorse cloud model at the wire-call only.

---

## §GROUNDTRUTH — SRE Voice-of-Marionette Groundtruth (folded)

# SRE + Voice/Marionette Ground-Truth Ledger — 2026-07-04

**Sworn by:** Priya (Lacuna Engineering — BS-gate / adversarial reviewer).
**Occasion:** Phase 1 baseline. Marcus is building two clusters in parallel
(Lacuna SRE #327–#333, P0 #330; Voice/Marionette #668). This ledger is the
honest spec-vs-reality state of disk **before** his landed work is gated
(Phase 2 comes on a later resume). Every PRESENT below is a line I read and,
where a suite exists, a test I ran green. Every ABSENT is a gap I will not
paper over.

**Method:** grep + read live disk, not the tracker. Where a test suite guards a
claim I ran it and record the count. No deploy, no commit, no code change. The
`.sks` corpus + index were not touched (single-writer hold).

> Legend — **PRESENT-AND-WIRED** = real code on a live path, exercised (test or
> boot wiring verified). **STUB** = real scaffold, honest-null at the boundary,
> declares itself not-yet-wired. **ABSENT** = nothing writes/runs the signal.

---

## §1. Lacuna SRE cluster (#327–#333) + attestation gaps (#356)

Context: the SRE Attestation (`docs/SRE-ATTESTATION-2026-07-02.md`, 2026-07-02)
found the alerting watcher written-but-never-run, no general latency capture,
no cart-run spine feed, and no health verdict. Between then and now a new
package `curator_api/lacuna_sre/` + supporting write-paths landed to close
those gaps. This ledger checks whether the closure is genuine.

| Item | State | Evidence (file:line) |
|---|---|---|
| **#330 alert-rule evaluator** | **PRESENT-AND-WIRED** | `lacuna_sre/alerting.py:62` `evaluate()` — pure deterministic evaluator over a scrubbed snapshot; 7 real rules (cart-p99 `:82`, verb-p95 `:88`, k-floor `:94`, replica-lag `:100`, cap-forgery `:106`, SLO burn-rate `:113`, Neimark-Sacker Δ_NS `:126`). Emits `AlertEvent` with severity + escalation chain. Missing metric → NO alert (honest-null, never silent-ok, `:66-68`). |
| **#330 paging sink** | **STUB (correctly honest-null)** | `lacuna_sre/alerting.py:137` `PagingSink.page()` returns `delivered:False`, `escalate:"service-not-yet-wired"` — no SMS/push/email transport, no roster. It does NOT pretend to have paged (a false "paged" is the worst outcome). `escalation.resolve_contact():88` returns `service-not-yet-wired`. |
| **#330 evaluator ACTUALLY RUNS** | **PRESENT-AND-WIRED (gated)** | `lacuna_sre/watcher_daemon.py:112` `tick_once()` calls `alerting.evaluate` at `:144`, routes firing events to `PagingSink` at `:171`, refreshes the oracle snapshot at `:152`. Booted at app start: `app.py:323-324` `start_watcher_daemon_from_handles()`. **Gated by `SRE_MONITORING_ENABLED` (off by default) and declines when substrate handles are unbound** (`watcher_daemon.py:201-207,235-267`). So: pipeline is wired end-to-end but dark until the flag is on AND a disparate SRE Loam is bound. This is the exact honest posture the attestation demanded. |
| **#330 escalation logic** | **PRESENT-AND-WIRED** | `lacuna_sre/escalation.py` — pure `chain_for():42` (primary→secondary→architect), `next_tier():55` (timeout-climb with per-severity grace windows `:29-33`). Roles only, never names/PII. |
| **#330 error-budget math** | **PRESENT-AND-WIRED** | `lacuna_sre/error_budget.py` — `ErrorBudget` dataclass, `burn_rate():69`, `burn_rate_severity():82` (Google-SRE 14.4/6.0/1.0 thresholds), `delta_ns_severity():99` (Neimark-Sacker 0.10 warn / 0.03 damp). Pure, no I/O. |
| **#356 gap 2 — general latency p50/p90/p95/p99** | **PRESENT-AND-WIRED (was NO-not-yet)** | Write-side closed: `sre/latency_ring.py` `LatencyRing` (`record():73`, `drain_percentiles():129`). Stamped on the real dispatch path: `routes/verb_backings.py:98` `_latency_finish()` → `record_verb_latency()` at `:113` (t_received→t_ok). Drained by the sampler: `sre/timeseries.py:713-714`. Served: `sre/routes.py:674-675`. p90 now exists (`latency_ring.py:123`), reconciling the p90/p95 mismatch the attestation flagged. |
| **#356 gap 7 / #329 — cart-run spine feed** | **PRESENT-AND-WIRED (was PARTIAL)** | Write-side closed: `loam/sre/cart_feed.py` `emit_cart_state():101` translates FE state→spine event (cart-fire/success/failure, `:143-159`), metadata-only, sim runs excluded (`:127`). Called from the live mirror route: `routes/sakura_cart.py:154-163`. Best-effort, never breaks a cart run. Honest-null no-op when substrate unbound (`cart_feed.py:67-92`). |
| **#356 gap 10 — health oracle ("is my system okay?")** | **PRESENT-AND-WIRED (was NO-not-yet)** | `lacuna_sre/health_oracle.py` `verdict():` — three independent readings (rule anomalies via `alerting.evaluate`, Δ_NS bifurcation, staleness). No data → `okay=None` (UNKNOWN, never fabricated green). Exposed: `sre/routes.py:708` `GET /api/sre/health` (always 200; UNKNOWN is a valid honest answer). This was the keystone the attestation called "unbuilt." |
| **#356 gap 8 — general error budgets/burn-rate** | **PRESENT-AND-WIRED** | `error_budget.py` generalizes the Stores-only math the attestation flagged; consumed by `alerting.evaluate` SLO rule (`alerting.py:113-124`). |
| **#329 cart-run telemetry (client + server)** | **PRESENT-AND-WIRED** | Client taxonomy `cartBus.js` (pre-existing); server spine feed now live (see gap 7 above). |
| **#331 ticketing** | **PRESENT-AND-WIRED** | `lacuna_sre/ticketing.py` (5.4 KB) — incidents as append-only rows in Lacuna's own segregated Cortex plane. Zero `service-not-yet-wired` markers; real store logic against the disparate cortex. |
| **#332 fleet-control** | **STUB (correctly honest-null)** | `lacuna_sre/fleet.py` (6.4 KB) — fleet registry + control-action seams (bans/token-delivery/refunds/chargebacks). 11 honest-null/escalate markers: control actions are human-triggered seams, NEVER auto-writes to prod. Registry real; effectors not-yet-wired. |
| **#333 HAL agent** | **STUB (correctly honest-null, dry-run)** | `lacuna_sre/hal.py` (13.7 KB) — real intent→action tool registry (all read-only/signal-only), calls `error_budget`/`alerting`/`escalation` deterministically before any model. `run(..., dry_run=True)` assembles the full request and STOPS at the model-call boundary — no model download, no inference, no token fired. Vendor name only at env-driven `CloudBackend._wire_call`. |
| **loam_bridge (best-effort prod read)** | **STUB (correctly honest-null)** | `lacuna_sre/loam_bridge.py` — 5 honest-null markers; degrades to stale-flagged last-known on partition, never blocks/locks prod. |

**SRE test evidence:** `tests/sre/test_sre_gap_closure.py` +
`tests/sre/test_lacuna_sre.py` + `tests/loam/test_lacuna_watcher.py` → **51
passed** (ran `.venv/bin/python -m pytest`, 0.78s, 2026-07-04).

**SRE vendor-leak scan:** clean. `grep -niE '(claude|anthropic|sonnet|opus|
qwen|llama|mistral|gemini|...gpt)'` across `lacuna_sre/` + `sre/` (excluding
wire-call/env-driven lines) returned **zero** hits.

**SRE bottom line:** The three load-bearing gaps the 2026-07-02 attestation
could not swear to — general latency capture, cart-run spine feed, alerting
pipeline run — now have **real closing code on live paths, tested green.** The
paging *transport*, fleet *effectors*, and HAL *inference* remain honest-null
stubs by design (never fabricate a page/ban/answer). The whole SRE plane still
ships **dark behind `SRE_MONITORING_ENABLED` (off by default)** on a
shared-fate in-process read until a disparate SRE Loam is bound — that is the
one thing standing between "wired" and "watching."

---

## §2. Voice / STT / TTS package (#457, #458, #664–#667)

`curator-voice/` is Plane A: a standalone Rust duplex-audio binary. Its own
Cargo.toml header declares: *"Status: SCAFFOLD. Binary compiles; hot loop,
models, and AEC are honest stubs."* Confirmed on disk.

| Item | State | Evidence (file:line) |
|---|---|---|
| **#457 local Parakeet STT (in-process ONNX)** | **STUB (honest-null)** | `curator-voice/src/stt/ort_parakeet.rs:44` `transcribe()` → `bail!("stt-not-yet-wired")`; `warmup():51` same. Header `:8`: "HONEST STUB. A clean ONNX export of Parakeet TDT 0.6B v2 does not exist as of 2026-07-04." Trait surface (`stt/mod.rs:53`) correct; no model loaded. |
| **#457 local STT (MLX sidecar alt)** | **STUB (honest-null)** | `curator-voice/src/stt/mlx_sidecar.rs:49` `transcribe()` → `bail!("stt-not-yet-wired: MlxSidecar has no socket")`. Socket/protocol are TODO. |
| **#457 local TTS** | **STUB (honest-null)** | `curator-voice/src/tts.rs:106` `synthesize()` → `bail!("tts-not-yet-wired: LiveTts has no model loaded")`. Kokoro/ort load is TODO `:94`. Bridge playback also not-yet-wired `:138`. |
| **Engine hot-loop (all 4 voice modes)** | **STUB (honest-null)** | `curator-voice/src/engine.rs:196` — all mode handlers return `final_text:"service-not-yet-wired"` (`:208,223,236,246`). Audio capture/playback streams are non-fatal stubs `:101`. |
| **#458 prosody wiring** | **ABSENT (design-only)** | Only reference is a TODO comment in `tts.rs:20` ("trained prosody — capability-gated; grant verified before use"). No prosody code path; grant verification itself is TODO `:21`. |
| **Plane B JS voice bridge (`marionetteVoice.js`)** | **STUB (honest-null)** | Every bridge call returns `['escalate','service-not-yet-wired',…]` with no engine (`:210,221,248,294`). `_dispatchDown` socket write not implemented (`:217-223`). Node child_process spawn is TODO `:144`. This is correct honest behavior — no engine, no silent no-op. |
| **`voice/say` tape queue** | **PRESENT-AND-WIRED (tape only)** | `marionetteAudio.js:441` — records the speech line on the tape as a hash-keyed signed span (content in `speechContentStore` keyed by hash, GDPR-erasable). But `ttsWired:false` explicitly (`:424`): the tape records INTENT; live TTS dispatch is `service-not-yet-wired`. |

**Voice vendor-name discipline:** two **LEAKS** outside the adapter boundary —
`curator-voice/src/lib.rs:13` and `src/seam.rs:67` both name the TTS model
("Kokoro"). The CLAUDE.md rule confines vendor/model names to the `stt/` +
`tts` adapter modules; `lib.rs` and `seam.rs` are not adapters. Minor (comments,
not operator-facing, not corpus) but they are real rule violations. **Flag for
Phase 2 / Marcus.** The rest of the non-adapter Rust (`engine.rs`, `main.rs`)
is clean.

**Voice bottom line:** #457 (STT+TTS) and #458 (prosody) are **not built** —
the Rust is an honest scaffold that compiles and returns not-yet-wired at every
model boundary; the JS bridge is honest-null with no engine. This matches the
Cargo header's own claim. No fluent-wrong here.

---

## §3. Marionette suite (#511, #595, #515/#516, #668)

| Item | State | Evidence (file:line) |
|---|---|---|
| **#511 Marionette core suite** | **PRESENT-AND-WIRED** | `marionetteWorld.js` (1313 lines — spawn/step/collide/render), `marionetteBrain.js` (478), `marionetteSteer.js` (378 — steering forces), `marionettePath.js` (429), `marionetteBus.js`, `marionetteScene.js`, `marionetteTape.js` (record/replay). **169 tests pass** across 7 files (ran vitest 2026-07-04). Real deterministic motion. |
| **#595 M5 game controls** | **PRESENT-AND-WIRED** | `gameKit.js` + marionette binding verbs (`marionettePath.js`, `marionetteWorld.js`, `marionetteSteer.js`) registered via `registry/VerbRegistry.js`. The STAMP's "control a flower ⟺ control a PICO-8 player" is real: same `_stampLimbs` stamper (`grid.js:636`). |
| **Marionette binding bone (STAMP claim)** | **PRESENT-AND-WIRED** | `docs/MARIONETTE-1.0-STAMP.md` claims the six binding verbs are live in `grid.js`. Verified: `entity/shape!` (`grid.js:926`), `world/render` (`grid.js:966`), `sway!`, `world/sway-all!`, `_stampLimbs` (`grid.js:636`). The STAMP is honest ("built and wired," not future-tense). |
| **#515 OMR (music score → Scheme)** | **PRESENT-AND-WIRED (offline codegen)** | `scripts/musicxml_to_scheme.mjs` (11.4 KB) `musicXmlToScheme()`. 7 tests pass. NOTE: this is a **MusicXML-format → Scheme translator**, NOT live optical-music-recognition (no image/scan capture). Scope is format-transcode, correctly. |
| **#516 AMT (audio events → Scheme)** | **PRESENT-AND-WIRED (offline codegen)** | `scripts/amt_events_to_scheme.mjs` (9.4 KB) `amtEventsToScheme()`. 6 tests pass. Same shape: an **event-list → Scheme translator**, NOT live audio-to-MIDI transcription. |

**Marionette test evidence:** motion suite **169 passed** (7 files);
OMR/AMT codegen **13 passed** (2 files). Ran vitest 2026-07-04.

**Marionette bottom line:** #511/#595 motion + game-control substrate is **real
and heavily tested** — the strongest-built lane in this ledger. #515/#516 are
present as **offline format-transcoders** (MusicXML/event-list → Scheme), not
the live OMR/AMT capture their issue titles might imply — flag the scope gap so
no one claims "we scan sheet music" from a format converter.

---

## §4. Summary ledger

| # | Item | Verdict |
|---|---|---|
| #330 | alert evaluator + math + escalation + oracle | **PRESENT-AND-WIRED** (dark behind flag) |
| #330 | paging transport | **STUB** (honest-null) |
| #329 | cart-run telemetry (client + server spine feed) | **PRESENT-AND-WIRED** |
| #331 | ticketing | **PRESENT-AND-WIRED** |
| #332 | fleet-control | **STUB** (registry real, effectors honest-null) |
| #333 | HAL agent | **STUB** (harness real, model boundary honest-null / dry-run) |
| #356 | attestation gaps 2/7/10 (latency, spine, oracle) | **CLOSED — PRESENT-AND-WIRED** |
| #356 | default-on observability | **STILL OPEN** (`SRE_MONITORING_ENABLED` off) |
| #457 | local STT + TTS | **STUB** (Rust scaffold, not-yet-wired at every model boundary) |
| #458 | prosody wiring | **ABSENT** (design-only TODO) |
| #511 | Marionette core suite | **PRESENT-AND-WIRED** (169 tests) |
| #595 | M5 game controls | **PRESENT-AND-WIRED** |
| #515/#516 | OMR / AMT | **PRESENT-AND-WIRED** as offline codegen (NOT live capture) |

**Vendor-leak baseline:** SRE Python clean. Voice Rust has **2 leaks**
(`lib.rs:13`, `seam.rs:67` — "Kokoro" outside the adapter boundary).

---

## §5. The bar Marcus's landed work will be gated against (Phase 2)

State it plainly so the target is known before he builds:

1. **Four-question ship check** — every landed path needs a real user (named
   operator or code path), a real path (something exercises it), a real test
   (eval/unit gate), and a real doc section (named in a canonical, with WHY).
   Missing any one = dead weight.
2. **Honest-null, no fluent-wrong** — a STUB that reports "Done" fails the
   gate. Every not-yet-wired boundary must surface `service-not-yet-wired` /
   `pending-visual`, never silent-success a no-op, never claim Ready/Done when
   the path isn't verified end-to-end.
3. **P0 #330 must EVALUATE + PAGE, not return a hollow stub** — the evaluator
   must fire real rules over real telemetry, and the routing must reach a sink.
   A hollow "return []" evaluator or a paging sink that fabricates "delivered"
   fails. (Current state passes on the evaluator; the sink is *correctly*
   honest-null and must STAY honest — a future "delivered:true" without a real
   transport is a Phase-2 fail.)
4. **No silent failures / swallowed errors** — the `except: pass` best-effort
   guards on telemetry/feed paths are acceptable ONLY because they log and
   degrade to honest-null. A swallow that hides a real error behind a green is
   a fail.
5. **Vendor + model-size name discipline** — banned tokens (Claude, Anthropic,
   Sonnet, Opus, Qwen, Llama, Mistral, Gemini, Perplexity, Firecrawl,
   DeepSeek, Vertex, OpenAI, GPT) and model-size leaks appear ONLY at the
   literal wire-call. The 2 existing "Kokoro" leaks are already on the board;
   any new leak outside a wire-call/adapter fails.
6. **No prod deploy, no flyctl, NO commit** — Mac Studio is dev+training only;
   everything stays in-tree. A commit or a `flyctl deploy` is an automatic
   fail regardless of code quality.
7. **Single-writer hold on `.sks` + index** — MD/JSON edits fine; touching the
   cart `.sks` corpus or its generated index during this build is a fail.
8. **Scope-honesty** — an offline format-transcoder (#515/#516) may not be
   presented as live capture; a flag-gated dark pipeline (#330) may not be
   presented as "monitoring is on." Say what it is.

---

*End SRE-VOICE-MARIONETTE-GROUNDTRUTH-2026-07-04. No deploy. No commit. No code
change. `.sks`/index untouched. Companion to
`docs/SRE-ATTESTATION-2026-07-02.md` (the prior oath) and
`docs/MARIONETTE-1.0-STAMP.md` (the motion truth).*

---

## §BURNDOWN — SRE Voice-of-Marionette Build Burndown (folded)

# SRE + Voice/Marionette Build Burndown — 2026-07-04

**Coordinator:** Marcus (Lacuna Engineering build coordinator).
**Occasion:** Architect lifted the gate on Cluster 1 (Lacuna SRE, #327–#333 +
#356) and Cluster 2 (Voice/Marionette, #668). Build both to completion in-tree.
**Constraint honored:** no prod deploy, no flyctl, no training, no `.sks` /
cart-index authoring, honest-null over fluent-wrong, four-question ship check on
every landed path, vendor/model names only at the wire-call boundary.

> **Headline finding.** The bulk of both clusters was ALREADY BUILT and GREEN
> when I opened the tree — the prior anti-straggler pipeline (2026-07-02 for SRE,
> 2026-07-03/04 for Voice/Marionette) closed the three load-bearing P0 gaps the
> `SRE-ATTESTATION-2026-07-02.md` sworn oath named. My job resolved to (1) VERIFY
> those claims against the running tests, and (2) close the one genuine remaining
> reachable gap: the **#329 per-customer cart-run aggregate table**. This doc
> records the honest per-item state, cites `file:Line + symbol()`, and points
> Priya's BS-gate at exactly the seams that are built-but-unreachable or
> honest-null.

Test evidence this pass (all run under `curator-api/.venv`):
- `tests/sre/` — **270 passed** (was 259; +11 new cart-run-table tests).
- `curator-web` marionette suite — **169 passed** (7 files).
- `curator-web` music-ingest codegen — **25 passed** (ingestScore / musicxmlToScheme / scoreToVoices).
- `curator-voice` (Rust) — `cargo build` clean (warnings only); **0 unit tests** (flagged below).

---

## Cluster 1 — Lacuna SRE (#327–#333, #356)

Legend — **BUILT** = wired end-to-end, real data path, test-guarded ·
**BUILT (unreachable)** = code + tests exist but no HTTP route surfaces it ·
**HONEST-NULL** = returns `service-not-yet-wired` by design (backing absent) ·
**BLOCKED** = needs an architect decision or a prod bridge that can't land in-tree.

### #330 SRE-ALERTING-BACKEND (P0) — **BUILT**

The single highest priority. Reviewable now.

| Leg | Status | Evidence |
|---|---|---|
| Alert-rule evaluator (cart-p99, verb-p95, K-floor, replica-lag, cap-forgery, SLO-burn, Δ_NS bifurcation) | BUILT (pure/deterministic) | `lacuna_sre/alerting.py:evaluate()` (`:138`); severities from `error_budget.burn_rate_severity`/`delta_ns_severity` |
| Generalized error-budget math | BUILT (pure fns) | `lacuna_sre/error_budget.py:ErrorBudget` (`:262`), `burn_rate()` (`:302`), `burn_rate_severity()` (`:315`) |
| **General latency capture** (the attestation's #1 gap — "the first number the architect looks for") | BUILT | write side: `sre/latency_ring.py:LatencyRing` (`record()`/`drain_percentiles()`); stamped at dispatch `routes/verb_backings.py:_latency_start/_latency_finish` (`:83,:98`) hung off the `_audit()` bracket (`:215-227`); drained by sampler `sre/timeseries.py:_drain_latency()` (`:705`) into `latency-p50/p90/p95/p99-by-verb` |
| **p90 now exists** (attestation: "p90 exists nowhere") | BUILT | `latency_ring._percentile` computes p90; allow-listed `sre/timeseries.py:91` `latency-p90-by-verb` (p95 kept for least-surprise) |
| Alerting daemon (poll spine + run evaluator on 30s cadence) | BUILT (gated) | `lacuna_sre/watcher_daemon.py:WatcherDaemon.tick_once()` (`:459`); booted at `app.py:317-324` under `SRE_MONITORING_ENABLED`; declines honestly when substrate unbound (`start_watcher_daemon():551`) |
| Paging sink | HONEST-NULL | `alerting.PagingSink.page()` (`:222`) returns `delivered:False, escalate:'service-not-yet-wired'` — a false "paged" is the worst outcome, so it fails visibly. Roster + transport are `escalation.resolve_contact` HONEST-NULL. |
| Health-oracle keystone ("is my system okay, sir?") | BUILT (reachable) | `lacuna_sre/health_oracle.py:verdict()` (`:735`) — three-valued (`okay=True/False/None`), never fabricates green on no data; exposed at `GET /api/sre/health` (`sre/routes.py:707`) |

Ship-check: real user = the watcher daemon + `/api/sre/health` route; real path =
`tick_once` → `evaluate` → `PagingSink`; real test = `tests/sre/test_sre_gap_closure.py`
(oracle + daemon + evaluator, 18 tests); real doc = this section + attestation §1 rows 2,9,10.

### #329 CART-RUN-TELEMETRY — **BUILT** (both halves now closed)

The attestation (§1 row 7) flagged this PARTIAL: the client cart-bus taxonomy was
real but the server-side spine was **not fed by production cart runs**, and there
was **no aggregate table**.

| Leg | Status | Evidence |
|---|---|---|
| Cart-run EDGE feed (Sense-1) onto the spine | BUILT | `loam/sre/cart_feed.py:emit_cart_state()` (`:120`) translates FE state → `cart-fire`/`cart-success`/`cart-failure`; called at `routes/sakura_cart.py:155`; sim runs excluded; best-effort |
| **Per-customer aggregate table** (runs / combined / failed + incomplete-run detection) — the named #329 deliverable | **BUILT THIS PASS** | `loam/sre/cart_run_table.py:aggregate_events()` (pure fold) + `build_cart_run_table()` (spine read, honest-null when unbound); exposed at `GET /api/sre/loam/cart-run-table` (`sre/routes.py`, `cart_run_table_endpoint()`) |
| Per-customer attribution (PII-clean) | BUILT THIS PASS | `cart_feed._anon_tenant_for()` HKDFs the operator id via the canonical `intelligence/cohort_gravity.py:anonymize_tenant()`; the spine FORBIDS raw `operator_id`, so only `anon_tenant` crosses; missing id → bucketed `unattributed`, never mislabeled |
| Incomplete-run detection (the "lost run" a naive success ratio hides) | BUILT THIS PASS | `cart_run_table.py` incomplete pass — a `cart-fire` with no terminal edge older than `INCOMPLETE_AFTER_S` (300s grace) is `incomplete`; in-flight runs inside the grace window are NOT mislabeled; count-based FIFO because the spine carries no run_id |
| Sense-2/3 (proposals / cohort-gravity) | BLOCKED (W11) | `sre/startup.py` leaves `pattern_miner`/`cohort_gravity` handles `None`; unchanged — depends on W11 backends outside this build |

Ship-check: real user = `/api/sre/loam/cart-run-table`; real path = spine →
`build_cart_run_table` → per-customer rows; real test = `tests/sre/test_cart_run_table.py`
(11 tests incl. incomplete detection, FIFO matching, honest-null, window filter);
real doc = this section.

### #356 SRE-WIRE-TELEMETRY-GAPS (the 5 spec-vs-wired gaps) — **BUILT**

The five gaps named in `SRE-ATTESTATION-2026-07-02.md §3`, and their closure:

1. **General p50/p90/p99 (carts/verbs/vendors)** — BUILT (see #330 latency capture; p90 added).
2. **Cart-run reliability spine feed** — BUILT (see #329 `cart_feed` + aggregate table).
3. **Alerting pipeline runs** — BUILT (see #330 `watcher_daemon`).
4. **"Is my system okay?" oracle** — BUILT + reachable (`health_oracle.verdict()` @ `/api/sre/health`).
5. **Default-on observability** — GATED-BY-DESIGN. Sampler/runner/daemon boot under
   `SRE_MONITORING_ENABLED` (`app.py:295-324`), pointed at the disparate SRE substrate,
   NOT prod in-process. Flipping the flag in the deployed config is a deploy act (out of
   scope: no flyctl). The switch is wired; turning it on is the operator's.

### #331 LACUNA-TICKETING — **BUILT (unreachable)**

| Leg | Status | Evidence |
|---|---|---|
| Incident model + Sakura→SRE delegation + file-on-behalf + queue | BUILT (module + tests) | `lacuna_sre/ticketing.py` — `file_incident` / `sakura_delegate` / `ack` / `resolve` / `open_queue`; scrubs every field |
| HTTP route / System Services queue surface | HONEST-NULL (no route) | No `/api/sre/tickets*` endpoint mounts `ticketing.py` — the module is import-reachable and test-covered (`tests/sre/test_lacuna_sre.py`) but not surfaced. **This is the #331 delta to fully land.** |

### #332 LACUNA-FLEET-CONTROL — **BUILT (registry) / HONEST-NULL (actions) / BLOCKED (chargeback)**

| Leg | Status | Evidence |
|---|---|---|
| Fleet registry (service ↔ SRE Loam ↔ never-down state ↔ replica lag) | BUILT | `lacuna_sre/fleet.py:FleetRegistry` |
| Control levers: ban / token-delivery / refund / payment | HONEST-NULL (human-gated) | each records intent to Lacuna's own Cortex then returns `executed:False, escalate:'service-not-yet-wired'` — a false "refunded"/"banned" is money+trust lost, so it fails visibly. Prod-execution bridge into Curator billing/ban APIs can't land in-tree (no deploy). |
| Chargeback | BLOCKED (architect-pending) | tagged `policy:architect-pending` (coin-ladder §16 memory lock) — Lacuna records intent, never sets policy |
| HTTP route | HONEST-NULL (no route) | no `/api/sre/fleet*` endpoint; module test-covered but unreachable |

### #333 LACUNA-HAL-AGENT — **BUILT (harness) / HONEST-NULL (model boundary)**

| Leg | Status | Evidence |
|---|---|---|
| HAL harness: intent → deterministic read-only tools → assembled prompt → STOP | BUILT | `lacuna_sre/hal.py` — read-only tools (pull telemetry, evaluate alerts, compute budget, propose escalation, file-ticket-on-behalf); grounds on exact math before narrating |
| Local + cloud model backends | HONEST-NULL | `LocalBackend` (security/Linux copilot GGUF at `LACUNA_HAL_MODEL_PATH`, never downloaded) + `CloudBackend` (env-driven, the ONLY wire-call vendor boundary); `dry_run=True` returns the request at the boundary — no inference fires |
| HTTP route | HONEST-NULL (no route) | no `/api/sre/hal*` endpoint |

### Separation posture (#327 — SRE brain = own disparate instance) — **ENFORCED IN CODE**

- Store boundary: `lacuna_sre/cortex.py:_assert_segregated()` raises `SegregationViolation`
  (fails LOUD) if Lacuna's Cortex resolves inside Curator's root; own `LACUNA_CORTEX_KEY`.
- Read boundary: `lacuna_sre/loam_bridge.py:pull()` best-effort, one-directional, degrades to
  `{available:False, stale:True, last_known:…}` on partition; scrubs every row.
- Intent boundary: Lacuna writes only `LacunaIncident/LacunaAlertEvent/LacunaFleetNote/LacunaHalTrace`.
- Two independent signals: telemetry pull AND external `/healthz/deep` (`app.py:1929-1992` LIVE).

---

## Cluster 2 — Voice / Marionette (#668)

### #457 LOCAL-SPEECH-BRINGUP (Parakeet STT + local TTS) — **BUILT (engine) / HONEST-NULL (model weights)**

| Leg | Status | Evidence |
|---|---|---|
| Rust voice engine (STT/TTS #664–#667) | BUILT (compiles clean) | `curator-voice/src/` — `engine.rs`, `tts.rs`, `stt/{mod,ort_parakeet,mlx_sidecar}.rs`, `vad.rs`, `aec.rs`, `eou.rs`, `turn.rs`; `cargo build` clean |
| Speech recognition behind swappable trait | BUILT | `stt/mod.rs` trait + `ort_parakeet.rs` / `mlx_sidecar.rs` backends (capability verbs; no model-size name in module names) |
| Model weights present + running locally | HONEST-NULL | weights are not vendored (no download in-tree; Mac Studio dev/training only). Engine boundary is real; the model file is the operator's to place. |

### #458 LOCAL-TTS wiring (prosody/pace/tone into her words) — **BUILT (JS side)**

- `curator-web/src/scheme/marionetteVoice.js` + `marionetteAudio.js` carry the prosody/pace/tone
  surface; audio is on the replay tape (#640 done — `marionetteTape.audio.test.js` green).
- Research grounding: `docs/RESEARCH-LOCAL-TTS-PROSODY-API-2026-07-02.md`,
  `docs/RESEARCH-TTS-PROSODY-VIA-SENTENCE-STRUCTURE-2026-07-01.md`.

### #511 MARIONETTE-SUITE + #595 M5 (unified audio+video max-control; game-engine controls) — **BUILT**

Stamped built and wired in `docs/MARIONETTE-1.0-STAMP.md` (verified line-by-line against the
live interpreter 2026-07-03).

| Leg | Status | Evidence |
|---|---|---|
| Six binding verbs (shape/pose/entity/behavior) | BUILT | `curator-web/src/scheme/grid.js:926-1019` (`entity/shape!`, `entity/shape-flower!`, `entity/pose!`, `world/render`, `sway!`, `world/sway-all!`) — honest-null symbols, never throw |
| World/steer/path/brain/scene/tape modules | BUILT (169 tests green) | `marionette{World,Steer,Path,Brain,Scene,Tape,Bus,Audio}.js` |
| Motion authored in Sakura Scheme via the REAL interpreter | BUILT (invariant honored) | the JS harness is a headless surface + encoder ONLY; motion is Scheme through the interpreter (the `render_grid_anim.mjs` JS-waltz anti-pattern is not reintroduced) |
| Deterministic replay tape (positions + camera + audio) | BUILT | `marionetteTape.js`; `dsin` fround-shimmed (`detMath.js`) → byte-identical replays |

### #515 OMR (sheet-music → Scheme) + #516 AMT (audio → Scheme) — **BUILT (codegen) / HONEST-NULL (ML engine)**

| Leg | Status | Evidence |
|---|---|---|
| OMR codegen (MusicXML → canonical `(score …)` sugar) | BUILT (7 tests) | `scripts/musicxml_to_scheme.mjs`; propagates `escalate:'score-not-recognized'` |
| AMT codegen (note-events JSON → canonical sugar) | BUILT | `scripts/amt_events_to_scheme.mjs`; propagates `escalate:'no-notes-detected'` |
| Ingest router + provenance + artifact wiring | BUILT (25 tests across ingest/xml/voices) | `curator-web/tools/ingest_score.mjs:ingestSource()` — routes MusicXML→OMR, events-JSON→AMT, `.sks`→passthrough |
| Raw image/audio → intermediate (the ML transcription step) | HONEST-NULL | no OMR/AMT inference engine wired; a RAW image/audio returns `escalate:'transcriber-not-available'` — it NEVER fabricates a score. Hooks (`transcribeImage`/`transcribeAudio`) are the wire-later seam; the rest of the flow is unchanged when they land. |

---

## Where Priya's BS-gate should focus

The system is honest where I can see it, but three classes of claim deserve the hard look:

1. **`SRE_MONITORING_ENABLED` is off by default (#356 gap 5).** Every SRE collector
   (sampler, abuse runner, watcher daemon) and the substrate binding are gated
   (`app.py:295-324`). **A monitor that isn't running is not a monitor.** The wiring is
   real and tested, but nothing proves it runs in a deployed config from this tree — that
   proof is a deploy act I could not perform. *BS-gate: confirm the flag is actually flipped
   (against a DISPARATE SRE Loam, not prod in-process) before anyone swears the pager works.*

2. **Built-but-unreachable modules (#331 ticketing, #332 fleet, #333 HAL).** All three have
   real code and passing unit tests but **no HTTP route** surfaces them — they are
   import-reachable only. *BS-gate: do not let "tested" read as "usable." The delta to fully
   land each is a mounted route (ticketing → System Services queue; fleet → human-gated
   control surface; HAL → observer endpoint behind an explicit enable flag).*

3. **Honest-null model boundaries (Rust voice weights, OMR/AMT inference, HAL model).**
   Each engine/harness is built to the model boundary and STOPS there honestly. **No model
   is downloaded, no inference fires.** *BS-gate: verify the honest-null actually returns
   `service-not-yet-wired`/`transcriber-not-available` on the raw-input path and never a
   fabricated score/transcript/answer — the whole point is a visible null, not a fluent-wrong.*

4. **Rust voice engine has 0 unit tests.** `cargo build` is clean but `cargo test` finds no
   tests. *BS-gate: the compile is not a correctness proof for STT/TTS/VAD/AEC/EOU — those
   want fixtures.*

### My-changes-this-pass specific gate

- `loam/sre/cart_run_table.py` — incomplete-run detection is **count-based FIFO** because
  the spine metadata carries no `run_id` correlating a terminal to a specific fire. This is
  the honest choice (it never under-reports a lost run), but it is an APPROXIMATION when a
  customer runs the same cart many times concurrently. *Gate: confirm the 300s
  `INCOMPLETE_AFTER_S` grace and the count-based pairing match the reliability signal the
  architect wants; if per-run precision is needed, a `run_id` must be threaded onto the
  spine's `cart-*` metadata (allow-list add).*
- `cart_feed._anon_tenant_for` reuses `cohort_gravity.anonymize_tenant` (per-deploy HKDF
  salt). *Gate: confirm the SRE salt is provisioned in the deployed env so attribution is
  stable within a deploy and rotates across deploys.*

---

*End SRE-VOICE-MARIONETTE-BUILD-BURNDOWN-2026-07-04. No deploy. No training. No
`.sks`/cart-index authoring. New code: `loam/sre/cart_run_table.py`,
`tests/sre/test_cart_run_table.py`, `/api/sre/loam/cart-run-table` route, and
`anon_tenant` attribution on the cart-run feed. Everything else in both clusters
was verified against the running tests, not re-authored. Companion oaths:
`SRE-ATTESTATION-2026-07-02.md` (the promise), `LACUNA-SRE-DESIGN-2026-07-02.md`
(the design), `MARIONETTE-1.0-STAMP.md` (the Marionette seal).*

---

## §GATE — SRE Voice-of-Marionette Gate (folded)

# SRE + Voice/Marionette Phase-2 Gate Verdict — 2026-07-04

**Sworn by:** Phase-2 BS-gate / adversarial-verification agent (expert verify → check
stage of the anti-straggler pipeline).
**Gates:** Marcus's landed SRE + Voice/Marionette build
(`SRE-VOICE-MARIONETTE-BUILD-BURNDOWN-2026-07-04.md`) against Priya's ground-truth
baseline (`SRE-VOICE-MARIONETTE-GROUNDTRUTH-2026-07-04.md`).
**Method:** ran the tests on live disk, read the load-bearing code (not the summary),
grepped for silent failures + vendor leaks. No commit, no deploy, no `.sks`/index write.

> Legend — **PASS** = four-question ship check holds, verified against running code.
> **PASS (honest-null)** = correctly returns `service-not-yet-wired`, never fabricates.
> **BLOCKED** = real reason it can't fully land in-tree (deploy/architect), honestly stated.

---

## Part A — Gate results

### A1. #329 cart-run table — **PASS**

| Check | Verdict | Evidence |
|---|---|---|
| `pytest tests/sre/test_cart_run_table.py` | **PASS** | **11 passed** in 0.14s (`.venv/bin/python -m pytest`, 2026-07-04) |
| Full SRE suite (claimed 270) | **PASS — count matches** | `pytest tests/sre/` → **270 passed** in 1.83s |
| `aggregate_events()` is a pure fold | **PASS** | `loam/sre/cart_run_table.py:162` — no I/O, no Loam; folds `EVENT_CART_*` only; docstring states PURE and it is |
| `build_cart_run_table()` honest-nulls when spine unbound | **PASS** | `cart_run_table.py:312-319` returns `CartRunTable(available=False, reason="service-not-yet-wired: SRE substrate not bound")` — never a fabricated zero. Read failure → `available=False, reason="spine-read-failed (degraded)"` (`:325-332`), logged at `log.debug` |
| `failure_rate` honest-null (no fabricated 0.0) | **PASS** | `cart_run_table.py:100-106` returns `None` when `combined <= 0` |
| PII-clean: only `anon_tenant` crosses, raw `operator_id` forbidden | **PASS** | `cart_feed._anon_tenant_for()` (`cart_feed.py:101`) HKDFs via `intelligence/cohort_gravity.anonymize_tenant`; `emit_cart_state` never assembles raw `operator_id` into `meta` (`cart_feed.py:156-168` — only the anon hash is added). Spine backstop `event_spine.py:_validate_metadata()` (`:269`) **raises** `SREEventError` on any key in `_FORBIDDEN_METADATA_KEYS` (incl. `operator_id`, `:118-119`) + allow-list + scalar-only + 256-char clamp |
| Call site (`sakura_cart.py:155`) | **PASS** | `routes/sakura_cart.py:154-162` — `operator_id` sourced from session `current_operator_id(request)` (IDOR-fixed v2.20.0-S1, `:125`), passed to `emit_cart_state`; sim runs excluded |
| 300s-grace incomplete detection is count-based FIFO + honestly approximate | **PASS** | `cart_run_table.py:229-258` — `INCOMPLETE_AFTER_S = 300.0`; oldest-fire-first pairing because "the spine carries no run_id"; docstring + burndown both label it an APPROXIMATION, not exact. Never under-reports a lost run (honest bias). |
| Endpoint doesn't fabricate on error | **PASS** | `sre/routes.py:437` `cart_run_table_endpoint` — `_require_sre_user` gate, unknown period → 400, exception → 500 `cart_run_table_failed` (not a 200-with-zeros) |

### A2. #330 P0 alerting — **PASS**

| Check | Verdict | Evidence |
|---|---|---|
| Evaluator genuinely evaluates (not hollow) | **PASS** | `lacuna_sre/alerting.py:evaluate()` (`:62`) — 7 real rules with real thresholds (cart-p99, verb-p95, k-floor, replica-lag, cap-forgery, SLO-burn, Δ_NS); each guarded by `isinstance(...)` so a missing metric → NO alert (honest-null), never silent-ok |
| Paging sink STAYS honest | **PASS (honest-null)** | `alerting.py:PagingSink.page()` (`:146`) returns `{"delivered": False, "escalate": "service-not-yet-wired"}` — no fabricated `delivered:true`, no fake transport |
| p90 actually exists | **PASS** | `latency-p90-by-verb` allow-listed `sre/timeseries.py:91` + drained `:729` (`float(stats["p90"])`); computed in `latency_ring` |
| `duration_ms` stamped at `verb_backings.py:_audit()` | **PASS** | `_latency_start` (`:83`) stamps `t_received` on `received` audit; `_latency_finish` (`:98`) computes `duration_ms = (time.monotonic() - start) * 1000.0` at terminal outcome → `record_verb_latency` (`:113`). Bracketed by `_audit()` (`:225-227`) |
| Health oracle never fabricates green | **PASS** | `health_oracle.py` — no data → `okay=None` (UNKNOWN, `:106`), green only after it actually looked (`:212-226`) |
| gap-closure + deep-consider suites | **PASS** | `pytest test_sre_gap_closure.py test_deep_consider_window.py` → **35 passed** |

### A3. Silent-failure hunt — **PASS**

Grepped every changed-in-my-scope Python file for bare/swallowed exceptions.
All `except` blocks in the new/changed SRE code **log and degrade to honest-null**;
none mask a real failure behind a green return:

- `cart_run_table.py:325,358` — `log.debug` then `available=False` / `None`.
- `cart_feed.py:90,116,193` — `log.debug` then no-op `None` (feed is non-critical; never breaks a cart run).
- `verb_backings.py:94,114` — `except: pass` on latency capture ONLY (documented non-critical; a dropped latency sample is not a masked error).
- `health_oracle.py:252,273` — read/persist helpers return `None`/`False` = "no data" (honest-null), consumed as UNKNOWN.

Honest-null model paths return the null on raw input, never a fabricated score/transcript
(verified in A5 for the Rust voice engine; OMR/AMT/HAL confirmed by ground-truth §2/§3 unchanged this pass).

### A4. Scope-honesty — **PASS (with the burndown's own caveats intact)**

- `SRE_MONITORING_ENABLED` off-by-default = **dark pipeline, NOT "monitoring on."** The burndown
  (#356 gap 5) and ground-truth §1 both state this plainly; no doc line claims the pager is live.
  Flipping the flag is a deploy act, correctly out of scope.
- #331 ticketing / #332 fleet / #333 HAL are **BUILT (unreachable)** — import-reachable + unit-tested
  but **no HTTP route**. The burndown labels each "BUILT (unreachable)" / "HONEST-NULL (no route)";
  none reads as "usable." **PASS** — the honesty is in the doc.
- #515/#516 OMR/AMT are **offline format-transcoders, not live capture** — burndown + ground-truth
  §3 both flag the scope gap. No "we scan sheet music" overclaim. **PASS.**
- Undisclosed-but-honest: `sre/deep_consider_queue.py` gained `read_configured_window_s` +
  water-mark defaults (not in the burndown ledger). Honest-null (unparseable → documented default,
  clamped), test-covered by new `test_deep_consider_window.py`. Not a #329/#330 deliverable — noted, not a fail.

### A5. No commit / no deploy / no `.sks`-index write — **PASS**

- `git log -1` = `50d3ddc0 index regen: fold 500 hardest carts into 1.0 seal` — **unchanged**, no new commit; nothing staged (`git diff --cached` empty).
- No `index.json` / `sakura-corpus.jsonl` / `breadcrumbs` / `manifest.js` in `git status` — **no cart-index write.**
- No flyctl / deploy invoked.
- One untracked `.sks` exists (`curator-web/src/scheme/carts/scenes/demo/waltz-of-the-flowers.sks`) — **NOT mine** (belongs to the parallel render/scheme agent; outside my scope). I did not touch `curator-web/src/scheme`.

---

## Part B — Vendor-model leak fixes — **FIXED, cargo clean**

Priya named 2 leaks; the tree scan found **6 leak sites** in non-adapter Rust
(Priya's grep caught the two most prominent). Fixed all. The designated **adapter modules**
(`tts.rs`, `vad.rs`, `eou.rs`, `audio.rs`, `stt/*.rs`) self-declare a "vendor name boundary
... ONLY here" — that is the codebase's established wire-call-equivalent convention, so vendor
names inside them are **allowed and left intact** (not over-scrubbed).

| File:line | Before | After |
|---|---|---|
| `curator-voice/src/lib.rs:10-13` | `via ort / Silero` · `SmartTurn end-of-utterance` · `OrtParakeet stub + MlxSidecar stub` · `live TTS (Kokoro via ort)` | `via ort` · `semantic end-of-utterance` · `in-process ONNX stub + MLX sidecar stub` · `live TTS via ort` |
| `curator-voice/src/seam.rs:67` | `Maps to Kokoro \`speed\`.` | `Maps to the live TTS \`speed\`.` |
| `curator-voice/src/seam.rs:71` | `route to cached Parler` | `route to the cached expressive bridge` |
| `curator-voice/src/seam.rs:177` | `semantic EOU (SmartTurn) is the fast path` | `the semantic EOU model is the fast path` |
| `curator-voice/src/turn.rs:66` | `Silero VAD said "speech is present"` | `the generic VAD said "speech is present"` |
| `curator-voice/src/turn.rs:102` | `signal from SmartTurn or silence fallback` | `signal from the semantic EOU model or silence fallback` |
| `curator-voice/src/params.rs:24` | `semantic EOU model (SmartTurn) over silence` | `semantic EOU model over silence` |
| `curator-voice/src/engine.rs:54` | `Path to the STT model file (for OrtParakeet).` | `Path to the STT model file (for the in-process ONNX backend).` |

All edits are **comment-only** (no functional change).
`engine.rs:198` `§CLAUDE.md` is a reference to the repo's own convention file, NOT the Claude
vendor — left as-is.

**Post-fix scan:** `grep -rniE '(kokoro|parler|parakeet|silero|smartturn|nvidia|sonnet|opus|
qwen|llama|mistral|gemini|...gpt|0.6b|82m)' src/` excluding adapter modules → **zero** hits.

**Compile:** `cargo check` in `curator-voice/` → **Finished dev profile, 2.92s. 5 warnings
(pre-existing dead-code on stub fields), 0 errors.** No test failures introduced (the crate has
0 unit tests per ground-truth §2 — a separate open item, unchanged by this pass).

---

## Verdict

**Part A: PASS.** #329 and #330 satisfy the four-question ship check on live code — real path,
real test (270 + 35 SRE tests green), honest-null at every unbound/error boundary, PII-clean
attribution enforced at both the emit site and the spine backstop. Scope claims are honest
(dark-flag ≠ monitoring-on; unreachable ≠ usable; transcoder ≠ live capture). No commit, no
deploy, no index write.

**Part B: FIXED.** All 6 vendor/model leak sites outside the adapter boundary neutralized to
capability-neutral vocabulary consistent with the codebase; `cargo check` clean.

**Remaining open (honest, not this gate's scope):**
- `SRE_MONITORING_ENABLED` still off — proving the pager fires in a deployed config against a
  disparate SRE Loam is a **deploy act** (BLOCKED in-tree, by design).
- #331/#332/#333 need mounted HTTP routes to move from "unreachable" to "usable."
- `curator-voice` has **0 unit tests** — compile ≠ correctness for STT/TTS/VAD/EOU (open item).

---

*End SRE-VOICE-MARIONETTE-GATE-2026-07-04. No deploy. No commit. No `.sks`/index write.
Companion to `SRE-VOICE-MARIONETTE-BUILD-BURNDOWN-2026-07-04.md` (build) and
`SRE-VOICE-MARIONETTE-GROUNDTRUTH-2026-07-04.md` (baseline).*

---

## §REMAINDER — SRE Voice-of-Marionette Remainder Build (folded)

# SRE + Voice + Marionette — Remainder Build — 2026-07-04

**Agent:** backend build agent (buildable-remainder lane of the anti-straggler pipeline).
**Scope:** close the buildable remainder of the Lacuna SRE + Voice + Marionette clusters
left open by the gate (`SRE-VOICE-MARIONETTE-GATE-2026-07-04.md` "Remaining open").
**Method:** ground-truthed every premise against running tests + load-bearing code before
building. In-tree only. NO deploy/flyctl. NO commit. NO training. `SRE_MONITORING_ENABLED`
untouched. Money-movement left honest-null + architect-pending (no route). Vendor/model-size
names kept out of every new file.

Legend — **BUILT** = new code + tests, green. **ALREADY-DONE** = found built + tested, no
delta. **HELD** = a real reason it can't land in-tree (deploy/architect/model), honestly stated.

---

## Baselines (ground-truth, pre-build)

| Suite | Before | After | Δ |
|---|---|---|---|
| `curator-api` SRE suite (`pytest tests/sre/`) | 270 | **288** | +18 (route tests) |
| `curator-voice` cargo (`cargo test`) | 0 | **24** | +24 (honest-null + seam) |
| `curator-web` marionette (`vitest run src/scheme/marionette`) | 169 | **200** | +31 (voice tests) |

---

## Item 1 — Mount built-but-unreachable SRE routes — **BUILT**

**Ground-truth:** #331 ticketing / #332 fleet / #333 HAL modules were import-reachable +
unit-tested but had NO HTTP route (gate §A4 "BUILT (unreachable)"). Confirmed by grep: no
`@router` referenced `ticketing`/`hal`/`fleet` before this pass.

**Built** — `curator-api/curator_api/sre/routes.py` (added ~330 lines before `/privacy`):

| Route | Method | Contract |
|---|---|---|
| `/api/sre/tickets` | GET | open incident queue; `available:true`, `count`, `tickets` |
| `/api/sre/tickets` | POST | file incident; **PII in `detail` → 400 `pii_refused`** (via `TelemetryLeak`), never silently dropped |
| `/api/sre/tickets/delegate` | POST | Sakura-delegated incident (`source: sakura-delegate`) |
| `/api/sre/tickets/{id}/ack` | POST | lifecycle → `acked`; unknown id → 404 |
| `/api/sre/tickets/{id}/resolve` | POST | lifecycle → `resolved`; drops off open queue |
| `/api/sre/hal/status` | GET | **honest-null**: no model env → `available:false`, `reason` contains `service-not-yet-wired` |
| `/api/sre/hal/dry-run` | POST | ALWAYS `dry_run:true`, `stopped_at:"model-call-boundary"`, `backend_available:false` — assembles the prompt, never fires inference |
| `/api/sre/fleet` | GET | registry list; `available:true`, `instances:[]` |
| `/api/sre/fleet/ban` | POST | **honest-null**: `executed:false`, `escalate:"service-not-yet-wired"` |
| `/api/sre/fleet/token-delivery` | POST | **honest-null**: `executed:false`, `escalate:"service-not-yet-wired"`, `action:"token-delivery"` |

**HARD HOLDS enforced:**
- **No live HAL inference route.** There is deliberately no non-dry-run HAL endpoint; a `POST
  /api/sre/hal/run` returns 404/405 (asserted). Inference is wired-later.
- **No money-movement route.** `/api/sre/fleet/{refund,payment,chargeback}` are NOT mounted —
  a missing route (404/405) is the honest posture; money movement stays honest-null +
  architect-pending inside the module, no HTTP surface. (Asserted, parametrized.)
- Every route is behind `_require_sre_user(request)` (401 when anon — asserted for
  tickets/hal/fleet).
- Ticket queue + fleet registry are process-singletons, best-effort Cortex-backed; if the
  segregation guard trips or no key, they run ephemeral (honest degrade, not a fabricated
  durable claim).

**Tests** — `curator-api/tests/sre/test_lacuna_sre_routes.py` (NEW, 18 tests): auth gate (401),
ticket file→queue→ack→resolve lifecycle, PII refusal (400), HAL status honest-null, HAL dry-run
stops at boundary, no-live-HAL-route, fleet registry + ban/token-delivery honest-null, and
parametrized `test_money_movement_has_no_route`. **Result: SRE suite 270 → 288, all pass (2.10s).**

---

## Item 2 — curator-voice unit tests (was 0) — **BUILT**

**Ground-truth:** gate §Part B / "Remaining open" — the crate compiled but had 0 unit tests;
compile ≠ correctness for STT/TTS/VAD/EOU. The honest-null adapters + the pure seam logic are
testable without model weights.

**Built** — `curator-voice/tests/seam_and_honest_null.rs` (NEW, 24 tests):
- **Model-boundary honest-null on RAW input** (the load-bearing assertion): STT in-process +
  sidecar backends return `stt-not-yet-wired` on raw audio (never a fabricated transcript); TTS
  synthesize → `tts-not-yet-wired`; VAD / EOU / cached-bridge → their `*-not-yet-wired` null.
- **Pure/deterministic seam:** UpMessage/DownMessage postcard round-trip is byte-exact (4-byte
  LE length prefix); `SEAM_VERSION == 1`; `VoiceProfile::default() == Utility`; tone resolution
  bounded 0.7–1.3; `style_needs_cached_path`; `no_scheme_guard`; turn-machine state transitions
  (QUIET→STARTING→SPEAKING→STOPPING, barge-in reset); dual-VAD honest-null; AEC pass-through
  identity; PolicyParams / EngineConfig defaults.
- No vendor/model names in the test file (grep-clean).

**Result: cargo 0 → 24 tests, all pass.** `cargo check` clean (pre-existing dead-code warnings
on stub fields only).

---

## Item 3 — #661 speech-wiring through Marionette — **BUILT (tests) / boundary HELD**

**Ground-truth:** `curator-web/src/scheme/marionetteVoice.js` (Plane B seam) is FULLY BUILT —
all 13 `voice/*` verbs (say/bridge/stop/backchannel/listen/dictate/mute/wake/tone/rate/identity/
state/level), wired into the interpreter at `src/scheme/index.js:801`, honest-null via
`_dispatchDown` (returns `['escalate','service-not-yet-wired',…]` when `!_engineConnected`).
It had **NO test file** — the #661 testing gap.

**Built** — `curator-web/src/scheme/marionetteVoice.test.js` (NEW, 31 tests):
- **Honest-null at the model boundary** (the load-bearing assertion): with the real
  `_dispatchDown` and no engine, all 8 dispatching verbs return
  `['escalate','service-not-yet-wired',{verb}]` — asserted per-verb; a `voice/listen` carries a
  *reason*, never a fabricated `final_text`.
- **Local-apply honest exception:** `voice/tone`/`voice/rate`/`voice/identity` store a local
  default + return `'ok'` with an `engine-not-connected` note (NOT a fabricated engine success);
  bad tone/rate → `bad-arg`.
- **Security:** `voice/identity :signature` with no capability token falls back to `utility` — a
  cart cannot self-escalate to the signature voice.
- **No-Scheme-in-TTS guard:** parens / namespace tokens → `scheme-in-tts` (never dispatched);
  clean prose dispatches; empty text → `bad-arg`, no dispatch.
- **Delivery params:** tone/style normalized, pace clamped 0.7–1.3; prior `voice/tone` default
  carries into a later `voice/say`.
- **Deterministic `'speech-done` scheduling:** `voice/say :key` schedules a future bus
  completion (frame-counted, not wall-clock); advancing `hostTick` to `doneAt` fires the
  completion exactly once — this is the replay-safe sequencing seam `(when-done …)` relies on.
- **Dictate mic-button path:** requires `:into` sink; `params.allow_interruptions:false`; no LLM
  turn.
- Voice-tap (#640 replay seam) inert until armed; installer skip-if-bound; manifest = 13 verbs.
- No vendor/model names (grep-clean).

**HELD — model/process boundary (correct, by design):** `startEngine()`/`stopEngine()` in
`marionetteVoice.js` are Node/Electron `child_process` stubs (`TODO(next-lane/plane-b)`); the
Unix-socket connect + postcard write to Plane A are not implemented. Wiring live speech is a
Node-harness + running-Rust-engine act, not an in-tree buildable — so the honest posture is
exactly what's tested: every verb is `service-not-yet-wired` until the engine is up. **Result:
marionette 169 → 200, all pass.**

---

## Item 4 — Marionette lifecycle/events (#585 / #588 / #589 / #601) — **ALREADY-DONE**

Ground-truthed all four; each is BUILT and test-covered against the real interpreter. No
buildable delta — genuine already-done, not a gap.

| Ticket | Module | State (file:line) | Tests |
|---|---|---|---|
| **#585** sprite lifecycle + sensing | `marionetteWorld.js` | spawn/despawn (deferred mid-step), `entity/goto!` FSM → `'entity/state-change`, `entity/damage!` ≤0 → `'entity/died` + despawn, `world/step`, sensing predicates (overlaps/collisions/distance/nearest/input), snapshot/restore/hash determinism (`:1106-1208`) | `marionetteWorld.test.js` (58) |
| **#588** brain / decision layer | `marionetteBrain.js` | blackboard (`ai/bb-*`), behavior-tree nodes (seq/sel/par/invert/force/act/cond/tick), `ai/utility`, `ai/decide`, `ai/policy` | `marionetteBrain.test.js` (15) |
| **#589** completion-events + carts-wait | `marionetteBus.js` | `emit`/`scheduleCompletion`/`onEvent`/`whenDone`/`everyTick`/`hostTick` deferred-fire, stable sort key (frame,priority,seq,corr), scene scope teardown, overflow reported (no silent hang) | `marionetteBus.test.js` (23) |
| **#601** big-bang game loop | `marionetteScene.js` | prefabs, `scene/load`/`scene/grid`, HtDP big-bang (on-tick/on-key/to-draw/stop-when/check-with/with-seed), own per-frame fuel, honest-null symbols | *(no dedicated test file — see below)* |

**Note (undisclosed, honest):** `marionetteScene.js` (#601) is BUILT + interpreter-wired
(`index.js:781`) but has no dedicated test file. It's out of the #585/#588/#589 remainder scope
and is exercised indirectly via the tape/recorder path; flagged here as a known follow-up, not a
gap I was asked to close. JS harness stays headless-surface-only — no MOTION was authored in JS
this pass.

---

## Verdict

- **Item 1 (SRE routes): BUILT.** 10 routes mounted, 18 tests, SRE suite 270→288. Money-movement
  has no route (asserted); HAL has no live-inference route (asserted); all honest-null boundaries
  return `service-not-yet-wired`.
- **Item 2 (curator-voice tests): BUILT.** 0→24. Every adapter honest-nulls on raw input; seam is
  byte-exact + deterministic.
- **Item 3 (#661 voice tests): BUILT.** 0→31 for `marionetteVoice.js`. Model boundary honestly
  null; live-engine wiring HELD (Node-harness + running Rust engine, out of in-tree scope).
- **Item 4 (#585/#588/#589/#601): ALREADY-DONE.** All built + tested against the real
  interpreter; no buildable delta.

**Honest-null boundaries verified:** SRE HAL status/dry-run, fleet ban/token-delivery (Python);
STT/TTS/VAD/EOU/bridge adapters (Rust); all 8 dispatching `voice/*` verbs (JS). None fabricates a
score/transcript/success.

**No commit. No deploy. No `.sks`/index write. `SRE_MONITORING_ENABLED` untouched.
Money-movement architect-pending. Vendor/model names kept out of every new file.**

*Companion to `SRE-VOICE-MARIONETTE-GATE-2026-07-04.md` (gate) and
`SRE-VOICE-MARIONETTE-BUILD-BURNDOWN-2026-07-04.md` (build).*

---

# §SLAT — Marionette state on the SLAT wire (added 2026-07-12)

> Cross-refs: `~/code/lacuna-labs/research/lacuna-docs/specs/SLAT-1.0.SPEC.md`, `CORTEX-1.0.ENG.md §SLAT`, `HELLO-SURFACE-1.0.ENG.md §ARTIFACT.15`. Task #62 landed the ENG-tree surface pass; this section threads SLAT through Marionette's control rig, mood snapshots, animation events, and the letter-composition envelope. Additive to §STAMP, §FINISH-DESIGN, §RESEARCH; no deletes.

## §SLAT.1 — Doctrine

Marionette is the direct-control orchestration layer — the sprites, the moods, the physics rigs, the set-and-check-in autonomy pattern from §STAMP §4. Every piece of Marionette state that leaves the running process — persistence, mailbox, Cortex slice, mood snapshot — travels as SLAT.

The load-bearing property: control-rig state is a Scheme value. SLAT is the wire form for Scheme values. Therefore the state a director sends and the state a walker checks in with are the same shape, and the reader on either side is the same reader that reads Sakura's own code.

## §SLAT.2 — Control-rig state as `artifact-state`

The rig state — sprite positions, current clip, mood, current goal — serializes as `artifact-state` (SLAT §4.1 row 13) with `:type marionette`:

```slat
(artifact-state
  :type  'marionette
  :id    "rig-walker-042"
  :state (rig
           :sprite  'walker
           :pose    (:x 320 :y 180 :facing 'east)
           :clip    'walk-loop
           :mood    (:valence 0.6M :arousal 0.4M)
           :goal    'reach-target
           :target  (:x 640 :y 180))
  :parent-card "shop-status"
  :ts    #inst "2026-07-12T04:22:00Z"
  :cid   #b64 "…")
```

Cortex writes accept this shape directly. `slat/read` on the persisted line hands a native `Rig` object to whoever asks — the animation loop, the mood system, the observer. Round-trip is byte-stable (SLAT §6.1) so save/reload is deterministic.

## §SLAT.3 — Mood snapshots as `snapshot` slats

Marionette moods (Blossom / Sky / Mint / … — the 16 personalities per §STAMP §4b) persist as SLAT §4.1 snapshot records:

```slat
(snapshot
  :ts      #inst "2026-07-12T04:22:00Z"
  :subject 'marionette.walker-042.mood
  :body    (mood :personality 'blossom :valence 0.72M :arousal 0.38M))
```

A mood transition writes a `delta` slat with `:changes`. Cortex ingests both; the Book of Self chapter that teaches Sakura what her moods look like on disk reads exactly these slats.

## §SLAT.4 — Animation events as `event` slats

Every tick, every clip transition, every reaction fires an event on the bus:

```slat
(event
  :ts    #inst "2026-07-12T04:22:00Z"
  :kind  "motion.tick"
  :rig   "rig-walker-042"
  :frame 87
  :clip  'walk-loop
  :bounds (:x0 316 :y0 176 :x1 328 :y1 190))
```

```slat
(event
  :ts    #inst "2026-07-12T04:22:01Z"
  :kind  "motion.clip.transition"
  :rig   "rig-walker-042"
  :from  'walk-loop
  :to    'idle-breathe
  :reason 'target-reached)
```

Loam ingest surfaces these into projections (LOAM §SLAT.3) so the SRE dashboard can show clip-histograms per rig without any translator between Marionette and the observability spine.

## §SLAT.5 — The set-and-check-in envelope

§STAMP §4 describes the pattern: director sets a goal, walker acts autonomously, walker checks in periodically. Wire form:

**Director → walker (goal set):**
```slat
(message :v 1
         :from 'director
         :to   'walker/rig-042
         :ts   #inst "2026-07-12T04:22:00Z"
         :detail (goal-set :goal 'reach-target :target (:x 640 :y 180)))
```

**Walker → director (check-in):**
```slat
(message :v 1
         :from 'walker/rig-042
         :to   'director
         :ts   #inst "2026-07-12T04:22:05Z"
         :detail (check-in :progress 0.4M :state (rig :pose (:x 456 :y 180))))
```

The reader dispatches on `car` (`message`), then on `slat-get :detail` head (`goal-set` or `check-in`). No JSON envelope; no `_type` sniffing.

## §SLAT.6 — Letter-composition (Cindy escalation pattern)

The Cindy escalation pattern — Marionette composes a letter to the operator when something needs judgment — travels as a signed slat envelope. The letter body is a slat record; the envelope carries the signing identity so the operator can verify the letter came from the process that claims to have sent it:

```slat
(signed
  :body        (letter
                 :from      'marionette
                 :to        'operator
                 :subject   "Rig-042 stalled — asking judgment"
                 :body-text "The walker has been at the same tile for 30 seconds…"
                 :context   (rig-status :rig "rig-walker-042" :stall-duration 30)
                 :suggested-actions ((reset-rig) (change-goal) (pause)))
  :signed-by   "marionette@lacuna"
  :signature-algo "ed25519"
  :signature   #b64 "…"
  :cid         #b64 "…"
  :nonce       #b64 "…"
  :ts-signed   #inst "2026-07-12T04:22:30Z")
```

Envelope shape per SLAT §6.2. The operator surface renders the letter; when the operator picks a suggested action, the response goes back as a signed slat carrying the operator's choice and a fresh nonce. Cortex logs both sides on the audit trail.

The Book of Self chapter on Sakura knowing her own limits references exactly this pattern — Sakura writes a letter (a slat), signs it, sends it, waits.

## §SLAT.7 — Cross-references

- SLAT primitives — `SLAT-1.0.SPEC.md §3`
- `artifact-state` — `SLAT-1.0.SPEC.md §4.1` row 13
- Signing envelope — `SLAT-1.0.SPEC.md §6.2`
- Snapshot + delta — `SLAT-1.0.SPEC.md §4.1` rows 5, 6
- HELLO-SURFACE §ARTIFACT.15 — how artifact-state moves through the surface
- CORTEX §SLAT — how the Cortex bus receives Marionette events
- LOAM §SLAT.3 — the projection pattern that consumes motion events
- Book of Self — the letter-writing chapter uses exactly this envelope
