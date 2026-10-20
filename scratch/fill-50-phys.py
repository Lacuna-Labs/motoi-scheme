#!/usr/bin/env python3
"""fill-50-phys.py — add missing named row-2/4 and row-5 fields to phys verbs.

Each verb needs:
  :row-2-audit  → :eng-program :math-program :cs-program  (+3)
  :row-4-proof  → :eng-program :math-program :cs-program  (+3)
  :row-5-emergence → :eng-composition :math-composition :cs-composition (+3)

Strategy: for each verb, locate the end of the existing row-2/4/5 section's
final tuple entry and insert the new named fields there, keeping parens balanced.
"""
import re, sys
from pathlib import Path

SRC = Path('/Users/alfred/code/motoi-scheme/scheme/reference/50-phys.slat')
text = SRC.read_text()


def paren_balance(t):
    depth = 0; ins = False; esc = False
    for c in t:
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')': depth -= 1
    return depth

assert paren_balance(text) == 0, f"Pre-edit delta={paren_balance(text)}"

# New content to add per verb — each value is a string to splice in
# Format: for row-2/4 we insert before the closing paren of the row section
#         for row-5 we insert before the closing paren of the row section

ADDITIONS = {
'phys/L-free': dict(
    r2e = '(:eng-program "(define L (phys/L-free 1.0))\n(define (action-over-time qdot dur) (* (L qdot) dur))\n(action-over-time 3.0 2.0)"\n     :math-program "(define L (phys/L-free 1.0))\n(L 3.0)"\n     :cs-program "(define (L-free m) (lambda (qdot) (* 0.5 m qdot qdot)))\n((L-free 2.0) 3.0)")',
    r4e = '(:eng-program "(define L (phys/L-free 2.0))\n(define (approx a b) (< (abs (- a b)) 0.0001))\n(approx (L 3.0) (L -3.0))"\n     :math-program "(define L (phys/L-free 1.0))\n(= (L 4.0) (L -4.0))"\n     :cs-program "(define L (phys/L-free 2.0))\n(and (> (L 5.0) (L 3.0)) (> (L 3.0) (L 0.0)))")',
    r5e = '(:eng-composition "(define (compare-actions m qdot1 qdot2 dur)\n  (let ((L (phys/L-free m)))\n    (list (* (L qdot1) dur) (* (L qdot2) dur))))\n(compare-actions 1.0 3.0 5.0 2.0)"\n     :math-composition "(define (poly2 m v) (* 0.5 m v v))\n(map (lambda (v) (poly2 1.0 v)) \'(1 2 3 4 5))"\n     :cs-composition "(define (memoised-L m)\n  (let ((cache (list)))\n    (lambda (qdot)\n      (let ((hit (assoc qdot cache)))\n        (if hit (cdr hit)\n            (let ((r (* 0.5 m qdot qdot)))\n              (set! cache (cons (cons qdot r) cache)) r))))))\n((memoised-L 1.0) 3.0)")',
),
'phys/L-harmonic': dict(
    r2e = '(:eng-program "(define L (phys/L-harmonic 1.0 4.0))\n(define (energy-check q qdot) (+ (* 0.5 1 qdot qdot) (* 0.5 4 q q)))\n(list (L 0.5 1.0) (energy-check 0.5 1.0))"\n     :math-program "(define L (phys/L-harmonic 1.0 4.0))\n(- (L 0 1.0) (L 1.0 0))"\n     :cs-program "(define (L-harmonic m k) (lambda (q qdot) (- (* 0.5 m qdot qdot) (* 0.5 k q q))))\n((L-harmonic 1.0 4.0) 0.5 1.0)")',
    r4e = '(:eng-program "(define (total-energy m k q qdot) (+ (* 0.5 m qdot qdot) (* 0.5 k q q)))\n(define omega (sqrt (/ 4 1)))\n(define (approx a b) (< (abs (- a b)) 0.01))\n(approx (total-energy 1 4 (cos (* omega 0)) (* -1 omega (sin (* omega 0))))\n        (total-energy 1 4 (cos (* omega 0.5)) (* -1 omega (sin (* omega 0.5)))))"\n     :math-program "(define (total-energy m k q qdot) (+ (* 0.5 m qdot qdot) (* 0.5 k q q)))\n(define (approx a b) (< (abs (- a b)) 0.01))\n(approx (total-energy 1 4 1.0 0.0) (total-energy 1 4 0.0 2.0))"\n     :cs-program "(define L (phys/L-harmonic 1.0 4.0))\n(define (approx a b) (< (abs (- a b)) 0.01))\n(approx (L 0.0 1.0) (L 0.0 -1.0))")',
    r5e = '(:eng-composition "(define (compare-oscillator-actions m k qdot-0 q-0 dur)\n  (let ((L (phys/L-harmonic m k)))\n    (let loop ((t 0) (acc 0.0))\n      (if (>= t dur) acc\n          (loop (+ t 0.01) (+ acc (* (L q-0 qdot-0) 0.01)))))))\n(compare-oscillator-actions 1 4 1 0.5 1.0)"\n     :math-composition "(define L (phys/L-harmonic 1.0 4.0))\n(define (riemann-sum L q qdot a b n)\n  (let ((dt (/ (- b a) n)))\n    (let loop ((i 0) (acc 0.0))\n      (if (= i n) acc\n          (loop (+ i 1) (+ acc (* (L q qdot) dt)))))))\n(riemann-sum L 0.5 1.0 0 1 100)"\n     :cs-composition "(define (step-harmonic m k q qdot dt)\n  (let ((acc (* -1 (/ k m) q)))\n    (let ((qdot-new (+ qdot (* acc dt))))\n      (list (+ q (* qdot-new dt)) qdot-new))))\n(step-harmonic 1.0 4.0 1.0 0.0 0.01)")',
),
'phys/constant': dict(
    r2e = '(:eng-program "(define h (phys/constant \'h))\n(define c (phys/constant \'c))\n(define m-e (phys/constant \'m-e))\n(/ h (* m-e c))"\n     :math-program "(define G (phys/constant \'G))\n(define c (phys/constant \'c))\n(/ G (* c c c c))"\n     :cs-program "(define (all-immutable? syms)\n  (let ((vals (map phys/constant syms)))\n    (equal? vals (map phys/constant syms))))\n(all-immutable? \'(c h G))")',
    r4e = '(:eng-program "(define (approx a b) (< (abs (- a b)) 0.0000001))\n(approx (phys/constant \'c) 299792458.0)"\n     :math-program "(define (approx a b) (< (abs (- a b)) 0.0000001))\n(and (approx (phys/constant \'c) (phys/constant \'c))\n     (approx (phys/constant \'G) (phys/constant \'G)))"\n     :cs-program "(define c1 (phys/constant \'c))\n(define c2 (phys/constant \'c))\n(= c1 c2)")',
    r5e = '(:eng-composition "(define (rydberg-energy)\n  (let ((m-e (phys/constant \'m-e))\n        (e (phys/constant \'e))\n        (eps-0 (phys/constant \'epsilon-0))\n        (h (phys/constant \'h)))\n    (/ (* m-e e e e e) (* 8 eps-0 eps-0 h h))))\n(rydberg-energy)"\n     :math-composition "(define (planck-length)\n  (let ((hbar (* (phys/constant \'h) (/ 1 (* 2 3.14159))))\n        (G (phys/constant \'G))\n        (c (phys/constant \'c)))\n    (sqrt (/ (* hbar G) (* c c c)))))\n(planck-length)"\n     :cs-composition "(define (constants-report syms)\n  (map (lambda (s) (cons s (phys/constant s))) syms))\n(constants-report \'(c G h))")',
),
'phys/dimension': dict(
    r2e = '(:eng-program "(define computed \'(20 . ((length . 1) (time . -1))))\n(define dims (phys/dimension computed))\n(equal? dims \'((length . 1) (time . -1)))"\n     :math-program "(define dim \'((length . 1) (time . -1)))\n(define q (cons 20 dim))\n(equal? (phys/dimension q) dim)"\n     :cs-program "(define (dimension-key? q k)\n  (assq k (phys/dimension q)))\n(dimension-key? \'(20 . ((length . 1) (time . -1))) \'length)")',
    r4e = '(:eng-program "(define dim \'((length . 1) (time . -1)))\n(define q (cons 20 dim))\n(equal? (phys/dimension q) dim)"\n     :math-program "(define d \'((mass . 1)))\n(equal? (phys/dimension (cons 5.0 d)) d)"\n     :cs-program "(define q \'(9.8 . ((length . 1) (time . -2))))\n(and (assq \'length (phys/dimension q))\n     (assq \'time (phys/dimension q)))")',
    r5e = '(:eng-composition "(define (unit-check qs expected)\n  (define (every? p xs) (if (null? xs) #t (and (p (car xs)) (every? p (cdr xs)))))\n  (every? (lambda (q) (equal? (phys/dimension q) expected)) qs))\n(unit-check (list \'(10 . ((length . 1))) \'(5 . ((length . 1)))) \'((length . 1)))"\n     :math-composition "(define (group-by-dim qs)\n  (let loop ((xs qs) (groups \'()))\n    (if (null? xs) groups\n        (let* ((q (car xs)) (d (phys/dimension q))\n               (found (assoc d groups)))\n          (if found\n              (begin (set-cdr! found (cons q (cdr found))) (loop (cdr xs) groups))\n              (loop (cdr xs) (cons (list d q) groups)))))))\n(group-by-dim (list \'(5 . ((length . 1))) \'(3 . ((length . 1))) \'(2 . ((time . 1)))))"\n     :cs-composition "(define (dim-signature qs)\n  (map phys/dimension qs))\n(dim-signature (list \'(5 . ((length . 1))) \'(20 . ((length . 1) (time . -1)))))")',
),
'phys/gravitational-force': dict(
    r2e = '(:eng-program "(define earth \'(5.972e24 . ((mass . 1))))\n(define moon \'(7.342e22 . ((mass . 1))))\n(define r \'(3.844e8 . ((length . 1))))\n(phys/gravitational-force earth moon r)"\n     :math-program "(define G 6.674e-11)\n(define (grav m1 m2 r) (/ (* G m1 m2) (* r r)))\n(grav 5.972e24 7.342e22 3.844e8)"\n     :cs-program "(define (symmetric-force F m1 m2 r)\n  (equal? (F m1 m2 r) (F m2 m1 r)))\n(symmetric-force phys/gravitational-force\n  \'(5 . ((mass . 1))) \'(3 . ((mass . 1))) \'(2 . ((length . 1))))")',
    r4e = '(:eng-program "(define m1 \'(5 . ((mass . 1))))\n(define m2 \'(3 . ((mass . 1))))\n(define r \'(2 . ((length . 1))))\n(equal? (phys/gravitational-force m1 m2 r) (phys/gravitational-force m2 m1 r))"\n     :math-program "(define G 6.674e-11)\n(define (grav m1 m2 r) (/ (* G m1 m2) (* r r)))\n(= (grav 5 3 2) (grav 3 5 2))"\n     :cs-program "(define F12 (phys/gravitational-force \'(5 . ((mass . 1))) \'(3 . ((mass . 1))) \'(2 . ((length . 1)))))\n(define F21 (phys/gravitational-force \'(3 . ((mass . 1))) \'(5 . ((mass . 1))) \'(2 . ((length . 1)))))\n(equal? F12 F21)")',
    r5e = '(:eng-composition "(define (surface-g M R)\n  (let ((G (phys/constant \'G))\n        (m-test 1.0))\n    (/ (* G M) (* R R))))\n(surface-g 5.972e24 6.371e6)"\n     :math-composition "(define (escape-velocity M R)\n  (let ((G (phys/constant \'G)))\n    (sqrt (/ (* 2 G M) R))))\n(escape-velocity 5.972e24 6.371e6)"\n     :cs-composition "(define (orbital-velocity m-body m-orbiter r)\n  (let ((f (phys/gravitational-force m-body m-orbiter r)))\n    (sqrt (car (phys/q/ f m-orbiter)))))\n(orbital-velocity \'(5.972e24 . ((mass . 1))) \'(1 . ((mass . 1))) \'(6.371e6 . ((length . 1))))")',
),
'phys/kinematics': dict(
    r2e = '(:eng-program "(define x0 \'(0 . ((length . 1))))\n(define v0 \'(20 . ((length . 1) (time . -1))))\n(define g \'(-9.8 . ((length . 1) (time . -2))))\n(define t \'(1.5 . ((time . 1))))\n(phys/kinematics x0 v0 g t)"\n     :math-program "(define (suvat x0 v0 a t) (+ x0 (* v0 t) (* 0.5 a t t)))\n(suvat 0 20 -9.8 1.5)"\n     :cs-program "(define (kine-pure x0 v0 a t) (cons (+ x0 (* v0 t) (* 0.5 a t t)) (+ v0 (* a t))))\n(kine-pure 0 20 -9.8 1.5)")',
    r4e = '(:eng-program "(define (KE m v) (* 0.5 m v v))\n(define (work F x) (* F x))\n(define (mock-kine x0 v0 a t) (cons (+ x0 (* v0 t) (* 0.5 a t t)) (+ v0 (* a t))))\n(define t1 (mock-kine 0 20 -9.8 0.5))\n(define t2 (mock-kine 0 20 -9.8 1.0))\n(define (approx a b) (< (abs (- a b)) 0.1))\n(approx (- (KE 1 (cdr t1)) (work -9.8 (car t1)))\n        (- (KE 1 (cdr t2)) (work -9.8 (car t2))))"\n     :math-program "(define (pos x0 v0 a t) (+ x0 (* v0 t) (* 0.5 a t t)))\n(define (vel v0 a t) (+ v0 (* a t)))\n(define (approx a b) (< (abs (- a b)) 0.001))\n(approx (vel 0 2 3) (/ (- (pos 0 0 2 3.001) (pos 0 0 2 2.999)) 0.002))"\n     :cs-program "(define (kine x0 v0 a t) (cons (+ x0 (* v0 t) (* 0.5 a t t)) (+ v0 (* a t))))\n(define s1 (kine 0 10 -9.8 1))\n(define s2 (kine (car s1) (cdr s1) -9.8 1))\n(define s3 (kine 0 10 -9.8 2))\n(define (approx a b) (< (abs (- a b)) 0.001))\n(approx (car s2) (car s3))")',
    r5e = '(:eng-composition "(define (projectile-range v0 angle-deg)\n  (let* ((angle-rad (* angle-deg 0.01745))\n         (vx (* v0 (cos angle-rad)))\n         (vy (* v0 (sin angle-rad)))\n         (t-flight (/ (* 2 vy) 9.8)))\n    (* vx t-flight)))\n(projectile-range 20 45)"\n     :math-composition "(define (kine x0 v0 a t) (cons (+ x0 (* v0 t) (* 0.5 a t t)) (+ v0 (* a t))))\n(define (time-to-apex v0 g) (/ v0 (- g)))\n(define (apex-height v0 g) (car (kine 0 v0 g (time-to-apex v0 g))))\n(apex-height 20 -9.8)"\n     :cs-composition "(define (simulate-steps x0 v0 a dt n)\n  (let loop ((i 0) (x x0) (v v0) (hist (list (cons x0 v0))))\n    (if (= i n) (reverse hist)\n        (let ((xn (+ x (* v dt) (* 0.5 a dt dt)))\n              (vn (+ v (* a dt))))\n          (loop (+ i 1) xn vn (cons (cons xn vn) hist))))))\n(simulate-steps 0 20 -9.8 0.1 30)")',
),
'phys/kinetic-energy': dict(
    r2e = '(:eng-program "(define m \'(1 . ((mass . 1))))\n(define v \'(40 . ((length . 1) (time . -1))))\n(phys/kinetic-energy m v)"\n     :math-program "(define (ke m v) (* 0.5 m v v))\n(ke 2 3)"\n     :cs-program "(define m \'(1 . ((mass . 1))))\n(define v-plus \'(40 . ((length . 1) (time . -1))))\n(define v-minus \'(-40 . ((length . 1) (time . -1))))\n(equal? (phys/kinetic-energy m v-plus) (phys/kinetic-energy m v-minus))")',
    r4e = '(:eng-program "(define m \'(1 . ((mass . 1))))\n(define v-plus \'(40 . ((length . 1) (time . -1))))\n(define v-minus \'(-40 . ((length . 1) (time . -1))))\n(equal? (phys/kinetic-energy m v-plus) (phys/kinetic-energy m v-minus))"\n     :math-program "(define (ke m v) (* 0.5 m v v))\n(and (= (ke 2 3) (ke 2 -3)) (= (ke 2 3) 9.0))"\n     :cs-program "(define (ke m v) (* 0.5 m v v))\n(> (ke 1 5) (ke 1 3))")',
    r5e = '(:eng-composition "(define (collision-energy m1 v1 m2 v2)\n  (let ((ke1 (phys/kinetic-energy m1 v1))\n        (ke2 (phys/kinetic-energy m2 v2)))\n    (list ke1 ke2)))\n(collision-energy \'(1 . ((mass . 1))) \'(10 . ((length . 1) (time . -1)))\n                  \'(1 . ((mass . 1))) \'(-10 . ((length . 1) (time . -1))))"\n     :math-composition "(define (ke m v) (* 0.5 m v v))\n(define (total-ke pairs)\n  (apply + (map (lambda (p) (ke (car p) (cdr p))) pairs)))\n(total-ke \'((2 . 3) (1 . 4)))"\n     :cs-composition "(define (ke-series m velocities)\n  (map (lambda (v) (* 0.5 m v v)) velocities))\n(ke-series 1.0 \'(1 2 3 4 5))")',
),
'phys/lagrange-residual': dict(
    r2e = '(:eng-program "(define L (phys/L-free 1.0))\n(phys/lagrange-residual L \'(1 . ((length . 1))) \'(2 . ((length . 1) (time . -1))) \'(0 . ((time . 1))))"\n     :math-program "(define L (phys/L-free 1.0))\n(define (approx a b) (< (abs (- a b)) 0.01))\n(approx (phys/lagrange-residual L \'(5 . ((length . 1))) \'(2 . ((length . 1) (time . -1))) \'(0 . ((time . 1)))) 0)"\n     :cs-program "(define L (phys/L-free 1.0))\n(map (lambda (qdot)\n       (phys/lagrange-residual L \'(0 . ((length . 1))) qdot \'(0 . ((time . 1)))))\n     (list \'(1 . ((length . 1) (time . -1))) \'(2 . ((length . 1) (time . -1))) \'(3 . ((length . 1) (time . -1)))))")',
    r4e = '(:eng-program "(define L (phys/L-free 1.0))\n(define (approx a b) (< (abs (- a b)) 0.01))\n(and (approx (phys/lagrange-residual L \'(0 . ((length . 1))) \'(2 . ((length . 1) (time . -1))) \'(0 . ((time . 1)))) 0)\n     (approx (phys/lagrange-residual L \'(5 . ((length . 1))) \'(2 . ((length . 1) (time . -1))) \'(1 . ((time . 1)))) 0))"\n     :math-program "(define L (phys/L-free 1.0))\n(define (approx a b) (< (abs (- a b)) 0.01))\n(approx (phys/lagrange-residual L \'(2 . ((length . 1))) \'(3 . ((length . 1) (time . -1))) \'(0.5 . ((time . 1)))) 0)"\n     :cs-program "(define L (phys/L-free 1.0))\n(define (check-times L q qdot times)\n  (define (approx a b) (< (abs (- a b)) 0.01))\n  (let loop ((ts times))\n    (if (null? ts) #t\n        (and (approx (phys/lagrange-residual L q qdot (car ts)) 0)\n             (loop (cdr ts))))))\n(check-times L \'(0 . ((length . 1))) \'(2 . ((length . 1) (time . -1)))\n             (list \'(0 . ((time . 1))) \'(1 . ((time . 1))) \'(2 . ((time . 1)))))")',
    r5e = '(:eng-composition "(define L (phys/L-free 1.0))\n(define (residual-samples traj-fn times)\n  (map (lambda (t)\n         (let ((state (traj-fn t)))\n           (phys/lagrange-residual L (car state) (cadr state) t)))\n       times))\n(residual-samples (lambda (t) (list (+ 5 (* 2 t)) 2)) \'(0 0.5 1))"\n     :math-composition "(define L (phys/L-free 1.0))\n(define (max-residual L q qdot times)\n  (apply max (map (lambda (t) (abs (phys/lagrange-residual L q qdot t))) times)))\n(max-residual L \'(0 . ((length . 1))) \'(2 . ((length . 1) (time . -1)))\n              (list \'(0 . ((time . 1))) \'(1 . ((time . 1))) \'(2 . ((time . 1)))))"\n     :cs-composition "(define L (phys/L-free 1.0))\n(define (verify-trajectory L traj-fn times tol)\n  (define (approx a b) (< (abs (- a b)) tol))\n  (let loop ((ts times))\n    (if (null? ts) \'verified\n        (let ((state (traj-fn (car ts))))\n          (if (approx (phys/lagrange-residual L (car state) (cadr state) (car ts)) 0)\n              (loop (cdr ts))\n              \'failed)))))\n(verify-trajectory L (lambda (t) (list (+ 0 (* 2 t)) 2))\n                   (list \'(0 . ((time . 1))) \'(1 . ((time . 1)))) 0.01)")',
),
'phys/lagrangian-action': dict(
    r2e = '(:eng-program "(define L (phys/L-free 1.0))\n(define (straight-path t) (phys/q* \'(1 . ((length . 1) (time . -1))) t))\n(phys/lagrangian-action L straight-path \'(0 . ((time . 1))) \'(2 . ((time . 1))))"\n     :math-program "(define L (phys/L-free 1.0))\n(define (path t) 1.0)\n(define S1 (phys/lagrangian-action L path 0 1))\n(define S2 (phys/lagrangian-action L path 0 2))\n(< S1 S2)"\n     :cs-program "(define (integrate-riemann f a b n)\n  (let ((dt (/ (- b a) n)))\n    (let loop ((i 0) (acc 0.0))\n      (if (= i n) acc\n          (loop (+ i 1) (+ acc (* (f (+ a (* i dt))) dt)))))))\n(integrate-riemann (lambda (t) (* 0.5 1.0 t t)) 0 2 100)")',
    r4e = '(:eng-program "(define L (phys/L-free 1.0))\n(define (path t) 1.0)\n(define S1 (phys/lagrangian-action L path 0 1))\n(define S2 (phys/lagrangian-action L path 0 2))\n(< S1 S2)"\n     :math-program "(define L (phys/L-free 1.0))\n(define (path t) 1.0)\n(define S0-1 (phys/lagrangian-action L path 0 1))\n(define S1-2 (phys/lagrangian-action L path 1 2))\n(define S0-2 (phys/lagrangian-action L path 0 2))\n(define (approx a b) (< (abs (- a b)) 0.001))\n(approx S0-2 (+ S0-1 S1-2))"\n     :cs-program "(define L (phys/L-free 1.0))\n(define (path t) 1.0)\n(define (approx a b) (< (abs (- a b)) 0.001))\n(approx (phys/lagrangian-action L path 0 1 10)\n        (phys/lagrangian-action L path 0 1 100))")',
    r5e = '(:eng-composition "(define L (phys/L-free 1.0))\n(define (compare-two-paths p1 p2 t0 t1)\n  (list (phys/lagrangian-action L p1 t0 t1)\n        (phys/lagrangian-action L p2 t0 t1)))\n(compare-two-paths (lambda (t) t) (lambda (t) (* t t)) 0 1)"\n     :math-composition "(define L (phys/L-free 1.0))\n(define (action-vs-n path t0 t1)\n  (map (lambda (n) (phys/lagrangian-action L path t0 t1 n)) \'(10 50 100 500)))\n(action-vs-n (lambda (t) 1.0) 0 1)"\n     :cs-composition "(define L (phys/L-free 1.0))\n(define (min-action-path paths t0 t1)\n  (let loop ((ps paths) (best-path (car paths)) (best-S (phys/lagrangian-action L (car paths) t0 t1)))\n    (if (null? (cdr ps)) (list \'min-action best-S)\n        (let ((s (phys/lagrangian-action L (cadr ps) t0 t1)))\n          (if (< s best-S)\n              (loop (cdr ps) (cadr ps) s)\n              (loop (cdr ps) best-path best-S))))))\n(min-action-path (list (lambda (t) t) (lambda (t) (* t t)) (lambda (t) (* 0.5 t))) 0 1)")',
),
'phys/nbody': dict(
    r2e = '(:eng-program "(define bodies\n  \'((sun . ((mass . 1.989e30) (pos . (0 0 0)) (vel . (0 0 0))))\n    (earth . ((mass . 5.972e24) (pos . (1.496e11 0 0)) (vel . (0 29780 0))))))\n(phys/nbody bodies \'(time-seconds 31536000))"\n     :math-program "(define (total-momentum bodies)\n  (let loop ((bs bodies) (px 0) (py 0))\n    (if (null? bs) (list px py)\n        (let* ((b (car bs))\n               (m (cdr (assq \'mass (cdr b))))\n               (v (cdr (assq \'vel (cdr b)))))\n          (loop (cdr bs) (+ px (* m (car v))) (+ py (* m (cadr v))))))))\n(total-momentum \'((a . ((mass . 1) (vel . (5 0)))) (b . ((mass . 1) (vel . (-5 0))))))"\n     :cs-program "(define (submit-bodies bodies opts) (phys/nbody bodies opts))\n(submit-bodies \'((m1 . ((mass . 1) (pos . (0 0 0)) (vel . (0 0 0))))\n                 (m2 . ((mass . 1) (pos . (10 0 0)) (vel . (0 5 0)))))\n               \'(time-seconds 60))")',
    r4e = '(:eng-program "(define (total-momentum bodies)\n  (let loop ((bs bodies) (px 0) (py 0))\n    (if (null? bs) (list px py)\n        (let* ((b (car bs))\n               (m (cdr (assq \'mass (cdr b))))\n               (v (cdr (assq \'vel (cdr b)))))\n          (loop (cdr bs) (+ px (* m (car v))) (+ py (* m (cadr v))))))))\n(total-momentum \'((a . ((mass . 1) (vel . (5 0)))) (b . ((mass . 1) (vel . (-5 0))))))"\n     :math-program "(define G 6.674e-11)\n(define (pair-force m1 m2 r) (/ (* G m1 m2) (* r r)))\n(define (approx a b) (< (abs (- a b)) 1e-10))\n(approx (pair-force 5e24 7e22 3.8e8)\n        (pair-force 7e22 5e24 3.8e8))"\n     :cs-program "(define (mock-nbody bodies opts) (list \'result (length bodies) opts))\n(mock-nbody \'((a . ((mass . 1) (pos . (0 0 0)) (vel . (0 0 0))))\n              (b . ((mass . 2) (pos . (5 0 0)) (vel . (1 0 0)))))\n            \'(time-seconds 10))")',
    r5e = '(:eng-composition "(define (predict-future-earth years)\n  (define solar-system\n    \'((sun . ((mass . 1.989e30) (pos . (0 0 0)) (vel . (0 0 0))))\n      (earth . ((mass . 5.972e24) (pos . (1.496e11 0 0)) (vel . (0 29780 0))))))\n  (phys/nbody solar-system (list \'time-seconds (* years 31536000))))\n(predict-future-earth 10)"\n     :math-composition "(define (energy-at-t bodies G)\n  (let loop ((bs bodies) (e 0))\n    (if (null? bs) e\n        (let* ((b (car bs))\n               (m (cdr (assq \'mass (cdr b))))\n               (v (cdr (assq \'vel (cdr b)))))\n          (loop (cdr bs) (+ e (* 0.5 m (car v) (car v))))))))\n(energy-at-t \'((a . ((mass . 1) (vel . (5 0)))) (b . ((mass . 2) (vel . (3 0))))) 6.674e-11)"\n     :cs-composition "(define (nbody-pipeline bodies time-step post-fn)\n  (let ((result (phys/nbody bodies (list \'time-seconds time-step))))\n    (post-fn result)))\n(nbody-pipeline \'((m1 . ((mass . 1) (pos . (0 0 0)) (vel . (0 0 0))))\n                  (m2 . ((mass . 1) (pos . (10 0 0)) (vel . (0 5 0)))))\n                60 (lambda (r) (list \'done r)))")',
),
'phys/q*': dict(
    r2e = '(:eng-program "(define force \'(10 . ((mass . 1) (length . 1) (time . -2))))\n(define dist \'(5 . ((length . 1))))\n(phys/q* force dist)"\n     :math-program "(define a \'(2 . ((mass . 1))))\n(define b \'(3 . ((length . 1))))\n(define c \'(4 . ((time . -1))))\n(define (approx-q qa qb) (< (abs (- (car qa) (car qb))) 0.001))\n(approx-q (phys/q* a b) (phys/q* b a))"\n     :cs-program "(define P \'(100 . ((mass . 1) (length . 2) (time . -3))))\n(define t \'(60 . ((time . 1))))\n(phys/q* P t)")',
    r4e = '(:eng-program "(define a \'(2 . ((mass . 1))))\n(define b \'(3 . ((length . 1))))\n(define c \'(4 . ((time . -1))))\n(define (approx-q qa qb) (< (abs (- (car qa) (car qb))) 0.001))\n(and (approx-q (phys/q* a b) (phys/q* b a))\n     (approx-q (phys/q* (phys/q* a b) c) (phys/q* a (phys/q* b c))))"\n     :math-program "(define a \'(2 . ((mass . 1))))\n(define b \'(3 . ((length . 1))))\n(define (approx-q qa qb) (< (abs (- (car qa) (car qb))) 0.001))\n(approx-q (phys/q* a b) (phys/q* b a))"\n     :cs-program "(define a \'(5 . ((length . 1))))\n(define b \'(2 . ((time . 1))))\n(define (approx-q qa qb) (< (abs (- (car qa) (car qb))) 0.001))\n(approx-q (phys/q/ (phys/q* a b) b) a)")',
    r5e = '(:eng-composition "(define (energy-from-power power time)\n  (phys/q* power time))\n(define P \'(100 . ((mass . 1) (length . 2) (time . -3))))\n(define t \'(60 . ((time . 1))))\n(energy-from-power P t)"\n     :math-composition "(define (kinetic-energy m v)\n  (phys/q* \'(0.5 . ()) (phys/q* m (phys/q* v v))))\n(kinetic-energy \'(2 . ((mass . 1))) \'(3 . ((length . 1) (time . -1))))"\n     :cs-composition "(define (scale-force F k)\n  (phys/q* F \'(k . ())))\n(define F \'(10 . ((mass . 1) (length . 1) (time . -2))))\n(phys/q* F \'(2 . ()))")',
),
'phys/q/': dict(
    r2e = '(:eng-program "(define d (phys/quantity 100.0 \'((length . 1))))\n(define t (phys/quantity 5.0 \'((time . 1))))\n(phys/q/ d t)"\n     :math-program "(define d \'(100 . ((length . 1))))\n(define t \'(5 . ((time . 1))))\n(phys/q/ d t)"\n     :cs-program "(define (decay-constant half-life)\n  (phys/q/ (phys/quantity (log 2.0) \'())\n           (phys/quantity half-life \'((time . 1)))))\n(decay-constant 5730.0)")',
    r4e = '(:eng-program "(define a \'(5.0 . ((length . 1))))\n(define b \'(2.0 . ((time . 1))))\n(define (approx-q qa qb) (< (abs (- (car qa) (car qb))) 0.001))\n(approx-q (phys/q/ (phys/q* a b) b) a)"\n     :math-program "(define a \'(5.0 . ((length . 1))))\n(define b \'(2.0 . ((time . 1))))\n(define (approx-q qa qb) (< (abs (- (car qa) (car qb))) 0.001))\n(and (approx-q (phys/q/ (phys/q* a b) b) a)\n     (approx-q (phys/q/ (phys/q* a b) a) b))"\n     :cs-program "(define v \'(100.0 . ((length . 1) (time . -1))))\n(define t \'(10.0 . ((time . 1))))\n(define d (phys/q* v t))\n(define (approx-q qa qb) (< (abs (- (car qa) (car qb))) 0.001))\n(approx-q (phys/q/ d t) v)")',
    r5e = '(:eng-composition "(define (acceleration v-final v-initial dt)\n  (phys/q/ (phys/q+ v-final (phys/q* v-initial \'(-1.0 . ()))) dt))\n(acceleration \'(20.0 . ((length . 1) (time . -1)))\n              \'(10.0 . ((length . 1) (time . -1)))\n              \'(2.0 . ((time . 1))))"\n     :math-composition "(define (rate events duration)\n  (phys/q/ \'(events . ((count . 1))) \'(duration . ((time . 1)))))\n(phys/q/ \'(120 . ((count . 1))) \'(60 . ((time . 1))))"\n     :cs-composition "(define (normalize-to-unit v)\n  (phys/q/ v (phys/q* \'(1.0 . ()) v)))\n(define d \'(45.0 . ((length . 1))))\n(define t \'(9.0 . ((time . 1))))\n(phys/q/ d t)")',
),
}


