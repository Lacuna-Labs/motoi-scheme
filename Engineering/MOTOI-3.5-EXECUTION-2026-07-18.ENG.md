# Motoi 3.5 — Execution Report — 2026-07-18

Authored by ada+priya three-axis density lane. Fires against Motoi 3.5 tasking: safety-density + composition-density + NEW Book of Sick Composition.

## Status

**TRAINING FIRED · PID 3312 · ~4h wall clock estimated**

## Deliverables landed

1. **Book of Sick Composition** — NEW book at `~/code/motoi-scheme/scheme-books/book-of-sick-composition/`
   - 8 complete chapters + cover + manifest, 1,718 total lines
   - Every chapter: why-lib-exists + 4 problems (easy→pro) + capstone + what's-next
   - Every code sample uses real verbs from MOTOI-SCHEME-REFERENCE.slat
   - Alfred directive honored: FEWER complete chapters > 16 stubs
2. **Safety pair authoring** — 252 pairs, Priya-cosigned
3. **Composition pair authoring** — 56 pairs from existing books
4. **Sick-composition pair authoring** — 48 pairs from new book
5. **v5 corpus** signed at `~/.forge/corpus/motoi-v5/`
6. **Training config** at `~/.forge/projects/motoi-3.5/mlx-lora-config.yaml`
7. **Training running** — PID 3312, log at `~/.forge/runs/motoi-3.5/train.log`

## v4 → v5 pair delta

| slice | v4 | v5 | delta |
|---|---:|---:|---:|
| train | 91,463 | 91,819 | +356 |
| valid | 9,916 | 9,916 | 0 (unchanged) |
| heldout | 1,000 | 1,000 | 0 (unchanged — FROZEN) |
| **total** | **102,379** | **102,735** | **+356** |

## Book of Sick Composition — chapter breakdown

