# THE SFT COVERAGE MAP

**2026-08-10 · design read, no data created · companion to `MK-ZERO-PLAN-2026-08-10.md`**

Alfred asked: look into the depth of the 1–3 and the 5–8 bands, tell him what they
contain that gets us to ~3M, and say what covers *the kinds of questions this thing
will actually be asked* — then tie it back to what the CPT eval measured.

Short version up front, then the map.

---

## 0 · THE ANSWER IN FIVE LINES

1. **The CPT landed the knowledge and left one door shut.** In the corpus's own
   document shape the model names real verbs at **89.0% grounding, answering 100%
   of the time**. Asked the same thing in plain English it only answers **55%** of
   the time — but when it does answer it is still **83.7% grounded**. The knowledge
   is in there. The *plain-English door* is what SFT opens.
2. **The fan-out is conceptual, and it is on disk, and you were right about the
   floor.** Minimum per fact is 3 shapes + a coupled reversal (CPT doctrine S00/S06).
   The SFT side is far richer than that floor: the reference lane alone runs **15
   runnable programs per verb** (5 rows × 3 disciplines), each row a *different
   question* — HOW / WHEN / WHERE-ELSE / WHY / WITH-WHAT-ELSE. Those are five
   conceptual understandings, not five rephrasings. That is the fan-out you named.
3. **The 3M is two lanes and a long tail.** Reference ~1.32M + Graphs ~1.14M = 81%
   of the total. Everything else is 0.58M. The corpus is *not* evenly spread and it
   should not be.
4. **Question-type coverage exists — but per-lane, never unified.** Five separate
   taxonomies cover it (below). No one has ever laid them side by side to see what
   falls through. This map is the first time.
5. **One book on disk has no lane: `book-of-your-own-dialect`** — 25 files, 909 KB,
   ~932 runnable blocks, and it is the *anti-confabulation* book (these-are-not-
   your-verbs · hallucination-recovery · honest-null-as-signal · reference-grounding
   drills · pushback dialogues). It is the written form of the exact axis the eval
   measures, and it was never walked. Every other book is walked, math included —
   math is §15 FULL CORE, one of five must-not-flop books. See §7 for the
   correction to my first draft. (Corrected 2026-08-10 after you pushed back.)

---

## 1 · WHAT THE CPT MEASURED, AND WHAT IT HANDS TO SFT

| axis | BASE | CPT ZERO | reading |
|---|---:|---:|---|
| domain pass^4 (all 4 of 4) | 40% | **80%** | reliable capability doubled |
| vocab grounding, native shape | 7.6% | **89.0%** | the knowledge is really in the weights |
| answer coverage, native shape | 38.8% | **100%** | in its own idiom it always speaks |
| vocab grounding, plain English | 32.6% | **83.7%** | when it answers, it's right |
| answer coverage, plain English | 17.5% | **55%** | **the door that's half shut** |
| retention (general) | 91.7% | 50% | forgetting is real; arithmetic is the casualty |
| stop-behaviour, zero-shot | 0% | 99.3% leak | it never learned to *end* |

**So the SFT job is not "add knowledge." It is three jobs:**

- **(a) Shape transfer** — convert 89%-grounded latent knowledge into answers to
  questions phrased the way a person phrases them. Pre-registered target: plain
  coverage **55% → ~100% at grounding ≥84%**.
- **(b) Stop** — every target ends at an explicit end-of-answer. No separator, no
  tag header. This is the top single defect.
- **(c) Repair arithmetic** — locally generated, interpreter-graded (no external
  corpora), and `book-of-math` is the substrate.

Everything in the map below is evidence for (a). §7 is the fix for (c).

---

## 2 · THE FAN-OUT IS CONCEPTUAL — THE PROOF, PER LANE

You said it explicitly: *"they're not just different rephrasings of the same thing,
the one is a set of conceptual understandings."* Here is where that lives.

### 2.1 The reference lane's five rows — five different questions about one verb

Contract from `00-intro.slat` §13a, enforced: **every verb carries exactly 15
runnable programs = 5 rows × 3 disciplines (eng / cs / math).**

