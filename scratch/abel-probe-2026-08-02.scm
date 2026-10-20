;; Abel Sussman — probe for the three silent-wrong defects in lib/base/r7rs-small.js
;; Run: MOTOI_HOME=$(mktemp -d) ./bin/motoi run scratch/abel-probe-2026-08-02.scm

(display "== 1. cxr family ==") (newline)

(display "A1 (caar (list 1 2))            expect: ERROR   got: ")
(display (caar (list 1 2))) (newline)

(display "A2 (cdddr (list 1))             expect: ERROR   got: ")
(display (cdddr (list 1))) (newline)

(display "A3 (caar (list (list 1 2) 3))   expect: 1       got: ")
(display (caar (list (list 1 2) 3))) (newline)

(display "A4 (cdar (list (cons 'a 1)))    expect: 1       got: ")
(display (cdar (list (cons 'a 1)))) (newline)

(display "A5 (cddr (list 1 2 3))          expect: (3)     got: ")
(display (cddr (list 1 2 3))) (newline)

(display "A6 (cadddr (list 1 2 3 4))      expect: 4       got: ")
(display (cadddr (list 1 2 3 4))) (newline)

(display "A7 (caddr (list 1 2))           expect: ERROR   got: ")
(display (caddr (list 1 2))) (newline)

(display "A8 (number? (caar (list 1 2)))  expect: ERROR   got: ")
(display (number? (caar (list 1 2)))) (newline)

(newline)
(display "== 2. list-set! ==") (newline)

(define L (list 1 2 3))
(display "B1 (list-set! L 5 'x) then L    expect: ERROR   got: ")
(list-set! L 5 'x)
(display L) (newline)

(display "B2 (list-set! (list) 0 'x)      expect: ERROR   got: ")
(list-set! (list) 0 'x)
(display "no error") (newline)

(display "B3 (null? '()) after B2         expect: #t      got: ")
(display (null? '())) (newline)

(display "B4 (list-set! L 0 'ok) then L   expect: (ok 2 3) got: ")
(define M (list 1 2 3))
(list-set! M 0 'ok)
(display M) (newline)

(newline)
(display "== 3. assv / memv (eqv? semantics) ==") (newline)

(display "C1 (memv 1/2 (list 1/3 1/2))    expect: (1/2)   got: ")
(display (memv 1/2 (list 1/3 1/2))) (newline)

(display "C2 (assv 1/2 (list (cons 1/3 'a) (cons 1/2 'b))) expect: (1/2 . b) got: ")
(display (assv 1/2 (list (cons 1/3 'a) (cons 1/2 'b)))) (newline)

(display "C3 (memv 2 (list 1 2 3))        expect: (2 3)   got: ")
(display (memv 2 (list 1 2 3))) (newline)

(display "C4 (assv 'b (list (cons 'a 1) (cons 'b 2))) expect: (b . 2) got: ")
(display (assv 'b (list (cons 'a 1) (cons 'b 2)))) (newline)

(display "C5 (memv (list 1) (list (list 1) 2)) expect: #f got: ")
(display (memv (list 1) (list (list 1) 2))) (newline)

(display "C6 (memv (make-rectangular 3 4) (list (make-rectangular 1 1) (make-rectangular 3 4))) expect: non-#f got: ")
(display (if (memv (make-rectangular 3 4) (list (make-rectangular 1 1) (make-rectangular 3 4))) "found" "#f")) (newline)

(display "C7 (memv 1/2 (list 0.5))        expect: #f      got: ")
(display (memv 1/2 (list 0.5))) (newline)

(display "C8 (memv #\\b (list #\\a #\\b))   expect: non-#f  got: ")
(display (if (memv #\b (list #\a #\b)) "found" "#f")) (newline)

(display "C9 (assv 4/2 (list (cons 2 'two))) expect: (2 . two) got: ")
(display (assv 4/2 (list (cons 2 'two)))) (newline)

(display "done") (newline)
