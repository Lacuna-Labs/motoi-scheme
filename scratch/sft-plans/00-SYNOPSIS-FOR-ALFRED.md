# Motoi SFT — NOW-context assay + research synopsis (2026-07-29)

You asked: read the weave doctrine first, research how to SFT the 1.5B across all
lanes, then meticulously assay everything so we have a clean NOW picture before we
fire another fold. Here it is. **No fold fired. No 2.3 GB moved. Nothing deleted.**

---

## 1. Doctrine — what we already concluded (read, reconciled)

**WEAVE-RECIPE.slat (Weave 0.75, ACTIVE).** The pipeline is settled:

- **Phase 0 CPT** = knowledge injection → **done** (Mk3, val 0.338).
- **Phase 1 SFT** = *shape retrieval* → this is the fold we're building.
- **Phase 2 Spectral → Phase 3 LASER → Phase 4 KTO** = training-free/light finishing
  moves that **fork from the SFT adapter**, each **reverted if it doesn't net-improve**.

Load-bearing rule, verbatim from the doctrine: **"SFT CANNOT inject knowledge that
CPT hasn't already presented in multiple shapes."** So the fold's job is to teach
the model to *surface and format* what Mk3 CPT already put in — not to cram new
facts. If a lane flops, the first suspect is CPT shape-coverage, not more pairs.

**On LASER specifically (you said "call Weave with LASER"):** the doctrine already
treats LASER as an *optional, reverted-if-no-gain* Phase 3. The research (below)
sharpens this — for a **generalist** like Motoi, LASER is more likely a wash than a
win, and **model-souping is the better-evidenced lever.** Recommendation: keep LASER
as a cheap end-of-line sweep (gated on "regresses no lane"), not a planned step.

---

## 2. Research — Lacuna-Eng brief (citation-grounded, done)

The one-plan answer, matched to our base model's own recipe:

- **Epochs:** **2** (Qwen2.5 fine-tunes >1M examples for exactly 2 epochs). Epoch 3
  only if per-lane held-out evals still improve with no forgetting. Never >3.
- **Mixing:** upsample the **thin-but-critical** lanes (self-knowledge/identity,
  honest-refusal, all three reverse-directions, music, animation) **at the sampler,
  not on disk** — which *satisfies ONLY-ADD*: you raise their exposure without
  trimming the thick reference lane. Target effective mix ≈ reference 40–45%, graph
  12%, books 10%, carts 10%, word-books 10%, debugger 6%, music+anim 6%,
  self-knowledge+refusal 4–5% (upsampled hard). Tune by re-weighting laggards
  Tülu-style.
