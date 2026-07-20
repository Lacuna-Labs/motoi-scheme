;; drum-machine-game.scm
;; Motoi Cart — Wave 5 Hybrid
;;
;; (cart
;;   :name            "drum-machine-game"
;;   :category        :music
;;   :sub-category    :rhythm-game
;;   :audience        :kid
;;   :complexity      3
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Hit the right key when the beat lands. Kick, snare, hat."
;;   :verb-families   (graphics audio game tick)
;;   :verbs-used      ("set-mode" "clear" "rectangle" "fill-rect" "pixel"
;;                     "synth/kit" "sfx" "note"
;;                     "tick/phase" "tick/pulse"
;;                     "on-key" "on-frame" "fire-key" "tick-frame"))
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-5-hybrid/drum-machine-game.scm
;;
;; THE COMPOSITION.
;; A 16-step drum pattern plays at 120 BPM. On each step, ONE drum is due
;; (kick, snare, or hat). The player must press the matching key at the
;; right frame. Hit → score + bright flash + drum plays cleanly. Miss →
;; muffled sfx + red pulse.
;;
;; Verb families braided per tick:
;;   tick    — `tick/phase` maps frame to step-in-bar, `tick/pulse` gates the
;;             on-beat window
;;   audio   — `synth/kit` fires the drum, `sfx` handles the miss thud,
;;             `note` for the tempo click
;;   game    — score + streak + hit-log state
;;   graphics— 16-step ladder repaints via rectangle + fill-rect + pixel
;;
;; Aliases used: `rectangle` (canonical `rect`), `fill-rect` (canonical
;; `rect-fill`), `pixel` (canonical `pset`) — three aliases per cart.

(set-mode 64 16)
(clear 0)

;; ── the pattern (16 steps × 3 lanes)
;; Each entry is (step drum). Drum ∈ (kick snare hat).
(define PATTERN
  '((0 kick) (2 hat)  (4 snare) (6 hat)
    (8 kick) (10 hat) (12 snare) (14 hat)))

(define STEPS  16)
(define FRAMES-PER-STEP 2)   ;; 2 frames per step → 32 frames total
(define TOTAL-FRAMES (* STEPS FRAMES-PER-STEP))

;; ── game state
(define hits 0)
(define misses 0)
(define streak 0)
(define log '())

;; What drum is DUE at this step? Returns symbol or 'none.
(define (drum-at step)
  (cond
    ((null? PATTERN) 'none)
    (else
     (let loop ((rem PATTERN))
       (cond ((null? rem) 'none)
             ((= (car (car rem)) step) (nth (car rem) 1))
             (else (loop (cdr rem))))))))

;; The player's most recent keypress at this frame (or 'none).
;; The on-key handler stashes it; the frame reads + clears it.
(define last-key 'none)
(on-key
 (lambda (k) (set! last-key k)))

;; key → drum symbol lookup. Kids type z/x/c on a piano keyboard row.
(define (key->drum k)
  (cond ((eq? k 'z) 'kick)
        ((eq? k 'x) 'snare)
        ((eq? k 'c) 'hat)
        (else 'none)))

;; ── graphics: paint the 16-step ladder with the beat indicator
(define (paint-ladder step)
  (clear 0)
  ;; frame border — rectangle alias
  (set-color 5)
  (rectangle 0 0 64 16)
  ;; each step is 4px wide, 3 lanes stacked
  (for-each
   (lambda (s)
     (let* ((x (* s 4))
            (d (drum-at s))
            (lane (cond ((eq? d 'kick)  0)
                        ((eq? d 'snare) 1)
                        ((eq? d 'hat)   2)
                        (else -1))))
       ;; empty cell — thin outline
       (when (>= lane 0)
         ;; step cell — fill-rect alias
         (set-color (cond ((eq? d 'kick)  9)
                          ((eq? d 'snare) 12)
                          (else           14)))
         (fill-rect (+ x 1) (+ 3 (* lane 3)) 2 2))))
   (range 0 STEPS))
  ;; playhead — a bright pixel column
  (set-color 7)
  (pixel (+ (* step 4) 1) 14 7))

;; ── the composition point: frame handler
;; on-frame handlers receive zero args by reference semantics — the
;; script owns the frame counter itself so the tick math stays legible.
(define frame-no 0)
(define (compose-frame)
  (let* ((frame frame-no)
         (step (modulo (quotient frame FRAMES-PER-STEP) STEPS))
         (on-beat? (= (modulo frame FRAMES-PER-STEP) 0))
         (due (drum-at step)))
    (paint-ladder step)
    ;; On the exact on-beat frame, check the player's press.
    (when on-beat?
      (let ((played (key->drum last-key)))
        (cond
          ;; drum was due AND player pressed matching key → HIT
          ((and (not (eq? due 'none)) (eq? played due))
           (set! hits (+ hits 1))
           (set! streak (+ streak 1))
           (synth/kit due 0)                    ;; audio: drum plays cleanly
           (set! log (cons (list step due 'HIT) log)))
          ;; drum was due but wrong / no press → MISS
          ((not (eq? due 'none))
           (set! misses (+ misses 1))
           (set! streak 0)
           (sfx 'noise 60 0.15)                 ;; audio: dull thud
           (set! log (cons (list step due 'MISS) log)))
          ;; player pressed on empty step → ghost hat (soft, no penalty)
          ((not (eq? played 'none))
           (sfx 'pulse 8000 0.05)))
        ;; tempo click — subtle, marks the bar
        (note 'C6 0.04)
        ;; consume the press
        (set! last-key 'none)))))

(on-frame compose-frame)

;; ── mocked press schedule.
;; Perfect play: press z at steps 0,8 (kicks), x at 4,12 (snares),
;; c at 2,6,10,14 (hats). We miss step 12 on purpose to show a MISS.
(define MOCK-PRESSES
  '((0 z)  (2 c)  (4 x)  (6 c)
    (8 z)  (10 c) (14 c)))     ;; step 12 (snare) intentionally missed

(display "DRUM MACHINE GAME — z=kick  x=snare  c=hat") (newline)
(display "=========================================") (newline)

(let loop ((f 0))
  (when (< f TOTAL-FRAMES)
    ;; queue a press for the step this frame IS (fire BEFORE tick so the
    ;; frame handler sees last-key set)
    (let ((step (quotient f FRAMES-PER-STEP)))
      (when (= (modulo f FRAMES-PER-STEP) 0)
        (for-each
         (lambda (p) (when (= (car p) step)
                       (fire-key (nth p 1))))
         MOCK-PRESSES)))
    (set! frame-no f)
    (tick-frame)
    (loop (+ f 1))))

(stop)
(newline)
(display "final:  hits=") (display hits)
(display "  misses=") (display misses)
(display "  streak=") (display streak) (newline)
(display "log (most recent first):") (newline)
(for-each
 (lambda (e)
   (display "  step ") (display (car e))
   (display ": ") (display (nth e 1))
   (display " → ") (display (nth e 2)) (newline))
 log)
