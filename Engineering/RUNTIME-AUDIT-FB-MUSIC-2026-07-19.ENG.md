# Runtime audit — Framebuffer + music verbs

**Date:** 2026-07-19
**Author:** Zane
**Scope:** what a Motoi 5.0 demo author can reach at `./bin/motoi eval`, and what they can't. Verified by running every claim.

## 1. Full FB verb inventory (verified bound)

Draw + framebuffer verbs, cited to file:line.

**Canonical draw verbs — `lib/media/media.js`:**
- `clear` (media.js:175), takes optional color
- `circle` (media.js:200)
- `disc` (media.js:207)
- `line` (media.js:214)
- `rect` (media.js:225)
- `rect-fill` (media.js:233)
- `plot` (media.js:240) — series-plot, not per-pixel
- `pset` (media.js:249)
- `pget` (media.js:288)
- `flower/paint` (media.js:282)

**Beginner aliases — `lib/media/media.js:265-272` (from 2026-07-19 pass):**
- `rectangle`, `draw-rect` → rect
- `fill-rect`, `filled-rectangle` → rect-fill
- `pixel`, `put-pixel`, `set-pixel!`, `plot-pixel` → pset

**New this audit — `lib/media/media.js:277-279`:**
- `background`, `bg-clear` → clear

**Framebuffer lifecycle — `lib/graphics/framebuffer-verbs.js`:**
- `surface-exists?` (:62), `pixels-wide` (:68), `pixels-tall` (:74)
- `viewport` (:80), `viewport-width` (:87), `cols` (:94), `rows` (:100)
- `clear-surface-layer` (:106)
- `begin-frame` (:114), `end-frame` (:127), `after-frame` (:142)
- `on-canvas-trace` (:150), `measure-content` (:154)
- `text/draw` (:169), and new **`draw-text`** (:170) — both alias `fb/text` from `lib/graphics/text.js`

**Mode / palette — `lib/media/media.js`:**
- `set-mode` (:146), `set-color` (:158), `get-color` (:164), `mode-info` (:167)
- `set-color` accepts numeric index OR HTML named-color symbol (verified: `(set-color 'red)` → `8`).
- `color/named`, `color/name-of`, `color/palette-html-16` from `composer-v11.js:325-336`.

**Render / snapshot — media.js:**
- `render` (:312), `framebuffer` (:328), `fb-snapshot` (:319), `fb-restore` (:334)

## 2. Full audio / music verb inventory (verified bound)

**Core one-shot audio — `lib/media/media.js`:**
- `tone` (:366) — freq + dur
- `note` (:376) — pitch symbol/MIDI + dur + vel
- `chord` (:398) — list of pitches, single WAV
- `melody` (:413) — sequence, single WAV
- `sfx` (:426) — synthesized effect
- `music` (:439), `silence` (:444), `stop-sound` (:449)

**Namespaced audio — `lib/audio/audio-verbs.js`:**
- `audio/play` (:37), `audio/halt` (:62), `audio/playing?` (:69)
- `audio/master-volume` (:75), `audio/tempo` (:81)
- `note/strike` (:88), `note/release` (:98), `note/place-at` (:101)
- `synth/play` (:117), `synth/chord` (:131), `synth/kit` (:145)

**Beat-relative oscillators — `lib/audio/tick.js`:**
- `tick/sine` (:12), `tick/osc` (:15), `tick/pulse` (:18), `tick/ease` (:25), `tick/phase` (:31)

**Scheduler + tempo — `lib/game/scheduler.js`:**
- `on-tick` (:58), `cancel-tick` (:66), `after` (:69), `wait` (:77 — tagged clause, does NOT block)
- `at-beat` (:83), `beat/on` (:86) — alias
- `across-beats` (:89), `land-on-downbeat` (:93), `sub-position-per-beat` (:96), `arc-between` (:102)
- `tempo` (:105)

**Composer voices — `lib/composer/composer-v11.js:303-322`:**
- `song/config`, `composer/voice-pool`, `voice/mix`, `voice/compose`, `composer/voice-assign`, `composer/voice-mix-set`
- Plus `composer/piano-roll` (composer.js:1046), `composer/adsr` (:1050), `composer/instrument-picker` (:1051), `composer/fx-chain` (:1052).

