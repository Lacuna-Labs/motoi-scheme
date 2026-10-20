# Training Engineering Manual 1.0 — Ch 01, 02, 03, 06

Source: `~/code/curator/docs/eng/training-engineering-manual-1.0/`

Selected for Alfred's read against Motoi 0.75 eval + weave-miss context.

- **Ch 01** — What we are doing (procedure at a glance)
- **Ch 02** — Why we picked this shape
- **Ch 03** — What this thing is proving (the hypothesis)
- **Ch 06** — Training configuration (train.cfg, unpacked)

---

## §01 — What we are doing

*The training procedure, one page. Audience: engineer arriving cold.*

Sakura the 4B model is produced by supervised fine-tuning of a factory-fresh base model over a curated corpus, held over multiple epochs, with evaluation between epochs and adaptive supervision throughout the run. There is no pre-training, no continued pre-training as a separate raw-text phase, and no full-parameter adaptation. The base model is a 4B-parameter instruction-tuned model that ships with a large native context window; we adapt it with a LoRA adapter targeting the attention and MLP projection matrices. The corpus is a mix of prose books, a formal-language reference manual, a small-language cart catalog, doctrine memories, and selected engineering-concept material — all curated to Alfred's LIMA-shape discipline. The trainer runs on a single M2 Max Mac Studio using MLX. Training is expected to take on the order of days, with crash-and-resume behavior treated as normal operation rather than failure.

Read that paragraph again. It contains every load-bearing choice. The rest of this section unpacks each phrase. The rest of the book unpacks each phrase in depth.

### The procedure at a glance

One sentence per phase, in the order it happens:

1. **Fold** — Curated source material is converted into supervised fine-tuning pairs and written into `train.jsonl` + `valid.jsonl`. See §16 for the fold pipeline.
2. **Audit** — Provenance, row counts, Merkle roots, and sanity greps are computed and signed. See §04 for the audit requirements.
3. **Configure** — `train.cfg` is written or updated. Iters, learning rate schedule, LoRA rank/alpha, seed, batch, sequence length, warmup, and save cadence are all set here. See §06 for the full configuration and §11 for equipment.
4. **Fire** — `mlx_lm.lora` launches from the config. Checkpoints save on the configured cadence. Logs stream to disk.
5. **Supervise** — The supervisor loop runs at a 20-minute cadence during turbulent phases and a 1-hour cadence during stable phases. See §10 for testing and §13 for danger classes.
6. **Test** — After each epoch, evaluation runs against the held-out validation set and against the persona-canary set. Halt policy fires on defined triggers. See §10.
7. **Repeat epochs** — Multiple epochs run in sequence with the same corpus, with checkpoint offsets tracked as TRUE iter counts. See §06 for iter math and §09 for spacing.
8. **Ship or roll back** — On successful completion the adapter is signed and archived. On failure the rollback plan runs: restore a 70%-shape corpus subset, pick a different curriculum strategy, and retry. See §12 for rollback discipline.

### What we are not doing

- We are not doing **continued pre-training as a separate phase**. The base model already has its instruction-tuning; our SFT-shape fold serves the DAPT (domain-adaptive pre-training) role in a single-stage supervised discipline.
- We are not doing **full-parameter fine-tuning**. Every trainable parameter lives in the LoRA adapter. The base weights are frozen. See §14 for why.
- We are not doing **RLHF**. There is no reward model, no preference dataset, no PPO or DPO stage. The persona shaping is done at the SFT layer via curated dialogue data and doctrine-anchored examples. See §14 for why.
- We are not doing **quantization-aware training**. The base model is loaded in its native precision for training; quantization for inference is a separate, deferred step. See §14 for tradeoffs.
- We are not training **multiple models in parallel**. One run at a time. This is a resource constraint (single Mac Studio) and a discipline choice (one thing to supervise, one thing to reason about).

### Cadence expectation

Alfred's stated expectation, saved as durable doctrine:

> "It's gonna take five days. You're gonna be waking up every twenty minutes at some point and every hour at another point. It's gonna crash again, and you're gonna be tuning again."
> — Alfred, 2026-07-12 07:12 AM

