(define-syntax twice (syntax-rules () ((_ e) (begin e e))))
(define (loaded-fact n) (if (= n 0) 1 (* n (loaded-fact (- n 1)))))
(twice (loaded-fact 5))
