# Conformance fix decisions — 2026-08-02

Authorised by Alfred: "FIX ALL THE FUCKUPS IN MOTOI." This file is the single
ruling every fix agent works from, so three agents editing three files land on
one coherent language instead of three.

## The one architectural call: exactness is a REPRESENTATION LIMIT, not a bug

Motoi numbers are JS numbers, plus a `Rational` class (BigInt n/d). JS cannot
distinguish `2` from `2.0` — the reader collapses both to the same value.
Therefore:

- `(exact? 2.0)` => `#t` is **correct for Motoi**. There is no inexact 2 to have.
- `(inexact? 2.0)` => `#f` follows, and is **consistent**, not contradictory.
  (The 2026-08-02 findings report called this a self-contradiction. That call
  was wrong. `#t`/`#f` is exactly what a consistent `exact?`/`inexact?` pair
  returns. Corrected here.)
- `(eqv? 2 2.0)` => `#t` follows for the same reason.
- `(/ 1 3)` => `0.333…` rather than `1/3` STAYS.

**Do not "fix" `/` to return exact rationals.** R7RS §6.2.3 explicitly permits a
limited numeric tower. Making `/` exact would turn every `(/ w 2)` centering
expression in the graphics stack into a `Rational` object and would break
rendering, `Math.floor` paths, and canvas ops. Correct-but-catastrophic. The
honest move is to document the limit, which is what R7RS allows.

These are recorded as **documented limits** with an `:std "Motoi"` citation and
a pointer to §6.2.3. They are NOT `needs-alfred`, and they are NOT xfail.

### Still real bugs inside the numeric area — DO fix these

Nothing above excuses returning NaN or contradicting a sibling procedure:

- `round` / `floor` / `ceiling` / `truncate` / `sqrt` return `+nan.0` on a
  Rational. There is no representational excuse; the value is exactly
  representable. Fix.
- `(equal? 1/2 1/2)` => `#f` while `(eqv? 1/2 1/2)` => `#t`. Inverts the
  standard's guarantee that `eqv?` implies `equal?`. `equal?` must recurse into
  Rational. Fix.
- `min` / `max` at zero arity return `Infinity` / `-Infinity`. Should raise. Fix.

## Fix list — real bugs, contained blast radius

1. **n-ary comparison truncation.** `= < > <= >=`, the case-sensitive `string`
   comparison family, `boolean=?`, `symbol=?`. All bound as 2-arg JS arrows; JS
   silently drops the tail, so `(= 1 1 2)` => `#t`. Highest priority: smallest
   diff, largest blast radius, and it is the one a beginner meets first.
   The `-ci` string family and all char comparisons are ALREADY correct
   (pairwise loops) — leave them, and match their shape.
2. **Bounds and type checks.** `vector-ref`, `list-ref`, `string-ref`,
   `vector-set!`, `string-length`, `vector-length`. Today an out-of-range read
   returns a truthy non-value, so the error surfaces arbitrarily far from its
   cause. That defeats the whole debugging lane this corpus teaches.
3. `(log 8 2)` silently ignores the base.
4. `(string->number "12abc")` => `12`; must be `#f`. `"1/2"` => `1`; must be `1/2`.
5. `vector-copy!` / `bytevector-copy!` overlap. Forward loops with no temporary,
   so a right shift smears. Also range validation: `vector-copy!` silently GROWS
   the destination, `bytevector-copy!` silently DISCARDS.
6. `vector-append`, `vector->string`, `string->vector` argument validation.
7. `append` splices a non-list: `(append 7 '(1))` => `(7 1)`.
8. `member` / `assoc` 3-arg comparator silently ignored.
9. SRFI-1 `fold` and `list-index` drop extra lists.
10. `rationalize` is an identity stub.
11. `(eq? '() '())` => `#f`; §6.1 requires `#t`.
12. **Unbound but required:** `string-set!`, `string-fill!`, `string-copy!`
    (§6.7), `set-car!`, `set-cdr!` (§6.4), `read` (§6.13.2).
