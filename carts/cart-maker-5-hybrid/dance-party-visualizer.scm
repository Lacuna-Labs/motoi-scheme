;; dance-party-visualizer.scm
;; Motoi Cart — Wave 5 Hybrid
;;
;; (cart
;;   :name            "dance-party-visualizer"
;;   :category        :creative
;;   :sub-category    :audio-reactive
;;   :audience        :kid
;;   :complexity      3
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Animated scene reacts to a composer-piece playing in the background."
;;   :verb-families   (graphics audio game tick)
;;   :verbs-used      ("set-mode" "clear" "rectangle" "fill-rect" "pixel"
;;                     "disc" "circle"
;;                     "chord" "note" "sfx" "synth/kit" "melody"
;;                     "tick/sine" "tick/phase" "tick/pulse" "tick/ease"
;;                     "entity/make" "entity/state" "entity/move"
;;                     "on-frame" "tick-frame"))
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-5-hybrid/dance-party-visualizer.scm
;;
;; THE COMPOSITION.
;; A short chord progression + drum pattern plays in the "background"
;; (fired frame-by-frame). Three dancer entities move on the framebuffer;
;; their positions and colors are driven by the same phase math that
;; times the drums. Kick lands → dancers duck. Chord change → color
;; palette shifts. It's a piece of music AND an animated scene AND a
;; small entity system, all sharing one clock.
;;
;; Braided per frame (all four families!):
;;   tick     — `tick/sine`, `tick/phase`, `tick/ease`, `tick/pulse` shape
;;              the visual + the beat
;;   audio    — `chord` for the progression, `synth/kit` for drums,
;;              `sfx` for sparkle, closing `melody`
;;   game     — three dancer entities, `entity/move` updates positions
;;              each frame from the phase
;;   graphics — background wash, dancer rendering, beat pulse ring
;;
;; Aliases: `rectangle`, `fill-rect`, `pixel` — three per cart.

(set-mode 64 32)
(clear 0)

;; ── the piece
(define BEATS-PER-BAR 4)
(define BARS 4)
(define FRAMES-PER-BEAT 2)
(define TOTAL-FRAMES (* BARS BEATS-PER-BAR FRAMES-PER-BEAT))  ;; 32

;; Chord progression — one chord per bar. I-vi-IV-V, a kid-classic loop.
(define CHORDS
  '((C4 E4 G4)      ;; I
    (A3 C4 E4)      ;; vi
    (F3 A3 C4)      ;; IV
    (G3 B3 D4)))    ;; V

