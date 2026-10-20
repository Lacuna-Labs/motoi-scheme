# CPT ZERO — Corpus Inventory & Pre-Surgical Checklist

**UPDATE 2026-08-07 (post-decisions):** §10 at the bottom records Alfred's locked decisions and the six new emitters added to `emit_cpt_v5.py`.

Written 2026-08-07, before firing `emit_cpt_v5.py`. Everything below is **grepped from disk**, not remembered. Numbers cite `wc -l` or file counts as-of tonight.

Alfred's mountain model in one line: **dense core → normal curve at the edges → honest nulls at the horizon.** This grid names what's in the pile, what's on the summit, what's on the slope, and what's off the map.

---

## §1 The 14 emitters — what they read and from where

Every emitter in `scripts/cpt-prep/emit_cpt_v5.py`, cross-checked against actual disk state.

| Emitter | Reads from | Extractor | On disk today | Comes out as |
|---|---|---|---|---|
| **H** — reference | `Scheme/reference/*.slat` (top-level only) | `extractors/reference.py::iter_all_verbs()` | 89 chapter files | Per-verb records (S-shape catalog) |
| **HP** — reference programs | Same 89 chapters | `iter_all_verbs()` (programs field) | 19,326 runnable programs | Whole-program S10 records |
| **E-book** — scheme-books | `scheme-books/book-of-*/*.book.slatl` | `extractors/book.py::iter_all_chapters()` | 825 chapter files across 33 books | Chapter/paragraph shape-tagged |
| **W** — word-books | `word-books/book-of-*/*.book.slatl` | inline `_iter_wordbook_paragraphs()` | 50 chapter files (book-of-words) | S19 prose-register |
| **LE** — lang-engineering | `engineering/motoi-eng/LANG-ENGINEERING-1.0.ENG.slat` | inline regex on prose fields | **1 file, 2,432 lines** | S16 engineering-exposition |
| **L** — carts | `carts/**/*.sks` + `**/*.scm` | `extractors/cart.py::iter_all_carts()` | 41 `.sks` carts | S10 whole-program |
| **I** — identity | `scheme-books/book-of-self/`, `scheme-books/book-of-limits/` (paragraph extract) | `_extract_paragraphs_from_book()` | 2 books | Identity substrate |
| **J** — doctrine | `scheme-books/book-of-values/`, `scheme-books/book-of-reminded/` | same | 2 books | Doctrine substrate |
| **K** — weave | `Scheme/reference/*.slat` (verbs) rewoven | `iter_all_verbs()` | 89 chapters | Weave records |
| **M** — cart FIM | `carts/**/*.sks` (fill-in-middle) | reuses `iter_all_carts()` | 41 carts | Qwen FIM triples |
| **N** — graph tags | `graphs/graph-of-{feeling,intuition,sensation,thinking}.slat` | inline | 4 axis files | Graph tag records |
| **G-graph** — graph shapes | same 4 axis files | inline | 4 files | S20/S23 shapes |
| **F** — lib runtime | `lib/**/*.js` | inline `lib_root.rglob("*.js")` | 102 `.js` files | Lib metadata records |
| **HN** — honest nulls | Reference verbs with empty `:oppositions`/`:associations`/`:cross-refs` | inline | derived | Honest-null exemplars |

**One-line read:** the CPT baked from this is dominated by **reference (89 chapters)** + **scheme-books (825 chapters)** + **word-books (50 chapters)** + **graphs (4 axes)** + **lib runtime (102 .js)** + **carts (41)** + **one engineering doc**.

---

## §2 What's IN — dense core

| Source | Files | Emitter(s) | Confidence |
|---|---:|---|---|
| `Scheme/reference/*.slat` | 89 | H, HP, K, HN | verified — extractor uses `REF_DIR.glob("*.slat")` |
| `scheme-books/book-of-*/*.book.slatl` | 825 | E-book, I, J | verified — extractor uses `BOOKS_ROOT.glob("book-of-*/*.book.slatl")` |
| `word-books/book-of-words/*.book.slatl` | 50 | W | verified — inline glob |
| `graphs/graph-of-{4-axes}.slat` | 4 | N, G-graph | verified — narrow glob to 4 axis files (comment: "sakura dirs archived") |
| `lib/**/*.js` | 102 | F | verified — `rglob("*.js")` |
| `carts/*.sks` + `*.scm` | 41 | L, M | verified — extractor uses `CARTS_ROOT.rglob`, plus `.scm`; **note: only 41 `.sks` counted tonight**, plus any `.scm` |
| `engineering/motoi-eng/LANG-ENGINEERING-1.0.ENG.slat` | 1 of 3 | LE | verified — hardcoded in `LANG_ENG_DOCS` list |

