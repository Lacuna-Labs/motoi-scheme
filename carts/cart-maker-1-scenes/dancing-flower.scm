;; Scene: Dancing Flower
;; Author: Motoi Cart Maker 1 (Scenes) · 2026-07-19
;; What it draws: A single flower with six coral petals around a gold center, on a green stem with two leaves, gently swaying frame by frame. Draws 6 frames of animation deterministically via tick-frame.
;; Verbs used: set-mode, clear, set-color, disc, circle, rect-fill, line, put-pixel, plot-pixel, on-frame, tick-frame, stop, begin-frame, end-frame, render

;; A flower has a stem going up, leaves branching off, and petals
;; arranged around a center. To animate, we tilt the whole flower
;; a little based on the frame number. sine would be smoother but
;; a simple triangle wave is easier to read and deterministic.

(set-mode 80 80)

;; Triangle-wave sway: takes frame count, returns a small integer
;; offset the head leans by. Cycles every 8 frames, amplitude 3.
(define (sway n)
  (let ((phase (modulo n 8)))
    (cond
      ((< phase 2) phase)
      ((< phase 4) (- 4 phase))
      ((< phase 6) (- 4 phase))
      (else (- phase 8)))))

(define (draw-flower frame)
  (clear)
  (begin-frame)

  ;; Sky
  (set-color 'skyblue)
  (rect-fill 0 0 80 80)

  ;; Sun
  (set-color 'gold)
  (disc 66 14 5)

  ;; Ground
  (set-color 'mediumseagreen)
  (rect-fill 0 66 80 14)

  ;; Stem — a vertical line from ground to just below head
  (set-color 'forestgreen)
  (line 40 66 40 40)
  (line 41 66 41 40)  ; two lines side by side = thicker stem

  ;; Leaves — a filled triangle-ish shape on each side, static
  (set-color 'mediumseagreen)
  (disc 34 55 3)
  (disc 46 50 3)
  ;; leaf veins
  (set-color 'forestgreen)
  (line 32 55 36 55)
  (line 44 50 48 50)

  ;; Head position — swayed by the frame
  (define dx (sway frame))
  (define cx (+ 40 dx))
  (define cy 32)

  ;; Petals — six discs around the center, coral colored
  (set-color 'coral)
  (disc (- cx 6) cy 4)              ; left
  (disc (+ cx 6) cy 4)              ; right
  (disc (- cx 4) (- cy 5) 4)        ; upper-left
  (disc (+ cx 4) (- cy 5) 4)        ; upper-right
  (disc (- cx 4) (+ cy 5) 4)        ; lower-left
  (disc (+ cx 4) (+ cy 5) 4)        ; lower-right

  ;; A ring of pink on top of the coral for a two-tone petal look
  (set-color 'pink)
  (disc (- cx 6) cy 2)
  (disc (+ cx 6) cy 2)
  (disc (- cx 4) (- cy 5) 2)
  (disc (+ cx 4) (- cy 5) 2)
  (disc (- cx 4) (+ cy 5) 2)
  (disc (+ cx 4) (+ cy 5) 2)

  ;; Center — gold disc with a brown outline
  (set-color 'gold)
  (disc cx cy 4)
  (set-color 'sienna)
  (circle cx cy 4)

  ;; A tiny bee, one pixel, hovers near the flower — a delight beat.
  ;; Alias check: plot-pixel is the same as pset.
  (set-color 'black)
  (plot-pixel (+ cx 12) (- cy 3))
  (put-pixel  (+ cx 12) (- cy 4))
  (set-color 'gold)
  (put-pixel  (+ cx 12) (- cy 3))

  (end-frame))

;; Hook the animation loop. tick-frame advances one frame at a time
;; without waiting for wall-clock — so the cart finishes fast in CI
;; but still records a real animation.
(on-frame draw-flower)

(define (run-frames n)
  (if (> n 0)
      (begin (tick-frame) (run-frames (- n 1)))
      #f))

(run-frames 6)
(stop)
(render)
(display "Dancing Flower — 6 frames rendered.")
(newline)
