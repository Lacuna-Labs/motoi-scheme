;; Scene: Lighthouse at Night
;; Author: Motoi Cart Maker 1 (Scenes) · 2026-07-19
;; What it draws: A striped lighthouse on a rocky cliff sweeping a beam of gold light across a dark sea, with a crescent moon overhead, stars, and choppy waves reflecting the beam. Animated: the beam sweeps across 6 frames.
;; Verbs used: set-mode, clear, set-color, rect-fill, filled-rectangle, fill-rect, rectangle, rect, disc, circle, line, pset, pixel, put-pixel, on-frame, tick-frame, stop, begin-frame, end-frame, render

;; A lighthouse scene is fun because it's got two moods stacked:
;; the moody nightscape (dark blue, sparse stars, a moon) and the
;; warm beacon cutting through it. The beacon animation is the
;; whole reason the scene has motion — everything else stays put.

(set-mode 80 80)

;; The beam sweeps in a range of x-endpoints on the horizon line.
;; Frame N controls where the beam lands. We use a simple bounce
;; between two x values so it looks like a real rotating light.
(define (beam-end frame)
  (let ((cycle (modulo frame 12)))
    (if (< cycle 6)
        (+ 2 (* cycle 12))         ; sweep left→right
        (+ 2 (* (- 12 cycle) 12)))))  ; sweep right→left

(define (draw-frame frame)
  (clear)
  (begin-frame)

  ;; --- night sky (deep navy) ------------------------------------
  (set-color 'navy)
  (rect-fill 0 0 80 55)

  ;; --- stars ---------------------------------------------------
  (set-color 'white)
  (pset 6 6) (pset 14 4) (pset 24 10) (pset 32 3)
  (pset 44 8) (pset 54 5) (pset 62 12) (pset 72 6)
  (pset 8 20) (pset 20 24) (pset 36 22) (pset 58 22) (pset 74 20)
  (pixel 42 15) (pixel 42 16)   ; a brighter star

  ;; --- crescent moon (upper right) ------------------------------
  ;; Draw a gold disc, then a navy disc offset a bit to carve
  ;; the crescent shape out of it.
  (set-color 'gold)
  (disc 66 14 6)
  (set-color 'navy)
  (disc 68 12 5)

  ;; --- sea (choppy dark water) ----------------------------------
  (set-color 'navy)
  (rect-fill 0 55 80 25)
  (set-color 'teal)
  (rect-fill 0 60 80 20)
  ;; a lighter horizon band
  (set-color 'mediumseagreen)
  (line 0 55 80 55)

  ;; --- wave crests (little zigzags) -----------------------------
  (set-color 'skyblue)
  (line 0 62 4 61)   (line 4 61 8 62)   (line 8 62 12 61)
  (line 12 61 16 62) (line 16 62 20 61) (line 20 61 24 62)
  (line 24 62 28 61) (line 28 61 32 62) (line 32 62 36 61)
  (line 36 61 40 62) (line 40 62 44 61) (line 44 61 48 62)
  (line 48 62 52 61) (line 52 61 56 62) (line 56 62 60 61)
  (line 60 61 64 62) (line 64 62 68 61) (line 68 61 72 62)
  (line 72 62 76 61) (line 76 61 80 62)
  ;; a second row of shorter crests
  (set-color 'white)
  (pset 6 66) (pset 18 68) (pset 30 66) (pset 46 68) (pset 60 66) (pset 72 68)

  ;; --- rocky cliff on the right (where the lighthouse sits) -----
  (set-color 'saddlebrown)
  (rect-fill 46 48 34 12)
  (set-color 'sienna)
  (disc 48 50 3)
  (disc 74 52 4)
  ;; grass tuft
  (set-color 'forestgreen)
  (pset 52 47) (pset 53 46) (pset 68 47)

  ;; --- lighthouse body (striped tower) --------------------------
  ;; Base is wider than the top. Two thin trapezoid-ish rects will
  ;; look enough like taper at 80x80.
  (set-color 'white)
  (filled-rectangle 58 22 10 26)   ; tower main
  (set-color 'crimson)
  (fill-rect 58 22 10 4)           ; red stripe near top
  (fill-rect 58 32 10 4)           ; red stripe middle
  (fill-rect 58 42 10 4)           ; red stripe bottom
  ;; a small base plinth
  (set-color 'slategray)
  (rect-fill 56 46 14 3)

  ;; --- lamp room (top of tower) ---------------------------------
  (set-color 'gold)
  (rect-fill 60 16 6 6)
  (set-color 'crimson)
  (rectangle 60 16 6 6)
  ;; roof cap (a little triangle from lines)
  (set-color 'crimson)
  (line 59 16 63 12)
  (line 63 12 67 16)
  (line 59 16 67 16)
  ;; antenna
  (set-color 'black)
  (line 63 12 63 8)
  (pset 63 7)

  ;; --- door on the tower ---------------------------------------
  (set-color 'sienna)
  (rect-fill 61 40 4 6)
  (set-color 'gold)
  (pset 64 43)

  ;; --- beam of light (the animated part) ------------------------
  ;; A wedge from the lamp room out into the night. Two lines
  ;; bracket the wedge; a couple of interior lines fill it in.
  ;; The beam is gold and translucent-feeling — pale peachpuff
  ;; for the outer edges, gold for the core.
  (define target-x (beam-end frame))
  (define lamp-x 63)
  (define lamp-y 19)
  (set-color 'peachpuff)
  (line lamp-x lamp-y target-x 30)
  (line lamp-x lamp-y target-x 32)
  (line lamp-x lamp-y target-x 34)
  (line lamp-x lamp-y target-x 36)
  (line lamp-x lamp-y target-x 38)
  (set-color 'gold)
  (line lamp-x lamp-y target-x 33)
  (line lamp-x lamp-y target-x 35)

  ;; --- reflection on the water (a bright patch under the beam) --
  (set-color 'gold)
  (put-pixel target-x 60)
  (put-pixel (+ target-x 1) 60)
  (put-pixel (- target-x 1) 60)
  (put-pixel target-x 61)
  (set-color 'peachpuff)
  (put-pixel (+ target-x 2) 62)
  (put-pixel (- target-x 2) 62)

  (end-frame))

;; Animate — 6 frames, deterministic tick.
(on-frame draw-frame)
(define (run n)
  (if (> n 0) (begin (tick-frame) (run (- n 1))) #f))
(run 6)
(stop)
(render)
(display "Lighthouse at Night — 6 frames rendered.")
(newline)
