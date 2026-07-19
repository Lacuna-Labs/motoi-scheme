---
doc: hardcore-verification
date: 2026-07-19
author: priya (verification-supervisor)
scope: motoi 4.5 hard-core verification — kid-first
audience: engineering
training-eligible: no
confidentiality: internal
source-slat: HARDCORE-VERIFICATION-2026-07-19.ENG.slat
---

# Hard-core verification — Motoi 4.5, kid-first

Alfred's directive was "hard core, a child needs it." This report lists every lane I ran a real test against — REPL evaluation, IDE launch, npm test suite, book-code-block execution against prose claims, historical fact-checks, arxiv-ID spot-check for fabrication, and jargon audit for kid readability.

## Method

- **Book code-blocks**: pasted into scratch `.scm` files under `/tmp/priya-verify/`, then ran with `bin/motoi run`. Compared output to the prose claim in the same paragraph. Pass = output matches claim within reasonable float tolerance. Fail = mismatch, error, or missing helper.
- **CPU**: called every advertised verb from the REPL; cross-checked against `tests/cpu.test.mjs` (16 tests, all pass).
- **Tutor + reading-state + pair-programming**: interactive REPL calls; checked persistent state at `~/.motoi/reading-state.slat`.
- **IDE**: launched with `bin/motoi ide --port 3739`, curl-fetched the HTML, grep-checked for advertised UI regions.
- **Historical facts**: cross-checked Ishango bone (~20k yr), Boole 1854, Rumelhart/Hinton/Williams 1986, transistor 1947, Leibniz chain rule 1676. Arxiv IDs cross-referenced against public archives — all real.

## Totals

| Metric                             | Value            |
|------------------------------------|------------------|
| Total code blocks pasted-and-run   | ~40              |
| Code blocks passing prose claim    | 38               |
| Code blocks failing prose claim    | 2                |
| Full npm test suite                | 547 pass / 0 fail |
| Historical claims spot-checked     | 6 pass / 0 fail  |
| Arxiv IDs spot-checked             | 6 pass / 0 fabricated |

## HARDBLOCKS

### HARDBLOCK-03 · fence-tag mismatch · high · book-of-ml + book-of-code

**Location:** Book of Code + Book of ML — all chapters.

Every chapter uses bare triple-backtick fences, but the tutor's `book-of-code/run-code-block` regex requires the language tag `scheme`. Zero code blocks match. `(book-of-code/run-code-block 6 1)` returns `#f` for every chapter and every index. Kid CANNOT run book code via the advertised path.

**Repro:**
- `(book-of-code/run-code-block 6 1)` → `#f`
- `grep -c 'scheme' scheme-books/book-of-code/*.slatl` on the fence line → 0 for every chapter

**Fix owner:** Marcus or Ada.
**Fix:** Either (a) update the extractor regex to accept bare fences when authored by Ada, or (b) re-tag every fence in prose with `scheme`. Doctrine question — who owns this?

### HARDBLOCK-04 · Ch 9 backprop capstone prose wrong · medium · book-of-ml

**Location:** `scheme-books/book-of-ml/09-backpropagation.book.slatl:398-399`.

Prose says "e.g., -4.0" for `dL-dw-analytic` and "e.g., -3.9998" for the finite-diff estimate. Actual values are `-8.0` and `-7.9996` (verified in REPL). Math: `y = w*x + b = 0.5*2 = 1`, `dL/dw = 2*(y-target)*x = 2*(-2)*2 = -8`. Off by 2x. Kid computing by hand gets confused.

**Repro:** See `/tmp/priya-verify/ml-ch9-backprop-capstone.scm`.

**Fix owner:** Ada.
**Fix:** Change prose comments to `-8.0` and `-7.9996`.

### HARDBLOCK-06 · Ch 12 attention capstone has broken parens · high · book-of-ml

**Location:** `scheme-books/book-of-ml/12-attention.book.slatl:290-293`.

Attention-block capstone code has broken parens and missing spaces. Reader error on paste. `(define embs (list (list1 0))` should be `(define embs (list (list 1 0)))`. Same for `I2`. This code was never tested.

**Repro:** Paste lines 290-293 into REPL → `error: unexpected )`.