---

## §3 What's NOT IN — the summit / gaps Alfred flagged

**These files exist in the tree and are NOT read by any emitter.** Each is a potential blind spot for the model.

| Source | Size | Why not | Should it be? |
|---|---:|---|---|
| `engineering/motoi-eng/CORTEX-1.0.ENG.slat` | **5,617 lines** | not in `LANG_ENG_DOCS` list | **Alfred's ask.** This is the memory/self-loop engineering doc. Directly hits his "understanding of self" bar. **Recommend: ADD.** |
| `engineering/motoi-eng/WEAVE-RECIPE.slat` | **14,244 lines** | not in `LANG_ENG_DOCS` list | **Alfred's ask.** This is how the graph×philosopher weave is composed — connects code understanding to conceptual understanding. **Recommend: ADD (selectively — filter personal/tough parts).** |
| `Scheme/REPL.slat` | ~ | no emitter reads it | REPL UX + verbs. Would help self-model. Small addition. |
| `Scheme/REPL-FEATURES.slat` | ~ | no emitter reads it | Same story. Cheap add. |
| `Scheme/REFERENCE-ALIASES.slat` | ~ | no emitter reads it | Alias resolution — helps model when users type old names. |
| `Scheme/reference/broken-examples/` | dir | reference extractor doesn't recurse | **These teach R5RS/R6RS/SRFI differences by contrast.** Per CLAUDE.md doctrine: "Bad examples are kept — they are teaching signal." **Currently unemitted.** |
| `Scheme/reference/error-cards/` | dir | same | Errors + repair patterns. Teaching value. |
| `spec/` (10 files: SRFI-1/13/27/125, R7RS-small, BOOK-LAYOUT, VIRTUAL-SHAPE-VOCABULARY, SLAT-CONVENTION, MOTOI-SCHEME-REFERENCE-SCHEMA, CPU-SPEC) | 10 files | no emitter reads them | The **actual standards Motoi conforms to.** Per CLAUDE.md: "Spec kept alongside." If model doesn't see the spec, it can't reason about "does X match the spec?" **Recommend: ADD at least R7RS-small + adopted SRFIs (1/13/27/125).** |
| `Spec/` (same 10 files, duplicate uppercase — likely case-insensitive FS artifact) | duplicate | — | ignore |
| `CLAUDE.md` | root | no emitter | doctrine, but IS meta ("agent guidance") — not obvious it belongs in CPT. Alfred's call. |
| `README.md`, `PUBLIC-API.md`, `STATE-2026-08-02.md` | root | no emitter | "intro" material Alfred mentioned. Public-facing narrative + API surface. **Recommend: ADD README + PUBLIC-API** (STATE-* is a working note, skip). |
| Held-out slice at `training-data/held-out/` | dir | correctly excluded per fold hygiene | KEEP OUT (evaluation set, must never leak) |
| `_archive/` under `Scheme/reference/` | archived | correctly excluded | KEEP OUT |
| `scratch/` | working area | correctly excluded | KEEP OUT (per repo doctrine) |
| `.bak-*` files | backup | correctly excluded from most globs but reference has 6 `.bak-*` at top level — verify they don't match `*.slat` | **VERIFY:** files like `29-geom.slat.bak-20260804T045943` are matched by `*.slat` glob? |

**Alfred's "understanding of LLM" gap:** no source in the current emit teaches the model **what it is as an LLM** — training process, generalization, temperature, context, prompt caching. If we want that, it needs a NEW book or an addition to `book-of-self`. **Not present today.**

---

## §4 What the model will learn about itself

Cross-checking against Alfred's "self ↔ code ↔ LLM" triangle.

