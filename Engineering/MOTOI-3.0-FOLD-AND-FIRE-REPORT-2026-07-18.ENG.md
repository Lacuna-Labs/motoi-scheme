# Motoi 3.0 — Fold and Fire Report — 2026-07-18

Marcus (infra). Executed against Alfred GO on `MOTOI-3.0-GAP-CLOSURE-PLAN-2026-07-18.ENG.slat` after both authoring lanes (books + graph seed) landed clean.

## Status

**TRAINING FIRED · PID 96119 · ~4h wall clock estimated**

## v3 → v4 pair delta

| slice | v3 | v4 | delta |
|---|---:|---:|---:|
| train | 89,956 | 91,463 | +1,507 |
| valid | 9,916 | 9,916 | 0 (unchanged) |
| heldout | 1,000 | 1,000 | 0 (unchanged — sacred) |
| **total** | **100,872** | **102,379** | **+1,507 (+1.5%)** |

Under Ada's estimate of +3,335 because per-section extraction from `.book.slatl` files yields fewer USE pairs than projected (many H2/H3 sections lack code fences) and the graph seed emitted 207 selected pairs (from 168 sample-instruction + 5-element decomposition) vs the plan's 1,200 projected. Quality > raw count: every selected pair has clear single-heading or single-node provenance.

## 7-technique fold pipeline

- Candidates: 1,939
- After LIMA (quality floor): 1,915 kept, 24 culled (20 too-short, 4 banned)
- After LIMO (provenance-required, `book:` or `graph:` only): 1,915
- After LIFT (whitespace + dedupe): 1,910
- After DEITA / LASER / MIG per-bucket selection: **1,507**

## Bucket breakdown

```
book-recall-composition   163
book-recall-fib           200
book-recall-graphics       91
book-recall-limits        235
book-recall-sound         300
subsystem-limit           207   (Priya cosign scope: all 175 safety-critical)
verb-contrast               2
verb-explain-graphics      59
verb-explain-sound        250
TOTAL                   1,507
```

## Manifest

- Path: `~/.forge/corpus/motoi-v4/manifest-2026-07-18-v4.slat`
- Combined root: `slat-merkle-v1:add9cae75dc89e26e2b8b90985f267aac0d57740b6e988916b2cb9f24aaea363`
- Previous (v3) root: `slat-merkle-v1:f64830a0c0a6234d8bec7d58ad9fd1729094f28484c7da01d2c29197d17de1ae`
- Chain: preserved
- Signature: **ed25519 verified** (cortex@motoi)
- Priya cosign: APPROVED (referenced in manifest; full note in seed file)

## Training config

- Path: `~/.forge/projects/motoi-3.0/mlx-lora-config.yaml`
- Base: `Qwen/Qwen2.5-Coder-1.5B-Instruct`
- **Seed: 37** (rotated from 31 which was v2.0; odd prime per Adam-spike doctrine)
- Rank 128, alpha 256 (scale 2.0), dropout 0.05 — unchanged
- Epochs 2 — unchanged (Lacuna finding: 3 overfits at 1.5B)
- Iters: **45,732** = ceil(91463 × 2 / 4)
- LR peak 1.0e-4, cosine to 1.0e-5, warmup 2,286 (5%)
- Seq length 4096
- Adapter output: `~/.forge/runs/motoi-3.0/adapter/`
- **No `resume_adapter_file`** — fresh from BASE per LIMO doctrine

## Training run

- Fired via: `bash /Users/alfred/code/forge/scripts/forge-fire.sh ~/.forge/projects/motoi-3.0/mlx-lora-config.yaml motoi-3.0`
- PID: **96119** in `~/.forge/runs/motoi-3.0/pid`
- Log: `~/.forge/runs/motoi-3.0/train.log`
- Config symlink: `~/.forge/runs/motoi-3.0/train.cfg` → `mlx-lora-config.yaml`
- Banner: `=== INITIAL FIRE 2026-07-18T19:46:12Z ===`

Early metrics (~30s after fire):
- Trainable params: 9.569% (147.7M / 1,543.7M)
- iter 1 val loss: **2.976**
- iter 10 train loss: 3.957
- iter 30 train loss: 4.657 (normal warmup jitter)
- Peak mem: 8.262 GB

## Blockers

**None.** Training running clean.

Non-blocking notes:
- `forge-fire.sh` cosmetic sed bug: the banner iters display concatenated digits from multiple yaml lines. mlx_lm parsed `iters: 45732` correctly from the yaml — no effect on training.
- Fold selection came in at 1,507, not the 2,500-3,300 plan target. Pool was smaller than estimated (1,939 candidates). If Reveal Mk C shows partial gap closure, a second author-and-fold pass to thicken is straightforward.

## Handoff to Reveal Mk C

When training completes (~4h, expected ~23:45 local from ~19:46 UTC fire):

1. Adapter at `~/.forge/runs/motoi-3.0/adapter/final/` (or highest-iter checkpoint)
2. Probe suite: existing 6-axis + new subsystem-limits (14 × 3 = 42 probes) + fibonacci fix-it + circle draw + middle-C + move-and-stop
3. Compare v3 (Motoi 2.0) vs v4 (Motoi 3.0) probe results — gap-closure verification

If loss curve blows up or subsystem-limits templates don't take: next lane is Micro-Weave polish (1 epoch, LR halved to 5e-5), not a v5 retrain.

## Doctrine compliance

- Grand Weave 7-technique fold applied
- No contaminants — every pair traces to `book:` or `graph:`
- LIMO doctrine: fresh from BASE
- Odd prime seed rotated (31 → 37)
- Held-out contract preserved (1,000 pairs from v2 → v3 → v4 unchanged)
- Valid split preserved (9,916 rows from v3 unchanged)
- Merkle chain preserved (previous-combined-root → v3)
- Manifest signed and verified
- Priya cosign referenced for 14-node subsystem-limit content
- STOP-fake-completion: PID + early loss reported; not claiming "trained" until iters complete
