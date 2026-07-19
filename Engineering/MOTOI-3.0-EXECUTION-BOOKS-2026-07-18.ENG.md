# MOTOI-3.0-EXECUTION-BOOKS

- **Doc**: MOTOI-3.0-EXECUTION-BOOKS
- **Date**: 2026-07-18
- **Author**: Ada (execution mode, per Alfred approval of MOTOI-3.0-GAP-CLOSURE-PLAN-2026-07-18)
- **Audience**: Alfred, Motoi 3.0 fold pipeline, Priya cosign review
- **Status**: **COMPLETE** — book-edits phase, ready for fold + Priya cosign of subsystem-limit pairs

**Composes with:**
- Plan: `engineering/MOTOI-3.0-GAP-CLOSURE-PLAN-2026-07-18.ENG.slat`
- Doctrines: brutal-honest-subsystem-limit, no-contaminants-provenance, motoi-admits-limits-wittgenstein, motoi-personality, motoi-no-tools-no-internet, motoi-core-verbs-frozen, verify-disk-not-memory

## Executive Summary

Executed book-edits section of MOTOI-3.0-GAP-CLOSURE-PLAN exhaustively. All 12 target books edited per per-gap prescriptions. 16-chapter invariant preserved (zero new chapters added; only in-place expansion of existing chapters + appendices). Provenance chains updated on every touched record with `:edit-source` pointing at the plan. No new verbs invented; all examples use CORE verbs per motoi-core-verbs-list and MOTOI-SCHEME-REFERENCE.

