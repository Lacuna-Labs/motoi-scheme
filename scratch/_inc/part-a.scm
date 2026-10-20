(define (inc-a x) (+ x 100))
(define-syntax inc-twice (syntax-rules () ((_ e) (inc-a (inc-a e)))))
