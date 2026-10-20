(display (guard (e (#t 'no-define-library)) (eval '(define-library (foo bar) (export x) (begin (define x 1))) (environment '(scheme base))))) (newline)
