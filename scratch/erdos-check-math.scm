;; Semantic spot-checks for every record Erdos touched in 40-math.slat.

;; --- math/round-half-up now honours `places` ---
(display (list 'r37 (math/round-half-up 3.7 0)      ; 4
               'r25 (math/round-half-up 2.5 0)      ; 3
               'r05 (math/round-half-up 0.5 0)      ; 1
               'rn05 (math/round-half-up -0.5 0)    ; -1
               'rn25 (math/round-half-up -2.5 0)    ; -3
               'tens (math/round-half-up 87 -1)     ; 90
               'pi3 (math/round-half-up 3.14159 3)))  ; 3.142
(newline)
(define (price-from-cost cost markup-pct)
  (let ((gross (* cost (+ 1 (/ markup-pct 100)))))
    (math/round-half-up gross 2)))
(display (list 'price (price-from-cost 10 15)))     ; 11.5
(newline)
(define (idempotent? x p)
  (= (math/round-half-up (math/round-half-up x p) p) (math/round-half-up x p)))
(display (list 'idem (idempotent? 3.14159 2) (idempotent? 2.5 0)))  ; #t #t
(newline)
(define (integer-fixed? n) (= (math/round-half-up n 0) n))
(display (list 'intfix (integer-fixed? 3) (integer-fixed? -7) (integer-fixed? 0)))
(newline)

;; --- math/avg over property lists ---
(define (field key p) (cadr (memq key p)))
(define (smooth-positions positions)
  (let ((x-vals (map (lambda (p) (field 'x p)) positions))
        (y-vals (map (lambda (p) (field 'y p)) positions)))
    (list 'x (math/avg x-vals) 'y (math/avg y-vals))))
(display (list 'smooth (smooth-positions (list (list 'x 10 'y 20) (list 'x 30 'y 40)))))
(newline)                                            ; (x 20 y 30)

;; --- boolean=? sign-agreement laws (R7RS 6.3) ---
(define (divides? d n) (= 0 (remainder n d)))
(display (list 'divides (map (lambda (n) (divides? 3 n)) (list 9 10 -9))
               'agrees (map (lambda (n) (boolean=? (divides? 3 n) (= 0 (modulo n 3))))
                            (list 9 10 -9))))
(newline)                          ; (#t #f #t) and (#t #t #t)
(display (list 'rem-sign
  (map (lambda (p) (or (= 0 (remainder (car p) (cadr p)))
                       (boolean=? (< (remainder (car p) (cadr p)) 0) (< (car p) 0))))
       (list (list 7 3) (list -7 3) (list 7 -3) (list -7 -3)))))
(newline)                          ; (#t #t #t #t) — remainder takes the DIVIDEND's sign
(display (list 'mod-sign
  (map (lambda (p) (or (= 0 (modulo (car p) (cadr p)))
                       (boolean=? (< (modulo (car p) (cadr p)) 0) (< (cadr p) 0))))
       (list (list 7 3) (list -7 3) (list 7 -3) (list -7 -3)))))
(newline)                          ; (#t #t #t #t) — modulo takes the DIVISOR's sign

;; --- math/mixed-number ---
(display (list 'mixed (math/mixed-number '(7 3)) (math/mixed-number '(11 4))
               (math/mixed-number '(8 4)) (math/mixed-number '(9 0))))
(newline)                          ; (2 1 3) (2 3 4) (2 0 1) nan
