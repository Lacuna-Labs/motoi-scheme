# Motoi 4.0 Coverage Audit

**Date:** 2026-07-18
**Owner:** Ada — Motoi 4.0 example-coverage lane
**Composes with:** project_no_contaminants_provenance_rule_2026_07_17 · project_sakura_scheme_lock_post_audit_2026_07_18 · MOTOI-3.5-EXECUTION-2026-07-18 · MOTOI-SCHEME-FINALIZATION-2026-07-18

## Executive Summary

Motoi 3.5 Mk D showed verb-recall dropped from 62% (Mk A) to 34% (Mk D)
because safety density crowded out verb density. Alfred: *"solve the
entire example coverage problem."* The 2026-07-18 Zane FILL PASS landed
120 R7RS + SRFI verbs (Appendix Z) into the reference but thin on
examples.

**Approach:** three-part audit — (1) reference-level example density
per verb; (2) corpus-level pair density per verb across target
buckets; (3) Appendix Z specifically.

**Verdict:** 1,112 unique verbs audited across 1,125 verb records.
Reference gained `:examples` blocks for 127 previously-thin Appendix Z
verbs. Book of R7RS Recipes authored (9 chapters covering records,
exceptions, hash tables, strings, chars, bytevectors, string ports,
numeric tower, lazy+iteration). **8,858 Scheme-lift pairs** extracted
with **100% provenance chain** and **99.99% parse-check pass**.

## Phase 1 — Reference Coverage Audit

Method: parse `MOTOI-SCHEME-REFERENCE.slat` with a paren-balanced
top-level form walker. For each `(verb ...)` record, count `:examples`
entries and note `:summary` + `:signature` presence.

| Metric | Value |
|---|---|
| Total verb records | 1,125 |
| Unique verb names | 1,112 |
| Duplicate verb records | 13 |

**Pre-fill state:**
- With 2+ examples: 972
- With 1 example: 2 (`filter-map`, `delete-duplicates`)
- With 0 examples: 0 in original CORE — but **127 Appendix Z verbs lacked `:examples` blocks entirely**

**Appendix Z audit:**
- Total Appendix Z verbs: 167
- With :examples block: 40
- Without :examples block: **127**

The CORE 335 verbs had complete reference-level coverage before this
lane. The 120 Appendix Z additions from Zane's 2026-07-18 FILL PASS
landed the reference paragraphs but were thin on worked examples.
This lane closed that gap.

## Phase 1b — Corpus Coverage Audit (v5 substrate)

Method: load `train.jsonl` (91,819 rows) filtered to target
training-signal kinds. For each of 974 reference verbs, count
occurrences of scheme-use `(verb ...` or backtick mention across those
filtered rows.

**Target rows in v5:** 16,790

**Buckets observed in v5:**

| Bucket | Count |
|---|---|
| graph-code-teaching | 1,109 |
| book-recall | 754 |
| book-explain | 748 |
| book-use | 196 |
| verb-explain | 100 |
| verb-use | 80 |
| sick-composition-nothing-to-something | 48 |
| composition-multi-step-scheme | 25 |
| verb-contrast | 22 |
| composition-big-bang | 11 |
| composition-higher-order-chain | 10 |
| composition-list-manipulation | 10 |

**Per-verb coverage in target-kind pair set:**

| Bucket | Count |
|---|---|
| MISSING (0 hits) | 4 — `concatenate`, `append-map`, `unzip`, `string-contains` |
| THIN (1-2 hits) | 49 |
| OK (3-9 hits) | 498 |
| COVERED (10+ hits) | 423 |

**Interpretation:** coverage in the reference layer is complete.
Coverage in the corpus training-signal layer is majority OK-or-better
(94%). But when the explicit `verb-*` buckets alone are considered:
only **202 verb-explain + verb-use + verb-contrast pairs across 974
verbs = 0.2 pairs per verb**. That density is what safety crowded out
to produce Mk D's 34% verb-recall. The lift target: rebuild `verb-*`
pair density.

