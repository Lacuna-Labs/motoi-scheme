;; layered-song.scm — Motoi music cart #5 (melody + bass + drums, composer).
;;
;; :title       "Little Green Room" — a three-voice piece
;; :style       lo-fi study, bass + melody + backbeat
;; :key         C major
;; :bpm         92
;; :meter       4/4
;; :verbs-used  ("song/config" "composer/canvas" "composer/voice-pool"
;;               "composer/voice-assign" "composer/voice-mix-set"
;;               "voice/mix" "voice/compose" "composer/emit"
;;               "composer/render-tui" "note" "chord" "synth/kit")
;; :audio-mode  hybrid                ; declares the song via composer
;;                                    ; then walks the sequence with note/chord/synth-kit.
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-3-music/layered-song.scm
;;
;; This is what a full Motoi song looks like:
;;
;;   1. song/config declares BPM + voice budget (16 voices, oldest-steal).
;;   2. composer/canvas holds a voice-pool widget.
;;   3. voices are assigned:  1=lead melody  2=bass  3=kick  4=snare  5=hat.
;;   4. voice-16 (the mixer) taps all five together.
;;   5. The composer/emit round-trips the whole song to a Scheme form.
;;   6. Then we walk the sequence with raw note/chord/synth-kit calls so
;;      the audio driver actually schedules the pitches. (Composer
;;      round-trip proves the SHAPE; the walk proves the SOUND.)
;;
;; Two-bar cell repeats twice = four bars total. Structure per bar:
;;
;;   step:    1  2  3  4  5  6  7  8   (eighth notes)
;;   melody:  E4 -  G4 -  C5 -  G4 -   (a floating figure)
;;   bass:    C3 -  -  -  G3 -  -  -   (root then fifth)
;;   kick:    x  -  -  -  -  -  -  -
;;   snare:   -  -  -  -  x  -  -  -
;;   hat:     x  -  x  -  x  -  x  -

(define BPM       92)
(define EIGHTH    (/ 60.0 BPM 2))    ; one eighth-note in seconds

;; ── song config + voice pool ──────────────────────────────────────

(define cfg (song/config :voices 16 :voice-steal 'oldest :bpm BPM))

(display "song/config → ") (display cfg) (newline)
(newline)

;; A canvas that holds one voice-pool widget. The pool is our
;; polyphony bank; the canvas gives us round-trip.
(define pool
  (composer/voice-pool :bind (quote (song :pool)) :steal (quote oldest)))

(define stage
  (composer/canvas (list :bind (quote (song)))
    pool))

;; Assign our five voices. Voice 6+ stay free (headroom for a listener
;; who wants to add a pad or a lead harmony).
(composer/voice-assign pool 1 (list :instrument (quote lead)   :pitch (quote C4)))
(composer/voice-assign pool 2 (list :instrument (quote bass)   :pitch (quote C3)))
(composer/voice-assign pool 3 (list :instrument (quote kick)))
(composer/voice-assign pool 4 (list :instrument (quote snare)))
(composer/voice-assign pool 5 (list :instrument (quote hat)))

;; Voice 16 (the mixer) sums voices 1..5 into one output stream.
(composer/voice-mix-set pool (list 1 2 3 4 5))

;; voice/mix + voice/compose are aliases — both produce the same record.
;; `voice/compose` matches Alfred's phrasing.
(define mix-record (voice/compose (list 1 2 3 4 5) 0.8))
(display "voice/compose → ") (display mix-record) (newline)
(newline)

;; ── the emit — round-trip through Scheme ─────────────────────────

(display "composer/emit round-trip:") (newline)
(display (composer/emit stage)) (newline)
(newline)

;; ── the actual playback walk ─────────────────────────────────────
;;
;; Two-bar figure. Each bar = 8 eighth-notes. Melody notes lift off on
;; 1/3/5/7; bass hits 1 and 5; drums pattern per top comment.

(define (play-bar bar-num)
  (display "bar ") (display bar-num) (display "  ") (newline)

  ;; Beat 1: kick + hat + bass-C3 + melody E4
  (synth/kit (quote kick))
  (synth/kit (quote hat))
  (note (quote C3) EIGHTH 0.6)
  (note (quote E4) EIGHTH 0.5)

  ;; Beat 2: rest for the ear
  (display "    beat 2 rest") (newline)

  ;; Beat 3: hat + melody G4
  (synth/kit (quote hat))
  (note (quote G4) EIGHTH 0.5)

  ;; Beat 4: rest
  (display "    beat 4 rest") (newline)

  ;; Beat 5: snare + hat + bass-G3 + melody C5
  (synth/kit (quote snare))
  (synth/kit (quote hat))
  (note (quote G3) EIGHTH 0.6)
  (note (quote C5) EIGHTH 0.5)

  ;; Beat 6: rest
  (display "    beat 6 rest") (newline)

  ;; Beat 7: hat + melody G4
  (synth/kit (quote hat))
  (note (quote G4) EIGHTH 0.5)

  ;; Beat 8: rest
  (display "    beat 8 rest") (newline))

(display "Little Green Room — a three-voice piece") (newline)
(display "=======================================") (newline)
(display "BPM ") (display BPM)
(display "  key C major  meter 4/4  4 bars") (newline)
(newline)

(play-bar 1)
(play-bar 2)
(play-bar 3)
(play-bar 4)

;; ── close with a resolving chord ─────────────────────────────────

(newline)
(display "final chord (C major, ringing):") (newline)
(chord (list (quote C4) (quote E4) (quote G4) (quote C5)) (* 2 EIGHTH) 0.5)

(newline)
(display "song complete — 5 voices routed through voice-16 mixer,") (newline)
(display "4 bars walked + one closing tonic chord.") (newline)
