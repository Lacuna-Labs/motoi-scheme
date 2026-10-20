;; ===============================================================
;; Waves — the signal-math foundation for the Book of Music.
;; A note is a FREQUENCY. A sound is a waveform: samples of sines.
;; A score is DATA: lists of (beat freq ...) you can map over.
;; Everything below is built from math/sin, expt, and lists.
;; ===============================================================
(define TWO-PI (* 2 3.141592653589793))
(define (midi->freq n) (* 440.0 (expt 2.0 (/ (- n 69) 12.0))))
(define (wave-sample f t) (math/sin (* TWO-PI f t)))
(define (wave f n dt) (map (lambda (k) (wave-sample f (* k dt))) (iota n)))

;; coerce a pitch (MIDI number < 128, or a Hz value) to a frequency
(define (as-freq p) (if (and (number? p) (< p 128)) (midi->freq p) p))

;; play a tone = a few samples of its wave (so you can see the shape)
(define (tone f dur) (wave (as-freq f) 6 0.001))
(define (beep) (tone 440.0 0.15))
(define (chime) (list (tone 523.25 0.3) (tone 659.25 0.3) (tone 783.99 0.3)))

;; a note is (freq . samples); place-at tags it with a beat position
(define (note/strike pitch dur . rest) (let ((f (as-freq pitch))) (cons f (wave f 4 0.001))))
(define (note/place-at beat pitch dur . rest) (list beat (note/strike pitch dur)))

;; additive synthesis: sum harmonics k*f scaled by amps, at time t
(define (additive f amps t)
  (let loop ((k 1) (as amps) (acc 0.0))
    (if (null? as) acc
        (loop (+ k 1) (cdr as) (+ acc (* (car as) (wave-sample (* k (as-freq f)) t)))))))

;; a "periodic wave" IS a harmonic amplitude profile; a voice samples it
(define (create-periodic-wave reals imags) reals)   ; the harmonic profile
(define (make-voice profile) profile)
(define (voice/create kind) kind)
(define (timbre-sample profile f t) (additive f profile t))

;; a score is data: base/at-beat and base/across-beats build (beat . event) lists
(define (base/at-beat beat . body) (cons beat body))
(define (base/across-beats beats . body) (map (lambda (b) (cons b body)) beats))
(define (beat name pos) (list 'beat name pos))     ; a drum hit as data

;; envelope / voice wrappers just pass their body through (they shape data)
(define (with-voice v . body) (cons v body))
(define (with-dynamics d . body) (cons d body))
(define (section-voice name . body) (cons name body))
(define (transpose semitones . notes) (map (lambda (n) (+ n semitones)) notes))
(define (transport/tempo-curve . pts) pts)

(display (midi->freq 69)) (newline)
(display (note/strike 60 1.0 64)) (newline)
(display (note/place-at 0 'C4 'quarter)) (newline)
(display (create-periodic-wave '(0.0 1.0 0.4 0.1) '(0.0 0.0 0.0 0.0))) (newline)
(display (base/at-beat 0 'kick)) (newline)
(display (beat 'snare 2)) (newline)
(display (transpose 12 60 62 64)) (newline)
