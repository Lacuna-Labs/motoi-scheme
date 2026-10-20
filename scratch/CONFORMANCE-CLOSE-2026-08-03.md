# R7RS + SRFI conformance — the close, 2026-08-03

Written for the test gate. Every number here was produced by a command
named beside it, on one settled tree, after all five authorized items landed.

## The gates

| gate | command | before today | after the first five | now (file ports) |
|---|---|---|---|---|
| repo suite | `node --test --test-reporter=tap tests/*.test.mjs tests/**/*.test.mjs` | 786 / 0 fail | 847 / 0 fail | **859 / 0 fail** |
| reference notes | `python3 scratch/verify-reference-notes.py` | 969 MATCH / 0 / 0 | 969 MATCH / 0 / 0 | **969 MATCH / 0 MISMATCH / 0 ERROR** |
| larceny oracle | `run_larceny.py` → `score_larceny.py` | 2074 exec / 2027 pass / 47 fail / 26 drop | 2149 / 2140 / 9 fail / 3 drop | **2151 exec / 2142 pass / 9 fail / 3 drop** |
| chibi oracle | `run_chibi3.py` → `score.py` | 1204 / 1186 pass | 1204 / 1191 pass, 13 fail | **1204 exec / 1195 pass / 9 fail** |

The `--test-reporter=tap` flag is not optional. Without it the runner
misreports counts when a module fails to load, which is exactly the kind of
green-for-the-wrong-reason result that has to be designed out of a gate.

## What landed

1. **SRFI-1 strong linear update** — 17 destructive verbs rewritten against
   real cells (`take!` `drop-right!` `split-at!` `append!` `concatenate!`
   `reverse!` `append-reverse!` `map!` `filter!` `remove!` `partition!`
   `take-while!` `span!` `break!` `delete!` `delete-duplicates!`
   `alist-delete!`). `split-at!` had a doc row and no definition.
2. **P3 — circular lists, interior pointers, cycle-aware `equal?`.**
   `list.sld` went from 25 failures to **0**; `write.sld` and `read.sld` to
   **0**. With SRFI-133 in, `vector.sld` is **103 / 103, zero failures and
   zero drops** — it was 33 executed, 28 passing, 5 failing, 19 dropped.
3. **Macro hygiene** (`src/macro.js`) — custom ellipsis, lexically shadowed
   `...`, and `bound-identifier=?` vs `free-identifier=?`. Ellipsis is now
   recognized by name **and** mark, so `(let ((... 19)) …)` really does take
   the ellipsis meaning away.
4. **`guard` re-enters the dynamic extent before re-raising**
   (R7RS §4.2.7). `dynamic-wind` records its winder pair on a passing
   condition; `guard` replays them when no clause matched. Verified against
   chibi on 12 cases including nested winds, `=>`, `else`,
   `raise-continuable`, and a call/cc escape (which is explicitly *not*
   replayed — an escape is control flow, not a condition).
5. **SRFI-133 adopted as the sixth standard part** — `lib/std/srfi-133.js`,
   27 verbs, spec at `spec/srfi-133.slatl`, registered in
   `core/parts-registry.js`. Passes all five points of the CLAUDE.md part
   gate; `lib-validate-all` answers `#t` for it.
6. **A circular ELEMENT is no longer confused with a circular SPINE.** Found
   while enumerating the residual list for this document — a real defect, not
   a policy exclusion, and the reason enumeration is not optional. `toJS` in
   `lib/base/list.js` walked to a count cap, so `(list x 'a)` where `x` is
   circular raised *"circular list passed to a verb that expects a proper
   list"* about a list that was perfectly proper. R7RS §6.1's own `equal?`
   examples build exactly that structure. Two parts: `toJS` now runs Floyd
   detection and hands a circular element through **as cells** (the rule that
   already applied to a dotted tail), while the spine still raises, because
   there the complaint is true; and `list` and `vector` became **RAW** in
   `src/base.js` and `lib/std/r7rs-completions-core.js`, since they take
   VALUES and were converting every argument on the way in. Gated by
   `tests/pairs.test.mjs`.
7. **`write` labels a cycle instead of refusing it** (§6.13.3). Found by
   enumerating the *chibi* residual after larceny was clean — larceny's
   `write.sld` read **63 / 63** the whole time, because it has no circular
   `write` case. The datum-label machinery was already correct; `write` and
   `display` were simply still being wrapped in `lib/base/r7rs-small.js` (they
   were raw in the other two installers), so the argument was flattened to an
   array — which cannot express a cycle — and the conversion raised before the
   labeller ran. `(write x)` on a self-referential `x` now prints
   `#0=(1 . #0#)`, and `write` still refuses to label a merely-shared datum
   that `write-shared` does label.

