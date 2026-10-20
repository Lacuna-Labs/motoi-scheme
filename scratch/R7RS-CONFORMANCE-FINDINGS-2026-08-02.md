# R7RS-small conformance findings — 2026-08-02

Produced as a side effect of authoring the missing core-primitive layer into
`scheme/reference/`. Nothing here is recalled; every line was executed against
`./bin/motoi run` and independently re-run before being written down.

**48 records across 8 chapters carry `:status "needs-alfred"`.** Each one's
Row-4 invariant states the CURRENT behaviour with an `IN MOTOI TODAY` clause,
so the proof begins FAILING the day the bug is fixed — the record announces its
own staleness rather than rotting silently.

The failure class that matters: almost none of these raise. They return a
plausible answer. In a teaching language a wrong-but-plausible answer is worse
than a crash, because it trains the learner — and the model — on a lie.

---

## Tier 1 — silent-wrong on ordinary input

These need no edge case to trigger. A learner hits them on day one.

| expression | Motoi | R7RS-small |
|---|---|---|
| `(= 1 1 2)` | `#t` | `#f` |
| `(< 1 3 2)` | `#t` | `#f` |
| `(<= 5 12 10)` | `#t` | `#f` |
| `(string=? "a" "a" "b")` | `#t` | `#f` |
| `(vector-ref (vector 1 2 3) 99)` | non-value, no error | error |
| `(list-ref '(1 2 3) 99)` | non-value, no error | error |
| `(round 9/10)` | `+nan.0` | `1` |
| `(string->number "12abc")` | `12` | `#f` |
| `(string->number "1/2")` | `1` | `1/2` |
| `(log 8 2)` | `2.079…` (base ignored) | `3` |

`= < > <= >=` are bound as 2-argument JS arrows (`src/base.js:118-122`) while
`+ - *` correctly spread (`(...a)`), so JS silently drops the tail. `+ - *`
were measured and ARE correct, including `(+)` → `0` and `(*)` → `1`.

The n-ary defect is **split, not uniform** — this is the part that would be
guessed wrong:

- broken: numeric comparisons, case-sensitive string comparisons
- correct: **all** `-ci` string comparisons, **all** char comparisons
  (`lib/base/r7rs-small.js` implements those as pairwise loops)

`(vector-ref v 99)`'s non-value is **truthy**, and `(number? x)` returns the
non-value too — which is also truthy — so `(if (number? x) …)` takes the number
branch. The eventual arithmetic error surfaces far from the bad index.

## Tier 2 — silently wrong results

| expression | Motoi | R7RS-small |
|---|---|---|
| `(vector-copy! v 1 v 0 4)` on `#(1 2 3 4 5)` | `#(1 1 1 1 1)` | `#(1 1 2 3 4)` |
| `(vector-append (vector 1) (list 2 3))` | `#(1)` — arg skipped | error |
| `(vector->string (vector 1 2 3))` | `"123"` | error |
| `(string->vector "abcdef" -2)` | `#(e f)` — negative = from end | error |
| `(append 7 '(1))` | `(7 1)` — non-list spliced | error |
| `(member 2 '(1 2 3) never-eq)` | `(2 3)` — comparator ignored | `#f` |
| `(assoc k alist compare)` | comparator ignored | honours it |
| `(sort (vector 3 1 2) <)` | `#(3 1 2)` unsorted, no error | — |
| `(list-index pred l1 l2)` | extra lists ignored | walks in step |
| `(rationalize x tol)` | identity stub, any tolerance | converges |

`vector-copy!` and `bytevector-copy!` are forward loops with no temporary, so a
left shift is correct and a right shift smears. Overflow diverges by container:
`vector-copy!` silently **grows** the destination, `bytevector-copy!` silently
**discards** (fixed-width `Uint8Array`).

## Tier 3 — equivalence and exactness

| expression | Motoi | R7RS-small |
|---|---|---|
| `(eq? '() '())` | `#f` | `#t` (§6.1) |
| `(eqv? 2 2.0)` | `#t` | `#f` |
| `(equal? 1/2 1/2)` | `#f` | `#t` |
| `(exact? 2.0)` / `(inexact? 2.0)` | `#t` / `#f` | `#f` / `#t` |
| `(even? 4/2)` | `#f` though `(integer? 4/2)` is `#t` | `#t` |

