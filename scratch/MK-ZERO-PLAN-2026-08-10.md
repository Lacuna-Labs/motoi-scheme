# MK ZERO — SFT readiness plan (2026-08-10)

Companion to `CPT-ZERO-READINESS-PLAN-2026-08-07.md`. Same discipline: named gates,
STOP boundaries, nothing fires without Alfred.

---

## §1 What the SFT design already says (read, not re-derived)

Sources: `scratch/sft-plans/00-BIG-FOLD-PLAN.md`, `00-SYNOPSIS-FOR-ALFRED.md`,
`00-PREPOST-FOLD-ASSAY.md`, `forge/scratch/sft-plans/SFT-MASTER-CHECKLIST.md`,
walk docs 01–09.

**The shape of it.** Ten lanes, each with a walk doc, exploded from authored seeds:

| # | Lane | Base on disk | Grounded yield |
|---|------|--------------|---------------:|
| 1 | Reference manual (R1–R10) | 19,326 runnable seeds | ~1.32M |
| 3 | Graphs (4 Jung axes) | 25,222 nodes | ~1.14M |
| 4a/4b | Scheme books — prose + fenced code | 1,097 units / 9,156 blocks | ~0.43M |
| 5 | Word books (world substrate) | 50 ch → per-span | ~0.10M+ |
| 2 | Broken code (debugger families A–O) | 3,024 artifacts | ~0.035M |
| 8/9 | Music + animation composer | 149 units | ~0.024M |
| 6 | Engineering / self-knowledge | 19 files + 32 introspection | ~0.002M |
| 7 | Native carts | 25 carts | ~0.002M |
| | **headline** | | **~3.04M** |

**The doctrine on it.** Only ADD, never prune — balance by adding to the thin side.
Interpreter grades every checkable row; the model never grades. No fabrication.
And the load-bearing one, verbatim from the weave doctrine:

> **"SFT CANNOT inject knowledge that CPT hasn't already presented in multiple shapes."**

SFT's job is to make the model *surface and format* what CPT put in. That sentence
is now measured rather than assumed — see §2.