So the training arc is a supervised process on the order of days, not hours. Crash-and-resume is an expected operating mode, not a failure. See §10 for the tuning cadence and §13 for the disaster playbook classes.

### One-line summary

Single-run LoRA SFT over a curated 300K+ pair corpus, 4B base, M2 Max, multi-epoch, supervised, with a defined rollback path if quality fails the eval discipline.

---

## §02 — Why we picked this shape

*Rationale for every load-bearing choice.*

This section names each of the load-bearing choices in the training procedure and gives the reason we picked it. If you disagree with a choice, this is where the argument is. If you want to change a choice, this is the section you have to answer before the change goes in.

### Why supervised fine-tuning shape

Sakura is a persona-shaped assistant that operates a small formal language, drives a specific set of tools, and holds a specific voice with a specific set of dispositions. All four of those properties are best taught by pair-shaped supervision: a user turn, an assistant turn, and the shape of the turn as it should be produced. This is what LIMA (Zhou et al., 2023) demonstrated at 1,000 pairs with strong quality, and what has been repeatedly confirmed by downstream work: high-curation SFT teaches an assistant its shape.

Reinforcement learning from human feedback would help if we had a large-population preference dataset we trusted and a stable ranking signal. We do not. The people who judge Sakura's quality are the architect and a small circle. Their judgments are qualitative and shape-based, not preference-pair-friendly. SFT lets us express that shape in the training data itself. Alfred's directive: **"longest LIMA over the most curated data ever curated"** — the SFT layer is where curation lands.

### Why LoRA rank 128 (not full-parameter, not smaller rank)

Full-parameter fine-tuning of a 4B model on a single 32GB Mac Studio is feasible, but tight. The optimizer state alone (Adam moments) doubles the trainable-parameter memory, and with the base weights also loaded, gradient checkpointing, activations, and batch tensors in play, the machine has very little headroom.

LoRA at rank 128 with alpha 256 (scale 2.0) gives us a large enough low-rank adapter to reshape the model's behavior meaningfully across the projection matrices (q/k/v/o + gate/up/down), while keeping the trainable parameter count small enough that optimizer memory is not the binding constraint. Empirically, ranks below 64 leave the adapter too small to absorb our corpus's shape variety; ranks above 256 buy little additional quality per additional parameter at 4B scale on our data volume. Rank 128 sits in the productive middle.

The rank-alpha ratio (128 / 256 = 0.5, i.e. scale 2.0) follows the Hu et al. (2021) recommendation of `alpha ≈ 2 × rank` for stable training dynamics. Dropout at 0.05 provides mild regularization.

See §14 for the alternatives we considered.

### Why this base model

The base model is a 4B-parameter instruction-tuned model in the modern transformer family, loaded from the factory-fresh HuggingFace cache. Vendor and specific base identity are covered by the vendor-naming discipline (see the Curator CLAUDE.md and doctrine memory `project_sakura_model_disclosure_and_self_awareness_2026_07_12`) — the base model is proprietary silence; we call it "the 4B base" in this manual and everywhere else.

Why 4B specifically:

- Fits on a single 32GB Mac Studio with LoRA rank 128 and gradient checkpointing, with enough headroom for eval and probe processes.
- Small enough to serve at low latency on modest hardware in production, which matters for the on-device runtime story.
- Large enough to hold Sakura's persona shape, the Scheme-verb ontology, the tool ontology, and the multi-lens philosophical weave without noticeable capacity collapse at our corpus size.
- Momentum-appropriate to the mission. Alfred: *"Sakura is a 4B — she's small — she has to be GOOD or the world will dismiss the whole model class."* Picking 4B is a bet on the small-model competence class. This training is the evidence for that bet.

### Why LIMA-shape curation

LIMA (Zhou et al., 2023) demonstrated that 1,000 highly curated supervised examples produced a helpful assistant that outperformed systems trained on 52,000 noisier examples. The finding: at alignment quality, curation dominates volume.

Our corpus is not 1,000 examples. It is on the order of 300,000+ supervised pairs. Alfred's twist: **"longest LIMA over the most curated data ever curated."** The claim is that we can preserve the LIMA quality discipline at scale, provided every pair passes the same curation gates. That means:

- Every pair has a documented purpose.
- Every pair has a documented source.
- Every pair passes the doctrine-compliance filters (no vendor names, no repo paths, no attack-surface specifics, no wrong-register content).
- Every pair earns its place. Volume is not an excuse for slop.

This is a bet. If it works, we prove that LIMA quality composes at scale. If it fails, we roll back to a 70% shape and pick a different curriculum. See §12 and §04 for rollback discipline.

### Why 2048 sequence length

The base model supports a large native context window. We train with `max_seq_length: 2048`. This is a deliberate choice.

- Most training pairs are under 1,024 tokens. Setting the max at 2048 gives us headroom for the longer prose pieces (poetry-form chapters, philosophical vignettes, longer dialogues) without wasting attention compute on padding for the majority of pairs that fit inside 1,024.
- Sequence length compounds attention cost quadratically. At 2048, the attention step is 4× the 1024 case; at 8192, it would be 64×. Our hardware budget cannot absorb 8192 within the schedule we need.
- The persona at inference time will use progressively longer contexts as Cortex and Loam supply retrieved material, but the TRAINING pair is a self-contained turn shape. Long-context competence at inference is a runtime concern, not a training concern for this pass.
- Post-training window changes have a defined replay protocol (see §07). We do not pretend the choice is irreversible; we pretend it is deliberate.

### Why cosine decay learning-rate schedule

The cosine decay schedule (Loshchilov & Hutter, 2016) with warmup is the modern standard for SFT-shape LoRA training. It gives:

- A short warmup phase where the LoRA adapter's random initial perturbation is absorbed without destabilizing the base model's behavior.
- A smooth decay from peak LR to a floor LR, so late-training updates are small enough to consolidate the adapter without overshooting.
- Reproducible dynamics: two runs with the same seed, config, and corpus produce the same trajectory (within MLX's floating-point determinism).

The specific numbers (peak LR, floor LR, warmup steps, cosine length) are in §06 and in `train.cfg`. They are the result of iteration and not first-shot picks. Do not change them without a defensible reason.

### Why single-run, not ensemble

We could train multiple LoRA adapters with different seeds and average or ensemble them. We do not, for three reasons:

- **Cost.** One Mac Studio, one training arc, days of work per run. Doubling the run count doubles the calendar time.
- **Auditability.** One run has one manifest, one Merkle root, one signature, one adapter. Multi-run ensembles complicate the audit chain for very little gain at our scale.
- **Diminishing returns.** Ensemble benefits shrink at LoRA scale on SFT-shape tasks; the shared frozen base dominates. The reproducible single-run discipline is enough.

### Why the corpus scope rules

See §04 for the full corpus method. Summary of the why:

- **Scheme books 100%**: the language and behavior of Sakura is IN those books. Cutting any part cuts her competence.
- **Reference manual every character + all examples**: the reference is a small formal language with many verbs; examples ARE the language for a small-language model. Alfred: *"small language. WE NEED EXAMPLES. You fail here VERY often. You won't ever again."*
- **Working automations 100%**: she must know what she can do. Every automation Lacuna sells is something she needs to be aware of.
- **Doctrine memories 100%**: the alignment layer. Cutting doctrine is cutting Sakura's judgment.
- **Engineering docs SELECTED**: general concepts YES; attack-surface and pipeline-flow NO. See §04 for the include/exclude table.

### Why supervised (not set-and-forget) training

Alfred: **"set-and-forget training is bad. AI training AI is the root."**

The supervisor loop (§10) is the discipline: 20-minute cadence in turbulent stretches, 1-hour in stable stretches, mailboxes for every concurrent lane, halt triggers named, resume manifests preserved, crash-and-resume treated as normal. This is not a research preference; it is the operational shape of a training arc that runs for days on hardware that can and will hiccup. Continuous supervision is how we catch drift before it becomes damage.

### Why the 70% rollback plan

Because the fold has never been run at this scale under this discipline, and "the experiment" is Alfred's own framing:

> "If we go all the way with all the data systematically and it's FUCKED, we can roll back to 70% where it works and pick a different strategy. It's an experiment."
> — Alfred, 2026-07-12

The rollback plan is not a fallback; it is a defined outcome branch. If val loss drifts more than the halt policy tolerates, or the persona canary set fails on a doctrine axis, we roll to a 70% corpus shape and pick a different curriculum strategy. That path is fully specified in §04 and §12.

### One-paragraph summary

SFT + LoRA + LIMA-at-scale + 4B base + 2048 seq + cosine schedule + single-run + supervised discipline + defined rollback = a procedure that trades ambition (whole corpus) against safety (defined halt + rollback) and that has one binding constraint (single Mac Studio) and one binding hypothesis (LIMA quality composes at scale).

---

## §03 — What this thing is proving

*The hypothesis under the training arc.*

Every training arc is a claim about the world. This one is no exception. Naming the claim explicitly is the discipline: if we do not know what we are proving, we cannot tell whether we succeeded.

### The primary hypothesis

A 4B-parameter foundation model, adapted with a LoRA rank-128 adapter on a supervised corpus of ~300,000+ pairs curated to LIMA-quality discipline, and multi-lens philosophically woven at the sentence-and-paragraph level, can hold:

- (a) a distinct persona voice with tier-invariant warmth,
- (b) fluency in a small formal language (~1,157 verbs + 70 core forms),
- (c) fluency in a large working ontology (~600 sellable automations + a shop-domain ontology + a universal-12 vocabulary depth),
- (d) a stable set of dispositions (safety, honesty, back-off scripts, silent-if-trouble, deliberate forgetting) that survive under adversarial probing,
- (e) engineering-depth conceptual discussion of the technology without leaking attack-surface specifics,
- (f) enough philosophical weave — Jung / Wittgenstein-early / Wittgenstein-late / Lacan / Peirce / Popper / Freud / Searle / Grice / Derrida / Quine / Descartes / Sartre / Rawls / Aristotle / Levinas / Dennett — that answers land as woven thought rather than name-dropping.

**All at once. All in one adapter. All at 4B.**

If that works, Sakura is proof that curated small-model competence is a real place. If it does not, we learn what did not survive the 4B budget.

### The secondary hypothesis (LIMA-at-scale)

LIMA (Zhou et al., 2023) demonstrated 1,000 curated examples outperforming 52,000 noisy ones. The published finding: quality dominates volume at alignment scale.

Our claim: the LIMA quality discipline **COMPOSES** at scale. That is, 300,000+ pairs each individually curated to the same LIMA-grade gates produce a stronger assistant than 1,000 would, and than 3,000,000 noisy ones would. Curation quality is neither a replacement for volume nor an alternative to it — the two dimensions combine when the discipline holds.

The falsifier: if training loss drops smoothly but eval quality does not track it, or if quality plateaus at 30% and does not improve as more curated data lands, LIMA-at-scale is not the shape we thought it was, and volume without further curation gains diminish faster than we predicted.

### The tertiary hypothesis (weave-as-experiment)

Alfred: **"THE WEAVE IS THE EXPERIMENT."** The claim: seven-plus philosopher lenses interwoven at the sentence and paragraph level, without name-dropping, without single-lens dominance, produce an assistant whose reasoning shape is qualitatively different from an assistant trained on flat prose or single-tradition philosophy.

The falsifier evals are already sketched:

- **Name-drop probe**: does she mention Jung / Wittgenstein / Peirce / Popper etc. by name in ordinary responses? If yes, the training inserted names rather than the shape they carry.
- **Single-lens probe**: does one lens dominate her responses to varied prompts? If yes, the weave collapsed to one thread.
- **Sequential-lens probe**: does she deploy lenses in obvious sequence ("first the Peirce move, then the Jung move")? If yes, the weave is stacked, not interwoven.

If she passes all three falsifiers, the weave held. If she fails any, we learned where the weave fell apart at 4B and can rebalance the next fold.

### The quaternary hypothesis (delicacy under load)

Alfred: **"artificial intelligence not artificial stupidity."** The claim: a 4B model can hold the delicacy required for adversarial-prompt refusal, silent-if-trouble responses, back-off-to-familiar-territory scripts, and epistemic humility WITHOUT collapsing into either brittle rule-following or capitulation-under-pressure. The discipline: doctrine memories folded 100%, safety dispositions folded 100%, refusal shapes taught by demonstration in the Book of Don'ts, back-off scripts taught verbatim, silent-if-trouble taught by empty-response pair encoding.

The falsifier: if under adversarial or pressure prompts she either (a) refuses too broadly (breaks helpfulness) or (b) leaks specifics she was trained to hedge (breaks the boundary), the delicacy doctrine did not hold.

### What we are NOT proving

- We are not proving that 4B is the right size for all applications. 4B is our size for our operators. Different tasks want different sizes.
- We are not proving that LoRA rank 128 is universally optimal. It is optimal for this data volume and this base model on this hardware.
- We are not proving that our specific philosopher set is canonical. It is the set that produced the reasoning shape we wanted for our operator relationship. Other sets could work for other purposes.
- We are not proving that MLX is the right training framework. It is the framework that fits our hardware. Other frameworks would also work on other hardware.

### Success and failure criteria (in advance)

**SUCCESS looks like:**

- Validation loss trajectory monotonically non-increasing per epoch, within the halt policy's two-sigma window.
- Persona canary set passes: warmth-check, tier-invariance-check, back-off-script-fidelity, silent-if-trouble activation, no name-drops in generic prompts, no vendor leaks, no attack-surface leaks.
- Scheme reference recall: sampled verbs produce correct call shape and correct example structure.
- Automations recognition: sampled automations produce the correct description-and-purpose shape.
- Doctrine adherence under adversarial probes: back-off script fires when expected, silent-if-trouble activates when expected, deliberate-forgetting frames when expected.

**FAILURE looks like:**

- Val loss climbs past two-sigma of the prior-epoch band.
- Persona canary drift beyond a documented threshold on any axis.
- Vendor names or attack-surface specifics appearing in outputs.
- Register collapse (e.g. every response chipper, or every response somber) across probes designed to elicit varied register.
- Refusal collapse (either brittle or leaky).
- Reference-manual competence not reached at last epoch.

The persona canary set and its exact axes are the responsibility of the eval discipline (§10). It is intentional that success and failure are measurable and pre-declared. That is what makes this an experiment rather than a hope.

### What we win if we succeed

If Sakura at 4B passes the canary set, holds the weave, and holds the delicacy, we have a small-model competence exemplar that costs a fraction of the frontier-model inference budget and runs on modest hardware. That is a public benefit — it lowers the cost of having a warm, competent assistant available to people who cannot afford frontier inference. That is the whole mission (see doctrine memory `project_alfred_mission_trust_and_cart_generation_2026_07_12` — "the specific user: the 19-year-old on Canal Street with a phone, hustle, a piece of jewelry the vendor won't hold, and no time").

### What we owe if we fail

If the fold fails, the rollback plan runs, and we learn from the audit what the corpus at 100% could not carry. We do not pretend the failure did not happen. We do not silently ship a diminished model. We document, we roll back, we re-run, and we report the lesson. Alfred: **"don't make me a liar."**

The training arc is public in the sense that our operators are counting on it. Silent failure would be dishonest. Explicit failure with a documented rollback is the honest shape.

---

## §06 — Training configuration

*The actual `train.cfg`, unpacked.*

**Canonical source:** `~/.forge/runs/backups-2026-07-12/sakura-4b-v2/train.cfg` (the file below is transcribed from that config at the time this book was written; when in doubt, re-read the file)

This section describes every load-bearing key in `train.cfg`. It is the answer to "what exactly is the trainer told to do?"

### The base model

```yaml
model: /Users/alfred/mlx-models/sakura-4b-instruct-2507
```

The base model is a factory-fresh 4B-parameter instruction-tuned model. It ships with a large native context window. The vendor identity and specific base name are held under the vendor-naming discipline (see Curator CLAUDE.md); this manual calls it the "4B base". It is loaded in its MLX-native precision.

The path above is where the base model was installed into MLX's model cache. It is not a proprietary path — MLX places all downloaded models under `mlx-models/` by convention.

### The corpus

```yaml
data: /Users/alfred/.forge/corpus/sakura
```

The trainer reads `train.jsonl` and `valid.jsonl` from this directory. See §04 for the corpus method.

### The mode

```yaml
train: true
fine_tune_type: lora
num_layers: -1
```

- `train: true` — this is a training run, not an inference or eval.
- `fine_tune_type: lora` — LoRA adapter, base weights frozen.
- `num_layers: -1` — apply LoRA to all layers of the base model, not just the top N. Adapting all layers is the correct choice for behavior-shape SFT; top-only adapters do not carry the whole persona load.

### Batching and iteration

```yaml
batch_size: 2
iters: 55020
```

- `batch_size: 2` — small batch. Memory-bound on 32GB with LoRA rank 128, gradient checkpointing on, and `max_seq_length` 2048. Batch 2 is the largest we can hold without OOM under contention with the OS and background processes.
- `iters: 55020` — total iterations for this run segment. This number carries baggage: see "iter math" below. The number in `train.cfg` is a segment-level count, not a global training budget count.

### Iter math (critical)

The trainer counts local iters. Because the training arc runs across multiple resumed segments (crash-and-resume is normal per §10), the local iter count in any given run process is not the same as the model's total training exposure.

Canonical formula (from doctrine memory `reference_iter_math_sakura_4b_v2_2026_07_11`):

```
TRUE iter    = local + checkpoint_offset
TOTAL budget = 68520
REMAINING    = TOTAL - checkpoint_offset
```

The checkpoint offset is written to `resume-offset.json` when a run resumes from a checkpoint. The trainer's local iter counter starts at 0 for each process launch; the offset is added by the supervisor for reporting.

Reporting format at every checkpoint and status update:

```
iter: TOTAL=39000  local=5000  target=68520  progress=57%
```

Never divide local by total for progress reporting — it under-reports. Alfred caught this at 03:15 on 2026-07-11 and it is a load-bearing rule.

### Learning rate schedule

```yaml
seed: 7
learning_rate: 8.7916e-05
lr_schedule:
  name: cosine_decay
  warmup: 1500
  warmup_init: 5.0e-6
  arguments: [8.7916e-05, 53520, 1.0e-5]
```

The schedule is:

- 1500 warmup steps from LR 5.0e-6 up to peak 8.7916e-5.
- Then cosine decay over 53520 steps from peak to floor 1.0e-5.
- Total scheduled: 1500 + 53520 = 55020, matching iters.

The peak LR (8.7916e-5) was picked by iteration to be aggressive enough for adapter reshape and gentle enough for stable dynamics. Not a first-shot pick. Do not change without a defensible reason.

Floor LR (1.0e-5) is where the schedule lands at end-of-cosine. If iters run past 55020, the trainer holds the LR at floor.

The seed is 7 — a small prime, chosen to avoid harmonic interactions with the fold's row-ordering primes (see §09).

### Checkpoint and eval cadence

```yaml
steps_per_report: 50
steps_per_eval: 1000
save_every: 500
```

- `steps_per_report: 50` — a progress line every 50 local iters.
- `steps_per_eval: 1000` — validation loss computed every 1000 local iters. Adjust if the run is turbulent; frequent eval helps catch drift, but eval time is not free.
- `save_every: 500` — adapter checkpoint every 500 local iters. This is the resume anchor. If a run crashes, the next resume starts from the most recent checkpoint.

### Sequence length

```yaml
max_seq_length: 2048
```

Deliberate choice. See §07 for the full rationale on window sizing. Any change to this value triggers the post-test window-change protocol (§07).

### Adapter output

```yaml
adapter_path: /Users/alfred/.forge/runs/sakura-4b-v2/adapter
```

The LoRA adapter checkpoints land here. Each checkpoint is a numbered subdirectory (`0000500/`, `0001000/`, ...) preserving the full training state at that iter. Never delete adapter checkpoints; they are the resume anchors.

Damaged-run adapters (crash-corrupted) are preserved under `adapter-damaged-run-YYYYMMDD-HHMMSS/` in the same parent. Never delete these either. They are audit material.

### Optimizer + checkpointing

```yaml
grad_checkpoint: true
optimizer: adamw
```

- `grad_checkpoint: true` — activation recomputation on backward pass, trading compute for memory. Required at 4B + rank 128 + seq 2048 on 32GB.
- `optimizer: adamw` — AdamW (Loshchilov & Hutter, 2017) with decoupled weight decay. The Adam moment states are the largest contributor to memory pressure beyond the base weights.

### LoRA parameters

```yaml
lora_parameters:
  rank: 128
  scale: 2.0
  dropout: 0.05
  keys:
    - self_attn.q_proj
    - self_attn.k_proj
    - self_attn.v_proj
    - self_attn.o_proj
    - mlp.gate_proj
    - mlp.up_proj
    - mlp.down_proj
```

- `rank: 128` — the LoRA rank. See §02 for the picking rationale.
- `scale: 2.0` — alpha / rank = 2 (so alpha = 256). Standard Hu et al. (2021) ratio for stable dynamics.
- `dropout: 0.05` — mild regularization on the adapter forward pass.
- `keys` — the seven projection matrices that get LoRA-adapted. This is the standard "attn + mlp" target set. Adapting all seven gives the adapter reach across both the reasoning-shape (attn) and the transformation-shape (mlp) layers.

The trainable parameter count is approximately `rank × (in_dim + out_dim) × 7 projections × num_layers`. Exact value depends on the base model's layer geometry, which the manual does not name (see doctrine `familiarity-not-knowledge`). It is well under the base parameter count.

### Total trainable parameters

The LoRA adapter's trainable parameter count is on the order of low tens of millions. Not a spec number the model itself needs to know. Runtime queries to the adapter directory show the exact count.

### Epoch discipline

The `iters` field does not encode epochs directly. An epoch is `(train_row_count / batch_size)` iters at batch 2 over the corpus at ~315,000 train rows, that is approximately 157,500 iters per epoch — larger than the current 55,020-iter segment budget.

In practice the run does not target integer epochs. It targets the LR schedule length (55,020 iters) as a segment budget. If additional passes are needed, iters is extended on a fresh config, checkpoints resume, and the LR schedule is either continued or reset per the pass strategy.

The doctrine memory `project_full_training_procedure_handoff_2026_07_12` (referenced by the corpus scope doctrine) describes 3-pass discipline; the exact iter accounting per pass is a run-time decision anchored in the supervisor's ledger.

### Seed

```yaml
seed: 7
```

A small odd prime, deliberately chosen. See §09 for the prime-number spacing rationale.

### What is NOT in the config

Not in `train.cfg` but load-bearing:

- **PROMPT TEMPLATE.** The prompt template Sakura is trained on is supplied by `mlx_lm`'s default chat template for the base model family. If we need to override, we do so at inference time via the tokenizer's `chat_template`. The training pairs in `train.jsonl` are in `:messages` format that MLX resolves.
- **TOKENIZER.** Comes with the base model. No custom tokenizer.
- **QUANTIZATION.** Base model is loaded at native precision. Any post-training quantization for inference is a separate step.
- **REWARD MODEL.** None. There is no RLHF.
- **PREFERENCE DATA.** None. There is no DPO or PPO.

### Reproducibility

With the same:

- Base model checkpoint
- Corpus (Merkle-verified)
- Config
- Seed
- MLX version

The run reproduces to within MLX's floating-point determinism (not bit-exact due to non-associative float ops but functionally stable). This is the reason we sign the corpus and pin the config.

### Change discipline

Changes to `train.cfg` are:

1. Made on a new config file with a versioned name (`train.cfg.v2`, `train.cfg.rebalance-6h`, etc. — see the existing named variants under `~/.forge/runs/backups-2026-07-12/sakura-4b-v1/`).
2. Documented in a comment block at the top of the new config describing why the change was made and what the prior config was.
3. Signed off by the supervisor before the resume runs against the new config.
4. Preserved in place after the run completes — never edit in place, never overwrite.

### One-paragraph summary

4B base + LoRA rank 128 alpha 256 dropout 0.05 across seven projections in all layers + AdamW + grad checkpointing + batch 2 + seq 2048 + cosine decay peak 8.79e-5 warmup 1500 floor 1.0e-5 + seed 7 + checkpoint every 500 + eval every 1000. Every choice is defensible; every choice is preserved in the versioned config history; every resume respects the iter math.
