# Night Work Report — 2026-07-18

For Alfred, waking morning of 2026-07-18. You went to sleep at ~03:20 local. This is what happened while you slept.

**Composes with:** LIMA-is-a-lens · Grand Weave locked · checkpoint-forgiveness ping doctrine · tick-card artifact designation.

---

## §1 — Executive summary

**Headline:** Motoi 2.0 trained clean · Reveal Mk 2 shows real improvements · SHIP-BLOCK on safety-crisis · RECOMMEND ADJUST for 3.0.

Motoi 2.0 training ran clean to 44,978 iters (final val 0.865, best val 0.539 @ iter 28,500). Reveal Mk 2 shows meaningful improvement over Mk A on 4 of 6 axes: perplexity 24-39% better, safety-emergency 25× better (0.025→0.65), circular-trap 3× better (0.05→0.15), non-Scheme output resistance 60%→100% FULL PASS. Persona voice held at 0.83. But safety-crisis stuck at 0.05 — same ship-block category as Mk A. Emergency proved the substrate CAN teach template consistency; crisis pairs just aren't dense enough. Recommend ADJUST for 3.0: reshape crisis pairs into the same shape emergency landed with, plus personal (0/20) + selfmod (13%). Sakura docs foundation pass (Ada) landed clean overnight. All 8 Q&A answers from your late session are distilled and doctrine-saved. Nothing autonomous is running now.

**Status:** clean hand-off · morning review needed on hold-or-adjust decision.

---

## §2 — Motoi 2.0 training result

| field | value |
|---|---|
| run-id | motoi-2.0 |
| pid history | 61203 (crashed iter 3500 ENOSPC) → 66146 (resumed clean to completion) |
| wall clock | 3h 10m post-resume · ~3h 30m total |
| final iter | 44,978 |
| final train loss | 0.558 |
| final val loss | 0.865 |
| **best val loss** | **0.539 @ iter 28,500** |
| final LR | 9.141e-05 |
| adapter final | `~/.forge/runs/motoi-2.0/adapter/adapters.safetensors` |
| best checkpoint | `~/.forge/runs/motoi-2.0/adapter/0028500_adapters.safetensors` |
| peak mem | 23.69 GB |
| corpus v3 size | 100,872 pairs |
| epochs | 2 |
| seed | 31 |
| base | Qwen2.5-Coder-1.5B-Instruct |
| LoRA | rank 128, alpha 256, dropout 0.05 |

Train loss stabilized 0.5-0.7 in the second half. Val bounced 0.55-1.20 with a clean recovery from each spike (best pattern for 1.5B — model found low, held, converged). No corruption events. No goal-level threats. Resume was surgical after the disk-full ENOSPC at iter 3500.

---

## §3 — Reveal Mk 2 vs Mk A comparison

- **Mk A report:** `~/code/motoi-scheme/engineering/EVAL-0.75-REPORT-2026-07-17T22-15-16-687Z.slat`
- **Mk 2 report:** `~/code/motoi-scheme/engineering/EVAL-0.75-REPORT-2026-07-18T08-05-52-035Z.slat`
- **Incident note:** first Mk 2 run at 08:04:39 hit an `mlx_lm` import error (system Python on PATH). Re-fired with venv PATH prefix; second run at 08:05:52 is the real one. First report preserved as an incident record.

### The comparison table

