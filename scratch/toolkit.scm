;; pitch (MIDI note number) -> frequency in Hz, equal temperament, A4=440
(define (midi->freq n)
  (* 440.0 (expt 2.0 (/ (- n 69) 12.0))))

;; sample one point of a sine wave of frequency f (Hz) at time t (seconds)
(define (wave-sample f t)
  (math/sin (* 2 3.141592653589793 f t)))

;; take n samples of frequency f over a small time step dt
(define (samples f n dt)
  (map (lambda (k) (wave-sample f (* k dt)))
       (iota n)))

;; additive synthesis: sum of harmonics k*f with amplitudes, sampled at t
(define (additive f amps t)
  (let loop ((k 1) (as amps) (acc 0.0))
    (if (null? as)
        acc
        (loop (+ k 1) (cdr as)
              (+ acc (* (car as) (wave-sample (* k f) t)))))))

(display (midi->freq 69)) (newline)     ; A4 -> 440
(display (midi->freq 60)) (newline)     ; C4 -> ~261.6
(display (wave-sample 440.0 0.0)) (newline)
(display (samples 440.0 4 0.001)) (newline)
(display (additive 220.0 '(1.0 0.5 0.25) 0.001)) (newline)