8. **File ports — the 13 verbs R7RS requires and Motoi did not have.** Landed
   after the five, same day. `open-input-file` `open-output-file`
   `open-binary-input-file` `open-binary-output-file` `call-with-input-file`
   `call-with-output-file` `with-input-from-file` `with-output-to-file`
   `file-exists?` `delete-file` `load`, plus `include` / `include-ci` in the
   expander. decision-022 and decision-025 are now `:status "superseded"`,
   superseded by **decision-026**; both rested on the argument that a port is a
   hole the dispatcher gate cannot see through, and `safePath` closes that at
   the descriptor instead. Reads are `personal-data`, writes and removals are
   `destructive`, so the untrusted and external tiers are exactly as unable to
   touch the filesystem as before. Two properties gated by
   `tests/file-ports.test.mjs` are NOT conformance and would be lost silently
   without a test: writes go THROUGH to the descriptor rather than buffering (a
   program that forgets to close must not lose what it wrote), and every
   filename is canonicalized by `safePath` first (a file port must not become
   the one door that reads outside the allowed roots).
   `(cond-expand ((library (scheme file)) …))` now answers `have-file`.

## The standard, as of today

R7RS-small (semantic authority) + SRFI-1 + SRFI-13 + SRFI-125 + SRFI-27 +
**SRFI-133**. Six parts, 299 declared verbs. R7RS-small and SRFI-1 are the
default bundle; the other four are lazy.

SRFI-133 does **not** rebind any name R7RS-small already owns
(`vector-map`, `vector-copy!`, `vector-append`, `vector-fill!`, …). It
installs last precisely so it cannot shadow one. The conformance ladder is
intact: R7RS-small first, then the SRFI.

One trap worth keeping in front of anyone touching this: SRFI-133's
`vector-fold` calls `(kons state elt)` — **accumulator first** — the opposite
of SRFI-1's `fold`. Both live in this engine. They must not be harmonized.
`tests/srfi-133.test.mjs` asserts both orders with a non-commutative `kons`,
because with `+` the two are indistinguishable.

## What the oracle still reports, and why each one is not a defect

These are the items the harness will keep flagging. They are enumerated here
so the gate can assert *this exact list* rather than a count.

The complete set is **9 failures + 3 drops**, in four classes. Each is listed
by suite and form number, because a form number is what the gate can compare.

### `include` / `include-ci` — 3 drops + 3 cascading failures — **RECLASSIFIED, a harness input gap**

This entry changed character today and the change matters more than the count,
which is identical. Before file ports, `base.sld` drops **5, 6, 7** read
`unbound symbol: include` / `include-ci` — a language gap, by policy. They now
read:

```
include: cannot read 'tests/scheme/base-test1.scm'
  (looked in …/scratch/r7rs-conformance/tests/scheme/…, …/motoi-scheme/tests/scheme/…)
```

`include` works. **The fixture files were never copied into this harness** —
`scratch/r7rs-conformance/larceny/` holds only the seven `.sld` suites
(`base char inexact list read test vector`), and `base.sld` lines 359–370
include three companion files from Larceny's own `tests/scheme/` that are not
here. `base.sld` failures **52** `(fact 6)`, **53** `(fib 10)` and **54**
(`bd578d6d`, which base.sld's own comment already marks
implementation-dependent/FIXME) still cascade from the drops.

So this is now a **missing harness input**, not a missing language feature, and
it is the one item on this page that a human has to decide about. The fixture
contents are fully determined by the assertions that consume them — `(fact 6)`
→ 720, a case-folded `(fib 10)` → 55, `bd578d6d` → 319 — which means I could
write files that make these six go green. **I did not**, and this note exists so
nobody later mistakes the omission for an oversight: authoring the fixtures
myself and then reporting "the include tests pass" would be the gate certifying
its own input. The real files should come from the Larceny distribution, or the
three drops should stay enumerated here permanently as *not supplied*.

### `base.sld` form 93 — a harness capture artifact, 1 failure

`(display "4 plus 1 equals ") (display (+ 4 1))` emits no trailing newline, so
the harness's own `@@T` / `@@X` / `@@R` marker lines land inside the captured
string. The recorded output ends `@@R PASS` — **the harness itself scores the
case as passing** and only the scorer's capture boundary disagrees. Motoi
prints exactly `4 plus 1 equals 5`. Not a language defect; do not "fix" it in
the engine.

### `(vector-copy! a 2 a 0)` — `base.sld` form 518, 2 failures

