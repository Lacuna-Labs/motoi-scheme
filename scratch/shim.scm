;; ---- signal-math foundation ----
(define (midi->freq n) (* 440.0 (expt 2.0 (/ (- n 69) 12.0))))
(define (wave-sample f t) (math/sin (* 2 3.141592653589793 f t)))
(define (wave f n dt) (map (lambda (k) (wave-sample f (* k dt))) (iota n)))

;; ---- pitch-name -> freq ----
(define pitch-classes '(("C" . 0)("C#" . 1)("Db" . 1)("D" . 2)("D#" . 3)("Eb" . 3)
                        ("E" . 4)("F" . 5)("F#" . 6)("Gb" . 6)("G" . 7)("G#" . 8)
                        ("Ab" . 8)("A" . 9)("A#" . 10)("Bb" . 10)("B" . 11)))
;; a "note" here is just its frequency; play = sample its wave
(define (tone f dur) (wave f 6 0.001))

(display (tone 440 1.0)) (newline)
