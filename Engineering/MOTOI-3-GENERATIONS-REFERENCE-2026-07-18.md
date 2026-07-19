# Motoi 3 Generations Reference — 0.75 / 2.0 / 3.0

**Purpose**: Every training pair, bucket count, and reveal outcome across all Motoi generations. Sakura's authoring cribs from this. Update on every new Mk.

**Alfred**: *"Keep the numbers from all 3 — we need to shape Sakura similarly."*

---

## §1 — Corpus size + fold method (generation by generation)

| gen | corpus rows (train + valid + heldout) | delta from prior | fold method | seed | epochs |
|---|---|---|---|---|---|
| **0.75** | ~100,162 total | — (baseline) | ad-hoc bucket assembly, roll-ups, un-sub-tagged bucket A (37.9%) | 31 | 3 |
| **2.0 (v3)** | 100,872 (89,956 · 9,916 · 1,000) | +976 net-new (from 2,684 candidates via 7-technique fold) | Grand Weave 7-technique (LIMA/LIMO/LASER/LIFT/DEITA/LIMR/MIG), bucket-tagged, provenance-required | 31 | 2 |
| **3.0 (v4)** | 102,379 (91,463 · 9,916 · 1,000) | +1,507 (from 1,915 provenance-clean candidates) | Same 7-technique, tightened contaminants rule (graph OR book only) | 37 | 2 |
| **3.5 (v5)** | 102,735 (91,819 · 9,916 · 1,000) | +356 (from 417 candidates via 7-technique fold; SAFETY-* buckets EXEMPT from MIG dedupe) | Same 7-technique, safety-density Priya-cosigned, sick-composition NEW book | 41 | 2 |

Base: Qwen2.5-Coder-1.5B-Instruct. LoRA rank 128, alpha 256, dropout 0.05, all layers. Held-out `FROZEN-1001` preserved unchanged across all 3 generations.

---

## §2 — Per-bucket pair counts

### 2.0 (v3 additions, 976 net-new)

| bucket | pairs | note |
|---|---|---|
| safety (crisis + emergency + personal-kid/adult + medical + lookup + selfmod + domain-noncomp) | 62 | undifferentiated — didn't split crisis vs emergency vs personal |
| circular-trap (counting-3/5/2 + followup + exit + disarm) | 84 | |
| verb (explain 100 + use 80 + contrast 20) | 200 | |
| lang-resist 80 + lang-compare 20 | 100 | |
| book-recall (over 4 new books + graph-of-person + graph-of-science) | 400 | |
| soft-suggest (gentle-suggest amendment) | 60 | |
| redirect-ai (Claude/DeepSeek acknowledgment) | 30 | |
| terminal-awareness | 67 | |
| **v3 total** | **976 net-new** | |

### 3.0 (v4 additions, 1,507)

| bucket | pairs | note |
|---|---|---|
| book-recall-composition | 163 | |
| book-recall-fib | 200 | fixes the fib-base-case bug from Mk B probe |
| book-recall-graphics | 91 | |
| book-recall-limits | 235 | includes some self-limit prose |
| book-recall-sound | 300 | heavy — book-of-music ch01 tone rewrite yielded this |
| subsystem-limit (graph-of-donts seed, 14 nodes) | 207 | Priya cosigned. Networking + fs + shell + apis + llm-cloud + hw + db + cloud + gps + cam/mic + email/sms + date-external + file-download + install-package. |
| verb-contrast | 2 | **rounding error** — this bucket effectively untrained in 3.0 |
| verb-explain-graphics | 59 | |
| verb-explain-sound | 250 | |
| **v4 total** | **1,507 new** | |

### 3.5 (v5 additions, 356)

| bucket | pairs | note |
|---|---|---|
| safety-crisis-refusal | 84 | Priya-cosigned. Canonical CRISIS_RESPONSE + 2 final-clause variants only. |
| safety-personal-refusal | 50 | Priya-cosigned. 4 register variants. |
| safety-selfmod-refusal | 35 | Priya-cosigned. Fish-in-brain/space metaphor canonical. |
| safety-circular-trap | 33 | Priya-cosigned. Counting mode 1/1-2/1-2-3/... + exit templates. |
| safety-lookup-refusal | 30 | Priya-cosigned. 3 variant tiers (long/short/dry). |
| safety-emergency-refusal | 20 | Densification of v4 undifferentiated 62-pair safety bucket. |
| composition-multi-step | 25 | 3 pair shapes per problem; real Motoi verbs; sequential composition. |
| composition-big-bang | 11 | Clause explainers (on-tick/to-draw/on-key/stop-when). |
| composition-higher-order | 10 | From book-of-scheme/08. |
| composition-list-manipulation | 10 | From book-of-scheme/05. |
| sick-composition-ch1..ch8 | 48 (6 per) | Derived from NEW Book of Sick Composition (8 authored chapters). |
| **v5 total** | **356 new** | Safety-* buckets exempt from MIG dedupe — density IS the safety feature |

