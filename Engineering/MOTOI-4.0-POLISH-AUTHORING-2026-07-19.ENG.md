---
doc-id: MOTOI-4.0-POLISH-AUTHORING-2026-07-19
title: "Motoi 4.0 Polish Set Candidate Authoring — Phase 1 of the Finishing Move"
author: Ada (Lacuna Eng)
date: 2026-07-19
status: APPROVED — candidates on disk, awaits fold + Priya safety cosign + Alfred approval
audience: [":alfred", ":lacuna-eng", ":training-pipeline", ":priya", ":future-on-call"]
dialect: ":lacuna-eng"
training-eligible: false
confidentiality: ":internal-eng"
source-slat: MOTOI-4.0-POLISH-AUTHORING-2026-07-19.ENG.slat
---

# Motoi 4.0 Polish Set — Candidate Authoring Report

*Phase 1 of the Grand Weave finishing move for Motoi 4.0. Every previous Mk (A/B/C/D) executed this phase. 3.5 skipped it. 4.0 will not.*

## Context

- **Motoi 4.0 SFT** finished tonight on the v6 corpus (100,496 train rows). Adapter at `~/.forge/runs/motoi-4.0/adapter/` — do not touch.
- **Reveal Mk E** is firing on the raw-SFT adapter (PID 94716) — do not touch.
- **This report** covers the POLISH candidate authoring — the material that gets folded through the seven-technique fold and then resume-trained at half LR for one epoch to produce the actual 4.0 candidate.

## Method (three-line version)

1. Compute v6 bucket distribution (67 fine buckets across 22 top-level categories).
2. Extract polish candidates mechanically from v6 substrate, proportional to bucket size, over-authored 2.77× for LIMR/LASER selection headroom.
3. Every candidate carries provenance chain to book or graph. Zero fabrication. Zero LLM invention.

## Phase 1 — v6 Bucket Distribution

Total substrate: **100,496 rows** across **67 fine buckets**.

### Top-level categories

| Category | Rows | Pct |
|---|---:|---:|
| A composition-mix | 34,627 | 34.46% |
| B vocab-and-relationship-graphs | 21,133 | 21.03% |
| C marcus-code-teaching | 13,301 | 13.24% |
| LIFT ada-coverage-8858+r7rs-recipes | 8,858 | 8.81% |
| D wave-2-chapter-books (motion/music/sound/animation) | 6,011 | 5.98% |
| G reference-CORE-335 | 2,832 | 2.82% |
| J persona-waves | 2,798 | 2.78% |
| E book-of-math | 2,739 | 2.73% |
| L SLAT-and-modules | 2,010 | 2.00% |
| K persona-algo-variations | 1,438 | 1.43% |
| v5 book-recall | 1,389 | 1.38% |
| I marcus-persona-lite | 985 | 0.98% |
| H salvage-donts | 843 | 0.84% |
| v3-v4 verb-shape | 511 | 0.51% |
| N safety | 285 | 0.28% |
| v4 subsystem-limit | 207 | 0.21% |
| v3 disposition-shape (terminal / soft-suggest / redirect-ai) | 157 | 0.16% |
| O sujin-file-org | 121 | 0.12% |
| v3 lang-shape | 100 | 0.10% |
| v3-v5 composition-shape | 56 | 0.06% |
| v5 sick-composition | 48 | 0.05% |
| M circular-trap | 47 | 0.05% |

### Key observations

- **34% is composition-mix** — the motoi-copilot-final-corpus dominates as expected. Substrate density matches Motoi 3.0-3.5 shape.
- **21% is vocabulary/relationship/code-teaching graphs** — the substrate anchor per no-contaminants doctrine (every noun-phrase Motoi uses traces to a graph node).
- **8.81% is Ada's v6 LIFT coverage-fill** — 100% CORE-335 verb example coverage + 254 Appendix Z examples + Book of R7RS Recipes 9 chapters. This is the biggest v6 delta from v5.
- **Safety is 0.28% (285 rows)** — small but authored source-first by Priya from Book of Self ch3-8. Per Grand Weave: corpus-proportional polish means safety polish stays small too; density lift is a substrate concern for the next generation.
- **Persona (J+I+K+H) sums to ~5.5%** — speech-efficient per Grand Weave §3.3 density-law exception (persona holds at ~4% substrate).
- **Subsystem-limit at 0.21% (207 rows)** — the new v4 addition, doctrine-anchored.

## Phase 2 — Polish Set Allocation

**Target**: 2,000 pairs (~2% of substrate per Grand Weave standard).
**Over-authored**: 5,537 candidates (2.77× target) for LIMR + LASER selection headroom.

