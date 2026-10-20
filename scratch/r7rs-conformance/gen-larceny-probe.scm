;; Motoi-side helpers for the flattened Larceny R7RS suite.
;; Larceny's own (tests scheme test) body is spliced in after this, with
;; `run-test` and `capture-output` overridden below it.

(define (motoi--->str x)
  (let ((p (open-output-string))) (write x p) (get-output-string p)))

(define (motoi--flat s)
  (string-map (lambda (c)
                (if (or (char=? c #\newline) (char=? c #\return)) #\space c))
              s))
(define (delete-file fname) #t)
(define (file-exists? fname) #t)
(define (call-with-input-file fname proc)
             (proc (current-input-port)))
(define (with-output-to-file fname thunk) (thunk))
(define &assertion '&assertion)
(define &implementation-restriction '&implementation-restriction)
(define &who '&who)
(define &message '&message)
(define &irritants '&irritants)
(define &error '&error)
(define &syntax '&syntax)
(define &violation '&violation)
(define &non-continuable '&non-continuable)
(define condition-message   error-object-message)
(define condition-who       error-object-message)
(define condition-irritants error-object-irritants)
(define who-condition?      error-object?)
(define error?              error-object?)
(define (for-all f xs . others)
     (cond ((null? xs)
            #t)
           ((apply f (car xs) (map car others))
            (apply for-all f (cdr xs) (map cdr others)))
           (else
            #f)))
(define (exists f xs . others)
     (cond ((null? xs)
            #f)
           ((apply f (car xs) (map car others))
            #t)
           (else
            (apply exists f (cdr xs) (map cdr others)))))
(define (get-string-n p n)
     (let loop ((chars '())
                (i 0))
       (if (= i n)
           (list->string (reverse chars))
           (let ((c (read-char p)))
             (if (char? c)
                 (loop (cons c chars)
                       (+ i 1))
                 (loop chars n))))))
(define-record-type multiple-results
     (make-multiple-results values)
     multiple-results?
     (values multiple-results-values))
(define-record-type approx
     (make-approx value)
     approx?
     (value approx-value))
(define-record-type alts (make-alts values) alts?
     (values alts-values))
(define-syntax test
     (syntax-rules ()
       ((_ expr expected)
        (begin
         ;; (write 'expr) (newline)
         (run-test 'expr
                   (catch-exns (lambda () expr))
                   expected)))))
(define (catch-exns thunk)
     (guard (c (#t &error))
      (call-with-values thunk
       (lambda x
         (if (= 1 (length x))
             (car x)
             (make-multiple-results x))))))
(define-syntax test/approx
     (syntax-rules ()
      ((_ expr expected)
       (run-test 'expr
                 (make-approx expr)
                 (make-approx expected)))))
(define-syntax test/alts
     (syntax-rules ()
      ((_ expr expected0 expected ...)
       (run-test 'expr
                 expr
                 (make-alts (list expected0 expected ...))))))
(define (good-enough? x y)
     ;; relative error should be with 0.1%, but greater
     ;; relative error is allowed when the expected value
     ;; is near zero.
     (cond ((not (number? x)) #f)
           ((not (number? y)) #f)
           ((or (not (real? x))
                (not (real? y)))
            (and (good-enough? (real-part x) (real-part y))
                 (good-enough? (imag-part x) (imag-part y))))
           ((infinite? x)
            (= x (* 2.0 y)))
           ((infinite? y)
            (= (* 2.0 x) y))
           ((nan? y)
            (nan? x))
           ((> (magnitude y) 1e-6)
            (< (/ (magnitude (- x y))
                  (magnitude y))
               1e-3))
           (else
            (< (magnitude (- x y)) 1e-6))))
(define-syntax test/exn
     (syntax-rules ()
      ((_ expr condition)
       (test (guard (c (#t
                        condition))
                    expr)
             condition))))
(define-syntax test/values
     (syntax-rules ()
      ((_ expr val ...)
       (run-test 'expr
                 (catch-exns (lambda () expr))
                 (make-multiple-results (list val ...))))))
(define-syntax test/output
     (syntax-rules ()
      ((_ expr expected str)
       (run-test 'expr
                 (capture-output
                  (lambda ()
                    (run-test 'expr
                              (guard (c (#t &error))
                                     expr)
                              expected)))
                 str))))
(define-syntax test/unspec
     (syntax-rules ()
      ((_ expr)
       (test (begin expr 'unspec) 'unspec))))
(define-syntax test/unspec-or-exn
     (syntax-rules ()
      ((_ expr condition)
       (test (guard (c (#t
                        'unspec))
                    (begin expr 'unspec))
             'unspec))))
(define-syntax test/unspec-flonum-or-exn
     (syntax-rules ()
      ((_ expr condition)
       (test (guard (c (#t
                        'unspec-or-flonum))
                     (let ((v expr))
                       (if (and (number? v)
                                (inexact? v)
                                (real? v))
                           'unspec-or-flonum
                           (if (eq? v 'unspec-or-flonum)
                               (list v)
                               v))))
             'unspec-or-flonum))))
(define-syntax test/output/unspec
     (syntax-rules ()
      ((_ expr str)
       (test/output (begin expr 'unspec) 'unspec str))))
(define checked 0)
(define failures '())
(define (same-result? got expected)
     (cond
      ((and (real? expected) (nan? expected))
       (and (real? got) (nan? got)))
      ((approx? expected)
       (and (approx? got)
            (good-enough? (approx-value expected)
                          (approx-value got))))
      ((multiple-results? expected)
       (and (multiple-results? got)
            (= (length (multiple-results-values expected))
               (length (multiple-results-values got)))
            (for-all same-result?
                     (multiple-results-values expected)
                     (multiple-results-values got))))
      ((alts? expected)
       (exists (lambda (e) (same-result? got e))
               (alts-values expected)))
      (else (equal? got expected))))
(define (write-result prefix v)
     (cond
      ((multiple-results? v)
       (for-each (lambda (v)
                   (write-result prefix v))
                 (multiple-results-values v)))
      ((approx? v)
       (display prefix)
       (display "approximately ")
       (write (approx-value v)))
      ((alts? v)
       (write-result (string-append prefix "   ")
                     (car (alts-values v)))
       (for-each (lambda (v)
                   (write-result (string-append prefix "OR ")
                                 v))
                 (cdr (alts-values v))))
      (else
       (display prefix)
       (write v))))
;; Overrides applied AFTER Larceny's own test-library body.
;; Only two things change: where results are reported, and how output is
;; captured (Motoi has no (scheme file), so we use a string port instead of
;; Larceny's temp-file dance).  The comparison logic stays Larceny's own
;; `same-result?`, including its approx / multiple-results / alts handling.

(define (motoi--render v)
  (cond ((multiple-results? v)
         (string-append "values " (motoi--->str (multiple-results-values v))))
        ((approx? v)
         (string-append "approx " (motoi--->str (approx-value v))))
        ((alts? v)
         (string-append "one-of " (motoi--->str (alts-values v))))
        (else (motoi--->str v))))

(define (capture-output thunk) (with-output-to-string thunk))

(define (run-test expr got expected)
  (display "\n@@T ")
  (display (motoi--flat (motoi--->str expr)))
  (newline)
  (display "@@X ok ")
  (display (motoi--flat (motoi--render expected)))
  (newline)
  (display "@@A ok ")
  (display (motoi--flat (motoi--render got)))
  (newline)
  (display "@@R ")
  (display (if (guard (e (#t #f)) (if (same-result? got expected) #t #f))
               "PASS" "FAIL"))
  (newline))

(define (report-test-results) #f)

(display "\n@@START\n")
(display "\n@@F 0\n")
(define reverse-subtract
     (lambda (x y) (- y x)))
(display "\n@@F 1\n")
(define add4
     (let ((x 4))
       (lambda (y) (+ x y))))
(display "\n@@F 2\n")
(define xxx 2)
(display "\n@@F 3\n")
(define radix
     (make-parameter
      10
      (lambda (x)
        (if (and (exact-integer? x) (<= 2 x 16))
            x
            (error "invalid radix")))))
(display "\n@@F 4\n")
(define (f n) (number->string n (radix)))
(display "\n@@F 7\n")
(include "tests/scheme/base-test3.scm")
(display "\n@@DONE\n")
