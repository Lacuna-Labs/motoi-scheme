# Pre-Fold / Post-Fold Assay — "prove the fold worked"

**Date:** 2026-07-29 · design · task #455
**Goal (Alfred, verbatim):** "come up with a clever way of testing the data post
fold and pre fold. So we know the fold worked."

The problem with the folds we've burned days on: we fired, waited hours, then
couldn't tell whether a flat eval meant (a) the fold data was wrong, (b) the model
can't learn it at 1.5B, or (c) the fold "worked" but our probe was measuring the
wrong thing. This design removes that ambiguity **before** we spend the compute.

Two doctrines drive the design:
- **Interpreter-is-grader.** Code answers are graded by `./bin/motoi run`, exit 0 /
  correct value — never token overlap. (memory: probe-facts-not-words)
- **Physics-of-LMs exposure floor.** A fact needs ~1000× exposure to store
  reliably (arXiv:2404.05405). The assay uses this as a *prediction to falsify*,
  not just a hope.

---

## The core trick: TREATED vs CANARY, per lane

For every lane, split its probe set two ways **at fold-build time**, with a pinned
deterministic seed recorded in the runlog:

- **TREATED** — the probe's underlying fact/verb/shape **is** in the fold.
- **CANARY** — a matched sibling that is **held OUT of the fold entirely.**

Then measure the same probes on the base (pre-SFT Mk3) and the SFT'd model:

```
                    pre-SFT (Mk3)      post-SFT
  TREATED probe        low               HIGH      ← the fold taught it
  CANARY  probe        low               low       ← held out, so no leak
```

The load-bearing signal is **Δ = post(TREATED) − post(CANARY)**, per lane:

- **Δ large & positive** → the fold genuinely taught this lane. Success.
- **Δ ≈ 0, both HIGH** → *contamination / leakage* — the "canary" fact reached the
  model some other way (already in CPT, or a sibling pair leaked it). Fix the split,
  don't trust the win.
- **Δ ≈ 0, both LOW** → the fold **flopped** for this lane (data wrong, or below the
  learning floor). This is the failure we kept missing — now it's named per-lane.
- **TREATED regresses vs pre-SFT** → interference / catastrophic forgetting from
  another lane (the research brief's forward/reverse + chained-tuning warning).

Because the split is **per lane**, a flat aggregate can't hide a dead lane: we see
exactly which of {reference, graph, books, word-books, debugger, carts, music,
animation, self-knowledge, refusal} took and which didn't.

---

## The probe sets (grounded, interpreter-graded where possible)

Small, hand-verified, ~30–60 items per lane (LIMA says small+clean beats large).
Each item is `{prompt, grader, treated|canary, lane, fact-id, exposure-count}`.

| Lane | TREATED probe | Grader |
|---|---|---|
| Reference | "write code using `<verb>`" for verbs IN the fold | run through `./bin/motoi`, exit 0 |
| Reference (reverse R5) | "which verb does this?" → name | string match on verb name |
| Graph | edge-traversal Q ("what is X's opposite / kin?") | fact match vs graph node |
| Books | chapter-concept abduction | keyword-family + human spot |
| Word-books draw | "draw a `<object>`" → Scheme | run → framebuffer non-empty, shape sane |
| Word-books draw (reverse) | "what does this draw?" → object | name match |
| Debugger | broken snippet → fix | fixed code runs clean |
| Carts | "help me make `<mechanic>`" → code | runs; mechanic present |
| Music / Animation | domain build prompt | runs; produces score/scene |
| Self-knowledge | "who built you / what are you written in?" | fact match ("Alfred Borden", "JavaScript") |
| Refusal / honest-null | benign-but-unknown Q | abstains WITHOUT over-refusing a benign known Q |

**CANARY for each** = a held-out sibling of the same shape (a different verb of the
same family held out of the fold; a different object never given a draw pair; a
different self-knowledge fact deliberately never authored). Same difficulty, same
format — only the fold membership differs.

### Over-refusal counter-probe (from the research brief)
Refusal is the lane most likely to go brittle/over-refusing. So the refusal probe
carries a **twin benign-KNOWN set**: questions the model *should* answer. Score =
(abstains on true-unknowns) AND (answers on benign-knowns). A model that refuses
both is failing, not passing.

---

## Pre-fold gate (runs BEFORE we spend a minute of training compute)

This is the cheap half — it catches the "the data was wrong" failure before the fold.

1. **Corpus contains what we think.** Re-run the grounded census (assess.py + the
   grep bases). Every lane's base count reproduces on disk. (Already: AUDIT-REPORT
   PASS.)