13. **Ports (§6.13), 13 flags.** Closed ports still read and still write;
    `char-ready?`/`u8-ready?` wrong at EOF; `write-shared` has no datum labels;
    `flush-output-port` is a bare no-op; `current-input-port` is a permanently
    empty stub; `read-string` accepts negative k; `write-u8` masks mod 256;
    `get-output-bytevector` can't be told from an empty sink.
14. `(sort (vector 3 1 2) <)` returns the vector unsorted with NO error. If
    vectors aren't supported, it must raise.

## Explicitly NOT bugs — do not "fix", do not re-flag

- `map` / `for-each` SRFI-1 shortest-stop on unequal lists. R7RS leaves it
  unspecified; this is a sanctioned strict superset and a deliberate recorded
  choice.
- `sort` argument order matches no adopted standard. Filed `:std "Motoi"`. It is
  a genuine stable sort. Only the vector case (item 14) is a bug.
- `string-eq?` is a Motoi-own alias for `string=?`. It inherits whatever arity
  `string=?` gets — fix it in lockstep, don't delete it.

## Standing rules that outrank speed

- **The reference is the language.** When code and the reference disagree, the
  reference wins — EXCEPT where the reference records the bug being fixed here.
  Those records carry an `IN MOTOI TODAY` clause in their Row-4 invariant and
  are DESIGNED to start failing the day the bug is fixed. Expect them to fail;
  that is the signal, not a regression. They get updated in a later pass.
- **No fabrication.** If a fix requires a judgment this file does not settle,
  stop and log `:status "needs-alfred"`. Do not guess.
- **No deletes, ever.** Archive under a dated `_archive/` subdirectory.
- `764/764` node tests pass right now. That number may not go down.

---

## Round 2 rulings (2026-08-02, after Marcus/Abel/Zain round 1)

Three questions round 1 raised but this file did not settle. Settled now.

### R2-1. Type-checking the comparison families: RAISE.

`(= 1 'a)` answers `#f` today. `(string=? 5 "5")` answers `#t`. Both are
**silent-wrong**, the worst failure class in a teaching language: the learner
gets a plausible answer to a question that was never asked, and the model
trains on it. R7RS-small §6.2.6 requires numeric arguments to `=`/`<`/`>`/
`<=`/`>=`; §6.7 requires strings to `string=?` and the ordering family. Neither
has a "coerce" clause.

So: **`_ckNums` goes back on the `=` family, and the string comparison family
gets the matching `_ckStrs`.** Raise with the verb name and the offending
argument.

This breaks `carts/asteroids.sks` and `carts/space-invaders.sks`, which branch
on `(= DIFFICULTY 'easy)`. **The carts are wrong, not the engine** — comparing a
symbol with `=` is exactly the error the check exists to catch. They get
`eq?`. Cart fixes are Alfred's lane in this pass, not the agents'.

### R2-2. One-argument comparison: `#t`, and the harness is what changes.

`(= 1)` and `(< 1)` answer `#t`. A chain with no adjacent pairs is vacuously
satisfied, and Chez, Guile and Racket all agree. `scripts/conformance-diff.py`
currently expects a raise; **the expectation is wrong and gets cleared.** Zero
arguments still raises — there is no chain at all to be vacuous about.

### R2-3. `(string=? (string-ref s 0) "a")` => `#f` is CORRECT. Do not "fix" it.

`string-ref` returns a **character**, and a character is not a string. The `#f`
is the type system doing its job. `carts/sokoban-boxes.sks` compares the two and
so `find-player` always answers `(-1 -1)`; that cart has been rendering garbage
silently since it was written. **Fix the cart with `char=?`, never the engine.**

Note this makes R2-1 load-bearing in the other direction: once `string=?` type
checks, that sokoban line stops being silently `#f` and starts raising, which is
how the bug should have surfaced in the first place.