R7RS §6.8 requires `(- (vector-length to) at)` to be at least `(- end start)`.
Here that is `3 ≥ 5`, which is false, so it **is** an error. chibi errors too.
Larceny clamps, which is why it also reports the follow-on `a` as
`#(1 2 1 2 3)` where Motoi leaves `#(1 2 3 4 5)` untouched. **R7RS text wins;
Motoi and chibi agree.** Not a defect.

### `(/ 1.0 0)` and `(/ 0.0 0)` — `inexact.sld` forms 96 and 101, 2 failures

Exact-zero divisor. chibi raises; Motoi raises; larceny answers `+inf.0` /
`+nan.0`. Motoi matches chibi and the text.

### `dynamic-wind` + `call/cc` re-entry — `base.sld` form 588, 1 failure

The `(connect talk1 disconnect connect talk2 disconnect)` example. Bounded by
decision-004 (escape-only continuations) — a full re-entrant continuation is
the only thing that would close it, and that is a language decision, not a bug
fix.

## The chibi side, enumerated the same way — 9 failures

Larceny's suite has no circular-`write` case, so `write.sld` read 63/63 while
`write` was in fact non-conformant. **That is the argument for keeping both
oracles**: a clean suite is evidence about the cases the suite contains and
nothing else.

| form | what | verdict |
|---|---|---|
| 124, 127 | `(sequence2 …)`, `(sequence3 …)` unbound | **harness artifact.** Cascades from `load-error` drops 121/123/126. All three `be-like-begin` ellipsis-escape forms (§4.3.2, `(... ...)` and `(... template)` and a custom `dots`) were run standalone and answer **3, 4, 5** — correct. Not a language defect. |
| 149 | `(bar 1)` → `1`, chibi says `x` | **real, known-open.** Referential transparency for *variables* under a plain `define-syntax`. Needs per-identifier renaming. Item 4 below. |
| 405 | `make-polar` digits | Motoi prints the full round-trip double `0.5403023058681398`; chibi truncates to `0.54030230586814`. Motoi's reads back `eqv?`; chibi's does not. Not a defect. |
| 850 | `dynamic-wind` + `call/cc` | decision-004. Same case as larceny 588. |
| 1048 | symbol printed `+NaN.0abc`, chibi bars it `\|+NaN.0abc\|` | **not a defect — verified by round-trip, not by comparison.** Motoi reads its own output back as the *same* symbol, and `+nan.0` / `+inf.0` / `+i` / `1+2i` all still read as NUMBERS. R7RS §7.1.1 makes `+NaN.0abc` a valid peculiar identifier (`+` `<sign subsequent>` `<subsequent>*`). Motoi does bar `\|hello world\|`, `\|123\|`, `\|\|`. chibi is conservative. |
| 1153, 1154, 1156 | subnormals print `5e-324`, chibi `4.94065645841247e-324` | Motoi's spelling is shortest-round-trip and is valid R7RS inexact syntax. The harness's accepted-spelling list simply does not contain it. Not a defect. |

So of chibi's 9, **exactly one (form 149) is an open defect**, and it is
already item 4 below. The rest are harness or chibi being conservative — with
file ports in, there is no longer a single *policy* exclusion on this list.

## Known-open, found while closing — not fixed, not hidden

1. On a **never-handled** raise, Motoi runs the `after` thunk; chibi aborts
   without unwinding. R7RS-small does not specify uncaught-exception
   behavior, so neither engine is non-conformant. Pre-existing, independent
   of `guard`.
2. `guard` catches call/cc `_EscapeSignal` sentinels as though they were
   conditions. Harmless today because no clause matches a sentinel, so it
   re-raises — but a `guard` with an `else` clause would swallow a non-local
   exit. Latent.
3. `with-exception-handler` unwinds before calling its handler; §6.11 calls
   it in the raise's dynamic environment. Same escape-only root.
   `raise-continuable` is correct.
4. Referential transparency for *variables* under a plain `define-syntax`
   (chibi says `outer`, Motoi says `inner`). Needs per-identifier renaming,
   not another special case.

## Designing the gate from this

The pass is usable as a gate because the failure list above is **enumerated
and explained**, not summarized. A gate that asserts a *count* goes green the
moment a fix un-masks a vacuous assertion somewhere else — that already
happened once today, when fixing `pair-fold` made `list.sld` fall from 149 to
147 because five assertions had been passing on an empty list. The gate must
assert the identity of each expected failure, so that a *new* failure is
distinguishable from a *known* one.

Recommended shape:

- **Hard blockers**: repo suite 0 fail; reference notes 0 MISMATCH / 0 ERROR.
- **Oracle**: assert the set of failing forms equals the enumerated set
  above. Any form entering or leaving that set is a change that needs a human
  to look at it, in both directions.
