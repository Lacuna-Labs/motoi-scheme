(define (make-hash . kvs)
  (let ((h (make-hash-table)))
    (let loop ((xs kvs))
      (if (or (null? xs) (null? (cdr xs)))
          h
          (begin (hash-table-set! h (car xs) (cadr xs))
                 (loop (cddr xs)))))))

(display
 (filter (lambda (person)
           (and (>= (hash-table-ref/default person ':age #f) 18)
                (< (string-length (hash-table-ref/default person ':name #f)) 5)))
         (list (make-hash ':name "Ali" ':age 22)
               (make-hash ':name "Bernardo" ':age 19)
               (make-hash ':name "Max" ':age 17)
               (make-hash ':name "Jo" ':age 25))))
