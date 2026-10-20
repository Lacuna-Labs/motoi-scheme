(define c (topo/close (topo/complex '((0 1 2)))))
(display (topo/betti c))(newline)
(display (topo/betti-k c 0))(newline)
(display (topo/betti-k c 1))(newline)
