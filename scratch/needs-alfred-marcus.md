# needs-alfred — Marcus (math cluster book-claim repair, 2026-08-04)

Shape-(c) silent-wrongs found while repairing the math cluster. Per the brief I
did NOT edit any book to match these. Two I fixed in the engine (bottom of this
file); the rest need your call.

Every entry names the check that would fail if I were wrong.

---

## OPEN — engine is wrong, reference is clear

### 1. `ops/simplex` cannot detect infeasibility

`lib/system/ops.js` — the tableau builder bails the moment any RHS is negative:

```js
if (row[cols-1] < 0) return sym('needs-phase-1')
```

There is no phase-1. The reference (`scheme/reference/47-ops.slat`) says:

    (ops/simplex lp-artifact) -> solution-map | escalates 'infeasible | 'unbounded | 'fuel-budget

So a genuinely infeasible LP and a merely-needs-phase-1 LP are indistinguishable,
and `'infeasible` is unreachable in standard form.

Check that fails if I'm wrong:
```
MOTOI_HOME=/tmp/mx ./bin/motoi eval "(ops/simplex (ops/lp 'maximize '(1 1) '((1 1) (-1 -1)) '(4 -10)))"
;; => needs-phase-1     (the reference promises 'infeasible)
```

Impact on the book: §1.2 and §1.3 of `ch-advanced-09` now claim `needs-phase-1`,
which is the truth but not the lesson those sections were written to teach. When
phase-1 lands, both sections want rewriting.

### 2. `ops/mip-solve` answers `infeasible` for a feasible problem

Its branch-and-bound drops any node with a negative RHS (`if (b2[r] < -1e-9) return`),
which is the same phase-1 hole one layer up. The diet LP in §1.3 is feasible —
(5,0) and (0,2.5) both satisfy it, cost $5 — and `ops/mip-solve` says `infeasible`.

A wrong answer, not an honest null. This is the class of defect that cost the
last run.

### 3. `alg/invert` — two different verbs are fighting over the name

`lib/math/alg-groups.js:278` binds it as a group-element inverse:

```js
def('alg/invert', (G, x) => { if (!isList(G)) return x; return elementInverse(G, x) })
```

`scheme/reference/03-alg.slat:1007` documents it as pitch-class-set inversion:

    (alg/invert pcset [axis]) -> inverted-pcset

The group binding wins, so the REFERENCE'S OWN EXAMPLE returns junk:

```
MOTOI_HOME=/tmp/mx ./bin/motoi eval "(alg/invert (alg/pcset '(0 1 2)))"
;; => 0          (reference :note says {0, 10, 11})
MOTOI_HOME=/tmp/mx ./bin/motoi eval "(alg/invert (alg/triad '(0 4 7)))"
;; => <empty>    (reference :note says {0, 5, 8})
```

This is a language decision, not a bug fix: either rename one of the two, or
dispatch on the argument's tag. I did not pick. `ch-advanced-04` §on inversion
(`T-inv`) stays broken until you do.

### 4. `alg/perm-parity` — the reference contradicts itself

`lib/base/alg.js:577` returns the sign ±1. The reference says both things:

- `03-alg.slat:2586` — `:signature "(alg/perm-parity perm) -> symbol"`, and two
  `:examples` whose notes say the result is `'even` / `'odd`.
- `03-alg.slat:1313` — a `row-2-audit` that says the opposite, explicitly:
  *"alg/perm-parity returns the sign ±1, not a count, so test it with = against 1
  rather than with even?"*

Both spellings appear in live corpus. I will not pick one unilaterally — whichever
you choose invalidates the other set of sites.

```
MOTOI_HOME=/tmp/mx ./bin/motoi eval "(eq? (alg/perm-parity (alg/perm '(1 0 2 3))) 'odd)"
;; => #f
```

### 5. `alg/identity` on a subgroup returns a permutation, not the identity

`(alg/subgroup-gen (alg/zn 6) '(2))` returns the bare element list `(0 2 4)`.
`alg/identity` doesn't recognise that shape and falls through to
`permIdentity(arg.length)`:

```
MOTOI_HOME=/tmp/mx ./bin/motoi eval "(alg/identity (alg/subgroup-gen (alg/zn 6) '(2)))"
;; => (0 1 2)    (the identity of {0,2,4} under +mod6 is 0)
```

The reference's own examples DO work (`(alg/identity (alg/zn 6))` → `0`), so this
is specifically the subgroup path. The real problem is upstream: `alg/subgroup-gen`
throws away the group operation, so `alg/identity` has nothing to compute from.
Fixing it means deciding whether a subgroup is a group structure or an element
list. Your call.

### 6. `topo/close` stringifies its elements

```
MOTOI_HOME=/tmp/mx ./bin/motoi eval "(topo/close (list (list 1 2 3)))"
;; => (("1") ("2") ("1" "2") ("3") ("1" "3") ("2" "3") ("1" "2" "3"))
```

Numbers went in, strings came out. The reference's own example does the same, so
per the brief this is (c), not a bad book. `appendix-W` left alone.

### 7. `topo/ball` returns the empty list for the reference's own example

```
MOTOI_HOME=/tmp/mx ./bin/motoi eval "(topo/ball (list 0 0) 1.5 (topo/metric-space (list (list 0 0) (list 1 0) (list 0 1)) (lambda (a b) (sqrt (+ (expt (- (car a) (car b)) 2) (expt (- (cadr a) (cadr b)) 2))))))"
;; => ()
```

`(0 0)` is at distance 0 from itself, so the ball is never empty. An
answer-shaped nothing. `appendix-W` left alone.

---

## NOTE — not a bug, but it bit the book

`ch-advanced-09` §6.5 asked for 10,000 gradient-descent steps on Rosenbrock. The
default fuel budget is 200,000 eval steps (`src/cli.js:180`), and that block
exhausts it — the example could never have run, in any session. I reduced it to
1,000 steps, which runs standalone and in a whole-chapter run, and said so in the
prose. If you'd rather the book show the converged answer, the fuel default has to
move; I didn't touch it.

## NOTE — the mismatch list is contaminated for stateful verbs

`scratch/mismatch-subbuckets.json` was produced with shared state across examples.
For `camera-*`, `entity/*` and `grid/*` the recorded `value` is often the result
of an EARLIER example's mutation, not of the code in the record. Two I confirmed:

- `(begin (grid-init 10 10) (grid-step 4) (grid/card-center 2 2))` — recorded
  `(22 22)`, actually `(10 10)` in a fresh session, which is exactly what the book
  claims. The record is a false positive.
- `(camera-scale)` — recorded `0.5`, actually `1`. Also a false positive.

Anyone working the graphics/audio cookbooks off that JSON should re-run each case
in a fresh session before believing the `value` column.

---

## FIXED (by me, suite still 859/0) — recorded here so the decision is reviewable

### A. Every `ops/*` verb silently treated an exact rational as zero

`lib/system/ops.js` had a local shadow of `num`:

```js
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)
```

An exact rational is an object, so `Number(x)` is `NaN` and `|| 0` turned `5/2`
into `0`. Same number, two answers, no error:

```
(ops/erlang-c 2.5 3)      ;; => 0.702247191011236
(ops/erlang-c (/ 10 4) 3) ;; => 1            ← before the fix
```

That is exactly the silent-wrong shape, and it hit the whole `ops/` family, not
just Erlang-C: `(ops/littles-law 5/2 3)` was `0`, `(ops/erlang-b 5/2 3)` was `0`.
Fixed by delegating to the numeric tower's own `num` (`lib/math/tower.js:51`),
which is the language's definition of "the JS double behind a number". Non-numbers
keep the historical `0` fallback, so nothing else moves.

Grounded in the reference: these verbs are documented to take numbers, and `5/2`
is a number in R7RS. Tell me if you'd rather they escalate on exact input instead.

### B. `ops/dijkstra` and `ops/bellman-ford` leaked JS `null` into Scheme

The "no predecessor" slot was a raw `null`, which is not a Scheme value:
`(null? x)` was `#f`, `(list? x)` was `#f`, and `write` printed nothing at all,
so a row rendered as `(a 0 )`. Changed to the empty list. The eval printer was
already showing `()` for it, which is how the discrepancy surfaced — the two
printers disagreed because the value was alien to both.
