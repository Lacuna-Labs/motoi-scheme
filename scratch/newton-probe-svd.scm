(define (svd-compressor A)
  (let ((decomp (linalg/svd A)))
    (let ((U (cadr (assoc ':U decomp)))
          (V (cadr (assoc ':V decomp))))
      (list ':U-orthogonal? (linalg/is-orthogonal? U)
            ':V-orthogonal? (linalg/is-orthogonal? V)))))
(display (svd-compressor '((3 0)(0 2)))) (newline)

(display "raw: ") (display (linalg/svd '((3 0)(0 2)))) (newline)

;; the two sites that were silently #f
(define (has-all-keys? A)
  (let ((r (linalg/svd A)))
    (or (eq? r 'not-implemented)
        (and (assoc ':U r) (assoc ':Sigma r) (assoc ':V r)))))
(display "keys present: ") (display (has-all-keys? '((1 0)(0 1)))) (newline)

(define (feature A)
  (let ((r (linalg/svd A)))
    (if (eq? r 'not-implemented)
        'pending-implementation
        (and (assoc ':U r) (assoc ':Sigma r) (assoc ':V r)))))
(display "feature: ") (display (if (feature '((3 0)(0 2))) "truthy" "FALSE")) (newline)

;; singular values of diag(3,2) must be (3 2)
(display "sigma diag(3,2): ") (display (cadr (assoc ':Sigma (linalg/svd '((3 0)(0 2)))))) (newline)
;; singular values of ((3 0)(0 4)) must be (4 3)
(display "sigma diag(3,4): ") (display (cadr (assoc ':Sigma (linalg/svd '((3 0)(0 4)))))) (newline)
