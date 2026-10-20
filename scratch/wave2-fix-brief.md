# Wave-2 book-fix brief — make failing chapters run CLEAN, "real verbs only, no stubs"

## Goal
Every ```scheme block in your assigned book(s) must run CLEAN under the canonical
grader `./bin/motoi run` (via `scratch/grade-book.mjs`), using ONLY verbs that
natively bind. No fake stubs. This corpus trains a model; a fake stub or a
non-running example is a lie in the training data.

## The three compliant fixes (pick ONE per broken block)
1. **Real verb** — replace the imaginary verb with one that natively binds.
   Verify: `echo '(the-verb)' | ./bin/motoi run /dev/stdin` — no "unbound" = real.
2. **Rewrite to nearest real capability** — teach the closest real thing with
   bound verbs. PREFER THIS; it keeps the chapter runnable and truthful.
3. **Demote to ```text fence** — change ```scheme to ```text + one prose line
   noting it's illustrative pseudocode for a capability base Motoi doesn't expose.
   The grader skips ```text. Use only when nothing real is close.

## FORBIDDEN
- Defining an in-chapter stub `(define (imaginary-verb ...) ...)` for a
  nonexistent host verb inside a ```scheme fence. Ever.
- Redefining/shadowing an R7RS or SRFI standard name (e.g. `filter`, `random`,
  `length`, `map`).

## LEGIT (keep)
- Local helper functions built on REAL primitives are good Scheme pedagogy
  (e.g. `grid-ref`/`grid-set!` over `(make-vector …)`). Test: does it fake an
  absent host capability, or compute over real values with bound verbs? If the
  latter, KEEP it.

## Fix-type playbook by failure signature
- **`unbound symbol: <verb>`** — imaginary/removed verb. Apply fix 1/2/3.
  Common absent verbs seen corpus-wide: define-card, surface, canvas, record,
  poem-form, clock/now (real is `time/now` for bare now, but signatures with
  keywords differ — rewrite, don't blind-rename), knowledge/of, loam/recall,
  fetch, http/*, json/*, system/*, text/normalize, with-slat-stream,
  validate-money, weather/*. Verify each before assuming.
- **`unbound symbol: motoi>`** — a REPL PROMPT leaked into a code block. The
  author pasted `motoi> (expr)` transcripts. Fix: strip the `motoi> ` prompt
  (and any `;=> result` echo lines) so it's clean code, OR demote the transcript
  block to ```text.
- **`unbound symbol: xs` / `t` / `value`** — a free variable used without being
  defined/bound in the cumulative block sequence. Add the missing `define`/`let`
  binding, or fix the example so the variable is in scope.
- **`unterminated string` / `unexpected )`** — a real authoring/escaping bug in
  the .slat prose string (mismatched `\"` or paren). Find and fix the balance.
- **`a.slice is not a function` / `.map is not a function`** — the example calls
  a list op on a non-list (often a dotted pair or a number). Fix the data shape
  in the example (e.g. `(cdr track)` vs `(cadr track)`), don't stub.
- **`NaN cannot be converted to a BigInt`** — an exact/integer op received a
  non-integer (often from `/` producing a ratio/float, or `sqrt`). Fix the math
  in the example (use the right numeric op / coerce with `exact`/`floor`).
- **`fuel exhausted`** — MAY be a budget artifact, NOT broken code. First re-test
  that chapter alone with more fuel:
  `GRADE_FUEL=50000000 node scratch/grade-book.mjs scheme-books/<book>/<ch>.book.slatl`
  If it goes CLEAN, it was just heavy — leave the code alone (the grader default
  is generous; a genuine session is smaller). Only if it STILL exhausts at 50M is
  there a real infinite-loop/runaway bug to fix.

## Verbs/standard reminders
- Trig = geom/sin, geom/cos, geom/tan (bare sin/cos/tan UNBOUND).
- Standard = R7RS-small + SRFI-1/13/125/27. NEVER fold-left/foldl/foldr — use
  SRFI-1 `fold` (elem-first) / `fold-right`.
- Real audio surface: audio/{bar-clock,halt,key,listen,lufs,master-volume,
  onset-strength,onset?,play,playing?,spectrum,synth,tempo,tick},
  note/{place-at,release,strike}, synth/{chord,kit,play}.
- Ground truth inventory: `scratch/real-verbs-inventory.md`.

## Exit gate (BOTH must hold; verify yourself before reporting done)
1. `node scratch/grade-book.mjs scheme-books/<book>/*.slatl` → every chapter CLEAN.
2. `node scratch/find-stubs.mjs scheme-books/<book>/*.slatl` → TOTAL 0, OR only
   verified local-helpers-on-real-values (list them explicitly as legit).
Run from `/Users/alfred/code/motoi-scheme`.

## Constraints
- Edit files in place. No file deletes. No commit. No --force/--no-verify.
- Prefer rewrite-to-real over text-fence so chapters stay runnable and truthful.
- If a block is INTENTIONAL error-teaching (deliberately shows a broken example
  so the reader learns to read the error), demote it to ```text with a prose note
  like "This deliberately errors — that's the lesson." so the grader passes and
  the model isn't taught the broken code as valid.
- Report under 250 words: per-book, how many blocks fixed by real-verb vs
  rewrite vs text-fence, any authoring bugs found, any fuel-only chapters, final
  grade (X/Y CLEAN) and final find-stubs TOTAL.
