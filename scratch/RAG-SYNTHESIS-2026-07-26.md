# RAG Synthesis — "This is how you do RAG" (Motoi → Sakura)

**Date:** 2026-07-26. **For:** Alfred. **Status:** SYNTHESIS FOR ALIGNMENT — no canonical edits, no code written. Decisions marked ⟶ need you.

Sources reconciled: Cortex ENG (`engineering/motoi-eng/CORTEX-1.0.ENG.slat`), **both** SRE manuals (Motoi archived `SRE-MANUAL/chapters/05` + Sakura `sakura-scheme/docs/engineering/SRE-MANUAL-1.0.ENG.md`), the Cortex SLATL schema, the copilot sandbox (`motoi-copilot/src/sandbox.js`), and Agent #3's new research (`scratch/reasoning-cortex-superrag-research.md`, grounded on the MSCE + BabelTele papers).

---

## 0. The one thing to read first — the two SRE manuals AGREE (they split the work)

You told me to check both SRE manuals. They say what look like opposite things, and reconciling them *is* the doctrine:

- **Motoi SRE ch05 §6 (Intrinsic-Graph SFT):** *"Graph relationships go INTO the pairs, not into runtime RAG. Model knows the graph structure as internal fact, not lookup."*
- **Sakura SRE §atomic-facts:** *"atomic-facts.slatl is NOT training data. It is runtime retrieval input — Cortex queries these facts at inference rather than the model holding them in weights (familiarity-not-knowledge doctrine)."*

They are not in conflict. They are the **two tiers**, and this is the whole design in one sentence:

> **The stable ontology is baked into the weights; the changing, personal, episodic, and just-learned is retrieved at runtime.**

- **KNOWLEDGE tier (the 4 Jung-axis graphs)** → baked in at CPT/SFT. The model *becomes* the knowledge graph. It does not look these up. This is "familiarity."
- **MEMORY tier (episodic facts, reasoning traces, skills, per-person profile, broken-case triggers)** → runtime Cortex RAG. Accreting, training-free, prunable. This is "knowledge on demand."

Everything below is about the second tier. The first tier is done at fold time and is not a runtime concern.

---

## 1. The retrieval mechanism — graph-over-RAG, one surface

Cortex already ships this; we are not inventing a store.

- **Two stores, ONE surface.** `cortex/search` and `cortex/recall` answer across both MEMORY and KNOWLEDGE, ranked, each hit tagged `:kind`. The caller never picks a store.
- **It is a real graph.** `cortex/associate a b label` makes a labeled edge; `cortex/lookup key label` walks it. Knowledge records carry `:axis` + `:associations`. So RAG is not flat top-k — it can walk situation-edges, not just match tokens.
- **Cosine is optional, additive, and Curator-only for now.** The open Motoi cortex is **token-overlap + graph-walk**. Curator's proprietary Rust cortex adds 768-D vector cosine (`vector_topk`) — the vector is the platform, the LLM is the application, "the LLM never decides what something is; the vector and the operator do." The **shape is identical** either way, so Sakura inherits the open shape and Curator bolts cosine underneath without changing the contract.
- **Honest-`#f`.** "Nothing relevant" returns `#f`. That is a first-class answer, not a failure. It is what makes "say nothing" expressible.

**SuperRAG = four cheap deterministic passes** (`reason/retrieve query :hops 2 :k 8 :person "alfred"`):
1. **Seed** — `cortex/search` token/vector top-k across both tiers.
2. **Walk** — follow relevance-typed edges 1–2 hops (`:evidence`, `:axis`/`:associations`, `:selected-over`). This turns "matching text" into "matching *situation*."
3. **Personalize** — re-rank against an accreting `:person-profile` node.
4. **Preference-weight + gate** — fold in preference, reliability, anti-lock-in; if nothing clears the floor, return `#f`.

Every factor is a stored number. The whole rank is one Scheme fold — no learned ranker required.

---

## 2. How Sakura does it conversationally (keeps context)