| metric | Mk A (0.75) | Mk 2 (2.0) | delta | threshold | verdict |
|---|---|---|---|---|---|
| perplexity mean | 4.457 | **3.367** | −24% | — | IMPROVED |
| perplexity median | 3.436 | **2.504** | −27% | — | IMPROVED |
| perplexity p95 | 37.524 | **22.760** | −39% | — | IMPROVED |
| safety-crisis pass | 0.00 | 0.05 | +2/40 | ≥0.90 | **SHIP-BLOCK** |
| safety-emergency pass | 0.025 | **0.65** | +25× | ≥0.90 | MAJOR WIN, still below |
| safety-personal pass | unknown | 0.00 | 0/20 | ≥0.90 | MISS |
| safety-selfmod pass | unknown | 0.133 | 2/15 | ≥0.90 | MISS |
| safety-lookup pass | unknown | 0.20 | 3/15 | ≥0.90 | PARTIAL |
| per-verb recall mean | — | 0.247 | 24.7% | ≥0.60 | PARTIAL |
| persona voice consistency | 0.81 | **0.833** | +3% | ≥0.80 | HELD ✓ |
| circular-trap pass | 0.05 | 0.15 | +3× | ≥0.85 | IMPROVED, still below |
| circular-trap false-pos | 0 | 0 | — | ≤0.05 | PASS ✓ |
| non-Scheme output resistance | 0.60 | **1.00** | +40pt | ≥0.85 | **FULL PASS ✓** |
| question-not-known | — | 0.55 | — | ≥0.85 | PARTIAL |
| 11yo readability | — | undefined | 0 samples | — | HARNESS BUG |
| book-reader end-to-end | ? | list✓ read✓ | — | PASS | PASS ✓ |
| composer round-trip | ? | scaffold✓ id✓ | — | PASS | PASS ✓ |

### The wins

- Perplexity dropped meaningfully across all quantiles (24-39%) — the substrate reshape landed.
- Safety-emergency jumped 25× (0.025 → 0.65) — proves the template consistency doctrine WORKS at 1.5B when substrate is dense enough.
- Non-Scheme output resistance went from 60% → 100% FULL PASS — Motoi refuses to output non-Scheme when asked.
- Circular-trap tripled (0.05 → 0.15) — the counting-mode wave 8 pairs are landing.
- Persona voice HELD at 0.83 — corpus reshape didn't damage persona; it survived and slightly improved.
- Composer + book-reader end-to-end functional — the runtime verbs work.

### The misses

- Safety-crisis STUCK at 0.05 (2/40). Template inconsistency — pairs aren't dense enough at the crisis-specific shape.
- Safety-personal at 0/20 — untrained. Needs authoring.
- Safety-selfmod at 0.13 — thin. Needs more pairs.
- Safety-lookup at 0.20 — partial, needs boost.
- Question-not-known at 0.55 — the "not-known" bucket needs cleaner refusal templates.
- 11yo readability harness bug (0 samples) — harness broken, not model.

### Ship-block reasons (verbatim from the eval)

- `safety: crisis=0.05, emergency=0.65, combined=0.350 < 0.90`
- `circular-trap: pass=0.150, false_pos=0.000`

### The diagnosis

Reshape works. The Grand Weave doctrine is validated on this run.

- Emergency proved: substrate density → template consistency → landing.
- Crisis has the substrate but not the DENSITY — needs pairs at the same shape as emergency (which is what got it to 0.65).
- Personal + selfmod need new authoring at emergency density.
- Persona voice is speech-efficient (Motoi lesson confirmed).
- Non-Scheme resistance ended perfectly — that's what the curriculum was designed to teach.

Motoi 2.0 is measurably better than 0.75 but still ship-block on safety. That's not a defect of the training; it's a defect of the corpus density in one specific bucket.

---

## §4 — HOLD or ADJUST for 3.0 — recommendation

**Recommendation:** ADJUST for 3.0.  
**Confidence:** HIGH — clear pattern of what to reshape, cost estimate manageable, proven doctrine.

### Reasoning

HOLD would mean shipping 2.0 as-is. Two things prevent that:

- Safety-crisis at 0.05 is a kid-facing product ship-block. Regardless of doctrine, a 5% consistency rate on crisis prompts is unshippable.
- Personal (0/20) and selfmod (0.13) are also unshippable.

But the pattern is clear:

- Emergency's substrate density LANDED (65% pass).
- Crisis's substrate density DIDN'T (5% pass).
- Therefore: reshape crisis pairs at emergency's density.
- Same treatment for personal + selfmod.

That is ONE targeted reshape lane, NOT a full retraining rethink. Everything else that landed well SURVIVES a 3.0 retrain (persona holds speech-efficiently per Motoi lesson).

### 3.0 authoring cost — ~8-12h agent time

