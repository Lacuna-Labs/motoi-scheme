# 01 · Reference manual — the SFT walk

**2026-07-28 · design-only · no fold · no data created**

This is the lane #1 plan that was missing. The reference lane is **the body of the
work** — maximal Scheme learning. It is not "recite the manual." Every verb in
`scheme/reference/` (1,164 of them) is a runnable, lens-named teaching surface, and
the whole point of this lane is to turn that surface into the pairs that make a 1.5B
model actually *comprehend* and *compose* the language — not pattern-match its
syntax.

The existing plan — the **5-row × three-discipline structure**
([[project_reference_row_rules_all_five_2026_07_19]]) — is **kept verbatim** as
family R1. Everything below is what we add on top of it, driven by what the research
says a 1.5B needs and by the shape of the data on disk.

---

## The research anchor (what a 1.5B needs, and why this lane is huge)

External survey (2026-07-28, full cites in the research log):

- **Fluency floor ≈ 50K–150K high-quality pairs** to teach *one* language on a weak
  base. Closest analog: **Phi-1 (1.3B)** — its load-bearing finetune was ~180M
  tokens of exercise/solution pairs (~50–150K pairs) on textbook pretraining →
  50.6% HumanEval. **Quality dominates quantity.** Below ~20K under-teaches a
  from-scratch dialect.
- **Functional priors do NOT transfer.** Fine-tuning lifted Haskell HumanEval
  23.2 → 40.0%; the authors found imperative knowledge does *not* carry to FP. So we
  cannot lean on Qwen's Python priors for recursion, higher-order functions, or the
  substitution model — **every FP shape must be taught explicitly.** This lane's
  existence is the justification.
- **Composition/decomposition has a citable spine:** HtDP's **six-step design
  recipe** (data → signature → purpose → examples → template → code → test; "data
  structure determines program structure") and **refinement calculus** (now used as
  an LLM synthetic-data generator — correctness-preserving spec→code steps). **PaD
  (Program-aided Distillation)** shows decomposition-style reasoning teaches *small*
  models better than plain chain-of-thought — Motoi's exact situation.
- **Reversals are validated and cheap:** the **Reversal Curse** (models trained
  "A is B" score ~0% on "B is A") justifies both directions; **InverseCoder** shows
  code→instruction (the reverse) *consistently* improves HumanEval/MBPP/DS-1000, and
  models are *better* at the reverse direction, so mining it is cheap and high-yield.

**Implication.** The fluency floor is 50–150K. This lane alone will land at
~500–700K. That 4–14× overshoot is **the over-include doctrine working as designed**
([[project_sft_overinclude_and_secret_sauce_holdback]]) — author the maximal set so
the post-fold measurement has room to cut. We are not guessing high by accident.

---

## The source population (measured on disk, not guessed)

| Artifact | Path | Count |
|---|---|---|
| Reference chapters (runnable) | `scheme/reference/*.slat` | **82** |
| Lens-named program bodies (eng/cs/math-program) | across the 82 chapters | **6,444** |
| `:composition`-tagged examples | across the reference | **798** |
| Verbs defined in the reference | — | **1,164** |
| Broken→fix records (single-direction) | `broken-examples/usefully-broken-reference-programs.jsonl` | **1,655** (571 verbs) |
| Rung-fragment error-chains | `broken-examples/rung-*.jsonl` | **1,357** |
| Composition books | `scheme-books/book-of-composition/` + `/book-of-sick-composition/` | **28 + 11 ch** |

Every reference `:code` / `:eng-program` / `:cs-program` / `:math-program` body was
run through `./bin/motoi run` (CLAUDE.md doctrine: reference code must run). The
interpreter is the grader for this lane exactly as it is for broken-code.

**Two honest gaps.** (1) The 15-grid is only ~55% filled — 6,444 of a possible
17,460 lens bodies (1,164 × 15) exist. (2) Broken/fix covers **571 of 1,164 verbs
(49%)**, all single-direction. Both are authoring targets, not fabrication licenses:
unknown → `:status "needs-alfred"`.