;; Drum pattern (kick on beats 0,2; snare on 1,3; hat on every beat)
(define (drum-of beat)
  (cond ((= (modulo beat 2) 0) 'kick)
        (else 'snare)))

;; ── dancer entities
(entity/make 'a 12 20 4 6)
(entity/make 'b 30 20 4 6)
(entity/make 'c 48 20 4 6)

;; Track which entities are which so we can paint them.
(define DANCERS '(a b c))

;; ── game-flavored state
(define kicks 0)
(define chord-changes 0)
(define frames-danced 0)

(define frame-no 0)

;; Reset dancer position to base row for a clean bounce every frame.
(define (dancer-baseline id base-x)
  (let ((cur (entity/state id)))
    (when cur
      (let ((cx (nth cur 1)))
        (entity/move id (- base-x cx) 0)))))

;; ── one frame of composition
(define (compose-frame)
  (let* ((f frame-no)
         (beat (quotient f FRAMES-PER-BEAT))
         (bar (quotient beat BEATS-PER-BAR))
         (bar-mod (modulo bar BARS))
         (chord-here (nth CHORDS bar-mod))
         (on-beat? (= (modulo f FRAMES-PER-BEAT) 0))
         (bar-start? (and on-beat?
                          (= (modulo beat BEATS-PER-BAR) 0)))
         ;; the shared clock — one phase drives EVERYTHING visual
         (phase (tick/phase f FRAMES-PER-BEAT))
         (bar-phase (tick/phase f (* BEATS-PER-BAR FRAMES-PER-BEAT)))
         (bounce (tick/sine phase))
         (glow (tick/ease bar-phase)))

    ;; AUDIO — new chord at the top of each bar
    (when bar-start?
      (chord chord-here 0.5)
      (set! chord-changes (+ chord-changes 1)))
    ;; AUDIO — drums land on every beat
    (when on-beat?
      (let ((d (drum-of beat)))
        (synth/kit d beat)
        (when (eq? d 'kick) (set! kicks (+ kicks 1)))))
    ;; AUDIO — sprinkle a bright sfx on the ANDs (off-beats)
    (when (and (not on-beat?) (= (modulo f 2) 1))
      (sfx 'pulse (+ 3000 (* 200 bar-mod)) 0.04))

    ;; GAME — entity motion driven by phase
    (dancer-baseline 'a 12)
    (dancer-baseline 'b 30)
    (dancer-baseline 'c 48)
    ;; Each dancer's bounce timing is offset — visual polyphony.
    (entity/move 'a 0 (round (* 4 bounce)))
    (entity/move 'b 0 (round (* 4 (tick/sine (tick/phase (+ f 1) FRAMES-PER-BEAT)))))
    (entity/move 'c 0 (round (* 4 (tick/sine (tick/phase (+ f 2) FRAMES-PER-BEAT)))))
    (set! frames-danced (+ frames-danced 1))

    ;; GRAPHICS — wash background based on chord (bar_mod picks palette)
    (clear (nth (list 0 1 2 4) bar-mod))
    ;; wall ring — a rectangle that gets brighter as the bar progresses
    (set-color (+ 5 (round (* glow 8))))
    (rectangle 0 0 64 32)                        ;; alias: rectangle
    ;; beat-pulse ring at center — tick/pulse gate keeps it strictly ON on the
    ;; front of the beat, OFF otherwise.
    (when (= (tick/pulse phase 0.3) 1)
      (set-color 11)
      (circle 32 16 (+ 3 (round (* 4 glow)))))
    ;; dancers rendered from entity state
    (for-each
     (lambda (id)
       (let ((st (entity/state id)))
         (when st
           (let ((x (nth st 1))
                 (y (nth st 2))
                 (w (nth st 5))
                 (h (nth st 6))
                 ;; color of dancer cycles with beat
                 (col (+ 8 (modulo (+ beat (cond ((eq? id 'a) 0)
                                                 ((eq? id 'b) 2)
                                                 (else 4))) 7))))
             (set-color col)
             (fill-rect x y w h)                 ;; alias: fill-rect
             ;; head — a filled disc above the block
             (set-color (+ col 1))
             (disc (+ x 2) (- y 2) 2)
             ;; a bright pixel eye
             (set-color 7)
             (pixel (+ x 2) (- y 2) 7)))))       ;; alias: pixel
     DANCERS)))

(on-frame compose-frame)

(display "DANCE PARTY VISUALIZER — audio-reactive scene.") (newline)
(display "==============================================") (newline)

(let loop ((f 0))
  (when (< f TOTAL-FRAMES)
    (set! frame-no f)
    (tick-frame)
    (when (= (modulo f 8) 0)
      (let* ((sa (entity/state 'a))
             (sb (entity/state 'b))
             (sc (entity/state 'c)))
        (display "  f=") (display f)
        (display "  bar=") (display (modulo (quotient f (* BEATS-PER-BAR FRAMES-PER-BEAT)) BARS))
        (display "  a-y=") (display (nth sa 2))
        (display "  b-y=") (display (nth sb 2))
        (display "  c-y=") (display (nth sc 2))
        (newline)))
    (loop (+ f 1))))

(stop)
(newline)
(display "  chord changes: ") (display chord-changes) (newline)
(display "  kicks landed:  ") (display kicks) (newline)
(display "  frames danced: ") (display frames-danced) (newline)

;; Final flourish: solo the top-notes of every chord as one melody line
;; so the ear hears the harmony that just played.
(define (top-notes cs)
  (cond ((null? cs) '())
        (else (cons (nth (car cs) 2) (top-notes (cdr cs))))))
(display "  final melody:  ") (display (top-notes CHORDS)) (newline)
(melody (top-notes CHORDS) 0.25)
