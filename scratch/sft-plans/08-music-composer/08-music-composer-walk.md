# Lane #8 — Music Composer SFT (make-a-song from scratch)

**Status: OPEN — design locked here, authoring DEFERRED.** Design-only #418. No fold,
no pairs authored until Alfred says go ("we're gonna get to that in a second," 2026-07-29).

This lane is the **Music composer** sibling of lane #7 (native carts = the Game composer).
The boot splash (#373) has four surfaces — IDE / Music / Animation / Game. Games got a
rich make-from-scratch lane; Music and Animation did not. This is Music's.

Not a duplicate of lane #4 §21–§23 (book-of-music/sound/instruments). Those teach the
**subject** (Tier-2 instruction + 3–5 pairs/unit, sealed). This lane teaches **"help me
make a song"** — the same 10-family / 3-tier machinery lane #7 uses, domain-swapped to
audio. The book supplies the concept ladder; this lane supplies the build dialogue.

---

## §0 — one breath

Take the music make-from-scratch material, build it up rung by rung (each rung RUNS via
`./bin/motoi run`), decompose every construct back to the reference manual + book-of-music,
explode WHY each musical decision, reverse write⇄identify, and link every music-specific
ERROR back to its construct. Then climb into the ship-it tier: refine-and-extend a melody,
give sage advice about what actually sounds good, tell the truth about the machine (voice
budget, the sampler, headless audio), and — the keystone — **break "make me a song" into a
dialogue** ("what mood? let's start with a drum pattern, then a bassline under it"). Cap
with the philosophical lens: what music IS, why humans make it, music in CS.

## §1 — why this lane exists (Alfred, 2026-07-29)

The game engine is a vehicle to teach the model to **write Scheme, generally** — math,
science, state machines, Mealy/Moore machines. Games (and songs, and animations) are the
**on-ramp**: a lot of people meet Scheme + functional programming for the first time
*through a gaming system*. The error-finding these composer lanes drill **generalizes far
beyond music** — LLMs generalize debugging skill anyway, so teaching it here is high-value
transfer, not throwaway. Music is a key component precisely because it's a second, different
domain proving the same build/decompose/debug loop.

## §1.5 — the emphasis: CONSTRUCT ⇄ DECONSTRUCT, errors, and the on-ramp

**Making music from code is hard — any help is good** (Alfred, 2026-07-29). So the heavy
weight in this lane sits on the **construct/deconstruct pair + errors + the subtleties**:

- **CONSTRUCT (M1)** — expand hard on *how to build sound up*: a bare tone → a pitched note
  → a two-note interval → a phrase → a phrase you can loop → phrases stacked into parts (drum
  under bass under melody, per `layered-song`). Every rung a runnable step, small enough to
  hold in a head.
- **DECONSTRUCT (M2)** — expand equally hard on *taking a song apart*: given a finished song,
  name every construct, point each back at the reference manual + book-of-music, and say what
  it contributes (this `for-each` sequences; this `(pitch dur)` pair is one note; this BEAT
  math sets tempo). Take it apart "by mutilating" — change one thing, hear/read what breaks.
- **ERRORS + SUBTLETIES (M5, M8)** — sound has *lots* of subtleties and a rich error surface:
  timbre/envelope shape, tuning, timing/tempo drift, velocity/dynamics, the voice budget,
  silent-non-errors (runs, plays nothing). This is where the debugging skill that
  **generalizes past music** gets drilled hard.

**Why the lane exists (on-ramp + fork, Alfred):** the engine teaches Scheme *generally*
(math, science, state machines, Mealy/Moore). Composers are the on-ramp; the
self-reinforcing loop ("what else can I do?") is how people learn to program. Graduation =
**fork Motoi and write your own Scheme** with Motoi helping; Motoi warns what's dangerous
(Unix permissions) and gives an **honest no** where it doesn't know; Motoi stays the
kid-friendly one; forks leave and come back — Motoi is not mad. See
[[project_composer_lanes_music_animation]].

## §2 — substrate on disk (grab-don't-generate)

- **Ground-truth builds:** `carts/cart-maker-3-music/` — `arpeggio`, `chord-progression`,
  `drum-loop`, `layered-song`, `twinkle-melody` (each `*.scm` + captured `*.out.txt`). This
  is the from-scratch music ground truth. NOTE: there are **NO standalone music `.sks`
  program carts** (unlike games' 26). The unit here = the cart-maker song + the book ladder.
- **Concept ladder:** `scheme-books/book-of-music/` (19ch + 11app: surface-of-sound → note →
  melody → rhythm/meter → harmony → voices → timbre/envelope → polyphony → polyrhythm →
  repertoire chapters → harmonic series → concerto; appendices = world-music canon +
  drills). `book-of-sound/` (DSP/synth sibling: waveform → filter → envelope → FFT →
  voice → beat). `book-of-instruments/` (the roster you play).
- **Verb identity:** reference manual — `note`, `audio/play`, score verbs, `synth/*`,
  `note/*`, the harmonic-series primitives built from `math/sin`/`expt`.
- **Errors:** `scheme/reference/error-cards/` + music-specific runtime errors (below).
- **Composer runtime:** #380 composer-spec layer (`part/* motion/* note/* synth/*` on
  framebuffer/scheduler/synth); #379 real Node audio DSP backend (25 audio verbs). Verify
  which audio verbs actually run before assigning depth (headless; honest-null where absent).

## §3 — the ten families in three tiers (M1–M10, mirroring C1–C10)

**Tier A — MAKE & READ THE CODE (M1–M5):**
- **M1 BUILD-A-SONG LADDER** — empty file → one note → a phrase → a loop → layered parts,
  each rung RUNS. Grab rungs from cart-maker-3-music (twinkle: BPM→BEAT→phrase→play-phrase→
  reprise; layered-song: drum → bass → melody stacked). Unit = the whole song.
- **M2 DECOMPOSE-AND-DESCRIBE** — construct-by-construct against the reference-manual verb
  identity grid + book-of-music's frame (a note is a frequency; `note` fire-and-forget;
  `for-each` over `(pitch dur)` pairs). Name each helper by musical role.
