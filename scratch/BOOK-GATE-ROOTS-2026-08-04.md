# Book value gate — 115 run-errors were 13 roots; gate fixed, now 75 in 11

Measured 2026-08-04, after the array↔cell boundary fixes (ops.js seqVerb wrap,
composer improper-Pair paths, calc.js listItems). Zero raw JavaScript
TypeErrors remain; every error below is a Scheme-level condition.

## Why 13 roots become 115

`audit-books-values.py` runs each block with **every prior block of that
chapter as its prefix**. One bad block therefore fails itself and every block
after it in the file. So the 115 is a cascade count, not a defect count.

| n | first→last block | file | one message |
|---|---|---|---|
| 33 | 15→47 | book-of-math/ch-advanced-09-optimization-operations-research | `-: expected a number, got an improper list` |
| 18 | 4→36 | book-of-introspection/02-verb-metadata | `not a function: :name` |
| 18 | 15→49 | book-of-introspection/03-describe-typeof | `length: expected a proper list, got the string "hello"` |
| 17 | 1→17 | book-of-limits/appendix-a-reading-the-error | `string-length: expected a string, got the number N` |
| 10 | 4→15 | book-of-scheme/ch-rampup-07-lists | `nth: expected a proper list, got the number N` |
| 6 | 1→6 | book-of-limits/appendix-b-the-honest-miss | `string-length: expected a string, got the number N` |
| 5 | 61→66 | book-of-math/ch-advanced-14-topology-shape-of-data | `car: expected a pair, got the empty list` |
| 2 | 8→14 | book-of-jesse/18-fantasy-console-mode | `procedure: expected N argument (f), got N` |
| 2 | 6→7 | book-of-simulation-games/ch07-brachistochrone | `list-ref: index out of range` |
| 1 | 8 | book-of-cs-curriculum/appendix-g-hindley-milner-type-inference | `append: improper list argument` |
| 1 | 6 | book-of-cs-curriculum/appendix-h-constraint-satisfaction | `car: expected a pair, got a list` |
| 1 | 2 | book-of-music/ch14-pitch-interval-harmonic-series | `vector-ref: expected an integer index` |
| 1 | 5 | book-of-narrative-games/ch05-dialogue-trees | `string-append: expected a string, got the symbol A` |

## The three categories

### A. GATE defects — the book and the engine are both already right (41)

**A1. A claim that asserts an error is not understood (23).**
`book-of-limits/appendix-a-reading-the-error` block 1 is, in full:

```scheme
(string-length 42)
;; => error: string-length: expected a string, got the number 42
```

The chapter's whole subject is reading error messages. The book states the
error, the engine raises exactly that error, and the gate scores it as a
run-error. Both appendices of book-of-limits are this. **Nothing to repair —
the gate must match `;; => error: ...` against the raised condition, and a
block whose error was CLAIMED must not poison the prefix.**

**A2. An output fence is executed as code (18).**
`book-of-introspection/02-verb-metadata` block 2 is the *printed result* of
block 1's `(help 'car)`:

```scheme
((:name car)
 (:doc "The first element of a non-empty list.")
 ...)
