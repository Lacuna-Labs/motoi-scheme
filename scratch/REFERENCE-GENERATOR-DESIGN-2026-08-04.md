# Reference Generator — design notes, 2026-08-04

Working notes for the local generate-and-gate driver that fills missing verb
grid slots. Nothing here is written into `scheme/reference/`.

## Alfred's two directions this session

1. **Split by model.** Code model handles the Scheme; prose model handles the
   text. ("What about the scheme alone and mistral handles text?")
2. **Shape, don't judge.** ("Haiku fucks up too. You have to correct it and
   shape it. Do the same for Qwen. Don't we big ones?")

Direction 2 corrects a wrong call I made: I reported ~3/12 as a *model ceiling*
after four runs. Three of those four runs failed on **harness bugs of mine**,
not on the model — lowercased JSON keys, a double-wrapped `(list ...)`, and a
retry prompt that omitted the original prompt so the model repeated itself
verbatim. That is a harness defect reported as a model limitation.

## Why v3 was never actually shaped

Every cell started from a blank prompt. Nothing accumulated across cells. The
visible cost, straight from the run log:

```
retry row-5-emergence.eng (hole HELPER was named `clamp` ...)
retry row-5-emergence.math (hole HELPER was named `clamp` ...)
retry row-5-emergence.cs (hole HELPER was named `clamp` ...)
```

Three independent cells, same mistake, three times, because cell 1's correction
was thrown away before cell 2 began. Every rejection was paid for and then
discarded.

## v4 — the shaping loop

`scratch/fill-grid-v4.py`. Same templated cells as v3, same interpreter
interlock. What changes is that corrections persist:

- **Lesson ledger.** Every rejection reason is normalised to its *kind* and kept
  in a per-row list plus a global list, injected into every later prompt for
  that row: "mistakes already made here, do not repeat." A rejection is paid for
  once and then benefits every remaining cell.
- **Survivors become few-shot.** The first gated-good answer for a row is shown
  as an accepted exemplar to the remaining cells of that row. The model's own
  verified output teaches the rest of the run — no hand-written exemplars, and
  no risk of teaching from something the interpreter hasn't confirmed.
- **Real retry room.** 2 → 5 attempts. Correction loops need space.
- **Retries carry the full original prompt** (fixed in v3's last run; keep it).

Unchanged and non-negotiable: the interpreter grades, never the model. Plus the
structural gates the interpreter cannot provide — never redefines the verb,
always calls it, ladder rungs must have textually distinct bodies, a composition
row's BIGGER must actually call HELPER.

## The prose half (direction 1) — not yet built

Prose fields (`:problem`, `:claim`, `:invariant`, `:explanation`) are the ones
**nothing in the toolchain can falsify**, which is exactly where the stale
`clamp` `+nan.0` caveat survived every existing check. So the prose model never
authors a claim — it voices a *verified artifact*:

```
code model  ->  program
interpreter ->  gate + capture REAL output
prose model ->  given the surviving program AND its captured output,
                write the prose around it
```

It cannot assert `+nan.0` when the captured output says `5`, because the value
is handed to it rather than recalled. This is the same "must be fed source"
constraint the voice bake-off found.

**One gate to add between the stages:** reject prose containing any numeric
literal, `#t`, `#f`, or `+nan.0` that does not appear in the program or its
captured output. Mechanical, and it targets the fluent-wrong class directly.

Residual risk that gate does NOT cover: correct value, wrong *reason*. No
automated check for that — it needs a human read, or it stays out of the manual.

## Open, needs Alfred

- The stale `clamp` caveat: fix the record to match the engine, or make a 2-arg
  `clamp` raise. (`src/base.js:1203`; `(display (clamp 5 0))` prints `5`, the
  record says `+nan.0`.) The code comment at `:1199-1202` is stale too.