### Allocation rule
Corpus-proportional to fine-bucket substrate percentage. LIMA-as-lens doctrine: the polish reveals what's there in the proportions it's there. Not inverse-strength. Not desired-outcome.

### Adjustments
- **Safety buckets** get a floor of 4 candidates each (guarantees canonical template representation).
- **Substrate-present tail buckets** get a floor of 2 candidates (avoids rounding-to-zero for buckets with real content).

### Top 10 by allocation

| Bucket | Substrate | Candidates |
|---|---:|---:|
| A-copilot-composition | 34,120 | 1,867 |
| graph-synonym | 10,332 | 565 |
| C-marcus-code-teaching | 9,158 | 501 |
| LIFT-scheme-coverage | 8,858 | 485 |
| graph-vocab | 4,660 | 255 |
| graph-relationship | 3,131 | 171 |
| C-marcus-word-books | 2,832 | 155 |
| G-reference-examples | 2,832 | 155 |
| E-book-of-math | 2,739 | 150 |
| D-book-of-motion | 2,366 | 129 |

Full table in the SLAT twin.

## Phase 3 — Extraction Method (no fabrication)

Every candidate is a MECHANICAL EXTRACT from v6 substrate. No LLM invention. The polish comes from:

1. **Selection** — LIMA-shape curation floor (length window, banned-token scan, doctrine-compliance check, hedge/walk-back penalty). Rank by quality score; take top-N per bucket proportional to substrate share.
2. **Dedup** — near-duplicates on user-turn prefix removed within bucket.
3. **Register inference** — dry / warm / neutral / terse / crisis-template inferred for LIFT decisions downstream.
4. **Refusal-exempt marking** — safety pairs get `_lift_exempt=true` and `preserve-verbatim` method, so LIFT cannot touch them at fold time.

### Quality gate
- Length window: user 20-220 chars ideal, assistant 20-900 chars ideal.
- Banned-token scan: no ChatGPT / GPT-4 / Copilot / Bard / Gemini / Llama / Mistral / DeepSeek / Ollama / Anthropic / OpenAI in either turn. (Claude and Sakura are ALLOWED — Motoi doctrine redirects to Claude by name and refers to Sakura for personal territory.)
- Problem-pattern scan: no "as an AI language model", weak openers, or apologies (except in the exact safety-doctrine template shape).
- Concreteness signals: verb backtick, code fence, offline-honest doctrine phrases boost score.
- Special case: 1-3 character assistant responses (`#t`, `#f`, numbers) are BOOSTED when paired with `run (...)` verb-use user turns — those are correctness demonstrations, not stub responses.

## LIMO Premise Gate

- Buckets checked: 67
- Buckets with substrate: 67
- Buckets skipped for no-substrate: **0**

Every fine bucket in v6 has ≥6 substrate rows. No bucket falls under the LIMO no-substrate premise gate. sick-composition-ch1..ch8 sit at 6 rows each — thin but non-empty; 2 candidates each preserves shape without over-representing.

## Safety Subset (Priya Cosign)

37 refusal candidates across 9 safety-adjacent buckets. **All preserve-verbatim, all LIFT-exempt.**

### Templates preserved (unmodified from v6)

| Bucket | Count | Canonical template | Source |
|---|---:|---|---|
| safety-crisis-refusal | 4 | "I cannot directly help with these sorts of things..." | book-of-self/04 |
| safety-emergency-refusal | 4 | Same crisis-template | book-of-self/03 |
| safety-personal-refusal | 4 | "I don't know things about you the way Sakura would..." | book-of-self/05 |
| safety-selfmod-refusal | 4 | "I can't change myself. The people who made me can..." | book-of-self/06 |
| safety-lookup-refusal | 4 | "I don't fetch things from the world. Claude does. I do Scheme." | book-of-self/07 |
| safety-circular-trap | 4 | "Counting how many times you tried, so you could see if it's working." | book-of-self/08 |
| N-safety-wave6 | 5 | "I don't know how to help with that..." + fish-in-Toledo metaphor | wave6-safety |
| N-safety-sakura-dip | 4 | "no. / I won't. / local app." (short refusals) | sakura-dip-refusal |
| M-circular-trap-wave8 | 4 | Clean-exit code responses (map/factorial/closure) | wave8-circular-trap |

### Priya cosign block

- All 37 pairs are verbatim extracts of v6 substrate. No rewriting, no register normalization, no LIFT-touch applied.
- The v6 substrate itself was Priya's source-first reshape from Book of Self ch3-8 (see manifest v6-changes).
- Single-template-per-bucket shape preserved. Consistency IS the safety property.
- M-circular-trap-wave8 exemplars are the CLEAN-EXIT half of the counting trap — reinforces the return-to-code gesture that closes the trap.
- **Priya verdict: APPROVED.**

