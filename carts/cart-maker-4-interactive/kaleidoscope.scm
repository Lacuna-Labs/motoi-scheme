;; kaleidoscope.scm
;; Motoi Cart — Wave 4 Interactive
;;
;; (cart
;;   :name            "kaleidoscope"
;;   :category        :creative
;;   :sub-category    :interactive
;;   :audience        :kid
;;   :complexity      3
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Mouse motion mirrored 6 ways into a symmetric pattern."
;;   :verbs-used      ("set-mode" "clear" "on-mouse" "fire-mouse" "pixel"
;;                     "fill-rect" "sin" "cos" "for-each" "display")
;;   :inspiration     "A cheap plastic kaleidoscope from a museum gift shop.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-4-interactive/kaleidoscope.scm
;;
;; The idea: every point (x y) the mouse visits gets echoed to 5 other
;; positions rotated 60° around the center. So a single stroke becomes
;; a 6-armed symmetric pattern.
;;
;; The 6-fold echo happens INSIDE the on-mouse handler — so whether
;; the mouse events come from the IDE or from a mocked list, the
;; symmetry logic is identical. Kids should feel: "I did math and it
;; became beautiful."

(set-mode 60 60)
(clear 0)

;; A soft square backdrop using the `fill-rect` alias (canonical: `rect-fill`).
(set-color 1)
(fill-rect 0 0 60 60)

(define CX 30)
(define CY 30)
(define TAU 6.2831853)

;; ─── event handler ─────────────────────────────────────────────────
;; For each incoming (x y), compute the vector from the center and
;; plot 6 rotated copies of it. Six-fold symmetry = a snowflake.

(define points-drawn 0)

(on-mouse
  (lambda (x y btn)
    (let ((dx (- x CX))
          (dy (- y CY)))
      (let loop ((i 0))
        (when (< i 6)
          (let* ((theta (* (/ i 6) TAU))
                 (ct    (cos theta))
                 (st    (sin theta))
                 (rx    (+ CX (- (* dx ct) (* dy st))))
                 (ry    (+ CY (+ (* dx st) (* dy ct)))))
            ;; `pixel` (alias for `pset`) — kids love that one.
            (pixel (round rx) (round ry) (+ 8 (modulo i 8)))
            (set! points-drawn (+ points-drawn 1)))
          (loop (+ i 1)))))))

;; ─── mocked event queue ────────────────────────────────────────────
;; Points along a small curve — one drag-motion the mouse might make.
;; Because each of these produces 6 mirrored pixels, we get 6× the
;; input's density in output.

(define MOCK-MOVES
  '(( 40 30 0)
    ( 42 28 0)
    ( 44 27 0)
    ( 46 27 0)
    ( 47 29 0)
    ( 46 31 0)
    ( 44 33 0)
    ( 42 34 0)))

(define (replay ev)
  (fire-mouse (car ev) (cadr ev) (caddr ev)))

(for-each replay MOCK-MOVES)

(display "input strokes: ")
(display (length MOCK-MOVES))
(newline)
(display "mirrored points: ")
(display points-drawn)
(newline)
