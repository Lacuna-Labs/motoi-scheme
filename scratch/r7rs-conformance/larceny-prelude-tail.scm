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
