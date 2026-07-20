;; karaoke.scm
;; Motoi Cart — Wave 5 Hybrid
;;
;; (cart
;;   :name            "karaoke"
;;   :category        :music
;;   :sub-category    :sing-along
;;   :audience        :kid
;;   :complexity      3
;;   :runtime-tier    :runs-on-core
;;   :one-line        "Lyric lines display in time with a melody. Press space on the downbeat."
;;   :verb-families   (graphics audio game tick)
;;   :verbs-used      ("set-mode" "clear" "rectangle" "fill-rect" "pixel"
;;                     "note" "melody" "sfx"
;;                     "tick/phase" "tick/pulse"
;;                     "on-key" "on-frame" "fire-key" "tick-frame"
;;                     "display" "newline"))
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-5-hybrid/karaoke.scm
;;
;; THE COMPOSITION.
;; A short "Twinkle Twinkle" melody plays one note per frame. A parallel
;; list of lyric syllables scrolls under the highlighted note. The player
;; is expected to press SPACE on each downbeat (every 2 frames). Hits
;; score, misses log — but the melody plays regardless.
;;
;; Braided per frame:
;;   audio    — `note` fires the melody line; `sfx` marks user-press;
;;              `melody` plays the whole song again at the end
;;   graphics — lyric text drawn as colored rects (block-caps aesthetic),
;;              highlight bar under the current syllable
;;   game     — score / miss log
;;   tick     — `tick/phase` for the highlight animation, `tick/pulse` gates
;;              the downbeat window
;;
;; Aliases: `rectangle`, `fill-rect`, `pixel` — three per cart.

(set-mode 80 24)
(clear 0)

;; ── the song: Twinkle Twinkle. Each entry is (pitch syllable downbeat?).
(define SONG
  '((C4 "twin" #t) (C4 "kle" #f)
    (G4 "twin" #t) (G4 "kle" #f)
    (A4 "lit"  #t) (A4 "tle" #f)
    (G4 "star" #t) (G4 "-"   #f)
    (F4 "how"  #t) (F4 "I"   #f)
    (E4 "won"  #t) (E4 "der" #f)
    (D4 "what" #t) (D4 "you" #f)
    (C4 "are"  #t) (C4 "-"   #f)))

;; ── game state
(define hits 0)
(define misses 0)
(define log '())

;; ── the frame counter and last-pressed
(define frame-no 0)
(define pressed? #f)

(on-key
 (lambda (k)
   (when (eq? k 'space) (set! pressed? #t))))

;; ── graphics: one lyric "letter" block per syllable, highlight the
;; current one.
(define BLOCK-W  4)
(define BLOCK-H  6)
(define BASELINE 12)

(define (paint-frame current-idx phase)
  (clear 0)
  ;; top border, tick-driven color pulse
  (set-color (+ 5 (round (* (tick/ease phase) 8))))
  (rectangle 0 0 80 24)                          ;; alias: rectangle
  ;; each syllable = a filled block (fill-rect alias)
  (for-each
   (lambda (i)
     (let* ((x (+ 4 (* i BLOCK-W)))
            (entry (nth SONG i))
            (down? (nth entry 2))
            (col (cond ((= i current-idx) 11)   ;; bright — playing
                       (down?              12)   ;; downbeats
                       (else                5))))
       (set-color col)
       (fill-rect x BASELINE BLOCK-W BLOCK-H)))  ;; alias: fill-rect
   (range 0 (length SONG)))
  ;; playhead pixel above the current block (pixel alias)
  (set-color 7)
  (pixel (+ 4 (* current-idx BLOCK-W) 1) (- BASELINE 2) 7))

;; ── the composition point
(define (compose-frame)
  (let* ((f frame-no))
    (when (< f (length SONG))
      (let* ((entry (nth SONG f))
             (pitch (car entry))
             (syl   (nth entry 1))
             (down? (nth entry 2))
             (phase (tick/phase f 2)))
        ;; GRAPHICS — repaint with the current syllable highlighted
        (paint-frame f phase)
        ;; AUDIO — the melody plays one note per frame
        (note pitch 0.22)
        ;; GAME — scoring: only downbeat frames are gradable
        (when down?
          (cond (pressed?
                 (set! hits (+ hits 1))
                 (sfx 'pulse 2200 0.03)
                 (set! log (cons (list f syl 'HIT) log)))
                (else
                 (set! misses (+ misses 1))
                 (set! log (cons (list f syl 'MISS) log)))))
        ;; consume any press so it doesn't carry across
        (set! pressed? #f)))))

(on-frame compose-frame)

;; ── mocked presses. Press near the downbeat 6 of 8 times — two misses
;; on purpose to prove the scoring branch fires.
;;
;; Downbeat frames are 0,2,4,6,8,10,12,14. We press at all EXCEPT 6 and 12.
(define MOCK-PRESSES
  '(0 2 4 8 10 14))

(display "KARAOKE — press SPACE on each downbeat. Sing along.") (newline)
(display "===================================================") (newline)
;; Print the lyric line up front so a reader knows the words.
(display "  ")
(for-each
 (lambda (e) (display (nth e 1)) (display " "))
 SONG)
(newline) (newline)

(let loop ((f 0))
  (when (< f (length SONG))
    (when (member f MOCK-PRESSES)
      (fire-key 'space))
    (set! frame-no f)
    (tick-frame)
    (loop (+ f 1))))

(stop)
(newline)
(display "  hits:   ") (display hits) (newline)
(display "  misses: ") (display misses) (newline)
(display "  log (recent first):") (newline)
(for-each
 (lambda (e)
   (display "    frame ") (display (car e))
   (display " '") (display (nth e 1))
   (display "' → ") (display (nth e 2)) (newline))
 log)

;; Final flourish: play the whole song as one smooth melody so the
;; listener hears what they scored on.
(newline)
(display "  Final playback of the whole song:") (newline)
(define (pitches-of song)
  (cond ((null? song) '())
        (else (cons (car (car song)) (pitches-of (cdr song))))))
(melody (pitches-of SONG) 0.15)
