# Book-of-Logic — Qwen turns / hallucination research synthesis (2026-07-28)

Working note (gitignored `scratch/`). Grounds Alfred's questions for the Book of Logic:
*"Ask the Qwen team — how many turns in memory? turns on disk? when does it start
hallucinating and how do we prevent that? Do the small models (1.5B, 4B-instruct/coder-
instruct) hallucinate? How many turns can we take? What can our reasoning thing help it do?"*

Two background research agents (A = Qwen long-context/turns; B = hallucination-vs-turns/
abstention) + my own two follow-up lookups (hidden-CoT/scratchpad; reason-in-code/PAL).

**No-fabrication discipline:** where Qwen publishes no primary number (1.5B effective
length; hallucination-onset-by-turn), it is recorded here as an **honest gap / inference**,
never a fabricated figure. Citations are arxiv IDs; verify at discussion time.

---

## 1. What Qwen actually publishes about context (grounded)

- **Qwen2.5-Coder (all sizes, incl. 1.5B)** — 8K file-level pretraining → **32K repo-level**
  (RoPE base extended toward 1M) → **128K via YaRN** at inference. The **1.5B config default
  is `max_position_embeddings: 32768`**; 128K is reachable **only with explicit `rope_scaling`
  (YaRN)**, and Qwen's own model card **warns YaRN degrades short-context performance** — so
  you don't turn it on for a chat that lives under 32K. Coder tech report: **2409.12186**.
- **Qwen2.5 (base family)** — same 32K→128K-via-YaRN story; max **generation 8,192 tokens**.
  Report: **2412.15115**. Qwen2 predecessor: **2407.10671**.
- **Qwen2.5-1M (7B / 14B only)** — the genuinely-long line: progressive length expansion,
  Dual Chunk Attention (DCA), sparse **MInference** for the 1M regime. **There is no 1M / 1.5B.**
  Report: **2501.15383**.
- **Qwen's own effective-length framing:** for the 128K-class models they cite **~64K as the
  practical coherence ceiling** (advertised 128K, reliably-usable ~64K). This is the
  advertised-vs-effective gap made explicit by the vendor.

**Honest gap #1:** Qwen publishes **no primary "effective context length" number for the
1.5B** specifically (no RULER/LongBench row broken out at 1.5B in a way that yields a single
turn-count). What we CAN assert: **1.5B is the short-window tier (32K native)**, and long-
context (128K/1M) is documented on the **≥7B** tiers. Inference for the book: the
consolidation discipline (4→save→16) matters **more** for the 1.5B, not less.

## 2. "How many turns?" — reframed correctly

Qwen (and everyone) reports **tokens**, not **turns**. Turns → tokens is workload-dependent.
The honest translation for the book:

- **Token budget (1.5B, no YaRN):** 32,768 tokens shared across system + all prior turns +
  current generation, with **generation itself capped ~8K**. A "turn" in a code-teaching
  session (prompt + reasoning + a code block + result) can easily be 500–2,000 tokens, so a
  raw window holds *dozens* of turns before eviction — but that is **capacity, not coherence**.
- **Coherence horizon ≠ token horizon** (this is the load-bearing point). The literature (§3)
  shows degradation begins **well before** the window fills. So "how many turns" has two
  answers: a large **capacity** number and a much smaller **reliable-reasoning** number.
- **This is exactly why Sakura's 4→save→…→16 exists.** 16 is a **coherence** horizon, not a
  token horizon — a deliberately-chosen consolidation cadence that keeps the *working set*
  inside the reliable band and pushes the rest to disk (Cortex). The book teaches the *why*
  of that number via linear + temporal + non-monotonic logic.

**Honest gap #2:** there is **no Qwen-published "hallucination onset at turn N"** for any
size. The onset evidence is from the general multi-turn literature (§3), not from Qwen.

## 3. Hallucination as a function of turns (the general literature)

