# Sample: Qwen filling one verb's 15-slot grid (`clamp`)

Model: `Qwen3-Coder-30B-A3B-Instruct-4bit`, local, $0. Driver:
`scratch/sample-one-verb-grid.py`. Nothing written into `scheme/reference/`.

`clamp` has 3 of 15 slots authored. The 12 missing are rows 2–5, three programs
each. Below is what came back.

## Result: 3 of 12 usable

| pass | gate | kept |
|---|---|---|
| 1 | runs + deterministic | 7/12 |
| 2 | + no degenerate/duplicate output | 7/12 |
| 3 | + must not redefine the verb | **3/12** |

## Why pass 1 was a lie

Six of the seven "passing" programs opened with:

```scheme
(define (clamp x lo hi) (min hi (max lo x)))
(display (clamp 15 0 10))
(display (clamp 15 0 10))
```

They shadow the builtin, test their own copy, and print `1010`. They run clean
and deterministically. **If Motoi's `clamp` broke tomorrow, every one of them
would still pass green.** The interpreter cannot catch this — it is a real
program producing real output. It is the same shape as the conformance gate that
only checked examples *ran*.

Two other fakes in that batch: `(display (clamp 100 50 200))(display 100)(display 200)`
— displaying bare literals to simulate a three-rung ladder.

Structural gates now enforced, none of which the interpreter can provide:
redefines-the-verb · never-calls-the-verb · displays-a-bare-literal.

## The 3 that survived — all from row-5-emergence

```scheme
;; eng-composition  -> (0 50)
(define (health-bar current max) (clamp current 0 max))
(define (health-bar-clamped)
  (list (health-bar -5 100) (health-bar 50 100)))
(health-bar-clamped)

;; math-composition -> (0 1)
(define (easing-parameter t)
  (clamp t 0 1))
(define (easing-test)
  (list (easing-parameter -0.2) (easing-parameter 1.5)))
(easing-test)

;; cs-composition   -> (0 800)
(define (sprite-position x)
  (clamp x 0 800))
(define (sprite-test)
  (list (sprite-position -10) (sprite-position 810)))
(sprite-test)
```

These are genuinely usable — correct, they exercise the real verb, and they show
both ends of the clamp. But they are the *same program three times* with the
nouns swapped: wrap, call twice out of range, list the results. That is
template-lock, the same defect measured in the sensation graph.

## What it could not do at all

- **Rows 2, 3, 4 yielded zero.** Audit, dimension-ladder, and proof are the rows
  that require reasoning about the verb's *traps* and *invariants*. Row 5
  (compose it into a wrapper) is the easy one, and it is the only one that
  produced anything.
- **None of the prose.** `:problem`, `:claim`, `:invariant`, `:explanation` were
  not attempted here. Those are comparative judgement and nothing in the
  toolchain can falsify them.

Worth noting what the *existing* hand-authored `clamp` examples do, since that is
the bar: they document that `(clamp 5 10 0)` returns `0` with reversed bounds and
never raises, and that `(clamp 5 0)` is `+nan.0` that then travels into a
coordinate and fails somewhere else. Qwen produced nothing in that class.

## v2 — few-shot + caveats + retry

`scratch/fill-grid-v2.py`. Three levers: few-shot the real authored `sqrt`
programs so it sees the house style; feed it the verb's own `:caveats` and demand
a program demonstrating a trap; retry with the exact rejection reason instead of
one-shotting.

**Gate score 3/12 -> 9/12. Quality went DOWN.**

Everything collapsed to a one-liner:

```scheme
;; row-2-audit.eng-program   -> (10 0)
(display (list (clamp 15 0 10) (clamp -5 0 10)))

;; row-5-emergence.math-composition  -> (0)
(display (list (clamp 5 10 0)))
```

The instruction said "3-8 lines, use define." All nine ignored it. Row-3 is meant
to be a ladder into a real domain and produced `(display (list (clamp 1 0 10)))`.
Row-5 is meant to compose the verb inside a larger function and produced a bare
call — the opposite of the row's purpose.

What happened: adding hard constraints made the model optimise for the *gate*
rather than the *intent*. Told not to define the verb, it stopped defining
anything. The v1 output was worse on the gate and better as teaching material.
**Gate score is not quality, and the two moved in opposite directions.**

## v3 — templated cells (Alfred's idea)

`scratch/fill-grid-v3.py`. The model never emits code shape. Every cell has a
fixed program skeleton; the model returns JSON leaf values (a function name, a
parameter list, a body expression, test cases) and the script renders the
program. The skeleton guarantees by construction what v2's prose instructions
could not: a `define` is present, the verb is called, the output is a list, the
program is multi-line.

**This fixed the collapse. v2's one-liner problem is structurally impossible in
v3.** It did not fix the substance.

Four runs were needed, and the first three failures were mine, not the model's:

| run | kept | what was actually broken |
|---|---|---|
| 1 | 1/12 | model lowercased the JSON keys (`fn`, not `FN`) because I told it "names must be lowercase-with-dashes"; every hole read as unfilled |
| 2 | 2/12 | template wrapped `(list {CASES})` while the model also supplied `(list ...)` → double-wrapped; and it named helpers `clamp` |
| 3 | 5/12 | retry prompt carried the rejection reason but **not the original prompt**, so the model repeated the same mistake verbatim twice |
| 4 | 3/12 | honest |

Run 3 kept 5. Two of those five were fake, and **my gate passed both** — I only
caught them by reading the programs:

```scheme
;; row-3-dimension — "a ladder". All three rungs have the SAME body.
(define (plain x) (clamp x 0 10))
(define (physical x) (clamp x 0 10))
(define (clamp-health x) (clamp x 0 10))
(display (list (plain 5) (physical 15) (clamp-health -5)))   ; -> (5 10 0)
```

The rungs "differ" only because different arguments were passed. My distinctness
check tested the *outputs*, so it passed.

```scheme
;; row-5-emergence — "composition". clamp-health never calls clamp-value.
(define (clamp-value x lo hi) (clamp x lo hi))
(define (clamp-health health) (clamp health 0 100))
```

The helper is dead code. The composition row composed nothing.

Both are now gated structurally (`render()`: the three rung bodies must be
textually distinct; `BBODY` must call `HELPER`). That is what dropped run 4 back
to 3/12 — the gate got honest, not the model.

### v3 final: 3 of 12, all three real

```scheme
;; row-2-audit.eng   -> (0 0.5 1)
(define (clamp-to-0-1 x) (clamp x 0 1))
(display (list (clamp-to-0-1 -0.5) (clamp-to-0-1 0.5) (clamp-to-0-1 1.5)))
(newline)

;; row-2-audit.math  -> (0 50 100)
(define (keep-on-screen x) (clamp x 0 100))
(display (list (keep-on-screen -5) (keep-on-screen 50) (keep-on-screen 105)))
(newline)

;; row-4-proof.cs    -> (#t #t #t #t)
(define (holds? x lo hi)
  (= (clamp x lo hi) (min hi (max lo x))))
(display (map (lambda (c) (apply holds? c))
              (list (list 5 0 10) (list -3 0 10) (list 15 0 10) (list 5 10 0))))
(newline)
```

The row-4 program is **the best single artifact any version produced**. It
asserts that the builtin equals the reference formula `(min hi (max lo x))`
across four cases including the reversed-bounds `(5 10 0)`, and every case
holds. That is a property test, not a demo — and it independently confirms the
`src/base.js:1203` rewrite is equivalent to the form it replaced on those
inputs, which is the claim the code comment makes and nothing in the repo
checked.

### What v3 still cannot do

- **Rows 3 and 5 yielded zero**, same as v1. Ladder and composition are the rows
  that need reasoning about the verb rather than around it. When forced into a
  skeleton the model fills the skeleton and empties it of meaning — identical
  rung bodies, dead helpers. It satisfies shape without satisfying intent.
- **The domain axis collapsed.** `keep-on-screen` — plainly an engineering
  program — landed in the `math` slot. eng/math/cs are not being differentiated,
  and no gate can catch that.
- **The two row-2 keeps are the same program twice** with different constants.
  Distinct outputs, so the duplicate gate passes. Template-lock survived
  templating, because now the template is *mine*.

### Score across all three versions, on `clamp`

| version | gate | actually usable |
|---|---|---|
| v1 free-form | 7/12 → 3/12 after structural gates | 3 (all row-5, near-identical) |
| v2 few-shot + retry | 9/12 | ~0 (all collapsed to one-liners) |
| v3 templated cells | 3/12 | **3, and all three are honest** |

v3 is the first version where the gate score and the quality point the same way.
The yield did not move. What moved is that the number can now be trusted.

## The exercise found a real bug in the manual

Pointing the model at `:caveats` made it emit `(clamp 5 0)` — the two-argument
form the manual warns about. The manual says, in both `:explanation` and
`:caveats`:

> A missing hi gives +nan.0, not an arity error: (clamp 5 0) is +nan.0 and the
> NaN travels into whatever consumes it.

The engine disagrees:

```
$ printf '(display (clamp 5 0))' > /tmp/cl.scm
$ MOTOI_HOME=/tmp/mx ./bin/motoi run /tmp/cl.scm
5
```

Cause — `clamp` was rewritten at `src/base.js:1203`:

```js
def('clamp', (x, lo, hi) => {
  const r = num(x) < num(lo) ? lo : x
  return num(r) > num(hi) ? hi : r
})
```

With `hi` undefined, `num(hi)` is NaN and `r > NaN` is false, so it returns `r`.
The old `Math.min(hi, Math.max(lo, x))` form did give NaN. The caveat is **stale
relative to the rewrite** and now documents a trap that no longer exists.

This is a silent-wrong record sitting in the `:caveats` field — the part a paying
reader trusts most. Needs Alfred's call: fix the caveat to match the engine, or
make the engine raise on a 2-arg call. Note the code comment at
`src/base.js:1199-1202` claims it matches "what the reference documents", which
is no longer true either.

**Worth saying plainly: this bug was found by the model, not by the gate.** Every
existing check passed this record.

## Verdict

Qwen is not able to fill this grid at the quality the existing records hold. It
is useful as a **proposer for row-5 compositions** behind the structural gates,
at roughly 25% yield and with a diversity problem. For rows 2–4 and all prose it
is currently a liability, because its failures are fluent and look right.

Options, cheapest first:

1. **Narrow it.** Let Qwen do row-5 compositions only, gated, and hand-author
   rows 2–4. Fills ~3 of 12 slots per verb automatically.
2. ~~**Better prompting per row**~~ — TRIED, twice (v2 caveats+few-shot, v3
   templated cells). Neither moved the yield off ~3/12. Prompting is exhausted;
   the ceiling is the model's grasp of the verb, not the instructions.
3. **Paid authoring pass** for rows 2–4 + prose across the 45 verbs.
4. **Leave the 45 at 12–14 slots.** They are 97.2% of the way there and the
   deficit is 344 programs on a 27,140-slot manual.

Option 4 deserves saying out loud: this may not be worth fixing before the CPT.
The 212 completely undocumented verbs are a much larger hole than these 45.
