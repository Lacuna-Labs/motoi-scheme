(define name2 'y)
(display (quasiquote (a (unquote (quote name2))))) (newline)
(display `(a ,'y)) (newline)
