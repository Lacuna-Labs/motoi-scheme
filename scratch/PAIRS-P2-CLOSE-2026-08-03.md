# Pairs P2 — real cons cells everywhere. Close-out.

2026-08-03. Task #53. This is the acceptance record for "option 2 — total
compatibility."

## The headline

`(equal? '(1 2) '(3 4 5))` answered `#t`.

So did `(equal? '(1 2) '(1 3))` and `(equal? '(1 2) '(1 2 3))`. Chibi says `#f`
to all three. The 786-test repo suite passed the entire time this was broken.
The oracles caught it; the suite did not.

That is the exact silent-wrong class from the fake-conformance-gate incident: a
green check that measures the wrong thing. It is now locked in by eight
regression tests in `tests/pairs.test.mjs`.

Two more of the same shape turned up in this pass — `pair-fold-right` silently
returning its own seed, and the boundary wrappers dropping a procedure's tags.
Neither threw. Both are below, both are tested now.

## Gates

All four measured on the same tree, after every edit below.

| gate | before the flip | now |
|---|---|---|
| repo suite | 786 / 786 | **794 / 794**, 0 fail |
| `scratch/verify-reference-notes.py` | 969 / 969 | **969 / 969** MATCH, 0 MISMATCH, 0 ERROR |
| chibi (`run_chibi3.py` → `score.py`) | 1186 / 1204 | **1187 / 1204**, 14 forms dropped |
| larceny (`run_larceny.py` → `score_larceny.py`) | 2027 / 2074 | **2029 / 2075**, 46 fail, 26 dropped |

`tests/pairs.test.mjs` went 18 → 26.

**Read the larceny number carefully — it does not mean what it looks like.**
Larceny's `same-result?` (`gen-larceny.scm:187`) falls through to `(equal? got
expected)`, and that runs *inside Motoi*. So every larceny verdict was being
adjudicated by the very verb that answered `#t` for unequal lists. The old
2027 was inflated. Two separate fixes in this pass each made the count fall by
unmasking assertions that had been vacuous, and each time letting it fall was
the correct move. Do not read this gate as a monotone score.

One process note: two larceny runs were briefly in flight at once and both write
`larceny-state.json`. Interleaved writes would have produced a meaningless
number. Killed both, re-ran once, clean. Any larceny figure taken while a second
run is live should be discarded.

## The bug class, stated once

`isList()` in `lib/base/list.js` deliberately answers `#t` for **both** a cell
chain and a JS array, because a guard has to be right on either side of the
`seqVerb` sequence boundary. That is the correct design. It also makes one
mistake very easy and completely silent:

```js
if (isList(a) && isList(b)) {
  if (a.length !== b.length) return false   // undefined !== undefined → false
  for (let i = 0; i < a.length; i++) ...    // bound is undefined → 0 iterations
  return true                               // reports success
}
```

A chain has no `.length`, no `.map`, no `[i]`, and is not iterable. Every defect
below is an instance of that one shape. A secondary class: `isList(NIL)` is `#t`
but `NIL` is a frozen singleton with nothing to walk.

## What was actually wrong, by site

| file | site | symptom |
|---|---|---|
| `src/base.js` | `_eqQ` | **any two chains compared equal** |
| `src/base.js` | `_reachesFrom` | Pair branch below the Array branch |
| `src/base.js` | display formatter | array reaching `pairToString` printed `( . <array>)` |
| `src/base.js` | `list-ref` | `isList` where `Array.isArray` was meant |
| `lib/base/r7rs-small.js` | `_eqDeep` | same defect as `_eqQ` |
| `lib/base/r7rs-small.js` | `_eqvQ`, `_describe` | `.length === 0` on a chain |
| `lib/base/r7rs-small.js` | `_isCompound` | `isList(NIL)` → `for...of NIL` → "v is not iterable"; **6 larceny base.sld forms** |
| `lib/base/r7rs-small.js` | `_renderForWrite`, `_renderForDisplay`, `_renderLabeled` | `isList` checked before `instanceof Pair`; `(write (cons '(a b) 'c))` died |
| `src/reader.js` | `patchLabels` | datum label inside a chain never patched |
| `src/reader.js` | apostrophe guard | `,'five` in a quasiquote read as a typo |
| `src/slat-verbs.js` | `toSlatValues` / `fromSlatValues` | chain walked as a `{car,cdr}` object → `[object Object]`; **9 reference-note failures** |
| `tui/session.js` | `alistToObject` and 3 callers | chain returned AS the object; `pairState().mode` was `undefined` |
| `src/cli.js`, `src/dispatch.js` | formatters | same ordering defect |
| `lib/base/assert.js`, `lib/math/stat.js`, `lib/std/r7rs-completions-core.js` | `_describe` / type guards | `.length` on a chain |
| `lib/std/srfi-1.js` | `_shortest` / `pair-fold`, `pair-fold-right`, `pair-for-each` | **loop bound `NaN`, zero iterations, returned the seed** |
| `lib/std/srfi-1.js` | `_describe` | `.length` on a chain → "a list of undefined elements" |

