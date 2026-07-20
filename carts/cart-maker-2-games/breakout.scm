;; breakout.scm
;; Motoi Cart — Games Lane 2026-07-19
;;
;; (cart
;;   :name            "breakout"
;;   :category        :game
;;   :sub-category    :arcade
;;   :audience        :kid
;;   :complexity      3
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Paddle, ball, brick grid. 6-tick simulation ends with brick count."
;;   :verbs-used      ("set-mode" "clear" "set-color" "begin-frame" "end-frame"
;;                     "rect-fill" "filled-rectangle" "rect" "rectangle"
;;                     "disc" "line" "display" "newline")
;;   :aliases-used    ("filled-rectangle" "rectangle")
;;   :inspiration     "Atari, 1976. Steve Wozniak's clone-competitor. Bricks all the way down.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-2-games/breakout.scm
;;
;; The brick grid is a list of (x y alive?) triples. On each tick: move
;; ball, bounce off walls + paddle, check brick collisions, remove hit
;; bricks. The paddle tracks the ball. Runs 6 ticks bounded.
;;
;; Alias highlights: `filled-rectangle` (== rect-fill) and `rectangle`
;; (== rect). The renderer uses both so kids see both.

(set-mode 128 96)

(define BALL-X 62)
(define BALL-Y 42)
(define BALL-VX 3)
(define BALL-VY -4)
(define PADDLE-X 52)
(define PADDLE-Y 88)
(define PADDLE-W 24)

;; ------- brick grid -------
;; 5 columns × 3 rows of bricks. Each brick: (x y alive?).
(define BRICK-W 24)
(define BRICK-H 6)

(define BRICKS
  (list
    (list 4   10 #t) (list 30  10 #t) (list 56  10 #t) (list 82  10 #t) (list 108 10 #t)
    (list 4   18 #t) (list 30  18 #t) (list 56  18 #t) (list 82  18 #t) (list 108 18 #t)
    (list 4   26 #t) (list 30  26 #t) (list 56  26 #t) (list 82  26 #t) (list 108 26 #t)))

(define (brick-x b) (list-ref b 0))
(define (brick-y b) (list-ref b 1))
(define (brick-alive? b) (list-ref b 2))

;; ------- collision helpers -------
(define (in-rect? px py x y w h)
  (and (>= px x) (< px (+ x w))
       (>= py y) (< py (+ y h))))

(define (bricks-alive)
  (let loop ((bs BRICKS) (n 0))
    (if (null? bs) n
        (loop (cdr bs) (if (brick-alive? (car bs)) (+ n 1) n)))))

;; Hit-test the ball against all bricks; kill the first hit; bounce vy.
(define (check-brick-hit!)
  (let loop ((bs BRICKS) (acc '()) (hit? #f))
    (cond
      ((null? bs)
       (set! BRICKS (reverse acc)))
      ((and (not hit?) (brick-alive? (car bs))
            (in-rect? BALL-X BALL-Y (brick-x (car bs)) (brick-y (car bs)) BRICK-W BRICK-H))
       (set! BALL-VY (- 0 BALL-VY))
       (loop (cdr bs) (cons (list (brick-x (car bs)) (brick-y (car bs)) #f) acc) #t))
      (else
       (loop (cdr bs) (cons (car bs) acc) hit?)))))

;; ------- physics tick -------
(define (tick!)
  (set! BALL-X (+ BALL-X BALL-VX))
  (set! BALL-Y (+ BALL-Y BALL-VY))
  ;; wall bounce
  (when (or (<= BALL-X 0) (>= BALL-X 126))
    (set! BALL-VX (- 0 BALL-VX)))
  (when (<= BALL-Y 0)
    (set! BALL-VY (- 0 BALL-VY)))
  ;; paddle bounce
  (when (and (>= BALL-Y PADDLE-Y) (< BALL-Y (+ PADDLE-Y 4))
             (>= BALL-X PADDLE-X) (< BALL-X (+ PADDLE-X PADDLE-W)))
    (set! BALL-VY (- 0 BALL-VY)))
  ;; brick check
  (check-brick-hit!)
  ;; paddle AI — chase ball
  (cond
    ((< BALL-X (+ PADDLE-X (quotient PADDLE-W 2))) (set! PADDLE-X (- PADDLE-X 3)))
    (else (set! PADDLE-X (+ PADDLE-X 3))))
  (when (< PADDLE-X 0) (set! PADDLE-X 0))
  (when (> PADDLE-X (- 128 PADDLE-W)) (set! PADDLE-X (- 128 PADDLE-W))))

;; ------- draw -------
(define (draw!)
  (clear 0)
  ;; border via `rectangle` alias
  (set-color 5)
  (rectangle 0 0 128 96)
  ;; bricks via `filled-rectangle` alias
  (let loop ((bs BRICKS) (i 0))
    (when (not (null? bs))
      (let ((b (car bs)))
        (when (brick-alive? b)
          (set-color (+ 8 (modulo i 6)))
          (filled-rectangle (brick-x b) (brick-y b) BRICK-W BRICK-H)))
      (loop (cdr bs) (+ i 1))))
  ;; paddle
  (set-color 11)
  (rect-fill PADDLE-X PADDLE-Y PADDLE-W 4)
  ;; ball
  (set-color 7)
  (disc BALL-X BALL-Y 2))

;; ------- driver -------
(display "BREAKOUT — 6-tick demo") (newline)
(display "======================") (newline)
(display "  Ball bounces, paddle chases, bricks fall.") (newline)
(newline)
(display "  starting bricks: ") (display (bricks-alive)) (newline)
(newline)

(let loop ((t 0))
  (when (< t 6)
    (begin-frame)
    (draw!)
    (tick!)
    (end-frame)
    (display "  frame=") (display t)
    (display "  ball=(") (display BALL-X) (display ",") (display BALL-Y) (display ")")
    (display "  paddle-x=") (display PADDLE-X)
    (display "  bricks-left=") (display (bricks-alive))
    (newline)
    (loop (+ t 1))))

(newline)
(display "  DEMO ENDED — 6 frames simulated cleanly.") (newline)
(display "  Fork: change BRICK-W/H, expand the grid, add power-ups.") (newline)