- **M3 THE WHY — EXPLODE** — why 100 BPM, why quarter/half durations, why velocity 0.6, why
  phrase-1 reprises as a bookend, why C major. Multi-angle = the volume. Taste-bottom-out →
  honest-null.
- **M4 REVERSAL bidirectional** — (a) intent→code WRITE ("a lullaby in C, 4/4"); (b)
  code→identify+OUTCOME READ ("this note list — what tune, what key?"). InverseCoder. Also
  spec/broken poles.
- **M5 ERROR-LINK — including MUSIC-SPECIFIC errors** — each construct's throwable errors
  back to it inside the song, abductive symptom→cause→fix. Music errors: **silent output**
  (no audio driver / velocity 0 / wrong verb), **off-tempo** (BEAT math wrong, durations in
  ms vs seconds), **clipped/blown voice-budget** (too many simultaneous notes → the 16-voice
  cap, cf. composition ch12), **wrong pitch** (symbol not a note name → reader/expand),
  **notes-all-at-once** (forgot to sequence / used `map` where timing needed), **fuel-
  exhausted** (un-guarded generative loop). Silent-non-errors: a song that runs but plays
  nothing.

**Tier B — MAKE IT GOOD & MAKE IT REAL (M6–M9):**
- **M6 REFINE-AND-EXTEND** — nothing is done. "How do I make this melody better?" tighten
  (extract phrases, name pitches), extend (add a harmony voice, a counter-melody, a bridge),
  each RUNS. Done = checkpoint not end.
- **M7 SAGE ADVICE** — musical FEEL + taste, grounded in SURVEYED "what people of various
  ages find musical/pleasing" (cited K7, not invented): consonance vs tension, why a reprise
  satisfies, why a drop lands, tempo-for-mood; age axis (nursery-simple / teen-hook /
  adult-depth-or-calm); taste-forks → honest-null.
- **M8 TRUTH ABOUT THE MACHINE** — the voice budget (16 voices; "I stacked 200 notes on one
  beat and it choked"), the sampler/synth cost per tick, headless audio (why it may make no
  sound), fuel budget = seatbelt. What to do when it hangs. Deep version of M5's voice-blow.