`(equal? 1/2 1/2)` being `#f` while `(eqv? 1/2 1/2)` is `#t` inverts the
standard's guarantee that `eqv?` implies `equal?`. `exact?` and `inexact?`
directly contradict each other on the same value, and they contradict the
existing `exact?`/`inexact?` records already in `52-predicate.slat`.

Genuinely unspecified in R7RS, where Motoi simply picks (documented as picks,
not as guarantees): `eq?` on strings → `#t`; `eq?` on numbers and chars → `#t`.

## Tier 4 — ports (§6.13)

`35-io.slat` carries 13 flags — proportionally the worst chapter.

- `input-port-open?` / `output-port-open?` — **closed ports still read and
  still write.** The predicate reports a state the port does not honour.
- `char-ready?` / `u8-ready?` — return `#f` at EOF where §6.13.2 requires
  `#t`; raise on an output port; return `#t` for a non-port.
- `write-shared` — same function as `write`; no visited set, no datum labels.
  It is *defined* by emitting labels, so this is a genuine divergence.
  `write-simple` is vacuously conformant.
- `flush-output-port` — bare no-op, ignores its argument.
- `current-input-port` — permanently-empty stub.
- `read-string` — negative `k` unvalidated: returns characters *and* advances.
- `write-u8` — silently masks mod 256; silently discarded on a textual port.
- `get-output-bytevector` — returns `#u8()` for textual, input, and non-port
  arguments, indistinguishable from a genuinely empty sink.

Also unbound, found incidentally: **`read`** and **`set-cdr!`**. Because
`set-cdr!` is missing, a circular list cannot be constructed at all, so the
whole datum-label question is moot in practice today.

## Not bugs — recorded so they are not "fixed" by mistake

- `map` / `for-each` use SRFI-1 shortest-stop on unequal-length lists. R7RS
  leaves that case unspecified, so this is a **strict superset**, and it is the
  deliberate choice recorded in `CLAUDE.md`.
- `sort` matches no adopted standard. Not R7RS-small; not SRFI-132 (which is
  `(list-sort less? lst)`, and `list-sort` is unbound); argument order matches
  SRFI-95 but there is no vector or key support. Filed `:std "Motoi"`. It is a
  genuine stable sort.
- `string-eq?` is a Motoi-own alias for `string=?` — distinct procedure object,
  same semantics, and inherits the same 2-arity limit.
- Lists are JS arrays and `set-car!`/`set-cdr!` are unbound, so `append`,
  `member` and `list-tail` return copies. R7RS structure-sharing is
  unobservable here rather than violated.

## Pre-existing reference errors found while authoring

- `12-char.slat` — the `char?` record claims `(char? "a")` is `#t`; the live
  answer is `#f`. The record is wrong, and the reference is canonical, so this
  one is a **reference** fix, not an engine fix.
- `12-char.slat` — `char=?`'s note claiming chars never come from `#\`
  literals is stale.
- `40-math.slat` — 4 snippets fail at baseline (`math/mixed-number` ×3,
  division by zero; `math/round-half-up` ×1, symbol where a number is wanted).
- `52-predicate.slat` — 2 snippets fail at baseline.

## Ordering, if these get fixed

1. The n-ary comparisons (`= < > <= >=`, `string=?` and the case-sensitive
   string family). Smallest diff, largest blast radius, and they are the ones a
   beginner meets.
2. Bounds checks on `vector-ref` / `list-ref` / `string-ref`. Currently the
   error surfaces arbitrarily far from its cause, which defeats the debugger
   lane this corpus is supposed to teach.
3. `vector-copy!` / `bytevector-copy!` overlap and range validation.
4. Exactness: `exact?`/`inexact?`, `round` on rationals, `eqv?`/`equal?` on
   rationals. This is one coherent piece of work, not four.
5. Ports. Largest count, lowest learner-frequency — last.

**No engine code was changed.** Every item above is recorded in the reference
with executed evidence, flagged `needs-alfred`, and left for a human decision,
per `CLAUDE.md`: *no fabrication.*