A second, unrelated class surfaced in the same pass: the boundary **wrappers**
(`seqVerb`'s `w`, `adaptIn`'s `w`) dropped the wrapped procedure's own
properties. Motoi has values that *are* procedures carrying a tag — a parameter
object hangs `_parameter`, an audio handle hangs `__audioHandle`. So
`parameterize` said "not a parameter" about a real parameter, and
`with-input-from-string` threw `Cannot read properties of undefined`. Fixed
centrally by `copyTags`, called from both wrappers. `adaptIn` also memoizes into
a `WeakMap` so a procedure crossing twice is the same object and `eq?` holds.

## Verified against `chibi-scheme -p`

All now match:

```
(equal? '(1 2) '(3 4 5))                        → #f
(equal? '(1 2) '(1 3))                          → #f
(equal? '(1 2) '(1 2 3))                        → #f
(equal? '#(1 (2 3)) (vector 1 (list 2 3)))      → #t
(equal? (cons 1 2) (cons 1 3))                  → #f
(member '(2) '((1) (2) (3)))                    → ((2) (3))
(write (cons '(a b) 'c))                        → ((a b) . c)
(display (cons '(1 2) 3))                       → ((1 2) . 3)
(write (list 1 '() (cons 'a 'b)))               → (1 () (a . b))
(let ((a 3)) `((1 2) ,a ,4 ,'five 6))           → ((1 2) 3 4 five 6)
(with-input-from-string "hello" (lambda () (read-line)))  → "hello"
(slat-dump (list (list 'a 1) (list 'b 2)))      → "(a 1)\n(b 2)\n"
```

## The remaining oracle failures, itemized

I asserted "every one accounted for" before actually enumerating them. That was
wrong, and enumerating found two real defects. One is fixed below; one is filed.
The itemization is worth more than the claim was.

### Larceny drops — 26, all explained

| n | cause | status |
|---|---|---|
| 2 | macro hygiene (`base.sld` 132, 143) | task #46 — real |
| 3 | `include` / `include-ci` (`base.sld` 5, 6, 7) | decision-010, no file ports — permanent |
| 2 | circular datum labels (`base.sld` 195, 329) | task #54, P3 |
| 19 | `vector.sld` — `vector-unfold`, `vector=`, `vector-empty?`, `vector-swap!`, `reverse-vector->list` … | **SRFI-133, not in the 2026-07-24 lock** — expected |

### Larceny failures — 46

**base.sld (11):**
- 3 — `(fact 6)`, `(fib 10)`, `bd578d6d`. These are defined in the `include`d
  files, so they are **cascades of the 3 include drops**, not separate defects.
- 2 — **`guard` does not re-enter the dynamic extent before re-raising.**
  Real defect. Chibi agrees with larceny. Filed as **task #57**. Not a pairs
  bug.
- 2 — macro hygiene (`bound-identifier=?`, `...` escape). Task #46.
- 2 — `(vector-copy! a 2 a 0)` with an implicit end that overruns. Larceny's own
  source comments this `; FIXME: R7RS doesn't say`. Oracle disagreement.
- 1 — `dynamic-wind` re-entry via `call/cc`. decision-004, escape-only.
- 1 — a `test/output` harness artifact, not a value mismatch.

**list.sld (25):** three causes, no others.
- 13 — SRFI-1 **linear update** cell-identity: `take!`, `drop-right!`,
  `append!`, `map!`, `filter!`, `remove!`, `partition!`, `take-while!`,
  `span!`, `break!`, `delete!`, `delete-duplicates!`, `list-copy`. Motoi
  allocates fresh cells where the strong reading says reuse. **This is Priya's
  finding and needs Alfred's explicit ruling** (`lib/std/srfi-1.js:863-876`,
  justified at `:859-862`; Motoi's own suite tests the strong reading at
  `:308-313`). Overrule it deliberately — do not silently flip it.
- 9 — `circular-list` is unsupported, so `null-list?`, `length+`, `zip`,
  `count`, `map`, `for-each`, `filter-map`, `any`, `every` error on one. Task
  #54, P3.
- 2 — `(eq? (cdddr x) (drop x 3))` and `(eq? x (drop x 0))`. `drop` should
  return the interior pointer. P3.
- 1 — `split-at!` is tested but **not bound**. Standing from Priya's audit.

**vector.sld (5):** all SRFI-133 (`vector=`, `vector-empty?`). Outside the lock.

**write.sld (2) + read.sld (1):** `equal?` has no cycle detection, so a
round-tripped circular datum compares unequal to itself. Note the two written
forms print **identically** — the printer is right, the comparator can't handle
cycles. Task #54, P3.

