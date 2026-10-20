# Prototype + smoke test — Reference lane shapes R1–R6

**2026-07-29 · scratch-only · no fold · nothing committed**

De-risks the full ~1M-pair reference lane by proving that every Scheme code block in
a hand-authored prototype of the first six pair-shapes actually runs under the Motoi
interpreter (`./bin/motoi run /dev/stdin`) — "tests to ensure the fold will work 100%."

## Artifacts

- `prototype-shapes-0-5.jsonl` — 15 authored instruction/response pairs (29 code blocks).
- `test-shapes-0-5.sh` — extracts every `code_block`, runs each through the interpreter,
  reports PASS/FAIL per block + a final tally. Honors per-pair `expected_error_idx` so
  R5 broken examples count correctly.
- `build-shapes-0-5.py` — regenerates the JSONL (keeps code-string escaping exact).

## Verbs used (all confirmed wired, not assumed)

- **`fold`** — SRFI-1, element-first combiner `(f elem acc)`.
- **`filter`** — SRFI-1.
- **`iota`** — SRFI-1 (`(iota n [start [step]])`), with supporting `map`,
  `delete-duplicates`, `length`, `even?/odd?/positive?`.

Each was smoke-tested with `echo '<expr>' | ./bin/motoi run /dev/stdin` before use.
Example bodies were **grabbed** from `scheme/reference/39-list.slat`
(`:eng/cs/math-program` and `:rungs` fields), per the grab-don't-generate doctrine —
e.g. the `arith-prog` and index/square-table bodies are verbatim from that chapter.

## Shape coverage

| Shape | What it prototypes | Pairs |
|---|---|---|
| R1 | verb-identity 5-row × 3-discipline (eng/cs/math lens per verb) | 3 |
| R2 | run-and-explain: predict → run → substitution trace | 3 |
| R3 | decompose-and-label: HtDP signature/purpose/inventory/template | 2 |
| R4 | build-up ladder: each rung runs, generate→filter→reduce | 2 |
| R5 | reversals: code↔description + broken↔fixed (2 expected-error blocks) | 3 |
| R6 | comprehension-vocab overlay: combiner/seed/predicate/pure/tail-position | 2 |

## Result

**29/29 code blocks PASS on the first harness run.**
- 27 must-run blocks exit 0.
- 2 R5 "broken" blocks exit non-zero **for the right reason** and are counted as PASS
  via `expected_error_idx`:
  - `(fold-left + 0 (list 1 2 3))` → `error: unbound symbol: fold-left` (R6RS name,
    deliberately excluded).
  - `(filter 42 (iota 6))` → `error: not a function: 42`.

## Gotchas the full fold must handle

1. **Expected-error blocks are load-bearing.** R5 (and the debugger lane) will emit
   code that *should* fail. The grader cannot be a naive "exit 0 = pass" — it needs a
   per-block expected-outcome flag. This prototype's `expected_error_idx` is the
   minimal version; the real fold should also assert on the **error message/class**,
   not just non-zero exit, so a block failing for the *wrong* reason is caught.
2. **Multi-form blocks need `display`+`newline` to surface output.** Bare top-level
   `(define ...)` prints nothing; blocks that should demonstrate a value must end in a
   `display`. The interpreter reads a whole program from stdin, so multi-line blocks
   (define + display) work — but the JSONL must carry the literal `\n`.
3. **Escaping/newlines.** Code blocks contain quotes and newlines; the harness passes
   them through base64 to survive the shell boundary intact. A naive `echo` pipeline
   would mangle them. Any full-fold grader should feed the raw bytes, not a re-quoted
   string.
4. **Standard-name discipline is real and enforced by the interpreter.**
   `fold-left`/`foldl`/`foldr` are genuinely unbound — good, because it means the
   grader will catch any pair that accidentally uses an R6RS/Racket name. Authors must
   use `fold`/`fold-right` (element-first). This is a free correctness gate for the
   whole lane.
5. **SRFI-1 fold order surprises.** `(fold cons '() xs)` reverses; authors writing R2
   traces must get the `(f elem acc)` order right or the explanation contradicts the
   run. Worth a lint that re-derives the trace and diffs it against the stated output.

## Verdict

The six-shape structure is authorable against real wired verbs, real reference bodies,
and a runnable grader, at 100% block pass. The mechanism scales: JSONL + a
per-block expected-outcome flag + interpreter-as-grader is sufficient to validate the
full fold. Recommend the production grader upgrade from "exit code" to "exit code +
error-class assertion" before authoring R5/debugger at volume.
