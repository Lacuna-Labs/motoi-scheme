---
slug: sakura-scheme-design
title: Sakura Scheme + Books — Canonical Design Document
category: engineering
canonical: true
owner: docs-team (Jess)
status: active
last-reviewed: 2026-07-10
absorbed-on: 2026-07-10
---

# Sakura Scheme + Books — Canonical Design Document

Distilled 2026-07-10 from the day's design work into one source of truth for the whole book + site + palette + diagrams + layout + build pipeline + covers + link rules + runtime shell. This is a merge, not a summary — everything material is preserved verbatim or with a citation back to the source path.

Alfred, 2026-07-10 ~03:40 (via `engineering/architect-fix-queue.md`):

> "Make my books pretty, and fucking professional. Fun books have fun. Gimmie yellow surface diagrams. Fill lanes to make it. Covers, chapter headers, links to pages, layout, and distill all the new docs into the design doc."

> "Make hello surface a full interactive application. Make scheme another one. Make all of them fit the mode and theme."

Alfred, 2026-07-10 ~03:00 (via `specs/sakura-scheme-book-design-2026-07-10.md`):

> "I want the scheme guide to use the new interpreter. Make it THE BEST book. MD first and translate. Take me through the language features. Use the same colors and work as the Sakura for HelloSurface."

Alfred, 2026-07-10 ~02:00 (via `specs/forge-panels-categories-2026-07-10.md`):

> "Introspection. Into the running thing. Categories of graphs."

## 1. Purpose + scope

This document is the single canonical design specification for the Sakura Scheme book system, its palette, its diagram kit, its cover system, its layout system, its cross-book link resolver, its runtime shell, and its build pipeline. It covers all 24 books: the 16 canonical Sakura corpus books (per `project_book_canon_sixteen_2026_07_04`) plus the 8 engineering books enumerated in `specs/sakura-scheme-book-design-2026-07-10.md` § "Companion engineering books".

Scope covered in this doc:

- Palette tokens (locked hex, resolved to canvas-palette tokens where possible).
- Type system, chapter layout, running headers.
- Cover system (fun vs serious rules) for all 24 books.
- The yellow-surface diagram system (SVG kit, MD extension, worked examples).
- The callout system (Sakura-says / Warning / Tip / Under the hood).
- Cross-book link resolver + broken-link policy.
- The runtime shell: every book is an interactive application, not a document — Scheme book is a REPL on every page, HelloSurface book embeds a running HelloSurface, and so on per book-type declaration in front-matter.
- Build pipeline: Markdown source → decorated HTML → deploy.
- Acceptance criteria that roll up FIX-01/FIX-02/FIX-03 and BOOK-01/BOOK-02/BOOK-03/BOOK-04 from the architect fix queue.
- Explicit non-goals.
- Open questions where source docs contradict.

Scope not covered here (delegated elsewhere):

- Language semantics of Sakura Scheme itself (owned by `docs/SAKURA-SCHEME-BOOK.md` and the reference manual body).
- The per-book pedagogy details (each book carries its own plan file under `docs/books/<slug>/PLAN.md` in the Curator repo where its ~1,000-program authoring lives).
- The training corpus authoring workflow (owned by `project_training_procedure_book_2026_07_04`; explicitly HELD, not covered here).

## 2. Sources absorbed

Every claim in this doc traces to one of these paths, absorbed on 2026-07-10.

