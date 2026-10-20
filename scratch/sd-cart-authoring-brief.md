# SD Cart Authoring Brief — READ THIS FIRST

You are authoring a **flagship Motoi Scheme game cart** that renders to the real
**SD framebuffer (320×240)**. This brief is the ground truth. Follow it exactly;
the sharp edges below are what make a cart run vs. fail.

## The one hard gate

Your cart MUST pass, with **default fuel** (200000), no flags:

```
./bin/motoi run carts/<name>.sks    # EXIT 0, no "unbound symbol", no "fuel exhausted"
```

Run it yourself, repeatedly, until it passes. A cart that doesn't run is worthless.
Never report success without an actual EXIT=0 run.

## Read these two working carts BEFORE writing anything

- `carts/asteroids.sks` — the **proven SD-cart template**. Copy its shape:
  header alist comment → HOW TO RUN → WHAT THIS IS prose → KNOBS → deterministic
  PRNG → state → helpers → step → render (SD draw verbs) → driver (`let loop`).
- `carts/spacewar.sks` — physics + readable-AI-opponent idioms.

## Motoi Scheme surface (what you may use)

Standard = **R7RS-small + SRFI-1 (lists) + SRFI-13 (strings)**. No R6RS, no Racket.

- Control/binding: `define let let* letrec cond case when unless if and or not begin`
- Mutation: `set!` (mutate a global you `define`d), `list-set` (returns a NEW list).
- **Recursion for loops** via named let: `(let loop ((i 0)) ... (loop (+ i 1)))`.
  There is NO `for`/`while`. Iterate with `let loop`, `for-each`, `map`, `range`.
- Lists: `list cons car cdr nth list-set length append reverse map filter
  for-each range null? list-ref member assoc`.
- **Vectors (USE THESE for boards):** `make-vector vector-ref vector-set!
  vector-length vector list->vector vector->list`. O(1) access — essential for
  chess/checkers/sudoku so board reads don't blow fuel. `nth` on a list is O(n).
- Numbers: `+ - * / quotient remainder modulo abs min max floor ceiling round
  round2 sqrt expt sin cos atan pi < > <= >= = zero? even? odd? number->string`.
  `(atan y x)` two-arg form works (angle of a vector).
- Strings: `string-append number->string string-length substring` (SRFI-13 too).
- Booleans printed `#t`/`#f`. Symbols are quoted: `'red`, `'ai`.

## SD draw verbs (VERIFIED signatures — these exact names)

Call `(set-mode 'sd)` ONCE at the top to allocate the 320×240 framebuffer.

| Verb | Signature | Notes |
|---|---|---|
| `(set-mode 'sd)` | → (320 240) | allocate SD framebuffer |
| `(clear c)` | c = palette index 0..15 | wipe screen to color c |
| `(set-color c)` | index 0..15 or `'name` | sets current draw color |
| `(disc cx cy r)` | filled circle | uses current color |
| `(circle cx cy r)` | outline circle | uses current color |
| `(line x0 y0 x1 y1)` | line segment | uses current color |
| `(rect x y w h)` | rectangle outline | uses current color |
| `(rect-fill x y w h)` | filled rect | uses current color |
| `(pset x y c)` | one pixel | c = index |
| `(triangle-fill x1 y1 x2 y2 x3 y3 c)` | filled triangle | **c is LAST arg**, index |
| `(star-fill cx cy outer inner points c)` | filled star | c index |
| `(ngon-fill cx cy r sides c)` | filled regular polygon | c index |
| `(ring cx cy r c)` / `(arc ...)` | | |
| `(fb/text "STR" x y 'color)` | draws text | color is a `'symbol` |
| `(fb/dump)` or `(fb/dump x y w h)` | prints framebuffer to stdout as ANSI half-blocks | ONE SCREENSHOT ONLY |

**Palette (PICO-8, indices 0..15):** 0 black · 1 dark-blue · 2 dark-purple ·
3 dark-green · 4 brown · 5 dark-grey · 6 light-grey · 7 white · 8 red · 9 orange
· 10 yellow · 11 green · 12 blue · 13 lavender · 14 pink · 15 peach.
Names also accepted where a color-name is taken: `'black 'white 'red 'green
'blue 'yellow 'orange 'pink 'lavender 'peach 'brown`.

