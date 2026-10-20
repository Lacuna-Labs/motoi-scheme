# Where every row came from, and whether it may go into MK-ULTRA

2026-08-03. Local only. Read-only — nothing under `~/motoi-corpus` was modified.
Scripts `scratch/corpus-provenance-census.py`, `scratch/verify-fold.py`.
Raw index `scratch/corpus-provenance.json`.

There is one CPT and one SFT. The CPT is **CPT ULTRA**, emitted 2026-07-30.
The SFT being built is **MK-ULTRA**. Nothing here is called v3.

---

## The line

The stdlib was locked **2026-07-24** (R7RS-small + SRFI-1/13/125/27). Anything
authored before that date was authored against a language that has since changed
underneath it — roughly 300 verbs were added and the reader was patched. Its
code is not *known* wrong; it is *unverifiable*, which for training is the same
thing. That date is the only classification rule used below.

Filesystem dates inside `~/motoi-corpus` are all 2026-08-02, the copy date, and
carry no signal. The dates below are the **originals'** mtimes, taken from the
paths named in `WHAT-IS-HERE.md`.

---

## Category 1 — ELIGIBLE for MK-ULTRA

**219,162 rows. 12.5% of what is on disk.**

| rows | folder | built | original path |
|---:|---|---|---|
| 199,940 | `sft-fold/` | 2026-07-31 | `~/code/forge/scratch/sft-plans/fold/` |
| 15,535 | `sft-staging/` | 2026-08-01 | `~/code/forge/scratch/sft-plans/fold-staging/` |
| 3,687 | `haiku-revoice/` | 2026-07-31 | `~/code/forge/scratch/sft-plans/` |

Every row carries `tags.provenance`. Within the eligible set it takes six values,
and each one names a different way the row was made:

| rows | provenance | what it means |
|---:|---|---|
| 115,926 | `corpus-grounded-generate-then-verify` | reversals; the block was run against the engine at build time, `oracle_verified: true` |
| 12,432 | `reference-source-deterministic` | ref-grid; generated straight from the reference source, no model |
| 10,123 | `staging-revoice-qwen2.5-7b` | local fills |
| 10,000 | `minted-10th-seam-generate-then-verify` | `mk-ultra-reversals.jsonl` — the held-out 10,000 |
| 9,276 | `exploded-claude-cli-claude-haiku-4-5` | the re-voice work (see the census below) |
| 3,749 | `book-code-verified` | book code blocks that ran |
| 3,012 | `staging-revoice-reframed-qwen2.5-7b` | local fills, reframed |
| 2,375 | `staging-revoice-mistral` | local fills |
| 1,220 | `module-qa-claude-sonnet-4-6` | R8 module Q&A |
| 601 | `wordbook-dialogue-claude-sonnet-4-6` | wordbook philosopher dialogue |

### 34,414 of those 199,940 are not fold rows

They are rejects and caches that were copied along with the fold and are sitting
in the fold root, which is the exact condition the hygiene gate warns about
(intermediates in the fold root produced the self-BLEU 1.000 artifact):

| rows | file |
|---:|---|
| 14,024 | `_corpus-reversal-broken.jsonl` |
| 11,967 | `.book-code-cache.jsonl` |
| 3,691 | `_book-code-broken.jsonl` |
| 2,371 | `_corpus-reversal-skipped.jsonl` |
| 1,470 | `attic/_book-code-broken.pre-emptyfix.012147.jsonl` |
| 868 | `attic/_ref-broken.pre-emptyfix.012147.jsonl` |
| 23 | `_ref-broken.jsonl`, `_ref-broken.pilot.jsonl` |

**Real eligible fold body: 165,526 rows.** Any packer must exclude leading-`_`,
leading-`.`, and `attic/`. That is one filename rule, not a judgement call.

---

## Category 2 — QUARANTINE

**1,540,868 rows. 87.5%.** None of it may enter MK-ULTRA.

