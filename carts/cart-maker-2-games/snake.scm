;; snake.scm
;; Motoi Cart — Games Lane 2026-07-19
;;
;; (cart
;;   :name            "snake"
;;   :category        :game
;;   :sub-category    :arcade
;;   :audience        :kid
;;   :complexity      2
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Grid snake, food, growth, self-collision. Framebuffer-drawn + text log."
;;   :verbs-used      ("set-mode" "clear" "set-color" "begin-frame" "end-frame"
;;                     "fill-rect" "rect-fill" "put-pixel" "pset"
;;                     "display" "newline" "randint" "modulo")
;;   :aliases-used    ("fill-rect" "put-pixel")
;;   :inspiration     "Nokia 3310, 1997. Ate its own tail once too often.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-2-games/snake.scm
;;
;; 15-tick bounded demo. Snake follows a food-seeking policy. Each frame:
;; move head, check food, check wall/self, draw. Also emits an ASCII
;; board every 3 frames so the training model sees BOTH the framebuffer
;; verbs AND readable state.
;;
;; Aliases: `fill-rect` (== rect-fill) and `put-pixel` (== pset).

(set-mode 128 96)

(define CELL 8)          ;; 8×8 pixel cells → 16×12 board
(define COLS 16)
(define ROWS 12)
(define MAX-TICKS 10)

(define SNAKE '((6 5) (6 4) (6 3)))   ;; (row col) HEAD first
(define DIR 'r)
(define FOOD '(4 10))
(define ALIVE? #t)
(define SCORE 0)

(define (head) (car SNAKE))

(define (next-cell dir cell)
  (let ((r (car cell)) (c (car (cdr cell))))
    (cond
      ((eq? dir 'u) (list (- r 1) c))
      ((eq? dir 'd) (list (+ r 1) c))
      ((eq? dir 'l) (list r (- c 1)))
      ((eq? dir 'r) (list r (+ c 1))))))

(define (out-of-bounds? cell)
  (let ((r (car cell)) (c (car (cdr cell))))
    (or (< r 0) (>= r ROWS) (< c 0) (>= c COLS))))

(define (cell-eq? a b)
  (and (= (car a) (car b)) (= (car (cdr a)) (car (cdr b)))))

(define (in-snake? cell body)
  (cond
    ((null? body) #f)
    ((cell-eq? cell (car body)) #t)
    (else (in-snake? cell (cdr body)))))

(define (drop-last xs)
  (cond
    ((null? xs) '())
    ((null? (cdr xs)) '())
    (else (cons (car xs) (drop-last (cdr xs))))))

(define (safe? dir)
  (let ((n (next-cell dir (head))))
    (not (or (out-of-bounds? n) (in-snake? n SNAKE)))))

(define (opposite? a b)
  (or (and (eq? a 'u) (eq? b 'd))
      (and (eq? a 'd) (eq? b 'u))
      (and (eq? a 'l) (eq? b 'r))
      (and (eq? a 'r) (eq? b 'l))))

(define (choose-dir)
  (let* ((h  (head))
         (hr (car h)) (hc (car (cdr h)))
         (fr (car FOOD)) (fc (car (cdr FOOD)))
         (want (cond
                 ((> fc hc) 'r)
                 ((< fc hc) 'l)
                 ((> fr hr) 'd)
                 (else 'u))))
    (cond
      ((and (not (opposite? want DIR)) (safe? want)) want)
      ((safe? 'r) 'r)
      ((safe? 'd) 'd)
      ((safe? 'l) 'l)
      ((safe? 'u) 'u)
      (else DIR))))

(define (step-tick)
  (let ((new-head (next-cell DIR (head))))
    (cond
      ((out-of-bounds? new-head) (set! ALIVE? #f))
      ((in-snake? new-head SNAKE) (set! ALIVE? #f))
      ((cell-eq? new-head FOOD)
       (set! SNAKE (cons new-head SNAKE))
       (set! SCORE (+ SCORE 1))
       (set! FOOD (list (randint 0 ROWS) (randint 0 COLS))))
      (else
       (set! SNAKE (cons new-head (drop-last SNAKE)))))))

;; ------- draw the game to the framebuffer -------
(define (draw-frame)
  (clear 0)
  ;; food — a red square. Also poke a single pixel via `put-pixel`
  ;; alias so the training model sees the alias verb in action.
  (set-color 8)
  (let ((fx (* (car (cdr FOOD)) CELL))
        (fy (* (car FOOD) CELL)))
    (fill-rect (+ fx 2) (+ fy 2) (- CELL 4) (- CELL 4))
    (put-pixel (+ fx (quotient CELL 2)) (+ fy (quotient CELL 2)) 7))
  ;; snake body via fill-rect alias
  (set-color 11)
  (let loop ((body SNAKE) (head? #t))
    (when (not (null? body))
      (let* ((cell (car body))
             (r (car cell))
             (c (car (cdr cell)))
             (x (* c CELL))
             (y (* r CELL)))
        (if head?
            (begin
              (set-color 3)
              (fill-rect x y CELL CELL)
              (set-color 11))
            (fill-rect (+ x 1) (+ y 1) (- CELL 2) (- CELL 2))))
      (loop (cdr body) #f))))

;; ------- ASCII overlay for readable log -------
(define (glyph-at r c)
  (cond
    ((cell-eq? (list r c) FOOD) "@")
    ((cell-eq? (list r c) (head)) "O")
    ((in-snake? (list r c) SNAKE) "o")
    (else " ")))

(define (dump-board)
  (display "  +") (display "----------------") (display "+") (newline)
  (let row-loop ((r 0))
    (when (< r ROWS)
      (display "  |")
      (let col-loop ((c 0))
        (when (< c COLS)
          (display (glyph-at r c))
          (col-loop (+ c 1))))
      (display "|") (newline)
      (row-loop (+ r 1))))
  (display "  +") (display "----------------") (display "+") (newline))

;; ------- driver -------
(display "SNAKE — 15-tick demo (auto-play policy: seek food, avoid self)") (newline)
(display "===============================================================") (newline)
(display "  O = head   o = body   @ = food") (newline)
(newline)

(dump-board)

(let loop ((t 1))
  (when (and ALIVE? (<= t MAX-TICKS))
    (set! DIR (choose-dir))
    (step-tick)
    (begin-frame)
    (draw-frame)
    (end-frame)
    (when (or (= (modulo t 3) 0) (not ALIVE?))
      (display "  tick=") (display t)
      (display "  score=") (display SCORE)
      (display "  dir=") (display DIR) (newline)
      (dump-board))
    (loop (+ t 1))))

(newline)
(display (if ALIVE?
             "  DEMO ENDED — max ticks reached without collision."
             "  SNAKE DIED — collision detected."))
(newline)
(display "  final score: ") (display SCORE) (newline)
