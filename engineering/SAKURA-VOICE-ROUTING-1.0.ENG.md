# Sakura Voice Routing 1.0 — Engineering

> **Status: REFERENCE.** Specifies the voice-channel routing architecture
> — how Sakura's L0/L1/Engram lateral-handoff pattern applies to a
> conversational voice loop where the operator speaks near-continuously
> while Sakura decides whether/when/how to respond. Sister doc to
> `SAKURA-VOICE-INTEGRATION-2026-06-27.md` (which specifies the byte-level
> chain) and `SAKURA-TRAINING-MANUAL-1.0-ENGINEERING.md` §§13-23 (which
> specifies the model layer). This doc is the routing brain that sits on
> top of both.
>
> Voice: HelloSurface gold standard. Drafted 2026-06-30 (B4 voice-routing
> dispatch). Every section is real research with paper citations, not
> memory-talk.

**Cross-links (read these first):**
- `SAKURA-VOICE-INTEGRATION-2026-06-27.md` — byte-level chain, barge-in
  state machine, slow-update queue, V/A voice pick, privacy
- `SAKURA-TRAINING-MANUAL-1.0-ENGINEERING.md` §13 (L0), §14 (L1), §15
  (L0↔L1 routing), §20 (infra-aware voice), §23 (lateral handoff +
  Engram-as-task-queue)
- `SAKURA-PERSONALITY-DISCIPLINE-2026-06-27.md` §4 (V vs A) — discipline
  this routing serves
- `HELLO-SURFACE-1.0-ENGINEERING.md` §47b-e (voice register floors,
  pensive mode, existential carve-out)
- `LOAM-1.0-ENGINEERING.md` §17 (substrate refuses English; Scheme only)
- `CLAUDE.md` — vendor-naming lock; L0/L1/L2 capability terminology

---

## §0 Executive summary

> **Architect's framing (verbatim, 2026-06-30):**
> *"The thing that I do like about our voice system is that our LLM is
> really in truth routing voice data and processing it back in order to
> write a response. A person speaking to our LLM, however, may speak
> near continuously as it decides to respond. So that means we have to
> get very clever at crafting these responses."*

Five-bullet TL;DR:

1. **We are a streaming pipeline, not a full-duplex speech-to-speech
   model.** ASR friend → L0/L1 reasoning → TTS friend. The reasoning
   tier is the brain; the audio tier is two collaborating tools on
   either side. This buys us debuggability, vendor flexibility,
   per-operator caching, and clean compliance audit trails — at the
   cost of natively-preserved prosody that full-duplex models keep
   for free. *(See §1, §12.)*

2. **The hard problem isn't "barge-in" — that's solved by the cascade
   in §3 of the voice-integration doc. The hard problem is the three
   discrimination cases an LLM-driven pipeline must execute in
   < 300ms: (a) backchannel-only · (b) resume-with-bridge · (c)
   abandon-and-pivot.** A pure VAD pipeline can't tell these apart;
   silence alone discriminates none. The 2024-2026 literature
   consolidates around a **VAD + semantic-VAD + Voice-Activity-Projection
   ensemble** (§3, §5).

3. **Anticipatory generation is mandatory at our latency target, not
   optional.** Composing on partial transcripts saves 500-1500ms per
   turn. The cost — wasted L1 calls on hypothesis flips — is bounded
   by a confidence-score-gated EagerEndOfTurn signal (Deepgram Flux
   pattern, §4) plus the **operator's per-folder prefix cache** that
   makes restarts cheap. With prefix-cache hit rate ≥ 80%, a flipped
   speculative call costs ~50ms not ~500ms. *(See §4.)*

4. **"Our way" applies cleanly.** The L0/L1/Engram lateral-handoff
   pattern from training manual §23 maps onto voice with no new
   topology: L0 owns VAD + backchannel detection + streaming ASR + audio
   choreography + honest-null; L1 owns reasoning + bridge phrases +
   resume-vs-abandon arbitration + streaming TTS; Engram is the shared
   substrate where partial transcripts, hypothesis chunks, and response
   tokens flow as CRDT-ordered task units. The lateral work-stealing
   from §23.2 (L0 ↔ L1 bidirectional) becomes the speculative-streaming
   protocol. *(See §8.)*

5. **The build map is finite.** Seven new components — turn-taking
   controller · backchannel detector · semantic endpoint classifier ·
   resume-decision arbiter · streaming-TTS-with-fade · L0↔L1 audio
   coordination protocol · per-operator voice persona cache. Five of the
   seven are sub-1M-param models. None require new infrastructure
   beyond what Engram already provides. The 200-300 pair conversational
   repair corpus is the one substantive content authoring need. *(See
   §10, §11.)*

The shape of the answer to the architect's "very clever at crafting
these responses" is: **don't be clever — be observable.** Sakura tells
the operator what she's hearing and thinking via real-time choreography
(the §20 infra-aware vocabulary extended to voice); when she's
uncertain, she emits a backchannel; when she's confident, she takes the
floor; when she yields, she yields with a bridge. The architecture is
honest with the operator about its own state. That's what "clever" looks
like in practice.

---

## §1 — State of the art: full-duplex voice LLMs

Three production-grade full-duplex systems exist as of mid-2026, plus
one open research model. We summarize each, then assess.

### §1.1 Moshi (Kyutai, arXiv 2410.00037)

