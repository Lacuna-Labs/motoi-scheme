(grid/flower-spawn! 'rose 'red 3 4)
(define p (grid/flower-pos 'rose))
(display (list 'pos p 'x (car p) 'y (cdr p)))
(newline)
