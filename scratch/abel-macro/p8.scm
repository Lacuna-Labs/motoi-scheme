(define-syntax be-like-begin2
  (syntax-rules ()
    ((be-like-begin2 name)
     (define-syntax name
       (... (syntax-rules () ((name expr ...) (begin expr ...))))))))
(be-like-begin2 sequence2)
(write (sequence2 1 2 3 4)) (newline)

(define-syntax be-like-begin3
  (syntax-rules ()
    ((be-like-begin3 name)
     (define-syntax name
       (syntax-rules dots () ((name expr dots) (begin expr dots)))))))
(be-like-begin3 sequence3)
(write (sequence3 2 3 4 5)) (newline)
