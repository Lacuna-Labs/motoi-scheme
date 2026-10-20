#!/bin/bash
# weh-record-probe-2026-08-03.sh — run every candidate snippet for the rewritten
# with-exception-handler record and print what the engine ACTUALLY says, so the
# :note values are transcribed rather than predicted.
cd /Users/alfred/code/motoi-scheme
run(){ printf '%s\n' "$1" > /tmp/wehprobe.scm
       echo "===== $2"
       MOTOI_HOME=/tmp/mx ./bin/motoi run /tmp/wehprobe.scm 2>&1 | head -6; }

run "(with-exception-handler (lambda (e) 'never-called) (lambda () (* 6 7)))" "E1 thunk returns"
run "(guard (e (#t 'caught)) (error \"boom\"))" "E2 guard is the catcher"
run "(define seen 'not-yet)
(guard (e (#t #t)) (with-exception-handler (lambda (e) (set! seen (error-object-message e))) (lambda () (error \"boom\"))))
(display seen)
(newline)" "E3 handler runs for effect"
run "(guard (e (#t (error-object-message e))) (with-exception-handler (lambda (e) 'ignored) (lambda () (error \"boom\"))))" "E4 secondary condition"
run "(with-exception-handler (lambda (e) 42) (lambda () (list 'before (raise-continuable 'x) 'after)))" "E5 raise-continuable resumes"
run "(guard (e (#t (list 'outer e))) (with-exception-handler (lambda (e) (raise (list 'rethrown e))) (lambda () (raise 'first))))" "E6 handler escapes by raising"

# ---- row 2 audit
run "(define (load-config raw)
  (guard (e (#t (list 'defaults)))
    (if (string? raw) (list 'parsed raw) (error \"config is not text\" raw))))
(display (list (load-config \"depth=3\") (load-config 42)))
(newline)" "R2 eng"
run "(define (safe-recip x)
  (guard (e (#t 'undefined)) (if (zero? x) (error \"no reciprocal of zero\") (/ 1 x))))
(display (map safe-recip (list 4 0 -2)))
(newline)" "R2 math"
run "(define (audit thunk)
  (define note 'clean)
  (guard (e (#t (list note (error-object-message e))))
    (with-exception-handler (lambda (c) (set! note 'handler-ran)) thunk)))
(display (audit (lambda () (error \"disk full\"))))
(newline)" "R2 cs"

# ---- row 3 dimension
run "(with-exception-handler (lambda (e) (display (list 'logging (error-object-message e))) (newline) (raise e)) (lambda () (error \"sensor offline\")))" "R3 rung1 raw (expected: logs then dies)"
run "(guard (top (#t 'reported))
  (with-exception-handler (lambda (e) (display (list 'logging (error-object-message e))) (newline) (raise e))
    (lambda () (error \"sensor offline\"))))" "R3 rung1"
run "(display (map (lambda (x) (guard (e (#t 'undefined)) (if (negative? x) (error \"outside domain\" x) (sqrt x)))) (list 9 -1 16)))
(newline)" "R3 rung2"
run "(display (with-exception-handler (lambda (e) (list 'resumed-with e)) (lambda () (raise-continuable 'stage-2))))
(newline)" "R3 rung3"

# ---- row 4 proof
run "(display (list 'returns (with-exception-handler (lambda (e) 'H) (lambda () 'BODY))
                 'raises  (guard (e (#t 'SECONDARY)) (with-exception-handler (lambda (e) 'H) (lambda () (error \"x\") 'BODY)))
                 'continuable (with-exception-handler (lambda (e) 'H) (lambda () (raise-continuable 'x)))))
(newline)" "R4 eng"
run "(display (guard (e (#t (string? (error-object-message e)))) (with-exception-handler (lambda (e) 'handler-value) (lambda () (error \"any\")))))
(newline)" "R4 math"
run "(display (with-exception-handler (lambda (e) 'never) (lambda () (+ 1 2))))
(newline)" "R4 cs"

# ---- row 5 emergence
run "(define (retry n thunk)
  (if (= n 0) 'gave-up (guard (e (#t (retry (- n 1) thunk))) (thunk))))
(define tries 0)
(display (retry 3 (lambda () (set! tries (+ tries 1)) (if (< tries 3) (error \"flaky\") (list 'ok-after tries)))))
(newline)" "R5 eng"
run "(define (first-defined xs f)
  (if (null? xs) 'none (guard (e (#t (first-defined (cdr xs) f))) (f (car xs)))))
(display (first-defined (list -4 -1 25) (lambda (x) (if (negative? x) (error \"outside domain\") (sqrt x)))))
(newline)" "R5 math"
run "(define (with-trace thunk)
  (define trail '())
  (define answer (guard (e (#t (list 'stopped (error-object-message e))))
                   (with-exception-handler (lambda (c) (set! trail (cons (error-object-message c) trail))) thunk)))
  (list answer (reverse trail)))
(display (with-trace (lambda () (fold (lambda (stage acc) (stage acc)) 2 (list (lambda (x) (* x 10)) (lambda (x) (if (> x 15) (error \"too big\" x) x)))))))
(newline)" "R5 cs"
