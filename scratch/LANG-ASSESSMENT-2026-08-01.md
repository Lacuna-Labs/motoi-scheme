# MOTOI LANGUAGE ASSESSMENT — 2026-08-01

Four assessors, run in parallel against the live tree. Every headline claim below was
re-verified by hand with `./bin/motoi eval` before it was written down. Nothing here is
quoted from a design doc.

- **Marcus** — SRFI upgrade audit
- **Abel Sussman** — correctness / R7RS conformance
- **Zain** — performance, hot paths, drawing stack
- **Kleene** — language-surface hygiene, naming, docs parity

---

## 0. THE HEADLINE YOU DIDN'T ASK FOR

**"We added new SRFIs" is not true on disk.** There are four SRFI modules and none is
newer than Jul 26:

```
lib/std/srfi-1.js    Jul 25    lib/std/srfi-13.js   Jul 24
lib/std/srfi-125.js  Jul 26    lib/std/srfi-27.js   Jul 26
```

Zero hits for srfi-2/8/9/26/43/69/113/128/132/133/143/158. There is no new SRFI to
upgrade toward. The upgrade opportunity is the opposite direction: the four we *have*
are barely used by the carts.

Stating this plainly rather than papering over it — honest nulls, no fluent-wrong.

---

## 1. CRITICAL — silent-wrong (verified by hand)

These return a wrong answer with no error. That is the worst failure mode for a teaching
language, because the kid's screen shows something and it is a lie.

| # | Defect | Repro | Actual | Should be |
|---|--------|-------|--------|-----------|
| C1 | **No cons cells / dotted pairs** | `(cdr (cons 1 2))` | `(2)` | `2` |
| C1b| Reader treats `.` as a symbol | `(cdr (assq 'a '((a . 1))))` | `(. 1)` | `1` |
| C2 | **`apply` drops all leading args** | `(apply + 1 2 (list 3 4))` | `1` | `10` |
| C3 | **`+ - *` are raw JS operators** | `(+ 1 "a")` | `"1a"` | error |
| C4 | **`define-record-type` 100% broken** | `(define-record-type <pt> (mk x) pt? (x px))` | `error: fieldSyms.map is not a function` | works |
| C5 | **Bad input returns JS `undefined`** | `(car (list))`, `(length 5)` | blank | error |
| C6 | `(/ 1 0)` | `Infinity` | error or exact | |
| C7 | **`eq?`=`eqv?`=`equal?`=`=?`** | `(eq? (list 1 2) (list 1 2))` | `#t` | `#f` |

**C1** — `src/base.js:93-95`: `cons` is array spread, `cdr` is `slice(1)`. Every R7RS and
SRFI-1 alist idiom silently yields garbage.

**C4** — ABI mismatch: `src/interp.js:571` spreads fields, `lib/base/r7rs-small.js:1076`
expects an array. Also `_record-ref` takes a numeric index but interp passes a `Sym`, so
every accessor would read field 0 even after the spread is fixed. Two bugs stacked.

**C7** — `src/base.js:203-208` defines all four names to the same function, with a comment
claiming it's so "operators coming from Racket/Chez/Chicken aren't surprised." The comment
has it backwards: a Chez author would be *very* surprised that `eq?` is deep equality.
This is a direct violation of the LOCKED R7RS-small stdlib doctrine. Carts call `eq?` 203×
but **0 times on string literals**, 19 on call results — so the fix is likely safe, but it
must re-run all 41 carts as the gate.

### High

- `exact?`/`inexact?` conflate exactness with *integrality* (`lib/std/r7rs-completions-core.js:149-150`): `(exact? 1.0)` → `#t`, `(inexact? 1.0)` → `#f`.
- Rationals exist but `/` bypasses them: `(/ 1 3)` → float; `(exact (/ 1 3))` → `333333333/1000000000`.
- Silent integer overflow: `(+ 9007199254740992 1)` unchanged; `(expt 2 100)` → `1.267e+30`.
- `(string->number "1x")` → `1`.
- Arity is unchecked: `(define (f x) x) (f 1 2)` → `1`.

### Verified correct — do not touch

Proper tail calls in **all** tail positions, including mutual recursion at 200k. The
`fuel exhausted` at default 200000 is the deliberate seatbelt, not a TCO failure.
`syntax-rules` hygiene incl. capture-avoidance. `dynamic-wind` + escaping `call/cc`.
`quotient`/`remainder`/`modulo` signs, all six cases. `guard`/`raise`/`error-object-*`.
Banker's `round`.

**Deliberately absent, not bugs:** `set-cdr!`, `string-set!`, `string-fill!`, `read` —
the mutation-free / eval-free sandbox. **Implemented-but-limited:** continuations are
one-shot escape-only; re-entry gives a bare `error: undefined` instead of an honest
"re-entrant continuation unsupported."

---

## 2. THE SEED BUG — a regression of a bug we already fixed

