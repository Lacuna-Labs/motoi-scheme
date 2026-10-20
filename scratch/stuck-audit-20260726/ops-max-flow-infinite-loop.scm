(define sources '(0 1 2))
(define g '((0 1 5) (1 2 3)))
(map (lambda (s) (list s (ops/max-flow g s 2))) sources)