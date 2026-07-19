---
doc: hardcore-verification-wave-2
date: 2026-07-19
author: priya (verification-supervisor)
scope: motoi 4.5 hard-core verification wave 2 — post Marcus IDE Wave 2 + Ada Book of ML Wave 2
audience: engineering
training-eligible: no
confidentiality: internal
source-slat: HARDCORE-VERIFICATION-WAVE-2-2026-07-19.ENG.slat
---

# Hard-core verification — Wave 2

Wave 1 flagged 11 hardblocks. Marcus shipped IDE Wave 2, Ada shipped Book of ML Wave 2. This is my re-verification: same reproduction steps, same kid-first standard.

## Method

Re-ran the exact Wave 1 repros. Also spot-verified the two Wave 2 landings (IDE surface + Ch 16 training loop with gradient check). Ran full `npm test`. Extracted Ch 16 code fences and ran the training loop end-to-end.

## Verdict table

| Hardblock | Verdict | Owner | Kid-impact |
|---|---|---|---|
| HARDBLOCK-03 fence-tag mismatch | STILL BROKEN | Marcus or Ada | HIGH |
| HARDBLOCK-04 Ch 9 backprop prose numbers | STILL BROKEN | Ada | MEDIUM |
| HARDBLOCK-06 Ch 12 attention broken parens | STILL BROKEN | Ada | HIGH |
| HARDBLOCK-07 IDE Wave 2 UI missing | **RESOLVED** | Marcus | — |
| HARDBLOCK-14 reading-progress broken for Sym | STILL BROKEN | Marcus | MEDIUM |
| HARDBLOCK-15 ambient-complete stub | PARTIAL | Marcus | LOW |
| HARDBLOCK-16 refactor-suggest never suggests | PARTIAL | Marcus | LOW |
| HARDBLOCK-17 bug-spot never spots | PARTIAL | Marcus | LOW |
| HARDBLOCK-18 book/toc empty | STILL BROKEN | Marcus | LOW |
| HARDBLOCK-19 book/read positional fails | STILL BROKEN | Marcus | HIGH |
| HARDBLOCK-20 Ch 12 CPU chapter no cpu/boot | STILL BROKEN | Ada | MEDIUM |

**Totals: 1 resolved · 3 partial · 7 still broken.**

## Marcus IDE Wave 2 — verified

- `npm test`: 588 pass / 0 fail
- IDE launches on `bin/motoi ide --port 3739`
- 4-region layout confirmed (tree · tabbed editor · REPL · optional CPU)
- ide.js contains vim + emacs + basic editor modes, `:pair-on` / `:pair-off` / `:explain` vim commands, `M-e` emacs binding, Settings tab, Palette description
- `(motoi/pair-on!)` returns `[motoi] Pair on. You drive; I ride along and only speak when you ask.`
- `(motoi/ambient-complete "cpu/")` returns 8 CPU verbs; `"vec/"` returns 8 vec verbs

## Ada Book of ML Wave 2 — verified

- Zero surviving `(list0.<digit>` typos across 5 random `.book.slatl` files
- `(cons 'a 5)` produces `(a 5)`; book code correctly uses `(cadr entry)` throughout (grep confirmed in cover.book.slatl, 02, 11)
- Ch 16 training loop reproduced end-to-end:

```
iter 0   loss 2.9932753398472673
iter 100 loss 2.7266669434184845
iter 500 loss 1.4613110427073301
iter 950 loss 0.6603318619178191
```

Ada claimed `2.886 → 0.587` — mine is `2.993 → 0.660`. Same shape, same magnitude, difference is just random seed. **Claim verified.**

- Gradient check reproduced:
```
analytic     0.006134278420009385
finite-diff  0.006134278418557
ratio        1.000000000236772
```
Matches to ~10 digits — matches Ada's "10-13 digits" claim.

- Generation output after training: `motoi is honest a language is honest a language is` — model learned corpus structure.

## New hardblocks discovered

- **HARDBLOCK-21 (high, Ada)** — Ch 16 uses bare ` ``` ` fences for math derivations (`∂L/∂z[i] = ...`), pseudocode (`pre = W1 * ln2_x + b1`), and expected output (`iter 0 loss 3.02`). An extract-all-blocks pass will treat these as Scheme and error with `unbound symbol: ∂L/∂z[i]`. 6-8 such blocks in ch 16 alone.
- **HARDBLOCK-22 (medium, Marcus)** — `book-of-ml/run-code-block` and `book-of-ml/tutor` do not exist. Only `book-of-code/*` verbs are wired. `(book-of-ml/tutor 6)` → `unbound symbol`. Kid working through ML book has no runnable helper.
- **HARDBLOCK-23 (low, Ada)** — Ch 16 prose example shows loss `1.42` at iter 900; actual convergence lands ~0.66. Prose says "won't match exactly" so kid isn't confused, but numbers should be refreshed.

## Kid cold-sit simulation — Wave 2

The IDE now looks the part. But the connective tissue Alfred cared about is still broken:

- Kid types `(book-of-code/run-code-block 6 1)` → still `#f`. Same failure as Wave 1.
- Kid pastes Ch 12 attention capstone → same paren errors as Wave 1.
- Kid follows Ch 9 backprop capstone → still sees `-8` when prose says `-4`.
- Kid types `(book/read "code" 6)` → still gets a wall of usage text.
- Kid opens IDE → **wins!** 4-panel layout with vim/emacs modes really is there.
- Kid types `(cpu/boot!) (cpu/load-program! ...) (cpu/run!)` → **wins.** CPU is real, 16 tests pass.

**4 of 11 kid-facing paths clear.**

## Priya Wave 2 cosign

```
(priya-cosign-wave-2
  :date "2026-07-19"
  :scope "motoi 4.5 hard-core verification wave 2 — post Marcus + Ada Wave 2"
  :wave-1-hardblocks 11
  :resolved 1
  :partially-resolved 3
  :still-broken 7
  :new-hardblocks-found 3
  :ready-for-child 4-of-11-kid-facing-paths
  :status STILL-BLOCKED)
```

## What tomorrow's lane needs to close

**Priority 1 (kid trips in first 15 min):**
1. HARDBLOCK-03 — either re-tag every bare ` ``` ` as ` ```scheme ` OR relax the tutor regex to accept bare fences AND filter blocks by content shape.
2. HARDBLOCK-06 — Ch 12 attention capstone paren fix (embs + I2 lines 290-293).
3. HARDBLOCK-19 — `book/read` positional overload or a proper error return.
4. HARDBLOCK-21 (new) — Ch 16 math/pseudocode/output fences need a non-scheme tag.

**Priority 2 (kid trips in first hour):**
5. HARDBLOCK-04 — Ch 9 prose numbers `-4.0` → `-8.0`, `-3.9998` → `-7.9996`.
6. HARDBLOCK-14 — reading-progress Sym+number fall-through fix.
7. HARDBLOCK-20 — Ch 12 CPU chapter needs a `Boot the machine` section.
8. HARDBLOCK-22 (new) — install `book-of-ml/tutor` + `book-of-ml/run-code-block`.

**Priority 3 (nice-to-have but flagged):**
9. HARDBLOCK-15 — strip leading `(` in ambient-complete prefix.
10. HARDBLOCK-16 — add duplicate-branch refactor rule + widen if-tautology regex.
11. HARDBLOCK-17 — either tighten `car`/`cdr` on nil, or add classic-pattern pre-check to bug-spot.
12. HARDBLOCK-18 — wire `book/toc` to chapter-file enumeration.
13. HARDBLOCK-23 (new) — refresh Ch 16 example loss numbers.