| row | question | lens | what changes |
|---|---|---|---|
| 1 Composition | **HOW** do I build with it | SICP 1·3·5 module ladder | the construction |
| 2 Audit | **WHEN** is it the right call | Peirce (abduction) | the judgment |
| 3 Dimension | **WHERE ELSE** does this idea live | Lacan metonymy + Wittgenstein aspect | the domain |
| 4 Proof | **WHY** is it correct | Peirce + Popper (∀ invariant) | the guarantee |
| 5 Emergence | **WITH WHAT ELSE** does it combine | late-Wittgenstein + Lacan | the composition |

Ask "what is `fold`" five ways and you get five *sentences*. Ask it these five rows
and you get five *understandings* — and each one runs. That is the difference you
were pointing at, and it is the contract, not an aspiration.

On top of R1 sit **R2 run-and-explain** (abductive), **R3 decompose-and-label**
(HtDP), **R4 build-up ladder to 60–80 lines per library**, **R5 reversals** (four
directions: code↔description, code↔spec, broken↔fixed, decompose↔recompose),
**R6 comprehension vocabulary**, **R7 Bloom × philosopher**, **R8 module Q&A nest**,
**R9 feeling/self-relation.**

### 2.2 The graph lane's 24 relations — 24 different things to know about one node

25,222 nodes across the four Jung axes. The generator traverses the **complete
24-key relation set**, treating an empty field as honest-null signal, never absence:

`synonyms · oppositions · associations · distributional-neighbors ·
cross-refs-graph · cross-refs-books · related-books · related-verbs ·
related-principles · appears-in-corpus · surrounding-words · relations ·
context-of-use · prerequisites · example-dialogue · examples ·
used-in-programs-as · example-in-world · example-in-scheme · short-scenario ·
antipattern-scenario · sensory-description · contrast-register · tf-idf-per-axis`

Each relation is a *different question a person could ask about that word*. Twenty-
four of them, precomputed, per node, times register times lens. That is the second
1M lane and it is the generalization engine you described — the thing that links
back general knowledge to every item the model meets.

### 2.3 The word-book lanes — world-sense, then the bridge back to code

- **Lens 0** teach the text · **Lens 1** sixteen philosophers · **Lens 2A**
  interpretive conversation (inside the text) · **2B** situational commonsense
  (out to the world) · **2C** draw it from math primitives.
- **2B is arc-typed** — a thing/ecological arc reaches for *analogical slot-swap*
  ("a home for a frog is a swamp"); a person/social arc reaches for
  *variable-decoupling* ("living next to someone isn't knowing them"). Do not run
  one 2B recipe across all arcs. This is the finding that makes 2B not-generic.
- **Lane B is the join you keep naming** — given a world-situation, emit the Scheme
  construct that models it, abductive and bidirectional, **interpreter-graded**.
  Observation → abduction → emit → grade → reverse. The interpreter kills the
  wrong candidates; the model picks among survivors. Non-running emissions never
  enter the set. That is "pivot to code from understanding of the world," built.

---

## 3 · THE DEPTH BANDS — WHAT 1–3 AND 5–8 ACTUALLY CONTAIN

This is the part you asked me to look into by name. It is a **lane-level quota**,
not a per-text choice.

| band | what it is | when it's correct | failure mode |
|---|---|---|---|
| **1–3 turns** | a label, a spare line, a fact that closes fast | the text genuinely affords no more | forcing it to 8 = **fabrication** |
| **3–5 turns** | enough to develop, not enough to go deep | mid-richness scene | **the band that gets skipped** |
| **5–8 turns** | a rich situation you can turn several ways | genuinely affords it | past 8 a real conversation *pivots*, it doesn't drill |

**Typical depth is ~5. Eight is the honest ceiling**, reserved for material that
earns it — because past eight turns people change the subject rather than keep
mining one seam. That ceiling is a fidelity choice, not a budget choice.

**The anti-laziness guard has real teeth:** *"mad one-threes and no three-to-fives"*
is the named failure. 1–3 is cheap to author, so the distribution will skew shallow
unless the **medium band is quota'd to carry genuine mass at the lane level.**

**And here is why the bands matter more than the counts.** Trained across all three
bands matched to real texts, the model learns **depth-affordance** — it picks up a
text and gauges whether it's a one-liner or a rabbit hole. The mechanism is
conceptual blending: a spare text opens a small blend space (few slots to swap) →
1–3; a rich text opens a large one → 5–8. The bands are the blend-richness dial
with numbers on it. Tagged `:depth-band` alongside Bloom and the FairytaleQA
element, so the model correlates **material-shape → afforded-depth** during
training rather than absorbing it from raw distribution.

