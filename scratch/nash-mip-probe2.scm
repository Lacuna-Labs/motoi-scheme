(define (facility-select fixed-costs coverage budget)
  (ops/mip-solve
    (cons (append fixed-costs (list '<= budget))
          (map (lambda (i)
                 (append (map (lambda (j) (if (= i j) 1 0)) (iota (length coverage)))
                         (list '<= 1)))
               (iota (length coverage))))
    coverage
    (list ':integers (iota (length coverage)))))
(display (facility-select (list 50 80 35) (list 40 60 30) 120))
(newline)
