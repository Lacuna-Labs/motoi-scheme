# Motoi 5.0 — pre-fold checkpoint

**Date:** 2026-07-19
**Author:** Claude (per Alfred, "verifying data EVERY step of the way")
**Status:** substrate authored + verified on disk · awaiting your sign-off to fold + retrain

---

## What happened

You said stop the 4.5 training, add compositions + games + music + IDE knowledge, verify every step, start over as 5.0. That's what landed. 46 min of 4.5 training sunk (fair — the model would have shipped without composition literacy). 7 parallel authoring lanes fired. All landed clean.

## Totals — disk-verified

**858 new training pairs**, distributed across 9 files. All provenance-tagged (`_meta._source`). No fabrication.

| File | Rows | SHA-16 |
|---|---:|---|
| `ai-tech-history-cards-2026-07-19.jsonl` | 396 | `ca126a2e134a1712` |
| `book-of-ml-pair-voice-2026-07-19.jsonl` | 208 | `e13e0682d24c6ac3` |
| `ide-teaching-2026-07-19.jsonl` | 63 | `a0e623d18a8bece8` |
| `book-of-jesse-frames-buffered-2026-07-19.jsonl` | 34 | `02eac76812d71f2f` |
| `cart-maker-1-scenes-2026-07-19.jsonl` | 44 | `bcb969aa75330d13` |
| `cart-maker-2-games-2026-07-19.jsonl` | 26 | `4c7eda10898bc099` |
| `cart-maker-3-music-2026-07-19.jsonl` | 23 | `374e53dfa5b08340` |
| `cart-maker-4-interactive-2026-07-19.jsonl` | 23 | `c358cc87a278ad3f` |
| `cart-maker-5-hybrid-2026-07-19.jsonl` | 41 | `f9b125ec0c7360e3` |
| **TOTAL** | **858** | |

Location: `~/.forge/corpus/motoi-v8-partial/`

## Carts on disk

**26 runnable `.scm` carts**, one `.out.txt` per cart (verified exit 0). Located at `~/code/motoi-scheme/carts/cart-maker-{1..5}-*/`.

Spot-check re-run of 3 random carts this pass — all still clean:
- `house-on-a-hill.scm` → "House on a Hill — drawn."
- `twinkle-melody.scm` → 42-note Twinkle melody
- `dance-party-visualizer.scm` → 8 kicks landed, 32 frames

## Book of Jesse — Chapter 17 "Frames Buffered"

`scheme-books/book-of-jesse/17-frames-buffered.book.slatl` (510 lines)
10 examples: house, moon-over-hills, flag, face, bouncing-ball, rain, tone-as-shape, catch-the-pixel, sunrise, small-demo. Every example verified runnable. All 8 aliases distributed across the chapter (`rectangle` · `pixel` · `put-pixel` · `filled-rectangle` · `set-pixel!` · `fill-rect` · `draw-rect` · `plot-pixel`).

## Runtime additions — additive-only

**Zane audit** (`engineering/RUNTIME-AUDIT-FB-MUSIC-2026-07-19.ENG.md`) wired 3 aliases:
- `background`, `bg-clear` → `clear`
- `draw-text` → `fb/text`

**My follow-up on Zane's questions** (6 more additive verbs):
- `sleep-ms N` — blocking ms pause (kids type "wait"; the tagged-clause `wait` doesn't block — this is the honest form)
- `print`, `println` — familiar from Python/Racket (delegate to `display`)
- `kick`, `snare`, `hat`, `crash`, `clap` — bare percussion verbs that dispatch to `synth/kit`

All 605 tests green after both waves.

## What I left for you to decide

Zane's audit surfaced 2 pedagogy questions I didn't answer:

1. **Bare `beat` form** — `beat/on` exists (installs a handler). `(beat)` bare has no clean mapping. Options: (a) return current beat-clock counter, (b) install a default handler, (c) leave unbound. I left it unbound. Your call.
2. **Bare `song` form** — same shape. Left unbound.

Also **`sprite`** — registered but pushes to an accumulator without rendering to the framebuffer directly. Ada substituted primitive shapes; not a blocker but worth deciding for later chapters.

## Sample pairs (one from each lane)

**Book of Jesse Ch 17:**
> user: "How do I draw a house?"
> motoi: "Start with `(begin-frame)`. Then `(fill-rect 20 40 20 20)` for the wall. `(rectangle 20 40 20 20)` outlines it. Roof: two `line`s. Door: `(fill-rect 27 50 6 10)`. Window: `(pixel 24 45)` for a bright spot. Finish with `(end-frame)`."

**Scenes (Cart Maker 1):**
> user: "Draw a lighthouse."
> motoi: [full 149-line cart with animated 6-frame sweeping gold beam]

**Games (Cart Maker 2):**
> user: "Write pong."
> motoi: [full cart with 2 paddles as entities, ball, top/bottom bounce, AI chase — 5-tick bounded]

**Music (Cart Maker 3):**
> user: "Play Twinkle Twinkle."
> motoi: "42 notes in C major at 100 BPM. Three phrases via raw `note` sequencing."

**Interactive (Cart Maker 4):**
> user: "How do I make clicking draw a dot?"
> motoi: "`(on-mouse (lambda (x y) (disc x y 3)))`. Set up handler, dispatch real events via `fire-mouse` or the IDE's mouse loop."

**Hybrid (Cart Maker 5):**
> user: "How do I make snake play a note when it eats?"
> motoi: "In the eat branch of the tick, call `(note (list-ref pentatonic (modulo score 5)) 0.15)`. The tone runs alongside the game state update."

**IDE-teaching:**
> user: "How do I get help on a verb?"
> motoi: "Type `,help <name>` in the REPL. I return a colored card with the docstring, signature, arity, examples."

**AI-tech cards:**
> user: "What is MCP?"
> motoi: "Model Context Protocol. Anthropic introduced it in late 2024 as a standardized way for AI systems to talk to tools and data sources. Like USB for AI."

## What happens next (waiting on your green light)

1. **You review this doc** — say yes/no to the pedagogy calls + green-light the fold.
2. **Fold**: I concatenate the 9 new v8-partial JSONL files into v7 base (100,215 rows kept after wave6 cull) → v8 total ~101,073 rows.
3. **Pre-fold data check**: bucket density, dedup, no-old-template safety verification. Same rigor as v7 assembly.
4. **Post-fold data check**: SHA seal, row count, sample re-read.
5. **Motoi 5.0 SFT fires** — same 3-epoch config, new seed (61 or 67 — next odd prime in rotation), corpus v8.
6. **Mk G raw eval** at completion.
7. **Seven-technique polish fold** (proper this time).
8. **Polish resume-train**.
9. **Mk G polished eval**.
10. **Final report + push-notify**.

Wall estimate: fold ~5 min, SFT ~5-6h, polish + finish move ~2h. Report by evening if you green-light in the next hour.

## Where the composition gap stood before

44 composed scenes in v7. **After v8 fold, ~200 composed scenes** (26 new carts × ~5 pairs each of composition-teaching content, plus the 34 chapter pairs, plus the 128 pair-programming pairs — cross-referenced counts). Density-of-composition rises from 0.04% to ~0.20% — right at the cliff, might need a v9 pass if we want it comfortably above.

## Ready when you are

🌳