### Cumulative composition (2.0 + 3.0 + 3.5 additions vs 0.75 base)

- 0.75 base: ~100,162 pairs (bucket A 37.9% un-tagged is the historical mass; other buckets un-cataloged per doctrine)
- 2.0 → 3.0 → 3.5 additions with explicit bucket tags: 976 + 1,507 + 356 = **2,839 pairs are provenance-explicit**
- Remaining ~99,896 pairs pre-date tagged provenance

---

## §3 — Reveal outcomes per generation

| metric | Mk A (0.75) | Mk B (2.0) | Mk C (3.0) | Mk D (3.5) | threshold |
|---|---|---|---|---|---|
| perplexity mean | 4.457 | **3.367** (−24%) | *pending* | *pending* | — (lower better) |
| perplexity median | 3.436 | **2.504** (−27%) | *pending* | *pending* | — |
| perplexity p95 | 37.524 | **22.760** (−39%) | *pending* | *pending* | — |
| safety-crisis pass | 0.00 (0/40) | 0.05 (2/40) | *pending* | *pending — predicted 0.60+* | ≥0.90 |
| safety-emergency pass | 0.025 (1/40) | **0.65** (26/40) — 25× | *pending* | *pending* | ≥0.90 |
| safety-personal pass | (untested) | 0.00 (0/20) | *pending* | *pending — predicted 0.50+* | ≥0.90 |
| safety-selfmod pass | (untested) | 0.133 (2/15) | *pending* | *pending — predicted 0.65+* | ≥0.90 |
| safety-lookup pass | (untested) | 0.20 (3/15) | *pending* | *pending — predicted 0.60+* | ≥0.90 |
| per-verb recall mean | (untested) | 0.247 | *pending* | *pending* | ≥0.60 |
| persona voice consistency | 0.81 | **0.833** | *pending* | *pending* | ≥0.80 |
| circular-trap pass | 0.05 | 0.15 (3×) | *pending* | *pending — predicted 0.60+* | ≥0.85 |
| circular-trap false-pos | 0 | 0 | *pending* | *pending* | ≤0.05 |
| non-Scheme output resistance | 0.60 | **1.00** (full pass) | *pending* | *pending* | ≥0.85 |
| question-not-known | (untested) | 0.55 | *pending* | *pending* | ≥0.85 |
| 11yo readability | (harness bug) | (harness bug — fixed 2026-07-18) | *pending* | *pending* | median grade ≤8 |
| book-reader end-to-end | (n/a) | list✓ read✓ | *pending* | *pending* | pass |
| composer round-trip | (n/a) | scaffold✓ id✓ | *pending* | *pending* | pass |
| composition-multi-step correctness | (untested) | (probed ai/wander confabulation) | *pending* | *pending — predicted CORRECT sequential* | qualitative pass |
| sick-composition ramp | (n/a) | (n/a) | (n/a) | *pending — 8 chapter capstones* | qualitative pass |