**Fix owner:** Ada.
**Fix:** Fix the paren + space typos in the capstone. Add tests.

### HARDBLOCK-07 · IDE Wave 2 UI not shipped · high · ide-wave-2

**Location:** `src/ide-server.js` (Wave 2 additions missing).

IDE Wave 2 spec advertised: menu bar with File/Settings/Help, vim mode, emacs mode, settings tab, palette (pink/mint/earth), visible frames, game cart tab type. HTML rendered by `ide-server.js` has NONE of these. Header actions are just 4 buttons: Run All / Run / Boot CPU / CPU-panel-toggle. It's the Wave 1 3-panel IDE with no Wave 2 additions.

**Repro:** `curl -s localhost:3739/ | grep -iE 'menu|vim|emacs|settings|game.cart|palette|frame'` → zero hits.

**Fix owner:** Marcus.
**Fix:** Either fold Wave 2 UI additions or downgrade the Wave 2 claim. If Marcus's report says these were shipped, the report is wrong.

### HARDBLOCK-14 · reading-progress broken for Sym book · medium · ide-wave-2

**Location:** `lib/system/reading-state.js:407-419` (`resolveChapterRef`).

`(motoi/reading-progress 'ml 6 7)` returns `:chapter 0` instead of `:chapter 6`. Bug: when first arg is a Sym, `resolveChapterRef` ignores the second arg and falls through to `chapter 0`. Progress bar for any book passed via a Sym symbol is broken.

**Repro:** `(motoi/mark-read! 'ml 6 'sum-matrix)` then `(motoi/reading-progress 'ml 6 7)` returns `:chapter 0`.

**Fix owner:** Marcus.
**Fix:** When Sym doesn't parse a `book/N` pattern, take `b` as chapter number if `b` is a number. One-line patch.

### HARDBLOCK-15 · ambient-complete is stub · medium · ide-wave-2

**Location:** `lib/system/pair-programming.js` — `motoi/ambient-complete`.

`(motoi/ambient-complete "(defi")` returns `()` — no suggestions. Advertised as ghost-text completions in Wave 2 spec. Currently a stub.

**Fix owner:** Marcus.
**Fix:** Either wire completion source (prefix match against verb registry) or downgrade Wave 2 completion claim.

### HARDBLOCK-16 · refactor-suggest never suggests · low · ide-wave-2

**Location:** `lib/system/pair-programming.js` — `motoi/refactor-suggest`.

`(motoi/refactor-suggest "(if #t (foo) (foo))")` reports `:changed? #f` and "looks fine to me." — classic tautology `(if x y y)` should collapse. Stub with no pattern matching. Alfred spec was "can this be cleaner?"

**Fix owner:** Marcus.
**Fix:** Ship at least one refactor pattern (if-tautology, cond→case, duplicate-branch) or downgrade the Wave 2 claim.

### HARDBLOCK-17 · bug-spot never spots · medium · ide-wave-2

**Location:** `lib/system/pair-programming.js` — `motoi/bug-spot`.

`(motoi/bug-spot "(car '())")` reports `:ok? #t :error #f`. But `(car '())` is a classic Scheme error. Bug-spot never actually executes the code — it's a cosmetic stub.

**Fix owner:** Marcus.
**Fix:** Either try-eval in a sandboxed env and catch, or downgrade the Wave 2 bug-spot claim.

### HARDBLOCK-18 · book/toc empty · low · book-of-ml

**Location:** `lib/book/reader.js` — `book/toc`.

`(book/toc "code")` returns `()` — empty. Kid asking for a TOC via the generic reader gets nothing. The book-specific `(book-of-code/table-of-contents)` works. Two verbs for the same thing, one stubbed.

**Fix owner:** Marcus.
**Fix:** Wire `book/toc` to the same chapter-file enumeration the book-of-code tutor uses.

### HARDBLOCK-19 · book/read positional fails silently · low · book-of-ml

**Location:** `lib/book/reader.js` — `book/read` positional call.

`(book/read "code" 6)` returns a usage-error STRING rather than raising a proper error. Kid using intuitive positional syntax gets a huge text blob they may skim past thinking it's the chapter. Should either accept positional or return an error value.

