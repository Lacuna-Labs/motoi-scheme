;; catch-the-ball.scm
;; Motoi Cart — Games Lane 2026-07-19
;;
;; (cart
;;   :name            "catch-the-ball"
;;   :category        :game
;;   :sub-category    :arcade
;;   :audience        :kid
;;   :complexity      1
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Falling balls, moving catcher, score. 8-tick simulation."
;;   :verbs-used      ("set-mode" "clear" "set-color" "begin-frame" "end-frame"
;;                     "disc" "rect-fill" "draw-rect" "plot-pixel" "line"
;;                     "display" "newline" "randint")
;;   :aliases-used    ("draw-rect" "plot-pixel")
;;   :inspiration     "Kaboom! Activision, 1981. The Mad Bomber lobbing bombs to your buckets.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-2-games/catch-the-ball.scm
;;
;; A ball falls; a catcher slides beneath it; if the ball hits the
;; catcher's rectangle we score. Otherwise the ball resets to the top
;; at a new column and the run continues. Bounded 8-tick demo.
;;
;; Aliases: `draw-rect` (== rect) and `plot-pixel` (== pset).

(set-mode 128 96)

(define BALL-X 30)
(define BALL-Y 0)
(define BALL-VY 12)

(define CATCHER-X 50)
(define CATCHER-Y 84)
(define CATCHER-W 28)
(define CATCHER-H 6)

(define SCORE 0)
(define MISSED 0)

;; ------- helpers -------
(define (catch?)
  (and (>= BALL-Y CATCHER-Y)
       (>= BALL-X CATCHER-X)
       (< BALL-X (+ CATCHER-X CATCHER-W))))

(define (reset-ball!)
  (set! BALL-X (randint 8 120))
  (set! BALL-Y 0))

(define (chase-catcher!)
  (let ((center (+ CATCHER-X (quotient CATCHER-W 2))))
    (cond
      ((< BALL-X (- center 4)) (set! CATCHER-X (- CATCHER-X 6)))
      ((> BALL-X (+ center 4)) (set! CATCHER-X (+ CATCHER-X 6))))
    (when (< CATCHER-X 0) (set! CATCHER-X 0))
    (when (> CATCHER-X (- 128 CATCHER-W))
      (set! CATCHER-X (- 128 CATCHER-W)))))

(define (tick!)
  (chase-catcher!)
  (set! BALL-Y (+ BALL-Y BALL-VY))
  (cond
    ((catch?)
     (set! SCORE (+ SCORE 1))
     (reset-ball!))
    ((>= BALL-Y 96)
     (set! MISSED (+ MISSED 1))
     (reset-ball!))))

;; ------- draw -------
(define (draw!)
  (clear 0)
  ;; ground line via `line` verb
  (set-color 5)
  (line 0 94 127 94)
  ;; catcher via `draw-rect` alias (outline) then rect-fill inside
  (set-color 11)
  (draw-rect CATCHER-X CATCHER-Y CATCHER-W CATCHER-H)
  (rect-fill (+ CATCHER-X 1) (+ CATCHER-Y 1) (- CATCHER-W 2) (- CATCHER-H 2))
  ;; ball
  (set-color 8)
  (disc BALL-X BALL-Y 3)
  ;; sparkle above the ball via `plot-pixel` alias
  (plot-pixel BALL-X (- BALL-Y 5) 7))

;; ------- driver -------
(display "CATCH THE BALL — 8-tick demo") (newline)
(display "=============================") (newline)
(display "  Ball falls, catcher slides. Score = catches, Missed = drops.") (newline)
(newline)

(let loop ((t 0))
  (when (< t 8)
    (begin-frame)
    (draw!)
    (tick!)
    (end-frame)
    (display "  frame=") (display t)
    (display "  ball=(") (display BALL-X) (display ",") (display BALL-Y) (display ")")
    (display "  catcher-x=") (display CATCHER-X)
    (display "  score=") (display SCORE)
    (display "  missed=") (display MISSED)
    (newline)
    (loop (+ t 1))))

(newline)
(display "  DEMO ENDED — 8 frames simulated cleanly.") (newline)
(display "  final: caught ") (display SCORE)
(display ", missed ") (display MISSED) (newline)
(display "  Fork: speed up BALL-VY, add multiple balls, add scoring bonuses.") (newline)