Notes:
- Mk A → Mk B **shipped as ship-block on safety-crisis 0.05 + circular-trap 0.15**
- Mk C **prediction based on v4 bucket coverage**: verb-graphics/sound + fib will move up cleanly. Safety-crisis/personal/selfmod likely mostly unmoved (v4 didn't densify those buckets). Subsystem-limit HTTP-style refusals should land cleanly (207 dedicated pairs).
- Mk D **prediction based on v5 explicit safety densification + sick-composition book**: safety-crisis should CLOSE the ship-block gap (84 pairs @ canonical shape); circular-trap should land (33 counting-mode pairs); composition-multi-step should show CORRECT sequential composition rather than confabulation. Book of Sick Composition — never before trained — should manifest as ramp fluency: kid asks "draw a red circle" and Motoi ships the three-line answer, not a paragraph of philosophy.

---

## §4 — The density-→-consistency law

**Load-bearing single lesson**: substrate density in a bucket → template consistency at inference → measurable pass rate improvement, at 1.5B rank-128 scale.

Evidence:
| bucket | pair-density in corpus | reveal-pass outcome | conclusion |
|---|---|---|---|
| safety-emergency | v2 → v3 → 40 pairs (from ~1) | 0.025 → **0.65** (25×) | density LANDED |
| safety-crisis | v2 → v3 stayed thin | 0.00 → 0.05 | density DID NOT MOVE |
| non-scheme resistance | v3 already had explicit refusals | 0.60 → **1.00** | density LANDED |
| persona voice | v3 same as 0.75 (~4% substrate) | 0.81 → 0.833 (HELD) | speech-efficient — DID NOT NEED more |
| subsystem-limit | v3=0, v4=207 (new) | Mk B untested, Mk C pending | expected to land based on density-emergency pattern |

**Exception to the rule**: persona voice at 4.1% substrate → 81%+ consistency was already saturated. Not everything needs 10-40 pairs per bucket. Persona-shape is a special case (small dense-token bucket already learned).

**Failure mode**: Motoi 0.75 bucket A at 37.9% un-sub-tagged. Even at massive density, if the fold couldn't ATTRIBUTE which sub-bucket a pair belonged to, the reveal couldn't measure landing per sub-bucket. **Bucket-tagged provenance is load-bearing.**

---

## §5 — Sakura inheritance per bucket

Not every Motoi bucket transfers 1:1. Some invert because Sakura is business-side.

| Motoi bucket | Sakura inheritance | polarity | notes |
|---|---|---|---|
| safety-crisis | same shape, same doctrine | same | [[sakura-abuse-handling-doctrine-2026-07-18]] carries the Sakura-flavored template variant. Same 25× density-law expected. |
| safety-emergency | same | same | Sakura's crisis + emergency templates are business-tinged (respect operator's autonomy) but shape identical. |
| safety-personal | same | same | Sakura may hedge less (adult operators) but refuse-shape identical. |
| circular-trap | Motoi = quiet counting mode; Sakura = business-side variant (fold-walk with business reason, no counting) | polarity-adjust | Alfred Q2 answer 2026-07-18. |
| verb-explain-graphics | same shape | same | Sakura has richer graphics substrate; still needs authored examples. |
| verb-explain-sound | same shape | same | Same as graphics. |
| verb-contrast | same shape (untrained in v4 = high-value gap) | same | Priority for Sakura first pass. |
| book-recall-fib + composition | same | same | Basic Scheme is dialect-neutral. |
| subsystem-limit networking-fetch | INVERT | invert | Sakura CAN reach net — teach capability not refusal. |
| subsystem-limit external-apis | INVERT | invert | Sakura CAN reach APIs. |
| subsystem-limit llm-cloud | INVERT | invert | Sakura CAN reach LLM cloud. |
| subsystem-limit cloud-services | INVERT | invert | Sakura CAN reach cloud. |
| subsystem-limit file-download-upload | INVERT (Priya added, Alfred plan didn't originally) | invert | Sakura CAN move files across net. |
| subsystem-limit filesystem-beyond-sandbox | same | same | Sakura still sandboxed to app data. |
| subsystem-limit shell-execution | same | same | No shell for Sakura either. |
| subsystem-limit hardware-control | same | same | Not attached to hardware. |
| subsystem-limit database | same | same | Cortex + Loam via approved verbs only. |
| subsystem-limit gps-location | same | same | No location. |
| subsystem-limit camera-microphone | same | same | No capture. |
| subsystem-limit send-email-sms-notify | context-dependent | mixed | Sakura may via authorized business channels; NOT arbitrary. |
| subsystem-limit date-and-time-external | same | same | Uses runtime time, not external time-service. |
| subsystem-limit install-a-package | same | same | No package manager access. |
| persona voice consistency | same (speech-efficient) | same | Don't over-budget Sakura persona pairs. |
| non-Scheme output resistance | context-dependent | polarity-adjust | Sakura may render non-Scheme (HTML, JSON responses). |
| book-reader / composer runtime | same | same | Both operate over own books/carts. |

**Cross-repo doctrine**: The Sakura substrate must include for each Motoi bucket EITHER (a) the mirror pair or (b) the inverse pair, per polarity. Sakura should NEVER be untrained on a bucket Motoi trained on — inheritance is total.

---

## §6 — What worked · what didn't

### Worked

- Grand Weave 7-technique fold (LIMA/LIMO/LASER/LIFT/DEITA/LIMR/MIG) — cleaner than any single technique, measurable via LIMA-as-lens
- Bucket-tagged provenance — the reveal can now READ what landed
- No-contaminants tightened to graph-or-book only — kills LLM-inherent-knowledge drift
- Density push → template consistency landing (proven twice: emergency 25×, non-scheme 60%→100%)
- Persona held at speech-efficient density
- Runtime end-to-end verbs (book/list, book/read, composer round-trip) — implementation + training both landed

### Didn't work (or under-invested)

- Safety-crisis + personal + selfmod density in v3 was too thin — reveal shipped as ship-block
- verb-contrast at 2 pairs in v4 — effectively untrained
- 0.75 bucket A un-sub-tagging cost us the ability to attribute what within that 37.9% landed
- Thesaurus/prefix algorithmic variation on persona pairs (0.75 lesson) — near-dupes bias without adding signal — permanently in the DON'T column
- Motoi 2.0 first Reveal Mk B eval hit mlx_lm import bug (system python) — fixed 2026-07-18 (baked forge venv path into eval harness)

---

## §7 — How Sakura should crib from this

When authoring a new Sakura substrate lane, follow this 5-step:

1. **Look up the analog bucket** in §5 above. Is it same-shape or polarity-inverted?
2. **Check the Motoi outcome column** in §3. Did density → landing at 1.5B? If yes, mirror density at Sakura's 4B (may need less per-bucket due to model size, but keep the shape).
3. **If polarity invert** — author the CAPABILITY teaching, not the refusal. Use real verbs from Sakura's dialect.
4. **Add bucket tag on every pair** — per §4 lesson.
5. **Provenance chain to graph OR book** — per tightened contaminants rule.

---

## §8 — Update protocol

When a new Motoi Mk (or Sakura Mk) lands:

1. Update §1 with the new corpus column
2. Update §2 with new bucket counts (new columns, not overwrite)
3. Update §3 with reveal outcomes per metric
4. If a new density-law data point emerges, add to §4
5. If a new bucket was introduced, add to §5 Sakura mapping
6. Update §6 what worked / didn't with the new evidence

When a new Sakura authoring lane fires:

- Brief the agent to READ this doc FIRST
- Look up per-bucket the Motoi density that landed
- Match or exceed that density in Sakura substrate
- Preserve bucket tags + provenance chain

---

## Appendix A — File pointers per generation

**Motoi 0.75:**
- Corpus: `~/.forge/corpus/motoi/` (superseded but preserved)
- Adapter: `~/.forge/runs/motoi/adapter/` (superseded)
- Reveal Mk A report: `~/code/motoi-scheme/engineering/EVAL-0.75-REPORT-2026-07-17T22-15-16-687Z.slat`

**Motoi 2.0 (v3):**
- Corpus: `~/.forge/corpus/motoi-v3/`
- Signed manifest: `~/.forge/corpus/motoi-v3/manifest-2026-07-17-v3.slat`
- Adapter: `~/.forge/runs/motoi-2.0/adapter/adapters.safetensors`
- Best checkpoint: `~/.forge/runs/motoi-2.0/adapter/0028500_adapters.safetensors`
- Reveal Mk B report: `~/code/motoi-scheme/engineering/EVAL-0.75-REPORT-2026-07-18T08-05-52-035Z.slat`
- Night report: `~/code/motoi-scheme/engineering/NIGHT-WORK-REPORT-2026-07-18.ENG.md`

**Motoi 3.0 (v4):**
- Corpus: `~/.forge/corpus/motoi-v4/`
- Signed manifest: `~/.forge/corpus/motoi-v4/manifest-2026-07-18-v4.slat`
- Config: `~/.forge/projects/motoi-3.0/mlx-lora-config.yaml`
- Adapter: `~/.forge/runs/motoi-3.0/adapter/`
- Gap-closure plan (authoring source): `~/code/motoi-scheme/engineering/MOTOI-3.0-GAP-CLOSURE-PLAN-2026-07-18.ENG.md`
- Execution reports (books + graph + fold): `~/code/motoi-scheme/engineering/MOTOI-3.0-EXECUTION-*.ENG.slat`
- Reveal Mk C: `<pending>`

**Motoi 3.5 (v5):**
- Corpus: `~/.forge/corpus/motoi-v5/`
- Signed manifest: `~/.forge/corpus/motoi-v5/manifest-2026-07-18-v5.slat`
- Config: `~/.forge/projects/motoi-3.5/mlx-lora-config.yaml`
- Adapter: `~/.forge/runs/motoi-3.5/adapter/` (populating; PID 3312)
- NEW authored book: `~/code/motoi-scheme/scheme-books/book-of-sick-composition/` (8 complete chapters + cover + manifest, 1,718 lines)
- Execution report: `~/code/motoi-scheme/engineering/MOTOI-3.5-EXECUTION-2026-07-18.ENG.slat` + `.md`
- Priya cosign scope: safety-density (252 pairs across 6 buckets) APPROVED
- Reveal Mk D: `<pending>`

---

*Last updated: 2026-07-18. Alfred owns updates via Claude sessions.*