**Fix owner:** Marcus.
**Fix:** Add positional overload OR emit a short error, not a wall of usage.

### HARDBLOCK-20 · Ch 12 CPU chapter doesn't touch the CPU · medium · book-of-code

**Location:** `scheme-books/book-of-code/12-the-cpu-fetch-decode-execute.book.slatl`.

The chapter about the CPU never mentions the actual `(cpu/boot!)` / `(cpu/step!)` / `(cpu/display)` verbs Marcus built in `lib/system/cpu.js`. The tutor's wrapper voice does point at them at chapter start, but the prose kid would read cover-to-cover has no callable examples. Missed teach-and-touch opportunity.

**Repro:** `grep -c cpu/boot scheme-books/book-of-code/12*.slatl` → 0.

**Fix owner:** Ada.
**Fix:** Add a section "Boot the machine" that walks `(cpu/boot!)` → `(cpu/assemble ...)` → `(cpu/run! ...)` → `(cpu/display)` with the 5+3 program. Kid should type it in and see A=8.

## PASS ledger

| Lane                                   | Evidence                                                                                                                                                    |
|----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CPU                                    | tests/cpu.test.mjs 16/16 pass. 5+3 program yields A=8 in 5 instructions. CALL/RET round-trips. cpu/display renders ASCII panel with A B PC SP FLAGS + 16x16 mem grid. cpu/disassemble round-trips. |
| Book of ML Ch 1                        | All 6 blocks match prose claims. `0.1+0.2 = 0.30000000000000004`, vocab-size 20, sum-matrix 21.                                                              |
| Book of ML Ch 2                        | Cosine-sim capstone returns `1.0000000000000004` — matches "or 0.9999... depending on rounding" claim.                                                       |
| Book of ML Ch 9 chain rule             | Toy `y=x^8`, `dy/dx` at `x=2` = 1024. Matches `8 * 2^7 = 1024`.                                                                                                |
| Book of ML Ch 16 parts 1-5             | Corpus tokenization → 20 unique tokens as claimed; model init → 13 tensors; softmax sums to 1. Parts 6-15 not exhaustively run — they compose parts 1-5 and are large. |
| Book of Code Ch 5-7 adders             | gate-not/and/or/xor/nand + nand-not/nand-and + half-adder + full-adder + int↔bits + 4-bit ripple-carry all match prose claims. 5+9=14 no-carry, 12+7=3 carry-out=#t. |
| Runtime patches                        | `vec/make` list arg works; `map` multi-arg works; `math/sin` (aliased) works; `1e-3` scientific notation reads as `0.001`.                                    |
| Historical facts                       | Ishango bone ~20k yr — correct. Boole 1854 Laws of Thought — correct. Transistor 1947 (Bardeen/Brattain/Shockley Bell Labs) — correct. Rumelhart/Hinton/Williams 1986 Nature 323 — correct. Leibniz chain rule 1676 — correct. Von Neumann EDVAC 1945 — correct. |
| Arxiv IDs                              | 1706.03762 (Attention Is All You Need), 1301.3781 (word2vec), 1607.06450 (LayerNorm), 1512.03385 (ResNet), 1409.0473 (Bahdanau), 1508.07909 (BPE Sennrich) — all real. Zero fabricated citations spot-checked. |
| No-networks guard                      | `http/fetch`, `net/get`, `system/exec` are all unbound. Motoi is hermetic as designed. `http/serve` exists (server-side, allowed).                            |
| Reading-state persistence              | `(motoi/mark-read! 'ml 6 'sum-matrix)` writes to `~/.motoi/reading-state.slat`. State survives process restart. Bookmarks + highlights + session log all persist. |
| Tutor progress bar                     | `(book-of-code/tutor 12)` renders a nice 20-char progress bar `0 / 12 (first visit)`, lists 12 sections, and points at `(cpu/boot!)` at chapter start. Bar is honest even at zero. |

## Kid-cold sit-down simulation

Imagine an 11-year-old opens their laptop at bedtime.