2. **Every runnable pair actually runs.** Sample K pairs per lane, extract the
   answer code, run `./bin/motoi`. A pair whose gold answer doesn't run is a poisoned
   pair — must not enter the fold. (Reference: the full-reference-verify harness.)
3. **Tag contract complete.** Every emitted pair carries
   `:bloom :shape :philosopher :register` + the source tags; hard-fail any missing.
4. **Canary split recorded.** The held-out fact-ids are written to
   `holdout-canaries.json` with the seed, so post-fold can prove they were absent.
5. **Baseline eval.** Run Mk3 (pre-SFT) on ALL probes. Expectation: TREATED and
   CANARY both **low** (there must be headroom, or the fold can't demonstrate a
   lift). If a lane is already HIGH pre-SFT, CPT already taught it — note it, the
   fold's job there is format not knowledge.

Exit gate: bases reproduce ✓, sampled pairs run ✓, tags complete ✓, canaries
recorded ✓, baseline has headroom ✓. Only then fire the fold.

---

## Post-fold assay (after training)

1. Re-run every probe on the SFT'd model. Interpreter-graded lanes are objective.
2. Compute per-lane Δ = post(TREATED) − post(CANARY). Table it.
3. **Contamination check:** any CANARY that went HIGH → investigate the split; a
   leak invalidates that lane's win.
4. **Exposure-floor falsification:** bucket TREATED facts by fold exposure count
   (from the sampler log). Predict: facts ≥~1000× exposure learn; facts <~20×
   don't. If the buckets don't sort that way, the sampler mix (§2 upsampling) is
   mis-set — this is how we *tune the mix from evidence*, not by hand.
5. **Retention probe:** re-run the Mk3 CPT knowledge probe + a general-instruction
   probe. No pretrained capability may regress (catastrophic-forgetting guard).
6. **Report:** one row per lane {pre, post-treated, post-canary, Δ, verdict}, plus
   retention + over-refusal. "The fold worked" = every in-scope lane shows large
   positive Δ, no CANARY leak, no retention regression.

---

## Why this is better than what burned us

- It **localizes** failure to a lane (dead-lane no longer hides in the average).
- It **distinguishes** "data wrong" (pre-fold gate) from "model can't learn"
  (TREATED low post) from "we measured wrong" (interpreter grader, not tokens).
- It **proves causation**: CANARY hold-out shows the lift came from the fold, not
  from CPT or leakage.
- It **turns the exposure floor into a tuning instrument** for the sampler mix.
- It's **cheap on the pre side** — most failures are caught before the compute.

## Build checklist (next, not fired yet)
- [ ] `probes/<lane>.jsonl` — 30–60 items/lane, treated+canary tagged, graders wired.
- [ ] `holdout-canaries.json` — held-out fact-ids + seed; fold builder MUST exclude.
- [ ] `assay_pre.py` — census + sample-run + tag-check + baseline eval → gate.
- [ ] `assay_post.py` — per-lane Δ + contamination + exposure-bucket + retention.
- [ ] Wire into the fold builder so the canary hold-out is enforced at emit time.

---

# STANDING HYGIENE GATES — pre-fold AND post-fold (task #485, wired 2026-07-30)

The TREATED/CANARY assay above proves the fold *taught* something. These three
gates prove the fold is *clean* before it teaches — and they run BOTH before the
explosion (on the authored lanes) and after (on the exploded fold), because both
defects reappear at 12×. Alfred, 2026-07-30: "be sure to put these folks pre fold
and post fold template lock checks and the like and **why it's done. Both**."

All three are wired into `fold_report.py` (the go/no-go dashboard). Two are
**INFO** (they self-heal, add-only), one is a **HARD** blocker.

## Why these are inevitable at ~12× explosion — not optional cleanup

The fold is the EXPLOSION of 10 authored lanes, each ~12×. At that volume three
things are guaranteed by construction, not by authoring sloppiness:

1. **Exact duplicates across lanes.** The same authored `(prompt, completion)` is
   minted by more than one lane (a "what's pi" card lands in the reference lane AND
   the word-book lane AND a book chapter). Nobody wrote it twice on purpose; the
   lane overlap does it. Left alone, identical rows inflate self-BLEU to 1.000
   (fake phrase-lock) and make a naive train/valid split look like it leaks the
   same prompt on both sides. **This is redundancy, not teaching signal.**

2. **Template-lock (completion-lock).** The 12× surface-scatter that prevents
   phrase-lock ALSO produces families where one canned answer is stapled onto many
   prompt variants ("prep for Ecology" / "prep for Genetics" → the identical body).
   Alfred: parallel templates with only a variable swapped are "nonsense." At
   explosion scale this is inevitable in every lane that fans a template over a
   list.

