"""Augmentation layers — each takes a list of pairs and expands it.

Composition order (main.py wires this):
  1. hand_authored  — identity, honest-null, dialogues, character, turing-witt, etc.
  2. audience       — k-PhD register rewriter (kid/adult/PhD variants)
  3. lacan          — metaphor + metonymy paraphrase (2 additional variants per pair)
  4. short_direct   — long-scaffold → short-direct counterparts
  5. contrastive    — plausible-wrong + correction pairs for central concepts

After augmentation:
  6. centrality Zipfian oversampling (existing)
  7. interleave + spread (existing)
"""
