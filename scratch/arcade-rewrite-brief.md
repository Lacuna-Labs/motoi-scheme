# Arcade-games book rewrite brief (shared)

You are fixing ONE `.book.slatl` chapter/appendix in
`/Users/alfred/code/motoi-scheme/scheme-books/book-of-arcade-games/`.
A surgery removed Curator stub verbs. Every code block that calls them
now fails `unbound symbol`. KEEP the good prose; rewrite every broken
```scheme block and every `(code-block ... :source "...")` anchor onto
REAL Motoi primitives, headless, returning a concrete value ending in a
`;; =>` comment that matches ACTUAL output.

## RIPPED verbs (never use — they are gone)
world/* entity/* motion/* scene/* part/* game/* group/* prefab/*
camera/* audio/* note/* synth/play sound/* collision/define-layers!
big-bang on-frame paint-* input/* define-card

## REAL primitives you MAY use (verified wired)
- vec/make vec/add vec/sub vec/scale vec/norm  (vecs print as (x y);
  components via car/cadr — NO vec/x)
- phys/kinematics x0 v0 a t  => (position velocity) list, ONE axis; call
  per-axis for 2D. It IS the closed-form equation of motion.
- geom/cos geom/sin geom/sqrt ; deg->rad = (* d (/ 3.14159 180))
- SRFI-1: map fold filter iota length append reverse assq memq
  (fold is ELEM-FIRST: (fold (lambda (x acc) ...) init lst))
- R7RS: let let* letrec named-let cond when max min modulo abs
  number->string string-append list car cdr cadr caddr
- random-int (non-deterministic — AVOID in book output; use a
  deterministic hash like (+ 20 (modulo (* seed 61) 280)) instead)

## The established pattern (from ch01-ch05, REUSE it)
- A body/entity is a list. ch01: (define (body pos vel) (list pos vel)).
  ch05: (define (ent kind pos vel) (list kind pos vel)).
- The world is a LIST of bodies. `step` is a PURE function body->body.
- Gravity: add a gravity vec to velocity, add velocity to position.
- Bounce: flip the velocity axis * restitution when past a bound.
- AABB / collision: coordinate comparisons or vec/norm distance test.
- Layer table = PLAIN-LIST alist (NOT dotted pairs — the reader mangles
  (a . (b)) into an improper list; use (a b c) rows + (cdr row)).
- Iterate frames with a named let carrying (frame world ...); stop at N.
- Convert a paint/render loop into a simulation returning a value:
  final position, a count, an hp, a schedule list — whatever the prose
  is teaching.

## HARD RULES
- NO fabrication. Never invent a verb. If a block genuinely cannot be
  honestly rewritten on real primitives, KEEP the prose, insert
  `<!-- needs-alfred: <verb> — <why> -->` where the block was, and note
  it. Never claim a verb runs without running it.
- Run EVERY block: `echo '<expr>' | ./bin/motoi run /dev/stdin` (or the
  checker). The `;; =>` MUST equal the actual tail output verbatim.
- Fuel is default 200000. Keep frame*body products modest (~100 frames,
  small worlds). If a run says "fuel", shrink the demo.
- Edit IN PLACE. Do NOT touch scratch/attic/. This repo is NOT git —
  never run git.
- Leave persona headers alone: `:dialect ("motoi" "sakura")`,
  `:voice "sakura-teaching..."`, `:audience`, etc.
- Adjust prose ONLY where a sentence literally describes old/ripped
  code. No new comments beyond `;; =>` and the needs-alfred marker.
- Inside the prose STRING, `"` is escaped as `\"`. The anchor
  `(code-block ... :source "...")` string also escapes `"` as `\"`.

## Verify
Run: `python3 /Users/alfred/code/motoi-scheme/scratch/arcade-check.py <file>`
from the repo root. Every block must print `ok` with matching
expected/got tails. Report: blocks found / rewritten / passing /
still-failing, any needs-alfred (verb + section), and a one-line note on
any prose you changed.