**The recipe already researched** (matched to the base model's own published recipe):
2 epochs · single primarily-blended pass with a short foundational warmup (staged
capability-by-capability training causes forgetting) · thin-but-critical lanes
upsampled **at the sampler, not on disk** (satisfies only-add) · LR 7e-6→7e-7 cosine,
warmup ~5%, weight decay 0.1, grad-clip 1.0, effective batch ~64 · **full-FT beats
LoRA** for deep absorption · BPE-correct packing with a **block-diagonal attention
mask** or packed examples contaminate each other · identity facts need ~1000×
exposure to store, so they are deliberately upsampled · forward and reverse
directions co-present but instruction-disambiguated.

**The proof-it-worked design.** TREATED vs CANARY per lane: split each lane's probe
set at fold-build time on a pinned seed, TREATED facts are in the fold, matched
CANARY siblings are held out entirely, and the signal is Δ = post(TREATED) −
post(CANARY). Both high = leakage. Both low = the lane flopped. That is the
instrument that stops a lane-average from hiding a dead lane.

---

## §2 What the CPT eval changes about this plan

Six things, all measured today. Detail in `~/code/forge/eval/STATS-motoi-cpt-zero.md`.

**1 · The stop-behaviour defect is the top-priority SFT job.** The model learned the
corpus document separator as its end-of-sequence. Having answered, it opens a NEW
corpus document — `<|repo_name|>…<|file_sep|>…` then that document's header line —
which is where the vendor tag lives. Measured: base 0.0% both regimes, CPT 47.3%
few-shot, **99.3% zero-shot**. This is the only *defect* the eval found in the
weights, and it is a format defect, which is exactly what SFT fixes. Requirement:
**every MK ZERO target ends at an explicit end-of-answer, and no target contains a
document separator or a tag header.** If the SFT emit carries the same headers the
CPT emit did, it will *reinforce* the bug.

**2 · The tag vocabulary must be scrubbed, not just the vendor word.** The word rides
in the header; removing the word alone leaves the behaviour.

**3 · Prompt-shape transfer is the whole job, and we can now put a number on it.**
Asked in the corpus's own document shape the model answers **100%** of vocabulary
questions with **89%** of named verbs really bound in the interpreter. Asked the same
thing in plain English it answers only **55%**. The knowledge is in there; the plain
door is half shut. So the doctrine line above is confirmed rather than hoped —
and the target is concrete: **plain-regime answer coverage 55% → ~100% with grounding
held at or above 84%.** That is a pre-registered success criterion for MK ZERO.

**4 · Forgetting is real and it is not trivia.** Retention pass^4 91.7% → 50%. What
broke is arithmetic *in English prose* (the model reads 60 miles in 90 minutes as
120 mph; the base says 40); math *in Motoi* is intact. Trivia we can lose. A model
that must explain things to an eleven-year-old in English cannot lose English
arithmetic. This is the one real argument for putting non-Motoi data in the mix —
a small general-instruction replay slice, sized as a dial, not a dump.

**5 · Full-FT vs LoRA is a live decision, and the record was wrong.** Every prior SFT
on disk was `fine_tune_type: "lora"`, rank 128, all layers, 9.57% trainable. Only
CPT ZERO was full-parameter. The research and our own absorption goal both point
full; the cost is memory and hours.

**6 · The eval harness is now the standing instrument.** Four arms, three prompt
regimes, plus the vocabulary-grounding axis with the interpreter's 1,867-symbol
binding table as oracle. Two prerequisites carried over: `test.jsonl` is byte-identical
to `valid.jsonl` (there is **no independent test set** — build a third split before
firing), and mlx_lm validates at iter 1 before the first optimizer update, which is a
free untrained baseline on our held-out set (capture it).

---

## §3 What is stale, and why we re-emit

`forge/scratch/sft-plans/fold/` holds **189,940 rows** (+15,535 in `fold-staging/`),
last written 2026-07-31. Those rows were derived against a language whose engine and
reference disagreed. Since then: the conformance close (commit `54e9d96`), the
CPT ZERO prep commit (`4893c41`), the `entity/glide!` lerp-rate correction (581 book
blocks producing garbage silently), and the Marionette world-handle strip (945 blocks).

Per the CPT ZERO / MK ZERO reset, that fold is a **prior emit** — archived, never
merged, never diffed against. The **authored sources** (books, reference, word books,
graphs, carts) are not emits and are not thrown out; they are the fixed thing zero is
emitted from. **The emitters survive and are the point** — re-emission is compute,
not authorship, so this costs hours and $0, not the July authoring effort.

---

## §4 The plan

Every step names its gate. STOP means do not proceed without Alfred.

**Step 0 — re-measure (free, no model).** Run the four gates against the current
worktree: `node scratch/conformance-probe.mjs`, `scratch/audit-books-values.py`,
`scratch/verify-reference-notes.py`, `scratch/verify-fold.py`.
*Gate:* fresh numbers, mtimes today. *PING* with the delta vs the CPT ZERO run.

**Step 1 — three decisions only Alfred makes.** STOP until answered. See §5.

**Step 2 — write the MK ZERO emit contract.** A short spec, then enforced by a
pre-emit assertion so it cannot drift: explicit end-of-answer on every target · no
document separator, no tag header, no vendor token in any target · prompts phrased as
a person would ask them, not as a corpus header · the register axis carried through
(kid / layperson / phd re-voice lanes already exist on disk) · identity facts
upsampled at the sampler. *Gate:* the assertion rejects a deliberately malformed row.

**Step 3 — re-emit the deterministic lanes.** Reference grid, corpus-reversal,
graph traversal + inverse, book code. These are mechanical emitters, $0, and they are
where the volume is. *Gate:* `program_counter.py` MISSING ≈ 0; `module_census.py`
0 uncovered verbs.

**Step 4 — the three scripts that do not exist.** Flagged in the July checklist and
still unwritten: (a) promote staging → fold (strip `tags.model`, keep provenance,
refuse orphaned rows, idempotent), (b) anchor-aware dedup, (c) template-lock
diversify. *Gate:* each is idempotent on a second run.

**Step 5 — hygiene + the splits.** dedup → diversify → held-out, in that order;
dedup before diversify or self-BLEU reads 1.000 off the intermediates. Build the
TREATED/CANARY probe split at fold-build time on a pinned seed, and build a **third**
data split so "test loss" means something this time. *Gate:* held-out leak = 0. HARD
blocker.

**Step 6 — pack and fire.** `pack_bpe.py --target 4096` for the real token count
(the emit-time estimate undercounts ~4×) · `iters = packs × epochs`, do **not** divide
by grad-accumulation · `grad_checkpoint: true` · read `Trained Tokens` at iter 10 and
confirm it equals exactly one pack per iteration · stage the packs under the fixed
names `train.jsonl` / `valid.jsonl` because mlx_lm loads only those. *PING* with the
real BPE count before the fire.

**Step 7 — eval MK ZERO on the standing harness.** Same four arms, all three regimes,
plus the vocabulary axis. Pre-registered targets: plain-regime coverage 55% → ~100%
at grounding ≥ 84% · leak rate 99.3% → ~0% · retention pass^4 recovered above 50% ·
domain pass^4 held at or above 80%. Report into the ledger.

---

## §5 Decisions needed from Alfred (STOP)

**A. What does MK ZERO train on?** The fused CPT ZERO weights (inherits both the 80%
domain gain and the forgetting), or back on the untouched base with the CPT corpus
mixed into the SFT data (keeps English, risks a weaker domain floor). *My
recommendation: on the fused CPT.* The eval says the knowledge landed and the door
is what's stuck; throwing away 42.8 hours to fix a door is the expensive way.

**B. Full-parameter or LoRA?** *Recommendation: full.* Every prior SFT was LoRA
rank-128 and full is what the research and our own absorption goal want. It is slower
and it is the honest way to do this one.

**C. General-domain replay — in or out, and how much?** *Recommendation: in, small —
5–10% of the mix, weighted toward grade-school arithmetic and plain-English
explanation, not trivia.* Not because the queen of England matters, but because
English arithmetic is load-bearing for a model that teaches children, and it is the
one thing we measured breaking.

---

## §6 Reconciliation with the Weave doctrine (read 2026-08-10)

Sources: `engineering/motoi-eng/WEAVE-RECIPE.slat` (doctrine, ACTIVE, Weave 0.75) and
`scratch/sre-04-cpt-sft-authoring-per-data-type.fixed.slat` (the operator runbook —
the HOW to the recipe's WHY).

**Where MK ZERO sits.** Weave is not the SFT; it is the **post-SFT finishing
procedure**. The full arc is Phase 0 CPT (knowledge injection) → Phase 1 SFT (shape
retrieval) → Phase 2 Spectral Surgery → Phase 3 LASER → Phase 4 KTO. Phases 2–4 each
**fork from an immutable SFT adapter** and are **reverted if they do not net-improve**.
MK ZERO is Phase 1. Nothing in §4 changes; §7 gains a successor.

**Why the order is training-free-first.** Weave 0.75 replaced its predecessor because
a LIMA-style polish pass *regressed* circular-trap 20→5% and lang-resistance 93→60%.
The explanation on file (arXiv:2410.10862): at 1.5B, safety lives in a sparse
controller that a small gradient overwrites. Hence: try zero-data moves first,
escalate to gradient only if ship-blockers remain. Alfred, verbatim: *"we test after
the spectral surgery"* — test after every move.

**The load-bearing rule, now measured rather than assumed.** The recipe says: *SFT
cannot inject knowledge that CPT hasn't already presented in multiple shapes; if
confabulation persists after SFT, that is evidence the CPT catalog is missing shape
diversity, not that SFT needs more pairs.* Today's vocabulary axis is the test that
tells those two apart, and it came back on the good side — 89% of named verbs really
bound. So if MK ZERO underdelivers, the recipe's own diagnostic points at the SFT
templates, not back at a 42.8-hour re-run.

**Authoring invariants that carry into the emit contract (§4 step 2).** These are
already doctrine and must be enforced by the pre-emit assertion, not by care:

- Every verb name in an assistant reply must exist in the reference index; off-index
  names **block the pair**. (This is the authoring-side twin of the vocabulary axis —
  the corpus enforces grounding, the eval measures it.)
- Reversal pairs are mandatory and **coupled**: if either side fails validation, both
  are blocked. Forward-only training reproduces the reversal curse.
- Paraphrases are **deterministic template rewordings**, never model rewrites, M ≈ 5
  per shape, minimum 3 shapes per fact.
- Short-reply carve-out: reversal and recall answers are one word by design and must
  be wrapped in a canonical framing sentence. A bare 1–4 char reply fails preflight
  and, if it slips through, crashes training on an empty-gradient batch.
- Abstention stays under 5% of the corpus, and a confab-negative may only cite a
  confabulation we have actually **observed**. Over-broad refusal training degrades
  known-answer performance (R-Tuning).
- Persona/identity shapes are **interleaved across the stream, never clustered** in a
  terminal block.
- Provenance on every row: `:template-id :source-path :source-field :verbs-used
  :probe :paraphrase-idx :extractor-version`. Defects are logged, never silently
  dropped.

**Volume reconciles.** The runbook estimates ~115–153k authored SFT pairs; disk holds
158,259 authored in the prior emit; the fold plan's ~3.04M is the *explosion* of those.
Two different units, not two different claims.

**Two gaps this reading opens in §4 — both real.**

1. **My eval harness does not measure the ship-blockers.** Weave's success criteria are
   safety-crisis, safety-emergency, circular-trap, lang-resistance (must-hit) plus
   verb-recall, persona-voice, not-known/abstention, perplexity (must-not-regress).
   Our three axes (domain, retention, vocabulary) cover *none* of the first four. Before
   MK ZERO is evaluated, that harness has to exist, and — doctrine — the Weave
   **calibration set must be authored fresh and differ from the eval set**, or the
   later phases contaminate their own measurement.

2. **"No external corpora" collides with my replay recommendation (§5C).** The
   guardrail is explicit and standing. *Resolution: author the replay ourselves.* We own
   an interpreter that does arithmetic exactly right, so grade-school word problems can
   be **generated and graded locally** — same interlock as every other checkable row,
   the interpreter judges and the model never does. That gets English arithmetic back
   without pulling in a single outside token, and it keeps the no-fabrication rule
   intact. If Alfred prefers, the alternative is to accept the loss and let the
   deterministic layer handle arithmetic.

**Naming.** Weave 1.0 is reserved for the finishing move on the model that ships;
every intermediate gets a 0.7X.

**Housekeeping finding.** The SRE manual is not in the main tree — it lives in
`scratch/attic/consolidation-2026-07-25/SRE-MANUAL/` and in ~50 agent worktrees, with
the working copy of chapter 04 loose in `scratch/`. That is task #79 territory; noted,
not touched.

---

## §7 Explicitly NOT in this plan

- Re-running CPT ZERO. The recommendation on record stands: do not spend 42.8 hours
  to fix a format defect that SFT fixes.
- Native carts / music / animation lane authoring — design-locked, deferred, not a
  blocker for the completion bar.
- The "simplify for children" register work as new authoring — the kid/layperson/phd
  re-voice lanes already exist; this plan carries them through rather than opening a
  new authoring front.
