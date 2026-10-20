# R7RS conformance — where the language stands, and the four things only you can decide

2026-08-03. Machine-readable failure dump: `scratch/r7rs-conformance/remaining-classified-2026-08-03.json`.

## The number

| | assertions | pass | fail |
|---|---|---|---|
| chibi-scheme suite | 1206 | 1086 | 120 |
| Larceny suite | 2084 | 1937 | 147 |
| **combined** | **3290** | **3023** | **267** |

This morning it was 2818 / 453. Repo suite: **768 tests, 0 fail.**

**How this was measured, and what would falsify it.** Two real conformance
suites (chibi `r7rs-tests.scm`, Larceny `tests/R7RS/`) are run through
`./bin/motoi`, and every `(test expected expr)` is compared value-by-value. The
check that would fail if this number were wrong is `score.py` / `score_larceny.py`
under `strict equal?` — the number above is the chibi-rules count; strict-equal
is slightly lower (1055 on chibi) because it does not accept an inexact answer
where an exact one was asked for. That gap **is** the exactness decision below.

## What I fixed since the last report

`cond-expand (library ...)` (this was silently installing stub `read`/`write`
implementations and poisoning 23 assertions) · quasiquote rewritten for nesting,
vector templates, and multi-operand unquote · `raise-continuable` now really
returns to the raise point instead of unwinding · `=>` in `guard` clauses ·
`=>` treated as an ordinary variable when it is bound · astral characters
through `read-char`/`peek-char` · `read-line` at `\r` and `\r\n` · bulk
bytevector I/O · Unicode `digit-value` · full-fold `string-foldcase` ·
`take-right`/`drop-right` over dotted lists · SRFI-1 surface completion
(47 names) · §6.12 `eval` + environments.

## The four decisions

Each is a **representation change**, not a bug. Each is cheap to describe and
expensive to build. Together they are 197 of the 267.

### 1. Exactness — 74 assertions

Motoi has one number type: the JS double (plus `Rational` and bigint). `1` and
`1.0` are the same object, so `(exact? 3)` and `(inexact? 3)` currently
contradict each other, `(number->string 1.0)` prints `"1"`, and
`(= 9007199254740992 9007199254740992.0)` is `#t` where the standard says `#f`.

Fixing it means an exactness tag on every number and a rule at every arithmetic
site. It is the single largest change on this list and it touches the printer,
which means it re-dates every printed value in the books.

### 2. Mutable strings — 53 assertions

`string-set!`, `string-fill!`, `string-copy!`, and `(eq? s (string-copy s))`.
Motoi strings are JS strings, which are immutable. Fixing it means strings
become a wrapper object, and every string verb in the tree unwraps.

### 3. Complex numbers — 49 assertions

`1+2i` currently reads as a symbol. `make-rectangular`, `make-polar`,
`magnitude`, `angle`, `real-part`, `imag-part` are unbound. This is the most
self-contained of the four: a `Complex` class, reader support, and the math
verbs. It also has the least to do with teaching kids to draw a circle.

### 4. Cons cells — 21 assertions

A proper list in Motoi is a JS **array**; `Pair` exists only for a dotted cdr.
So `cdr` returns a fresh slice, `(eq? (cdddr x) (drop x 3))` is `#f`,
`set-cdr!` cannot exist, and circular lists / datum labels (`#0=(1 2 #0#)`)
cannot be represented. Every SRFI-1 `!` verb that promises storage reuse fails
its identity test for this reason (they are correct on values, wrong on `eq?`).

This is the deepest change of the four — it is the list representation itself,
and it would slow every list operation in the language.

**My read, since you asked for one thing and not ten:** none of these four is
required for a kid to make a game, and all four are required to say "R7RS
conformant" without an asterisk. If you want a shippable language by Aug 23,
do **none** of them now and ship the asterisk honestly.

## Already-decided, not open

- **5 — SRFI-133** (`vector-empty?`, `vector=`). Out of scope: SRFI-133 is not
  in the 2026-07-24 stdlib lock.
- **4 — file ports** (`file-exists?`, `open-input-file`, `delete-file`).
  Deliberately absent per decision-010. Note this also means the two
  `file-error?` assertions can never pass; `file-error?` itself is correct.

## Still mechanical — I can finish these without you

- **31 — macro hygiene.** `syntax-rules` under `let-syntax`, ellipsis escape
  `(... ...)`, `_` and `...` as literals, `bound-identifier=?` vs
  `free-identifier=?`. Hard but bounded, and no representation changes.
- **6 — exceptions / continuations.** `dynamic-wind` re-entered through a
  stored continuation, and the R7RS "secondary exception" rule when a handler
  for a non-continuable `raise` returns normally. `call/cc` is escape-only
  today, so full re-entry is the real blocker.
- **2 — writer symbol bar-quoting.** `(write '|+NaN.0abc|)` must emit the bars,
  or the symbol reads back as a number.
- **1 — `exact-integer-sqrt`** on values past 2^53; needs the bigint path.

## One thing I added that you should know is an approximation

I bound §6.12 `environment`, `interaction-environment`,
`scheme-report-environment`, and `null-environment`. Motoi has **no module
system** — one substrate environment holds every library — so each of these
returns a fresh writable *child* of that environment. It contains the requested
library, but it is not *restricted* to it. `(environment '(scheme base))` will
happily find `draw-circle`. That is not what the standard says, and I am
recording it here rather than letting it read as conformance.

Same shape of caveat on `cond-expand (library ...)`: it answers by probing
whether a witness procedure is actually bound, which is honest about what is
available but cannot distinguish "imported" from "present".