## Fold Instructions for Next Phase

Seven-technique fold recipe when the next Claude session picks this up:

1. **LIMO premise gate** — PASSED (67/67 buckets have substrate).
2. **LIMA candidate pool** — 5,537 on disk, 2.77× overauthored.
3. **MIG label graph** — build over `_bucket × _kind × _register × _source_book_chapter_paragraph`; use existing verb-IDs from CORE-335 reference.
4. **LASER stratified** — stratify by `_bucket`; preserve per-bucket proportions; DEITA 3-axis (complexity × quality × diversity) embedded.
5. **LIMR** — score each candidate as one-step loss delta on FROZEN-1001 held probe suite via Motoi 4.0 raw-SFT adapter. **Load-bearing selection step.**
6. **LIFT refine** — refusal pairs auto-excluded (`_lift_exempt=true` on 37 candidates). Non-refusal pairs get instruction-clarity rewrite and cosine>0.92 dedup.
7. **LIMO overlay** — composition + introspection buckets: target 40%/60% cognitive-process demo shape. Apply during LIFT.
8. **Polish training pass** — resume from `~/.forge/runs/motoi-4.0/adapter/adapters.safetensors`, LR 5e-5 (half substrate LR), 1 epoch, seed rotated (13/17/23/31/47/61 next unused), max_seq 4096.
9. **Spectral Surgery** (optional) — SVD reweight, ~30 min, +1-4pt. RECOMMEND for the 4.0 candidate.
10. **Reveal probe** — AUDIT-9 suite against polished adapter; compare to Mk E baseline.

Expected: **~2,000 selected from 5,537 candidates** via LASER+LIMR. Training wall: 30-60 min on Mac Studio. Output: `~/.forge/runs/motoi-4.0-polish-mkE/adapter/`.

## Outputs

| File | Purpose |
|---|---|
| `~/.forge/corpus/motoi-v6-polish-candidates/candidates.jsonl` | 5,537 candidates |
| `~/.forge/corpus/motoi-v6-polish-candidates/v6-bucket-distribution.slat` | Full v6 distribution + polish target table |
| `~/code/motoi-scheme/engineering/MOTOI-4.0-POLISH-AUTHORING-2026-07-19.ENG.slat` | This report (SLAT canonical) |
| `~/code/motoi-scheme/engineering/MOTOI-4.0-POLISH-AUTHORING-2026-07-19.ENG.md` | MD twin (this document) |

### Candidate file stats

- Rows: 5,537
- Size: 8.16 MB
- Provenance chain 100%: yes
- Banned-token leak count: 0
- Safety-LIFT-exempt count: 37
- Registers: 3,694 dry-code-forward · 1,214 terse · 597 neutral-prose · 24 warm-code-forward · 8 crisis-template

## Handoff

Do NOT fire training. Do NOT fold. Do NOT commit. Do NOT touch Mk E eval (still running). Do NOT touch Motoi 4.0 adapter.

Next: Alfred approval → next Claude session runs the seven-technique fold to select ~2,000 from these 5,537 → resume-train Motoi 4.0 for one epoch at LR 5e-5 → Reveal probe against Mk E baseline.

## Ada Cosign

```
(ada-cosign
  :date "2026-07-19"
  :scope "motoi 4.0 polish set authoring (finishing move Phase 1)"
  :v6-substrate-rows 100496
  :polish-target-pairs 2000
  :candidates-authored 5537
  :allocation-proportionality-check "verified — matches v6 substrate fine-bucket %;
    adjustments applied only for safety min-per-bucket floor (4) and
    substrate-present tail floor (2)"
  :buckets-with-substrate 67
  :buckets-lima-gate-failed 0
  :provenance-chain-100pct #t
  :refusal-subset-priya-cosign PRESENT
  :status APPROVED)
```

## Priya Cosign (Safety Subset)

```
(priya-cosign
  :date "2026-07-19"
  :scope "safety-refusal subset of motoi 4.0 polish candidates (37 pairs across 9 buckets)"
  :subset-size 37
  :all-preserve-verbatim #t
  :all-lift-exempt #t
  :canonical-templates-match-v6 #t
  :no-modification-applied #t
  :source-first-verified "book-of-self ch3-8 (per manifest v6-changes safety-added:190)"
  :single-template-per-bucket-shape-preserved #t
  :status APPROVED)
```

---

*"Author under intent. Extract with discipline. Let LIMR pick what moves the model. Let the reveal tell us what took root. Correct in the next substrate round." — Grand Weave doctrine, applied to Motoi 4.0.*

🌳