**Appendix Z in corpus audit:** of 167 Appendix Z verbs sampled
against v5 train, 50 have zero occurrences and ~35 more are thin. The
"OK" hits are polluted by common English words (`fold`, `find`, `do`,
`write`), so actual scheme-use coverage is much thinner than raw
counts suggest.

## Phase 2 — Fill Pass

### Book content added

**New book: Book of R7RS Recipes** — `scheme-books/book-of-r7rs-recipes/`

11 files, 9 chapters + cover + manifest:

| Ch | Title |
|---|---|
| 0 | Cover — what this book is and how to read it |
| 1 | Records — `define-record-type` and the shape of a struct |
| 2 | Exceptions — `guard`, `raise`, and staying alive when things break |
| 3 | Hash Tables — `make-hash-table` and the joy of lookup |
| 4 | The String Library — split, join, trim, and everything you meant to say |
| 5 | Character Predicates — `char-alphabetic?`, `char-upcase`, and the ASCII neighborhood |
| 6 | Bytevectors — the raw byte and when you actually need one |
| 7 | String Ports — capturing output and replaying input |
| 8 | The Numeric Tower — `exact`, `inexact`, and the story of one-half |
| 9 | Lazy and Iteration — `delay`, `force`, `do`, and doing something many times |

**Shape:** every chapter follows Book of Sick Composition — overview
→ 3-6 problems → capstone → alphabet-of-family. Each verb-use is a
real Motoi call verified against `src/r7rs-completions.js` semantics.

Approximately **120 Appendix Z verbs** covered across the 9 family
chapters.

### Reference additions

**File:** `scheme/MOTOI-SCHEME-REFERENCE.slat`

**Verbs injected:** 127
**Examples per verb:** 2 (novice + intermediate)
**New examples added:** 254

**Method:** `scripts/motoi-4.0-fill-examples.py` (idempotent — runs
skip if `:examples` block already present).

All 127 previously-thin Appendix Z verbs now have novice + intermediate
examples. Semantics verified against R7RS-small + SRFI-1/13/125 spec +
`src/r7rs-completions.js` implementation.

### Provenance check

- All examples cite source (R7RS section or SRFI number): YES
- No LLM invention: YES
- R7RS section cited per verb: YES

## Phase 3 — Extract (Scheme lift)

**Output:** `~/.forge/corpus/motoi-v6-partial/scheme-lift.jsonl`
**Total pairs:** 8,858 (+ 1 header row)

**Bucket distribution:**

| Bucket | Count | Method |
|---|---|---|
| verb-recall | 2,250 | "what does X do?" → `:summary` (2 per verb, rotating templates) |
| verb-example | 3,520 | "show me X at tier T" → fenced code + note |
| verb-contrast | 2,514 | "X vs Y?" → summary of each (capped 3 per verb from `:related`) |
| verb-use | 348 | "run (X args)" → exact result parsed from `:note` |
| book-recall | 38 | "what does chapter N teach?" → title |
| book-explain | 27 | "what does 'X' mean in book?" → first paragraphs of section |
| book-use | 127 | "in Motoi, how do I X?" → code block from prose |
| composition-multi-step | 34 | "walk through capstone of chapter N" → code + explanation |

**Method:** `scripts/motoi-4.0-extract-scheme-lift.py` — 6 extractor
passes. Every pair carries `meta.provenance` chain pointing to
reference file + verb name + example index + code-hash (or book file +
chapter + heading + prose-hash).

## Phase 4 — Sanity Check

**Method:** `scripts/motoi-4.0-sanity-check.py` — loads all 8858 pairs
and verifies: (a) 3-message shape, (b) non-empty content, (c)
`meta.bucket` + `meta.provenance` present, (d) source-file provenance
points at real disk file, (e) fenced motoi code blocks parse-check via
balanced-paren walker.

**Results:**