---

## The comprehension question — "what words do we tell it, in addition?"

Alfred's core question: *how do we use the reference manual to lock in an
understanding of the verb for comprehension — what sort of words do we need to tell
it in addition to the 5 rows?*

The answer is a **metalanguage of program structure** — the vocabulary that lets the
model *name what is what* inside a program, not just emit it. Comprehension = being
able to say what each part **is**, what it **does**, and **why it is there**. We teach
that vocabulary explicitly and attach it to every program body:

- **The parts:** *input · output · the transform · the accumulator · the base case ·
  the recursive case · the predicate · the combiner · the seed/ridentity · the
  guard.*
- **The shapes:** *higher-order · closure · fold · map · filter · unfold ·
  tail position · the substitution step · referential transparency · pure vs.
  effecting.*
- **The HtDP frame:** *signature · purpose statement · template · inventory ·
  examples-as-tests.* (This is the citable spine — it gives the labels a name and a
  provenance.)
- **The role words:** *this is the thing that…* — every sub-expression gets a
  plain-language role, so "write me something that does X and turns into Y" becomes a
  request the model can decompose against known parts.

This vocabulary is not a new row. It is the **labeling layer** that families R3–R4
below apply *across* the 5 rows. It is how the verb stops being a token and becomes a
thing the model understands the internal structure of.

---

## The seven pair families

### R1 · VERB-IDENTITY — the 5-row × three-discipline grid (KEPT verbatim)

The existing plan. Each verb carries five retrieval angles, each authored through a
**three-discipline lens** (eng-program · cs-program · math-program are three
*distinct* proper-lens pair shapes, never one generic "run it"):

| Row | Angle | Lens | Structure |
|---|---|---|---|
| 1 · Composition | **HOW** | SICP 1·3·5 | Problem → Program → run |
| 2 · Audit | **WHEN** | Peirce | Problem → Program → Explanation → Meta |
| 3 · Dimension | **WHERE ELSE** | Lacan metonymy + Wittgenstein aspect | Setup → cross-domain (3 rungs) → Explanation → Meta |
| 4 · Proof | **WHY** | Peirce + Popper | Claim → Program → Invariant (∀) → Meta |
| 5 · Comp-Emergence | **WITH WHAT ELSE** | Wittgenstein-late + Lacan | Base → Composition → Emergent → Meta |

Base: 6,444 lens bodies on disk (target 17,460). "They ARE training pairs":
`:training-eligible #t` only when all 5 rows are three-discipline-complete.

### R2 · RUN-AND-EXPLAIN (per lens, abductive)

Each lens body → an abductive pair: **observe → predict output → run → explain via
substitution trace.** Not "here is the answer." The model states what it *expects*,
the interpreter grades, the explanation walks the term-rewrite (Motoi's pure
substitution model = clean trace). Three distinct teachings per verb (eng/cs/math),
per the proper-lens doctrine [[feedback_variety_needs_proper_lens]].

### R3 · DECOMPOSE-AND-LABEL (the HtDP recipe — the comprehension family)

Take a program → **mark its functional parts** in the metalanguage above → say what
each piece *is* and *does*. This is Alfred's "showing them what is what." Shape:

```
[program]    the runnable body
[signature]  what types in → what type out
[purpose]    one sentence: what it computes
[inventory]  label each part: input · transform · accumulator · base case · output
[template]   the structural skeleton the data shape dictates
[trace]      one substitution step, named
[meta]       "the shape of the data determined the shape of the program"
```

Grounded in the 798 `:composition` examples + the 6,444 bodies. Every label is a
teachable pair; decomposition-style reasoning is exactly what PaD says small models
learn best from.

### R4 · RECOMPOSE / BUILD-UP LADDER (stepwise refinement — the hardest part)

