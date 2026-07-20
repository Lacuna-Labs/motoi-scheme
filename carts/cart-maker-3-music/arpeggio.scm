;; arpeggio.scm — Motoi music cart #3 (broken-chord arpeggio).
;;
;; :title       "Am — F — C — G ascending arpeggio"
;; :style       broken chord / study
;; :key         A minor / C major (parallel)
;; :bpm         110
;; :meter       4/4
;; :verbs-used  ("note" "for-each" "define" "list" "map" "append" "quote")
;; :audio-mode  raw-sequencing
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-3-music/arpeggio.scm
;;
;; An arpeggio walks a chord's tones one at a time, up (or up-and-down).
;; Classic beginner shape: root, third, fifth, octave — the shape of a
;; triad laid out horizontally in time instead of stacked in one hit.
;;
;; Progression is the sad-then-hopeful loop familiar to every pop song:
;;   Am → F → C → G → back to Am.
;;
;; Each chord arpeggiates as: root, 3rd, 5th, oct, 5th, 3rd — a six-note
;; "up-and-down" figure. Six notes × four chords = 24 notes per cycle.

(define BPM       110)
(define STEP-DUR  (/ 60.0 BPM 4))    ; sixteenth-note in seconds
(define VEL       0.55)

;; Each chord is a list of six pitches — root/3rd/5th/oct then back down.
;; A minor:  A3 C4 E4 A4 E4 C4
;; F major:  F3 A3 C4 F4 C4 A3
;; C major:  C4 E4 G4 C5 G4 E4
;; G major:  G3 B3 D4 G4 D4 B3

(define arp-Am (list 'A3 'C4 'E4 'A4 'E4 'C4))
(define arp-F  (list 'F3 'A3 'C4 'F4 'C4 'A3))
(define arp-C  (list 'C4 'E4 'G4 'C5 'G4 'E4))
(define arp-G  (list 'G3 'B3 'D4 'G4 'D4 'B3))

;; Play one arpeggio: six notes at STEP-DUR each.
(define (play-arp label pitches)
  (display "  ") (display label) (display ":  ")
  (for-each
    (lambda (p)
      (display p) (display " ")
      (note p STEP-DUR VEL))
    pitches)
  (newline))

;; One full cycle of the progression.
(define (play-cycle n)
  (display "cycle ") (display n) (display " -----") (newline)
  (play-arp "Am" arp-Am)
  (play-arp "F " arp-F)
  (play-arp "C " arp-C)
  (play-arp "G " arp-G))

(display "Arpeggio Study — Am F C G") (newline)
(display "=========================") (newline)
(display "BPM ") (display BPM)
(display "  step ") (display STEP-DUR) (display "s") (newline)
(display "shape per chord: root 3rd 5th octave 5th 3rd (up-and-down)") (newline)
(newline)

;; Two cycles = 48 notes.
(play-cycle 1)
(play-cycle 2)

(newline)
(display "arpeggio complete — 48 notes over 2 cycles.") (newline)