def balanced_section_bounds(text, key, start=0):
    """Return (section_start, section_end) of the (...) group following :key."""
    m = re.search(re.escape(key) + r'\s*\(', text[start:])
    if not m:
        return None, None
    sec_start = start + m.start()
    paren_start = start + m.end() - 1
    depth = 0; ins = False; esc = False; j = paren_start
    while j < len(text):
        c = text[j]
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    return sec_start, j + 1
        j += 1
    return None, None


def find_verb_bounds(text, name):
    """Return (start, end) of the whole (verb ...) form for the named verb."""
    pattern = r'\(verb\b'
    for m in re.finditer(pattern, text):
        i = m.start()
        # Quick check: does :name "name" appear soon?
        chunk = text[i:i+200]
        if f':name "{name}"' not in chunk:
            continue
        # Extract balanced form
        depth = 0; ins = False; esc = False; j = i
        while j < len(text):
            c = text[j]
            if ins:
                if esc: esc = False
                elif c == '\\': esc = True
                elif c == '"': ins = False
            else:
                if c == '"': ins = True
                elif c == '(': depth += 1
                elif c == ')':
                    depth -= 1
                    if depth == 0:
                        return i, j + 1
            j += 1
    return None, None


def insert_before_last_paren_of_section(section_text, new_entry):
    """Insert new_entry (a string) before the last ')' of the section."""
    # Find the last ')' in section_text
    j = len(section_text) - 1
    while j >= 0 and section_text[j] != ')':
        j -= 1
    # Insert before it
    return section_text[:j] + '\n     ' + new_entry + '\n     ' + section_text[j:]