That is a reader's core skill, and it is the answer to "how many pairs" being a
*measurement* rather than a quota.

---

## 4 · WHAT COVERS THE KINDS OF QUESTIONS IT WILL BE ASKED

Five taxonomies, each covering a different question-space. They exist. They have
**never been laid side by side** — this table is the first time.

| # | taxonomy | source | covers | size |
|---|---|---|---|---|
| 1 | **5 rows × 3 disciplines** | reference `00-intro.slat` §13a | how/when/where-else/why/with-what-else, per verb | 15 × 1,164 verbs |
| 2 | **24-key graph relations** | `graphs/*.slat` | what-is-it-near/opposite/needed-first/used-for | 24 × 25,222 nodes |
| 3 | **FairytaleQA 7 elements × explicit/implicit** | word-books §5B | character·setting·action·feeling·causal·outcome·prediction, surface vs inference | 14 slots per span |
| 4 | **Debugger families A–O** | broken-code walk | "why doesn't this work" — 15 distinct failure shapes | 15 families |
| 5 | **HOW TO BE — 10 interlocutor signals** | word-books §4 | reading the *person*, not the text | 10 moves |

Taxonomy 5 deserves its own line because nothing else covers it. It reads the
interlocutor: disengages→shorten · leans in→open up · pivots→follow · ambiguous→
check · pushes back→hold-with-grounding or concede · confused→repair and re-frame ·
shows feeling→acknowledge the affect first · reveals who they are→pitch the
register · satisfied→land it · minimal→one light offer. Each with a philosopher
read (Grice, Levinas, Popper, Peirce, late-Wittgenstein, Freud, Aristotle),
affordance-gated to ~5–7 of the 10 per seed, tagged `:interlocutor-signal` +
`:governing-lens`.

Across all of it, **three registers** (kid-seed / layperson / PhD) run orthogonally
— the three-tier ladder is arc-invariant, so the same truth re-voices without
changing what's true.

**Honest gap:** there is no cross-lane question-type census. Nobody has asked "of
the questions a person actually types, which of these five taxonomies catches it,
and what falls between them." That census is cheap ($0, no model) and I have not
run it.

---

## 5 · THE MAP — WHERE WE'RE STRONG, WHERE WE'RE THIN

Yields are the grounded HIGH from `assess.py`, cross-checked against
`fold-sizing-record.md`. On-disk authored total at the 2026-07-31 audit stamp:
**158,259 shippable pairs (+10,000 frozen reversals)** — that is the *authored*
unit; ~3.04M is the *explosion* of it. Two units, one claim.

| lane | base on disk | yield | strength | read |
|---|---|---:|---|---|
| **1 Reference** | 19,326 runnable seeds | **~1.32M** | ⬛⬛⬛⬛⬛ | the body of the work; 5-row grid is over-filled (mean 16.5 programs/verb), needs **zero** fill |
| **3 Graphs** | 25,222 nodes | **~1.14M** | ⬛⬛⬛⬛⬛ | the generalization engine; 24 keys precomputed |
| **4a/4b Scheme books** | 918–1,097 prose units · 9,156 code blocks | ~0.43M | ⬛⬛⬛ | **single-layer**; some books have 4–5 layers per section, unexploited |
| **5 Word books** | 50 chapters (→ per-SPAN) | ~0.10M+ | ⬛⬛ | base is wrong unit: ~48 spans/chapter ⇒ a **40–50× base lift** sitting uncounted |
| **2 Broken code** | 3,024 artifacts | ~0.035M | ⬛⬛ | covers **571 of 1,164 verbs (49%)**, single-direction only |
| **8 Music** | 72 units | ~0.012M | ⬛ | M1–M10 machinery, dialogue-heavy |
| **9 Animation** | 77 units | ~0.012M | ⬛ | A1–A10, same machinery domain-swapped |
| **6 Engineering/self** | 19 files + 32 introspection | ~0.002M | ⬛ | shallow **by design** (≤3 pairs/unit, 2 rounds max) — thin is correct here |
| **7 Native carts** | 25 carts | ~0.002M | ⬛ | DEFERRED; `spacewar.sks` named but not on disk |
| | | **~3.04M** | | |

