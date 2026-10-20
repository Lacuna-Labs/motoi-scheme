(for-each (lambda (p)
  (display (list p 'valid? (juggle/valid? p) 'balls (juggle/balls p) 'max (juggle/max-throw p)))
  (newline))
  '((3) (4 4) (5 3 1) (7 1) (9 3) (6 4 4 1) (9 3 3 3) (5 5 5 5 5) (4 4 1 3) (5 3 4 0) (7 1 6 4 2) (4 4 4) (2 1) (441)))
