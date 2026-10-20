# needs-alfred — two engine silent-wrongs found by gating the lib smoke tests

Found 2026-08-04 while building `scratch/build_lib_tests_gate.py`. Both are
shape (c): the engine returns an answer-shaped nothing or a wrong type, and
never raises. Neither lib file was edited — the assertions are simply not
emitted into CPT ZERO.

## 1. `topo/components` returns `()` for a graph

`67-topo.slat:793` specifies `(topo/graph num-vertices edge-list)`, and its own
expert example passes the resulting graph straight to `topo/components`:

```scheme
(topo/graph 6 (list (list 0 1) (list 1 2) (list 3 4) (list 4 5)))
(topo/components g)          ; the reference's own example
```

Run with correct arity, that gives `()`:

```
(topo/components (topo/graph 4 (list (list 0 1) (list 2 3))))   → ()
```

The same call on a *complex* works:

```
(topo/components (topo/close (topo/complex '((0 1) (2 3) (4 5)))))
  → (("0" "1") ("2" "3") ("4" "5"))
```

So `topo/components` handles a complex but silently returns empty for a graph,
while the reference documents both. Two vertices in one component is a real
answer; `()` is an answer-shaped nothing.

The reference is internally inconsistent here — `:signature` says `complex`,
the `topo/graph` example passes a graph. **That is the decision to make:** either
`topo/components` accepts a graph (fix the engine) or it does not (fix the
`topo/graph` example). I did not pick.

## 2. Vertex ids come back as strings

Every component is a list of *strings*, not the integers that went in:

```
(topo/components (topo/close (topo/complex '((0 1 2)))))
  → (("0" "1" "2"))
```

The reference note for that exact example reads "one component: {0, 1, 2}" —
integers. So `(member 0 (car comps))` fails where a reader would expect it to
hold. Same shape as the `entity/all` stringification, except there the
reference explicitly documented strings and this one does not.

## What was done instead

`lib/game/game-extras.js` and `lib/math/topo.js` were NOT edited. The gate
verified 151 of 153 lib assertions and dropped these 2, so neither reaches
CPT ZERO. Rerun `python3 scratch/build_lib_tests_gate.py` after any fix — the
file shrinks to nothing as lib is repaired.

Note the `game/ttt-value` drop is a *stale claim*, not an engine bug: the lib
says `'draw` for `(x o - - x - - - o)`, but X to move has a fork at square 6
(threatening 0-3-6 and 2-4-6), so `'x-win` is correct under the minimax
semantics `28-game.slat:1189` documents. Safe to fix the literal in lib.
