# needs-alfred — Priya (media + simulation cluster) — 2026-08-04

Cases where the ENGINE and the REFERENCE disagree, or where a repair would be an
authoring decision rather than a claim fix. **Books were not edited to paper over
any of these.** No engine change was made.

---

## 1. `entity/untag!` / `entity/tag!` — reference says void, engine returns a record

- Reference `scheme/reference/24-entity.slat`: `(entity/untag! id tag) -> void`,
  `(entity/tag! id tag) -> void`.
- Engine `lib/game/world.js:942-943`:
  ```js
  def('entity/tag!',   (e, t) => { const r = ent(e); if (!r) return false; r.tags.add(nm(t));    return r })
  def('entity/untag!', (e, t) => { const r = ent(e); if (!r) return e;     r.tags.delete(nm(t)); return r })
  ```
  Returns the entity record on success; on an unknown id `tag!` returns `#f` but
  `untag!` returns **the argument you passed in**. Three different return shapes
  from two sibling verbs the reference says are both void.

`book-of-arcade-games/appendix-verbs-cookbook` claimed `#t` / `#f`, which matches
neither. I rewrote that section to teach the *effect* and to state that the result
is void and must not be branched on — true under the reference and under the
engine as it stands today. **Not fixed in the engine**: changing a return type is
a language change, and `lib/game/game.js:179` carries a comment about a previous
tag!/untag! disagreement, so this has history I should not overwrite.

**Decision needed:** conform the engine to `-> void`, or amend the reference.

## 2. Tag state is unobservable in the default environment

`entity/has-tag?` is defined only in `lib/game/game.js:424`, against
`game.entities`. `entity/tag!` / `entity/untag!` in `lib/game/world.js` operate on
a *different* registry. In a default `./bin/motoi run`, `entity/has-tag?` is
`unbound symbol`, so there is no way to observe what `entity/untag!` did.

That is why the arcade cookbook example above verifies `entity/alive?` instead of
the tag itself. A verb whose only effect cannot be read back cannot be tested,
which is precisely how a wrong claim survives a gate.

**Decision needed:** is there one entity registry or two? If one, which module owns it?

## 3. `grid/card-center` — reference arity does not match the engine

- Reference `scheme/reference/30-grid.slat`: `(grid/card-center id) -> pair or #f`
  — "Get the center coordinates of a card by ID." One argument.
- Engine: `(grid/card-center 2 2)` → `(2 2)`. Two arguments, coordinates in and out.

Both are self-consistent; they are not the same verb. Not touched.

## 4. `book-of-animation/appendix-verbs-cookbook` shadows real engine verbs

The chapter opens with a Scheme prelude that **redefines** `camera-set!`,
`camera-home`, `camera-scale`, `camera-state`, `camera-center-on`, `grid/clear`,
`grid/card-center` and others as book-local shims. Those verbs are all really
bound in the engine, and the shims do not agree with them:

| verb | engine (and reference) | chapter shim |
|---|---|---|
| `camera-state` | `((x 0) (y 0) (k 1))` | `((\"x\" 0) (\"y\" 0) (\"zoom\" 1) (\"shake\" 0))` |
| `camera-set!` | unspecified | 3-element list |
| `camera-home` | unspecified | 2-element list |
| `grid/clear` | unspecified (`-> null`) | `ok` |

So the appendix documents the shim, not the language, and a reader copying from it
gets code whose return values do not exist. I repaired the claims to the values the
chapter actually produces and corrected the prose that contradicted the reference
(notably `camera-home`, which the chapter said returned to a home recorded by
`camera-set!`; the reference says it returns to the **origin**, and the shim agrees).

**Decision needed:** delete the shim prelude and re-author the appendix against the
real verbs? That is a rewrite of a 900-line chapter, not a claim repair, so I left
the shims in place.

## 5. `world/attract!` — the reference and the engine describe two unrelated verbs

This is the worst one I found. Same name, two subsystems.

- Reference `scheme/reference/72-world.slat:95-100`:
  `(world/attract! id cx cy strength) -> void` — "Pull an entity toward a point
  (cx, cy) using a softened inverse-square force… gravity wells, vacuum effects,
  homing behavior, and **orbital mechanics**."
- Engine `lib/game/world.js:801`:
  ```js
  def('world/attract!', (proc) => {
    // Attract mode: replay a recorded tape headless as a demo. We just run
    // the setup proc again (the caller usually feeds recorded input).
    if (proc) callProc(proc, [])
    return undefined
  })
  ```
  It is a **tape-replay** verb taking a thunk. It sits in the tape block
  (`world.js:726`, "record / replay / attract mode"), not the physics block.

Consequence: `(world/attract! b1 400 300 50)` — the reference's own signature —
evaluates `b1` as a procedure, returns `undefined`, and applies **no force**.
Verified: a body pinned at (100,100), attracted toward (400,300) with strength
5000, stepped 30 times, ends at `(100 100)` with velocity `(0 0)`.

There is no inverse-square attraction anywhere in the world surface, so nothing
in `scheme-books/` can build an orbit. **`book-of-simulation-games/ch13`
§13.6 "Same energy, different topology, different fate" is dead on this** — its
three-body setup produces two straight-line falls, so both configurations return
`((A (1)) (B (1)))` (one component, zero loops) instead of the bound/unbound
contrast the chapter is written around. Per the brief this is shape (c), so I
left the block and its claim alone rather than paper the engine bug into the
book. It is the one remaining mismatch in my 14 files.

**Decision needed:** rename the tape verb (e.g. `world/tape-attract!`) and
implement the documented physics `world/attract!`, or amend the reference and
re-author ch13 §13.6 around a force the engine actually has.

Two smaller wrong calls in that same block WERE genuine book bugs and are worth
knowing even though I could not land the fix:
- `(entity/pos (world/find 'body-1))` — `world/find` returns a **list** of ids
  (`72-world.slat:626`), so this feeds a list to `entity/pos` and gets
  `entity-not-found` 40 times. Needs `car`.
- `(topo/betti topo-A 50)` — `topo/betti` is `(topo/betti complex)`, one
  argument, and `topo-A` is a *filtration*, not a complex.

## 6. `topo/unknot?` returns `unknown-beyond-bound`, reference says boolean

- Reference `scheme/reference/67-topo.slat`: `(topo/unknot? knot-diagram) -> boolean`,
  caveat: "diagrams with 1+ crossings **always return `#f`**".
- Engine: `(topo/unknot? (topo/knot '()))` → `#t` (agrees), but
  `(topo/unknot? (topo/knot '((1 4 2 5) (3 6 4 1) (5 2 6 3))))` → `unknown-beyond-bound`.

An honest-null is defensible language design, but it is not what the reference
says, and `unknown-beyond-bound` is truthy in Scheme — `(if (topo/unknot? k) …)`
takes the "yes it is the unknot" branch for a trefoil. I kept the 0-crossing case
in ch13 §13.4 and avoided the nonzero case rather than document a value the
reference contradicts.

**Decision needed:** conform the engine to `#f`, or amend the reference to
document the third answer (and say plainly that it is truthy).