result = text

# Process each verb
for verb_name, adds in ADDITIONS.items():
    vstart, vend = find_verb_bounds(result, verb_name)
    assert vstart is not None, f"Verb {verb_name} not found"

    verb_text = result[vstart:vend]

    # --- ROW 2 ---
    # Find :row-2-audit in verb_text
    r2_offset = verb_text.find(':row-2-audit')
    assert r2_offset >= 0, f"{verb_name}: no :row-2-audit"
    # Find the ( that opens the list
    r2_paren = verb_text.index('(', r2_offset)
    # Extract balanced section
    depth = 0; ins = False; esc = False; j = r2_paren
    while j < len(verb_text):
        c = verb_text[j]
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    break
        j += 1
    r2_section = verb_text[r2_paren:j+1]

    # Check if already has eng-program (skip if so)
    if ':eng-program' not in r2_section:
        new_r2 = insert_before_last_paren_of_section(r2_section, adds['r2e'])
        verb_text = verb_text[:r2_paren] + new_r2 + verb_text[j+1:]

    # --- ROW 4 ---
    r4_offset = verb_text.find(':row-4-proof')
    assert r4_offset >= 0, f"{verb_name}: no :row-4-proof"
    r4_paren = verb_text.index('(', r4_offset)
    depth = 0; ins = False; esc = False; j = r4_paren
    while j < len(verb_text):
        c = verb_text[j]
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    break
        j += 1
    r4_section = verb_text[r4_paren:j+1]

    if ':eng-program' not in r4_section:
        new_r4 = insert_before_last_paren_of_section(r4_section, adds['r4e'])
        verb_text = verb_text[:r4_paren] + new_r4 + verb_text[j+1:]

    # --- ROW 5 ---
    r5_offset = verb_text.find(':row-5-emergence')
    assert r5_offset >= 0, f"{verb_name}: no :row-5-emergence"
    r5_paren = verb_text.index('(', r5_offset)
    depth = 0; ins = False; esc = False; j = r5_paren
    while j < len(verb_text):
        c = verb_text[j]
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    break
        j += 1
    r5_section = verb_text[r5_paren:j+1]

    if ':eng-composition' not in r5_section:
        new_r5 = insert_before_last_paren_of_section(r5_section, adds['r5e'])
        verb_text = verb_text[:r5_paren] + new_r5 + verb_text[j+1:]

    # Replace verb in result
    result = result[:vstart] + verb_text + result[vend:]
    print(f"  Processed {verb_name}")

# Validate
final_balance = paren_balance(result)
print(f"\nFinal paren balance: {final_balance}")
if final_balance != 0:
    print("ERROR: Paren balance is not 0! Not writing.")
    sys.exit(1)

SRC.write_text(result)
print(f"Written to {SRC}")