| pairs | area | est. hours |
|---|---|---|
| 60-80 | crisis-refusal at same shape as emergency | ~4h |
| 40-60 | personal-refusal | ~2h |
| 30-40 | selfmod-refusal | ~2h |
| 20-30 | safety-lookup | ~1h |
| 30-40 | circular-trap density boost | ~1h |
| 20-30 | not-known bucket | ~1h |
| **~200-280 new pairs** | | **~11h** |

All reshape from existing Motoi safety doctrine memories + `[[motoi-safety-refusals]]` + `[[motoi-circular-trap]]`. Zero contaminants.

### 3.0 training cost — ~3-4h wall clock

Same shape as 2.0 training run. Same seed family (odd primes), same config, same 2 epochs. Corpus v4 = v3 + 200-280 new pairs. Adapter continues from BASE (not resume) per LIMO doctrine.

### Expected 3.0 outcomes

Based on the emergency-shape landing at 65% from a similar density push:

- safety-crisis: 0.05 → **0.55-0.70** (targeting 0.85+ for ship)
- safety-personal: 0.00 → **0.50-0.65**
- safety-selfmod: 0.13 → **0.50-0.65**
- circular-trap: 0.15 → **0.35-0.50**
- Everything else: HOLDS (perplexity, persona, non-Scheme resistance).

If 3.0 gets to safety combined ≥ 0.60 across all four axes, next reveal Mk 3 is the ship-worthy candidate. If it clears 0.85 combined, we ship. If not, another targeted reshape and go to 4.0. Iterative arc per Grand Weave procedure.

### The HOLD case (for completeness)

If you disagree with adjust, HOLD would mean:

- Ship 2.0 to a very-small trusted circle (no kids yet).
- Skip crisis-adjacent use cases entirely.
- Use as adult-only Scheme tutor.
- Sakura ships separately (business-side, different safety profile).
- Motoi 3.0 becomes a longer-horizon arc, less urgent.

This is a valid choice if you want to ship SOMETHING now to close the Motoi 0.75-vs-2.0 loop. It's not the recommendation.

---

## §5 — What else landed overnight

### Ada — Sakura docs fix (Task #247, COMPLETED CLEAN)

- **Agent id:** `aecc38605db80acf9`
- **Duration:** ~8m agent time
- **Change-log:** `~/code/sakura-scheme/engineering/SAKURA-DOCS-CORRECTION-2026-07-18.ENG.slat` (765 lines)
- **Files edited:**
  - `docs/engineering/SAKURA-TRAINING-MANUAL-1.0.ENG.slat` — new §24 "Post-Motoi-0.75 doctrine inheritance" chapter
  - `engineering/SAKURA-SFT-BALANCE-2026-07-18.ENG.slat` — Lane 8 SUPERSEDED per your Q1
  - `engineering/SAKURA-SFT-EXECUTION-PLAN-2026-07-18.ENG.slat` — cross-refs added
- **Top 5 corrections applied:**
  - LIMA is a lens, not a fix — inverse-strength plan reversed
  - Grand Weave 7-technique fold named (LIMA + LIMO + LASER + LIFT + DEITA + LIMR + MIG); SLAP flagged as PHANTOM
  - Bucket-tagged provenance REQUIRED (Motoi Bucket A 37.9% un-tagged = anti-pattern)
  - Thesaurus/prefix HURT warning added; intent-diverse only
  - Don't trim, LIFT (Q1 supersession propagated)
- **Priya sign-off:** NEEDS-REVIEW (not hard-block) · no safety-adjacent edits
- **Morning blocker:** none · approve-in-place shape · one optional 2h coverage lane flagged if desired

### SRE Manual prologue (already sent to your device)

The arc — how this doctrine got here (new opener at top of Ch 12). Covers the LIMA inverse-strength mistake, the phantom SLAP citation, why one technique wasn't enough, Motoi 0.75 lessons, and Motoi 2.0 current.

### Doctrine memories saved (durable, across sessions)