| rows | folder | built | why it is out |
|---:|---|---|---|
| 791,906 | `sakura-corpus/` | 2026-06-01 → 2026-07-09 | wrong dialect *and* pre-lock. This is Sakura's corpus, not Motoi's |
| 398,701 | `packed-sft/` | 2026-05-27 → 2026-07-19 | three packed generations, all pre-lock. 362,261 of its rows name an `older-generation` `_source_file`, so it is mostly a re-pack of the folder below |
| 273,822 | `older-generation/` | 2026-07-20 | built against the old Sakura reference (1,282 verbs), four days before the lock |
| 76,439 | `cpt/` | 2026-07-07 | **this is the wrong CPT** — see below |

None of it carries `tags.provenance` at all. That absence is itself the tell:
the provenance field was introduced with the current generators.

### The CPT in `~/motoi-corpus/cpt/` is the old CPT

It is 76,439 rows dated **2026-07-07**, from `~/.forge/corpus/cpt-text/`.

CPT ULTRA is the **2026-07-30 18:56** emit, in motoi, at
`~/code/motoi-scheme/scratch/attic/2026-07-30-sakura-curator-scrub/` — 89,000
lines of `cpt-stream.jsonl` plus its per-lane sources (`book-text`, `reference`,
`axis-{sensation,intuition,thinking,feeling}`, `code-fim`, …). It is the last of
three passes that day (prescrub → attribution → sakura-curator-scrub), so it is
the scrubbed one. It never got copied into `~/motoi-corpus`.

The emit scripts agree with those dates: `emit_cpt.py` / `_v3` / `_v4` are all
2026-07-21, and `emit_cpt_v5.py` is **2026-07-27** — after the stdlib lock, which
is why its output is the one that counts.

**The CPT training run is not on this machine, and its date cannot be
established from local evidence.** `~/.forge/runs/` holds eight `motoi-*` runs,
all 2026-07-17 → 2026-07-19, and every one is LoRA SFT on
`Qwen2.5-Coder-1.5B-Instruct` against `~/.forge/corpus/motoi-v3` … `motoi-v6`.
`forge-fire-cpt.sh` exists (2026-07-21) and its example names a run
`motoi-mk2-cpt`; no such project or run directory exists here. So what is
datable locally is the corpus, not the run.

Consequence: a CPT emit supersedes, it does not accumulate. The Jul-7 set is a
snapshot of a language that no longer exists. It goes in the quarantine pile
with the rest.

---

## The re-voice census — what actually got finished

The Haiku rows are not "model output." Haiku was reading the reference and the
books through and re-speaking each one in three registers (kid / layperson /
phd). It stopped partway. This is what it got through.

### Reference: 1,229 of 1,679 verbs. **451 left.**

The reference now documents **1,679** records. Haiku voiced **1,229** of them,
in all three registers each (3,687 rows = 1,229 × 3). One voiced verb no longer
exists in the reference — drift, negligible.

**451 documented verbs have never been voiced.** That is the reference work list.

### Books: 3 of 34 finished. **24 never touched.**

34 books on disk, 895 chapters. Re-voice rows exist for 10 books, 143 chapters.

| book | chapters voiced / on disk | registers |
|---|---:|---|
| Book of Challenges | 17 / 19 | kid, layperson, phd |
| Book of Arcade Games | 30 / 32 | kid, layperson, phd |
| Book of Animation | 23 / 25 | kid, layperson, phd |
| Book of Composition | 25 / 28 | phd only |
| Book of Code | 23 / 27 | phd, partial layperson |
| Book of Computing | 17 / 19 | phd only |
| Book of Craft | 3 / 10 | phd only |
| Book of Sound | 2 / 21 | layperson only |
| The Book of Motoi Scheme | 2 / 29 | phd only |
| Book of Math II | 1 / 40 | kid only |

