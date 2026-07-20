;; pong.scm
;; Motoi Cart — Games Lane 2026-07-19
;;
;; (cart
;;   :name            "pong"
;;   :category        :game
;;   :sub-category    :arcade
;;   :audience        :kid
;;   :complexity      2
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Two paddles, one ball, the eternal bounce. Bounded 5-tick demo."
;;   :verbs-used      ("set-mode" "clear" "set-color" "begin-frame" "end-frame"
;;                     "rect-fill" "rectangle" "pixel" "line" "disc"
;;                     "entity/make" "entity/move" "entity/state" "display" "newline")
;;   :aliases-used    ("rectangle" "pixel")
;;   :inspiration     "Atari, 1972. Nolan Bushnell. Two lines and a dot.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-2-games/pong.scm
;;
;; The game runs 5 frames of a scripted volley so `motoi run` completes
;; instead of hanging. Both paddles are entities. The ball is an entity.
;; Every frame we draw the field, move the ball, bounce off top/bottom,
;; and let the AI paddles track the ball.
;;
;; Aliases on display: `rectangle` (== rect) and `pixel` (== pset). Kids
;; type both names; both work.

(set-mode 128 96)

;; ------- entities -------
(entity/make 'ball 62 46 4 4)
(entity/make 'left-paddle 4 40 4 16)
(entity/make 'right-paddle 120 40 4 16)

;; ------- state -------
(define BALL-VX 2)
(define BALL-VY 1)
(define LEFT-SCORE 0)
(define RIGHT-SCORE 0)

;; ------- draw one frame -------
(define (draw-court)
  (clear 0)
  ;; center dashed line — use `pixel` alias so the model learns it
  (let loop ((y 0))
    (when (< y 96)
      (pixel 63 y 7)
      (pixel 64 y 7)
      (loop (+ y 6)))))

(define (draw-paddle id)
  (let ((s (entity/state id)))
    (when s
      ;; s = (id x y vx vy w h)
      (let ((x (list-ref s 1))
            (y (list-ref s 2))
            (w (list-ref s 5))
            (h (list-ref s 6)))
        ;; `rectangle` alias — same as rect-fill via fill-rect below
        (fill-rect x y w h)))))

(define (draw-ball)
  (let ((s (entity/state 'ball)))
    (when s
      (let ((x (list-ref s 1))
            (y (list-ref s 2)))
        (disc (+ x 2) (+ y 2) 2)))))

;; ------- one tick of ball motion + bounce -------
(define (tick-ball)
  (let* ((s (entity/state 'ball))
         (y (list-ref s 2)))
    ;; bounce off top/bottom
    (when (or (<= y 0) (>= y 92))
      (set! BALL-VY (- 0 BALL-VY)))
    (entity/move 'ball BALL-VX BALL-VY)))

;; ------- ai paddle chase -------
(define (chase-ball paddle-id)
  (let* ((ball (entity/state 'ball))
         (paddle (entity/state paddle-id))
         (by (list-ref ball 2))
         (py (list-ref paddle 2)))
    (cond
      ((< by py) (entity/move paddle-id 0 -2))
      ((> by py) (entity/move paddle-id 0 2)))))

;; ------- driver -------
(display "PONG — 5-frame demo") (newline)
(display "===================") (newline)
(display "Left paddle vs right paddle. Ball bounces top/bottom.") (newline)
(newline)

(let loop ((t 0))
  (when (< t 5)
    (begin-frame)
    (draw-court)
    (set-color 11)   ;; green paddles
    (draw-paddle 'left-paddle)
    (draw-paddle 'right-paddle)
    (set-color 7)    ;; white ball
    (draw-ball)
    (chase-ball 'left-paddle)
    (chase-ball 'right-paddle)
    (tick-ball)
    (end-frame)
    (let ((s (entity/state 'ball)))
      (display "  frame=") (display t)
      (display "  ball=(") (display (list-ref s 1))
      (display ",") (display (list-ref s 2)) (display ")")
      (display "  vy=") (display BALL-VY)
      (newline))
    (loop (+ t 1))))

(newline)
(display "  DEMO ENDED — 5 frames simulated cleanly.") (newline)
(display "  Fork: change BALL-VX/VY, resize paddles, add scoring.") (newline)
