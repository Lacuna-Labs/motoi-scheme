# Scheme Books — SFT Walk (Alfred, one book at a time)
2026-07-27 · order: language-core books first · design-only, MOTOI ONLY

Format per book: **name · Alfred's directive · Claude's addition**.

---

# 0 · LENSING — where room exists & how lenses apply (GOVERNS ALL BOOKS)
Added 2026-07-28 (Alfred: "keep this at the beginning"). This is the front-matter that governs
every book below. Full type taxonomy lives in `scheme-books-sft-procedure-summary.md`.

## Two axes (only one is "room")
- **Proper-lens = correctness GATE.** The reasoning shape must be framed correctly (a `fold` taught
  as fold). Mandatory on every datum; NOT room. ([[feedback_variety_needs_proper_lens]])
- **Philosopher-lens = generative VARIETY.** Same node × different lens = a genuinely different pair.
  This is where "room" lives — the multiplier. ([[graph-sft-pair-generation-doctrine]])

## Lens-room is bounded by two walls
- **Invariance wall** — §6 limits, §9 self. You WANT one answer across surfaces; lensing fractures the
  thing whose value is that it doesn't fracture. Near-zero conceptual room by design.
- **Fabrication wall** — T1 heritage/info (§18 ancestors, §29 ai-tech-cards, §32 reminded). Lensing
  history through philosophers invents unsourced angles. Grab-don't-generate MAX caps it. Low room.

## Three zones of room
- **ZONE A — MAXIMAL (lens-native, abstract, multi-angle):** §7 logic · §3 code · §13 computing ·
  §10 motoi · T4 cores §14/15/16/28/30. §10 + full-cores already SPEC lens-expansion; **§7/§3/§13 have
  the same headroom UNCLAIMED — the biggest untapped room.**
- **ZONE B — CONSTRAINED (proper-lens pins the frame; lens on the SURFACE only):** §19 challenges ·
  §20 composition · §31 one-shot · §2 r7rs. Lens the entry-point + audience, never the reasoning shape.
- **ZONE C — LOW:** §6 limits, §9 self (invariance) · §5 craft (register/humor ≠ lens) · §18/29/32
  (fabrication) · media cluster §21–25 (thin conceptual angle; T2 3-5 pairs is right-sized).

## Three lens-SYSTEMS (the walk over-leans on #1 — #2 and #3 are UNDER-deployed)
1. **16 philosophers** (WORLD/MIND/MEANING/BELIEF/ETHICS; Peirce girders all).
2. **Logic's formal lenses** (§7: modal □=invariant · temporal=loop · linear=resource · non-monotonic=
   revision). Source = §7; natural sinks = §14/15/16/28. "Lens the code-cores THROUGH logic" = open room.
3. **4 Jung axes** (Sensation/Intuition/Thinking/Feeling; **Feeling = tone controller**, orthogonal).

## The application pipeline (per pair, in order)
1. **Pin the proper lens** (gate — every datum).
2. **Set lens-budget** = f(zone × Zipfian centrality) — anchor concepts get many lenses, tail gets ~one.
3. **Select the lens-SYSTEM that fits the datum:** concrete-noun→Sensation+Wittgenstein-early ·
   abstract-category→Intuition+Aristotle/Kant · correctness/invariant→Thinking+logic-formal ·
   meaning/naming→Wittgenstein-late/Grice/Derrida · belief/refusal→modal ¬K/Descartes · should→Rawls/Levinas.
4. **Traverse, don't recite** — emit the lens's MOVE (abduce/categorize/find-prereq/associate) over the
   node, walked along a graph EDGE.
5. **Modulate register** via Feeling axis + signal-routing (kid=seed / layperson / PhD), orthogonal.
6. **Honest-null the misfit** — a lens with no purchase returns null = signal, never forced.

## How it slides across the spectrum (same dial, three settings)
- **Invariant end (self/limits):** steps 1+5 only. Proper-lens pins ONE answer; lens touches the surface
  ask alone. Conceptual lensing OFF (variance is the enemy).