| Axis | Sources covering it | Strength |
|---|---|---|
| **Understanding of code** | H, HP, K, F, L, M (reference + lib + carts) | STRONG — 89 chapters + 19k programs + 102 .js + 41 carts |
| **Understanding of self (Motoi as a system)** | I (book-of-self, book-of-limits), J (book-of-values, book-of-reminded), LE (LANG-ENGINEERING) | MEDIUM — 4 books + 1 eng doc. **CORTEX-1.0.ENG.slat missing** = memory-self loop unexplained. **WEAVE-RECIPE.slat missing** = compositional-self unexplained. |
| **Understanding of LLM (Motoi as a language model)** | ✗ | **NONE.** No source in the emit teaches the model what an LLM is, how it was trained, what CPT/SFT/RLHF mean. If the model ever needs to reason about "am I sure? what am I?", it has no CPT ground for those concepts. |
| **Connection between code ↔ self** | I + J + LE (partial) | THIN. WEAVE-RECIPE covers this — currently excluded. |
| **Connection between self ↔ LLM** | ✗ | NONE. |

**Consequence, in Alfred's mountain metaphor:** the pile has a real peak on `code` (huge reference + lib + carts). The `self` slope is medium and lumpy. The `LLM` face is a cliff — the mountain just ends. Not fatal (LLMs generalize) but load-bearing if we want Motoi to reason about its own uncertainty or nature. Sakura's future add-on story mitigates.

---

## §5 Bloom coverage — shape distribution safety

`SHAPE_BLOOM` in `emit_cpt_v5.py` gates create/read/comprehend/eval balance. Fix per defect #4 already lands S10/S12/S14/S23 → create bucket. Post-emit, run `pack_bpe.py --target 4096` and check the shape distribution report — flag any shape < 2% of tokens.

**Unverified:** post-emit shape histogram. Must be checked after `emit_cpt_v5.py` completes.

---

## §6 Pre-surgical checklist — before we open the patient

Neurosurgery checklist. Every item must be **explicitly** yes/no before Priya's commit + emit.

### Gates
- [x] Conformance suite green: **110/110** (verified 2026-08-07 20:38 EDT)
- [x] Books value-gate green: **0 hard mismatch of 1,439** (verified 2026-08-07 20:39 EDT)
- [x] Reference notes gate green: **0 mismatch of 1,026** (verified 2026-08-07 20:40 EDT)
- [x] Fold verify-fold green: **0 wrong-value, 0 stale-broken** (verified 2026-08-07 20:51 EDT after 30-row quarantine)
- [ ] Full repo suite (`node --test tests/`) green: **NOT YET RUN** against worktree
- [ ] `no-phone-home.py` PASS re-verified on the 477 uncommitted: **NOT YET RUN**

