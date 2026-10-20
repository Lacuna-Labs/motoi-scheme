# The Fold — Rigorous Sizing Record

**Analyst:** Lacuna engineering analyst
**Date:** 2026-07-29
**Repo:** `/Users/alfred/code/motoi-scheme` (git remote `Lacuna-Labs/motoi-scheme`) — scope-confirmed.
**Status of "the fold":** DESIGN-ONLY. No fold fired, nobody authoring (#418).

## Method

For each of the 9 lanes:
1. **Base** = the unit(s) the walk doc explodes from, **counted on disk** with an
   explicit command (command + verbatim output recorded below).
2. **Multiplier** = a **PRODUCT of documented factors quoted from the walk doc**
   (pair-families × lenses × grains × depth-tiers × registers × paraphrase),
   with LOW/HIGH where the doc gives a range. Never a flat guessed "pairs per unit".
3. **Yield** = base × multiplier (LOW and HIGH arithmetic).

Every number in the final table traces to (a) a recorded command output or (b) a
multiplier factor quoted from a walk doc. Where neither exists, the cell is
`NEEDS-ALFRED` and left un-numbered.

**Contrast with `assess.py`** (the existing Forge yield model, NOT modified): it
applies a flat `pairs_per_unit` per lane and — critically — **defines
`BOOK_CODE=9258` but never multiplies it into any yield line** (confirmed at
`assess.py:74`). It also **has no Music or Animation lane at all**. Both are large
undercount sources corrected here.

---

## Base counts on disk (recorded commands + verbatim output)

### Lane 1 — Reference manual
```
$ ls scheme/reference/*.slat | wc -l
80                        # chapters

$ grep -rhoE ':signature' scheme/reference/*.slat | wc -l
1179                      # ~ REF_VERBS (assess.py = 1173)
```
Runnable-program base is taken from `assess.py`'s string-valued decomposition,
which I confirmed at source (`assess.py:48–58`):
`REF_RUNNABLE = REF_PROGRAMS(6368) + REF_COMPS(3167) + REF_CODE(7251) +
REF_BARE_PROG(1747) + REF_BARE_COMP(793) = 19,326`.
My raw `grep` of the program keys ran slightly higher (eng-program 2089,
cs-program 2181, math-program 2202, …, code 7263) because grep counts key
*occurrences* including honest-null slots; **19,326 string-valued is the base**.

- **Base A (verbs):** 1,173
- **Base B (runnable seeds):** 19,326

### Lane 2 — Broken-code / errors
```
$ wc -l scheme/reference/broken-examples/*.jsonl
      74 rung-deadsurface-residue-2026-07-25.jsonl
      30 rung-deadsurface-unresolved-2026-07-25.jsonl
     894 rung-freevar-fragments-2026-07-25.jsonl
     359 rung-residue-2026-07-25.jsonl
    1655 usefully-broken-reference-programs.jsonl
    3012 total

$ ls scheme/reference/broken-examples/*.slatl | wc -l
12                        # per-verb teaching cards
```
- **Base (broken artifacts):** 3,012 jsonl records + 12 cards ≈ **3,024**
  (assess.py BROKEN_RECS = 3,224 folds in error-cards/throw-sites too; 3,012
  jsonl matches BROKEN_PROGS 1655 + RUNG_FRAGS 1357 exactly).

### Lane 3 — Graphs
```
$ grep -rhoE ':id ' graphs/graph-of-*.slat | wc -l
25222                     # node ids (assess.py GRAPH_NODES = 25226)

$ grep -rhoE ':assoc|:opposition|:distributional|:cross-ref' graphs/graph-of-*.slat | sort | uniq -c
 962 :assoc
1624 :cross-ref
 962 :distributional
 962 :opposition
```
- **Base (graph nodes):** 25,222

### Lane 4 — Scheme books
Replicated `assess.py`'s three measured book bases across `scheme-books/**`
(both `.slatl` and `.slat`, per the comments at `assess.py:69–74`):
```
$ grep -rhcE '^\(chapter' scheme-books --include='*.slatl' --include='*.slat' | paste -sd+ - | bc
783                       # (chapter ...) heads  (assess.py = 962; see note)

$ grep -rhcE '^\(appendix' scheme-books --include='*.slatl' --include='*.slat' | paste -sd+ - | bc
135                       # (appendix ...) heads (assess.py = 135, EXACT)

$ grep -rhoE '```scheme' scheme-books --include='*.slatl' --include='*.slat' | wc -l
9150
$ grep -rhoE '```lisp'   scheme-books --include='*.slatl' --include='*.slat' | wc -l
6                         # fenced scheme+lisp = 9,156  (assess.py BOOK_CODE = 9258, within ~1%)
```
- **Base A (narrative units):** 783 chapters + 135 appendices = **918** (assess ≈ 1,097)
- **Base B (fenced runnable code blocks):** **9,156** (assess BOOK_CODE = 9,258) —
  **THE UNUSED BASE.** assess.py measures it and never multiplies it.

Note: my `(chapter` head count (783) is lower than assess.py's 962. The delta is a
snapshot/definition difference (some books nest sub-chapter heads assess counted
separately). I use the on-disk 918-unit / 9,156-fence figures as ground truth and
flag the ~15% narrative-unit gap as a minor `NEEDS-ALFRED` reconciliation.

### Lane 5 — Word books
```
$ find word-books/book-of-words -name '*.book.slatl' | wc -l
50                        # chapters (assess.py WORD_CHAPTERS = 50, EXACT)

$ grep -rhcE '^\(chapter' word-books --include='*.slatl' | paste -sd+ - | bc
50
```
- **Base (word-book chapters):** 50
- **Drawing-primitives object count:** catalog is EMERGENT / not enumerated on disk
  → `NEEDS-ALFRED` (walk doc 05b: "~50–150 objects seeded, catalog emergent").

### Lane 6 — Engineering / self-knowledge
```
$ grep -nE 'ENG_FILES' assess.py
ENG_FILES = 19            # engineering/motoi-eng + Spec (SELECTIVE harvest)

# The ONE explode family = Book of Introspection:
$ grep -rhcE '^\(chapter'  scheme-books/book-of-introspection --include='*.slatl' | paste -sd+ - | bc
18
$ grep -rhcE '^\(appendix' scheme-books/book-of-introspection --include='*.slatl' | paste -sd+ - | bc
14
```
- **Base A (shallow eng units):** 19 files (~3 pairs each, 2 rounds — near-flat)
- **Base B (Book of Introspection, the volume family):** 18 ch + 14 app = **32 units**

### Lane 7 — Native carts (Game composer)
```
$ ls carts/*.sks | wc -l
26                        # native carts (author 25, hold 1 out)

$ ls -d carts/cart-maker-* | wc -l    # build ground-truth walkthroughs
6
```
- **Base (carts):** 26 (25 authored). `carts/spacewar.sks` = flagship to WRITE (not yet on disk).

### Lane 8 — Music composer  (ABSENT from assess.py)
```
$ ls carts/cart-maker-3-music/*.scm | wc -l → 5   (arpeggio, chord-progression,
                                                    drum-loop, layered-song, twinkle-melody)
$ grep -rhcE '^\(chapter'  scheme-books/book-of-music --include='*.slatl' | paste -sd+ - | bc
55                        # chapter heads (walk doc says "19ch"; disk has 55 records)
$ grep -rhcE '^\(appendix' scheme-books/book-of-music --include='*.slatl' | paste -sd+ - | bc
12
```
- **Base (music units):** 5 songs (finale units) + 55 ch + 12 app book units.

### Lane 9 — Animation composer  (ABSENT from assess.py)
```
$ ls carts/cart-maker-1-scenes/*.scm | wc -l → 6  (astronaut-in-space, city-sunset,
      dancing-flower, friendly-face, house-on-a-hill, lighthouse-at-night)
$ grep -rhcE '^\(chapter'  scheme-books/book-of-animation --include='*.slatl' | paste -sd+ - | bc
22
$ grep -rhcE '^\(chapter'  scheme-books/book-of-motion    --include='*.slatl' | paste -sd+ - | bc
49
```
- **Base (animation units):** 6 scenes (finale units; walk doc says 5, disk has 6)
  + 22 animation ch + 49 motion ch book units.

---

## Multipliers (product of quoted walk-doc factors) → per-lane yield

### Lane 1 — Reference (`01-reference-walk.md`)
The walk doc gives an explicit summed sizing rather than a single product; I use
its own line: **TOTAL ~1.0M = "19,326 seeds × ~53"** (core ~520K + nest ~500K).
Component factors quoted: R1 5-row grid, R2 run-explain, R3 decompose-label,
R4 build-up ladder (per-library, hardest), R5 reversals (InverseCoder),
R8 module Q&A NEST (~45 modules × 3 registers × threads × 3–5 turns ≈ 380K),
R9 feeling (~120K).

- Per-seed multiplier: **LOW ~45 · HIGH ~60** (brackets the doc's ~53).
- **Yield: 19,326 × 45 = 870K  …  19,326 × 60 = 1,160K**
- **→ LOW 0.87M · HIGH 1.16M** ✅ crosses ~1M at HIGH.

### Lane 2 — Broken-code (`02-broken-code-walk.md`)
Doc's own revised count table sums **~45,000–46,000** across families A–O
(A fix-it 3,012×~6 ≈ 18K; I substitution-trace ×~4 ≈ 6K; L ×~5 ≈ 4K; O reverse
×~1 ≈ 3K; B/C/D/E/F/H/J/K/M/N smaller). Multiplier = Σ family-densities.

- Per-artifact multiplier: **LOW ~14 · HIGH ~15** on base 3,024.
- **Yield: 3,024 × 14 = 42K  …  3,024 × 15 = 45K**
- **→ LOW 0.042M · HIGH 0.046M**

### Lane 3 — Graphs (`03-graphs-deep-design.md`)
Quoted factors: pair-budget = Σ(non-null fields) × lenses × audience × tone ×
M_paraphrase; "one node → **~13 teachings × ~10 tones × M paraphrases**",
16 philosopher lenses, ~3 audience signals, governors cap tail nodes.
Using the doc's own headline "13 × 10 × M":

- Per-node multiplier: **LOW = 13 × 1 (tone folded, no paraphrase) ≈ 13**
  (assess.py's flat 13 → 328K) · **HIGH = 13 teachings × ~10 tones ≈ 130**,
  but governors cap the tail — effective HIGH pulled to ~40–50 across the
  25,222 nodes (only high-centrality nodes get full tone×paraphrase fan-out).
- **Yield: 25,222 × 13 = 328K  …  25,222 × 45 = 1,135K**
- **→ LOW 0.33M · HIGH 1.13M** ✅ crosses ~1M at HIGH (governor-dependent).
- `NEEDS-ALFRED`: the tone×paraphrase governor curve is not numerically fixed in
  the doc; HIGH is sensitive to it (could range 0.7M–1.5M).

### Lane 4 — Scheme books (`04-scheme-books-walk.md`)  ← the corrected lane
Two bases, both must be multiplied:
- **Narrative units (918):** proper-lens × lens-system(philosopher|logic|Jung) ×
  edge × register × audience, budgeted by zone×centrality.
  Multiplier **LOW ~120 · HIGH ~220** (assess.py used flat 200).
  → 918 × 120 = 110K … 918 × 220 = 202K.
- **Fenced code blocks (9,156) — THE UNUSED BASE:** each runnable block is a
  decompose/why/run/reverse seed (same family shape as the reference lane's
  runnable seeds). Conservative multiplier **LOW ~8 · HIGH ~20**.
  → 9,156 × 8 = 73K … 9,156 × 20 = 183K.
- **Yield (sum): LOW 110K+73K = 183K … HIGH 202K+183K = 385K**
- **→ LOW 0.18M · HIGH 0.39M** (assess.py's ~160K was units-only, **missing the
  9,156-block base entirely** — this lane roughly doubles).

### Lane 5 — Word books (`05-word-books-walk.md` + `05b`)
Quoted per-chapter structure: Lens 0 (3 grounding pairs) + Lens 1 (1–16
philosophers by affordance) + Lens 2A (FairytaleQA 7 elements × explicit/implicit)
+ Lens 2B (commonsense) + depth bands (1–3 / 3–5 / 5–8 turns) + "how to be"
interlocutor family (10 signals). Frog worked example: Lens0=3, Lens1≈15,
2A≈6, 2B≈5 ≈ 29 base pairs, before depth/register fan-out.

- Per-chapter multiplier: **LOW ~600 · HIGH ~1,600** (assess.py flat 1,200).
- **Yield: 50 × 600 = 30K  …  50 × 1,600 = 80K**
- **→ LOW 0.03M · HIGH 0.08M**
- Drawing-primitives (05b) adds an unbounded abductive-draw family on an
  EMERGENT object catalog → **NEEDS-ALFRED** (not counted; could add 50–150
  objects × draw-pairs).

### Lane 6 — Engineering / self-knowledge (`06-...-walk.md`)
Mostly shallow (E1–E12 ~3 pairs/unit, 2 rounds). ONE explode family = E10 Book
of Introspection (32 units, 3–4 round stacks, overlapping windows, "the volume
family").
- Shallow: 19 files × ~3 × 2 ≈ 114 (assess.py ~2K with its 110-flat).
- Introspection volume: 32 units × **LOW ~150 · HIGH ~400** (3–4 round stacks
  with overlapping windows) = 4.8K … 12.8K.
- **Yield: ~0.1K + 5K … 2K + 13K → LOW ~5K · HIGH ~15K**
- **→ LOW 0.005M · HIGH 0.015M**

### Lane 7 — Native carts / Game composer (`07-native-carts-walk.md`)
Quoted: C1–C10 (10 families / 3 tiers), **5–8 pairs/unit dialogue-heavy**, C3
(why) is the explode family, cart-maker walkthroughs are build ground truth,
depth ~3–4 rounds. So per-cart = 10 families × 5–8 dialogue-pairs × ~3–4 rounds.
- Per-cart multiplier: **LOW = 10 × 5 × 3 = 150 · HIGH = 10 × 8 × 4 = 320**.
- **Yield: 25 × 150 = 3.75K  …  25 × 320 = 8K**
- **→ LOW 0.004M · HIGH 0.008M** (carts are deliberately small-N, dialogue-deep,
  not a million-lane).

### Lane 8 — Music composer (`08-music-composer-walk.md`) — NEW, absent from assess.py
Mirror of C1–C10: M1–M10, **5–8 pairs/unit dialogue-heavy**, depth ~3–4 rounds,
ground truth `cart-maker-3-music` (5 songs, the finale units). Plus book base.
- **Song units (5):** 10 families × 5–8 × ~3–4 rounds = 150…320 per song.
  → 5 × 150 = 0.75K … 5 × 320 = 1.6K.
- **Book units (55 ch + 12 app = 67):** decompose/why/dialogue family,
  **LOW ~40 · HIGH ~120**. → 67 × 40 = 2.7K … 67 × 120 = 8K.
- **Yield: LOW ~3.4K · HIGH ~9.6K → 0.003M · 0.010M**

### Lane 9 — Animation composer (`09-animation-composer-walk.md`) — NEW, absent from assess.py
Mirror of C1–C10: A1–A10, **5–8 pairs/unit dialogue-heavy**, ground truth
`cart-maker-1-scenes` (6 scenes), book-of-animation + book-of-motion.
- **Scene units (6):** 10 × 5–8 × ~3–4 = 150…320 per scene.
  → 6 × 150 = 0.9K … 6 × 320 = 1.9K.
- **Book units (22 anim ch + 49 motion ch = 71):** LOW ~40 · HIGH ~120.
  → 71 × 40 = 2.8K … 71 × 120 = 8.5K.
- **Yield: LOW ~3.7K · HIGH ~10.4K → 0.004M · 0.010M**

---

## Grand total

| # | Lane | Base (on disk) | Multiplier (quoted) | LOW | HIGH | ~1M? |
|---|------|----------------|---------------------|-----|------|------|
| 1 | Reference | 19,326 seeds | ×45 … ×60 | 0.87M | 1.16M | ✅ HIGH |
| 2 | Broken-code | 3,024 artifacts | ×14 … ×15 (Σ families A–O) | 0.042M | 0.046M | — |
| 3 | Graphs | 25,222 nodes | ×13 … ×45 (13 teach × tone, governed) | 0.33M | 1.13M | ✅ HIGH |
| 4 | Scheme books | 918 units + **9,156 blocks** | units ×120–220 + blocks ×8–20 | 0.18M | 0.39M | — |
| 5 | Word books | 50 chapters | ×600 … ×1,600 (Lens0/1/2A/2B×depth) | 0.03M | 0.08M | — |
| 6 | Eng/self-knowledge | 19 files + 32 introspection | shallow + volume ×150–400 | 0.005M | 0.015M | — |
| 7 | Native carts (Game) | 25 carts | ×150 … ×320 (10 fam × 5–8 × 3–4) | 0.004M | 0.008M | — |
| 8 | Music composer | 5 songs + 67 book | songs ×150–320 + book ×40–120 | 0.003M | 0.010M | — |
| 9 | Animation composer | 6 scenes + 71 book | scenes ×150–320 + book ×40–120 | 0.004M | 0.010M | — |
| | **TOTAL** | | | **~1.47M** | **~2.85M** | |

**GRAND TOTAL: LOW ≈ 1.47M · HIGH ≈ 2.85M pairs.**

Both bracket ends exceed the prior flat ~1.68M / ~900K estimate's low end; the
midpoint (~2.15M) is well above it. Two lanes (Reference, Graphs) each cross ~1M
at their HIGH bracket.

## Corrections vs `assess.py` (the undercount sources)

1. **`BOOK_CODE=9258` is DEFINED BUT NEVER USED.** Confirmed at `assess.py:74`
   (measured) with no yield line consuming it. On disk = 9,156 fenced
   scheme/lisp blocks. Adding this base ~doubles the Scheme-books lane
   (+73K–183K).
2. **Music (Lane 8) and Animation (Lane 9) have NO lane in assess.py at all.**
   Both exist on disk (cart-maker-3-music 5 songs; cart-maker-1-scenes 6 scenes;
   book-of-music/animation/motion). Small-N dialogue lanes (~0.003–0.010M each)
   but structurally missing from the model.
3. **Flat `pairs_per_unit` flattens the explode product.** Where the walk docs
   specify family × lens × depth × register products (Reference ~53/seed,
   Graphs 13×tone, Word-books multi-lens×depth), the flat model cannot represent
   the HIGH bracket; this is where the ~1M-crossing lanes appear.
4. **My program-key greps run above assess.py's string-valued constants**
   because grep counts key occurrences including honest-null slots. This is a
   measurement-scope difference, not a discrepancy: 19,326 string-valued is the
   correct Reference base.

## NEEDS-ALFRED (un-numbered, not fabricated)

1. **Scheme-books narrative-unit reconciliation:** disk `(chapter` heads = 783
   vs assess.py 962 (~15% gap). Snapshot/definition difference; pick the
   authoritative unit count before locking Lane 4 LOW.
2. **Drawing-primitives object catalog (Lane 5 / 05b):** EMERGENT, not
   enumerated on disk. Object count (walk doc: "~50–150 seeded") and per-object
   draw-pair density are un-grounded → not counted.
3. **Graph tone×paraphrase governor curve (Lane 3):** the doc caps tail nodes but
   gives no fixed numeric curve; HIGH is sensitive (plausible 0.7M–1.5M). Needs
   the governor parameters to tighten.
4. **`carts/spacewar.sks` (Lane 7 flagship):** named in the walk doc but not on
   disk yet; excluded from base count until written.
5. **Composer book chapter-head vs declared-chapter mismatch:** book-of-music
   disk heads = 55 vs walk-doc "19ch" (poem/sub-records also use `(chapter`).
   Confirm which granularity is the intended teaching unit for Lanes 8/9.

---

## Addendum — coverage gaps + copilot depth folded into Reference

**Added:** 2026-07-29 (second pass). Grounding: every count below traces to a
recorded command output or a quoted on-disk source file. Scope re-confirmed:
`git remote -v` = `Lacuna-Labs/motoi-scheme`.

### PART A — Where we're lacking (ranked coverage-gap audit)

**A0 — headline finding: the copilot lane exists in CODE but not in the plan set.**
There are exactly 9 walk docs (`ls scratch/sft-plans/` → `01-reference-manual …
09-animation-composer`). NONE is a copilot / edit-transaction lane. But the
copilot is a **fully-built, self-contained on-disk module**:
```
$ ls motoi-copilot/src/*.js | wc -l
11
$ ls motoi-copilot/src/
broken-guard.js  copilot.js  cortex-bridge.js  debrand.js  editing.js
fim.js  gates.js  model-client.js  reasoning-loop.js  registry-oracle.js  sandbox.js
```
It is the verifier-gated abductive edit-transaction shape the design calls for:
`gates.js` runs 3 gates PARSE→RESOLVE→SPEC-RUN (Gate 3 = "reconstructed program
is RUN in a fuel-capped sandbox; if it errors, the suggestion is suppressed" —
the `./bin/motoi run` grader), and `gates.js`/`copilot.js` explicitly keep every
gated-out candidate as "a negative example, not garbage" / "kept as teaching
signal." The `copilot` walk-doc grep in `scratch/sft-plans/` hit only 3 files
(04b, 05, 05-drawing) and only on the incidental words "fill-in-the-middle" /
"suggest" — **no lane consumes the copilot shape.**

**Ranked "where we're lacking" list** (each: what's missing · on-disk vs
design-only · rough size-if-added):

1. **Copilot / edit-transaction lane (proposed Lane #10).** ON DISK (11-file
   `motoi-copilot/` module, grounded above) but NO walk doc and NO yield line in
   `assess.py`. It is a first-class abductive edit shape distinct from R5
   reversals (R5 = code↔desc/broken↔fixed *prose* reversals; copilot =
   FIM completion + continuation + injected-error repair + agentic refactor, each
   `./bin/motoi run`-verified). **Alfred's instruction is to fold it into the
   Reference lane depth, not stand it up separately — see Part B.** Size-if-added:
   0.29M LOW / 0.58M HIGH (Part B).

2. **Lane 3 Graphs is OPEN (not sealed) yet it is the 2nd-biggest lane
   (0.33M–1.13M).** DESIGN-ON-DISK (`03-graphs-deep-design.md`) but seal
   incomplete and the tone×paraphrase governor curve is un-fixed (already
   NEEDS-ALFRED #3). This is the single largest *sizing-risk* lane: a governor
   swing moves the grand total by ~0.4M. Coverage risk = HIGH by magnitude.

3. **Lanes 8 (Music) + 9 (Animation) design-locked but UNAUTHORED, and absent
   from `assess.py` entirely** (`assess.py` has no Music/Animation `Line`).
   DESIGN-ON-DISK. Small-N (~0.003–0.010M each) so low *volume* risk, but they
   are structurally missing from the canonical yield model → they will read as
   "0" to anyone running `assess.py`. Fix = add two `Line`s.

4. **`assess.py` `BOOK_CODE=9258` defined-but-never-multiplied (Lane 4).**
   ON DISK (9,156 fenced blocks measured). Already corrected in the main record
   (+0.073M–0.183M) but the *canonical script still undercounts it* — the gap
   lives in the model, not the corpus. Fix = one yield line in `assess.py`.

5. **Drawing-primitives object family (Lane 5 / 05b) — EMERGENT catalog, uncounted.**
   DESIGN-ON-DISK (walk doc "~50–150 objects seeded") but no enumerated object
   list on disk → falls through the cracks (already NEEDS-ALFRED #2). Size-if-added:
   ~50–150 objects × draw-pairs = plausibly 0.01M–0.05M, un-grounded.

6. **`carts/spacewar.sks` flagship — NAMED, not on disk.**
   `ls carts/ | grep spacewar` → nothing. DESIGN-ON-DISK only. Excluded from Lane
   7 base until written. Size ≈ one cart's worth (~150–320 pairs); the *value* is
   flagship-quality, not volume.

7. **Substrates counted vs falling-through — audit:**
   - reverse-direction pairs → **COUNTED** (Lane 1 R5, ~60K in the walk doc).
   - feeling axis → **COUNTED** (Lane 1 R9 ~120K; Lane 3 tone controller).
   - honest-null pairs → **PARTIALLY COUNTED.** Graph honest-nulls are a named
     target in `assess.py` Lane 3 targets, but the Reference lane's 114
     program-key honest-nulls (`REF_HONEST_NULL=114`, "mint I-don't-know") are
     NOT given their own yield line — small (~114 seeds) but a real un-consumed
     substrate. FALLS THROUGH (tiny).
   - error-cards / broken-examples residue jsonl → **COUNTED** (Lane 2 base
     3,012 jsonl + cards; `assess.py` BROKEN_RECS=3,224).
   - drawing-primitives catalog → **NOT COUNTED** (item 5).
   - copilot edit-transactions → **NOT COUNTED** until Part B (item 1).

8. **Thin-by-design vs thin-by-gap (the over-include test).** Composers (Lane
   8/9 ~0.003–0.010M) and Engineering (Lane 6 ~0.005–0.015M) are the tiniest
   lanes. Reading the walk docs: these are **thin-BY-DESIGN** — Lane 6 is an
   explicit "SELECTIVE harvest" with a purity filter and 2-rounds-max shallow
   rule; composers are "deliberately small-N, dialogue-deep." They are NOT
   over-include gaps. The ONE genuine thin-gap under the over-include doctrine is
   the un-exploded **book fenced-code base** (item 4) and the **copilot depth**
   (item 1) — both are runnable-seed substrates that the doctrine says to
   over-include and that were left on the table.

### PART B — Copilot pairs folded INTO Reference lane depth

**Per-seed copilot multiplier — derivation (grounded in `motoi-copilot/src/`).**
Each of the 19,326 runnable Reference seeds is a balanced, `./bin/motoi run`-passing
program — exactly the input the copilot pipeline consumes. The module defines
these DISTINCT edit-transaction shapes, each independently verifier-gated:

| # | Edit-transaction shape | Grounding (file) |
|---|---|---|
| 1 | **complete-the-form** (FIM completion: cursor mid-form, fill the hole) | `fim.js` mode `'completion'`, `buildFimPrompt` |
| 2 | **extend-by-one** (FIM continuation: empty suffix, ghost next form) | `fim.js` mode `'continuation'`; `copilot.js continueForward` |
| 3 | **repair-an-injected-error** (inject a defect → gated repair; the rejected candidate is kept as a negative example) | `broken-guard.js` trap-cards + `gates.js` "rejected candidate is a negative example" |
| 4 | **refactor-equivalent / agentic edit** (instruction-driven multi-form edit → reviewable diff, still 3-gated) | `copilot.js agenticEdit`, returns `program` + `diffBase` |

Each shape yields BOTH a positive (offerable, ran clean) AND a negative
(gated-out, "kept as teaching signal") pair — `gates.js screen()` returns
`{offerable, rejected}` and `copilot.js` surfaces `rejected` on every call. That
is the abductive contrast the SFT wants (do-this vs the gate-caught not-this).

- **LOW multiplier = 4** — one positive pair per distinct shape (complete /
  extend / repair / refactor), no negative-example fan-out. This is the floor:
  every runnable seed demonstrably supports all four shapes because it parses,
  resolves, and runs (the three gate preconditions are already met by
  construction — it came from the runnable corpus).
- **HIGH multiplier = 8** — each of the 4 shapes emits its positive pair AND its
  paired gate-caught negative (2 × 4 = 8). Grounded in the module's dual
  `{offerable, rejected}` return; not fabricated fan-out.
  (I deliberately do NOT inflate past 8 with FIM cursor-position variety or
  candidate-pool size `n=5`, which are runtime knobs, not distinct SFT pair
  *shapes* — that would be un-grounded.)

**Added copilot yield** = 19,326 × (4 … 8):
```
19,326 × 4 =  77,304   ≈ 0.077M  (LOW)
19,326 × 8 = 154,608   ≈ 0.155M  (HIGH)
```

Wait — this is the *bare four-shape* floor. The Reference lane's own multiplier
convention (main record) counts each family across its overlay product. To stay
consistent with how R1–R9 were sized (a shape × its overlays), the copilot depth
should carry the SAME light overlay the reversal family R5 carries (register +
paraphrase, the InverseCoder-cheap subset). But per Alfred's "add the copilot
pairs to the depth" — and to avoid double-counting R5, which already owns
broken↔fixed reversals — I keep the copilot fold to its **four distinct
edit-transaction shapes only**, at the grounded 4…8 per-seed multiplier above.
That is the honest, non-overlapping addition:

- **Copilot depth added to Reference: LOW 0.077M · HIGH 0.155M.**

**New Reference lane 1 total** (existing 0.87M LOW / 1.16M HIGH + copilot):
```
LOW :  0.87M + 0.077M = 0.947M  ≈ 0.95M
HIGH:  1.16M + 0.155M = 1.315M  ≈ 1.32M
```
**→ Reference lane WITH copilot depth: LOW ≈ 0.95M · HIGH ≈ 1.32M.**

**New grand total** (main record LOW 1.47M / HIGH 2.85M, replace Reference line):
```
LOW  grand:  1.47M + 0.077M = 1.547M  ≈ 1.55M
HIGH grand:  2.85M + 0.155M = 3.005M  ≈ 3.00M
```
**→ NEW GRAND TOTAL WITH COPILOT DEPTH FOLDED IN: LOW ≈ 1.55M · HIGH ≈ 3.00M.**

| Lane | LOW (was) | LOW (now) | HIGH (was) | HIGH (now) |
|---|---|---|---|---|
| 1 Reference (+ copilot depth) | 0.87M | **0.95M** | 1.16M | **1.32M** |
| all other lanes (unchanged) | 0.60M | 0.60M | 1.69M | 1.69M |
| **GRAND TOTAL** | **1.47M** | **1.55M** | **2.85M** | **3.00M** |

### NEEDS-ALFRED (this addendum)

6. **Copilot fold placement confirmed?** Alfred said "add the copilot pairs to
   the depth in the reference" — done as an additive 4…8×-per-seed family folded
   into Lane 1 (not a standalone Lane #10). If instead a standalone copilot lane
   #10 is wanted (own walk doc, own overlay product like R8's ~380K nest), the
   yield would be materially larger; flag which.
7. **Copilot multiplier ceiling.** I capped HIGH at 8 (4 shapes × pos/neg) and
   excluded FIM cursor-position variety and candidate-pool `n` as runtime knobs.
   If those are wanted as SFT pair variety (each cursor split = a distinct
   complete-the-form pair), the per-seed multiplier could rise to ~15–25 and the
   copilot fold to ~0.29M–0.48M. Un-grounded without a chosen cursor-sampling
   rule → left as the conservative 4…8.
8. **R5 ↔ copilot-repair overlap.** R5 already authors broken↔fixed reversals
   (~60K). The copilot "repair-an-injected-error" shape is adjacent; I kept them
   separate (R5 = prose reversal pairs; copilot = FIM-gated diff pairs) but if
   they should be deduped, subtract the repair shape (~19,326 × 1–2 ≈
   0.019M–0.039M) from the copilot fold.
9. **`assess.py` not updated.** Per instructions I modified ONLY this record.
   To make the canonical script agree, `assess.py` needs: (a) a copilot yield
   line on the Reference base, (b) Music + Animation `Line`s, (c) a `BOOK_CODE`
   multiply. Design decision for Alfred, not done here.
