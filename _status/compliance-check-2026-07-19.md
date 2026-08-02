# Motoi Reference Compliance Check — code runnability

Total code blocks checked: 17588
Passes: 17310
Failures: 278
Skipped (marked :runs "spec-only"): 3

Pass rate: 98.4%

## Failures — grouped by verb


### `arity-of` — file `00b-introspection.slat`

- **row-2-audit** :math-program
  ```scheme
  ;; Mean minimum-arity: reduce each verb's arity (an integer, or (min max) for variadics) to its min, then average over a sample — a real central-tendency statistic on the vocabulary's shape.
(let* ((vs (take (all-verbs) 60))
       (as (filter (lambda (a) (or (number? a) (pair? a))) (map arity-of vs
  ```
  Error:
  ```
  error: +: expected a number, got nothing

  ```
- **row-4-proof** :math-program
  ```scheme
  ;; Lower bound on argument count: every verb's minimum arity is ≥ 0 — you cannot call a verb with a negative number of arguments. Proven by min over the sample.
(let* ((vs (take (all-verbs) 80))
       (as (filter (lambda (a) (or (number? a) (pair? a))) (map arity-of vs)))
       (mins (map (lambda 
  ```
  Error:
  ```
  error: min: expected a number, got nothing

  ```

### `describe` — file `00b-introspection.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (namespaced-manual ns)
  (let ((matches (filter (lambda (v) (equal? (substring (symbol->string v) 0 (string-length ns)) ns))
                         (all-verbs))))
    (for-each (lambda (v) (display (describe v)) (newline)) matches)))
(namespaced-manual "audio/")
  ```
  Error:
  ```
  error: substring: end 6 is past the end of a string of length 1. To TEST a prefix use (string-prefix? "..." s); to TRUNCATE use (substring s 0 (min 6 (string-length s))).

  ```

### `grid-cols` — file `01-core.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (index->cell i)
  (let ((w (grid-cols)))
    (list (modulo i w) (quotient i w))))
(display (index->cell 5))
  ```
  Error:
  ```
  error: modulo: division by zero

  ```

### `land-on-downbeat` — file `01-core.slat`

- **row-4-proof** :math-program
  ```scheme
  (define (snap t period)
  (* period (ceiling (/ t period))))
