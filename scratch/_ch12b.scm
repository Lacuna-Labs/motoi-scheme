(define (multi-lookup key alists)
  (let loop ((alists alists))
    (cond
      ((null? alists) 'nan)
      ((assoc key (car alists))
       (cdr (assoc key (car alists))))
      (else (loop (cdr alists))))))

(display (multi-lookup 'age '(((name . "Alice")) ((age . 30)) ((city . "NYC")))))(newline)
(display (multi-lookup 'height '(((name . "Alice")) ((age . 30)))))(newline)