| Check | Result |
|---|---|
| Total pairs | 8,858 |
| Missing provenance | 0 |
| Source file missing | 0 |
| **Provenance-chain verified** | **100.0%** |
| Empty content | 0 |
| Parse failures | 1 |
| **Parse pass** | **99.99%** |

**Parse failure detail:** 1 verb — `audio-perceptual-bands`
intermediate example has unbalanced parens (`(let ((pbands (audio-perceptual-bands))))`
— extra `)`). Pre-existing reference defect; needs one-line fix in
`MOTOI-SCHEME-REFERENCE.slat`.

**Unique source files referenced:** 20
**Top sources:**

| Count | Path |
|---|---|
| 8,632 | `scheme/MOTOI-SCHEME-REFERENCE.slat` |
| 22 | `scheme-books/book-of-r7rs-recipes/09-lazy-and-iteration.book.slatl` |
| 18 | `scheme-books/book-of-r7rs-recipes/08-numeric-tower.book.slatl` |
| 15 | `scheme-books/book-of-r7rs-recipes/05-character-predicates.book.slatl` |
| 14 | `scheme-books/book-of-r7rs-recipes/06-bytevectors.book.slatl` |
| 13 | `scheme-books/book-of-sick-composition/02-list-manipulation.book.slatl` |
| 13 | `scheme-books/book-of-sick-composition/08-sound-and-music.book.slatl` |
| 12 | `scheme-books/book-of-r7rs-recipes/03-hash-tables.book.slatl` |
| 12 | `scheme-books/book-of-r7rs-recipes/04-string-library.book.slatl` |
| 12 | `scheme-books/book-of-sick-composition/04-recursion.book.slatl` |

## Needs-Alfred

| # | Item | Severity |
|---|---|---|
| 1 | `audio-perceptual-bands` reference example has unbalanced parens — extra `)` in `(let ((pbands (audio-perceptual-bands))))` | trivial — 1-pair impact |
| 2 | `hash-table-update!` verify existing native `:examples` block adequate | info |
| 3 | `raise-continuable` maps to `raise` (per Zane finalization needs-alfred item 2) — keep as landed | info, non-blocking for training |

## Deliverables

1. `engineering/MOTOI-4.0-COVERAGE-AUDIT-2026-07-18.ENG.slat` (this doc source)
2. `engineering/MOTOI-4.0-COVERAGE-AUDIT-2026-07-18.ENG.md` (this file)
3. `engineering/MOTOI-4.0-COVERAGE-FILL-EXECUTION-2026-07-18.ENG.slat`
4. `engineering/MOTOI-4.0-COVERAGE-FILL-EXECUTION-2026-07-18.ENG.md`
5. `scheme-books/book-of-r7rs-recipes/` — 11 files (9 chapters + cover + manifest)
6. `scheme/MOTOI-SCHEME-REFERENCE.slat` — 127 `:examples` blocks added inline to Appendix Z
7. `~/.forge/corpus/motoi-v6-partial/scheme-lift.jsonl` — 8,858 pair Scheme lift with 100% provenance chain
8. `scripts/motoi-4.0-fill-examples.py` — fill-examples script (idempotent)
9. `scripts/motoi-4.0-extract-scheme-lift.py` — pair extractor
10. `scripts/motoi-4.0-sanity-check.py` — sanity checker

## Ada Cosign

```
(ada-cosign
  :date "2026-07-18"
  :scope "motoi 4.0 coverage audit + fill + scheme-lift extraction"
  :verbs-audited 1112
  :verbs-covered 972
  :verbs-thin 2
  :verbs-missing 127
  :verbs-needs-alfred 3
  :book-content-added "9 chapters + cover + manifest = 11 files in book-of-r7rs-recipes/"
  :reference-examples-added 254
  :pairs-extracted 8858
  :provenance-chain-verified 100%
  :parse-check-passed 99.99%
  :status APPROVED)
```
