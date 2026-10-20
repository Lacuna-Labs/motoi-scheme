# Drawing-primitives reference chapter authoring spec

You are authoring ONE chapter of the Motoi Scheme Reference Manual documenting a
set of newly-wired drawing verbs. This spec defines the exact `.slat` format and
the hard rules. It defines STRUCTURE only — every word of CONTENT you write must
be genuine, per-verb judgment. Do NOT template. Two verbs must never read like
the same sentence with the noun swapped (that is "phrase-lock" and it poisons the
training data). Vary framing, examples, and prose per verb.

## The interpreter is the grader — every code block must RUN

Motoi runs code like this:

    echo '<expr>' | ./bin/motoi run /dev/stdin

You MUST run every single code block you write through that command and confirm
NO error. Errors look like: `unbound symbol`, `not a function`, `is not defined`,
`TypeError`, `ReferenceError`, `SyntaxError`, `error:`, `parse error`. If a block
errors, FIX it until it runs (or, if it is a deliberate teaching failure, mark it
`:expect-error "<message>"` — but for these drawing chapters prefer runnable).

### The framebuffer / SD mode

Verbs that PAINT to the screen need a framebuffer. Any runnable block that calls a
painting verb MUST start with `(set-mode 'sd)` (the default 320×240 canvas). Order:

    (set-mode 'sd) (triangle 10 10 40 10 25 40 8)

- PURE verbs (return a value, don't paint): `superformula`, `svg-path->points`,
  all `img/*` constructors, `image?`, `image-width`, `image-height`, `sdf?`,
  `overlay`/`beside`/`above`/`place-image`/`empty-scene`/`rotate`/`scale`/`scale/xy`/
  `flip-horizontal`/`flip-vertical` (these return image VALUES) — run fine WITHOUT
  set-mode. Prefer to demonstrate them by wrapping in `image?`, `image-width`, etc.
  so the block prints something meaningful (`#t`, a number).
- SINK verbs (paint, return undefined): raster shapes (`triangle`, `triangle-fill`,
  `polygon`, `poly`, `star`, `ellipse`, `ngon`, `ring`, `arc`, and `-fill` forms),
  `draw-image`, `draw-image/center`, `superformula-stroke`, `superformula-fill`,
  `sdf-fill`, `sdf-fill-rect`, `draw-svg-path`, `fill-svg-path` — MUST be preceded
  by `(set-mode 'sd)`. These print nothing (undefined) — that is expected and OK;
  the grade is "no error thrown."

### Language facts you need

- Scheme lists are the data structure. A point is `(list x y)`. A polygon is a
  list of points: `(list (list 5 5) (list 30 5) (list 20 30))`.
- Colors: an integer palette index 0–15, OR a quoted color name symbol like
  `'red`, `'blue`, `'white`, `'black`, `'green`, `'yellow`, `'cyan`, `'magenta`
  (resolved via NAMED_COLORS, case-insensitive). Unknown name → current color.
- `mode` args (for `img/*`) are quoted symbols: `'solid` (filled) or `'outline`.
- Standard library = R7RS-small + SRFI-1 (lists) + SRFI-13 (strings) + SRFI-125
  (hash) + SRFI-27 (random). Use `fold`/`fold-right` (SRFI-1, element-first), NOT
  `fold-left`/`foldl`/`foldr` (those are UNBOUND). `map`, `for-each`, `iota`,
  `filter`, `let`, `let*`, `letrec`, `lambda`, `define`, `cond`, `case`, `when`,
  `unless`, `do`, `list`, `cons`, `car`, `cdr`, `apply`, `display`, `newline`,
  numeric ops, `list-tab`... are all available. `square` is NUMERIC (x*x) — do not
  use it as a drawing verb; the drawing square is `img/square`.
- No `card/*`, `shop/*`, `cine/*`, `flower/*` (those are Curator dialect, not in
  Motoi). Use real Motoi domains: drawing, games, math, physics, simulation, audio.
- Multi-line code in a `:code` string uses literal `\n` for newlines.

## The chapter file format (.slat)

Header (adapt number/library/verb-count to your assignment):

    ;;; NN-<library>.slat — Motoi Scheme Reference · Chapter NN · library <library>
    ;;;
    ;;; <N> verbs in this library. Read chapter 00-intro.slat first.
    ;;;
    ;;; ─── THE ROW RULES (summary — full doctrine in 00-intro.slat) ───
    ;;;
    ;;;   Row 1 (HOW · Composition) — the verb written well; 1/3/5 module ladder
    ;;;   Row 2 (WHEN · Audit)      — operator's problem + this-verb-not-a-sibling
    ;;;   Row 3 (WHERE ELSE · Dim)  — same shape in 3 substrates (verb/metaphor/math)
    ;;;   Row 4 (WHY · Proof)       — claim + runnable test + ∀-invariant
    ;;;   Row 5 (WITH WHAT ELSE)    — chained verbs → named emergent pattern
    ;;;
    ;;; Every row carries the three-discipline lens: :eng · :math · :cs.
    ;;; Every code block RUNS through ./bin/motoi. Made by Alfred Borden.

    (dialect :applies ("motoi") :note "Library <library> — <N> verbs.")

    (chapter :number "NN" :library "<library>" :verb-count <N> :training-eligible #t)

Then one `(verb ...)` record per verb. Use the FULL record shape below (copied
from the real 23-eng.slat exemplar). Every field is required.

    (verb
      :name "<verb>" :std "Motoi"
      :library "<library>"
      :kind "meta"
      :signature "(<verb> arg ...) -> <result>"
      :summary "<one sentence: what it does>"
      :explanation "<a full paragraph: what it is, when to reach for it, how it
        fits the drawing stack, what the result means. Teach it.>"
      :examples (
        (:dialect "motoi" :tier "novice"       :code "..." :note "...")
        (:dialect "motoi" :tier "intermediate" :code "..." :note "...")
        (:dialect "motoi" :tier "expert"       :code "..." :note "..."))
      :caveats ("..." "..." "...")
      :drawbacks ("..." "..." "...")
      :usecases ("..." "..." "..." "...")
      :related ("<sibling-verb>" "<sibling-verb>" ...)
      :learn (:concept "..." :prerequisites ("<verb-or-idea>") :progression "...")
      :row-2-audit (
        (:problem "<a real operator's concrete situation>"
         :program "<the plain solution using this verb>"
         :eng-program "<same, framed as an operator would harden it>"
         :math-program "<same idea, the math/invariant made explicit>"
         :cs-program "<same idea, with a type/precondition guard>"
         :explanation "eng: ... math: ... cs: ..."
         :meta "<WHY this verb and not the named siblings — defend the choice>")
        (:eng "<the audit lens / smoke test>" :math "<the structure>" :cs "<the algorithm+cost>"))
      :row-3-dimension (
        (:setup "<the shared shape, stated abstractly>"
         :rungs (
           (:domain "<this verb's domain>" :code "...")
           (:domain "<a metaphor domain>"  :code "...")
           (:domain "<the math/logic beneath>" :code "..."))
         :explanation "Rung 1: ... Rung 2: ... Rung 3: ... All three share ..."
         :meta "<why the transfer works — the substrate-independent shape>")
        (:eng "..." :math "..." :cs "..."))
      :row-4-proof (
        (:claim "<an algebraic invariant of this verb>"
         :program "<runnable test that prints #t>"
         :eng-program "<operator's version of the check>"
         :math-program "<the math version>"
         :cs-program "<the contract/predicate version>"
         :invariant "∀ ... . <the statement>"
         :meta "<what would FALSIFY it, and what that would mean>")
        (:eng "..." :math "..." :cs "..."))
      :row-5-emergence (
        (:base "<what the verb does alone>"
         :composition "<chain it with other verbs; runnable>"
         :eng-composition "<operator's build; runnable>"
         :math-composition "<the math view; runnable>"
         :cs-composition "<the algorithm view; runnable>"
         :emergent "<name the emergent pattern: a mandala, a scene, a tiling, ...>"
         :meta "<the family this belongs to: compositional geometry, CSG, ...>")
        (:eng "..." :math "..." :cs "..."))
    )

### Content guidance specific to drawing verbs

- Row 3's "same shape in three substrates" is where the SHAPE-MATH acumen lives.
  A circle is a level set of distance; an overlay is function composition / z-order;
  a superformula is a polar function sampled on a schedule; an SDF boolean is
  min/max arithmetic. Reach for the real math beneath each verb.
- Row 5 "emergence" is the compositional payoff Alfred cares about most: chaining
  primitives to make an OBJECT it has never seen — a building from nested squares,
  a tree from a trunk rectangle + circle crowns, a snowman from stacked discs, a
  mandala from rotated copies. Make Row-5 compositions build recognizable things.
- Keep the four disciplines honest: eng = an operator hardening/using it; math =
  the invariant or geometry; cs = the algorithm, data structure, and cost.

## Output

Write the finished chapter to the path you are given
(`scheme/reference/NN-<library>.slat`). Then run a final pass: extract every
`:code` block and confirm it runs clean through `./bin/motoi run /dev/stdin`
(painting blocks prefixed with `(set-mode 'sd)`). Report: chapter path, verb
count, total code blocks, and confirm ALL run clean. If any block cannot be made
to run, leave it marked `:expect-error` with the real message and say so.
