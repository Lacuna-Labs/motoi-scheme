;; click-to-draw.scm
;; Motoi Cart — Wave 4 Interactive
;;
;; (cart
;;   :name            "click-to-draw"
;;   :category        :creative
;;   :sub-category    :interactive
;;   :audience        :kid
;;   :complexity      2
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Click the canvas to leave a colored dot where you clicked."
;;   :verbs-used      ("set-mode" "clear" "on-mouse" "fire-mouse" "disc"
;;                     "pixel" "rectangle" "for-each" "display")
;;   :inspiration     "Every finger-painting app since 1984.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-4-interactive/click-to-draw.scm
;;
;; This cart is EVENT-DRIVEN. In a real IDE, mouse clicks fire (on-mouse ...);
;; in headless mode we build a MOCK event list and replay it with (fire-mouse
;; x y btn). Same handler, same result — the runtime doesn't know or care
;; whether the mouse is real or a list.
;;
;; The pattern to remember:
;;   1. Register a handler:      (on-mouse (lambda (x y btn) ...))
;;   2. In headless: feed events: (for-each replay MOCK-CLICKS)
;;   3. In IDE:      just wait — the browser fires the same handler.

(set-mode 40 20)
(clear 0)

;; A soft frame so the canvas has an edge — uses the `rectangle` alias
;; (canonical: `rect`), which kids more often type first.
(set-color 5)
(rectangle 0 0 40 20)

;; ─── event handler ─────────────────────────────────────────────────
;; (on-mouse handler) — handler is called with (x y button).
;; The handler draws a small disc where you clicked, cycling color
;; through a friendly palette. `set!` bumps the color between clicks.

(define color 8)
(define clicks 0)

(on-mouse
  (lambda (x y btn)
    (set-color color)
    (disc x y 2)
    ;; a single-pixel accent, using the `pixel` alias (canonical: `pset`).
    (pixel x y 7)
    (set! color (+ 1 (modulo color 15)))
    (set! clicks (+ clicks 1))))

;; ─── mocked event queue ────────────────────────────────────────────
;; A list of (x y button) triples. In the IDE these come from real
;; browser clicks; here we author them by hand so `motoi run` produces
;; deterministic output for testing + snapshotting.

(define MOCK-CLICKS
  '((10 5 0)
    (20 5 0)
    (30 5 0)
    (15 10 0)
    (25 10 0)
    (20 15 0)))

(define (replay ev)
  (fire-mouse (car ev) (cadr ev) (caddr ev)))

(for-each replay MOCK-CLICKS)

(display "clicks: ")
(display clicks)
(newline)
(display "final color: ")
(display color)
(newline)
