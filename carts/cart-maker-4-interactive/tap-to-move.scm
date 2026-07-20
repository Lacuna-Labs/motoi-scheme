;; tap-to-move.scm
;; Motoi Cart — Wave 4 Interactive
;;
;; (cart
;;   :name            "tap-to-move"
;;   :category        :game
;;   :sub-category    :interactive
;;   :audience        :kid
;;   :complexity      2
;;   :runtime-tier    :runs-on-core
;;   :one-line        "WASD moves a sprite; every step leaves a bright dot behind."
;;   :verbs-used      ("set-mode" "clear" "on-key" "fire-key" "pixel"
;;                     "fill-rect" "for-each" "display")
;;   :inspiration     "Robot-turtle from every K-6 CS class ever taught.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-4-interactive/tap-to-move.scm
;;
;; A sprite lives at (x,y). WASD moves it one step per keypress and
;; drops a colored dot at the OLD position, so the sprite's whole path
;; is visible as a trail. This is the same pattern you use for a snake
;; game, a paint program, a maze runner.

(set-mode 40 20)
(clear 0)

(define x 20)
(define y 10)
(define steps 0)

(define (in-bounds? nx ny)
  (and (>= nx 0) (< nx 40) (>= ny 0) (< ny 20)))

;; Drop a trail dot at the current position (using `pixel` alias),
;; then move if the new position is legal.

(define (step dx dy)
  (pixel x y 11)   ;; trail
  (let ((nx (+ x dx))
        (ny (+ y dy)))
    (when (in-bounds? nx ny)
      (set! x nx)
      (set! y ny)
      (set! steps (+ steps 1)))))

;; ─── event handler ─────────────────────────────────────────────────
;; Direction table: symbol → (dx dy). `case` picks the branch.

(on-key
  (lambda (k)
    (case k
      ((w) (step  0 -1))
      ((a) (step -1  0))
      ((s) (step  0  1))
      ((d) (step  1  0))
      (else 'ignored))))

;; ─── mocked event queue ────────────────────────────────────────────
;; A zig-zag path: right 4, down 3, left 4, down 3, right 4.

(define MOCK-KEYS
  '(d d d d s s s a a a a s s s d d d d))

(for-each fire-key MOCK-KEYS)

;; Paint the sprite at its final position last so it sits on top of
;; the trail — `fill-rect` alias (canonical: `rect-fill`).
(set-color 12)
(fill-rect (- x 1) (- y 1) 3 3)

(display "steps: ")
(display steps)
(newline)
(display "final position: ")
(display (list x y))
(newline)