`(with-seed 42 …)` does **not** cover `random-integer`. Verified, two consecutive runs:

```
(with-seed 42 (lambda () (list (random 100) (random-integer 100))))
  => (25.234517478384078 54)
  => (25.234517478384078 33)      ; random-integer diverges
```

`lib/std/srfi-27.js:29` hardcodes `rand: Math.random`. The seeded LCG lives at
`lib/game/misc.js:33`.

This is the *third* occurrence of this exact bug class. `misc.js` carries a dated comment
from the last fix:

> BUG-2 fix (Zane-2, 2026-07-17): the seeded rng draw. Every random-\* verb installed below
> routes through this helper so `with-seed` covers ALL of them, not just (random).

SRFI-27 landed 2026-07-26 — nine days after that fix — and reintroduced it, because
nothing enforces the invariant. **Recommendation: fix it and add a test that enumerates
every verb matching `random` and asserts seed-determinism**, so a fourth occurrence is
impossible.

Downstream: **34 hand-rolled `1103515245` LCG lines across the carts** (tic-tac-toe,
backgammon, asteroids, go-nine, starfighter, space-invaders, connect-four, …). They exist
because the built-in RNG can't be trusted under a seed. Fixing SRFI-27 unblocks deleting
all of them.

---

## 3. WHAT THE CARTS REIMPLEMENT (the SRFI "upgrade" that actually exists)

| Reimplemented | Count | Replace with |
|---|---:|---|
| LCG rng | 34 lines | `random-integer` (after §2) |
| `pad` | 11 carts | `string-pad` (SRFI-13) |
| `take` / `drop` | 7 carts | SRFI-1 |
| `join` | 2 carts | `string-join` (SRFI-13) |

Cart usage of SRFI today: `filter` 16 uses. `iota`, `fold`, `delete-duplicates`,
`take-while`, `string-join`, `string-split`, `string-index`, `string-contains`,
`make-hash-table`, `random-integer`, `list-tabulate`, `find`, `remove` — **0 each.**
Against 912 hand-rolled `(define (` and 300+ `let loop`.

Coverage gaps worth filling: SRFI-1 `lset-*`, `span`, `break`, `take-right`, `drop-right`,
`split-at`; SRFI-13 `string-tokenize`, `string-any/every`, `string-concatenate`;
SRFI-125 `hash-table-empty?/count/find/map/prune!`.

**Don't use `Spec/srfi-*.slatl` as the conformance gate** — they are auto-generated from
each module's own META, so they can never surface a gap.

---

## 4. PERFORMANCE — one free 30%, then stop

**Telemetry hooks run in production.** `installCore` unconditionally wires
`setCountHook` (`lib/system/verb-stats.js:274` — a **BigInt** Map read/add/set per
primitive dispatch) and `setStackHooks` (`lib/system/stack.js:91` — allocates an object +
`String()` per closure call; `stack.js:37` does `frames.slice()` on every new peak, latent
O(d²)).

| bench | hooks on | hooks off | Δ |
|---|---|---|---|
| 1e6 named-let accumulate | 720.5 ms | 547.7 ms | −24.0% |
| 1e6 empty named-let | 473.8 ms | 329.8 ms | −30.4% |
| fib(25) | 132.9 ms | 91.7 ms | −31.0% |

Make both opt-in (TUI/IDE/`--stats`). Zero correctness risk — pure observability.

**Boot: 12 ms of `snap()` bookkeeping** — `core/index.js:291,304` builds two
`new Set(env.vars.keys())` *per installer* over a growing 1712-name map, for a summary
nothing reads at runtime. Gate behind a debug flag.

**Measured-negative — do NOT do these.** I benchmarked the two "obvious" wins and both
are losses: the `Env.get` single-lookup rewrite is **33% slower** (300.9 vs 226.1 ms,
misses pay twice), and the arithmetic `typeof` fast-path is 91.2 vs 65.5 ms. A real win
needs lexical addressing at expand time — high risk, defer.

**Drawing stack is already fast, no action.** `fill-poly` 26 µs; a 3-way `sdf-union` full
320×240 fill 0.38 ms (~88 per frame); `overlay`+`draw-image` 0.11 ms. Nits only: `sdf-fill`
lacks bbox tracking, `fillPolygon` allocates per scanline, `svg-path.js:41` re-tokenizes
`d` every call.

**`cons`/`cdr` are O(n) → list code is O(n²)**: n=5k 59 ms, 40k 3134 ms. Not urgent for
the target (200 entities × 60 frames = 0.33 ms/frame); bites above ~2000 elements. The
fix is real cons cells — same change as C1.

**Verdict:** for 320×240 carts the interpreter is already fast enough. Fuel refills to
200k/frame and 200k steps ≈ 10 ms inside a 33 ms frame. Do the two free ones, stop.

---

## 5. SURFACE HYGIENE

Live registry: **1712 bindings**, 76 installers, 0 install failures. (Not 1,173 — that was
a `src/reader.js` doc count, not the runtime.)