```

Evaluated, that calls `:name` as a procedure. The gate needs to recognise a
block that is a displayed value rather than a program — or the book needs the
fence marked as output.

### B. CORPUS defects — the book states something false (28+)

**B1. `(length "hello") ;; => 5`** — `03-describe-typeof` block 15. R7RS §6.4
`length` takes a list. The claim is wrong; the engine is right.

**B2. `(- finish due)` where `finish` is a dotted pair** — the optimization
chapter, block 15. `(cadr (assoc (car job) sched-complex))` reads
`(time . 4)` out of an `ops/edd` schedule and subtracts it. This is the one
that was HIDDEN under the `mip-solve` engine bug until today.

### C. UNDECIDED — check the reference before touching either side (5+)

**C1. `(nth 2 '(a b c d))`** — `ch-rampup-07-lists`. The book calls it
index-first; the engine wants list-first. The reference decides which is the
verb's contract, and the conformance ladder decides whether `nth` should exist
under that name at all. **Do not "fix" the book to match the engine without
reading the record first** — that is the gate certifying its own input.

**C2. `topo/` and the four singletons** — not yet read.

## Recommended order

1. Fix A1 + A2 in `audit-books-values.py` (gate only, no corpus edits).
2. Re-run. The 115 should fall to roughly 74 without a single book being
   touched, and the 309 mismatches may move too — a chapter that dies at block
   15 contributes no verdicts for blocks 16-49.
3. THEN read the reference for category C, repair category B, and only then
   run the value splices (CPT plan step 6).

Doing it the other way round means editing books against a gate that is
mismeasuring, which is the failure mode that produced the 85 divergences.

---

## UPDATE 2026-08-04 — the gate is fixed; corpus untouched

`audit-books-values.py` changed in three places. No book was edited.

1. **A claim may assert a raise.** Both spellings the books use are now read as
   claims — `;; => error: …` (9 in the corpus) and the bare `;; error: …` (19).
   The claimed text is compared against the message the engine actually raised,
   so a block that fails a DIFFERENT way still fails.
2. **A printed-output fence is not a program.** A top-level form whose applied
   symbol is a keyword (`(:name car)`) cannot be a legal call in any program, so
   it is classified `output-fence` instead of executed. Deliberately narrow —
   output that merely looks like a call is still run and still checked.
3. **Neither kind of block enters the accumulated prefix.** This was the real
   multiplier: the gate feeds every earlier block of a chapter into the next one,
   so one deliberate failure killed every block below it.

### Selftest — 5 cases, and 2 of them must FAIL

`python3 scratch/audit-books-values.py --selftest`

| case | required verdict |
|---|---|
| true value claims | pass |
| **false value claims** | **mismatch** |
| true error claim | pass |
| **error claim naming the WRONG error** | **run-error** |
| output fence | output-fence |

The fourth is the one that matters: without it the error path would become a
proxy for "something failed", which is the bug class that produced the 85
divergences.

### Result

| | before | after |
|---|---|---|
| run-errors | 115 | **75** |
| root causes | 13 | **11** |
| blocks ran | 975 | **1017** |
| claims passing | 987 | **1025** |
| mismatches | 309 | 318 |

Mismatches ROSE by 9, and that is the gate working: chapters that used to die at
block 15 now run to the end and report the verdicts they always owed. Counts
going up here is evidence of un-masking, not regression — the same
non-monotonicity that makes a count a bad gate and failure identity a good one.

book-of-limits/appendix-a went 17 → 1, appendix-b 6 → 0, and 02-verb-metadata's
output fence cleared (revealing one more real block underneath, since fixed as
a claim). Every one of the remaining 75 is a Scheme-level condition in exactly
11 blocks.

### Still to do — the 11 real roots

Categories B and C above stand. The two biggest are a corpus bug each
(`(length "hello") ;; => 5`, and the dotted-pair subtraction in the
optimization chapter). `(nth 2 '(a b c d))` still needs the reference read
before either side is touched.

---

## UPDATE 2026-08-04 (late) — all 11 roots repaired; run-errors are ZERO

Alfred: "Fix all. It's fine." — so none were quarantined.

| | 13-root measure | gate fixed | all roots fixed |
|---|---|---|---|
| run-errors | 115 | 75 | **0** |
| root causes | 13 | 11 | **0** |
| blocks ran | 975 | 1017 | **1101** |
| claims passing | 987 | 1025 | **1137** |
| mismatches | 309 | 318 | 351 |

Mismatches rose again, for the third time, for the same reason: a block that
used to abort now runs and reports the verdicts it always owed. That is the
non-monotonicity. **Never gate on a count.**

### The reference decided three of these, and it decided them AGAINST the book

Each of these I would have got backwards had I patched the book to match my
reading of its prose:

- **`ops/edd`** (`47-ops.slat:436`) returns *the jobs reordered*, not their
  finish times. The chapter's §2.4 was subtracting a due-date from an alist
  cell. Replaced with an explicit `finish-times` walk that turns the order into
  an id→finish alist with a running clock. This root alone was 33 of the
  original 115.
- **`curve/brachistochrone`** (`20-curve.slat:339`) returns *two parameters*
  `[R, θ_end]`, not a curve. The chapter's entire "full cycloid arch that comes
  back up" narrative was fabricated. Rewritten as solve-params-then-sweep with
  `curve/cycloid`, and the real margin stated: 1.39 s against 1.48 and 1.63,
  about 6% over the arc — not the "wide margin" the book claimed.
- **`topo/complex`** (`67-topo.slat:414`) takes *one flat simplex list*. The
  chapter called it with 3–4 args at 24 sites. Added a `complex-from` helper
  that assembles the flat list from the three lists a reader actually thinks in.

### The other eight

| root | file | what was wrong |
|---|---|---|
| `nth` arg order | book-of-scheme/ch-rampup-07-lists | book had CL's `(nth i lst)`; `39-list.slat:5673` documents the trap explicitly |
| `length` on a string | book-of-introspection/03-describe-typeof | `(length "hello") ;=> 5`; §6.4 is proper lists only |
| error text drift | book-of-limits/appendix-a | claimed a message the engine no longer raises |
| `on-frame` arity | book-of-jesse/18-fantasy-console-mode | handler takes NO arguments (`01-core.slat:2404`); also `fire-mouse` button is an integer index |
| exact index | book-of-music/ch14-pitch-interval | `round` on an inexact gives an inexact; `vector-ref` demands an exact |
| symbol vs string | book-of-narrative-games/ch05-dialogue-trees | labels get `string-append`ed; `string-append` will not stringify a symbol |
| 8-queens claim | book-of-cs-curriculum/appendix-h | claim was a different solution than the deterministic first one |
| TDA pipeline | book-of-math/ch-advanced-14-topology | see below |

The topology chapter needed a second pass after the `topo/complex` fix. Its
filtrations were lists of bare complexes; `topo/persistence` reads a
`(scale complex)` pair and dates births and deaths off that scale, so every
bar in the chapter was `(0 0)` — an answer-shaped nothing. Eleven filtration
sites now carry their scale, and the barcode arithmetic goes through a
`lifetime` helper because an essential class dies at the symbol `inf` and
`(- 'inf 0.5)` correctly raises. `topo/betti-curve` also reads the filtration
and a dimension, not the barcode.

### TWO ENGINE BUGS, both cons-cell-flip fallout, both found by the books

1. **`iota` was in SRFI-1's `_RAW` set** (`lib/std/srfi-1.js:126`) but its body
   returns a plain JS array. So `(pair? (iota 3))` said `#t` while
   `(car (iota 3))` raised. Removed from `_RAW`.
2. **`values` was `seqVerb`-wrapped** (`lib/base/r7rs-small.js`). `adaptIn`
   converted each value on the way IN, so `(values 'int '())` boxed an
   array-spelled empty list. It satisfies `null?`, `list?` and `eq? '()` but is
   not `NIL`, so `let-values` bound it and consing onto it built an improper
   chain — which is what made appendix-g raise "append: argument 1 is an
   improper list". `values` and `call-with-values` are now `_RAW`: `values` is
   a pass-through box, it has no business converting anything.

This is the same defect shape as `iota`, and as the eight before it: a verb
that answers for both spellings sitting next to a verb that only accepts one.

### The four standing gates, re-run after both engine edits

| gate | before | after |
|---|---|---|
| repo suite | 859 pass / 0 fail | **859 pass / 0 fail** |
| `verify-reference-notes.py` | 969 MATCH / 0 MISMATCH / 0 ERROR | **969 / 0 / 0** |
| larceny | 2151 exec / 2142 pass / 9 fail / 3 drop | **2151 / 2142 / 9 / 3** |
| chibi | 1204 exec / 1195 pass / 9 fail | **1204 / 1195 / 9** |

Identical on all four. The two engine edits regressed nothing.

### One divergence found — Alfred ruled "Reference wins", engine conformed

`67-topo.slat` documents `(topo/persistence filtration dimension)` returning
`(birth death)` pairs, and `(topo/total-persistence filtration [dim])`. The
engine took `(filtration)` alone and returned `(dim birth death)` triples across
every dimension at once, and `total-persistence` took only the barcode. I logged
this rather than decide it — `topo/*` is Motoi-own, so the arity is a language
decision. **Alfred ruled: "Reference wins."** Conformed 2026-08-04.

Engine changes in `lib/base/topo.js`:

- `persistence(filtration, dimension)` now returns that dimension's barcode:
  a list of `(birth death)` intervals, with the symbol `inf` as the death of
  an essential class.
- `totalPersistence` and `persistenceEntropy` accept **either** a filtration
  (with an optional dimension) or a barcode straight through — the reference
  spells both, and a `(scale complex)` entry is distinguishable from a
  `(birth death)` bar, so one verb satisfies both spellings (`asBarcode`).
- `bottleneck` re-indexed from triples to pairs.
- `barLifetime` returns `null` for an infinite bar; every sum and entropy skips
  those rather than doing arithmetic on a symbol.

**One bug I introduced and caught.** `asBarcode`'s discriminator was
`typeof d === 'number'`. Motoi's numeric tower boxes an inexact as a `Flo` and
an exact ratio as a `Rational`, so every inexact barcode failed the test, was
read as a filtration, and answered 0 — silently, with no error. Caught by running
the reference's own runnable fixture
`(topo/persistence-entropy (list (list 0 1.0) (list 0 1.0) (list 0 1.0)))`,
which returned 0 instead of ln 3. Fixed by importing `isNum` from
`lib/math/tower.js`. This is exactly the silent-wrong class this whole effort
exists to kill — a run-only gate would have passed it.

Verified against the reference's own fixtures: bottleneck identity `#t`,
bottleneck symmetry `#t`, entropy of three equal bars `1.0986122886681096`
(= ln 3; the record's own caveat says the log base is an implementation
choice), bottleneck perturbation `0.1000000000000009` (record says "≈0.1").

`ch-advanced-14-topology-shape-of-data.book.slatl` was then rewritten to the
conformed API: every `topo/persistence` call carries its dimension, the
`lifetime` helper reads `(car p)`/`(cadr p)` instead of `(cadr p)`/`(caddr p)`,
and the now-meaningless `(= (car p) 0)` / `(= (car p) 2)` dimension filters are
gone. Ten new `; =>` claims were added from measured output; all ten pass.

Two prose over-claims in that chapter were corrected rather than papered over.
Example 52 (hollow cube, 8 corners) claims a β₂ void; it actually yields 35
infinite dimension-2 bars, because Rips on 8 points at r=1.5 is nearly complete.
Example 53 (torus, 12 points, radii 1/2/3/4) claims two long β₁ bars; it yields
an empty barcode, because both loops are born and filled inside the 1.0→2.0 gap.
Both now teach the under-sampling honestly. No fabrication: the book states what
the engine prints.

## Four more silent-wrong defects, found downstream of that conformance

Conforming `persistence` made the rest of the topology surface actually
execute, and executing it uncovered four more defects of the same class. All
four were answer-shaped: none raised, so a run-only gate saw green.

**1. `topo/rips-filtration` returned `()` for every call the reference spells.**
The reference signature is `(topo/rips-filtration point-set epsilon-max
[step-count])`. The engine demanded an explicit LIST of scales in argument 2 and
returned the empty filtration for anything else — so `(topo/rips-filtration pts
2.0)` answered `()`, and every barcode read off it was empty. Empty is a
plausible answer for a point cloud with no features, which is why it survived.
Conformed to accept all four spellings the reference uses across its own
examples: `(pts eps-max)`, `(pts eps-max step-count)`, `(pts eps-min eps-max
eps-step)`, and the original explicit `(pts '(s0 s1 ...))`. All four are
distinguishable, so all four are honored.

**2. `topo/betti` returned `(0 -1)` — a NEGATIVE Betti number.** A Betti number
counts holes; it cannot be negative. Root cause: `canonicalSimplex` sorted
vertices but did not deduplicate them, so a point cloud containing the same
point twice — a closed trajectory that returns to its start, exactly what
ch13 traces — produced a degenerate "edge" from a vertex to itself. That
inflated the 1-cell count and pushed the Euler characteristic off by one. A
simplex is a SET of vertices: `{v, v}` is the 0-simplex `{v}`, not an edge.
Fixed with a `Set` dedup. This silently corrected ch13's β₀ barcode (which had
been missing its infinite bar) and made its β₁ loop appear.