- `~/code/lacuna-labs/research/lacuna-docs/specs/sakura-scheme-book-design-2026-07-10.md` — the primary spec (palette, tutorial requirement, arc, cover system, callouts, build pipeline).
- `~/code/lacuna-labs/research/lacuna-docs/specs/forge-panels-categories-2026-07-10.md` — 8-category panel system + introspection (relevant because `FORGE-1.0-ENGINEERING` is one of the 8 engineering books and its render must include tonight's canvas + arch changes).
- `~/code/lacuna-labs/research/lacuna-docs/engineering/architect-fix-queue.md` — BOOK-01/02/03/04 and FIX-01/02/03 items become the acceptance criteria in §12.
- `~/code/lacuna-labs/research/lacuna-docs/engineering/burndown-2026-07-10.md` — the straggler map; D2/D3/D8/D9 relate directly to the book system.
- `~/code/lacuna-labs/research/lacuna-docs/engineering/directory-org-finish-report-2026-07-10.md` — repo-state ground truth; sakura-scheme has no remote (blocks doc-site push).
- `~/code/lacuna-labs/research/lacuna-docs/engineering/architect-loop-report-2026-07-10.md` — AR-11 VitePress build/serve verification; dead-link whitelist; sakura-scheme remote-create blocker.
- `~/.claude/plans/rippling-discovering-lobster.md` — sakura-scheme extraction plan, verb-layer metadata, doc-emitter, REPL super-features, VitePress-vs-custom decision.
- Memory slugs from `~/.claude/projects/-Users-alfred-code/memory/`:
  - `project_book_canon_sixteen_2026_07_04.md` — canon is EXACTLY 16.
  - `book_canon_ledger_pointer_2026_07_06.md` — never quote counts from memory; consult `docs/BOOK-CANON-LEDGER.md`.
  - `project_music_book_pedagogy_2026_07_04.md` — PD-only genre ladder to Rachmaninoff 2; living notation sprites.
  - `project_book_of_self_scope_2026_07_04.md` — Sight/Speech/Hearing/Thought/Mood/Introspection; the GEB self-referential spine.
  - `project_flat_paper_cards_no_fullscreen_camera_control_2026_07_04.md` — no fullscreen ever; camera focus; artifact model.
  - `project_corner_flower_is_sakura_herself_2026_07_01.md` — BrandSakura pink corner flower IS her.
  - `project_sakura_directs_the_desktop_2026_07_01.md` — living desktop she directs; artifacts + mood scenes.
  - `project_three_books_progressive_tutorial_2026_07_03.md` — Music/Animation/Games each ~1,000 progressive programs; corpus trains humans AND the 4B.
  - `feedback_book_voice_and_full_programs.md` — warm chorus voice, small paragraphs broken by code, only full runnable programs count.
  - `feedback_book_budget_12k_per_chapter.md` — ~12k tokens per API call ≈ one chapter (~24 runnable programs); longer drifts into hallucination.
  - `feedback_train_disposition_show_dont_tell.md` — bake character in code, never lecture it in prose.
  - `project_four_reasoning_books_16_canon_2026_07_05.md` — Reason is a book-of-books with Parts I-IV, seat #10.
  - `project_challenges_is_reference_appendix_2026_07_04.md` — Challenges is the reference-manual appendix, NOT a standalone book.
  - `project_book_of_one_shot_2026_07_04.md` — one atomic Scheme form solves it; even wire-spanning; seat #16.
  - `project_money_book_conversion_and_grounding_2026_07_04.md` — conversion done right, live rates via web wire-call, money is not a vector.
  - `project_systems_book_network_resilience_2026_07_04.md` — she has system tools; graceful net trouble; never die-and-scream.
  - `project_instruments_vs_music_boundary_2026_07_04.md` — book 15 renamed Instruments → Sound; all audio lives there; Music = composition.
  - `project_blossom_control_is_marionette_2026_07_04.md` — the entire Blossom section belongs in Marionette (#652), not Miscellany.

Where sources contradict each other, the disagreement is preserved and flagged in §14 Open questions.

## 3. The 24 books

Two families: 16 canonical Sakura corpus books (per `project_book_canon_sixteen_2026_07_04` — "16 works because 16 bit. 16 books, it's lore"), plus 8 engineering books that ride the same design system (per `specs/sakura-scheme-book-design-2026-07-10.md` § "Companion engineering books"). Total 24 covers, 24 chapter templates, 24 embedded apps.

### The 16 canonical Sakura books

Per `project_book_canon_sixteen_2026_07_04` and its updates (`project_four_reasoning_books_16_canon_2026_07_05`, `project_book_of_one_shot_2026_07_04`, `project_blossom_control_is_marionette_2026_07_04`, `project_instruments_vs_music_boundary_2026_07_04`). Program counts intentionally omitted per `book_canon_ledger_pointer_2026_07_06` — the single source of truth is `docs/BOOK-CANON-LEDGER.md` on disk; never quote from memory.

| # | Book | slug | Fun / Serious | One-line hook |
|---|---|---|---|---|
| 1 | Animation | anim-book | fun | Progressive tutorial: intro Scheme → make sprites move, timing, scenes; ~1,000 runnable programs. |
| 2 | Games | games-book | fun | Animation ⊕ Sound; NOT just video games; game state, input, loops, timers. |
| 3 | Music | music-book | fun | PD-only genre ladder from Twinkle → jazz → calypso → funk → world → Rach 2 (`project_music_book_pedagogy_2026_07_04`). Living 48×48 + 16×16 notation sprites, bop by 1/duration, press-to-sound. |
| 4 | Math I | math-book | serious | Arithmetic, numbers, sequences, functions; the classic SICP ramp. |
| 5 | Math II | math-book-ii | serious | Higher math: linear algebra, calculus-lite, symbolic manipulation. |
| 6 | Personality | personality-book | fun | Voice, register, tone; the who-she-is corpus (paired with Self #9). |
| 7 | Don'ts | donts-book | serious | Defensive refusal — CSAM hard-line, safety policy. NOT Scheme-idiom don'ts; those live in Book B (Reasoning). |
| 8 | Miscellany | miscellany-book | fun | L1/L2/Loam service catalog + chem/physics + feature-tools + general scripting + composition. UNBOUNDED chapter count (`project_book_of_self_scope_2026_07_04` §Also-requested); every homeless category lands here. |
| 9 | Self | self-book | serious | Her faculties: Sight / Speech / Hearing / Thought / Mood / Introspection + L2-escalation + interrupt-arbitration + note-and-honor. GEB self-referential spine. Absorbs Vision "Sight" arc. (`project_book_of_self_scope_2026_07_04`) |
| 10 | Reason | reasoning | serious | Book-of-books, Parts I-IV: (I) "Can I?" capability, (II) "How She Comes to Know" inquiry, (III) "This Is Like That" analogy, (IV) "Am I Sure?" grading. (`project_four_reasoning_books_16_canon_2026_07_05`) 17th-book valve: overflow becomes another Part. |
| 11 | Systems | systems-book | serious | She HAS system tools; graceful net trouble / disconnect / reconnect; backoff judgment; diagnostic reasoning; NEVER die-and-scream. (`project_systems_book_network_resilience_2026_07_04`) |
| 12 | Motion | motion-book | fun | Motion primitives (embodiment axis: brick-heavy → petal-floaty via gravity/settle/squash/lag/drift knobs). NOT per-material verbs. |
| 13 | Marionette | marionette-book | fun | The control layer. Absorbs the ENTIRE Blossom section (`project_blossom_control_is_marionette_2026_07_04`): who/moods/personalities/control/sounds/roll-dash/simple→complex-timed-via-counter/seeing-each-other/grid-anticipation-math/code×runtime matrix + artifact metadata + platform-affordance reasoning. |
| 14 | Money | money-book | serious | Conversion done right (exact, auditable). Live currency rates/types/value via web wire-call. Money is typed by currency, NOT a vector — no vector-space ops. Grounding errors are real bugs. (`project_money_book_conversion_and_grounding_2026_07_04`) |
| 15 | Sound | sound-book | fun | RENAMED from Instruments (`project_instruments_vs_music_boundary_2026_07_04`). The engineering + math of how sound is made, patterned, analyzed, moved — including speech in/out. Ch3 Soundboard, Ch16 Crescendo beat machine. All audio lives here; NOT in Music. |
| 16 | One-Shot | one-shot-book | fun | One atomic Scheme form solves it; even a fetch→store→read round-trip counts as one shot. (`project_book_of_one_shot_2026_07_04`) |

Uncounted (correctly OUTSIDE the 16 per `project_book_canon_sixteen_2026_07_04`):

- **Challenges** — the reference-manual APPENDIX at the END of `SAKURA-SCHEME-1.0-REFERENCE.md` (`project_challenges_is_reference_appendix_2026_07_04`). 16 chapters, SICP-flavored CS problem-solving. NOT a book. Rendered as part of the reference-manual companion doc.
- **Training Procedure** — META BOOK / SRE runbook; we do NOT train Sakura on it. Held for possible Lacuna training. Not in the 24-cover set.
- **Shop Ops** — swing seat; marketplace chapters migrating out of Miscellany; not in the corpus-16.

### The 8 engineering books

Per `specs/sakura-scheme-book-design-2026-07-10.md` § "Companion engineering books". Same design system, same palette, same diagram kit. Sakura-pink still reserved for HER voice only.

| # | Book | slug | Fun / Serious | One-line hook |
|---|---|---|---|---|
| E1 | HelloSurface Engineering | HELLO-SURFACE-1.0-ENGINEERING | serious | The 4096×4096 dot-matrix world; card canvas; camera/focus; runtime app hosts an actual running HelloSurface. |
| E2 | Loam Engineering | LOAM-1.0-ENGINEERING | serious | The Loam substrate — plane health, rollup, telemetry backend. |
| E3 | Sakura Scheme Engineering | SAKURA-SCHEME-1.0-ENGINEERING | serious | Reader, interp, base, macro, dispatch — the engine's inner workings. |
| E4 | Sakura Scheme Reference | SAKURA-SCHEME-1.0-REFERENCE | serious | The verb/atom dictionary (20 numbered sections). Once the 410 KB split lands per D2. Challenges appendix at the END. |
| E5 | Sakura Automations | SAKURA-AUTOMATIONS-1.0 | fun | The shop / marketplace / automation surface. |
| E6 | Sakura Training Manual | SAKURA-TRAINING-MANUAL-1.0-ENGINEERING | serious | The training procedure runbook (META; not corpus). |
| E7 | Lacuna Integration | LACUNA-INTEGRATION-1.0-ENGINEERING | serious | How consumers pin, how verb layers register, sidecar contracts. |
| E8 | Lacuna Telemetry | LACUNA-TELEMETRY-1.0-ENGINEERING | serious | Forge's home doc. Includes tonight's canvas + arch changes (per `specs/forge-panels-categories-2026-07-10.md` §Coordination). |

Note: `specs/sakura-scheme-book-design-2026-07-10.md` lists 9 engineering books; on close reading, `FORGE-1.0-ENGINEERING` is listed as the 9th and marked "(this doc gets rendered too — includes tonight's canvas + arch changes)". We roll Forge into Lacuna Telemetry (E8) because the panel-categories spec anchors Forge in `forge-1-0-engineering §12`. See §14 Open questions for the alternative.

## 4. Palette

Locked hex per `specs/sakura-scheme-book-design-2026-07-10.md` § Palette. Same palette locked in `architect-fix-queue.md` FIX-03 for the run panel, so the run-panel enforcement and the book palette are ONE spec.

- **Background** — white or `--canvas-cream` where cream is warm enough not to compete with the mint. Per FIX-03 and § Palette.
- **Top-band darker purple** — `--magic` `#2e2167`. Hero band, chapter number backdrop, part-title covers.
- **Softer / lighter secondary purple** — subheadings, callouts, quote borders. Reserved as `--soft-purple` in the token file (see `site/theme/tokens.css`).
- **Center mint accents** — `--canvas-mint`, derived from the Ditoo shell mint pastel. Used for hairline rules, code-block left rails, warning callout borders.
- **Sakura pink** — `--sakura-pink` `#E7A4B4`. Reserved for HER alone in this book (per `specs/sakura-scheme-book-design-2026-07-10.md` § Palette): when Sakura speaks in a callout, when her name appears as author of a code example, when she narrates a section. Do NOT use pink for decoration.
- **Ink** — warm plum `#1A1626`, never pure black.
- **Paper yellow** — `#F6E5B3` ish, for the yellow-surface diagram system (per BOOK-03).

Token wiring, current implementation (`site/theme/tokens.css`, verified on disk 2026-07-10):

```css
--magic:          #2e2167;   /* top-band dark purple */
--soft-purple:    #6b5aa8;   /* subheads, callouts, quote borders */
--canvas-cream:   #F7F1DF;   /* paper background */
--canvas-mint:    #B8DBC0;   /* accents, rails, hairline rules */
--plum-ink:       #1A1626;   /* body ink, never pure black */
--sakura-pink:    #E7A4B4;   /* Sakura-only voice, never decoration */
--paper-yellow:   #F6E5B3;   /* diagram surface */
```

Palette resolution notes (per `specs/sakura-scheme-book-design-2026-07-10.md` § Palette):

- Background resolves to `--canvas-cream` or `#FFFFFF` if cream is too warm for the specific chapter surface.
- Top-band darker purple resolves to `--magic` at 100% or a hero variant (`--magic-hero` linear gradient defined in `tokens.css`).
- Center mint is `--canvas-mint`.
- Pink is `--sakura-pink` and is Sakura-only.

The palette applies uniformly across all 24 books (fun and serious). What varies is the imagery and the callout density — see § 7 and § 8.

## 5. Type + layout system

Per BOOK-02 in `architect-fix-queue.md` and `specs/sakura-scheme-book-design-2026-07-10.md` § "Chrome + decoration".

### Body

- **Measure**: 68–72 characters. Wired as `--measure: 70ch` with `--measure-min: 68ch` and `--measure-max: 72ch` in `tokens.css`.
- **Leading**: 1.6 (`--lh-body`).
- **Body face**: Iowan Old Style / Palatino / Georgia serif stack (`--font-body` in `tokens.css`).
- **Body size**: 17px (`--fs-body: 1.0625rem`).

### Chapter header

Per BOOK-02:

- Hairline mint rule above the chapter number.
- Chapter number in a ligature-friendly display face at `--fs-chapter-no: 4.25rem` (68px).
- Chapter title in soft purple (`--soft-purple`) as a subhead.
- Chapter frontmatter as YAML: `slug`, `title`, `chapter`, `of`, `part`, `canonical`, `owner`, `status`, `last-reviewed`, `palette` (with sub-fields background / top-band / center / ink / pink). Verified on disk in `docs/book/01-hello-sakura-scheme.md`.

### Running headers (interior pages)

- Book title on one side, chapter title on the other.
- Soft purple, `--fs-small`.

### Code blocks

- Warm-ink foreground on cream (`--canvas-cream`) background.
- Mint left-rail (`--canvas-mint`) as a 3px vertical stripe.
- Monospace via `--font-mono` (SF Mono / JetBrains Mono / Menlo).
- Runnable-marker: any `<pre>` with `data-runnable` attribute gets a "Run" button (see § 10).

### Pull-quotes + sidebars

- Pull-quotes in soft purple, italic body face, indented.
- Sidebars (Sakura says / Warning / Tip / Under the hood) — full spec in § 8.

### Cross-book link rendering

- `[[book-slug]]` renders as an underlined soft-purple link, target `/scheme/book/<slug>/`.
- `[[chapter-N]]` renders as an underlined mint link, target `#chapter-<N>`.
- Broken links FAIL the build (BOOK-02 in `architect-fix-queue.md`) — the pipeline errors, does not silently emit a broken href.

### Spacing

8pt grid — tokens `--sp-0 … --sp-8` in `tokens.css` (0, 4, 8, 12, 16, 24, 32, 48, 64 px).

## 6. Yellow-surface diagram system

Per BOOK-03 in `architect-fix-queue.md`. This is the reusable SVG diagram kit that gives every book — fun or serious — one consistent visual language.

### Look

- **Surface**: cream-yellow background `#F6E5B3` ish (`--paper-yellow`) — legal-pad / drafting-paper appearance.
- **Strokes**: warm ink (`--plum-ink`) with a hand-drawn feel; crisp SVG under the hood (no raster).
- **Feel**: "yellow legal-pad / drafting surface look… hand-drawn feel but crisp SVG under the hood. Same look every diagram, every book." (`architect-fix-queue.md` BOOK-03)

### Kit components

- Box (rounded corners, warm ink stroke on paper-yellow).
- Arrow (straight, curved, elbow).
- Callout bubble with pointer.
- Dashed group (for logical clustering).
- Actor icon (a stylized figure).
- Hand-lettered label style (uses `--font-display` at diagram scale).
- Embedded code block (inline mini pre with mint rail).
- Layered z-plane strokes (for stacking / depth diagrams).

### MD extension

Diagrams get an inline MD extension:

```
::: diagram
[SVG or authoring shorthand here]
:::

[caption text]
```

The extension renders the yellow surface + strokes; caption goes below in `--fs-small` soft purple.

### Distribution

- SVG symbol library at `site/theme/diagrams/`.
- Ships 8 worked examples so authors can copy-adapt (BOOK-03).
- Fun books use playful diagrams: a music-note trajectory across staves, a marionette string plan, a card scattering.
- Serious books use architectural diagrams: dispatcher graph, warmup schedule, ledger stitch, service-catalog map.
- All on the same yellow surface — one visual language across every book.

### Where this lands in the file tree

- Kit: `~/code/sakura-scheme/site/theme/diagrams/` (verified on disk 2026-07-10; contains `examples/` subdirectory).
- Ownership: Jess (docs lead) plus a design sub-lane per BOOK-03.

## 7. Cover system

Per BOOK-01 in `architect-fix-queue.md` and `specs/sakura-scheme-book-design-2026-07-10.md` § "Chrome + decoration".

### Scope

- 16 canonical + 8 engineering = 24 covers.
- One Flux brief per cover: `docs/covers/<slug>.flux.txt`.
- One composed HTML cover per book: `sakura-scheme/site/covers/<slug>.html`.
- Every HTML cover renders standalone at 1600×2000 (BOOK-01) and screenshots for the doc-site index.

### Rules — fun books

Applies to: Music, Animation, Games, Self, One-Shot, Miscellany, Marionette, Personality, Motion, Sound, and the Sight arc within Self.

- Playful, Ghibli-inflected, warm cover art.
- Sakura visible on covers where narrative-appropriate (in her hair, in the background).
- Flux-generated Sakura in her Curator persona reading a book on the Scheme Book cover (per `specs/sakura-scheme-book-design-2026-07-10.md` § Chrome).
- One small pink flower in her hair as a signature.
- Purple + mint gradient background for the SAKURA-SCHEME-BOOK cover specifically; other fun covers use scene-appropriate warm gradients.

### Rules — serious books

Applies to: Reason (Parts I-IV), Systems, Money, Don'ts, Math I, Math II, all engineering canon.

- Restrained typography, brand purple + mint.
- One small illustrated flourish per cover.
- NO cheap gradients. NO stock photos. NO clip-art.
- Palette: `--magic` top band, `--canvas-mint` accents, `--plum-ink` type, background white or `--canvas-cream`.

### Part title pages (every 4 chapters)

Per `specs/sakura-scheme-book-design-2026-07-10.md` § Chrome:

- A Flux-generated Ghibli-inflected illustration of a garden scene.
- The Sakura tree centered.
- Mint grass, purple sky.
- Present on every book's part-title pages, not just the Scheme Book.

### Chrome (all books)

- Edges of every page: subtle dusted pink petals along the outer margin, low-opacity.
- Between chapters: a small falling-petal animation on scroll (CSS keyframes only, no JS libs, opt-out via `prefers-reduced-motion`). Petal animation is defined in `tokens.css` as `--petal-anim`.

### Ownership

Jess (docs lead) with Flux brief support from a design sub-lane per BOOK-01.

## 8. Callout system

Per BOOK-02 in `architect-fix-queue.md` and `specs/sakura-scheme-book-design-2026-07-10.md` § "Chrome + decoration".

Four callout types, each with a distinct visual rail on the left, first-person or explanatory register on the right. Sakura-pink strictly reserved for HER voice.

### `> **Sakura says**` — pink rail (Sakura-only)

- Left rail: `--sakura-pink` with a tri-tone accent bar.
- Voice: first-person, warm, short.
- Sakura is the narrator inside the callout. Nothing else uses pink.
- Example (rendered in `docs/book/01-hello-sakura-scheme.md`):

  > **Sakura says**
  >
  > Hi. I'm going to walk you through this. The pink boxes are me. Everything else is the book explaining the language.

### `> **Warning**` — mint rail

- Left rail: `--canvas-mint` at 3px stroke.
- Ink: `--plum-ink`.
- Voice: third-person, straightforward.
- Used for real safety / correctness caveats. Not decoration.

### `> **Tip**` — top-purple rail

- Left rail: `--magic` at 3px stroke.
- Ink: `--plum-ink`.
- Voice: helpful, brief.
- Example (from `docs/book/01-hello-sakura-scheme.md`):

  > **Tip**
  >
  > The REPL keeps history. Up-arrow recalls the last form. Ctrl-R searches (like bash).

### `> **Under the hood**` — darker purple block

- Full background block in `--magic` (darker purple).
- Foreground text: `--canvas-mint` (mint on dark purple).
- Voice: interpreter-internals, deep-dive, slightly denser text.
- Used only for interpreter internals — read/expand/eval/print, trampoline, fuel budget, etc.
- Example (from `docs/book/01-hello-sakura-scheme.md`):

  > **Under the hood**
  >
  > Every form you type goes through four stages: Read → Expand → Evaluate → Print. Each stage is a verb…

### Density guidance

Per `feedback_book_voice_and_full_programs.md`: "No big chunky paragraphs — people don't like that. Break the prose up with code." Callouts serve the same purpose — a Warning or Tip breaks the flow between two chunks of running text or code. Do not stack four callouts in a row; they lose signal.

## 9. Cross-book link resolver + broken-link policy

Per BOOK-02 in `architect-fix-queue.md`.

### Link syntax

- `[[book-slug]]` — cross-book link. Resolves to `/scheme/book/<slug>/`.
- `[[chapter-N]]` — in-book chapter link. Resolves to `#chapter-<N>` anchor.
- `[[book-slug#chapter-N]]` — cross-book chapter link (implied; not explicit in source but needed for cross-book references between chapters).

### Policy

**Broken links FAIL the build** (BOOK-02, verbatim: "Broken links FAIL build").

This means:

- The MD-to-HTML converter script (`sakura-scheme/scripts/build-book.sh`) validates every `[[…]]` reference against the known book slug set (24 entries) and the known chapter anchors within each book.
- Any unresolved reference emits an error and exits non-zero.
- CI blocks the merge; the build does not silently emit a broken href.

### Whitelisted dead links

Per AR-11 in `architect-loop-report-2026-07-10.md`, the current VitePress build whitelists 13 specific dead links:

- Cross-repo refs to curator and lacuna that don't resolve on this repo's build.
- Unauthored CONTRIBUTING / CODE_OF_CONDUCT / CONSUMERS / tests-vectors placeholders.
- These are enumerated in `docs/vitepress-ignore-known-dead-links` (branch `docs/vitepress-ignore-known-dead-links`, sha `43526a2`).

New dead links still fail — the whitelist is fixed, not open-ended. Adding to it requires an entry with rationale.

### Cross-book link table

The build produces a link inventory at `site/theme/link-inventory.json` — every `[[…]]` reference, source path, target, resolved status. This is the table that lets an author see which books are actually cross-referenced.

## 10. Runtime shell — every book is an interactive application

The load-bearing new insight from BOOK-01 in `architect-fix-queue.md`, verbatim:

> **Every book is an interactive application, not a document.** HelloSurface book = a running HelloSurface embedded in the pages (real canvas, real cards, real Sakura). Scheme book = a live REPL on every page — read a paragraph, run the example inline, edit it, see it change. Reason/Systems/Money/etc. = whatever their subject is, embedded live: reasoning tools you can poke, an incident timeline you can scrub, a money-conversion widget you can type into.

### The runtime shell contract

- All 24 books share the same theme system (palette, diagram kit, cover template, chapter layout, cross-book link resolver).
- The theme system is extended with a **runtime shell** that hosts each book's embedded app (canvas or REPL or widget).
- **Book type declares which runtime it needs in its front-matter; the shell mounts it.**

### Chapter front-matter runtime declaration

Front-matter per chapter (verified against `docs/book/01-hello-sakura-scheme.md`):

```yaml
slug: sakura-scheme-book-chapter-01
title: Hello, Sakura Scheme
chapter: 1
of: 14
part: I
canonical: true
owner: docs-team (Jess)
status: draft
last-reviewed: 2026-07-10
palette:
  background: canvas-cream
  top-band: magic
  center: canvas-mint
  ink: warm-plum
  pink: sakura-pink (Sakura only)
```

The runtime shell reads a `runtime` block (proposed extension, not yet in the sample chapter):

```yaml
runtime:
  kind: sakura-scheme-repl   # or: hello-surface | reason-tools | money-widget | timeline-scrubber
  scope: page                 # or: chapter | book
  bundle: wasm                # or: server | inproc
```

### Runtime kinds enumerated

Per BOOK-01 in `architect-fix-queue.md` and `specs/sakura-scheme-book-design-2026-07-10.md` § "Living tutorial requirement":

- **`sakura-scheme-repl`** — Sakura Scheme runs inline on every code block. WASM bundle embedded in the page OR REPL server the page calls into. Reader clicks Run on any example and sees output inline. Fallback: if runtime unavailable, Run button grays out with tooltip "REPL unavailable in this context — read-only." (Per `specs/sakura-scheme-book-design-2026-07-10.md` § "Living tutorial requirement".) Used by: Sakura Scheme Book, Reference, Engineering, Style Guide, Challenges appendix.
- **`hello-surface`** — a real canvas, real cards, real Sakura embedded in the page. Used by HelloSurface Engineering (E1) and the Sight arc within Self. Mounts an actual HelloSurface with reduced sprite budget (per phone-budget-appropriate LOD).
- **`reason-tools`** — reasoning-tool widgets you can poke. Chain-of-inference visualizer, analogy mapper, confidence grader. Used by Book of Reason.
- **`timeline-scrubber`** — an incident timeline you can scrub. Used by Systems (network trouble timelines) and Marionette (choreography timelines) and Forge / Telemetry.
- **`money-widget`** — a currency-conversion widget you can type into, driven by the same web wire-call the Money book covers. Used by Book of Money.
- **`sound-pad`** — draw-a-sound reactive pad. Used by Sound Book (Ch3 Soundboard, Ch16 Crescendo Beat Machine).
- **`notation-sprite`** — the 48×48 / 16×16 living notation sprites from `project_music_book_pedagogy_2026_07_04`; press-to-sound; used by Music Book.

### Chat / IDE unification (per `project_flat_paper_cards_no_fullscreen_camera_control_2026_07_04`)

The runtime shell inside a book is the same primitive as the desktop's flat-paper page: "There is exactly ONE primitive — a white sheet of paper opened on the dotted surface containing content — and the 'goodie viewer,' 'chat,' and 'IDE' are just what's inside the sheet. They all look identical." A book chapter's embedded REPL is the IDE-flavored surface, chat-that-runs-code. This means the book runtime shell and the desktop artifact shell share code — one implementation.

### Sakura-directs-the-page

Per `project_sakura_directs_the_desktop_2026_07_01` and `project_corner_flower_is_sakura_herself_2026_07_01`: when a book page loads and Sakura is available (via `,ask sakura` or the persona bridge), the BrandSakura corner flower is present, mounted in the page chrome. She reacts in-place — no arms, sway/spin/jitter — to reader interactions with the Run button, to error output, to `sakura/…` autogen calls. She never flies down onto the page.

### Runtime availability discipline

Per BOOK-01 and `specs/sakura-scheme-book-design-2026-07-10.md` § "Living tutorial requirement":

- Every code block runs.
- If the runtime isn't available in the current context, the Run button grays out with a real reason ("REPL unavailable in this context — read-only.").
- Nothing is fake. No stub outputs.

## 11. Build pipeline

Per `specs/sakura-scheme-book-design-2026-07-10.md` § "Build pipeline" and § "MD first, then translated".

### The rule

**MD first, then translated.** Every chapter is authored in Markdown at `sakura-scheme/docs/book/<NN>-chapter.md`. The HTML build reads the MD, applies the palette + Sakura decorations + runtime shell, embeds the runtime, emits static files under `sakura-scheme/site/`.

### Steps

1. `sakura-scheme/scripts/build-book.sh` reads `docs/book/*.md`, applies decoration layer, produces HTML at `sakura-scheme/site/book/`.
2. Static generator: VitePress OR custom static gen — Jess decides. **MD-first is the hard rule** (`specs/sakura-scheme-book-design-2026-07-10.md` § Build pipeline).
3. Deploy target: `lacunalabs.ai/scheme/book/` — exact path is Alfred's call.

### Current state on disk (verified 2026-07-10)

- Chapter 1 exists: `docs/book/01-hello-sakura-scheme.md`.
- Theme tokens exist: `site/theme/tokens.css`.
- Diagram kit skeleton exists: `site/theme/diagrams/examples/`.
- Cover briefs and covers exist for the four Reason Parts: `site/covers/book-of-reason-{i,ii,iii,iv}-*.html` + `.flux.txt`. The other 20 covers are not yet on disk.
- `site/apps/` exists but is empty — this is where the runtime-shell artifacts land per book.
- `site/book/` exists but is empty — this is the build output; not yet built.
- No `build-book.sh` yet; VitePress is the current build stack per AR-11 (`architect-loop-report-2026-07-10.md`).

### VitePress vs custom (per `rippling-discovering-lobster.md`)

Decisions locked in the plan:

- **Doc site: VitePress.** `docs/` becomes a VitePress site (already Vite-shaped, matches Curator's stack). MD files remain the working surface; VitePress builds them into a browsable static site with sidebar + search + version switcher.
- `scripts/build-docs.sh` runs `vitepress build`.
- `scripts/serve-docs.sh` runs `vitepress dev`.
- GitHub Actions deploys the built `docs/.vitepress/dist/` to Pages on push to `main`.

Contradiction with `architect-fix-queue.md` BOOK-02 which says "MD-to-HTML converter script" — this may point at a custom pipeline or at VitePress with a custom transformer. See §14 Open questions.

### Build gate: dead links

The build fails if any `[[…]]` link doesn't resolve (BOOK-02). The current dead-link whitelist (AR-11) specifies 13 legitimate cross-repo / stub exceptions; new dead links still fail.

### Build gate: runtime bundle

If a chapter declares `runtime.kind: sakura-scheme-repl` and `runtime.bundle: wasm`, the build must include the WASM bundle. Fallback: gray Run buttons in the emitted HTML if the bundle is absent (per § 10).

### Publish

Per `burndown-2026-07-10.md` D8 (VitePress site never built or served, `build-docs.sh` + `serve-docs.sh` exist but aren't wired), D9 (DNS + GitHub Pages config), and AR-11 (repo has no remote, `gh repo create Lacuna-Labs/sakura-scheme` is pending Alfred). The pipeline is authored; publish is blocked on repo creation.

## 12. Acceptance criteria

Every item from `architect-fix-queue.md` — BOOK-01, BOOK-02, BOOK-03, BOOK-04 (this doc), FIX-01, FIX-02, FIX-03 — is folded into the criteria below. A book is "pretty and fucking professional" when all criteria for its type pass.

### Palette criteria (all books)

Roll up FIX-03 in `architect-fix-queue.md`.

- [ ] Every chapter renders with `--magic` `#2e2167` as the top-band darker purple.
- [ ] Every chapter renders with `--canvas-mint` as center accents.
- [ ] Every chapter renders with `--plum-ink` `#1A1626` as ink (never pure black).
- [ ] Sakura-pink appears ONLY in "Sakura says" callouts and where Sakura is named as author.
- [ ] No decorative pink anywhere else (grep the emitted HTML for `sakura-pink` uses).
- [ ] Card backgrounds (where cards exist) render as softer purple gradient over `--canvas-cream` or white.
- [ ] Nothing washed out; runs against the run-panel canonical palette (FIX-03).

### Cover criteria (BOOK-01)

- [ ] 24 covers exist: one HTML at `sakura-scheme/site/covers/<slug>.html` + one Flux brief at `docs/covers/<slug>.flux.txt` per book.
- [ ] Every HTML cover renders standalone at 1600×2000.
- [ ] Every cover generates a screenshot for the doc-site index.
- [ ] Fun covers pass the "playful, Ghibli-inflected, warm" bar. Sakura visible where narrative-appropriate.
- [ ] Serious covers pass the "restrained typography, brand purple + mint, one small illustrated flourish" bar. NO cheap gradients / NO stock photos / NO clip-art.
- [ ] Every cover uses only `--magic`, `--canvas-mint`, `--plum-ink`, `--sakura-pink` (HER ONLY), and background white or `--canvas-cream`.

### Layout criteria (BOOK-02)

- [ ] Shared HTML+CSS layout exists at `sakura-scheme/site/theme/chapter.css` and `chapter.template.html`.
- [ ] MD-to-HTML converter script exists and runs the whole `docs/book/` tree.
- [ ] Chapter header: hairline mint rule + subhead in soft purple + chapter number in ligature-friendly display face.
- [ ] Running headers on interior pages: book title + chapter title.
- [ ] Body measure 68–72 chars, leading 1.6.
- [ ] Pull-quotes in soft purple.
- [ ] Code blocks in warm ink on cream, mint left-rail.
- [ ] All four sidebars render: "Sakura says" (pink), "Warning" (mint), "Tip" (top-purple), "Under the hood" (dark purple block with mint text).
- [ ] Every `[[book-slug]]` MD reference resolves to `/scheme/book/<slug>/`.
- [ ] Every `[[chapter-N]]` MD reference resolves to the anchor.
- [ ] Broken links FAIL build (verified by intentionally-broken test link that must cause build error).

### Yellow-surface diagram criteria (BOOK-03)

- [ ] SVG kit lives at `sakura-scheme/site/theme/diagrams/`.
- [ ] Kit includes: box, arrow (straight/curved/elbow), callout, dashed group, actor icon, hand-lettered label style, embedded code block, layered z-plane strokes.
- [ ] Same yellow surface (`--paper-yellow` `#F6E5B3` ish) on every diagram, every book.
- [ ] Warm-ink strokes (`--plum-ink`).
- [ ] MD extension (`::: diagram / caption / :::`) renders inline.
- [ ] 8 worked examples ship so authors can copy-adapt.
- [ ] Fun books use playful diagrams (music-note trajectory, marionette string plan, card scattering).
- [ ] Serious books use architectural diagrams (dispatcher graph, warmup schedule, ledger stitch, service-catalog map).

### Design-doc criterion (BOOK-04, this doc)

- [ ] `sakura-scheme/docs/DESIGN.md` exists and cites every source path (§ 2).
- [ ] Every source doc listed in BOOK-04 scope is absorbed with no information loss.
- [ ] Contradictions are marked OPEN, not silently resolved.

### Runtime shell criterion (BOOK-01, extended)

- [ ] Every book declares its runtime kind in chapter front-matter.
- [ ] Runtime shell mounts the declared kind per page / chapter / book scope.
- [ ] Fallback: unavailable runtime grays out the Run button with an honest reason.
- [ ] Nothing fake. No stub outputs.

### Run-panel criteria (FIX-03)

Applies to the run-detail view on Forge, which the same palette governs.

- [ ] Top band `--magic` `#2e2167`.
- [ ] Center accents `--canvas-mint`.
- [ ] Card backgrounds softer purple gradient over `--canvas-cream` or white.
- [ ] Ink warm plum, never black.
- [ ] Sakura pink HER-only.

### Sexy dropdown criterion (FIX-01)

Applies to the ledger view rendered inside E8 Lacuna Telemetry / Forge.

- [ ] Raw `resume-offset.json` fields never appear as literal text.
- [ ] Each incident/segment row: iter range + state chip (green/red) + single-line summary.
- [ ] Click expands to full detail — `<details><summary>` or D3 timeline row.
- [ ] Uses canvas-palette tokens; no raw JSON leaks through.

### Mobile-scroll criterion (FIX-02)

Applies to all book pages when rendered at phone width.

- [ ] `document.documentElement.scrollWidth <= window.innerWidth` at 390px viewport.
- [ ] No child of `<main>` has `scrollWidth > clientWidth` on its parent.
- [ ] Playwright verification at 390px (still deferred; `burndown-2026-07-10.md` F9).
- [ ] Also runs the 3-viewport ship-lock (`lacuna-labs/CLAUDE.md`): iPhone 393×852, iPad 820×1180, Desktop 1440×900. `bads: 0` on `scan-strict.js`.

### Language extraction criteria (from `rippling-discovering-lobster.md`)

Only the criteria that touch the book system directly:

- [ ] Every verb metadata blob carries `doc`, `examples` (three tiered), `contract`, `atom`, `source`, `namespace`, `since`. The book's `,help` renders exactly these fields.
- [ ] The doc-emitter reads verb metadata and produces one MD page per namespace.
- [ ] The book's chapter on the REPL (Ch 12 in the Scheme Book arc) shows every meta-command from `,help`, `,type`, `,doc`, `,arity`, `,examples`, `,source`, `,namespace`, `,search`, `,ask sakura` on down to `,save` / `,load`.

## 13. What is NOT in scope

Explicit non-goals, so future readers don't try to fold them in.

- **Language semantics.** How Scheme forms evaluate, what `define-macro` expands to, how tail calls trampoline — belongs in `docs/SAKURA-SCHEME-BOOK.md` (the language reference), not in this design doc.
- **The training procedure.** Per `project_book_canon_sixteen_2026_07_04` and `project_training_procedure_book_2026_07_04`, the Book of the Training Procedure is a META BOOK / SRE runbook; it is NOT one of the corpus 16, and this design doc governs its rendering (E6) but NOT its content.
- **Per-book pedagogy plans.** Each of the 16 canonical books has its own plan file under `docs/books/<slug>/PLAN.md` in the Curator repo; this doc does not attempt to summarize them.
- **Program counts per book.** Per `book_canon_ledger_pointer_2026_07_06`: never quote program counts from memory. The single source of truth is `docs/BOOK-CANON-LEDGER.md` on disk; re-measure before editing.
- **Public npm publication.** Held for Alfred (`burndown-2026-07-10.md` L6).
- **The Meridian repo rename.** Held for Alfred (`burndown-2026-07-10.md` G1).
- **The sakura-scheme GitHub repo creation.** Held for Alfred (`architect-loop-report-2026-07-10.md` AR-11).
- **LSP for editors.** Ships post v1.0 (`rippling-discovering-lobster.md` "Not in scope right now").
- **WASM bundle for browser REPL widget.** Ships post v1.0 (`rippling-discovering-lobster.md` "Not in scope right now"). Note the tension with § 10 which requires the WASM bundle for `runtime.kind: sakura-scheme-repl`. See §14 Open questions.
- **Package manager for verb layers.** Ships post v1.0 (`rippling-discovering-lobster.md` "Not in scope right now").
- **Fullscreen UI.** Retired doctrine per `project_flat_paper_cards_no_fullscreen_camera_control_2026_07_04`: no fullscreen mode, ever. Focus = camera zoom. This applies to book pages too — a book page is not a fullscreen surface; it lives on the world / paper primitive.
- **Program-specific Verbs catalog.** Per `rippling-discovering-lobster.md` § "Naming resolution — the Book vs the verb layers", verb catalogs live in each consumer's own `<consumer>-VERBS.md`, NOT in the Sakura Scheme Book proper.

## 14. Open questions

Where sources disagree or leave a decision explicitly deferred, the disagreement is preserved here. Each item has an owner path.

### OPEN-1 — VitePress vs custom pipeline

- `specs/sakura-scheme-book-design-2026-07-10.md` § Build pipeline: "VitePress or custom static gen (Jess decides — MD-first is the hard rule)".
- `rippling-discovering-lobster.md` § Decisions locked: "**Doc site: VitePress.**"
- `architect-fix-queue.md` BOOK-02: "MD-to-HTML converter script" — implies custom, or implies VitePress with a custom transformer for palette + runtime shell + broken-link failure.
- Resolution owner: Jess. Assumed VitePress with a custom transformer that (a) applies the palette + callout + diagram MD extensions, (b) mounts the runtime shell per chapter front-matter, (c) fails on broken `[[…]]` links.

### OPEN-2 — Number of engineering books: 8 or 9

- `specs/sakura-scheme-book-design-2026-07-10.md` § "Companion engineering books" enumerates 9 items (E1-E9), including `FORGE-1.0-ENGINEERING` at the end with the note "(this doc gets rendered too — includes tonight's canvas + arch changes)".
- `architect-fix-queue.md` BOOK-01 says "8 engineering books" and "the 16 canonical Sakura books + each of the 8 engineering books = 24 covers".
- This doc treats Forge as folded into E8 Lacuna Telemetry (24 total). If Forge should instead be a distinct E9, the cover count is 25.
- Resolution owner: Alfred (or Jess with Alfred's confirmation).

### OPEN-3 — Runtime bundle for `sakura-scheme-repl`

- BOOK-01 in `architect-fix-queue.md` requires the Scheme book to be "a live REPL on every page — read a paragraph, run the example inline, edit it, see it change."
- `rippling-discovering-lobster.md` § "Not in scope right now" lists "WASM bundle for in-browser REPL widget" as post-v1.0.
- Reconciliation: either (a) ship the WASM bundle earlier than the rippling plan currently authorizes, or (b) run the REPL through a server call (`REPL server the page calls into` per `specs/sakura-scheme-book-design-2026-07-10.md`) — which requires a running server for the book to be interactive, breaking static hosting.
- Resolution owner: Alfred.

### OPEN-4 — Where the reference-manual Challenges appendix physically lives

- `project_challenges_is_reference_appendix_2026_07_04` says Challenges is the appendix at the END of `SAKURA-SCHEME-1.0-REFERENCE.md`.
- `burndown-2026-07-10.md` D2 says split the 410 KB reference into `sakura-scheme/docs/SAKURA-SCHEME-BOOK.md` (moved) + `curator/docs/CURATOR-VERBS.md` (stub → real).
- `architect-loop-report-2026-07-10.md` AR-03 marks the physical split as BLOCKED pending Alfred's Curator CLAUDE.md policy update.
- Interim: the appendix rows are on disk as `SAKURA-SCHEME-1.0-REFERENCE.appendix-row1.md`, `.appendix-row2.md`, `.appendix-row3.md` in `~/code/sakura-scheme/docs/`. Once the split lands, they slot into the reference-manual E4 rendered book.

### OPEN-5 — Card-vs-artifact boundary within a book page

- `project_flat_paper_cards_no_fullscreen_camera_control_2026_07_04` late passage: "why aren't STORES artifacts? Composite hypothesis: maybe each dumb button is itself an artifact, and a store is a COMPOSITE set of artifacts." Not resolved.
- A book chapter is neither a card nor an artifact per the current locks; it's a static page with an embedded runtime shell.
- Implication for future work: if the artifact model absorbs stores, and the runtime shell is the same primitive as an artifact per § 10, book chapters may eventually become artifacts too. Not decided.
- Resolution owner: Alfred.

### OPEN-6 — Font stack for chapter numbers

- The palette spec calls for "chapter number in ligature-friendly display face" without naming the face.
- `tokens.css` currently ships `--font-display: "Iowan Old Style", "Palatino", "Georgia", serif` — same stack as body. This satisfies "serif with ligatures" but is not a distinct display face.
- Resolution owner: Jess.

### OPEN-7 — Voice register when Sakura speaks in Under-the-hood callouts

- `specs/sakura-scheme-book-design-2026-07-10.md` § Voice: "Warm-competent, first-person from Sakura where she narrates. Third-person when explaining the language."
- `docs/book/01-hello-sakura-scheme.md` uses first-person in the "Under the hood" callout ("every form you type…") which is neither strictly Sakura's voice nor third-person description of the language — it's second-person to the reader.
- Sample chapter 1 mixes second-person and third-person freely. The spec does not explicitly rule on second-person.
- Resolution owner: Jess. Assumed second-person to the reader is allowed anywhere, first-person Sakura-voice only in the pink Sakura-says callout.

### OPEN-8 — What counts as "runnable" in code blocks that are shell commands

- The tutorial requirement says "Every code block runs." Chapter 1 marks shell commands as `data-runnable data-lang="sh"`, which implies the runtime shell can execute a `sakura-scheme --version` shell call inline.
- Executing shell commands in a browser runtime is not straightforward. Either the runtime shell has a shell-capable backend (server-mode) or the shell blocks render as read-only (WASM-mode).
- Resolution owner: Jess. Assumed shell blocks render Run only when the runtime is in server-mode; WASM-mode grays them out with a "shell unavailable in browser" tooltip.

---

*End of DESIGN.md. Distilled 2026-07-10 by Lane D of the book-pretty pass. Update this doc as sources evolve; do not fork it.*