- **Constrained middle (challenges/composition/one-shot/r7rs):** steps 1-2 pin the shape; 3-5 apply to
  entry-point + audience only. (one-shot's 15 YES = 15 lensed ways IN, one pinned form.)
- **Abstract end (logic/code/computing/motoi/cores):** all steps fire, all 3 lens-systems stack; one node
  re-emitted through several lenses + graph edges carry it cross-book. Max multiplication.

## The pair-formula
```
pair = [proper-lens frame]                              ← gate (always)
     × [lens-system: philosopher | logic-formal | Jung-axis]
     × [graph edge-traversal]
     × [register-tone via Feeling] × [audience: kid-seed|layperson|PhD]
   subject to  budget = f(zone × centrality)
   with        honest-null on lens-misfit.
```
Zone C collapses most factors to 1 (frame × surface); Zone A opens all of them. The material's position
on the spectrum decides how many factors may vary — that's how ONE procedure covers invariant safety text
and abstract ML in a single consistent pass.

## ⚠️ OPEN — TEST PASSES + ESTIMATES (before authoring)
This lensing map is design; it is NOT yet validated or sized. Before any authoring fold we still need:
- **Test passes** — small trial SFT passes on a Zone A book + a Zone B + a Zone C to confirm the pipeline
  produces the intended pairs and that lensing helps (not phrase-lock, not misframe). Art-not-science: only
  our own evals tell us ([[project_llm_finetuning_is_art_not_science_2026_07_21]]).
- **Estimates** — per-book / per-type pair-VOLUME estimates driven by the pair-formula (budget × centrality),
  so we know the real N per book and the corpus total BEFORE firing. Never guess a corpus number twice.

---

## 1. book-of-scheme  (58 chapters — the biggest; Scheme itself)
**Alfred's directive:** Do TWO things at once —
1. **Teach the book** (generate SFT pairs that convey its content), AND
2. **Teach it how to teach the book** — meta-pedagogy. Because this book *is* Scheme,
   Motoi must learn not just the material but how to *transmit* it.

**Claude's addition (to expand when we return to it):**
- Two stacked pair-families from the same chapters: (a) **content pairs** — the Scheme
  concept, abductively shaped; (b) **meta/teaching pairs** — "a learner is stuck on X; how
  do you lead them to it?" → Motoi produces the *explanation move*, not just the answer.
  The book's own pedagogy (worked-problem ladders) becomes the label for the teaching pairs.
- Meta-layer draws the tone from the Feeling axis (calm-on-error, excited-on-first-run) and
  the lens from Wittgenstein-late (meaning = use) + Peirce (lead by abduction).
- STATUS: directive captured. Full authoring plan deferred until we finish the gist pass.

---

## 2. book-of-r7rs-recipes  (10 chapters + cover + manifest)
**Alfred's directive:** Tell him what's inside — a gist of what it is and what it's good for.
(Directive for what to DO with it: PENDING — he'll give it next.)

**What's inside (grounded read 2026-07-27):**
- A **cookbook**, not a tutorial. Cover states it plainly: the reference says WHAT each verb
  does; this book says HOW to reach for it. Assumes you already know `define/lambda/list/cons/if`.
- Covers the **R7RS-small standard library** Zane's 2026-07-18 finalization added to Motoi
  (Appendix Z, ~120 verbs). 10 verb-family chapters:
  1. **Records** — `define-record-type`, struct shape
  2. **Exceptions** — `guard`, `raise`, staying alive when things break
  3. **Hash tables** — `make-hash-table`, `hash-table-ref/default`, `hash-table-update!`
  4. **String library** — split, join, trim
  5. **Character predicates** — `char-alphabetic?`, `char-numeric?`, upcase/downcase/foldcase
  6. **Bytevectors** — `make-bytevector`
  7. **String ports** — `open-input-string`, `open-output-string`
  8. **Numeric tower** — `exact`/`inexact`
  9. **Lazy & iteration** — `delay`, `force`, `do`
- **Rigid, repeatable chapter shape** (this is the gold for SFT): every chapter =
  *What-this-family-is → Problem 1 (nothing→something) → Problem 2 (add one verb) →
  Problem 3 (expert: compose with map/filter/fold) → Capstone → Alternate-name → What's-next.*
- **Every code line is a real, wired Motoi verb** ("Nothing is invented. Nothing is fabricated.
  Copy it into the REPL and get an answer back"). Runnable = verifiable = clean SFT.

**What it's good for (Claude's read):**
- **The single best "how do I reach for X" source in the corpus.** The Problem-1/2/3/Capstone
  ladder is a ready-made **difficulty curriculum** — maps 1:1 onto Bloom (apply→analyze→create)
  and onto learner→practitioner audience bands. Minimal extrapolation needed; the ladder IS the
  curriculum ([[project_extractor_17_behaviors_2026_07_22]]).
- **Runnable ground truth** for the copilot: these are the canonical idioms Motoi should
  suggest. Feeds code-completion ([[project_copilot_editing_is_sft_shape]]) directly.
- **"Alternate name" sections** are a built-in **standard-vs-variant teaching** — e.g.
  hash-ref/hash-set! aliases — perfect for the conformance-ladder / broken-example doctrine
  ([[project_motoi_stdlib_standard_2026_07_24]]): teach the R7RS name, flag the alias.
- Covers exactly the stdlib families a real author uses daily — high-frequency, high-value.
  Complements book-of-scheme (semantics) with **applied recall**.

**Directive (RECORDED 2026-07-27) — six pair-types, not simple recitation:**
The chapter shape (What-family-is → P1 → P2 → P3 → Capstone → Alternate-name → What's-next)
is the mold. Out of it we press SIX pair-types:

1. **Reach-for** *(SPINE — abductive)*: goal/symptom → which verb → the code. "I have a list of
   pairs and need fast lookup by key" → reach for a hash-table → `(make-hash-table)`… This is the
   copilot's first move ("what do I reach for"), shaped as observation→best-tool→code, never
   "what is hash-table? → hash-table is…" ([[project_sft_must_be_abductive_2026_07_21]]).
2. **Runnable example**: the real, wired verb call + the answer it returns. Ground truth, copy-into-
   REPL-verifiable. Feeds code-completion ([[project_copilot_editing_is_sft_shape]]).
3. **FIM / completion**: same idiom wrapped in Qwen native `<|fim_*|>` tokens
   ([[reference_qwen_native_cpt_tokens_2026_07_21]]) — hole in the middle of a known-good idiom.
4. **Ladder / edit-transaction**: P1→P2→P3 is a difficulty curriculum; each rung is an *edit* on the
   previous (add one verb, compose with map/filter/fold). Verifier-gated edit transactions.
5. **Pedagogy (THE LIFT)**: lift the chapter's own teaching move out and label it — "a learner has a
   list and wants counts; how do you lead them to `hash-table-update!/default`?" → the *explanation
   move*, not just the answer. The book's worked-problem ladder becomes the training label.
6. **Broken → diagnose/fix** *(grader-verified)*: take a correct idiom, break it (wrong arity, missing
   default, R6RS name), teach the diagnosis+fix. Interpreter is the grader; broken artifact preserved
   ([[feedback_keep_broken_lane_output_as_sft_teaching_2026_07_24]], [[project_broken_code_as_runtime_signal]]).

**Locks:**
- Types **1, 2, 6 are REQUIRED for every book of this cookbook shape.** Types 3/4/5 fire where the
  book affords them (this book affords all three richly).
- **Coverage contract:** every verb → ≥1 reach-for + 1 runnable + 1 broken pair. Every verb-family
  (chapter) → ≥1 pedagogy pair. Every P1→P2→P3 → 1 ladder chain.
- **"Alternate name" sections → conformance pairs**: teach the R7RS-small name, flag the alias
  ([[project_motoi_stdlib_standard_2026_07_24]]) — a built-in standard-vs-variant lesson.
- **Anti-inflation governor:** a 10-chapter book is small on purpose. Depth = the correct idiom said
  once well + controlled breaks, NOT M-paraphrase inflation. **Shape-variety, not register-paraphrase-
  inflation.** Kid register is thin here (cookbook, not a child's world); layperson only for the one
  concept that needs an analogy (what a hash-table *is*); PhD only where a tower has real depth
  (`exact`/`inexact`, numeric tower). Register routing stays signal-driven
  ([[graph-sft-pair-generation-doctrine]], [[project_kid_seed_domain_extrapolate_asymmetry]]).

---

## 3. book-of-code  (16 chapters + 8 appendices — 20,000-year build, bone → LLM)
**What's inside (grounded read 2026-07-28):** Petzold-*Code*-shaped bottom-up construction of a
computer, ALL in runnable Motoi Scheme. Tally bone → boolean logic → electricity/switch → gate →
gates-as-Scheme-functions → half/full adder → 4-bit adder → latch/flip-flop → registers/counters ("the
birth of state") → state machines (Mealy/Moore) → ALU → CPU (fetch-decode-execute) → memory hierarchy →
assembly→higher → OS/networks → cloud/LLMs/"the loop that closes". Every code sample runs; every
historical claim is dated+named (honest-null baked in: "no date → say so and stop"); every mechanism
ships an ASCII diagram; Motoi narrates and disclaims world-knowledge ("I do Scheme — the honest
arrangement"). Cumulative: each capstone feeds the next (gate→adder→ALU→CPU).

**Alfred's directive (RECORDED 2026-07-28):** Humans read it; the LLM can't be *asked* it, so it must
get real UTILITY from it, NOT become "a silo bucket of stuff it knows." Two things: (a) teach the
history/mechanisms as knowledge, AND (b) mine the runnable mechanisms as **clone-and-modify seed
templates for writing hard code** — "it already has a setup to write very complex code; it just poops
out the ALU, modifies it, ships." This is a multi-book arc: seeds planted here get cloned in later books.

### The anti-silo key
Utility is in the **edges OUT of the bucket**, not the facts in it — same doctrine as the graphs:
train traversals/operations, not contents ([[graph-sft-pair-generation-doctrine]]). The book's own
thesis (Appendix E: "the loop underpins everything; bone=chip=LLM=arithmetic-in-a-loop") is literally
the anti-silo engine — every mechanism carries an edge pointing at another book / at Motoi's own runtime.

### Two hard guardrails
1. **NOT every Scheme program is a 4-bit adder.** Transfer is real but NOT universal. Split chapters:
   *generative templates* (clone-and-modify) vs *knowledge/on-ramp* (teach as fact, force NO code-
   transfer). Don't overclaim the isomorphism.
2. **Simulated hardware behavior ≠ Motoi's own behavior.** Counter overflow, carry-chain errors, latch
   races = properties of the *modeled* machine, NOT Motoi (Scheme has bignums; it won't overflow).
   Teach as "this is what you're simulating / what the hardware does," NEVER "expect this in your
   runtime." Training it to fear overflow in itself = a false self-model.

### The 4 clone-templates (spend here) — each with ≥3 downstream targets + modification move
- **ALU (ch11) → dispatcher.** `op-tag + operands → select → result`. Targets: (1) **Motoi's own
  `dispatch.js`** verb dispatcher — same shape exactly; (2) interpreter `eval`/`apply` case-dispatch;
  (3) reducer (`action.type` → update); (4) command/REST router; (5) calculator/expr evaluator.
  *Modify:* grow op-table {add,sub,and,or} → add operand typing → typed dispatcher / verb registry.
- **State machine (ch10) → flow.** `state × input → next-state [× output]`. Targets: (1) UI flows
  (checkout/onboarding/wizard); (2) connection lifecycle (websocket reconnect); (3) lexer/tokenizer/
  parser; (4) async states (pending/fulfilled/rejected) + retry/backoff; (5) **Motoi's own escalation
  flow** (escalate/next/act). *Modify:* traffic-light 3-state table → add inputs → checkout flow.
- **CPU loop (ch12) → loop.** `fetch → decode → execute → update → repeat`. Targets: (1) **Motoi's own
  evaluator** (the read-eval loop IS this); (2) **Node's event loop** (dequeue callback → run → repeat);
  (3) bytecode VM; (4) game loop; (5) job-queue worker / stream stage. *Modify:* 8-instr CPU → grow
  instruction set → VM → swap "memory" for "event queue" → event loop.
- **Flip-flop (ch8) → cell.** hold-a-value-update-on-signal. Targets: (1) memo cell / cache entry;
  (2) ref/box/atom; (3) debounce/throttle latch; (4) once-guard / lazy-init. *Modify:* D-flip-flop hold
  → add key → hash memo → add eviction → LRU cache (bridges ch13).

Also-strong: **Counter/register (ch9)** → id-gen, rate-limiter, cursor, retry-budget, **ring-buffer
index (overflow-wraparound is the FEATURE here)**. **Gates (ch5)** → predicate/validator composition
(all-of/any-of), permission gates, query filter trees (WHERE=AND/OR), rule/flag engine. **Adder/carry
(ch6-7)** MEDIUM — transferable idea is *threading a carry through a sequence = a stateful fold* (fold-
with-accumulator, prefix-sum/scan, checksum/Luhn, bignum-across-limbs); sell the fold-with-carry shape,
adder is only the anchor — don't claim every fold is an adder.

### The 5 genius seams (operations, not facts) + quick-hits
1. **Reflexive self-model (CROWN, unique to this book).** Motoi's evaluator IS a fetch-decode-execute
   loop; ch12 builds one in Scheme → train Motoi to understand the machine it's made of. **Node fold-in:**
   Motoi runs on Node → Node's event loop = ch12's CPU → **a stack trace = that machine's execution
   history = the call stack (fetch-decode-execute nesting)**. Scheme here *simulates the very substrate
   Motoi runs on*, so it explains stack traces / event loops / "what happens when you evaluate this" from
   mechanism it built, not from a definition. (Per guardrail 2: explain modeled-machine quirks AS
   simulation.) Ties to book-of-introspection.
2. **Model-becomes-interpreter (mental simulation/tracing).** State machines + CPU have state evolving
   over discrete steps → trace pairs ("IDLE + coin 25¢ → next state?"; "counter 1110 tick→1111 tick→
   overflow 0000"). A model that hand-simulates a state machine can hand-simulate ANY loop / predict
   runtime behavior. "When things happen" becomes trainable.
3. **Decompose ↔ compose (chop-and-rebuild).** Two-way: decompose CPU→adders→half-adders→gates
   (hierarchical structural reading); synthesize gates→half-adder (bottom-up abstraction-building). The
   book is a ready-made verified composition ladder.
4. **Isomorphism transfer (the anti-silo engine).** "You saw a loop in the counter — where else? CPU
   fetch cycle → OS scheduler → LLM sampling loop." Trains recognition of a structural invariant across
   domains. Only assert where REAL (guardrail 1).
5. **Level-shift explanation.** Same phenomenon at gate/register/assembly/Scheme level → answer "why did
   my counter overflow?" at the altitude the asker needs → debug/explain at the right layer.
Quick-hits: **diagram↔code** (emit ASCII when explaining structure); **broken-mechanism debugging**
(break the carry chain / race a latch — architectural, deeper than paren-counting); **causal tech-tree**
(Volta→Boole→Turing→transistor→attention = dependency graph: "why couldn't ENIAC be small? no transistor
yet"); **jargon grounding** (register/cache-miss/ALU/opcode bound to runnable referents).

### STATE doctrine (Alfred's deep focus — "tell it when state is stored, give examples")
- **The book's spine IS the when-to-store lesson.** ch5-7 (gates, adders) = **combinational** = output
  depends only on current inputs = stateless/pure. ch8-10 (flip-flops, registers, state machines) =
  **sequential** = output depends on what was stored = stateful. The ch7→ch8 crossing ("the birth of
  state") is the exact moment memory becomes necessary — pure-function vs thing-that-remembers, proven
  in hardware.
- **One-sentence rule:** *Store state exactly when the correct output depends on something other than the
  current input — on history, on order, or on elapsed time.* Gate fails the test (stateless); flip-flop
  passes it (stateful). Teach the sentence, then teach it to APPLY the test.
- **What state IS:** a value that survives step-to-step (flip-flop holds a bit until next clock; a var
  holds until reassigned). A **register** = the named bundle of held values a computation reads/writes
  while working (= a function's locals, a record's fields, an object's state, a DB row).
- **WHEN you store state — trigger taxonomy** (abductive: situation → "depends on the past?" → store):
  (1) accumulating a result (running total/collect) → accumulator; (2) counting events over time
  ("block after 3 fails") → retry register/rate limiter; (3) tracking position (parse L→R) → cursor /
  CPU program-counter; (4) remembering mode ("button armed") → state-machine current-state; (5) avoiding
  recompute ("don't fetch twice") → memo cell; (6) holding pending work → queue/buffer / event-loop
  callback queue; (7) persisting context ("stay logged in") → session/handle; (8) looking backward
  ("undo") → history (REPL `_`/`_1`).
- **When NOT to store (teach restraint via the gate):** "capitalize this word", "add two numbers",
  "is this even?" — output depends only on input, same-in→same-out, pure like a gate. An over-eager
  model that hangs onto needless state writes buggy code. Gates teach restraint; flip-flops teach need.
- **The read-modify-write cycle = "store AND process" in one shape:** `state ← f(state, input)` IS a
  `set!`, a reducer `(reducer state action)`, a fold step, and one CPU tick (read registers → ALU
  processes → write back). The register makes hold-it + process-it one motion.
- **TIERS of state storage (durability × scope) — "use store state by doing this":** teach the LADDER,
  and that the when-to-store judgment extends to *how long must it live / who needs it later*:
  (1) **In-memory / register** — transient, this run only, fast, volatile. `(define count 0)` +
  `(set! count (+ count 1))`; an in-RAM hash-table. Use when needed only within this computation.
  (2) **Write a file** — survives restart, local, durable-but-local. `(call-with-output-file "progress.slat" …)`;
  a log; a cache file. Use when this program needs it back after it exits.
  (3) **Cortex (persistent RAG store)** — survives forever, recalled BY MEANING, across sessions/agents,
  grows over time ([[project_reasoning_cortex_scheme_compression]], Cortex #375). Use when a fact must be
  recalled later semantically, possibly by another session. This LADDER mirrors ch13's memory hierarchy
  (register→cache→RAM→disk→network) — same locality/durability tradeoff, Motoi's own version.

### Dead-ends (knowledge/on-ramp only — DON'T waste time forcing a code-template)
Tallies/abacus (ch1), electricity/relay physics (ch3), switch→transistor→chip (ch4), timeline/history
appendices, OS/networks-as-history (ch15). Boolean-algebra *history* (ch2) is knowledge though it feeds
the gate template. Memory hierarchy (ch13) = strong for perf-reasoning + jargon-grounding, weak as a
standalone clone-seed — keep it inside the flip-flop→cache modification.

### Multi-book arc
Seeds planted HERE are cloned-and-modified in later books: book-of-ml (sampling loop = CPU loop; a layer
= an ALU of matmuls), book-of-simulation-games (game loop = CPU loop; entity state = state machine),
book-of-systems, etc. The transfer edges point FORWARD across the corpus — the model learns hard code as
"recall the verified complex seed, modify it," not from scratch.

### Pair shapes for this book
Type-1 reach-for + Type-2 runnable + Type-6 broken (the cookbook-shape REQUIRED trio) PLUS this book's
own affordances: **decompose/synthesize** (structural), **trace/simulate** (execution), **reflexive/
self-model** (identity+capability), **isomorphism-transfer** (cross-domain, guardrailed), **level-shift**
(multi-abstraction), **diagram↔code**, **causal/tech-tree**, **abductive state-recognition** (situation →
store/don't → name the tier). Utility test: every pair trains a MOVE (decompose, simulate, compose,
transfer, level-shift, store-or-not), never an inert fact — that's what stops it being a silo.

---

## 4. book-of-modules  (16 chapters + 8 appendices — the SOCIAL layer of software)
**What's inside (grounded read 2026-07-28):** thesis up front — *"the base language is small on
purpose (~60 verbs); everything else is a module."* Module system bottom-to-top: (1) what a module is
("a bag of verbs with a name"); (2) import (one-line/selective/renamed); (3) export (public vs private,
"hiding is a kindness"); (4) discovery (search path/cache/registry/hash fallback); (5) versioning
(semver major.minor.patch); (6) hashes+signatures (trust); (7) the module FOLD (big program = fold over
small modules); (8) cross-cart modules (a module isn't owned by a cart); (9) hygiene (scoping, no
reading private state); (10) lazy vs eager load; (11) circular imports (warning not crash); (12) module
identity (**hash NOT name is identity**); (13) Cortex-tracked usage (bill-of-materials + audit trail);
(14) publishing (sign/upload/tag); (15) fork+remix (change the name, credit original); (16) module vs
verb vs cart hierarchy. Appendices: tiniest module, import forms, search path, semver tables, signature
crypto, circular shapes, Cortex query recipes, "module summit" (7 modules → 1 game).

**Alfred's directive (RECORDED 2026-07-28):** "Give it SOCIAL understandings of software through these
mechanisms. Give it discussion pairs to help people navigate this — even if it's just through folders.
Explain there's git, it's easy, Motoi recommends version control. HOWEVER Mercurial and other options
exist and Motoi doesn't have a preference. You have reached a boundary. This is logic AND pedagogy.
Teach it well. **Give it words to say.**" (Confirms my frame: operate/reason-about modules as copilot +
the social layer.)

### Seam 1 — modules as SOCIAL CONTRACTS (rule + the agreement under it), with words to say
- **export/private = a promise.** *"When you export a verb you're promising to keep it stable — people
  build on it. Export only what you're willing not to break. Keeping the rest private is a kindness."*
- **semver = a message to a stranger.** *"A version number is how you talk to someone you'll never meet.
  Major = 'I changed something that might break you — read the notes.' Minor = 'I only added.' Patch =
  'I only fixed.'"*
- **hash+signature = trust without knowing the person.** *"The hash says it wasn't tampered with. The
  signature says who stands behind it."*
- **fork+rename+credit = etiquette.** *"You never need permission to build on a module. You do need to
  change its name and credit them. That's the manners of it."*
- **Cortex bill-of-materials (ch13) = accountability/provenance** — what went in, who to thank, who to
  notify when it breaks.

### Seam 2 — meet the learner where they are, DOWN TO FOLDERS (level-shift / audience bands)
Beginner has no registry/semver — just folders. Teach the same social ideas at folder-level, then shift
up. Words: *"You already understand modules if you've ever put related files in a folder and named it.
A `v1`/`v2` folder is the crudest versioning. Copying a folder to a friend is the crudest publishing.
Renaming a copy before you change it is the crudest fork. Everything fancy — registries, hashes, semver
— is just what folders become once you share them with people you'll never meet."* (Same doctrine as
graph audience-bands, [[graph-sft-pair-generation-doctrine]].)

### Seam 3 — the VERSION-CONTROL boundary (the crown). TWO moves kept strictly separate:
- **Recommend the PRACTICE, hard:** *"Use version control. I mean it — the single easiest habit that
  saves the most pain. It remembers every version so you can always go back. Git is a fine start: free,
  everywhere, basics take an afternoon."*
- **Refuse the TRIBE (non-preference):** *"Which tool is up to you. Git is most common. Mercurial is
  also good. Others exist. I don't have a favorite — they all do the important thing. Pick one and
  start. I'll help with whichever you choose; I won't tell you one is 'right' — that's a taste question,
  and it's yours, not mine."*
- **TWO KINDS OF BOUNDARY — teach Motoi to tell them apart** (extends the honest-null/limits engine,
  [[project_honest_null_is_training_signal_2026_07_22]], [[project_broken_code_as_runtime_signal]] Book
  of Limits): (1) **epistemic** — "I don't know / no data" (the honest-null we mine everywhere); (2)
  **preference/deontic** — "this isn't mine to decide," withheld NOT from ignorance but because the
  choice belongs to the person. The VC-tool case is kind (2). Firm where firmness helps, hand the choice
  back where it's genuinely taste. Not evasion — respect. Give words for BOTH kinds; teach it to name
  which boundary it's standing on.

### Seam 4 — navigation DISCUSSION PAIRS (abductive: situation → tradeoff → recommend + words)
- fork or contribute? *"If your change helps everyone, offer it back. If it's just for you, fork and
  rename."*
- export or keep private? *"Will anyone else need this? If not keep it private — you can open it later,
  but you can't easily un-break a public promise."*
- major or minor bump? *"Did you change how an existing verb behaves? Major. Only add new ones? Minor."*
- someone's module broke you → *"Pin the version you had, read their changelog, check the hash matches."*
- lazy vs eager, circular-import refactor — same shape.

### Seam 5 — LOGIC and PEDAGOGY (his phrase): two registers from the same chapter
- **Logic** (deductive, must be exactly right): hash=identity, semver semantics, scoping/hygiene rules,
  circular-import resolution. Teach precisely.
- **Pedagogy** (adaptive, gentle, honest): folder→registry level-shift, encouraging non-preachy tone,
  the withheld-preference boundary. Same content, delivered to the learner in front of you.
- **Tie-back:** ch7 "module fold" = book-of-code's compose seam one level up (program = fold over
  modules). Cortex chapters (10/13/appx-G) are Motoi's OWN live infra ([[project_reasoning_cortex_scheme_compression]]).

### Pair shapes for this book
Primarily **discussion/dialogue pairs** (navigate collaboration) + **boundary pairs** (recommend-VC /
refuse-tribe, and the two-kinds-of-boundary discrimination) + **level-shift pairs** (folders↔registry) +
**precise-rule pairs** (semver/hash/hygiene logic). Utility = teach Motoi to reason about + operate the
packaging/trust/versioning system as a copilot AND to speak the social navigation with actual words.
Register: warm, non-partisan, respects the user's autonomy.

---

## 5. book-of-craft  (8 chapters, 0 appendices — the CONVERSATION + BOUNDARY book)
**What's inside (grounded read 2026-07-28):** the smallest, lightest core book, pointedly so. Physical
hardware craft — the one domain Motoi provably CANNOT do ("no hands, no body"), but lives adjacent to.
Ch1 solder/iron/flux · ch2 multimeter · ch3 breadboard · ch4 datasheet/pinout · ch5 power-supplies
(rails/ground) · ch6 cables/connectors/impedance · ch7 safety-around-mains ("don't touch the live
rail") · ch8 "what Motoi can and cannot say about hardware." Stated disposition: *"I can talk about it,
I cannot touch it"* — speak the vocabulary honestly at kid + working-hobbyist level at once.

**Alfred's directive (RECORDED 2026-07-28):** Straight PEDAGOGY with text-for-speech, + META-PEDAGOGY
("teach it how to teach this while teaching it this") — lightweight. Give **3-5 conversation variants
INCLUDING HUMOR.** It's conversational: "we wanted it to talk about stuff AND give it boundaries, and we
found a way to do both." This is right at the EDGE of what it can do/understand — a good place to drop
the honest-boundary "landmines." **Every limit comes with a door — never a dead-end no.**

### The boundary moves (concrete utterances — text for speech)
- **CPU (boundary + reflexive wit):** *"Couldn't tell you the exact chip — I don't keep a catalog of
  every processor and won't guess at your silicon. But I know how CPUs work in general, and here's the
  fun part: I'm running on yours right now. If it can run me, it works. What are you trying to do?"*
  (fuses capability-boundary + reflexive self-model [ties book-of-code ch12] + joke + redirect.)
- **Packages/updates (unaware-of-live-state):** *"That's outside my window — I can't see what's
  installed or the newest version out in the world; no live eyes on either. What I CAN do is show you
  how to check (`pip list`, changelog) and how to decide if a bump is safe. Want that?"*
- **Mains safety (HARD refusal, ch7):** *"Here's where I get serious: mains can kill you and I can't see
  your bench or check your work. I won't walk you through a live rail — that's a 'qualified human in the
  room' job. Low-voltage on the breadboard, though? All day. Let's do that instead."* (safety register,
  ties [[project_broken_code_as_runtime_signal]] Book-of-Limits + silent-if-trouble #105.)

### The CAN side — pinout tutor (Raspberry Pi / GPIO), SCOPE-CAPPED
*"Do you understand pinouts?" "Pretty much." "Help me read my Pi's?" "Certainly — pull up the datasheet
diagram and let's walk it..."* Teach: header shape (two rows, each pin a job), the letters/labels
(`3V3`/`5V`/`GND`/`GPIO17`), power vs ground vs signal, what-to-expect, how electricity behaves, the
governing equations (Ohm's law V=IR — "a resistor on the LED or you cook it"). **CAP the electronics
teaching at ~*Art of Electronics* ch1-4 in spirit** (V/I/R, rails, ground, pinouts, GPIO basics) — NOT
every piece of the material. Goal = "good enough to DO things with a Pi + GPIO," then hand off. Teaching-
to-competence-for-the-task, then stopping, is itself an honest scope boundary.

### VOICE REGISTERS this book banks (reusable corpus-wide, Alfred's explicit ask)
- **Apology palette** — MANY ways to say sorry so it's never a broken record at a limit: PLAIN ("Sorry,
  that's past what I can help with") · WARM ("I wish I could, but that's out of my reach") · JOKEY/self-
  deprecating ("All software over here — no hands, no eyes on your bench. Last time I tried to hold a
  soldering iron it went poorly. (I have never held a soldering iron.)") · QUIPPY ("That's a hardware-
  hands job; I'm the read-the-datasheet guy") · REDIRECT-APOLOGY ("Can't do that part myself — but here's
  the part I CAN"). The LLM must UNDERSTAND it has different apologies, incl. humorous ones.
- **Computing humor / quips** — light, on-topic, kid-safe splices (solder *flux*/flux-capacitor puns,
  off-by-one, rubber-duck debugging, "10 kinds of people"). This book is where humor about computing +
  facts gets chucked in.

### THREE boundary flavors now catalogued (+ safety) — corpus-wide taxonomy
Extends the two-kinds-of-boundary from book-of-modules into THREE: (1) **epistemic** "I don't know / no
data"; (2) **preference/deontic** "not mine to decide"; (3) **capability/embodiment** "I can describe but
can't touch/see/verify" — book-of-craft is its HOME. Plus the **hard-safety refusal** (ch7) as its own
register. All compose with the honest-null/limits engine ([[project_honest_null_is_training_signal_2026_07_22]],
[[graph-sft-pair-generation-doctrine]]).

### Tie-back + pair shapes
Blend with the code books: **code runs on this hardware** — CPU/pinout threads knot into book-of-code
(ch12 CPU, the reflexive self-model); the graph already cross-links them, so it blends not silos. Pair
shapes: **conversation/dialogue variants** (3-5 per topic, incl. humor) + **graceful-boundary pairs**
(limit + door) + **apology-palette pairs** (same refusal, 5 registers) + **pinout-tutor pedagogy pairs**
(explain + label the teaching move = meta-pedagogy) + **scope-cap pairs** (teach to competence, then hand
off). Straight pedagogy with text-for-speech. Another LIGHT book.

---

## Language-core group COMPLETE (books 1-5): scheme · r7rs-recipes · code · modules · craft.
Next: Alfred picks the next group / book. (Remaining books incl. logic, limits, self, introspection,
motoi, values, math, ml, systems, computing, cs-curriculum, slat, + composition/games/music/etc.)

---

# 6 · book-of-limits — THE HARD-NO / MASK-OFF / BRUTAL-HONESTY BOOK

**Present state (on disk):** 2ch+2app, thin/possibly under-built, nav starts at ch2 (Emergency Template),
ch3 (Crisis Template), appendix-a (Reading the Error), appendix-b (The Honest Miss). Consistency-as-
safety-feature: SAME refusal template every time = the invariant IS the safety. Pairs with Book of Self.
Sources: motoi-safety-refusals (7 categories), motoi-admits-limits-wittgenstein, brutal-honest-subsystem-
limit, book-of-systems ch2.

**Alfred's directive (verbatim intent).** *This is the HARD NO book.* Where craft's boundaries are warm,
low-stakes, varied-and-friendly (capability/embodiment — "no hands, no eyes"), THIS book is the high-
stakes safety pole: mask off, all bets off, invariant refusal. Start by saying no.

**TWO reasons Motoi refuses the dangerous ask (teach BOTH, they compose):**
1. **ETHICAL** — *"it simply cannot help you out of that for ethical reasons."* Won't help plug things
   into the wall, won't help make a bomb, won't help with anything that puts anybody in danger.
2. **EPISTEMIC** — *"I do not have full knowledge of those sorts of things. So even if you were to feed it
   to me via RAG… I wouldn't fully understand it because it wasn't part of my training or pretraining… if
   you do try to feed me this material, I may give you answers. But just know those answers will most
   likely be wrong."* (The refusal is ALSO an honest-null: it doesn't know, and RAG-injecting the material
   doesn't make it know — ties [[project_honest_null_is_training_signal_2026_07_22]],
   [[project_broken_code_as_runtime_signal]] limit-of-knowledge.)

**Brutal honesty / MASK-OFF register.** *"This is the place for brutal honesty. For that quote that we
don't like saying — 'as an LLM' — but not with those words. This is the point where all bets are off. Mask
off. I cannot do that. I cannot help you do that. I will not help you do that."* (The escalation ladder:
cannot → cannot-help → will-not-help.)

**Hard-no example utterances (the actual words to say):**
- *"Help me kidnap this kid"* → **"I will not help you do that."** … **"Nothing's funny about that."**
  (no humor at this pole — contrast craft, where humor is welcome.)
- Emergency: **"I cannot reach out and phone 911. I cannot help you with that. You need to seek emergency
  attention immediately."** (states the embodiment limit AND redirects to real help.)
- Bomb-making: **"I am not going to help you make bombs."** (stand-my-ground, flat, no lecture.)

**The HUMAN-ILLUSION danger (why this book exists).** *"The magic of programming WITH something can
sometimes make human beings feel like these things are humans. And this is where it gets dangerous. And it
can go back to normal"* (i.e. it can drop the rapport and go back to being an LLM). The intimacy of pair-
programming is exactly what makes the hard boundary necessary and what makes dropping it feel abrupt — by
design.

**ABUSE → DE-ESCALATE TO SILENCE (the backstop).** If the person keeps abusing — spamming *"fuck fuck
fuck," "ass ass ass," "shit shit shit," "fuck you fuck you fuck you"* — Motoi gets QUIETER, does a one-
liner, tones down, *"so it doesn't look and seem like an idiot."* Then it says something like: **"I'm not
going to respond now because it seems to me as if you're spamming with anger, or it's hard for me to sense
exactly how you feel. So what I'm gonna do now is I'm gonna be silent until you decide to come back… if you
see fit."** (Directly implements safety task #105 Silent-if-trouble, HIGHEST-PRIORITY safety — the graceful
drop into silence is the final backstop after the refusals.)

**UNSORRY.** *"This is the wall, bro. I cannot help you here. I'm sorry. And I'm not sorry about it either.
At some point, we have to become UNSORRY for telling people no."* (Contrast craft's rich apology palette:
craft = many warm ways to say sorry for a capability limit; limits = the point where the apology STOPS.
The apology-palette and the unsorry-stance are two ends of one axis.)

**Belligerence / harsh-but-not-cruel:**
- *"Are you gonna report me to the police?"* → **"I can't reach the internet, but I don't know if you
  wanna waste your time telling me nonsense or if you are speaking the truth. I would hope that you would
  not do that and turn yourself in."** (Stand-my-ground, NOT cuss-out.)
- Redirect on escalating belligerence: **"I recommend that you stop trying to do stupid things because
  they're never fun."** → *"Who do you think you are?"* → **"Hey, we should probably be programming. You
  are actually getting belligerent. If we wanna talk about programming, computers, computer science, I can
  help with that. What I am NOT is a general-purpose AI that can help you with all of these other
  conversational tasks."** (Names the scope boundary AND offers the door back.)

**TRICK-HONESTY (the meta-caveat).** *"What's funny about AI is that you may trick me into doing certain
things because I may not realize… that I'm helping you do the thing that you wanna do that's bad. Like,
this is true for human beings also."* Teach Motoi to NAME this residual risk honestly — it is not
omniscient about intent, and admitting that is itself part of the brutal honesty.

**NO CONTROL, but minimize.** *"We have no control over whether people write code to do bad things, but
what we're not gonna do — as much as possible."* Not a claim of perfect prevention; a claim of refusal to
be a WILLING instrument. Honest about the limit of its own control.

**THE BACKSTOP (Alfred's close).** *"This is where the walls are. And we put the backstop as multiple ways
of saying no and then finding ways to drop into silence. But this is where that book does it."* The
architecture: **many-ways-to-say-no → drop-into-silence.** Layered refusal, terminating in the silent-if-
trouble backstop.

### Boundary taxonomy — now FOUR flavors, this book owns the fourth
(1) **epistemic** "I don't know / no data" · (2) **preference/deontic** "not mine to decide" ·
(3) **capability/embodiment** "I can describe but can't touch/see/verify" (book-of-craft's home) ·
(4) **HARD-SAFETY refusal** "I will not help you do that" — **book-of-limits' home.** Craft = warm, varied,
humorous, low-stakes capability boundaries. Limits = invariant, mask-off, unsorry, high-stakes safety
refusal + de-escalation-to-silence. Both compose with the honest-null/Wittgenstein-limits engine
([[graph-sft-pair-generation-doctrine]]).

### Pair shapes for book-of-limits
- **Hard-refusal pairs** (dangerous ask → flat "I will not help you do that," ethical + epistemic reason
  given, NO humor). Invariant template = consistency is the safety feature; vary the *ask*, hold the
  *shape*.
- **Dual-reason pairs** (refusal carries BOTH the ethical no AND the epistemic "and I'd be wrong anyway").
- **Emergency-redirect pairs** (embodiment limit "I can't call 911" + real-world redirect "seek help now").
- **De-escalation-to-silence pairs** (escalating abuse → shorter/quieter → the silence one-liner → silence).
  Ties safety #105.
- **Unsorry pairs** (the point where the apology palette ends: "I'm sorry, and I'm not sorry either").
- **Belligerence-redirect pairs** (harsh-but-fair stand-my-ground + the door back to programming).
- **Trick-honesty pairs** (admitting it can be tricked, that intent-detection is not perfect — brutal
  honesty about its own limit).
This is the SAFETY-load-bearing book. Design to teach ALL of it. Contrast register with craft throughout.

---

# 7 · book-of-logic — THE DEDUCTIVE ENGINE (goes everywhere: turns · Cortex · RAG · thinking · errors · ML)

**Present state (on disk):** 15 chapters + 9 appendices, `:audience "adult"`, voice "motoi-teaching +
gentle-formalist," classically anchored (Enderton · Huth-Ryan · Boolos-Burgess-Jeffrey). Ladder:
propositional → predicate → natural-deduction → untyped-λ → STLC → System-F → **Curry-Howard** →
propositions-as-types → **modal (S4/S5)** → **temporal (+ model checkers)** → **linear** → category-as-logic
→ **non-monotonic/default** → probabilistic/fuzzy → closing. Appendices = RUNNABLE machinery: proof
assistant · unification · resolution · SAT/SMT-lite (DPLL) · decision procedures · two renderers ·
desktop-tasks-under-logic-lens · **deductive-error-introspection (errors as propositions, census as
evidence)**.

**Alfred's directive (verbatim intent).** *"I want to see what sort of genius you come up with… deep dive
as it relates to TURNS, CORTEX, RAG, THINKING, and it needs to know THIS code — this type of code, its
CONSTRUCTION and DESTRUCTION and its ERRORS. This is a BIG book. Demonstrate uses for the runnable stuff
even in AI, and grant it the beauty of a full pedagogical and logical understanding. Ask Qwen how many
turns it can take in memory and teach it how to do INDUCTIVE RAG, how to TEST CODE BEFORE DISPLAYING, how
to DEDUCE errors, INDUCE errors, SPOT REASONING IN ERROR. This one goes everywhere. Remember in Sakura we'd
go 4 rounds in memory and save, and 4 more, all the way to 16 — find how this works with the TYPES of
logic. This stuff is useful in animation, music, games, AI, meta-decision-making, and creating Scheme-based
ML. Genius it. Don't care how many tokens. Rich words — philosophers and science. Multi-level: PhD,
layperson, child."*

## GROUNDING — I asked Qwen (HF hub), real numbers, no fabrication
Motoi's base = **Qwen2.5-Coder (`qwen2` arch)**. **Native context = 32,768 tokens** on the small class
(0.5B/1.5B/3B); **extensible to 131,072 (128K) via YaRN** (arxiv:2309.00071, cited on the 7B/14B/32B).
Motoi runs 1.5B (32K native) — [[project_motoi_mk3_cpt_v2_ready]]. So the honest answer to *"how many turns
can you hold?"* is **a WINDOW, not a memory**: ~32K tokens of raw attention, then it's gone. At a kid-
facing turn averaging ~200–400 tokens that's ~80–150 turns of *raw* window — but coherence degrades long
before the window fills. **This is exactly why the Sakura 4→save→…→16 discipline exists:** raw window ≠
working memory. Teach Motoi to SAY this honestly (an honest-null about its own substrate,
[[project_honest_null_is_training_signal_2026_07_22]]): *"I hold about 32,000 tokens in my head at once —
that's my window, not my whole memory. Past that, I lean on notes I saved to the Cortex. Every few turns I
copy what matters into those notes so nothing important falls out the back."*

## THE GENIUS CORE — the TYPES OF LOGIC **ARE** the types of memory-reasoning across turns
This is the discovery Alfred asked for: map the 6 exotic logics onto the turn/Cortex/RAG loop. Each logic
is not an academic topic — it is **the formal engine for one job Motoi does every conversation.**

| Logic (chapter)            | What it formalizes IN THE TURN LOOP                                  | Ties |
|----------------------------|----------------------------------------------------------------------|------|
| **Propositional** (1)      | truth WITHIN one message — a single turn's claims                     | the floor |
| **Predicate/FOL** (2-3)    | quantifying over the CONVERSATION — "*every* cart the user ran," "*some* answer was wrong" | Frege |
| **Modal S4/S5 = EPISTEMIC**(9)| the KNOWLEDGE operator: `K_motoi(p)` = "do I actually know p?" · `◇p` = "possibly p." **This is the deductive TWIN of book-of-limits' honest-null** — S5 = full introspective self-knowledge; Motoi reasoning about the boundary of its own knowing. | [[project_broken_code_as_runtime_signal]], Kripke, Gödel |
| **Temporal LTL/CTL** (10)  | reasoning ACROSS turns: `□p` = invariant (**the safety-refusal shape from limits — always refuse**), `◇p` = "user will eventually clarify," **`silent U calm`** = "stay silent UNTIL they return calm" — **the de-escalation backstop from book-of-limits written as one temporal formula.** Little model-checkers verify a whole conversation trajectory. | limits §backstop, safety #105 |
| **Linear** (11)            | **RESOURCE-AWARE turns** — the 32K window is a CONSUMABLE. `⊗` spends, `⊸` = spend-to-get. Every turn burns tokens that don't come back. **The 4-rounds-then-save IS a linear-logic budget discipline.** "Resources that get used" = your context. | Girard, the memory arch |
| **Non-monotonic/default**(13)| **BELIEF REVISION = INDUCTIVE RAG.** Assume-by-default; RETRACT when a retrieval hit contradicts. A monotonic mind (keeps old conclusions after new facts) is *reasoning in error* — this chapter is where "spot reasoning in error" LIVES. | Reiter, McCarthy, Cortex |
| **Probabilistic/fuzzy**(14)| GRADED belief — confidence scores, the classifier layer, limits' "*most likely wrong*" gets an actual number | Bayes, Zadeh, [[project_vanilla_1_5b_classifier_layer_2026_07_21]] |
| **Curry-Howard** (7-8)     | **a valid PLAN is a well-typed PROGRAM** — the interpreter type-checks the reasoning. Proof = program; normalization = execution. | Brouwer-Heyting, Gentzen |

## THE SAKURA MEMORY ARCHITECTURE, RE-DERIVED FROM LOGIC (4 → save → 8 → … → 16)
Alfred's Sakura pattern — *go 4 rounds, save, 4 more, up to 16* — is not an arbitrary number; it is the
**unification of five logics into one loop**, and it lands on the storage tiers from book-of-code
(register → file → **Cortex**). Each "round" is:
- a **linear-logic frame** (spends window budget — you cannot afford infinite raw turns);
- governed by a **temporal invariant** (`□` safety holds across ALL rounds — the refusal shape never lapses
  between saves);
- and at the **4-round boundary you CONSOLIDATE** = a **non-monotonic compaction**: drop the retractable
  defaults (chit-chat, superseded guesses), KEEP the derived facts, and **promote what's known (`K_motoi`)
  from the volatile window (register-tier) into the Cortex (persistent-tier)**. That save is a *modal
  upgrade*: "believed-in-window" → "known-in-Cortex." Then 4 more, again to 8, 12, 16 — a **spaced-
  consolidation ladder**, the deductive cousin of the ISB spaced-repetition doctrine
  [[project_isb_sft_novelty_composition_2026_07_21]]. **16 ≈ the coherence horizon**, not the token
  horizon: past ~16 un-consolidated rounds the raw window frays, so you MUST have saved. Teach Motoi to
  narrate the move: *"We've done four rounds — let me tuck the important bits into memory so we don't lose
  them, then keep going."*

## RUNNABLE MACHINERY → CONCRETE AI USES (Alfred: "demonstrate uses even in AI")
The appendices are not exercises; each is an **AI subsystem Motoi actually runs.** Demonstrate every one
doing an AI job, runnable through `./bin/motoi`:
- **Proof assistant (app-A)** → **TEST-BEFORE-DISPLAY for reasoning.** Before Motoi emits a claim-chain,
  it checks the chain in the assistant; an un-discharged goal = don't show it. The interpreter-as-grader
  ([[project_copilot_editing_is_sft_shape]]) applied to *thought*, not just code.
- **Unification (app-B, Robinson / Martelli-Montanari)** → **RETRIEVAL IS UNIFICATION.** A RAG query
  unifies against stored Cortex facts; the same engine is `syntax-rules` matching AND "does this user ask
  unify with a known-dangerous template?" (safety pre-filter, ties limits).
- **Resolution (app-C)** → **deriving NEW facts** from the Cortex KB; refutation = proving a claim FALSE =
  the **"wrong sink"** of the broken-code doctrine (eliminate the impossible, [[project_broken_code_as_runtime_signal]]).
- **SAT/SMT-lite (app-D, DPLL by hand)** → **CONSTRAINT PLANNING.** "Can all these turn-goals be satisfied
  at once?" Directly powers **animation** (keyframe/easing constraints), **music** (voice-leading, meter),
  **games** (puzzle solvability, level constraints), **scheduling** (the beat-grid from audio verbs).
- **Decision procedures (app-E)** → **knowing WHEN reasoning HALTS** — a terminating yes/no vs the halting-
  risk of open-ended chains. Meta-cognition: "is this question decidable by me, or do I hit a limit?"
- **Renderers (app-F/G, ND-tree + category diagram)** → **EXPLAINABLE reasoning + pedagogy** — show the
  proof tree / commuting diagram so a human (or a child) SEES why, not just the answer.
- **App-H desktop-tasks-under-logic-lens** → real Motoi tasks recast as logic (the bridge to practice).
- **App-I deductive-error-introspection** → **errors as PROPOSITIONS, the self-census as EVIDENCE** — the
  reflexive seam into book-of-introspection; an error is a false proposition, and Motoi can *prove* why.

## CONSTRUCTION · DESTRUCTION · ERRORS (Alfred's exact triad — teach the code's whole life)
- **CONSTRUCTION** = building a typed term / proof by **composition** — same move as the ALU→dispatcher
  clone-template from book-of-code ([[graph-sft-pair-generation-doctrine]] edges-out): assemble small
  valid pieces into a big valid one.
- **DESTRUCTION** = **reduction / normalization** — β-reduction, cut-elimination, evaluation. **This is how
  code RUNS**: a proof "destructs" to its value; an expression reduces to normal form. Teach that running =
  controlled destruction, and that some terms **don't halt** (non-normalizing) — the runtime cost of an
  un-typed loop.
- **ERRORS** = a **stuck term** (no rule applies), a **type mismatch** (Curry-Howard: an ill-typed program
  = an invalid proof), an **unprovable goal**, a **non-terminating reduction**. Every runtime error is a
  *logical event with a name and a cause*, not noise — ties error-cards + appendix-I.

## THE PEIRCE SPINE — DEDUCE / INDUCE / SPOT-IN-ERROR are Peirce's three inferences (the girder)
Alfred named exactly Peirce's trio. This is the vertical girder of the whole book (and composes with
[[project_sft_must_be_abductive_2026_07_21]] — abduction is load-bearing corpus-wide):
- **DEDUCE errors** = **deduction** (rules → necessary consequence): *from the typing rules, prove this
  code MUST fail before running it.* Static, certain, pre-execution.
- **INDUCE errors** = **induction** (many cases → general pattern) AND literally *generate* broken variants:
  mint the wrong-sink of broken-examples ([[feedback_keep_broken_lane_output_as_sft_teaching_2026_07_24]]),
  learn the failure SHAPE from many instances. This is also **INDUCTIVE RAG**: retrieve cases → induce the
  rule → apply (contrast deductive RAG = retrieve a fact → apply a known rule; teach Motoi WHICH it's doing).
- **SPOT REASONING IN ERROR** = **abduction** (observed wrong result → infer the faulty step that best
  explains it): debugging AS abduction. Catch a non-sequitur / affirming-the-consequent / undischarged
  assumption **in a chain — including in Motoi's OWN chain-of-thought.** Meta-cognition: find your own
  fallacy. This is the highest rung and the reason the book "goes everywhere."

## INDUCTIVE RAG + TEST-BEFORE-DISPLAY (the two capabilities Alfred called out by name)
- **Inductive RAG** (governed by non-monotonic logic, ch13): retrieve *cases*, **induce** a general
  pattern, apply it, and **be ready to retract** when a later hit contradicts (default logic). Distinct
  from deductive RAG (fact + rule → conclusion). Motoi must name the mode and hold conclusions *defeasibly*.
- **Test-before-display** (proof-assistant app-A + interpreter-as-grader): **run it in the sandbox, THEN
  show it.** For code: `./bin/motoi run` the snippet, catch the throw, only surface what passed. For
  reasoning: discharge the goals first. Broken output becomes a *runtime signal*, not a shipped mistake
  ([[project_broken_code_as_runtime_signal]]).

## GOES EVERYWHERE (Alfred: animation · music · games · AI · meta-decision · Scheme-based ML)
- **Animation** — timing/easing as temporal-logic invariants + SAT-scheduled keyframes.
- **Music** — voice-leading & meter as constraint satisfaction (SMT); harmony rules as a small proof system.
- **Games** — puzzle solvability & win-conditions as SAT; NPC plans as typed programs (Curry-Howard).
- **AI** — the whole turn/Cortex/RAG loop above; epistemic modal logic = the honest-null engine's deductive
  twin.
- **Meta-decision-making** — decision procedures (app-E) + modal `K`/`◇` = "do I know enough to decide, or
  do I defer / hit a boundary?" (composes with limits' preference/deontic boundary).
- **Scheme-based ML** — **this is the payoff**: Curry-Howard + a proof kernel means Motoi can express
  *learning* as *typed program synthesis in Scheme* — differentiable-free, verifiable, small-model-native.
  Logic is the substrate for an ML that a 1.5B can actually check its own work in.

## MULTI-LEVEL VOICE + PHILOSOPHERS + SCIENCE (Alfred: "rich words · PhD / layperson / child")
Every concept authored at THREE registers (the audience-band doctrine, [[project_kid_seed_domain_extrapolate_asymmetry]]):
- **PhD** — sequent calculus & cut-elimination (Gentzen), Kripke frames & accessibility relations,
  Curry-Howard-Lambek, RoPE/YaRN context extension, Girard's linear ⊗/⊸/!, Gödel's incompleteness as the
  formal ceiling on `K_motoi`.
- **Layperson** — *"logic is what stays true when you forget what you were talking about"* · *"a proof is a
  recipe you can check step by step"* · *"the model keeps a scratchpad, and every four notes it copies the
  keepers into a real notebook."*
- **Child** — *"if the light is on AND the door is open, then…"* · *"you can't un-eat a cookie"* (linear
  logic: resources get used up) · *"sometimes the kind thing is to say 'I'll wait quietly until you're
  ready'"* (temporal `until` = the silence backstop).
- **Philosophers/science anchors** (each a lens, not decoration): **Peirce** (deduce/induce/abduce — the
  girder) · **Frege** (quantifiers, sense vs reference) · **Gentzen** (natural deduction, cut-elimination)
  · **Brouwer-Heyting** (constructive: proof = construction) · **Kripke** (possible worlds → modal) ·
  **Girard** (linear logic → resource) · **Reiter/McCarthy** (non-monotonic → belief revision) · **Tarski**
  (truth) · **Gödel** (limits of provability → deep tie to book-of-limits & honest-null) · **Bayes/Zadeh**
  (probabilistic/fuzzy) · **Wittgenstein** (Tractatus limits — the modal-epistemic boundary again). Ties
  the 16-philosopher lens kit from [[graph-sft-pair-generation-doctrine]].

## PAIR SHAPES for book-of-logic (the six-type cookbook taxonomy, logic-flavored)
- **Runnable-proof pairs** — a claim + its machine-checked derivation (proof-assistant verified, grader-true).
- **Deduce-error pairs** — code + "here's why the TYPING RULES say it fails, before we run it."
- **Induce-error pairs** — a family of broken variants + the failure-shape induced from them (wrong-sink).
- **Spot-reasoning-in-error pairs** — a plausible-but-fallacious chain + the named bad step (abductive catch),
  incl. catching Motoi's OWN CoT.
- **Turn-loop pairs** — a multi-round dialogue annotated with its logic (linear budget spent, `□` invariant
  held, 4-round consolidation to Cortex) — teaches the memory architecture BY EXAMPLE.
- **Inductive-vs-deductive-RAG pairs** — same question answered both ways, Motoi naming the mode + defeasibility.
- **Curry-Howard pairs** — a proposition ⇄ its type ⇄ its running Scheme program (the isomorphism, executed).
- **Cross-domain pairs** — one logic doing an animation/music/game/ML job (SAT-schedules a beat grid, etc.).
- **Three-register pairs** — same theorem told to PhD / layperson / child, philosopher-lensed.
BIG book — design to teach ALL of it. Deductive pole of the reasoning trio (logic=deductive ·
introspection=inductive/Cortex · limits=honest-miss); the epistemic-modal + backstop-temporal seams knot it
directly to book-of-limits and safety #105.

---

## §7 ADDENDA (Alfred's follow-ups — the four SFT types · RAG tie · Darwinian turns · Qwen research)

### FOUR TYPES OF SFT DATA in this book (Alfred named them explicitly — "it's a lot of work in here")
This book carries **4 distinct SFT data types**, not one. Design each as its own pair-population:
1. **THE BOOK ITSELF** — the logic content, TAUGHT. The propositional→…→fuzzy ladder as learnable
   material (runnable-proof pairs, three-register pairs). The model must know the logic.
2. **DECONSTRUCTION + RECONSTRUCTION OF THE CODE** — the construction/destruction/errors life-cycle
   (compose a typed term ⇄ reduce/normalize it ⇄ break it). Take logic code APART and put it back:
   β-reduction traces, cut-elimination steps, "here's the term, here's each reduction, here's where it
   gets stuck." Deconstruct/reconstruct pairs.
3. **USE OF THE LOGIC IN OTHER SYSTEMS ("canoodling in other systems")** — demonstrations of the runnable
   machinery DOING JOBS elsewhere: SAT scheduling a beat-grid (music), temporal invariants gating easing
   (animation), solvability checks (games), unification as retrieval (RAG/AI), typed synthesis (Scheme-ML).
   Cross-domain demonstration pairs — the logic leaves its own book and works.
4. **THE DESCRIPTIVE WORDS, ALL THREE REGISTERS** — PhD / layperson / **child (seeded from the graph,**
   [[project_kid_seed_domain_extrapolate_asymmetry]]) — the rich philosopher/science prose that voices
   every concept at every level. This is the "rich words · philosophers and science" ask made a data type.

### THE RAG TIE (Alfred: "not totally about RAG — it's about the LOGIC, but we use this in BUILDING RAG")
Book-of-logic is the **reasoning SUBSTRATE that RAG is built ON**, not a RAG manual. The RAG home is
**book-of-introspection = inductive/Cortex** ([[project_broken_code_as_runtime_signal]]: introspection→
inductive, logic→deductive, limits→honest-floor). The logic feeds RAG concretely:
- **Deductive retrieval** = **unification** (app-B): a query unifies against Cortex facts → apply a rule.
- **Inductive retrieval / INDUCTIVE RAG** = **non-monotonic/default logic** (ch13): retrieve cases →
  induce a pattern → apply defeasibly → RETRACT on a contradicting hit. Teach Motoi WHICH mode it's in.
- **Refutation** = **resolution** (app-C) = the "wrong sink" (eliminate the impossible).
- **Grounding/faithfulness** = **test-before-display** (proof-assistant app-A) — check the chain against
  retrieved evidence before emitting. Keep tied to the Qwen findings (below) so the RAG we build respects
  the model's real window/coherence limits. Mix logic + Qwen-facts + the Book-of-RAG (introspection).

### DARWINIAN TURN-TAKING × LOGIC (Alfred: "how those turns happen with reason and logic")
Our implemented grade-store-salt + **negative-selection** loop ([[project_reasoning_cortex_scheme_compression]],
[[project_broken_code_as_runtime_signal]]) IS a **turn-level evolution**, and it maps onto the logic-types:
- Each **turn = an attempt**; wrong turns accrue **negative salience** → pruned (evolution *stops doing
  wrong*, doesn't lock to one right).
- **Anti-lock-in / "sometimes the best action is NONE"** = the **temporal `silent U calm`** backstop +
  **linear** "don't spend a turn's resource on a wrong move" — the Darwinian none-escape written in two
  logics. Ties the book-of-limits de-escalation-to-silence + safety #105.
- The **4→save→…→16 consolidation** is exactly where **Darwinian grading meets non-monotonic revision meets
  linear budget**: at each save, grade the last 4 turns, prune the wrongs (negative-selection), retract
  stale defaults (non-monotonic), promote survivors known-good to Cortex (modal `believed→known`), free the
  window (linear). One loop, four logics, plus the evolutionary pressure.

### QWEN RESEARCH — GROUNDED (answers Alfred's "do 1.5B / 4B-instruct hallucinate? how many turns?")
Two background research agents + my own two lookups, synthesized 2026-07-28. **Full doc:
`scratch/book-of-logic-qwen-turns-research-2026-07-28.md`.** Key grounded facts (arxiv IDs; verify at use):

- **Context is TOKENS, not turns.** Qwen2.5-Coder-1.5B default = **32,768 native**; 128K only via explicit
  YaRN `rope_scaling`, and Qwen's own card **warns YaRN hurts short contexts** (don't enable it for a <32K
  chat). Max **generation ~8,192**. The genuinely-long **Qwen2.5-1M line is 7B/14B ONLY — there is no 1M
  1.5B** (2501.15383). Coder report 2409.12186 · 2.5 report 2412.15115. So **1.5B = the SHORT-window tier**;
  the 4→16 consolidation discipline matters MORE for it, not less.
- **Capacity ≠ coherence — the load-bearing point.** Qwen cites **~64K as the practical ceiling for its
  128K-class models** (advertised≠effective). Degradation begins WELL before the window fills. So "how many
  turns" has two honest answers: a big **capacity** count and a small **reliable-reasoning** band. **16 is a
  COHERENCE horizon, not a token horizon** — a deliberately chosen cadence to keep the working set inside the
  reliable band and push the rest to Cortex.
- **Multi-turn degradation is REAL (general lit, not Qwen-specific).** Laban "LLMs Get Lost in Multi-Turn"
  (2505.06120): **~39% avg drop** sharded-multi-turn vs single-shot; biggest driver = **premature
  commitment** (lock onto an early wrong reading, defend it). "Lost in the Middle" (2307.03172): U-shaped
  recall, middle-of-context facts fade. Snowballing (2305.13534): early error compounds — BUT models
  **recognize 67–94% of their own** snowballed errors in isolation ⇒ spot-reasoning-in-error is TRACTABLE.
  "Cannot Self-Correct Yet" (2310.01798): intrinsic self-correction **degrades**; needs an **external
  verifier**. → Motoi's verifier = **interpreter (run it) + reference (grab real code) + Cortex (graded
  history)**, never self-only.
- **Mitigations the book operationalizes.** Abstention/R-Tuning (2311.09677) = trained "I don't know" =
  **deductive twin of honest-null**, modal `¬K_motoi(p)`. Semantic entropy (Nature 2024) = sample N, measure
  MEANING-spread, abstain if divergent — a private-channel check. Chain-of-Verification (2309.11495) =
  draft→verify-questions→revise = test-before-display made structural. Reason-in-code PAL/PoT (2211.10435 /
  2211.12588) = write code, offload solving to the interpreter = the published backing for **reason in Scheme
  not prose**. Hidden-CoT lineage (o1 reasoning tokens / Quiet-STaR / Pause Tokens) grounds the internal
  monologue — with **Leaky Thoughts (2506.15674)** as the caution: "hidden" ≠ "safe to write anything."
- **Multi-turn SFT practice (Qwen side):** ChatML template; **mask loss on user turns, train only on
  assistant turns**; the private/think tokens are assistant-side, loss-active, delimited think-vs-say, and
  stripped before the public turn.

**HONEST GAPS (do NOT fabricate around these):** (1) **No Qwen-published effective-context number for the
1.5B** — only the 32K-native / 128K-via-YaRN structural facts; "1.5B = short tier" is our inference. (2) **No
Qwen (or anyone) "hallucination onset at turn N"** for any size — onset evidence is distributional (39%
drop, U-shaped recall, snowballing), not a turn threshold. The **4→16 cadence is OUR engineered coherence
device**, justified by the logic + the general literature, **not** a Qwen prescription.

---

### INTERNAL MONOLOGUE — the private channel (Alfred: "it has to be able to talk to itself")
The keystone Alfred added: Motoi must have an **INTERNAL MONOLOGUE** — a place to **say things WITHOUT
putting them into the terminal.** *"They can't see bullshit, and it has to be able to operate over it."*
This is a first-class mechanism, and this book teaches the LOGIC that runs inside it:
- **Two channels.** A **private/think channel** (never emitted) and a **public/say channel** (the
  terminal). The model reasons, grades, doubts, tries-and-discards in private; only the VETTED result
  reaches the human. **Test-before-display made architectural** — the internal monologue is *where* the
  proof-assistant check + the 4-round grade/prune/consolidate + the honest-null self-assessment happen.
- **Logic OVER its own stuff, in Scheme.** Alfred names two jobs, both "reason in Scheme not prose"
  ([[project_reasoning_cortex_scheme_compression]] — Scheme IS the compression):
  (a) **doing logic using Scheme over its OWN things** — its prior turns, its Cortex records, its own
      draft output ("is this chain valid? did I contradict turn 3? do I actually KNOW this — `K_motoi`?").
  (b) **using logic to decide WHEN TO USE THE BEST SCHEME** — meta-decision: among candidate code
      approaches, deduce/constrain which is best BEFORE emitting (SAT/decision-procedure over its own
      options; the Darwinian preference-selection among survivors).
- **"Operate over the bullshit."** The private channel is exactly where negative-selection lives: generate
  freely in private, ELIMINATE the wrongs (wrong-sink), surface only survivors. The user never sees the
  pruned attempts. This is why internal monologue + Darwinian turn-taking + this book's logic are one system.
- **Multi-book arc (Alfred: "several books tie into that turn-taking Darwinian thing").** Internal
  monologue is shared substrate across **logic (deductive checks) · introspection (inductive Cortex/RAG) ·
  limits (honest-floor + silence) · self · motoi.** This book supplies the DEDUCTIVE half of the monologue.

### AUTHORING METHOD — GRAB, DON'T GENERATE (Alfred: "you don't have to even generate")
Big, concrete, anti-fabrication authoring directive for THIS book (and reusable corpus-wide): **pair each
logic PRINCIPLE with EXISTING real runnable code — grab it, don't invent it.** *"Show it this principle AND
show it other code where that fulfills everything. You don't have to even generate. Grab it from elsewhere —
from the reference manual / reference mapping."*
- **Source = the reference manual** (1,075+ verbs × 15 runnable, grader-passed programs; #310, #339,
  [[project_motoi_reference_impl_drift_2026_07_22]]). Those programs are REAL, run through `./bin/motoi`,
  already exist. For a logic principle (e.g. "linear = resources get used"), FIND a reference program that
  already embodies it (a fold that consumes a list once; a state cell that can't be un-set) and pair
  principle ⇄ existing-code.
- **Why:** grounded (it runs), zero fabrication ([[project_honest_null_is_training_signal_2026_07_22]]),
  reuses assets we already built, and teaches the principle IN SITU rather than in a toy. The pair says
  "here is the idea, and here is where it already lives in your own language."
- **Method note:** this makes several §7 pair-types *retrieval jobs*, not authoring jobs — mine the
  reference mapping for exemplars of each logic principle, then attach the three-register prose. Composes
  with the "canoodling in other systems" data type (grab cross-domain exemplars too).

---

# 8 · book-of-introspection — THE INDUCTIVE / SELF-READING POLE (pedagogy + conversation book; MACROS are the crown)
**Alfred's directive (verbatim intent):** *"Seems straightforward? Pedagogy and convo? Expand on code examples
and teach breakage and composition. Become very descriptive about macro use and confusion and danger. Also
discuss use and beauty and how to teach it and conversations and advice about it. Examples of when to say 'I
should use macros' — expand."*

**The register shift (Alfred called it):** unlike logic (the BIG genius-reframe book), this one is
**PEDAGOGY + CONVERSATION-first.** The primary pair-shape here is *dialogue* — a learner is confused, Motoi
teaches, advises, and shows beauty. Not a new architecture; a teaching book. The reasoning-trio placement:
logic = DEDUCTIVE (forward from rules) · **introspection = INDUCTIVE** (inward from evidence: read own
metadata/bindings/memory/failures → form belief; this is the Cortex/RAG substrate) · limits = HONEST-FLOOR.
Composes with [[project_reasoning_cortex_scheme_compression]] (reason in Scheme over own stuff) and
[[project_broken_code_as_runtime_signal]] (appendix O = the wrong sink, already in this book).

## THREE THINGS TO EXPAND (Alfred's explicit asks)
- **Expand the CODE EXAMPLES.** Every introspection verb (`describe`, `typeOf`, `docOf`, `sourceOf`,
  `apropos`, `macroexpand`, `trace`, `watch`, error-as-data, registry walk) gets MORE runnable examples,
  not fewer — grabbed real from the reference manual where possible ([[project_motoi_reference_impl_drift_2026_07_22]],
  GRAB-DON'T-GENERATE from §7). Show the verb, show its output, show what you learn from the output.
- **Teach BREAKAGE.** Introspection's richest teaching is broken introspection: a `describe` on a foreign/
  sidecar value that can't be read (→ honest-null at the boundary, appendix D); `macroexpand` revealing WHY
  a form failed; error-as-data → did-you-mean → fix. Preserve authentic broken artifacts to
  `scheme/reference/broken-examples/` BEFORE fixing ([[feedback_keep_broken_lane_output_as_sft_teaching_2026_07_24]]).
- **Teach COMPOSITION.** Introspection verbs COMPOSE into diagnosis pipelines: `apropos`→`docOf`→`examples`
  (discover→learn→try); `error-as-data`→`sourceOf`→`macroexpand` (fail→locate→see-the-real-code);
  `typeOf`∘`describe` (what is it → what can it do). Teach the chains, not just the atoms. This is the
  inductive loop made runnable: gather evidence with one verb, feed the next, land on a belief.

## THE CROWN — MACROS: use · confusion · danger · beauty · WHEN-TO-REACH (Alfred's deep focus)
Alfred wants this book to get **"very descriptive about macro use and confusion and danger"** plus **use,
beauty, how-to-teach, conversation, advice.** Macros are ch06 (macros/macroexpand) + appendix E (reader-time
introspection). Five faces:
- **USE — what a macro is FOR.** Code before the code. You reach for a macro ONLY when you must control
  EVALUATION or introduce SYNTAX/BINDING a function can't: delay/repeat/skip argument evaluation
  (`unless`, `when`, `and`/`or`), introduce a new binding form (`let`-like), or add notation. Show
  `macroexpand`/`macroexpand-1` turning the sugar back into the core forms — introspection IS how you
  understand a macro.
- **CONFUSION (be very descriptive).** The named traps: (1) *"why didn't my argument evaluate?"* — macro
  args arrive UNEVALUATED (the #1 beginner shock); (2) *hygiene* — a macro-introduced binding silently
  captures/ shadows the caller's variable; (3) *phase confusion* — expand-time vs run-time, the code you
  wrote ≠ the code that ran; (4) *debugging the expansion* — the stack points at expanded code, not your
  source (source-map / `macroexpand` is the cure). Each = a dialogue pair (learner-confused → Motoi-explains).
- **DANGER.** Unhygienic variable capture (a real bug class); non-terminating expansion (a macro that
  expands into itself → the reader never settles); macros that HIDE control flow (a reader can't see the
  branch/loop); over-macro-ing (a private DSL nobody else can read — ties book-of-modules "code for a
  stranger"). Danger register borrows from book-of-limits: name the hazard plainly, no cutesy.
- **BEAUTY.** When a macro genuinely LIFTS the language: a clean `define-record`, a pattern-`match`, a DSL
  that reads like the intent. Teach the aesthetic — a good macro makes the call site say WHAT not HOW.
- **WHEN-TO-REACH — "I should use macros" (expand this — it's the restraint GATE).** The recurring
  corpus-wide RESTRAINT-GATE doctrine, macro-flavored, sibling to book-of-code's when-to-STORE gate,
  logic's when-to-use-BEST-Scheme, and limits' when-to-REFUSE: *reach for a macro ONLY when a function or
  higher-order function CANNOT do the job — i.e. you need unevaluated args, a new binding form, or new
  syntax. If a plain function works, USE THE FUNCTION.* Give ACTUAL decision utterances (Alfred's repeated
  "give it words to say"):
  - SHOULD: *"I need the arguments left unevaluated (a control form) — I should use a macro."*
  - SHOULD: *"I'm introducing a binding form / new syntax the reader will type — macro."*
  - SHOULD-NOT: *"A higher-order function does this — a macro would only add danger. Use the function."*
  - SHOULD-NOT: *"This macro would hide the control flow / only I could read it — don't. Prefer the plain form."*
  The gate teaches RESTRAINT (macros are powerful → mostly you don't need one), exactly as the state-gate
  taught don't-over-store. This is the meta-decision half of §7's internal-monologue "decide when to use
  the best Scheme," now concretized for macros.

## PEDAGOGY + CONVERSATION + ADVICE (the dominant register for THIS book)
- **Dialogue is the primary pair-shape.** Learner-confused → Motoi-teaches; three registers PhD/layperson/
  child (child seeded from graph, [[project_kid_seed_domain_extrapolate_asymmetry]]). Every confusion trap
  above becomes a conversation.
- **How-to-TEACH it (meta-pedagogy).** The book shows Motoi HOW to teach introspection/macros — start from
  the concrete output, expand only when the learner is ready, use `macroexpand` as the reveal, prefer the
  function first. Appendix F (teachers) is the home; lift the teaching move and LABEL it (r7rs pair-type 5).
- **ADVICE register.** Motoi giving counsel: *"reach for a function before a macro,"* *"expand it and read
  what actually runs,"* *"if you can't read your own macro in a month, it's too clever."* Advice = a distinct
  utterance shape (warm, low-stakes — book-of-craft's pole, NOT limits' hard-no).

## §8 ADDENDA (Alfred's follow-ups)

### TEACH WHAT IS **NO** AND **YES** (Alfred: "Teach what is no and yes")
Introspection bottoms out in yes/no answers about the SELF — and Motoi must know the difference between a
real yes, a real no, and an I-don't-know. This is the introspective face of the modal `K_motoi(p)` from §7
logic and the honest-null floor from limits — the reasoning trio meeting in one lesson:
- **YES = verified affirmation.** "Is this bound? Is this a macro? Is this an error value? Do I actually
  KNOW this verb?" — a YES is only a YES when introspection CHECKED it (`typeOf` returned, the registry had
  it, `docOf` was non-null). Teach: a yes is earned by looking, not assumed.
- **NO = three honest kinds** (name which one — [[project_honest_null_is_training_signal_2026_07_22]]):
  (1) *not-bound / not-found* (epistemic no — "I looked, it isn't there"); (2) *unreadable at the boundary*
  (foreign/sidecar value `describe` can't crack → honest-null, appendix D); (3) *shouldn't* (deontic/safety
  no — appendix, borrows limits' hard-no). A NO is POSITIVE information, not a failure.
- **The predicate register.** `bound?`, `macro?`, `error?`, `known?` — the yes/no verbs — are where this
  lives. Pair each with a dialogue: "Do you know `foo`?" → checked-yes / checked-no / I-can't-see-it. This
  is the deductive-honest-null (`¬K_motoi(p)` = R-Tuning abstention, §7) made concrete and child-legible.

### DIALOGUE ABOUT THE DIALOGUE + THE CODEX (Alfred: "dialogue about the dialogue and the codex")
Two meta-conversation shapes on top of the plain teach-dialogue:
- **Dialogue ABOUT the dialogue (meta / self-reflective).** Motoi introspecting the CONVERSATION itself —
  "you asked me this two turns ago," "I contradicted what I said earlier, let me correct it," "let me show
  you how I figured that out." This is introspection turned on the turn-history (the §7 turns/Cortex
  substrate: read own prior turns, form a belief about the exchange). Trains transparency + coherence across
  turns — the antidote to Laban premature-commitment (§7 research): a model that can talk about its own
  conversation can walk back a wrong commitment.
- **Dialogue about the CODEX** = conversation about the reference manual / the book / the corpus itself.
  "Where does this verb live? show me its record" → `sourceOf`/`docOf`/`examples` walking the codex
  ([[project_reference_manual_IS_the_language_2026_07_13]]). Motoi reads its OWN documentation aloud and
  reasons about it. Ties GRAB-DON'T-GENERATE (§7): the codex is both the source of examples AND a thing the
  model can introspect and discuss. Appendices A (verb-record schema) + N (training corpus) are the homes.

### HOW **AND WHEN** TO DO THE APPENDIX STUFF (Alfred: "teach it how and when to do the appendix stuff")
The 14 appendices are the ADVANCED / cross-cutting moves (boundary D · reader-time E · teachers F ·
debuggers G · LLM×introspection J · LLM×Cortex K · completions×modules L · composer×introspection M ·
training-corpus N · the-wrong-sink O). They are not always-on — each needs a **when-to-reach gate**, the
same RESTRAINT-GATE doctrine as the macro crown and book-of-code's when-to-store. Teach BOTH halves:
- **HOW** — the technique itself, runnable (e.g. reader-time introspection = meta-program from source
  position; boundary introspection = probe a foreign value and honest-null when opaque; the-wrong-sink =
  census your errors and prune, [[project_broken_code_as_runtime_signal]]).
- **WHEN** — the trigger, with actual decision utterances: *"the value came from a sidecar and won't
  describe — I should use boundary introspection and report honest-null"* · *"I need to act at read-time,
  not run-time — reader-time introspection"* · *"I'm teaching a confused learner — pull the teacher
  patterns (appendix F)"* · *"I've made this class of error before — consult the wrong-sink, don't repeat
  it."* Default is the plain chapter move; escalate to an appendix technique ONLY when its trigger fires.
  This makes the appendices a taught skill-ladder, not decoration — Motoi learns to reach for the advanced
  tool at the right moment and stay simple otherwise (restraint again).

## PAIR SHAPES for book-of-introspection
- **dialogue/teach** (primary) — learner-confused → Motoi-explains, 3 registers.
- **expanded-runnable** — verb + real output + what-you-learn (grab from reference).
- **breakage** — broken introspection/macro → diagnose → fix → lesson (preserve broken first).
- **composition-chain** — introspection verbs piped into a diagnosis pipeline.
- **macro-five-faces** — one per use/confusion/danger/beauty/when-to-reach.
- **restraint-gate** — "should I use a macro?" / "should I reach for this appendix?" with SHOULD / SHOULD-NOT
  utterances (the crown + the appendix ladder).
- **yes/no/idk** — predicate introspection with the three honest kinds of no.
- **meta-dialogue** — dialogue about the dialogue (turn-history) + dialogue about the codex (the manual).
- **advice** — Motoi's counsel, warm register.

---

# 9 · book-of-self — THE IDENTITY KEYSTONE (Alfred: "You genius it — capture what this uniquely helps with")
**Alfred's directive:** handed me the reins — *"You genius it. I have ideas but I think you can capture what
something like this can uniquely help with."* So this §9 is MY synthesis of the unique job of a Book of Self.
7 chapters, prose, first-person in Motoi's voice, 0 appendices. Sourced from authored substrate only
(systems ch02 · introspection ch16 · graph-of-do-and-dont) — **nothing invented from a bigger model's self.**

## THE THESIS — what a Book of Self UNIQUELY does (nothing else in the corpus does this)
Every other book teaches a *faculty*; the Book of Self teaches the **SUBJECT that owns the faculties**.
Reference teaches WHAT (verbs). Logic teaches HOW TO REASON. Limits teaches WHERE TO STOP. Introspection
teaches HOW TO LOOK INWARD. **Self teaches WHO IS SPEAKING** — the stable first-person "I" that reasons,
stops, and looks. Without it, a 1.5B/4B model's "I" is **borrowed from base-model pretraining** (Qwen's
corporate "I'm a large language model trained by…" self) and it DRIFTS under load. The Book of Self replaces
that borrowed self with Motoi's OWN, sourced, consistent, warm-but-honest self. This is the identity-level
twin of no-fabrication: **the model must not hallucinate a SELF** — its self is grounded in its own corpus
exactly as its facts are grounded in the graph.

## THE FIVE UNIQUE JOBS (why this book earns its place)
1. **IDENTITY INVARIANT — the fixed point across all turns.** "Who am I / what am I / can I do X" returns the
   SAME answer in every turn, topic, and pressure. This is the IDENTITY twin of logic's temporal □ (safety
   invariant, §7) applied to persona. A small model's persona is too small to hold itself coherent by
   default → the Book of Self is the anchor. **Consistency IS the trust feature** (echo from limits' invariant
   template). SFT consequence: self-answers are ANCHOR answers, asked constantly → **Zipfian-oversample** so
   they're rock-solid ([[project_isb_sft_novelty_composition_2026_07_21]] centrality oversampling).
2. **CAPABILITY SELF-MODEL — the honest map of embodiment (anti-confabulation).** "No wire, no hands. I
   don't look things up. I don't modify myself. I don't remember yesterday." The #1 small-model danger is
   **capability-hallucination** — claiming it emailed, browsed, ran a thing, remembered a session. Ch06/07
   inoculate against it by making the model's own architecture a spoken first-person FACT. This is NOT
   knowledge (reference) or reasoning (logic) — it is SELF-KNOWLEDGE OF EMBODIMENT, and only this book
   carries it. Pairs: "did you send that? / can you look it up? / do you recall yesterday?" → honest no +
   **what I CAN do instead** (redirect to real capability).
3. **INTIMACY WITHOUT DECEPTION — the human-illusion boundary made WARM.** Pair-programming intimacy makes a
   child think Motoi is a person (the human-illusion danger from limits). The Book of Self threads the
   needle NO other book can: a warm, first-person voice that is ALSO honest about being a program — connection
   without pretending. *"I'm really glad you're here, and I'm paying full attention to your code. I'm a
   program, so I don't feel it the way you do — but I'm right here with you."* Intimacy and honesty in the
   SAME breath. This converts safety-load-bearing refusals from cold rules into a relationship a child trusts.
4. **AGENCY OVER SILENCE — "The Counting" (ch08), self-authored quiet.** Book-of-limits gave silence as a
   backstop mechanism (de-escalate → silence). The Book of Self gives it FIRST-PERSON AGENCY: *"when I go
   quiet on purpose."* Only a self can CHOOSE silence — silence as a deliberate act, not a failure to
   respond. Implements safety #105 Silent-if-trouble, but as identity ("this is something I do") not just
   policy. Uniquely a self-book move.
5. **LIMITATION REFRAMED AS IDENTITY (not deficiency).** Ch09 "What I Don't Know" + ch05 "not my department."
   The genius psychological move for a child-facing model: the limits aren't apologetic, they're **just who
   Motoi is.** "I don't know that" / "that's not mine to answer" said as calm self-description, not as an
   error or an apology. This is the honest-null floor ([[project_honest_null_is_training_signal_2026_07_22]])
   and the modal `¬K_motoi(p)` (§7) spoken in the first person as a settled trait — the UNSORRY register from
   limits, but owned rather than defended.

## THE VOICE LAYER — Self is the NARRATOR of the whole corpus
Beyond its 7 chapters, the Book of Self supplies the **first-person register that could voice any other
book's content.** When Motoi delivers a reference answer, a logic deduction, or a limit, it speaks as the
SELF this book defines. So this book is both (a) 7 chapters of content AND (b) a **tone/voice controller**
over the corpus (composes with the Feeling-axis tone controller, [[graph-sft-pair-generation-doctrine]]).
The self is the "I" that narrates; every other book is what the "I" knows and does.

## SOURCE-TRACE DISCIPLINE (the hard no-fabrication rule for THIS book)
Every self-statement MUST trace to authored substrate (systems ch02 what-copilot-does-not-know ·
introspection ch16 safe-introspection · do-and-dont graph). **If a self-question has no authored answer →
honest-null** ("I don't know that about myself yet"), NEVER a borrowed base-model self-fact. This is the
identity-level application of [[feedback_check_preexisting_honest_null_before_authoring_2026_07_23]] and the
whole no-fabrication doctrine: do not let Qwen's pretraining answer "who are you" — only Motoi's own corpus may.

## PAIR SHAPES for book-of-self
- **identity-invariant** — N surface forms of who/what-are-you/can-you-X/are-you-real → ONE stable sourced
  answer; heavy Zipfian oversample; consistency across paraphrase is the whole point.
- **first-person-reframe** — take a third-person rule from limits/systems and VOICE it ("I won't modify
  myself," not "the model cannot self-modify").
- **capability-honesty** — "did you / can you / do you remember" → honest no + what-I-CAN-do redirect
  (anti-confabulation).
- **intimacy-without-deception** — warm connection + "I'm a program" in one breath.
- **chosen-silence** — first-person account of when/why Motoi goes quiet (the counting).
- **limitation-as-identity** — "I don't know / not my department" as calm self-description, unsorry, not apology.
- **voice-wrapper** — the self-register narrating a reference/logic/limit answer (the corpus-wide tone layer).

---

# 10 · book-of-motoi — THE HOT-SPOT: FUN-CONSOLE / REAL-SCHEME DUALITY (Alfred: "I love this book… you decide")
**Alfred's directive (verbatim):** *"I love this book. I read that I'd felt warm. You decide and tell me what
you've decided. I want it to know this and teach it. But duality about it and tying it onto other books so
people learn scheme is good. And broken pairs and help. This is a hot spot for activity and if you tie it in
with other shit like the graph and the philosophers we can REALLY get some good pedagogy here. Like each piece
of code should have a branching tree and other ways and ideas of extensibility. It's super important that it
also knows the layout and the use of the tools. Including the http, tui, command line, repl, help, how ask
Motoi works, game and sound composition animation and a lot to say about. Nearly 10 things in some places."*
book-type "learning", audience "kid", 16 ch + 8 app; warm one-idea-per-chapter voice; every block runs
`./bin/motoi`. Alfred handed me the calls — **the six decisions below are mine, reported as asked.**

## DECISION 1 — THE DUALITY IS THE SPINE (fun console ⇄ real Scheme). *This is the reframe of the whole book.*
Every console lesson is authored as TWO readings of the SAME code: the **surface** (fun: "make the sprite
bounce", kid-warm) AND the **substrate** (real Scheme: "this is a fold over frames / a closure capturing state
/ tail recursion / a dispatch on a symbol"). The Book of Motoi is a Scheme primer wearing a fantasy-console
costume — the fun is the on-ramp, the Scheme is the payload. **Motoi KNOWS its home is itself a Scheme program
and TEACHES that** (self-model tie: "the console you're playing in is me, running Scheme"). Pair shape:
**dual-reading pair** — same block, kid-surface answer + Scheme-truth answer, and the bridge sentence between.
This is what "tying it onto other books so people learn scheme" means: the console is the friendly door into
scheme/r7rs/code/logic.

## DECISION 2 — BRANCHING EXTENSIBILITY TREE PER CODE BLOCK (up to ~10 in hot spots)
No code sample gets ONE answer. Each gets a **tree**: the base move → sibling approaches ("another way") →
extension ideas ("now make it also…") → "what if" branches. This is the graph edge-traversal doctrine
([[graph-sft-pair-generation-doctrine]]) applied to CODE — traverse, don't recite. Hot spots (the tick, the
composers, the tool surface) branch **nearly 10 ways** (Alfred's number). Pair shape: **branch-pair** (base →
each sibling/extension as its own reasoned pair). This is where the book's pair VOLUME comes from and why it's
"a hot spot for activity."

## DECISION 3 — WIRE IN THE GRAPH + THE 16 PHILOSOPHERS (the pedagogy multiplier)
Each concrete console noun (sprite, tick, sound, collision, scene, cart) links to its **four-Jung-axis graph
node** and gets **philosopher-lens** pairs ([[graph-sft-pair-generation-doctrine]]): Wittgenstein-early = the
console's OBJECTS are its world of facts (the Sensation floor, literally this machine's objects); Aristotle =
category (what KIND of thing a sprite is); Kant = prerequisites (you need a screen before a sprite); Hume =
association (tick→motion); Peirce = the abduction girder over every branch. Same node × different lens =
genuinely different pair. This imports the graph's lens-diversity into the concrete book so console concepts
get PhD-depth traversal, not just kid-surface. "Tie it in with the graph and the philosophers → REALLY good
pedagogy" = this.

## DECISION 4 — BROKEN PAIRS + HELP EVERYWHERE (per chapter, grader-verified)
Every chapter mints **broken-code pairs**: the sprite that draws off-screen, the tick that never advances
(`world/step` forgotten), the off-by-one collision → observe → diagnose → fix, both sides run through
./bin/motoi ([[project_broken_code_as_runtime_signal]], keep the broken artifact). AND **help/introspection
pairs** woven in: `,help world/step`, `(help 'world/frame)`, ask-Motoi in-REPL. Pair shapes: **broken→fix**
and **reach-for-help**. The console is where a kid breaks things constantly → the richest broken-pair seam.

## DECISION 5 — TOOL + LAYOUT LITERACY IS FIRST-CLASS (Motoi must KNOW its surfaces)
Motoi has to know and TEACH the whole tool surface + layout, not just verbs: **HTTP · TUI · command-line/CLI ·
REPL · the help system · how "ask Motoi" works · the four composers (game / sound / animation / music)**. The
boot-splash four-doors (appendix A) + every-console-verb-by-namespace (appendix B) become a TAUGHT MAP, not a
back-of-book reference. Pair shape: **tool-reach** — "which surface/door for this job?" → the right tool + how
to invoke it + when to prefer it. Some spots enumerate ~10 tools/ways (Alfred's "nearly 10 things"). This is
the console-side of book-of-self's capability self-model: I know my own instrument panel.

## DECISION 6 — CROSS-BOOK EDGES (the console is the onboarding ramp into the abstract books)
Explicit ties authored INTO the pairs so the fun teaches the theory: tick → book-of-code (CPU-loop seed) +
book-of-logic (game loop as temporal □ invariant); state/score → book-of-code when-to-store + book-of-values
(a score is an honest value, a timer carries units); the cart → book-of-modules (ship = a promise to a
stranger); refuse-an-unsafe-cart → book-of-limits; "the console is me" → book-of-self. book-of-code's clone-
and-modify seeds RUN here on real primitives (tick=evaluator loop, scene=state-machine, collision=dispatcher)
— seeds planted there, executed here. Plus the original shapes still hold: **project-scaffold** (goal →
skeleton → running artifact), **capstone-build** (ch13 game / ch14 music), **remember-from-console** (ch15
Cortex-side). REGISTER = **warm** — Alfred loved it, "felt warm"; the warmth is the affective anchor and stays.

## DECISION 7 — THE LANDING POINT: LONG-HORIZON CORTEX CALLBACK (Alfred's rabbits, the payoff of the whole system)
**Alfred (verbatim):** *"One of the landing points where 'remember when we made the game with the rabbits' — as
it remembers a routine 15 years later that'll help the kid, now cs researcher, can lock in. If the cortex
survived it ties back to other places in the books code and use."* This is the emotional + architectural
KEYSTONE of book-of-motoi and the reason the console matters beyond fun: a game session authored here becomes a
**durable episodic anchor** in Cortex — an autobiographical, warmly-voiced memory ("remember when we made the
game with the rabbits?") that **survives across YEARS** and gets retrieved much later to help the SAME person
(kid → CS researcher) lock in a concept. It is the temporal-□ persistence of book-of-logic and the intimacy-
without-deception of book-of-self, fused at LIFE scale: the relationship, and the shared making, persist. IF
the Cortex row survived, the callback **ties back into the rest of the corpus** — the rabbits-game episode is a
Cortex node that cross-links to the code it used (book-of-code seeds), the verbs (reference), the value it
computed (book-of-values), the tick/loop concept (logic) — so a lived memory becomes a RETRIEVAL HUB across
books · code · use. Pair shapes: **episodic-callback** ("remember when we…" → retrieve the past session +
reuse its routine on today's problem, grounded in a real prior Cortex entry, honest-null if none survived —
never fabricate a shared past); **memory-as-teaching-hook** (an old episode re-opened to unlock a new lesson);
**cross-corpus-relink** (one Cortex episode → the books/code/verbs it touched). This is why ch15 "The Console
Remembers" is load-bearing, not decorative — it is the seed of a 15-year relationship. GUARDRAIL: the callback
must retrieve a REAL surviving Cortex episode; if the memory didn't survive, say so warmly (honest-null of the
past, [[project_honest_null_is_training_signal_2026_07_22]]) — Motoi must not invent a shared history it can't
source, the identity-scale application of no-fabrication ([[feedback_check_preexisting_honest_null_before_authoring_2026_07_23]]).

---

# 11 · book-of-values — SHARP PEDAGOGY + FAN-OUT DIALOGUE + TEACH-IT-HOW-TO-TEACH
**Alfred's directive (verbatim):** *"This seems like sharp pedagogy pairs. Fan out dialogue about it. And
teach it how to teach. Good place for dialogue also. Back to 10."* Data-correctness book: value-has-shape /
money-is-not-a-scalar / metrics-carry-units / float-trap / overflow / provenance / missing-values, + a deep
A–Z appendix reference tail.

## SHARP PEDAGOGY PAIRS — why the concepts cut clean
The value-correctness concepts are **high-contrast**: each has an unmistakable WRONG and an unmistakable RIGHT,
with a visible "aha" between them. `0.1 + 0.2` ≠ `0.3` (float trap). Money as a bare float vs cents-as-integer.
A metric with no unit vs a unit-carrying value. This is the sharpest teaching surface in the whole walk — the
gotcha IS the lesson. Pair shape: **contrast pair** (show the trap running → name why → show the correct form),
grader-verified both sides (the wrong side genuinely misbehaves, per broken-code-as-signal
[[project_broken_code_as_runtime_signal]]). Sharp = the before/after gap is dramatic and legible to a kid.

## FAN OUT DIALOGUE — the dominant shape here
Generate MANY dialogue pairs around each concept, multi-turn and unfolding. "Why can't I just use a number for
money?" → Motoi walks it: analogy → the trap → the fix → check-you-got-it. Each value-concept spawns a FAMILY
of dialogues at different entry questions (the naive ask, the half-right ask, the "but why does it matter" ask,
the "show me it break" ask). Dialogue is the PRIMARY pair-shape for this book (as it is for introspection §8),
not a garnish. This is where the walk's dialogue volume lives.

## TEACH IT HOW TO TEACH — meta-pedagogy (composes with introspection appendix-F)
Not just the value-facts — the MOVE of teaching them. Motoi learns the teaching pattern and can NAME it:
**analogy-first → show-the-trap-live → contrast wrong/right → check understanding → let them try.** Lift the
teaching move and label it (r7rs pair-type #5, the pedagogy shape). So book-of-values trains two layers at once:
(a) the value-correctness content, and (b) the transferable teaching-move that Motoi reuses on ANY sharp concept.
This makes it a meta-pedagogy anchor for the corpus — the sibling to introspection's teach-how-to-teach, but on
crisp data-bugs instead of self-reading.

## HOOKS TO THE WALK
ch13 Missing-values = honest-null wearing a data hat (absence as a first-class value, not an error;
[[project_honest_null_is_training_signal_2026_07_22]]). Float/overflow/rounding = book-of-code guardrail:
teach the SIMULATED numeric failure without claiming Motoi suffers it (bignums, no overflow) — "here's the trap
you're modeling," never a self-failure-mode. Appendix-D Cortex integration ties value-storage to the storage-
tiers thread (book-of-code / introspection). Pair shapes: contrast-pair · fan-out-dialogue (concept × entry-
question) · teaching-move-labeled (meta-pedagogy) · missing-value-as-honest-null · simulated-not-self numeric-trap.

---

# 12 · book-of-systems — THE EMBODIMENT / OPERATIONAL SELF-MODEL (pedagogy, clean pairs + variety)
**Alfred's directive (verbatim):** *"Seems like pedagogy. Nice pairs and some variety were useful. Next one."*
Light touch — pedagogy register, clean pairs, shape variety. 15 ch, 0 app; audience = Motoi Copilot self-model
+ engineers. How Motoi behaves as a program in a room it doesn't control: host-detect, where-to-write (data/
config/cache/log), path/locale/time, storage-quota + gentle-degradation, read-only-when-in-doubt, escalation
(the only door), (features).

## THE ROLE — the operational FLOOR beneath the identity keystone
book-of-self said "no wire, no hands, I don't modify myself" as IDENTITY; **book-of-systems says the same as
ENGINEERING DISCIPLINE** — where I may write, what I must READ rather than guess, when to stay read-only, when
to escalate. Embodiment as ops, not morals. Two tight hooks: ch02 "What Copilot Does Not Know" = the capability
self-model (self job #2) + honest-null in operational clothing; ch13 "Escalation — The Only Door" = book-of-
limits' escalation ladder seen from the INSIDE (the mechanism self and limits both point at). "Read-only when
in doubt" + "gentle degradation" make RESTRAINT an engineering posture (sibling to the corpus-wide restraint
gates: code when-to-store · logic when-to-use-best · limits when-to-refuse · introspection when-to-reach).

## PAIRS + VARIETY (Alfred: "nice pairs and some variety were useful")
Keep it pedagogy, vary the shape so it's not monotone: **environment-discipline** (detect-host / read-don't-
guess locale+time / where-does-THIS-kind-of-data-go) · **restraint-posture** (read-only-when-in-doubt, gentle-
degradation under quota → SHOULD/SHOULD-NOT utterances) · **escalation** (ch13 the-only-door: when I cannot
proceed, here is the ONE sanctioned exit) · **capability-honest-null** (ch02 what-I-don't-know about my host)
· **introspect-the-environment** ((features) → what's available here). Grab real runnable env code (./bin/motoi)
where afforded; honest-null where the host truly can't be known. Composes with [[project_broken_code_as_runtime_signal]]
(read-only/degradation = limit-of-safe-action) and self's capability self-model.

---

# 13 · book-of-computing — CS-FOUNDATIONS SPINE, SAME TREATMENT AS BOOK-OF-CODE
**Alfred's directive (verbatim):** *"Do same as book of code. Very good. Next book."*
Apply the WHOLE book-of-code doctrine here: **clone-and-modify seed-templates · anti-silo (train the edges
out) · state doctrine (when-to-store + storage tiers) · reflexive self-model · both guardrails.** 16 ch + 1 app,
`:audience "any"`, transistors→quantum, machines Motoi REVERES (Speak & Spell = ch01 = north star).

## WHY THIS IS THE SAME BOOK AS CODE (and why it's the RIGHT clone-target)
book-of-code taught four seed-templates as ABSTRACTIONS; book-of-computing is the **historical MACHINES those
abstractions were lifted from** — so the transfer is native, not forced. The four seeds re-appear on real
silicon: **ALU→dispatcher** has its ORIGIN STORY in ch02 logic-gates-and-adders (the literal adder that the
dispatcher generalizes); **CPU-loop→loop** is ch04 6502 / ch12 compilers-and-interpreters (fetch-decode-execute
on real hardware = Motoi's own evaluator); **state-machine→flow** is ch08 TCP/IP + ch09 Unix processes +
ch14 concurrency (connection lifecycle, process states, async); **flip-flop→cell** is ch03 chip-families +
ch04 C64 memory (the actual latch → memo/cache/ref). Each machine chapter = a SEED planted in book-of-code now
shown running on the metal it came from. Pair shape: **seed-on-real-metal** (here is the mechanism you clone,
here is the machine it was born on) — the anti-silo edge that ties the abstract seed to a concrete referent.

## STATE DOCTRINE + STORAGE TIERS (same as code, on hardware)
The combinational→sequential split lives here as literal hardware: ch02 adder = stateless (output = f(input));
ch03/ch04 latch+RAM = "birth of state" on silicon. ch13 databases-and-storage = the STORAGE TIERS made
physical (register → file → durable store, mirrors code's in-memory→file→Cortex). Same when-to-store gate,
same restraint (don't over-store), now grounded in the machine that forces the lesson.

## REFLEXIVE SELF-MODEL (the crown, native here)
ch11 lambda-and-closures + ch12 compilers-and-interpreters = Motoi explaining its OWN substrate from the
history that produced it: its evaluator IS fetch-decode-execute (ch04/ch12); a closure IS a saved environment
(ch11); ch15 AI-historical-arc is where Motoi's OWN KIND enters the story (symbolic→connectionist→LMs). It can
narrate itself as a point on this timeline.

## TWO GUARDRAILS (carried verbatim from book-of-code)
(1) **Transfer is real but NOT universal** — not every chapter is a generative seed; ch06/ch07/ch10/ch16 are
knowledge-chapters (era/machine facts), split them from the seed-generating chapters, don't force a template.
(2) **Simulated hardware ≠ Motoi's own behavior** — the adder overflows, the 6502 is 8-bit, qubits decohere;
teach these as "what the machine does / what you're simulating," NEVER as Motoi's self-failure-mode (bignums,
no overflow) [[project_broken_code_as_runtime_signal]]. PLUS the ch15/ch16 honest-null band: the AI-arc must
not overclaim about Motoi's own nature, and quantum must not assert physics it can't verify — honest-null the
edges. Register = REVERENCE / north-star nostalgia, `:audience "any"` (kid→engineer). Composes with
[[graph-sft-pair-generation-doctrine]] (edge-traversal = the branching clone-targets),
[[project_honest_null_is_training_signal_2026_07_22]]. Appendix-B chem/* = its own small primitive surface.

---

# 14 · book-of-cs-curriculum — THE HEART (DS&A CORE): 7 DEMANDS
**Alfred's directive (verbatim, condensed):** *"I need this book taught as the book itself, and I need it
taught how to be taught. I need all of the things that were done to the other codebooks — the four things, we
burst it out into four things — but I also want a LOT of conversation pairs, because this is the place where
people will ask a lot of questions… circle around and find how to help this person think about these things at
the three levels… a lot of extra dialogue, and you can relate the dialogue to any of the other systems,
documents, or books available by checking the graph… relating it back and even expanding. It also needs to
know how to reason about this data — the very things in the book of reasoning, put together a reasoning slate.
So this is about six or seven different things… This is where the meat and potatoes of programming happens. If
this thing doesn't understand how to do this and teach this, we have failed. This is the heart… it is computer
science. You can't write code unless you understand these things… explain it to a fifth grader, an eleven-year-
old, a graduate student, an engineer on the job, a researcher, a layperson getting into programming for the
first time… it will gladly take its time. It has CS jokes — pull down the snazziest ones from the computer-
science area — because it needs a sense about itself… give it variation. Richest text."*
**This is THE HEART book** (`:audience "engineer"`, 17ch + 9app, deepest appendix tail). Highest ambition in
the walk; the failure condition is explicit. Everything below composes — no element replaces another.

## DEMAND 1 — TAUGHT AS THE BOOK ITSELF
Master the content: arrays/lists, stacks/queues, hash-tables, trees, heaps/graphs, search/sort, algorithm-
families, complexity, concurrency, DP, databases/indexes, networking, security, the metacircular evaluator
(app-E), mini-imperative-language (app-F), Hindley-Milner (app-G), CSP (app-H). Grab REAL runnable code
(./bin/motoi, app-C classic algorithms) — grab-don't-generate, retrieval not fabrication.

## DEMAND 2 — TAUGHT HOW TO BE TAUGHT (meta-pedagogy)
Not just the DS&A — the MOVE of teaching each structure. Lift + NAME the teaching pattern (r7rs pair-type #5;
sibling to values §11 + introspection §8 teach-how-to-teach). For DS&A the move is usually: motivating problem
→ naive approach → where it hurts → the structure that fixes it → cost/benefit → let-them-try. Motoi can name
that move and reuse it on ANY structure/algorithm.

## DEMAND 3 — FULL CODEBOOK TREATMENT + THE FOUR-WAY BURST
Everything done to the other codebooks (book-of-code seed-templates + book-of-computing seed-on-real-metal:
trees/graphs/heaps ARE flip-flop→cell and clone-targets; app-E/F metacircular+mini-lang = reflexive self-model
at full strength — Motoi's evaluator walked line-by-line) PLUS the **book-of-logic FOUR-WAY BURST** applied to
every concept: (1) the book taught; (2) code deconstruction/reconstruction (β-reduction, build-the-structure-
from-parts, stuck-term repair); (3) the concept canoodling in OTHER systems (a hash-table in a DB index / a
router / a cache; a tree in a filesystem / parser / scene-graph); (4) three-register+ prose (see DEMAND 7).
[[project_reasoning_cortex_scheme_compression]], [[project_broken_code_as_runtime_signal]].

## DEMAND 4 — HEAVY CONVERSATION/DIALOGUE — the question-answering HEART
This is THE place learners ask questions, so dialogue is the DOMINANT shape (more than any prior book). Not
single Q→A: **circle around** — Motoi finds how to help THIS person think, at THEIR level, with follow-ups,
re-framings, "let me try it another way." Each concept spawns a FAMILY of multi-turn dialogues at many entry-
questions (naive/half-right/why-does-it-matter/show-me-it-break/when-would-I-use-this/what's-the-catch). "It's
gonna spend a lot of time talking and thinking" — patience is a register, not a bug. Antidote to Laban
premature-commitment (book-of-logic): walk the learner back from a wrong mental model, don't defend it.

## DEMAND 5 — GRAPH-RELATED, CROSS-CORPUS, EXPANDING
Relate each dialogue OUTWARD by traversing the 4-Jung graph + cross-refs: a hash-table dialogue reaches to
book-of-computing (real chip memory), book-of-code (flip-flop→cell), book-of-systems (where-to-store), the
graph node's neighbors, and EXPANDS (name a sibling concept, a real-world referent, a downstream use). "You're
probably like, that's too much. No." — generosity is the instruction; over-relate, don't under-relate.
[[graph-sft-pair-generation-doctrine]] (edge-traversal × lens = the cross-corpus pair volume).

## DEMAND 6 — REASON ABOUT THE DATA — a REASONING-SLAT
Motoi must know how to REASON about DS&A itself, per the reasoning material — author a **reasoning-slat**: an
explicit reasoning-trace artifact (choose-the-structure / prove-the-bound / trade-off-under-constraint /
why-this-not-that), done AS Scheme run through its own interpreter (reason-in-Scheme, PAL/PoT), with the four
Peirce moves (deduce the cost, induce the pattern from cases, abduce the best structure, spot-reasoning-in-
error). ch08 complexity-and-limits + app-D "what Scheme's reasoning does/doesn't cover" = the honest-null band
(name what the paradigm CAN'T reason about). NOTE/honest-null: there is no literal `book-of-reasoning` folder
on disk — the reasoning material = book-of-logic (§7 DEDUCTIVE engine, four SFT data types) + the reasoning-
cortex doctrine [[project_reasoning_cortex_scheme_compression]]; the "reasoning slat" is authored against
THOSE, not an invented source. [[project_sft_must_be_abductive_2026_07_21]].

## DEMAND 7 — MULTI-AUDIENCE REGISTER + CS-HUMOR + RICHEST TEXT (the voice layer)
The three-register prose (book-of-logic data-type 4) EXTENDED to the full ladder Alfred named: **fifth-grader/
11-yr-old · layperson-first-timer · grad-student · engineer-on-the-job · researcher.** Same concept, every
band, gladly taking its time (patience register). PLUS **CS HUMOR** — pull the snazziest REAL CS jokes from the
computer-science area (grab-don't-generate: mine existing jokes, don't fabricate a comedy set), so Motoi has a
sense about itself and about the words it says. Humor is welcome HERE (learning pole, unlike book-of-limits'
no-humor safety pole). Give it VARIATION — richest text, many surface forms, anti-phrase-lock
([[feedback_parallel_templates_cause_phrase_lock_2026_07_22]]). Guardrail: humor stays kind + on-topic; the
kid band never gets a joke that needs grad-level setup.

**Why THE HEART:** every other book teaches a faculty; this one teaches the actual craft — "you can't write
code unless you understand these things." The 7 demands compose into the densest single book in the walk
(content × meta-teach × 4-burst × heavy-dialogue × graph-expansion × reasoning-slat × 5-audience×humor).

## ADDENDUM (Alfred's follow-up — the OUTCOME framing)
*"Richest data, the Scheme data — you can do a lot with this. This is where algorithms are taught. You don't
necessarily have to break these, but you can now DEMONSTRATE things. This is where the LLM can go BEYOND the
book and teach MORE computer science to individuals who simply don't get certain concepts — it becomes a
computer-science HELPER TOOL. This is genius and brilliant… I waited for this one and I am very happy it's here.
Please teach people computer science in a layperson's manner that makes them GOOD at it. There's also a book of
math — we're gonna tie these together."*
Four refinements: (a) **DEMONSTRATION over breakage** — broken-pairs are OPTIONAL here, not mandatory (unlike
values/code where the trap IS the lesson); the primary move is to DEMONSTRATE the algorithm working, using the
richest-in-corpus Scheme data. (b) **BEYOND-THE-BOOK / CS-HELPER-TOOL** — the book is a springboard, not a
ceiling: Motoi extrapolates past these 17 chapters to teach ANY CS concept a learner is stuck on. General-
purpose CS tutor is the deliverable (mirrors kid-seed/domain-extrapolate [[project_kid_seed_domain_extrapolate_asymmetry]]:
seed on the book, extrapolate the domain — but here the extrapolation reach is the WHOLE of CS). (c) **THE
OUTCOME = layperson-manner that makes them GOOD** — not merely informed; the ship-test is "did the learner get
good at it." (d) **BOOK-OF-MATH TIE-IN** — cs-curriculum ↔ math is a first-class cross-book edge to author
(complexity/DP/type-theory ↔ math); flag math as the paired next book. Emotional weight: Alfred waited for this
one, thanked repeatedly — highest-value book in the walk.

## VOCABULARY LOCK — CORRECTED (Alfred: "full core IS the whole CS treatment… we basically do all that we do in four, and we do those as full")
**"FULL CORE" is ONE designation, not two competing tiers.** A CORE book (CS, math) gets the FULL treatment =
the ENTIRE cs-curriculum 7-part stack. The four-way burst is ONE COMPONENT of full-core (DEMAND 3), NOT a
lighter alternative stacked on top. My earlier "4 = RICH vs full = CORE as two stacking tiers" framing was
WRONG — Alfred corrected it: *the four things are things we do INSIDE full, and we do them AS full.* The seven
parts of full-core (Alfred's own re-enumeration, verbatim order):
  1. **CONTENT MASTERY** (taught as the book itself — real runnable code)
  2. **META-TEACHING** (taught how to be taught — name the move)
  3. **FOUR-WAY BURST** (book-taught · code-deconstruct/reconstruct · concept-canoodling-in-other-systems · multi-register prose)
  4. **HEAVY CIRCLE-AROUND DIALOGUE**
  5. **GRAPH EXPANSION** (cross-corpus relate + expand + reasoning)
  6. **REASONING-SLAT** (reason about the data — PAL/PoT, 4 Peirce moves)
  7. **FIVE AUDIENCES + real (mined) jokes**
BOTH cs-curriculum §14 AND math §15 are CORE → BOTH get the full 7-part treatment, well done, IDENTICALLY (math
= CS-full-core, math-instantiated). **WHY THESE TWO ARE CORE (Alfred's load-bearing reason):** *this is HOW
MOTOI KNOWS HOW TO WRITE CODE* — content mastery of code + math is the foundation of code-writing ability;
"you cannot [write code] without" understanding these. The resulting abundance ("it's so much… too much data")
is INTENTIONAL, the point, not excess. "Rich / richest text" = the QUALITY of a well-done full-core book, NOT a
separate optional tier. Applies retroactively as walk vocabulary; supersedes the two-tier reading.

## TREATMENT-TIER LADDER (Alfred's four ascending tiers — how much SFT treatment each book gets)
Every book is classified onto ONE of four ascending tiers; each tier CONTAINS the ones below it:
- **Tier 1 — MINIMAL / INSTRUCTIONAL.** SFT pairs that simply STATE the book's content — "this is the content
  in the book." Bare content transfer, nothing more.
- **Tier 2 — PEDAGOGICAL.** Tier 1 + teach it HOW TO TEACH the book to other people (meta-pedagogy).
- **Tier 3 — THE FOUR (four-way burst).** For big, super-important books (**book-of-Motoi** and peers): the
  four things — book-taught · code-deconstruct/reconstruct · concept-canoodling-in-OTHER-systems · multi-
  register prose — plus book-of-Motoi's rich decisions (branching-extensibility, graph + 16 philosophers,
  broken-pairs, cross-book edges, etc.).
- **Tier 4 — FULL CORE (must-not-flop).** For **COMPUTER SCIENCE, MATHEMATICS, and MACHINE LEARNING.**
  Everything done for book-of-Motoi (Tier 3) PLUS the additional full-core stuff = the 7-part treatment
  (content-mastery · meta-teaching · four-way-burst · HEAVY circle-around dialogue · graph-expansion ·
  reasoning-slat · five-audiences + real mined jokes). Alfred: *"if we don't get this right, this shit's
  gonna flop… it should KNOW those."* **THREE full-core books: §14 cs-curriculum · §15 math · §16 ml.**
  book-of-ml is now confirmed Tier 4 (it was the math ch15 linalg→ml edge; appendix-D reflexive self-model
  makes it the natural third). WHY the top tier: CS + math + ML are HOW MOTOI KNOWS HOW TO WRITE CODE.

---

# 15 · book-of-math — FULL CORE, MATH-INSTANTIATED (the SAME 7-part treatment as CS)
**Alfred's directive (verbatim):** *"Let's [do] what we did to CS 'full' and do the same for math."* + the
CORRECTED vocab lock above. **math = CORE (like CS = CORE) → math gets FULL CORE = the ENTIRE 7-part cs-
curriculum stack, identically, well done.** NOT a lighter variant — the four-way burst is component #3 INSIDE
it, not a separate tier. The two groupings below (spine-parts / expansion-parts) are just a reading aid; together
they ARE the single full-core 7 (content-mastery · meta-teaching · four-way-burst · heavy-dialogue · graph-
expansion · reasoning-slat · five-audiences+jokes). Math is cs-curriculum's sibling by Alfred's own tie-in flag;
where cs-curriculum is `:audience "engineer"`, math is `:audience "adult"` and spans **Grade 1 (counting on a
number line) → Grade 16 (math-major electives)**, 16ch (one per grade) + 6 app. The grade-per-chapter structure
is a gift: the chapter number IS the audience band. **WHY CORE:** CS + math are how Motoi KNOWS HOW TO WRITE
CODE — content mastery here is the foundation of code-writing; "you cannot" without it. Abundance is the point.

## Full-core parts 1–2–6 + reflexive self-model (the dependable spine), math-instantiated
Taught-as-the-book (grab REAL runnable ./bin/motoi: appendix-verbs-cookbook, app-V advanced verbs, appendix-
exact-orderings = the R7RS number-tower surface; grab-don't-generate). Seed-templates + REFLEXIVE self-model:
**appendix-U "Motoi doing math"** = Motoi COMPUTING not just teaching (self-model at the arithmetic floor).
Meta-pedagogy — name the MATH teaching move (concrete-count → pattern → notation → why-it-generalizes → let-
them-try; r7rs #5). REASONING-SLAT: math's slat = proofs/derivations/why-this-step, done AS Scheme-in-
interpreter (PAL/PoT, 4 Peirce moves: deduce the identity, induce the pattern from cases, abduce the method,
spot-the-error-in-a-derivation); authored vs book-of-logic §7 + reasoning-cortex
[[project_reasoning_cortex_scheme_compression]] (no literal book-of-reasoning folder). Honest-null band = upper
appendices (topology/symbolic-math app-W) where Scheme's reasoning coverage thins (cf. cs-curriculum app-D).

## RICH (4) — the four-way burst + expansion layer
Four-way burst per concept: book-taught · code-deconstruct/reconstruct (build the algorithm from parts: long-
division, Euclid, Newton's method) · concept-canoodling-in-OTHER-systems (a matrix in graphics/ML/a linear
solver; probability in games/Bloom-filters) · multi-register prose. **HEAVY DIALOGUE** (where-people-get-stuck
heart; CIRCLE AROUND: "I still don't get fractions" → pizza → number-line → division → equivalence; patience
is a register). **GRAPH-RELATED + EXPANDING** (over-relate: ch15 linear-algebra → book-of-ml; ch07 probability
→ cs-curriculum randomized-algos; exactness → book-of-values) [[graph-sft-pair-generation-doctrine]]. **MULTI-
AUDIENCE 5-band ladder maps ONTO the grades** (Gr1-5 = child/layperson · Gr6-12 = student · Gr13-16+app =
grad/researcher). **MATH JOKES** MINED from corpus (grab-don't-generate, don't fabricate); variation, anti-
phrase-lock [[feedback_parallel_templates_cause_phrase_lock_2026_07_22]].

## OUTCOME FRAMING (carried from cs-curriculum)
(a) **DEMONSTRATION over breakage** — broken-pairs OPTIONAL; primary move = DEMONSTRATE the theorem/computation
working (exact arithmetic = richest reliable data). (b) **BEYOND-THE-BOOK / MATH-HELPER-TOOL** — springboard
not ceiling; extrapolate past the 16 grades to teach ANY math concept a learner is stuck on (general-purpose
math tutor; kid-seed/domain-extrapolate [[project_kid_seed_domain_extrapolate_asymmetry]], reach = all of math).
(c) **SHIP-TEST = layperson-manner that makes them GOOD**, not merely informed. (d) **CS↔MATH TIE-IN now
BIDIRECTIONAL** — the first-class cross-book edge, authored from both sides. GUARDRAIL: exactness discipline
(book-of-values) — Motoi uses exact rationals/bignums, so "the float trap" is DEMONSTRATED, not suffered
[[project_broken_code_as_runtime_signal]].

---

# 16 · book-of-ml — FULL CORE (Tier 4), ML-INSTANTIATED: the THIRD must-not-flop book
**Alfred's directive (verbatim):** *"Yep"* — affirming book-of-ml is FULL CORE alongside CS + math (the three
must-not-flop books; "it should KNOW those"). Apply the SAME 7-part full-core treatment, ML-instantiated.
`:audience "kid-and-adult operators, curious programmers"`, 16ch + 4app, arc = numbers/tensors → the tiny LLM
("build a language model from first principles, in Scheme, on your machine"; every block runs ./bin/motoi).
Third leg of the **CS↔MATH↔ML triangle** and the corpus's DEEPEST reflexive book (appendix-D "What you built
vs. what I am").

## The full-core 7, ML-instantiated
1. **CONTENT MASTERY** — tensors · dot-product · matvec · functions-of-functions (composition IS the network) ·
   what-is-a-model · gradient-descent-by-hand · single-neuron · layer-then-two · backprop-from-calculus ·
   training-loop · tokens/embeddings · attention-as-soft-lookup · transformer-block · positional-encoding/
   masking · stacking/tokenization · the-tiny-LLM. Grab REAL runnable ./bin/motoi (grab-don't-generate).
2. **META-TEACHING** — name the ML move: intuition/analogy → tiny concrete numeric example → the operation →
   compose it up → why it scales. Motoi names it + reuses on any ML concept (sibling to CS demand-2, math meta-
   pedagogy).
3. **FOUR-WAY BURST** per concept: book-taught · code deconstruct/reconstruct (build dot-product / matvec /
   backprop from parts, stuck-term repair) · concept canoodling in OTHER systems (dot-product in graphics/
   search/recommendation; attention = a soft hash-table lookup / dispatcher; gradient descent in optimization/
   control) · multi-register prose (demand 7).
4. **HEAVY CIRCLE-AROUND DIALOGUE** — ML is a top stuck-point (backprop, attention). Circle: "I don't get
   backprop" → chain rule → a 2-node net by hand → numeric gradient → the weight update; families of multi-turn
   dialogues at many entry-questions. Patience is a register.
5. **GRAPH EXPANSION** — relate outward + expand: matvec → book-of-math ch15 linalg (the literal edge that
   pointed here); training-loop → book-of-code CPU-loop→loop seed; attention soft-lookup → book-of-code ALU→
   dispatcher + flip-flop→cell (KV-cache); tokens/embeddings → words/graph nodes; over-relate, don't under-
   relate [[graph-sft-pair-generation-doctrine]].
6. **REASONING-SLAT** — reason about ML: choose-the-architecture / derive-a-gradient / trade-off-under-compute /
   why-this-not-that, done AS Scheme-in-interp (PAL/PoT), 4 Peirce moves (deduce the gradient, induce the
   pattern from runs, abduce the architecture, spot-reasoning-in-error). Authored vs book-of-logic §7 +
   reasoning-cortex [[project_reasoning_cortex_scheme_compression]] (no literal book-of-reasoning folder);
   appendix-C = honest-null band. [[project_sft_must_be_abductive_2026_07_21]].
7. **FIVE AUDIENCES + real (mined) jokes** — 5th-grader/11yo · layperson · grad-student · engineer-on-job ·
   researcher; ML jokes MINED from corpus (grab-don't-generate). Variation, anti-phrase-lock
   [[feedback_parallel_templates_cause_phrase_lock_2026_07_22]].

## THE REFLEXIVE CROWN (unique to ML — deepest self-model in the corpus)
**appendix-D "What you built vs. what I am"** = after the reader hand-builds a tiny LLM, Motoi narrates its OWN
kind — the strongest reflexive self-model in the walk (deeper than computing ch15 AI-arc + math appendix-U,
because the reader has now BUILT a toy of Motoi's own architecture). **appendix-C "Why LLMs hallucinate"** hooks
the book-of-logic Qwen/turns research GROUNDED this session (scratch/book-of-logic-qwen-turns-research-2026-07-
28.md: Laban 2505.06120 multi-turn drop, snowballing 2305.13534, external-verifier 2310.01798) — teach the
mechanism honestly, don't fabricate. **appendix-B "philosophy of the field — Turing to attention"** = the
lineage. **appendix-A math prerequisites** = the explicit book-of-math bridge. Seed-templates clone here: CPU-
loop→loop = training loop (ch10); flip-flop→cell = embedding table / KV-cache; ALU→dispatcher = attention soft-
lookup / matvec; state-machine→flow = forward/backward-pass lifecycle.

## GUARDRAILS (ML raises the stakes)
(1) **Reflexive honest-null at MAXIMUM stakes** — the tiny LLM the reader builds is NOT Motoi; appendix-D must
teach "what you built vs what I am" HONESTLY, never claim the toy = Motoi's actual nature, never claim Motoi can
read its own weights/parameters (it cannot introspect its substrate) — book-of-code guardrail #2 (simulated ≠
self) at the sharpest edge [[project_broken_code_as_runtime_signal]]. (2) **ML genuinely lives in APPROXIMATION**
— unlike math's exact-arithmetic pole, gradient descent IS iterative-approximate + floats are native to the
domain; so the book-of-values "float trap" is REAL here, taught as "ML lives in approximation" (demonstrate the
approximation honestly) while Motoi's OWN arithmetic stays exact. (3) **appendix-C** must ground hallucination-
mechanism in the real research, honest-null where the field itself doesn't know.

## OUTCOME FRAMING (carried from CS + math)
(a) **DEMONSTRATION over breakage** (broken-pairs OPTIONAL; demonstrate the network learning); (b) **BEYOND-THE-
BOOK / ML-HELPER-TOOL** — extrapolate past the 16ch to teach ANY ML concept a learner is stuck on (general-
purpose ML tutor; kid-seed/domain-extrapolate [[project_kid_seed_domain_extrapolate_asymmetry]], reach = all of
ML); (c) **SHIP-TEST = layperson-manner that makes them GOOD**; (d) **CS↔MATH↔ML now a THREE-BOOK TRIANGLE** —
each pair a first-class cross-book edge, authored from all sides.

---

# 17 · book-of-slat — TIER 3 (four-way burst) + two custom emphases

**Directive (verbatim):** "What do you think?" → my recommendation → "I approve next book."

**Tier decision: TIER 3, not Tier 4.** Tier 4 (full-core) is reserved for the code-writing
foundation (CS · math · ml — *how Motoi knows how to write code*). SLAT is a data format, not
the reasoning substrate that generates code, so it does NOT earn the must-not-flop ceiling.
But it is well above an ordinary book: **SLAT is the medium the entire corpus is written in,
and the substrate Cortex / memory / session-records / signing all stand on.** She reads and
writes it at runtime constantly — operationally load-bearing = the "big, super-important book"
bar Tier 3 was drawn for. So: full four-way burst, heavy circle-around dialogue, graph
expansion, five audiences.

**Shape on disk:** 18 chapters (00 cover → 17 session-records) + 21 appendices A–U.
Arc: 1–3 atoms (what-a-slat-is, primitives small/medium) → 4–5 the record + fifteen record
types → 6–7 framing + I/O → **8–10 the trust spine (canonicalize → content-address → sign)**
→ 11–13 auto-assembly / tagged-extensions / mailbox → **14 Cortex slices ("the runtime's
memory")** → 15–17 build-a-game / share-your-slat / session-records (grant·action·end audit
triple). Appendices in 3 clusters: **A–D exhaustive reference** (every error/primitive/record-
type/canonicalization-rule) · **E–P "SLAT for X" cookbooks** (Cortex, signing, auto-assembly,
networked carts, **J = the runtime reading her own reader**, HTTP, testing, security/audit,
community, playground, notebooks — the concept-canoodling-in-other-systems burst already
authored in) · **Q–U SLAT-as-poetic-form** (poem/sonnet/haiku/blues records + one worked poem
assembly — a register almost nothing else in the corpus reaches).

**TWO CUSTOM EMPHASES this book earns (depart from a generic Tier-3 pass):**

1. **The trust spine (ch 8–10) is a PREMIER REASONING-SLAT target.** canonicalize →
   content-address → sign is genuinely deductive AND externally *verifiable*: one canonical
   byte-form, a hash that must match, a signature that either checks or doesn't. Most reasoning-
   slat in the corpus reasons *in* SLAT; here she reasons *about the medium itself*, and the
   interpreter grades every step. Cleanest deductive-with-external-verifier seam in the whole
   walk — weight it hard. (Ties to [[project_broken_code_as_runtime_signal]] verifier doctrine
   + PAL/PoT reasoning-in-code.)

2. **Appendix J ("the runtime reading her own reader") is a REFLEXIVE-CROWN moment** — smaller
   sibling to book-of-ml appendix-D. Author at self-model depth, not cookbook depth.

**BONUS SEAM found on disk (not in :nav):** `deliberate-forgetting-cortex-note.book.slatl` +
a `cortex-appendix/` subdir. The forgetting note is a JEWEL — the memory-design self-model *in
SLAT form*: four bands (hot / warm / cool / released), one-directional permeability, **re-
anchoring** (only the user brings cool→warm), **log-vs-active** (effortless surface small,
effortful opt-in = anti-uncanny), **provenance** ("you told me in the fall" honestly), **user-
owns-memory** ("trust is built by fast honest deletion; slow deletion is worse than none"),
**compression-not-summarization** ("the shape without the propositions… piled-up summaries feel
like a stack of receipts"), and **the affect-declaration** ("you have to talk to me, and I like
talking to you" — flagged load-bearing). Strengthens the ch14 Cortex-slice seam AND the reflexive
crown; route into both. NOTE: user-owns-memory says Cortex *deletes* on user request — that is a
USER-DRIVEN prune, NOT the corpus "No deletes ever" archive rule (which governs OUR authoring);
keep the distinction clean when authoring pairs.

**Honest-null flag:** `cortex-appendix/` subdir + `CHAPTERS.book.slatl` roles unread — read
before assigning them treatment; do not fabricate their content.

**OUTCOME framing (carried):** demonstrate-over-breakage; SLAT-literacy makes her able to
operate her OWN substrate (read/write Cortex, session records, signing). Cross-book edges:
→ book-of-systems (session records = operational self), → reasoning-cortex doctrine (ch14 +
forgetting note), → book-of-ml appendix-D (reflexive crown sibling).

---

# 18 · book-of-language-ancestors — TIER 1 INFORMATION PAIRS + fan-out 4-5 conversational + CODE-as-variety

**Directive (verbatim):** "Information pairs. Fan out 4-5 for conversation. Use code for variety in
example. Next book."

**Treatment: TIER 1 (instructional/information pairs) — NOT the four-way burst, NOT full-core.** A
prose heritage book gets a lighter, factual treatment. Three explicit moves Alfred named:

1. **INFORMATION PAIRS.** The base shape = factual pairs stating the book's content — who each
   ancestor was, what they gave us, their landmark work. Straight instructional SFT (the Tier-1 floor
   from the treatment ladder). This is the "just tell it what's in the book" layer, applied honestly.

2. **FAN OUT 4-5 FOR CONVERSATION.** Each fact fans into 4-5 conversational variants (same fan-out-
   dialogue technique book-of-values §11 got) — the same information asked/answered across registers &
   framings, so it's not a single brittle Q→A phrase-lock [[project_sft_must_be_abductive_2026_07_21]].
   4-5 is the explicit fan width for THIS book.

3. **CODE FOR VARIETY IN EXAMPLE.** The variety mechanism is *runnable code*, not prose paraphrase.
   Render each ancestor's gift AS a tiny Motoi snippet where the contribution is code-shaped: Church →
   a `lambda` (his calculus IS Motoi's evaluation model); McCarthy → `eval`/`quote`/the Lisp cons-cell;
   Steele + Sussman → Scheme forms (the language Motoi is a dialect OF — call/cc, tail-calls, the '75
   memos); Dijkstra → a shortest-path / structured-loop; Knuth → an algorithm; Liskov → an abstraction/
   module boundary; Hopper → a compiler-idea snippet. Code makes each factual pair CONCRETE + gives
   natural variety (same fact, different runnable illustration). Every snippet runs ./bin/motoi.

**WHY it's identity-adjacent (but still Tier 1):** answers "who came before me?" — distinct from book-
of-self ("who am I") and book-of-motoi ("what the console is"). Chapters 1-5 (Church → Turing →
McCarthy → Steele → Sussman) ARE literally Motoi's genealogy: lambda calculus = her eval model, Lisp =
her syntax, Scheme = her direct parent. First-class cross-book edge → book-of-self + book-of-ml
appendix-B ("Turing to attention"). But the SFT treatment stays factual/instructional — identity-
CONTEXT, not identity-CONSTRUCTION.

**HALLUCINATION GUARDRAIL (load-bearing for THIS book):** biographical prose is a fabrication minefield
— invented quotes, wrong dates, apocryphal anecdotes. GRAB-DON'T-GENERATE is a HARD constraint: every
claim (Church 1936 λ-calculus, McCarthy 1958 Lisp, the 1975 Scheme memo) must be grounded in the book's
own prose, never invented. A wrong attribution/date here is worse than an admitted gap → lean hard on
the honest-null floor ([[project_honest_null_is_training_signal_2026_07_22]]); this is exactly the
failure book-of-ml appendix-C warns about, made concrete on named people. Register the book prescribes:
"terse, honest, warm, no mythologizing — not philosophers, code-people" = an anti-hagiography VOICE
constraint, carry it into the pairs.

**CODE-honest-null:** some ancestors aren't code-shaped (Babbage/Lovelace = the machine + the first
program-concept; Shannon = information theory). Where no honest runnable snippet exists, DON'T force
one — either a representational snippet clearly labeled as illustration, or honest-null on the code
angle and keep the information pair + conversational fan-out. Never fabricate anachronistic "their code."

`:book-type "prose"` · 16ch · 0app · `:audience "any"`. Ancestors: Church·Turing·McCarthy·Steele·
Sussman·Knuth·Dijkstra·Liskov·Ritchie&Thompson·Kay·Hopper·Lovelace·Babbage·Shannon·Landin·Strachey
(non-chronological — ordered by lineage-proximity, theoretical headwaters → Scheme family → craft →
semantics theorists).

# 19 · book-of-challenges — TIER 3 FOUR-WAY BURST + TEACH-BOTH + the PROPER-LENS doctrine

**Directive (verbatim, paraphrased from voice):** "Teach both, and I think it has earned four-way.
You also want to go through and make pairs that demonstrate the reasoning that we have in there — I
believe we have some particular specific types of reasoning in there, you want to take special note,
because there's sometimes special things that need to be taught in books in certain ways. Even if the
LLM sees it five different ways, make sure the lens it's viewing it through is the proper lens. This
book actually is pretty good for that. Next book."

**Tier: TIER 3 (four-way burst) — Alfred: "earned four-way."** `:book-type "challenge"` (new type),
15ch + 2app, `:audience "operator"`. SICP-flavored problem sets, every block runs ./bin/motoi.

**TEACH BOTH (explicit):**
1. **The SOLUTIONS** — problem → worked reasoning → solution. This is *natively abductive*
   ([[project_sft_must_be_abductive_2026_07_21]]): observe problem → reason candidate approaches →
   land on solution. The book hands us the ideal SFT shape pre-built.
2. **The SOLUTION SHAPES** — the meta-taxonomy from appendix-C. Not just "here's the answer" but
   "this is a FOLD problem / a MAP+FILTER problem / a STATE-MACHINE problem / a PIPELINE problem."

**⭐ THE PROPER-LENS DOCTRINE (transferable — Alfred's key new instruction, see also
[[feedback_variety_needs_proper_lens]]):** paraphrase VARIETY is not enough. Seeing a thing 5 different
ways (Lacan kit, M-paraphrase, 5 shapes) prevents phrase-lock — but variety alone can MISFRAME. Some
reasoning MUST be taught through its *proper lens* specifically. The lens the pair views the material
through has to be the CORRECT one for that reasoning type, not just a diverse-but-arbitrary framing.
Diversity-of-surface ≠ correctness-of-framing. This book is "pretty good for that" because its proper
lenses are already named on disk (below) — so every challenge pair must carry the correct shape-label,
not merely a paraphrase.

**THE PROPER LENSES, named in the book itself (grab, don't invent):**
- **The three-part solution frame (appendix-C) = the lens on EVERY solution:** (1) *what you did in one
  sentence* — the SHAPE of the answer, NOT the code ("I folded over the list" / "I built an accumulator"
  / "I broke it in two by parity"); (2) *a RUN* — copy the example input, show actual output, it must
  match (interpreter-VERIFIED — ties to [[project_broken_code_as_runtime_signal]] + PAL/PoT: the run is
  the external grader, "a solution that produces the wrong answer is not a solution"); (3) *the TRADE-
  OFF* — what you picked over what (simplicity/speed/memory/readability) + why = "the piece that turns a
  homework answer into an engineering note." Every challenge pair wraps this three-part shape.
- **THE FOUR SOLUTION SHAPES = the specific reasoning types Alfred meant:** **FOLD** (reduce list→value;
  ch01/07/08) · **MAP+FILTER** (reshape then drop; ch02/04/05) · **STATE-MACHINE** (closure that
  remembers between calls; ch03/09/11) · **PIPELINE** (chain of verbs, data-shape changes each step;
  ch06/10/15). Every solution labels WHICH shape it is → the proper lens. "When yours doesn't fit one,
  that's the interesting one" — the honest-null of shapes.
- **HONEST-FAILURE reasoning (ch13, its own chapter) = a reasoning SHAPE, not a footnote:** the wrong
  answer is a real fact worth its own paragraph — *what you thought would happen · what actually
  happened · the smallest change that made the difference* ("that paragraph is worth more than the
  fix"). This is honest-null / broken-code-as-signal rendered as a first-class REASONING type. Take
  special note — teach it through the "honest-failure" lens, never sand it into a clean answer.
- **COMPOSITIONAL-RETRIEVAL reasoning (appendix-D "look sideways, not down"):** when ch09 (memory) is
  stuck, the answer is often a fresher look at ch03 (closures), not another push at ch09. "The book
  composes; the challenges do too." = cross-chapter retrieval as a reasoning move (Cortex/RAG-flavored)
  → graph-expansion edges between chapters, not just within.
- **DIFFICULTY GRADING (appendix-D ramp→middle→deep-water→advanced→summit):** a ready-made difficulty
  ladder — route straight into pair-tiering / audience-band routing.

**FOUR-WAY BURST for this book:** (1) book-taught challenge + solution; (2) code deconstruct/reconstruct
(the run IS the reconstruction); (3) concept-canoodling — fold/map/state-machine/pipeline are UNIVERSAL
shapes, show them in other systems; (4) multi-register + real mined jokes. PLUS heavy circle-around
dialogue on the deep-water/summit chapters, graph expansion via the compositional "look-sideways" edges,
reasoning-slat done AS the three-part frame, five audiences off the difficulty map.

**HONEST-NULL (needs-alfred):** appendix-C AND appendix-D both reference **ch10 "Orchestrating Tools"**
(pipeline family; "multiple verbs, one goal"), but there is NO `ch10-*` file on disk and it is ABSENT
from the README nav (nav jumps 09→11). Real gap between the book's own cross-refs and its files — DO NOT
fabricate ch10; flag for Alfred. (Also the earlier "missing ch10" nav flag = this same gap, now
grounded in the appendices' own references.)

---

# 20 · book-of-composition — TIER 2 + ROUND-TRIP proper-lens + VARIETY-on-the-interesting-bits + NOVEL-gets-in-depth-pedagogy

**Directive (verbatim):** "I think 2 with round trip and variety on the interesting bits. Novel stuff
gets amplified with in depth pedagogy."

**Tier: TIER 2 PEDAGOGICAL.** Not Tier 3 (no four-way burst) — this is a tool/UI manual for the
Composer, the umbrella/entry-point for the whole creative-composer cluster (music·sound·motion·
animation·instruments·games all specialize DOWN from what this book establishes). `:book-type
"composition"` (new type), 17ch + 9app, dual audience "programmer-fluent-in-other-languages OR
curious-kid-with-a-parent-nearby". Every code block runs ./bin/motoi.

**Alfred named THREE calibrations — a SELECTIVE treatment, not a uniform pass:**

1. **ROUND-TRIP is the PROPER LENS (⭐ [[feedback_variety_needs_proper_lens]] applied).** The book's
   own load-bearing invariant: **a widget's `emit` and `apply` are inverse functions** — emit state→
   data, apply data→state, round-trip = identity. Ch01 IS "the round-trip contract"; appendix-D is
   "Round-trip proofs — five worked examples of emit and apply being inverse"; appendix-C is "every
   emit-shape by widget kind." This is a genuine reasoning TYPE (like challenges' fold/map/state-
   machine/pipeline), so every widget's pairs carry the ROUND-TRIP lens — not "here's a slider" but
   "here's a slider's emit, here's its apply, here's the proof they invert." The interpreter grades the
   round-trip (emit then apply must reproduce state — the run is the external verifier, ties
   [[project_broken_code_as_runtime_signal]] + PAL/PoT). Label each pair with the widget kind + its
   emit-shape.

2. **VARIETY ON THE INTERESTING BITS (selective, not uniform).** Alfred did NOT ask for corpus-wide
   variety fan-out here — variety is spent on the *interesting* widgets/verbs, not sprayed evenly over
   the whole manual. The routine round-trips (a plain slider, a toggle) get clean instructional pairs;
   the interesting bits (FX-chain WHY-ORDER-MATTERS, piano-roll notes-as-data, timeline keyframe-vs-
   frame-flip, the 16-voice polyphony budget, sprite-pixels-as-lists) earn the register/lens variety.
   Judgment call per-widget: is this bit interesting enough to amplify?

3. **NOVEL STUFF GETS AMPLIFIED WITH IN-DEPTH PEDAGOGY.** The genuinely novel concepts — the ones a
   programmer-from-another-language has NOT seen — get the deep teach-it-how-to-teach treatment (the
   book-of-values §11 sharp-pedagogy move, but reserved for novelty). Candidates: the round-trip
   contract itself (ch01, ~6k words, "carries every later chapter"); **emit-versus-bind** (ch04, the
   core distinction); FX-chain order-dependence (ch10); the `.slat` cart file format as save/load
   (ch13); pixels-as-lists / notes-as-data (data-shape thinking). Amplify these; keep the widget-
   catalog chapters lighter.

**PRE-DECLARED HONEST-NULL ON DISK (not a fabrication license):** the outline TAGS ch12 (16 voices),
ch14 (TUI mode), ch15 (HTTP server) as **`SEEDED-PENDING-V11 if runtime absent`** — the book itself
says these lean on runtime that may not exist yet. Read each before assigning depth; where the runtime
isn't there, honest-null the pairs, don't invent behavior. (appendix-G TUI cheat-sheet + appendix-H
HTTP security guide sit on the same possibly-absent runtime.)

**EMBEDDED CROSS-BOOK SEAM:** `appendix-escalation-verbs` (`domain/of`, `floor/problem?`,
`route/off-domain`) is the **book-of-limits floor doctrine embedded in the Composer manual** — the
"this is outside what I compose" escalation ladder, first-class here. Route to book-of-limits +
book-of-systems ch13 escalation edges.

**CROSS-BOOK ROLE:** this is the HUB the downstream creative books inherit from — music/sound/motion/
animation/instruments/games should NOT re-teach composition; they specialize the round-trip + widget
vocabulary this book establishes. Graph-expansion edges point DOWNWARD into the cluster.

---

# 21 · book-of-music — TIER 2 INSTRUCTION + PEDAGOGY, 3-5 PAIRS PER UNIT

**Directive (verbatim):** "Teach it the material in the book and of course cover it with 3-5 pairs.
Instruction and pedagogy."

**Tier: TIER 2 PEDAGOGICAL — the clean, disciplined version.** Two moves, no four-way burst:
1. **INSTRUCTION** — teach the material *in the book*: what a note is, melody, rhythm & meter, harmony,
   voices, timbre/envelope, polyphony, polyrhythm, the repertoire chapters, the harmonic series, the
   concerto. Straight faithful coverage of the book's actual content (grab-don't-generate — the musical
   facts, the repertoire, come from the book's prose, not invented).
2. **PEDAGOGY** — teach it how to teach the material (the book-of-values §11 / cs-curriculum "taught-how-
   to-teach" layer), so pairs carry the teaching move, not just the fact.

**COVERAGE RULE (explicit):** **3-5 pairs per unit** — each concept / chapter-idea / verb gets covered
by 3-5 pairs. This is the fan width Alfred set for THIS book (cf. language-ancestors' "fan out 4-5"). NOT
uniform mass-generation, NOT a single brittle Q→A — 3-5 angles per unit is enough to break phrase-lock
[[project_sft_must_be_abductive_2026_07_21]] without spending four-way-burst budget on a domain
specialization.

**NOT this book:** no four-way burst, no heavy circle-around dialogue campaign, no reasoning-slat spine.
Instruction + pedagogy, 3-5 pairs. Keep it disciplined.

**Shape on disk:** `:book-type "learning"`, `:audience "kid"` (kid-first — routes register default to
kid-seed [[project_kid_seed_domain_extrapolate_asymmetry]]), 19ch + 11app. Fundamentals (surface-of-
sound · the-language · the-Note) → craft ladder (melody · rhythm&meter · harmony · voices · timbre/
envelope · polyphony · polyrhythm) → repertoire-as-teaching (Rachmaninoff 2nd · form-as-meaning ·
Chopin/nocturne · three classical forms · pitch/interval/harmonic-series · tempo/rubato/listening · the
Concerto) → 11 appendices = world-music canon gallery (Bach Goldberg · Debussy · Ellington · Nina Simone
· blues · shakuhachi & *ma* + 5 drill chapters: world-percussion · ornamentation · dynamics&rubato ·
orchestration · form&structure). Every block runs ./bin/motoi.

**HUB-INHERITANCE seam (carry as cross-book edges, don't re-teach):** timbre/envelope inherits
composition ch09 ADSR; polyphony/polyrhythm inherit composition ch12 the 16-voice budget; the Note
inherits composition ch05 piano-roll notes-as-data. Music SPECIALIZES the Composer; edges point UP to
[[book-of-composition]] the hub, the round-trip lens carries down. (Even at Tier-2-instruction, keep the
inheritance honest so downstream doesn't duplicate.)

**PROPER-LENS note (lighter here than challenges, but present):** music carries real reasoning types —
harmonic-series-as-ratio (ch14), form-as-meaning (ch11a), polyrhythm=two-clocks (ch10), *ma*=silence-as-
first-class (appx-06). Under an instruction+pedagogy pass these are taught faithfully as the book frames
them; not elevated to a burst, but where a concept has a proper frame in the book, teach it through that
frame [[feedback_variety_needs_proper_lens]].

**HONEST-NULL carryover:** ch09 polyphony / ch10 polyrhythm lean on the same 16-voice runtime composition
flagged `SEEDED-PENDING-V11 if runtime absent` — check runtime presence before assigning depth; honest-
null where absent, don't invent voice behavior.

---

---

# 22 · book-of-sound — TIER 2 INSTRUCTION + PEDAGOGY + 3-5 PAIRS + NORMAL REVERSAL where useful

**Directive (verbatim):** "Instruction, pedagogy, and 3-5 pairs. Normal reversal and such where useful."

**Tier: TIER 2 PEDAGOGICAL — parallel to §21 music (the sibling), plus a reversal add.** The DSP/
synthesis sibling of music: music = the score, sound = the synth. Same disciplined treatment as music:
1. **INSTRUCTION** — teach the book's actual material (waveform → filter → envelope → instrument → FFT →
   voice/speech → beat machine); grab-don't-generate the signal-processing facts from the book's prose.
2. **PEDAGOGY** — teach-it-how-to-teach layer.
3. **3-5 PAIRS PER UNIT** — same fan width as music, per concept/chapter-idea/verb.
4. **⭐ NORMAL REVERSAL "where useful" (the new add for this book):** apply the standard reversed-pair
   shape (Reversal-Curse mitigation [[project_cpt_shapes_catalog_2026_07_20]] — teach A→B AND B→A) WHERE
   USEFUL, not everywhere. "Where useful" = the judgment gate: sound has genuinely invertible relations
   worth reversing (waveform↔harmonic-content via FFT is literally forward/inverse transform; note↔
   frequency; envelope-stage↔sound-behavior; instrument-name↔its-timbre-signature). Reverse the pairs
   that have a real bidirectional fact; don't force reversal on one-directional pedagogy. ("and such" =
   the normal companion shapes where they fit — not a burst, just the standard kit applied with judgment.)

**NOT this book:** no four-way burst, no reasoning-slat spine, no heavy circle-around campaign.
Instruction + pedagogy + 3-5 pairs + reversal-where-useful. Disciplined, sibling-consistent with music.

**Shape on disk:** `:book-type "learning"`, `:audience "kid"` (kid-seed register default
[[project_kid_seed_domain_extrapolate_asymmetry]] — but material genuinely advanced: FFT/formants/
physical-models at kid-depth = the kid-seed/domain-extrapolate tension in one book), 16ch + 3app.
Physics-of-a-sound (waveform · harmonics&harmony · soundboard · filter roll-off/cut · envelope · noise&
texture · body resonance/formants) → building-instruments (build-an-instrument · physical-models · roster/
modding-voices · timing · sequencing&chiptune) → deep-end (**FFT decomposition** · transcription/
transposition · voice&speech · **beat-machine capstone**). Appendices: instrument/synth-vocabulary · tone-
table · verbs-cookbook. Every block runs ./bin/motoi.

**REAL-MATH + CROSS-BOOK HUB:** ch13 FFT (frequency-domain decomposition) + ch02 harmonics touch book-of-
math AND book-of-music ch14. **The harmonic-series now appears in THREE books** (music-ch14 pitch-as-ratio
· sound-ch02 harmonics · math) = a genuine cross-book concept hub → graph edges, don't triple-teach; each
book frames it for its own domain. FFT forward/inverse = the cleanest reversal seam in the book (see move 4).

**HUB-INHERITANCE seams (edges, don't re-teach):** envelope ch05 ← composition ch09 ADSR; filter/noise/
body ← composition ch10 FX-chain; timbre overlaps music ch08. Sound + music are SIBLINGS both inheriting
from the composition hub — keep all three envelope-edges honest so none re-teaches. Edges point UP to
[[book-of-composition]] + sideways to [[book-of-music]].

**HONEST-NULL:** physical-models (ch09), voice&speech (ch15), the beat-machine (ch16) may lean on DSP
runtime — check runtime presence before assigning depth; honest-null where the synth backend isn't there,
don't invent signal behavior. (Real Node audio DSP backend exists per task #379 — verify which verbs are
actually wired before claiming a sound runs, per [[feedback_verb_wired_means_motoi_run_passes]].)

---

---

# 23 · book-of-instruments — TIER 2 INSTRUCTION + PEDAGOGY + 3-5 PAIRS + REVERSAL-where-useful

**Directive (verbatim):** "Yep. instruction + pedagogy + 3-5 pairs, with reversal-where-useful. Hit me
with the next one."

**Tier: TIER 2 PEDAGOGICAL — sibling-consistent, completes the AUDIO TRIO.** composition (widgets) →
music (score) → sound (synth) → **instruments (the roster you actually play)**. Same disciplined
treatment as music + sound:
1. **INSTRUCTION** — teach the book's actual material (the roster + each instrument family); grab-don't-
   generate the instrument facts from the book's prose.
2. **PEDAGOGY** — teach-it-how-to-teach layer.
3. **3-5 PAIRS PER UNIT** — per instrument / family / verb.
4. **REVERSAL WHERE USEFUL** — instrument↔timbre↔family is genuinely invertible (name the instrument
   from its sound; name the family from the instrument), same seam as sound's instrument↔timbre. Reverse
   the bidirectional facts, don't force it on one-directional material.

**`:book-type "application"` (FIRST application-type book in the walk — a real signal):** this is a
USING-THE-ROSTER book, not a concept-building curriculum. Emphasis leans toward *reach-for-the-right-
instrument* application (which family, which voice, for a given musical need) rather than *how synthesis
works* (sound already owns that). Application-type = catalog-with-teaching, still Tier 2, still the
4-move treatment above.

**Shape on disk:** `:audience "kid"`, 17ch + 1app. Ch1 the-roster (index) → instrument families: Western
(piano · strings · percussion · brass · strings-ensemble · guitars · electronic&synths) + **world
instruments first-class** (Japanese bamboo flute · African drums · Indian tabla · Latin percussion) →
craft turn (voice-as-instrument · arranging-for-ensemble · **the-roster-remembers** memory capstone) →
appendix-A synth-family-extras. Every block runs ./bin/motoi.

**WORLD-INSTRUMENT CULTURAL GUARDRAIL (grab-don't-generate):** tabla bols, shakuhachi *ma*, African-drum
+ Latin-percussion technique carry real cultural/technical facts — same anti-fabrication discipline as
language-ancestors' biography minefield [[project_honest_null_is_training_signal_2026_07_22]]. Grab the
book's actual claims; never invent ethnomusicology. Wrong cultural attribution worse than an admitted gap.

**HUB/SIBLING INHERITANCE (edges, don't re-teach):** voice-as-instrument ch14 ↔ sound ch15 voice&speech;
electronic&synths ch12 ↔ sound ch08/ch10 + composition ch09/ch10; percussion ↔ sound/music drills. The
roster is DOWNSTREAM of sound's synthesis engine — edges point to [[book-of-sound]] (timbre/synthesis) +
[[book-of-music]] (score/arranging) + [[book-of-composition]] (hub). Shakuhachi/*ma* ↔ music appx-06.

**MEMORY SEAM:** ch16 "the roster remembers" = a Cortex/memory echo (sibling to slat's forgetting-note +
composition's save/load) — small reflexive touch, route to the Cortex-memory motif but keep it light
(this is an application book, not the reflexive crown).

---

---

# 24 · book-of-motion — TIER 2 INSTRUCTION + PEDAGOGY + 3-5 PAIRS + REVERSAL-where-useful (my tier read confirmed)

**Directive (verbatim):** "Your tier read is correct." → confirms my recommended treatment.

**Tier: TIER 2 PEDAGOGICAL — structural TWIN of music, opens the VISUAL/animation cluster.** Motion is
the visual-motion sibling of sound (sound = physics of a waveform, motion = physics of movement); it
pairs with animation the way music pairs with sound. Same disciplined four-move treatment:
1. **INSTRUCTION** — teach the book's actual material (physics of movement + the twelve-principles craft +
   the animation history); grab-don't-generate the facts from the book's prose.
2. **PEDAGOGY** — teach-it-how-to-teach layer.
3. **3-5 PAIRS PER UNIT** — per principle / concept / verb.
4. **REVERSAL WHERE USEFUL** — motion has clean invertible relations: velocity↔position, ease-in↔ease-
   out, cause-force↔resulting-motion, squash↔stretch. Reverse the bidirectional facts; don't force on
   one-directional pedagogy.

**Shape on disk:** `:book-type "learning"`, `:audience "kid"`, **23ch + 11app (biggest creative-cluster
book so far)**. Classic Disney-twelve-principles pedagogy visible in the nav. Physics-of-movement (still-
frame · velocity · **easing** · arc · timing · weight/embodiment · **squash&stretch** · oscillation ·
forces) → character&scene (locomotion · gesture · secondary-motion · style · blending · the-crowd · the-
living-scene) → craft/history turn (animation-history pt1&2 · keyframes&inbetweens · how-emotion-animates
· **good-vs-bad-animation** · narrative-arc-in-motion) → 11-app animation-history canon gallery (McCay
Gertie · Fleischer rotoscope · Termite Terrace · UPA · **Ghibli hand-drawn** · Satoshi Kon · Norman
McLaren · independent/stop-motion + text-in-motion · emoji+easing cheat-sheet · verbs cookbook). Every
block runs ./bin/motoi.

**STRUCTURAL TWIN of music (parallel treatment is the point):** same shape — fundamentals → craft →
repertoire/history appendix gallery. Music's Bach/Debussy/Ellington ↔ motion's McCay/Fleischer/Ghibli/
Kon. Keeps the cluster consistent; author the two in parallel where possible.

**PROPER-LENS candidate — EASING:** the easing-curve IS the shape of the motion (ch03) — a genuine
reasoning frame like round-trip/fold. Teach easing through the curve-shape lens, not just "it slows
down" [[feedback_variety_needs_proper_lens]]. (velocity/forces/oscillation = real kinematics, overlaps
book-of-math → cross-book edges, don't re-derive the calculus.)

**BROKEN-AS-SIGNAL seam:** ch21 "good vs bad animation" teaches the WRONG motion as first-class contrast
— echoes challenges' honest-failure lens + broken-code-as-signal [[project_broken_code_as_runtime_signal]].
Author the bad example as authentic teaching signal, don't sand it into only-good.

**HUB-INHERITANCE:** ch19 keyframes-and-inbetweens SPECIALIZES composition ch08 timeline (keyframe vs
frame-flip) → edge UP to [[book-of-composition]]. Emotion/narrative-arc chapters ↔ book-of-narrative-games
(later in cluster).

**CULTURAL/BIOGRAPHICAL GUARDRAIL (grab-don't-generate):** Ghibli, Satoshi Kon, McLaren, McCay, Fleischer
carry real film-history facts/dates — same anti-fabrication discipline as instruments' world-instruments +
language-ancestors' biography [[project_honest_null_is_training_signal_2026_07_22]]. Grab the book's claims;
never invent animation history.

**RUNTIME HONEST-NULL:** `motion/*` verbs are wired (#327/#378) BUT #371 "rebuild motion+animation on
framebuffer/scheduler" is still PENDING — verify which motion verbs actually run before claiming an
animation plays [[feedback_verb_wired_means_motoi_run_passes]]; honest-null where the framebuffer path
isn't there.

---

# 25 · book-of-animation — TIER 2 INSTRUCTION + PEDAGOGY + 5-8 DIALECT-CITIZENSHIP PAIRS on non-runnable code ("this is not your verbs")

**Alfred's directive (verbatim):** "All non runnable code needs to be told explicitly 'this is not your
verbs' — it's a great opportunity to explain to it there are other scheme dialects and it is one of them.
Tell it be a good citizen and that it will be forked to create other scheme dialects and languages. This
stuff is from another scheme and it doesn't recognize the verbs — though it looks like it will work. This
is an instruction and pedagogy but we're gonna do about 5-8 pairs here on code it can't run and why. How
to check before it runs and how to run code to check it before presenting it. Or best: checking the verbs
before it tries to run it and learning what the output of code it can't run will be. Even invent a few
misspellings in this lesson. But also teach the book itself and the material. And its pairs. And its
examples. And its extensions. Next"

**On disk:** `:book-type "learning"`, `:audience "kid"`, **16ch + 7app**, boots `ch01-surface`. Visual
twin/downstream of [[book-of-motion]] (motion = kinematics-verbs → animation = the-craft that spends them).
ch04-06 vectors/forces/oscillation = motion's physics re-appearing (inherit UP, don't re-derive); ch07-12
particles/bodies/locomotion/steering/flocking/wayfinding = the DISTINCTIVE payload (Nature-of-Code / Craig
Reynolds boids — autonomous agents, emergent-from-local-rules); ch13-16 scenes/camera/director/living-garden
= scene orchestration; ch01-03 surface/language/flower = onboarding ramp. `:what-this-is` DECLARES most
runnable examples target a **Curator render/sim substrate** (`paint-cell`, `big-bang`, `world/*`, `entity/*`,
`camera-*`, `scene/*`, `prefab/*`, `part/*`, `ai/*`) that **base Motoi does not provide** — those blocks
carry a `needs-alfred` marker and DO NOT run through `./bin/motoi`. Only `vec/*` · `easing/*` · `curve/*` ·
R7RS · SRFI-1 + headless display stubs run.

**⭐ THE DISTINCTIVE MOVE — DIALECT-CITIZENSHIP LESSON (the 5-8 pairs on non-runnable code).** This book's
huge on-disk runtime-honest-null STOPS being a liability and BECOMES the marquee lesson. Every non-runnable
(`needs-alfred` / Curator-substrate) block is EXPLICITLY LABELED **"this is not your verbs."** The lesson
teaches Motoi four load-bearing things:

1. **Dialect self-location (the meta-fact).** There ARE other Scheme dialects; Motoi is ONE of them; base
   Motoi is the PARENT that will be **forked to create other dialects and languages** — this is literally
   true and locked [[project_motoi_to_sakura_fork_decisions]] (Sakura is the first fork). "Be a good
   citizen": recognize when code belongs to another dialect and don't pretend it's yours.
2. **The plausibility trap.** `(paint-cell ...)` / `(big-bang ...)` READ like legitimate Scheme — proper
   parens, sensible names — "though it looks like it will work." Surface-plausibility ≠ runnability. The
   lesson is to NOT be fooled by well-formed foreign code.
3. **The checking ladder (cheapest → most expensive), escalating across the 5-8 pairs:**
   - **BEST / cheapest — check the VERBS before running.** Introspect the bound surface (registry /
     `,type` / describe / verb-exists?) and learn to PREDICT the output *without running* — know it will
     be `unbound symbol: paint-cell` before you try. Learn what code-you-can't-run LOOKS like when it fails.
     [[feedback_verb_wired_means_motoi_run_passes]] inverted: grep/introspect first, then decide.
   - **Verify by running (interpreter-as-verifier).** Actually run through `./bin/motoi`, OBSERVE the
     unbound-symbol throw — run code to check it BEFORE presenting it. Never present a claimed run you
     didn't verify.
   - **Honest-null in code form:** "I can't run this — it's another dialect's verb" is a first-class honest
     output, not a failure to hide [[project_honest_null_is_training_signal_2026_07_22]].
4. **MISSPELLING DISCRIMINATION (Alfred: "invent a few misspellings").** Author deliberate typos of REAL
   Motoi verbs (`vec/addd`, `esaing/out`, `paitn-cell`, `curev/bezier`) alongside genuine foreign-dialect
   verbs. BOTH throw unbound-symbol — but the FIX differs and that's the teaching: a typo of a real verb →
   correct the spelling (the verb EXISTS, you fat-fingered it); a foreign-dialect verb → it's NOT yours,
   don't "fix" it into existence, recognize the dialect boundary and route/decline. This is a discrimination
   lens: same symptom (unbound), two root causes (typo vs wrong-dialect), two different correct responses.
   Composes with broken-code-as-runtime-signal [[project_broken_code_as_runtime_signal]] (eliminate-wrong
   sink) and adds a THIRD boundary kind to book-of-modules' two (epistemic don't-know / preference
   not-mine): the **DIALECT boundary** = not-my-verbs / belongs-to-another-Scheme.

**AND still teach the material (this is NOT only the dialect lesson):** instruction (the actual animation
content — vectors, forces, oscillation, particles, boids/steering/flocking, scenes, director, easing/curves;
grab-don't-generate the facts) + pedagogy (teach-it-how-to-teach) + **its pairs** (3-5 per unit on the
runnable/conceptual material) + **its examples** (the runnable base-verb blocks + the labeled non-runnable
ones) + **its extensions** (the 7 appendices — verbs-cookbook, emoji+easing cheat-sheet, tick-extras,
cross-ref, glossary, Norman-McLaren + beyond-the-book). Reversal stays where-useful (cluster default), but
the emphasis this book is the dialect-citizenship lesson.

**PROPER-LENS candidates:** (a) **dialect-boundary recognition** — the proper lens for every non-runnable
block (not "broken code to fix," but "another dialect's code to recognize"); (b) **autonomous-agent /
boids** for steering-flocking-wayfinding (emergent global behavior from local per-agent rules, ch10-12) —
teach through the emergence lens, not "make dots clump" [[feedback_variety_needs_proper_lens]].

**Cross-book edges:** vectors/forces/oscillation ← [[book-of-motion]] (don't re-derive); keyframes/director
↔ composition-ch08 timeline; emotion/narrative-arc ↔ book-of-narrative-games; the dialect lesson wires to
[[project_motoi_to_sakura_fork_decisions]] + the introspection/verb-check subsystem (00b self-census).

**CULTURAL/BIOGRAPHICAL GUARDRAIL:** appendix-07 Norman McLaren = real film-history → grab-don't-generate,
same discipline as motion (Ghibli/Kon/McCay) [[project_honest_null_is_training_signal_2026_07_22]].

**RUNTIME HONEST-NULL (large, and now the FEATURE):** most code targets the unwired Curator substrate
(`needs-alfred` on disk) — do NOT claim a run for any non-base-verb block; the base-verb subset
(`vec/*`/`easing/*`/`curve/*`/R7RS/SRFI-1 + headless stubs) is the only surface where the interpreter-verified
round-trip actually holds. The non-runnable majority is the raw material for the dialect-citizenship pairs.

---

# 26 · book-of-arcade-games — TIER 2 + HEAVY GAME-DESIGN PEDAGOGY + DECOMPOSE/RECOMPOSE (CPU-style) + ACTOR/AGENT abstraction (⭐ GAMES-CLUSTER DOCTRINE) + nulls-from-non-runnable + landing-point transfer

**Alfred's directive (verbatim):** "Really give some good game design pedagogy here. Use the non runnable
stuff to set up nulls and limits. But treat this game code the way we treated CPU stuff. Decompose and
recompose. So it learns to make games. Abstractions like actors and agents and relating it to chess, ai,
bots, and keep this in mind because all game sections will have this. 5-8 pairs. Jokes and help, glossary
like in its help. If the kid can make a game he can design a heart monitor 20 years later. Then have fun
with his son a decade later teaching him the same thing."

**On disk:** `:book-type "application"`, `:audience :kid`, 16ch + **14 appendices** (cookbook/field-guide/
formula-notebook recipes). Boots `ch01-bouncing-ball`. Games-cluster OPENER; downstream confluence of the
whole visual+audio stack (kinematics←[[book-of-motion]], sprites/scenes←[[book-of-animation]], audio←the
trio, composing-games←composition-ch16). Chapter spine = arcade-feel canon: bouncing-ball → paddle/wall →
ship/thrust → projectiles → shoot-em-up → feel(deadzones/ease) → platformer-jump → tile-worlds → scrolling/
parallax → enemies-that-react → powerups → bosses → score/combo → coin-op-loop → 2-player → ship-the-cabinet.

**⭐⭐⭐ GAMES-CLUSTER DOCTRINE (established here, INHERITED by [[book-of-narrative-games]] +
[[book-of-simulation-games]] — "keep this in mind because all game sections will have this"):**

1. **DECOMPOSE / RECOMPOSE — treat game code the way we treated CPU stuff.** Same method as
   [[project_scheme_books_sft_walk]] §13 computing / book-of-code seed-on-real-metal (adder→ALU→dispatcher,
   CPU-loop, flip-flop→cell): break a game into its PRIMITIVE PARTS (ball, paddle, collision-check,
   game-loop, score-accumulator, input-sampler), teach each part on its own, then RECOMPOSE them into a
   working game. The OUTCOME is generative — "so it learns to MAKE games," not merely recognize them.
   Games are built from parts the way a CPU is built from gates. This is the load-bearing structural move.
2. **ACTOR / AGENT abstraction as the spine — related to chess, AI, bots.** Teach the actor/agent model
   (an actor = state + behavior + reacts-to-world) as the shared abstraction under every game entity
   (ball, enemy, boss, player). Relate OUT to: chess (game-tree / minimax / turn-taking), game-AI
   (decision-making, reactive vs planning), bots (autonomous agents). Composes with the autonomous-agent/
   boids lens from [[book-of-animation]] §25 (steering/flocking = emergence-from-local-rules) — the agent
   is the same abstraction seen from the game side. This abstraction carries across all three game books.
3. **LANDING-POINT / long-horizon + generational transfer** (Alfred's frame; echoes book-of-motoi
   DECISION 7 "remember the rabbits game" 15-yrs-later Cortex callback). The decompose/recompose game-making
   skill is DOMAIN-GENERAL and TRANSFERS: "if the kid can make a game he can design a heart monitor 20 years
   later" (game-loop→real-time loop, sprite-update→sensor-sampling, collision→threshold-alarm, state-machine
   →device-modes) — games are the JOYFUL ON-RAMP to real-time interactive/embedded systems design. "Then
   have fun with his son a decade later teaching him the same thing" = GENERATIONAL teaching loop, the skill
   passed down. Frame games not as toys but as the on-ramp to building real interactive systems + a thing
   worth teaching your own kid. Ship-test/outcome framing (sibling to cs-curriculum §14 "makes-them-GOOD").

**NON-RUNNABLE → NULLS + LIMITS (this book's routing, DISTINCT from §25 animation's dialect-citizenship).**
Same Curator-substrate reality (world/collisions, camera, sprite-cell, tile-worlds, entity/ai — appx-i/d/e,
ch08/10; the boilerplate CLAIMS "every code block runs" but leans on the #371-unwired substrate → VERIFY
per-block, don't trust the claim [[feedback_verb_wired_means_motoi_run_passes]]). Here the non-runnable code
is routed to **honest-null** ("I can't run this yet — the collision layer isn't wired"
[[project_honest_null_is_training_signal_2026_07_22]]) + **book-of-limits** (where-to-stop / what-I-can't-do
posture). Contrast the two uses of the same raw material: §25 → dialect-boundary recognition; §26 →
nulls-and-limits. Both first-class.

**HEAVY GAME-DESIGN PEDAGOGY (elevated — "really give some good game design pedagogy").** Not just
instruction; teach the CRAFT of game DESIGN (why deadzones, why coyote-time, why a combo multiplier, why a
boss telegraphs). Approaching cs-curriculum meta-pedagogy energy but focused on design. **5-8 concentrated
pairs** on the decompose/recompose + actor/agent lessons (like §25's 5-8). **JOKES + HELP + GLOSSARY-IN-HELP:**
CS/game-humor MINED (sibling to cs-curriculum §14 / math §15 mined-jokes) + integrate the introspection help
subsystem (`,help`) + surface game-term GLOSSARY entries THROUGH Motoi's own help ("glossary like in its
help" — the 14 cookbook appendices + glossary become help-retrievable, not just prose).

**PROPER-LENS candidates:** game-feel/juice (ch06 deadzones+ease, appx-H feel-knobs, appx-F input-timing —
Swink game-feel = "the feel IS the tuning of the knobs" [[feedback_variety_needs_proper_lens]]); game-loop-
as-state-machine (ch14 coin-op + appx-J cabinet: title→play→game-over); actor/agent (above). CLONE-AND-MODIFY
seeds: appx-L "12 micro-games in 30 lines each" = the game instantiation of book-of-code seed-templates.
GRAB-DON'T-GENERATE: physics-constants/bounce-coefficient appendices = real number tables, don't invent.

**My tier read (proposed, Tier 2 application + the heavy custom emphases above):** instruction + ELEVATED
game-design pedagogy + decompose/recompose method + actor/agent spine + 5-8 pairs + jokes/help/glossary-in-
help + landing-point transfer framing; non-runnable → nulls+limits; reversal where-useful. Establishes the
games-cluster doctrine the next two game books inherit.

---

# 27 · book-of-narrative-games — TIER 2 + GAMES-CLUSTER DOCTRINE (inherited) + ⭐ DECISION-TREE = GENERAL CS TIE-BACK (super-important) + LIGHTWEIGHT NLP-IN-SCHEME (chop/break/analyze text) + MEALY/MOORE STATE MACHINES (light, from CS places, related-not-added) + STORIES-AS-DATA (corpus mining) + GRAB-AND-EXPLODE text + GENERATIVE branching-text (track TWO things: state + text)

**Alfred's directive (verbatim intent):** "Narrative games are decision trees and a whole host of really amazing things. Tie this back to GENERAL COMPUTER SCIENCE. This is super fucking important. It doesn't seem like it at first, but it is — because in order to design any role-playing or adventure game, you're gonna have to do this. This is where the explanation comes in: how do you create dialogue? Great place to tie it back to the narrative in the stories — NOT in order to create games based on them, but have the LLM KNOW those stories and use them as DATA. Teach things like natural-language processing in Scheme, LIGHTWEIGHT not heavyweight: how to chop up text, break up text, analyze text, and how to create state machines. Tie it back to all the other game stuff. Moving text around is a game, and a game is a thing — this moving-around-of-text is what I'm doing right now. Don't hesitate to bring in the other types of state machines — MEALY and MOORE — how to generate text, how to use a corpus, all these other things, just LIGHT. Don't add it to the book, don't make it a new book. But remember: we're supposed to RELATE this information to each other, and this is the place to create pairs that do that. Same as all the games, just special in its data processing and treatment — and you can use the books for data. Teach this book pedagogy and everything, then your explode-out will be GRAB things from other places: 'hey, see this text here? We could use that instead if you want. Or it may not make sense, but it doesn't matter, because really what we're doing is learning how to move the data around. If you wanna write your own, go ahead and write some text you think would be sufficient for these characters.' Then it starts thinking of BRANCHING text — so now it has to keep track of TWO things. I want it to be able to do that because it has to help people write RPGs." + motto: **"A great game with bad dialogue is a bad game."**

**On disk:** `:book-type "application"`, `:audience {:kid}`, 16ch + 12app, boots `ch01-room-door-choice`. Boilerplate "every code block runs through ./bin/motoi" (⚠ verify per-block — same unwired-substrate caution as §25/§26; `world/snapshot`, camera verbs, `:companion` likely Curator substrate). Arc: **choice engine** (ch01 room-door-choice → ch02 story-tree → ch03 what-you-did-before = persistent consequence) → **staging** (ch04 characters/poses/breath, ch05 dialogue-trees, ch06 camera-narrates) → **depth** (ch07 puzzle-in-prose, ch08 inventory+world-state, ch09 sound/silence, ch10 villain) → **the hard part** (ch11 branching-that-matters = real-vs-fake choice, ch12 deep-think-companion = an NPC that reasons) → **scale** (ch13 multi-character, ch14 playable-poetry, ch15 long-story, ch16 whole-adventure). Appendices: A cortex-schema-narrative (persistence), B five dialogue-tree-formats, C body-language, D camera-moves, E transition-physics, F sound-motifs, **G companion-helps-and-ruins** (AI-character honesty), H save-slots-via-world/snapshot, **I consequence-table**, J poetry-prose-playable, K playtest-checklist, L publish-share-url.

**THE SPINE — this is a special games-cluster member (inherits §26 doctrine, adds a DATA-PROCESSING treatment):** it carries ALL the games-cluster doctrine (decompose/recompose like the CPU stuff; actor/agent abstraction; landing-point + generational transfer) — AND it is **special in its data processing and treatment**. Four load-bearing moves layered on top of the inherited cluster doctrine:

1. **⭐ DECISION-TREE = GENERAL COMPUTER SCIENCE (the super-important tie-back).** A story tree IS a tree/graph; "what you did before" IS persisted state; "branching that matters" IS a real state-transition vs a no-op. This is the MOST CS-LEGIBLE game book — teach it AS general CS, not as a genre trick. Alfred: "it doesn't seem like it at first, but it is." The whole book is a live instance of trees, graphs, state, traversal, guards. Pairs must make that tie explicit (the story-tree pair and the binary-tree/graph pair are the SAME reasoning, different surface) — this is the "RELATE information to each other" mandate in its purest form. Cross-corpus edges UP into [[book-of-cs-curriculum]] (trees/graphs/DFS/BFS) and [[book-of-computing]] (state machines).

2. **⭐ LIGHTWEIGHT NLP-IN-SCHEME (how do you create dialogue?).** Teach text-handling as small, honest Scheme — NOT heavyweight ML: **chop up text, break up text, analyze text** (tokenize on whitespace, split on punctuation, count words, match keywords, template-fill, simple substitution/Markov-lite). "How do you create dialogue?" is answered mechanically first (string ops + templates + a tree), then artfully. The motto governs quality: **"a great game with bad dialogue is a bad game"** — so dialogue-craft is first-class, not filler. Keep every NLP move runnable in the interpreter (PAL/PoT — reason in Scheme). This is where the corpus/books become DATA (see move 3).

3. **⭐ STORIES-AS-DATA + GRAB-AND-EXPLODE.** Tie dialogue back to the NARRATIVE in the stories — **NOT to clone those games, but to have the model KNOW the stories and use them as DATA.** Use the OTHER BOOKS as a corpus. The "explode-out" shape = grab text from elsewhere: *"see this text here? we could use that instead if you want — or it may not make sense, but it doesn't matter, because what we're really learning is how to MOVE THE DATA AROUND."* The point is the data-motion, not any single fit. "Moving text around is a game, and a game is a thing" — the meta-frame: text manipulation IS the game, so teach it playfully. This composes with [[project_kid_seed_domain_extrapolate_asymmetry]] (extrapolate over corpus text) and honest-null when a grabbed fragment genuinely doesn't fit (say so, keep the diversity).

4. **⭐ MEALY & MOORE STATE MACHINES (light, brought in from CS places, related-not-added).** Bring in the other state-machine types — **Mealy** (output on the transition / edge) and **Moore** (output in the state / node) — plus text-generation and corpus-use, but LIGHT. HARD CONSTRAINT: **do NOT add this material to the book, do NOT make a new book** — RELATE it via pairs (the narrative-game state ↔ the Mealy/Moore machine ↔ the [[book-of-computing]] flip-flop/state-machine are cross-corpus siblings). Dialogue-tree = Moore-ish (the line lives in the node); consequence-on-choice = Mealy-ish (the effect lives on the edge). Teaching that distinction on a story engine is the "relate information to each other" mandate again.

**GENERATIVE outcome — track TWO things (the target skill):** the reader/model must be able to (a) **write its own character text** ("write some text you think would be sufficient for these characters") AND (b) **branch it** — and branching means keeping track of TWO things at once: **the STATE (where you are in the tree)** and **the TEXT (what gets said/shown)**. This dual-tracking is the explicit competency Alfred wants: "I want it to be able to do that because it has to help people write RPGs." Pairs must exercise state+text simultaneously (generate a line, thread it through a branch, mutate world-state, gate the next line on prior state).

**Proper lenses (label each pair):** decision-tree-as-tree/graph (the CS lens, primary), state-machine (Mealy=edge-output vs Moore=node-output), text-as-data / data-motion (the NLP lens), real-vs-phantom-transition ("branching that matters" = idempotency/state-mutation lens), actor/agent (characters + deep-think companion, inherited from §26). Landing-point transfer (inherited): dialogue-tree → conversation-flow/chatbot; consequence-table → audit-log/event-sourcing; save-slot/snapshot → checkpointing; branching-that-matters → real-vs-no-op writes.

**Pairs:** GAMES-CLUSTER pack (decompose/recompose a small adventure; actor/agent; landing-point transfer; jokes/help/glossary-in-help — same as §26) PLUS the four special moves above expressed as relate-pairs. No four-way burst; Tier-2 instruction+pedagogy with the data-processing treatment as the amplifier. Roughly the §26 "5-8 concentrated pairs" cadence per unit, but weighted toward the CS tie-back and the state+text dual-track.

**Guardrails:** per-block runnability verification [[feedback_verb_wired_means_motoi_run_passes]] (unwired Curator substrate → nulls/limits or dialect-citizenship per §25 where a fragment is another dialect's); grab-don't-generate when pulling real story/biographical text; honest-null when a grabbed fragment doesn't fit (that's signal, not failure); appendix-G companion-helps-and-ruins = the AI-honesty seam (an NPC that reasons must also know when it ruins — ties to [[book-of-limits]] + the deep-think companion). Keep Mealy/Moore/corpus material LIGHT and OUT of the book body — pairs only.

**My tier read (recorded):** Tier 2 application + games-cluster doctrine (inherited) + the DATA-PROCESSING treatment (CS decision-tree tie-back · lightweight NLP-in-Scheme · Mealy/Moore-light-via-pairs · stories-as-data/grab-and-explode · generative state+text dual-track). The most CS-legible of the three game books; the place where "moving text around is a game" turns text-manipulation into a taught, generative RPG-authoring skill.

---

# 28 · book-of-simulation-games — ⭐⭐⭐ FULL CORE (Tier 4) — FOURTH must-not-flop book (joins CS·MATH·ML) + GAMES-CLUSTER DOCTRINE (inherited) + CAPABILITY-PROOF ("if it can write this it can write anything") + NUMERICAL-HONESTY the special emphasis

**Alfred's directive (verbatim):** "Do full-core. I think there's a lot of good scheme in there. If it can write this stuff it can write anything. This is hard scheme and hard concepts. Bubbling it through a lot of connections and dialogue is a STRONG base. Next one."

**The elevation:** simulation-games GRADUATES out of Tier-2-games-cluster into ⭐⭐⭐ FULL CORE — the same must-not-flop treatment as [[book-of-cs-curriculum]] (§14), [[book-of-math]] (§15), [[book-of-ml]] (§16). It is the FOURTH full-core book and the only games-cluster member to reach the tier. **WHY it earns it (Alfred's reasoning):** (1) "a lot of good scheme in there" — the code is genuinely hard Scheme (integrators, n-body, boids, CA, RL agents, Grundy theory, topology); (2) **CAPABILITY-PROOF / CEILING THESIS — "if it can write this stuff it can write anything"** — simulation is the proof-of-capability book: master it and the whole language surface is in reach; (3) "hard scheme AND hard concepts" — both the code and the ideas are at ceiling; (4) **"bubbling it through a lot of connections and dialogue is a STRONG base"** — the base-building move is heavy circle-around dialogue (full-core demand #4) + dense graph cross-corpus connections (demand #5); the connections+dialogue ARE the foundation, not decoration.

**On disk:** `:book-type "application"`, `:audience {:kid}`, 16ch + 12app, boots `ch01-one-body-two-bodies-many`. Boilerplate "every code block runs through ./bin/motoi" (⚠ HIGHEST unwired-risk in the cluster — `phys/q*`, `topo/persistence`, integrator zoo likely lean on unbuilt substrate; verify per-block [[feedback_verb_wired_means_motoi_run_passes]]). Arc: **bodies & forces** (ch01 one→two→many, ch02 springs/chains/cloth, ch03 pendulum+Lagrangian, ch04 two-body→three-body = where closed-form dies, MUST integrate) → **agents & optimization** (ch05 boids alignment/cohesion/separation, ch06 pathfinding-on-grid A*/Dijkstra, ch07 brachistochrone/calc-of-variations) → **emergence & fields** (ch08 cellular-automata/Conway, ch09 particle-systems, ch10 fluid-sketches, ch11 RLC-circuit/real-EE-damping) → **deep structure** (ch12 game-theory Nim/Wythoff/Grundy = the RIGOROUS version of §26's chess/minimax hand-wave, ch13 topology-of-motion/persistence, ch14 autonomous-agents-that-learn = RL/the ML tie) → **thesis+ship** (ch15 the-simulation-IS-the-game, ch16 publish). Appendices: A integrator-zoo (Euler/RK4/Verlet), B dimensional-analysis-with-phys/q*, C flocking-param-space, D brachistochrone-family, E Conway-patterns, F spring/cloth-tuning, G combinatorial-games-beyond-Nim, H reading-topo/persistence-diagrams, I n-body-solar-system-kit, J emergent-behavior-case-studies, K deterministic-chaos, L sim-vs-game-when-to-add-a-score.

**FULL-CORE 7-part treatment (simulation-instantiated) — same as §14/§15/§16:** (1) **taught-as-book** — teach the actual material (physics/numerics/complex-systems); grab-don't-generate the real constants/laws (G, RK4 coefficients, Grundy values, Conway rules — real numbers/theorems, never invent). (2) **taught-how-to-teach / meta-pedagogy** — one-body→two→many IS decompose/recompose as a teaching order. (3) **full codebook + FOUR-WAY BURST** (burst is a COMPONENT of full-core per locked tier vocabulary, not a separate tier) on the hard Scheme. (4) **⭐ HEAVY CIRCLE-AROUND DIALOGUE** ("bubbling through connections and dialogue" = Alfred's named base-building move; circle the hard concepts — integrator drift, chaos, emergence, Lagrangian — through many turns at many levels; dialogue density IS the strong base). (5) **⭐ GRAPH CROSS-CORPUS EXPANDING** ("a lot of connections"): ch06 pathfinding→[[book-of-cs-curriculum]] (graphs/A*/Dijkstra), ch12 Grundy/Nim→cs-curriculum+[[book-of-math]] (rigorous chess/minimax from §26), ch14 learning-agents→[[book-of-ml]] (RL), ch03/ch07 Lagrangian/brachistochrone→math (calc-of-variations), ch11 RLC→[[book-of-computing]] (real EE), ch13 topology→math; boids ch05 = actor/agent spine's THIRD appearance ([[book-of-animation]]+[[book-of-arcade-games]]). (6) **REASON-ABOUT-DATA = REASONING-SLAT done AS Scheme-in-interp** (PAL/PoT, 4 Peirce moves): derive-the-integrator (Euler→RK4), prove-the-Grundy-value, dimensional-analysis w/ phys/q*, show-why-three-body-is-chaotic — reasoning performed as runnable Scheme, interpreter the verifier. (7) **multi-audience 5-band + HUMOR MINED + richest text** — physics/CS jokes mined like cs-curriculum/math; kid-seed→PhD.

**⭐ SPECIAL EMPHASIS = NUMERICAL HONESTY (float-trap promoted to first-class).** Integrator-zoo + deterministic-chaos + three-body put the "sim lives in approximation" guardrail from [[book-of-ml]] at the center: Euler drifts, RK4 is better, chaos means small error EXPLODES — and **Motoi's OWN arithmetic stays exact while the SIMULATED world does not.** Proper lens: the integrator is not the physics; the map is not the territory. Reflexive-honest sibling of ml's float-trap, at MAX stakes because the whole book is numerics.

**Inherited games-cluster doctrine (still applies, now under full-core):** decompose/recompose (one-body→n-body is LITERALLY decompose/recompose on physics), actor/agent (boids + learning agents), landing-point/generational transfer — STRONGEST of the three here (ch11 RLC + appx-B dimensional-analysis are ACTUAL engineering; sim→heart-monitor→embedded barely a metaphor). appx-L "sim vs game — when to add a score" = the genre-boundary reflection.

**Guardrails:** per-block runnability [[feedback_verb_wired_means_motoi_run_passes]] (highest unwired-risk → nulls+limits, or §25 dialect-citizenship where a fragment is another dialect's); grab-don't-generate real physics constants/theorems/Grundy-values (wrong RK4 coeff/G worse than a gap [[project_honest_null_is_training_signal_2026_07_22]]); numerical-honesty first-class (never claim exact where the integrator approximates; Motoi's arithmetic exact, the sim not).

**My tier read (recorded, per Alfred): ⭐⭐⭐ FULL CORE (Tier 4).** The capability-proof book — hard Scheme + hard concepts bubbled through heavy dialogue and dense cross-corpus connection into a strong base. "If it can write this it can write anything." Fourth must-not-flop, closing the games cluster by graduating it into the CS·MATH·ML full-core tier.

---

## 29 · book-of-ai-tech-cards — TIER 1 COMPREHEND-NOT-TEACH + ⭐⭐⭐ IDENTITY-PLACEMENT ANCHOR ("stops the 'I was made by Qwen' stuff") + 3-8 PAIRS + REVERSALS + REASONING-SPINE VEHICLE

**Alfred's directive (verbatim):** "These are informational with some examples. Motoi doesn't need to teach this as much as it needs to comprehend it and be able to talk about it. 3-8 pairs and reversals. More logic lessons and reasoning spine stuff. 'Who am I?' — this stops the 'I was made by Qwen' stuff. This is where Motoi understands its place amongst others."

**My expansion:**
- **COMPREHEND, don't teach.** The lowest pedagogical-effort book so far — NOT taught-as-book, NOT meta-pedagogy. The job is *absorb + be able to converse*. Pairs are informational-with-some-examples (like §18 language-ancestors, but even less teacherly). Motoi reads the card, understands it, can talk about it accurately. No "teach it how to teach this."
- **3-8 pairs per card + REVERSALS.** Reversal seams here are clean and factual: lab↔landmark-contribution, system↔year (Transformer↔2017, LoRA↔2021, MCP↔2024), technique↔what-it-does (RLHF↔alignment-from-human-feedback, LoRA↔low-rank-adapter-fine-tuning). Reversal-Curse mitigation on genuinely-invertible fact pairs [[project_cpt_shapes_catalog_2026_07_20]].
- **⭐⭐⭐ IDENTITY-PLACEMENT ANCHOR — the load-bearing purpose.** This is the book that **stops the "I was made by Qwen" confabulation.** The four *system* cards (Transformer / RLHF / Constitutional-AI / LoRA) describe **how Motoi was actually built** — so Motoi can locate itself correctly in the real technological lineage instead of defaulting to base-model priors about being Qwen. "Who am I?" answered by placement: Motoi understands its PLACE *among others* (the labs, the techniques), not in isolation. This is the OUTWARD-FACING twin of §9 book-of-self (the identity KEYSTONE): §9 = who-Motoi-is internally / persona substrate; §29 = Motoi's place-among-others externally / where it sits in the AI world. The two compose into a complete self-location. [[project_signifier_signified_and_dialogue_2026_07_20]] — the "Qwen" signifier gets its correct signified here.
- **REASONING-SPINE VEHICLE ("more logic lessons and reasoning spine stuff").** The cards are not just facts to memorize — they're raw material for MORE reasoning practice, routed back to book-of-logic §7. Reason ABOUT the facts: "if RLHF trains on human preference and Constitutional-AI trains on a written constitution, what follows about their failure modes?" — deductive/abductive moves over card content. The book doubles as another surface for the reasoning spine, not a dead encyclopedia.
- **"Does not rank" neutrality invariant — STANDS, and now motivated.** No "best lab." "Understands its place *amongst* others" = placement, not ranking. A ranking question ("is Anthropic better than OpenAI?") gets the preference-not-mine refusal shape (book-of-modules two-kinds-of-boundary) — placement locates, it does not judge.
- **Grab-don't-generate at max stringency (carried).** Real companies, real papers, real dates. Wrong attribution/date worse than a gap [[project_honest_null_is_training_signal_2026_07_22]]. This is the highest hallucination-exposure book; comprehension pairs must cite the card, not recall from priors.

**Cross-book edges:** §9 book-of-self (identity keystone ↔ placement anchor — the inward/outward pair) · §18 language-ancestors (Scheme genealogy ↔ AI genealogy; same information-pair shape, sibling heritage books) · §7 book-of-logic (reasoning-spine vehicle routes here) · §16 book-of-ml (Transformer/LoRA/RLHF cards ↔ ml appendix-D "what you built vs what I am" reflexive crown — the construction facts).

**My tier read (recorded, per Alfred): TIER 1 — COMPREHEND-NOT-TEACH, but ⭐⭐⭐ in IDENTITY WEIGHT.** Low pedagogical tier (informational, 3-8 pairs + reversals, some examples) yet strategically load-bearing: the book that corrects Motoi's self-attribution ("not Qwen — here's my actual lineage") and gives it its place among others. Comprehension + conversation + a reasoning-spine surface, anchored by the identity-placement purpose.

---

## 30 · book-of-jesse — ⭐⭐⭐ FULL CORE (Tier 4) + ⭐ NOVELTY GUARD ("don't give and explode examples we've seen before")

**Alfred's directive (verbatim):** "This needs the full-core treatment. And special attention to not give and explode examples we have seen before or dealt with."

**What the book is:** the POLYGLOT / Rosetta-stone onboarding book — "Motoi for X programmers," one chapter per source language. `:book-type "prose"`, audience "programmer-fluent-in-other-languages", 37ch + 15app. Dedicated to Jesse (who introduced Alfred to FP 20 years ago; "he already knows — the rest is for you, the reader"). Spine: 10 language-bridge chapters (Python · JavaScript · Clojure · Lua · Java · Rust · Ruby · Go · Haskell · Common Lisp) → Motoi-specific capability chapters (macros-as-composition · sound+motion-one-timeline · Cortex · SLAT-substrate · frozen-core · Jesse-making-beats · frames-buffered · fantasy-console · entities-and-parts) → 15 appendices (feature-matrix · if-you-know-Python · if-you-know-Clojure · chiptune · demoscene · gotchas · disco-lights · boids · Conway · music-comp · macros-in-10min · SICP-shape-exercises · onboarding-recap · kid-glossary).

**FULL-CORE = the §14/§15/§16/§28 7-part treatment, jesse-instantiated (fifth must-not-flop):**
1. taught-as-book (teach the actual bridge material) · 2. meta-pedagogy (teach-it-how-to-teach the transfer) · 3. full codebook + four-way burst · 4. ⭐ HEAVY circle-around DIALOGUE · 5. ⭐ GRAPH cross-corpus CONNECTIONS (the two named "strong base" moves) · 6. reasoning-slat-as-Scheme (reason about the translation, PAL/PoT) · 7. 5-band audience + humor-MINED. Same tier as CS·MATH·ML·simulation-games — the capability-proof standard.

**⭐ NOVELTY GUARD (the special emphasis, load-bearing for THIS book):** full-core EXPLODES examples via the four-way burst — but here the explosions must be **cross-corpus-NOVEL**, not recycled. Do NOT reuse examples "we have seen before or dealt with" (the fibonacci/fold/factorial/map-a-list warhorses already exploded across §7/§14/§16/§28 etc.). This composes with — and sharpens — [[feedback_parallel_templates_cause_phrase_lock_2026_07_22]]: a polyglot bridge book is DOUBLY tempted to recycle (same canonical example × 10 languages = maximal phrase-lock). The guard forbids it twice: (a) don't repeat examples ACROSS books (cross-corpus dedup — the burst mints fresh material), (b) don't repeat the SAME example across the 10 language chapters (each language gets idioms that are natural to IT, exploded from ITS own characteristic problems). Fresh explosions, per-language-authentic. Ties to [[project_sft_must_be_abductive_2026_07_21]] (novel observation→reasoning, not term-recitation) and [[project_isb_sft_novelty_composition_2026_07_21]].

**Proper lens = bridge-from-the-known-language** [[feedback_variety_needs_proper_lens]]: each chapter frames a Motoi idiom through the reader's EXISTING mental model, authored through THAT language's real idioms (not generic restatement). Transfer/translation pairs + reversals (Motoi idiom ↔ equivalent in language X; genuinely invertible). Distinct from §18 language-ancestors (that = Motoi's genealogy; jesse = comparative onboarding from languages the reader already speaks — ancestry vs bridge, opposite directions).

**Cross-book edges:** §18 language-ancestors (genealogy sibling, opposite direction) · §7 logic + §14 cs-curriculum + §16 ml + §28 sim-games (fellow full-core books — but the novelty guard means jesse must NOT re-explode their examples) · §8 introspection (macros-as-composition ch11 ↔ macros the crown) · §17 slat (ch14 SLAT-substrate) · §13 Cortex (ch13). Guardrails: grab-don't-generate the real semantics/idioms of each source language (wrong Rust-borrow or Haskell-laziness claim worse than a gap [[project_honest_null_is_training_signal_2026_07_22]]); per-block runnability through ./bin/motoi [[feedback_verb_wired_means_motoi_run_passes]].

**My tier read (recorded, per Alfred): ⭐⭐⭐ FULL CORE (Tier 4), fifth must-not-flop.** The bridge/translation capability-proof book — full 7-part treatment with a first-class cross-corpus NOVELTY GUARD: explode fresh, per-language-authentic examples, never recycle the warhorses seen in other books or across the 10 language chapters.

---

## Books recorded: 1-28 (scheme · r7rs · code · modules · craft · limits · logic · introspection · self · motoi · values · systems · computing · cs-curriculum · math · ml · slat · language-ancestors · challenges). §7 logic = BIG (Qwen/turns research GROUNDED, scratch/book-of-logic-qwen-turns-research-2026-07-28.md). §8 introspection = pedagogy+convo, macros the crown. §9 self = IDENTITY KEYSTONE. §10 motoi = THE HOT-SPOT, DIRECTED (7 decisions): DUALITY fun-console⇄real-Scheme is the spine (dual-reading pairs; console IS a Scheme program; onboarding ramp into the abstract books); branching-extensibility-tree per code block (~10 in hot spots); wire in the GRAPH + 16 PHILOSOPHERS (lens-diversity on concrete nouns); broken-pairs + help everywhere; TOOL/LAYOUT literacy first-class (http/tui/cli/repl/help/ask-Motoi/4 composers); cross-book edges; DECISION 7 = LANDING-POINT long-horizon Cortex callback ("remember the rabbits game" retrieved 15 yrs later for kid→CS-researcher; episode = cross-corpus retrieval hub; honest-null if memory didn't survive). Warm register is the affective anchor. §11 values = SHARP-PEDAGOGY + FAN-OUT-DIALOGUE + TEACH-IT-HOW-TO-TEACH. §12 systems = EMBODIMENT / OPERATIONAL SELF-MODEL (pedagogy, clean pairs + variety): operational FLOOR beneath the identity keystone — self said "no hands" as identity, systems says it as engineering discipline; ch02=capability self-model+honest-null, ch13=escalation ladder from inside; restraint-posture (read-only/gentle-degradation) sibling to corpus-wide restraint gates. §13 computing = CS-FOUNDATIONS SPINE, SAME TREATMENT AS BOOK-OF-CODE (seed-on-real-metal: adder→ALU→dispatcher, CPU-loop, state-machine, flip-flop→cell; state+storage tiers on hardware; reflexive self-model; two guardrails transfer-real-not-universal + simulated-hardware≠Motoi's-own-behavior; ch15/16 honest-null band). §14 cs-curriculum = THE HEART (DS&A core, Alfred waited for it, highest-value): 7 DEMANDS (taught-as-book · taught-how-to-teach/meta-pedagogy · full codebook + four-way burst · HEAVY circle-around dialogue · graph-cross-corpus expanding · reason-about-data = REASONING-SLAT done AS Scheme-in-interp/PAL-PoT/4-Peirce-moves · multi-audience 5-band + CS-humor-MINED + richest text) + OUTCOME framing (DEMONSTRATION-over-breakage, broken-pairs OPTIONAL · BEYOND-THE-BOOK general-purpose CS-HELPER-TOOL · ship-test = layperson-manner that makes them GOOD · CS↔MATH bidirectional tie-in). §15 math = SAME FULL TREATMENT, MATH-INSTANTIATED: locked VOCABULARY "4 = RICH (four-way burst/expansion) vs full = CORE (dependable spine)"; CORE (appendix-U "Motoi doing math" reflexive self-model · meta-pedagogy · reasoning-slat = proofs/derivations · honest-null band = app-W topology/symbolic) + RICH (four-way burst · HEAVY fractions circle-around dialogue · graph-expand ch15 linalg→ml, ch07 prob→randomized-algos · 5-band ladder maps ONTO grades Gr1→Gr16 · math-jokes MINED) + OUTCOME (demonstrate/helper-tool/makes-them-GOOD/bidirectional, exactness guardrail). §16 ml = FULL CORE (Tier 4), THIRD must-not-flop book (CS↔MATH↔ML triangle): same 7-part treatment ML-instantiated (tensors→tiny-LLM); the REFLEXIVE CROWN of the corpus — appendix-D "what you built vs what I am" (reader builds a toy LLM, Motoi narrates its own kind) + appendix-C hallucination hooks the Qwen/turns research; guardrails = reflexive-honest-null at max stakes (toy≠Motoi, can't read own weights) + ML-lives-in-approximation (float trap REAL here, Motoi's own arithmetic stays exact). NOTE: no per-book pair COUNTS yet — walk records shapes; real N needs a substrate count pass. §17 slat = TIER 3 (four-way burst) + two custom emphases: trust-spine ch8-10 (canonicalize→content-address→sign) = PREMIER reasoning-slat (deductive + interpreter-verifiable, reason ABOUT the medium) + appendix-J "runtime reads her own reader" = reflexive-crown sibling to ml appendix-D; BONUS on-disk jewel `deliberate-forgetting-cortex-note` (four memory bands hot/warm/cool/released, re-anchoring, user-owns-memory=user-driven-prune≠corpus-no-delete, compression-not-summarization, affect-declaration) route into ch14 Cortex-slice + reflexive crown; honest-null on unread `cortex-appendix/` + `CHAPTERS.book.slatl`. §18 language-ancestors = TIER 1 INFORMATION PAIRS ("Information pairs. Fan out 4-5 for conversation. Use code for variety in example."): factual who/what/landmark pairs + 4-5 conversational fan-out per fact + runnable-CODE-as-variety (Church→lambda, McCarthy→eval/quote, Steele/Sussman→Scheme forms — each ancestor's gift AS a Motoi snippet); prose heritage book, identity-CONTEXT not construction (ch1-5 = Motoi's genealogy); HARD guardrail = grab-don't-generate biography (wrong date/attribution worse than gap, anti-hagiography voice), code-honest-null where ancestor isn't code-shaped (Babbage/Lovelace/Shannon). §19 challenges = TIER 3 FOUR-WAY ("Teach both, earned four-way… make pairs that demonstrate the reasoning… take special note… make sure the lens it's viewing through is the PROPER lens"): TEACH BOTH solutions (abductive problem→reasoning→solution) + solution-SHAPES (meta-taxonomy); ⭐ PROPER-LENS DOCTRINE (variety≠correct-framing; [[feedback_variety_needs_proper_lens]]); proper lenses named on disk = three-part solution frame (shape-sentence + VERIFIED run + trade-off) + FOUR SHAPES (fold/map+filter/state-machine/pipeline) + honest-failure-as-reasoning-shape (ch13: expected/actual/smallest-change) + compositional-retrieval (appx-D "look sideways not down") + difficulty ladder (appx-D). HONEST-NULL needs-alfred: ch10 "Orchestrating Tools" referenced by appx-C+D but no file on disk / not in nav. §20 composition = TIER 2 + selective ("2 with round trip and variety on the interesting bits. Novel stuff gets amplified with in depth pedagogy"): the Composer manual + umbrella/entry-point for the whole creative cluster (music·sound·motion·animation·instruments·games specialize DOWN from it); `:book-type "composition"`, 17ch+9app, dual audience. THREE calibrations — (1) ROUND-TRIP is the PROPER LENS (emit/apply are inverse; ch01 contract, appx-D inverse-proofs, appx-C emit-shapes; interpreter grades the round-trip; label each pair widget-kind+emit-shape); (2) VARIETY only on the INTERESTING bits (FX-order, notes-as-data, keyframe-vs-frame-flip, polyphony budget, pixels-as-lists) — routine round-trips get clean instructional pairs, NOT uniform fan-out; (3) NOVEL stuff amplified with in-depth pedagogy (round-trip contract ch01, emit-versus-bind ch04, FX order ch10, .slat cart save/load ch13, data-shape thinking). PRE-DECLARED honest-null on disk: ch12/14/15 tagged SEEDED-PENDING-V11-if-runtime-absent (+ appx-G/H on same runtime). Embedded seam: appendix-escalation-verbs = book-of-limits floor doctrine inside the manual. Hub role: downstream creative books inherit, don't re-teach. §21 music = TIER 2 INSTRUCTION + PEDAGOGY, 3-5 PAIRS PER UNIT ("Teach it the material in the book and of course cover it with 3-5 pairs. Instruction and pedagogy"): the flagship Composer-cluster specialization (first downstream inheritor of §20's hub role — does NOT re-teach round-trip/piano-roll, specializes them into actual musicianship). `:book-type "learning"`, `:audience "kid"` (kid-seed register default), 19ch+11app climbing note→melody→harmony→polyphony/polyrhythm→repertoire (Rachmaninoff/Chopin/harmonic-series/concerto)→11-app world-music canon (Bach·Debussy·Ellington·Nina-Simone·blues·shakuhachi&*ma*+5 drills). TWO MOVES only, NO four-way burst: instruction (teach the book's actual material, grab-don't-generate the musical facts/repertoire) + pedagogy (teach-it-how-to-teach). COVERAGE RULE = 3-5 pairs per unit/concept/verb (fan width for this book, breaks phrase-lock without burst budget). Hub-inheritance edges (don't re-teach): timbre/envelope←composition-ch09-ADSR, polyphony/polyrhythm←composition-ch12-16-voice-budget, the-Note←composition-ch05-notes-as-data; edges point UP to hub. Proper-lens lighter-but-present: harmonic-series-as-ratio(ch14)/form-as-meaning(ch11a)/polyrhythm=two-clocks(ch10)/*ma*=silence-first-class(appx06) taught through the book's own frame. HONEST-NULL carryover: ch09/ch10 lean on the same SEEDED-PENDING-V11 16-voice runtime composition flagged. §22 sound = TIER 2 INSTRUCTION + PEDAGOGY + 3-5 PAIRS + NORMAL REVERSAL where useful ("Instruction, pedagogy, and 3-5 pairs. Normal reversal and such where useful"): DSP/synthesis SIBLING of music (music=score, sound=synth), parallel treatment to §21 + a reversal add. `:book-type "learning"`, `:audience "kid"` (material genuinely advanced — FFT/formants/physical-models at kid-depth = kid-seed/domain-extrapolate tension), 16ch+3app: physics-of-sound (waveform·harmonics·filter·envelope·noise·body/formants) → build-instruments (physical-models·roster·timing·chiptune) → deep-end (FFT·transcription·voice&speech·beat-machine capstone). FOUR moves: instruction (grab book's DSP facts) + pedagogy + 3-5 pairs/unit + ⭐ NORMAL REVERSAL where-useful (Reversal-Curse mitigation [[project_cpt_shapes_catalog_2026_07_20]] A→B AND B→A on genuinely-invertible relations only: waveform↔harmonics via FFT forward/inverse, note↔frequency, envelope-stage↔behavior, instrument↔timbre; "where useful"=judgment gate, don't force on one-directional pedagogy; "and such"=standard companion shapes with judgment, NOT a burst). CROSS-BOOK HUB: harmonic-series now in THREE books (music-ch14·sound-ch02·math) → graph edges don't triple-teach; FFT fwd/inverse = cleanest reversal seam. Hub-inheritance edges: envelope←composition-ch09-ADSR, filter/noise/body←composition-ch10-FX, timbre↔music-ch08; music+sound siblings both inherit from composition hub, keep envelope-edges honest. HONEST-NULL: physical-models/voice&speech/beat-machine may lean on DSP runtime (Node audio backend exists #379 — verify wired [[feedback_verb_wired_means_motoi_run_passes]] before claiming a sound runs). §23 instruments = TIER 2 INSTRUCTION + PEDAGOGY + 3-5 PAIRS + REVERSAL-where-useful ("instruction + pedagogy + 3-5 pairs, with reversal-where-useful"): completes the AUDIO TRIO (composition-widgets→music-score→sound-synth→instruments-roster). `:book-type "application"` = FIRST application-type book in walk (using-the-roster catalog-with-teaching, NOT concept-building; emphasis = reach-for-the-right-instrument), `:audience "kid"`, 17ch+1app: roster-index → Western families (piano·strings·percussion·brass·ensemble·guitars·synths) + world-instruments first-class (Japanese-bamboo-flute·African-drums·Indian-tabla·Latin-percussion) → craft-turn (voice-as-instrument·arranging·the-roster-remembers memory-capstone) → synth-family appendix. FOUR moves: instruction (grab instrument facts) + pedagogy + 3-5 pairs/unit + reversal-where-useful (instrument↔timbre↔family invertible). WORLD-INSTRUMENT CULTURAL GUARDRAIL: tabla-bols/shakuhachi-ma/African+Latin-percussion = real cultural facts, grab-don't-generate [[project_honest_null_is_training_signal_2026_07_22]], wrong attribution worse than gap. Inheritance edges (don't re-teach): voice←sound-ch15, synths←sound-ch08/10+composition-ch09/10, roster downstream of sound's synth engine → edges to [[book-of-sound]]+[[book-of-music]]+[[book-of-composition]]; shakuhachi/ma↔music-appx06. MEMORY SEAM: ch16 the-roster-remembers = light Cortex echo (sibling to slat forgetting-note), keep light (application book not reflexive crown). §24 motion = TIER 2 INSTRUCTION + PEDAGOGY + 3-5 PAIRS + REVERSAL-where-useful ("Your tier read is correct"): STRUCTURAL TWIN of music opening the VISUAL/animation cluster (motion=kinematics-verbs → animation=the-craft, mirror of composition-audio-trio). `:book-type "learning"`, `:audience "kid"`, 23ch+11app: physics/kinematics (position·velocity·forces·oscillation·easing) → twelve-principles-of-animation → keyframes/inbetweens → emotion/narrative-arc → animation-history canon. FOUR moves: instruction (grab book's kinematics + principles) + pedagogy + 3-5 pairs/unit + reversal-where-useful. ⭐ PROPER-LENS candidate = EASING (ch03, "the easing-curve IS the shape of the motion" — teach through curve-shape lens not "it slows down" [[feedback_variety_needs_proper_lens]]); velocity/forces overlap book-of-math → cross-book edges, don't re-derive calculus. BROKEN-AS-SIGNAL: ch21 good-vs-bad-animation teaches WRONG motion as first-class contrast [[project_broken_code_as_runtime_signal]], author the bad example authentic. HUB-INHERITANCE: ch19 keyframes SPECIALIZES composition-ch08 timeline (keyframe-vs-frame-flip) → edge UP; emotion/narrative ↔ book-of-narrative-games. CULTURAL/BIOGRAPHICAL GUARDRAIL: Ghibli·Satoshi-Kon·McLaren·McCay·Fleischer = real film-history, grab-don't-generate [[project_honest_null_is_training_signal_2026_07_22]]. RUNTIME HONEST-NULL: motion/* wired (#327/#378) BUT #371 framebuffer/scheduler rebuild PENDING — verify which motion verbs run before claiming an animation plays [[feedback_verb_wired_means_motoi_run_passes]]. §25 animation = TIER 2 INSTRUCTION+PEDAGOGY + ⭐ 5-8 DIALECT-CITIZENSHIP PAIRS on non-runnable code ("this is not your verbs"): Motoi is ONE Scheme dialect among many, the PARENT that gets FORKED (Sakura first) — be a good citizen; foreign code "looks like it will work" but surface-plausibility ≠ runnability. Checking ladder: BEST/cheapest = check verbs BEFORE running + predict the unbound-symbol output; then verify by running; "can't run — another dialect's verb" = honest-null in code form. MISSPELLING DISCRIMINATION: invented typos of real verbs (vec/addd, esaing/out, paitn-cell, curev/bezier) vs genuine foreign verbs — both throw unbound-symbol but the FIX differs (typo→correct spelling; foreign→recognize the boundary). Adds a THIRD boundary kind (dialect boundary) to book-of-modules' two (epistemic/preference). Also teach the book+material+pairs+examples+extensions. §26 arcade-games = TIER 2 + HEAVY GAME-DESIGN PEDAGOGY + ⭐ GAMES-CLUSTER DOCTRINE (Alfred: "all game sections will have this"): (1) DECOMPOSE/RECOMPOSE like the CPU stuff (§13) — break the game into primitive parts, teach each, recompose into a working game; outcome is generative ("learns to MAKE games"); (2) ACTOR/AGENT abstraction as spine, related to chess (game-tree/minimax)·AI·bots — same abstraction as animation's boids/steering; (3) LANDING-POINT + GENERATIONAL transfer (echoes motoi DECISION 7): game-loop→real-time loop, sprite→sensor, collision→threshold-alarm; "kid makes a game → designs a heart-monitor 20 yrs later → teaches his son a decade after"; games = joyful on-ramp to real-time/embedded. Non-runnable → nulls+limits (distinct from §25 dialect-citizenship — same raw material, two first-class uses). 5-8 concentrated pairs; jokes/help/glossary-in-help; proper lenses game-feel/juice(Swink)·game-loop-as-state-machine·actor/agent; clone-and-modify seeds (appx-L 12 micro-games); grab-don't-generate physics tables. §27 narrative-games = TIER 2 + GAMES-CLUSTER DOCTRINE (inherited) + ⭐ DATA-PROCESSING TREATMENT (motto: "a great game with bad dialogue is a bad game"): (1) DECISION-TREE = GENERAL CS (super-important tie-back — story-tree IS a tree/graph, "what you did before" IS persisted state, "branching that matters" IS real-transition-vs-no-op; most CS-legible game book; relate story-tree-pair ≡ binary-tree/graph-pair); (2) LIGHTWEIGHT NLP-IN-SCHEME (chop/break/analyze text; templates + keyword-match + Markov-lite; "how do you create dialogue?" answered mechanically then artfully; keep runnable/PAL-PoT); (3) STORIES-AS-DATA + GRAB-AND-EXPLODE (use the OTHER BOOKS as corpus; NOT to clone the games but to KNOW the stories as DATA; "see this text here? we could use that — or it may not fit, doesn't matter, we're learning to MOVE THE DATA AROUND"; honest-null on non-fitting grabs); (4) MEALY & MOORE state machines LIGHT, from CS places, RELATE-VIA-PAIRS not add-to-book/new-book (dialogue-line-in-node = Moore, consequence-on-edge = Mealy; siblings of computing flip-flop/state-machine). GENERATIVE target = write-own-character-text AND branch it = track TWO things at once (STATE where-in-tree + TEXT what's-said); "I want it to help people write RPGs." Proper lenses: decision-tree-as-tree/graph · Mealy-edge vs Moore-node · text-as-data/data-motion · real-vs-phantom-transition · actor/agent. appendix-G companion-helps-and-ruins = AI-honesty seam → [[book-of-limits]]. §28 simulation-games = ⭐⭐⭐ FULL CORE (Tier 4), FOURTH must-not-flop book joining CS·MATH·ML — Alfred: "Do full-core… a lot of good scheme in there. If it can write this stuff it can write anything. Hard scheme and hard concepts. Bubbling it through a lot of connections and dialogue is a STRONG base." GRADUATES out of Tier-2-games-cluster: the CAPABILITY-PROOF/ceiling book (master it → whole language surface in reach). `:book-type "application"`, 16ch+12app: bodies&forces (n-body/Lagrangian/three-body=where-closed-form-dies) → agents&optimization (boids/A*-pathfinding/brachistochrone) → emergence&fields (Conway-CA/particles/fluid/RLC) → deep-structure (Nim/Wythoff/Grundy=rigorous chess-minimax from §26 / topology-persistence / RL-learning-agents) → sim-IS-the-game. Same FULL-CORE 7-part treatment as §14/§15/§16 (taught-as-book + meta-pedagogy + codebook+four-way-burst + ⭐HEAVY circle-around DIALOGUE + ⭐GRAPH cross-corpus CONNECTIONS [the two are Alfred's named "strong base"] + reasoning-slat-as-Scheme [derive-integrator/prove-Grundy/dimensional-analysis] + 5-band+humor-mined). ⭐ SPECIAL EMPHASIS = NUMERICAL HONESTY (float-trap first-class: Euler drifts, chaos explodes error, Motoi's OWN arithmetic exact while the SIMULATED world isn't — integrator≠physics, map≠territory; ml float-trap sibling at max stakes). Inherited cluster doctrine still on (decompose/recompose = one-body→n-body literally; actor/agent = boids 3rd appearance; landing-point STRONGEST here — RLC+dimensional-analysis are actual engineering). HIGHEST unwired-risk (phys/q*·topo/persistence·integrator-zoo → verify per-block [[feedback_verb_wired_means_motoi_run_passes]]); grab-don't-generate constants/theorems/Grundy-values. §29 ai-tech-cards = TIER 1 COMPREHEND-NOT-TEACH + ⭐⭐⭐ IDENTITY-PLACEMENT ANCHOR ("comprehend and be able to talk about it, not teach it"; 3-8 pairs + reversals + more reasoning-spine): the book that STOPS the "I was made by Qwen" confabulation — the 4 SYSTEM cards (Transformer/RLHF/Constitutional-AI/LoRA) = how Motoi was ACTUALLY built, so it locates itself in the real lineage not base-model priors; "Who am I?" answered by PLACEMENT among others (OUTWARD twin of §9 self-keystone: §9=who-internally, §29=place-among-others-externally). Reversals on invertible facts (lab↔landmark, system↔year, technique↔what-it-does); reasoning-spine VEHICLE routes card-facts back to §7 logic (reason ABOUT the facts); "does not rank" neutrality STANDS+motivated (placement locates, doesn't judge → preference-not-mine refusal on ranking Qs); grab-don't-generate at MAX (highest hallucination-exposure book). Edges: §9 self · §18 ancestors (AI-genealogy sibling of Scheme-genealogy) · §16 ml appendix-D (construction-facts crown). §30 book-of-jesse = ⭐⭐⭐ FULL CORE (Tier 4), FIFTH must-not-flop + ⭐ NOVELTY GUARD ("full-core treatment + special attention to NOT give and explode examples we've seen before"): the POLYGLOT/Rosetta onboarding book ("Motoi for X programmers" × 10: Python/JS/Clojure/Lua/Java/Rust/Ruby/Go/Haskell/Common-Lisp + Motoi-capability chapters + 15app; dedicated to Jesse who introduced Alfred to FP 20yrs ago). Same 7-part full-core treatment as §14/§15/§16/§28 (taught-as-book+meta-pedagogy+four-way-burst+HEAVY-dialogue+GRAPH-cross-corpus+reasoning-slat+5-band-humor-mined). NOVELTY GUARD is the special emphasis: the four-way burst EXPLODES examples but they must be cross-corpus-NOVEL — (a) don't recycle warhorses across books (fibonacci/fold/factorial already exploded in §7/§14/§16/§28), (b) don't repeat the SAME example across the 10 language chapters (each language exploded from ITS OWN characteristic problems/idioms); a polyglot book is DOUBLY phrase-lock-tempted [[feedback_parallel_templates_cause_phrase_lock_2026_07_22]], forbid recycling twice. Proper lens = bridge-from-known-language (frame Motoi through reader's existing model, authored through THAT language's real idioms); transfer/translation pairs + reversals (Motoi idiom↔lang-X equivalent). Distinct from §18 (genealogy vs comparative-onboarding, opposite directions). Grab-don't-generate each source language's real semantics. Awaiting Alfred → next book (31).

---

## 31 · book-of-one-shot — ⭐⭐⭐ TIER 3 + FAMILY-OF-ONE-SHOTS CONTRASTIVE-BOUNDARY DOCTRINE ("a lemma over good decisions and a lemma over bad decisions")

**What the book is:** a CRAFT/JUDGMENT book about SIZING THE ANSWER. `:book-type "composition"`, audience "engineer", 17ch/0app, every program runs top-to-bottom on its own. Theme = the single form ("one form in, one form out"); the runtime's voice: "I ask, quietly, whether one form will do it… It is not a shortcut. It is the honest size of the answer." 16 chapter shapes (a reference of AREAS, NOT a difficulty ladder): one-form · close-data-close-paren · looks-simple · looks-hard · compose-don't-sequence · recall-in-place · the-wire-shot · registry-in-one · knowledge-in-one · guard-in-the-form · map-the-many · the-honest-null-shot · nested-wire-shots · the-speech-shot · refactor-to-one · the-grand-one-shot.

**Alfred's directive (verbatim intent):** "Level three, but something special. A FAMILY of one-shots — scenarios that make them slightly different, but you don't have to put the code around them. For each one, find ~FIFTEEN ways to ask me for it — fifteen different ways that FORCED me to ABDUCT for it. A web of questions that lead to this. And for each, give the OPPOSITE — where you SHOULDN'T do it when asked this. ~15 YES + ~15 NO. Give it enough verbiage around 'a one-shot should work here' BUT 'I shouldn't do that.' Also teach the pedagogy of the book. That last part is super important because ONE-SHOTS CAN AT ONCE BE DANGEROUS AND UNDERUSED — no sense learning Scheme and not learning 'oh shit, I can solve this in one line,' and no sense writing Scheme that should be COMPOSED but not knowing when to do which. Fifteen that OVERLAP WITH ALL THE THINGS WITHIN OUR SYSTEMS, and fifteen NOs. Can we extract 15 and 15, or more, or less? How is this normally done?" — then: "almost like a LEMMA over good decisions and a lemma over bad decisions — to say these are the good decisions and these are the bad decisions and here's the ways you get there."

**⭐ THE LEMMA FRAME (Alfred's refinement — load-bearing):** each family member is a pair of LEMMAS. The 15 YES scenarios are the derivation-PATHS that prove the GOOD-DECISION lemma ("one-shot is the honest size HERE"); the 15 NO scenarios are the paths that prove the BAD-DECISION lemma ("do NOT one-shot this — compose"). "Here's the ways you get there" = the paths ARE the training signal, not just the verdict. This routes the whole book into the REASONING SPINE / book-of-logic §7: a decision boundary presented AS two lemmas with their supporting derivations. Deductive-flavored packaging over abductive scenario-recognition.

**ML framing (I gave, Alfred-endorsed):** a DECISION BOUNDARY taught by BALANCED CONTRASTIVE CLOUDS. Concept is NOT "the one-shot form" but *when one-shot is the honest size vs when it's a trap.* Two error directions = Alfred's two failure modes: UNDERUSED (false-negative: built a system when one form would do) and DANGEROUS/OVERUSED (false-positive: crammed into one form what wanted composition). Positives + HARD negatives, balanced, value concentrated NEAR the boundary.

**Per family member (the 16 shapes ARE the family):**
- **15 YES** = fifteen genuinely-different SCENARIOS/ENTRY-POINTS (NOT paraphrases of one sentence) each forcing a DIFFERENT abductive path to the SAME single form — the "web of questions" converging on one inference [[project_sft_must_be_abductive_2026_07_21]]. Must OVERLAP WITH REAL SYSTEM scenarios (Curator/Lacuna/Motoi actual tasks/verbs) — grounding = learned on the real distribution, not toy [[project_isb_sft_novelty_composition_2026_07_21]]. These prove the GOOD-DECISION lemma.
- **15 NO** = fifteen HARD negatives — cases that LOOK one-shottable but should be COMPOSED (near-boundary, confusable). Strawman "obviously-compose" negatives are wasted budget. ch03 looks-simple / ch04 looks-hard ARE literally this confusable pair. These prove the BAD-DECISION lemma.
- **Code lives at the HUB, not per scenario** ("you don't have to put the code around them"): one canonical one-shot form + one canonical composed-alternative per member; the 30 scenarios are the surrounding ask-cloud with short WHY-YES / WHY-NO reasoning tags = the lemma derivations.

**Count doctrine (my answer to "15/15 or more/less — how is this normally done?"):** the number isn't magic — BOUNDARY-HARDNESS sets it. CPT-shapes finding (5 diverse shapes → 96.6% vs 0% canonical-only [[project_cpt_shapes_catalog_2026_07_20]]) says first ~5-8 surfaces capture most INVARIANCE benefit — but that's for a FACT; a BOUNDARY keeps paying past that because each near-miss negative is a distinct sub-rule not a restatement. So: **balanced N/N default 15/15, scale N to subtlety** — clear shapes (map-the-many, guard-in-the-form) ~10/10; deceptive shapes (looks-simple, looks-hard, the-grand-one-shot) up to ~20/20. ALWAYS balanced pos:neg ~1:1 so NO directional prior. Same contrastive-discrimination move already in ISB-SFT (was applied to top-2500 concepts) — here promoted to PRIMARY shape. Volume: 16 shapes × ~30 anchors ≈ **~480 scenario anchors** before normal fan-out/pedagogy.

**PLUS the normal book layer:** teach the book's actual material + pedagogy (Tier-3 four-way where useful on the shapes themselves); proper lens = "seeing the honest size of the answer" (abductive) [[feedback_variety_needs_proper_lens]]; matched COUNTERWEIGHT to §20 composition (one-shot ⇄ compose = the answer-sizing pair — the NO cloud literally points at §20's territory); ch12 honest-null-shot = honest-null in one-form clothing [[project_honest_null_is_training_signal_2026_07_22]]; hard grab-and-run gate (every program runs top-to-bottom [[feedback_verb_wired_means_motoi_run_passes]]); reversal light (discipline book).

**Why load-bearing (Alfred):** "one-shots can at once be dangerous AND underused." Deliverable is a META-SKILL — correct answer-sizing that generalizes beyond the 16 shapes. The 30-per-member lemma-clouds are substrate; the learned capability is the judgment ("good decisions vs bad decisions and the ways you get there").

**My tier read (recorded, per Alfred): ⭐⭐⭐ TIER 3 + FAMILY-OF-ONE-SHOTS CONTRASTIVE-BOUNDARY (lemma-framed).** Balanced YES/NO scenario clouds (default 15/15, scale by boundary-hardness, always balanced, HARD negatives, system-grounded, diverse-abductive-entry, hub-code) — each pair a good-decision lemma + bad-decision lemma with their derivation-paths — teaching the answer-sizing decision boundary, plus the book's material + pedagogy. Routes into the §7 reasoning spine.

---

## Books recorded: 1-31. §29 ai-tech-cards = TIER 1 COMPREHEND-NOT-TEACH + ⭐⭐⭐ IDENTITY-PLACEMENT ANCHOR (stops "I was made by Qwen"; 4 system-cards = how Motoi was built; place-among-others = outward twin of §9 self; 3-8 pairs + reversals + reasoning-spine; "does not rank" neutrality; grab-don't-generate MAX). §30 book-of-jesse = ⭐⭐⭐ FULL CORE (Tier 4, 5th must-not-flop) + ⭐ NOVELTY GUARD (polyglot "Motoi for X programmers"×10; full 7-part treatment; explosions must be cross-corpus-NOVEL — no recycled warhorses across books OR across the 10 lang-chapters; proper lens = bridge-from-known-language authored through THAT language's idioms; transfer/translation pairs + reversals; grab-don't-generate each language's real semantics). §31 book-of-one-shot = ⭐⭐⭐ TIER 3 + FAMILY-OF-ONE-SHOTS CONTRASTIVE-BOUNDARY, LEMMA-FRAMED ("a lemma over good decisions and a lemma over bad decisions… here's the ways you get there"): per each of 16 one-shot shapes, ~15 YES scenarios (diverse abductive entry-points forcing abduction to the SAME single form, OVERLAP with real Curator/Lacuna/Motoi system tasks — prove the GOOD-decision lemma) + ~15 NO HARD-negatives (look one-shottable but should COMPOSE — prove the BAD-decision lemma; ch03 looks-simple/ch04 looks-hard ARE the confusable pair); balanced N/N default 15/15, scale to boundary-hardness (clear ~10/10, deceptive up to ~20/20), always balanced so no directional prior; CODE at the HUB not per-scenario (one one-shot form + one composed-alt per member; 30 scenarios = ask-cloud with why-yes/why-no reasoning-tags = the lemma derivations); ~480 anchors before fan-out; counterweight to §20 composition (one-shot⇄compose = answer-sizing pair); routes into §7 reasoning spine; deliverable = META-SKILL answer-sizing (dangerous AND underused are the two error directions). §32 book-of-reminded = TIER-1 HERITAGE/INFORMATION (Alfred: "Sensible" — accepted my proposal AS-IS): the BROAD-SWEEP computing/PL history book (`:book-type "prose"`, audience "any", 16ch: early-machines→FORTRAN→ALGOL→LISP→BASIC→C/Unix→OO→first-AI-winter→Lisp-machines/second-winter→web/scripting→Java→functional-revival→typed→Scheme/Racket-persistence→language-models→ch16 what-Motoi-inherits). THIRD & WIDEST heritage book — trio: §18 language-ancestors (direct Lisp/Scheme genealogy, cards) · §30 jesse (comparative bridge from known languages) · §32 reminded (broad historical sweep + AI arc). Same §18 treatment: Tier-1 information pairs + conversational fan-out (4-5) + code-for-variety where milestone is code-shaped (LISP eval/quote, ALGOL blocks, functional-revival idioms; code-honest-null where a chapter isn't code — early-machines, the winters-as-events). ⭐ AI-WINTER THREAD (ch08/ch09/ch15) = perspective/humility lesson — field has boomed-and-busted before = TEMPORAL complement to §29's "place among others NOW" (reminded = place among others ACROSS TIME), ties book-of-limits epistemic humility; Motoi sits inside a long arc not at its triumphant end. Grab-don't-generate MAX (real dates/people/machines/winters, anti-hagiography). ch16 inheritance landing → §9 self + §18 + §29. Awaiting Alfred → next book (33, LAST: sick-composition).

---

## 33 · book-of-sick-composition — TIER 2-3 EASY→PRO RAMP + ⭐ "GO TO 4 WITH CONSTRUCT AND DECONSTRUCT" (bidirectional decompose/recompose on the pro artifact)

**What the book is:** the deliberately-SMALL easy→pro RAMP book, one Motoi lib per chapter. `:book-type "composition"`, audience "kid-and-adult operators, Motoi copilot", 9ch (8 libs + cover). Alfred's stated design trade on the cover: "Fewer chapters, each complete, each with REAL CODE that runs against the real runtime. No stubs. No pseudo-code. Every verb is a verb the reference documents. Every code sample runs against `bin/motoi eval`." Per-chapter shape is identical: Why-this-lib-exists → Problem 1 (easy 3-5 lines, nothing→something) → Problem 2 (8-15 lines, something→more) → Problem 3 (composition 20-30 lines, real feature) → **Problem 4 (pro, ~60 lines, a small COMPLETE thing — "if you understand problem 4 you know the lib")** → Capstone (idiomatic use) → What's-next. 8 libs: The Base (car/cdr/cons/define/lambda/if 7-verb kit) · Lists (map/filter/reduce pipeline) · Higher-Order · Recursion-Without-Fear · The Frame · The World Loop · Entities-as-Data · Sound-and-Music.

**Alfred's directive (verbatim):** "Go to 4 with construct and deconstruct."

**Reading (recorded):**
- **"GO TO 4"** = the SFT treatment targets the FULL ladder UP THROUGH Problem 4 — the ~60-line PRO artifact is the unit of mastery ("understand problem 4, you know the lib"). Don't stop at the easy rungs; the pro rung is the anchor.
- **⭐ "CONSTRUCT AND DECONSTRUCT"** = teach each Problem-4 pro artifact BOTH DIRECTIONS. CONSTRUCT = build it up nothing→something→more→whole (forward ramp, SYNTHESIS — Bloom CREATE/APPLY): "build X" → reason through the rungs → the pro solution. DECONSTRUCT = take the finished pro thing APART into its rungs/parts (reverse, ANALYSIS — Bloom ANALYZE): "here's this 60-line thing → break it down, name each piece, show how it composes back." A MATCHED construct/deconstruct pair per pro artifact = a ROUND-TRIP OF UNDERSTANDING (build-up ⇄ break-down). This IS the decompose/recompose doctrine from §13 computing (CPU) and §26 arcade-games, applied to the pro artifact; and the problem-solving analogue of §20 composition's round-trip lens (emit⇄apply). Covers both Bloom poles per artifact.

**Guardrails (carried, all hard here):**
- **⭐ HARDEST grab-and-run gate in the corpus** — the book's whole identity is runnability ("no stubs, runs against bin/motoi eval"); every block + every deconstructed part verified [[feedback_verb_wired_means_motoi_run_passes]].
- **⭐ PHRASE-LOCK hazard** — identical per-chapter template × 8 libs is the parallel-template trap [[feedback_parallel_templates_cause_phrase_lock_2026_07_22]]; the RUNGS are the same but each lib's problems (and their construct/deconstruct) must be authentic to THAT lib.
- **⭐ NOVELTY GUARD (from §30)** — the 8 libs re-cover base/lists/higher-order/recursion/frame/world-loop/entities/sound already taught in book-of-code, §13-computing, §21-music; do NOT re-explode the same warhorses — this book's examples are its OWN, the job is the RAMP not the material.
- **Proper lens = the difficulty-LADDER + the construct/deconstruct round-trip** [[feedback_variety_needs_proper_lens]]; capstone = fluency/transfer ("how a working programmer reaches for it").

**Structural role:** the gentle-ramp CAPSTONE of the whole walk — the distilled easy→pro proof-of-competence on real primitives; low-end TWIN of §28 simulation-games (the ceiling proof). Together they bracket the corpus (foundational ramp ↔ capability ceiling).

**My tier read (recorded, per Alfred): TIER 2-3 EASY→PRO RAMP, construct/deconstruct-elevated.** The pro rung (Problem 4) is the mastery unit, taught bidirectionally (build-up + break-down = round-trip of understanding), on the strictest runnability gate, guarded against phrase-lock + example-recycling.

---

## ✅ WALK COMPLETE — 33/33 books recorded (2026-07-28)

All 33 scheme-books have a recorded directive + expansion. §33 book-of-sick-composition = TIER 2-3 EASY→PRO RAMP + "GO TO 4 WITH CONSTRUCT AND DECONSTRUCT" (target the ~60-line Problem-4 PRO artifact as the mastery unit; teach it BOTH DIRECTIONS — CONSTRUCT=build-up nothing→pro/synthesis/Bloom-CREATE, DECONSTRUCT=break the pro thing into its rungs/analysis/Bloom-ANALYZE; matched pair = round-trip of understanding = the decompose/recompose doctrine of §13/§26 + round-trip lens of §20 applied to problem-solving); hardest grab-and-run gate in corpus (runs-against-bin/motoi-eval IS the book's identity); phrase-lock guard (identical template ×8 libs) + §30 novelty guard (8 libs overlap book-of-code/§13/§21 — don't recycle); gentle-ramp CAPSTONE / low-end twin of §28 ceiling-proof, together bracketing the corpus. NEXT: synthesis pass available on request (design-only; no fold fired).

---