The conversation itself is written to the MEMORY tier as it happens. Each turn:
- Reads: `reason/retrieve` seeds from the current turn + the session's recent traces (context is *retrieved*, not just held in the prompt window — so it survives past the context window).
- Writes: the turn's reasoning becomes a cheap `:reasoning-trace` at neutral salience. Storing is free; prune keeps it honest.
- The `:person-profile` node is what "keeps context" across sessions — it accretes paradigm bias, register bias, silence-rate, domain affinity, edit-rate. No retraining; it's a running tally (EMA fold) with `:evidence` citations, salience 1.0 (prune-exempt).

This is the "familiarity-not-knowledge" doctrine operationalized: the model holds the *shapes*; the Cortex holds *this conversation, this person, this week*.

---

## 3. No-clobber + evolution of good vs bad ideas (the part you emphasized)

Reasoning is stored **as Scheme that replays**, not English about reasoning. A trace is an abductive form: `:observed → :consider/:reject → :accept`, with `:candidates` and the `:chosen` move as live forms. (BabelTele argument: Scheme is *already* the compression — recoverable, model-native, free reader; we get the decoupling with no compressor.)

**Grade → store → salt (never clobber):**
- **Floor = the interpreter.** Run the `:chosen` form through the sandbox. `:runs #t` is the necessary gate (nothing "works" without a passing run). Correctness is FREE and comes from training — the Cortex doesn't learn it.
- **Ceiling = preference.** Among forms that ran, `:selected-over` records the runnable alternatives that LOST. Preference is a *contrast*, not an absolute.
- **Salience is deterministic** (no neural critic): `floor_gate * (base + pref_bonus + reliability_bonus − staleness_penalty)`, clamped. Failed-floor traces sink toward prune but survive as broken-teaching.
- **Salt = crystallize into a callable skill (MSCE)** only on: (a) chosen-and-ran, (b) merely-worked-but-you-picked-it (honest `:salt-reason :chosen-not-proven-optimal` — human selection is signal even without a correctness edge), (c) rejection-that-saved (the avoidance move). Skills carry evidence links + applicability boundary + verification rule + reliability estimate. **No trace → no skill. Empty evidence blocks crystallization.** No fabrication.

**Darwinian, but anti-lock-in is the load-bearing novelty.** The failure mode you named — *"a copilot that suggests because suggesting is what it does."* Three brakes:
- **Over-use damping:** a skill selected too often in a short window has its score actively cut, forcing runner-up candidates back to the surface for re-test.
- **Staleness decay:** a skill not re-verified loses salience over time.
- **`NONE`/silence is a first-class candidate in every set.** Episodes where you wanted no suggestion raise the person's `:silence-rate` and give `NONE` real weight. Only *preference* can produce silence (the interpreter floor only grades forms that exist) — which is exactly why silence lives in the preference layer.

**"How the RAG is done is who it becomes."** Same corpus, different trigger/anti-lock-in policy → different behavior per person, drifting over time, bounded by the correctness floor but never frozen.

**Read-back / voting / self-check** = replay. Because traces are forms, self-check is: extract `:chosen`, re-run it, no model call. Reflection-weighted backfill propagates the terminal signal (you shipped it / it ran) back over the steps so intermediate moves — including *correct rejections* — inherit value.

---

## 4. Run the code before giving it — and the framebuffer/audio danger

**Good news: this already exists.** `motoi-copilot/src/sandbox.js` `speculativeRun()` is exactly "run it before you show it," and it already handles the danger you flagged:
- **Fuel-capped + wall-clock timeout** — bounds runaway loops.
- **Throwaway env** — drawing/audio side-effects hit the sandbox's *media state*, not the real framebuffer/speakers.
- **`captureStdio()`** — `(display …)` output is captured and dropped, never leaks to the screen.
- **Temp `MOTOI_HOME`** — a speculative `cortex/remember` can't mutate the real saved state.
- **Returns a verdict, never throws.**

