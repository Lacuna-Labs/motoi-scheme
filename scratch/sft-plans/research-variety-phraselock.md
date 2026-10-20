# Variety Engine Research — Beating Phrase-Lock at Corpus Scale

Research-only (2026-07-29). Target: millions of SFT pairs where N pairs teaching the
same fact read as genuinely different text. Prefer offline / reproducible on a Mac.

---

## TL;DR verdict

**No purely-deterministic path gives real natural-language variety at millions-scale.**
Deterministic tricks (template banks, synonym swaps, grammar diversification, syntactic
control, back-translation) buy *surface* variety cheaply and reproducibly but plateau
fast, drift semantically, and still read as machine-stamped. **Genuine variety —
different framing, register, and clause structure — requires a generative model in the
loop.** The winning architecture is a **hybrid**: deterministic layer for cheap
structural scatter + skeleton control, an **offline open-weights LLM** for the bulk
rewrite, and **full-context Claude ("high cool") authoring reserved for the load-bearing
lanes** (reference build-ladders, keystone dialogues, contrastive-boundary lemmas). Then
**gate the fold on measured diversity metrics** — do not trust that variety happened.

---

## (a) Ranked concrete recommendations for the variety engine

**1. Offline open-weights LLM rewrite pass = the workhorse (highest ROI).**
Run a local model (MLX on the Mac; a 7B–14B instruct model is plenty for paraphrase) as a
rewrite lane over templated seeds. This is the single biggest lever. Two techniques stack
on top and are both training-free prompting strategies, so no fine-tuning needed:
  - **Verbalized Sampling** (arXiv:2510.01171, Oct 2025): ask the model to emit *k*
    candidate rewrites *with probabilities* and sample from that verbalized distribution.
    Reported **2–3× diversity gain**, orthogonal to temperature, model-agnostic, explicitly
    validated for *synthetic data generation*. Directly counters the post-training
    "typicality bias" mode-collapse that makes aligned models phrase-lock. **Adopt this.**
  - **Length / word-count constraints in the prompt.** The persona-diversity study
    (arXiv:2505.17390, May 2025) found a plain word-count limit produced *larger* lexical
    diversity gains than elaborate persona engineering. Cheap, effective, use everywhere.