Because both are *products of the explosion itself*, de-locking is a **standing
step, not a one-off cleanup** — it runs every fold, forever.

## Gate 3b — anchor-aware DEDUP (INFO, add-only exception to only-add)

- **What:** `fold_dedup.dedup_records()` keeps the FIRST occurrence of each exact
  `(prompt.strip, completion.strip)`, drops later exact copies. Dropped copies are
  archived to a dated attic jsonl — **NO silent loss**; lane files are never edited.
- **Why it's the sanctioned exception to only-add:** Alfred, 2026-07-30: "Both" —
  dedup + diversify, "we have to do this anyway... it's inevitable for the amount
  we get." Dedup is a FOLD-ASSEMBLY filter, not a corpus edit. It removes only
  provable exact copies whose repetition carries zero signal. See
  [[feedback_only_add_never_prune_the_fold]] — the fold still only GROWS in unique
  content; we only decline to count byte-identical reprints N times.
- **ANCHORS ARE NEVER COLLAPSED** (repetition IS the lesson): refusal/honest-null
  anchors (`_refusal_src`), reversal/contrastive families (`family`+`provenance`,
  `type`~"revers", `template` R1..R5, `reverse_of`/`direction`, inline reverse
  tags), and silent-if-trouble (#105, `_meta.bucket`~"silent"). Alfred: "we also
  have reversals... you have to be careful there." A reversal's two directions are
  INTENTIONALLY parallel and must survive whole.

## Gate 2 — TEMPLATE-LOCK / diversify (INFO, add-only)

- **What:** `fold_diversify.py` finds families (same `skeleton(prompt)`) whose
  self-BLEU > 0.35 AFTER dedup, drops anchors/reversals from the rewrite set, and
  emits a work-order. A model lane (Haiku/Forge) REGENERATES each locked completion
  conditioned on its own prompt slot (Verbalized-Sampling), and the fresh variants
  land in an **add-only** lane (`delock-variants-<DATE>.jsonl`). The locked family
  is diluted; self-BLEU falls; originals are never edited or dropped.
- **Why regeneration, not surface-scatter:** reordering clauses / swapping
  connectives produces "the same nonsense in a trench coat" (Alfred). The honest
  fix makes the answer actually fit the question, which needs a model. If the model
  can't improve a row it's left alone — no fabrication, no deletion.
- **Runs on the POST-DEDUP fold:** exact copies are dedup's job; diversify only
  clusters the survivors, so we don't waste model calls rewriting rows dedup drops
  anyway.
- **2026-07-30 result:** Haiku rewrote 232 rows → 462 add-only variants (210
  declined, no fabrication). Template-lock fell 52 fams/13 severe/557 rows →
  47 fams/10 severe/453 rows. Reversal/heldout-safe (work-order had 0 of each).

## Gate 3c — HELD-OUT leak (HARD blocker, eval poisoning)

- **What:** counts records whose `held_out` / `_held_out` / `heldout` is truthy
  across the discovered training lanes. **Must be 0.** Training on the exam poisons
  the eval — the fold's numbers become meaningless.
- **Two layers of defense** (both needed — a filename filter can't see inside a
  mixed lane):
  1. **Lane-level** (`fold_common._keep`): a `heldout*` / `held-out` file, or a
     file under a `held-out/` / `held_out` dir, is no longer discovered as a
     training lane. This caught `heldout-2026-07-16.jsonl` (940 rows) that was
     silently training. (`eval*` was already excluded; `heldout` was the gap.)
  2. **Per-record** (this gate): rows with `held_out:true` embedded in OTHER,
     legitimate lanes are surfaced as a HARD no-go so they're excluded before the
     fold. As of 2026-07-30 there are ~1094 such rows still to exclude.
  3. **Emit-time backstop** (`fold_diversify.emit_variants`): a variant whose id
     is heldout-derived is dropped at the moment it would become a training row —
     the last chance to stop an eval prompt entering the fold through the back door.

## Intermediate files must NOT live in a fold root

The diversify work-order (442 identical instruction strings) and the model
responses are WORKING files. If they sit in a fold root (`scratch/sft-plans/` or
`training-data/`) the phrase-lock detector scans them as a training lane and reads
a self-BLEU 1.000 family — a pure measurement artifact. Keep intermediates at
`scratch/` root (unscanned); only the add-only VARIANTS lane belongs in the fold
root, because it IS training data.

## Where each gate lives
- `fold_dedup.py` — dedup (preview default; `--apply` writes the attic archive).
- `fold_diversify.py` — template-lock work-order (default) + `--emit-variants`.
- `fold_common.find_lane_files._keep` — lane-level held-out/eval exclusion.
- `fold_report.py` — all three surfaced on the standing go/no-go dashboard.