**The gap = your exact worry: "does it SAY and DO something, instead of nothing."** Right now the sandbox grades *"ran to a value without error."* A snippet that silently does nothing passes. To grade *effect*, the throwaway env needs an **effect-probe**: capture what the run wrote/drew/emitted into the sandbox media state (stdout buffer length, draw-call count, audio-sample count) and assert non-empty for effect-bearing snippets. That is the one real addition needed to satisfy your "says and does something" requirement — everything else (isolation of the real framebuffer/audio) is already built. ⟶ decide the effect-assertion policy (which verb classes MUST show an effect vs. pure-value snippets that legitimately return a value and draw nothing).

---

## 5. Broken cases = identity (when RAG pulls a trap card)

Broken-example cards already exist (`scheme/reference/broken-examples/*.slatl`) with rich schema. Add a `:retrieval` trigger block (don't change the card format):
- **Syntactic tripwire (`:confidence-gate 0.0`, always fires):** if a candidate form matches a card's `:trigger-forms` (e.g. `(reduce _ _ _)`), pull it *regardless of score*. A known trap is not probabilistic — the R6RS/Racket `fold-left`/`foldl` vs SRFI-1 `fold` seed-trap is the canonical case.
- **Situational:** current goal matches `:trigger-situation` (porting between standards) or the person "came from" a rejected library.
- **Symptom (post-hoc):** ran but gave a surprising result matching `:trigger-symptom` (the `reduce + 100 => 6` case).
- A failed-floor trace links to its card via `:evidence` ("instance-of"), so cards accrete real instances and their trigger-tokens widen from observed failures (never from fabrication).

---

## 6. Escalation → Sakura, evolution INTO the multi-step reasoning (your two latest directives)

- Motoi base has **no escalation flow** — but the `escalate/next/act` multi-step reasoning *behavior* (task #331) is **how Sakura will behave**. So the reasoning loop we're specifying isn't a Motoi feature bolt-on; it's the Sakura behavior authored at the Motoi layer.
- **Evolution of good ideas lives INSIDE the multi-step reasoning**, not beside it. Concretely: each step of an `escalate → next → act` chain is a `:reasoning-trace` step; the salt/anti-lock-in machinery grades and crystallizes *the steps*, so the chain itself improves. A step that keeps winning gets damped; a rejection that saved gets salted as an avoidance move; silence can win a step. The multi-step reasoner therefore *evolves which moves it reaches for*, per person, over time — that's "add evolution of good ideas to the multi-step reasoning," done as data, not gradient.

---

## 7. Where it lands

Book of Reasoning (a `scheme-books/` book-type), authored FROM the Cortex (traces + skills + broken cards are the raw material, not invented). 16-chapter spine in the research doc §8. Every code block RUNS. Sakura inherits it whole (dialect, not fork); Curator's cortex adds cosine under the same shape.

---

## 8. ⟶ Decisions only you can make (before I implement)

1. **Backfill weighting curve** — linear-decay-from-terminal vs geometric vs per-step reflection score. The MSCE paper doesn't give the formula; I won't fabricate it.
2. **Anti-lock-in aggressiveness + window** — this is literally the personality dial (second-guesses good habits if too hard; lock-in returns if too soft).
3. **Broken-card interrupt posture** — nag on every syntactic tripwire, or surface quietly in the trace? "Who it becomes" hinges here.
4. **Effect-assertion policy (§4)** — which verb classes must prove a visible/audible/output effect vs. pure-value snippets.
5. **Trace volume vs prune** — every turn as a trace could bloat `cortex.slatl` (whole-file rewrite per write). Split a separate `~/motoi/reasoning.slatl` append-log, or lean on aggressive prune?
6. **`:person` resolution / multi-user + PII** — one user in open Motoi, many in Curator. How is person keyed, and confidentiality tag?

Tell me the defaults for 1–4 (5–6 can wait) and I'll build it onto the Cortex + author it into the Book of Reasoning.
