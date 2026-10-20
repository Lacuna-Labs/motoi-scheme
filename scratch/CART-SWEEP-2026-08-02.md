# Cart verification sweep — 2026-08-02

Task #17. Run after the Motoi core-semantics work (real dotted pairs, arithmetic
strictness, accessor guards) landed in Motoi and was ported to Sakura.

## Motoi native carts

**41 / 41 run clean** via `./bin/motoi run`. No regressions.

## Automations carts (`~/code/scheme-carts`, 10,850 `.sks`)

These are Curator automation carts. They call marketplace and model verbs, so
*executing* them needs Curator's dispatch layer and live endpoints — not a
meaningful gate here. What IS meaningful is **parse + macro-expand**, because
the reader is exactly what changed when real dotted pairs landed. A reader
regression would be silent and total.

| stage | carts clean | failing |
|---|---|---|
| parse + expand | 9,959 | 891 |

Of the 891, **789 were already failing before any of my changes** (unbalanced
parens in the cart sources — a pre-existing authoring backlog, unrelated to this
work).

**102 carts newly fail.** Both classes are the new engine *detecting* latent
bugs in the cart sources, not the engine breaking. Neither should be reverted.

### Class 1 — 48 carts: two dots in one list

Found in e.g. `automations-carts/ship-ship-void-refund-status/`:

```scheme
'(:reason "refund-id and provider required" :refund-id . refund-id :provider . provider)
```

In Scheme, `.` may appear **once**, immediately before the **last** element.
Two dots in one list is not a pair, not a list, not Scheme.

What the old reader did with it — this is the whole point:

```
OLD => (quote (:reason "required" :refund-id |.| refund-id :provider |.| provider))
NEW => ERROR: more than one form after . in pair (line 1, col 33)
```

The old reader parsed `.` as **a symbol whose name is "."** and produced a flat
9-element list. So these carts were not building the alist their authors wrote —
they were building a flat list with literal `.` symbols wedged into it. Any
`assq`/`assoc` against it returns the wrong thing or nothing, with no error.

That is the silent-wrong-that-renders-correctly failure class this whole
campaign exists to kill, and it was live in a **refund-status** cart.

### Class 2 — 54 carts: `do` used as `begin`

Found in e.g. `automations-carts/cortex-warmup-by-context/`:

```scheme
(do (ctx-log ctx 'warn "listing card-open event missing required fields")
    (done))
```

R7RS §4.2.4 `do` is the iteration form — `(do ((var init step) ...) (test result ...) body ...)`.
Its first operand must be a **list of bindings**. Here the first operand is a
procedure call, so the first "binding" is the bare symbol `ctx-log`. The authors
meant `begin`.

The new expander rejects it by name: `do: each binding must be (var init [step])`.
The old Sakura expander had no `desugarDo` at all, so the form passed macro
expansion untouched and whatever happened, happened at runtime. I did **not**
establish what the old runtime did with it — only that nothing rejected it up
front.

## Method note — a trap worth recording

My first baseline run reported `EXPAND-FAIL 0` and I nearly believed it. It was
an artifact: `macro.js` guards with `instanceof Sym`, and the archived old
reader exports its **own** `Sym` class, so every guard silently no-op'd against
old-reader output. Cross-version A/B of a reader is only valid for the parse
stage unless you carry the whole module graph. The expand-stage baseline came
from Sakura's git history (`4464984` → `cade4d5`) instead.

## Recommendation — needs Alfred's go, not taken

The 102 carts live in `~/code/scheme-carts`, a different repo, and are
Curator/automations scope. **I have not edited them.** Both classes are
mechanical one-line fixes (`. ` → proper alist pairs; `do` → `begin`), but 102
edits to the automations corpus is a corpus change and needs an explicit go.

Flagging separately: when Curator picks up this engine, these 102 carts will
start failing loudly at load. That is the correct outcome — they were already
wrong — but it should not be a surprise on a deploy day.
