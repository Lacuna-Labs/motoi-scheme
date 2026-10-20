;; velocity model: position after N steps = start + vel * (dt * N)
(define (advance start vel dt steps)
  (vec/add start (vec/scale vel (* dt steps))))

(define hero (vec/make 0 0))
(define vel (vec/make 2 0))
(display (advance hero vel 0.016 1))(newline)   ;; one step
(display (advance hero vel 0.016 10))(newline)  ;; ten steps
