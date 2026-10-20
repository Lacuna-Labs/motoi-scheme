# Reasoning-Cortex + SuperRAG — Design Research (Agent #3)

**Status:** DESIGN ONLY. No canonical edits, no commits. Everything lives in `scratch/`.
**Date:** 2026-07-26. **Author:** Research team (Agent #3).
**Grounded in:** the real Cortex schema (`Spec/CORTEX-SLATL-SCHEMA.slat`, `lib/ai/cortex.js`, `lib/ai/world-knowledge.js`), the real broken-example card format (`scheme/reference/broken-examples/*.slatl`), and two papers (MSCE, BabelTele) fetched 2026-07-26.

This document designs the **reasoning/learning layer**: the grade → store → salt → retrieve loop over the Cortex, folded into the Books of Reasoning. Alfred's six reframes are load-bearing and designed AROUND, not relitigated.

---

## 0. What is already real (so we build on it, not beside it)

The Cortex is not a proposal — it ships. This design must extend the existing surface, never fork it.

- **Two-store model, one surface.** MEMORY tier (episodic, written, prunable, `~/motoi/cortex.slatl`) + KNOWLEDGE tier (the four Jung-axis graphs, read-only, *virtual* — never written into the memory file). `cortex/search` and `cortex/recall` answer across both and tag each hit with `:kind`.
- **Extensible record.** `(cortex-record :kind :id :key :text :tags :salience :ts :data :provenance ...)`. **Unknown fields and unknown `:kind` values round-trip untouched.** This is the contract we exploit: *we add reasoning without changing the engine.* Known fields keep fixed order; invented fields trail.
- **The graph is real.** `cortex/associate key key label` creates a labeled edge; `cortex/lookup key label` returns neighbors (per `book-of-challenges/ch09`). Knowledge records carry `:axis` and `:associations`. So the Cortex is genuinely a graph — SuperRAG has real edges to walk.
- **Salience + prune** is the existing keep-weight dial (0..1, default 0.5; prune drops `< 0.1` by default; never touches knowledge). Our learning loop rides this dial rather than inventing a parallel one.
- **Honest-#f.** Absence is `#f` / `()`, never a sentinel. Our reasoning layer must preserve this: "no relevant prior reasoning" returns `#f`, and that is a legitimate, first-class answer — it is what makes "none is valid" (reframe 4) expressible.

**Design consequence:** every new thing below is a **new `:kind`**, a **new edge label**, or a **new field on `:data`**. We invent zero new stores and zero engine changes are *required* to prototype. Ranking/traversal improvements are additive verbs on top.

---

## 1. Papers — what transfers, what we reject

Both abstracts fetched fresh; neither exposes full formulas in the abstract. Reported honestly, not fabricated.

### MSCE (arxiv 2607.16621) — memory → callable skills, training-free
**What it actually claims (from the abstract):** organizes agent experience into three components — *grounded step traces*, *reusable procedural policies*, and *declarative environmental cognition*. It "crystallizes evidence-backed L2 policies with positive estimated gain into callable skills that retain evidence links, applicability boundaries, decision guidance, verification rules, and reliability estimates." It introduces **reflection-weighted value backfilling**, which "propagates sparse terminal feedback through dense local self-reflections to produce evidence-calibrated trace values." It is explicitly **training-free** (a post-training architecture). The abstract does **not** give the formulas for the value backfill, the reliability estimator, or the "positive estimated gain" threshold — do not fabricate them; treat them as design knobs we choose ourselves.

**Transfers (adopt):**
1. **Three-layer experience shape** maps cleanly onto our Cortex: *step traces* → episodic memory `:kind :reasoning-trace`; *reusable procedural policies* → `:kind :reasoning-skill` (a crystallized, replayable Scheme move); *declarative environmental cognition* → the four Jung graphs we already have (knowledge tier). We did not have to invent the taxonomy.
2. **Crystallize only high-gain traces into skills.** A trace is cheap and episodic; a *skill* is a promoted, evidence-linked, replayable thing. This is exactly our **salt** step (reframe 2): most traces stay traces; only ones that earned it get promoted.
3. **Skills retain evidence links + applicability boundaries + verification rules + reliability estimates.** We carry these as fields on the skill record so retrieval knows *when* a skill applies and *how much* to trust it. This directly powers anti-lock-in (a skill with a shrinking reliability estimate stops being pulled).
4. **Reflection-weighted value backfilling** = the mechanism for our grade→salt: terminal signal (did the human ship it? did it run?) is sparse; we propagate it back over the *steps* of the trace so intermediate moves inherit calibrated value. We adopt the SHAPE; we choose the weighting (an open question, §8).
5. **Training-free.** Matches Alfred's compute-aversion perfectly. All learning is data written to the Cortex + retrieval policy — **no gradient step, no retrain.** The trained model provides the floor (correctness); the Cortex provides the accreting preference.

**Reject / adapt:**
- We do **not** adopt any implied heavy value-model or learned scorer. Backfill is a deterministic pass over the trace (a Scheme fold), not a neural critic.
- MSCE is agent-task-centric (environments, terminal rewards). Our "terminal reward" is softer and more human: *did the interpreter pass* (floor) and *did the human choose this* (preference). We keep the backfill shape but redefine the reward as **run-pass ∧ human-selection**, not an environment score.

### BabelTele (arxiv 2606.19857) — model-native compressed text
**What it actually claims (from the abstract):** a class of *model-centric textual representations* — compact, non-standard, prioritizing machine interpretability over human readability. It shows "human readability, natural-language typicality, and model-side semantic recoverability can be **partially decoupled**." Reports ~99.5% semantic fidelity at ~27.9% of original length in one setting, but explicitly notes effectiveness "depends on the compressor-reader pair and task setting." It is framed as "an empirical probe, not a fixed protocol." The abstract does **not** specify the compression mechanism or its compute cost.

**We use BabelTele only as an ARGUMENT, never as compute.** The reframe (Alfred #1) is: **Scheme IS the compression.** BabelTele's own thesis — that recoverability can be decoupled from human readability, and that a compact model-native representation preserves ~all semantics — is exactly the property Scheme *already has for free*:
- Scheme is short, structural, and (for a model trained on the Motoi corpus) fully recoverable. A `(fold + 0 xs)` form is a compressed, model-native representation of a reasoning step whose "expansion" the model already knows.
- BabelTele needs a **compressor-reader pair** (compute both ways). Scheme needs **neither** — the reader is `src/reader.js`, deterministic and free; the "reader model" is the already-trained Motoi. So we get BabelTele's decoupling benefit **without its compressor-reader compute cost.**

**Therefore we reject:** building or running any neural text compressor. **We adopt:** the *claim* as our justification for storing reasoning as Scheme S-expressions rather than prose. If a reviewer asks "why not compress the memory?", the answer is "it already is compressed — it's Scheme."

---

## 2. Reasoning-in-Scheme medium (Deliverable 1)

**Principle:** multi-step reasoning is stored as **Scheme data that replays**, not English prose about reasoning. A reasoning trace is itself a Motoi form the reader can parse and (in part) the interpreter can re-run. Prose appears only in a single `:gloss` field for human/RAG readability — it is never the substrate.

### 2.1 The trace record — `:kind :reasoning-trace`

A trace is an ordinary `cortex-record` (so it stores, prunes, and round-trips today) whose `:data` carries a Scheme reasoning program. It is episodic and cheap; most traces are never promoted.

```scheme
(cortex-record
  :kind      :reasoning-trace
  :id        "rt-1785100000000-4f2a"
  :text      "reduce vs fold seed convention when porting a left-fold"   ; RAG body
  :tags      ("fold" "porting" "srfi-1")
  :salience  0.5                                     ; starts neutral; grading moves it
  :ts        1785100000000
  :provenance "reason/record"
  :data
    ((:goal    (port (foldl + seed xs) to motoi))    ; the SITUATION, as a form
     (:observed (surprising-result (reduce + 100 xs) => 6))   ; Peirce: the observation
     (:steps                                          ; the reasoning, AS SCHEME
       ((:consider (reduce f seed xs) :because "same name as source foldl")
        (:reject   (reduce f seed xs) :because "srfi-1 reduce ignores seed for non-empty")
        (:consider (fold   f seed xs) :because "srfi-1 fold always folds the seed")
        (:accept   (fold   + 100 xs)  :because "seed participation is the intent")))
     (:candidates ((fold + 100 xs) (reduce + 100 xs) (fold-left ...)))  ; the move-set
     (:chosen    (fold + 100 xs))                     ; what got picked
     (:runnable  #t)                                  ; the :accept form parses+runs
     (:gloss     "Ported a left-fold; reduce silently drops the seed under SRFI-1, so fold is the faithful move.")))
```

**Why this shape.** It is **abductive** (memory doctrine `sft_must_be_abductive`): `:observed` → candidate moves with `:because` → `:accept`. It is not a declarative "reduce means X." The `:steps` are Scheme forms with reasons, so the trace *is a small program-with-annotations*, not a paragraph. The `:candidates` and `:chosen` split is what makes **preference learnable** (§3): among candidates that all run, which did the human keep?

### 2.2 Imperative vs functional both-legitimate (reframe 1)

A single reasoning goal may carry **multiple `:accept` branches tagged by paradigm**, because Alfred's mandate says imperative and functional are both legitimate "reasonable" ways:

```scheme
(:steps
  ((:accept (let loop ((i 0) (acc 0)) ...) :paradigm imperative :because "mutation-style, familiar to C porters")
   (:accept (fold + 0 xs)                  :paradigm functional :because "idiomatic SRFI-1, no mutation")))
```

Retrieval later learns **which paradigm THIS person prefers** (§4) — the trace does not decide; it records both as valid and lets preference-weighting choose. This is where "reasoning in Scheme" carries real pedagogical content: the Book of Reasoning teaches that the *form* of the reasonable answer differs by language family, and both are stored.

### 2.3 Replay

Because `:steps`, `:candidates`, and `:chosen` are forms, replay is: read the record, extract `:chosen` (or a `:accept` form), feed it to `./bin/motoi run`. Replay is how the **interpreter-as-grader** re-verifies a stored trace still runs (§3.1) — no model call, no compute beyond the interpreter. Traces whose `:chosen` no longer parses/runs (language drift) are flagged, not silently trusted.

---

## 3. Grading schema (Deliverable 2)

**Four things get graded**, mapped to Alfred's list (code / response / action / winning action). Grades live on the record so retrieval can read them.

### 3.1 The floor: interpreter-as-grader (correctness, from training)

Correctness is **binary and free**: run the `:chosen`/`:accept` form through `./bin/motoi run`.

```scheme
(:grade-floor
  ((:runs   #t)              ; parses + evaluates without unbound-symbol / error
   (:passes #t)             ; if the trace carries an assertion/expected value, it matched
   (:verified-ts 1785100050000)))   ; when the interpreter last confirmed it
```

- `:runs #t` is the necessary gate (memory doctrine `verb_wired_means_motoi_run_passes` — nothing counts as "works" without a passing `motoi run`).
- A trace that fails the floor is **never salted into a skill** and is a candidate for the **broken-examples** pipeline (§6) — a failure is teaching signal, not garbage (memory doctrine `keep_broken_lane_output_as_sft_teaching`).
- The floor is provided by the *trained model + interpreter*; the Cortex does not have to learn correctness. This is reframe 3: **correctness is the floor, provided by training.**

### 3.2 The ceiling: preference (companion, from the human)

Among forms that clear the floor, the grade that matters is **preference** — did the human *choose* this?

```scheme
(:grade-pref
  ((:human-chosen   #t)          ; the person accepted/shipped THIS candidate
   (:human-edited   #f)          ; did they take it as-is, or tweak it?
   (:paradigm       functional)  ; which family the chosen form was in
   (:register       terse)       ; response style they kept (verbose|terse|explained|silent)
   (:selected-over  ((reduce + 100 xs)))   ; the runnable candidates they DID NOT pick
   (:signal-strength 1.0)))       ; 1.0 explicit accept, lower for weak/inferred signal
```

`:selected-over` is the load-bearing field: it records the **runnable alternatives that lost**. Preference is a *contrast*, not an absolute — "chose fold over reduce, both ran." This is the raw material for personalization (§4) and for anti-lock-in (§5: we can detect when we keep proposing the same winner).

### 3.3 How the two compose into salience

The existing `:salience` dial (0..1) is the single scalar the prune already respects. We compute it deterministically (no learned scorer — reframe 1 compute-aversion):

```
salience = floor_gate * (base + pref_bonus + reliability_bonus - staleness_penalty)   clamped 0..1
  floor_gate        = 1 if (:runs #t) else 0.05   ; failed-floor traces sink toward prune but survive as broken-teaching
  base              = 0.4
  pref_bonus        = 0.3 * signal_strength   if :human-chosen
  reliability_bonus = 0.2 * (reuse_success / reuse_total)   ; MSCE-style reliability estimate
  staleness_penalty = 0.2 * (1 - recency_decay)             ; anti-lock-in leans on this (§5)
```

All terms are arithmetic over stored fields — a Scheme fold, not a neural critic. The reliability term is MSCE's "reliability estimate" made concrete as a reuse hit-rate.

### 3.4 Reflection-weighted backfill (MSCE, adapted)

When a terminal signal lands (human shipped / interpreter passed), propagate it back over the `:steps` so intermediate moves inherit calibrated value:

```scheme
(:backfill
  ((:terminal (human-chosen . #t))
   (:step-values ((accept-fold . 1.0) (reject-reduce . 0.8) (consider-reduce . 0.3)))
   (:method "linear-decay-from-terminal")))   ; the weighting is OUR choice, deterministic
```

A **rejected** step that correctly steered away from a broken move gets *positive* value (rejecting `reduce` was right) — that is how the system learns the *avoidance* moves, not just the winning ones. The exact decay curve is an open question (§8), but it is deterministic and cheap.

---

## 4. Store + salt policy (Deliverable 3)

**Store (cheap, always):** every reasoning episode writes a `:reasoning-trace` at neutral salience via a new write verb `reason/record` (thin wrapper over `cortex/record`). Storing is free; the prune keeps it honest.

**Salt (selective, earned) — three triggers:**

1. **Chosen-and-ran (strong).** `:grade-floor.runs = #t` ∧ `:grade-pref.human-chosen = #t` → crystallize into a `:kind :reasoning-skill` (MSCE "callable skill"). This is the primary learning signal.
2. **Merely-worked-but-chosen (Alfred's explicit case, reframe 2).** Sometimes a candidate *merely worked* (ran, but wasn't obviously optimal) yet **the human picked it**. Human selection is signal even absent a correctness advantage. We salt these back with an honest marker so we do not pretend they are optimal:

```scheme
(cortex-record
  :kind :reasoning-skill
  :text "customer prefers imperative loop over fold for accumulation"
  :salience 0.55
  :data
    ((:skill      (let loop ((i 0)(acc 0)) ...))
     (:evidence   ("rt-1785100000000-4f2a" "rt-1785100500000-9c1d"))   ; MSCE evidence links
     (:applies-when (accumulate over small list, porting from imperative source))
     (:verify     (motoi-run-passes))                    ; MSCE verification rule
     (:reliability ((reuse-success . 3) (reuse-total . 4)))   ; MSCE reliability estimate
     (:salt-reason :chosen-not-proven-optimal)          ; HONEST marker — no fabrication
     (:paradigm   imperative)))
```

3. **Rejection-that-saved (avoidance skill).** A backfilled rejection with high value (e.g. "rejecting `reduce` here avoided the seed trap") salts into a skill whose `:applies-when` is a *warning trigger* and whose body points at the broken-example card (§6).

**Anti-fabrication guardrails (memory doctrine `honest_null_is_training_signal`, `check_preexisting_honest_null`):**
- A skill is **only** salted from real traces with real evidence links (`:evidence` must cite ≥1 stored trace id). No trace → no skill. Empty evidence is `#f`, and `#f` blocks crystallization.
- `:salt-reason` is mandatory and enumerated (`:chosen-and-ran` | `:chosen-not-proven-optimal` | `:rejection-that-saved`). It never claims more than the evidence supports.
- The floor is never inferred. `:runs` is only `#t` if `motoi run` actually passed (recorded `:verified-ts`). Unverified → `#f`, and the honest answer is "not verified," which retrieval respects.
- Salting is **idempotent by key**: re-salting the same skill updates its `:reliability`, it does not duplicate. `cortex/remember`'s upsert-by-key gives this for free.

---

## 5. SuperRAG retrieval over the graph (Deliverable 4)

Plain `cortex/search` (token-overlap top-k over one flat surface) is insufficient because the Cortex is a **graph** and because it does not know the **person**. SuperRAG = **graph-walk + personalization + preference-weighting**, layered additively on the existing search.

### 5.1 The four-stage retrieval policy

A new read verb `reason/retrieve` composes stages, each a cheap deterministic pass:

1. **Seed (existing).** `cortex/search query k` gets the token-overlap seed set across memory + knowledge (both `:kind`s), free.
2. **Walk (graph expansion).** For each seed, follow labeled edges (`cortex/lookup`) one or two hops along **relevance-typed edges** — `:evidence` edges (trace → skill), `:axis`/`:associations` edges (knowledge-graph neighbors), and `:selected-over` edges (this-vs-that preference contrasts). The graph is what turns "matching text" into "matching *situation*." Hop budget is small (default 2) — compute-aversion.
3. **Personalize (accrete).** Re-rank the walked set by a **person-profile** the system accretes over time (§5.2).
4. **Preference-weight + gate.** Fold in `:grade-pref`, `:reliability`, and the anti-lock-in penalty (§5.3). If the top score falls below a floor, return `#f` — **"none is valid"** (reframe 4). Honest-#f is a legitimate SuperRAG result.

```scheme
(reason/retrieve "port a left-fold accumulation"
  :hops 2 :k 8 :person "alfred")
;; => ranked ((skill . score) ...) OR #f when nothing clears the relevance floor
```

### 5.2 "Learn the person" — personalization accretion (reframe 6)

The person is itself a **node in the Cortex graph** — a `:kind :person-profile` record that accretes, no retraining:

```scheme
(cortex-record
  :kind :person-profile
  :key  "person:alfred"
  :salience 1.0                       ; never prune the profile
  :data
    ((:paradigm-bias   ((functional . 0.7) (imperative . 0.3)))   ; running tally from :selected-over
     (:register-bias   ((terse . 0.8) (explained . 0.2)))
     (:silence-rate    0.25)          ; how often the WINNING action was NO suggestion (§5.3)
     (:domain-affinity ((fold . high) (games . high) (regex . low)))
     (:edit-rate       0.4)           ; how often they edit vs take-as-is
     (:evidence        ("rt-..." "rt-..."))))   ; accretion is auditable, never fabricated
```

**Accretion mechanism (training-free):** every graded episode with a `:grade-pref` updates the profile counters by a small increment (an EMA / running tally — a Scheme fold, no gradient). `:paradigm-bias` comes from `:selected-over` contrasts; `:register-bias` from kept response styles; `:silence-rate` from episodes where the winning action was "no suggestion." The profile is **auditable** (`:evidence` cites the traces) and **prunable-exempt** (salience 1.0). Personalization is thus *data that accumulates in the graph*, exactly Alfred's "accreting over time."

### 5.3 Preference-weighting composed with graph structure

Final score for a candidate `c` given person `p`:

```
score(c, p) = text_relevance(c)                       ; stage-1 overlap
            * graph_proximity(c, seed)                ; 1/(1+hops) along relevance edges
            * personalize(c, p)                       ; paradigm/register/domain match from profile
            * reliability(c)                          ; reuse hit-rate
            * anti_lock_in(c, p)                       ; §5.4 — the load-bearing novelty
```

Every factor is a stored number; the whole thing is one fold. No learned ranker, no embedding model *required* (Curator's proprietary Rust cortex may add vector search — the OPEN cortex stays token+graph, and the SHAPE is identical, per the schema's open/proprietary split).

---

## 6. Darwinian evolution + anti-lock-in (Deliverable 5) — "who it becomes"

This is the reframe most easily gotten wrong. The failure mode Alfred named: **a copilot that keeps suggesting because suggesting is what it does.** Evolution must move toward the correct action *without collapsing into repeating a favored move.*

### 6.1 Selection = differential salience, not winner-take-all

Skills compete on `salience` (the existing dial), which already blends reliability + preference + staleness (§3.3). Selection is Darwinian: high-reliability skills are retrieved more, get reused, and (if they keep winning) climb. **But three mechanisms prevent lock-in:**

### 6.2 The anti-lock-in factor

```
anti_lock_in(c, p) = novelty_bonus(c) * (1 - overuse_penalty(c, p))
  overuse_penalty  = clamp( recent_selection_count(c) / window , 0, 0.9 )
  novelty_bonus    = 1 + 0.2 * (unexplored_candidate_in_situation ? 1 : 0)
```

A skill selected too often *in a short window* is actively **damped** — its score drops precisely because it keeps winning, forcing the system to surface runner-up runnable candidates (recorded in `:selected-over`) and re-test them against the human. This is mutation pressure: the population of moves cannot collapse to one allele. **Staleness penalty** (§3.3) does the long-horizon version — a skill that hasn't been re-verified decays.

### 6.3 The explicit "none is valid" / silence escape (reframe 4, first-class)

Silence is a **first-class candidate**, always present in every candidate set:

```scheme
(:candidates ((fold + 0 xs) (reduce + 0 xs) NONE))   ; NONE = "the right action is no action"
```

- `NONE` has its own `:grade-pref` history: episodes where the human **wanted no suggestion** raise the person's `:silence-rate` (§5.2) and give `NONE` real weight.
- `reason/retrieve` returns `#f` (honest-#f) when either (a) nothing clears the relevance floor, or (b) `NONE` outscores every content candidate. `#f` is not a failure — it is the copilot correctly choosing silence.
- This is the direct antidote to "suggests because suggesting is what it does." The interpreter-floor cannot produce silence (it only grades forms that exist); **only preference can**, which is why silence lives entirely in the preference/personalization layer.

### 6.4 Why anti-lock-in IS the identity

Because retrieval damps over-used winners and elevates silence per-person, *the same corpus retrieves differently for different people and drifts over time.* The evolution is bounded (correctness floor holds) but never frozen (preference + anti-lock-in keep it moving). "How that RAG is done is who it becomes" — the retrieval policy, not the weights, is the personality.

---

## 7. Broken-example labeling + retrieval (Deliverable 6) — "identity"

Broken-example cards already exist (`scheme/reference/broken-examples/*.slatl`) with a rich schema: `:name :library :teaches :std-target :std-rejected :status :training-eligible :broken-code :broken-output :runs :why :fix-code :fix-output :lesson :three-other-libs :motoi-standard`. **We do not change the card format** — we add a **retrieval-trigger label block** so RAG knows WHEN to consult them. HOW they are labeled is who the system becomes.

### 7.1 The trigger-label block (added to each card)

```scheme
(broken-example :name "reduce"
  ...existing fields...
  :retrieval
    ((:trigger-forms  ((reduce _ _ _) (fold-left _ _ _) (foldl _ _ _)))  ; syntactic tripwires
     (:trigger-tokens ("reduce" "fold-left" "foldl" "seed" "accumulator"))
     (:trigger-situation port-between-standards)      ; the SITUATION that summons it
     (:trigger-symptom  "seed silently ignored / off-by-seed result")
     (:severity         high)                          ; how loudly to interrupt
     (:consult-when     (or authoring-uses-trigger-form
                            candidate-matches-trigger-form
                            user-came-from (:lib R6RS Racket)))
     (:confidence-gate  0.0)))    ; ALWAYS consult on syntactic match — a known trap is not probabilistic
```

### 7.2 The trigger policy — WHEN RAG pulls a broken card

Broken cards are consulted **pre-emptively and cheaply**, on three triggers, before a suggestion is finalized:

1. **Syntactic tripwire (deterministic, always).** If a candidate `:chosen`/`:accept` form matches a card's `:trigger-forms`, the card is pulled *regardless of relevance score.* A known trap is not probabilistic — `:confidence-gate 0.0`. This is the load-bearing rule: **the system checks the broken cases whenever it is about to emit a form that has historically bitten.**
2. **Situational trigger.** If the current episode's `:goal`/`:observed` matches a card's `:trigger-situation` (e.g. "porting between standards") or the person's profile shows they "came from" a rejected library (`:std-rejected` overlaps `:domain-affinity`), pull the card.
3. **Symptom trigger (post-hoc).** If a produced form ran but gave a *surprising* result matching `:trigger-symptom`, retrieve the card to explain — this is exactly the `reduce + 100 => 6` case.

### 7.3 The linkage that makes broken cards part of learning

- A failed-floor trace (§3.1) that matches a broken card gets an **`:evidence` edge to that card** (`cortex/associate trace-id card-name "instance-of"`). The card accretes real instances over time — its `:trigger-tokens` can be *widened* from observed failures (never narrowed by fabrication).
- A **rejection-that-saved** skill (§4, trigger 3) points its `:applies-when` warning at the broken card. So the *avoidance* skill and the *teaching* card are graph-linked: retrieving one surfaces the other.
- The card's existing `:three-other-libs` field is *already* the cross-library teaching (reduce in SRFI-1 vs R6RS vs Racket) — SuperRAG uses it to explain *why* the person's home-language habit misfires here. This is where "learn the person" and "broken cases" meet: the card knows the trap, the profile knows the person's origin library, retrieval joins them.

**Identity claim, concretely:** two systems with identical corpora but different broken-card trigger policies (aggressive vs permissive consulting) will *behave* differently — one interrupts on every tripwire, one only on symptom. The trigger policy is a tunable personality dial (Alfred decides the defaults — §8).

---

## 8. How it folds into the Books of Reasoning (Deliverable 7)

The **Books of Reasoning** are a book-type in `scheme-books/` (like the existing books) that *teach reasoning using Scheme as the medium*. They are authored FROM the Cortex (traces + skills + broken cards are the raw material), not invented. Structure only — not full authoring here.

**Proposed chapter spine (16-chapter invariant, overflow → appendices):**

1. **Reasoning is Scheme, not prose.** Why the `:reasoning-trace` form is the unit; the BabelTele argument (Scheme is already the compression).
2. **The abductive shape.** `:observed → :consider/:reject → :accept`; Peirce as the meta-shape (memory doctrine).
3. **Two legitimate reasonables.** Imperative vs functional `:accept` branches; when each is the reasonable move; both stored.
4. **The floor: the interpreter is the grader.** `motoi run` as truth; correctness is necessary, not sufficient.
5. **The ceiling: preference.** `:selected-over` contrasts; grader vs companion.
6. **Grade → store → salt.** The three salt-triggers; the honest `:salt-reason`.
7. **Reflection-weighted backfill.** Terminal signal → step values; learning the avoidance moves.
8. **SuperRAG I — the graph walk.** Edges, hops, relevance-typing.
9. **SuperRAG II — learning the person.** The `:person-profile` node; accretion.
10. **Darwinian evolution.** Differential salience; the population of moves.
11. **Anti-lock-in.** Over-use damping; staleness; why winning too much loses.
12. **The silence escape.** `NONE` as a candidate; honest-#f as an answer.
13. **Broken cases and identity.** Trigger labels; when to consult; who you become.
14. **Cross-library reasoning.** The `:three-other-libs` shape; teaching the differences (R5RS/R6RS/SRFI).
15. **Composition.** Chaining skills; multi-step traces that call skills.
16. **The whole loop, replayed.** An end-to-end episode from record → grade → salt → retrieve.

- **Appendices:** the trace/skill/profile record schemas; the trigger-label schema; the salience formula; worked broken-card examples.
- **Every code block RUNS** (`./bin/motoi run`) per repo doctrine — the book is itself floor-graded.
- Sakura inherits the whole thing (it is a dialect, not a fork). Curator's proprietary cortex adds vector search but consumes the identical SHAPE.

---

## 9. Open questions / risks for Alfred (Deliverable 8)

**Top 3 (decide first):**

1. **What weighting does reflection-backfill use?** MSCE's abstract does not give the formula. §3.4 proposes deterministic linear-decay-from-terminal, but the decay curve (linear? geometric? per-step reflection score?) is a real design choice with behavioral consequences. *Needs Alfred.* (No fabrication — the paper does not specify it.)

2. **Anti-lock-in aggressiveness (§6.2) — the personality dial.** How hard do we damp an over-used winner, and over what window? Too aggressive → the copilot second-guesses good habits; too soft → lock-in returns. This is literally a personality knob and Alfred owns the default.

3. **Broken-card consult aggressiveness (§7.2) — interrupt policy.** Syntactic tripwires fire deterministically (`:confidence-gate 0.0`), but do we *interrupt* the human on every tripwire or only surface the card in the reasoning trace? "Who it becomes" hinges on this. Alfred decides the default posture (nag vs quiet).

**Further risks / questions:**

4. **Person identity + multi-user.** The `:person-profile` node assumes we can key by person. In the open Cortex there may be one user; in Curator there are many. How is `:person` resolved, and is it PII-sensitive? (Confidentiality tagging per repo doctrine.)

5. **Trace volume vs prune.** Storing every episode as a trace could bloat `cortex.slatl` (which rewrites its whole file on each write — "bad to graph" for large stores). Do traces need a separate append-log store, or is aggressive prune (§3.3 sinks failed-floor traces) enough? Possible new store `~/motoi/reasoning.slatl` split from memory.

6. **Skill collision / merge.** When two salted skills cover overlapping `:applies-when`, do we merge, keep both (Darwinian competition), or dedup? §4 says upsert-by-key, but non-identical-key overlaps are unresolved.

7. **Cold start.** Before any traces accrete, `:person-profile` is empty; retrieval falls back to token+graph only. Is that acceptable, or do we seed a default profile? (Empty is honest-#f — probably acceptable, but flag it.)

8. **Does the OPEN cortex need graph-proximity ranking, or is that Curator-only?** §5.3's `graph_proximity` uses `cortex/lookup` which exists, but the token-only open cortex may not want the extra traversal cost. Compute-aversion may argue for hops=1 default in the open build.

9. **Verifying "human-chosen" without a UI contract.** `:grade-pref.human-chosen` presumes the copilot host reports selection back to the Cortex. That reporting channel is a product-integration dependency, not a language feature — flag as an interface Alfred must own.

---

## 10. One-paragraph summary of the design

Reasoning is stored **as Scheme** — an abductive `:reasoning-trace` record (`:observed → :consider/:reject → :accept`, with candidates and the chosen move as live forms) — because Scheme is already the compression (BabelTele's decoupling for free, no compressor). The **interpreter is the floor grader** (`motoi run` → `:runs #t`); **preference is the ceiling** (`:selected-over` contrasts, register, paradigm). Grade → store → salt: cheap traces always store; only floor-passing + human-chosen (or merely-worked-but-chosen, honestly marked) crystallize into MSCE-style **callable skills** with evidence links, applicability boundaries, verification rules, and reliability estimates — training-free, all data. **SuperRAG** = token seed → graph walk over relevance-typed edges → personalize against an accreting `:person-profile` node → preference-weight, returning honest-#f when nothing clears the floor. **Anti-lock-in** damps over-used winners and decays stale skills, and **`NONE`/silence is a first-class candidate**, so the copilot can correctly choose to say nothing. **Broken-example cards** carry a trigger-label block (syntactic tripwires fire deterministically) so RAG consults known traps before emitting a form — and that trigger policy, per person, is who the system becomes.
