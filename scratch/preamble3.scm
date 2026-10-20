(define TWO-PI (* 2 3.141592653589793))
(define (midi->freq n) (* 440.0 (expt 2.0 (/ (- n 69) 12.0))))
(define (wave-sample f t) (math/sin (* TWO-PI f t)))

;; parse a pitch name like "C4" "C#4" "Bb3" -> MIDI number
(define pitch-class-table
  '(("C" . 0)("C#" . 1)("Db" . 1)("D" . 2)("D#" . 3)("Eb" . 3)
    ("E" . 4)("F" . 5)("F#" . 6)("Gb" . 6)("G" . 7)("G#" . 8)
    ("Ab" . 8)("A" . 9)("A#" . 10)("Bb" . 10)("B" . 11)))
(define (pitch-name->midi s)
  (let* ((n (string-length s))
         (octch (substring s (- n 1) n))
         (oct (string->number octch))
         (pc (substring s 0 (- n 1)))
         (pair (assoc pc pitch-class-table)))
    (if (and oct pair) (+ (cdr pair) (* 12 (+ oct 1))) 60)))
(define (as-freq p)
  (cond ((and (number? p) (< p 128)) (midi->freq p))
        ((number? p) p)
        ((symbol? p) (midi->freq (pitch-name->midi (symbol->string p))))
        ((string? p) (midi->freq (pitch-name->midi p)))
        (else 440.0)))
(define (wave f n dt) (map (lambda (k) (wave-sample (as-freq f) (* k dt))) (iota n)))

(display (as-freq 'C4)) (newline)   ; -> ~261.6
(display (as-freq "A4")) (newline)  ; -> 440
(display (as-freq 'Bb3)) (newline)  ; -> ~233
(display (as-freq 'C#4)) (newline)  ; -> ~277
(display (as-freq 440)) (newline)   ; Hz passthrough (>=128)
(display (as-freq 60)) (newline)    ; MIDI 60 -> ~261.6
