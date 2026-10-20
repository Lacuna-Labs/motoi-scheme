# Book Audit — Findings (report-only, 2026-07-25)

Auditor pass over the scheme + engineering books. **No files edited.** Four lenses:
structure/metadata · runnability · standard-conformance · prose/pedagogy.

Scope audited: `scheme-books/` (32 book dirs, 804 `.book.slatl` + 30 `.slat`),
`SRE-MANUAL/`, `docs/LANG-ENGINEERING-1.0.ENG.slat`, `docs/LANG-DESIGN-1.0.ENG.slat`.
Mechanical engine: `scratch/book-audit.py` → `scratch/book-audit.json`.

Headline: **875 files scanned · 430 runnable blocks (362 pass / 68 fail) ·
54 banned-fold hits across 11 files · 24 of 32 books missing `:book-type` ·
0 contaminant files.**

---

## Lens 1 — Standard conformance (excluded fold names)

Standard is LOCKED: R7RS-small + SRFI-1/13/125/27. EXCLUDED at runtime (all confirmed
unbound): `fold-left` (acc-first), `foldl`, `foldr`. Use SRFI-1 `fold`/`fold-right`
(element-first). 54 real hits in 11 files (+4 legitimately in x-dialect teaching dirs,
which are fine). Triaged:

### GENUINE violations — teach/use excluded names as if normal (candidate fixes)
| File | Hits | What it does |
|---|---|---|
| `book-of-challenges/ch12-composition-and-macros` | 15 | `foldl`/`foldr` throughout solution code, no note they're non-standard |
| `book-of-challenges/ch16-the-summit` | 14 | `foldl` in every summit solution (`(foldl + 0 scores)`, reducers) |
| `book-of-music/ch02-language` | 10 | **defines `foldl` locally, acc-first, marks it `BUILD: runnable`, and frames it as the fold** — runs green, teaches the excluded shape as canonical |
| `book-of-challenges/ch01-recursion-warmups` | 3 | `fold-left` in solution code |
| `book-of-logic/ch13-non-monotonic-and-default-logic` | 2 | `fold-left` in code; also lists `"fold-left"` in a keyword table |
| `book-of-animation/ch11-flocking` | 1 | `fold-left` in flocking accumulation |
| `book-of-cs-curriculum/04-trees` | 1 | `(fold-left bst-insert '() ...)` |

### SELF-AWARE (names the divergence, provides a shim) — softer
| File | Hits | Note |
|---|---|---|
| `book-of-challenges/ch04-list-surgery` | 5 | explicitly says "many Schemes call right fold `foldr`… assume `(define (foldr …))`" and ships a local def. Names the difference but still works in the excluded name. |

### BENIGN / false-positive (meta-discussion, correct contrast)
- `SRE-MANUAL/ch06-standard-library-operations` (1) — a comment *contrasting* "another
  dialect would make — fold-left with the accumulator first". Correct teaching. Leave.
- `book-of-challenges/ch07-numbers-and-stats` (1), `book-of-introspection/01` (1) — word
  appears in prose; not code. Negligible.

**Recommendation if you say "fix":** rewrite ch12 + ch16 + ch01 (challenges),
ch11 (animation), 04-trees (cs-curriculum), ch13 (logic) to SRFI-1 `fold`/`fold-right`
(element-first, swap arg order). `book-of-music/ch02` is the sharpest: it *teaches* the
excluded name as the fold — recast to `fold` or clearly re-label as a broken-example.
ch04 (list-surgery) can keep its shim but should point at `fold-right` as the real name.

---

## Lens 2 — Runnability (362/430 pass, 84%)

Failure breakdown from the harness: 33 unbound-symbol · 31 runtime-error · 4 syntax.
**Important methodology caveat:** the harness runs each fenced block *standalone*. Books
build `define`s across blocks within a chapter, so a large share of "failures" are
**isolation artifacts, not book defects.** Failures cluster in just 5 files:

| File | Fails | True cause |
|---|---|---|
| `book-of-music/ch02-language` | 25 | music-dialect verbs (`beep`, `play-note`, `pitch-table`, `play-by-range`…) — **not in base**, need a music layer |
| `book-of-math/ch-advanced-03-sequences-series-recurrence` | 19 | **isolation artifacts** — `seq/recurrence` IS wired (verified); errors are `undefined`/symbol args because earlier `define`s weren't in scope for the standalone block |
| `book-of-music/appendix-drill-11-world-percussion` | 10 | music-dialect verbs |
| `book-of-music/ch09-polyphony` | 3 | music-dialect verbs |
| `book-of-music/appendix-drill-12-ornamentation` | 3 | music-dialect verbs (`trill`, `tremolo`, `arpeggio`) |

