# Reference-manual example validation — 2026-07-25

Ran **every runnable program** in `scheme/reference/*.slat` (all 15-per-verb
fields: `:code :program :*-program :*-composition`) through the authoritative
eval path. Env parity with `./bin/motoi run /dev/stdin` **confirmed** (identical
errors on spot-checks) — these failures are real, not harness artifacts.

## Headline

- Extracted runnable programs: **17,887**
- **PASS ≈ 15,062  ·  FAIL ≈ 2,818  ·  HANG 7**  →  ~84% pass
- (5 chunks first "crashed" from fresh-env OOM; recovered per-snippet with a
  worker timeout. Only 2 verbs actually hang — see below.)

## Failure buckets (of 2,745 captured FAIL records)

| # | bucket | count | nature | proposed disposition |
|---|--------|------:|--------|----------------------|
| A | excluded-doctrine (`fold-left`/`foldl`/`foldr`) | 163 | correct — R6RS/Racket, deliberately excluded | keep as broken-examples (already partly catalogued) |
| B | number-tower (`1/2`,`22/7`,`+inf.0`,`+nan.0`, complex-coerce) | 268 | reader/runtime has no rationals, inf/nan, or complex | **DECISION: implement R7RS number tower vs declare broken** (154 are chapter 17-complex) |
| C | missing stdlib (`read`,`error?`,`list-head`,`for-all`) | 55 | `read`/`error?` R7RS, `list-head` SRFI-1 → wire; `for-all` R6RS → broken | wire the standard 3; `for-all`→broken |
| D | fragment (single-letter unbound: `a x p v n f h`) | 372 | example not self-contained (`(audio-halt h)` — `h` never bound) | authoring defect — regenerate self-contained |
| E | js-impl-bug (`.map`/`.slice`/`NaN is not a function`) | 189 | verb impl throws raw JS error | **fix verb impls** |
| F | namespaced-gap (`linalg/mv`,`fb/rect`,`paint-cell`,`card/do`…) | 255 | verb named in ref but unwired; some are Curator-dialect | split: wire Motoi verbs, out-of-scope Curator ones |
| G | undefined helper (`parse-float`,`parse-rational`…) | 123 | example calls a helper it never defines | authoring defect — regenerate |
| H | char-coerce (all in 12-char.slat: "not a character a") | 67 | systemic char-literal issue in one chapter | investigate 12-char |
| I | other-unbound (`in-formation`,`arm-angle`,`rule-conway`,`grid`…) | 964 | mostly unwired sibling verbs / undefined helpers | split: wire vs out-of-scope vs regenerate |

## The 7 hangs (non-terminating verb impls — real bugs)

- `game/surreal-simplest` (28-game.slat) — 6 programs. `(game/surreal-simplest 0 1)`
  never returns. Infinite recursion / no base case.
- `ops/max-flow` (47-ops.slat) — 1 program (`:eng-composition`). Augmenting-path
  loop never terminates on a particular graph.

## Read of it

Two systematic root causes dominate, not one-off "usefully broken" teaching cases:

1. **Missing language features** — R7RS number tower (rationals, inf/nan, complex)
   is absent; a whole chapter (17-complex) presumes it. Plus a few standard verbs
   (`read`, `error?`, `list-head`).
2. **Example programs that reference an unwired / Curator-dialect vocabulary**
   (`paint-cell`, `camera-frame`, `on-key`, `in-formation`, `arc-between`,
   `begin-frame`) or undefined local helpers — ~1,400 programs are not
   self-contained. These are authoring defects, NOT teaching signal.

Routing all 2,818 to `broken-examples/` would be wrong: only bucket A (and
`for-all`) are doctrine-broken teaching cases. The rest need fixing (wire verbs /
implement number tower / repair impls / regenerate non-self-contained examples).

Artifacts: `/tmp/motoi-ref-allcode.jsonl` (all snippets),
`/tmp/motoi-ref-failures.jsonl` (2,745 FAIL records),
`scratch/triage-ref-failures.mjs` (classifier),
`scratch/run-ref-snippets-timeout.mjs` (hang detector).
