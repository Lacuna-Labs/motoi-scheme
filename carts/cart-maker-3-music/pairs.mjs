// pairs.mjs — emit training pairs for cart-maker-3-music.
//
// Reads each cart source, generates 5-8 JSONL pairs, appends to the
// v8-partial corpus. Deterministic — same input always emits the same
// pairs, so re-running is safe.

import { readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { homedir } from 'node:os'

const CART_DIR = `${homedir()}/code/motoi-scheme/carts/cart-maker-3-music`
const OUT = `${homedir()}/.forge/corpus/motoi-v8-partial/cart-maker-3-music-2026-07-19.jsonl`

mkdirSync(dirname(OUT), { recursive: true })

function read(name) { return readFileSync(`${CART_DIR}/${name}`, 'utf8') }

function pair(user, assistant, meta) {
  return JSON.stringify({
    messages: [
      { role: 'user', content: user },
      { role: 'assistant', content: assistant },
    ],
    _meta: { _source: meta.source, tags: meta.tags, dialect: 'motoi', category: 'music-carts' },
  }) + '\n'
}

const pairs = []

// ── Cart 1: twinkle-melody ─────────────────────────────────────────
const twinkle = read('twinkle-melody.scm')

pairs.push(pair(
  "Write a Motoi cart that plays Twinkle Twinkle Little Star.",
  "```scheme\n" + twinkle + "```",
  { source: 'carts/cart-maker-3-music/twinkle-melody.scm', tags: ['music', 'melody', 'nursery', 'note-verb'] },
))

pairs.push(pair(
  "How do I represent a melody as data in Motoi so I can walk it note by note?",
  "Store each note as a `(pitch duration)` pair inside a list, then walk with `for-each`:\n\n```scheme\n(define phrase\n  (list (list 'C4 0.6) (list 'C4 0.6) (list 'G4 0.6) (list 'G4 0.6)\n        (list 'A4 0.6) (list 'A4 0.6) (list 'G4 1.2)))\n\n(for-each\n  (lambda (pair)\n    (note (car pair) (car (cdr pair)) 0.6))\n  phrase)\n```\n\nEach `(note pitch dur vel)` call is fire-and-forget through the audio driver. The `list` shape keeps the data legible; you can print it or edit it as data before playback.",
  { source: 'carts/cart-maker-3-music/twinkle-melody.scm', tags: ['music', 'melody', 'data-shape', 'for-each'] },
))

pairs.push(pair(
  "How do I compute note durations from BPM in Motoi?",
  "One quarter note at BPM b is `(/ 60.0 b)` seconds. From that base you derive the rest:\n\n```scheme\n(define BPM  100)\n(define BEAT (/ 60.0 BPM))      ; quarter note\n(define Q    BEAT)              ; quarter\n(define H    (* 2 BEAT))        ; half\n(define E    (/ BEAT 2))        ; eighth\n(define S    (/ BEAT 4))        ; sixteenth\n```\n\nPass those values as the `dur` argument to `note`, `chord`, or `melody`.",
  { source: 'carts/cart-maker-3-music/twinkle-melody.scm', tags: ['music', 'bpm', 'timing'] },
))

pairs.push(pair(
  "What's the pitch encoding for the `note` verb in Motoi?",
  "`note` accepts either a pitch symbol like `'C4`, `'C#4`, `'Bb3` (letter, optional accidental, octave) OR an integer MIDI number. Middle C is `'C4` or 60. Sharps use `#`, flats use `b`. The symbol is parsed against the standard octave-4-is-middle convention.",
  { source: 'carts/cart-maker-3-music/twinkle-melody.scm', tags: ['music', 'note', 'pitch-encoding'] },
))

pairs.push(pair(
  "Will `(note 'C4 0.5 0.6)` actually make sound in Motoi?",
  "It fires the OS audio driver in the background (`afplay` on macOS, `aplay` on Linux, PowerShell tone on Windows) fire-and-forget. If the runtime is headless — no audio device, or the driver isn't installed — the call still completes cleanly and the note is recorded in the media-state timeline. So the cart runs the same either way; only the acoustic result changes.",
  { source: 'carts/cart-maker-3-music/twinkle-melody.scm', tags: ['music', 'headless', 'audio-driver'] },
))

// ── Cart 2: drum-loop ──────────────────────────────────────────────
const drums = read('drum-loop.scm')

pairs.push(pair(
  "Write a Motoi cart that plays a classic four-on-the-floor drum loop.",
  "```scheme\n" + drums + "```",
  { source: 'carts/cart-maker-3-music/drum-loop.scm', tags: ['music', 'drums', 'pattern', 'synth-kit'] },
))

pairs.push(pair(
  "How do I trigger drum sounds in Motoi?",
  "The `synth/kit` verb plays a named drum hit:\n\n```scheme\n(synth/kit 'kick)   ; ~60 Hz thud\n(synth/kit 'snare)  ; ~200 Hz crack\n(synth/kit 'hat)    ; ~8000 Hz tick\n(synth/kit 'clap)   ; ~1200 Hz\n(synth/kit 'crash)  ; ~5000 Hz\n```\n\nOptional second argument is a step number the engine records but doesn't act on. `synth/kit` returns `'ok` on success, `'error` otherwise. It's a paint-tier verb (audible), not a read-only observation.",
  { source: 'carts/cart-maker-3-music/drum-loop.scm', tags: ['music', 'drums', 'synth-kit', 'verb-reference'] },
))

pairs.push(pair(
  "How do I represent a drum pattern in Motoi so I can walk it step by step?",
  "Use one boolean list per drum, one entry per step:\n\n```scheme\n(define kick-pat  '(#t #f #f #f #f #f #f #f #t #f #f #f #f #f #f #f))\n(define snare-pat '(#f #f #f #f #t #f #f #f #f #f #f #f #t #f #f #f))\n(define hat-pat   '(#t #f #t #f #t #f #t #f #t #f #t #f #t #f #t #f))\n\n(define (play-step i)\n  (if (list-ref kick-pat i)  (synth/kit 'kick))\n  (if (list-ref snare-pat i) (synth/kit 'snare))\n  (if (list-ref hat-pat i)   (synth/kit 'hat)))\n```\n\nOne pass through the pattern is one bar; loop through multiple times for multiple bars. This keeps the pattern editable as data — flip a `#t` and the beat changes.",
  { source: 'carts/cart-maker-3-music/drum-loop.scm', tags: ['music', 'drums', 'pattern-data', 'list-ref'] },
))

pairs.push(pair(
  "What's the timing math for a 16-step drum loop at 120 BPM?",
  "One beat at 120 BPM is `60/120 = 0.5s`. If your bar has 4 beats and 16 steps, each step is a sixteenth note: `0.5 / 4 = 0.125s`. So:\n\n```scheme\n(define BPM      120)\n(define STEP-DUR (/ 60.0 BPM 4))   ; = 0.125s\n```\n\nAt 120 BPM a full 16-step bar takes 2 seconds; four bars is 8 seconds.",
  { source: 'carts/cart-maker-3-music/drum-loop.scm', tags: ['music', 'timing', 'bpm', 'sixteenth-note'] },
))

// ── Cart 3: arpeggio ───────────────────────────────────────────────
const arp = read('arpeggio.scm')

pairs.push(pair(
  "Write a Motoi cart that arpeggiates the Am-F-C-G progression.",
  "```scheme\n" + arp + "```",
  { source: 'carts/cart-maker-3-music/arpeggio.scm', tags: ['music', 'arpeggio', 'progression', 'note-verb'] },
))

pairs.push(pair(
  "What is an arpeggio and how do I write one in Motoi?",
  "An arpeggio is a chord played one note at a time instead of stacked together. A common shape walks root-third-fifth-octave then back down: root-3rd-5th-oct-5th-3rd. In Motoi:\n\n```scheme\n(define arp-C (list 'C4 'E4 'G4 'C5 'G4 'E4))\n\n(for-each\n  (lambda (p) (note p 0.15 0.55))\n  arp-C)\n```\n\nThat's a six-note ascending-descending C major arpeggio. Chain several chords and you have a study piece.",
  { source: 'carts/cart-maker-3-music/arpeggio.scm', tags: ['music', 'arpeggio', 'concept', 'for-each'] },
))

pairs.push(pair(
  "How do I voice a triad in Motoi so it sits comfortably in the ear?",
  "Root position with a doubled octave on top is the safest voicing for beginner ears. For a C major triad:\n\n```scheme\n(list 'C4 'E4 'G4 'C5)   ; root, 3rd, 5th, octave\n```\n\nMinor triads flatten the third:\n\n```scheme\n(list 'A3 'C4 'E4 'A4)   ; A minor\n```\n\nAvoid piling notes below C3 or above C6 unless you have a reason — the ear stops parsing the chord and starts hearing texture.",
  { source: 'carts/cart-maker-3-music/arpeggio.scm', tags: ['music', 'voicing', 'triad'] },
))

pairs.push(pair(
  "The arpeggio cart runs but I don't hear anything. What's wrong?",
  "Nothing. Motoi's audio driver is fire-and-forget: the cart returns as soon as the notes are queued, before playback finishes. On macOS the queued `afplay` processes take a few seconds to actually emit sound. On CI or a headless server, `afplay` may not exist at all — the cart still completes cleanly. Check by running on your laptop with the volume up; the driver is only heard on real hardware.",
  { source: 'carts/cart-maker-3-music/arpeggio.scm', tags: ['music', 'headless', 'audio-driver', 'troubleshooting'] },
))

// ── Cart 4: chord-progression ──────────────────────────────────────
const chords = read('chord-progression.scm')

pairs.push(pair(
  "Write a Motoi cart that plays I-IV-V-I in C major.",
  "```scheme\n" + chords + "```",
  { source: 'carts/cart-maker-3-music/chord-progression.scm', tags: ['music', 'chord-progression', 'chord-verb'] },
))

pairs.push(pair(
  "How is `chord` different from `melody` or `note` in Motoi?",
  "`(note pitch dur vel)` plays one pitch. `(melody notes dur vel)` walks a list of pitches one at a time, note after note. `(chord notes dur vel)` mixes all the pitches into a single sample-accurate WAV so the attack lands together — up to 16 voices at once. Use `chord` when you want harmony to strike; use `melody` when you want a run; use `note` when you're driving the timing yourself.",
  { source: 'carts/cart-maker-3-music/chord-progression.scm', tags: ['music', 'chord', 'melody', 'note', 'verb-comparison'] },
))

pairs.push(pair(
  "What are the roman-numeral chords in C major?",
  "The seven diatonic triads:\n\n```\nI    C  major   C4 E4 G4\nii   D  minor   D4 F4 A4\niii  E  minor   E4 G4 B4\nIV   F  major   F3 A3 C4\nV    G  major   G3 B3 D4\nvi   A  minor   A3 C4 E4\nvii° B  dim     B3 D4 F4\n```\n\nUppercase = major, lowercase = minor, ° = diminished. I-IV-V is the pop cadence; ii-V-I is the jazz cadence. Both resolve to I (the tonic).",
  { source: 'carts/cart-maker-3-music/chord-progression.scm', tags: ['music', 'theory', 'roman-numerals', 'harmony'] },
))

pairs.push(pair(
  "Why does `chord` mix into one WAV instead of firing several `note` calls?",
  "Because process-spawn latency drifts. Each `note` call fires `afplay` in a subprocess; on macOS that's 30-50ms of startup per note. Four `note` calls in a row would attack four separate times spread across ~200ms — the ear hears a rushed arpeggio, not a chord. `chord` mixes the sample data in-process, writes one WAV, and plays it in one `afplay` call. All voices attack together, drift-free.",
  { source: 'carts/cart-maker-3-music/chord-progression.scm', tags: ['music', 'chord', 'timing', 'internals'] },
))

// ── Cart 5: layered-song ───────────────────────────────────────────
const layered = read('layered-song.scm')

pairs.push(pair(
  "Write a Motoi cart that layers a melody, bass, and drums into one song using the composer.",
  "```scheme\n" + layered + "```",
  { source: 'carts/cart-maker-3-music/layered-song.scm', tags: ['music', 'composer', 'voice-pool', 'layered'] },
))

pairs.push(pair(
  "How do I use `composer/voice-pool` and voice 16 in Motoi?",
  "The voice-pool holds 16 voice slots. Slots 1..15 are individual voices; slot 16 is the mixer. Assign a slot with `composer/voice-assign`, then route several slots into the mixer with `composer/voice-mix-set`:\n\n```scheme\n(define pool\n  (composer/voice-pool :bind '(song :pool) :steal 'oldest))\n\n(composer/voice-assign pool 1 (list :instrument 'lead :pitch 'C4))\n(composer/voice-assign pool 2 (list :instrument 'bass :pitch 'C3))\n(composer/voice-assign pool 3 (list :instrument 'kick))\n\n(composer/voice-mix-set pool '(1 2 3))\n```\n\nNow voice 16 mixes voices 1, 2, and 3. Steal policy `'oldest` means when a 17th note wants to play, the oldest voice yields.",
  { source: 'carts/cart-maker-3-music/layered-song.scm', tags: ['music', 'composer', 'voice-pool', 'voice-assign', 'voice-mix-set'] },
))

pairs.push(pair(
  "What does `song/config` do in Motoi?",
  "It records the top-level song settings — voice count, voice-steal policy, BPM — as a `song-config` record you can pass to a runtime or inspect. Voices greater than 16 clamp to 16 (Motoi Composer v1.1 max) with a warning stored in the record's `:warnings` field.\n\n```scheme\n(song/config :voices 16 :voice-steal 'oldest :bpm 92)\n```\n\nThe returned record is self-documenting; nothing plays until you fire notes through `note`/`chord`/`synth/kit` or hand the emitted form to the audio engine.",
  { source: 'carts/cart-maker-3-music/layered-song.scm', tags: ['music', 'composer', 'song-config'] },
))

pairs.push(pair(
  "What's the difference between `voice/mix` and `voice/compose`?",
  "They're the same verb under two names. Both return a `voice-mix` record with a voice-id list and an optional gain. `voice/compose` matches Alfred's phrasing — 'compose them together' — while `voice/mix` matches DAW terminology. Pick whichever reads more naturally; the runtime treats them identically.\n\n```scheme\n(voice/mix     '(1 2 3) 0.8)\n(voice/compose '(1 2 3) 0.8)   ; same record\n```",
  { source: 'carts/cart-maker-3-music/layered-song.scm', tags: ['music', 'voice-mix', 'voice-compose', 'aliases'] },
))

pairs.push(pair(
  "How do I round-trip a composer canvas through Scheme in Motoi?",
  "`composer/emit` produces the declaration form for a canvas — every widget's kind, options, and state. `composer/apply` reads a form back into an existing canvas and mutates the widgets to match. The round-trip guarantee is:\n\n```scheme\n(composer/apply c (composer/emit c))  ; ≡ c\n```\n\nSo you can save a song to disk as Scheme text, reload it tomorrow, and the voice pool, assignments, and mixer routing all come back exactly as you left them.",
  { source: 'carts/cart-maker-3-music/layered-song.scm', tags: ['music', 'composer', 'emit', 'apply', 'round-trip'] },
))

pairs.push(pair(
  "Motoi is headless — how do I hear my layered song?",
  "Two paths. First, run the cart on a machine with a real audio device (`./bin/motoi run carts/cart-maker-3-music/layered-song.scm`) — the audio driver fires each `note`, `chord`, and `synth/kit` call through the OS mixer as it walks the sequence. Second, hand the `composer/emit` form to a downstream renderer (Curator, a DAW export, or a live Sakura session) that reads the voice-pool routing and produces the mix. The cart runs the same either way; only the audible result differs.",
  { source: 'carts/cart-maker-3-music/layered-song.scm', tags: ['music', 'headless', 'composer', 'render'] },
))

// ── write ──────────────────────────────────────────────────────────

for (const p of pairs) appendFileSync(OUT, p)

console.log(`wrote ${pairs.length} pairs to ${OUT}`)
