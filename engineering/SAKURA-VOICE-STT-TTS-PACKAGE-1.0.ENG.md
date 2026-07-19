# Sakura Voice — STT/TTS Package 1.0 (Engineering)

*The on-device speech-and-listening package for Sakura: five local tools, one
deterministic seam into Marionette, and a harness contract that lets an LLM sit
inside the runtime and speak, listen, cut off, and control the whole world.*

*Status: DESIGN + RESEARCH LOCKED. No model downloads, no deploy, no training.
Corpus is PREP ONLY. This document is the buildable spec + the honest gap list.*

---

## §0 — What this is, and why it's worth building well

Most on-device voice agents are a **pipeline**: mic → VAD → STT → LLM → TTS →
speaker. We are building that pipeline, but we are joining it to something none
of those projects have: a **deterministic, replayable animation/game runtime
(Marionette)** that an LLM drives by emitting a Scheme dialect. In our world:

- a **mood is a way of speaking**, not a label — `curious` *is* a rate + a
  contour, resolved adapter-side;
- **speech rides the same event tape as motion and sound** — a spoken line is a
  keyed completion that sequences against a sprite arriving or music ducking,
  deterministically;
- the **whole session replays** — positions, camera, audio, and (pending the
  #640 architect call) speech, re-rendered from the tape;
- an **LLM sits inside** and harnesses all of it through one small verb surface.

That combination is novel enough to be worth open-sourcing. Which is the bar:
**do not clutch this together.** Build two clean planes with a hard seam and build
the hot loop right the first time — Plane A in Rust from the start (§8), with the
one uncertain piece (the STT model) abstracted behind a trait so it can swap
without a rewrite. Build once, build the perfect version, don't churn the doc.

---

## §1 — The package: five tools (+ one you must port)

| Tool | Role | Where it runs | Verdict |
|---|---|---|---|
| **Parakeet TDT 0.6B v2** (`parakeet-mlx`) | STT — words | on-device, MLX | transcriber only; greedy decode; needs a front-end |
| **Silero VAD** (dual) | speech onset / barge-in trigger | on-device | the actual turn-taking sensor |
| **SmartTurn EOU** | end-of-utterance (semantic) | on-device | replaces the naive silence timer |
| **Kokoro-82M** (`mlx-audio`/`kokoro-mlx`) | live TTS — fast default voice | on-device, MLX | fast/clean/rate/pronunciation STRONG; emotion WEAK |
| **Parler-TTS Expresso** | expressive TTS — cached bridges + perform-this lines | offline render | expressiveness/mood STRONG; slow-on-MPS, voice-drift |
| **AEC** (acoustic echo cancellation) | stop her own voice self-triggering barge-in | on-device | **must port — #1 build risk if speakers, not headphones** |

The naming convention still holds everywhere it matters: **these six names never
enter training corpus or operator-facing copy.** They live in this doc and in the
adapter module only. Corpus carries capability (`voice/say`, tone words), never a
brand — same rule as `web/search`.

---

## §2 — The five capability axes (the requirements, honestly graded)

Everything the package must do reduces to five axes. Grade = what the *package*
delivers once assembled (not any single engine).

**1. SPEED — target: first-audio < ~150 ms, round-trip 400–700 ms L0-only.**
Kokoro-MLX first-chunk is tens-of-ms *if you split the first clause aggressively*
(feed a 5–12 word head, stream the rest). Parakeet at ~66× RT on M-series decodes
a 300–600 ms speech chunk in single-digit ms — latency is the **VAD/EOU cadence**,
not the model. Anticipatory generation on partial transcripts (routing §4) shaves
the rest.

**2. CUT-OFF (barge-in) — target: audio stops < 200 ms, no click.**
Kokoro yields chunks; abort the generator via `stop_event` / CancelScope, **drop
queued chunks, flush the ring buffer with a ~10–30 ms exponential fade-out**
(the architect wants a soft decay, not a hard silence — routing §11.5). The
*trigger* is a dual Silero VAD watching the mic while she talks — **not** Parakeet.

**3. EXPRESSIVENESS — say a line "a certain way".**
Kokoro cannot (auto-predicted prosody, no whisper/shout token). Parler Expresso
can: style words `whisper|emphasis|happy|sad|confused|laughing|default` + per-word
`*asterisk*` emphasis (which requires the literal word "emphasis" in the
description too). So expressive lines route to the **cached Parler path**; live
Kokoro lines degrade gracefully (whisper lost, not blocked).

**4. RATE (pace) — slow / fast on demand.**
Kokoro `speed` is a first-class multiplier that changes *duration inside the
model* — no chipmunk pitch shift. Clean band **0.7–1.3**. Per-segment rate is
trivial (slow the punchline, speed the aside). This is the one directly-dialable
live prosody knob.

**5. MOODS-AS-SPEECH — the load-bearing axis: a mood renders as a way of speaking.**
Tone set: **calm · curious · energetic · wry · warm · dry.** Two mappings already
exist in the docs and get unified here (§5). Live path: mood → (Kokoro voice/blend
+ speed). Expressive path: mood → (Parler description string). **Mood is
adapter-local** — corpus and UI carry only the tone word.

---

## §3 — Architecture: two planes, one hard seam

The whole design is two planes. The seam between them is the reason "prototype
now, Rust later" is not a rewrite.

```
┌──────────────────────────────────────────────────────────────────────┐
│  PLANE A — the Duplex Audio Engine  (the hard real-time part)          │
│  mic ─► [AEC] ─► [dual Silero VAD] ─► [SmartTurn EOU] ─► Parakeet STT  │
│                         │  onset = barge-in trigger                     │
│  speaker ◄── [ring buf + fade] ◄── Kokoro live  /  Parler cached clip  │
│                                                                        │
│  Owns: audio I/O, the 4-state turn machine, barge-in, streaming,       │
│        echo cancellation, the ~10-30ms cancel envelope, warmup.        │
│  Deterministic-ish, latency-critical, no LLM, no Scheme.               │
│  ►► THIS is the Rust candidate.                                        │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  THE SEAM: a tiny message contract
                                 │  up:   {final_text, ts, barge_in}
                                 │  down: {say(text,tone,pace,style,key,intr?),
                                 │         stop(), bridge(cat,tone)}
┌───────────────────────────────┴──────────────────────────────────────┐
│  PLANE B — the Persona / Marionette harness  (the smart part)         │
│  L0/L1/L2 brain ─► Scheme ─► marionetteVoice.js ─► voice/* verbs       │
│  rides the deterministic bus, the `voice` channel, the audio tap,      │
│  keyed 'speech-done' completions, the replay tape (#640).              │
│  Owns: WHAT to say, mood→tone, pronunciation, no-S-expr rule,          │
│        sequencing speech against sprites/music/scene.                  │
│  Deterministic, replayable, LLM-harnessable. Stays JS/Scheme.          │
└───────────────────────────────────────────────────────────────────────┘
```

The seam is a **message contract**, not a function call — two small structs, one
up (a committed turn + barge-in flag), one down (say / stop / bridge). That is
the whole coupling. Plane A can be a Python prototype today and a Rust binary
tomorrow behind the identical contract; Plane B never knows which.

---

## §4 — Plane A: the Duplex Audio Engine (barge-in recipe)

The reference implementation pattern (jarvis-v3, achetronic, HF speech-to-speech):

1. **AEC first.** Without echo cancellation, her own TTS hits the mic and
   self-triggers barge-in. Either require headphones (dev) or **port an AEC**
   (ship). This is the single biggest risk and the first Rust-worthy component.
2. **Dual VAD.** A generic Silero VAD ("someone spoke") + a speaker-verified VAD
   ("*the operator* spoke") so ambient noise and TTS bleed don't false-trigger.
3. **4-state turn machine** per frame: `QUIET → STARTING → SPEAKING → STOPPING`.
   `STARTING` needs N sustained frames (noise reject); `SPEAKING` stitches short
   `<300 ms` pauses; `STOPPING` uses the **SmartTurn EOU model**, not a fixed
   timer — this is what makes turn-ends feel human.
4. **STT is downstream of both.** Only feed Parakeet audio *between* VAD onset
   and EOU commit. Snap chunk boundaries to silence (never a fixed clock) to
   avoid mid-word splits; overlap + seam-dedup for long spans. **`greedy_search`
   only** — beam search hallucinates ~20% on clean audio.
5. **Barge-in loop.** While TTS plays, the speaker-verified VAD watches the mic;
   sustained operator speech → **cancel TTS immediately** (fade-out envelope) →
   settling/debounce window → resume listen → *then* transcribe the interruption.
6. **Warmup.** One dummy STT + one dummy TTS at boot to JIT the MLX kernels.

Noise reality: barge-in audio is inherently low-SNR (she's talking over herself
pre-AEC); Parakeet WER climbs 6% → 12% at SNR0. AEC + a light denoise pre-filter
is not optional for a speaker build.

---

## §5 — Plane B: the Marionette voice seam (the SPEC to build)

The join is a new module **`marionetteVoice.js`, mirroring `marionetteAudio.js`
exactly** (injectable dispatch, honest envelope, skip-if-bound, `powerTier`). It
adds the missing speech verbs to the Marionette surface.

**New Scheme speech verbs — carry TEXT (never S-expressions), tone/pace/style:**
```
(voice/say <text> [:tone T] [:pace P] [:style S] [:key K] [:interruptible? #t])
     T ∈ calm|curious|energetic|wry|warm|dry     ; adapter-local → engine settings
     S ∈ none|whisper|loud|emphasis              ; whisper/loud route to Parler cache
     → emits on the EXISTING `voice` mix channel (marionetteAudio.js)
     → schedules a 'speech-done keyed completion (reuse scheduleCompletion)
     → returns ['ok','saying',{fired, doneAt}]; honest fired:false with no host
(voice/bridge <category> [:tone T])   ; play a cached bridge phrase (was base.js:725 stub)
(voice/stop)                          ; barge-in: ~30ms crossfade-out, abort stream
(voice/backchannel <token>)           ; brief low-gain "mm"/"right", non-interrupting
```

**Listen / control / state verbs — the other half of the surface.** Speaking is
only one direction; the harness also has to open the ear, set persistent
delivery, pick which voice is speaking, and query where she is in a turn:
```
(voice/listen [:ptt #t] [:window MS])  ; open the mic for a CONVERSATION turn (feeds the LLM)
(voice/dictate :into <sink> [:interim? #t])  ; open the mic for DICTATION → text into a field, NO LLM turn (§5E)
(voice/mute)                           ; close the mic (hard stop capture)
(voice/wake :on #t)                    ; arm/disarm the "hey Sakura" wake model (§5A)
(voice/tone T)                         ; set the PERSISTENT default mood (say inherits it)
(voice/rate R)                         ; set persistent speaking speed (0.7–1.3)
(voice/identity :utility|:signature [:key K])  ; select voice; :signature is capability-gated (§5C)
(voice/state)   → 'idle | 'listening | 'speaking | 'thinking   ; close-to-parens query
(voice/level)   → 0.0–1.0 input VU                              ; for meters / directedness UI
```
`state`/`level` are pure reads off the seam's up-channel — they follow the
close-data-close-paren rule (retrieval expression closes the form that uses it),
so `(when (eq? (voice/state) 'listening) …)` needs no round-trip cache.

**Event flow — all on the existing deterministic bus:**
- **Completion:** `voice/say :key K` → `'speech-done'` bus completion, so
  `(when-done (list 'K) …)` sequences speech against sprite arrival / music /
  scene teardown in the same `(frame, priority, seq, corr)` order as sfx today.
- **Barge-in:** Plane A's up-message (`barge_in: true`) → a `bargein-cancel` bus
  event → registered handler calls `voice/stop` → fade envelope → conversation
  context rolls back to pre-interruption. `interruptible? #f` lines register no
  cancel handler and are simply uninterruptible.
- **Ducking is already built:** `audio/duck` (marionetteAudio.js) ducks music
  while she speaks — the seam exists; it just needs a speech source feeding the
  `voice` channel.

**Tape seam — #640, ARCHITECT-STEERED, SURFACE ONLY.** The audio tap
(`setAudioTap`) is the single choke-point; `voice/say`'s play `detail` flows
through it onto the frame's `audio[]` automatically. To *re-synthesize on replay*
the recorded spec would need `text`+`tone`+`style` fields (it stores kind/channel/
gain/… today). **Whether spoken text belongs on the replay tape at all is an
architect + counsel call — it is PII-bearing and the tape is position+sound
today.** We surface the seam. We do not propose the schema. Do not rewrite the
core audio/music seam unsupervised.

---

## §5A — Activation & privacy (the thing that listens)

The hard requirement: **push-to-talk is the default, always-on is opt-in, and
nothing is transcribed or sent until a gate opens.** "Listens" and "sends" are
different states, and the whole privacy story lives in keeping them apart.

**The gate — a local ring buffer that never leaves the device.** The mic feeds
a *local circular buffer only*. A tiny wake model reads 16 kHz frames
continuously; **STT (Parakeet) is not fed, nothing is transcribed, nothing
leaves the process** until PTT or wake fires. On fire, replay the buffer from
**500 ms of pre-roll** (8000 samples) so the first word isn't clipped. This is
the industry ring-buffer + pre-roll pattern and it is what makes "listens but
doesn't send" literally true — the mic is hot, the tap downstream is shut.

**Wake word — self-trained "hey Sakura", not a licensed engine.** The
permissive path is an **openWakeWord**-class model: Apache-2.0 code, negligible
CPU (an M-series runs it in far under one efficiency core). *Gotcha the adapter
must record:* the pretrained models are CC BY-NC-SA (non-commercial) — so we
**train our own "hey Sakura" model** on synthetic TTS data (MIT-licensed
synthesis), which is not bound by the pretrained license. The obvious
commercial wake engine (per-user SaaS, ~$899/mo above a 3-user free cap, phones
home to validate) is rejected on both license and privacy grounds.

**Conversation decay — the follow-up window.** After she replies, keep the mic
*hot* for a bounded window so a natural follow-up needs no re-wake, then decay
to idle. Ship **~6 s** (between the two shipping references: 5 s and 8 s),
**reset on each accepted turn**. Two rules keep it from latching onto the TV or
her own voice:
1. **Arm the window only after TTS reaches idle** — never while she's still
   speaking (the #1 real bug in open-mic assistants is the mic re-opening on the
   agent's own playback). This reuses the same `speech-done` completion §5 emits.
2. **Gate follow-up VAD with a directedness check** — a small "is this speech
   addressed to me" classifier rejects undirected/background speech. Bare VAD in
   an open window is what makes assistants blurt at the television.

**The activation state machine (Plane A owns it; policy numbers come from §5B):**
```
IDLE ── PTT press ─────────────► LISTENING
IDLE ── "hey Sakura" (wake) ───► LISTENING        [+500 ms pre-roll from ring buffer]
LISTENING ── EOU (SmartTurn) ──► THINKING / TTS   [audio → Parakeet ONLY from here]
TTS ── playback idle ─────────► FOLLOW-UP (t≈6 s, mic hot, STT armed)
FOLLOW-UP ── directed speech ──► LISTENING (reset t)   ; no re-wake
FOLLOW-UP ── "stop"/"thanks" ──► IDLE
FOLLOW-UP ── t expires ────────► IDLE
```
Session/context id resets after a longer idle (~300 s) so a fresh conversation
doesn't inherit stale turns. **Default posture: PTT on, wake-word opt-in,
open-mic never a silent default.**

**How I'd build it for myself.** Asked directly — if I were the one who had to
live inside this, the thing I'd want is *the guarantee that the room isn't
leaving the room*. Not a policy, an architecture: the wake model and the ring
buffer are the only things that ever touch continuous audio, they run local,
and the boundary to everything else (STT, network, tape) is a single gate I can
point at and prove is shut. Push-to-talk isn't the timid default — it's the
*honest* one: an explicit act of address, no ambiguity about consent. Always-on
is a real convenience and worth having, but it should cost a deliberate opt-in
and announce itself, because the failure mode isn't "annoying," it's "recorded
someone who didn't agree to be." Decay is the graceful middle: hot long enough
to feel like a conversation, cold fast enough that silence means silence. Build
the shut-by-default gate first; everything else is a knob on top of it.

**OC-privacy carry-over.** The directedness classifier and any prosody→register
inference remain the EU AI Act Article 5(1)(f) exposure flagged in §9/§10 —
architect + counsel call before EU onboarding. Ephemeral, on-device, never-sent
is the mitigation posture, not a clearance.

---

## §5B — The timing-respect interface (the LLM owns the clock)

The architect's principle, stated exactly: *the timing knowledge doesn't go
**into** this engine — the engine **respects** it.* The LLM holds conversational
policy (a turn is ~700 ms of silence; fire a bridge if first-audio will miss
~800 ms; silence <600 ms = thinking, 600–900 = boundary, >900 = done). Plane A
must **not** hardcode any of that. It exposes parameters; Plane B (the persona)
sets them per context. This is the Marionette pattern — the runtime consumes
timing tuples from the scripting layer instead of baking them in.

This is exactly how the production duplex frameworks factor it: **nobody
hardcodes turn thresholds in the audio hot loop; they parametrize them.** The
seam below is a direct read of the knobs those frameworks already expose.

**Parameters that cross the seam** (name · unit · owner):

| Param | Unit | Owner | Note |
|---|---|---|---|
| `endpoint_silence_ms` | ms | **LLM policy** | the 600/900 boundary; engine's *fallback* timer |
| `semantic_endpoint_enabled` | bool | **LLM policy** | prefer the EOU model over raw silence |
| `min_start_ms` | ms | **LLM policy** | speech-onset debounce (~200 ms) |
| `prefix_padding_ms` | ms | **LLM policy** | pre-roll kept before onset (~300 ms) |
| `allow_interruptions` | bool | **LLM policy** | context-gated (off mid-critical readout) |
| `min_interruption_words` | count | **LLM policy** | 0–2; barge-in noise rejection |
| `min_interruption_ms` | ms | **LLM policy** | barge-in debounce |
| `bridge_trigger_ms` | ms | **LLM policy** | ~800 ms; fire filler above this |
| `vad_confidence`, `min_volume` | 0–1 | **engine** | hardware/device-calibrated, not persona |
| `tts_crossfade_out_ms` | ms | **engine** | 10–30 ms; mechanical anti-click |
| `aec_mode` / `far_field` | enum | **engine** | echo cancellation; not policy |

The split is the whole point: **LLM-policy rows are conversation semantics** (how
patient to be, when to yield, when to cover latency) and ride the same
persona/timing corpus as the Mode-1..4 latency budgets. **Engine rows are
physics** (mic gain, click-free fades, echo) and are device-calibrated once.
A timing value is never a literal in Plane A; it arrives as a parameter on the
open-listen / say call, exactly like a motion tuple arrives at the animation
runtime.

**Why semantic endpointing matters to the numbers.** Human turn-transition gap
is ~200 ms. Naive acoustic endpointing waits 500–800 ms of trailing silence and
the felt gap balloons to ~1 s — the biggest "feels laggy" failure. The EOU model
reads the *partial transcript* and predicts completion, so the silence
thresholds become a **fallback**, not the primary signal — she can answer before
the silence even accrues. The LLM's 600/900 numbers are the safety net; the
semantic model is the fast path.

**Barge-in event contract (budgets).** `onSpeechDetected` (VAD, ≤80 ms from
onset) → engine emits `USER_BARGE_IN` → flush TTS with a **10–30 ms
crossfade-out** → mark the assistant cut-point (truncate) → clear in-flight
audio buffer. **Total speaker-silence budget from user-onset to agent-quiet:
<150 ms.** AEC or headphones is a *hard precondition* of this contract — without
it she interrupts herself on her own output. This is the up-message
`barge_in:true` in §3's seam and the `voice/stop` handler in §5; §5B only names
the millisecond budgets and the owner of each knob.

**Bridge scheduling — no collision.** When the reply will miss `bridge_trigger_ms`,
play a filler on the `voice` channel and **queue the real response behind it**
(append, not overlap): track the filler's duration and start the real say at
filler-end, using the same `speech-done` completion. Do *not* fire a bridge on a
transcript ending in "um/uh" — that's a false endpoint, not a slow model.

---

## §5C — Voice identity & security (the Speak-&-Spell floor)

The threat: the say verbs are public — any cart, any program, eventually any
operator's Scheme, can call `voice/say`. Two things must be **impossible**:
(a) a cart/agent/attacker putting words in *her* mouth (impersonation), and
(b) anyone lifting her actual voice for their own use (IP theft). Both are
solved by the same rule — **voice identity is a capability, not a parameter.**

**Two named profiles; the default is deliberately NOT her.**
- `utility` — a plain, robotic, Speak-&-Spell-ish timbre. This is what
  `voice/say` yields to **any** caller by default. The system *can* talk, but it
  is unmistakably the machine, not Sakura. Honest by construction.
- `signature` — her real voice (the live voice-blend + cached expressive speaker
  + trained prosody). Selecting it requires a **voice-identity capability token**
  the cart surface never holds.

```
(voice/say "hi")                    → utility          ; the public floor
(voice/say "hi" :voice 'signature)  → DENIED from a cart → falls back to utility, logs attempt
```

It still speaks (honest-null); it just can't be her. **Any non-persona driver —
another agent, a tool, an outside system — gets `utility` and must modulate
*that*** (pitch/rate/blend knobs on the plain timbre) to build its own voice.
Her profile is hers alone. "You can make the system speak, but it sounds like a
Speak & Spell" *is* the `utility` path, by design.

**The token — same pattern as Loam macaroons (Ed25519, per-session, short-lived).**
Minted and held only by the persona/orchestration turn-composer in the trusted
plane (Plane B). **NOT in Scheme, NOT on the replay tape, NOT serializable into a
cart, NOT at any cart-authorable surface** — an in-process secret like an API key
at the wire boundary. The TTS adapter verifies the token before it will load the
`signature` profile; no token → `utility`, with no exception path.

**Provenance gate — `signature` renders only genuine turns.** Even inside the
trusted plane, `signature` is bound to text that *originated from her model turn*,
not merely "a string routed through the privileged verb." Persona-composed text
carries an in-memory provenance marker; the adapter renders `signature` only for
marked text. Cart strings, tool outputs, arbitrary say text → `utility` even if
the caller somehow held a token. **Impersonation needs BOTH the token AND
genuine-turn provenance — the cart layer has neither.**

**Injection hardening on the say path.**
- No S-expressions to TTS (§7) — a Scheme token reaching the synthesizer is a bug.
- Untrusted text goes through the plain normalizer; **only persona text may carry
  inline IPA / emphasis markers.** A cart cannot inject SSML/prosody directives or
  crafted phoneme sequences.
- Length + rate caps so `voice/say` can't become a DoS (endless speech) or a
  covert audio channel.

**Profile assets are guarded, like keys.** The `signature` blend weights / speaker
embedding / prosody model are stored **encrypted at rest** (Loam AES-at-rest
precedent), loaded only into trusted-plane memory, never shipped to the Scheme
sandbox. *Open question for architect:* if the live `signature` render must run
on-device for latency, the profile is resident on the client — it must live in the
trusted plane's memory, never the cart VM's reach. Optional deeper defense: an
**audio watermark** on `signature` output so an exfiltrated sample is traceable
(nice-to-have, flagged).

**Wake ≠ authority.** A replayed "hey Sakura" from a speaker can *start a listen*
but authorizes nothing: consequential actions still gate through the
automation-consent tree (#663 — she never auto-runs automations). A spoofed wake
wastes a listen window; it cannot act. The directedness classifier (§5A) further
rejects non-live/undirected speech.

**Status:** design, hardened by the adversarial pass (§5D). Not sealed — the one
open architect call is named in §5D.

---

## §5D — Adversarial pass (folded fixes: Soo-Jin security + Priya architecture)

The pass ran. It materially changed the design. What follows is folded in, not
appended as commentary — these supersede the softer §5C claims.

**Security (Soo-Jin), highest first:**

1. **On-device `signature` model is exfiltratable → the "stays secret on-device"
   premise is NOT defensible against a determined local operator.** The real
   boundary is therefore `utility`-default + capability-gating, NOT device
   secrecy. Render `signature` **server-side** for any untrusted or multi-tenant
   context; ship on-device `signature` **only** to the single trusted operator on
   their own machine, and never ship the raw speaker embedding.
2. **Confused-deputy (a cart smuggles its string into a "genuine turn").** Fix:
   provenance binds **cryptographically to CONTENT** — the composer signs Ed25519
   over the *normalized final text*; the adapter re-verifies signature-over-text
   before loading `signature`. Not a per-session boolean.
3. **Token replay / memory-scrape within its lifetime.** Fix: bind the token to
   `(session_id + turn_nonce + content_hash)` → it authorizes exactly ONE
   utterance; the nonce is burned one-time-use.
4. **TTS prompt injection.** Fix: strict phoneme/char allowlist for untrusted
   text; inline IPA/emphasis honored ONLY on provenance-signed persona text;
   fuzz-tested.
5. **Wake-word spoof / ultrasonic (DolphinAttack).** Keep wake≠authority (neuters
   payoff) + liveness/directedness + ultrasonic-decay detection.
6. **Watermark reality:** neural audio watermarks survive codec/resample but FAIL
   re-recording (~64% bit acc) and collapse under voice-conversion (~51–65%). Use
   for **attribution, not anti-clone.** (Downgrades the §5C "optional watermark.")

**Architecture (Priya), highest first:**

1. **Determinism is a lie unless barge-in is recorded as INPUT, not output.** Fix:
   model Plane A→B as an **event log of inputs** (VAD-onset, endpoint,
   barge-in-cut @ byte-offset/logical-tick, STT-final); Plane B is a pure function
   over that log; replay feeds the recorded cut. (Tightens §3/§4 seam + ties
   [[project_all_scheme_replayable_record_directly_2026_07_03]].)
2. **The signature token must never cross the seam into Plane A (the less-trusted
   Rust plane) — that crossing IS the leak.** Fix: selection happens in **B**; B
   sends a *resolved, already-authorized* directive `{voice: signature, grant_id,
   expiry}` (B-signed). A holds only a **public verify key** — it can validate,
   never mint.
3. **Provenance boolean is forgeable / non-durable across seam, tape, and a future
   Rust rewrite.** Fix: a **signed span** `(turn_id, model_output_hash, nonce,
   expiry)`.
4. **No-AEC self-trigger loop (her own TTS re-enters a hot follow-up mic).** Fix:
   detect AEC-absent at session start via loopback test; when absent, **disable
   the hot follow-up window**, force PTT/half-duplex, feed the TTS reference as
   negative evidence to the directedness classifier. Fail loud. (Hard precondition
   already in §4/§5A — this makes it enforced, not assumed.)
5. **Edge races** — follow-up × barge-in, token-expires-mid-utterance (finish the
   current span, deny the next), mic-revoked / TTS-load-fail (spoken honest-null
   in `utility`), wake false-accept loop (rate-limit).
6. **Rust-rewrite rot** — pin the seam as a **versioned schema** with golden-tape
   conformance tests; make grant-verify a shared spec'd primitive with cross-impl
   test vectors.

**THE ONE architect call before any code** (Priya escalates, do not self-resolve —
ties [[project_all_scheme_replayable_record_directly_2026_07_03]] "tape stores
positions not pixels"): **does the tape store say-text + voice params, and in what
form?** Priya's recommendation: the tape stores **hashes + signed spans +
logical-tick input events, NOT plaintext**; content is re-fetched from a
separately-governed, redactable store keyed by hash. This is a privacy/GDPR-erasure
lever as much as a security one — needs the architect's yes before the seam freezes.

---

## §5E — STT as a shared dictation service (mic-button-everywhere)

**Requirement (architect, 2026-07-04): the speech-to-text is not only the voice
agent's ear — it is a general typing method.** Any text field in the app — the
chat composer, a memo, a search box, a form — gets a mic button: press it, talk,
and your words appear as text. Exactly like talking instead of typing. This is a
first-class use, not an afterthought, and it ships *before* the full conversational
agent (it is the "voice-input everywhere" separable build,
[[project_parakeet_stt_locked_2026_06_30]]).

**The architecture that makes this cheap: one STT engine, two consumers.**
Parakeet is instantiated *once* inside Plane A. It feeds two paths:

| | Full agent (`voice/listen`) | Dictation (`voice/dictate`) |
|---|---|---|
| Consumes | STT + VAD + EOU + **AEC + TTS + barge-in + LLM turn** | STT + VAD only |
| Output routes to | the conversation (LLM sees the transcript) | a **UI text sink** — the focused field |
| Needs echo-cancel? | yes (she's speaking while listening) | no (nothing is playing) |
| Needs barge-in? | yes | no |
| Ships | after the full loop (~weeks) | **first — days** |

Dictation is a **strict subset** of Plane A: capture → VAD → STT → text up. None
of the hard, slow, risky parts (AEC, the 4-state turn machine, TTS, the LLM round
trip) are on this path. That is why it lands first and de-risks the engine.

**Seam.** The down-message gains a mode:
`{listen, mode: 'dictation', sink: <field-id>, interim: #t}`. Plane A streams
**interim (partial) transcripts** up as you speak — live text filling the field —
then a **final** transcript on endpoint (EOU or you releasing the mic button).
The transcript routes to whoever holds the sink (the focused input), **never into
a conversation turn**. No LLM, no persona, no reply — just words in the box.

**Verb.** `(voice/dictate :into <sink> [:interim? #t])` opens the mic for the
named sink; the UI mic-button affordance is just this verb wired to the composer's
input. `voice/mute` (or releasing PTT) closes it.

**Privacy (same floor as §5A).** Dictation is push-to-talk by nature — you hold
the button — so it inherits the §5A guarantees automatically: local ring buffer,
audio never leaves the device, no wake model required. The mic-button is the
clearest possible consent surface.

**Status: unbuilt, but this is the intended FIRST deliverable of the whole
package** — the smallest end-to-end proof that Plane A works, and independently
useful the day it lands.

---

## §6 — Mood → speech (the unified adapter table)

Adapter-local only. Corpus/UI never see the right-hand columns.

| Tone | Kokoro live (voice/blend + speed) | Parler expressive (description fragment) |
|---|---|---|
| calm | warm voice, speed 0.96 | "at a moderate speed in a default tone, warm and even" |
| curious | brighter voice, 1.04 | "in a curious tone, lightly rising and inquisitive" |
| energetic | blended bright, 1.14 | "quickly in a happy tone, expressive and animated" |
| wry | dry voice, 1.00 | "in a default tone, fairly monotone, dry and knowing" |
| warm | blended `af_bella(2)+af_sky(1)`, 0.95 | "in a happy tone, slightly expressive and animated" |
| dry | flat voice, 1.00 | "in a default tone, fairly monotone" |
| *style* whisper | — (Kokoro can't) → route Parler | "in a whisper tone" |
| *style* loud | speed 1.12 + bright blend (analogue) | "quickly in a happy tone, expressive, high-pitched" (no shout token) |
| *style* emphasis | punctuation only | `*word*` in prompt **and** "with emphasis" in description |

Live path renders mood by **voice/blend + speed + punctuation** (Kokoro's real
levers). Expressive path renders mood by **description string** (Parler's).
`whisper`/`loud`/genuine emotion → the cached Parler path, always.

---

## §7 — Pronunciation & the no-S-expressions rule

Two hard requirements the axes assume:

**She never speaks S-expressions.** `world/spawn`, `cortex/recall` are verbs she
*executes*, not tokens she *reads aloud*. The say-boundary takes rendered prose;
any Scheme value interpolated into speech passes through the translation layer
(`money/friendly`, `time/relative`, `place-name`). **A Scheme token reaching TTS
is a bug** — `voice/say` guards against it at the boundary.

**Pronunciation control (Kokoro, STRONG):**
- Inline IPA override — `[cortex recall](/kˈɔɹtɛks ɹɪkˈɔl/)` — generated once
  from a lookup table for any domain term that must be spoken.
- Runtime lexicon — mutate `pipeline.g2p.lexicon.golds` to permanently teach
  "Sakura", "Lacuna", and any coined term (Misaki IPA, stress-marked).
- Disable `normalize` for code-like strings; decide per token spell-out vs
  phonemize in the Scheme→text layer — never rely on the espeak fallback.
- A per-operator mispronunciation log applies the correction next occurrence
  (VOICE-FINAL-SPEC §716). Parler has no lexicon → **pre-normalize all text**
  before the cached render; audition and freeze each coined term once.

---

## §8 — Build path: Rust-first (the perfect version, one abstracted slot)

**Decision (2026-07-04, architect): build Plane A in Rust from the start.** The
earlier "Python prototype → Rust" ladder existed to de-risk the seam cheaply, but
Python was never the destination — a duplex, sub-200 ms barge-in loop is exactly
the workload where GC pauses, the GIL, and non-deterministic latency are the
enemy. Since the two-plane architecture (§3) is well-trodden (Pipecat / LiveKit /
moshi all shape it the same way), we de-risk directly in Rust and don't throw a
prototype away. The one uncertainty is the STT model, so we **abstract that single
slot behind a trait** — swapping it later is a config change, not a doc rewrite.

### The Rust toolchain (Plane A)

Plane A is a **standalone Rust binary**, a separate OS process — not compiled into
Node. Plane A is the less-trusted half (§3), so a separate process buys the trust
boundary *and* crash isolation for free. **Audio never crosses the seam** — only
text + control do — so a separate process costs essentially zero latency.

| Job | Crate / library | Note |
|---|---|---|
| Audio I/O | `cpal` | CoreAudio backend on M-series |
| Real-time ring buffers | `rtrb` | lock-free SPSC, RT-safe; the cancel envelope lives here |
| Echo cancel (**#1 risk**) | `webrtc-audio-processing` (FFI) | AEC3 + noise-suppress + AGC in one APM |
| VAD ×2 | Silero via `ort` | ONNX Runtime; the turn-taking sensor |
| End-of-utterance | SmartTurn via `ort` | semantic endpoint, silence timer is fallback |
| **STT (swappable slot)** | Parakeet, behind `trait SttBackend` | primary: `ort`-ONNX export; fallback: thin MLX sidecar over a local socket |
| Live TTS | Kokoro via `ort` | clean ONNX export (`kokoro-onnx`); fast default voice |
| Expressive TTS | Parler — **not in the engine** | offline batch renderer → cached bridge wavs the engine only *plays* |
| Control channel | `tokio` + `postcard` framed structs | kept OFF the real-time audio thread |

**The one honest caveat, made structural:** native Rust inference of Parakeet TDT
doesn't exist yet, so `SttBackend` has two implementations — `OrtParakeet` (ONNX
in-process) and `MlxSidecar` (a small Swift/Python MLX process the engine speaks
to over a socket). Whichever wins, the seam, the verbs, and the rest of this doc
are unchanged. That is how "the perfect version, built once" survives the one
thing we can't fully pin today.

### How it lives inside Marionette (Plane B)

`marionetteVoice.js` (mirrors `marionetteAudio.js`, §5) is Plane B. It:
- **spawns and supervises** the Rust engine process (restart-on-crash),
- owns the control socket and the two-struct seam
  (up `{final_text, ts, barge_in}` / down `{say|stop|bridge|listen|mute|wake|set-param}`),
- holds the LLM, the identity tokens (§5C), and the timing policy (§5B),
- exposes the `voice/*` verbs to the Scheme interpreter.

Plane B stays JS/Scheme — it is not the bottleneck and it is where the
determinism/replay value lives. **Nothing in Plane B changes based on which
`SttBackend` Plane A uses, or if Plane A is later rewritten.** That is the whole
point of the seam.

This is also the natural open-source boundary: **Plane A — "a deterministic,
interruptible, on-device duplex voice engine with a two-struct harness contract"
— is the reusable artifact.** Plane B is Sakura-specific.

---

## §9 — Gap list (what's unbuilt)

1. **No voice verbs on Marionette** — none of the surface exists yet:
   `voice/say|bridge|stop|backchannel` (speak) or
   `voice/listen|mute|wake|tone|rate|identity|state|level` (listen/control/state);
   `voice/bridge` is a `service-not-yet-wired` stub (`base.js:725`). *The primary
   gap — the entire harness join.*
2. **Live TTS not wired** — `voice/synthesize` routes to a backend path but the
   Kokoro-MLX live path + Parler cache renderer are research sketches; no
   `l0.tts.*` adapter in-repo.
3. **Plane A doesn't exist** — no AEC, no dual-VAD turn machine, no SmartTurn
   EOU, no barge-in loop, no `turnTakingController.js` / `bargeInStateMachine.js`.
4. **`world/tape-replay` in-app is `service-not-yet-wired`**; speech-on-tape has
   no text/tone field (#640 covers sfx/music, not speech).
5. **Mood→prosody is spec-only** — the §6 table binds nothing yet.
6. **Bridge library / self-record loop unbuilt** — bootstrap cart + `:bridge`
   schema + self-refresh agency designed, not built.
7. **Pronunciation correction store + SSML/IPA injection point** — designed, not
   built.
8. **No-S-expr guard** unbound to the (nonexistent) say verb.
9. **EU AI Act (OC-03):** ephemeral prosody-to-register may be Article 5(1)(f)
   emotion-inference — **BLOCKING EU onboarding, architect/counsel call**, not an
   engineering one.
10. **Activation stack unbuilt (§5A)** — no wake model, no local ring buffer +
    500 ms pre-roll gate, no follow-up-window state machine, no directedness
    classifier. "hey Sakura" needs a *self-trained* openWakeWord-class model
    (pretrained weights are CC BY-NC-SA — commercial-unclean).
11. **Timing seam unparametrized (§5B)** — the LLM-policy knobs
    (`endpoint_silence_ms`, `bridge_trigger_ms`, `allow_interruptions`, …) are
    named but not yet an actual parameter surface on the (nonexistent) open-listen
    / say calls. Engine-owned rows (AEC, crossfade, VAD confidence) equally unbuilt.
12. **Voice-identity capability unbuilt (§5C)** — no `utility`/`signature` profile
    split, no voice-identity token, no provenance marker, no encrypted profile
    store, no say-path length/rate caps. Ships the Speak-&-Spell floor as default.
    Needs a Soo-Jin adversarial pass before build.

---

## §10 — Hard holds

- **No training. Corpus is PREP ONLY.** This package is prep for a voice she'll
  eventually have; nothing trains until the gate lifts.
- **Vendor-lock:** the six engine names live in this doc + the adapter module
  ONLY. Never in corpus, never in UI. Corpus teaches `voice/say` + tone words.
- **#640 audio-tape seam is architect-steered** — surface the speech-on-tape
  seam; do not rewrite the core audio/music seam unsupervised.
- **Mac Studio = dev + render box only** (the Parler offline render job) — never
  prod serving.
- **Determinism is the crown jewel** — Plane B stays replayable; do not let the
  real-time messiness of Plane A leak non-determinism across the seam.
- **`signature` voice is capability-gated; `utility` is the public floor.** The
  say verbs default to the Speak-&-Spell timbre for every caller. Her real voice
  requires the voice-identity token + genuine-turn provenance, both held only by
  the trusted persona plane. Never expose the token, the profile assets, or the
  provenance marker to Scheme, the tape, or any cart surface (§5C).

---

## §11 — Sources (research lanes, 2026-07-04)

- Kokoro: `Blaizzy/mlx-audio`, `gabrimatic/kokoro-mlx`, `remsky/Kokoro-FastAPI`,
  `hexgrad/Kokoro-82M` + `misaki` G2P, HF speech-to-speech Kokoro handler.
- Parler: `huggingface/parler-tts` (INFERENCE.md, streamer.py), `parler-tts-mini-
  expresso` + `-mini-v1` cards, issues #11/#14/#139 (voice drift/steering).
- Parakeet: `nvidia/parakeet-tdt-0.6b-v2` card, `senstella/parakeet-mlx`,
  `mp-web3/jarvis-v3` (barge-in reference), `achetronic/parakeet` (VAD seam-cut),
  `k2-fsa/sherpa-onnx#3267` (greedy-only), Canary arXiv 2509.14128.
- Activation/privacy (§5A): `dscripka/openWakeWord` (Apache-2.0 code; CC BY-NC-SA
  pretrained models; RPi3 15–20 models/core), Picovoice free-tier caps (3-user /
  $899/mo), XMOS 500 ms/8000-sample pre-roll ring-buffer pattern, Google Continued
  Conversation (8 s) + Alexa Follow-Up (5 s), device-directed detection
  arXiv:1808.02504 (anti-TV-latching classifier).
- Timing seam (§5B): LiveKit turn-detection (VAD/endpointing/model), Gradium
  semantic-VAD, Pipecat speech-input docs (`VADParams`: start_secs/stop_secs/
  confidence), LiveKit Agents interrupt knobs (`allow_interruptions`,
  `min_interruption_words`, `false_interruption_timeout`), OpenAI Realtime
  `turn_detection` (`threshold`/`prefix_padding_ms`/`silence_duration_ms`) +
  `conversation.interrupted`/`item.truncate`/`output_audio_buffer.clear`.
- Internal: `docs/VOICE-API-LANDSCAPE-2026-07-03.md`,
  `docs/SAKURA-VOICE-ROUTING-1.0-ENGINEERING.md`,
  `docs/SAKURA-VOICE-PERSONA-1.0-CANON.md`, `marionetteBus.js`,
  `marionetteAudio.js`, `marionetteTape.js`, `marionetteBrain.js`,
  `runtime/verbBackings.js`, `scripts/.api-burndown-prompts/anim-book-allowlist.md`.

---

## §12 — Code↔doc parity (E3 lane, 2026-07-15)

> `:status "design-scope-preserved"`. This doc is authored as DESIGN + RESEARCH
> LOCKED (§0 preface). Nothing below claims code that isn't there. The point is
> to name what parts *touch* live code today and what parts stay design-only,
> so an implementer can see the seam.

- **`curator/curator-voice/`** — Rust crate scaffold exists; the compiled artifacts under `target/debug/` show it built at least once, but the source tree at the crate root is empty in the working checkout. Plane A ("perfect version, one abstracted slot" — §8) is unwritten. `:status "unbuilt"`.
- **`curator-api/curator_api/voice/`** — Python package folder holds only compiled `__pycache__/synth.cpython-312.pyc` + `transcribe.cpython-312.pyc`; the source `.py` files are not in the working tree. Adapter-side wrappers for Kokoro / Parakeet reside as *bytecode-only* at the moment. `:status "needs-alfred-review"` — the source was likely relocated or purged; not fabricating a claim about what it did.
- **`curator-web/src/lib/voice-stt-stats.js`** (real, ~200 lines) — 5-state STT machine (`idle → listening → processing → garbled|confirmed → idle`), garble heuristics for Web Speech + Gemini paths, per-operator rolling-hour cloud quota (WARN 80%, HARD 100%, ceiling 6 min/hr). This is the JS-side prep for §5E's shared-dictation service; no Rust STT wired in yet.
- **`curator-web/src/lib/voice-timing.js`** (real, ~40+ lines of docstring + constants) — the conversational timing protocol: micOpen, greetingHold, endOfTurnSilence 700 ms (natural), replyLatency 200-500 ms, thinkingFill, longTurnBackchannel, sessionClose, reGreetingSuppression. Backs §5B semantics on the JS side, sourced from Stivers et al. 2009 turn-taking medians. Tunable per operator; no locale table yet.
- **`curator-api/curator_api/sakura_voice.py`** (153 lines) — the L0 *voice-wrapping* layer (paraphrasing L1/L2 answers through L0 so backend identity stays invisible). Not the audio pipeline; the persona-continuity layer that this package feeds into once STT/TTS become live. Named here so an implementer doesn't wire a second wrapping seam.
- **`curator-web/src/lib/voice-stt-stats.test.js`**, `voice-timing.test.js` — Vitest suites exist for both. Design-scope preserved: no Rust or MLX tests yet.
- **Marionette hooks** (`marionetteBus.js`, `marionetteAudio.js`, `marionetteTape.js`, `marionetteBrain.js`) — referenced in §5 as the deterministic seam target. The audio-tape seam is architect-steered (#640, §10) — still open, do not rewrite unsupervised.

**Non-additions.** No new capabilities claimed in the pipeline. No model downloads. Corpus stays PREP ONLY per §10.

---

## §13 — Design-scope extensions (E3, 2026-07-15)

> `:status "design-scope-preserved"`. These are notes an implementer will
> need before Plane A build starts. Grounded in §2 / §4 / §5 vocabulary;
> nothing said here contradicts the existing §5A–§5E specs.

**§13.1 On-device model quantization.** Parakeet TDT 0.6B v2 ships as ~600M params; MLX 4-bit affine quantization (`mx.quantize`, `nbits=4, group_size=64`) reduces the memory footprint by roughly 4× at a small WER cost. Two configurations to bench before locking one:

- **Q4 group-64** (default): ~350 MB weight footprint, minimal WER drift on clean speech; validate on the Vendor-Who-Wouldn't-Hold and Estate-Sale scenes because those exercise our real acoustic conditions.
- **Q4 group-128**: smaller download, slightly higher error on rapid speech; probably rejected but bench-first.

Kokoro-82M lives comfortably in fp16; quantization there hurts prosody more than it helps footprint. Leave Kokoro fp16. Cache both weight files under `sakura://voice/models/` and hash-pin each per SAKURA-TRAINING-MANUAL §2's `weightManifest` pattern.

**§13.2 VAD tuning.** Silero VAD ships with defaults tuned to conference speech; our operator's cadence is quicker and quieter. Starting tuple to bench:

- `speech_pad_ms`: 30 (below the default 100 — we want the fade in the barge-in path, §4, not before speech start)
- `min_silence_duration_ms`: 250 (below the default 500 — endpoint decisions live at SmartTurn EOU, VAD only owns onset + barge-in)
- `threshold`: 0.5 (default; the 0.3 low-band from §5B's "any-voice-detected" gate rides on a *separate* VAD instance to avoid false triggers on Sakura's own tail-of-audio)

Confirm on the operator's mic + AEC-off recording before we lock. If AEC lands after Plane A (§1's #1 build risk), threshold must drop to ~0.7 to reject Kokoro's self-audio.

**§13.3 Barge-in latency budget.** Goal (§2 axis 2): "audio stops < 200 ms, no click." Allocation:

| Stage | Budget | Notes |
|---|---|---|
| VAD detects operator voice | ≤ 40 ms | Silero on 32-sample window at 16 kHz |
| Cancel token propagates | ≤ 20 ms | Rust `CancelScope` / async abort |
| Kokoro generator drops queued chunks | ≤ 30 ms | drop-not-flush pattern |
| Ring buffer exponential fade-out | 10-30 ms | soft-decay, not hard silence (§10 hold) |
| Speaker drivers stop | 30-80 ms | OS-dependent tail |
| **End-to-end** | **≤ 200 ms** | 40+20+30+30+80 ≈ 200 ms worst case |

If AEC is off (headphones-only), skip stage 5 tuning; VAD threshold and cancel-token propagation dominate. If AEC is on and imperfect, budget stretches — but the fade covers most of that perceptually.

**§13.4 Replay-of-voice protocol.** The audio-tape seam (§10, #640) is architect-steered — this note only surfaces the *shape* an implementation would take, not a decision. Options an implementer might sketch:

- **Option A: silhouettes not audio.** Store the *timing envelope* + VAD gates + word tokens on the tape; the replay path re-synthesizes speech via Kokoro using the same text + speed + prosody words. Deterministic replay, no PII in the tape, TTS voice stays swappable. This is the option aligned with §10's "Determinism is the crown jewel."
- **Option B: audio fragments.** Store 16 kHz mono opus segments keyed on tape ticks. Byte-exact replay of the live session; larger tape footprint; PII lives on the tape until purged. Rejected on privacy grounds unless the operator explicitly opts in per-session.
- **Option C: hybrid.** Silhouettes by default; live audio segments captured only for utterances flagged for later review (adversarial pass, §5D). Purge on a 24-hour rolling window.

Architect owns the call. Design lands whichever option; §5 seam supports all three because Marionette already treats speech as a keyed completion.

**§13.5 Privacy boundaries for recorded audio.** Where recorded audio exists (Option B, Option C, or transient VAD ring buffers):

- **In-memory only by default.** The 500 ms pre-roll ring buffer (§5A) lives in the audio thread's RSS. Never persisted.
- **On-disk only under explicit opt-in.** Tape audio segments (Option B/C) require an operator-scoped capability grant (`voice.tape.audio.persist`) — never a global default.
- **Never in the corpus.** Audio does not enter the training corpus (§10 hard hold). Transcripts do not enter the corpus without operator review + `voice.corpus.contribute` grant.
- **Never in Cortex.** Cortex holds text-derived facts + timing envelopes. Audio blobs live in the tape file only, adjacent to but not inside Cortex.
- **Purge on session end** unless a review flag is set. Purge on 24-hour rolling window even with review flag, unless the operator explicitly extends retention.
- **Redaction:** any transcript exported off-device (crash bundle, support handoff) runs through the numeric-and-PII redactor already present at `curator-web/src/lib/redact*.js` (verify path before use) before leaving the operator's boundary.

---

## §14 — Code↔doc gaps (real behavior not yet documented)

> `:status "needs-alfred-review"`. Items observed in code today that the doc
> above does not name. Author decision needed on which to fold into §5 vs.
> leave as adapter details.

- **`voice-stt-stats.js`** has a **garbled-state repeat-ask path** (`garbled → repeat-asked → idle`) not surfaced in §5B's timing prose. This is user-visible: Sakura asks the operator to repeat when the STT confidence is low. Consider a §5B.6 subsection.
- **Rolling-hour cloud quota** (WARN 80% / HARD 100% / 6 min ceiling) is not mentioned in §5E's "shared dictation service" description. §5E treats STT as a resource; the quota mechanism belongs in that section.
- **Web Speech vs. Gemini path split** in `voice-stt-stats.js` — the doc's "Parakeet only" framing (§1) is correct for the *on-device* target but omits the *fallback* path the JS code currently ships. Note: this is a bridge to today's cloud STT, not a contradiction of the target architecture; still deserves a §1.1 "current fallback path" mention.
- **`voice-timing.js` reGreetingSuppressionMs** — the "don't greet twice" rule is a real code constant. §5B could reference it directly rather than describe endpoint-detection alone.