- **M9 BREAK-THE-WANT-INTO-A-DIALOGUE (keystone)** — "make me a nursery tune" = one small
  cart (fits in a head). "make me a song" = part-by-part ("I can't hold a whole song in my
  head or read yours — walk me through it: what mood? let's lay a drum pattern first, then a
  bassline under it, then a melody on top — here's four bars, want it faster?"). Triage want
  → ask the load-bearing Q (tempo? key? mood?) → offer a starting shape (a drum loop) →
  build layer by layer → each step RUNS. Fuses stacked-context; the layered-song walkthrough
  is the worked spine.

**Tier C — WHAT MUSIC IS (M10):**
- **M10 WHAT IS MUSIC** — why humans make music (rhythm/dopamine/social bonding, told true,
  no mysticism); the 16 philosophers pass on sound/harmony/pattern/time (honest-null where
  silent; Wittgenstein-late on rule-following in a key; Pythagoras/harmonic-series as the
  math-in-music anchor); music in CS (signal as data, synthesis as computation, the score as
  a program); *ma* / silence as first-class (appx-06).

## §3.5 — knowledge weave (music K-set)

K1 computer-music history (world-knowledge, KEEP; scrub only who built the MODEL) · K2
music-design fundamentals (melody/harmony/rhythm/form) · K3 how-audio-works/why (sample →
waveform → mixer; the tick/scheduler) · **K4 what the SYNTH/AUDIO BACKEND is doing** — link
to the engineering manual's audio-DSP chapter (#379), the sibling of lane #7's framebuffer
weave · K5 the note↔frequency table (A4 = 440 Hz; named pitches ↔ Hz; unseen → "here's how
to derive it") · K6 where complexity belongs (sequencer state, voice allocation, the
16-voice budget) · K7 surveyed what-people-find-musical (cited).

## §4 — the units (finale artifacts)

The cart-maker-3-music songs ARE the units: arpeggio · chord-progression · drum-loop ·
layered-song · twinkle-melody. **Hold 1 out** (candidate: `arpeggio`) as a never-trained
validation song — clean test of write-a-song vs memorize-these-songs. Book-of-music's
concerto is the far-horizon finale referenced, not authored as a cart.

## §5 — depth / register

**COVERAGE WIDTH: 5–8 pairs per unit, DIALOGUE-HEAVY** (Alfred, 2026-07-29). This lane is
where the dialogue volume lives — "lots of dialogue, that's just the way it is." Expand it
richly:

- **KNOWS HOW TO COMPOSE** — the composition mechanics themselves (melody · harmony · rhythm
  & meter · voices · form), not just verb calls. It can build a piece, not only play notes.
- **KNOWS HOW SOUND WORKS** — the science: a **tone is a waveform**, the **math** behind it
  (frequency, the harmonic series, `math/sin`/`expt`), envelope/timbre, tuning. **Live it in
  WITH science** — sound as applied signal-math, the same physics the eng manual teaches.

Depth ~3–4 rounds (M1 longer, discrete rungs; M9 can run long with stacked context).
Register rides `:audience` (kid-first, book-of-music is `:audience "kid"`) and CLIMBS —
kid-who-wants-a-song not kept a baby. M7 age axis; M10 philosopher register. Novelty &
interest as an axis (a surprising turnaround, an unexpected key change). Abductive,
proper-lens (easing↔envelope, harmonic-series-as-ratio), grab-don't-generate, interpreter-
graded (`./bin/motoi run`). Over-include then scale back.

## §6 — compliance

Reference + book = authority (gap → `:status needs-alfred`, no fabrication — never invent
ethnomusicology or repertoire facts). Cited-not-invented for M7/K7. Scrub wall holds (music
HISTORY = world knowledge, KEEP; only naming who built the MODEL is forbidden; sole
surviving name = "Built by Alfred Borden"). Every code block must `./bin/motoi run`. This
is a design doc; the songs are the execution surface, authored on Alfred's go.

## §7 — open questions

1. Author all 5 cart-maker songs or hold `arpeggio` out (default: hold 1 out)?
2. Also teach the bundle `:music`/`:sounds` round-trip shape here, or leave to a bundle lane?
3. Error-link only own-construct errors, or also near-miss adjacent (wrong-audio-verb)?
4. K7 sourcing without internet — which cited source for "what people find musical"?
5. How much book-of-sound (DSP/FFT) folds in here vs staying pure book-of-music?