1. **`motoi help <verb>` is dead for all 1697 verbs.** `src/cli.js:372-381` calls
   `help(verb)` without ever building an env, so the registry is empty and every lookup
   returns `unknown verb`. Verified: `./bin/motoi help triangle-fill` → `unknown verb`.
   In-language `(help 'x)` works. Pure bug fix.
2. **`motoi docs` throws** — missing `await` at `src/cli.js:393`. Verified.
   `docs regen` also defaults to `docs/reference`, not canonical `Scheme/reference`.
3. **1392/1697 verbs (82%) have no `doc` string.**
4. **Fill-naming: three conventions.** Suffix `-fill` (8), prefix `fill-` (3),
   `filled-rectangle`. Carts only ever call the suffix form; every prefix form has 0 cart
   calls. Suffix `-fill` should win.
5. **18 pure aliases, zero alias metadata** (`deprecated`/`aliasFor` = 0 registry-wide).
   Carts use only the canonical member of each group. Keep `rectangle`/`pixel` as
   intentional kid-friendly aliases; mark the rest.
6. **`audio/*` vs `audio-*` silently diverge** — `audio-tempo` is a setter returning a
   handle, `audio/tempo` is a getter returning BPM; `audio-playing?` ≠ `audio/playing?`.
   That is a real bug wearing an aliasing costume. 0 cart calls.
7. **The three "lazy, excludable" SRFI parts are eagerly always-on** —
   `src/r7rs-completions.js:48-51` installs all four regardless, while
   `core/parts-registry.js:56-59` believes the decorative `LAZY = true` flags. Two sources
   of truth; violates CLAUDE.md gate #4.
8. **Docs parity is good** — 89 chapters, 1289 documented verbs, only 3 ghosts
   (`sprite`, `sprites`, `on-collision`). All 53 new drawing verbs ARE documented (ch.
   73-79). The switch did not drift the docs.
9. **Dead code: `installCortexIO`** (`lib/ai/cortex-io.js:68`), superseded by
   `lib/ai/cortex.js`. Archive, don't delete.

---

## 6. TEST SUITE GATES NOTHING

507 pass / 93 fail / 600 total. Node 26 stopped printing the `# pass` summary under the
default reporter, which is why it reads as "just failing." Most of the 93 are **stale
expectations**, not live regressions — e.g. `tests/wave-2-lib-loader.test.mjs:50` asserts
85 installers when the live count is 79; `part/wave` now returns a gesture alist, not a
function.

A suite at 93 known-red cannot gate anything, which is precisely how the SRFI-27 seed
regression walked back in nine days after being fixed. **Rebaselining this is the
prerequisite for every fix below.**

---

## 7. IMPACT ON THE SFT CORPUS — checked, and it's clean

The obvious worry: is the fold teaching constructs the language gets wrong? Checked
directly against `forge/scratch/sft-plans/fold/`.

- `set-cdr!` — 31 rows, and they teach it as **absent**, correctly:
  *"we rebuild the alist on update because Motoi lists are immutable (there is no
  set-cdr!)"*. The corpus routes around the missing dotted pair rather than teaching it.
- `string-set!` 3 rows, `string-fill!` 0, `define-record-type` 4 rows.

**The corpus is honest about the gaps.** No re-generation is required on account of these
findings. C1/C4 are engine bugs, not corpus poison.

---

## 8. RECOMMENDED ORDER

**Gate first (nothing else is safe without it)**
0. Rebaseline the test suite to green; restore the pass/fail summary under Node 26.

**Tier 1 — free, no correctness risk**
1. Gate the telemetry hooks behind `--stats` (~30% interpreter speedup).
2. Gate `snap()` behind a debug flag (12 ms off every launch).
3. Fix `motoi help <verb>` (missing env) and `motoi docs` (missing `await`).
4. Route SRFI-27 through the seeded LCG **+ add the enumerate-all-random-verbs test.**

**Tier 2 — correctness, needs the 41-cart gate**
5. `eq?`/`eqv?` split from `equal?`.
6. `apply` leading args; numeric guards on `+ - *`; errors instead of `undefined`;
   arity checking; `(/ 1 0)`.
7. `define-record-type` ABI (both bugs).

**Tier 3 — cart cleanup, unblocked by #4**
8. Delete 34 hand-rolled LCGs, 11 `pad`, 7 `take`/`drop`, 2 `join`.
9. Fill the SRFI-1/13/125 coverage gaps.

**Tier 4 — deliberate, later**
10. Real cons cells (fixes C1 + the O(n²) list cliff). Large blast radius: arrays are the
    pervasive list representation.
11. Alias metadata, fill-naming convergence, `audio/*` vs `audio-*` divergence.
12. `exact?`/`inexact?`, rational `/`, integer overflow.

**Do not do:** the `Env.get` rewrite or the arithmetic fast-path. Both measured slower.
