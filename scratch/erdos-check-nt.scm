;; Semantic spot-checks for every record Erdos touched in 44-nt.slat.
;; The chapter gate only proves a snippet RAN; these prove the ANSWERS.

(define (fold-left f init xs)
  (let loop ((xs xs) (acc init))
    (if (null? xs) acc (loop (cdr xs) (f acc (car xs))))))
(define (take xs n)
  (let loop ((xs xs) (n n) (acc '()))
    (if (or (zero? n) (null? xs)) (reverse acc)
        (loop (cdr xs) (- n 1) (cons (car xs) acc)))))

;; --- divmod: signature says ((quotient q) (remainder r)) ---
(display (list 'divmod (nt/divmod 17 5)))                       (newline) ; ((quotient 3) (remainder 2))
(define (digits n base)
  (if (< n base) (list n)
      (let ((qr (nt/divmod n base)))
        (cons (cadr (cadr qr)) (digits (cadr (car qr)) base)))))
(display (list 'digits (digits 12345 10)))                      (newline) ; (5 4 3 2 1)
(define (hours-minutes total)
  (let* ((qr (nt/divmod total 60)))
    (list ':hours (cadr (car qr)) ':minutes (cadr (cadr qr)))))
(display (list 'hm (hours-minutes 137)))                        (newline) ; 2h 17m
(display (list 'euclid-step
               (let ((qr (nt/divmod 1729 89))) (list 89 (cadr (cadr qr))))))
(newline)                                                                  ; (89 12)
(display (list 'reconstruct
               (let* ((qr (nt/divmod 17 5)) (q (cadr (car qr))) (r (cadr (cadr qr))))
                 (= (+ (* q 5) r) 17))))                        (newline) ; #t
(display (list 'extract-q (cadr (car (nt/divmod 89 7)))
                          (cadr (car (nt/divmod 1729 89)))))    (newline) ; 12 19

;; --- extended-gcd: ((gcd g) (x a) (y b)) ---
(display (list 'egcd (nt/extended-gcd 35 15)))                  (newline) ; gcd 5
(display (list 'bezout
               (let ((r (nt/extended-gcd 35 15)))
                 (+ (* 35 (cadr (cadr r))) (* 15 (cadr (caddr r)))))))
(newline)                                                                  ; 5
(display (list 'gcd-agrees
               (= (nt/gcd 1729 561) (cadr (car (nt/extended-gcd 1729 561))))))
(newline)                                                                  ; #t

;; --- prime-factorization: ((p . e) ...) ---
(display (list 'pf12 (nt/prime-factorization 12)))              (newline) ; ((2 . 2) (3 . 1))
(display (list 'tau60 (fold * 1 (map (lambda (p) (+ 1 (cdr p)))
                                     (nt/prime-factorization 60)))
               'ref (nt/divisor-count 60)))                     (newline) ; 12 12
(display (list 'totient36
               (fold (lambda (p acc) (* acc (expt (car p) (- (cdr p) 1)) (- (car p) 1)))
                     1 (nt/prime-factorization 36))
               'ref (nt/totient 36)))                           (newline) ; 12 12
(display (list 'gcd-min-exp
               (fold * 1 (map (lambda (pa)
                                (let ((m (assoc (car pa) (nt/prime-factorization 36))))
                                  (if m (expt (car pa) (min (cdr pa) (cdr m))) 1)))
                              (nt/prime-factorization 24)))
               'ref (nt/gcd 24 36)))                            (newline) ; 12 12

;; --- mod-inverse: number | null ---
(display (list 'inv (nt/mod-inverse 3 7) 'none (nt/mod-inverse 6 9)
               'null? (null? (nt/mod-inverse 6 9))))            (newline) ; 5 () #t
(display (list 'solve
               (let ((inv (nt/mod-inverse 3 7)))
                 (if (null? inv) '() (nt/mod (* inv 5) 7)))))   (newline) ; 4

;; --- boolean comparisons ---
(define (sum-parity-rule a b)
  (boolean=? (nt/even? (+ a b)) (equal? (nt/even? a) (nt/even? b))))
(display (list 'parity (map (lambda (p) (sum-parity-rule (car p) (cadr p)))
                            (list (list 2 4) (list 3 5) (list 7 8)))))
(newline)                                                                  ; (#t #t #t)
(define (sigma-2n-witness n)
  (boolean=? (nt/is-perfect? n) (= (nt/divisor-sum n) (* 2 n))))
(display (list 'perfect (map sigma-2n-witness (list 6 12 28 89 496))))
(newline)                                                                  ; (#t #t #t #t #t)

;; --- continued fraction convergents ---
(define (cf-value terms)
  (let ((r (reverse terms)))
    (fold-left (lambda (acc a) (+ a (/ 1 acc))) (car r) (cdr r))))
(define cf (nt/continued-fraction 355/113))
(display (list 'cf cf 'convergents
               (map (lambda (n) (cf-value (take cf (+ n 1)))) (list 1 2 3))))
(newline)                                                    ; (3 7 16) → 22/7, 355/113