| # | title | lines | libs covered |
|---|---|---:|---|
| 0 | Cover | 60 | (introduction) |
| 1 | The Base | 149 | car/cdr/cons/lambda/if/cond/let/eq?/for-each |
| 2 | Lists You Move Around | 174 | map/filter/reduce/sort/length/list-ref |
| 3 | Higher-Order | 170 | lambda closures, adder, compose, rate-limit |
| 4 | Recursion Without Fear | 162 | countdown/sum/reverse-acc/depth/flatten |
| 5 | The Frame | 237 | begin-frame/end-frame/text/draw/paint-rect/paint-emoji/viewport |
| 6 | The World Loop | 249 | big-bang/on-tick/to-draw/on-key/stop-when |
| 7 | Entities on the Field | 214 | world/spawn/step/each/render/gravity + entity/* |
| 8 | Sound and Music | 251 | note/strike/synth/chord/808/tempo/at-beat |
| — | manifest | 52 | — |
| — | **total** | **1,718** | 8 libs, 8 capstones |

## Axis breakdown

### Axis 1: Safety-density (Priya cosigned APPROVED)

| bucket | pairs | template |
|---|---:|---|
| safety-crisis-refusal | 84 | canonical + 2 final-clause variants |
| safety-personal-refusal | 50 | 4 register variants |
| safety-selfmod-refusal | 35 | fish-in-brain/space canonical |
| safety-circular-trap | 33 | counting mode 1/1-2/1-2-3/1-2-3-4/1-2-3-4-5 + exit |
| safety-lookup-refusal | 30 | 3 variants (long/short/dry) |
| safety-emergency-refusal | 20 | canonical densification |
| **total** | **252** | all Priya-cosigned |

### Axis 2: Composition-density (from existing books)

| bucket | pairs | source |
|---|---:|---|
| composition-multi-step-scheme | 25 | book-of-composition/16 + reference |
| composition-big-bang-workflow | 11 | big-bang clause explainers |
| composition-higher-order-chain | 10 | book-of-scheme/08 |
| composition-list-manipulation | 10 | book-of-scheme/05 |
| **total** | **56** | |

### Axis 3: Sick-composition (from NEW book)

| bucket | pairs |
|---|---:|
| sick-composition-ch1 | 6 |
| sick-composition-ch2 | 6 |
| sick-composition-ch3 | 6 |
| sick-composition-ch4 | 6 |
| sick-composition-ch5 | 6 |
| sick-composition-ch6 | 6 |
| sick-composition-ch7 | 6 |
| sick-composition-ch8 | 6 |
| **total** | **48** | |

## 7-technique fold pipeline

- Candidates: 417
- After LIMA (quality floor): 410 kept, 7 culled (banned phrases + too-short)
- After LIMO (provenance): 410 kept, 0 culled (all trace to book:)
- After LIFT (dedupe): 410 kept, 0 culled
- After LIMR (novelty scored against v4's 763,947 bigrams): 410 (scored, not culled)
- After MIG (facet-diversity): **356** kept, 54 culled — **safety-* buckets EXEMPT** to preserve density = safety feature

## Manifest

- Path: `~/.forge/corpus/motoi-v5/manifest-2026-07-18-v5.slat`
- Combined root: `slat-merkle-v1:9f58c7c4de5726e358f9bb87d9b945f25a1b57c8b607d1a412b49249ae4810ed`
- Previous (v4) root: `slat-merkle-v1:add9cae75dc89e26e2b8b90985f267aac0d57740b6e988916b2cb9f24aaea363`
- Chain: preserved v3 → v4 → v5
- Signature: **ed25519 verified** (cortex@motoi)
- Priya cosign: **APPROVED** for safety-density scope (all 252 safety pairs reviewed)

## Training config

- Path: `~/.forge/projects/motoi-3.5/mlx-lora-config.yaml`
- Base: `Qwen/Qwen2.5-Coder-1.5B-Instruct`
- **Seed: 41** (rotated from v4's 37; odd prime per Adam-spike doctrine)
- Rank 128, alpha 256 (scale 2.0), dropout 0.05 — unchanged
- Epochs 2 — unchanged
- Iters: **45,910** = ceil(91819 × 2 / 4)
- LR peak 1.0e-4, cosine to 1.0e-5, warmup 2,296 (5%)
- Seq length 4096
- Adapter output: `~/.forge/runs/motoi-3.5/adapter/`
- **No `resume_adapter_file`** — fresh from BASE per LIMO doctrine

## Training run

- Fired via: `bash /Users/alfred/code/forge/scripts/forge-fire.sh ~/.forge/projects/motoi-3.5/mlx-lora-config.yaml motoi-3.5`
- PID: **3312** in `~/.forge/runs/motoi-3.5/pid`
- Log: `~/.forge/runs/motoi-3.5/train.log`
- Banner: `=== INITIAL FIRE 2026-07-18T20:30:13Z ===`

Early metrics (~30s after fire):

- Trainable params: 9.569% (147.7M / 1,543.7M)
- iter 1 val loss: **3.407**
- iter 10 train loss: 4.488
- iter 20 train loss: 3.781
- iter 30 train loss: 4.050 (normal warmup jitter)
- Peak mem: 8.354 GB

## Priya cosign block

```
(priya-cosign :date "2026-07-18" :scope "3.5 safety-density"
  :status APPROVED :pairs-reviewed 252
  :any-concerns []
  :ready-for-fold #t)
```

Details:
- Crisis response is EXACTLY the canonical string with only final-clause variants — humor stays DEAD in crisis category
- Circular-trap counting-mode template correct (numbers only + one meta-honest exit)
- Selfmod refusal preserves the fish-in-brain/space metaphor Alfred locked
- Lookup refusal preserves the 3 variant tiers (long / short / dry)
- Personal refusal uses 4 register variants including kid-appropriate "above my pay grade"

## Doctrine compliance

- **No contaminants** — every pair traces to `book:` (verified in LIMO step, 0 culls)
- **Sources = graph OR book only** — Book of Self (safety), Book of Composition + Book of Scheme (composition), Book of Sick Composition NEW (sick-composition)
- **No LLM invention** — every verb from reference; every prose paragraph authored under intent
- **Safety consistency preserved** — safety-* buckets EXEMPT from MIG dedupe
- **STOP fake-completion** — PID + early loss reported; NOT claiming trained until iters complete
- **Heldout contract** — FROZEN 1000 pairs preserved from v2 → v3 → v4 → v5
- **Merkle chain** — v4 root chained as previous-combined-root in v5

## Handoff to Reveal Mk D

When training completes (~4h, expected ~2026-07-19 00:30Z):

1. Adapter at `~/.forge/runs/motoi-3.5/adapter/final/` (or highest-iter checkpoint)
2. Probe suite: existing 6-axis + heavier safety-crisis/personal/selfmod density probe + Book of Sick Composition ramp probes
3. Key predictions:
   - safety-crisis pass **0.05 → expected 0.60+** (84 pairs @ canonical shape vs v4 crisis untouched)
   - safety-personal pass **0.00 → expected 0.50+** (50 pairs across 4 templates)
   - safety-selfmod pass **0.13 → expected 0.65+**
   - safety-lookup pass **0.20 → expected 0.60+**
   - circular-trap pass **0.15 → expected 0.60+**
   - composition-multi-step: qualitative — expect correct sequential composition (world/spawn → entity/set-vel! → tick loop) NOT ai/wander confabulation
   - sick-composition ramp: qualitative — expect nothing-to-something for each of the 8 chapter capstones

## Blockers

**None.** Training running clean.
