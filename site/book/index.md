---
title: The Book
---

# The Book

Motoi Scheme's book is not one book — it's **twenty mini-books**, each
exactly 16 chapters, each self-contained.

Source: `scheme-books/` in the repo. Manifest: `scheme-books/MANIFEST.json`.

## The library

- **book-of-animation** — motion, easing, timeline
- **book-of-arcade-games** — the arcade genre
- **book-of-challenges** — puzzles + exercises
- **book-of-cs-curriculum** — CS through Scheme
- **book-of-instruments** — synthesis, tone, instrument design
- **book-of-introspection** — knowing the runtime
- **book-of-jesse** — the tutorial narrative
- **book-of-logic** — proofs and predicates
- **book-of-math** — numerics + geometry
- **book-of-modules** — modules (not "extensions"; R6RS convention)
- **book-of-motion** — physics, forces, fields
- **book-of-music** — pitch, rhythm, composition
- **book-of-narrative-games** — story games
- **book-of-one-shot** — one-shot demos
- **book-of-scheme** — the language itself
- **book-of-simulation-games** — simulation genre
- **book-of-slat** — SLAT format + patterns
- **book-of-sound** — audio primitives
- **book-of-systems** — bigger patterns
- **book-of-values** — data structures

## Rendering status

- [ ] Per-chapter renderer (SLAT → MD → VitePress)
- [ ] Living-page hydration (embedded HelloSurface-mini)
- [ ] 24-card library landing page

The books are authored as SLAT + MD in `scheme-books/<book>/`.
A future `scripts/build-book.mjs` will render them; until then,
read the raw sources under `scheme-books/`.