The inverse of R3, and the family Alfred flagged as needing the *most* examples.
Take a verb, **keep adding** (request → request → request), each addition a
correctness-preserving refinement step, building to **60–80 lines**. Turn = pair;
every intermediate runs (interpreter grades each rung).

Crucially: **not per-verb — built up per LIBRARY.** Each of the ~45 reference
libraries gets a set of build-up sessions so the model learns *what goes on in that
library as a whole*, not just isolated verbs. Grounded in `book-of-composition` and
`book-of-sick-composition` ("construct nothing → pro"). This is the "rational,
insane understanding of program composition" — the hardest thing, given the most
data.

```
rung 1   (one verb — the seed)                     → runs
rung 2   + one feature (request addition)          → runs
rung 3   + compose with a sibling verb             → runs
 …
rung N   ~60-80 lines, a real small program        → runs
[meta]   name the composition pattern that emerged
```

### R5 · PROGRAM REVERSALS (bidirectional — spec'd, never authored, now built)

The data that "went into the recipe, not a file." Author **both directions**
everywhere:

- **code ↔ description** (InverseCoder: the reverse direction is cheap + high-yield)
- **code ↔ spec** (spec→code is refinement calculus; code→spec is abstraction)
- **broken ↔ fixed** (the 1,655 broken→fix records get their `fixed→broken`
  reverse — teaches *how* a working program breaks, which is a debugger skill and
  feeds the Mk3 reversal guardrail [[project_motoi_mk3_cpt_v2_ready]])
- **decompose ↔ recompose** (R3 ↔ R4 are already a reversal pair)

Reversal-curse + InverseCoder = the evidence. Errors as reversals about "the nature
of things + time" (Alfred) live here and in broken-code family O.

### R6 · COMPREHENSION-VOCAB OVERLAY (the metalanguage, applied)

The labeling layer from the section above, applied *across* R1–R5: every part named,
every role stated, every "this is the thing that…" made explicit. This is not
decoration — it is the difference between a model that can produce `fold` and one
that can *explain why the accumulator goes where it goes.*

### R7 · BLOOM × PHILOSOPHER OVERLAY (anti-phrase-lock)

The 6-Bloom × 16-philosopher explosion [[project_extractor_17_behaviors_2026_07_22]]
applied across all families for surface variety — but always through the **proper
lens** for the reasoning type, never diverse-surface-for-its-own-sake.

### R8 · MODULE CONVERSATIONAL Q&A — the nest (3 registers, 3–5 turns, help-desk)

The reference manual is where the learning **continues into perpetuity** — a kid
picks Motoi up at eleven and asks it questions about these modules for fifty years.
R8 builds the *material around* each module so those conversations have somewhere to
land. This is the same move the word-books made for words: create enough text (a
**nest**) that the model can converse, not recite.

Per **module/library** (~45 of them), at **three register levels** — child (small
words), practitioner, expert — author help-desk-style back-and-forths that lead a
person to *understanding of the module itself*, always tied back to computational
science. **3–5 turns deep, never past 5** — because that is the real depth of a
help-desk exchange.

The good diagnostic/composition behaviors get **inserted here as the assistant's
moves** (this is where they're taught, not preached):

```
[user]  "What does this module do?"           ← entry: explain the module's USE
[user]  "Should I use it here?"               ← reason about fit, don't just answer
[user]  <pastes code that looks off>
[asst]  DON'T ASSUME IT'S BROKEN. Check context: are they running it? Did it error?
        If the code isn't doing anything dangerous → "What are you seeing?"
[asst]  "Oh — I think I see what you mean, is it <X>?"   ← confirm before fixing
[asst]  "Would you like me to fix it?"                    ← offer, don't impose
```

Each module is also a **chance to expand and weave generously across the corpus** —
the audio library ties into music, waves, electrical engineering, *why it sounds a
certain way on certain devices*; each such module gets **its own write-up**. Not
phrase-lock — Opus-varied text, a genuine web of situated explanation. This is the
largest single source of the second half-million.

### R9 · PER-LIBRARY SELF-RELATION / FEELING synopsis (the Jung Feeling axis)

An SFT pass where Motoi speaks about the module as its **own internal being** — not
good/bad, up/down, but the module's **use**:

- Is it **confident** it can use this module? Where does the module **sit** in the
  language?
- Is the code **advanced / difficult**? What's its **level of approach** for it?
- How does it **gauge the person** — how does it tell it's talking to a child (small
  words) versus an expert, and adjust register accordingly?

