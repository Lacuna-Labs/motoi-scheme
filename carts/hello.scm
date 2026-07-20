;; hello.scm — the first cart to try.
;; Run with: ./bin/motoi run carts/hello.scm
;; Verbs: display, +, map, set-mode, begin-frame, set-color, pixel, end-frame, fb/dump

(display "hello, motoi — 2 + 3 = ") (display (+ 2 3)) (newline)
(set-mode 8 1)
(begin-frame)
(map (lambda (x) (set-color (+ x 8)) (pixel x 0)) (list 0 1 2 3 4 5 6 7))
(end-frame)
(fb/dump)
