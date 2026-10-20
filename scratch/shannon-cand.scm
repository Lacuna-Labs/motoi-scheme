(for-each (lambda (p) (display (list p (juggle/valid? p) 'balls (juggle/balls p) 'max (juggle/max-throw p))) (newline)) '((4 4 1 3) (8 4 4 0) (7 3 4 5 1) (5 3 4 0) (3 5 4 6 4)))
