# 02 · Broken-code / Errors — the SFT walk

**2026-07-28 · design-only · no fold · no data created**

This is the lane #2 plan that was missing. The four flat shapes in `assess.py`
(broken→why→fix · family-contrastive · error-sig→did-you-mean · lesson) were
correct but **transactional** — single-turn. Alfred's ask was always richer: the
error surface must be **exploded into dialogue**, taught through the **three
Peirce inferences**, wired to **two RAG surfaces** (error-RAG + language-RAG over
the Cortex), given **words** (working-narration so it isn't purely silent), and
made **Darwinian** (error-evolution, no-lock-in). This doc captures all of it.

Everything here rests on the doctrine [[project_broken_code_as_runtime_signal]]:
**build the WRONG SINK, not a right-ranker.** We teach the model to eliminate
wrong and keep diversity among rights; Motoi's own intelligence picks the survivor.

---

## The source population (measured on disk, not guessed)

| Artifact | Path | Count |
|---|---|---|
| Curated per-verb broken cards | `scheme/reference/broken-examples/*.slatl` | **12** |
| Preserved usefully-broken programs | `scheme/reference/broken-examples/usefully-broken-reference-programs.jsonl` | **1,655** |
| Rung fragments (freevar / deadsurface / residue) | `scheme/reference/broken-examples/rung-*.jsonl` | **1,357** |
| Error-family cards | `scheme/reference/error-cards/*.slatl` | **11** |
| Throw-site harvest (normalizer key-space seed) | `scratch/error-throwsite-harvest-2026-07-27.txt` | **189** |
| Reasoning-about-errors notes | `scratch/self-census-roster-and-lesson-2026-07-27.md`, `scratch/appendix-I-deductive-error-introspection.md` | ~52 metrics + 6 patterns |

The census engine is live: `normalizeError` → error-key → `stats/error-count-of`
in `lib/system/verb-stats.js`. Every error-card `:trigger-code` was run through
`./bin/motoi run` and reproduces its `:observed-output` verbatim — the cards are
**grounded in actual runtime behaviour**, not a brochure of what Scheme "should"
do. That is what makes the interpreter our grader.

---

## The seven pair families

### A · FIX-IT PAIRS — the spine (go through ALL the broken code)

**"You were supposed to create fix-it pairs."** Every broken program becomes a
multi-turn abductive fix-it conversation. Turn = pair. Each fix-it conversation
demonstrates four things Alfred named explicitly:

1. **that the code CAN be fixed** (the fix runs — `:motoi-run-passes`),
2. **WHERE to find the behavior** (point to the verb's reference chapter / the
   error-card / the line — this is the locate move, not just "here's the answer"),
3. **WHY it was broken** — the *specific* fault named, in words:
   *the parenthesis*, *the unbound symbol*, *the fuel ran out*, *the arg-order*,
   *the wrong library* — never a generic "it errored,"
4. **the generalized lesson** (specific fix → the rule it teaches).

Worked shape (one broken program → one fix-it dialogue):

```
[symptom]   "This won't run — what's wrong?  (reduce - '(3 1 2))"
[abduce]    "reduce takes (op ridentity list). You passed a list where the
             binary op goes. Candidate: wrong arg-order, or wrong verb."
[locate]    "See reference · SRFI-1 · reduce — its signature is
             (reduce f ridentity list). fold has a different order again."
[why]       "It broke because '(3 1 2) landed in the op slot; reduce tried to
             call a list as a procedure → not-a-procedure."
[fix]       "(reduce + 0 '(3 1 2))  ;=> 6   — runs."
[lesson]    "Arg-order is the whole game in the fold family. When in doubt,
             name the slots before filling them."
```

- Applies across **3,012** preserved broken programs (the mass) + the **12**
  curated cards (rich, carry the 3-library contrast in-schema).
- **Do NOT store the breaking code by authorial intent.** Classify by the one
  question the interpreter answers: *does this run?* An error is not noise — it
  is "a logical event with a name and a cause." The card is keyed to the fault,
  not to who wrote it or why.

### B · READ-THE-ERROR PIPELINE — the operational loop

**"How to read the error, understand the error, write the error to the error
log, reason about it, and fix it."** This is the runtime loop taught as dialogue,
one pair per stage:

```
READ      raw thrown text arrives      → capture it verbatim
UNDERSTAND normalizeError → error-key   → what this KIND means (the error-card)
LOG       write to the census          → stats/error-count, error-first-seen,
                                          error-by-verb  (Family B, verb-stats.js)
REASON    deductive vs inductive        → is this a FACT? is this COMMON?
FIX       back into family A            → the graded repair
```

- Base: **189** throw-sites (each normalizes to a key) + **11** error-family
  cards. Each throw-site → a short read→understand→log→reason→fix conversation.
- The LOG stage is first-class: the model learns that an error is **written
  down**, not just handled — the counter is where the facts live
  ([[project_broken_code_as_runtime_signal]], self-census Family B).

### C · LOGIC-OVER-ERRORS SWEEPS — deduction · abduction · induction

**"Do logic and reasoning with the thing — deduction, abductions, induction with
all these errors. Give me some sweeps of that with error types."** The Peirce
spine (`04-scheme-books-walk.md:664`) applied directly to the error surface,
swept across every error TYPE:

- **DEDUCE the error** (rules → necessary consequence). From the typing/binding
  rules, *prove* why this is wrong. `unbound-symbol ≡ a false proposition`;
  `fix-landed ⟸ had-error ∧ bound-now` (appendix-I §I.3). Certainty, not guess —
  **a caught error IS a fact** (`guard` turns it into a value you can assert on).
- **ABDUCE the error** (observed wrong result → best-explanation cause). This is
  SPOT-REASONING-IN-ERROR: symptom → the faulty step that best explains it. The
  engine of family A's `[abduce]` turn.
- **INDUCE over errors** (many cases → general pattern). The census frequency:
  "unbound symbols are common here" — evidence, not proof. Includes literally
  *generating* broken variants (induction as construction), `provisional→real`
  promotion, and the **zero-count fallacy** (appendix-I §I.5): a zero count
  proves "none escaped over the runs on disk," NOT "cannot happen" — and
  `(/ 1 0)` returns `+inf.0` silently, so the wrong happens without throwing.

Sweep grid = **{deduce, abduce, induce} × error-types**:
unbound-symbol · not-a-procedure · fuel-exhausted · TypeError · RaisedValue ·
reader/expand-time · silent-non-errors · arg-order · wrong-library-family.

### D · RAG-OVER-ERRORS — two surfaces, over the Cortex

**"You have to teach it how to do RAG over the errors… correlate that with things
inside of the language itself — language RAG, essentially… RAG over the Cortex
and errors."** Three retrieval reflexes, all honest-`#f` when nothing clears the
floor:

1. **Error-RAG (the wrong-sink as retrieval).** On throw, retrieve by
   **error-signature + code-shape** → the matching error-card, the did-you-mean
   nearest verb, the nearest past fix. "Retrieve by key, steer away on suggest"
   (error-cards README). This is the wrong-sink made a lookup.
2. **Language-RAG.** Correlate the error with the **language surface itself** —
   not just "does this run? oh, a paren error, understood," but *paren error →
   the reference chapter on syntax*; *wrong verb → that verb's reference card*;
   *wrong-library → the R5RS/R6RS/SRFI contrast card*. The error becomes a door
   INTO the reference manual. This is the correlation Alfred called "language
   RAG."
3. **Cortex-RAG (SuperRAG over the graph).** Retrieve across Cortex **and**
   errors together — seed (token/vector top-k) → walk relation-edges 1–2 hops →
   personalize → preference-weight + gate ([[project_reasoning_cortex_scheme_compression]],
   RAG-SYNTHESIS). Teaches **when to run things in the background** and how to
   decide, rather than answer blind.

### E · WORKING-NARRATION — words that go WITH fixing (not purely silent)

**"Three different lenses of responses for error types… including dialogue for
when it's doing something so it's not purely silent. 'Just one second, finishing
up real quick. Let me just add this function.' That sort of language — it doesn't
go INTO errors, but it comes OUT of the idea of fixing."**

This language is not in the error data; we **author** it, because it falls out of
the premise that *code before it runs is often broken*. When the model is mid-fix
it should narrate lightly instead of going dark:

- *"One sec — that threw an unbound-symbol, let me wire the missing define."*
- *"Running that in the background; give me a moment."*
- *"Almost — the fuel ran out on the first pass, tightening the recursion."*

Three **response lenses per error type**, so it can *continue the conversation
about the error it is having* at the register that fits (kid-seed / layperson /
PhD, [[project_kid_seed_domain_extrapolate_asymmetry]]). Distinct from — and the
complement of — the **silent-if-trouble** safety floor (#105,
[[project_broken_code_as_runtime_signal]]): silent when in *trouble*; lightly
narrated when merely *working*. The two must be taught as different situations so
the model doesn't confuse "busy fixing" with "must stay silent."

### F · DARWINIAN / ERROR-EVOLUTION — grade, store, salt; no lock-in

**"Darwinian choices, error evolution, all those things need to be put into
that."** The cortex learning from [[project_reasoning_cortex_scheme_compression]]:

- **Grade-store-salt.** A fix is graded by the interpreter (does it run?), the
  survivor is stored under the error-key, and the store is *salted* (perturbed)
  to keep diversity — we never freeze one canonical fix.
- **Negative-selection, no lock-in.** The wrong-sink eliminates *wrongs*; among
  the *rights* we keep diversity — "none is canonically valid." A monotonic mind
  that keeps an old conclusion after a contradicting retrieval is itself
  *reasoning in error* (non-monotonic / belief-revision, `04:44`).
- **Error-evolution.** The census promotes `provisional→real` as evidence
  accretes; the sink grows; fixes compete and improve over time. The model learns
  the surface is *living*, not a fixed table.

### G · FAMILY-CONTRASTIVE + LESSON (kept from the original four)

Retained from the flat plan, now feeding the dialogues above: **R5RS / R6RS /
SRFI same-idea-three-libraries** (the 12 cards carry this in-schema — `fold-left`
R6RS acc-first vs `fold` SRFI-1 elem-first vs `foldl` Racket) and
**lesson-generalization** (specific fix → general rule, GLUCOSE-style). These are
no longer standalone single-turns; they surface as the `[locate]`/`[lesson]`
turns inside families A–C.

---

## The debugger — the spine under all of it (what Alfred named)

The through-line: **errors and their nature change over time.** New error types
accrue; the model can't have memorized them. The one thing it can always do is
**retrace the code, trace the evaluation steps, localize the fault, and reason
about what's going on.** That is the deliverable — a *debugger*, not an
error-lookup table. Everything below serves it.

The single most evidence-backed debugger pair-shape in the literature
(NExT · Self-Debug · Reflexion · HtDP algebraic stepper): **trace-grounded,
expected-vs-actual delta, localize-before-fix.** NExT roughly *doubled* repair
pass@1 (23→49%) and generalized to inference with no trace present — the trace
grounding is doing the work, not extra chain-of-thought. Motoi has two advantages
those papers lacked: (1) a **pure substitution model** — the trace is a clean
term-rewrite sequence, not messy imperative variable-state; (2) its **own
interpreter as an automatic pass/fail grader** for the NExT-style self-training
filter (keep only fixes that actually run).

### H · RICH PER-ERROR EXPLANATION — two lenses, chop-able

Each error family carries **two authored rich explanations** the LLM chops into
many (Alfred: "a rich scheme explanation… it can then chop into multiple… a very
rich computer science explanation… tie back to ideas in the book of computer
science"):

1. a **rich Scheme explanation** — what the evaluator actually does (binding
   lookup, `apply`, reduction, the reader);
2. a **rich CS explanation** — the *same* fault as a computer-science idea, tied
   to a real chapter of the book of computer science.

Error → `book-of-cs-curriculum/` anchor (real chapters on disk):

| Error family | Scheme lens | CS-book anchor |
|---|---|---|
| unbound-symbol | environment / binding lookup | `appendix-e-a-metacircular-evaluator` (env model) |
| not-a-procedure · wrong-arity | `apply`, the operator slot | `appendix-e…`; `ch15-the-machine-underneath` |
| fuel-exhausted · non-termination | recursion w/o base case, TCO silent | `08-complexity-and-limits`; `appendix-d-reasoning-limits` |
| structural · unexpected-eof · close-paren | the reader / parser | `10-compilers-…`; reference reader chapter |
| TypeError · not-a-pair | cons cells, tag checks | `01-arrays-and-lists`; `appendix-g-hindley-milner-type-inference` |
| division-by-zero · silent `+inf.0` | IEEE float, silent non-error | `ch15-the-machine-underneath` |
| index-out-of-range | bounds | `01-arrays-and-lists` |
| fuel / call-stack depth | the stack | `02-stacks-and-queues`; `ch15` |
| wrong-library-family | parts registry, R7RS/SRFI | the stdlib parts (SRFI-1/13/125/27) |

Each rich explanation is authored ONCE against the 11 error-cards, then **chopped**
into 3 registers × N slices. No new errors invented — grounded in the cards.

### I · THE SUBSTITUTION-TRACE DEBUGGER — localize before you fix

Every broken program → a **stepper-trace** dialogue (a *second*, distinct shape
from Family A's abductive fix; both run over the 3,012 programs):

```
[intent]   restate what the code is trying to do
[trace]    substitution-reduce step by step, citing each intermediate form
[delta]    name the exact reduction where actual ≠ expected
[locate]   two-stage: region → the s-expression subterm; and DEFEND
           *why this subterm and not its neighbors* (the failing-vs-passing contrast)
[classify] name the fault kind (unbound / arity / type / structural / fuel)
[fix]      minimal repair
[verify]   continue reducing to the value — it runs (interpreter grades it)
```

HtDP algebraic stepper + NExT trace-grounding, fused. **Localize-before-fix is
load-bearing**: the target must point at a location and *defend the pointing*
before it patches — never jump straight to a diff.

### J · MULTI-REGISTER DIALOGUE + PEDAGOGY + LESSONS

People ask a *lot* about errors. So: **many PhD, many layperson, many child**
questions per error — plus a **lesson** per error and explicit **pedagogy**:

- the **hypothesis-construction cycle** (the proven novice-debugging shape,
  HypoCompass): generate 2–3 *candidate* hypotheses → pick one with justification
  → the *test* that would confirm it → fix. Teaching multiple candidates (not one
  confident guess) is the load-bearing move;
- **read-the-message-and-act-on-it** — parse each part of the raw error text,
  because prettier messages alone change nothing (Denny et al.); teach applying
  the message in context;
- the **trace/substitution steps stay invariant across registers** — the fix is
  register-independent; only the surface explanation varies (anti-phrase-lock).
  Author the **expert register most carefully** — it degrades first.

### K · RECOVERY + KNOWING WHEN TO REWRITE

- **Recovery.** `guard` / `with-exception-handler` turns a caught error into a
  *value* ([[appendix-I]] deductive introspection). Pairs teach: catch → inspect
  the error record → decide → continue / abort / retry / fallback / degrade.
  Composes with Darwinian error-evolution (Family F).
- **When to rewrite vs patch.** The *decision itself* is taught: is this a
  **local fix** (paren, arg-order, missing define) or a **structural rewrite**
  (wrong recursion shape → non-terminating; wrong library; wrong data structure /
  algorithm family)? Tie to `07-algorithm-families` + `08-complexity-and-limits`:
  a "fix" that preserves an exponential or non-terminating shape is not a fix.
  Knowing when to throw the approach away is a debugger skill, not a failure.

### The inductive tools power all of this (Alfred: "a ton of them")

- **Error census** — `lib/system/verb-stats.js`: `normalizeError` → error-key
  across 14 families; `stats/error-counts` · `stats/error-count-of` ·
  `stats/error-summary` · `stats/error-novel`; persisted to `~/.motoi/stats.slat`;
  promotion `provisional→real` at recurrence ≥3. **This IS the induction engine** —
  frequency is *evidence, not proof* (zero-count fallacy, appendix-I §I.5).
- **Corpus-semantics miner** — `scripts/corpus-semantics-miner/mine_corpus_semantics.py`:
  the 5-mechanism inductive ladder (Hearst → author-hint → WordNet → PMI →
  deterministic) that links an error to its **language-RAG** neighbors (Family D).
- **Throw-site harvest** — `scratch/error-throwsite-harvest-2026-07-27.txt` (189
  sites) seeds the normalizer key-space.
- **book_phd_extractor** — `scripts/sft-prep/isb-sft/book_phd_extractor.py`: the
  17-behavior × 6-Bloom × 16-philosopher engine that explodes each rich
  explanation into graded dialogue.

### L · DECOMPOSITION-TO-DEBUG + the incremental-fix ladder

Motoi already understands **equivalence** and **composition** — so teach the
inverse it needs for debugging: **decomposition.** Break the failing whole into
parts you can each check.

- **Incremental-fix ladder** (Alfred's gradient): `not-working → somewhat →
  right-output → more-right-output`. Each rung is a gradeable pair (interpreter
  grades it). Then the **meta-abduction**: *tying the rungs together IS the
  debugger* — teach the ladder, then teach that the ladder itself is the method.
  From broken→fix stays *easy* and stepwise; never one leap.
- **"Run your own code and know the errors to fix it."** The interpreter is
  Motoi's own — self-run as the *first* move, read the thrown text, fix. Not a
  last resort.
- **How Scheme bugs present themselves** (the presentation tells you the stage):
  unbound at *eval*, arity/not-a-procedure at *apply*, structural at *read*,
  non-termination *silent* (TCO → fuel-exhausted, not a stack blow-up), type at
  *primitive application*.
- **Macro diagnosis** — how to know a macro is the culprit and how to check: if
  the error points at code you didn't write, suspect expansion; `macroexpand` /
  `,expand-1` one step at a time; source-map through expansion so errors point at
  the *original* source, not the expanded form.

### M · SENTIMENT + LABOR — respect the code, decompose don't delete

"**Sentiment with labor.**" Code has value because someone *labored* over it.
**Maybe a kid wrote it — deleting it is not the better option.** Deletion is the
lazy rewrite; **decomposing the problem stepwise into small, reasonable
solutions** is the respectful path and the better debugger move.

- **Limits include sentiment**, which Motoi understands. Sentiment is a real
  *limit on the rewrite decision* (Family K): don't throw away labored-over code
  just because a rewrite is easier. Ties the Wittgenstein-LIMIT / honest-null
  doctrine to an **affective** limit, and feeds the word-books **Feeling axis**
  (the axis that regressed in Mk2 CPT).

### The stack — two lessons at once (Alfred: "the stack and stack")

- **The call stack as a data structure** — `02-stacks-and-queues` +
  `ch15-the-machine-underneath`: recursion pushes frames, but Motoi's **TCO does
  not grow the stack on tail calls**, so non-termination is *silent*
  (fuel-exhausted) rather than a stack overflow. That is a distinctive Scheme
  presentation the debugger must recognize.
- **The stack trace as a localization signal** — the research's strongest static
  signal: which verb, which throw-site. The **throw-site harvest** (189 sites) is
  exactly the map from error-key → source location. A stack lesson is therefore
  both *how the stack works* (CS) and *how to read a trace to locate the fault*
  (debugger).

### N · TRACE-TO-ORACLE — the reference is the ground truth

Understanding the trace means answering **where is the code?** — my expression?
a verb I called? **could it be the module / library itself?** The escalation
ladder ends at an oracle so localization *terminates* instead of guessing forever:

```
1. my expression        (substitution trace, Family I)
2. the composed pieces  (decomposition, Family L)
3. the verb / module    (could the library itself be wrong?)
4. LAST RESORT: check against the REFERENCE
```

**The reference is canonical** (CLAUDE.md: "the reference IS the language; when
code and reference disagree, reference wins"). Decision procedure:
`behavior ≠ reference ∧ reference-is-right ⟹ it is a bug` — and it **stays a bug
until the behavior matches the reference.** This gives fault-localization a
terminal oracle and turns Family D's language-RAG (error → reference chapter)
into a *decision*, not just a lookup.

> **These concepts are taught HERE.** The broken-code lane is the canonical home
> for the debugger — trace · localize · decompose · escalate-to-oracle · recover ·
> decide-to-rewrite — not scattered across other lanes.

### O · ERRORS AS REVERSAL + TIME — rich ground for the nature of things

Errors are **rich ground for teaching reversals** — about life and the nature of
things — and about **time.**

- **Reversal.** An error is a reversal made visible: `broken ↔ fixed`,
  `cause ↔ effect`, `symptom ↔ root`, `had-error → bound-now`. Authoring each pair
  in BOTH directions (break→fix *and* fix→why-it-would-break) directly serves the
  **Mk3 reversal guardrail** (reverse-direction pairs — the weakness the CPT probe
  flagged, [[project_motoi_mk3_cpt_v2_ready]]). The wrong-sink IS a reversal
  engine: negate the wrong to reach the right.
- **Time.** The trace runs *forward in time* (step sequence); the census accretes
  over time (`provisional→real`); the incremental-fix ladder is temporal
  progression (`not-working → … → right`); before-run vs after-run are two times
  of one program. Teach the **before/after** structure — a fix is a *transition
  between two moments*, not a static fact.

---

## Revised count (over-include, turn = pair)

| Family | base | ~pairs | yield |
|---|---:|---:|---:|
| A · Fix-it (broken programs) | 3,012 | ~6 turns | ~18,000 |
| A · Fix-it (curated cards) | 12 | ~15 | ~180 |
| B · Read-the-error pipeline | 189 + 11 | ~8 | ~1,600 |
| C · Logic-over-errors sweeps | 9 types × 3 inferences | register-fan | ~1,500 |
| D · RAG-over-errors (error/language/cortex) | ~40 keys | ~15 + lang-corr | ~1,600 |
| E · Working-narration (3 lenses × types) | 9 types × 3 | scenarios | ~500 |
| F · Darwinian / error-evolution | reasoning | — | ~500 |
| H · Rich per-error explanation (Scheme + CS) | 11 fam × 2 lenses | chop ×3 reg | ~2,000 |
| I · Substitution-trace debugger (localize-first) | 3,012 | ~4 turns | ~6,000 |
| J · Multi-register dialogue + pedagogy + lessons | 9 types × 3 reg | Q + lesson | ~3,000 |
| K · Recovery + when-to-rewrite | ~30 keys | ~15 | ~1,500 |
| L · Decomposition + incremental-fix ladder | 3,012 | ~5 rungs | ~4,000 |
| M · Sentiment + labor + stack lessons | types + scenarios | — | ~1,500 |
| N · Trace-to-oracle (reference = ground truth) | ~30 keys | — | ~1,000 |
| O · Reversal + time (bidirectional break↔fix) | 3,012 | reverse-pair | ~3,000 |

### → **lane #2 ≈ 45,000–46,000 SFT pairs** (over-include)

Trajectory: stale `~1,000` (base=30) → `~11–12k` (disk-grounded flat) →
`~24–25k` (dialogue + logic + RAG + narration + Darwinian) → **`~45–46k`** with
the **debugger spine**: rich Scheme+CS explanation · substitution-trace ·
decomposition / incremental-fix ladder · multi-register pedagogy · recovery ·
sentiment-with-labor · trace-to-oracle · reversal+time. The four original shapes
were never wrong — they were **one-fourteenth** of the lane.

---

## Guardrails (in force)

- **No fabrication.** The 12 cards, 11 error-cards, 3,012 programs, 189
  throw-sites are the real substrate; author dialogue *around* them, don't invent
  new errors. Genuinely-unknown → `:status "needs-alfred"`.
- **Interpreter is the grader.** Every `[fix]` turn must run
  (`echo … | ./bin/motoi run /dev/stdin`, [[feedback_verb_wired_means_motoi_run_passes]]).
- **Keep the broken artifact.** Preserve the authentic broken input before the
  fix ([[feedback_keep_broken_lane_output_as_sft_teaching_2026_07_24]]).
- **Abductive shape** throughout — observation → best explanation, never
  declarative Q→A ([[project_sft_must_be_abductive_2026_07_21]]).
- Design-only. No fold. No data created.