**inexact.sld (2):** `(/ 1.0 0)` and `(/ 0.0 0)`. Three-way split — larceny
wants `+inf.0`/`+nan.0`, **chibi errors on the first and answers `0.0` to the
second**, Motoi errors on both. Not a clear defect; needs a ruling if it
matters.

### chibi — 1187 / 1204, 14 dropped

Same buckets.

## The defect the itemization found — and fixed

`pair-fold`, `pair-fold-right` and `pair-for-each` (`lib/std/srfi-1.js:757`)
shared a `_shortest` helper that took `l.length`. On a chain that is `undefined`,
`Math.min(m, undefined)` is `NaN`, `i < NaN` is false — **the loop ran zero
times and each verb silently returned its own seed.**

```
(pair-fold-right cons '() '(a b c))   was ()   should be ((a b c) (b c) (c))
(pair-for-each ... )                  was ()   should be ((3) (2 3) (1 2 3))
```

Second bug at the same site: the tail was `l.slice(i)`, which **copies**. These
three verbs exist to hand the callback the caller's own cell so a `set-cdr!`
inside is visible outside — that is how SRFI-1's canonical `reverse!` is
written. A copy makes the whole verb pointless. They now walk cells directly and
collect the tails before any callback runs, which is the guarantee SRFI-1's
reference implementation gets by grabbing `(cdr lis)` one step ahead.

**A divergence worth knowing:** `(pair-fold (lambda (pair tail) (set-cdr! pair
tail) pair) '() (list 1 2 3))` now answers `(3 2 1)`. Chibi answers `(1)` —
chibi's `pair-fold` does *not* grab the cdr ahead. SRFI-1's reference
implementation does, and larceny tests for it. Motoi follows SRFI-1, per the
conformance ladder (SRFI is the authority for a SRFI verb, not another
implementation).

**This fix made the larceny number go DOWN, and that is correct.** `list.sld`
went 149 → 147. Five tests capture the original cells with `(pair-fold cons '()
x)` and then assert a destructive verb reused them. While `pair-fold` returned
`()`, those assertions were **vacuous**. Now `cells` really has six entries and
the assertions genuinely fail — `filter!` really does allocate fresh. Verified
directly:

```
(let* ((x (list 0 7 8 8 43 -4)) (cells (pair-fold cons '() x)) (r (filter! even? x)))
  (list r (length cells) (memq r cells)))
→ ((0 8 8 -4) 6 #f)
```

Same story as `equal?`: a broken verb was hiding real failures. Both times the
honest move is to let the number fall.

## Triage method worth reusing

Parse the oracle's dropped/failed records → bucket by `stderr` prefix →
reproduce the smallest one with `./bin/motoi eval` → then find the *class* with
a targeted scan, not by eyeballing. The scan that found the ordering sites
looked for `isList(V)` where `V` is used as an array within 8 lines **and** a
`Pair` branch appears nearby. That found 14 sites in one pass.

## Where the arrays survive, on purpose

The evaluator's spine — the AST the reader hands `interp` and `macro` — is still
JS arrays. Sound only because Motoi has no `eval` (decision-005): program text
and program data never have to be the same objects. Quoted data crosses into the
cell world at `quote` and `quasiquote`, and nowhere else. That is what kept this
change from touching the evaluator and the macro expander at all.

The library beyond the core (math, graphics, game, composer) takes a list as a
*sequence* and is wrapped at its installer to keep receiving arrays. Not a shim
for unconverted code — those verbs were never about cells, and rewriting four
hundred of them would have added risk without adding a conformance point.

## Still open (do not start without a decision)

- **#54 P3** — cycle detection in `equal?`, `circular-list`, datum labels in
  reader and writer, `write-shared` vs `write-simple`, and Alfred's ruling on
  the SRFI-1 linear-update reading.
- **#55 P4** — corpus repair, 7 surfaces: 432 CODE sites (mechanical after P3)
  + 38 PROSE (needs authoring). Carts are clean: 0 hits across 45 files.
- **#56 P5** — 13 missing verb records + rewrite the 5 array-design records
  (`set-car!`, `set-cdr!`, `list-copy`, `last-pair`, `list?`). Drafts at
  `scratch/pairs/drafts/`, specs at `scratch/pairs/spec-pack/`, all `:note` =
  `PENDING-ENGINE`, 20 records `:status "needs-alfred"`.
- **#57 `guard` re-entry** — new, found here. Real, both oracles agree.
- **#46 macro hygiene** — the next option after 2.

Standing from the SRFI-1 audit, unresolved: the normative SRFI-1 text is not in
the repo (`spec/srfi-1.slatl` is auto-generated from Motoi's own implementation
— evidence of the bug, not authority over it), so library gate #2 is
unsatisfied. `split-at!` is tested but not bound. 20 SRFI-1 verbs are bound but
undocumented.
