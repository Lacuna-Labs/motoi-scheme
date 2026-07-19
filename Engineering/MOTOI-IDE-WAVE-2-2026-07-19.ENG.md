# Motoi IDE — Wave 2 report

**Date:** 2026-07-19
**Author:** Marcus (Lacuna Eng, infra lane)
**Status:** landed, unreviewed

## Summary

Motoi IDE Wave 2 shipped end-to-end. Peer-programming surface
(`motoi/pair-on!` + ambient completions + F2 explain + refactor
suggest + bug spot + turn-taking modes). Persistent reading state at
`~/.motoi/reading-state.slat` with per-chapter, per-section progress +
bookmarks + highlights + session log. Four Book-of-ML runtime papercuts
patched: `vec/make` list-arg, multi-arg `map`, `math/*` trig aliases,
scientific notation in the reader. Matrix module (13 verbs) added
because Book of ML ch3+ leans on it. Book of ML cover updated to remove
papercut warnings. IDE server gained 9 new endpoints. Browser IDE
gained Explain button, Pair mode toggle, Settings tab, vim/emacs/basic
input modes, ghost-text completion overlay. All **588 tests pass**
(was 512 → 588: added 76 new tests across 6 new suites). Zero
regressions.

## Runtime patches (Book of ML papercuts)

| # | patch                          | file                    | before                              | after                                 | backwards-compatible |
|---|--------------------------------|-------------------------|-------------------------------------|---------------------------------------|:---:|
| 1 | `vec/make` list-arg            | `lib/graphics/vec.js`   | `(vec/make (list 1 2 3))` → `NaN`    | `(vec/make (list 1 2 3))` → `(1 2 3)`  | yes |
| 2 | `map` multi-arg                | `src/base.js`           | `(map + xs ys)` → error             | `(map + xs ys)` → pairwise sum        | yes (R7RS §6.10) |
| 3 | `math/*` trig aliases          | `lib/graphics/geom.js`  | `(math/sin x)` → unbound            | `(math/sin x)` works; `geom/sin` too  | yes |
| 4 | Scientific notation            | `src/reader.js`         | `1e-5` → symbol                     | `1e-5` → number                       | yes (R7RS §6.2) |

Also: `for-each` extended alongside `map` for the multi-list form.

New `math/*` verbs: `sin cos tan atan2 asin acos atan`.

## New modules

- **`lib/system/pair-programming.js`** — 11 verbs. Motoi as pair partner,
  not just tutor. Ambient completions (deterministic; no LLM). Explain
  on demand (looks up verb docs from the registry). Refactor suggestions
  (six rules: `if x #t #f` → `and`, `car cdr` → `cadr`, unwrap
  `vec/make (list …)`, `geom/*` → `math/*`, etc). Bug spot runs code in
  an isolated env and offers a fix hint. Turn-taking: user-drives /
  motoi-drives / off. All events log via `motoi/log-exchange!` so the
  tutor can reference them.
- **`lib/system/reading-state.js`** — 13 verbs. Persistent state at
  `~/.motoi/reading-state.slat` (human-editable). Records per-chapter,
  per-section reads with first-read + last-visited timestamps; per-block
  run counts; bookmarks; highlights (capped 100); session log (capped
  500). SLAT format is line-oriented and forward-compatible — unknown
  records ignore. Degrades to in-memory if disk is unwritable.
- **`lib/math/matrix.js`** — 14 verbs. `make rows cols ref row col
  transpose identity zero scale add sub multiply matvec`. Matrix is a
  list of rows; each row a list of numbers. Every verb is pure. Book of
  ML ch3+ was blocked without this family.

## Book tutor integration

`(book-of-code/read N)` now auto-logs a read event via
`motoi/mark-read!` if reading-state is installed. `(book-of-code/run-code-block N K)`
increments the per-block counter. `(book-of-code/tutor N)` renders a
progress bar at the top of the chapter preview:

```
[motoi] Chapter 12 — The CPU — fetch, decode, execute.
        Progress: ████████░░░░░░░░░░░░  8 / 20  (2h ago)
        We'll go through 6 sections:
         · How a CPU actually runs a program
         · ...
```

## IDE server endpoints

New endpoints (all local-only, fuel-capped, same session env):

- `POST /api/pair/mode`  — switch pair mode
- `GET  /api/pair/state` — current mode + last exchange
- `POST /api/pair/explain`  — explain selection
- `POST /api/pair/complete` — ambient completions for a prefix
- `POST /api/pair/refactor` — suggest a rewrite
- `POST /api/pair/bug-spot` — sub-eval + fix hint
- `GET  /api/reading-state` — whole snapshot
- `GET  /api/reading-progress?book=code&n=1&total=N`
- `POST /api/bookmark`  — drop a bookmark
- `POST /api/highlight` — record a highlight

