;; storybook.scm
;; Motoi Cart — Wave 4 Interactive
;;
;; (cart
;;   :name            "storybook"
;;   :category        :storytelling
;;   :sub-category    :interactive
;;   :audience        :kid
;;   :complexity      2
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Spacebar advances a 5-scene slide deck: sun, cloud, rain, rainbow, night."
;;   :verbs-used      ("set-mode" "clear" "on-key" "fire-key" "disc"
;;                     "fill-rect" "line" "for-each" "display")
;;   :inspiration     "A pop-up book that only turns its own page.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-4-interactive/storybook.scm
;;
;; Five scenes. Each spacebar press advances by one. The last scene
;; wraps back to the first — no error, no dead-end. Kids can only ever
;; press space, so the interaction contract is impossibly simple.
;;
;; The pattern: an integer `scene` variable, a `dispatch` table of
;; drawing thunks, a single `on-key` handler that increments and
;; re-draws. `fill-rect` (alias) is used generously — kids reach for
;; that name first.

(set-mode 40 20)
(clear 0)

(define scene 0)
(define advances 0)

;; ─── scene painters ────────────────────────────────────────────────

(define (paint-sun)
  (clear 12)                        ;; sky
  (set-color 10)
  (disc 20 8 5))                    ;; sun

(define (paint-cloud)
  (clear 12)
  (set-color 7)
  (disc 15 8 3) (disc 20 7 4) (disc 25 8 3))

(define (paint-rain)
  (clear 5)
  (set-color 7)
  (fill-rect 12 4 16 4)             ;; big cloud, alias in use
  (set-color 12)
  (line 14 10 14 14)                ;; falling drops
  (line 18 10 18 14)
  (line 22 10 22 14)
  (line 26 10 26 14))

(define (paint-rainbow)
  (clear 12)
  (set-color 8)  (disc 20 18 12)
  (set-color 9)  (disc 20 18 10)
  (set-color 10) (disc 20 18  8)
  (set-color 11) (disc 20 18  6)
  (set-color 12) (disc 20 18  4))

(define (paint-night)
  (clear 1)
  (set-color 7)
  (pixel 8 4 7) (pixel 15 6 7) (pixel 24 3 7) (pixel 32 5 7)
  (set-color 10)
  (disc 30 8 2))                    ;; moon

(define SCENES
  (list paint-sun paint-cloud paint-rain paint-rainbow paint-night))

(define SCENE-NAMES
  '(sun cloud rain rainbow night))

(define (repaint)
  ((list-ref SCENES scene)))

(repaint)                           ;; opening scene

;; ─── event handler ─────────────────────────────────────────────────
;; Only 'space matters. Everything else is politely ignored.

(on-key
  (lambda (k)
    (when (eq? k 'space)
      (set! scene (modulo (+ scene 1) (length SCENES)))
      (set! advances (+ advances 1))
      (repaint)
      (display "scene ")
      (display (list-ref SCENE-NAMES scene))
      (newline))))

;; ─── mocked event queue ────────────────────────────────────────────
;; Six spacebar presses — full loop back to sun, plus one extra.
;; Also a stray key to prove the handler ignores non-space input.

(define MOCK-KEYS
  '(space space q space space space space))

(for-each fire-key MOCK-KEYS)

(display "advances: ")
(display advances)
(newline)
(display "final scene: ")
(display (list-ref SCENE-NAMES scene))
(newline)
