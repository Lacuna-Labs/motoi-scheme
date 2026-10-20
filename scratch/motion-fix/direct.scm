;; constant velocity: position after N frames = start + vel*(dt*N)
(define (drift start vel dt frames)
  (vec/add start (vec/scale vel (* dt frames))))
(display (drift (vec/make 0 0) (vec/make 2 0) 0.016 10))(newline)  ;; => (0.32 0)

;; patrol: reverse at boundaries, integrating by hand on vecs
(define (patrol pos vel dt frames)
  (if (= frames 0) pos
      (let* ((x (car pos))
             (vel2 (cond ((> x 5) (vec/make -2 0))
                         ((< x -5) (vec/make 2 0))
                         (else vel))))
        (patrol (vec/add pos (vec/scale vel2 dt)) vel2 dt (- frames 1)))))
(display (patrol (vec/make -5 0) (vec/make 2 0) 0.016 200))(newline)