**3. `topo/simplex` was variadic against a single-list signature.** The
reference spells `(topo/simplex verts)` — ONE argument, a list. Taken
variadically, `(topo/simplex '(a b c))` stringified the whole list into a
SINGLE vertex labelled `"a,b,c"`, so a triangle came back as a 0-simplex and
`(equal? (topo/simplex '(x y)) (topo/simplex '(y x)))` answered `#f` — a
simplex is a set, so that must be `#t`. It printed as `(a,b,c)`, which reads
close enough to right that the defect survived. Fixed by unwrapping a lone
array argument; the variadic spelling is kept, since both are unambiguous.
The record's own `:impl-notes` at `67-topo.slat:1954` had documented the buggy
output as intended behavior — that is the reference canonizing a bug, so the
note was corrected too.

**4. A performance blowup my own fix caused.** With `rips-filtration` doing
real work for the first time, a 40-point × 20-scale filtration hung for
minutes, which would have broken the book gate. `vietorisRips`'s maximal-face
filter compared every face against every other face — O(f²), ~114M comparisons
per scale. A face is non-maximal iff SOME face one vertex larger contains it,
so the faces are now indexed by key and the n candidate supersets probed
directly: O(f·n). Minutes → 2.8s, behavior-preserving.

### What this does NOT say

