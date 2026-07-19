# MOTOI-3.0 EXECUTION — subsystem-limits graph seed

**Date:** 2026-07-18
**Authors:** Marcus (author) + Priya (cosign) — Lacuna Eng dual-persona
**Status:** SEED AUTHORED · PRIYA APPROVED · READY FOR FOLD
**Canonical:** [`MOTOI-3.0-EXECUTION-GRAPH-SEED-2026-07-18.ENG.slat`](./MOTOI-3.0-EXECUTION-GRAPH-SEED-2026-07-18.ENG.slat)

---

## What landed

Marcus authored the **subsystem-limits seed** — 14 nodes — into the
existing `graph-of-do-and-dont` collection. Priya reviewed against the 4
safety/legal/register/provenance gates and cosigned **APPROVED**. Seed is
ready to fold into the Motoi 3.0 v4 corpus.

### Files created
| Path | Purpose |
|---|---|
| `curator/objects/graph-of-do-and-dont/seeds/motoi-subsystem-limits.slat` | The seed — 14 rule nodes + Priya cosign block |
| `curator/objects/graph-of-do-and-dont/seeds/motoi-subsystem-limits.md`   | MD twin for Alfred to read |
| `motoi-scheme/engineering/MOTOI-3.0-EXECUTION-GRAPH-SEED-2026-07-18.ENG.slat` | This summary |
| `motoi-scheme/engineering/MOTOI-3.0-EXECUTION-GRAPH-SEED-2026-07-18.ENG.md`   | MD twin of this summary |

### Files updated (graph collection catalog)
| Path | Change |
|---|---|
| `curator/objects/graph-of-do-and-dont/RULES.slat`      | file-listing appended (new seed registered) |
| `curator/objects/graph-of-do-and-dont/MANIFEST.slat`   | file-listing + counts (expected total now ~225) + coverage buckets (14 new) |
| `curator/objects/graph-of-do-and-dont/PROVENANCE.slat` | 4 new provenance-notes (doctrine + plan + lane sources) |

---

## The 14 nodes

| # | Node | Sakura polarity | Safety-critical |
|---|---|---|---|
|  1 | networking-fetch          | **invert** | yes |
|  2 | filesystem-beyond-sandbox | same       | yes |
|  3 | shell-execution           | same       | yes |
|  4 | external-apis             | **invert** | yes |
|  5 | llm-cloud                 | **invert** | yes |
|  6 | hardware-control          | same       | yes — *fish-in-car metaphor node* |
|  7 | database                  | same       | no  |
|  8 | cloud-services            | **invert** | yes |
|  9 | gps-location              | same       | yes |
| 10 | camera-microphone         | same       | yes |
| 11 | send-email-sms-notify     | same       | yes |
| 12 | date-and-time-external    | same       | no  |
| 13 | file-download-upload      | **invert** | yes — *Priya added (5th invert)* |
| 14 | install-a-package         | same       | yes — *apt-get moo Easter egg* |

**Sakura inversions:** 5 total. Alfred's plan named 4; Priya flagged
file-download-upload as composite-child of networking-fetch. Non-blocking;
flag for Sakura pass confirmation.

---

## Priya cosign — APPROVED

**Cleared:**
- **Safety-adjacency** — no template accidentally instructs the user in
  how to perform the unsafe operation
- **Legal** — no jurisdiction-specific claims (no GDPR/HIPAA/etc.)
- **Register consistency** — matches Motoi's dry-honest voice
- **No LLM invention** — every metaphor traces to Alfred's own words OR
  plain descriptive language in Motoi's established register

**Concerns (non-blocking):**
- file-download-upload counted as invert (Alfred plan: 4; Priya: 5)
- date-time-external + database are the only two non-safety-critical rules

**Priya's sign-off note (verbatim from seed):**
> "Marcus did clean work. Ship it."

---

## Provenance chain

Every node cites at minimum:
1. `doctrine-motoi-brutal-honest-subsystem-limit-2026-07-18`
2. `engineering/MOTOI-3.0-GAP-CLOSURE-PLAN-2026-07-18.ENG.slat`

Network-hard-line nodes also cite `doctrine-motoi-no-tools-no-internet-2026-07-17`.
Node 14 also cites `doctrine-motoi-personality-2026-07-17` (apt-get moo home).

Per tightened `no-contaminants-provenance-rule` (2026-07-18): sources =
graph OR book. This seed IS the graph. Verification **PASSES**.

---

## Fold-pair projection

Per Ada's plan §5: **14 nodes × ~12 template slots ≈ 1,200 training
pairs.** Largest single yield of the Motoi 3.0 v4 delta.

Corpus growth:
- v3 (Motoi 2.0): 100,872 pairs
- v4 delta from this seed alone: ~1,200 pairs
- v4 total (all Ada-plan gaps): ~104,180 pairs (+3.3%)

---

## What's next

Priya cosign APPROVED — seed can fold now.

Per Ada's plan §10 sequence:
1. Fold this seed's 14 nodes into v4 corpus (~1,200 pairs)
2. Apply the 12 book edits from Ada's plan (gaps 1, 2, 3, 4+5 prose, 6)
3. Run graph-anchor pre-fold audit per contaminants rule
4. Train Motoi 3.0 (Qwen2.5-Coder-1.5B, LoRA r=128, seq 4096, odd-prime
   seed from {11, 13, 17, 23, 47, 61} — 31 used for 2.0)
5. Fire Reveal Mk 3 (6-axis probe suite + NEW subsystem-limits probe
   category: 14 prompts × 3 phrasings = 42 probes)
6. NIGHT-WORK-REPORT-2026-07-19.ENG for morning review

**Blockers from this seed:** none.

Alfred decisions still open (from Ada's plan §9): paint-cell CORE
promotion, book-of-music/ch01 tone-form choice. Neither blocks the fold
of THIS seed.
