;; Spawn coins ensuring no two are closer than a threshold.
(world/reset!)
(define min-separation 80)
(define candidates '())

(define (too-close? x y)
  (let loop ((cs candidates))
    (if (null? cs)
        #f
        (let* ((c (car cs))
               (cx (car c))
               (cy (cdr c))
               (dx (- x cx))
               (dy (- y cy))
               (dist (dsqrt (+ (* dx dx) (* dy dy)))))
          (if (< dist min-separation)
              #t
              (loop (cdr cs)))))))

(let attempt-loop ((i 0) (placed 0))
  (when (and (< placed 15) (< i 100))
    (let* ((seed-x (+ 8000 (* i 97)))
           (seed-y (+ 9000 (* i 131)))
           (x (+ 100 (* 600 (- (dsin seed-x) -1) 0.5)))
           (y (+ 100 (* 400 (- (dsin seed-y) -1) 0.5))))
      (if (too-close? x y)
          (attempt-loop (+ i 1) placed)
          (begin
            (set! candidates (cons (cons x y) candidates))
            (world/spawn (string->symbol (string-append "coin-" (number->string placed)))
                         `((x . ,x) (y . ,y) (sprite . "coin")))
            (attempt-loop (+ i 1) (+ placed 1)))))))

(world/step)
