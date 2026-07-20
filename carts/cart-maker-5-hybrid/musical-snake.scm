;; musical-snake.scm
;; Motoi Cart — Wave 5 Hybrid
;;
;; (cart
;;   :name            "musical-snake"
;;   :category        :game
;;   :sub-category    :hybrid
;;   :audience        :kid
;;   :complexity      3
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Snake game that plays a note each time it eats food."
;;   :verb-families   (graphics audio game tick)
;;   :verbs-used      ("set-mode" "clear" "rectangle" "fill-rect" "pixel"
;;                     "note" "melody" "sfx" "tick/phase"
;;                     "entity/make" "entity/state" "on-frame" "tick-frame"
;;                     "fire-key" "on-key" "display" "newline"))
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-5-hybrid/musical-snake.scm
;;
;; THE COMPOSITION.
;; Three verb families braid together on every frame:
;;
;;   game     — snake list + food position + collision state
;;   audio    — a note fires the instant the head lands on food
;;   graphics — the framebuffer redraws each tick via rectangle/fill-rect
;;
;; The score note walks up a C-major scale as the snake grows. The frame
;; handler is the composition point: it advances snake, checks food,
;; triggers audio, and repaints. That's the whole shape.
;;
;; Uses aliases `rectangle` (canonical `rect`) and `fill-rect` (canonical
;; `rect-fill`) and `pixel` (canonical `pset`) — three aliases per cart.

(set-mode 32 16)
(clear 0)

(define WIDTH  32)
(define HEIGHT 16)
(define TICKS  24)

;; ── C major scale, one octave. Head ate food → play next note.
(define SCALE '(C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5))
(define note-index 0)

;; ── snake state
(define SNAKE '((8 8) (8 7) (8 6)))
(define DIR 'r)
;; Food starts three cells ahead so the very first straight run lands it —
;; that guarantees an audible note-on inside TICKS.
(define FOOD '(8 11))
(define ALIVE? #t)
(define SCORE 0)

(define (head) (car SNAKE))
(define (next-cell d cell)
  (let ((r (car cell)) (c (nth cell 1)))
    (cond ((eq? d 'u) (list (- r 1) c))
          ((eq? d 'd) (list (+ r 1) c))
          ((eq? d 'l) (list r (- c 1)))
          ((eq? d 'r) (list r (+ c 1))))))

(define (cell-eq? a b)
  (and (= (car a) (car b)) (= (nth a 1) (nth b 1))))

(define (in-snake? cell body)
  (cond ((null? body) #f)
        ((cell-eq? cell (car body)) #t)
        (else (in-snake? cell (cdr body)))))

(define (drop-last xs)
  (cond ((null? xs) '())
        ((null? (cdr xs)) '())
        (else (cons (car xs) (drop-last (cdr xs))))))

;; ── the composition point: one tick advances everything
(define (compose-tick t)
  (when ALIVE?
    (let ((new-head (next-cell DIR (head))))
      (cond
        ;; wall / self collision — a sad thud
        ((or (< (car new-head) 0) (>= (car new-head) HEIGHT)
             (< (nth new-head 1) 0) (>= (nth new-head 1) WIDTH)
             (in-snake? new-head SNAKE))
         (set! ALIVE? #f)
         ;; low sfx thud on death — audio family
         (sfx 'noise 80 0.4))
        ;; food landing — grow, play the next scale note
        ((cell-eq? new-head FOOD)
         (set! SNAKE (cons new-head SNAKE))
         (set! SCORE (+ SCORE 1))
         (set! FOOD (list (modulo (+ (car FOOD) 3) HEIGHT)
                          (modulo (+ (nth FOOD 1) 5) WIDTH)))
         ;; AUDIO TRIGGER — game state change fires a sound
         (note (nth SCALE (modulo note-index (length SCALE))) 0.18)
         (set! note-index (+ note-index 1)))
        ;; ordinary step — move the head, drop the tail
        (else
         (set! SNAKE (cons new-head (drop-last SNAKE))))))
    ;; GRAPHICS — redraw framebuffer each tick
    (clear 0)
    ;; food marker: filled square, uses `fill-rect` alias
    (set-color 8)
    (fill-rect (nth FOOD 1) (car FOOD) 1 1)
    ;; snake body: rectangles at each cell, uses `rectangle` alias
    (set-color 11)
    (for-each
     (lambda (cell)
       (rectangle (nth cell 1) (car cell) 1 1))
     (cdr SNAKE))
    ;; head is bright, drawn via `pixel` alias
    (set-color 7)
    (pixel (nth (head) 1) (car (head)) 7)))

;; ── input: turns are mocked via fire-key (headless-safe pattern)
(on-key
 (lambda (k)
   (cond ((eq? k 'up)    (set! DIR 'u))
         ((eq? k 'down)  (set! DIR 'd))
         ((eq? k 'left)  (set! DIR 'l))
         ((eq? k 'right) (set! DIR 'r)))))

;; on-frame + tick-frame is the driver — same handler runs whether
;; the animation loop drives it or we step manually in headless mode.
(on-frame compose-tick)

;; ── mocked turn schedule: (tick key)
(define MOCK-TURNS
  '((3 right) (5 down) (7 right) (9 down) (11 right)
    (13 up)   (15 right) (17 down) (19 right)))

(define (turn-at t)
  (for-each
   (lambda (ev)
     (when (= (car ev) t) (fire-key (nth ev 1))))
   MOCK-TURNS))

;; ── drive: alternate a tick/phase read (tick family) between frames
;; so the trace includes a phase reading — proves audio+tick+game compose.
(display "MUSICAL SNAKE — note plays each time the head eats food.") (newline)
(display "======================================================") (newline)

(let loop ((t 1))
  (when (and ALIVE? (<= t TICKS))
    (turn-at t)
    (tick-frame)
    ;; sample the phase — audio-timing helper from tick family
    (when (= (modulo t 6) 0)
      (display "  t=") (display t)
      (display "  score=") (display SCORE)
      (display "  note-idx=") (display note-index)
      (display "  phase=") (display (tick/phase t 8))
      (newline))
    (loop (+ t 1))))

(stop)
(newline)
(display (if ALIVE?
             "  SNAKE ALIVE — final melody as it grew:"
             "  SNAKE DIED — the song ended."))
(newline)
(display "  final score: ") (display SCORE) (newline)
(display "  notes played: ")
;; Replay the scale melody the snake earned — one final melody flourish.
(let loop ((i 0) (acc '()))
  (if (>= i note-index)
      (begin (melody (reverse acc) 0.15) (display (reverse acc)) (newline))
      (loop (+ i 1)
            (cons (nth SCALE (modulo i (length SCALE))) acc))))
