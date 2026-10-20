# Broken-example — `animation/reflow-policy` (dialect-leak)

> **Presentation-only Markdown.** Canonical source stays
> `scheme/reference/broken-examples/animation-dom-reflow-not-motoi-subject.slatl`.

A broken-example is kept ON PURPOSE (teaching signal). This one is a **dialect-leak**, not a
runtime failure: the three verbs below RUN, but they model a browser concept — DOM reflow policy
and a per-frame layout time-budget — that has no meaning on Motoi's fantasy-console framebuffer.

| DOM verb | what it pretended to be |
|---|---|
| `animation/budget` | a per-frame millisecond layout budget (DOM) |
| `animation/reflow-policy` | `'auto` / `'eager` / `'deferred` layout timing (DOM) |
| `animation/set-reflow-policy` | write that policy (DOM) |

These verbs are inherited from Curator's browser host, where a real DOM reflow costs real
milliseconds and must be batched. Motoi paints into a framebuffer; there is no reflow, no layout
pass, no millisecond budget to police.

- `:status` — **dialect-leak**
- `:std-target` — Motoi `animation/*` (tween lifecycle) + `easing/*` + `curve/*`
- `:std-rejected` — `animation/budget`, `animation/reflow-policy`, `animation/set-reflow-policy` (Curator browser DOM-reflow surface)
- `:training-eligible` — `#t`

## The broken code (runs, but models the wrong world)
```scheme
(begin (animation/set-reflow-policy 'deferred) (animation/budget) (animation/reflow-policy))
```
**Output:** `auto` — and note the tell: `set-reflow-policy 'deferred` is IGNORED; the read-back is a
hard-coded `'auto`, and `budget` is a hard-coded `16`ms. These are **inert inherited stubs**, not a
real policy engine. Runs: yes — but the write is a no-op, and "reflow policy" is a browser layout
concept, not a fantasy-console animation concept.

## Why it is broken
A DOM reflow is the browser recomputing element geometry after a style/content change; it is
expensive, so browsers batch it (`'deferred`) or force it (`'eager`), and animation code polices a
per-frame millisecond budget so reflows don't drop frames. NONE of that exists in Motoi. Motoi
animation writes pixels into a framebuffer and advances a tween clock — there is no layout tree to
reflow, no millisecond budget to spend, no policy to set. Documenting animation through "reflow
policy" teaches the reader that animation is about layout bookkeeping. It is not. Animation is a
value moving through time: a start, an end, a duration, and an easing curve that says HOW it moves.

## The fix
```scheme
(begin (animation/clear!) (motion/move-to (list 'star 0 0) (list 60 0)) (length (animation/tweens)))
```
**Output:** `1` — one live tween is now in flight toward `(60 0)`.

The real animation surface is three verbs: `animation/tweens` (read the live in-flight motions),
`animation/tick` (advance one frame and redraw them), and `animation/clear!` (drop them all). A
tween is created by a motion verb (`motion/move-to`). HOW the value moves is an easing curve —
`easing/linear`, `easing/standard`, `easing/accelerated`, `easing/decelerated`, `easing/spring`
(ch. 22), a monotone map [0,1]→[0,1]. WHERE it is at fraction t is `curve/eval` (ch. 20). Its
instantaneous velocity is `calc/derivative` of the position curve (ch. 11).

## The lesson
When a verb's whole meaning comes from the HOST (a browser layout engine) and not from Motoi's own
machine (a framebuffer + a tween clock), it is a dialect leak, not a Motoi verb. **Port the SUBJECT,
not the verb:**
- `animation/budget` answered "how many ms of layout may I spend this frame?" — a browser question.
  The Motoi question is "how many tweens are live?" → `(length (animation/tweens))`.
- `animation/reflow-policy` / `set-reflow-policy` chose WHEN the browser recomputes geometry. Motoi
  has no geometry pass; the analogous real controls are the easing curve (HOW a value moves) and
  `animation/tick` (WHEN the frame advances). Timing lives in the curve and the clock, not a policy.

## The same idea in three other libraries
- **Motoi `animation/*` + `easing/*`** (the wired target) — `(begin (animation/clear!) (motion/move-to (list 'dot 0 0) (list 100 0)) (animation/tick) (length (animation/tweens)))` → no policy, no budget: create a tween, tick the frame, read the live set.
- **Pico-8** — `function _update() x = x + (tx - x) * 0.2 end` → a fantasy console animates by moving a number toward a target every frame; no reflow policy because there is no DOM.
- **CSS transitions** (the browser world these verbs came from) — `transition: transform 300ms cubic-bezier(.2,0,0,1);` → where reflow IS a real cost. Motoi keeps the easing curve (`easing/standard` ≈ this bezier) and drops the reflow policy.

## Motoi standard
Chapter 04 documents `animation/tweens` / `animation/tick` / `animation/clear!` (the real tween
lifecycle, wired in `lib/graphics/animation.js`), taught through `easing/*` (ch. 22), `curve/eval`
(ch. 20), and `calc/derivative` (ch. 11). The three DOM-reflow verbs dropped from the reference
2026-07-26; they remain **wired** pending code surgery under #371.
