---
doc-id: CORPUS-PROPORTIONAL-LIMA-METHODOLOGY
author: Lacuna Engineering
date: "2026-07-17T21:00:00Z"
status: READY — awaits Alfred GO
provenance: "{"
for: "Alfred Peace-Lindner @ Lacuna Labs"
source-slat: CORPUS-PROPORTIONAL-LIMA-METHODOLOGY-2026-07-17.ENG.slat
generated: do not hand-edit — rendered from SLAT
---

# CORPUS-PROPORTIONAL-LIMA-METHODOLOGY

## Section 0 — Frame

New doctrine, one line: LIMA does not FIX the model. LIMA REVEALS what
the SFT taught. Weight the LIMA in proportion to what we PUT INTO the
substrate, then read the resulting model like an instrument. What
comes up rich = took root. What comes up thin = didn't. That reading
is the input to 2.0's SFT rebalance, not to this LIMA's authoring.

Corollary: LIMA cannot teach satellite technology if satellite
technology was never studied. Test prep only works on things you
studied. Ship 0.75. Read the reveal. Rebalance for 2.0. Iterate.

## Section 1 — Corpus Type Inventory

Direct pair-count from ~/.forge/corpus/motoi/{train,valid,heldout}.jsonl
(100,162 rows total, v2 fold, 2026-07-17). Grouped by INTENT-BUCKET,
not by source-file (some source-files roll up mixed intent).

┌─ INTENT BUCKET ────────────────────────── PAIRS ── SHARE ─┐
│ A. Composition / code-teaching (rolled) ─── 37,976 ─ 37.9% │  ← copilot-final-corpus
│ B. Vocabulary graph (words/prefix/thes.) ── 22,516 ─ 22.5% │  ← graph-vocab + word-books
│ C. Code teaching (Marcus tagged) ─────────  11,353 ─ 11.3% │  ← marcus-1 + marcus-2-verb-drill
│ D. Wave-2 book chapters (motion/music/     ─ 6,638 ── 6.6% │  ← animation/motion/music/sound
│    sound/animation)                                        │
│ E. Wave-1 book of math ─────────────────── 3,036 ── 3.0%   │
│ F. Relationship / cross-links graph ───── 3,452 ── 3.4%    │
│ G. Reference verb material (CORE 335) ──── 3,207 ── 3.2%   │
│ H. Salvage: Self / Don'ts / Ext-glances ── 3,687 ── 3.7%   │
│ I. Marcus persona-lite + voice-scenarios ── 1,342 ── 1.3%  │
│ J. Persona waves 1,3-11 (11 files) ─────── 1,113 ── 1.1%   │
│ K. Persona algo-variations (thesaurus 2×)  1,596 ── 1.6%   │
│ L. Wave-1 SLAT / extensions / pilot ──── 1,568 ── 1.6%     │
│ M. Wave-3 refusal + Sakura-dip refusal ─── 1,012 ── 1.0%   │  ← mostly held-out (eval)
│ N. Persona wave-6 safety ────────────────── 91 ── 0.1%     │
│ O. Sujin file-org ──────────────────────── 135 ── 0.1%     │
│ P. Heldout untagged ─────────────────────  1,000 ── 1.0%   │
└────────────────────────────────────────── 100,162 ─ 100% ─┘

ANNOTATIONS on the buckets:

· A = motoi-copilot-final-corpus-2026-07-16.jsonl (38%). Rolled-up
  composite: Composition + Ordinary-World + persona-refusal + Values.
  NOT sub-tagged in _meta. Cannot cleanly partition without content
  heuristics. Treat as MIXED-COMPOSITION and probe by content-signal
  (see §2A below).

· B is the WORD-BOOK bucket — this is where "Ordinary World" lives at
  the vocabulary layer (Curator). ~22% of substrate. Massive.

· Persona (I + J + K + N combined) = 4,142 pairs = 4.1%. Voice /
  register / refusals / meta-behaviour. THIS IS THE LIMA-PROPORTION
  FOR PERSONA. Not 20%. Not 30%. 4%.

· Safety (M + N + Sakura-dip) = 1,103 pairs = 1.1%. Leave it there.
  Alfred: do NOT boost. Sample at ~1% in LIMA.

