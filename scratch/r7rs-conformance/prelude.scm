;; Motoi-side harness for the Chibi r7rs-tests.scm suite.
;; Reimplements the (chibi test) surface used by that file, emitting
;; machine-readable @@ lines on stdout so a Python driver can score it.

(define motoi--errtag (list 'motoi-error-sentinel))

(define (motoi--->str x)
  (let ((p (open-output-string))) (write x p) (get-output-string p)))

(define (motoi--flat s)
  (string-map (lambda (c)
                (if (or (char=? c #\newline) (char=? c #\return)) #\space c))
              s))

;; Motoi's native runtime errors answer #f to error-object? but DO answer
;; error-object-message, and `write` renders them as "#<record>".  So always
;; reach for the message first and fall back to writing the payload.
(define (motoi--err->str e)
  (let* ((m (guard (e2 (#t #f)) (error-object-message e)))
         (irr (guard (e2 (#t '())) (error-object-irritants e)))
         (body (cond ((string? m) m)
                     ((not m) (motoi--->str e))
                     (else (motoi--->str m)))))
    (motoi--flat
     (string-append (if (error-object? e) "ERROR: " "RAISED: ")
                    body
                    (if (or (not (pair? irr)) (null? irr))
                        ""
                        (string-append " irritants=" (motoi--->str irr)))))))

(define (motoi--err? x) (and (pair? x) (eq? (car x) motoi--errtag)))

(define (motoi--try thunk)
  (guard (e (#t (cons motoi--errtag (motoi--err->str e))))
    (thunk)))

(define (motoi--show tag v)
  (display tag)
  (display " ")
  (if (motoi--err? v)
      (begin (display "err ") (display (cdr v)))
      (begin (display "ok ") (display (motoi--flat (motoi--->str v)))))
  (newline))

(define (motoi--run form ethunk athunk)
  (display "\n@@T ")
  (display (motoi--flat (motoi--->str form)))
  (newline)
  (let* ((ev (motoi--try ethunk))
         (av (motoi--try athunk)))
    (motoi--show "@@X" ev)
    (motoi--show "@@A" av)
    (display "@@R ")
    (display (cond ((or (motoi--err? ev) (motoi--err? av)) "FAIL")
                   ((equal? ev av) "PASS")
                   (else "FAIL")))
    (newline)))

(define-syntax test
  (syntax-rules ()
    ((_ name expected expr)
     (motoi--run (quote expr) (lambda () expected) (lambda () expr)))
    ((_ expected expr)
     (motoi--run (quote expr) (lambda () expected) (lambda () expr)))))

(define (motoi--run-pred form thunk want)
  (display "\n@@T ")
  (display (motoi--flat (motoi--->str form)))
  (newline)
  (let ((av (motoi--try thunk)))
    (motoi--show "@@X" (if (eq? want 'error) 'raises-an-error 'a-true-value))
    (motoi--show "@@A" av)
    (display "@@R ")
    (display
     (cond ((eq? want 'error) (if (motoi--err? av) "PASS" "FAIL"))
           ((eq? want 'true) (if (motoi--err? av) "FAIL" (if av "PASS" "FAIL")))
           (else (if (motoi--err? av) "FAIL" (if av "FAIL" "PASS")))))
    (newline)))

(define-syntax test-error
  (syntax-rules ()
    ((_ name expr) (motoi--run-pred (quote expr) (lambda () expr) 'error))
    ((_ expr) (motoi--run-pred (quote expr) (lambda () expr) 'error))))

(define-syntax test-assert
  (syntax-rules ()
    ((_ name expr) (motoi--run-pred (quote expr) (lambda () expr) 'true))
    ((_ expr) (motoi--run-pred (quote expr) (lambda () expr) 'true))))

(define-syntax test-not
  (syntax-rules ()
    ((_ name expr) (motoi--run-pred (quote expr) (lambda () expr) 'false))
    ((_ expr) (motoi--run-pred (quote expr) (lambda () expr) 'false))))

(define-syntax test-values
  (syntax-rules ()
    ((_ expect expr)
     (motoi--run (quote expr)
                 (lambda () (call-with-values (lambda () expect) list))
                 (lambda () (call-with-values (lambda () expr) list))))))

(define (test-begin . o)
  (display "\n@@G ")
  (display (motoi--flat (if (pair? o) (motoi--->str (car o)) "\"\"")))
  (newline))

(define (test-end . o) #f)
(define (test-exit . o) #f)
(define (current-test-epsilon . o) 1e-6)
