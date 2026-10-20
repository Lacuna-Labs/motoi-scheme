# The Grid Rules

The rules of the reference grid, written down once so they can be injected
rather than re-invented per script.

Every prompt is assembled from four blocks, in this order:

```
[A] THE PREAMBLE   — what Motoi Scheme is. Identical in every prompt.
[B] THE ROW RULE   — what this row exists to prove. One per row.
[C] THE COLUMN RULE— what this domain column means. One per column.
[D] THE VERB CARD  — this verb's signature, summary, behaviour, traps.
```

A is constant. B is the grid's first column. C is the grid's first row. D is the
cell's coordinates. That is the whole architecture — the grid's own headers are
the rules.

---

## [A] THE PREAMBLE — What Is Motoi Scheme

*Injected verbatim into every prompt. Verified against the engine 2026-08-04.*

> Motoi Scheme is a small, R7RS-small Scheme. You are writing programs that will
> be **executed** by `./bin/motoi run` and checked against their real output.
>
> **The standard.** R7RS-small is the authority, plus four SRFI parts: SRFI-1
> (lists), SRFI-13 (strings), SRFI-27 (random), SRFI-125 (hash tables). Nothing
> else. No R6RS. No Racket. No Guile or Chicken extensions.
>
> **Names that do NOT exist here** — using them is an error, not a style
> problem: `fold-left`, `foldl`, `foldr`, `define-values` from R6RS, `printf`,
> `format`, `display*`, `require`, `provide`, `set-car!` on a literal.
> Use SRFI-1 `fold` and `fold-right`, which take the element first:
> `(fold + 0 (list 1 2 3))` => `6`.
>
> **These are known good**, verified by running them:
> `define` `lambda` `let` `let*` `letrec` named-`let` `if` `cond` `case` `when`
> `unless` `and` `or` `begin` `quote` `list` `cons` `car` `cdr` `null?` `map`
> `for-each` `apply` `filter` `reverse` `length` `append` `fold` `fold-right`
> `assoc` `member` `vector` `vector-ref` `vector-length` `string-append`
> `string-length` `substring` `number->string` `string->number` `exact->inexact`
> `min` `max` `abs` `expt` `sqrt` `floor` `ceiling` `round` `truncate`
> `quotient` `remainder` `modulo` `display` `newline` `error`
>
> **Syntax rules that bite:**
> - Every parenthesis must close. Count them.
> - `'` is **quote**. An apostrophe inside an identifier is a reader error —
>   `banker's` fails. Write `bankers` or `banker-s`.
> - Identifiers are lowercase-with-dashes: `keep-on-screen`, not `keepOnScreen`.
> - `#t` and `#f` are the booleans. `#true`/`#false` also read, prefer `#t`/`#f`.
> - Rationals are exact: `(exact->inexact 1/2)` => `0.5`.
> - There is no `printf`. Output is `display` + `newline`.
>
> **Do not invent procedures.** If you have not seen a name in this preamble or
> in the verb card below, it probably does not exist and the program will die
> with `error: unbound symbol`. Build what you need out of the names above.
>
> **Determinism.** No randomness, no clocks, no input, no graphics, no file I/O.
> The same program must print the same thing every run.

---

## [B] THE ROW RULES

The rows are a ladder of *epistemic purpose*, not of difficulty. Each row exists
to prove something the other rows cannot.

### row-2-audit — "an operator picks this tool for a real job"

The question the row answers: *what is this verb actually for?*

- Define one descriptive domain function that wraps the verb.
- Call it three times, on inputs that span the verb's interesting range:
  below / inside / above, or empty / typical / degenerate.
- The three results must not all be the same.
- The function's NAME is the teaching: `keep-on-screen` teaches, `test1` does not.

### row-3-dimension — "the same verb at three altitudes"

The question: *how does this verb change meaning as the thing it touches gets
more real?*

- Rung 1 `plain` — the bare numeric or structural use, no units, no story.
- Rung 2 `physical` — applied to a measured quantity: pixels, seconds, degrees.
- Rung 3 named for a real domain use.
- **The three rungs must do genuinely DIFFERENT work.** Three functions with the
  same body called on different arguments is not a ladder, it is one rung
  printed three times. This is the single most common way this row is faked.

### row-4-proof — "a property, checked, not a demo"

The question: *what is true of this verb for EVERY input, not just this one?*

- State one invariant as a boolean expression over the verb.
- Check it across several argument sets, including at least one edge case.
- Every case must print `#t`. A `#f` means the invariant is false — either the
  claim is wrong or the verb is. Both are findings; neither is a passing cell.
- The strongest form is an equivalence: assert the verb equals an independent
  formula. `(= (clamp x lo hi) (min hi (max lo x)))` is the model of this row.

### row-5-emergence — "the verb as a component, not the headline"

The question: *what can you build where this verb is load-bearing but invisible?*

