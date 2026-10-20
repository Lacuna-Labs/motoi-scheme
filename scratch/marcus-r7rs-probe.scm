; marcus-r7rs-probe.scm — eleven-item probe for the R7RS-small shim defects.
; Run: MOTOI_HOME=$(mktemp -d) ./bin/motoi run scratch/marcus-r7rs-probe.scm

(define (show label v) (display label) (display " => ") (display v) (newline))

(display "── 1..5 complex ──") (newline)
(define z (complex/make 3 4))
(show "(complex/->string z)" (complex/->string z))
(show "(real-part z)" (real-part z))
(show "(imag-part z)" (imag-part z))
(show "(magnitude z)" (magnitude z))
(show "(angle z)" (angle z))
(show "(real-part 7)" (real-part 7))
(show "(imag-part 7)" (imag-part 7))
(show "(magnitude -7)" (magnitude -7))
(show "(angle -7)" (angle -7))
(show "(angle 1)" (angle 1))

(display "(real-part \"hi\") => ")
(display (with-exception-handler
           (lambda (e) (list 'raised (error-object-message e)))
           (lambda () (real-part "hi"))))
(newline)

(display "(make-rectangular 3 4) => ")
(display (with-exception-handler
           (lambda (e) (list 'raised (error-object-message e)))
           (lambda () (complex/->string (make-rectangular 3 4)))))
(newline)

(display "(make-polar 1 0) => ")
(display (with-exception-handler
           (lambda (e) (list 'raised (error-object-message e)))
           (lambda () (complex/->string (make-polar 1 0)))))
(newline)

(display "── 6 features ──") (newline)
(show "(features)" (features))
(show "(exact? (/ 1 3))" (exact? (/ 1 3)))
(show "(/ 1 3)" (/ 1 3))

(display "── 7 exit / emergency-exit ──") (newline)
(display "(procedure? exit) => ")
(display (with-exception-handler
           (lambda (e) (list 'raised (error-object-message e)))
           (lambda () (procedure? exit))))
(newline)
(display "(procedure? emergency-exit) => ")
(display (procedure? emergency-exit))
(newline)

(display "── 8 get-environment-variables ──") (newline)
(define ev (get-environment-variables))
(show "(pair? (car ev))" (pair? (car ev)))
(show "(car (car ev))" (car (car ev)))
(show "(cdr (car ev))" (cdr (car ev)))
(show "(string? (cdr (car ev)))" (string? (cdr (car ev))))

(display "── 9 error-object-type ──") (newline)
(display "(error-object-type 42) => ")
(display (with-exception-handler
           (lambda (e) (list 'raised (error-object-message e)))
           (lambda () (error-object-type 42))))
(newline)
(show "typed condition" (with-exception-handler
                          (lambda (e) (error-object-type e))
                          (lambda () (escalate 'over-budget 500))))
(show "error condition" (with-exception-handler
                          (lambda (e) (error-object-type e))
                          (lambda () (error "plain"))))

(display "── 10 file-error? ──") (newline)
(show "(file-error? 'anything)" (file-error? 'anything))
(show "(file-error? (make-file-error \"no such file\" \"/nope\"))"
      (file-error? (with-exception-handler (lambda (e) e)
                     (lambda () (escalate 'file-error "/nope")))))
(show "(file-error? (error-cond))" (with-exception-handler
                                     (lambda (e) (file-error? e))
                                     (lambda () (error "disk full"))))

(display "── 11 last-error ──") (newline)
(show "(last-error)" (last-error))
(show "(null? (last-error))" (null? (last-error)))
(show "(boolean? (last-error))" (boolean? (last-error)))
(show "(eq? (last-error) #f)" (eq? (last-error) #f))