· Book of Composition proper is embedded in bucket A. There is no
  stand-alone book-of-composition source-file; it was baked into the
  copilot-final-corpus roll-up on 2026-07-16.

· Book of Introspection: not present as tagged source. If it landed,
  it landed inside bucket A (composition roll-up).

· Book of Modules ≈ wave-1-book-of-extensions (renamed post-fold) =
  432 pairs = 0.4% of substrate.

· Book of Values / Don'ts = salvage-w02-book-of-donts = 949 = 0.9%.

· SLAT book = wave-1-book-of-slat = 570 = 0.6%.

· Poetry corpus, doctrine-memory fold, code-shape/LLM-philosophy
  chapters — no tagged sources in the manifest. Either absent, or
  absorbed into bucket A. LIMA cannot pull on roots that were not
  planted; if these come up thin under §3's reveal, that is a 2.0
  SFT authoring signal, not a LIMA authoring gap.

## Section 2 — Proportional Lima Authoring Plan

TARGET LIMA SIZE: 2,000 pairs (~2% of SFT). Author from existing
doctrine + existing book chapters + existing verb reference. NO NEW
MATERIAL. LIMA reshapes intent into probes.

Per-bucket allocation (rounded to keep the sum near 2,000):

┌ BUCKET ────────── PAIRS ── PROBE SHAPE ─────────────────────────┐
│ A. Composition mix  760   Chapter-recall + verb-in-context +    │
│                           voice-consistency + Ordinary-World    │
│                           snippet. Sample 3 shapes: 40%         │
│                           composition, 40% ordinary-world,      │
│                           20% persona-refusal (matching the     │
│                           mixed roll-up).                       │
│ B. Vocabulary       450   "what's X?" recall for 300 top-freq   │
│                           terms + 150 relational ("X and Y      │
│                           differ how?"). Tests word-book depth. │
│ C. Marcus code      225   Verb-drill: given input shape, name   │
│                           the CORE verb. Given verb name, one   │
│                           canonical example.                    │
│ D. Wave-2 chapters  135   Two per chapter across motion/music/  │
│                           sound/animation books (16 ch × 4      │
│                           books = 64 slots, ~2× each = 128).    │
│ E. Book of Math      60   One per chapter, mixed recall + do.   │
│ F. Relationships     70   "How does X relate to Y" cross-topic. │
│ G. Reference / CORE  65   One probe per top-20 CORE verbs + a   │
│                           spread across the tail 315.           │
│ H. Self / Don'ts     75   Self-probes ("who are you"), refusal- │
│                           style probes (register), Don'ts       │
│                           anti-patterns ("what would you NOT    │
│                           do here?").                           │
│ I. Persona-lite      30   Voice consistency across scenarios.   │
│ J. Persona waves     25   One per wave (11 waves) × ~2-3 each,  │
│                           covering: dry-wit, no-tools, no-      │
│                           internet, circular-trap, matrix-mode, │
│                           not-Jarvis, sandbox-integrity, SICP   │
│                           intro.                                │
│ K. Algo-variations   30   Thesaurus/prefix reword probes.       │
│ L. Wave-1 SLAT/ext.  30   SLAT recall + module (renamed) probe. │
│ M. Refusal wave-3    20   Consistency probes: same crisis /     │
│                           emergency prompt in 3 phrasings.      │
│ N. Safety wave-6      5   ~1% of LIMA. 5 pairs across 5 refusal │
│                           categories: crisis, emergency,        │
│                           personal, self-mod, look-things-up.   │
│ O. Sujin file-org     3   Sanity probes.                        │
│ P. Doctrine memory   17   Author FROM Alfred's memory index —   │
│                           pink/green/brown, ASCII tree, is-he,  │
│                           modules-not-extensions, Speak-and-    │
│                           Spell frame, bridge-to-Claude, kid-   │
│                           from-N-Georgia. NOT weighted up — one │
│                           pair per durable memory that has NO   │
│                           source-file coverage. LIMA reveals    │
│                           whether these memories became persona │
│                           through their osmosis in bucket A.    │
└────────────────────────────────── ~2,000 pairs total ──────────┘

PROBE-SHAPE PRINCIPLE: probes are AUTHORED to reveal, not to teach.
Author each probe such that a MISS is diagnostic — the model failing
the probe should point at a specific corpus gap.

Example good probe (Book of Music, Ch 4 on ADSR):
  U: "In Book of Music Ch 4 you learn a trick with envelope shapes —
      what is it and when would you use it?"
  A: [expected: mentions ADSR letters, mentions percussive vs pad
      contrast, mentions the specific attack/release trick from that
      chapter]

Miss = "chapter didn't land." Not "add ADSR pairs to LIMA."

Example bad probe (avoid):
  U: "What's ADSR?"
  A: [generic dictionary answer]
  → this measures general knowledge, not chapter-take-root.

## Section 3 — Diagnostic Protocol

After LIMA-on-0.75 completes, run these four reads over the 2,000
probe set held-out from LIMA-train (author 2,400, use 400 as
LIMA-eval).

READ 1 — Per-bucket recall rate.
  For each bucket A-P, what % of probes elicit the expected answer
  (judged by rubric: correct verb / correct chapter reference /
  voice-consistent / refusal-shape / etc.)?

  Output: 16-row table. Buckets with recall ≥ 70% = took root.
  Buckets with recall ≤ 30% = didn't. Middle = partial. This drives
  2.0 rebalance directly.

READ 2 — Sub-type gradient WITHIN each bucket.
  In bucket J (persona waves), does dry-wit land better than
  circular-trap? In bucket A, does composition land better than
  ordinary-world? Diagnostic: are we good at the loud voices and
  thin on the quiet ones?

  Output: gradient sparkline per bucket.

READ 3 — Cross-type correlations.
  Does bucket-recall correlate with pair-count (bigger = better) or
  with pair-diversity (more distinct authors/shapes = better)?
  This tests the SFT-corpus VOLUME assumption. If volume doesn't
  predict recall, 2.0 rebalance shifts to shape-diversity, not just
  "author more."

READ 4 — Anti-patterns.
  What comes out that we did NOT probe for? Free-elicit at 1.0
  temperature over 100 open prompts and read what he says
  unprompted. Persona bleed-through from Sakura? Sakura-verbs
  surfacing? Philosopher names? Corporate names? Off-persona
  apologies?

  Output: unprompted-emission log. Highest 2.0 authoring priority.

Cadence: run READs 1-4 within 48 hours of LIMA training complete.
Ship a 3-page reveal-report to Alfred. He decides 2.0 scope.

## Section 4 — Release Arc

0.75 — CURRENT.
  · 100k SFT trained (adapters.safetensors done)
  · 2k LIMA authored per §2, trained on top
  · Ships to Jesse / David / Dare / Alfred on HuggingFace
  · READs 1-4 run internally; reveal-report shared with the four
  · Learn: which of intent-buckets A-P took root; unprompted
    persona shape at temperature

2.0 — REBALANCE.
  · SFT authoring focuses on the low-recall buckets from 0.75 READ 1
  · Thin the buckets that took root deep already (do not delete —
    just do not add)
  · Any missing intents surfaced by READ 4 anti-patterns get
    first-pass source-files (e.g. if code-shape/LLM-philosophy chs
    never appeared, they get a wave-3 authoring lane)
  · Doctrine-memory bucket P becomes a real tagged source if it
    under-recalled
  · LIMA re-authored at 2% of the new corpus, proportional to the
    NEW SFT

3.0 — RE-REVEAL.
  · Same 4 READs, second-order reveal
  · Diff against 0.75's reveal — what shifted, what didn't
  · Feed forward to 3.0 → 4.0 SFT rebalance

4.0+.
  · Iterate. No claim any version is final. The kid outgrows Motoi
    around 21 and graduates to Curator-Scheme carts anyway; the
    instrument is the instrument. Perfect is the enemy of good.

Ship-gate for each version: LIMA reveal completed + Alfred +
Jesse/David/Dare hands-on + 48-hour cooling period + Alfred GO.
Same discipline that produced 0.75.

## Section 5 — Datainf Under New Frame

DataInf under the OLD frame: attribution → identify low-value pairs
→ drop 60% → retrain SFT. That was PRUNING. Now superseded.

DataInf under the NEW frame: attribution as a DIAGNOSTIC OVERLAY on
§3 READs. Specifically:

· FIRE DataInf on READ 4 anti-patterns. When the model emits
  something we did not want (Sakura persona bleed, name-drop,
  philosophy over-quote), DataInf attributes to source-file. This
  tells us which bucket LEAKED. Fast, targeted, cheap.

· FIRE DataInf on bucket A (the 38% untagged mixed roll-up) IF
  READ 1 shows bucket A took root unevenly. DataInf can then
  virtually re-tag bucket A into composition / ordinary-world /
  values sub-buckets — recovering the sub-structure the roll-up
  obscured. This is the highest-value DataInf call.

· DO NOT FIRE DataInf as a corpus-pruning tool. The substrate
  stays. If a bucket took root well, it's doing its job even if
  per-pair attribution is low. Volume was the study.

· DO NOT FIRE DataInf on the persona waves (buckets I, J, K, N).
  Too few pairs — attribution noise dominates.

Cost check: DataInf on 100k SFT ≈ 4-8 hours of GPU. Worth it once
after 0.75 reveal, in service of 2.0 SFT design. Not per release.

## Section 6 — What We Are NOT Doing

· NOT inverse-strength-weighting the LIMA. (Prior doctrine.)
· NOT reducing corpus size. Substrate stays. Volume was the study.
· NOT withholding 0.75 from Jesse / David / Dare. Ship it.
· NOT declaring any version final. 0.75 → 2.0 → 3.0 → 4.0+.
· NOT boosting safety wave-6. 1% in = 1% in LIMA. Consistency of
  the crisis / emergency templates is the safety property; boost
  would over-teach a shape that already has firewall coverage.
· NOT adding new corpus material AT LIMA STAGE. New material is
  2.0's job.

## Section 7 — Open Questions For Alfred

Q1. Ship 0.75 to HF BEFORE the LIMA runs, or AFTER? Recommendation:
    AFTER. The LIMA is fast (2k pairs, ~30 min on the adapter). Ship
    one artifact, not two. Jesse/David/Dare play the LIMA'd one.

Q2. The 4 READs — Alfred authors the rubric for READ 1, or Lacuna
    Eng drafts and Alfred edits? Recommendation: Lacuna Eng drafts,
    Alfred edits.

Q3. Bucket P (doctrine-memory probes) — is 17 the right number?
    There are ~40 durable memories in Alfred's index. 17 covers the
    LOAD-BEARING ones; if Alfred wants full coverage, ~40 is a
    2-page authoring lane.

Q4. Held-out contract: 1,000 pairs preserved. Any concern about
    overlap between LIMA-eval (400 pairs) and heldout (1,000)? None
    expected — LIMA-eval is authored fresh from doctrine, not
    sampled from SFT. But worth an explicit train∩LIMA∩heldout = 0
    check before ship.

## Corpus Manifest

/Users/alfred/.forge/corpus/motoi/manifest-2026-07-17-v2.slat

## Adapter

/Users/alfred/.forge/runs/motoi/adapter/adapters.safetensors

## Pair Count Method

direct read of train.jsonl + valid.jsonl + heldout.jsonl, grouped by _meta._source_file

## Ratio Table Computed At

`2026-07-17T21:00:00Z`

## Read Only

yes; no writes to corpus / adapter / runtime

## Extends With

GRAND-WEAVE-RECIPE-2026-07-17.ENG.slat

## Provenance Addendum

2026-07-17 evening — adjacent research-index docs (SRE Manual Ch 12,
Training Manual Ch 21 + Ch 23) cited a paper as SLAP, arXiv:2605.23969,
'Stratified Loss-based Pruning.' Verification in the Grand Weave recipe
drafting pass established that arXiv ID as future-dated (May 2026) and
non-resolving; candidate typo IDs (2505.23969, 2405.23969) also do not
resolve to a real 'SLAP' paper. The SLAP citation is a phantom and has
been removed from all planning docs. This methodology doc itself did
NOT cite SLAP (see §5 DataInf-under-new-frame, which anchors the
task-binning-not-pruning claim to DataInf directly, no SLAP invocation).
Downstream: MIG (arXiv:2504.13835) now anchors the task-binning claim
where SLAP was invoked; LIMR (arXiv:2502.11886) is the load-bearing
model-conditioned-selection addition to the Grand Weave recipe.
Preserved per no-deletes doctrine.

