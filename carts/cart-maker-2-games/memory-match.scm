;; memory-match.scm
;; Motoi Cart — Games Lane 2026-07-19
;;
;; (cart
;;   :name            "memory-match"
;;   :category        :game
;;   :sub-category    :party
;;   :audience        :kid
;;   :complexity      2
;;   :runtime-tier    :runs-on-core
;;   :one-line        "4×4 tile grid, flip pairs, match to keep them open. 8-turn demo."
;;   :verbs-used      ("set-mode" "clear" "set-color" "begin-frame" "end-frame"
;;                     "rect-fill" "fill-rect" "rect" "rectangle" "line"
;;                     "display" "newline" "randint")
;;   :aliases-used    ("fill-rect" "rectangle")
;;   :inspiration     "Concentration, 1961. Every kid's first card game.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-2-games/memory-match.scm
;;
;; 4×4 board = 16 tiles = 8 pairs. Each turn a "player" (a simple policy)
;; picks two unrevealed indices. If they match, they stay open + score.
;; If not, they flip back. Runs for 8 turns.
;;
;; Alias highlights: `fill-rect` (== rect-fill) and `rectangle` (== rect).

(set-mode 128 96)

(define ROWS 4)
(define COLS 4)
(define SIZE (* ROWS COLS))          ;; 16
(define PAIRS (quotient SIZE 2))     ;; 8
(define TILE-W 28)
(define TILE-H 20)
(define GAP 4)
(define OFF-X 6)
(define OFF-Y 6)
(define MAX-TURNS 8)

;; ------- deck: two of each 0..PAIRS-1 -------
(define (make-deck)
  (let loop ((cards (append (range 0 PAIRS) (range 0 PAIRS)))
             (out '()))
    (if (null? cards) out
        (let* ((idx (randint 0 (length cards)))
               (chosen (list-ref cards idx))
               (rest (append (take cards idx) (drop cards (+ idx 1)))))
          (loop rest (cons chosen out))))))

(define BOARD (make-deck))
;; Vector-like: which tiles are permanently open?
(define OPEN (make-list SIZE #f))
;; Which tiles were flipped this turn (for rendering)?
(define TURN-FLIPS '())

(define (tile-at i) (list-ref BOARD i))
(define (tile-open? i) (list-ref OPEN i))
(define (tile-face-up? i)
  (or (tile-open? i) (member i TURN-FLIPS)))

;; ------- indexed setter (no vector-set! needed) -------
(define (list-set-at lst i val)
  (let loop ((xs lst) (j 0) (acc '()))
    (cond
      ((null? xs) (reverse acc))
      ((= j i) (loop (cdr xs) (+ j 1) (cons val acc)))
      (else    (loop (cdr xs) (+ j 1) (cons (car xs) acc))))))

;; ------- policy: pick two random not-yet-open tiles -------
(define (pick-unrevealed)
  (let loop ((tries 0))
    (let ((i (randint 0 SIZE)))
      (cond
        ((> tries 40) i)
        ((not (tile-open? i)) i)
        (else (loop (+ tries 1)))))))

(define (pick-two)
  (let ((a (pick-unrevealed)))
    (let loop ((tries 0))
      (let ((b (pick-unrevealed)))
        (if (or (= a b) (> tries 40))
            (list a b)
            (if (= a b)
                (loop (+ tries 1))
                (list a b)))))))

;; ------- tile geometry -------
(define (tile-xy i)
  (let ((r (quotient i COLS))
        (c (modulo i COLS)))
    (list (+ OFF-X (* c (+ TILE-W GAP)))
          (+ OFF-Y (* r (+ TILE-H GAP))))))

;; ------- draw a face-up tile: show its value as a colored block -------
(define (draw-face i)
  (let* ((xy (tile-xy i))
         (x (car xy)) (y (car (cdr xy)))
         (v (tile-at i)))
    (set-color (+ 8 (modulo v 8)))
    (fill-rect x y TILE-W TILE-H)
    ;; centered "pip" using rectangle alias
    (set-color 7)
    (rectangle (+ x (- (quotient TILE-W 2) 3))
               (+ y (- (quotient TILE-H 2) 3))
               6 6)))

;; ------- draw a face-down tile: outline + hatch -------
(define (draw-back i)
  (let* ((xy (tile-xy i))
         (x (car xy)) (y (car (cdr xy))))
    (set-color 5)
    (fill-rect x y TILE-W TILE-H)
    (set-color 6)
    (rect x y TILE-W TILE-H)
    (line x y (+ x TILE-W) (+ y TILE-H))
    (line (+ x TILE-W) y x (+ y TILE-H))))

;; ------- draw the board -------
(define (draw!)
  (clear 0)
  (let loop ((i 0))
    (when (< i SIZE)
      (if (tile-face-up? i)
          (draw-face i)
          (draw-back i))
      (loop (+ i 1)))))

;; ------- render an ASCII board -------
(define (ascii-cell i)
  (cond
    ((tile-open? i)
     (string-append "[" (number->string (tile-at i)) "]"))
    ((member i TURN-FLIPS)
     (string-append "(" (number->string (tile-at i)) ")"))
    (else "[?]")))

(define (dump-board)
  (let row-loop ((r 0))
    (when (< r ROWS)
      (display "  ")
      (let col-loop ((c 0))
        (when (< c COLS)
          (display (ascii-cell (+ (* r COLS) c)))
          (display " ")
          (col-loop (+ c 1))))
      (newline)
      (row-loop (+ r 1)))))

;; ------- play one turn -------
(define SCORE 0)

(define (play-turn t)
  (let* ((pair (pick-two))
         (a (car pair))
         (b (car (cdr pair))))
    (set! TURN-FLIPS (list a b))
    (display "  turn=") (display t)
    (display "  flip tiles ") (display a)
    (display " + ") (display b)
    (display "  values=(") (display (tile-at a))
    (display " ") (display (tile-at b)) (display ")")
    (cond
      ((= (tile-at a) (tile-at b))
       (set! OPEN (list-set-at OPEN a #t))
       (set! OPEN (list-set-at OPEN b #t))
       (set! SCORE (+ SCORE 1))
       (display "  MATCH!"))
      (else
       (display "  miss")))
    (newline)
    (begin-frame)
    (draw!)
    (end-frame)
    (dump-board)
    ;; clear this turn's flips before next turn
    (set! TURN-FLIPS '())))

;; ------- driver -------
(display "MEMORY MATCH — 4x4, 8 pairs, 8-turn demo") (newline)
(display "=========================================") (newline)
(display "  [?]=face down  (n)=this turn's flip  [n]=matched") (newline)
(newline)

(dump-board)
(newline)

(let loop ((t 1))
  (when (<= t MAX-TURNS)
    (play-turn t)
    (loop (+ t 1))))

(newline)
(display "  DEMO ENDED — ") (display MAX-TURNS)
(display " turns played.") (newline)
(display "  final pairs matched: ") (display SCORE)
(display " / ") (display PAIRS) (newline)
(display "  Fork: change ROWS/COLS, teach the picker to remember what it's seen.") (newline)
