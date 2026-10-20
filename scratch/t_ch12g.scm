(define (mex lst)
  (let loop ((m 0)) (if (member m lst) (loop (+ m 1)) m)))

;; grundy via memo hash table; moves-fn returns list of reachable positions
(define grundy-cache (make-hash-table))
(define (grundy pos moves-fn)
  (let ((cached (hash-table-ref/default grundy-cache pos #f)))
    (or cached
        (let* ((nexts (moves-fn pos))
               (gs    (map (lambda (p) (grundy p moves-fn)) nexts))
               (g     (mex gs)))
          (hash-table-set! grundy-cache pos g)
          g))))

(define (sub-moves n)
  (filter (lambda (x) (>= x 0)) (map (lambda (k) (- n k)) '(1 2 3))))
(display (grundy 0 sub-moves)) (newline)  ;; 0
(display (grundy 1 sub-moves)) (newline)  ;; 1
(display (grundy 4 sub-moves)) (newline)  ;; 0
(display (grundy 5 sub-moves)) (newline)  ;; 1

(define (sub134-moves n)
  (filter (lambda (x) (>= x 0)) (map (lambda (k) (- n k)) '(1 3 4))))
(display (map (lambda (n) (grundy n sub134-moves)) '(0 1 2 3 4 5 6 7 8 9))) (newline)
