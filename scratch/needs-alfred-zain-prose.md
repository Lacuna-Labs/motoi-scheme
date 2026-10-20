# needs-alfred — shape-(c) engine defects found by the prose-note pass (Zain)

Found 2026-08-04 reading the 272 REVIEW+ERROR rows from
`scratch/verify-reference-prose.py`. Everything here is shape **(c)**: the
reference is right, the engine does not do what it says, and in most cases the
engine **never raises** — it returns an answer-shaped nothing that reads as
real. None of these were changed. What I *did* fix is listed at the bottom.

Every value below came from running the form, not from judgment:

    MOTOI_HOME=/tmp/mx ./bin/motoi eval "<expr>"

---

## 1. `geom/sin` / `geom/cos` / `geom/tan` — degrees vs radians. AMBIGUOUS, needs your call.

```
(geom/sin 90)   → 0.8939966636005579     reference note: "Sine of 90°; returns 1"
(geom/tan 45)   → 1.6197751905438615     reference note: "45° has tangent ≈ 1.0"
```

`29-geom.slat` is emphatic that these take **degrees** — `:signature
"(geom/sin angle-degrees)"`, the summary, the explanation ("Given an angle in
degrees (not radians)"), a caveat ("Input angle is in degrees, not radians
(unlike some Scheme math libraries)"), and all three examples. The impl is a
bare `Math.sin(x)`.

**I did not change it, because the reference contradicts itself across
chapters and the blast radius is large:**

- `40-math.slat:4549` documents `math/sin` with `:contract "x in radians"`.
  Same for `math/cos` and `math/tan`.
- `lib/graphics/geom.js:131-135` states the design: "`math/*` is the CANONICAL
  path going forward … `geom/*` stays as legacy alias … Both resolve to the
  same JS function."
- `tests/base.test.mjs:94` asserts `math/sin` **is an alias of** `geom/sin`.
  (It only probes 0, where both units agree, so it would not have caught this.)
- Caller survey says the *books* use radians. Across `scheme-books/`:
  `(geom/sin t)` ×19, `(geom/sin x)` ×19, `(geom/sin theta)` ×15,
  `(geom/sin angle-rad)` ×6 — parametric-curve callers, unmistakably radians.
  `geom/cos` is the same shape. Only 3 call sites pass a literal degree value.

So switching `geom/sin` to degrees would fix ~3 reference examples and
silently corrupt ~270 book call sites. **Decision needed:** either (a) make
`geom/*` trig degrees and re-voice the radian callers in the books, or (b)
declare `geom/*` trig radians and correct the `29-geom.slat` records. I lean
(b) — it matches `math/*`, R7RS, and the overwhelming majority of callers —
but that is a language call, not mine.

## 2. `geom/angle-between` — wrong arity AND wrong unit

```
(geom/angle-between 0 0 1 0 0 0 0 1)  → 0
```

Reference note: "Angle between horizontal and vertical vectors is 90°."
`:signature "(geom/angle-between p1 p2 p3 p4) -> degrees"`. Every one of the
~20 concrete call sites in `scheme/` passes **eight bare scalars** (four
points), e.g. `(geom/angle-between ax ay bx by cx cy dx dy)`.

`lib/graphics/geom.js:115` binds `(a, b)` — two points — and returns
**radians** via `Math.atan2`. So all eight scalars but the first two are
dropped, `pt(0)` falls through to `[0,0]`, and every documented call returns
`0` without raising.

**Not fixed: the reference is internally inconsistent about arity.** The
signature names four things (`p1 p2 p3 p4`), the `:explanation` says "four
coordinates", and the examples pass eight numbers. Those cannot all be true.
`lib/graphics/geom-extended.js:18` says an "angle-between four-scalar form"
was *meant* to be added there, and lines 22-24 say it deliberately was not.
Tell me which shape is canonical and I will wire it.

## 3. `geom/slope` — vertical line returns Infinity, reference says NaN

```
(geom/slope 5 0 5 10)  → +inf.0
```

`29-geom.slat:2808`: `:signature "(geom/slope x1 y1 x2 y2) -> number | nan"`,
summary "vertical lines return NaN (undefined, not infinity)", explanation
"returns NaN rather than infinity to avoid floating-point singularities. …
The NaN convention is canonical in Motoi Scheme."

But `tests/zane-1-bughunt.test.mjs:197` asserts `Infinity`. Reference and a
live test disagree, so I left the value alone. **I did fix the arity half** of
this verb (see below); only the vertical-line value is open.

## 4. `seq/arithmetic` — 0-indexed, reference says 1-indexed

```
(seq/arithmetic 2 3 1)  → 5      reference note: "First term … returns 2"
```

`56-seq.slat:38-40`: `:signature "(seq/arithmetic a1 d n)"`, "Returns the nth
term", "The nth term (**1-indexed**) is given by aₙ = a₁ + (n−1)·d". The impl
computes `a1 + n*d`. Not fixed: re-indexing shifts every other
`seq/arithmetic` call site and `seq/arithmetic-sum` may depend on the current
convention. One-line change once you confirm.

## 5. `seq/nth-term` — returns a descriptor, reference says a number

```
(seq/nth-term (list 2 4 6 8))   → (arithmetic 2 2)      code comment says 10
(seq/nth-term (list 1 3 9 27))  → (geometric 1 3)       code comment says 81
```

`56-seq.slat:486`: `:signature "(seq/nth-term lst) -> number"`, "Detects
whether a list is arithmetic or geometric, then returns **the next term**."
The impl returns the classification instead of extrapolating. Changing the
return type is not a contained fix — it needs your call on whether the
descriptor is worth keeping under another name.

## 6. `nt/nth-prime` — HANGS

```
(nt/nth-prime 1)  → (timeout, >25s)      reference note: "Returns 2, the first prime"
```

`44-nt.slat:1100`. This is the only hard hang in the 1,803-example prose set.
It is off-by-one-ish in a search loop by the look of it, but I did not open
number theory hours before an emit. **This one is worth catching before CPT
ZERO** — anything that runs the chapter end-to-end will stall on it.

## 7. Straightforward wrong answers, all silent

| expression | got | reference says |
|---|---|---|
| `(alg/is-field? 7)` | `#f` | `#t` — 7 is prime, ℤ/7ℤ is a field (`03-alg.slat:1161`) |
| `(alg/apply-symmetry 1 (list 1 0))` | `(1 0)` | ≈`(0 1)` — first non-identity D₄ rotation (`03-alg.slat:42`) |
| `(alg/perm-parity '(1 2 0))` | `1` | `'even` — the note and the code's own comment both say the symbol (`03-alg.slat:2590`) |
| `(tick/ease 'linear 0.5)` | `+nan.0` | `0.5` — "Linear easing at 50% progress returns 0.5" (`65-tick.slat:28`) |
| `(game/ttt-best-move '(empty ×9))` | `nan` | a move index, "typically 4 or a corner" (`28-game.slat:1139`) |
| `(game/surreal-eq? (game/star-n 0) (game/star-n 0))` | `#f` | `#t` — a nimber equals itself (`28-game.slat:296`) |
| `(grid/card-center 'no-such-card)` | `(0 0)` | `#f` — "or #f if not found" (`30-grid.slat:42,45`) |
| `(artifact/cite 'a-42)` | `#f` | `('pending msg)` (`05-artifact.slat:43`, same at `:87` for `artifact/delete`) |
| `(phys/lagrangian-action …)` | `+nan.0` | `2m` for a free particle (`50-phys.slat:704`) |
| `(ai/path (ai/grid 15 15) 0 0 14 14)` | `()` | a corner-to-corner path on an EMPTY grid (`02-ai.slat:1738`) |
| `(num/nintegrate-2d …)` / `-3d` | `error: integrand must return number` | `8` and `24` (`45-num.slat:33,75`) |

`(grid/card-center 'no-such-card)` → `(0 0)` is the nastiest of these: `(0 0)`
is a legitimate coordinate, so a caller cannot tell "card is at the origin"
from "card does not exist".

## 8. `linalg/lu` — U factor is all zeros

```
(linalg/lu (matrix/make 3 3 '(2 1 1 1 3 2 1 2 2)))
  → (((1 0 0) (0 1 0) (0 0 1)) ((0 0 0) (0 0 0) (0 0 0)) ((1 0 0) (0 1 0) (0 0 1)))
```

`38-linalg.slat:772` says the result is `(L U P)` with `P A = L U`. L and P
came back as the identity and **U came back as the zero matrix**, so the
claimed invariant is false for every input. Shaped exactly like a real answer.

## 9. `text/wrap` ignores its width argument

```
(text/wrap "the quick brown fox" 40)  → ("the" "quick" "brown" "fox")
```

`64-text.slat:231`. The string is 19 characters and the column is 40, so the
correct answer is one line. It splits on every space regardless of width.

## 10. `zip` rejects a ragged call the reference documents

```
(zip (list 1 2) (list 'a 'b) …)  → error: zip: expected a proper list, got the number 7
```

`39-list.slat:5749`. The note walks through six cases including the ragged and
non-list ones and states the expected output for each; the form raises instead.

## 11. `topo/*` — added to the existing pile, NOT investigated

Per instruction these join `scratch/needs-alfred-lib-tests.md` /
`scratch/needs-alfred-marcus.md` rather than starting a topology rewrite:

- `(topo/closed? (topo/torus))` → `#f`; `67-topo.slat:2103` and `:2463` both
  say `#t`. `(topo/open? (topo/torus))` → `#t` where `:2176` says `#f`.
- `(topo/homology (topo/complex '((a b c))))` → `((H 0 rank 1))`; the note at
  `:2893` documents all three ranks `((H 0 rank 1) (H 1 rank 0) (H 2 rank 0))`.
- **NEW, and worse than the known stringification bug:** `topo/boundary`
  emits a **NUL byte** inside its vertex names.
  `(topo/boundary (topo/complex '((a b c))))` → `(("b\x00;c") ("a\x00;c")
  ("a\x00;b"))`. The edge `(b c)` is being joined into one string on `\0`
  instead of staying a 2-element list. `topo/chain` inherits it
  (`67-topo.slat:2320`). A NUL in a corpus string is not just wrong, it is
  the kind of thing that corrupts a downstream tokenizer.
- The known vertex stringification defect (`("a" "b")` where the reference
  writes `(a b)`) accounts for ~14 of the 22 topo REVIEW rows on its own.

## 12. `39-list.slat:5164` — the note documents a defect that looks FIXED

The note says the engine prints `(host (1 8 9) tail (CHANGED 9) shared #f)` and
spells out "THE TAIL WAS COPIED. In a conforming Scheme host would read
(1 CHANGED 9) and shared would be #t." The engine now prints exactly the
*conforming* answer:

```
(host (1 CHANGED 9) tail (CHANGED 9) shared #t)
```

Related, `39-list.slat:5034`: the note says `memq` misses `1/2` "because the
two 1/2s are distinct objects"; `memq` now finds it.

I left both alone — this is the pair-identity question that is awaiting your
decision, and these notes are teaching material *about* that decision. But as
written they now teach the opposite of what the engine does, so they need to
move one way or the other before CPT ZERO.

## 13. Deferred to Marcus (his six files — not touched, to avoid a collision)

54 of the 272 REVIEW rows are in `40-math.slat` (30), `01-core.slat` (22) and
`24-entity.slat` (2). Not read, not edited. `35-io.slat`, `32-hash.slat` and
`07-audio.slat` had no REVIEW rows at all.

## 14. Two smaller notes I could not repair honestly

- `02-ai.slat:2307` — note says `(llm/config)` prints `((:backend none))`. It
  prints that plus `:home` and `:model-dir`, which are **absolute paths to the
  current `$MOTOI_HOME`**. The true value is machine-specific, so there is no
  stable string to write. The note needs re-authoring to stop quoting output,
  not a value swap.
- `00-intro.slat:919-921` — the `:code` is the literal token `...`. These are
  authoring placeholders, not defects; they will emit as unbound-symbol errors.

## 15. Corpus follow-on (a book, not the language)

`scheme-books/book-of-math/appendix-W-unwired-verbs-2026-07-22.book.slatl:105`
shows `(matrix/->string (matrix/identity 2))` → `"((1 0)(0 1))"`. I changed the
engine to the reference's spaced form (below), so that book line is now stale.
Language before corpus, so I left the book alone.

---

# What I DID change (all verified by running; suite and notes gate re-run clean)

**Engine — `lib/graphics/geom.js`**

- `geom/rotate` — was `(p, angle)`, reference `29-geom.slat:2460` is
  `(geom/rotate x y theta)` and its `:impl-notes` says so outright. Every
  documented call fed a bare number to `pt()` (which falls through to `[0,0]`)
  and dropped theta, so **every call returned `(0 0)`**. Now takes the flat
  3-arg form; the 2-arg point form still works. Caller survey found **zero**
  point-first callers outside the binding itself — all 33 sites across
  `scheme/`, `scheme-books/` and `lib/` are 3-arg flat.
  `(geom/rotate 1 0 0)` → `(1 0)`; `(geom/rotate 3 4 (geom/->radians 180))` →
  `(-3.0000000000000004 -3.9999999999999996)`.
- `geom/midpoint` — same defect, `(0 0)` for every documented call. Now accepts
  **both** the reference's flat `(x1 y1 x2 y2)` and the 2-point form, because
  `scheme-books/` really does call it as `(geom/midpoint p1 p2)` /
  `(geom/midpoint A B)` / `(geom/midpoint pt-a pt-b)` and
  `tests/core-wave-1-math-geom-vec.test.mjs:150` asserts the point form. Widened
  deliberately, following the dual-shape precedent already in `geom/distance`.
  `(geom/midpoint 0 0 10 10)` → `(5 5)`; `(geom/midpoint 2 4 6 8)` → `(4 6)`.
- `geom/slope` — same, `+inf.0` for every documented call. Accepts both shapes
  now, for the same reason (books call it 2-point, a test asserts it).
  `(geom/slope 0 0 1 1)` → `1`. Vertical-line value left as Infinity, see §3.

**Engine — `lib/graphics/geom-extended.js`**

- `geom/rotate-about` — was treating its angle as radians;
  `29-geom.slat:2522` says degrees in the summary, in the explanation ("The
  angle is measured in degrees, not radians"), and in all three examples
  (90, 45, 45). No radian caller exists — every site passes `deg`, 45, 90 or 0.
  `(geom/rotate-about (list 1 0) (list 0 0) 90)` → `(6.12e-17 1)`, matching
  the note's "result is near (0,1)". `geom/rotate` stays radians, per its own
  record.

**Engine — `lib/graphics/vec.js`**

- `vec/+` and `vec/-` were bound as strict 2-arg zips; `69-vec.slat:38` and
  `:111` document both as N-ary, with "single-arg negates, N-ary subtracts
  left-to-right". Failed silently in two directions: extra vectors were
  dropped (`(vec/+ '(1 1) '(2 2) '(3 3))` → `(3 3)`) and the documented unary
  form zipped against `undefined`, poisoning only the first component
  (`(vec/- '(1 2 3))` → `(+nan.0 2 3)`). Now `(-1 -2 -3)` and `(6 6)`.
  `vec/add` / `vec/sub` left binary — that is what their own records say.

**Engine — `lib/math/matrix.js`**

- `matrix/->string` joined rows with `''`. The reference says spaced in six
  places, including the normative `:impl-notes` (`"((r0-c0 r0-c1 ...) (r1-c0
  r1-c1 ...) ...)"`), the `:explanation` ("using parens and spaces"), two notes
  that quote the result as a string literal, and `69-vec.slat:221`. Now
  `(matrix/->string '((1 2)(3 4)))` → `"((1 2) (3 4))"`, matching both notes
  exactly.

**Engine — `lib/math/comb.js`**

- `comb/pascal-triangle` returned n+1 rows. `15-comb.slat:502` says "the first
  n rows" in the summary and in two examples — the second maps `length` over
  `(comb/pascal-triangle 5)` and states the answer is `(1 2 3 4 5)`; it was
  `(1 2 3 4 5 6)`. Fixed the loop bound and updated the file's own inline
  self-test, which had the off-by-one baked in. Fixing the *notes* instead
  would have contradicted the signature. `comb/pascal-row` is untouched and
  stays 0-indexed.

**Reference notes (shape (a) — engine was right, note stated a wrong number)**

`47-ops.slat` — four notes, each cross-checked against an independent Python
computation that matched the engine to the last digit:

- `(ops/eoq 1000 50 5)` — note said ≈447; √(2·1000·50/5) = √20000 = **141.42**.
  The 447 came from using h = 0.5.
- `(ops/erlang-b 3 5)` — note said ≈0.065; correct blocking probability is
  **0.110**.
- `(ops/erlang-c 4 6)` — note said ≈0.57; correct queue probability is
  **0.285**.
- `(ops/safety-stock 1.96 5.2 2)` — note said ≈20.3; z·σ·√L =
  1.96·5.2·√2 = **14.41**. The 20.3 came from using L instead of √L.

`41-matrix.slat:535` — `(matrix/identity 2)` note read "Returns [[1 0] [0 1]]",
JS bracket notation in a Scheme corpus. Now `((1 0) (0 1))`, the printed value.

`59-stat.slat:649` — `(stat/sd-sample '(5))` note said "Returns 0 … the impl
doesn't raise". It returns `(escalate no-spread)`, which the verb's own
`:signature` already lists as a valid third arm. Note corrected to match.

Backups (`.bak-20260804T*`) sit beside every file touched.