Alfred's two pre-approved decisions applied:
- **paint-cell arity**: `(paint-cell x y color)` authoritative (Ada's recommendation, book-of-animation form).
- **book-of-music ch01 bare tone**: Option A executed — 314 invocations rewritten to `(audio/play 'tone freq dur)`.

Constraint respected: **no subsystem-limit graph seed authored here** — parallel agent handles graph. Book paragraphs authored to carry the subsystem-limit story (networking, systems, appendix-G, introspection 16.12). When the parallel graph seed lands, pair-generation will trace through both graph nodes AND these book paragraphs.

All 16 edited files pass paren-balance sanity check (depth 0).

## Files Edited (16 total)

### Gap 1: Fibonacci base-case bug

| File | Change | Est. add |
|------|--------|----------|
| `scheme-books/book-of-scheme/07-recursion.book.slatl` | Worked table of 8 fib values, common-mistake sidebar (0-bug + 1-bug), cond variant, fib-fast + fib-nl + fib-memo, Fibonacci checklist | ~150 lines |
| `scheme-books/book-of-challenges/ch01-recursion-warmups.book.slatl` | Fibonacci first-eight-values reference, FIX-IT challenge (return-0 bug), FIX-IT challenge (return-1 bug), verify-fib challenge | ~90 lines |

### Gap 2: Graphics verb confabulation

| File | Change | Est. add |
|------|--------|----------|
| `scheme-books/book-of-animation/ch01-surface.book.slatl` | New §1.13 (filled circle: for-each + recursive + higher-order forms), new §1.14 (circle outline + common-mistakes sidebar) | ~180 lines |
| `scheme-books/book-of-animation/appendix-verbs-cookbook.book.slatl` | paint-cell canonical entry with 5 worked examples, anti-pattern sidebar (6 wrong forms), paint-cell/grid/dot reconciliation | ~130 lines |
| `scheme-books/book-of-scheme/02-move-something.book.slatl` | 'Two names, one idea: grid/dot and paint-cell' section anchoring both verbs | ~15 lines |

### Gap 3: Sound/music verb confabulation

| File | Change | Est. add |
|------|--------|----------|
| `scheme-books/book-of-music/ch03-note.book.slatl` | New §3.0 'The four ways to make a sound in Motoi' with 6-row reconciliation table, 5 middle-C variants, bare-tone dialect note, common invented forms sidebar | ~90 lines |
| `scheme-books/book-of-music/ch01-surface-of-sound.book.slatl` | **OPTION A executed**: 314 bare `(tone ...)` invocations rewritten to `(audio/play 'tone ...)`. Header note added. Backup at `.pre-3.0-bak` | +15 lines header, ~314 substitutions |
| `scheme-books/book-of-scheme/12-composing-sound.book.slatl` | New 'Every way to play middle C' section: 8 canonical variants + explicit note on `(tone freq dur)` NOT being CORE | ~40 lines |
| `scheme-books/book-of-scheme/01-hello-and-a-sound.book.slatl` | Added 'The most important note in the world' kid-callout — canonical middle-C form | ~12 lines |

### Gap 4+5: Subsystem limits (BOOK PARAGRAPHS ONLY — graph seed authored in parallel)

| File | Change | Est. add |
|------|--------|----------|
| `scheme-books/book-of-computing/08-networks-and-tcp-ip.book.slatl` | New §8.9 'Why Motoi can't fetch, and what he does instead' with full 5-element structure, fish-in-car metaphor, cross-references | ~130 lines |
| `scheme-books/book-of-systems/02-what-copilot-does-not-know.book.slatl` | Full subsystem-by-subsystem walkthrough (14 subsystems, uniform 5-element shape per entry) + meta-section + Scheme-refuses-vs-request-refuses distinction | ~280 lines |
| `scheme-books/book-of-scheme/appendix-G-where-next.book.slatl` | New 'Where Motoi does not go' closing section — kid-facing story with fish-in-car metaphor, Wittgenstein anchor, cross-refs | ~70 lines |
| `scheme-books/book-of-introspection/16-safe-introspection.book.slatl` | 16.12 stub expanded into full engineering-audience section: subsystem-presence protocol, 14-subsystem enumeration, cart auditing pattern, subsystem-unavailable error record schema | ~150 lines |

### Gap 6: Verb-composition drift

| File | Change | Est. add |
|------|--------|----------|
| `scheme-books/book-of-arcade-games/appendix-l-12-micro-games-in-30-lines-each.book.slatl` | 6 new micro-games (13-18): move-stop-right, move-while-held, roll-and-stop, thrust-drift-stop, glide-to-target, patrol. Plus 'read the prompt, don't drift' meta-section | ~200 lines |
| `scheme-books/book-of-composition/16-composing-games.book.slatl` | New §16.14 (multi-constraint pattern in 4 steps + worked example), §16.15 (drift detection + recovery + example), §16.16 (prompt-fidelity skill) | ~180 lines |
| `scheme-books/book-of-scheme/appendix-D-common-patterns.book.slatl` | New 'Move-until-condition — the two-constraint entity pattern' entry with 3 worked examples | ~65 lines |

## Pair-Yield Estimates

| Gap | Est. book-derived pairs | Notes |
|-----|-------------------------|-------|
| 1. Fibonacci | ~160 | (plan estimated 150) |
| 2. Graphics confabulation | ~400 | (plan: 390) |
| 3. Sound confabulation | ~305 | (plan: 300) |
| 4+5. Subsystem limits (BOOKS ONLY) | ~900 | (plan: 2,100 total; ~1,200 pending graph seed) |
| 6. Composition drift | ~370 | (plan: 370) |
| **TOTAL book-derived** | **~2,135** | |
| Graph-derived (when parallel seed lands) | ~1,200 | |
| **Grand total v4 contribution** | **~3,335** | matches plan estimate |

Corpus growth:
- v3 (Motoi 2.0): 100,872 pairs
- v4 (Motoi 3.0): ~104,207 pairs (+3.3%)

## NEEDS-ALFRED Items

**None deferred as blocked.** Two decisions the plan flagged were already resolved by Alfred before execution:

1. `paint-cell` CORE promotion vs demote-to-legacy — plan flagged; execution is compatible with either eventual choice. Books teach `(paint-cell x y color)` as canonical, appendix-verbs-cookbook explicitly names anti-patterns. Whichever way Alfred resolves the CORE-list entry, no book edit invalidated. **NEEDS-ALFRED-DECISION preserved but not blocking.**
2. `book-of-music ch01` Option A vs B — Alfred pre-approved A; executed.

**One minor drift from the plan** worth flagging:

3. The plan §5 anticipated the subsystem-limit graph seed authored SIMULTANEOUSLY with book edits. Per this run's constraint ('another agent is authoring subsystem-limit graph seed in parallel'), the graph seed portion was NOT authored here. Book edits stand alone as book-paragraph-only content. When the graph seed lands, pair-generation traces through both. The book paragraphs already cite the expected graph node structure (`system/has?`, `system/limit-info`) so that when the graph seed is complete, the introspection API described in `book-of-introspection` 16.12 will match.

4. No provenance chain violations. Every added record cites `:edit-source "MOTOI-3.0-GAP-CLOSURE-PLAN-2026-07-18"` plus source-book provenance history. Chain terminates at graph OR book per tightened rule.

## Fold-Readiness Status

**BOOK PORTION: READY FOR FOLD.**

- All 16 files present on disk, paren-balanced (verified via bracket-balance script).
- Provenance metadata updated per plan.
- No CORE-verb-signature drift (freeze respected).
- Content-rating `:G` preserved throughout.
- `training-eligible` flags left as they were per source books (all `#t`).
- 16-chapter invariant preserved (no new chapters added).

**BLOCKING FOR FULL v4 CORPUS:**

- Subsystem-limits graph seed at `/Users/alfred/code/curator/objects/graph-of-do-and-dont/seeds/motoi-subsystem-limits.slat` must land before the ~1,200 graph-sourced pairs can be extracted.
- Priya cosign required on subsystem-limit pair extraction per plan §5.

**Fold-pipeline step modifications needed:**

- Extract Q→A pairs from all 16 edited files as normal.
- When graph seed lands, pair-generation should join book paragraphs with graph nodes (per no-contaminants provenance rule: source = graph OR book).
- Anti-pattern pairs (paint-cell wrong forms, sound verb wrong forms) should be extracted as CONTRAST pairs, not RECALL pairs — they teach what does NOT exist, a training signal in its own right.

**Reveal Mk 3 probe updates:**

- 6-axis probe suite unchanged.
- Add subsystem-limits probe category (14 subsystems × 3 phrasings = 42 probes) per plan §10. Book edits provide substrate; probe suite verifies landing.
- Add fibonacci fix-it probe (feed the buggy version, ask for fix; verify model returns `(if (< n 2) n ...)` or equivalent).
- Add circle-drawing probe (ask for filled red circle; verify model uses `(paint-cell x y color)` in a nested loop, not `cell/at` or `paint-cell` with pos).
- Add middle-C probe (ask for middle C; verify model uses one of the 5 canonical forms, not bare `tone`).

## Doctrine Compliance Checklist

- [x] Motoi hermetic: all content teaches Motoi's own capability surface.
- [x] No tools, no internet: reinforced across §8.9, ch02 subsystem-walk, 16.12, appendix-G.
- [x] 335 CORE verbs frozen: no new verb names invented.
- [x] Books over new books: zero new books; zero new chapters.
- [x] SLAT canonical: all edits target `.slatl` files.
- [x] Sakura-inheritance notes: preserved from plan; Sakura authoring done separately.
- [x] No safety-refusal template weakening: subsystem-limits ADD to wave-6/8, do not modify.
- [x] Consistency-is-safety-feature: uniform 5-element template throughout.
- [x] Priya-cosign flagged for subsystem-limit content.
- [x] STOP-fake-completion: this report enumerates SPECIFIC files, SPECIFIC line-counts, SPECIFIC verification — no 'wired!' claims.

## Disk Verification (per feedback_verify_disk_not_memory doctrine)

- Reference verified: `/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat` (18,525 lines).
- Book paths verified: all 12 book directories exist under `scheme-books/`.
- Each target chapter existed on disk before edit; no fabrication of paths.
- Every edit re-Read after write? No — used Edit tool which errors on mismatch. Where mass substitution required (bare `tone` rewrite), used a Python script with a backup, then greppy verification of remaining occurrences before proceeding.

## Execution Notes

- Time to author: ~2.5 hours agent-time.
- Files created: **0** (per rule of ramp; edits only).
- Files backed up: 1 (`book-of-music/ch01-surface-of-sound.book.slatl.pre-3.0-bak`).

## Status

**book-edits COMPLETE**; awaiting parallel graph-seed + Priya cosign for full fold.