**Three books are done in all three registers. Six more are one-register drafts.
Twenty-four books have zero rows:** ai-tech-cards, cs-curriculum, instruments,
introspection, jesse, language-ancestors, limits, logic, math (beyond one
chapter), ml, modules, motion, music, narrative-games, one-shot, r7rs-recipes,
reminded, scheme, self, sick-composition, simulation-games, slat, systems,
values, your-own-dialect.

That is the whole voice backlog, and it is the work the local models can do
overnight: **451 reference verbs × 3 registers, and 752 book chapters × 3
registers.**

---

## Corruption vs gap in the eligible data

Two different defects, and they take different work.

**Gap.** The fold was generated from the reference as it stood on Jul 31. The
ref-grid covers 1,216 verbs; the reference now documents 1,679. So ~460 verbs
have no grid row, no buildup, no decompose, no revoice. Nothing here is *wrong* —
it is *absent*. This is fillable by the local models with no risk, because a
missing row cannot teach a falsehood.

**Corruption.** Rows that state a value the engine does not produce. Two kinds
turned up in the pilot:

1. *Stale-broken* — the block was verified on Jul 31 and no longer runs.
2. *Non-deterministic* — the block reads machine state, so its recorded value was
   never a fact about the language. Example: `(cadr (assoc :total-calls
   (stats/summary)))` is recorded as `895065`; it now returns `2587455` and will
   return something else next run. A row like this teaches a constant that is
   wrong forever. These must be **removed**, not repaired.

### The full re-verification, complete

All **125,920** code-bearing eligible rows, **21,320** distinct blocks, run
against the current engine. Raw data `scratch/verify-fold.json`, split lists
`scratch/fold-defects.json`.

| | rows |
|---|---:|
| block still runs clean | 124,576 |
| **stale-broken** | **1,344** (1.1%) |
| stated value matches | 59,079 |
| **stated value wrong** | **4,209** (6.7% of the 63,288 rows that state one) |
| states no value | 61,960 |

**5,553 bad rows, 4.4% of the code-bearing eligible set — and every one of them
is in the eight `corpus-reversal` shards.** `mk-ultra-reversals.jsonl` (the
10,000 held-out), `ref-grid`, `book-code` and the staging fills came back with
**zero** defects. Only **1,627 distinct code blocks** are behind all 5,553 rows,
because blocks repeat across shards — so the repair surface is small.

The split, by remedy:

| | rows | what happens |
|---|---:|---|
| deterministic wrong value | 3,768 | repair from the interpreter's actual output |
| deterministic stale-broken | 1,176 | repair or drop the row |
| **non-deterministic** | **609** | **delete — not repairable** |

Top wrong-value signatures: `#f` claimed where the engine says `#t` (678),
`}` claimed where the engine says `#<procedure>` (291) — that one is simply a
garbage row, the response literally reads ``It evaluates to `}`.`` — `#t` for `#f`
(33), and `Infinity` where the engine now says `+inf.0` (21), which is a
JavaScript number leaking into a recorded Scheme value.

A comparison note that matters when reading these numbers: a block with several
top-level expressions prints several values while the row states only the last
one. Comparing the claim against the whole output alone counts ~17% of
"mismatches" that are not mismatches. The check compares against the whole
output, its last line, **and** its last token.

`oracle_verified: true` is not evidence about the current engine. It records a
verdict from a machine that has since been patched. It is being re-earned.

---

## What this says about running two tracks

The two jobs do not touch the same files, so they can run at once:

- **The local model, in the background:** the voice backlog. 451 reference verbs
  and 752 book chapters, three registers each. It writes new rows into a fill
  lane. It never edits an existing row, so it cannot corrupt anything.
- **Me, in the foreground:** the 233 book/reference note repairs, then the
  stale-broken and non-deterministic rows the re-verification finds. That touches
  existing text and needs the value gate on every write.

The third stage — one uniform voice pass over everything so the whole corpus
reads as though one voice wrote it — has to come last, because it should run over
the repaired text, not over text that is about to change.
