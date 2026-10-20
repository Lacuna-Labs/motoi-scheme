(define g (alg/cyclic 12))
(define (normal? h) (= (length (alg/normalizer g h)) (alg/order g)))
(define subs (alg/subgroups g))
(list 'all-normal (= (length subs) (length (filter normal? subs))))