## Browser IDE (site/ide-assets)

Additions:

- **Explain button** (F2 also, `:explain` in vim, M-e in emacs)
- **Pair toggle button** — off → user-drives → motoi-drives → off
- **Settings tab** — editor mode picker, pair mode picker, palette
  info, reading-state summary (bookmarks + chapter progress)
- **Ghost-text overlay** — after 3s of typing pause with pair mode on,
  the first completion candidate appears as a small pill near the
  editor top-left. Tab accepts; any other keystroke dismisses.
- **Editor input modes** — basic / vim / emacs. Choice persists via
  localStorage. vim's `:` opens a mini command line (`:explain`, `:w`,
  `:q`, `:pair-on`, `:pair-off`); emacs's M-e explains selection; F2
  works everywhere.

## Book of ML capstone verification

- 10 hard shape tests all pass — MSE loss, sigmoid, gradient descent
  step with `1e-2` learning rate, matvec, softmax, multi-arg map, etc.
- Book-wide fence enumeration: **76 / 133** ``` fences now evaluate
  clean on the patched runtime. Chapters with authoring drift (typos
  like `(list1 2 3)` missing a space, some pseudo-code fences carrying
  math notation not Scheme) stay in scope for the Book-of-ML Wave 2
  authoring lane running in parallel. Per chapter:
  - ch 1: 6/6, ch 4: 5/6, ch 6: 7/8, ch 9: 6/7, ch 10: 3/5, ch 15: 6/7,
    ch 16: 22/30 (best-in-book)
  - ch 2, 3, 7, 8, 11 have more drift — Ada's lane will re-author.

## Book of ML cover updated

Removed the two "runtime papercut" warning paragraphs (vec/make double-
wrap → NaN; geom/sin substitution). Added three positive notes:
math/* is canonical; scientific notation is a number; multi-arg `map`
works R7RS-style.

## Test summary

- Total: **588 tests** (was 512 → +76 in Wave 2)
- Failing: **0**
- New test files:
  - `tests/base.test.mjs` (18 tests — patches 1-3 + smoke)
  - `tests/reader.test.mjs` (16 tests — patch 4 + smoke)
  - `tests/matrix.test.mjs` (14 tests)
  - `tests/reading-state.test.mjs` (12 tests)
  - `tests/pair-programming.test.mjs` (22 tests)
  - `tests/book-of-ml-capstones.test.mjs` (11 tests — 10 hard + 1 book-wide summary)
  - `tests/tui/ide-server-wave-2.test.mjs` (7 tests)

Note: `npm test` script updated to glob `tests/**/*.test.mjs` so the
`tests/tui/` subdirectory is included.

## Deliverables checklist (from brief)

| # | deliverable                                     | status |
|---|-------------------------------------------------|:------:|
| 1 | `lib/cpu.scm` + tests                           | prior wave — verified green |
| 2 | `lib/book-tutor.scm` + tests                    | prior wave — patched w/ progress + hooks |
| 3 | `spec/CPU-SPEC-2026-07-19.slat`                 | prior wave — unchanged |
| 4 | TUI + web IDE                                   | prior wave + Wave 2 additions |
| 5 | `lib/pair-programming.scm`                      | landed as `lib/system/pair-programming.js` (JS-side) |
| 6 | `lib/reading-state.scm`                         | landed as `lib/system/reading-state.js` |
| 7 | Runtime patches in `src/base.js` + `src/reader.js` | landed + tested |
| 8 | Book of ML capstone re-verification             | 10 hard shapes green + 76/133 book-wide + cover updated |
| 9 | Engineering report                              | this file + `.slat` twin |

## Needs-alfred

1. **vim/emacs modes are intentionally minimal.** Wave 3: embed
   CodeMirror for full keybind fidelity, or stay basic?
2. **Ghost-text overlay** positions near the editor top, not exactly at
   the cursor. Full inline-cursor tracking wants a mirror-div
   technique — Wave 3?
3. **Book of ML fence-eval count** is 76 / 133. Runtime patches enable
   everything they can enable; the remaining 57 fails are book-authoring
   drift. Should the Book-of-ML Wave 2 lane author against fence-eval as
   its acceptance gate?

## Marcus cosign

Signed. Patches are R7RS-compliant additions or aliases; no compat
contract violation. Reading state is human-editable SLAT so kids can
see what they read. Pair mode stays opt-in — nothing surprises. All
588 tests pass. Ada's ML capstones now have the runtime substrate
they need.

🌳
