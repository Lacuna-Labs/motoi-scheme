;; twinkle-melody.scm — Motoi music cart #1 (simple melody).
;;
;; :title       "Twinkle Twinkle Little Star"
;; :style       lullaby / nursery-tune
;; :key         C major
;; :bpm         100
;; :meter       4/4
;; :verbs-used  ("note" "for-each" "define" "list" "quote" "display" "newline")
;; :audio-mode  raw-sequencing        ; uses `note` verb directly
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-3-music/twinkle-melody.scm
;;
;; A recognizable tune the ear can name inside two bars.
;; Twinkle-Twinkle is:  C C G G A A G  |  F F E E D D C
;; Then the "up above" phrase: G G F F E E D  |  G G F F E E D
;; Then the whole first line again as a bookend.
;;
;; The runtime is headless — sound driver may or may not produce audio depending
;; on platform. What runs deterministically is the note-sequence itself: each
;; `(note 'X4 dur vel)` call completes cleanly and (on macOS with afplay)
;; will actually play a pitched tone via the audio driver.

(define BPM       100)
(define BEAT      (/ 60.0 BPM))     ; one quarter-note in seconds
(define Q         BEAT)             ; quarter-note
(define H         (* 2 BEAT))       ; half-note
(define VEL       0.6)              ; comfortable velocity

;; Phrases as (pitch duration) pairs. Pitch is a Scheme symbol Motoi
;; parses as a note name; duration is seconds.

(define phrase-1
  (list
    (list 'C4 Q) (list 'C4 Q) (list 'G4 Q) (list 'G4 Q)
    (list 'A4 Q) (list 'A4 Q) (list 'G4 H)
    (list 'F4 Q) (list 'F4 Q) (list 'E4 Q) (list 'E4 Q)
    (list 'D4 Q) (list 'D4 Q) (list 'C4 H)))

(define phrase-2  ;; "up above the world so high"
  (list
    (list 'G4 Q) (list 'G4 Q) (list 'F4 Q) (list 'F4 Q)
    (list 'E4 Q) (list 'E4 Q) (list 'D4 H)
    (list 'G4 Q) (list 'G4 Q) (list 'F4 Q) (list 'F4 Q)
    (list 'E4 Q) (list 'E4 Q) (list 'D4 H)))

;; Play a phrase note-by-note. `note` is a fire-and-forget verb; the
;; audio driver schedules each pitch in the OS-level mixer.

(define (play-phrase p label)
  (display "  phrase: ") (display label) (newline)
  (for-each
    (lambda (pair)
      (let ((pitch (car pair))
            (dur   (car (cdr pair))))
        (display "    ") (display pitch) (display " ")
        (display dur) (newline)
        (note pitch dur VEL)))
    p))

(display "Twinkle Twinkle Little Star") (newline)
(display "=========================") (newline)
(display "BPM ") (display BPM)
(display "  key C major  meter 4/4") (newline)
(newline)

(play-phrase phrase-1 "C C G G A A G  F F E E D D C")
(play-phrase phrase-2 "G G F F E E D  G G F F E E D")
(play-phrase phrase-1 "C C G G A A G  F F E E D D C   (reprise)")

(newline)
(display "melody complete — 42 notes across three phrases.") (newline)
