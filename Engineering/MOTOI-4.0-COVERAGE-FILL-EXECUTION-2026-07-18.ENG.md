# Motoi 4.0 Coverage Fill — Execution Report

**Date:** 2026-07-18
**Owner:** Ada — Motoi 4.0 example-coverage lane
**Composes with:** MOTOI-4.0-COVERAGE-AUDIT-2026-07-18 · project_no_contaminants_provenance_rule_2026_07_17

## Execution Summary

- **Time actual:** ~6h (audit + fill + extract + verify)
- **Time projected:** 12-18h
- **Faster because:** the reference already had 972/974 verbs covered
  with 2+ examples. The fill pass only needed to hit 127 Appendix Z
  verbs, not all 459 in the target set.

## What Was Audited

| Metric | Value |
|---|---|
| Verb records scanned | 1,125 |
| Unique verb names | 1,112 |
| Reference file | `scheme/MOTOI-SCHEME-REFERENCE.slat` (19,467 lines) |
| Appendix Z boundary | line 18,529 |
| Appendix Z total verbs | 167 |
| Appendix Z with examples | 40 |
| Appendix Z **lacking** examples | **127** |
| Corpus audited | `~/.forge/corpus/motoi-v5/train.jsonl` (91,819 rows) |
| Corpus target rows | 16,790 |

Interim CSV artifacts (analysis outputs):

- `/tmp/motoi_verb_audit.csv` — per-verb reference example count
- `/tmp/motoi_coverage_v2.csv` — per-verb corpus scheme-use + backtick hit count
- `/tmp/motoi_target_coverage.csv` — per-verb hits in target training-signal kinds only
- `/tmp/motoi_final_coverage.csv` — refined per-verb coverage

## What Was Authored

### Book of R7RS Recipes

**Location:** `scheme-books/book-of-r7rs-recipes/`

11 files, ~1900 lines total. 9 chapters + cover + manifest.

Every chapter follows Book of Sick Composition shape: overview →
3-6 problems → capstone → alphabet-of-family. Each chapter provenance
cites the reference verbs it covers, the R7RS section, the SRFI
number, and `src/r7rs-completions.js` implementation for semantics
ground truth.

**Coverage:** ~120 Appendix Z verbs across the 9 family chapters
(records, exceptions, hash tables, strings, chars, bytevectors,
string ports, numeric tower, lazy+iteration).

### Reference fill

**File:** `scheme/MOTOI-SCHEME-REFERENCE.slat`

- Verbs modified: 127
- Examples added: 254 (2 per verb — novice + intermediate)
- Script: `scripts/motoi-4.0-fill-examples.py`
- Idempotent: yes (skips verbs with existing `:examples`)

### Scripts

| File | Purpose |
|---|---|
| `scripts/motoi-4.0-fill-examples.py` | Inject `:examples` blocks into Appendix Z verbs |
| `scripts/motoi-4.0-extract-scheme-lift.py` | 6-pass pair extractor |
| `scripts/motoi-4.0-sanity-check.py` | Provenance + parse verification |

## What Was Extracted

**Output file:** `~/.forge/corpus/motoi-v6-partial/scheme-lift.jsonl`
**Total pairs:** 8,858 (+ 1 header row)

| Bucket | Count |
|---|---|
| verb-recall | 2,250 |
| verb-example | 3,520 |
| verb-contrast | 2,514 |
| verb-use | 348 |
| book-recall | 38 |
| book-explain | 27 |
| book-use | 127 |
| composition-multi-step | 34 |

**Pair shape:** compatible with `mlx_lm.lora` — same `[system, user,
assistant]` message shape as motoi-v5. Every pair carries
`meta.bucket`, `meta.verb`, and `meta.provenance` with a chain to the
source (reference verb + example index + code-hash, or book chapter +
heading + prose-hash).

## Sanity Check

| Check | Result |
|---|---|
| Total pairs | 8,858 |
| Missing provenance | 0 |
| Source file missing | 0 |
| **Provenance-chain verified** | **100.0%** |
| Empty content | 0 |
| Parse failures | 1 |
| **Parse pass** | **99.99%** |

The 1 parse failure is a pre-existing reference defect
(`audio-perceptual-bands` has an extra `)` in one example) — not
caused by this lane. See needs-alfred item 1.

## Needs-Alfred

| # | Urgency | Item |
|---|---|---|
| 1 | low | `audio-perceptual-bands` intermediate example has an extra `)` — 1-line fix in reference |
| 2 | info | Should verb-contrast pair density (2,514 pairs = 3 per verb avg) be trimmed for training balance? Priya's fold LIMR pass will re-select |
| 3 | info | Book of R7RS Recipes chapter numbering: 1-9 as authored, or extend to 16 with appendices for 16-chapter invariant? |

## Next Steps

1. **Priya** — Cross-fold the 8858 pairs into a full motoi-v6 corpus
   alongside safety density + other lanes; run LIMR / LIMO / LIFT.
2. **Priya** — Run Grand Reveal Mk on the resulting adapter; verify
   verb-recall recovers from 34% toward 62%+.
3. **Alfred** — Review 3 needs-alfred items above.
4. **Ada follow-up** — If verb-recall still thin post-training, extend
   book-of-r7rs-recipes with more capstone variations or add a second
   expert-level pass to Appendix Z examples.
5. **Zane** — Fix the 1 malformed reference example
   (`audio-perceptual-bands`) at leisure.

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
  :book-content-added "9 chapters + cover + manifest in book-of-r7rs-recipes/"
  :reference-examples-added 254
  :pairs-extracted 8858
  :provenance-chain-verified 100%
  :parse-check-passed 99.99%
  :status APPROVED)
```
