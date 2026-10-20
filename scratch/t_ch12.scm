;; bitwise xor of two non-negative integers, built from arithmetic
(define (bit-xor2 a b)
  (let loop ((a a) (b b) (bit 1) (acc 0))
    (if (and (= a 0) (= b 0))
        acc
        (let ((da (modulo a 2)) (db (modulo b 2)))
          (loop (quotient a 2) (quotient b 2) (* bit 2)
                (+ acc (* bit (if (= da db) 0 1))))))))
(define (nim-sum piles) (fold bit-xor2 0 piles))

(display (nim-sum '(3 5 6))) (newline)   ;; expect 0
(display (nim-sum '(4 5 6))) (newline)   ;; expect 7

(define (nim-outcome piles) (if (zero? (nim-sum piles)) 'P 'N))
(display (nim-outcome '(4 5 6))) (newline)  ;; N
(display (nim-outcome '(3 5 6))) (newline)  ;; P

;; nim-move: find (index . new-size) making nim-sum zero
(define (nim-move piles)
  (let ((s (nim-sum piles)))
    (let loop ((i 0) (ps piles))
      (if (null? ps) #f
          (let ((target (bit-xor2 s (car ps))))
            (if (< target (car ps))
                (cons i target)
                (loop (+ i 1) (cdr ps))))))))
(display (nim-move '(4 5 6))) (newline)  ;; expect (0 . 3)

;; wythoff
(define phi (/ (+ 1 (sqrt 5)) 2))
(define (wythoff-p? a b)
  (let* ((lo (min a b)) (hi (max a b))
         (n (exact (floor (/ lo (- phi 1))))))  ;; not used; direct check
    (let scan ((k 0))
      (let ((wl (exact (floor (* k phi))))
            (wh (exact (floor (* k phi phi)))))
        (cond ((> wl hi) #f)
              ((and (= wl lo) (= wh hi)) #t)
              (else (scan (+ k 1))))))))
(display (wythoff-p? 3 5)) (newline)  ;; #t
(display (wythoff-p? 4 5)) (newline)  ;; #f

;; mex
(define (mex lst)
  (let loop ((m 0)) (if (member m lst) (loop (+ m 1)) m)))
(display (mex '(0 1 2 4))) (newline)  ;; 3
(display (mex '(1 2 3))) (newline)    ;; 0
