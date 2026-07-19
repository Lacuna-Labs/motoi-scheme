;; pico8-dots.scm — PICO-8 palette in your terminal.
;;
;; Run with: ./bin/motoi run carts/cart-pico8-demo/pico8-dots.scm
;; You'll see 16 real colored blocks, then a yellow smiley face.

(set-mode 20 10)
(begin-frame)

;; palette test — all 16 colors across the top
(let loop ((x 0))
  (when (< x 16)
    (set-color x)
    (pixel x 0)
    (loop (+ x 1))))

;; smiley face in yellow
(set-color 'yellow)
(disc 10 6 3)
(set-color 'black)
(pixel 9 5) (pixel 11 5)          ; eyes
(pixel 9 8) (pixel 10 8) (pixel 11 8)  ; mouth

(end-frame)
(display "PICO-8 palette · 16 colors + smiley:") (newline)
(fb/dump)