### Corpus completeness (Alfred's mountain)
- [x] Reference: all 89 chapter files in scope
- [x] Books: all 825 chapters in scope
- [x] Word-books: all 50 chapters in scope
- [x] Graphs: all 4 axes in scope
- [x] Lib: all 102 .js in scope
- [x] Carts: 41 in scope
- [x] Engineering doc LANG-ENGINEERING in scope
- [ ] **Engineering doc CORTEX-1.0.ENG in scope** — Alfred to decide
- [ ] **Engineering doc WEAVE-RECIPE in scope** — Alfred to decide
- [ ] **Spec files (R7RS-small, SRFI-1/13/27/125) in scope** — Alfred to decide
- [ ] **REPL.slat + REPL-FEATURES + REFERENCE-ALIASES in scope** — Alfred to decide
- [ ] **broken-examples/ and error-cards/ subdirs in scope** — Alfred to decide (per CLAUDE.md they carry teaching signal)
- [ ] **README.md + PUBLIC-API.md in scope** — Alfred to decide (Alfred's "intro" ask)

### Hygiene
- [x] 30 non-det rows quarantined to `_archive/quarantine-2026-08-07-nondet.jsonl` (not deleted)
- [x] Chat tokens `<|im_start|>` / `<|im_end|>` blocked at emit (defect #6)
- [x] Every emitted doc gets `[qwen-native:true]` (defect #7)
- [x] `:book-type` required, halt-on-missing (defect #8)
- [ ] Post-emit shape histogram checked (must be after emit)
- [ ] Post-emit real BPE token count from `pack_bpe.py --target 4096` (must be after pack)

### Doctrine
- [x] CPT ZERO does not name / merge with / diff against any prior emit
- [x] Held-out slice `training-data/held-out/` correctly excluded from emit path
- [x] `_archive/` excluded
- [x] `scratch/` excluded

### Commit safety
- [ ] `git status --porcelain` empty **after** any add-scope changes above land
- [ ] Priya has Alfred's explicit `go commit`
- [ ] No `--no-verify`, no `--force`

### Fire safety
- [ ] Training entry point located: `~/code/forge/` — grep for `train_cpt` / `mlx_lm.lora` (per Alfred's amendment). **NOT YET LOCATED.**
- [ ] Log path + PID captured in a place we can find them

---

## §7 The three questions Alfred needs to answer before we fire

1. **Add CORTEX + WEAVE-RECIPE + spec/ + REPL.slat + broken-examples + README/PUBLIC-API to the emit?** (best-effort compaction on the "self" and "LLM" faces of the mountain). Estimated cost: adding a few emitters + regenerating; roughly 1–2 h of edits + one clean emit re-run.
2. **Add a new short "how an LLM works" book to fill the LLM face?** — or accept it as a known thin edge that Sakura's RAG covers later.
3. **Fire with what's on disk now?** — if answer is yes and we accept path (a) scope (288 reference verbs stay in SFT lane), we can commit and fire immediately after the two remaining hygiene checks (test suite + no-phone-home).

---

## §8 Honest nulls — what we know we don't know

- **Post-emit shape histogram**: unrunnable until after `emit_cpt_v5.py` runs. Recommend gating "READY TO FIRE" on this too.
- **Real BPE token count**: same, needs `pack_bpe.py --target 4096`.
- **Whether the 41 cart count is complete**: extractor globs `.sks` AND `.scm`; only counted `.sks` above.
- **Training entry (`train_cpt` / `mlx_lm.lora`) location**: assumed under `~/code/forge/`; not verified.
- **The 288 undocumented reference verbs**: deliberately out (path a). Model will not know these until SFT.

---

## §9 Recommendation

Before firing, do these in order, small to large:

1. **10 min:** run `python3 scratch/no-phone-home.py` — verify pass.
2. **20 min:** run `node --test tests/` (in `motoi-scheme/`, not `curator-web/`) — full suite green.
3. **Decision (Alfred):** answer §7 questions 1 + 2 + 3. If yes to §7-1, small change to emit_cpt_v5.py to add:
   - `LANG_ENG_DOCS` extended with `CORTEX-1.0.ENG.slat` + `WEAVE-RECIPE.slat`
   - New emitter or extended H to include `Scheme/REPL.slat`, `REPL-FEATURES.slat`, `REFERENCE-ALIASES.slat`
   - New emitter for `spec/*.slatl` (R7RS-small + SRFI-1/13/27/125)
   - New emitter for `broken-examples/` and `error-cards/` subdirs
   - New emitter for `README.md` + `PUBLIC-API.md`
4. **5 min:** re-run the 4 gates, confirm still green.
5. **Priya:** stage + commit (needs Alfred's `go commit`).
6. **Priya:** `emit_cpt_v5.py` → check shape histogram → `pack_bpe.py --target 4096` → report real BPE count.
7. **Auto-fire:** locate training entry, launch, log PID + log path.

**"My kind, sir, we have done all we can" fires only after items 1–2 pass and Alfred answers §7.**

---

## §10 Locked decisions (2026-08-07 evening, post-Alfred)

Alfred's calls on the §7 questions, and what landed in code.

### Decisions
- **CORTEX-1.0.ENG.slat**: IN (filtered). "It's a way of storing data, not secret." Boring implementation minutiae filtered by same letter-density / path-heavy / min-token filters as LE.
- **WEAVE-RECIPE.slat**: OUT. "We're not telling them what our procedure is. So peep... all that stuff out." Procedure remains proprietary; do not teach.
- **REPL.slat + REPL-FEATURES.slat + REFERENCE-ALIASES.slat**: IN. "REPL, yeah, you can add that."
- **broken-examples/**: IN. "It should know what broken examples. Yes. We need the broken examples."
- **error-cards/**: IN (paired with broken-examples in the same walk).
- **spec/*.slatl (R7RS-small + SRFI-1/13/27/125 + BOOK-LAYOUT + VIRTUAL-SHAPE-VOCABULARY + SLAT-CONVENTION + MOTOI-SCHEME-REFERENCE-SCHEMA)**: IN. "The spec books we need them there."
- **README.md**: IN. "You should have the read me there."
- **PUBLIC-API.md**: IN. "And public API. Yeah. Sure."
- **A new 'how an LLM works' book**: DEFERRED. Not addressed tonight; can be a follow-up book if the self↔LLM edge shows problems in eval.

### Six new emitters added to `emit_cpt_v5.py` (per SRE-04 §1a doctrine)

| Emitter | Source | Shape | substrate | material | audience | mode | cpt-shape-name |
|---|---|---|---|---|---|---|---|
| **CE** | `engineering/motoi-eng/CORTEX-1.0.ENG.slat` | **S16** | cortex-eng | engineering | programmer | expository | engineering-exposition |
| **RP** | `Scheme/REPL.slat` + `REPL-FEATURES.slat` + `REFERENCE-ALIASES.slat` | **S01** | repl | reference | programmer | expository | encyclopedic-canonical |
| **SP** | `spec/*.slatl` (9 files) — per-verb records + fallback prose | **S01** | spec | spec | programmer | expository | encyclopedic-canonical |
| **BE** | `Scheme/reference/broken-examples/*.slatl` | **S07** | broken-example | reference | programmer | expository | concept-then-example |
| **EC** | `Scheme/reference/error-cards/*.slatl` + `.slat` | **S12** | error-card | reference | programmer | expository | guided-modification |
| **IN** | `README.md` + `PUBLIC-API.md` | **S19 / S01** | intro | prose / reference | any / programmer | narrative / expository | origin-narrative / encyclopedic-canonical |

### Tag doctrine followed (per SRE-04 §1a "PROVENANCE STAMP TEMPLATE")

Every new record carries the full stamp: `[qwen-native:true] [dialect:motoi] [substrate:X] [material:Y] [shape:SXX] [cpt-shape-name:Z] [speech-act:assertive|directive] [mode:expository|narrative] [paraphrase-idx:0] [audience:X] [provenance:PATH] [contamination:none] [record-id:N]`. Plus the Qwen header `<|repo_name|>motoi-scheme<|file_sep|>{rel_path}`.

### Sanity-check counts (dry-count via `sum(1 for _ in fn())`)

| Emitter | Records |
|---|---:|
| CE | **337** |
| RP | **22** |
| SP | **283** (per-verb + prose meta) |
| BE | **54** |
| EC | **36** |
| IN | **30** |
| **TOTAL NEW** | **762** |

These stack on top of the existing 14 emitters' output; the total CPT ZERO doc count will only be known after the full emit runs.

### Deliberate departures from SRE-04 (must be flagged to Alfred)

- **S00 paraphrase wrap**: SRE-04 §200 says "MANDATORY on every shape." The existing 14 emitters emit ONE canonical form per source (paraphrase-idx=0) and rely on downstream shape rotation to hit the M≈5 target. My six new emitters match that pattern — I did NOT author explicit paraphrase variants for each new record. **If SRE-04's S00 wrap is meant to be enforced at emit time**, all 20 emitters (old + new) need extension. **Recommend: separate pass, not blocking this fire**, since it applies uniformly to what's already shipped.

### Still open on the checklist

- [ ] `node --test tests/` full repo suite green (~20 min)
- [ ] `python3 scratch/no-phone-home.py` re-verify PASS on the 477 uncommitted (~1 min)
- [ ] Locate CPT training entry (`~/code/forge/` — `train_cpt` / `mlx_lm.lora`) — needed for the auto-fire per Alfred's amendment
- [ ] Priya commit (needs Alfred's explicit "go commit")
- [ ] `emit_cpt_v5.py` run — real doc count (with new 762+ added)
- [ ] `pack_bpe.py --target 4096` — real BPE token count

---

## §11 The verb-program count, finally correct (2026-08-07 late)

I was wrong four times before this. Written down here so the number can't drift again.

### Canonical counter — `scratch/count-reference-programs.py`

One deterministic grep across all 89 chapter files, all 9 code-bearing SLAT tags.

| Tag | Count | Where it lives in the schema |
|---|---:|---|
| `:code` | 10,553 | `(:examples ((:code "…")))` + row-3 rungs `(:code "…")` |
| `:program` | 2,049 | row-2 audit + row-4 proof primary program |
| `:eng-program` | 3,068 | row-2 + row-4 engineering-lens |
| `:math-program` | 3,106 | row-2 + row-4 mathematics-lens |
| `:cs-program` | 3,144 | row-2 + row-4 computer-science-lens |
| `:composition` | 984 | row-5 emergence primary |
| `:eng-composition` | 1,514 | row-5 engineering-lens |
| `:math-composition` | 1,533 | row-5 mathematics-lens |
| `:cs-composition` | 1,578 | row-5 computer-science-lens |
| **TOTAL** | **27,529** | across **1,793 verbs** |

- **Programs per verb: 15.35** — matches the 5-row × 3-column grid exactly
- **Grid-fill: 102.4%** (slight overfill; some verbs have >3 `:examples`)
- Alfred's memory was right the whole time. My four prior counts (5,407 / 7,190 / 12,266 / earlier "19,326 stale") all missed some subset of the 9 tags.

### Do the programs actually flow into CPT emit? YES.

Full dry-count of every emitter (`sum(1 for _ in fn())`):

| Emitter | Records | Notes |
|---|---:|---|
| H | 58,377 | Per-verb catalog × 5-variant × 6 shapes (S01/S02/S03/S04/S05/S06 + H-caveat/drawback/usecase) |
| HP | 26,183 | **Per-program framed cell — covers 95.1% of the 27,529 canonical** (rest skipped via `training_eligible #f` or `:runs "spec-only"`) |
| E-book | 11,050 | 825 chapters × shapes |
| W (word-books) | 716 | |
| LE | 335 | LANG-ENGINEERING prose |
| **CE** (Cortex) | 337 | new tonight |
| **RP** (REPL family) | 22 | new tonight |
| **SP** (spec files) | 283 | new tonight |
| **BE** (broken-examples) | 54 | new tonight |
| **EC** (error-cards) | 36 | new tonight |
| **IN** (intro README+API) | 30 | new tonight |
| L (carts) | 127 | |
| I (identity books) | 75 | |
| J (doctrine books) | 1,121 | |
| K (weave) | 7,355 | |
| M (cart FIM) | 171 | |
| N (graph tags) | 4,951 | |
| G-graph (graph shapes) | 68,252 | Dominant emitter (36% of total) |
| F (lib runtime) | 254 | |
| HN (honest nulls) | 9,518 | |
| **TOTAL** | **189,247** | |

**HP emits 26,183 of the 27,529 canonical programs = 95.1% coverage.** The 4.9% gap is deliberate filter (spec-only + non-eligible verbs), not a bug.

### The permanent fix, so this never happens again

1. **`scratch/count-reference-programs.py`** — the canonical counter. Deterministic grep across all 9 code tags. Runs in 1 second. If anyone quotes a different number, run this and settle it.
2. **Pre-emit gate to add** (small change to `emit_cpt_v5.py`): before running EMITTERS, call the counter; assert HP records ≥ 90% of `_total_programs`. Halt loudly if not. Never fire on a partial corpus again.

### Recomputed lane scopes with real numbers

| Lane | Method | Real scope | Cost | ETA |
|---|---|---|---|---|
| **Lane 1** (blocking) | Python templates for CE/RP/SP/BE/EC/IN prose variants + mechanical S06 reversals for SP | ~762 records × 5 variants + 1,400 SP reversals ≈ **~5,200 additions** | free | ~1 h |
| **Lane 2** (background) | Mistral prose paraphrase — extend all prose emitters (LE + book-prose + word-books + all 6 new) with 4 model-authored rewrites each | ~12,800 records × 4 = **~51,000 paraphrases** | free (local GPU) | ~4–8 h |
| **Lane 3** (defer) | Qwen-30-Coder code variants for all HP programs | **27,529 × 4 = ~110,000 variants** interpreter-graded | free (local GPU) but **~150–250 GPU-hours** | multi-day. **Not tonight.** |
