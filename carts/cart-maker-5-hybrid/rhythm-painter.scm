;; rhythm-painter.scm
;; Motoi Cart — Wave 5 Hybrid
;;
;; (cart
;;   :name            "rhythm-painter"
;;   :category        :creative
;;   :sub-category    :music-drawing
;;   :audience        :kid
;;   :complexity      3
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Click to paint shapes in time with the beat. Each shape triggers a note."
;;   :verb-families   (graphics audio game tick)
;;   :verbs-used      ("set-mode" "clear" "rectangle" "fill-rect" "pixel" "disc"
;;                     "note" "chord" "sfx"
;;                     "tick/phase" "tick/pulse" "tick/ease"
;;                     "on-mouse" "on-frame" "fire-mouse" "tick-frame"))
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-5-hybrid/rhythm-painter.scm
;;
;; THE COMPOSITION.
;; A tempo click plays every 4 frames. When the user clicks WITHIN a small
;; window around the click, a shape appears at click position AND a note
;; plays. Off-beat clicks still paint but play a duller sfx. The color and
;; note pitch scroll through a pentatonic scale so the piece stays musical.
;;
;; Braided per frame:
;;   tick     — `tick/phase`, `tick/pulse`, `tick/ease` decide when the beat
;;              window is open + how brightly to pulse the border
;;   audio    — `note` on-beat, `sfx` off-beat, `chord` on the end flourish
;;   game     — history of painted shapes as list state (game-flavored;
;;              carts model interactive strokes as game state)
;;   graphics — border, playhead, per-click disc / rect / pixel splashes
;;
;; Aliases: `rectangle`, `fill-rect`, `pixel` — three per cart.

(set-mode 64 32)
(clear 0)

;; ── musical + timing setup
(define BEAT-EVERY 4)         ;; frames per beat
(define WINDOW     1)         ;; +/- frames still count as on-beat
(define TOTAL-FRAMES 32)

;; C pentatonic — kid-safe (no matter what order, they sound good).
(define PENTATONIC '(C4 D4 E4 G4 A4 C5 D5 E5))
(define pen-index 0)

;; ── game-flavored state: painting history
(define shapes '())    ;; each: (frame x y kind color note on-beat?)
(define on-count 0)
(define off-count 0)

;; ── the frame counter (on-frame handlers get no args)
(define frame-no 0)

;; Is this frame inside the on-beat window?
(define (on-beat? f)
  (let ((m (modulo f BEAT-EVERY)))
    (or (< m WINDOW) (< (- BEAT-EVERY m) WINDOW))))

;; Last click captured by on-mouse — the frame handler consumes it.
(define last-click 'none)

;; ── mouse handler: stashes the click; the frame reads it.
(on-mouse
 (lambda (x y btn)
   (set! last-click (list x y btn))))

;; ── graphics: paint every recorded shape + a beat-pulse border
(define (paint-frame f)
  (clear 0)
  ;; Beat-pulse border. tick/ease smooths the phase so the border fade
  ;; looks intentional, not stepped.
  (let* ((phase (tick/phase f BEAT-EVERY))
         (ease  (tick/ease phase))
         (color (+ 5 (round (* ease 10)))))
    (set-color color)
    (rectangle 0 0 64 32))                       ;; alias: rectangle
  ;; Playhead — a bright pixel walking the top row.
  (set-color 7)
  (pixel (modulo f 64) 0 7)                      ;; alias: pixel
  ;; Every recorded shape stays painted (history).
  (for-each
   (lambda (s)
     (let ((x (nth s 1))
           (y (nth s 2))
           (kind (nth s 3))
           (col (nth s 4)))
       (set-color col)
       (cond ((eq? kind 'disc)  (disc x y 2))
             ((eq? kind 'rect)  (fill-rect x y 3 3)) ;; alias: fill-rect
             (else              (pixel x y col)))))
   shapes))

;; ── the composition point
(define (compose-frame)
  (let ((f frame-no))
    (paint-frame f)
    ;; Consume any click since the last frame.
    (when (not (eq? last-click 'none))
      (let* ((x (car last-click))
             (y (nth last-click 1))
             (beat? (on-beat? f))
             (pitch (nth PENTATONIC (modulo pen-index (length PENTATONIC))))
             (color (if beat? (+ 8 (modulo pen-index 7)) 5))
             (kind (cond ((= (modulo pen-index 3) 0) 'disc)
                         ((= (modulo pen-index 3) 1) 'rect)
                         (else 'pixel))))
        (cond
          (beat?
           ;; AUDIO on-beat: play the pentatonic note
           (note pitch 0.18)
           (set! on-count (+ on-count 1)))
          (else
           ;; AUDIO off-beat: soft pulse sfx, still paints
           (sfx 'pulse 220 0.06)
           (set! off-count (+ off-count 1))))
        (set! shapes (cons (list f x y kind color pitch beat?) shapes))
        (set! pen-index (+ pen-index 1))
        (set! last-click 'none)))))

(on-frame compose-frame)

;; ── mocked clicks. Some on-beat, some off, one right on each beat.
;; Beats fall at frames 0, 4, 8, 12, 16, 20, 24, 28.
(define MOCK-CLICKS
  '((0  10 10 0)   ;; on-beat
    (2  20 12 0)   ;; off-beat
    (4  30 14 0)   ;; on-beat
    (7  40 16 0)   ;; off-beat
    (8  50 18 0)   ;; on-beat
    (12 25 20 0)   ;; on-beat
    (13 35 22 0)   ;; off-beat
    (16 45 24 0)   ;; on-beat
    (20 15 26 0)   ;; on-beat
    (24 55 8  0)   ;; on-beat
    (28 8  15 0))) ;; on-beat

(display "RHYTHM PAINTER — click to paint. On-beat clicks play a scale note.") (newline)
(display "==================================================================") (newline)

(let loop ((f 0))
  (when (< f TOTAL-FRAMES)
    ;; Fire any clicks scheduled for this frame BEFORE ticking so the
    ;; frame handler sees them.
    (for-each
     (lambda (c)
       (when (= (car c) f)
         (fire-mouse (nth c 1) (nth c 2) (nth c 3))))
     MOCK-CLICKS)
    (set! frame-no f)
    (tick-frame)
    (when (= (modulo f 8) 0)
      (display "  f=") (display f)
      (display "  on-beat?=") (display (on-beat? f))
      (display "  shapes=") (display (length shapes))
      (newline))
    (loop (+ f 1))))

(stop)

;; ── final flourish: a chord of every distinct pitch we painted on-beat.
(define (unique-pitches acc rem)
  (cond ((null? rem) acc)
        ((and (nth (car rem) 6)              ;; on-beat?
              (not (member (nth (car rem) 5) acc)))
         (unique-pitches (cons (nth (car rem) 5) acc) (cdr rem)))
        (else (unique-pitches acc (cdr rem)))))

(newline)
(display "  on-beat clicks:  ") (display on-count) (newline)
(display "  off-beat clicks: ") (display off-count) (newline)
(display "  total shapes:    ") (display (length shapes)) (newline)
(let ((flourish (unique-pitches '() shapes)))
  (display "  ending chord:    ") (display flourish) (newline)
  (when (not (null? flourish))
    (chord flourish 0.6)))
