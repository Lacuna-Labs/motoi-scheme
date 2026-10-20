(define radial (lambda (x y z) (list x y z)))
(display (list 'one-arg (calc/divergence radial) 'note-claims 3)) (newline)
(display (list 'two-arg (calc/divergence radial (list 1 2 3)) 'truth 3)) (newline)
(display (list 'curl-one-arg (calc/curl radial))) (newline)
