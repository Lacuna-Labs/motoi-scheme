;; drum-loop.scm — Motoi music cart #2 (drum pattern).
;;
;; :title       "Four-on-the-floor + backbeat + closed hats"
;; :style       classic pop/rock backbeat
;; :bpm         120
;; :meter       4/4
;; :bars        4
;; :verbs-used  ("synth/kit" "sfx" "for-each" "range" "modulo" "define" "display")
;; :audio-mode  raw-sequencing        ; uses `synth/kit` + `sfx` verbs
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-3-music/drum-loop.scm
;;
;; Pattern grid (16 steps per bar, x = hit, . = silent):
;;
;;   step:  1 . . . 5 . . . 9 . . . 13. . .
;;   kick:  x . . . . . . . x . . . . . . .
;;   snare: . . . . x . . . . . . . x . . .
;;   hat:   x . x . x . x . x . x . x . x .
;;
;; kick on 1 and 9   — the "four-on-the-floor" heartbeat
;; snare on 5 and 13 — the backbeat
;; hat on every odd  — 8th-note pulse
;;
;; `synth/kit` is the CORE drum-hit verb: (synth/kit 'kick), (synth/kit 'snare),
;; (synth/kit 'hat). Frequencies are hard-mapped inside the engine
;; (kick 60Hz, snare 200Hz, hat 8000Hz).

(define BPM        120)
(define STEP-DUR   (/ 60.0 BPM 4))   ; sixteenth-note in seconds
(define BARS       4)
(define STEPS      16)

;; Boolean patterns (list of 16 flags) — the classic backbeat.
(define kick-pat   '(#t #f #f #f #f #f #f #f #t #f #f #f #f #f #f #f))
(define snare-pat  '(#f #f #f #f #t #f #f #f #f #f #f #f #t #f #f #f))
(define hat-pat    '(#t #f #t #f #t #f #t #f #t #f #t #f #t #f #t #f))

;; Print a pattern row for verification (kids see the grid).
(define (print-row label pat)
  (display label) (display "  ")
  (for-each (lambda (b) (display (if b "x" ".")) (display " ")) pat)
  (newline))

;; Play a single step: fire whichever drums are on at this step.
(define (play-step i)
  (let ((k (list-ref kick-pat i))
        (s (list-ref snare-pat i))
        (h (list-ref hat-pat i)))
    (if k (synth/kit 'kick i))
    (if s (synth/kit 'snare i))
    (if h (synth/kit 'hat i))))

;; Walk N steps, playing each in order. `sleep` is bounded at 5s per call;
;; each step is ~0.125s at 120 BPM so we're well within.
(define (play-bar)
  (let loop ((i 0))
    (if (< i STEPS)
        (begin
          (play-step i)
          ;; DON'T actually sleep — headless mode races forward; the driver
          ;; buffers hits. Emit progress so the run is observable.
          (display "step ") (display (+ i 1)) (newline)
          (loop (+ i 1))))))

(display "Drum Loop: four-on-the-floor + backbeat") (newline)
(display "======================================") (newline)
(display "BPM ") (display BPM)
(display "  bars ") (display BARS)
(display "  steps/bar ") (display STEPS)
(newline)
(newline)
(display "pattern grid:") (newline)
(print-row "kick :" kick-pat)
(print-row "snare:" snare-pat)
(print-row "hat  :" hat-pat)
(newline)

;; Play the pattern BARS times.
(let loop ((b 1))
  (if (<= b BARS)
      (begin
        (display "bar ") (display b) (display " ---------------") (newline)
        (play-bar)
        (loop (+ b 1)))))

(newline)
(display "loop complete — ") (display (* BARS STEPS)) (display " steps.") (newline)