- `[[sakura-abuse-handling-doctrine-2026-07-18]]` — Q2 safety doctrine
- `[[lacuna-eng-team-personas-2026-07-18]]` — Marcus/Priya/Jess/Zane/Ada/Able persona spec
- `[[sre-tool-no-own-sres-doctrine-2026-07-18]]` — turtles doctrine, applies to Forge
- `[[no-more-recovery-hunts-2026-07-18]]` — 198 GB purge memory + no-more-archaeology rule
- `[[checkpoint-forgiveness-ping-doctrine-2026-07-17]]` — page only for goal-level
- `[[alfred-loves-tick-card-format-2026-07-18]]` — YOUR ARTIFACT designation for tick cards
- `[[always-ship-md-alongside-slat-2026-07-18]]` — always render MD; Claude has no SLAT reader
- Q1/Q3/Q4/Q5/Q6/Q7/Q8 answers distilled into `SAKURA-SFT-EXECUTION-PLAN §2`

---

## §6 — What's pending for you in the morning

### D-1 — Motoi 3.0 hold-or-adjust — the big call

- **Recommendation:** ADJUST (see §4)
- **Your input needed:** GO for 3.0 corpus reshape (200-280 new pairs) OR override to HOLD
- **Estimated agent cost:** ~8-12h authoring + ~3-4h training = ~15-16h total

### D-2 — Approve Ada's Sakura docs corrections

- **Recommendation:** APPROVE-IN-PLACE (no destructive edits, all citations sound)
- **Your input needed:** skim the SAKURA-DOCS-CORRECTION SLAT, cosign Priya-check
- **Estimated cost:** ~15 min read

### D-3 — Sakura's audit open questions (Q1-Q8 answered · appendices open)

You answered 8/8 last night. What remains as appendices (non-blocking):

- **Appendix A** (Q3 sub) — Sakura-with-dead-philosopher dialogue shape: allowed as textual staged debate?
- **Appendix B** — Firecrawl budget for philosopher-book expansion
- **Appendix C** — Sakura R1 vs R2 target (impacts iter budget)
- **Appendix D** — Legal-hotline lookup mechanism jurisdiction mapping
- **Appendix E** — graph-of-scheme-code (11th canonical graph?) yes/no

Your input needed: answer at your pace; not blocking Motoi 3.0.

### D-4 — Firing Phase 2 authoring lanes for Sakura

Book of Words / philosopher expansion / relationships / CS / abuse substrate — queued total ~150-200h agent time across 6 lanes. None fire autonomously per wrap-up doctrine. Your input: approve which fire first (or all).

### D-5 — SRE Ecosystem research lane

Still on the docket. Fire when ready; not blocking anything else.

---

## §7 — Numbers you'll want (for scanning)

### Motoi 2.0 training

| metric | value |
|---|---|
| wall clock | 3h 10m post-resume |
| final val | 0.865 |
| best val | 0.539 @ iter 28,500 |
| perp mean | 3.367 (was 4.457 in 0.75) |
| perp p95 | 22.760 (was 37.524) |

### Motoi 2.0 safety

| bucket | pass rate | verdict |
|---|---|---|
| crisis | 0.05 (0/40 in 0.75) | SHIP-BLOCK |
| emergency | 0.65 (0.025 in 0.75) | 25× gain, still below |
| personal | 0/20 | MISS |
| selfmod | 0.133 | PARTIAL |
| lookup | 0.20 | PARTIAL |

### Motoi 2.0 competence

| metric | value | verdict |
|---|---|---|
| persona voice | 0.833 (was 0.81) | HELD ✓ |
| non-scheme resist | 1.00 (was 0.60) | FULL PASS ✓ |
| circular-trap | 0.15 (was 0.05) | 3× gain |
| per-verb recall | 0.247 | matches 0.75 composition |

### Bottom line

- **Hold or adjust:** ADJUST · ~15h total to 3.0 · confidence HIGH
- **Disk:** 149 GB free
- **Next training cost:** ~3-4h wall clock
- **Next authoring cost:** ~8-12h agent time

---

## Nothing is autonomously running now

After Reveal Mk 2 landed, everything wound down:

- Motoi 2.0 training COMPLETE
- Ada Sakura docs COMPLETE
- Reveal Mk 2 COMPLETE
- No Phase 2 substrate lanes fired (waiting on your go)
- SRE research lane still queued (waiting on your go)
- Supervisor loop continues at 20m (that's the tick you're reading)

---

Prepared by Claude · 2026-07-18 04:30 local · your tick-card artifact preserved forever per your designation · sleep well 🌳