- **Exposure floor:** a fact needs ~**1000× exposure** to store reliably
  (Physics-of-LMs 3.3). Rare identity facts ("built by Alfred Borden", "written in
  JavaScript") and honest-null boundaries **must be deliberately upsampled** — direct
  backing for over-including self-knowledge.
- **One pass vs multi-pass:** **single primarily-blended pass** with a short
  foundational warmup (reference grid + word-grounding + read/explain), **not** a
  hard capability-by-capability pipeline (staging causes catastrophic forgetting —
  reference degrades while you train carts). Keep **forward+reverse co-present but
  instruction-disambiguated** (naive mixing interferes).
- **1.5B mechanics:** LR **7e-6→7e-7 cosine, warmup ~5%, weight decay 0.1, grad-clip
  1.0**, effective batch ~64 via grad-accum. **Full-FT beats LoRA** for deep
  absorption if unified memory allows (LoRA's "intruder dimensions" cost task
  performance; it only wins on *forgetting less*, which matters less here since we
  *want* deep Scheme absorption). If memory forces LoRA: rank 64–128 on all linears.
- **Packing:** BPE-correct sample packing + **block-diagonal attention mask**
  (or packed examples contaminate each other). Re-verify our known MLX 4× BPE
  undercount + `train.jsonl` filename gotcha before firing.
- **Refusal:** teach honest-null with **high prompt diversity** grounded in the
  5,871 real Wittgenstein-flagged boundaries; **eval over-refusal explicitly** on
  benign-known questions (pure-SFT refusal goes brittle/over-refusing).
- **Better than LASER:** train **2–3 seed/LR-varied full-FT runs and model-soup /
  TIES-merge** them — the principled way to reconcile "do all the things."

Full brief + all citations saved with the research output.

---

## 3. Pre-fold / post-fold assay — the "prove the fold worked" test

Design in `00-PREPOST-FOLD-ASSAY.md`. The trick that fixes what burned us:

**TREATED vs CANARY, per lane.** For each lane, split its probe set at fold-build
time (pinned seed): TREATED facts **are** in the fold; matched CANARY siblings are
**held out entirely**. Then the signal is **Δ = post(TREATED) − post(CANARY)**:

- Δ large & positive → the fold genuinely taught that lane.
- both HIGH → leakage (bad split), don't trust the win.
- both LOW → the lane **flopped** (this is the dead-lane the average kept hiding).
- TREATED regresses → interference/forgetting from another lane.

Code lanes graded by **`./bin/motoi run`** (objective), never token overlap. A cheap
**pre-fold gate** (bases reproduce + sampled pairs actually run + tags complete +
baseline has headroom) catches "the data was wrong" *before* we spend the compute.
The exposure-count buckets become a **tuning instrument** for the sampler mix.

---

## 4. Assay of what we have NOW (grounded, re-run on disk today)

- **Reference runs:** drawing chapters 73–80 verified **1008 blocks / 0 fail**;
  documented verb names **1179 → 1248** (the 69 new drawing verbs). A full
  ~19k-block re-verify of the entire reference is running in the background as the
  final pre-fold gate (confirmation — prior passes #367/#344 verified the
  pre-drawing chapters; the retag pass did not touch runnable code).
- **Independent audit (AUDIT-REPORT.md): PASS-WITH-FINDINGS.** assess.py runs →
  **~3.04M** headline; the two ≥1M lanes are Reference 1.32M + Graphs 1.14M;
  ONLY-ADD honored (every delta vs the 2026-07-28 ~900K model is an increase).
- **assess.py constants already reconciled to disk** (GRAPH_NODES 25222, REF_VERBS
  1173, BOOK_CODE 9258) — the audit's top-2 hygiene findings are already fixed.
- **Tags:** source tags are healthy (`:dialect` 33,942 · `:provenance` 26,375 ·
  `:training-eligible` 26,367 clean `#t`). The only issues are **encoding
  inconsistency** — `:confidentiality` written as `:public`/`"public"`/`public`
  (~875 records) and 14 malformed `:training-eligible` — which belong in the **fold
  reader's normalization pass**, not 875 source edits. The **3 non-public records**
  (`internal`/`restricted`/`personal-data`, in REFERENCE-ALIASES.slat +
  16-safe-introspection) are **correctly excluded** by the training-eligible gate.
  `:section` (72) and `:bloom` (0) are **fold-time overlay tags the generator adds
  per pair** — not source gaps.

---

## 5. The real remaining work + decisions I need from you

**A. 88 wired-but-undocumented verbs — "coverage for verbs we didn't think about."**
Confirmed still present today (all 14 spot-checks documented=0). These are wired at
runtime but have no reference record: **alg 28, topo 23** (pure math, clearly
in-scope) + artifact 10, cortex 5, entity 4, matrix 4, animation 3, world 3, easing
2, text 2, ai 1, sprite 1, floor 1, transport 1. Each needs a full 18-program grid
authored **with judgment** (not parallel templates → phrase-lock) + a per-verb drift
reconcile (is it already documented under another name?). This is the main remaining
reference authoring — real hours. **My plan: start with the math-core alg+topo (51),
which are unambiguous, then the rest.** Want me to proceed on all 88, or math-core
first?

**B. Two placement rulings (RULE 1 — your call):**
- **5 R7RS-core names** wired but undocumented: `/` `call/cc` `floor/` `truncate/`
  `hash-table-update!/default`. Likely home 01-core or 00e. Document them?
- **89 no-chapter verbs** (motoi/* IDE surface 32, composer-tooling 26, book-reader
  13, http 4, color 3, fb 3, voice/song 3…). New chapter? host-only/exclude?
  I will NOT author these without a ruling.

**C. Corpus-dir consolidation — needs your naming call.** The plan says the single
fold home is `motoi-sft-v3/` but disk has `v7/v8`. Recent SFT corpora:
`motoi-mk3-sft-isb` (1.6M, Jul 22, **latest**), `motoi-mk2-sft-isb` (1.05M, Jul 21).
Stale small folds (Jul 17–19): `motoi`, `motoi-v7`, `motoi-v8`, `motoi-mk1`,
`motoi-mk2-samples` + two `…enriched…jsonl`. **Proposed (reversible, no delete):**
new fold builds into one dir; archive the six stale ones under
`~/.forge/corpus/_archive-2026-07-29/`. Confirm the target dir name + which to
archive and I'll move them.

**D. Two known data defects (flagged, ~zero yield lost):** the intuition-graph
concatenated node (salvage recovers ~6,248 nodes; needs a regen) and the
book-of-values `00-outline` escaped-quote artifact (real chapters are separate
files). Regen or leave?

**E. 73 `.retag-new` drafts** sit beside the canonical chapters (from the #426 retag
pass). All census excludes them (canonical = plain `.slat`). Promote them (improves
tag consistency) or leave as drafts?

---

## 6. Bottom line

The fold inputs are **grounded and in good shape** — ~3.04M ONLY-ADD, audit-passed,
constants reconciled, tags healthy modulo reader-side normalization. The one
substantive authoring gap is the **88 verbs**; everything else is your decisions
(A–E) or generator/reader contract. I have not fired anything and will not until the
full-verify is green and you've ruled on A–C. **Next action on your word:** author
the 88 (math-core first), wire the reader normalization + gate, build the probe/
canary harness, then fire the single-pass 2-epoch full-FT fold.
