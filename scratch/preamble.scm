;; ===============================================================
;; Waves — the signal-math foundation for the Book of Music.
;; A note is a FREQUENCY. A sound is a waveform: samples of a sine.
;; Everything below is built from math/sin, expt, and lists.
;; ===============================================================

(define TWO-PI (* 2 3.141592653589793))

;; equal-temperament MIDI note number -> frequency in Hz (A4 = 69 = 440)
(define (midi->freq n) (* 440.0 (expt 2.0 (/ (- n 69) 12.0))))

;; one sample of a sine wave of frequency f (Hz) at time t (seconds)
(define (wave-sample f t) (math/sin (* TWO-PI f t)))

;; a short waveform: n samples of frequency f spaced dt seconds apart
(define (wave f n dt) (map (lambda (k) (wave-sample f (* k dt))) (iota n)))

;; "play" a tone = compute a few samples of its wave so you can see its shape
(define (tone f dur) (wave f 6 0.001))
(define (beep) (tone 440.0 0.15))
(define (chime) (list (tone 523.25 0.3) (tone 659.25 0.3) (tone 783.99 0.3)))

;; pitch-name string ("C4", "A4", "Bb3") -> frequency
(define pitch-class-table
  '(("C" . 0)("C#" . 1)("Db" . 1)("D" . 2)("D#" . 3)("Eb" . 3)
    ("E" . 4)("F" . 5)("F#" . 6)("Gb" . 6)("G" . 7)("G#" . 8)
    ("Ab" . 8)("A" . 9)("A#" . 10)("Bb" . 10)("B" . 11)))

;; strike / place a note: represent it as (freq . samples). MIDI number or Hz.
(define (note/strike pitch dur . rest)
  (let ((f (if (and (number? pitch) (< pitch 128)) (midi->freq pitch) pitch)))
    (cons f (wave f 4 0.001))))
(define (note/place-at beat pitch dur . rest)
  (list beat (note/strike pitch dur)))

;; additive synthesis: sum harmonics k*f with amplitudes amps, at time t
(define (additive f amps t)
  (let loop ((k 1) (as amps) (acc 0.0))
    (if (null? as) acc
        (loop (+ k 1) (cdr as) (+ acc (* (car as) (wave-sample (* k f) t)))))))

;; --- quick self-check ---
(display (midi->freq 69)) (newline)
(display (tone 440.0 1.0)) (newline)
(display (note/strike 60 1.0 64)) (newline)
(display (note/place-at 0 67 1.0)) (newline)
(display (additive 220.0 '(1.0 0.5 0.25) 0.001)) (newline)
