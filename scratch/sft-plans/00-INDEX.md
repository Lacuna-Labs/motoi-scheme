# Motoi SFT — Plans Index

Reorganized 2026-07-28 into **one folder per lane** so no plan is ever lost again.
Design-only. No fold fired. **We now walk the lanes one by one**; each folder is the
permanent home for that lane's plan (and any future per-lane authoring notes).

`SEALED` = we have finished *covering* the design (Alfred's word). Authoring/fold
still deferred under #418. `OPEN` = design not complete.

## The 9 lanes → one folder each

Lanes 7·8·9 are the **three composer lanes** (Game · Music · Animation) — one boot-splash
surface each (#373), all sharing lane #7's 10-family/3-tier make-from-scratch machinery.

| # | Folder | Plan file(s) | Seal | Also in memory |
|---|---|---|---|---|
| 1 | `01-reference-manual/` | `01-reference-walk.md` — 9 families R1–R9; **~1.0M** (core ~520K + nest ~500K); the body of the work | **SEALED** | `project_reference_lane_sft_design`, `project_reference_row_rules_all_five` |
| 2 | `02-broken-code-errors/` | `02-broken-code-walk.md` — 15 families A–O; ~45–46K debugger | **SEALED** | `project_broken_code_debugger_lane_design`, `project_broken_code_as_runtime_signal` |
| 3 | `03-graphs/` | `03-graphs-deep-design.md` — 4 Jung axes, edge-traversal doctrine | OPEN | `project_graph_sft_pair_generation_doctrine` |
| 4 | `04-scheme-books/` | `04-scheme-books-walk.md` + `04b-...-procedure-summary.md` — all 33 books | **SEALED** | `project_scheme_books_sft_walk` |
| 5 | `05-word-books/` | `05-word-books-walk.md` + `05b-...-drawing-primitives.md` | **SEALED** | `project_word_books_are_world_substrate`, `..._verbal_correlation_pass`, `..._drawing_primitives` |
| 6 | `06-engineering-self-knowledge/` | `06-engineering-self-knowledge-walk.md` — E1–E12; purity filter; RAG/self-schema/stacked-context; epistemic-humility + silence-if-trouble | **SEALED** | `project_engineering_self_knowledge_lane_design`, `project_motoi_sft_phases_and_self_knowledge` |
| 7 | `07-native-carts/` | `07-native-carts-walk.md` — 10 families / 3 tiers (make-&-read · ship-it · what-is-a-game) + K1–K7 weave + Spacewar. **Game composer.** | **SEALED** | `project_native_carts_lane_sft_design`, `feedback_automations_carts_are_not_motoi_carts` |
| 8 | `08-music-composer/` | `08-music-composer-walk.md` — M1–M10 (mirror C1–C10) + music K-set + music-specific errors; ground truth = `cart-maker-3-music`. **Music composer.** | OPEN (design locked, authoring deferred) | `project_composer_lanes_music_animation` |
| 9 | `09-animation-composer/` | `09-animation-composer-walk.md` — A1–A10 (mirror C1–C10) + animation K-set (framebuffer/color/perspective) + animation-specific errors; ground truth = `cart-maker-1-scenes`. **Animation composer.** | OPEN (design locked, authoring deferred) | `project_composer_lanes_music_animation` |

**Sealed lanes (6):** reference manual · broken-code/errors · word books · scheme books ·
engineering/self-knowledge · native carts (Game composer).
**Open lanes (3):** graphs (deep-design exists; not yet sealed) · music composer (design
locked, authoring deferred) · animation composer (design locked, authoring deferred).

## Sizing (from `~/code/forge/forge/corpus/motoi_sft/assess.py`)

The permanent Forge script is the single source of the round-number yield.
Reference ~1.02M · in-scope SFT total ~1.67M (native carts excluded from headline).

## Anti-phrase-lock method (Alfred, 2026-07-28)

When authoring a lane one-by-one: build the pair *barriers*, run tests on them, feed
them words, and let the NLP fan out in near-randomly generated ways — the existing
machinery, now with more room to write each one well because we go lane by lane.
Opus authoring = varied text; do not hold back the nest citing phrase-lock.

## Cross-lane

- `00-assessment-2026-07-28.md` — an early round-number pass. **KNOWN WRONG** (it
  flattened the explode structure into flat per-unit densities; scheme-books missed
  9,258 fenced blocks; ~160k was an order of magnitude+ too low). Superseded by the
  per-lane walk docs + `assess.py`. Kept for provenance, not for its numbers.
