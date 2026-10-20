(define g (alg/cyclic 12))
(define (normal? h) (= (length (alg/normalizer g h)) (alg/order g)))
(define subs (alg/subgroups g))
(display (filter normal? subs))
