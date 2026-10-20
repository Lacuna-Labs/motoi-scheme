# Stub-compliance brief — "Real verbs only, no stubs" (Alfred's ruling)

## The problem
Three books grade CLEAN under the canonical grader but achieve it by DEFINING
IN-CHAPTER STUBS for verbs that do not exist in base Motoi (e.g.
`(define (wave shape . rest) ...)`, `(define (spectrum-of src) ...)`). Alfred
ruled this FORBIDDEN. A CLEAN grade obtained via a fake stub is a lie in the
training corpus.

## The rule (verbatim)
Every ```scheme block must use ONLY verbs that natively bind in base Motoi.
For each stubbed/imaginary verb, apply exactly ONE of three compliant fixes:

1. **Delete the stub** — if the verb ACTUALLY binds natively (the stub was
   shadowing a real verb). Verify: `echo '(the-verb)' | ./bin/motoi run /dev/stdin`
   does NOT say "unbound". Then remove the `(define (the-verb ...) ...)` stub;
   the real verb takes over. Re-grade.
2. **Rewrite to the nearest real capability** — if the verb is genuinely absent,
   change the example to teach the closest real thing using a bound verb.
3. **Demote to a ```text fence** — if there's no near-real substitute, change the
   block's fence from ```scheme to ```text and add ONE prose line noting it's
   illustrative pseudocode for a capability base Motoi doesn't expose. The grader
   skips ```text fences.

## FORBIDDEN
- Defining a stub inside a ```scheme fence for any nonexistent verb. Ever.
- Redefining/shadowing an R7RS or SRFI standard name (e.g. audio `filter`
  shadowing SRFI-1 list `filter`).

## LEGIT (do NOT remove)
- Local helper functions built on REAL primitives are fine Scheme pedagogy
  (e.g. `grid-ref`/`grid-set!` over a `(make-vector ...)`, a `voice-3/4` helper
  that just computes with real list/number ops). The test is: does the helper
  fake an absent host capability, or does it compute over real values? If it
  computes over real values with bound verbs, KEEP it. Judge per-block.

## Real audio surface (base Motoi) — use these, nothing else
audio/{bar-clock, halt, key, listen, lufs, master-volume, onset-strength,
onset?, play, playing?, spectrum, synth, tempo, tick},
note/{place-at, release, strike}, synth/{chord, kit, play}.
Trig is geom/sin, geom/cos, geom/tan (bare sin/cos/tan are UNBOUND).
Standard = R7RS-small + SRFI-1/13/125/27. NEVER fold-left/foldl/foldr;
use SRFI-1 `fold` (elem-first) / `fold-right`.

## Per-verb keep/kill map (verified via ./bin/motoi 2026-07-29)

### book-of-music
- DELETE stub (real verb exists): audio/play, note/place-at, note/strike,
  synth/play, transport/tempo
- ABSENT → rewrite-to-real or text-fence: adsr, chord/build, chord/play,
  pedal/press, pedal/release, pluck, transport/tempo-curve, voice/create,
  voice/detune-spread, voice/envelope, voice/filter, voice/filter-sweep,
  voice/pan-sweep, voice/render, voice/tremolo, voice/vibrato, voice/waveform,
  wave, base/across-beats, base/at-beat, base/land-on-downbeat
  (voice-3/4, voice-4/4 are likely LOCAL HELPERS — inspect; keep if they
  compute over real values.)

### book-of-sound
- DELETE stub (real verb exists): (none — `filter` "binds" only as SRFI-1 list
  filter; if the book uses it as an AUDIO filter, that's a rewrite/text-fence,
  not a delete. Inspect usage.)
- ABSENT → rewrite-to-real or text-fence: add-formant, adsr, noise, partials,
  pluck, record, scheduler/queue, spectrogram-of, spectrum-of, speech/listen,
  speech/say, transcribe, transport/{loop,pause,play,stop}, voice, wave
  (audio/spectrum IS real — prefer it over spectrum-of.)

### book-of-introspection
- DELETE stub (real verb exists): (none found)
- ABSENT → rewrite-to-real or text-fence: composer/{set-widget-value,
  widget-info, widgets} (test each — may need composer server context),
  foreign/{call,origin}, form-pos, http/{get,post}, motoi/ask, native/get-resource,
  parse, parse-json, parse-one, sidecar/{call,start,type}, socket/{connect,info,read},
  system/{has?,limit-info}, value-type, walk
  (Motoi's real `type-of` introspects a verb NAME, not a value. For value-side
  type queries there is no `value-type` — rewrite onto `type-of` on a verb name,
  or text-fence.)

## Exit gate (both must hold)
1. `node scratch/find-stubs.mjs scheme-books/<book>/*.slatl` → TOTAL 0 (or only
   verified local-helpers-on-real-values, which find-stubs may still flag — if so,
   note them explicitly as legit in your report).
2. `node scratch/grade-book.mjs scheme-books/<book>/*.slatl` → every chapter CLEAN.

## Constraints
- No deletes of files. Edit in place.
- Do not commit.
- Preserve pedagogy: prefer rewrite-to-real over text-fence so the chapter still
  teaches something runnable; text-fence only when nothing real is close.