## 3. Composition patterns that work TODAY (verified)

- **Frame loop:** `(on-frame (lambda (f) (clear) (circle 40 40 (+ 10 (modulo f 20))) (render)))` — installs a single frame handler (media.js:463); overrides earlier handler; loop auto-starts (`ensureRunning`).
- **Manual step:** `(begin-frame) (disc 40 40 15) (end-frame)` — populates `(on-canvas-trace)` and `(measure-content)`.
- **Palette-driven draw:** `(set-color 'crimson) (rect-fill 10 10 20 20)` — 16 HTML color names verified via `(color/palette-html-16)`.
- **Sequenced note play:** `(tone 440 0.25)`, `(note 'A4 0.5)`, `(melody '(60 62 64) 0.2)`, `(chord '(60 64 67) 0.5)` — all fire through `lib/audio/audio-driver.js` (afplay/aplay).
- **Tempo-anchored math:** `(tick/sine (tick/phase (time/now) 500))` — pure math, no audio state; use to drive draw params.
- **Input:** `(on-key f)`, `(on-mouse f)`, `(on-gamepad f)`, `(fire-key 'space)` for testing.
- **Timing:** `(sleep 0.5)` blocks (media.js:515, capped at 5s). `(after 1000 fn)` schedules a JS-time one-shot (scheduler.js:69). `(time/every-ms 500 body)` for wall-clock cadence.
- **State snapshot:** `(save-cart "demo.sks")` / `(load-cart "demo.sks")` — sandboxed to `~/.motoi/carts/` (media.js:589).

## 4. Gap list — verified unbound

Verified via `(procedure? <verb>)`. Every entry below returned `error: unbound symbol: <verb>`:

- `beat` (bare — only `beat/on` exists)
- `song` (bare — only `song/config` exists)
- `piano`, `piano-key`, `drum`, `kick`, `snare` (no bare percussion / instrument verbs)
- `set-tempo` (canonical form is `(tempo bpm)` — same call site sets BPM)
- `print`, `println`, `show`, `reveal` (R7RS `display` + `newline` present; no aliases)
- `wait-ms`, `sleep-ms` (only `sleep` seconds and scheduler's non-blocking `wait` clause)

**Note on `wait`:** `(wait ms)` returns a tagged clause — it does NOT block. This is documented in `scheduler.js:8-14` but is a foot-gun for a demo author expecting a synchronous pause. Doctrine says no signature changes to existing verbs — flagged for Alfred rather than silently redefined.

## 5. Fix list — additive wiring landed this pass

Three aliases wired (no signature changes, no renames):

- `background` → `clear` — `lib/media/media.js:278`
- `bg-clear` → `clear` — `lib/media/media.js:279`
- `draw-text` → `fb/text` — `lib/graphics/framebuffer-verbs.js:170`

All three take the exact args of the underlying verb (same JS function reference, not a shim). Verified via `./bin/motoi eval`:
- `(background 3) (pget 5 5)` → `3`
- `(bg-clear 7) (pget 5 5)` → `7`
- `(begin-frame) (draw-text "hi" 5 5)` → OK

`npm test` — **605 pass / 0 fail** after edits.

## 6. Watchlist

`/tmp/frames-buffered-missing-verbs.txt` was not present at audit time. Nothing to check against.

## STILL MISSING — needs Alfred call

- **`beat` bare form.** No obvious deterministic mapping. Options: (a) return current beat-clock counter, (b) install handler like `beat/on`, (c) leave unbound. Needs decision — not a mechanical alias.
- **`song` bare form.** Same shape as above.
- **`wait-ms` vs `wait` collision.** Scheme `wait` returns a tagged clause; a demo author saying "wait 500ms" expects a block. Signature change to `wait` is forbidden per core freeze. Could add `sleep-ms` as blocking millisecond form — but Alfred should decide whether kids should ever busy-loop.
- **Percussion verbs (`kick`, `snare`, `hat`).** `synth/kit` internally maps these names to freqs (`audio-verbs.js:149`). Whether to expose `(kick)` / `(snare)` as bare verbs vs teaching `(synth/kit 'kick)` is a pedagogy call.
- **`print`.** Trivially aliasable to `display` + newline. Not landed because R7RS purity concern — Alfred call.