**Two lanes carry 81% of the corpus.** That concentration is right — it is where the
language actually lives — but it means the conversational surface rides on lanes
4/5, which are the two with un-cashed multipliers.

**Three flagged multipliers to ~5M, none of them invented volume** (they raise the
*base*, not the density): word-books per-SPAN (§7.1), the graph tone×paraphrase
governor curve (swings 0.7M–1.5M, not yet numerically fixed), and per-layer
scheme-book explosion (§7.2).

---

## 6 · THE THREE HONEST WEAKNESSES

1. **Broken-code covers 49% of verbs, one direction only.** Debugging is the
   question people ask most ("why doesn't this work") and it is the thinnest
   real-content lane at 0.035M. 593 verbs have no broken/fix record at all.
2. **Word books are sized on the wrong unit.** 50 chapters is not the yield-bearing
   unit; the lensable span is (~48/chapter). Until someone counts spans on disk,
   the lane that carries *conversational ability* is sized at ~0.10M against a
   plausible ~4M. That census is a read-only count — $0, no model, no fabrication.
3. **One unwalked book — `book-of-your-own-dialect`** (§7b). Not math; math is
   §15 FULL CORE. I had that backwards in the first draft.

---

## 7 · THE MATH FINDING — CORRECTED 2026-08-10

**My first draft of this section was wrong and I am replacing it.** I wrote that
`book-of-math` "has no lane of its own, no per-layer pass, and no dedicated
question-type grid." I inferred that from the lane *sizing* table (where all 34
books share one ~0.43M line) without reading the walk doc's per-book sections.

**What is actually true:** the scheme-books walk covers **all 33 numbered books,
one at a time, each with its own directive and tier.** `book-of-math` is **§15,
FULL CORE (Tier 4)** — one of the five "must-not-flop" books alongside
cs-curriculum, ml, simulation-games and jesse. It gets the entire 7-part
cs-curriculum stack identically: content-mastery · meta-teaching · four-way-burst ·
heavy-dialogue · graph-expansion · reasoning-slat · five-audiences-and-jokes. The
grade-per-chapter structure is used deliberately — *the chapter number IS the
audience band* (Gr1–5 child/layperson · Gr6–12 student · Gr13–16+app grad).
`appendix-U "Motoi doing math"` is already the reflexive self-model at the
arithmetic floor: Motoi **computing**, not just teaching. Stated reason it's core:
*"CS + math are how Motoi KNOWS HOW TO WRITE CODE."*

So math is not un-laned. It is one of the most deliberately-laned books in the
corpus. The measurement that stands is the substrate size — **38 files,
1,573,293 bytes, 3,846 code fences (≈1,923 runnable blocks)**, ch01 counting →
ch16 math-major-electives plus sixteen advanced chapters — and the standing fact
that the CPT eval measured **English arithmetic breaking (retention 91.7% → 50%)**.

**What survives from my recommendation, narrowed:** the retention repair needs
locally-generated, interpreter-graded arithmetic (no external corpora). §15 is
already the design for it and `appendix-U` is already the reflexive seed. The
action is not "give math a lane" — it has one. The action is **execute §15's
lower grades early and point the output at the retention axis**, because that
lane is currently unauthored and it is the one that answers a measured regression.

---

## 7b · THE BOOK THAT ACTUALLY HAS NO LANE

Checked all 34 book directories on disk against the walk doc's §1–§33.
**Exactly one has no section: `book-of-your-own-dialect`.**

- **25 files, 909,201 bytes, 1,864 code fences (≈932 runnable blocks)** — 16
  chapters + 8 appendices + manifest.
- ch01 these-are-not-your-verbs · ch02 what-motoi-actually-is · ch03
  check-the-reference · ch04 the-standards-boundary · ch05 i-am-not-that-language ·
  ch06 do-you-have-verb-x · **ch07 hallucination-recovery** · ch08 swapped-pairs-
  and-reversals · ch09 pushback-reasoning-remembering · ch10 deduce-induct-abduct-
  then-verify · ch11 debugging-from-the-real-error · ch12 the-console-remembers ·
  ch13 preseeded-local-memory · ch14 reminders-and-not-repeating · **ch15
  honest-null-as-signal** · ch16 putting-it-together.