It does not say the books are correct. It says every block RUNS and no block
raises. 348 claims still disagree with what the engine prints — that is CPT
plan step 6 (the value splices), still ahead.

### Gates after all of it (identical to baseline, every one)

| gate | baseline | final |
|---|---|---|
| repo suite | 859 pass / 0 fail | 859 pass / 0 fail |
| `verify-reference-notes.py` | 969 MATCH / 0 MISMATCH / 0 ERROR | 969 / 0 / 0 |
| larceny | 2151 exec / 2142 pass / 9 fail / 3 drop | 2151 / 2142 / 9 / 3 |
| chibi | 1204 exec / 1195 pass / 9 fail | 1204 / 1195 / 9 |

Book gate: 8419 blocks, **run_errors 0**, ran 1101 → 1111, claims passing
1137 → 1150, mismatches 351 → 348. `audit-books-values.py --selftest` PASS.

### Still open in these chapters (not started)

- `ch-advanced-14 block-67` — `(length (topo/boundary (topo/mobius)))` returns
  3; the claim is 1. A Möbius band has ONE boundary circle, so the claim is
  right and the verb is suspect.
- `ch13 block-7` — `(compare-orbits)` now returns `((A (1)) (B (1)))` but the
  claim is still the old `(b_0 . 1)` alist shape.
- Five `appendix-W-topology-algebra-symbolic-linalg` mismatches, including
  `sym/solve-ineq` returning `nan`.
