# Step 2 close-out — exactness landed, reference re-stated against it

2026-08-03. Step 2 was "finish the language with exactness, then make sure it is
all documented for input, output and computation." Both halves are done. Every
number below was measured, not estimated.

## Where the numbers landed

| gate | before | after |
|---|---|---|
| repo test suite | 768/768 | **768/768** (exit 0) |
| chibi conformance | 1117/1202 | **1121/1204** |
| larceny conformance | 1930/2068 | **1964/2068** |
| reference notes verified | 906/971 | **963/971** |

The 8 reference notes that still disagree are the only ones that CANNOT be made
to agree: six `02-ai.slat` snippets whose output is a model reply (offline here),
and two `26-exception.slat:last-error` snippets that read interpreter state. They
are non-deterministic by nature and must be quarantined, never spliced.

## Engine changes this session

- `numToString` — stopped appending `.0` to a double that already prints in
  exponent notation. `(number->string 2e200)` was `"2e+200.0"`, which is not a
  number and read back as `#f`, so the round trip lost the value.
- `string->number` — now honours `#e` / `#i` (both orders, with a radix prefix),
  and reads integers through the tower instead of `Number()`, which had been
  silently rounding every integer past 2^53.
- `exactFromDecimal` (new, `lib/math/tower.js`) — `#e0.1` is `1/10`, the value
  the digits name, not the dyadic rational the double rounds to. The reader and
  `string->number` both call it, so the two cannot disagree.
- `exptNum` — a negative exact integer exponent stays exact. `(expt 2 -1)` is
  `1/2`, not `0.5`.
- `modulo` — floor remainder rather than `((x % y) + y) % y`, which manufactured
  a `-0.0` on `(modulo -15.0 -3.0)`.
- `rationalize` — infinite arguments no longer throw.
- `features` — `exact-closed` and `ratios` restored. They were correctly removed
  2026-08-02, when they were lies; the tower made them true again.
- `clamp` / `math/clamp` — exactness-preserving, with the documented
  lower-bound-first order restored (I had inverted it; the reference caught it).
- `input-may-i-set!` — a Motoi closure is now recognised as a predicate and
  called, and only `#f` closes the gate. Both divergences were already fixed in
  `lib/system/core-toplevel.js`; the reference record was the stale half.

## Reference changes this session

- 36 mechanical note splices (leading literal only, prose untouched).
- 11 hand-authored rewrites of records that taught a now-fixed bug — the n-ary
  comparison defect, `log`'s ignored base, `exact-integer-sqrt`'s leaked object.
- 21 prose rewrites retiring "Motoi has one number type". That sentence explained
  a dozen behaviours by citing a limitation the engine no longer has. Zero
  occurrences remain anywhere in `scheme/reference/`.
- The `expt` record rewritten end to end, `exact`'s signature corrected to
  `-> exact-number`, the `std-parts` count corrected to 268.

Scripts, all re-runnable: `scratch/splice-reference-notes.py`,
`scratch/rewrite-bug-records.py`, `scratch/rewrite-stale-tower-prose.py`.

## Two calls I made, both reversible

1. **`mean` and `pct` keep their float results.** `(mean '(1 2 3 4))` is `2.5`,
   not the exact `5/2` that `(/ (sum ...) 4)` gives. They are Motoi-own stat and
   finance verbs whose documented job is a readable number, and `pct` feeds the
   Curator carts — turning `(pct 25 200)` into `25/2` would be a user-visible
   regression in a repo that is off-limits. I corrected the stated REASON (the
   old prose blamed the one-number-type limitation) and left the behaviour. Say
   the word if you want them exact instead.
2. **`exp2` and `expt` are documented as disagreeing in exactness.**
   `(list (exp2 10) (expt 2 10))` is `(1024.0 1024)`. `exp2` is a transcendental
   and always inexact; `expt` keeps an exact base and exact integer power exact.
   The old prose claimed they agreed exactly. Correcting the prose was right —
   making `exp2` exact would break it as a float verb.

## Still open, and they are your decisions, not mine

The 104 remaining larceny failures are almost entirely three features Motoi has
never had. Detail in `scratch/R7RS-STEP4-DECISIONS-2026-08-03.md`.

- mutable strings — `string-set!`, `string-copy!`, `string-fill!` — ~41
- cons-cell mutation, circular and improper lists — `set-cdr!` and the
  destructive SRFI-1 verbs — ~25
- macro hygiene — `let-syntax`, `letrec-syntax`, `bound-identifier=?` — ~12

The rest are small and classified: `vector-copy!` on overlapping ranges (2),
SRFI-133 verbs that are correctly outside the 2026-07-24 lock, one datum-label
round trip, one `dynamic-wind`, and two harness artifacts.