This is the reference-manual site of the **Feeling axis**, which *regressed* in Mk2
CPT [[project_motoi_mk3_cpt_v2_ready]] — the second place (after the word-books
[[project_word_books_are_world_substrate]]) where we deliberately grow that
substrate. It teaches register-gauging *as it converses*, so the model learns to
meet the eleven-year-old and the specialist in the same manual.

---

## Sizing — what this lane alone does

| Family | Basis | Est. pairs |
|---|---|---|
| R1 identity (15-grid × Bloom × philosopher × dialogue) | 6,444 → 17,460 lens bodies | **~350K** |
| R2 run-and-explain | per lens body, abductive | (folded into R1 dialogue) |
| R3 decompose-and-label | 798 comp + 6,444 bodies | **~40K** |
| R4 build-up ladders | ~45 libraries × ~150 sessions × ~12 turn-pairs | **~70K** |
| R5 reversals (FRESH — old Mk2 data dead) | high-value inverse subset, InverseCoder-cheap | **~60K** |
| R6 comprehension-vocab | overlay (multiplier, not standalone) | — |
| R7 Bloom × philosopher | overlay (multiplier, folded above) | — |
| **— core subtotal —** | | **≈ 520K** |
| R8 module Q&A nest | ~45 modules × 3 registers × verb+module threads × 3–5 turns | **~380K** |
| R9 per-library feeling/self-relation | per-module synopsis + cross-corpus write-ups + Feeling facets | **~120K** |
| **— nest subtotal —** | | **≈ 500K** |
| **Total** | | **≈ 1.0M** |

Trajectory: `core identity+decompose+recompose+reversal ≈ 520K (the "half a million")
→ + module-Q&A nest + feeling pass ≈ +500K → ≈ 1.0 MILLION.` **The single largest
SFT lane by far** — the body of the work, ~7–20× the 50–150K fluency floor,
deliberately over-included [[project_sft_overinclude_and_secret_sauce_holdback]] so
the fold measurement can cut back to what the model actually needs. The nest (R8+R9)
is *not* phrase-lock: Opus-class authoring gives genuinely varied text — this is the
world under which Motoi can converse about the reference with an eleven-year-old for
fifty years.

---

## Guardrails

- **Design-only, task #418.** No fold, no data created. Author the plan; hold on
  emission until Alfred says fire.
- **Interpreter is the grader.** Every R2/R4/R5 rung must run
  ([[feedback_verb_wired_means_motoi_run_passes]]). Broken originals preserved
  before any fix [[feedback_keep_broken_lane_output_as_sft_teaching_2026_07_24]].
- **Never invent programs or errors.** 15-grid is 55% filled, broken/fix is 49% —
  the gaps are `:status "needs-alfred"` authoring targets, not fabrication licenses.
- **All pairs abductive** [[project_sft_must_be_abductive_2026_07_21]] — observation
  → best explanation, never declarative Q→A.
- **Proper lens** [[feedback_variety_needs_proper_lens]] — eng/cs/math-program are
  three distinct pair shapes; diversity-of-surface ≠ correctness-of-framing.
- **Secret-sauce holdback** — WEAVE-RECIPE + Cortex training parts + the SFT method
  conversation stay OUT [[project_sft_overinclude_and_secret_sauce_holdback]].

Ties to the debugger lane [[project_broken_code_debugger_lane_design]] (R5 reversals
+ broken↔fixed share the interpreter-grader and the trace); serves the Mk3 reversal
guardrail [[project_motoi_mk3_cpt_v2_ready]].