Two real, actionable findings under the noise:
1. **`BUILD: runnable` is over-applied on music books.** Blocks that need a music dialect
   layer are marked base-runnable and fail under `./bin/motoi run`. Either (a) gate the
   marker to base-runnable code, or (b) teach the harness which dialect a book loads.
2. **Chapter-scoped runnability is untested.** To distinguish real breakage from isolation
   artifacts, the harness should concatenate a chapter's runnable blocks in order before
   running. Recommend before any "fix" pass so we don't chase phantom failures.

**Zero** banned-fold failures surfaced in runnable blocks — the excluded names live in
prose/solution code, not in green-marked runnable examples (except ch02's locally-defined
`foldl`, which passes precisely because it's redefined).

---

## Lens 3 — Structure + metadata

- **`:book-type` coverage: 8 of 32 books.** Registry (`docs/BOOK-TYPES.slat`) states every
  book must carry `:book-type` in its README + manifest. Only these declare it:
  composition, introspection, limits, modules, r7rs-recipes, self, sick-composition, values.
  **24 books missing it**, including core learning books (book-of-scheme, book-of-code,
  book-of-math, book-of-sound, book-of-music, book-of-cs-curriculum, book-of-animation,
  book-of-logic, book-of-computing, book-of-ml, book-of-slat, book-of-systems) and all four
  application books (arcade/narrative/simulation-games, instruments). The registry already
  lists the intended type for each — so this is a fill-from-registry job, not a decision.
  *(My first audit pass wrongly flagged 801 chapter files; the field is per-book, in
  README/manifest, not per-chapter. Corrected.)*
- **Type/registry mismatches to confirm:** `book-of-limits` declares `composition` but the
  registry narrative treats it as a limits/x-dialect teaching book; `book-of-sick-composition`
  declares `learning` but the registry groups it under `composition`. Worth reconciling.
- **Contaminant files: 0.** No NOTES/TODO/continuation/status/SCRATCH files in the book trees.
  Clean per the NO-notes-in-official-dirs doctrine.
- **Not-in-registry dirs:** `book-of-ai-tech-cards`, `book-of-reminded` don't appear in the
  registry's per-type `:books` lists — either add them or confirm they're intentional.

---

## Lens 4 — Prose + pedagogy (spot-check)

- **book-of-scheme/08-higher-order** — already conformed this session (element-first `fold`
  prose, `fold-right`/`fold` idioms). Reads clean and correct.
- **The fold story is the systemic pedagogy risk.** Multiple books independently reach for
  `foldl`/`foldr`/`fold-left` because that's the muscle memory from other Schemes. The
  conformance sweep (Lens 1) and the pedagogy fix are the same edit: teach `fold`/`fold-right`
  element-first everywhere, and route the excluded names through `broken-examples/` as
  deliberate contrast (keep-broken-lane doctrine — they're teaching signal, not deletions).
- **book-of-music/ch02** is the one place a book *actively teaches the wrong thing* (defines
  `foldl` acc-first, calls it the fold). Highest-priority prose fix if you greenlight edits.

---

## Suggested fix order (if/when you say "fix")

1. `book-of-music/ch02` — stop teaching `foldl` acc-first as the fold (conformance + pedagogy).
2. `book-of-challenges` ch01/ch04/ch12/ch16 — SRFI-1 `fold`/`fold-right`; excluded names → broken-examples.
3. `book-of-animation/ch11`, `book-of-cs-curriculum/04-trees`, `book-of-logic/ch13` — same fold conform.
4. Fill `:book-type` for the 24 missing books from `docs/BOOK-TYPES.slat` (mechanical).
5. Reconcile the 2 type/registry mismatches + 2 not-in-registry dirs.
6. Fix runnability harness to run chapter-scoped (concatenated) before re-judging the 68 fails;
   gate `BUILD: runnable` on music books or make the harness dialect-aware.

All of the above is **report-only until you say "fix".** No edits made in this pass.
