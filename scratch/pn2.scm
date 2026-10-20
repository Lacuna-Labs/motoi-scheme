(define g (alg/cyclic 12))
(define subs (alg/subgroups g))
(display (filter (lambda (h) (= (length (alg/normalizer g h)) (alg/order g))) subs))