- **Laban et al., "LLMs Get Lost in Multi-Turn Conversation" (2505.06120).** The headline
  finding: across 15 models, a **~39% average performance drop** on sharded multi-turn tasks
  vs the same task given single-shot. Mechanism: **premature commitment** — models lock onto
  an early (wrong) interpretation and can't recover; they "get lost." **Biggest single loss
  driver = committing early and then defending it.** Directly motivates: *don't commit in
  public until vetted in private* (→ internal monologue) and *keep an escape hatch* (→
  none-is-valid / belief revision).
- **"Lost in the Middle" (Liu et al., 2307.03172).** Retrieval/attention degrades for
  content in the **middle** of a long context; U-shaped recall (ends privileged). Implication:
  don't rely on a fact just because it's *in* the window — its **position** governs recall.
  Consolidation to Cortex (retrieve-when-needed) beats hoping the middle survives.
- **Error snowballing (Zhang et al., 2305.13534).** Once a model emits an early error it
  **compounds** it downstream to stay consistent. Notably: models can **recognize 67–94% of
  their own snowballed errors** when asked in isolation — i.e. the error is detectable
  post-hoc even though it wasn't prevented in-flight. Grounds **spot-reasoning-in-error**
  (abduction over one's own CoT) as a *tractable* SFT target.
- **"LLMs Cannot Self-Correct Reasoning Yet" (Huang et al., 2310.01798).** Intrinsic self-
  correction (model re-checks itself with no external signal) often **degrades** answers;
  reliable correction needs an **external verifier / oracle signal.** THE crucial design
  input: Motoi's self-correction must be anchored to something outside the token stream —
  **the interpreter** (run the code), **the reference** (grab real exemplars), **Cortex**
  (graded past turns). Not vibes.

## 4. What helps — mitigations the book operationalizes

- **Abstention / calibrated refusal — R-Tuning (2311.09677).** Train the model to say "I
  don't know" on questions outside its parametric knowledge; improves calibration and cuts
  confident-wrong answers. This is the **deductive twin of honest-null**: modal `¬K_motoi(p)`
  ("I do not know p") is a *trainable, first-class* output. Composes with book-of-limits
  (epistemic refusal) and the honest-null engine.
- **Semantic entropy (Farquhar et al., Nature 2024).** Detect confabulation by sampling
  several answers and measuring **meaning-level** (not token-level) disagreement; high
  semantic entropy ⇒ likely hallucination ⇒ abstain. A concrete private-channel check: draft
  N candidates in the internal monologue, measure spread, refuse/consolidate if they diverge.
- **Chain-of-Verification (CoVe, 2309.11495).** Draft → generate verification questions →
  answer them independently → revise. A structured, in-monologue **deductive check** before
  the public channel emits. Maps 1:1 onto test-before-display.
- **Verification against a model's own faulty steps.** Combined lesson of 2305.13534 +
  2310.01798: the model *can* catch its errors, but only with an **external check** feeding
  the catch. Hence Motoi's verifier = interpreter + reference + Cortex, not introspection alone.

## 5. Multi-turn SFT practice (chat-template / loss masking) — from the Qwen side

- Qwen chat models use the **ChatML** template (`<|im_start|>role … <|im_end|>`). Multi-turn
  SFT best practice (Qwen-consistent, standard across the field): **mask the loss on user
  turns and only compute loss on assistant turns**, so the model learns to *produce* replies,
  not to model the user. For a **thinking/monologue** channel, the private tokens are assistant-
  side content that can be trained-on but **stripped before the public turn** — matching the
  hidden-CoT pattern (§6).
- Practical implication for our four SFT data types: the **internal-monologue** pairs are
  assistant-side, loss-active, and must carry an explicit *think vs say* delimiter so the SFT
  learns the channel boundary. (Design detail for later; not a fold-in fact.)

## 6. My own lookups — the private-channel + reason-in-code substrate

- **Hidden chain-of-thought / scratchpad lineage.** o1-style **reasoning tokens** (hidden
  deliberation billed but not shown); **Quiet-STaR** (train a model to generate an internal
  rationale before each token); **Pause Tokens** (Goyal et al. — give the model extra internal
  compute steps); the `<thinking>…</thinking>` convention. **Leaky Thoughts (2506.15674)** is
  the *caution*: hidden reasoning can **leak** sensitive content — so the private channel needs
  its own discipline (never assume "hidden" = "safe to write anything"). This grounds the
  internal-monologue mechanism as an established, load-bearing design — with a named risk.
- **Reason-in-code — PAL / Program-of-Thoughts (PAL 2211.10435; PoT 2211.12588).** Instead of
  reasoning in prose, the model **writes code and offloads the solving to an interpreter** —
  disentangling *reasoning* (what to compute) from *computation* (running it), with large
  accuracy gains on tasks where prose CoT drifts. **This is the literature backing for
  "reason in Scheme, not prose"** ([[project_reasoning_cortex_scheme_compression]]): Motoi's
  internal monologue does its logic **as Scheme run through its own interpreter** — the
  interpreter is the external verifier from §3/§4. PAL/PoT is the published precedent.

## 7. Synthesis → what the Book of Logic must teach (grounded)

1. **Capacity vs coherence.** Teach both numbers. 32K tokens of *capacity* (1.5B), a much
   smaller *coherence* band. The book's job is to keep the working set inside coherence.
2. **The 4→16 cadence is a coherence device**, justified by linear (budget) + temporal
   (invariant) + non-monotonic (revision) + modal (believed→known) logic, plus Darwinian
   grading. Not arbitrary — it holds the reliable band and offloads the rest to Cortex.
3. **Don't commit in public** (Laban premature-commitment) → **internal monologue** is where
   commitment is deferred until vetted.
4. **Verify against something external** (2310.01798) → the **interpreter** (run it),
   the **reference** (grab real code), **Cortex** (graded history). Never self-only.
5. **Abstain when unknown** (R-Tuning) → modal `¬K_motoi(p)` = deductive honest-null = a
   trained output, tying book-of-limits into the deductive pole.
6. **Catch your own errors post-hoc** (snowballing 67–94% self-recognition) → spot-reasoning-
   in-error (abduction over own CoT) is a *tractable* SFT target, not aspirational.
7. **Reason in Scheme** (PAL/PoT) → the monologue runs logic as interpreter-checked Scheme.

## 8. Citations (verify at discussion time — arxiv IDs)

- Qwen2.5-Coder: **2409.12186** · Qwen2.5: **2412.15115** · Qwen2: **2407.10671** ·
  Qwen2.5-1M: **2501.15383**
- Laban multi-turn "get lost": **2505.06120** · Lost-in-the-Middle: **2307.03172** ·
  Snowballing: **2305.13534** · Can't-self-correct-yet: **2310.01798**
- R-Tuning abstention: **2311.09677** · Semantic entropy: *Nature* 2024 (Farquhar et al.) ·
  Chain-of-Verification: **2309.11495** · Peirce IDEA (deduce/induce/abduce ↔ error-ID):
  **2408.10455**
- Hidden-CoT / Leaky Thoughts: **2506.15674** (Quiet-STaR, Pause Tokens, o1 reasoning tokens
  — vendor/paper pages) · PAL: **2211.10435** · Program-of-Thoughts: **2211.12588**

## 9. Honest gaps (do NOT fabricate around these)

- **No Qwen-published effective-context number for the 1.5B** (only the 32K-native /
  128K-via-YaRN structural facts). → record as inference: 1.5B = short-window tier.
- **No Qwen (or anyone) "hallucination onset at turn N"** for any size. Onset evidence is
  distributional/qualitative (39% multi-turn drop; U-shaped recall; snowballing), **not** a
  single turn threshold. → the 4→16 cadence is *our* engineered coherence device, justified
  by the logic + the general literature, **not** a Qwen prescription.