The first real-time full-duplex speech-to-speech foundation model
released open-weights ([Kyutai](https://github.com/kyutai-labs/moshi);
[paper](https://arxiv.org/abs/2410.00037)).

- **Architecture**: 7B-parameter Temporal Transformer (backbone) + small
  Depth Transformer (inter-codebook dependencies); audio tokens come
  from Mimi, a streaming neural audio codec at 12.5 Hz / 1.1 kbps with
  80ms frame size ([Mimi specs](https://huggingface.co/docs/transformers/model_doc/mimi)).
- **Inner monologue**: predicts time-aligned text tokens as a prefix to
  audio tokens; "significantly improves linguistic quality." This is
  the mechanism we explicitly invoke in our pipeline's filler-on-escalate
  pattern (training manual §20; voice-integration §7).
- **Two parallel audio streams**: one Moshi speaks, one user speaks.
  Native overlap handling. No explicit turn segmentation needed.
- **Latency**: 160ms theoretical, 200ms practical on an L4 GPU.
- **License**: MIT (Python) / Apache 2.0 (Rust); weights CC-BY 4.0.
- **Hardware**: ~24GB VRAM (PyTorch, no quantization); MLX on Apple
  Silicon; Rust/Candle quantized down to int8.

### §1.2 GPT Realtime (OpenAI, refreshed 2025-08)

OpenAI's production full-duplex API ([gpt-realtime
launch](https://openai.com/index/introducing-gpt-realtime/);
[Realtime API docs](https://platform.openai.com/docs/models/gpt-4o-realtime-preview)).

- **Architecture**: end-to-end audio-in/audio-out single model;
  WebSocket transport; server-side VAD with semantic VAD option
  (2024-Q4 addition).
- **Turn detection**: VAD + semantic VAD; interruption is first-class
  (TTS stops on detected user voice); function calls in background
  while model keeps talking.
- **Latency**: sub-second end-to-end typical; the cancel cascade is
  handled inside the model.
- **Pricing (2025-08)**: $32/M input audio tokens · $64/M output audio
  tokens · ~$0.0192/min in · ~$0.0768/min out · ~$2.88/hr 50:50 split
  ([per-minute math](https://x.com/rohanpaul_ai/status/1964167717709033546)).
- **Cached input** at $0.40/M tokens — 80x cheaper than fresh input.

### §1.3 Gemini Live (Google, on Vertex AI 2025)

Google's full-duplex API, native audio variant ([Vertex announcement](https://cloud.google.com/blog/products/ai-machine-learning/gemini-live-api-available-on-vertex-ai);
[Live API guide](https://ai.google.dev/gemini-api/docs/live-guide)).

- **Architecture**: Gemini 2.5 Flash Native Audio; raw audio in, raw
  audio out, no intermediate text representation. Full-duplex WebSocket.
- **Recommended buffer**: 500-800ms (server default ~800ms) — this is
  the trade-off knob between latency and audio chunk contextuality.
- **Pricing (2025)**: $0.300/M input tokens · $2.50/M output tokens
  · ~$0.0368/min for live-audio at 25 tokens/sec ([CloudPrice](https://cloudprice.net/models/google-gemini-2-5-flash-native-audio)).
- **Affordable enough** to enable a "voice everywhere" tier
  experimentally — about ½ the cost of OpenAI Realtime per minute.

### §1.4 Voxtral (Mistral, 2025-2026)

Two product lines under the Voxtral name ([Voxtral paper arXiv
2507.13264](https://arxiv.org/abs/2507.13264);
[TTS](https://mistral.ai/news/voxtral-tts/)).

- **Voxtral STT** (multimodal audio understanding): audio encoder based
  on Whisper large-v3 + multimodal LLM decoder. Mini 3B · Small 24B
  variants. Not full-duplex — it's an enhanced transcribe+reason model.
- **Voxtral TTS**: 4B-parameter, transformer-based autoregressive
  flow-matching; runs on consumer hardware; voice clones from <5s audio.

Voxtral is interesting as L1 reasoning model that natively understands
audio (skipping the ASR translation), but it's not full-duplex.

### §1.5 Honest assessment — would adopting full-duplex be better?

Per the 2026 production literature consensus, the answer for us today
is **no, but soon-ish**.

**The cascaded pipeline is still the production default in 2026** ([LiveKit
sequential pipeline](https://livekit.com/blog/sequential-pipeline-architecture-voice-agents);
[Hamming AI](https://hamming.ai/blog/are-speech-to-speech-models-ready-to-replace-cascade-models)).
Hybrid approaches that use S2S for simple fast exchanges and cascade
for complex reasoning are emerging as the front-runner pattern. Our
existing L0+L1+L2 tiering MAPS DIRECTLY onto a hybrid: voice S2S could
be a future L0-replacement-when-Magic, with L1+L2 cascade kept for deep
reasoning. *[See §12 for the full tradeoff matrix and our recommendation.]*

What full-duplex models do better:
- Native prosody preservation (no text bottleneck losing emotion)
- Native overlap handling (parallel streams, no cancel cascade needed)
- Lower latency (160-200ms theoretical vs our 400-800ms target)

What our cascade does better:
- Per-operator prefix-cache hits on a stable warm L1 context (§4.3) —
  full-duplex models can't currently cache per-operator persona the
  same way because the audio context isn't a stable prefix
- Vendor swap without retraining (audio chain swap is one line of code
  per friend)
- Compliance audit trails at the text-transcript layer (text is the
  evidence)
- Tool calling reliability (text-grounded tool reasoning is mature; S2S
  tool reasoning is still improving per [Full-Duplex-Bench-v3 arXiv
  2604.04847](https://arxiv.org/pdf/2604.04847))
- Honest-null escalation: our `escalate 'service-not-yet-wired` works
  uniformly across L0/L1/L2; a single full-duplex model can't degrade
  partially the same way

**The bet**: keep our cascade as canonical; treat full-duplex as a
candidate substitute for the L0+L1 hot-path on Magic tier specifically,
once Magic-operator volume justifies the per-minute cost economics.
*[Open architect call §14.Q1.]*

---

## §2 — Streaming ASR + partial transcripts

The transcribe friend (capability `voice/transcribe`) is where the
audio-to-text translation happens. The constraint: we need partial
transcripts in < 200ms so anticipatory generation (§4) has something to
work with.

### §2.1 The locking problem

A streaming ASR system emits a sequence of hypotheses where each
hypothesis is a *guess* at the transcript-so-far. As more audio arrives,
the system may *change its mind* about earlier words. The
hypothesis-stability question: when can L0/L1 trust a transcript chunk
enough to start reasoning on it?

The literature consensus on stability ([Whisper-Streaming "Local
Agreement"](https://github.com/ufal/whisper_streaming);
[WhisperPipe arXiv 2604.25611](https://arxiv.org/pdf/2604.25611);
[two-pass decoding arXiv 2506.12154](https://arxiv.org/html/2506.12154v1)):

- **Two-tier commit policy**: separate stable-committed text buffer
  from volatile active-audio buffer. Commit a chunk to the stable
  buffer when (a) two consecutive hypotheses agree on it (perfect
  inter-hypothesis consistency) OR (b) multi-hypothesis similarity via
  word-level Levenshtein exceeds threshold.
- **Logistic-regression stability scoring** per partial word; partial
  words above threshold are committed immediately, others withheld.
- **Stability/latency tradeoff**: raising the threshold improves
  stability but adds 18.6% mean partial delay per the [WhisperKit
  benchmarks](https://arxiv.org/pdf/2507.10860).

### §2.2 Open-source streaming options

| Capability | Open-source impl | Notes |
|---|---|---|
| Whisper-base streaming | Whisper-Streaming (ufal) | Reference impl; LocalAgreement policy; uses faster-whisper backend |
| Low-latency Whisper | Distil-Whisper large-v3 | ~50% fewer params · ~6x faster · WER within ~1% |
| Production Whisper | Faster-Whisper (CTranslate2) | int8 quantization · fastest local Whisper on NVIDIA |
| Causal streaming Whisper | WhisperRT / CarelessWhisper [arXiv 2508.12301](https://arxiv.org/html/2508.12301v1) | Restructures Whisper to be true streaming, not chunked |
| On-device Apple | WhisperKit | Core ML · streaming · word-level timestamps · VAD ([arXiv 2507.10860](https://arxiv.org/pdf/2507.10860)) |

**Streaming-ASR latency targets in production (2025-2026
benchmarks)**: WhisperKit and Fireworks hit ~0.45s mean streaming
hypothesis latency; Deepgram ~0.83s; Chirp 3 250-400ms band; Moonshine v2
([arXiv 2602.12241](https://arxiv.org/pdf/2602.12241)) ergodic
streaming encoder targets the latency-critical lane.

### §2.3 Hallucination on silence — the production gotcha

Whisper's notorious failure mode: on silence or low-confidence audio,
embeddings approach zero and the decoder fills in repetitive text
(loops the most recent phrase). Production fixes ([Memo AI](https://memo.ac/blog/whisper-hallucinations);
[dev.to](https://dev.to/nareshipme/whisper-hallucination-on-silence-why-your-transcript-loops-the-same-phrase-2pg4)):

1. **VAD pre-filter** (Silero VAD): skip non-speech segments entirely.
   We already do this — §3 of voice-integration uses VAD as state
   trigger.
2. **No-speech confidence threshold**: discard segments where Whisper's
   internal no-speech-prob exceeds 0.6.
3. **`condition_on_previous_text=False`** for batch jobs > 10 min.
4. **Adequate padding**: shorter paddings increase hallucination.

### §2.4 Curator recommendation

- **L0 streaming ASR**: WhisperKit-style on-device for Apple Silicon
  operators; faster-whisper distil-large-v3 on backend ASR friend for
  others. CPU-only acceptable per Smart Turn precedent (§3.4).
- **Commit policy**: LocalAgreement two-hypothesis-match for chunks
  ≤ 5 words; logistic-regression stability score for longer.
- **L0 receives partial transcripts** with per-word stability scores;
  L0 holds back the partial until either (a) the stable buffer
  accumulates a parsable utterance fragment or (b) the unstable buffer
  exceeds 8 words (force-commit to avoid lag).
- **Hallucination guard**: mandatory VAD pre-filter + 0.6 no-speech
  threshold; honest-null `escalate 'asr-confidence-low` on threshold
  breach rather than fluent-wrong text into L1.

*[Wire-call vendor for backend ASR friend named in
`curator_api/voice/transcribe_client.py` ONLY; capability name elsewhere
per CLAUDE.md vendor lock.]*

---

## §3 — Endpoint detection beyond simple VAD

VAD alone tells you when audio energy is high enough to be speech; it
**cannot tell you whether a speaker finished their thought**. The
literature consensus 2024-2026 is that VAD-only endpointing is
inadequate for production voice agents.

### §3.1 The four endpoint-detection approaches

Per LiveKit's [turn detection taxonomy](https://livekit.com/blog/turn-detection-voice-agents-vad-endpointing-model-based-detection)
and the [Pipecat Smart Turn docs](https://docs.pipecat.ai/pipecat-cloud/guides/smart-turn):

1. **VAD-only**: classifies audio frames as speech vs non-speech;
   silence > N ms threshold ends turn. Latency tied entirely to the
   threshold. An 800ms silence threshold adds nearly a full second to
   *every* response.
2. **STT endpointing**: relies on the ASR provider's own utterance-end
   signal. Faster than waiting for full silence, but provider-bound.
3. **Model-based detection**: a classifier reads partial transcripts +
   audio and predicts semantic completion. Can fire *before* trailing
   silence. Better median latency; risk of mid-sentence-pause
   false-positives.
4. **Realtime-model native turn-taking**: a full-duplex model handles
   it natively (Moshi, GPT-4o Realtime).

### §3.2 Semantic VAD (model-based)

"Semantic VAD" = a language model evaluates whether the user's
utterance is *complete* using linguistic completeness + prosodic cues +
conversational context + filler-token signals (["um", "uh"]) ([Inworld
explainer](https://inworld.ai/resources/what-is-semantic-vad);
[Phoenix-VAD arXiv 2509.20410](https://arxiv.org/abs/2509.20410)).

The OpenAI Realtime API shipped Semantic VAD in 2024 Q4. Phoenix-VAD
(2025) is the open-research equivalent, using a sliding-window training
strategy on an LLM backbone for streaming semantic endpoint detection.

### §3.3 Voice Activity Projection (VAP) — the predictive approach

VAP models continuously predict upcoming voice activities of both
participants in dialogue, leveraging a cross-attention transformer over
the dynamic interplay between participants ([VAP real-time arXiv
2401.04868](https://arxiv.org/abs/2401.04868); [multilingual VAP arXiv
2403.06487](https://arxiv.org/abs/2403.06487); [prompt-guided VAP
arXiv 2506.21191](https://arxiv.org/pdf/2506.21191)).

Key properties:
- Predicts *future* voice activity windows, not just current state →
  enables anticipation, not just reaction
- Multimodal extensions (visual: gaze + head pose + gesture per [arXiv
  2505.21043](https://arxiv.org/pdf/2505.21043)) lift accuracy further
- Multilingual single-model: a 2024 LREC-COLING result showed a single
  multilingual VAP performs on par with per-language models

### §3.4 Smart Turn — the production-ready open-source pick

Pipecat's [Smart Turn v3](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/)
is the open-source semantic VAD that hits the latency target without a GPU:

- ~8M params (Whisper Tiny base + linear classifier)
- int8 quantized → 8MB on disk
- **12ms CPU inference** on modern CPUs; 60ms on low-cost AWS instance
- No GPU required → runs inside any backend container alongside the
  ASR friend
- HF Hub: `pipecat-ai/smart-turn-v3`

### §3.5 SpeculativeETD — the dual-tier pattern

[SpeculativeETD arXiv 2503.23439](https://arxiv.org/abs/2503.23439)
introduces a **two-stage cooperative architecture that maps cleanly
onto our L0/L1 split**:

- **On-device GRU** (~1M params; 2 Conv2D + 1 GRU): binary speak/non-speak
  classification; iPhone 12 mini per-inference latency 0.26ms; 79.34%
  accuracy on synthetic data.
- **Server Wav2vec 2.0** (~94M params): activated only after on-device
  silence detection; three-way classification (pause vs definitive
  end-of-turn); GPU; 99.49% accuracy.
- **Combined**: 919.64 megaFLOPs vs 34,971 for full Wav2vec → **97%
  compute saved** with near-Wav2vec accuracy.

This is *exactly* the L0-handles-first-cut, L1-verifies-the-hard-cases
pattern Curator already uses for cart classification. Same trick applied
to endpoint detection.

### §3.6 Prosodic cues — the human signal

Per conversation-analysis literature ([Sacks/Schegloff TRP
foundations](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00731/full);
[turn-taking timing review](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4357221/)),
humans use:
- **Falling intonation** (pitch contour going down → projecting end)
- **Final word lengthening** (last syllable elongated)
- **Slowing rhythm** (gap between words widening)
- **Trailing breath / exhale** (audible exhale → end signal)

[How Much Does Prosody Help arXiv 2209.05161](https://arxiv.org/pdf/2209.05161)
shows prosody adds ~10-15% to VAP turn-taking accuracy over text-only
baselines.

### §3.7 Curator recommendation

**Ensemble endpoint detector at L0**, with L1 verification on
uncertain cases:

| Layer | Signal | Latency | Role |
|---|---|---|---|
| L0-A | Silero VAD frame-level | 10-30ms | Gate downstream; trigger barge-in cascade per voice-integration §3 |
| L0-B | Smart Turn v3 CPU classifier | 12-60ms | Semantic endpoint on partial transcript; emits **EagerEndOfTurn** + **EndOfTurn** signals per Deepgram-Flux model |
| L0-C | Backchannel detector (§5) | <50ms | Suppress EndOfTurn fires when output is a backchannel only |
| L1 (escalated only) | Resume-vs-abandon arbiter (§7) | 100-300ms | Triggered only when Smart Turn confidence is medium (eagerness band) |

Total endpoint-detection latency on the L0-only path: ~60-120ms.
L1-verified path: ~200-400ms (only for medium-confidence cases).

The arbiter at L1 has access to the full conversation history + the
operator's per-folder Engram state — which is exactly what enables the
backchannel/resume/abandon discrimination that pure acoustic signals
can't make. *[See §7.]*

---

## §4 — Anticipatory response generation

"Compose the response while the operator is still talking" is the
single biggest latency win available to a cascaded pipeline. The
technique is well-named in the literature: **speculative generation**.

### §4.1 The pattern

Per [Pipecat preemptive issue
#3321](https://github.com/pipecat-ai/pipecat/issues/3321) +
[Deepgram Flux](https://deepgram.com/learn/introducing-flux-conversational-speech-recognition):

```
operator still speaking
       │
       ├─→ stable partial transcript T_n arrives
       │      │
       │      ├─→ confidence > eager_threshold (~0.3-0.5)
       │      │       │
       │      │       └─→ speculative L1 call begins on T_n
       │      │                  │
       │      │                  └─→ TTS friend begins synthesis
       │      │                       (audio NOT played yet — buffered)
       │      │
       │      └─→ confidence > commit_threshold (~0.7)
       │              │
       │              └─→ EndOfTurn fires; if speculation matches,
       │                  play buffered audio (zero added latency)
       │
       └─→ operator continues talking past speculation
              │
              └─→ TurnResumed signal cancels speculative call;
                  retry after next stable partial
```

### §4.2 Cost economics

The wasted-call cost: speculative L1 calls cancelled by TurnResumed.
Per Deepgram Flux docs: eager mode trades **50-70% increased LLM calls
for reduced latency**. At our backend cost ladder, this matters:

| Tier | Eager L1 spec rate | Wasted call cost (per turn) | Savings (per turn) |
|---|---|---|---|
| L0-only (8B Fly RR) | ~0.5x extra calls | ~$0.0001 | 300-800ms |
| L1→L2 cascade | ~0.3x extra calls | ~$0.005 | 800-1500ms |

The math says **eager generation is cheap when L0 owns it, expensive
when L2 owns it**. Recommendation: speculative generation defaults ON
at the L0/L1 boundary; OFF at the L1/L2 boundary unless operator is on
Magic tier.

### §4.3 Prefix caching — what makes wasted calls actually cheap

The wasted-call cost above is the *worst case* — fresh inference. With
**operator-folder prefix caching**, a cancelled speculative call costs
~50ms not ~500ms because the persona context is already warm.

Per [LMCache + vLLM benchmarks](https://llm-d.ai/blog/kvcache-wins-you-can-see)
and [voice agent latency techniques](https://futureagi.com/blog/how-to-optimize-voice-agent-latency-2026/):

- Major LLM providers cache prompt prefixes server-side
- Saves 200-400ms TTFT on cache hits
- 1500-token system prompt: 200-300ms TTFT cached vs 500-800ms cold
- **Healthy production voice agent: ≥80% prefix-cache hit rate**

Pitfalls that *defeat* prefix caching:
- Dynamic timestamps in system prompt
- Randomly ordered tool definitions
- Per-turn user IDs interpolated near the top

Our existing sticky-routing-by-operator_id pattern (training manual
§23.1) is exactly the topology that makes prefix caching work. We just
need to keep the warm-prefix discipline: persona + brand voice + cortex
warm slice goes in a stable position, dynamic per-turn data goes at the
end.

### §4.4 LTS-VoiceAgent — the listen-think-speak framework

[LTS-VoiceAgent arXiv 2601.19952](https://arxiv.org/pdf/2601.19952) is
worth citing as a 2026 framework explicitly designed for this:
semantic-triggering + incremental reasoning → speculative generation
woven into the conversation loop, not bolted on as a separate stage.

### §4.5 Curator recommendation

- Default eager-generation **on** at the L0/L1 boundary at all tiers
- Default eager-generation **off** at the L1/L2 boundary; on for Magic
  per the operator-folder cost cap (W7B per-op spend check first)
- Eager-threshold 0.4 (medium); commit-threshold 0.7 (high) — Deepgram
  Flux defaults
- Cancel cascade on TurnResumed: same 100ms budget as barge-in
  (voice-integration §3.2)
- Per-operator prefix-cache discipline enforced via lint at L1 prompt
  build time: warm prefix prefix is stable per operator across turns

---

## §5 — Backchannel detection (the missing piece, architect-named)

**This is the section the architect named as the gap.** The hard
problem: distinguishing *"the operator is signaling they're listening,
keep going"* from *"the operator wants the floor."* A pure VAD pipeline
can't tell these apart; they both fire VAD.

### §5.1 What backchannels are

Per conversation-analysis foundations (Yngve 1970, Schegloff 1982
"continuers"):

> Short feedback-like turns — "hmm", "yeah", "right", "uh-huh", "mm",
> "oh", "I see" — precisely timed to occur at Transition Relevance
> Places (TRPs). They signal feedback to the main speaker (e.g., yeah,
> right) and other minimal utterances that do not constitute an
> attempt to take the floor.
> — [Frontiers timing review](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00731/full)

The English backchannel vocabulary is small (~20-30 core tokens
covering 90% of occurrences). The discrimination signal is therefore
heavily **acoustic + positional**, not lexical.

### §5.2 The acoustic-vs-lexical balance

Per [Improving Backchannel Prediction
(2024)](https://www.researchgate.net/publication/400313792_Improving_Backchannel_Prediction_Leveraging_Sequential_and_Attentive_Context_Awareness)
on the Switchboard benchmark:

> Acoustic cues are more important than lexical cues, and their
> combination works best on both manual transcriptions and
> automatically generated transcriptions.

Concrete acoustic signals:
- **Short duration** (<400ms)
- **Low energy** relative to the operator's main-turn energy
- **Overlap-with-speaker**, not after-pause — backchannels typically
  come *during* the floor-holder's turn, not after a TRP gap
- **Falling-then-rising intonation** (uh-huh) or flat (mm)
- **Non-lexical fillers** (mm, hm) — phonologically distinct from
  speech-onset words

### §5.3 State-of-the-art backchannel predictors

| Model | Reference | What it does | Notes |
|---|---|---|---|
| VAP-fine-tuned | [arXiv 2410.15929](https://arxiv.org/pdf/2410.15929) | Real-time backchannel prediction with timing + type on unbalanced real-world data | "Yeah, Un, Oh: Continuous and Real-time Backchannel Prediction" — 2024 |
| Acoustic+LLM fusion | ICASSP 2024 | Combines acoustic + LLM lexical | Multimodal lift |
| Multimodal VAP | [June 2025](https://www.jstage.jst.go.jp/article/transinf/E108.D/6/E108.D_2024HCP0002/_article) | Non-verbal + acoustic + visual | Better than acoustic-only |
| RESPOND | [arXiv 2603.21682](https://arxiv.org/pdf/2603.21682) | Responsive Engagement Strategy | 2026 — orchestrated turn-taking + backchannel-aware response |

### §5.4 Curator recommendation

**L0 owns backchannel detection.** A small classifier (~200-500K params)
on the L0 audio + partial-transcript stream that emits one of three
labels every 100ms:

```
{
  backchannel,    // operator signaled listening; Sakura continues speaking
  take-floor,     // operator wants to interrupt; barge-in cascade fires
  pause-or-think  // ambiguous; semantic-VAD + eager-gen handle it
}
```

Features:
- Acoustic: 13-dim MFCC + pitch contour + energy ratio to recent
  Sakura output
- Lexical: presence-of-backchannel-token in last 300ms of L0 partial
  transcript
- Positional: time-since-last-Sakura-utterance-onset (backchannels
  cluster during Sakura's speaking, take-floor clusters after)

Sized to run alongside Smart Turn v3 on CPU; latency budget 30ms.

**Sakura emits her own backchannels** too — see §10.4 below. This is
symmetric: Sakura signals to operator she's hearing them via "mm" /
"right" / "yeah" tokens emitted at TRPs during operator's long turns,
delivered through TTS without interrupting operator. The
training-manual §23.4 infra-aware vocabulary extends to backchannel-aware
speech.

---

## §6 — Multi-LLM voice strategies — how multiple models coordinate

A voice loop is rarely a single LLM. The production literature
consolidates around two open-source frameworks and a handful of
commercial offerings; the patterns they each implement are what
matters.

### §6.1 Pipecat (open-source)

[Pipecat docs](https://docs.pipecat.ai/pipecat/learn/speech-input);
[smart-turn](https://github.com/pipecat-ai/smart-turn).

- **Pipeline-based**: processors chained `VAD → STT → LLM → TTS → audio`,
  each handling one task
- **Smart Turn v3** for semantic endpoint detection (§3.4)
- **Multimodal transport**: WebRTC + telephony + WebSocket
- **Interruption first-class**: barge-in enabled by default
- **Hooks at every seam** — backchannel injection, response cancellation,
  context modification mid-stream

Pipecat is the most architecturally similar reference for what we're
building. Worth reading their production guide ([Luong Hong
Thuan](https://luonghongthuan.com/en/blog/pipecat-voice-agent-production-scalable-guide/))
for operational gotchas.

### §6.2 LiveKit Agents

[LiveKit Agents docs](https://docs.livekit.io/agents/voice-agent/);
[architecture explainer](https://livekit.com/blog/voice-agent-architecture-stt-llm-tts-pipelines-explained).

- Voice agent joins a LiveKit "room" as a participant
- VoicePipelineAgent = STT/LLM/TTS pipeline with mid-stream text
  modification
- Native SIP support (2025) — direct phone integration without Twilio
  bridge
- Published industry medians 1.4-1.7s; p99 3-5s — per LiveKit ([real-time
  vs turn-based comparison](https://softcery.com/lab/ai-voice-agents-real-time-vs-turn-based-tts-stt-architecture))

### §6.3 Commercial offerings

| Vendor | Architecture | Notes |
|---|---|---|
| Daily.co | Pipecat-derived | Owns Smart Turn open-source effort |
| Vapi | Pipeline + S2S hybrid | Auto-routes per turn |
| Deepgram Voice Agent | Flux + cascade | Native EagerEndOfTurn signals |
| Retell AI | Pipeline | Phone-first |

### §6.4 Multi-LLM-as-router pattern (the relevant one)

The pattern that matters for us: **separate small models per
narrow capability**, with the big reasoning LLM only doing the
reasoning. Per [LTS-VoiceAgent](https://arxiv.org/pdf/2601.19952)
+ [SpeculativeETD](https://arxiv.org/abs/2503.23439):

| Capability | Model | Size | Latency budget |
|---|---|---|---|
| VAD frame-level | Silero VAD | <1M | 10-30ms |
| Semantic endpoint | Smart Turn v3 | 8M | 12-60ms |
| Backchannel detect | Custom acoustic+lex classifier | <500K | 30-50ms |
| Resume-vs-abandon arbiter | Small distilled LLM or rule-based on partial | ~50M or rule | 100-200ms |
| Main reasoning | L0 (1.7B) or L1 (8B) or L2 | 1.7B-300B | 200-2000ms |
| Streaming TTS | Voice-cloned model | varies | 100ms TTFA |

The reasoning LLM should never be doing turn-detection grunt work; that
budget belongs to the small models.

### §6.5 Latency budgets at each hop (production target)

| Hop | L0-only target | L0+L1 target | L1+L2 target |
|---|---|---|---|
| Audio in (WebRTC) | <50ms | <50ms | <50ms |
| Streaming ASR partial | 100-200ms | 100-200ms | 100-200ms |
| Endpoint detection | 60-120ms | 60-120ms | 60-120ms |
| Reasoning (TTFT) | 100-300ms | 300-800ms | 800-2000ms |
| Streaming TTS TTFA | 100-200ms | 100-200ms | 100-200ms |
| Audio out (WebRTC) | <50ms | <50ms | <50ms |
| **Total perceived** | **400-700ms** | **600-1400ms** | **1300-2600ms** |

The thresholds (§9) say: L0-only "feels conversational"; L0+L1 is
upper-edge-of-acceptable; L1+L2 needs filler-on-escalate (§7 of
voice-integration) to feel honest about the wait.

---

## §7 — Google's voice stack accessible via AI Studio

The architect asked specifically about Google's stack. Capability
inventory (named only at the wire-call boundary per CLAUDE.md vendor
lock; in operator-facing surfaces it's `voice/transcribe` /
`voice/synthesize` / `voice/duplex`):

### §7.1 Components

| Capability | Service | Notes |
|---|---|---|
| Streaming ASR | Chirp 3 (multilingual ASR) | 125+ languages · 250-400ms latency band · StreamingRecognize API |
| Full-duplex S2S | Gemini Live API (2.5 Flash Native Audio) | WebSocket bidirectional · 500-800ms recommended buffer · ~$0.0368/min |
| TTS (legacy waveform) | WaveNet / Studio voices | Higher quality · slower TTFA |
| Orchestration | Vertex AI Pipelines | Production deploy + monitoring |

### §7.2 AI Studio tier (free / dev)

Free tier provides Live API access for prototyping; rate-limited.
Production deploy goes via Vertex AI.

### §7.3 Adopting full-stack — what changes

If we adopted Google's full stack:
- L0 stays (on-device 1.7B + operator's phone)
- L1 reasoner becomes Gemini 2.5 Flash Native Audio for *voice path*
- Text path stays on our 8B Fly round-robin pool
- L2 deep reasoning stays Claude/Gemini per current router
- Voice/transcribe friend becomes Chirp 3 (already what we use for
  some voice routes per CLAUDE.md L1 sharpening 2026-06-26)

The gain: native full-duplex, lower latency, no cancel-cascade
complexity, no separate semantic-VAD.

The loss:
- Per-operator persona prefix caching becomes harder (Gemini Live's
  context model is different from text-LLM prefix caching)
- Vendor lock for the entire voice hot path
- Loss of debuggability at the text-transcript layer
- Less control over voice character (Gemini Live's voices vs our
  curated V/A pick)

### §7.4 Curator recommendation

**Keep Chirp 3 as one of the ASR friends in the L1 round-robin pool**
for non-Apple-Silicon operators (already true per current routing).
**Defer Gemini Live adoption** until Magic-tier operator volume gives
us cost-justification for vendor-locked-voice on that tier. *[See §12
+ §14.Q1 for the full hybrid recommendation.]*

---

## §8 — "Our way" — L0/L1/Engram per-operator architecture applied to voice

The architect's specific ask. Map the patterns locked in training
manual §23 onto voice. **The mapping is clean — no new infrastructure.**

### §8.1 L0 on-device responsibilities (voice extension)

Per training manual §13 + voice-integration §3. New voice-specific
duties:

| Capability | Why on L0 | Latency |
|---|---|---|
| VAD frame-level (Silero) | Audio never leaves device for negative frames; privacy + bandwidth | 10-30ms |
| Backchannel detector (§5) | Acoustic signals are most informative at frame-level; sending to L1 wastes a round-trip | 30-50ms |
| Streaming ASR (WhisperKit on Apple Silicon / faster-whisper else) | Tier of operators where transcription quality is sufficient on-device → keep transcript local | 100-200ms partial |
| Smart Turn v3 semantic endpoint | CPU-fast; can fire endpoint signals without round-trip | 12-60ms |
| Audio choreography (fade/hold/acknowledge) | Audio buffer manipulation must be ≤ 5ms; must be co-located with playback | <5ms |
| Simple intent classification | Already part of L0's grid-and-commerce reasoning | included in L0 reasoning budget |
| Honest-null when L1 unreachable | L0 must speak honestly about being offline — "I can still do the small stuff" per §23.4 vocabulary | included |
| L1 escalation token emission | Decision point: this turn needs L1 reasoning | included |

### §8.2 L1 per-operator-folder responsibilities (voice extension)

Per training manual §14 + §23. New voice-specific duties:

| Capability | Why on L1 | Latency |
|---|---|---|
| Full reasoning on transcribed text | Reasoning depth requires 8B+ | 300-800ms TTFT |
| Resume-vs-abandon arbitration | Requires full conversation context; backchannel can't decide; only L1 has the operator's persona + cortex history | 100-300ms |
| Bridge-phrase generation per persona | Operator's preferred bridge phrases live in their Engram folder | included in reasoning |
| Streaming TTS via voice/synthesize | TTS friend is L1-tier (capability `voice/synthesize`) | 100-200ms TTFA |
| Prefix-cache hits on operator's voice persona | Sticky routing + warm persona prefix per training manual §23.1 | enables 200-400ms TTFT savings |
| Slow-update queue management (voice-integration §4) | Cortex queue lives in operator's Engram folder | included |

### §8.3 Engram-as-shared-substrate for voice (training manual §23.2 applied)

The CRDT/vector-clock substrate that already powers cart task units
also powers voice work-stealing. Voice-specific task types:

| Task type | Direction | Trigger | Receiver action |
|---|---|---|---|
| `partial-transcript` | L0 → L1 | Stable partial above eager-threshold | L1 begins speculative reasoning (§4) |
| `transcript-commit` | L0 → L1 | Stable buffer commits | L1 commits speculation or restarts |
| `transcript-cancel` | L0 → L1 | TurnResumed signal | L1 cancels speculation; new commit pending |
| `reasoning-partial` | L1 → L0 | First N tokens of L1 response | L0 begins TTS streaming if confident |
| `reasoning-commit` | L1 → L0 | Full response ready | L0 commits TTS playback |
| `bargein-cancel` | L0 → L1 | Operator interrupts during SPEAKING | L1 abort signal; conversation context rolls back to pre-interruption state |
| `backchannel-emit` | L1 → L0 | Operator is mid-long-turn; L1 wants Sakura to acknowledge without taking floor | L0 emits brief "mm" / "right" / "yeah" via TTS, no interrupt |
| `slow-update-deferred` | substrate → L0 | Background cart completes during operator speech | L0 holds for next natural pause per voice-integration §4 |
| `tts-streaming-frame` | L1 TTS → L0 → audio out | Per TTS chunk | L0 maintains crossfade buffer |
| `l2-escalate` | L1 → L2 | Reasoning depth exceeds L1 | Operator hears "going to the deep thinker" filler per §23.4 vocabulary |

The lateral work-stealing pattern from §23.2 makes the speculative
streaming protocol natural: L0 streams partial transcripts to L1's
queue; L1 streams partial response chunks back; either side can
preempt by writing a `cancel` task.

### §8.4 Per-operator voice persona cache in Engram

The cold-storage operator-folder data per training manual §23.1:

```
operator-folder/voice/
  persona/
    register-floor.json       # V default · A allowed · etc per personality-discipline
    bridge-phrases.json       # operator's tested bridges that landed well
    backchannel-rate.json     # how often this operator wants Sakura to mm-hmm
    interrupt-tolerance.json  # how forgiving they are of false-cutoffs
    voice-pick-prefs.json     # V/A bias inferred from feedback
  history/
    last-N-turns.jsonl        # rolling transcript with timing metadata
    recent-bargein-causes.jsonl  # why they interrupted recently
    speculative-hit-rate.json # eager-gen calibration per this operator
  drift/
    vocabulary.json           # vocabulary-drift state (voice-integration §5)
```

Sticky routing keeps the operator's L1 worker warm with this folder
mounted; turns 2-N pay no mount cost. The eager-generation
prefix-cache discipline (§4.3) makes warm-prefix hits ≥ 80% for stable
operators.

### §8.5 Speculative streaming with hypothesis-confidence-scored transcripts

The exact wire shape (training manual §23.2 extended):

```
L0 emits per-100ms tick:
{
  type: 'partial-transcript',
  text: "I want to list the chunky",
  per_word_confidence: [0.95, 0.92, 0.88, 0.97, 0.93, 0.71, 0.60],
  stable_prefix_n: 5,              // first 5 words committed
  volatile_suffix_n: 2,            // last 2 words still active
  endpoint_signal: 'eager',        // smart-turn-v3 output
  endpoint_confidence: 0.45,       // medium → eager-gen triggers
  backchannel_signal: 'pause-or-think',
  operator_state: 'speaking',
  vad_energy_dbfs: -18,
  timestamp_ms: 1234567890
}
```

L1 reacts:

```
if endpoint_signal == 'eager' && endpoint_confidence >= eager_threshold:
  if no speculative call in flight: spawn speculative L1 call on stable_prefix
  if speculative call in flight: check delta — significant change → cancel + respawn

if endpoint_signal == 'commit' && commit_confidence >= commit_threshold:
  if speculation matches → play buffered TTS (zero added latency)
  else → cancel speculation, do fresh L1 call, mark eager_threshold up for this operator (calibration)

if operator_state == 'speaking' && time-since-last-backchannel > N:
  emit backchannel-emit task → L0 plays brief acknowledgment
```

### §8.6 Backchannel from L1 to operator (the missing UX piece)

Building on §5: Sakura emits her *own* backchannels during operator's
long turns so operator KNOWS they're being heard. This is the symmetric
half of backchannel detection.

Implementation:
- L1 watches operator turn duration via task-queue events
- Every N seconds (calibrated per operator's backchannel-rate
  preference from §8.4), L1 emits a backchannel-emit task
- L0 plays a brief TTS token ("mm" / "right" / "yeah") via voice-pick
  runtime (V always — backchannels are never A per personality
  discipline §6.4)
- Audio is mixed into the operator's stream at low volume, NOT through
  the main speaker channel (so it doesn't compete with the operator's
  own monitoring)

This is the conversational equivalent of the "Sakura is thinking"
visible-labor pattern in HelloSurface §47c (pensive mode) — voice-mode
visible labor.

---

## §9 — Latency budget breakdown (the user-felt experience)

The thresholds engineers must hit. Compiled from the literature (LiveKit
production targets; Pipecat Smart Turn benchmarks; OpenAI Realtime
published SLOs):

### §9.1 Perceptual thresholds

| Total round-trip | Feels |
|---|---|
| < 200ms | Live (indistinguishable from human) |
| 200-600ms | Conversational |
| 600-1500ms | Slow but acceptable |
| > 1500ms | Broken (operator starts repeating themselves) |

### §9.2 Per-tier realistic targets

| Tier | Routing | Expected | Worst case | Filler? |
|---|---|---|---|---|
| Free | L0-only · best path | 400-700ms | 1200ms | rare |
| Imagine $9.99 | L0+L1 | 600-1100ms | 1800ms | sometimes |
| Dream $39.99 | L0+L1+L2 (L2 occasional) | 800-1400ms | 2500ms | yes, on L2 escalate |
| Magic $99.99 | L0+L1+L2 (L2 frequent · Loam paths) | 800-1400ms standard · 3-5s deep | 8s deep-magic | yes, with "going to the deep thinker" per §23.4 |

The architect's "tier ≠ feature-gate, tier = pricing differential"
(MEMORY 2026-06-29) interacts here: every operator on every tier gets
the *capability* to hit the same latency, but pays differently for the
deeper routes. *(Per the 2026-06-23 magic-default override, every
account currently routes as Magic — see CLAUDE.md.)*

### §9.3 Where the time goes (typical L0+L1 turn)

```
operator finishes speaking
       │  endpoint detection             ~80ms (smart turn v3 + VAD ensemble)
       │  partial transcript final       ~100ms (already happened during speech)
       │  L1 reasoning TTFT (warm)       ~300ms (prefix-cache hit)
       │  TTS friend TTFA                ~150ms
       │  WebRTC out                     ~50ms
       └─→ operator hears first audio    ~680ms
```

With speculative generation (§4): the L1 TTFT is OVERLAPPED with the
end of operator's speech; the visible latency drops to ~300ms total.

### §9.4 Curator recommendation

- **Hit 600-1100ms target on L0+L1**, with speculative generation
  bringing perceived latency to ~300ms on speculation-hit turns
- **Filler-on-escalate (voice-integration §7)** mandatory whenever
  routing crosses 1000ms expected — Sakura's infra-aware vocabulary
  per §23.4 makes the wait honest, not awkward
- **L0-only path is the gold standard** — the 80% economic lever from
  §23.5 is also the latency lever; what we save in cost we save in
  user-felt time

---

## §10 — Conversational repair vocabulary (corpus design shape)

The architect named this: a 200-300 pair conversational repair corpus.
This section specifies the *shape* of the corpus; authoring is a
separate dispatch.

### §10.1 The vocabulary categories

Drawing on conversation-analysis foundations (Jefferson's overlap
taxonomy: transitional / recognitional / progressional; Sacks-Schegloff
TRP framework; [interactive repair as language foundation](https://www.sciencedirect.com/science/article/abs/pii/S1364661323002504)).

| Category | Example phrases | When |
|---|---|---|
| **Resume bridge** (post-interrupt continuation) | "yeah, like I was saying" · "right, so" · "the thing I was going to add" | After Sakura yields to operator, then operator yields back |
| **Quick acknowledgment + continue** | "right —" · "yeah —" · "got it, and" | Mid-thought acknowledgment without yielding floor |
| **Yield on detected interrupt** | "oh, sorry, go on" · "no no, you" · "go ahead" | Sakura detects operator wants the floor |
| **Mutual apology overlap** | "sorry sorry —" · "no no, you" · "go go" | Both apologize simultaneously; the architect-named double-sorry case |
| **Soft request to pause** | "wait —" · "hold on a sec" · "let me get this down" | Sakura needs operator to hold |
| **Backchannel (Sakura emits)** | "mm" · "right" · "yeah" · "mm-hmm" · "oh" | During operator's long turn |
| **Topic-shift signal** | "actually" · "oh — one more thing" · "so —" | Sakura indicating change of direction |
| **Acknowledge + bridge** | "hmm, that's a good point" · "right, and that connects to" | Backchannel + setup for own response |
| **Filler-on-escalate** (voice-integration §7) | "hmm, let me think about Pearl…" · "give me a second on that" · "let me check" | While L1 / L2 is reasoning |
| **Honest-null** (architect lock) | "I can't reach the bigger me right now" · "your phone's running warm" · §23.4 vocabulary | Degradation states |

### §10.2 Pair shape

Each corpus pair is `(situation, response)` where situation encodes:
- Operator's just-finished utterance (text + endpoint signal + backchannel
  signal)
- Sakura's prior turn (if any)
- Conversation history (last N turns)
- Operator's persona register (V/A floor)
- Tier / engagement-calibration level

And response is the EXACT bridge phrase Sakura should emit.

### §10.3 Scale

200-300 pairs covers the bridges; another 100-200 pairs covers the
backchannel timing (when to emit "mm" vs stay silent). Total
conversational repair corpus: **400-500 pairs**.

This goes into the training manual §4 corpus slices as a new slice:
`conversational-repair-corpus`. Training-time placement: same lane as
`samantha-depth-mirror-corpus` (~300 pairs) and `daria-register-corpus`
(~200 pairs) per training plan §6.

### §10.4 Sakura emits her own backchannels (paired w/ §5 + §8.6)

Backchannel-emit pairs are a sub-corpus (~100 pairs) where the input is
*operator-still-speaking* state and the output is the brief
acknowledgment Sakura emits without interrupting. This is the most
delicate sub-corpus — wrong placement reads as interruption, no placement
reads as not-listening.

### §10.5 What NOT to include (per personality discipline §6 banned list)

- "Great question" / "What a great question" (sycophant openers)
- "Let me think about that for you" (recap-as-stall)
- "Sorry for the delay" (apologetic corporate)
- "Please wait" / "One moment please" (formal corporate)
- "Hmm, interesting" with rising performative intonation (performed
  attention)
- Any A-register backchannel ("yay!" / "ooh!") — backchannels are V

---

## §11 — What we'd need to build (engineering map)

Seven components. Three are model artifacts; four are coordination
infrastructure. None require new platforms.

### §11.1 Turn-taking controller

A new module: `curator-web/src/voice/turnTakingController.js` (planned).
Sits between voice/transcribe and voice/synthesize. Consumes:
- VAD frame stream
- Smart Turn v3 endpoint signals
- Backchannel-detector output
- L0/L1 reasoning state via Engram task queue

Emits:
- BARGE-IN → cancel cascade (voice-integration §3.2)
- TAKE-FLOOR-SAKURA → begin TTS playback
- WAIT → continue listening, suppress L1 commit
- BACKCHANNEL-NOW → L0 emits brief acknowledgment

Owned by L0; reports state to L1 via Engram task queue.

### §11.2 Backchannel detector

Small classifier (~200-500K params) bundled into L0 alongside Smart Turn
v3. Specifications per §5.4. Training corpus: bootstrap on Switchboard
backchannel-annotated subset; fine-tune on operator-folder feedback
loop (operators who interrupt frequently shift the threshold per their
preferences).

Latency budget: 30-50ms on CPU. *[Built fresh; no existing component.]*

### §11.3 Semantic endpoint detector

Smart Turn v3 (8M params, int8, 12ms CPU) on L0. Off-the-shelf;
license-compatible. *[New dependency; not yet wired.]*

### §11.4 Resume-decision arbiter

A L1 capability, not a separate model. Implemented as a structured
prompt addition to L1's reasoning call, fired only when endpoint
signal is medium-confidence (eagerness band). Reads:
- Last 3 turns of conversation
- Operator's persona register
- Current speculative-call state
- Operator's interrupt-tolerance + recent-bargein-causes from Engram

Emits one of: `commit-speculation` / `restart-fresh` / `wait-more`.
Implementation: ~30-line prompt template in
`curator-api/curator_api/voice/resume_arbiter.py` (planned). *[New
module.]*

### §11.5 Streaming TTS with fade support

Existing `voice/synthesize` capability extended with crossfade-out
buffer. When cancel cascade fires, currently-playing audio fades over
~30ms rather than hard-stopping. Eliminates the "Sakura dropped silent
immediately" complaint (architect 2026-06-22 verbatim:
[MEMORY entry on "I like that you can interrupt them. I don't like
that they drop silent immediately"]).

Implementation: 30ms exponential-decay envelope applied to the audio
output ring buffer on cancel-event receipt. ~50 lines of JS in the
existing audio gateway.

### §11.6 L0↔L1 audio coordination protocol

**Reuse Engram's existing channel.** No new WebSocket. The
voice-specific task types in §8.3 ride the same CRDT substrate as cart
tasks. Vector clocks order partial-transcript / reasoning-partial /
cancel / commit events without conflict.

Schema additions to Engram: ~10 new task types (§8.3 table).
Implementation: schema-only change — no new infra.

### §11.7 Per-operator voice persona cache

Schema per §8.4. Lives in operator's Engram folder under `voice/`.
Sticky-routing-by-operator_id already mounts this for L1 reasoning;
the addition is the per-folder schema + the calibration loop (recent
bargein-causes → adjust eager_threshold + backchannel-rate).

Implementation: ~200 lines across `engram_client` extensions in
curator-web and curator-api.

### §11.8 Total build size estimate

| Component | New code (LOC est) | New model artifact |
|---|---|---|
| Turn-taking controller | ~400 JS | no |
| Backchannel detector | ~150 JS + ~500K-param model | YES — fresh train |
| Semantic endpoint (Smart Turn v3) | ~50 JS integration | off-the-shelf |
| Resume-decision arbiter | ~100 Python | no (prompt-only L1 capability) |
| Streaming TTS with fade | ~50 JS | no (extends existing) |
| L0↔L1 coordination | schema only | no (Engram extension) |
| Per-operator persona cache | ~200 LOC | no |

Plus 400-500 pair conversational-repair corpus (§10) for training.

Total: roughly 950 LOC + 1 small classifier + 1 corpus slice. Ship
window: 2-3 weeks at single-engineer pace, faster with corpus authoring
parallelized.

---

## §12 — Honest assessment: pipeline vs full-duplex

The architect's final question. Should we abandon our pipeline?

### §12.1 The tradeoff matrix

| Dimension | Cascaded pipeline (ours) | Full-duplex S2S (Moshi / GPT Realtime / Gemini Live) |
|---|---|---|
| **Latency floor** | 400-700ms best (L0-only) | 200-300ms best |
| **Latency with reasoning** | 600-1400ms (L0+L1) | 500-1000ms (single model) |
| **Cost per minute** | ~$0.005-0.02 (our infra + per-tier) | ~$0.04-0.08 (OpenAI) / ~$0.04 (Gemini Live) |
| **Per-operator prefix cache** | Native (Engram sticky routing) | Limited; audio context isn't a stable prefix |
| **Vendor lock** | Per-friend swap = one wire-call module | Full hot-path locked to vendor |
| **Debuggability** | Text transcripts + per-stage logs | Audio-in/audio-out black box |
| **Tool calling** | Mature (text-grounded LLM tools) | Improving but immature ([Full-Duplex-Bench-v3](https://arxiv.org/pdf/2604.04847)) |
| **Compliance audit** | Text trail at every stage | Audio + supplementary tooling needed |
| **Prosody preservation** | Lost in STT step | Native |
| **Emotion-context** | Lost in STT step | Native |
| **Overlap handling** | Cancel cascade required (~100ms) | Native parallel streams |
| **Honest-null degradation** | Uniform across L0/L1/L2 | Single failure mode |
| **Magic-tier deep reasoning** | L1+L2 cascade works | Need separate non-S2S model for L2 anyway |
| **Per-operator persona discipline** | Engram folder isolates cleanly | Vendor session state opaque |
| **Voice character control** | Voice friend swap | Vendor voice list only |

### §12.2 Where we lose to full-duplex (be honest)

- Prosody. We lose emotion in the STT bottleneck. Mitigation: V/A
  voice-pick runtime (voice-integration §6) reads back some emotion via
  TTS register choice, but it's reactive not preservative.
- Latency floor. Best-case full-duplex is 200ms; best-case us is 400ms.
  Mitigation: speculative generation (§4) brings perceived latency to
  ~300ms on speculation-hit turns.
- Overlap handling. Our cancel cascade is 100ms; full-duplex models
  handle overlap natively. Mitigation: cancel cascade is well-tested in
  voice-integration §3.2 and operates within barge-in budget.

### §12.3 Where we win (also be honest)

- Per-operator persona caching → cost economics at scale (training
  manual §23.5 ladder)
- Vendor flexibility — we already round-robin across approved L1
  upstreams; voice friend follows the same pattern
- Compliance — text transcripts + per-stage logs make audit trivial;
  Magic-tier operators run regulated businesses sometimes
- Tool calling — Sakura's whole product is tool-using carts; our
  cart-call reliability beats current S2S tool reliability
- Honest-null discipline — `escalate 'service-not-yet-wired` works
  uniformly; a single black-box S2S model can't degrade partially
- Vendor swap — voice/synthesize is one wire-call away from any TTS
  provider; voice/transcribe likewise

### §12.4 The hybrid future (where this goes)

The literature consensus 2026 ([Pipeline vs. Realtime](https://rtcleague.com/blogs/pipeline-vs-realtime-voice-agent-architecture);
[Hamming](https://hamming.ai/blog/are-speech-to-speech-models-ready-to-replace-cascade-models)):
**hybrid is the production end-state**. Use S2S for simple fast
exchanges where latency is most felt; cascade for complex reasoning +
tool calls + compliance-required paths.

This maps to our tiering:
- L0 (Free): cascade (we own the device; latency floor is acceptable)
- L1 (Imagine $9.99): cascade with speculative-gen optimization
- L2 voice path on Magic tier: **CANDIDATE for hybrid — S2S for the
  conversational turns, cascade for the cart-tool turns**, routed per
  turn classification

The router decision happens at L1: classify the inbound transcript;
route conversational turns to a future voice/duplex friend (Gemini
Live or Moshi self-hosted); route cart-call turns to existing cascade.

### §12.5 Curator recommendation (the bottom line)

**Keep the cascade as canonical for B4 (now) and B5 (next cycle).**
The lateral L0↔L1↔Engram pattern from training manual §23 is exactly
the substrate this requires, and the build map (§11) is finite.

**Defer the hybrid until Magic-tier voice volume justifies vendor-lock
on the conversational hot path.** That probably maps to the 1k → 10k
operator inflection point per §23.5 of the training manual. Until
then, the speculative-generation + prefix-cache discipline gives us
within-100ms of full-duplex latency at half the per-minute cost.

**Self-host Moshi as a research target** for the eventual L0
voice-mode replacement. Moshi runs on MLX on Apple Silicon today;
operator devices that can run it locally would get full-duplex without
sending audio off-device — that's the eventual upgrade path that
honors both the privacy story AND the latency goal. *[See §14.Q1.]*

---

## §13 LIVING markers (incomplete research / next-cycle expand)

<!-- LIVING:RESEARCH(2026-06-30): Backchannel-detector training data — Switchboard backchannel subset license vs alternative open corpora (Fisher? CallHome?). Confirm before any training kickoff. -->
<!-- LIVING:RESEARCH(2026-06-30): Smart Turn v3 license confirmation — HF model card lists BSD-3 per `pipecat-ai/smart-turn-v3` but verify before bundling into L0 distribution. -->
<!-- LIVING:RESEARCH(2026-06-30): Gemini Live per-operator session model — does Vertex AI session keep a stable prefix that we can attribute to an operator across turns, or is it stateless audio-in/audio-out? Implications for §7.3 vendor-lock evaluation. -->
<!-- LIVING:RESEARCH(2026-06-30): Moshi MLX latency on M-series Macs — published 200ms is L4 GPU; need M1/M2/M3 measurements. iPhone capable? -->
<!-- LIVING:TODO(2026-06-30): Eager_threshold + commit_threshold default values per operator tier — Deepgram Flux defaults (0.4 / 0.7) may need recalibration for our 8B reasoner vs their assumed model. -->
<!-- LIVING:TODO(2026-06-30): Conversational-repair corpus authoring — 400-500 pairs per §10. Separate dispatch; voice-routing doc names the shape, not the content. -->
<!-- LIVING:TODO(2026-06-30): Hybrid-route classifier prompt — for the eventual L2 voice path on Magic tier, the turn-classifier that decides conversational vs cart-tool routing. -->
<!-- LIVING:EXPAND(2026-06-30): §6.5 latency budgets — need real measurements from prod once L1 8B round-robin pool is at scale (currently extrapolated from LiveKit + Pipecat published medians). -->
<!-- LIVING:EXPAND(2026-06-30): §10.4 Sakura-emits-backchannels sub-corpus — interaction with V/A voice pick is subtle; need a few hundred pairs of explicit (V backchannel + A context) and (V backchannel + V context) to verify register-floor isn't breached. -->
<!-- LIVING:EXPAND(2026-06-30): §8.4 per-operator voice persona cache schema — needs an authoritative spec doc once schema stabilizes; current is sketch-level. -->
<!-- LIVING:USE-CHECK(2026-09-30): If hybrid S2S/cascade evaluation hasn't happened by Q4, kill or schedule. Architect call Q1 below should be revisited quarterly. -->

Visible inline gaps:
- *[needs: Switchboard backchannel-subset license confirmation before authoring training data]*
- *[needs: M-series Mac Moshi latency benchmarks]*
- *[expand: per-tier eager_threshold tuning curve once production voice traffic is measurable]*
- *[needs: real-prod latency p50/p90/p99 measurements per §9.3 (currently extrapolated)]*

---

## §14 Open architect calls (decisions only the architect can make)

These are the questions where engineering can lay out tradeoffs but the
call belongs to the architect.

### §14.Q1 — Hybrid S2S/cascade adoption for Magic tier voice

Do we adopt a hybrid approach for Magic-tier voice operators — using
Gemini Live or self-hosted Moshi for conversational turns, keeping
cascade for cart-tool turns — at the 1k operator inflection point
(§23.5)? Or do we ride the cascade as canonical for all tiers
indefinitely?

Trade summary:
- ADOPT: native overlap + prosody + 200-300ms latency on conv turns;
  vendor-lock on the voice hot path; cost ~$0.04/min vs ~$0.01/min
  cascade
- HOLD: cascade-only forever; speculative gen + prefix cache + L0 own
  most turns gets us within 100ms of full-duplex; vendor flexibility
  preserved; ~$0.01/min cost scales

### §14.Q2 — Moshi self-host as the L0 voice replacement for Apple Silicon operators

If we ran Moshi via MLX on operator's M-series Mac directly, on-device
full-duplex with audio never leaving the device, no vendor cost, full
privacy story — is that the right L0 voice path for Apple Silicon
operators, even at the cost of a 5GB model download?

Sub-questions:
- Does operator's first-launch experience accept a 5GB voice model
  download alongside the existing 1.7B model download?
- Is the existential carve-out still honored if Sakura's voice runs
  through a different model than her text reasoning?
- Battery cost on M-series — Moshi continuous full-duplex on
  battery-powered MacBook?

### §14.Q3 — Backchannel-emit policy default

Should Sakura emit her own backchannels by default ("mm" / "right"
during operator's long turns), or should it be opt-in per operator? The
literature says it's natural and expected human behavior, but it's a
*new sound* operators will hear. Risk: some operators find it
distracting; others find its absence cold.

Recommendation if defaults are required: ON for tier ≥ Imagine; OFF
for Free + first 5 sessions of any tier (calibration period); per-operator
toggle in voice settings; rate calibrated from operator's own backchannel
behavior (more they backchannel, more Sakura backchannels).

### §14.Q4 — Conversational-repair corpus authoring lane

The 400-500 pair corpus per §10 — does Lacuna Engineering author it in
the upcoming corpus expansion, or do we dispatch to outside voice-actor
review (Daria reference per personality discipline)? Trade: in-house
matches existing corpus discipline; outside review catches naturalness
issues an LLM-author can't.

### §14.Q5 — Voice-friend default vendor for non-Apple-Silicon operators

Today: backend voice/transcribe routes to one of (Chirp 3 · faster-whisper
self-hosted · Whisper API). The L1 round-robin includes all three for
load-balance. Should that stay round-robin, or pin to one for latency
consistency? Pin choice depends on geographic operator distribution.

### §14.Q6 — Eager-generation policy on cost-capped operators

Per §4.2 cost math, eager-generation costs 50-70% more LLM calls. For
an operator who's hit their W7B daily token cap, do we silently disable
eager-gen (slower responses, no surprise overage) or keep it on and
let them hit the cap faster (faster responses, earlier degraded
service)? Falls under the "honest with operator about their state"
discipline.

---

## §15 References

### §15.1 Foundational papers

1. **Moshi: a speech-text foundation model for real-time dialogue** —
   Défossez et al., Kyutai 2024. [arXiv:2410.00037](https://arxiv.org/abs/2410.00037).
   The full-duplex S2S reference; Mimi codec; inner monologue. License
   MIT/Apache 2.0; weights CC-BY 4.0. Source repo: [kyutai-labs/moshi](https://github.com/kyutai-labs/moshi).
2. **Large Language Models Know What To Say But Not When To Speak** —
   Umair, Sarathy, de Ruiter. EMNLP Findings 2024.
   [arXiv:2410.16044](https://arxiv.org/abs/2410.16044). The
   within-turn TRP problem; why current LLMs are bad at turn-taking
   timing.
3. **Speculative End-Turn Detector for Efficient Speech Chatbot
   Assistant** — March 2025. [arXiv:2503.23439](https://arxiv.org/abs/2503.23439).
   GRU on-device + Wav2vec server-side dual-stage; the pattern that
   inspires §3.5 + §8.
4. **Yeah, Un, Oh: Continuous and Real-time Backchannel Prediction with
   Fine-tuning of Voice Activity Projection** — October 2024.
   [arXiv:2410.15929](https://arxiv.org/pdf/2410.15929). VAP-based
   backchannel prediction.
5. **Phoenix-VAD: Streaming Semantic Endpoint Detection for Full-Duplex
   Speech Interaction** — September 2025. [arXiv:2509.20410](https://arxiv.org/abs/2509.20410).
   LLM-based semantic VAD with sliding window training.
6. **Real-time and Continuous Turn-taking Prediction Using Voice
   Activity Projection** — January 2024. [arXiv:2401.04868](https://arxiv.org/abs/2401.04868).
   VAP fundamentals.
7. **Multilingual Turn-taking Prediction Using Voice Activity
   Projection** — March 2024. [arXiv:2403.06487](https://arxiv.org/abs/2403.06487).
   LREC-COLING 2024.
8. **How Much Does Prosody Help Turn-taking? Investigations using Voice
   Activity Projection Models** — [arXiv:2209.05161](https://arxiv.org/pdf/2209.05161).
   Quantifies prosody contribution.
9. **Visual Cues Enhance Predictive Turn-Taking for Two-Party Human
   Interaction** — May 2025. [arXiv:2505.21043](https://arxiv.org/pdf/2505.21043).
   Multimodal VAP with gaze/head/gesture.
10. **WhisperPipe: A Resource Efficient Streaming Architecture** —
    [arXiv:2604.25611](https://arxiv.org/pdf/2604.25611). Two-tier
    commit policy + Levenshtein stability.
11. **Adapting Whisper for Streaming Speech Recognition via Two-Pass
    Decoding** — June 2025. [arXiv:2506.12154](https://arxiv.org/html/2506.12154v1).
12. **CarelessWhisper: Turning Whisper into a Causal Streaming Model** —
    August 2025. [arXiv:2508.12301](https://arxiv.org/html/2508.12301v1).
13. **WhisperKit: On-device Real-time ASR with Billion-Scale
    Transformers** — July 2025. [arXiv:2507.10860](https://arxiv.org/pdf/2507.10860).
14. **Voxtral** — Mistral AI, July 2025. [arXiv:2507.13264](https://arxiv.org/html/2507.13264v1).
15. **Thai Semantic End-of-Turn Detection for Real-Time Voice Agents** —
    [arXiv:2510.04016](https://arxiv.org/pdf/2510.04016). Cross-language
    semantic endpoint pattern.
16. **LTS-VoiceAgent: A Listen-Think-Speak Framework** —
    [arXiv:2601.19952](https://arxiv.org/pdf/2601.19952). 2026 framework
    for incremental reasoning + semantic triggering.
17. **Full-Duplex-Bench-v3: Benchmarking Tool Use for Full-Duplex Voice
    Agents Under Real-World Disfluency** — [arXiv:2604.04847](https://arxiv.org/pdf/2604.04847).
    Tool-use reliability gap S2S vs cascade.
18. **RESPOND: Responsive Engagement Strategy for Predictive
    Orchestration and Dialogue** — [arXiv:2603.21682](https://arxiv.org/pdf/2603.21682).
    2026 backchannel-aware orchestration.
19. **Probing Low Frame Rate Degradation in Neural Audio Codecs** —
    [arXiv:2606.16969](https://arxiv.org/html/2606.16969). Mimi
    codec frame-rate research.
20. **Streaming Endpointer for Spoken Dialogue using Neural Audio Codecs
    and Label-Delayed Training** — [arXiv:2506.07081](https://arxiv.org/pdf/2506.07081).
21. **Moonshine v2: Ergodic Streaming Encoder ASR for Latency-Critical
    Speech Applications** — [arXiv:2602.12241](https://arxiv.org/pdf/2602.12241).
22. **The intersection of turn-taking and repair** — Kendrick. Frontiers
    Psychology 2015. [link](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00250/full).
    Foundational conversation analysis.
23. **Interactive repair and the foundations of language** — Dingemanse
    2018. [link](https://www.sciencedirect.com/science/article/abs/pii/S1364661323002504).
24. **Timing in turn-taking and its implications for processing models
    of language** — Frontiers 2015. [link](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00731/full).
    TRP + backchannel + Yngve/Schegloff foundations.

### §15.2 Open-source repos

- [kyutai-labs/moshi](https://github.com/kyutai-labs/moshi) — Moshi
  (MIT/Apache 2.0 code; CC-BY 4.0 weights); MLX + PyTorch + Rust
- [pipecat-ai/smart-turn](https://github.com/pipecat-ai/smart-turn) —
  Smart Turn v3 (HF: `pipecat-ai/smart-turn-v3`); semantic VAD; ~8M
  params; 12ms CPU
- [ufal/whisper_streaming](https://github.com/ufal/whisper_streaming) —
  Reference streaming Whisper with LocalAgreement policy
- [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat) — Voice
  agent framework

### §15.3 Production-grade reference docs

- [OpenAI Realtime API Missing Manual (Latent Space)](https://www.latent.space/p/realtime-api)
- [LiveKit Voice Agent Architecture](https://livekit.com/blog/voice-agent-architecture-stt-llm-tts-pipelines-explained)
- [LiveKit Sequential Pipeline Architecture](https://livekit.com/blog/sequential-pipeline-architecture-voice-agents)
- [LiveKit Turn Detection](https://livekit.com/blog/turn-detection-voice-agents-vad-endpointing-model-based-detection)
- [Daily.co Smart Turn v3 announcement](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/)
- [Daily.co STT benchmarks](https://www.daily.co/blog/benchmarking-stt-for-voice-agents/)
- [Deepgram Flux launch](https://deepgram.com/learn/introducing-flux-conversational-speech-recognition)
- [Google Vertex Gemini Live](https://cloud.google.com/blog/products/ai-machine-learning/gemini-live-api-available-on-vertex-ai)
- [Pipecat Speech Input & Turn Detection](https://docs.pipecat.ai/pipecat/learn/speech-input)
- [Pipecat Smart Turn guide](https://docs.pipecat.ai/pipecat-cloud/guides/smart-turn)
- [Future AGI voice latency optimization](https://futureagi.com/blog/how-to-optimize-voice-agent-latency-2026/)
- [Voice AI infrastructure guide (Introl)](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025)

### §15.4 Internal cross-references

- `SAKURA-VOICE-INTEGRATION-2026-06-27.md` — byte-level chain;
  barge-in state machine; V/A voice pick runtime; privacy + cap-tokens
- `SAKURA-TRAINING-MANUAL-1.0-ENGINEERING.md` §13 (L0 manifest), §14
  (L1 manifest), §15 (L0↔L1 routing arbiter), §17 (encapsulation), §20
  (Sakura's infra-aware voice), §23 (lateral handoff + Engram-as-task-queue)
- `SAKURA-PERSONALITY-DISCIPLINE-2026-06-27.md` §4 (V vs A discipline),
  §6 (banned-pattern list), Engagement Calibration
- `HELLO-SURFACE-1.0-ENGINEERING.md` §47b (voice register floor), §47c
  (pensive mode = visible labor), §47d (existential carve-out)
- `LOAM-1.0-ENGINEERING.md` §17 (substrate refuses English)
- `SAKURA-TRAINING-PLAN-2026-06-27.md` §1.3 (Moshi pattern), §1.4
  (Self-REF), §6 (concert-handoff-corpus + voice-pick-runtime-corpus +
  samantha-depth-mirror-corpus + daria-register-corpus)
- `CLAUDE.md` — vendor naming lock; L0/L1/L2 capability terminology;
  tier override 2026-06-23

### §15.5 Code references (existing + planned)

- `curator-api/curator_api/voice/gateway.py` (existing — audio gateway)
- `curator-web/src/voice/bargeInStateMachine.js` (existing — barge-in
  state machine per voice-integration §3.2)
- `curator-web/src/voice/voicePickClassifier.js` (existing — V/A
  classifier per voice-integration §6)
- `curator-web/src/cortex/vocabularyDrift.js` (planned — vocabulary
  drift state per voice-integration §5.2)
- `curator-web/src/voice/turnTakingController.js` (planned — §11.1)
- `curator-web/src/voice/backchannelDetector.js` (planned — §11.2)
- `curator-web/src/voice/smartTurnIntegration.js` (planned — §11.3
  Smart Turn v3 integration)
- `curator-api/curator_api/voice/resume_arbiter.py` (planned — §11.4)
- `curator-api/curator_api/voice/transcribe_client.py` (existing —
  wire-call boundary; vendor name lives here only)
- `curator-api/curator_api/voice/synthesize_client.py` (existing —
  wire-call boundary; vendor name lives here only)

---

---

## §16 Code↔doc parity (E3 lane, 2026-07-15)

> `:status "needs-alfred-review"` on the several files below marked as
> "existing" in §15.5 which do NOT appear as source in the working tree
> today. This section names what is real vs. what §15.5 claims. No
> fabrication; if the file isn't in the working tree it's called out.

- **`curator-web/src/voice/`** — the directory does not exist in the current working tree. §15.5 lists `bargeInStateMachine.js`, `voicePickClassifier.js`, and several planned modules under this path. `:status "unbuilt"` for the directory as a whole. The barge-in state machine is described in `SAKURA-VOICE-INTEGRATION-2026-06-27.md` §3.2 (per the cross-ref); the JS side has not yet materialized here.
- **`curator-api/curator_api/voice/`** — only `__pycache__/` is present; source `.py` files not in the working tree. `gateway.py`, `transcribe_client.py`, `synthesize_client.py` referenced by §15.5 as "existing" are not visible as source. Bytecode-only in `synth.cpython-312.pyc` + `transcribe.cpython-312.pyc`. `:status "needs-alfred-review"` — either sources were relocated, staged in a branch, or purged; not fabricating what they contained.
- **`curator-web/src/lib/voice-stt-stats.js`** (real) — carries the STT state machine + rolling-hour cloud quota. Not named in §15.5. Belongs in the "existing" list once §15.5 is refreshed.
- **`curator-web/src/lib/voice-timing.js`** (real) — the conversational timing constants (endOfTurnSilenceMs 700, replyLatencyMs 200-500, thinkingFillMs, reGreetingSuppressionMs). Backs the §9 latency budget on the JS side. Not named in §15.5.
- **`curator-api/curator_api/sakura_voice.py`** (real, 153 lines) — the L0 voice-wrapping layer (§8's persona-continuity intent, implemented as backend-response paraphrasing). Not named in §15.5; add on next §15.5 refresh.
- **`curator-api/curator_api/chat_router.py`** (real, 431 lines) — the chat routing surface adjacent to voice routing. Named here so an implementer building §11's turn-taking controller knows the chat-side entry point.

## §17 Code↔doc gaps (real behavior not yet documented)

> `:status "needs-alfred-review"`. Notes for the routing doc to fold on
> its next review pass.

- **Garbled-repeat-ask** (from `voice-stt-stats.js`) is a routing decision the router owns but §3–§5 does not name. When STT confidence < 0.7 or transcript is `[?]` / `<unk>` / repeated `???`, the router should re-solicit rather than escalate. Fold into §3 (endpoint detection beyond simple VAD) or a new §3.6.
- **Quota-aware routing** — the 6 min/hour cloud-STT ceiling is a routing constraint. §14.Q6's "eager-generation on cost-capped operators" nearly touches this but frames it as a token-cap question. The STT-minute cap deserves its own §14.Q7 or a §11.6 knob on the turn-taking controller.
- **`voice-timing.js` reGreetingSuppressionMs** — the "don't greet twice" behavior is not surfaced in §9's latency budget. It's a routing decision (whether to emit a greeting), not just a latency knob.

---

<!-- end SAKURA-VOICE-ROUTING-1.0-ENGINEERING.md · sister doc to SAKURA-TRAINING-MANUAL-1.0-ENGINEERING.md + SAKURA-VOICE-INTEGRATION-2026-06-27.md -->
<!-- arch dispatch: 2026-06-30 (B4 voice-routing research thread; architect lock on conversational LLM routing depth) -->
<!-- next scheduled review: when conversational-repair corpus is authored (§10) OR when architect Q1 hybrid decision lands -->
