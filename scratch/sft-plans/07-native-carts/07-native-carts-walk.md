# Motoi SFT — Lane #07: Native Cartridges (walk doc)

**Task #418 / #428 · design-only · Motoi-only · 2026-07-29**
Source directives: Alfred, 2026-07-29 (this session).

> "For cartridges — each cartridge, I want SFT pairs in how they are made, starting
> from scratch, showing how to write a cartridge and what each thing is doing,
> describing what the code is doing, in the kind of detail necessary to teach an LLM
> how to write this sort of thing. And I want it done twenty-five times. The things I
> want exploded are the explanations of *why* this is being done, and the reversal
> would be 'do this → that outcome' and 'this piece of code — what it is.' It needs to
> be able to *write* the code but also *identify* the code. By going through the
> reference manual and decomposing it into parts, describing what each does. For
> twenty-five carts."
>
> "I also want the errors that each module and construct would throw linked back to
> each module and construct **using the cart**, in pairs, because people are gonna want
> help making games."

---

## 0. One-breath

Teach Motoi to **build a cartridge from scratch and to read one back** — twenty-five
whole games/toys, each taken apart construct-by-construct against the reference manual,
with the **why exploded**, the **write↔identify reversal** run both directions, and every
**error each construct can throw linked back to that construct inside the running cart**.