- Appendices: not-my-verb catalog · multi-dialect phrasebook · real-analog table ·
  cortex memory verb reference · reasoning-mode examples · debugging playbook ·
  **reference-grounding drills** · **pushback dialogues**.

**Why this is the expensive miss.** This is the anti-confabulation book. It is the
written form of the exact axis the CPT eval measures — "do you name verbs that
actually exist," "what do you do when you were wrong," "when is the honest answer
*I don't know*." The vocabulary-grounding axis went 7.6% → 89.0% *without* this
book being exploded into pairs at all. The remaining 11% invention, the 45% of
plain-English questions the model declines to answer, and the self-correction loop
you locked on 2026-07-30 all have their source material sitting here, unwalked.

It also contains the only on-disk `swapped-pairs-and-reversals` chapter — a book
teaching the reversal shape itself, which is the shape the whole fold depends on.

**Recommendation, one thing:** walk `book-of-your-own-dialect` as §34 before the
fold. It is design work, no spend, and it is the book most directly aimed at the
one number the eval says is still short.

---

## 7c · ORIGINAL §7 (superseded, kept per no-deletes)

You said: *"we are reteaching it mathematics with words, and that's part of the
reason I wrote those books… take the prose out of those and tell it, hey, like
addition, and then give examples of addition and examples of words around
addition."*

**Measured on disk just now:** `scheme-books/book-of-math/` = **38 chapter/appendix
files, 1,573,293 bytes, 3,846 code fences (≈1,923 runnable blocks)**, running
`ch01-counting-number-line` → `ch16-math-major-electives`, then sixteen advanced
chapters (number theory, combinatorics, groups, rings, probability, inference,
optimization, numerical methods, complex analysis, linear algebra, differential
geometry, topology, dynamical systems, mathematical physics), plus a verbs cookbook
and a "Motoi doing math" appendix.

**And the CPT eval measured English arithmetic breaking** — retention 91.7% → 50%,
and it was not trivia that went, it was arithmetic.

Right now that book is averaged into lane 4 alongside thirty-three other books at
~0.43M total. It has **no lane of its own, no per-layer pass, and no dedicated
question-type grid** — despite being the exact substrate for the exact regression
the eval found, and despite the retention fix needing to be *locally generated and
interpreter-graded* (no external corpora) which is precisely what a book of
runnable math blocks affords.

**Recommendation, one thing:** promote `book-of-math` to its own lane with the
reference lane's five-row treatment applied to *concepts* rather than verbs —
ch01 addition gets HOW (build it) / WHEN (which situation calls for it) /
WHERE-ELSE (the same idea in counting, in money, in geometry) / WHY (the invariant)
/ WITH-WHAT-ELSE (what it composes into), each with the three-register ladder and
the word-book 2B transposition on top. That is your fan-out applied to arithmetic,
it doubles as the retention replay, the interpreter grades every block, and the
authoring is already bought and paid for.

---

## 8 · WHERE YOUR BELIEF WAS RIGHT, AND WHERE IT WAS LOW

You said: *"even in this lowest case, we at minimum generate, I believe, it's three
pairs of alternative ways of saying the same thing, and it's reversal."*

**Right on the floor.** CPT doctrine: **minimum 3 shapes per fact**, S00 paraphrase
at **M≈5 universal**, **S06 reversal REQUIRED** — and the reversal pair is
**coupled**: if either half fails verification, both are blocked. That coupling is
what makes the reversal a real inverse rather than a second forward pair.

**Low on the ceiling.** The floor is 3+reversal. The reference lane's actual
contract is 15 runnable programs per verb across five *conceptual* rows and three
disciplines, and the graph lane's is 24 relations per node × register × lens. The
minimum you remembered is the guarantee under the thin tail — the anchors run an
order of magnitude above it.

---

## 9 · WHAT THIS MAP DOES NOT DO

- It does not re-derive the walk docs. Each lane's authority is its own walk doc in
  `scratch/sft-plans/`.
- It does not size the three flagged multipliers. Those need on-disk censuses
  (span count, layer count, governor curve) — read-only, $0, not yet run.
- It does not decide anything. The three MK ZERO decisions still sit in
  `MK-ZERO-PLAN-2026-08-10.md` §5 awaiting you: (A) train on the fused CPT vs the
  untouched base, (B) full-parameter vs LoRA, (C) locally-authored arithmetic
  replay in or out.
- It does not touch the fold. No data created, no commits.