## FUEL — the thing that will bite you

The Scheme sim costs roughly **1500–2500 fuel per simulated tick** in a busy
game. Default budget is 200000. So:

- Keep `MAX-TICKS` around **80–100**. Do NOT run 240-tick sims — they exhaust fuel.
- Use **vectors** for boards and heavy state (list `nth`/`list-set` multiply cost).
- `(fb/dump ...)` a full 320×240 screen is ~800 KB of text. Dump **ONCE or TWICE
  total** (a key/climax frame), never every tick. In between, print a compact
  ASCII scoreboard/status line every ~15 ticks so the run is readable.
- Board games (chess/checkers/sudoku) that "think" (search/solve) must bound the
  search HARD (e.g. 1-ply or shallow N-ply with a small move list, or a scripted
  opening) so a move costs well under a few thousand fuel. Prefer a readable
  heuristic over deep search. Determinism first.

## Determinism + no keyboard (REQUIRED)

- No `random` seeded by the clock. If you need randomness, roll a tiny LCG seeded
  by a `SEED` knob (see asteroids.sks `rnd`). Same run every time.
- **No keyboard input exists** in a headless cart. Two-player / "play against
  Motoi" is expressed as: a scripted move-stream for the human side and a small
  READABLE AI for the opponent — both drive the sim automatically. Say in the
  prose how a real surface would swap the script for live input.
- Make the opponent **human-flavored and readable at difficulty LEVELS** (a knob
  like `(define LEVEL 'normal)` → depth/greed), not a perfect optimizer.

## Play-against-Motoi AI: TWO PLANNING MODES (required for adversarial games)

If your cart is a game you **play against Motoi** (board/strategy), the AI opponent MUST
support two planning modes as a knob — `(define AI-PLAN 'straight)` (default) / `'adaptive`:

- **`'straight`** — a FIXED strategy: a scripted opening + a stable heuristic + one committed
  playstyle. Predictable and readable; a human can learn the pattern and beat it. This is the
  clean default and must fit default fuel.
- **`'adaptive`** — MODIFIES ITS PLAN based on how the human plays. Track the human's
  tendencies across the match in a little state record (e.g. aggression count, favored
  files/columns, trade-happiness) and SWITCH strategy to counter — the dumb→scripted→
  self-tuning "learn to play" ladder. Human-like ≠ optimal: make *readable* adjustments a
  person could narrate, not a perfect solver. Adaptive may need `--fuel` for deep levels;
  keep the DEFAULT (`'straight` + `LEVEL 'easy/'normal`) inside 200000.

Both plans deterministic + headless: the human side is a scripted move-stream (say in prose
how a real surface swaps in live input). Also support **HARD** as the top of the LEVEL ladder.

## SD IS MANDATORY (every cart, no exceptions)

Every cart in this batch MUST `(set-mode 'sd)` and render on the **320×240 framebuffer** with
the SD draw verbs — NOT an ASCII grid. Compact ASCII scoreboards between frames are fine for
readability, but the board/pieces/action are drawn with `disc/rect-fill/line/fb/text/…` and
shown via ONE `(fb/dump 0 0 320 240)` climax frame. A cart that only prints ASCII does not
satisfy this brief.

## Cart header (top of file, as a comment block)

Copy asteroids.sks's `(cart ...)` alist verbatim in shape: `:name :category
:sub-category :audience :complexity :runtime-tier :render :sd-framebuffer
:one-line :verbs-used (...) :inspiration "..."`. Then `HOW TO RUN:` and a
`WHAT THIS IS` teaching paragraph. Kid-facing, warm, honest. **Do NOT mention
Curator, Sakura, or Lacuna anywhere** — Motoi is nobody's product.

## When done

1. Confirm `./bin/motoi run carts/<name>.sks` → EXIT 0 (paste the non-ANSI text
   output lines + the EXIT code in your final report).
2. Do NOT edit CATALOGUE.slat — the orchestrator registers carts. Just report the
   cart's :name, :sub-category, :complexity, :one-line, and :inspiration line so
   the orchestrator can add the catalogue card.
3. Report the file path and a 2-line summary of what it does and how it plays.
