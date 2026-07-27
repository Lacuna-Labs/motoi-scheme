"""ISB-SFT — Interleaved-Spaced-Bloom Supervised Fine-Tuning generator.

Full spec: engineering/ISB-SFT-COMPLETE-SYNTHESIS-2026-07-21.ENG.slat
Paper (running title): engineering/PAPER-ISB-SFT-2026-07-21.md

Five composed mechanisms (each is prior art; the composition is novel):
  1. Bloom-6 shapes per central concept (bloom_router.py)
  2. Zipfian centrality oversampling (centrality.py)
  3. Interleaving at JSONL write (interleave.py)
  4. Philosopher-shape overlay tags (philosopher_tag.py)
  5. Spaced-repetition via duplicate spread (spacing.py)

Extractors walk the substrate:
  - extractors/reference.py — 1,125 verbs × 5 rows × eng/math/cs discipline
  - extractors/graph.py     — 962 T1 + 3,754 T2 + 19,895 T3 nodes × 20+ fields
  - extractors/book.py      — 861 chapters × per-book-type router (6 types)
  - extractors/cart.py      — 1,285 wired carts × 15 shapes each

Preflight validates the synthesis actually landed (not just the numbers):
  - Bloom coverage on central-500 concepts
  - Philosopher-shape coverage across all 16
  - Centrality-Zipfian actually applied (top-500 appear ≥3× in dataset)
  - Interleave verified (no 3 consecutive pairs from same concept)
  - Contrastive ≥12% of total
  - Long/short mixture within 30-70/70-30 window

If ANY preflight gate fails → training does not fire. Alfred sees the failure.
"""