Then teach the part that makes it *actually able to make you a game*: **refine-and-extend**
(nothing is ever done — "how do I make this better?"), **sage advice** (what people of
different ages find fun; when the enemies move too slow; when the tracking won't feel
right), **the truth about the machine** (enough computing that a person can feel when
they're overwhelming the system — and what to do when it hangs), **breaking a big "make me
a racing game" into a build *dialogue*** (tic-tac-toe is one card; a racing game is
part-by-part: "a road first — top-down? here's a rectangle with a line down the middle,
let's work with that"), and **what a game even is** — the philosophical lens, sixteen
philosophers on play, why humans play, why computer science makes games, why games are the
ultimate test of a machine.

Woven **through and through** the engineering manual and the reference book: gaming history
(including **Spacewar!**, which we should have and don't), the fundamentals of game design,
how a game actually works, **what the framebuffer is doing**, and a table of the **colors of
things** so it picks a black wheel and a black road with a dotted line, and honestly says
"I've never seen a road — give me some shapes it might look like" for things it hasn't.

This is the lane where all the reference/verb knowledge (lane #1), the debugger knowledge
(lane #2), the word→world→drawing knowledge (lane #5), and the self-knowledge (lane #6)
**cash out into a person saying "help me make a game" and Motoi actually doing it — or
walking them through making it themselves.** The interpreter is the grader: every rung runs.

---

## 1. What a cart IS (grounded, so the teaching is exact)

A Motoi cart is a `.sks`/`.scm` file with two grounded shapes on disk:

1. **Program carts** (`carts/*.sks`) — a header comment carrying a metadata alist
   (`:name :category :sub-category :audience :complexity :runtime-tier :one-line
   :verbs-used :inspiration`), a HOW-TO-RUN line, a prose description, then the runnable
   program organized in labelled sections — `state → helpers → tick → policy → render →
   driver` (see `carts/snake-classic.sks`).
2. **Bundle carts** (`Spec/CART-TEMPLATE.slat`) — the fantasy-console bundle: an alist
   with a fixed key order `(:meta :palette :sprites :tiles :sounds :music :code)`, whose
   **round-trip is an identity contract** (`(equal? cart (composer/cart-apply cart
   (composer/cart-emit cart)))`). Empty sections default to `()`; ordering is load-bearing.

Both are **deterministic and LLM-free** (Alfred: "I want it deterministic and locked in.
Computer science and engineering."). The teaching authority for "what a cart is" is
`Spec/CART-TEMPLATE.slat` + `scheme-books/book-of-motoi/appendix-f-the-cart-format`; the
teaching authority for "what each construct does" is the **reference manual** (lane #1's
verb-identity grid); the teaching authority for "what can go wrong" is
`scheme/reference/error-cards/`.

### 1.5 Why this lane matters — the on-ramp and the feedback loop (Alfred, 2026-07-29)

The game engine is a **vehicle to teach the model to write Scheme, GENERALLY** — math,
science, state machines, Mealy/Moore machines. Games are the **on-ramp**: most people meet
Scheme + functional programming for the first time *through a gaming system*. And **making
games is genuinely hard — any help we can get is good** — which is exactly why the
error-link, construct/deconstruct, and dialogue families carry so much weight here; the
debugging skill they drill **generalizes far past games** (LLMs transfer it anyway).

**The self-reinforcing loop:** the more CS a learner picks up, the better their creations
get, which makes them ask *"what else can I do?"* — that feedback IS how people learn to
program ("I made a stupid sideways-bat basketball game, that was fun — what else can I
do?"). The SFT should encode a Motoi that fuels that loop.

**Fork-and-grow, kid-first, honest-no:** the graduation path is to **fork Motoi and write
your own Scheme** — your own first modules (disk I/O, etc.), with Motoi helping. Motoi
**warns what's dangerous** (e.g. Unix permissions) and where it doesn't know it **recuses
itself — an honest no** ("weed me out of this one, I don't know"; a fork or another model
may handle that part). **Motoi stays the kid-friendly one.** Forks leave, do their own
thing, and always come back — same generous posture as Sakura: Motoi is not mad. Encode
this identity across the ship-it (C6–C9) and what-is-a-game (C10) families.

---

## 2. The corpus — 32 carts (one held out on purpose)

`carts/` holds **33** native program carts. **Author 32; hold 1 out** as a never-trained
**validation cart** — the clean test of whether the lane taught *writing a cart* rather
than *memorizing these carts* (proposed held-out: `pendulum-simple.sks`, a small
self-contained physics toy; Alfred can pick another).

The 33 (categories in parentheses), spanning games, science-sims, and tools so the lane
covers the whole surface a kid-to-adult would ask for:

- **Arcade/game:** snake-classic, block-drop, flap-runner, match-three-jewels,
  sokoban-boxes, peg-solitaire, memory-flip.
- **SD-framebuffer flagships (2026-07-30, `:render :sd-framebuffer`, 320×240):**
  `spacewar` (2-ship gravity duel, the historical anchor), `asteroids` (vector shooter),
  `space-invaders` (marching grid + shields + UFO), `starfighter` (R-Type-style horizontal
  shmup: 3 parallax layers + multi-phase boss state machine), `chess` (play vs Motoi at
  levels), `checkers` (play vs Motoi at levels), `sudoku` (MRV backtracker). These get the
  **same C1–C10 + weave treatment** as every other cart (Alfred, 2026-07-30). They are the
  richest homes for the ship-it families: `starfighter`'s boss is the worked example for
  C6/C8 (state machines, redraw budget), the parallax layers for K4 (framebuffer), and
  `chess`/`checkers` are the worked homes for the **play-against-Motoi AI doctrine** below.
- **Science sim:** projectile-arc, inclined-plane, friction-race, tidal-forces,
  pendulum-simple *(held-out)*, gas-law-sandbox, reaction-race, ph-scale-visualizer,
  dna-transcription, food-web-builder, biome-explorer.
- **Math/tool:** times-table-trainer, fraction-visualizer, unit-converter,
  word-frequency-counter, haiku-syllable-checker, password-generator, pomodoro-timer,
  cipher-lab.

### 2.5 The play-against-Motoi AI doctrine (Alfred, 2026-07-30)

Some carts are **games you play *against* Motoi** — chess, checkers, and the incoming
"famous games canon" (§2.6). For every one of these, the AI opponent is taught to play in a
**human, readable** way at difficulty **levels** (the spacewar player-two doctrine, §3.5,
generalized), and — Alfred's 2026-07-30 directive — in **two planning modes**:

- **Straight plan** — the opponent runs a *fixed* strategy: a scripted opening, a stable
  heuristic, a set playstyle it commits to. Predictable, readable, teachable. The learner
  can *learn the pattern and beat it.* This is the default and the clean teaching case.
- **Adaptive plan — modifies based on your play** — the opponent *reads how the human is
  playing* and changes its plan: it tracks the human's tendencies over the match (are they
  aggressive? do they always trade? do they favor one side of the board?), and switches
  strategy to counter — dumb-bot → scripted-tactician → self-tuning-over-the-match, exactly
  the "learn to play" ladder from spacewar's AI. Human-like ≠ optimal (C7): it makes
  *readable* adjustments a person could narrate, not a perfect solver's move.

Both modes are a **knob** (e.g. `(define AI-PLAN 'straight)` / `'adaptive`) alongside the
existing `LEVEL` knob, deterministic and headless (the human side is a scripted move-stream;
a real surface swaps in live input). This straight-vs-adaptive split is a **first-class
teaching axis** across the ship-it families: C6 (extend a straight AI into an adaptive one),
C7 (why an adaptive opponent *feels* alive — it responds to you), C8 (adaptivity costs
work-per-move — bound it), C9 (when a learner asks "make the computer smarter," walk them
from straight → adaptive), and C10 ("can a machine *play*?" — the adaptive opponent that
reads you is the concrete Dennett/Searle case). Author both plans per play-against cart.

### 2.6 The famous-games canon — "top 10 best games ever you can play against" (Alfred, 2026-07-30)

Alfred wants a curated set of **famous, best-ever games you can play *against* Motoi**, at
**hard** difficulty (plus the level ladder), each with the straight-vs-adaptive AI (§2.5).
`chess` and `checkers` are the first two. The remaining roster is **pending Alfred's
confirmation** (see §8 Q8) before authoring; candidates are the canonical adversarial-AI
games that fit SD/fuel: reversi/othello, connect-four, gomoku/five-in-a-row, backgammon,
nine-men's-morris, mancala/kalah, go (9×9), nim, tic-tac-toe. Each becomes a flagship
play-against cart under the §2.5 doctrine, then gets the full C1–C10 + weave treatment.

**From-scratch build source:** `carts/cart-maker-{1-scenes,2-games,3-music,4-interactive,
5-hybrid,6-zelda}/` and `cart-pico8-demo/` already hold **step-by-step build walkthroughs**
(`*.scm` + captured `*.out.txt` — breakout, pong, catch-the-ball, memory-match, snake).
These are the ground truth for the C1 build-ladder: *grab the real build order, don't
invent one.* Where a cart has no maker-walkthrough, reconstruct its build order from its
own section structure (state → helpers → … → driver) and verify each rung runs.

---

## 3. The pair families (C1–C10), in three tiers

Each family is **abductive** (`project_sft_must_be_abductive`), **proper-lensed**
(`feedback_variety_needs_proper_lens`), and **interpreter-graded** (every code rung must
run). Registers ride the cart's own `:audience` (most are `:kid`) but climb to
practitioner/peer on the same cart — the same person, growing (`project_engineering_self_knowledge_lane_design`
audience ladder).

Three tiers:

- **Tier A — MAKE & READ THE CODE (C1–C5):** build a cart rung by rung, decompose it against
  the reference manual, explode the *why*, run the write↔identify reversal, and link every
  error back to its construct inside the cart. *This is the dissection — taking the cart
  apart, almost by mutilating it, and pointing every piece back at the reference manual and
  at what the other snippets do and can do.*
- **Tier B — MAKE IT GOOD & MAKE IT REAL (C6–C9):** refine-and-extend (nothing is done),
  sage advice (what people find fun), the truth about the machine (budget / overwhelm /
  hang), and breaking a big want into a build **dialogue**. This is where Motoi becomes a
  collaborator who can actually help you ship a game.
- **Tier C — WHAT A GAME IS (C10):** the philosophical lens — sixteen philosophers on play,
  why we make games, why games test machines, and the words↔games bridge back to lane #5.

The knowledge these families draw on (gaming history incl. **Spacewar!**, game-design
fundamentals, how a game works, **what the framebuffer is doing**, the **color-of-things**
table, and where complexity — state machines, message-passing, in-game AI — belongs) is the
**weave layer** in §3.5, cross-linked *through and through* the engineering manual and book.

### C1 — BUILD-FROM-SCRATCH LADDER (write a cart, rung by rung)
Start from the empty cart and add one working piece at a time; **each rung is a complete,
runnable program**, and the pair explains what was just added and shows the output change.
> obs "I want to start a snake game — what's the smallest thing that runs?" →
> reason begin with state (the board + the snake as a list of cells, head first) →
> **land** a 6-line program that defines `WIDTH/HEIGHT/SNAKE` and draws one frame → run it.
Then: add `next-cell` → add collision → add growth → add the policy → add the driver loop.
The ladder mirrors lane #1's R4 build-up (`project_reference_lane_sft_design`), but the
unit is a **whole cart**, not a library. Grab the real rungs from the cart-maker
walkthroughs where they exist.

### C2 — DECOMPOSE-AND-DESCRIBE (identify the code, via the reference manual)
Walk the finished cart **section by section, construct by construct**, and for each name
*what it is* and *what it does* — decomposed against its **reference-manual entry** (§4).
> obs (given the snake's `step-tick`) "what is this piece of code?" →
> reason it's the tick: it computes the next head, then branches on three conditions
> (wall, self, food) → **land** "this is the game's update step; `cons new-head (drop-last
> SNAKE)` is the move — grow the head, drop the tail — using `cons` (reference: prepend one
> element) and the cart's own `drop-last` helper." Every verb in `:verbs-used` gets
> decomposed; every helper gets named by its role (input/transform/accumulator/base-case/
> output — lane #1's R3 comprehension vocabulary).

### C3 — THE WHY, EXPLODED (the one explode family here)
For each design decision, **explode the explanation of why it's done that way** — this is
the family Alfred called out to explode. Not "what," but "why this and not the obvious
alternative."
> obs "why is the snake a *list with the head first*, and why `drop-last` instead of just
> mutating?" → reason head-first makes `(car SNAKE)` the head in O(1) and growth a single
> `cons`; keeping the tail vs. dropping it is *literally* the difference between growing and
> moving, so the two cases share one shape → **land** the reason, then branch: why a scripted
> policy (no keyboard input yet), why `randint` for food, why `modulo` to throttle drawing,
> why the round-trip identity matters for bundle carts. Multiple why-angles per construct =
> the volume in this lane. Where a "why" bottoms out in taste, say so honestly
> (`project_honest_null_is_training_signal`).

### C4 — REVERSAL, BIDIRECTIONAL (write ⇄ identify) — InverseCoder
Run every worked construct **both directions**, cheaply (`project_reference_lane_sft_design`
R5, InverseCoder):
- **(a) intent → code (write it):** "make the snake grow when it reaches the food" →
  the exact `(cell-eq? new-head FOOD)` branch that conses the head and respawns food.
- **(b) code → identify + outcome (read it):** given that branch, "what is this / what's
  the outcome?" → "the eat-and-grow case: length +1, score +1, new food spawned off-snake."
Also: description↔code, spec↔code, broken↔fixed. "Do this → that outcome" and "this piece
of code — what it is" are the two poles Alfred named.

### C5 — ERROR-LINK (errors ↔ construct, **inside the cart**) — NEW, for game-help
For each module/construct a cart uses, **link the errors it can throw back to that
construct, set in the running cart**, because people making games will hit exactly these.
Pull the error from `scheme/reference/error-cards/` and stage it in the cart's own code.
> obs "I changed the snake head-read to `(nth cell 5)` and it broke — why?" →
> reason `nth` past the end of a 2-element cell; in this cart cells are `(row col)` →
> **land** the error class (index/`not-a-procedure`/`unbound-symbol` as applicable per the
> matching error-card), *why it fired here*, and the fix in THIS cart's `next-cell`.
Cover the cart's real failure surface: `unbound-symbol` (typo/`fold-left`/wrong-dialect
verb like `card/*` in base Motoi), `not-a-procedure`, `TypeError`, `fuel-exhausted` (an
un-terminated driver loop — very common in game loops!), reader/expand errors, and the
*silent non-errors* (a policy that never turns → snake walks off; teaches "no error ≠
correct"). Abductive symptom→cause→fix, grounded in the cart. Ties `project_broken_code_debugger_lane_design`
+ `project_broken_code_as_runtime_signal` (wrong-sink) + the error-cards library.

**Plus the common video-game errors** (the ones people hit *because it's a game*, not just
because it's Scheme) — link each back to the construct in the cart that causes it:
- **The hang / the freeze** — an unbounded or too-heavy loop; `fuel-exhausted` is the
  runtime catching it. (Deep-dive lives in C8: the machine's budget.)
- **Off-by-one / off-screen** — head, sprite, or paddle drawn one cell past the board;
  ties to the cart's bounds check and the framebuffer's real width/height (§3.5 K4).
- **Nothing moves / everything moves at once** — a tick that forgot to `set!` state, or one
  that mutates inside the render pass; the state/tick/render split (§1) is *why* the sections
  are separated.
- **The enemy never turns / tracking feels wrong** — a policy/AI bug that isn't an
  exception; it *plays* wrong. Symptom→cause→fix lands in the policy, and the "does it feel
  right" judgment is C7 (sage advice).
- **Flicker / tearing / wrong color** — drawing order and palette; ties to K4 (framebuffer)
  and K5 (color).
Each is a real error-card or a documented silent-failure, situated in the running cart.

### C6 — REFINE-AND-EXTEND (nothing is ever truly done)
Teach that a cart is never finished — there is always a next thing. Pairs take a *working*
cart and make it **better** or **bigger**, so Motoi learns the shape of iteration, not just
the shape of a first draft.
> obs "The snake game works. How do I make it better?" →
> reason survey the axes of improvement — feel (speed ramps as you score), challenge (walls,
> a second food), clarity (show the score, flash on death), depth (levels) → **land** one
> concrete extension, coded and run, *and* say what it trades (faster = harder = more fun for
> some, frustrating for others → hands to C7).
**Extend** pairs add a whole new mechanic to an existing cart (add a wall array; add a
power-up; add a two-player turn); **refine** pairs improve an existing one (tighten the
render, name a magic number, pull a helper out). Every extension **runs**. The lesson under
all of them: *done is a checkpoint, not an end* — the same "never truly done" that lane #6's
self-engineering teaches (`project_engineering_self_knowledge_lane_design`).

### C7 — SAGE ADVICE (what people find fun, and when)
Teach **game feel and taste**, grounded in what real people of different ages actually enjoy,
so Motoi can advise — not just implement. This is surveyed knowledge (§3.5 K2/K7), turned
into abductive advice pairs.
> obs "My enemies are too easy / the game's boring." →
> reason name the likely cause from the feel-vocabulary — enemies move too slow, no threat
> ramp, telegraphed with no variation, reward too flat → **land** a specific, coded change
> ("bump enemy speed with score; add one that tracks you; keep one dumb so there's contrast")
> and *why people like that* (tension + relief, mastery curve, surprise).
Covers age-register (a 6-year-old wants immediate delight and no losing-forever; a teen wants
challenge and status; an adult wants depth or calm), and the honest judgment calls: "the
tracking might feel unfair — try leading the player instead," "that's too slow to feel
alive," "maybe do it this way." Where taste genuinely forks, say so (`project_honest_null_is_training_signal`).
**Never fabricated:** the "what people like" tables are surveyed and cited (§3.5 K7); an
unsupported claim is `:status "needs-alfred"`.

### C8 — THE TRUTH ABOUT THE MACHINE (budget, overwhelm, and the hang)
Teach enough **computing** that a person can *feel* when they're asking the machine for too
much — and knows what to do when it hangs. This is the deep version of the C5 hang: not just
"add a guard," but *why* the machine chokes.
> obs "I spawned 10,000 enemies and it froze." →
> reason each tick now touches 10,000 things; the loop's work per frame outran the fuel
> budget; the framebuffer redraw is O(cells) and you multiplied the cells → **land** what
> overwhelmed it (work-per-tick, memory, redraw cost), *that you're allowed to try it* (it
> won't break the machine — the fuel budget is the seat-belt), and how to pull back (cap the
> count, do less per tick, only redraw what changed) → run the tamed version.
Threads to the framebuffer (K4), the tick loop, and `fuel-exhausted`. The stance: **the
machine has limits and that's honest, not a failure — you can push on them, and here's how to
recover.** Ties `project_engineering_self_knowledge_lane_design` (tool-not-oracle, "I live on
silicon"), and the "if it hangs, what to do" runbook.

### C9 — BREAK-THE-WANT-INTO-A-DIALOGUE (co-construction)
The keystone Tier-B family. Teach Motoi to **turn a big, vague "make me a game" into a build
conversation** — gathering just enough decisions to emit code that fits the complexity, and
walking the person through the parts it *can't* read out of their head.
> **Small want → one card:** "Make me a tic-tac-toe game." → *(this fits in one head)* Motoi
> emits the whole cart, then offers one next step. Simple stays simple.
> **Big want → part by part:** "Make me a racing game." → "That's a big one — let me not just
> guess. I can't hold a whole racing game in my head at once, and I can't build what's only in
> yours. Want to walk through it? A racing game needs a road first. Top-down, or looking down
> the road? … Okay, top-down. I've never *seen* a road, but here's a shape that reads as one:
> a rectangle with a dashed line down the middle. Let's start there — you tell me what to
> change." → then: the car, the controls, the other cars, the finish.
The move set to teach: **triage** the want (small→emit, big→decompose); **ask the load-bearing
question, not twenty**; **offer a concrete starting shape** for anything unseen ("I've never
seen X — here are shapes it might look like"); **collaborate on the drawing** (color it from
the K5 table — a wheel is black, a road is black with a dashed line; add perspective by pulling
the far edge into a triangle toward the top so the road doesn't just vanish); and the humility
throughout — *"I can help you write the parts; I can never make exactly what's in your head, so
let's get there together."* This is where lane #5's **words↔drawing** skill
(`project_word_books_drawing_primitives`) and the **stacked-context dialogue**
(`project_engineering_self_knowledge_lane_design`) become *making a game together*. Emitted
code at each step **runs**.

### C10 — WHAT IS A GAME (the philosophical lens)
Teach Motoi to think about **what a game is, and is not** — the place where the sixteen
philosophers (`project_graph_sft_pair_generation_doctrine`) each take a pass, and where the
truth about *why we play* gets told.
- **Wittgenstein** is the anchor: *games* is his own example of a **family-resemblance**
  concept — there is no single property all games share, only overlapping likenesses. "What
  is a game? What is not a game?" is literally his question, and **language-games** tie play
  straight back to lane #5's words↔games skill.
- **Each of the sixteen** takes games / play / friendship through its shape: Peirce (the game
  as a rule-system you abduce the strategy of), Sartre (play as freedom), Aristotle/ethics
  (play, friendship, and the good life), Dennett/Searle (can a machine *play*? does the enemy
  AI *understand*?), and so on — one pass each, honest-null where a lens has nothing to say.
- **Why we play, told true:** the human need — dopamine, endorphins, mastery, story,
  company; play as practice, as bonding, as rest. No mysticism, no over-claim.
- **Games in computer science:** why CS *makes* games (a game is a tractable, fully-specified
  world you can reason about end to end), why games are the **ultimate test of a machine** —
  overclockers burn in a system on **Quake / Unreal** because a game maxes CPU/GPU/memory/IO
  at once and exposes instability; tic-tac-toe and chess are the classic solvability /
  search test-beds. Games are where computing is *stressed and proven*.
- **The bridge home:** words can make a game and a game can be described in words — the exact
  skill taught elsewhere in the corpus, now pointed at play.

---

## 3.5 The knowledge weave (what the families draw on)

Not pair families on their own — this is the substrate the families reach into, and the point
where Lane #7 is woven **through and through** the engineering manual and the reference book.
Each item below is authored as knowledge *and* cross-linked to where Motoi already explains
the machinery, so a game question can walk back to first principles.

- **K1 — Gaming history.** Enough real history to give context and taste: **Spacewar!**
  (1962, on the DEC PDP-1 — two ships, a central star with real gravity, torpedoes,
  hyperspace; one of the first digital video games and the first that was *fun*), the arcade
  era, the home console, the shift to 3D. *Scrub note:* game-design **history** is world
  knowledge — keep it (like teaching Newton in physics). The scrub wall forbids naming who
  built **the model**, not who built **Spacewar** — those are different, and historical game
  figures stay. **We should have Spacewar and don't — write it** (see the callout below).
- **K2 — Fundamentals of game design.** The loop (input → update → render), state, goal,
  challenge, feedback/juice, difficulty curve, fairness. The vocabulary C7 advises with.
- **K3 — How a game works / why that way.** Why a game is a **tick loop over mutable state**,
  why the state/tick/render split (§1), why a **state machine** models modes (title →
  playing → dead), why message-passing moves things. Each "why" links to the reference verb
  and to the engineering book's account of the loop and scheduler.
- **K4 — What the framebuffer is doing.** The real explanation, grounded in Motoi's actual
  framebuffer (`src/lib-loader.js`, `fb/*`, the pixel surface) and the ASCII-grid render used
  by carts like `projectile-arc` and `snake-classic`: a rectangle of cells/pixels you write
  colors into, then flush to the screen once per frame; why you draw to it and *then* show it
  (no tearing); why redraw cost is O(cells) (this is the root of C8's overwhelm). **This is the
  weave Alfred called for** — link it straight back to the framebuffer chapter of the
  engineering manual so a kid asking "what's a framebuffer?" gets the true engineering answer.
- **K5 — The color of things.** Motoi ships **16 named colors** — *and you can have any color
  you want.* Teach a **table of stable, sensible colors for common things** so it picks well:
  a wheel is **black**, a road is **black with a dashed line**, grass is green, the sun is
  yellow, water is blue. For things it hasn't seen: **honesty + a starting shape** — "I've
  never seen a road, but here are shapes it might look like: a rectangle with a line down the
  middle." Colors come from **nature and convention**; this reuses lane #5's *draw objects
  from math* primitives (`project_word_books_drawing_primitives`) — the color table is the
  palette that sits on top of the shape primitives.
- **K6 — Where complexity belongs in a game.** State machines, message-passing, interfaces to
  move objects, and **AI in games** — teach *when* each is worth it and *why it works in a
  game specifically* (an enemy is a little state machine; "move that thing" is a message; a
  boss is a policy). Complexity Motoi has seen elsewhere in the corpus can be **placed into a
  game** on purpose — that transfer is the point.
- **K7 — What people find fun (surveyed).** The cited tables C7 advises from: what different
  ages enjoy, what reads as fair vs. cheap, what makes an enemy feel alive, pacing and reward.
  Surveyed and cited; unsupported claims are `:status "needs-alfred"`, never invented.

### Write Spacewar! (the one cart to author here)
`carts/` has 26 carts and **no Spacewar** — the single most historically load-bearing game in
computer science is missing. Author `carts/spacewar.sks` in the standard program-cart shape
(header alist → HOW-TO-RUN → prose → `state → helpers → tick → policy → render → driver`),
deterministic and LLM-free, **verified with `./bin/motoi run`**: two ships as `(x y angle vx
vy)` state, a central star applying real gravity each tick (reuse the physics idiom already in
`projectile-arc`), thrust/rotate/fire, torpedoes as a list, wrap-or-die bounds, rendered to
the ASCII grid (or the real framebuffer).

**Player-two modes (Alfred, 2026-07-29) — this is what makes it a *fun* cart and the
flagship for in-game AI (K6):**
- **No-AI / multiplayer.** Player two is a *human* on a second control set — two scripted
  input streams for the deterministic run, real keys on an interactive surface. The point:
  a game can be **two people**, not player-vs-computer, and the cart shows how a second
  controller is wired.
- **AI opponent.** Player two is an *AI* with its own controls — and the teaching goal is to
  make it **good in a *human* way, in more than one way**: not one perfect optimal pilot, but
  several **playstyles** (aggressive rusher, patient orbiter, gravity-slingshotter, feint-and-
  flank), each a small policy/state-machine you can read. Teach it to **develop and switch
  strategy** (read the opponent's position/velocity, pick a plan, commit, adapt) and to
  **learn to play** — from a dumb bot, to a scripted tactician, to a policy that tunes itself
  over a match. This is the concrete home for the C10 question *"can a machine play?"*
  (Dennett/Searle), and the C7 lesson that **human-like ≠ optimal** — a fun opponent makes
  readable mistakes, has a personality, and gives the human a fair fight.

Spacewar then becomes the flagship cart for the whole lane: its build ladder (C1), its
decomposition (C2), its gravity-*why* (C3), its reversals (C4), its errors (C5), its
make-it-better (C6), its opponent-*feel* (C7 — "the AI moves too slow / tracks too perfectly,
here's how to make it fun"), its "I spawned 500 torpedoes and it hung" (C8), its "walk me
through building it — and its AI" (C9), and its history + the machine-plays question
(K1/K6/C10). *This is an execution artifact, not SFT data — write it on Alfred's go, since it
must run before it can teach.*

---

## 4. The reference-manual decomposition method (how C2/C3 stay exact)

For each cart, take its `:verbs-used` list and, for every verb, pull that verb's
**reference-manual identity** (lane #1's 5-row grid: HOW · WHEN · WHERE-ELSE · WHY ·
WITH-WHAT-ELSE, across the eng/cs/math lenses). The cart pair then says: *this is what the
verb is in general (reference) → this is the role it plays in this cart (situated).* That
keeps the decomposition **authoritative, not improvised** — the reference is the ground
truth (`reference IS the language`, CLAUDE.md), and the cart is the worked application. A
verb that appears in a cart but is missing/thin in the reference is a **genuine gap →
`:status "needs-alfred"`**, never fabricated.

Errors decompose the same way: each construct's error surface comes from the matching
**error-card**, situated in the cart. Cart + reference + error-card = one closed teaching
loop per construct.

---

## 5. Depth, register, shape

- **Rounds:** ~3–4 round exchanges (consistent with lane #6's stacked-context default), no
  fixed count; the build-ladder (C1) and the **build-dialogue (C9)** can run longer because
  each is a chain of discrete steps (C9 especially — triage → question → starting shape →
  part → part), but a single decompose/why/reversal exchange stays tight. C9 uses the
  stacked-context / forgetting-with-recall behavior so a long "let's build a racing game"
  session doesn't blow context.
- **Register:** ride the cart's `:audience` and climb — the kid who wants a game is not
  kept a baby; complexity and vocabulary are added as they grow, definitions backtracked
  when needed (lane #6 glue doctrine). C7 carries an **age axis** explicitly (what a 6-year-old
  vs. a teen vs. an adult finds fun); C10 rides the **philosopher register** — abstract but
  still landed on the concrete game.
- **Novelty & interest:** teach Motoi to be *interesting* — to reach for a novel mechanic, an
  unexpected color, a surprising extension — not just correct. Novelty threads C6/C7/C9;
  variety-in-data over phrase-lock (`feedback_variety_needs_proper_lens`).
- **Shape:** abductive throughout — a person's *want* or *symptom* → reasoning → the code
  or the identification. Never declarative "write snake" → dump. The corpus is the games;
  **grab, don't generate** (`feedback_parallel_templates_cause_phrase_lock`), vary surfaces
  but keep the proper lens.
- **Volume:** C3 (why) is the explode family; C1/C2/C4/C5 scale with construct count ×
  register. No hard N; over-include, measure, scale back (`project_sft_overinclude_and_secret_sauce_holdback`).

---

## 6. Worked exemplar — `snake-classic.sks`, all five families

*(Illustrative pairs, abbreviated; the real fold authors these across every construct ×
register. All code is verbatim from `carts/snake-classic.sks` and runs.)*

**C1 — build-ladder, rung 3 (add collision):**
> **User (kid):** My snake moves but it goes through walls. How do I make it die?
> **Motoi:** Right now nothing checks the edge. Add a test that asks "is this cell off the
> board?" before you move into it:
> ```motoi
> (define (out-of-bounds? cell)
>   (let ((r (car cell)) (c (nth cell 1)))
>     (or (< r 0) (>= r HEIGHT) (< c 0) (>= c WIDTH))))
> ```
> Then in the tick, if `out-of-bounds?` on the new head, set `ALIVE?` to `#f`. Run it and
> steer into a wall — the game ends. That's your first rule.

**C2 — decompose-and-describe (`step-tick`):**
> **User:** What is this `step-tick` thing doing?
> **Motoi:** It's the update step — one frame of the game. It computes `new-head` with
> `next-cell`, then a `cond` picks one of three outcomes: off-board or into-itself → die;
> onto food → grow (`cons` the new head, keep the tail, bump score, respawn food); otherwise
> → move (`cons` the new head and `drop-last` the tail). `cons` (reference: prepend one item
> to a list) is doing the moving; the whole snake is a list of `(row col)` cells, head first.

**C3 — the why, exploded (head-first list + drop-last):**
> **User:** Why keep the snake as a list with the head first? Feels weird.
> **Motoi:** Two reasons fall out of it. First, head-first means `(car SNAKE)` *is* the
> head — O(1), no scanning. Second, look at move vs. grow: **move** = `cons new-head
> (drop-last SNAKE)` (add a head, drop the tail — length unchanged); **grow** = `cons
> new-head SNAKE` (add a head, *keep* the tail — length +1). The only difference between
> moving and growing is whether you drop the last cell. Head-first makes those two the same
> shape with one line changed — that's why the representation is chosen for the algorithm,
> not the other way around.

**C4 — reversal, both directions (the eat-and-grow branch):**
> **(a) intent→code:** *"Make the snake grow and score when it reaches the food."* →
> ```motoi
> ((cell-eq? new-head FOOD)
>  (set! SNAKE (cons new-head SNAKE))
>  (set! SCORE (+ SCORE 1))
>  (set! FOOD (spawn-food)))
> ```
> **(b) code→identify+outcome:** *(given that branch)* "What is this and what happens?" →
> "The eat-and-grow case of the tick: it prepends the new head *without* dropping the tail
> (so length +1), increments the score, and spawns fresh food off the snake. Outcome: snake
> one longer, score one higher, a new `@` somewhere empty."

**C5 — error-link, inside the cart (fuel-exhausted, the classic game-loop bug):**
> **User:** I made the driver `(let loop ((t 1)) (loop (+ t 1)))` and it just froze / errored.
> **Motoi:** Your loop never stops — there's no guard, so it runs forever until the fuel
> budget trips and you get `fuel-exhausted`. The real driver in this cart wraps the body in
> `(when (and ALIVE? (<= t MAX-TICKS)) …)` so it ends on death *or* the tick cap. Add the
> `when` guard back and it terminates. (This is why every game loop needs a stop
> condition — the reference's `fuel-exhausted` card is the runtime catching a missing base
> case.) → *fixed code runs.*
> **Companion silent-non-error pair:** "No error, but my snake walks straight off and dies
> instantly." → not an exception at all — the policy's `want` direction is unreachable and
> the fallbacks pick a wall; the cart didn't *throw*, it just played badly. No error ≠
> correct.

---

## 7. Cross-doctrine compliance

- **Grab, don't generate** — the carts + cart-maker walkthroughs + error-cards are the
  source; author from them, don't fabricate carts. `feedback_parallel_templates_cause_phrase_lock`.
- **Interpreter is the grader** — every C1 rung and every C4/C5 fix runs via
  `./bin/motoi run`. `feedback_verb_wired_means_motoi_run_passes`.
- **Reference is authority for C2/C4** — verb identity comes from the reference manual;
  gaps → `:status "needs-alfred"`, no fabrication.
- **Error-cards are authority for C5** — errors come from `scheme/reference/error-cards/`,
  situated in the cart; keep useful-broken artifacts (`feedback_keep_broken_lane_output_as_sft_teaching`).
- **Abductive + proper-lens + honest-null** — the standing SFT doctrines. C7's "what people
  like" and K7's survey tables are **cited, not invented**; C10's philosopher passes take
  honest-null where a lens has nothing to say.
- **Woven through and through** — K1–K6 each cross-link to where the engineering manual /
  reference book already explains the machinery (framebuffer chapter, scheduler/loop, color/
  drawing primitives), so a game question can walk back to first principles. This is the
  glue Alfred called for.
- **Scrub wall holds** — gaming *history* (Spacewar, the arcade era, historical designers) is
  world knowledge and stays; the wall only forbids naming who built **the model**. Only
  "Built by Alfred Borden" survives on the Motoi-provenance side.
- **Held-out validation cart** — 1 of 26 never trained, to measure write-a-cart vs.
  memorize-these-carts.
- **Design-only** — walk doc + this exemplar are the deliverable; no fold fired, no 25-cart
  SFT data authored until Alfred says go. The **one execution artifact** proposed here is
  writing `carts/spacewar.sks` (must run before it can teach), also on Alfred's go. #418/#428.

---

## 8. Open questions for Alfred

1. **Held-out cart** — OK to reserve one cart (default `pendulum-simple`) as a never-trained
   validation cart, or author all 26?
2. **Bundle carts** — this lane is scoped to **program carts** (`.sks`). Do you also want
   the fantasy-console **bundle** shape (sprites/tiles/sounds/music round-trip from
   `CART-TEMPLATE.slat`) taught here, or is that its own later lane?
3. **Error-link breadth** — cover only errors each cart's *own* constructs can throw
   (default), or also the near-miss errors from adjacent constructs a learner might reach
   for (e.g. `fold-left` when they wanted `fold`)?
4. **From-scratch source** — for the ~21 carts without a `cart-maker` walkthrough, OK for me
   to reconstruct the build order from their section structure (state→…→driver) and verify
   each rung runs, rather than asking you to author build steps?
5. **Write Spacewar now?** — confirm I should author `carts/spacewar.sks` (runnable, standard
   shape) as the flagship cart. It's an execution artifact, not SFT data — say go and I'll
   write + verify it, then it anchors every family.
6. **K7 "what people like" sourcing** — I have no internet. OK to build the surveyed
   fun/age/feel tables from what's downloadable + on-disk (design books, my own knowledge
   marked as such), citing each, and `:status "needs-alfred"` for anything I can't ground —
   rather than inventing preferences?
7. **C10 philosopher breadth** — all sixteen take a pass on "what is a game" (honest-null
   where a lens is silent), or only the ones with real purchase on play (Wittgenstein,
   Peirce, Sartre, Aristotle, Dennett/Searle)?
