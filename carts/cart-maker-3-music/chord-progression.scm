;; chord-progression.scm — Motoi music cart #4 (I-IV-V-I in C, then ii-V-I).
;;
;; :title       "Two classic progressions"
;; :style       tonal harmony study
;; :key         C major
;; :bpm         96
;; :meter       4/4
;; :verbs-used  ("chord" "for-each" "define" "list" "quote" "display")
;; :audio-mode  raw-sequencing        ; `chord` mixes voices into one WAV
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-3-music/chord-progression.scm
;;
;; Progression 1: I  – IV – V  – I    (C  – F  – G  – C)  the pop cadence
;; Progression 2: ii – V  – I         (Dm – G  – C)       the jazz cadence
;;
;; The `chord` verb is the RIGHT tool here — it mixes all the voices into
;; a single sample-accurate WAV so the attack lands together instead of
;; drifting note-by-note. Compare with `melody`, which plays notes in
;; sequence.
;;
;; Voicings are in root position with the octave doubled at the top so
;; the chord sits comfortably in the ear.

(define BPM      96)
(define WHOLE    (/ 60.0 BPM))       ; a "beat" (quarter) — we play each chord
(define HIT-DUR  (* 2 WHOLE))        ; each chord rings for two beats
(define VEL      0.5)

;; Chord voicings — root, third, fifth, octave.
;; Roman numeral   name    voicing
;;      I           C      C4 E4 G4 C5
;;      IV          F      F3 A3 C4 F4
;;      V           G      G3 B3 D4 G4
;;      ii          Dm     D4 F4 A4 D5

(define chord-I   (list 'C4 'E4 'G4 'C5))
(define chord-IV  (list 'F3 'A3 'C4 'F4))
(define chord-V   (list 'G3 'B3 'D4 'G4))
(define chord-ii  (list 'D4 'F4 'A4 'D5))

;; Play a chord and print what it was.
(define (strike label voicing)
  (display "  ") (display label) (display "  ")
  (display voicing) (newline)
  (chord voicing HIT-DUR VEL))

(display "Chord Progressions in C major") (newline)
(display "=============================") (newline)
(display "BPM ") (display BPM)
(display "  each chord rings ") (display HIT-DUR) (display "s") (newline)
(newline)

(display "Progression 1 (pop cadence):  I → IV → V → I") (newline)
(strike "I  (C) " chord-I)
(strike "IV (F) " chord-IV)
(strike "V  (G) " chord-V)
(strike "I  (C) " chord-I)
(newline)

(display "Progression 2 (jazz cadence): ii → V → I") (newline)
(strike "ii (Dm)" chord-ii)
(strike "V  (G) " chord-V)
(strike "I  (C) " chord-I)
(newline)

(display "progressions complete — 7 chords, 28 voices mixed.") (newline)