(display (snap (audio-time) 'bar))
  ```
  Error:
  ```
  error: /: expected a number, got the symbol bar

  ```

### `measure-content` — file `01-core.slat`

- **row-2-audit** :math-program
  ```scheme
  (define dims (measure-content 'my-card))
(define w (cadr (assoc 'w dims)))
(define h (cadr (assoc 'h dims)))
(display (/ w (max h 1)))
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got #f

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (fits? id max-w)
  (let ((dims (measure-content id)))
    (and (pair? dims)
         (<= (cadr (assoc 'w dims)) max-w))))
(display (fits? 'content-card 300))
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got #f

  ```
- **row-4-proof** :math-program
  ```scheme
  (define d (measure-content 'my-card))
(display (and (>= (cadr (assoc 'w d)) 0)
              (>= (cadr (assoc 'h d)) 0)))
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got #f

  ```

### `note-dots` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (let ((md (note-dots 'G4 'quarter 0 'treble)))
  (when (eq? (car md) 'ok)
    (display (cadr md))))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0

  ```
- **row-2-audit** :math-program
  ```scheme
  (define (y-of pitch clef)
  (let ((r (note-dots pitch 'quarter 0 clef)))
    (if (eq? (car r) 'ok) (cadr r) 'unknown)))
(display (y-of 'C4 'treble))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (ok? p clef)
  (eq? (car (note-dots p 'quarter 0 clef)) 'ok))
(display (ok? 'B3 'bass))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (render-chord pitches clef)
  (map (lambda (p)
         (let ((r (note-dots p 'quarter 0 clef)))
           (if (eq? (car r) 'ok) (cadr r) '())))
       pitches))
(render-chord '(C4 E4 G4) 'treble)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (span pitches clef)
  (let ((ys (map (lambda (p) (cadr (note-dots p 'quarter 0 clef))) pitches)))
    (- (apply max ys) (apply min ys))))
(display (span '(C4 C5) 'treble))
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got the number 0

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (layout pitches clef)
  (filter (lambda (r) (eq? (car r) 'ok))
          (map (lambda (p) (note-dots p 'quarter 0 clef)) pitches)))
(display (layout '(C4 X E4) 'treble))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0

  ```

### `sprite` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (sprite/address \'rose)
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 18)

  ```
- **row-2-audit** :math-program
  ```scheme
  (sprite/address \'rose)
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 18)

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (ring n)
  (map (lambda (i) (sprite/address \'rose)) (iota n)))
(display (ring 6))
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 2, col 37)

  ```

### `sprites` — file `01-core.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (sprites target form) (list \'sprites target form))
(define (sprites target form) (list 'sprites target form))
(define roster (map (lambda (i) (string->symbol (string-append "npc" (number->string i)))) (iota 8)))
(display (sprites roster (list 'anim 'wander)))
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 38)

  ```

### `viewport` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (center-of-view)
  (let ((vp (viewport)))
    (list (+ (hash-table-ref/default vp 'x #f) (/ (hash-table-ref/default vp 'w #f) 2))
          (+ (hash-table-ref/default vp 'y #f) (/ (hash-table-ref/default vp 'h #f) 2)))))
(center-of-view)
  ```
  Error:
  ```
  error: /: expected a number, got #f

  ```
- **row-2-audit** :math-program
  ```scheme
  (define (view-area)
  (let ((vp (viewport)))
    (* (hash-table-ref/default vp 'w #f) (hash-table-ref/default vp 'h #f))))  ;; area of the axis-aligned view rectangle = w * h
(view-area)
  ```
  Error:
  ```
  error: *: expected a number, got #f

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (in-box? px py vp)
  (and (>= px (hash-table-ref/default vp 'x #f)) (<= px (+ (hash-table-ref/default vp 'x #f) (hash-table-ref/default vp 'w #f)))
       (>= py (hash-table-ref/default vp 'y #f)) (<= py (+ (hash-table-ref/default vp 'y #f) (hash-table-ref/default vp 'h #f)))))
(display (in-
  ```
  Error:
  ```
  error: +: expected a number, got #f

  ```

### `viewport-width` — file `01-core.slat`

- **row-4-proof** :program
  ```scheme
  (define vp (viewport))
(display (equal? (viewport-width) (- (caddr vp) (car vp))))
  ```
  Error:
  ```
  error: caddr: expected a pair or a non-empty list, got the empty list

  ```

### `ai/bt-tick` — file `02-ai.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (batch-dispatch agents tree)
  (map (lambda (a) (list 'agent a 'status (if (odd? (length (symbol->string a))) 'success 'running))) agents))
(display (batch-dispatch '(a1 a2 a3 a4) 'combat-tree))
(newline)
  ```
  Error:
  ```
  error: length: expected a proper list, got the string "a1"

  ```

### `ai/waypoints` — file `02-ai.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define g (ai/grid 10 10))
(define path (ai/path g 0 0 3 3))
(define wps (ai/waypoints g path))
(display (list 'cells (length path) 'waypoints (length wps)))
(newline)
  ```
  Error:
  ```
  error: length: expected a proper list, got #t

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define g (ai/grid 16 16))
(define (convert-and-check grid cells)
  (let ((wps (ai/waypoints grid cells)))
    (= (length wps) (length cells))))
(display (convert-and-check g '((0 0) (1 1) (2 2))))
(newline)
  ```
  Error:
  ```
  error: length: expected a proper list, got #t

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define g (ai/grid 10 10))
(define path (ai/path g 0 0 4 4))
(define wps (ai/waypoints g path))
(display (list 'same-length (= (length path) (length wps))))
(newline)
  ```
  Error:
  ```
  error: length: expected a proper list, got #t

  ```

### `alg/subgroups` — file `03-alg.slat`

- **row-2-audit** :eng-program
  ```scheme
  (length (alg/subgroups (alg/cyclic 12)))
  ```
  Error:
  ```
  error: length: expected a proper list, got the symbol use-backend

  ```
- **row-3-dimension** :code
  ```scheme
  (length (alg/subgroups (alg/cyclic 12)))
  ```
  Error:
  ```
  error: length: expected a proper list, got the symbol use-backend

  ```
- **row-5-emergence** :composition
  ```scheme
  (define orders '(2 3 4 5 6 7 8 9 10 12))
(define (divisor-count n) (length (alg/subgroups (alg/cyclic n))))
(map (lambda (n) (list n (divisor-count n))) orders)
  ```
  Error:
  ```
  error: length: expected a proper list, got the symbol use-backend

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (map (lambda (n) (length (alg/subgroups (alg/cyclic n)))) '(6 8 12))
  ```
  Error:
  ```
  error: length: expected a proper list, got the symbol use-backend

  ```

### `alg/symmetry-group` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define S (alg/pcset (list 0 3 6 9)))
(zero? (modulo 24 (length (alg/symmetry-group S))))
  ```
  Error:
  ```
  error: modulo: division by zero

  ```
- **row-4-proof** :program
  ```scheme
  (define S (alg/pcset (list 0 3 6 9)))
(zero? (modulo 24 (length (alg/symmetry-group S))))
  ```
  Error:
  ```
  error: modulo: division by zero

  ```

### `artifact/cite` — file `05-artifact.slat`

- **row-4-proof** :eng-program
  ```scheme
  (equal? (car (artifact/cite 'a-42)) 'pending)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (deterministic-kick? id) (equal? (car (artifact/cite id)) 'pending))
(deterministic-kick? 'a-42)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```

### `artifact/delete` — file `05-artifact.slat`

- **row-4-proof** :eng-program
  ```scheme
  (equal? (car (artifact/delete 'a-42)) 'pending)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (deterministic-kick? id) (equal? (car (artifact/delete id)) 'pending))
(deterministic-kick? 'a-42)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```

### `artifact/save` — file `05-artifact.slat`

- **row-4-proof** :eng-program
  ```scheme
  (equal? (car (artifact/save (list (cons 'kind 'x) (cons 'payload 'y)))) 'pending)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (deterministic-kick? opts) (equal? (car (artifact/save opts)) 'pending))
(deterministic-kick? (list (cons 'kind 'x) (cons 'payload 'y)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```

### `calc/curl` — file `11-calc.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define vortex (lambda (p) (list (- (cadr p)) (car p))))
(define curl-val (calc/curl vortex (list 1 1)))
;; Rotational field F=(-y,x): curl F = ∂x/∂x - ∂(-y)/∂y = 1+1 = 2
(< (abs (- curl-val 2)) 0.05)
;; => #t — vorticity is 2 everywhere
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```

### `calc/directional-derivative` — file `11-calc.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define pressure (lambda (p) (+ (expt (car p) 2) (expt (cadr p) 2))))
(define flow-dir (list (/ 1 (sqrt 2)) (/ 1 (sqrt 2))))
(calc/directional-derivative pressure (list 1 1) flow-dir)
;; ∇p=(2x,2y) at (1,1)=(2,2); dot (2,2)·(1/√2,1/√2)=4/√2≈2.828
;; => ≈ 2.828
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-2-audit** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/directional-derivative f (list 1 0) (list 1 0))
;; ∇f=(2x,2y); at (1,0) with dir (1,0): 2x·1+2y·0=2
;; => ≈ 2.0
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (scan-directions f pt dirs)
  (map (lambda (d) (list d (calc/directional-derivative f pt d))) dirs))
(scan-directions
  (lambda (p) (* (car p) (cadr p)))
  (list 1 1)
  (list (list 1 0) (list 0 1) (list (/ 1 (sqrt 2)) (/ 1 (sqrt 2)))))
;; f=xy; ∇f=(y,x)=(1,1) at (1,1); directions give 1, 1, 
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/directional-derivative f (list 1 0) (list 1 0))
;; ∇f=(2x,2y); at (1,0) with dir (1,0): 2x·1+2y·0=2
;; => ≈ 2.0
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/directional-derivative f (list 1 0) (list 1 0))
;; ∇f=(2x,2y); at (1,0) with dir (1,0): 2x·1+2y·0=2
;; => ≈ 2.0
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define pt (list 1 1))
(define v (list 1 0)) (define w (list 0 1))
(define Dv (calc/directional-derivative f pt v))
(define Dw (calc/directional-derivative f pt w))
(define D2v3w (calc/directional-derivative f pt (list 2 3)))
(< (
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define p (list 1 1))
(define v (list 1 0)) (define w (list 0 1))
(< (abs (- (calc/directional-derivative f p (list 2 3))
           (+ (* 2 (calc/directional-derivative f p v))
              (* 3 (calc/directional-derivative f p 
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (linearity-dir? f pt v w a b tol)
  (let ((combined (calc/directional-derivative f pt (list (+ (* a (car v)) (* b (car w)))
                                                         (+ (* a (cadr v)) (* b (cadr w))))))
        (expected (+ (* a (calc/directional-derivative f pt v))
          
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 2.000001

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define loss (lambda (p) (+ (expt (car p) 2) (* 2 (expt (cadr p) 2)))))
(define pt (list 3 2))
(define grad (calc/gradient loss pt))
(define gmag (sqrt (+ (* (car grad) (car grad)) (* (cadr grad) (cadr grad)))))
(define descent-dir (list (/ (- (car grad)) gmag) (/ (- (cadr grad)) gmag)))
(list 'grad
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 3.000001

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define p (list 1 1))
(define g (calc/gradient f p))
(list g (calc/directional-derivative f p (list 1 0)))
;; gradient=(2,2); x-dir rate=2; confirms ∇f·ê₁ = ∂f/∂x
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (all-directional-rates f pt basis)
  (map (lambda (v) (calc/directional-derivative f pt v)) basis))
(all-directional-rates
  (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p))))
  (list 1 2)
  (list (list 1 0) (list 0 1) (list (/ 1 (sqrt 2)) (/ 1 (sqrt 2)))))
;; => (2 4 ≈4.243) — x-rat
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```

### `calc/extrema-1d` — file `11-calc.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (best-minimum f a b)
  ;; Extract the global minimum from classified extrema
  (let ((ext (calc/extrema-1d f a b)))
    (let loop ((xs ext) (best-x #f) (best-v +inf.0))
      (if (null? xs) (list 'min-at best-x 'value best-v)
        (let ((e (car xs)))
          (if (and (eq? (cadr e) 'min)
  ```
  Error:
  ```
  error: caddr: expected a pair or a non-empty list, got the empty list

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (optimization-report f a b)
  (let ((ext (calc/extrema-1d f a b)))
    (map (lambda (e)
           (list 'x (car e)
                 'type (cadr e)
                 'value (caddr e)))
         ext)))
(optimization-report (lambda (x) (+ (* 2 x x) (* -8 x) 6)) 0 5)
;; => ((x 2 type min value -
  ```
  Error:
  ```
  error: caddr: expected a pair or a non-empty list, got the empty list

  ```

### `calc/gradient` — file `11-calc.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define loss (lambda (w) (+ (expt (- (car w) 3) 2) (expt (- (cadr w) 5) 2))))
(calc/gradient loss (list 1 2))
;; L = (w1-3)² + (w2-5)²; ∇L = (2(w1-3), 2(w2-5))
;; at (1,2): (2·(-2), 2·(-3)) = (-4 -6)
;; => ≈ (-4 -6)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-2-audit** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/gradient f (list 1 2))
;; ∇(x²+y²) = (2x, 2y); at (1,2): (2, 4)
;; => ≈ (2 4)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (gradient-magnitude f pt)
  (let ((g (calc/gradient f pt)))
    (sqrt (apply + (map (lambda (gi) (* gi gi)) g)))))
(gradient-magnitude
  (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p))))
  (list 3 4))
;; ∇f=(6,8) at (3,4); |∇f|=√(36+64)=10
;; => ≈ 10.0
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 3.000001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/gradient f (list 1 2))
;; ∇(x²+y²) = (2x, 2y); at (1,2): (2, 4)
;; => ≈ (2 4)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/gradient f (list 1 2))
;; ∇(x²+y²) = (2x, 2y); at (1,2): (2, 4)
;; => ≈ (2 4)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define pt (list 1 1))
(define g (calc/gradient f pt))
(define gmag (sqrt (+ (* (car g) (car g)) (expt (cadr g) 2))))
(define unit-g (list (/ (car g) gmag) (/ (cadr g) gmag)))
(> (calc/directional-derivative f pt unit-g)
   (calc/
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define p (list 1 1))
(define g (calc/gradient f p))
(define g-mag (sqrt (+ (* (car g) (car g)) (* (cadr g) (cadr g)))))
(> (calc/directional-derivative f p (list (/ (car g) g-mag) (/ (cadr g) g-mag)))
   (calc/directional-derivat
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (steepest-beats-axis? f pt)
  (let* ((g (calc/gradient f pt))
         (gmag (sqrt (apply + (map (lambda (gi) (* gi gi)) g))))
         (unit-g (map (lambda (gi) (/ gi gmag)) g))
         (d-steepest (calc/directional-derivative f pt unit-g))
         (d-x (calc/directional-derivative f pt (
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define loss (lambda (w) (+ (expt (car w) 2) (expt (cadr w) 2))))
(define lr 0.1)
(define (sgd-step w) (let ((g (calc/gradient loss w)))
  (map (lambda (wi gi) (- wi (* lr gi))) w g)))
(let loop ((n 0) (w (list 3 4)))
  (if (= n 10) w (loop (+ n 1) (sgd-step w))))
;; converges toward (0 0) — minimum
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 3.000001

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define lr 0.1)
(define step (lambda (p) (let ((g (calc/gradient f p)))
  (list (- (car p) (* lr (car g))) (- (cadr p) (* lr (cadr g)))))))
(let loop ((n 0) (cur (list 3 3)))
  (cond ((= n 5) cur) (else (loop (+ n 1) (step cur))))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 3.000001

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (gradient-path f start lr steps)
  (let loop ((n 0) (pt start) (path (list start)))
    (if (= n steps) (reverse path)
      (let* ((g (calc/gradient f pt))
             (next (map (lambda (xi gi) (- xi (* lr gi))) pt g)))
        (loop (+ n 1) next (cons next path))))))
(gradient-path (lamb
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 4.000001

  ```

### `calc/hessian` — file `11-calc.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define f (lambda (p) (+ (expt (car p) 2) (* 3 (expt (cadr p) 2)))))
(calc/hessian f (list 0 0))
;; H = [[∂²f/∂x², ∂²f/∂x∂y], [∂²f/∂y∂x, ∂²f/∂y²]]
;; = [[2, 0], [0, 6]] — diagonal, constant curvature
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-2-audit** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/hessian f (list 0 0))
;; Hessian of x²+y² is [[2,0],[0,2]] everywhere
;; => ≈ ((2 0) (0 2))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (trace-of-hessian f pt)
  ;; Laplacian = trace of Hessian = sum of diagonal elements
  (let ((H (calc/hessian f pt)))
    (apply + (map (lambda (i) (list-ref (list-ref H i) i))
                  (range 0 (length H))))))
(trace-of-hessian
  (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/hessian f (list 0 0))
;; Hessian of x²+y² is [[2,0],[0,2]] everywhere
;; => ≈ ((2 0) (0 2))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/hessian f (list 0 0))
;; Hessian of x²+y² is [[2,0],[0,2]] everywhere
;; => ≈ ((2 0) (0 2))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (cadr p)) (* (car p) (car p)))))
(define H (calc/hessian f (list 1 1)))
(< (abs (- (list-ref (list-ref H 0) 1) (list-ref (list-ref H 1) 0))) 0.02)
;; H[0][1] and H[1][0] should both be ≈1; symmetry confirmed
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0001

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (cadr p)) (* (car p) (car p)))))
(define H (calc/hessian f (list 1 1)))
(< (abs (- (list-ref (list-ref H 0) 1) (list-ref (list-ref H 1) 0))) 0.01)
;; Schwarz: ∂²f/∂x∂y = ∂²f/∂y∂x for f ∈ C²
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0001

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (symmetric? H tol)
  (let ((n (length H)))
    (let outer ((i 0) (ok #t))
      (if (or (not ok) (= i n)) ok
        (let inner ((j 0) (ok ok))
          (if (= j n) (outer (+ i 1) ok)
            (inner (+ j 1)
                   (and ok (< (abs (- (list-ref (list-ref H i) j)
              
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 2.0001

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define f (lambda (p) (+ (expt (car p) 2) (expt (cadr p) 2))))
(define pt (list 1 2))
(define g (calc/gradient f pt))
(define H (calc/hessian f pt))
;; Newton step: p_next = p - H⁻¹·g
;; For diag H=[[2,0],[0,2]]: H⁻¹·g = (g/2)
(list 'gradient g 'hessian H
     'newton-step (map (lambda (gi) (/ gi 2)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define p (list 1 1))
(define g (calc/gradient f p))
(define H (calc/hessian f p))
(list g H)
;; => ((2 2) ((2 0) (0 2))) — gradient and curvature ready for Newton step
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (newton-step-2d f pt)
  ;; One Newton step for 2D f: pt_next = pt - H⁻¹·∇f
  ;; For diagonal H: H⁻¹_{ii} = 1/H_{ii}
  (let* ((g (calc/gradient f pt))
         (H (calc/hessian f pt))
         (h00 (list-ref (list-ref H 0) 0))
         (h11 (list-ref (list-ref H 1) 1)))
    (list (- (car  pt)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 3.000001

  ```

### `calc/jacobian` — file `11-calc.slat`

- **row-2-audit** :program
  ```scheme
  (define f (lambda (p) (list (+ (car p) (cadr p)) (- (car p) (cadr p)))))
(calc/jacobian f (list 1 1))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1

  ```
- **row-2-audit** :math-program
  ```scheme
  (define polar (lambda (p) (let ((r (car p)) (th (cadr p))) (list (* r (cos th)) (* r (sin th))))))
(calc/jacobian (list (lambda (p) (* (car p) (cos (cadr p)))) (lambda (p) (* (car p) (sin (cadr p))))) (list 2 0))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 2.000001

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define f (lambda (p) (list (- (* (car p) (car p)) 1) (- (cadr p) (car p)))))
(define J (calc/jacobian f (list 1 1)))
(number? (list-ref (list-ref J 0) 0))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (list (+ (car p) (cadr p)) (- (car p) (cadr p)))))
(calc/jacobian f (list 1 1))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1

  ```
- **row-3-dimension** :code
  ```scheme
  (define polar (lambda (p) (let ((r (car p)) (th (cadr p))) (list (* r (cos th)) (* r (sin th))))))
(calc/jacobian (list (lambda (p) (* (car p) (cos (cadr p)))) (lambda (p) (* (car p) (sin (cadr p))))) (list 2 0))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 2.000001

  ```
- **row-4-proof** :program
  ```scheme
  (define f (lambda (p) (list (+ (car p) (cadr p)) (- (car p) (cadr p)))))
(define J (calc/jacobian f (list 0 0)))
(number? (list-ref (list-ref J 0) 0))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f1 (lambda (p) (* (car p) (cadr p))))
(define f2 (lambda (p) (+ (car p) (cadr p))))
(define J (calc/jacobian (list f1 f2) (list 2 3)))
(< (abs (- (car (list-ref J 0)) (car (calc/gradient f1 (list 2 3))))) 0.05)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 2.000001

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define F (lambda (p) (list (+ (* 2 (car p)) (cadr p)) (* 3 (cadr p)))))
(define Ja (calc/jacobian F (list 0 0)))
(define Jb (calc/jacobian F (list 5 7)))
(< (abs (- (car (car Ja)) (car (car Jb)))) 0.05)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0

  ```
- **row-5-emergence** :composition
  ```scheme
  (define f (lambda (p) (list (* (car p) (cadr p)) (+ (car p) (cadr p)))))
(define J (calc/jacobian f (list 1 2)))
J
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define F (lambda (p) (list (- (* (car p) (car p)) 2) (- (cadr p) (car p)))))
(define J (calc/jacobian F (list 1.5 1.5)))
(list 'residual (F (list 1.5 1.5)) 'jacobian J)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.5

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define f (lambda (p) (list (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define J (calc/jacobian f (list 0 0)))
(define det (- (* (car (car J)) (cadr (cadr J))) (* (cadr (car J)) (car (cadr J)))))
(if (< (abs det) 0.01) 'singular 'invertible)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0

  ```

### `calc/laplacian` — file `11-calc.slat`

- **row-2-audit** :program
  ```scheme
  (calc/laplacian (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))) (list 0 0))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-2-audit** :math-program
  ```scheme
  (define f (lambda (p) (- (* (car p) (car p)) (* (cadr p) (cadr p)))))
(< (abs (calc/laplacian f (list 3 4))) 0.01)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 3.0001

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define bump (lambda (p) (- (+ (* (car p) (car p)) (* (cadr p) (cadr p))))))
(let ((lap (calc/laplacian bump (list 1 1)))) (if (< lap 0) 'peak 'valley))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0001

  ```
- **row-3-dimension** :code
  ```scheme
  (calc/laplacian (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))) (list 0 0))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-3-dimension** :code
  ```scheme
  (calc/laplacian (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))) (list 0 0))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (- (* (car p) (car p)) (* (cadr p) (cadr p)))))
(< (abs (calc/laplacian f (list 3 4))) 0.01)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 3.0001

  ```
- **row-4-proof** :program
  ```scheme
  (define f (lambda (p) (- (* (car p) (car p)) (* (cadr p) (cadr p)))))
(< (abs (calc/laplacian f (list 1 1))) 0.01)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0001

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (p) (+ (* 3 (* (car p) (car p))) (* 5 (* (cadr p) (cadr p))))))
(< (abs (- (calc/laplacian f (list 1 1)) (+ (car (car (calc/hessian f (list 1 1)))) (cadr (cadr (calc/hessian f (list 1 1))))))) 0.1)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0001

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define f (lambda (p) (* (car p) (car p))))
(define g (lambda (p) (* (cadr p) (cadr p))))
(define h (lambda (p) (+ (* 2 (f p)) (* 3 (g p)))))
(< (abs (- (calc/laplacian h (list 1 1)) (+ (* 2 (calc/laplacian f (list 1 1))) (* 3 (calc/laplacian g (list 1 1)))))) 0.05)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0001

  ```
- **row-5-emergence** :composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(list (calc/laplacian f (list 0 0)) (calc/hessian f (list 0 0)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(map (lambda (pt) (list pt (calc/laplacian f pt))) (list (list 0 0) (list 1 0) (list 2 2)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 0.0001

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* 2 (* (cadr p) (cadr p))))))
(define pt (list 1 1))
(list 'laplacian (calc/laplacian f pt) 'gradient (calc/gradient f pt))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0001

  ```

### `calc/line-integral` — file `11-calc.slat`

- **row-2-audit** :math-program
  ```scheme
  (define circle (lambda (t) (list (cos (* 2 3.14159 t)) (sin (* 2 3.14159 t)) 0)))
(define one (lambda (x y z) 1))
(< (abs (- (calc/line-integral one circle) (* 2 3.14159))) 0.1)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :program
  ```scheme
  (define phi (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define F (lambda (p) (calc/gradient phi p)))
(define x1 (lambda (t) t)) (define y1 (lambda (t) t))
(define x2 (lambda (t) (* t t))) (define y2 (lambda (t) t))
(< (abs (- (calc/line-integral F x1 y1 0 1) (calc/line-integral F x2
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define F (lambda (p) (list (car p) (cadr p) 0)))
(define fwd (lambda (t) (list t t 0)))
(define rev (lambda (t) (list (- 1 t) (- 1 t) 0)))
(< (abs (+ (calc/line-integral F fwd 'vector) (calc/line-integral F rev 'vector))) 0.05)
  ```
  Error:
  ```
  error: +: expected a number, got a list

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define F (lambda (p) (list (- (cadr p)) (car p) 0)))
(define circle (lambda (t) (list (cos (* 2 3.14159 t)) (sin (* 2 3.14159 t)) 0)))
(list 'circulation (calc/line-integral F circle 'vector) 'curl-z (caddr (calc/curl F (list 0 0 0))))
  ```
  Error:
  ```
  error: caddr: expected a pair or a non-empty list, got the empty list

  ```

### `calc/partial` — file `11-calc.slat`

- **row-2-audit** :program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/partial f 0 (list 1 2))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-2-audit** :math-program
  ```scheme
  (define profit (lambda (p) (- (* 3 (car p)) (* 2 (cadr p)) (* (caddr p) (caddr p)))))
(list (calc/partial profit 0 (list 4 5 2)) (calc/partial profit 2 (list 4 5 2)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 4.000001

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define f (lambda (p) (* (car p) (car p) (cadr p))))
(define fx (lambda (q) (calc/partial f 0 q)))
(< (abs (- (calc/partial fx 1 (list 2 3)) 4)) 0.1)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 2.000001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/partial f 0 (list 1 2))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :program
  ```scheme
  (define f (lambda (p) (* (car p) (cadr p))))
(define fx (lambda (p) (calc/partial f 0 p)))
(define fxy (lambda (p) (calc/partial fx 1 p)))
(define fy (lambda (p) (calc/partial f 1 p)))
(define fyx (lambda (p) (calc/partial fy 0 p)))
(< (abs (- (fxy (list 1 1)) (fyx (list 1 1)))) 0.05)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* 3 (cadr p)))))
(define slice (lambda (x) (f (list x 5))))
(< (abs (- (calc/partial f 0 (list 2 5)) (calc/derivative slice 2))) 0.05)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 2.000001

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define f (lambda (p) (* (car p) (car p))))
(define g (lambda (p) (* (car p) (cadr p))))
(define h (lambda (p) (+ (* 2 (f p)) (* 3 (g p)))))
(< (abs (- (calc/partial h 0 (list 1 1)) (+ (* 2 (calc/partial f 0 (list 1 1))) (* 3 (calc/partial g 0 (list 1 1)))))) 0.1)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-5-emergence** :composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(list (calc/partial f 0 (list 1 1)) (calc/partial f 1 (list 1 1)) (calc/gradient f (list 1 1)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p) (cadr p)) (* (cadr p) (cadr p)))))
(define fx (lambda (q) (calc/partial f 0 q)))
(list 'fxx (calc/partial fx 0 (list 1 1)) 'fxy (calc/partial fx 1 (list 1 1)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.0000019999999998

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define grad (list (calc/partial f 0 (list 1 2)) (calc/partial f 1 (list 1 2))))
(define dir (list 0.6 0.8))
(+ (* (car grad) (car dir)) (* (cadr grad) (cadr dir)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```

### `calc/surface-integral` — file `11-calc.slat`

- **row-4-proof** :program
  ```scheme
  (define F (lambda (p) (list (car p) (cadr p) (caddr p))))
(define x (lambda (u v) (* (cos u) (sin v))))
(define y (lambda (u v) (* (sin u) (sin v))))
(define z (lambda (u v) (cos v)))
(define flux (calc/surface-integral F x y z 0 (* 2 3.14159) 0 3.14159))
(< (abs (- flux (* 4 3.14159))) 0.5)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :math-program
  ```scheme
  (define sphere (lambda (u v) (list (* (cos u) (sin v)) (* (sin u) (sin v)) (cos v))))
(define one (lambda (x y z) 1))
(< (abs (- (calc/surface-integral sphere one 'scalar) (* 4 3.14159))) 0.5)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define F (lambda (x y z) (list (- y) x 0)))
(define cap (lambda (u v) (list (* (cos u) (sin v)) (* (sin u) (sin v)) (cos v))))
(list 'curl-flux (calc/surface-integral cap F 'flux) 'curl-z (caddr (calc/curl F (list 0 0 1))))
  ```
  Error:
  ```
  error: caddr: expected a pair or a non-empty list, got the empty list

  ```

### `calc/total-differential` — file `11-calc.slat`

- **row-2-audit** :program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/total-differential f (list 1 1) (list 0.01 0.02))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define (predict-change f pos step)
  (calc/total-differential f pos step))
(predict-change (lambda (xy) (+ (* (car xy) (car xy)) (* (cadr xy) (cadr xy))))
  (list 1 2) (list 0.01 0.01))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-2-audit** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(< (abs (- (calc/total-differential f (list 1 1) (list 0.01 0.02)) 0.06)) 0.001)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (safe-td f pos step) (if (= (length pos) (length step)) (calc/total-differential f pos step) 'dim-mismatch))
(safe-td (lambda (p) (* (car p) (cadr p))) (list 2 3) (list 0.1 0.1))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 2.000001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/total-differential f (list 1 1) (list 0.01 0.02))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-3-dimension** :code
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(calc/total-differential f (list 1 1) (list 0.01 0.02))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define x (list 1 1))
(define v (list 0.1 0)) (define w (list 0 0.1))
(< (abs (- (calc/total-differential f x (list 0.2 0.3))
           (+ (* 2 (calc/total-differential f x v))
              (* 3 (calc/total-differential f x w)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(< (abs (calc/total-differential f (list 1 1) (list 0 0))) 0.001)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define x (list 1 1))
(< (abs (+ (calc/total-differential f x (list 0.05 0.05))
           (calc/total-differential f x (list -0.05 -0.05)))) 0.001)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (number-out? f pos step) (number? (calc/total-differential f pos step)))
(number-out? (lambda (p) (* (car p) (cadr p))) (list 1 2) (list 0.01 0.01))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-5-emergence** :composition
  ```scheme
  (define f (lambda (p) (* (car p) (cadr p))))
(define x (list 1 2))
(define errs (list (list 0.01 0) (list 0 0.01) (list 0.01 0.01)))
(map (lambda (d) (calc/total-differential f x d)) errs)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (descent-direction? f pos dir)
  (< (calc/total-differential f pos dir) 0))
(descent-direction? (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p))))
  (list 1 1) (list -0.1 -0.1))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.000001

  ```

### `chem/formula-counts` — file `13-chem.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (all-pairs? c) (and (list? c) (fold (lambda (ok p) (and ok (= (length p) 2))) #t c)))
(all-pairs? (chem/formula-counts "H2O"))
  ```
  Error:
  ```
  error: length: expected a proper list, got #t

  ```

### `boolean=?` — file `16-compare.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (count-matching ref flags) (fold (lambda (n f) (if (boolean=? f ref) (+ n 1) n)) 0 flags))
(count-matching #t (list #t #f #t #t #f))
  ```
  Error:
  ```
  error: +: expected a number, got #f

  ```

### `complex/*` — file `17-complex.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define input '(3 4))
(define phasor '(0.7071 0.7071))
(define rotated (complex/* input phasor))
(define modulus-preserved? (< (abs (- (+ (* (car input) (car input)) (* (cadr input) (cadr input))) (+ (* (car rotated) (car rotated)) (* (cadr rotated) (cadr rotated))))) 0.01))
modulus-preserved?
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```

### `complex/+` — file `17-complex.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (mean-of-pair z1 z2) (list (/ (car (complex/+ z1 z2)) 2) (/ (cadr (complex/+ z1 z2)) 2)))
(mean-of-pair '(4 6) '(2 -2))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (centroid points) (let ((n (length points))) (let ((sum (let loop ((xs points) (acc '(0 0))) (if (null? xs) acc (loop (cdr xs) (complex/+ acc (car xs))))))) (list (/ (car sum) n) (/ (cadr sum) n)))))
(centroid (list '(0 0) '(6 0) '(3 6)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```

### `complex/-` — file `17-complex.slat`

- **row-4-proof** :math-program
  ```scheme
  (define (anti-commutative? a b) (equal? (complex/- a b) (list (- (car (complex/- b a))) (- (cadr (complex/- b a))))))
(anti-commutative? '(3 4) '(1 2))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (error-signal target actual) (complex/- target actual))
(define (control-step target state gain) (let ((err (error-signal target state))) (complex/+ state (list (* gain (car err)) (* gain (cadr err))))))
(control-step '(10 10) '(3 4) 0.5)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (finite-difference f z h) (list (/ (car (complex/- (f (list (+ (car z) h) (cadr z))) (f z))) h) (/ (cadr (complex/- (f (list (+ (car z) h) (cadr z))) (f z))) h)))
(finite-difference (lambda (z) (complex/* z z)) '(1 0) 0.01)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```

### `complex/conjugate` — file `17-complex.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define z '(3 4))
(define zbar (complex/conjugate z))
(define product (complex/* z zbar))
(= (cadr product) 0)
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (only-sign-flip? z) (let ((zbar (complex/conjugate z))) (and (= (car z) (car zbar)) (= (cadr z) (- (cadr zbar))))))
(only-sign-flip? '(5 -7))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (modulus-squared z) (car (complex/* z (complex/conjugate z))))
(modulus-squared '(3 4))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (spectral-power fft-bins) (map (lambda (z) (car (complex/* z (complex/conjugate z)))) fft-bins))
(spectral-power (list '(1 1) '(0 2) '(3 0)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```

### `complex/exp` — file `17-complex.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (exp-safe z) (if (> (car z) 100) 'overflow (complex/exp z)))
(exp-safe (complex/make 200 0))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-4-proof** :program
  ```scheme
  (define z1 '(1 0))
(define z2 '(0 1.5708))
(define lhs (complex/exp (complex/+ z1 z2)))
(define rhs (complex/* (complex/exp z1) (complex/exp z2)))
(< (car (complex/- lhs rhs)) 0.001)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define z (complex/exp (complex/make 0 0)))
(and (< (abs (- (car z) 1)) 0.001) (< (abs (cadr z)) 0.001))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (eulers-identity) (let ((result (complex/exp (complex/make 0 3.14159265)))) (< (abs (+ (car result) 1)) 0.01)))
(eulers-identity)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```

### `complex/from-polar` — file `17-complex.slat`

- **row-4-proof** :program
  ```scheme
  (define z '(3 4))
(let ((p (complex/->polar z)))
  (< (car (complex/- (complex/from-polar (car p) (cadr p)) z)) 0.001))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define z (complex/from-polar 1 0))
(and (< (abs (- (car z) 1)) 0.001) (< (abs (cadr z)) 0.001))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (modulus-of-polar-is-r r theta) (let ((z (complex/from-polar r theta))) (< (abs (- (sqrt (+ (* (car z) (car z)) (* (cadr z) (cadr z)))) r)) 0.001)))
(modulus-of-polar-is-r 5 0.9273)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (period-2pi? r theta) (let ((z1 (complex/from-polar r theta)) (z2 (complex/from-polar r (+ theta (* 2 3.14159265))))) (and (< (abs (- (car z1) (car z2))) 0.001) (< (abs (- (cadr z1) (cadr z2))) 0.001))))
(period-2pi? 1 0.5)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```

### `complex/make` — file `17-complex.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define z (complex/make 3 4))
(and (= (car z) 3) (= (cadr z) 4))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got a value of another kind

  ```

### `cpu/state` — file `18b-cpu.slat`

- **row-3-dimension** :code
  ```scheme
  (define r (list (cons ':x 1) (cons ':y 2)))
(cadr (assoc ':y r))
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got the number 2

  ```

### `cortex/query` — file `19-cortex.slat`

- **row-3-dimension** :code
  ```scheme
  (cortex/remember 'a/1 1) (cortex/remember 'a/2 2) (cortex/remember 'b/1 3)
(define (q prefix)
  (filter (lambda (k) (string=? prefix (substring (symbol->string k) 0 (string-length prefix))))
          (cortex/keys)))
(display (q "a/")) (newline)
  ```
  Error:
  ```
  error: substring: end 2 is past the end of a string of length 1. To TEST a prefix use (string-prefix? "..." s); to TRUNCATE use (substring s 0 (min 2 (string-length s))).

  ```
- **row-4-proof** :cs-program
  ```scheme
  (cortex/remember 'z/1 'a) (cortex/remember 'z/2 'b)
(define (query-keys prefix) (filter (lambda (k) (string=? prefix (substring (symbol->string k) 0 (string-length prefix)))) (cortex/keys)))
(display (and (member "z/1" (query-keys "z/")) #t)) (newline)
  ```
  Error:
  ```
  error: substring: end 2 is past the end of a string of length 1. To TEST a prefix use (string-prefix? "..." s); to TRUNCATE use (substring s 0 (min 2 (string-length s))).

  ```
- **row-5-emergence** :composition
  ```scheme
  (cortex/remember 'log/2026-07-19/click 1)
(cortex/remember 'log/2026-07-19/view 2)
(cortex/remember 'log/2026-07-18/click 3)

(define (query-keys prefix)
  (filter (lambda (k)
            (let ((s (if (symbol? k) (symbol->string k) k)))
              (and (>= (string-length s) (string-length prefix)
  ```
  Error:
  ```
  error: +: expected a number, got a list

  ```

### `cortex/size` — file `19-cortex.slat`

- **row-5-emergence** :composition
  ```scheme
  (for-each cortex/forget (cortex/keys))

(define soft-cap 10)

(define (remember-with-cap key value)
  (if (< (cortex/size) soft-cap)
      (begin (cortex/remember key value) 'stored)
      (begin
        ;; evict the first key to make room
        (let ((victim (car (cortex/keys))))
          (corte
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the empty list

  ```

### `curve/accel` — file `20-curve.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (accel-at h t) (map (lambda (f) (/ (+ (f (+ t h)) (f (- t h)) (* -2 (f t))) (* h h))) (list car cadr)))
(define g (lambda (t) (list (sin t) (cos t))))
(define coarse (accel-at 0.1 1.0))
(define fine   (accel-at 0.01 1.0))
(define residual (map (lambda (a b) (abs (- a b))) coarse fine))
(fold
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 1.1

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define ramp (lambda (t) (list t 0 (* 0.5 9.8 t t))))
(define a (curve/accel ramp))
(< (abs (- (list-ref a 2) 9.8)) 0.01)
  ```
  Error:
  ```
  error: -: expected a number, got nothing

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (frenet-kappa gamma)
  (let* ((v (curve/velocity gamma)) (a (curve/accel gamma))
         (sp (vec/norm v))
         (cross (- (* (car v) (cadr a)) (* (cadr v) (car a)))))
    (/ (abs cross) (expt sp 3))))
(frenet-kappa (lambda (t) (list (cos t) (sin t))))
  ```
  Error:
  ```
  error: /: division by zero

  ```

### `curve/brachistochrone` — file `20-curve.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define ramps '((3.0 1.0) (5.0 2.0) (8.0 3.0)))
(define solved (map (lambda (xy) (curve/brachistochrone (car xy) (cadr xy))) ramps))
(define radii (map car solved))
(fold min 1e18 radii)
  ```
  Error:
  ```
  error: min: expected a number, got a list

  ```
- **row-2-audit** :math-program
  ```scheme
  (define sol (curve/brachistochrone 3.14159 2.0))
(define R (car sol))
(define theta (cadr sol))
(define recon-y (* R (- 1 (cos theta))))
(< (abs (- recon-y 2.0)) 0.02)
  ```
  Error:
  ```
  error: *: expected a number, got a list

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define sol1 (curve/brachistochrone 4.0 2.0))
(define sol2 (curve/brachistochrone 4.0 2.0))
(and (< (abs (- (car sol1) (car sol2))) 1e-6) (< (abs (- (cadr sol1) (cadr sol2))) 1e-6))
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :math-program
  ```scheme
  (define pi 3.14159265)
(define sol (curve/brachistochrone pi 2.0))
(define R (car sol))
(define theta (cadr sol))
(define x-recon (* R (- theta (sin theta))))
(< (abs (- x-recon pi)) 0.02)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define target '(4 2))
(define sol (curve/brachistochrone (car target) (cadr target)))
(define R (car sol)) (define theta (cadr sol))
(define arc (* R (- theta (sin theta))))
(define chord (sqrt (+ (* (car target) (car target)) (* (cadr target) (cadr target)))))
(> arc chord)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```

### `curve/catmull-rom` — file `20-curve.slat`

- **row-4-proof** :program
  ```scheme
  (define pts '((0 0) (2 3) (5 3) (7 0) (9 2)))
(define spline (curve/catmull-rom pts))
(define interior (cdr (reverse (cdr (reverse pts)))))
(define (near a b) (< (+ (abs (- (car a) (car b))) (abs (- (cadr a) (cadr b)))) 0.001))
(define t-vals (map (lambda (i) (/ (+ i 1) (- (length pts) 1))) (iota (l
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define wp '((0 0) (5 5) (10 0) (15 5) (20 0)))
(define s (curve/catmull-rom wp))
(define at-mid (curve/sample s 2))
(define expected '(10 0))
(< (+ (abs (- (car at-mid) (car expected))) (abs (- (cadr at-mid) (cadr expected)))) 0.01)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```

### `curve/christoffel` — file `20-curve.slat`

- **row-3-dimension** :code
  ```scheme
  (define fx '((usd eur 0.92) (eur jpy 160) (jpy usd 0.0068)))
(define (through a b c) (* (cadr (assoc a fx)) (cadr (assoc b fx))))
(through 'usd 'eur 'jpy)
  ```
  Error:
  ```
  error: *: expected a number, got the symbol eur

  ```

### `entity/set!` — file `24-entity.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (award-xp id amount)
  (let ((current (or (entity/ref id 'xp) 0)))
    (entity/set! id 'xp (+ current amount))
    (when (> (entity/ref id 'xp) 100)
      (entity/set! id 'level (+ (or (entity/ref id 'level) 1) 1))
      (entity/set! id 'xp 0))))
(award-xp 'hero 30) (award-xp 'hero 80)
  ```
  Error:
  ```
  error: +: expected a number, got the symbol nan

  ```

### `entity/state` — file `24-entity.slat`

- **row-4-proof** :eng-program
  ```scheme
  (entity/make 'e 10 20)
(define s1 (entity/state 'e))
(define s2 (entity/state 'e))
;; purity: two reads with no mutation between them return equal snapshots,
;; and each read is a fresh copy — mutating one (via list-set!) cannot corrupt
;; the entity or the other snapshot.
(list-set! s1 1 999)
(and 
  ```
  Error:
  ```
  error: list-set!: not a list undefined

  ```

### `game/surreal-mul` — file `28-game.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (distributivity-check a b c)
  ;; a · (b + c) = a·b + a·c
  (game/surreal-eq? (game/surreal-mul a (game/surreal-add b c))
                    (game/surreal-add (game/surreal-mul a b) (game/surreal-mul a c))))
(distributivity-check (game/surreal-lit 2) (game/surreal-lit 3) (game/surreal-lit 4
  ```
  Error:
  ```
  <timeout>
  ```

### `geom/regular-polygon-vertices` — file `29-geom.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (generator-driven-mesh n radius edge-fn) (let* ((verts (geom/regular-polygon-vertices n radius 0)) (edges (let loop ((vs verts) (acc (list))) (cond ((null? vs) (reverse acc)) ((null? (cdr vs)) (reverse (cons (edge-fn (car vs) (car verts)) acc))) (else (loop (cdr vs) (cons (edge-fn (car vs) (
  ```
  Error:
  ```
  error: length: expected a proper list, got the symbol a

  ```

### `geom/solve-right` — file `29-geom.slat`

- **row-4-proof** :program
  ```scheme
  (define r (geom/solve-right '(:opp 3 :adj 4)))
(< (abs (- (list-ref r 1) 5)) 0.01)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (round-trip-hyp-angle? hyp angle-deg) (let* ((r (geom/solve-right (list ':hyp hyp ':angle angle-deg))) (opp (list-ref r 3)) (adj (list-ref r 5)) (r2 (geom/solve-right (list ':opp opp ':adj adj)))) (< (abs (- (list-ref r2 1) hyp)) 0.01)))
(round-trip-hyp-angle? 13 75)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (angle-plus-comp-is-90? config) (let* ((r (geom/solve-right config)) (theta (list-ref r 7)) (comp (- 90 theta))) (< (abs (- (+ theta comp) 90)) 1e-6)))
(angle-plus-comp-is-90? '(:opp 3 :adj 4))
  ```
  Error:
  ```
  error: -: expected a number, got nothing

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (ballistic-launch-range hyp-vel angle-deg) (let* ((r (geom/solve-right (list ':hyp hyp-vel ':angle angle-deg))) (vx (list-ref r 5)) (vy (list-ref r 3)) (g 9.81) (t-flight (/ (* 2 vy) g))) (* vx t-flight)))
(ballistic-launch-range 30 45)
  ```
  Error:
  ```
  error: *: expected a number, got a list

  ```

### `grid/flower-pos` — file `30-grid.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (sq-dist p tx ty)
  (+ (* (- (car p) tx) (- (car p) tx))
     (* (- (cdr p) ty) (- (cdr p) ty))))
(define (nearest tx ty)
  (fold (lambda (id best)
               (let ((p (grid/flower-pos id)))
                 (if (and p (or (not best) (< (sq-dist p tx ty) (cdr best))))
                   
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (argmin-dist tx ty)
  ;; argmin over a squared-distance function across the registry
  (define (d id) (let ((p (grid/flower-pos id)))
                   (and p (+ (expt (- (car p) tx) 2) (expt (- (cdr p) ty) 2)))))
  (fold (lambda (id b)
               (let ((dd (d id)))
                 (if
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```

### `filter-map` — file `33-higher-order.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (rationalize-safe num den)
  (if (zero? den) #f (/ num den)))
(define nums '(1 2 3 4 5))
(define dens '(2 0 4 0 8))
(filter-map rationalize-safe nums dens)
  ```
  Error:
  ```
  error: /: expected a number, got nothing

  ```

### `juggle/balls` — file `36-juggle.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define catalog '((3) (4 4) (5 3 1) (6 4 4 1) (5 5 5 5 5)))
(define counts (map juggle/balls catalog))
(list 'min (apply min counts) 'max (apply max counts))
  ```
  Error:
  ```
  error: min: expected a number, got the symbol nan

  ```

### `juggle/max-throw` — file `36-juggle.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define patterns '((3) (5 3 1) (6 4 4 1)))
(define maxes (map juggle/max-throw patterns))
(list 'global-max (apply max maxes) 'global-min (apply min maxes))
  ```
  Error:
  ```
  error: max: expected a number, got the symbol nan

  ```

### `linalg/is-orthogonal?` — file `38-linalg.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (svd-compressor A)
  (let ((decomp (linalg/svd A)))
    (let ((U (cadr (assoc ':U decomp)))
          (V (cadr (assoc ':V decomp))))
      (list ':U-orthogonal? (linalg/is-orthogonal? U)
            ':V-orthogonal? (linalg/is-orthogonal? V)))))
(svd-compressor '((3 0)(0 2)))
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got #f

  ```

### `linalg/lu` — file `38-linalg.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (P-is-permutation? A)
  (let* ((lu (linalg/lu A))
         (P (caddr lu))
         (row0 (list (matrix/get P 0 0) (matrix/get P 0 1)))
         (row1 (list (matrix/get P 1 0) (matrix/get P 1 1))))
    (and (= (+ (car row0) (cadr row0)) 1)
         (= (+ (car row1) (cadr row1)) 1))))
(P-is-pe
  ```
  Error:
  ```
  error: caddr: expected a pair or a non-empty list, got the empty list

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (solve-with-lu A b)
  (let* ((lu (linalg/lu A))
         (L (car lu)) (U (cadr lu)) (P (caddr lu))
         (Pb (linalg/mv P b))
         (y (linalg/solve L Pb))
         (x (linalg/solve U y)))
    x))
(solve-with-lu '((2 1)(1 3)) '(5 10))
  ```
  Error:
  ```
  error: caddr: expected a pair or a non-empty list, got the empty list

  ```

### `math/mixed-number` — file `40-math.slat`

- **row-4-proof** :program
  ```scheme
  (define m (math/mixed-number '(7 3)))
(define w (list-ref m 0))
(define n (list-ref m 1))
(define d (list-ref m 2))
(= (/ 7 3) (+ w (/ n d)))
  ```
  Error:
  ```
  error: /: division by zero

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define m (math/mixed-number '(11 4)))
(= (/ 11 4) (+ (list-ref m 0) (/ (list-ref m 1) (list-ref m 2))))
  ```
  Error:
  ```
  error: /: division by zero

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (roundtrip? nd)
  (let ((m (math/mixed-number nd)))
    (= (/ (car nd) (cadr nd))
       (+ (list-ref m 0) (/ (list-ref m 1) (list-ref m 2))))))
(and (roundtrip? '(7 3)) (roundtrip? '(15 4)))
  ```
  Error:
  ```
  error: /: division by zero

  ```

### `motion/cadence` — file `42-motion.slat`

- **row-4-proof** :program
  ```scheme
  (define (approx a b) (< (abs (- a b)) 0.5))
(define (check-reciprocity bpm sub factor)
  (let* ((cad (motion/cadence bpm sub))
         (p (hash-table-ref/default cad 'periodMs #f))
         (expected (/ 60000.0 (* bpm factor))))
    (approx p expected)))
(and (check-reciprocity 120 'q 1)
     (chec
  ```
  Error:
  ```
  error: -: expected a number, got #f

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (period-vector bpm subs)
  (map (lambda (s)
         (let ((cad (motion/cadence bpm s)))
           (if (hash-table-ref/default cad 'ok #f) (hash-table-ref/default cad 'periodMs #f) #f)))
       subs))
(define (lcm-approx-of xs)
  (apply max xs))
(let ((ps (period-vector 120 '(q 8 16))))
  (
  ```
  Error:
  ```
  error: max: expected a number, got #f

  ```

### `motion/pocket` — file `42-motion.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define pockets (motion/pocket 16 5))
(define (nearest-pocket-to t)
  (let loop ((ps pockets) (best (car pockets)) (dist (abs (- t (car pockets)))))
    (cond ((null? ps) best)
          ((< (abs (- t (car ps))) dist) (loop (cdr ps) (car ps) (abs (- t (car ps)))))
          (else (loop (cdr ps) best
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :program
  ```scheme
  (define pockets (motion/pocket 16 5))
(define (all-mirrored? xs)
  (let ((s xs))
    (let loop ((xs xs))
      (if (null? xs) #t
          (if (member (- (car xs)) s) (loop (cdr xs)) #f)))))
(all-mirrored? pockets)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-multiple-configs)
  (let loop ((cfgs '((16 3) (24 5) (32 7))) (all-ok #t))
    (cond ((null? cfgs) all-ok)
          (else (let* ((cfg (car cfgs))
                       (ps (motion/pocket (car cfg) (cadr cfg))))
                  (loop (cdr cfgs)
                        (and all-ok
  
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (sum-zero? xs)
  (let loop ((xs xs) (s 0))
    (if (null? xs) (< (abs s) 0.001)
      (loop (cdr xs) (+ s (car xs))))))
(sum-zero? (motion/pocket 16 5))
  ```
  Error:
  ```
  error: +: expected a number, got a list

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (snap-many events pockets)
  (map (lambda (t)
         (let loop ((ps pockets) (best (car pockets)) (d (abs (- t (car pockets)))))
           (cond ((null? ps) (+ t best))
                 ((< (abs (- t (car ps))) d) (loop (cdr ps) (car ps) (abs (- t (car ps)))))
                 (else (loop
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (grid-widths pockets)
  (let loop ((xs pockets) (prev #f) (gaps '()))
    (cond ((null? xs) (reverse gaps))
          (prev (loop (cdr xs) (car xs) (cons (- (car xs) prev) gaps)))
          (else (loop (cdr xs) (car xs) gaps)))))
(grid-widths (motion/pocket 16 5))
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (make-quantizer tol n)
  (let ((cache (motion/pocket tol n)))
    (lambda (t)
      (let loop ((ps cache) (best (car cache)) (d (abs (- t (car cache)))))
        (cond ((null? ps) best)
              ((< (abs (- t (car ps))) d) (loop (cdr ps) (car ps) (abs (- t (car ps)))))
              (el
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```

### `note/strike` — file `43-note.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (fundamental) (note/strike 'c4 (/ 60 (audio-bpm))))
(fundamental)
  ```
  Error:
  ```
  error: /: expected a number, got #f

  ```

### `nt/divisor-count` — file `44-nt.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (tau-formula-witness n)
  ;; τ(n) = ∏(aᵢ+1) via prime factorisation.
  (let ((pf (nt/prime-factorization n)))
    (= (nt/divisor-count n)
       (fold * 1 (map (lambda (p) (+ 1 (cdr p))) pf)))))
(tau-formula-witness 60)
  ```
  Error:
  ```
  error: +: expected a number, got a list

  ```

### `nt/divmod` — file `44-nt.slat`

- **row-4-proof** :program
  ```scheme
  (let* ((qr (nt/divmod 17 5)) (q (cdr (car qr))) (r (cdr (cadr qr))))
  (= (+ (* q 5) r) 17))
  ```
  Error:
  ```
  error: *: expected a number, got a list

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (reconstruct-batch pairs)
  (map (lambda (p)
         (let* ((a (car p)) (b (cadr p))
                (qr (nt/divmod a b))
                (q (cdr (car qr))) (r (cdr (cadr qr))))
           (= (+ (* q b) r) a)))
       pairs))
(reconstruct-batch (list (list 89 7) (list 561 13) (list 1729 89)
  ```
  Error:
  ```
  error: *: expected a number, got a list

  ```

### `nt/mod-inverse` — file `44-nt.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (safe-modular-solve a b m)
  ;; Solve a·x ≡ b (mod m); returns null on no-inverse.
  (let ((inv (nt/mod-inverse a m)))
    (if (null? inv) 'unsolvable (nt/mod (* inv b) m))))
(list (safe-modular-solve 3 5 7) (safe-modular-solve 6 5 9))
  ```
  Error:
  ```
  error: *: expected a number, got nothing

  ```

### `nt/prime-factorization` — file `44-nt.slat`

- **row-2-audit** :program
  ```scheme
  (define pf (nt/prime-factorization 60))
(fold * 1 (map (lambda (p) (+ 1 (cdr p))) pf))
  ```
  Error:
  ```
  error: +: expected a number, got a list

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (totient-via-factorization n)
  ;; Chain nt/prime-factorization with Euler's product formula.
  (let ((pf (nt/prime-factorization n)))
    (fold (lambda (p acc) (* acc (expt (car p) (- (cdr p) 1)) (- (car p) 1))) 1 pf)))
(totient-via-factorization 12)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (divisor-count-via-tau n)
  ;; τ(n) = Π(aᵢ+1) directly from prime-factorization.
  (fold * 1 (map (lambda (p) (+ 1 (cdr p))) (nt/prime-factorization n))))
(list (divisor-count-via-tau 60) (nt/divisor-count 60))
  ```
  Error:
  ```
  error: +: expected a number, got a list

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (gcd-via-min-exponents a b)
  ;; gcd(a,b) = ∏ p^{min(aᵢ,bᵢ)} over primes in both factorizations.
  (let ((pa (nt/prime-factorization a))
        (pb (nt/prime-factorization b)))
    (fold * 1
      (map (lambda (pair)
             (let ((match (assoc (car pair) pb)))
               (if match
  ```
  Error:
  ```
  error: min: expected a number, got a list

  ```

### `object/spawn` — file `46-object.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (batch-with-failures targets on-fail) (fold (lambda (fails t) (let ((r (object/spawn t))) (if (eq? r 'ok) fails (+ fails 1)))) 0 targets))
(batch-with-failures (list 'a 'b) (lambda (t) (list :failed t)))
  ```
  Error:
  ```
  error: +: expected a number, got the symbol a

  ```

### `ops/dijkstra` — file `47-ops.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define g '((A . ((B . 1) (C . 4))) (B . ((C . 2) (D . 5))) (C . ((D . 1))) (D . ())))
(let ((t (ops/dijkstra g 'A)))
  (list 'dist-to-D (cdr (assoc 'D (car t)))
        'path-A-to-D 'A-B-C-D))
  ```
  Error:
  ```
  error: cdr: expected a pair or a non-empty list, got #f

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define g '((A . ((B . 1) (C . 4))) (B . ((C . 2) (D . 5))) (C . ((D . 1))) (D . ())))
(let ((t (ops/dijkstra g 'A)))
  (= 0 (cdr (assoc 'A (car t)))))
  ```
  Error:
  ```
  error: cdr: expected a pair or a non-empty list, got #f

  ```
- **row-4-proof** :math-program
  ```scheme
  (define g '((A . ())))
(define t (ops/dijkstra g 'A))
(= 0 (cdr (assoc 'A (car t))))
  ```
  Error:
  ```
  error: cdr: expected a pair or a non-empty list, got #f

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define g '((A . ((B . 1) (C . 4))) (B . ((C . 2) (D . 5))) (C . ((D . 1))) (D . ())))
(define (reconstruct-path table src dst)
  (let loop ((node dst) (path (list dst)))
    (if (eq? node src)
      (reverse path)
      (let ((pred (cdr (assoc node (cadr table)))))
        (loop pred (cons pred pat
  ```
  Error:
  ```
  error: cdr: expected a pair or a non-empty list, got #f

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (all-distances g src)
  (let ((table (ops/dijkstra g src)))
    (map (lambda (entry) (list (car entry) (cdr entry))) (car table))))
(all-distances '((A . ((B . 1) (C . 4))) (B . ((C . 2))) (C . ())) 'A)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol A

  ```

### `ops/johnson` — file `47-ops.slat`

- **row-2-audit** :eng-program
  ```scheme
  (let* ((jobs '((cut . ((m1 . 3) (m2 . 6)))
               (fold . ((m1 . 8) (m2 . 4)))
               (pack . ((m1 . 5) (m2 . 2)))))
       (seq (ops/johnson jobs))
       (mk (car (assoc 'makespan (ops/sequence-metrics seq 'processing)))))
  (list 'sequence seq 'makespan mk))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (schedule-two-stage jobs)
  (let ((seq (ops/johnson jobs)))
    (if (pair? seq)
      (list 'ok seq)
      (escalate 'johnson-failed seq))))
(schedule-two-stage '((a . ((m1 . 2) (m2 . 8))) (b . ((m1 . 5) (m2 . 3)))))
  ```
  Error:
  ```
  error: escalate: johnson-failed 

  ```
- **row-4-proof** :eng-program
  ```scheme
  (let* ((jobs '((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4))) (c . ((m1 . 5) (m2 . 2)))))
       (johnson-mk (car (assoc 'makespan (ops/sequence-metrics (ops/johnson jobs) 'processing))))
       (spt-mk (car (assoc 'makespan (ops/sequence-metrics (ops/spt jobs) 'processing)))))
  (<= johnson-mk
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (johnson-optimal? jobs heuristic-seq)
  (let ((j-mk (car (assoc 'makespan (ops/sequence-metrics (ops/johnson jobs) 'processing))))
        (h-mk (car (assoc 'makespan (ops/sequence-metrics heuristic-seq 'processing)))))
    (<= j-mk h-mk)))
(johnson-optimal? '((a . ((m1 . 3) (m2 . 6))) (b . 
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (schedule-and-report jobs)
  (let* ((seq (ops/johnson jobs))
         (m (ops/sequence-metrics seq 'processing)))
    (list 'order seq 'makespan (car (assoc 'makespan m)))))
(map schedule-and-report (list '((a . ((m1 . 3) (m2 . 6))) (b . ((m1 . 8) (m2 . 4))))))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got #f

  ```

### `ops/max-flow` — file `47-ops.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define sources '(0 1 2))
(define g '((0 1 5) (1 2 3)))
(map (lambda (s) (list s (ops/max-flow g s 2))) sources)
  ```
  Error:
  ```
  <timeout>
  ```

### `ops/spt` — file `47-ops.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (dispatch jobs)
  (let ((ordered (ops/spt jobs)))
    (list 'order ordered 'metrics (ops/sequence-metrics ordered))))
(dispatch '((id . 1 p . 10) (id . 2 p . 5) (id . 3 p . 8)))
  ```
  Error:
  ```
  error: more than one form after . in pair (line 4, col 17)

  ```
- **row-2-audit** :math-program
  ```scheme
  (ops/spt '((id . 1 p . 10) (id . 2 p . 5) (id . 3 p . 8)))
  ```
  Error:
  ```
  error: more than one form after . in pair (line 1, col 16)

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (first-job jobs)
  (car (ops/spt jobs)))
(first-job '((id . 1 p . 10) (id . 2 p . 5) (id . 3 p . 8)))
  ```
  Error:
  ```
  error: more than one form after . in pair (line 3, col 18)

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define jobs '((id . 1 p . 8) (id . 2 p . 3) (id . 3 p . 5)))
(define spt-flow (cadr (ops/sequence-metrics (ops/spt jobs))))
(define orig-flow (cadr (ops/sequence-metrics jobs)))
(if (<= spt-flow orig-flow)
  (list 'spt-optimal-ok spt-flow orig-flow)
  (escalate 'spt-not-optimal null))
  ```
  Error:
  ```
  error: more than one form after . in pair (line 1, col 20)

  ```
- **row-4-proof** :math-program
  ```scheme
  (define jobs '((id . 1 p . 8) (id . 2 p . 3) (id . 3 p . 5)))
(<= (cadr (ops/sequence-metrics (ops/spt jobs)))
    (cadr (ops/sequence-metrics jobs)))
  ```
  Error:
  ```
  error: more than one form after . in pair (line 1, col 20)

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (spt-improves-flow? jobs)
  (<= (cadr (ops/sequence-metrics (ops/spt jobs)))
      (cadr (ops/sequence-metrics jobs))))
(spt-improves-flow? '((id . 1 p . 8) (id . 2 p . 3) (id . 3 p . 5)))
  ```
  Error:
  ```
  error: more than one form after . in pair (line 4, col 27)

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (schedule-and-grade jobs)
  (let* ((seq (ops/spt jobs))
         (m (ops/sequence-metrics seq)))
    (list 'sequence seq 'makespan (car m) 'total-flow (cadr m))))
(schedule-and-grade '((id . 1 p . 3) (id . 2 p . 5) (id . 3 p . 1)))
  ```
  Error:
  ```
  error: more than one form after . in pair (line 5, col 27)

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define jobs '((id . 1 p . 3) (id . 2 p . 5)))
(define seq (ops/spt jobs))
(ops/sequence-metrics seq)
  ```
  Error:
  ```
  error: more than one form after . in pair (line 1, col 20)

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (spt-flow jobs)
  (cadr (ops/sequence-metrics (ops/spt jobs))))
(spt-flow '((id . 1 p . 3) (id . 2 p . 5) (id . 3 p . 1)))
  ```
  Error:
  ```
  error: more than one form after . in pair (line 3, col 17)

  ```

### `phys/lagrange-residual` — file `50-phys.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define L (phys/L-free 1.0))
(define (verify-trajectory L traj-fn times tol)
  (define (approx a b) (< (abs (- a b)) tol))
  (let loop ((ts times))
    (if (null? ts) 'verified
        (let ((state (traj-fn (car ts))))
          (if (approx (phys/lagrange-residual L (car state) (cadr state) (car ts)
  ```
  Error:
  ```
  error: *: expected a number, got a list

  ```

### `phys/quantity->tag` — file `50-phys.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define mystery (phys/quantity 20.0 '((length . 1) (time . -1))))
(define tag (phys/quantity->tag mystery))
(cadr (assq ':dimension tag))
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got #f

  ```
- **row-4-proof** :program
  ```scheme
  (define q (phys/quantity 9.8 '((length . 1))))
(define tag (phys/quantity->tag q))
(define reconstructed (phys/quantity (cadr (assq ':value tag)) (cadr (assq ':dimension tag))))
(equal? q reconstructed)
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got #f

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (tag->line name q)
  (let ((tag (phys/quantity->tag q)))
    (list name
          '=> (cadr (assq ':value tag))
          'dim (cadr (assq ':dimension tag)))))
(define (report named-qs)
  (map (lambda (nq) (tag->line (car nq) (cdr nq))) named-qs))
(report (list (cons 'height (phys/quantity 1
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got #f

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (dimension-of q)
  (cadr (assq ':dimension (phys/quantity->tag q))))
(define (group-by-dimension quantities)
  (let loop ((qs quantities) (groups '()))
    (if (null? qs) (reverse groups)
        (let* ((d (dimension-of (car qs)))
               (hit (assoc d groups)))
          (loop (cdr q
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got #f

  ```

### `plot/function` — file `51-plot.slat`

- **row-2-audit** :eng-program
  ```scheme
  (plot/function (lambda (x) (/ 1 x)) '(-3 3))
  ```
  Error:
  ```
  error: /: division by zero

  ```

### `nan?` — file `52-predicate.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (safe-divide a b) (let ((r (/ a b))) (if (nan? r) 'nan-detected r)))
(safe-divide 0.0 0.0)
  ```
  Error:
  ```
  error: /: division by zero

  ```

### `output-port?` — file `52-predicate.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (audit-write-cap ps) (fold (lambda (n p) (if (output-port? p) (+ n 1) n)) 0 ps))
(audit-write-cap (list (open-output-string) (open-input-string "x")))
  ```
  Error:
  ```
  error: +: expected a number, got a value of another kind

  ```

### `sprite/landmarks` — file `58-sprite.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define petals (sprite/landmarks 'hero))
(length petals)
  ```
  Error:
  ```
  error: length: expected a proper list, got a value of another kind

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (petal-count sprite) (length (sprite/landmarks sprite)))
(petal-count 'hero)
  ```
  Error:
  ```
  error: length: expected a proper list, got a value of another kind

  ```

### `synth/load-score` — file `62-synth.slat`

- **row-2-audit** :program
  ```scheme
  (define r (synth/load-score 'beethoven-9-mvt-4))
(car r)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define (try-load name)
  (let ((r (synth/load-score name)))
    (cond ((eq? (car r) 'ok) 'loaded)
          ((eq? (car r) 'pending-fetch) 'wait)
          (else 'failed))))
(memq (try-load 'beethoven-9-mvt-4) '(loaded wait failed))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (dispatch r on-ok on-wait on-err)
  (cond ((eq? (car r) 'ok) (on-ok (cadr r)))
        ((eq? (car r) 'pending-fetch) (on-wait))
        (else (on-err))))
(dispatch (synth/load-score 'beethoven-9-mvt-4)
          (lambda (s) 'got) (lambda () 'later) (lambda () 'no))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```
- **row-4-proof** :program
  ```scheme
  (let ((r (synth/load-score 'beethoven-9-mvt-4))) (memv (car r) '(ok error pending-fetch unknown-score)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (all-tagged? names)
  (let loop ((ns names) (ok #t))
    (if (null? ns) ok
      (loop (cdr ns)
            (and ok (symbol? (car (synth/load-score (car ns)))))))))
(all-tagged? '(beethoven-9-mvt-4 nonesuch other))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (load-and-play n)
  (let ((r (synth/load-score n)))
    (if (eq? (car r) 'ok) (synth/play (cadr r) 120) 'skip)))
(load-and-play 'beethoven-9-mvt-4)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (load-many names)
  (let loop ((ns names) (loaded '()))
    (if (null? ns) (reverse loaded)
      (let ((r (synth/load-score (car ns))))
        (loop (cdr ns)
              (if (eq? (car r) 'ok) (cons (car ns) loaded) loaded))))))
(load-many '(beethoven-9-mvt-4))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define fetch-log '())
(define (fetch+log n)
  (let ((r (synth/load-score n)))
    (set! fetch-log (cons (list n (car r)) fetch-log))
    r))
(fetch+log 'beethoven-9-mvt-4)
(length fetch-log)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```

### `synth/onset-tap` — file `62-synth.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (subscription? r)
  (and (pair? r) (eq? (car r) 'ok)))
(define r (synth/onset-tap (lambda (e) 'noted)))
(or (subscription? r) (symbol? (car r)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 120

  ```
- **row-4-proof** :program
  ```scheme
  (let* ((r (synth/onset-tap (lambda (e) 'fire)))
       (unsub (and (eq? (car r) 'ok) (cadr r))))
  (if unsub (unsub #t) 'ok))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 120

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define fired 0)
(define r (synth/onset-tap (lambda (e) (set! fired (+ fired 1)))))
(define unsub (and (eq? (car r) 'ok) (cadr r)))
(if unsub (begin (unsub #t) 'unsubscribed) 'no-sub)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the number 120

  ```

### `synth/play` — file `62-synth.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (loaded-song name tempo)
  (let ((r (synth/load-score name)))
    (if (eq? (car r) 'ok)
      (synth/play (cadr r) tempo)
      'skip)))
(loaded-song 'beethoven-9-mvt-4 120)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol error

  ```

### `synth/sp1200` — file `62-synth.slat`

- **row-4-proof** :program
  ```scheme
  (let ((r (synth/sp1200 'kick 0))) (memv (car r) '(ok pending-sample-bank error)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol ok

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (batch-witness samples)
  (let loop ((xs samples) (ok #t))
    (cond ((null? xs) ok)
          (else (loop (cdr xs) (and ok (let ((r (synth/sp1200 (car xs) 0))) (symbol? (car r)))))))))
(batch-witness '(kick snare hat crash tom))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol ok

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define r1 (synth/sp1200 'kick 0))
(define r2 (synth/sp1200 'kick 12))
(define r3 (synth/sp1200 'kick -12))
(and (symbol? (car r1)) (symbol? (car r2)) (symbol? (car r3)))
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the symbol ok

  ```

### `time/to-ms` — file `66-time.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define incoming "2020-01-01T00:00:00Z")
(define ms (time/to-ms incoming))
(display (if ms (- (time/now) ms) 'unparseable)) (newline)
  ```
  Error:
  ```
  error: -: expected a number, got the symbol nan

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (age-ms iso-string)
  (let ((then (time/to-ms iso-string)))
    (if then (- (time/now) then) #f)))
(display (age-ms "2020-01-01T00:00:00Z")) (newline)
  ```
  Error:
  ```
  error: -: expected a number, got the symbol nan

  ```

### `topo/betti-curve` — file `67-topo.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define filt (topo/rips-filtration '((0 0) (1 1) (-1 1) (0 -1)) '(0 0.8 1.5 2.0)))
(define (curve-delta curve) (map - (cdr curve) curve))
(display (curve-delta (topo/betti-curve filt 0)))
(newline)
  ```
  Error:
  ```
  error: -: expected a number, got a list

  ```

### `topo/betti-k` — file `67-topo.slat`

- **row-3-dimension** :code
  ```scheme
  (define c (topo/close (topo/complex '((0 1 2)))))
(display (= (topo/betti-k c 0) (car (topo/betti c))))
(newline)
(display (= (topo/betti-k c 1) (cadr (topo/betti c))))
(newline)
  ```
  Error:
  ```
  #t
error: cadr: expected a pair or a non-empty list, got the empty list

  ```
- **row-3-dimension** :code
  ```scheme
  (define c (topo/close (topo/complex '((0 1 2)))))
(display (= (topo/betti-k c 0) (car (topo/betti c))))
(newline)
(display (= (topo/betti-k c 1) (cadr (topo/betti c))))
(newline)
  ```
  Error:
  ```
  #t
error: cadr: expected a pair or a non-empty list, got the empty list

  ```
- **row-4-proof** :program
  ```scheme
  (define c (topo/close (topo/complex '((0 1 2)))))
(display (= (topo/betti-k c 0) (car (topo/betti c))))
(newline)
(display (= (topo/betti-k c 1) (cadr (topo/betti c))))
(newline)
  ```
  Error:
  ```
  #t
error: cadr: expected a pair or a non-empty list, got the empty list

  ```

### `topo/f-vector` — file `67-topo.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define c (topo/close (topo/complex '((0 1 2) (1 2 3)))))
(define fv (topo/f-vector c))
(display (list 'vertices (car fv) 'edges (cadr fv) 'faces (caddr fv)))
(newline)
  ```
  Error:
  ```
  error: caddr: expected a pair or a non-empty list, got the empty list

  ```
- **row-4-proof** :program
  ```scheme
  (define c (topo/close (topo/complex '((0 1 2)))))
(define fv (topo/f-vector c))
(define chi (topo/euler-char c))
(define alt (- (car fv) (cadr fv) (- 0 (caddr fv))))
(display (list 'chi chi 'alt alt))
(newline)
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got the empty list

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define c (topo/close (topo/complex '((0 1 2)))))
(define fv (topo/f-vector c))
(define chi (topo/euler-char c))
(display (= chi (- (car fv) (cadr fv) (- 0 (caddr fv)))))
(newline)
  ```
  Error:
  ```
  error: cadr: expected a pair or a non-empty list, got the empty list

  ```

### `topo/vietoris-rips` — file `67-topo.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define pts '((0 0) (1 0) (0 1)))
(define small (topo/vietoris-rips pts 0.5))
(define big (topo/vietoris-rips pts 1.5))
(display (<= (car (topo/f-vector small)) (car (topo/f-vector big))))
(newline)
  ```
  Error:
  ```
  error: car: expected a pair or a non-empty list, got the empty list

  ```

### `world/tape-audio` — file `72-world.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (audio-subset-of-frames?)
  (<= (length (world/tape-audio)) (length (world/tape-frames))))
(audio-subset-of-frames?)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```
- **row-4-proof** :eng-program
  ```scheme
  (world/tape-clear!) (world/tape-record!) (world/step) (world/step)
(<= (length (world/tape-audio)) (length (world/tape-frames)))
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 2

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (subset-witness)
  (let ((a (world/tape-audio)) (f (world/tape-frames)))
    (list ':|A| (length a) ':|F| (length f) ':subset? (<= (length a) (length f)))))
(subset-witness)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```

### `world/tape-clear!` — file `72-world.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (reset-lab)
  (world/tape-clear!)
  (list ':cleared? (zero? (length (world/tape-frames))) ':armed? (world/tape-recording?)))
(reset-lab)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (start-fresh-session)
  (world/tape-clear!)
  (world/tape-record!)
  (list ':fresh? (= 1 (length (world/tape-frames)))))
(start-fresh-session)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (with-fresh-tape thunk)
  ;; Bracket wrapper: enter clean, run, leave state.
  (world/tape-clear!)
  (world/tape-record!)
  (let ((r (thunk)))
    (world/tape-stop!)
    (list ':result r ':frames (length (world/tape-frames)))))
(with-fresh-tape (lambda () (world/step) 'done))
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 1

  ```

### `world/tape-frames` — file `72-world.slat`

- **row-4-proof** :eng-program
  ```scheme
  (world/tape-clear!) (world/tape-record!)
(define n0 (length (world/tape-frames)))
(world/step)
(= (+ n0 1) (length (world/tape-frames)))
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (monotone-across-k k)
  (world/tape-clear!) (world/tape-record!)
  (let loop ((i 0)) (when (< i k) (world/step) (loop (+ i 1))))
  (= (+ k 1) (length (world/tape-frames))))
(monotone-across-k 5)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 5

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (bounded-by-capacity? cap)
  (world/tape-clear!) (world/tape-record! cap)
  (let loop ((i 0)) (when (< i (* 2 cap)) (world/step) (loop (+ i 1))))
  (<= (length (world/tape-frames)) cap))
(bounded-by-capacity? 10)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 20

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (record-and-report n)
  (world/tape-clear!) (world/tape-record!)
  (let loop ((k n)) (when (> k 0) (world/step) (loop (- k 1))))
  (world/tape-stop!)
  (list ':recorded (length (world/tape-frames)) ':target n))
(record-and-report 30)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 30

  ```

### `world/tape-record!` — file `72-world.slat`

- **row-4-proof** :math-program
  ```scheme
  (define (grows-after-arm?)
  (world/tape-clear!)
  (let ((n0 (length (world/tape-frames))))
    (world/tape-record!)
    (world/step)
    (> (length (world/tape-frames)) n0)))
(grows-after-arm?)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (double-arm-replaces?)
  ;; Arming again discards the prior tape unconditionally.
  (world/tape-record!) (world/step) (world/step)
  (let ((n1 (length (world/tape-frames))))
    (world/tape-record!)
    (< (length (world/tape-frames)) n1)))
(double-arm-replaces?)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 2

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (bounded-record cap seconds fps)
  ;; Prove: cap is monotone-bounded regardless of steps requested.
  (world/tape-clear!) (world/tape-record! cap)
  (let loop ((n (* seconds fps)))
    (when (> n 0) (world/step) (loop (- n 1))))
  (list ':cap cap ':held (length (world/tape-frames))))
(bounde
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 150

  ```

### `world/tape-save` — file `72-world.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (bug-repro-package label)
  (let ((tape (world/tape-save)))
    (list ':label label ':n (length tape) ':hash (world/tape-hash))))
(bug-repro-package 'ragdoll-glitch-2026)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```
- **row-2-audit** :math-program
  ```scheme
  (define (serialization-length-invariant)
  ;; |save(tape)| = |frames(tape)| — every frame becomes a serialized record.
  (let ((tape (world/tape-save)))
    (= (length tape) (length (world/tape-frames)))))
(serialization-length-invariant)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (save-does-not-clear?)
  (world/tape-record!) (world/step) (world/step)
  (world/tape-save)
  (> (length (world/tape-frames)) 0))
(save-does-not-clear?)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 2

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (roundtrip-witness)
  ;; hash(tape) and length(save(tape)) are joint witnesses of content.
  (let ((h (world/tape-hash))
        (saved (world/tape-save)))
    (list ':orig-hash h ':saved-len (length saved) ':claim 'roundtrip-fidelity)))
(roundtrip-witness)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```

### `world/tape-stop!` — file `72-world.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (end-session)
  (let ((n (world/tape-stop!)))
    (list ':halted-at n ':still-inspectable? (> (length (world/tape-frames)) 0))))
(end-session)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 0

  ```
- **row-2-audit** :math-program
  ```scheme
  (define (stop-is-mode-only)
  ;; Stop transitions the FSM but leaves frames invariant.
  (world/tape-record!) (world/step) (world/step)
  (let ((before (length (world/tape-frames))))
    (world/tape-stop!)
    (= before (length (world/tape-frames)))))
(stop-is-mode-only)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 2

  ```
- **row-4-proof** :eng-program
  ```scheme
  (world/tape-clear!) (world/tape-record!) (world/step)
(let ((n (world/tape-stop!)))
  (and (not (world/tape-recording?)) (= n (length (world/tape-frames)))))
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 1

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (stop-returns-count?)
  (world/tape-clear!) (world/tape-record!) (world/step) (world/step)
  (= (world/tape-stop!) (length (world/tape-frames))))
(stop-returns-count?)
  ```
  Error:
  ```
  error: length: expected a proper list, got the number 2

  ```

### `sdf-fill-rect` — file `77-sdf.slat`

- **row-5-emergence** :composition
  ```scheme
  (set-mode 'sd)
;; a row of bounded gauges, each painted only in its own bounding box
(define (gauge cx cy)
  (sdf-fill-rect (sdf-subtract (sdf/circle cx cy 16) (sdf/circle cx cy 7))
                 (- cx 18) (- cy 18) (+ cx 18) (+ cy 18) 11))
(for-each gauge (list 70 130 190 250))
  ```
  Error:
  ```
  error: -: expected a number, got nothing

  ```

## Verdict

✗ 278 FAILURES. Fix pass required before fold. See per-verb section above for intent (verb name + row + field).
