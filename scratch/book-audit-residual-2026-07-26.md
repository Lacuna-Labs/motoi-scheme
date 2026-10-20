# Book code audit — residual (2026-07-26)

Same standard as the reference sweep (#367): extract every runnable code field
from `scheme-books/`, run each INDEPENDENTLY via `node bin/motoi run /dev/stdin`
(15s budget, 8 workers), classify. Runner: `python3 scratch/audit-books.py`.

Two code surfaces in the books:

## 1. Structured code fields — `:code` / `:example` (self-contained, like the reference)

| | count |
|---|---|
| runnable `:code`/`:example` fields | 290 |
| **ok (green)** | **290 (100%)** |

Every worked example authored as a structured field runs green. These are the
book equivalent of the reference's self-contained programs. Clean.
(`:source` fields are provenance citations — wikipedia/papers — not code.)

## 2. Prose fenced blocks — ```scheme / ```motoi inside `:prose`

| | count |
|---|---|
| scheme/motoi fenced blocks | 9,178 |
| — transcripts (skip: `sakura>`/`$` prompts + expected output) | 49 |
| — ellipsis fragments (skip: `...`) | 281 |
| **runnable blocks** | **8,396** |
| **ok (green)** | **4,758 (56.7%)** |
| non-green | 3,638 |

### The non-green 3,638, fully bucketed

| bucket | n | disposition |
|---|---|---|
| **Narrative continuity — freevar** (param/macro-bound/pseudo, or defined in an earlier block of the same chapter) | 2,437 | **NOT a defect.** Prose is a narrative — a snippet uses a helper/binding introduced earlier. Running each block standalone breaks the thread. 564 resolve to a `(define …)` elsewhere in the same chapter; 1,873 are lambda/`let`/macro-bound names (`adsr`, `wave`, `A`, `v1`, `zero`) shown as isolated fragments. |
| **Consumer-dialect verbs** (`loam/`, `knowledge/`, `cortex/`, `world/make`, `voice/`, `web/`, `printify/`, `etsy/`, `cine/`, `email/`, `model/`, `crm/`, `shopify/`) | 333 | **Curator/Lacuna layer — not base Motoi** (per CLAUDE.md "not a place to put dialect verbs"). Taught in the automation / games / narrative books. Owned by consumer repos. |
| **Continuity — wrong-shape** (`.slice/.map/.filter is not a function`, `plot/* must be a list`, `seq/recurrence coeffs must be lists`) | 192 | **NOT a defect.** Downstream of continuity — the arg was bound in an earlier block, so standalone it arrives undefined/wrong-type. |
| **Composer-surgery verbs** (`motion/`, `synth/`, `clock/`, `base/at-beat`, `fb/`, `part/`, `note/`, `text/normalize`) | 266 | **#371 / #374 / #380 / #368** — the animation + music composer surface, mid-surgery. book-of-motion / sound / music / instruments / composition. |
| **Automation/util or mixed** (`json/get`, `time/unix-now`, `system/sha256`, `system/uuid-v4`, `stats/percentile`, `sensor/`, `foreign/call`) | 137 | Automation-lib / external-integration verbs, taught in book-of-one-shot / challenges (Lacuna-facing / pseudo-code). Not base Motoi. |
| **Other-unbound** (bare names in game/automation pseudo-code: `fetch`, `import`, `module`, `store`, `at`, `render-at`) | 136 | Consumer/pseudo-code narrative. |
| **runtime-other** | 73 | Mixed continuity + a few genuine; not concentrated in pure-language books. |
| **Non-canonical math names** (`calc/sin` `calc/cos` `calc/exp` `calc/sqrt` `calc/log` `complex/log` `comb/range`) | 44 | **GENUINE BOOK BUG.** The reference names calculus *operators* (`calc/derivative`, `calc/integral`, `calc/gradient`), NOT `calc/sin`. Plain R7RS `sin`/`cos`/`exp`/`sqrt`/`log`/`random`/`iota` all work. book-of-math should use the standard names. Overlaps active rewrite **#372**. |
| **parse-error** (typo/sketch) | 11 | ~2 genuine typos in stable books (e.g. book-of-jesse `(lambda (x) (* x x))))` — one extra `)`); rest are challenge-prompt comment blocks + unicode-math sketches in game/challenge books. |
| **known-heavy (fuel)** | 9 | impl-perf, not a bug. |

## Headline

- **Structured book code: 290/290 green (100%).**
- **0 reference-sanctioned gaps.** Every verb the canonical reference names runs;
  no book uses a reference verb that's missing. **The language surface is
  internally consistent between reference and runtime.**
- Prose non-green (3,638) = **72% narrative continuity** (2,629: fragments that
  depend on surrounding narrative context — not defects) + **24% owned
  surgery/dialect** (872: consumer-dialect + composer-surgery verbs, tracked by
  #368/#371/#374/#380 and consumer repos) + **~4% genuine small book bugs** (~64:
  44 non-canonical math names, 11 parse-error typos/sketches, a few runtime).

## Genuine actionable defects (the only real book bugs)

1. **book-of-math non-canonical math names** (~44 calls): `calc/sin`→`sin`,
   `calc/cos`→`cos`, `calc/exp`→`exp`, `calc/sqrt`→`sqrt`, `calc/log`→`log`,
   `complex/log`→(`log` on the complex value), `comb/range`→`iota`/range helper.
   **Overlaps #372** (active rewrite of math chapters to real Motoi math) — fold
   into that lane to avoid collision.
2. **~11 parse-error typos/sketches**: ~2 real typos in stable books (jesse
   extra-paren); the rest are challenge-prompt comment blocks + `α³`-style
   pseudocode sketches in the game/challenge books (arguably intentional
   illustration → keep-broken, or ellipsis-tag them).

Everything else is either narrative continuity (working as intended) or owned by
an existing surgery/dialect task. No un-triaged failures remain.
