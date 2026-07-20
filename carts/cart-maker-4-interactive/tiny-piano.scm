;; tiny-piano.scm
;; Motoi Cart — Wave 4 Interactive
;;
;; (cart
;;   :name            "tiny-piano"
;;   :category        :creative
;;   :sub-category    :interactive
;;   :audience        :kid
;;   :complexity      2
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Press number keys 1..8 to play a C major scale."
;;   :verbs-used      ("set-mode" "clear" "on-key" "fire-key" "tone"
;;                     "fill-rect" "rectangle" "for-each" "display")
;;   :inspiration     "The plastic-key Casio SA-1 from 1988.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-4-interactive/tiny-piano.scm
;;
;; Eight number keys → eight notes of the C major scale. Each keypress
;; also highlights the "piano key" on the display so kids can SEE what
;; they hear.
;;
;; The pattern: `assv` maps the incoming key symbol to a frequency,
;; then `tone` plays it. Mocked events for headless run.

(set-mode 80 20)
(clear 0)

;; Draw 8 empty keys — `rectangle` is the alias (canonical: `rect`).
(set-color 7)
(let loop ((i 0))
  (when (< i 8)
    (rectangle (+ 4 (* i 9)) 4 8 12)
    (loop (+ i 1))))

;; ─── the scale ─────────────────────────────────────────────────────
;; (key-name freq slot-index).  C4 = 261.63 Hz, D4 = 293.66, …

(define SCALE
  '((|1| 261.63 0)
    (|2| 293.66 1)
    (|3| 329.63 2)
    (|4| 349.23 3)
    (|5| 392.00 4)
    (|6| 440.00 5)
    (|7| 493.88 6)
    (|8| 523.25 7)))

(define notes-played 0)

;; ─── event handler ─────────────────────────────────────────────────
;; on-key receives a Sym. `assv` finds the entry, `tone` plays it,
;; `fill-rect` (alias for `rect-fill`) lights up the key.

(on-key
  (lambda (k)
    (let ((entry (assv k SCALE)))
      (when entry
        (let ((freq (cadr entry))
              (slot (caddr entry)))
          (tone freq 0.2)
          (set-color 11)
          (fill-rect (+ 5 (* slot 9)) 5 6 10)
          (set! notes-played (+ notes-played 1)))))))

;; ─── mocked event queue ────────────────────────────────────────────
;; A short scale run — 1,2,3,4,5,6,7,8 — then a little melody.

(define MOCK-KEYS
  '(|1| |2| |3| |4| |5| |6| |7| |8| |5| |3| |1|))

(for-each fire-key MOCK-KEYS)

(display "keys pressed: ")
(display (length MOCK-KEYS))
(newline)
(display "notes played: ")
(display notes-played)
(newline)
