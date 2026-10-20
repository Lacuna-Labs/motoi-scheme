(display (list 'null? (null? (last-error)) 'inspect (inspect (last-error)) 'pair? (pair? (last-error)))) (newline)
(display (list (inspect 42) (inspect "s") (inspect #t) (inspect #f) (inspect car) (inspect (lambda (x) x)) (inspect 'sym))) (newline)
(display (inspect (vector 1 2 3))) (newline)