**2. Skip elaborate persona/template engineering; it under-delivers.**
Same study: fine-grained personas gave *negligible, mostly non-significant* gains; mean
cosine similarity between fine- and coarse-persona outputs was **0.79** ("detailed
instructions override the persona"). Smaller models (1B/8B) barely benefited at all. So a
20-persona × 5-shape template matrix is a trap — it *feels* varied, measures flat. Prefer
a *few* coarse registers (your kid / layperson / PhD split is already the right grain) +
Verbalized Sampling for within-register scatter. **This aligns with the existing
"variety-in-data beats phrase-lock" and "kid=seed, domain=extrapolate" doctrines.**

**3. Syntactic-control paraphrasing = the deterministic-ish structural layer.**
Condition rewrites on *different target parse skeletons* so top-level clause structure
varies, not just words. Grounded methods: SCPN (Iyyer et al., N18-1170), SGCP
(Syntax-Guided Controlled Generation, TACL 2021), PIP parse-instructed prefixes
(arXiv:2305.16701), AESOP. Offline-runnable via small T5/BART checkpoints. Use it to
*supply target syntax templates* to the LLM rewrite pass (exemplar-controlled), rather
than as a standalone generator — as a standalone it's stiff and needs a parser.

**4. Round-trip / back-translation = a cheap supplementary lane, capped.**
Reproducible offline with a local MT model (e.g. NLLB/M2M pivot). Gives real reordering
"for free." **But** documented failure modes: **semantic drift**, register mismatch, and
non-paraphrase pairs from ambiguous pivots (arXiv:2205.12213 Info-Bottleneck; RTT-QE
work). Only safe on *prose* pairs, never on Scheme code or exact API facts. Treat as a
minor diversifier (cap ~10–15%), always re-verify meaning, never on code tokens.

**5. Diverse decoding when sampling k candidates per seed from any model.**
Prefer **Diverse Beam Search** or **Determinantal Beam Search** (DPP subset selection,
arXiv:2106.07400) over vanilla beam, which returns trivial-edit near-duplicates. For a
DPP-style *selection* step, over-generate (e.g. 8–16) then pick a max-diversity subset via
a determinant/greedy-embedding-dispersion criterion before keeping *n*. DPP-for-diversity
in LLMs is active 2025 work (arXiv:2509.04784). Nucleus + moderate temperature is the
floor; DPP selection is the ceiling.

**6. Deterministic surface layer = keep, but as scatter only, not as the variety story.**
Synonym/paraphrase templates, your 5-shapes/Lacan metaphor-metonymy passes, clause
reordering — cheap, reproducible, good for breaking exact-string repetition. Necessary,
insufficient. It cannot produce *framing* variety (the "proper lens" doctrine): that needs
generation.

---

## (b) Diversity metric(s) to gate the fold on — with thresholds

The standardization paper (arXiv:2403.00553, "Standardizing the Measurement of Text
Diversity") ships a PyPI package **`diversity`** and shows the metrics have **low mutual
correlation**, so report a *small complementary set*, not one number. Gate on:

| Metric | What it catches | Target (per fact-cluster of N pairs) |
|---|---|---|
| **Self-BLEU** (n-gram overlap across the set) | template phrase-lock — the #1 risk | **≤ 0.30–0.35** (lower = more diverse; flag ≥ 0.5) |
| **Distinct-2 / Distinct-3** (unique n-grams / total) | surface repetition | **Distinct-2 ≥ 0.6** on the pooled set |
| **Compression ratio** (gzip size / raw) | structural redundancy the n-gram metrics miss | **≤ 0.65** (high ratio near 1.0 = boilerplate; near-duplicate corpora compress hard) |
| **Homogenization / BERTScore self-similarity** (one semantic measure) | "all reworded, same shape" | mean pairwise **≤ ~0.75** (0.79 was the persona-failure watermark) |

Practical gate: compute these **per fact-cluster** (the set of pairs teaching one verb /
one node), not just corpus-wide — corpus-wide averages hide a phrase-locked cluster inside
a diverse corpus. **Hard fail** any cluster with Self-BLEU ≥ 0.5 *or* compression ratio
≥ 0.8 *or* mean BERTScore self-sim ≥ 0.85; route it back for re-authoring. Add **MTLD**
(≥ ~60–70) if you want a lexical-richness read on long book-chapter outputs. These plug
directly into a fold preflight gate alongside the existing 5-point gates.

---

## (c) Verdict: deterministic vs. LLM-in-the-loop

**Deterministic-only is not viable for the primary variety guarantee.** It is
reproducible and free, but every deterministic method here (template banks, syntactic
control, back-translation, synonym swap) either plateaus at surface variety, drifts
semantically, or requires a parser/MT model that is itself a neural component. The
research consensus (mode-collapse / typicality-bias literature, the persona-diversity
null result) is that *framing* and *register* diversity — exactly what "proper lens"
demands — comes from generation, not substitution.

**Recommended split:**
- **~70% offline open-weights LLM lane** (MLX-local, Verbalized-Sampling + word-count
  constraint + DPP selection over k candidates). Reproducible enough (fix seeds + model
  hash), cheap, scales to millions.
- **~20% deterministic scatter** (syntactic-control skeletons, 5-shapes, clause reorder,
  capped back-translation) layered *under* the LLM lane to seed structural variety.
- **~10% full-context Claude "high cool" authoring** reserved for load-bearing lanes where
  correctness of framing is non-negotiable: reference build-ladders (R4), keystone
  break-want-into-dialogue (C9), contrastive-boundary lemmas (§31), and anything
  identity- or safety-shaped. These are precisely the lanes the "parallel-templates =
  nonsense" doctrine warns must not be templated.
- **Always** gate every lane's output on the metric panel in (b). Variety is *measured*,
  never assumed. This turns "did we phrase-lock?" from a vibe into a preflight number.

Net: **hybrid, LLM-primary, deterministic-scaffolded, metric-gated.** Pure determinism is
a false economy here; the honest answer is that real variety needs a model in the loop —
and you already own the right instinct (reserve full-context Claude for the lanes that
carry judgment).

---

## Sources (verified via search, 2026-07-29)
- Verbalized Sampling — arXiv:2510.01171 (mode collapse / typicality bias; 2–3× diversity, training-free)
- Persona lexical-diversity study — arXiv:2505.17390 (persona gains negligible; word-count wins; 0.79 cosine watermark)
- Standardizing Text Diversity Measurement — arXiv:2403.00553 (`diversity` PyPI; low-correlation metric set)
- Diversity of Synthetic Data & impact on LLMs — arXiv:2410.15226
- Determinantal Beam Search — arXiv:2106.07400; DPP-for-LLM-diversity — arXiv:2509.04784
- SCPN — Iyyer et al. N18-1170; SGCP (Syntax-Guided) TACL 2021; PIP — arXiv:2305.16701; ParaAMR — arXiv:2305.16585
- Principled Paraphrase Generation / Info-Bottleneck vs round-trip MT — arXiv:2205.12213 (semantic drift, fidelity-diversity tradeoff)
- Offline paraphrase checkpoints: T5 (Vamsi/T5_Paraphrase_Paws), BART (eugenesiow/bart-paraphrase), PEGASUS-paraphrase — all HF, Mac-runnable