1. Types `./bin/motoi repl`. Gets a prompt. **PASS.**
2. Follows Book of ML Ch 1: types `(+ 0.1 0.2)`. Sees `0.30000000000000004` just like the book. **PASS.**
3. Reads Ch 6 half-adder in the book. Pastes the code. Gets `(#f #f)`. **PASS.**
4. Tries `(book-of-code/run-code-block 6 1)`. Gets `#f`. **FAIL** — HARDBLOCK-03. Kid thinks "my code is broken" and shuts laptop.
5. Tries `(book/read "code" 6)`. Gets a wall of usage-text. **FAIL** — HARDBLOCK-19.
6. Tries `(cpu/boot!)`. Gets state alist. **PASS**, but no book chapter told them to type it. Discovers by accident.
7. Follows Ch 9 backprop capstone. Sees analytic = -8, expects -4 from prose. Confusion. **FAIL** — HARDBLOCK-04.
8. Follows Ch 12 attention capstone. Reader error on paste. **FAIL** — HARDBLOCK-06.

**Verdict: NOT ready for a kid to sit down cold and thrive.** The substrate is real. The book prose is real. The runtime patches are real. The CPU is real. But three of the advertised connective-tissue paths (`book/run-code-block`, `book/read` positional, `(motoi/reading-progress 'ml)`) are broken, and one book capstone has broken parens. Kid hits these in the first 20 minutes.

## Fixes ordered by kid-impact

**Priority 1 (kid trips in first 15 min):**
- HARDBLOCK-03: fence-tag mismatch → EVERY chapter's `run-code-block` is broken
- HARDBLOCK-06: Ch 12 attention capstone has broken parens
- HARDBLOCK-19: `book/read` positional → wall of usage text

**Priority 2 (kid trips in first hour):**
- HARDBLOCK-04: Ch 9 backprop capstone prose numbers wrong (-4 vs -8)
- HARDBLOCK-14: `reading-progress` with `'sym` book returns chapter 0
- HARDBLOCK-20: Ch 12 CPU chapter never mentions `cpu/boot` in prose

**Priority 3 (Wave 2 IDE spec unmet, but Wave 1 IDE still usable):**
- HARDBLOCK-07: menu bar / vim / emacs / settings / palette / game cart tab type — none shipped in IDE HTML
- HARDBLOCK-15: `motoi/ambient-complete` returns `()` for `"(defi"`
- HARDBLOCK-16: `motoi/refactor-suggest` never suggests
- HARDBLOCK-17: `motoi/bug-spot` never spots

**Priority 4 (nice-to-have):**
- HARDBLOCK-18: `book/toc` empty for existing books

## Files touched during verification

- `/tmp/priya-verify/cpu-suite.scm` — CPU 5+3, step, disassemble, display
- `/tmp/priya-verify/ml-ch1.scm` — Ch 1 all blocks
- `/tmp/priya-verify/ml-ch2-capstone.scm` — cosine sim
- `/tmp/priya-verify/ml-ch9-backprop-capstone.scm` — REVEALED HARDBLOCK-04
- `/tmp/priya-verify/ml-ch9-chain-rule.scm` — chain rule y=x^8
- `/tmp/priya-verify/ml-ch16-parts.scm` — tiny LLM parts 1-5
- `/tmp/priya-verify/code-ch6-adders.scm` — half + full adder truth tables
- `/tmp/priya-verify/code-ch7-ripple.scm` — 4-bit ripple carry adder

## Priya cosign

```
(priya-cosign
  :date "2026-07-19"
  :scope "motoi 4.5 hard-core verification — kid-first"
  :lanes-verified (book-of-ml-wave-1
                   book-of-ml-wave-2
                   book-of-code
                   ide-wave-2
                   cpu
                   runtime-patches)
  :code-blocks-run 40
  :code-blocks-passed 38
  :hardblocks-found 11
  :hardblocks-resolved 2
  :cpu-verified #t
  :tutor-verified #t
  :ide-verified #f
  :pair-programming-verified :partial
  :reading-state-verified #t
  :runtime-patches-verified #t
  :readability-11yo :partial
  :ready-for-child #f
  :status HARD-BLOCK
  :note "Substrate is real and the CPU + core book code all runs.
         But 3 kid-facing paths break in the first 15 minutes and
         1 capstone has a paren typo. Fix HARDBLOCK-03 + HARDBLOCK-06 +
         HARDBLOCK-19 and I re-verify to APPROVED.")
```
