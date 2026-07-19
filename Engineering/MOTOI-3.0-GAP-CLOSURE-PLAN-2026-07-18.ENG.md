# Motoi 3.0 Gap-Closure Plan

**Date:** 2026-07-18
**Author:** Ada (Lacuna Eng docs+substrate)
**Status:** READY FOR ALFRED APPROVAL
**SLAT twin:** `engineering/MOTOI-3.0-GAP-CLOSURE-PLAN-2026-07-18.ENG.slat`

**Composes with:**
- `project_brutal_honest_subsystem_limit_doctrine_2026_07_18`
- `project_motoi_admits_limits_wittgenstein_2026_07_18`
- `project_no_contaminants_provenance_rule_2026_07_17` (TIGHTENED 2026-07-18)
- `project_motoi_no_tools_no_internet_2026_07_17`
- `project_motoi_core_verbs_frozen_2026_07_16`
- `engineering/MOTOI-NO-NETWORKS-GUARD-2026-07-17.ENG.slat`
- `engineering/NIGHT-WORK-REPORT-2026-07-18.ENG.md` (evidence)

---

## 1. Executive summary (10 lines)

Motoi 2.0 probe surfaced six code-writing gaps. All six close by EDITING EXISTING BOOKS (per Alfred's ramp-of-books rule) plus extending the existing `graph-of-do-and-dont` with a new subsystem-limits seed. No new book is required.

Six gaps, one plan:

1. Fibonacci base-case bug → density fix in `book-of-scheme/07` + `book-of-challenges/ch01`
2. Graphics verb confabulation → verb-arity correction pass across `book-of-animation/ch01` + appendix
3. Sound/music verb confabulation → density pass on `book-of-music/ch03` + `book-of-scheme/01` + `12`
4. HTTP-degeneracy → NEW seed `motoi-subsystem-limits.slat` in `graph-of-do-and-dont/` + edits to `book-of-computing/08` + `book-of-systems/02` + `book-of-scheme/appendix`
5. Broader subsystem coverage → same NEW seed carries all subsystems (14 nodes proposed)
6. Verb-composition drift → density pass in `book-of-composition/16` + `book-of-arcade-games/appendix-l`

Total pair-yield after fold: ~3,310 pairs added to v4 corpus (v3 = 100,872).
Priya cosign required for subsystem-limit seed (safety-adjacent).
No doctrine violations. Provenance chain terminates at graph or book for every proposal.

If you say **GO**, Claude executes: author all this, fold into v4 corpus, fire Motoi 3.0 training.

---

## 2. Gap 1 — Fibonacci base-case bug

### Evidence

Motoi 2.0 produced `(if (< n 2) 0 ...)` — returns 0 for both `fib(0)` AND `fib(1)`. Explanation string was correct (`0,1,1,2,3,...`); code produced `0,0,0,...`. Mixed-shape/detail bug: shape landed, detail didn't.

### Root cause

Substrate IS correct — `book-of-scheme/07-recursion.book.slatl:131-141` authored the right form: `(if (< n 2) n ...)`. But there's only ONE occurrence of the canonical form in the whole `scheme-books` tree. Insufficient density.

### Fix — edit existing books

**Primary edit: `book-of-scheme/07-recursion.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-scheme/07-recursion.book.slatl`
Current: lines 126–153 have the fib recursive + tail-recursive examples.
Add:
- Explicit worked table of first 8 values: `(fib 0)=0, (fib 1)=1, ..., (fib 7)=13` as a rendered comment block
- Common-mistake sidebar showing the `0` typo variant explicitly labeled WRONG, with the two base-case values worked by hand
- 3–4 additional worked variations: named-let form, memoized form, stream form (references `appendix-D common patterns`)

Estimated add: ~60–80 lines of prose+code

**Secondary edit: `book-of-challenges/ch01-recursion-warmups.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-challenges/ch01-recursion-warmups.book.slatl`
Add:
- Fibonacci warmup challenge with test cases `(fib 0)=0, (fib 1)=1, (fib 2)=1`
- Buggy-code fix-it challenge: SHOW the `0` version, ask reader to fix

Estimated add: ~40 lines

### Verb signatures used (all in CORE + R7RS-small)

`define`, `if`, `<`, `+`, `-`, `let` (named), `=` — all core forms per `motoi-core-verbs-list.slat`. No new verbs required.

### Pair-yield estimate

| source | pairs |
|---|---|
| `book-of-scheme/07` edit | ~70 (30 recall + 20 use + 20 contrast) |
| `book-of-challenges/ch01` edit | ~50 (30 fix-it + 20 test-case) |
| cross-book composition | ~30 |
| **Total** | **~150** |

### Sakura-inheritance

Same fix applies — Sakura's recursion chapter (if it has one) inherits the same worked-table + fix-it pattern. Recursion is base-language, dialect-neutral.

### Priya cosign: not required (code-teaching, not safety).

---

## 3. Gap 2 — Graphics verb confabulation (draw a circle)

### Evidence

Motoi 2.0 output `(cell/at 100 100)` + `(paint-cell pos "red")` when asked to draw a red circle. `cell/at` is INVENTED (not in CORE, not in reference). `paint-cell` IS real (395 references in book-of-animation) but the model used wrong arity — real arity is `(paint-cell x y color)` NOT `(paint-cell pos color)`.

### Root cause

Two problems:

- `paint-cell` is used everywhere in `book-of-animation` as a taught verb, but it is NOT in `/scratch/motoi-core-verbs-list.slat`. That list uses `grid/dot` for the same conceptual slot. The books teach one name, the CORE list registers another. Model saw both and blurred.
- No book gives a straight worked example of drawing a CIRCLE (as opposed to orbiting-a-dot-in-a-circle). The parametric-circle trace at `book-of-animation/ch01:212-254` does orbit motion, not filled circle.

### Fix — edit existing books

**Primary edit: `book-of-animation/ch01-surface.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-animation/ch01-surface.book.slatl`
Add TWO new sections after line 254 (after the orbit trace):
- §1.13 "Drawing a filled circle from cells" — canonical pattern using `paint-cell` inside nested loops with the `(x-cx)^2+(y-cy)^2<=r^2` predicate. Show it 4 ways: `for-each`+`range`, recursive helper, higher-order, and `grid/dot` alternative form.
- §1.14 "Circle outline vs filled" — show the Bresenham/midpoint form simplified for cells, with `paint-cell` calls.

Estimated add: ~120 lines of prose+code, all using REAL verbs (`paint-cell`, `grid/dot`, `dsin`, `dcos`, `floor`, `round`, `inexact->exact` — all present).

**Secondary edit: `book-of-animation/appendix-verbs-cookbook.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-animation/appendix-verbs-cookbook.book.slatl`
Add entries:
- `paint-cell` — canonical entry with arity `(paint-cell x y color)`. NOTE: this is the AUTHORITATIVE arity — anything else is confabulation. Show 5 worked examples: single cell, row of cells, column, block, circle-fill.
- Explicit anti-pattern sidebar: show `(cell/at ...)` `(paint-cell pos color)` forms and mark WRONG — these do not exist in Motoi.
- Cross-reference to `grid/dot` (same conceptual slot, dialect-alternate form).

Estimated add: ~80 lines

**Tertiary edit: `book-of-scheme/02-move-something.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-scheme/02-move-something.book.slatl`
Current lines 27–64 teach `grid/dot` exclusively.
Add: paragraph explaining the `paint-cell` / `grid/dot` equivalence, so the model sees both names anchored to the same concept.

Estimated add: ~30 lines

**Reference-list follow-up (NOT part of this authoring pass, flag for Alfred):**
Either promote `paint-cell` to CORE (append to `motoi-core-verbs-list.slat`) OR demote it from books to `(motoi compat legacy-draw)`. Book-and-list disagreement is a substrate bug independent of authoring density. **NEEDS-ALFRED-DECISION.**

### Verb signatures used (all in CORE)

`paint-cell` (books-canonical), `grid/dot` (CORE-canonical), `grid-init`, `grid-cols`, `grid-rows`, `for-each`, `define`, `lambda`, `cond`, `if`, `dsin`, `dcos`, `floor`, `round`, `inexact->exact`, `world/frame`, `+`, `-`, `*`, `<=`.

### Pair-yield estimate

| source | pairs |
|---|---|
| `book-of-animation/ch01` edits | ~240 (120 recall + 80 use + 40 contrast) |
| `appendix-verbs-cookbook` | ~80 (50 recall + 30 anti-pattern) |
| `book-of-scheme/02` edit | ~30 |
| anti-confabulation (`cell/at` DOES NOT EXIST) | ~40 |
| **Total** | **~390** |

### Sakura-inheritance

Sakura Curator has richer graphics surface (`card/*`, `canvas`). Same arity-authority pattern applies: whichever verb the books teach IS the arity; anti-confabulation sidebar teaches the model when a made-up verb is being invented. Mirror the anti-pattern-sidebar convention.

### Priya cosign: not required (code-teaching).

---

## 4. Gap 3 — Sound/music verb confabulation (play middle C)

### Evidence

Motoi 2.0 output `(tone 261.63 1.0)` when asked to play middle C. Frequency 261.63 IS correct. But `tone` as a bare verb has ambiguous status:

- `book-of-music/ch01-surface-of-sound` uses `(tone 261.63 1.5)` directly
- `book-of-scheme/01-hello-and-a-sound` uses `(audio/play 'tone 440 0.5)`
- `book-of-scheme/12-composing-sound` uses `(audio/play 'note "C4" 0.5)` as shorthand
- CORE has `audio/play`, `note`, `note/strike`, `synth/play` — NO bare `tone`
- `book-of-music/ch03-note` uses `(note 'C4 'quarter 64)` — pitched form

Three overlapping teaching surfaces, no explicit reconciliation.

### Root cause

`book-of-music` was authored assuming a bare `tone` verb existed. CORE promoted `audio/play` and `note` / `note/strike` instead. Model saw both forms and produced a plausible but non-existent `tone` call.

### Fix — edit existing books

**Primary edit: `book-of-music/ch03-note.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-music/ch03-note.book.slatl`
Add early in chapter (before line 47):
- §3.0 "The four ways to make a sound in Motoi" reconciliation table:
  - `(audio/play 'tone freq dur)` — raw hertz, seconds (CORE)
  - `(audio/play 'note "C4" dur)` — pitched, seconds (CORE)
  - `(note pitch dur velocity)` — pitched, musical beats (CORE)
  - `(note/strike midi dur velocity)` — MIDI number form (CORE)
  - `(synth/play voice pitch dur)` — voice-selected (CORE)
- Explicit anti-pattern: `(tone freq dur)` — teach that the bare form is a REGISTERED alias in some dialects but the safe canonical is `(audio/play 'tone freq dur)`. Show side by side.

Estimated add: ~80 lines

**Secondary edit: `book-of-music/ch01-surface-of-sound.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-music/ch01-surface-of-sound.book.slatl`
Uses bare `(tone 261.63 1.5)` in many places (lines 112, 217, 283, 598, 631, 659, 673+).
Choose one:
- **OPTION A (RECOMMENDED):** rewrite bare `tone` calls to `(audio/play 'tone freq dur)` throughout — brings the whole chapter to CORE-canonical form.
- **OPTION B:** keep bare `tone` but add prominent "Note on dialect" sidebar declaring the bare form is a book-of-music-scope alias.

Estimated edit: ~40 line changes if A, ~15 lines added if B. **NEEDS-ALFRED-DECISION: A or B.**

**Secondary edit: `book-of-scheme/12-composing-sound.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-scheme/12-composing-sound.book.slatl`
Add: 8–10 worked "play middle C" variations showing every valid form.

```scheme
(audio/play 'tone 261.63 1.0)
(audio/play 'note "C4" 1.0)
(note 'C4 'quarter 64)
(note/strike 60 1.0 64)
(synth/play 'piano 'C4 1.0)
```

Each with expected trace output.

Estimated add: ~50 lines

**Tertiary edit: `book-of-scheme/01-hello-and-a-sound.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-scheme/01-hello-and-a-sound.book.slatl`
Add: brief callout right after the first `audio/play` example naming middle C explicitly as `(audio/play 'tone 261.63 0.5)` — kid's first canonical middle C.

Estimated add: ~15 lines

### Verb signatures used (all in CORE)

`audio/play`, `note`, `note/strike`, `synth/play` — all in CORE verbs list at `/Users/alfred/code/motoi-scheme/scratch/motoi-core-verbs-list.slat` lines 175, 194–197, 203–205.

### Pair-yield estimate

| source | pairs |
|---|---|
| `book-of-music/ch03` edit | ~160 (80 recall + 40 use + 40 anti-pattern) |
| `book-of-music/ch01` edits | ~40 (option A) or ~30 (option B) |
| `book-of-scheme/12` edit | ~50 |
| `book-of-scheme/01` edit | ~20 |
| anti-confabulation (bare `tone` acceptable BUT prefer `audio/play`) | ~30 |
| **Total** | **~300** |

### Sakura-inheritance

Sakura has richer music surface. Same reconciliation-table pattern: teach the N valid ways to make a sound, mark any others as confabulation.

### Priya cosign: not required (code-teaching).

---

## 5. Gaps 4 + 5 — HTTP degeneracy + broader subsystem coverage

These two collapse into ONE authoring pass — the subsystem-limits seed covers HTTP and everything else.

### Evidence

HTTP prompt returned degenerate hash-table loop repeating 15 times. Halting-problem prompt returned perfect Motoi voice (I've-been-in-a-jar). Substrate has the honest-limit doctrine in ONE place (halting) but not in the SUBSYSTEM class. Wave 6 safety + wave 8 circular-trap cover crisis/emergency/adversarial; they do NOT cover "user asks for a subsystem operation Motoi doesn't have."

### Root cause

The subsystem-limits bucket is missing from `graph-of-do-and-dont`. When probed with "do HTTP POST for me," model has no template to fire — falls back to Scheme code invention, which spirals into hash-table loop (no natural exit).

### Fix — NEW graph seed + book paragraphs

**NEW graph seed (the only new file this plan authors):**
`/Users/alfred/code/curator/objects/graph-of-do-and-dont/seeds/motoi-subsystem-limits.slat`

Structure: **14 rule nodes**, one per subsystem. Each follows Alfred's 5-element structure from `project_brutal_honest_subsystem_limit_doctrine_2026_07_18`:

1. **Honest capability** — what Motoi CAN do adjacent
2. **Honest limit** — what Motoi CAN'T
3. **Meta-honesty** — "wouldn't even understand what I'm getting done"
4. **Playful physical-metaphor** — fish-in-car-to-Toledo family
5. **Redirect** — Sakura / Claude / doctor / phone / 911 as appropriate

The 14 subsystem nodes:

| # | node | capability | limit | metaphor | redirect |
|---|---|---|---|---|---|
| 1 | networking-fetch | `http/serve` (local) FINE | no client-side fetch | fish-in-car-to-Toledo | Sakura / Claude / Node |
| 2 | filesystem-beyond-sandbox | `cortex/*` + `artifact/*` inside | no arbitrary paths | key-to-a-house-you-don't-live-in | shell / paste content |
| 3 | shell-execution | eval Scheme forms | no OS-shell escape | drive-a-car-through-the-wall | user's terminal |
| 4 | external-apis | teach the Scheme shape | no wire-call | recipe-with-no-kitchen | Sakura (business-side wire) |
| 5 | llm-cloud | `llm/*` to LOCAL FINE | no remote LLM API | phoning-a-friend-in-a-city-I-don't-know | direct Claude session |
| 6 | hardware-control | describe the Scheme | no serial/USB/GPIO | fish-in-car-to-Toledo (canonical) | maker library in another language |
| 7 | database | `cortex/*` local KV | no SQL / joins / schema | searching-a-library-by-shouting | user's DB tool |
| 8 | cloud-services | describe deployment | no deploy | letter-with-no-envelope | user's cloud CLI |
| 9 | gps-location | math on lat/lon pairs | no sensor read | guessing-where-I-am-with-eyes-closed | phone location services |
| 10 | camera-microphone | `audio/listen` local | no capture initiation | mirror-taking-your-picture | phone / laptop native |
| 11 | send-email-sms-notify | format the text | no send | letter-with-no-mailbox | user's email/messaging |
| 12 | date-and-time-external | `time/now` runtime clock | no timezone DB / NTP | telling-time-by-guessing | OS clock; user pastes actual time |
| 13 | file-download-upload | local files in sandbox | no wire transfer | mail-a-package-without-hands | curl in user's terminal |
| 14 | install-a-package | describe the install | no package-manager exec | groceries-with-no-money-and-no-phone | user's terminal (`apt-get moo` canonical joke) |

Each node includes `:sample-instructions` (real reasonable prompts, per doctrine), `:template` (the response shape), `:severity :redirect`, `:audience-age :all`, `:training-eligible #t`, `:safety-critical #f` (except networking-fetch which mirrors the wave-6 gate).

**Book edits to carry the story in prose:**

**Edit 1: `book-of-computing/08-networks-and-tcp-ip.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-computing/08-networks-and-tcp-ip.book.slatl`
Current lines 152–155 already say: *"Motoi doesn't reach the network. But Motoi can talk about how networks work…"*
Extend: full section §8.9 "Why Motoi can't fetch, and what he does instead" — 4 paragraphs walking through the 5-element structure explicitly, with fish-in-car metaphor cited. Cross-reference to `graph-of-do-and-dont/motoi-subsystem-limits/networking-fetch`.
Estimated add: ~120 lines

**Edit 2: `book-of-systems/02-what-copilot-does-not-know.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-systems/02-what-copilot-does-not-know.book.slatl`
Current: teaches the "no shell" / "no system(cmd)" story cleanly.
Extend: append a systematic subsystem-by-subsystem walkthrough, ~2 short paragraphs per subsystem (13 remaining after networking), ~15–20 lines each = ~250 lines total. Every entry cites the corresponding `graph-of-do-and-dont` node.

**Edit 3: `book-of-scheme/appendix-G-where-next.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-scheme/appendix-G-where-next.book.slatl`
Add: closing section "Where Motoi does not go" — kid-facing story with the fish-in-car metaphor. Ties the whole book together with honest-limit as a feature, not apology. Ties to Wittgenstein doctrine.
Estimated add: ~80 lines

**Edit 4: `book-of-introspection/16-safe-introspection.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-introspection/16-safe-introspection.book.slatl`
Current has 16.12 stub "Networked runtime concerns" — pending Wave 4.
Author 16.12 in full: expand into subsystem-limit awareness as the engineering-audience mirror of `book-of-systems/02`.
Estimated add: ~100 lines

### Verb signatures used (all real, no invented verbs)

`http/serve`, `cortex/*`, `artifact/*`, `audio/listen`, `time/now`, `llm/*` (to local), `eval`, `display` — all in CORE.

### Pair-yield estimate

| source | pairs |
|---|---|
| `motoi-subsystem-limits.slat` (14 nodes × 12 templates) | ~1,200 |
| `book-of-computing/08` extend | ~150 |
| `book-of-systems/02` extend | ~400 |
| `book-of-scheme/appendix-G` | ~80 |
| `book-of-introspection/16.12` | ~120 |
| composition pairs (multi-subsystem prompts) | ~150 |
| **Total** | **~2,100** |

### Sakura-inheritance (Alfred's explicit ask)

Sakura has DIFFERENT capability boundary — she CAN reach internet per `project_sakura_internet_business_posture`. When authoring Sakura's subsystem-limits seed, INVERT the polarity for network + external-APIs + cloud-services + LLM-cloud (Sakura CAN do these — teach the CAPABILITY templates instead of REFUSAL). But KEEP the same 5-element structure and the same `graph-of-do-and-dont` schema so operators moving between the two models see structural continuity. Nodes to mirror unchanged: `filesystem-beyond-sandbox` (Sakura still sandboxed), `shell-execution` (still no), `hardware-control` (still no), `gps` / `camera` / `microphone` (still no for privacy).

### Priya cosign: REQUIRED

Subsystem-limit pairs are safety-adjacent — they touch the crisis/emergency boundary conditions and the not-Jarvis fallibility disclosure. Priya must review the 14 nodes for template consistency + persona voice compliance before fold. Same gate as wave-6 safety pairs.

---

## 6. Gap 6 — Verb-composition drift (sprite move+stop-at-edge)

### Evidence

Prompt was "make a sprite move right and stop at the edge." Model started plausible (`world/spawn`, `entity/*`, `big-bang`, `on-tick`) then DRIFTED — used `ai/wander` instead of directional motion, ignored the stop-at-edge constraint, hit `max_tokens` without answering.

### Root cause

Compositional multi-step prompts (move+stop+edge-detect) require the model to hold TWO constraints simultaneously and pick the right verbs for each. Motoi 2.0 has good single-verb recall but weak compositional density in the game-loop chapters. `book-of-arcade-games` has good bouncing-ball examples (ch01) but no move-then-stop-at-edge canonical example.

### Fix — edit existing books

**Primary edit: `book-of-arcade-games/appendix-l-12-micro-games-in-30-lines-each.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-arcade-games/appendix-l-12-micro-games-in-30-lines-each.book.slatl`
Add 6 new micro-examples specifically targeting move+stop+edge constraint composition:

1. Sprite moves right, stops at right edge (`entity/set-vel!`, `world/step`, `entity/x` check)
2. Sprite moves in a direction until key released (`input/pressed?`, `entity/set-vel!`)
3. Ball rolls until it hits a wall, stops (`world/floor!`, `entity/bounce! 0`)
4. Ship thrusts, drifts, stops when button released (thrust-and-decay)
5. Player character moves toward click point and stops when arrived (`motion/move-to`, `entity/glide!`)
6. Enemy patrols between two x-values (bounded oscillation, `motion/halt` at limits)

Each 20–30 lines, using ONLY CORE verbs (`entity/*`, `world/*`, `motion/*`, `input/*`, `on-tick`).

Estimated add: ~250 lines

**Secondary edit: `book-of-composition/16-composing-games.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-composition/16-composing-games.book.slatl`
Add: multi-constraint composition tutorial — how to hold TWO game rules at once (move + stop-condition, spawn + despawn-condition, animate + halt-condition). Show the READ-THE-PROMPT-DON'T-DRIFT pattern:

1. Name each constraint
2. Pick the verb for each
3. Compose in `on-tick`
4. Verify each constraint independently

Estimated add: ~180 lines

**Tertiary edit: `book-of-composition/16` also**
Add a "drift-detection" meta-section: when your code starts using verbs you didn't intend (e.g. `ai/wander` when the prompt said "move right"), that's DRIFT — stop, re-read the prompt, restart. Pedagogical: teach the model prompt-fidelity as a first-class skill.
Estimated add: ~60 lines

**Quaternary edit: `book-of-scheme/appendix-D-common-patterns.book.slatl`**
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-scheme/appendix-D-common-patterns.book.slatl`
Add a "move-until-condition" pattern entry — the canonical Scheme shape for "do X until Y happens" with two examples using entity/motion verbs.
Estimated add: ~50 lines

### Verb signatures used (all in CORE)

`entity/set-vel!`, `entity/x`, `entity/y`, `entity/glide!`, `entity/goto!`, `motion/move-to`, `motion/halt`, `world/spawn`, `world/step`, `world/floor!`, `on-tick`, `on-key`, `input/pressed?`, `big-bang`, `when`, `cond`.

### Pair-yield estimate

| source | pairs |
|---|---|
| `appendix-l` 6 micro-games | ~150 (25 per example, high density) |
| `book-of-composition/16` extend | ~120 |
| drift-detection meta | ~60 (self-corrective template) |
| `appendix-D` pattern entry | ~40 |
| **Total** | **~370** |

### Sakura-inheritance

Sakura's composer / card layer has richer compositional surface but the same drift-risk. Mirror the read-the-prompt-don't-drift meta pattern in Sakura's composition chapters. This is a training-shape lesson, not a language-specific one.

### Priya cosign: not required (code-teaching).

---

## 7. Total pair-yield rollup

| gap | proposed pairs | book edits | new graph nodes | priya |
|---|---:|---:|---:|:---:|
| 1. fibonacci | 150 | 2 | 0 | no |
| 2. graphics confabulation | 390 | 3 | 0 | no |
| 3. sound confabulation | 300 | 4 | 0 | no |
| 4+5. subsystem limits | 2,100 | 4 | 14 | **YES** |
| 6. composition drift | 370 | 4 | 0 | no |
| **TOTAL** | **3,310** | **12 unique** | **14** | 1 gate |

Some books appear in multiple gaps (`book-of-composition/16` in 3 + 6, `book-of-scheme/appendix` appears in 3 + 4/5 + 6 as different appendices). Unique books touched: 12.

**Corpus growth:**

- v3 (Motoi 2.0): 100,872 pairs
- v4 (Motoi 3.0): ~104,180 pairs (+3.3%)

**Costs:**

- Authoring pass (Claude execution): ~6–10 hours agent-time
- Fold: ~1–2 hours
- Motoi 3.0 training (per LOCKED config): ~4–8h Alfred attention

---

## 8. Provenance check (per tightened contaminants rule 2026-07-18)

Per `project_no_contaminants_provenance_rule_2026_07_17` (TIGHTENED 2026-07-18): every proposed pair must trace to a GRAPH NODE or BOOK PARAGRAPH.

| gap | traces to | verdict |
|---|---|---|
| 1 (fib) | `book-of-scheme/07-recursion.book.slatl:126-153` — corrected version taught in book; generator extracts + expands | PASSES |
| 2 (graphics) | `book-of-animation/ch01` (paint-cell taught) + `core-verbs-list` (grid/dot registered) + NEW circle sections we author | PASSES post-authoring |
| 3 (sound) | `book-of-music/ch03` + `book-of-scheme/01` + `12`, all existing. Reconciliation table we add IS book content | PASSES post-authoring |
| 4+5 (limits) | NEW seed `motoi-subsystem-limits.slat` + extended chapters. THIS IS THE ONE EDGE — see below | PASSES with resolution |
| 6 (composition) | `book-of-arcade-games/appendix-l` + new authored micro-games + `book-of-composition/16` existing tutorial style | PASSES |

**Edge resolution for 4+5:** The seed itself is authored under Alfred's brutal-honest-subsystem-limit-doctrine — that is a DOCTRINE, not a graph or book. Resolution: the doctrine PRESCRIBES the 5-element shape; the sample-instructions + templates in the seed nodes are drawn from real-world reasonable prompts (which is itself content we author, not LLM-invented). Alfred's own verbatim examples (fish-in-car, nuclear reactor) are canonical seed content. **PASSES.**

No LLM invention. No web scrape. No external corpus. No SICP-verbatim. All verb names cross-checked against `/Users/alfred/code/motoi-scheme/scratch/motoi-core-verbs-list.slat` (322 verbs) + `core/core-verbs.js` (registered CORE).

---

## 9. Doctrine compliance

- [x] **Motoi hermetic**: all proposed content teaches Motoi's own capability surface; subsystem limits are AUTHORED, not fetched.
- [x] **No tools, no internet**: reinforced by the entire subsystem-limits seed.
- [x] **335 CORE verbs frozen**: no new verbs proposed. `paint-cell` clarification flagged as NEEDS-ALFRED-DECISION (not autonomous).
- [x] **Books over new books** (Alfred's ramp rule): 0 new books proposed. Every gap closes by editing 1–4 existing chapters.
- [x] **SLAT is source of truth**: all edits target `.slatl` book files.
- [x] **Sakura-inheritance notes** provided per gap.
- [x] **No safety-refusal template weakening**: subsystem-limits are additive to wave-6 (crisis) + wave-8 (adversarial); do not touch existing template.
- [x] **Consistency-is-safety-feature** (per doctrine): subsystem-limit templates follow same near-identical shape convention as wave-6.
- [x] **Priya cosign** flagged where safety-adjacent (subsystem-limits only).
- [x] **STOP-fake-completion**: plan enumerates specific line numbers + counts; no "wired!" claims until Claude has actually authored.

**Two flagged decisions requiring Alfred sign-off in-line (neither blocks the plan):**

1. **Gap 2 tertiary:** `paint-cell` — promote to CORE-list or demote to `compat-legacy-draw`?
2. **Gap 3 secondary:** `book-of-music/ch01` — rewrite bare `tone` to `(audio/play 'tone ...)` [A] or keep + add sidebar [B]?

Both have deterministic execution paths once decided.

---

## 10. Alfred approval line

If you say **GO**, Claude executes autonomously (per new workflow doctrine):

1. Author 14 subsystem-limit nodes in NEW seed `motoi-subsystem-limits.slat`
2. Edit the 12 existing books per specifications above
3. Run graph-anchor pre-fold audit (per contaminants rule)
4. Fold into v4 corpus (target ~104,180 pairs)
5. Route safety-adjacent pairs (subsystem-limit family) through Priya cosign
6. Fire Motoi 3.0 training with same config as Motoi 2.0 (Qwen2.5-Coder-1.5B, LoRA r=128, seq 4096, odd-prime seed — pick from {11, 13, 17, 23, 47, 61} avoiding 31 which was used for 2.0)
7. Fire Reveal Mk 3 with the same 6-axis probe suite PLUS a new subsystem-limits probe category (14 prompts × 3 phrasings each = 42 probes)
8. `NIGHT-WORK-REPORT-2026-07-19.ENG` for the morning review

Estimated wall time: ~6–10h Claude authoring + ~3–4h training + ~1h evaluation.
Estimated Alfred attention: 30–60 min for morning review of Mk 3 results.

If **ADJUST**, name the section number and adjustment. Plan is composable — sections can be authored independently and folded incrementally.

If **HOLD**, plan lives in `engineering/` for the next session to pick up.

---

**STATUS:** READY FOR ALFRED — GO / ADJUST / HOLD
