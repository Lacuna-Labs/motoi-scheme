(define A '((2 1)(1 3)))
(define lu (linalg/lu A))
(display "L U P: ") (display lu) (newline)

;; P A = L U ?
(define L (car lu)) (define U (cadr lu)) (define P (caddr lu))
(display "LU  = ") (display (matrix/multiply L U)) (newline)
(display "PA  = ") (display (matrix/multiply P A)) (newline)

;; det via LU: det(A) = det(P) * prod Uii ; here P = I
(display "det A = ") (display (matrix/determinant A)) (newline)
(display "U00*U11 = ") (display (* (matrix/get U 0 0) (matrix/get U 1 1))) (newline)

;; solve-with-lu from the math-composition
(define (solve-with-lu A b)
  (let* ((lu (linalg/lu A))
         (L (car lu)) (U (cadr lu)) (P (caddr lu))
         (Pb (linalg/mv P b))
         (y (linalg/solve L Pb))
         (x (linalg/solve U y)))
    x))
(display "x for Ax=(5 10): ") (display (solve-with-lu '((2 1)(1 3)) '(5 10))) (newline)
(display "A.x = ") (display (linalg/mv '((2 1)(1 3)) (solve-with-lu '((2 1)(1 3)) '(5 10)))) (newline)

;; a matrix that REQUIRES a pivot swap
(define B '((0 1)(1 0)))
(define lb (linalg/lu B))
(display "B lu: ") (display lb) (newline)
(display "P B  = ") (display (matrix/multiply (caddr lb) B)) (newline)
(display "L U  = ") (display (matrix/multiply (car lb) (cadr lb))) (newline)

;; singular: U must have a zero on the diagonal, NOT fail
(define S '((1 2)(2 4)))
(define ls (linalg/lu S))
(display "S lu: ") (display ls) (newline)
(display "P S  = ") (display (matrix/multiply (caddr ls) S)) (newline)
(display "L U  = ") (display (matrix/multiply (car ls) (cadr ls))) (newline)

;; rank-from-lu (cs-composition) on the 3x3
(define (rank-from-lu A)
  (let* ((lu (linalg/lu A))
         (U (cadr lu))
         (n (length U))
         (nonzero-diag (let loop ((i 0) (count 0))
                         (if (>= i n) count
                             (loop (+ i 1)
                                   (if (> (abs (matrix/get U i i)) 1e-9)
                                       (+ count 1) count))))))
    nonzero-diag))
(display "rank-from-lu ((2 1 1)(1 3 2)(1 2 2)) = ") (display (rank-from-lu '((2 1 1)(1 3 2)(1 2 2)))) (newline)
(display "linalg/rank same          = ") (display (linalg/rank '((2 1 1)(1 3 2)(1 2 2)))) (newline)
(display "rank-from-lu singular     = ") (display (rank-from-lu S)) (newline)
(display "linalg/rank singular      = ") (display (linalg/rank S)) (newline)

;; not-square sentinel
(display "non-square: ") (display (linalg/lu '((1 2 3)(4 5 6)))) (newline)
