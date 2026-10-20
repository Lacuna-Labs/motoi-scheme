(define-syntax elli-esc-1
  (syntax-rules ()
    ((_)     '(... ...))
    ((_ x)   '(... (x ...)))
    ((_ x y) '(... (... x y)))))
(write (elli-esc-1)) (newline)
(write (elli-esc-1 100)) (newline)
(write (elli-esc-1 100 200)) (newline)

(define-syntax ual (syntax-rules (_) ((ual _) 'under) ((ual x) 'other)))
(write (list (ual _) (ual 5))) (newline)
(define-syntax eal (syntax-rules (...) ((eal ...) 'under) ((eal x) 'other)))
(write (list (eal ...) (eal 6))) (newline)

(define-syntax be-like-begin
  (syntax-rules ()
   ((be-like-begin name)
    (define-syntax name
      (syntax-rules ()
        ((name expr (... ...)) (begin expr (... ...))))))))
(be-like-begin sequence)
(write (sequence 1 2 3 4)) (newline)

(define-syntax be-like-begin-alt
  (syntax-rules &etc ()
   ((be-like-begin-alt name)
    (define-syntax name
      (syntax-rules ()
        ((name expr (&etc ...)) (begin expr (&etc ...))))))))
(be-like-begin-alt seq2)
(write (seq2 1 2 3 4)) (newline)
