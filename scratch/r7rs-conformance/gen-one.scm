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

(define reverse-subtract
  (lambda (x y) (- y x)))
(define add4
  (let ((x 4))
    (lambda (y) (+ x y))))
(define (means ton)
  (letrec*
     ((mean
        (lambda (f g)
          (f (/ (sum g ton) n))))
      (sum
        (lambda (g ton)
          (if (null? ton)
            (+)
            (if (number? ton)
                (g ton)
                (+ (sum g (car ton))
                   (sum g (cdr ton)))))))
      (n (sum (lambda (x) 1) ton)))
    (values (mean values values)
            (mean exp log)
            (mean / /))))
(let*-values (((a b c) (means '(8 5 99 1 22))))
  (test 27 a)
  (test 9.728 b)
  (test 1800/497 c))
(let*-values (((root rem) (exact-integer-sqrt 32)))
  (test 35 (* root rem)))
(let*-values (((root rem) (exact-integer-sqrt (expt 2 140))))
  (test 0 rem)
  (test (expt 2 140) (square root)))
(define integers
  (letrec ((next
            (lambda (n)
              (delay (cons n (next (+ n 1)))))))
    (next 0)))
(define head
  (lambda (stream) (car (force stream))))
(define tail
  (lambda (stream) (cdr (force stream))))
(define (stream-filter p? s)
  (delay-force
   (if (null? (force s)) 
       (delay '())
       (let ((h (car (force s)))
             (t (cdr (force s))))
         (if (p? h)
             (delay (cons h (stream-filter p? t)))
             (stream-filter p? t))))))
(define radix
  (make-parameter
   10
   (lambda (x)
     (if (and (integer? x) (<= 2 x 16))
         x
         (error "invalid radix")))))
(define (f n) (number->string n (radix)))
(define any-arity
  (case-lambda 
    (() 'zero)
    ((x) x)
    ((x y) (cons x y))
    ((x y z) (list x y z))
    (args (cons 'many args))))
(define rest-arity
  (case-lambda 
    (() '(zero))
    ((x) (list 'one x))
    ((x y) (list 'two x y))
    ((x y . z) (list 'more x y z))))
(define dead-clause
  (case-lambda
    ((x . y) 'many)
    (() 'none)
    (foo 'unreachable)))
(define-syntax be-like-begin1
  (syntax-rules ()
    ((be-like-begin1 name)
     (define-syntax name
       (syntax-rules ()
         ((name expr (... ...))
          (begin expr (... ...))))))))
(be-like-begin1 sequence1)
(define-syntax be-like-begin2
  (syntax-rules ()
    ((be-like-begin2 name)
     (define-syntax name
       (... (syntax-rules ()
              ((name expr ...)
               (begin expr ...))))))))
(be-like-begin2 sequence2)
(define-syntax be-like-begin3
  (syntax-rules ()
    ((be-like-begin3 name)
     (define-syntax name
       (syntax-rules dots ()
         ((name expr dots)
          (begin expr dots)))))))
(be-like-begin3 sequence3)
(define-syntax elli-esc-1
  (syntax-rules ()
    ((_)
     '(... ...))
    ((_ x)
     '(... (x ...)))
    ((_ x y)
     '(... (... x y)))))
(define-syntax part-2
  (syntax-rules ()
    ((_ a b (m n) ... x y)
     (vector (list a b) (list m ...) (list n ...) (list x y)))
    ((_ . rest) 'error)))
(define-syntax part-2x
  (syntax-rules ()
    ((_ (a b (m n) ... x y . rest))
     (vector (list a b) (list m ...) (list n ...) (list x y)
             (cons "rest:" 'rest)))
    ((_ . rest) 'error)))
(define-syntax underscore
  (syntax-rules ()
    ((foo _) '_)))
(define-syntax count-to-2
  (syntax-rules ()
    ((_) 0)
    ((_ _) 1)
    ((_ _ _) 2)
    ((_ . _) 'many)))
(define-syntax count-to-2_
  (syntax-rules (_)
    ((_) 0)
    ((_ _) 1)
    ((_ _ _) 2)
    ((x . y) 'fail)))
(define-syntax jabberwocky
  (syntax-rules ()
    ((_ hatter)
     (begin
       (define march-hare 42)
       (define-syntax hatter
         (syntax-rules ()
           ((_) march-hare)))))))
(jabberwocky mad-hatter)
(begin
  (define-syntax ffoo
    (syntax-rules ()
      ((ffoo ff)
       (begin
         (define (ff x)
           (gg x))
         (define (gg x)
           (* x x))))))
  (ffoo ff)
  (test 100 (ff 10)))
(let-syntax ((vector-lit
               (syntax-rules ()
                 ((vector-lit)
                  '#(b)))))
  (test '#(b) (vector-lit)))
(let-syntax
    ((m (syntax-rules ()
          ((m x) (let-syntax
                     ((n (syntax-rules (k)
                           ((n x) 'bound-identifier=?)
                           ((n y) 'free-identifier=?))))
                   (n z))))))
  (test 'bound-identifier=? (m k)))
(define add3
  (lambda (x) (+ x 3)))
(define first car)
(define-record-type <pare>
  (kons x y)
  pare?
  (x kar set-kar!)
  (y kdr))
(define gen-counter
  (lambda ()
    (let ((n 0))
      (lambda () (set! n (+ n 1)) n))))
(define gen-loser
  (lambda ()
    (let ((n 0))
      (lambda () (set! n (+ n 1)) 27))))
(define single-float-epsilon
  (do ((eps 1.0 (* eps 2.0)))
      ((= eps (+ eps 1.0)) eps)))
(let* ((a (/ 10.0 single-float-epsilon))
       (j (exact a)))
  (test #t (if (and (<= a j) (< j (+ j 1)))
               (not (<= (+ j 1) a))
               #t)))
(let* ((x (list 'a 'b 'c))
       (y x))
  (test '(a b c) (values y))
  (test #t (list? y))
  (set-cdr! x 4)
  (test '(a . 4) (values x))
  (test #t (eqv? x y))
  (test #f (list? y))
  (set-cdr! x x)
  (test #f (list? x)))