- A small helper wraps the verb.
- A BIGGER function is built **out of the helper** and does something more —
  maps it over a list, combines two of them, folds with it.
- **BIGGER must actually call the helper.** A helper that is never called is
  dead code, and the row has composed nothing. This is how this row gets faked.
- The point is that the verb disappears into something useful.

---

## [C] THE COLUMN RULES

The columns are three *audiences*, and they are not interchangeable. A program
belongs in a column because of who would write it and why, not because of which
numbers it happens to use.

- **eng** — someone building a thing. Screens, sprites, physics, budgets,
  throttles, health bars. The value is that it ships.
- **math** — someone establishing a property. Ranges, monotonicity, identities,
  limits, exactness. The value is that it is true.
- **cs** — someone probing the implementation. Edge cases, degenerate inputs,
  type boundaries, failure modes, the documented traps. The value is that it
  breaks, or provably does not.

Rule of thumb the generator keeps failing: `keep-on-screen` is an **eng**
program no matter what column it was asked for. If the program would be written
by a game developer, it is eng. Do not let the domain drift.

---

## [D] THE VERB CARD

Assembled from the record itself — never written by the model:

```
Verb:      {name}
Signature: {signature}
Summary:   {summary}
Behaviour: {explanation}
Traps:     {caveats}
```

**Caveats are supplied, not recalled.** The model must never state a trap that
is not on the card. (The `clamp` card currently carries a trap that the engine
no longer has — see the open item at the bottom.)

---

## The gates, and which rule each one enforces

The interpreter cannot check a rule; it can only check a program. These are the
rules made mechanical. All are structural and run before/around execution.

| gate | rule it enforces |
|---|---|
| never `(define (verb ...))` | the cell documents the builtin, not a copy of it |
| the program must call the verb | preamble: the verb is the subject |
| runs clean under `./bin/motoi run` | preamble: it must execute |
| identical output on two runs | preamble: determinism |
| output not `""` / `()` / `#<unspecified>` | row rules: it must teach something |
| output differs from every other cell | the grid is 12 lessons, not 1 |
| row-4: no `#f` in the output | row-4: every case must hold |
| row-3: rung bodies textually distinct | row-3: three rungs, not one |
| row-5: BIGGER's body calls HELPER | row-5: composition must compose |
| names ≠ the verb | never shadow the builtin |

What no gate can check, and therefore what a model must not be trusted with:
**which column a program belongs to**, and **whether a stated reason is the
right reason.**

---

## The leftovers — what actually needs filling

Measured by `scratch/certify-reference.mjs` (uses `src/reader.js`, not regex).
**1,629 verbs · 1,584 at spec (97.2%) · 45 under · 344 slots missing.**

Two distinct groups, and they are different jobs:

**Group A — 24 verbs at 3/15.** They have the three hand-authored `:examples`
and none of the grid. Each needs all 12 cells. This is 288 of the 344 slots —
84% of the whole deficit sits here.

| file | verbs |
|---|---|
| `40-math.slat` (15) | `pi` `ceil` `sign` `clamp` `round2` `lerp` `dist` `atan2` `exp2` `log2` `log10` `argmin` `exact-rational?` `=?` `rng-uniform` |
| `17-complex.slat` (6) | `real-part` `imag-part` `magnitude` `angle` `make-rectangular` `make-polar` |
| `03-alg.slat` (2, at 1/15) | `alg/permutation-cycles` `alg/permutation-compose` |
| `67-topo.slat` (1, at 1/15) | `topo/euler-characteristic` |

**Group B — 21 verbs at 12–14/15.** Missing 1–3 cells each, 56 slots total.
These are mostly `input/*`, `time/*`, `world/*` — stateful, effectful verbs
where determinism is the hard part, not judgement.

`on-collision` · `input/buttons` `input/down?` `input/may-i?` `input/pressed?`
`input/set!` · `time/across` `time/now` `time/every-ms` `time/when`
`time/from-ms` `time/to-ms` · `world/tape-lcamera` `world/running?`
`world/stop` `world/start` `world/state` · `stop` `to-draw` `escalate` ·
`with-input-from-string`

**Order of work:** Group A first. It is the bulk, it is pure numeric verbs, and
numeric verbs are the case where the interpreter can grade hardest. Group B's
`input/*` and `world/*` verbs are effectful and may not be gradeable
deterministically at all — decide that before generating, not after.

---

## Open, needs Alfred

The `clamp` verb card carries a trap the engine no longer has. The record says
`(clamp 5 0)` is `+nan.0`; the engine prints `5` (`src/base.js:1203`, and the
comment at `:1199-1202` claims it matches the reference, which is also stale).
Fix the record to match the engine, or make a 2-arg `clamp` raise — but it must
be settled before that card is fed to any generator, because the card is treated
as ground truth.
