;; Motoi-side helpers for the flattened Larceny R7RS suite.
;; Larceny's own (tests scheme test) body is spliced in after this, with
;; `run-test` and `capture-output` overridden below it.

(define (motoi--->str x)
  (let ((p (open-output-string))) (write x p) (get-output-string p)))

(define (motoi--flat s)
  (string-map (lambda (c)
                (if (or (char=? c #\newline) (char=? c #\return)) #\space c))
              s))
