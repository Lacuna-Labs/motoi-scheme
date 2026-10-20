# The Charm Pass — a reusable polish pattern for Motoi SD carts

A copy-pasteable recipe to give any `carts/*.sks` a title screen, sound, graphics
polish, and a light teaching thread, WITHOUT blowing the default 200000 fuel and
WITHOUT breaking the run. Piloted on `carts/tic-tac-toe.sks` (EXIT=0 preserved,
gameplay unchanged, exactly two SD dumps: a title frame + the climax frame).

## Audio verbs — CONFIRMED BOUND (probed via `echo '(v ...)' | ./bin/motoi run /dev/stdin`)

All of these returned no "unbound symbol":

- `(tone freq dur)` — sine wave, `freq` Hz, `dur` sec.
- `(note pitch dur vel)` — `pitch` is a MIDI integer (e.g. `60` = C4) OR a symbol (`'C4`); `vel` 0..1.
- `(sfx kind freq dur . opts)` — `kind` is a symbol (`'blip` etc.), then freq, dur, optional `:key val` pairs.
- `(music track)` — schedule a named track symbol; empty = silence.
- `(melody notes dur [vel])` — a list of MIDI ints/symbols played back-to-back at `dur` each. (Bonus, bound; great for motifs.)
- `(audio-play)`, `(audio-bpm n)`, `(at-beat b)` — also bound.

UNBOUND (never use — will crash): `on-beat`, `synth`, `beep`, `play-note`,
`sound`, `part/add`, `note/on`, `synth/voice`.

Headless truth: with no speaker these calls are no-ops that RETURN normally. That
is fine — the shape teaches, and on a real surface they sing. Always re-probe a
verb before first use in a new cart.

## The five drop-in pieces

Paste these near the top (helpers) and wire the calls into your driver. Adjust
palette indices / pitches to taste. Costs: audio calls are ~free; the background
starfield is ~40 `pset`s; a title frame is one extra `fb/dump`.

### 1. Sound helpers (guarded — the "never crash the game" idiom)

```scheme
;; TEACHING IDEA: sound is a nice extra, not the point. Put every extra behind a
;; switch + guard so it can NEVER take down the must-work core. (Seatbelt, not brake.)
(define SOUND-ON #t)
(define (safe thunk) (when SOUND-ON (thunk)) #t)   ;; run a sound only if on

;; a short opening motif — a rising major chord "here we go!"
(define (play-theme!)
  (safe (lambda ()
    (music 'my-theme)
    (melody (list 60 64 67 72) 0.12))))            ;; C4 E4 G4 C5

;; one tiny helper per EVENT so the driver reads like a sentence
(define (sfx-move! who)  (safe (lambda () (sfx 'blip (if (= who X) 520 392) 0.05))))
(define (sfx-capture!)   (safe (lambda () (note 76 0.10 0.7))))     ;; a chime
(define (sfx-win! w)     (safe (lambda ()
  (cond ((= w X) (melody (list 67 72 76) 0.12))    ;; bright win fanfare
        ((= w O) (melody (list 55 52 48) 0.14))    ;; gentle "aw" descent
        (else    (tone 330 0.30))))))              ;; flat draw tone
```

Generalize: rename `sfx-move!/-capture!/-win!` to your cart's events (thrust,
hit, explode, score, level-up). Keep each one a named helper wrapped in `safe`.

### 2. Named palette (kill magic-number colors)

```scheme
;; TEACHING IDEA: name your constants. Now "the sky" is a word, not the number 1,
;; and restyling the whole cart is a one-line edit here.
(define COL-SKY   1)  (define COL-STARS 13) (define COL-BOARD 5)
(define COL-SHADE 0)  (define COL-GRID  6)  (define COL-FRAME 7)
(define COL-X 8) (define COL-X-HI 14) (define COL-O 12) (define COL-O-HI 13)
```

### 3. Subtle background (deterministic starfield)

```scheme
;; A calm, seed-driven speckle behind the action gives depth for ~free.
;; Draw once per frame; it is just pixels. Keep stars out of the play area.
(define (draw-background)
  (clear COL-SKY)
  (let loop ((n 0) (s SEED))
    (when (< n 40)
      (let* ((s2 (modulo (+ (* s 1103515245) 12345) 2147483648))
             (x  (modulo s2 W))
             (s3 (modulo (+ (* s2 1103515245) 12345) 2147483648))
             (y  (modulo s3 (- BY 4))))       ;; band above the board
        (pset x y COL-STARS)
        (loop (+ n 1) s3)))))
```

### 4. Title / loading screen (its own SD frame)

```scheme
;; TEACHING IDEA: a title screen is just ANOTHER drawing — same verbs as the game.
;; Order: show title -> play theme -> start game.
(define (draw-title)
  (draw-background)
  (set-color COL-SHADE) (rect-fill 34 66 252 62)     ;; shadow
  (set-color 2)         (rect-fill 30 62 252 62)      ;; banner
  (set-color COL-FRAME) (rect 30 62 252 62)
  (fb/text "MY GAME NAME" 96 84 'yellow)
  (fb/text "you  vs  Motoi" 118 104 'white)
  ;; a scrap of art (swap for your cart's icon):
  (set-color COL-X) (line 132 150 156 174) (line 132 174 156 150)
  (set-color COL-O) (circle 188 162 12)
  (fb/text "* PRESS START *" 108 200 'green)
  (fb/text "loading..." 66 216 'lavender))
```

### 5. Piece / sprite shading (a cheap "shine")

```scheme
;; Draw the shape, then one bright inner stroke/ring = readable depth for pennies.
(define (draw-x cx cy)
  (let ((r 18))
    (set-color COL-X)
    (line (- cx r) (- cy r) (+ cx r) (+ cy r))
    (line (- cx r) (+ cy r) (+ cx r) (- cy r))
    (set-color COL-X-HI)                              ;; highlight core
    (line (- cx (- r 6)) (- cy (- r 6)) (+ cx (- r 6)) (+ cy (- r 6)))))
(define (draw-o cx cy)
  (set-color COL-O)   (circle cx cy 20)
  (set-color COL-O-HI)(circle cx cy 15))              ;; inner ring = depth
```

## Wiring it into the driver

```scheme
(set-mode 'sd)
;; ... your intro display lines ...

;; SPLASH FIRST (this is the ONE allowed extra dump — the loading screen):
(play-theme!)
(draw-title)
(fb/dump 0 0 W H)

;; ... game loop: on each event, fire the matching helper ...
;;   after placing a mark / moving:     (sfx-move! turn)
;;   when a win-line just completed:     (when (not (= (winner) 0)) (sfx-capture!))
;;   at game over:                       (sfx-win! (winner))

;; CLIMAX FRAME (the second and last dump — the finished board):
(draw-background) ; or your (draw-board), which should call draw-background first
;; ... draw pieces + HUD ...
(fb/dump 0 0 W H)
```

## Hard rules for the fan-out team (do not violate)

- **EXACTLY TWO `fb/dump 0 0 320 240` calls**: the title frame + one climax
  frame. Never dump per tick. Use a compact ASCII status line between them.
- **Default fuel only.** No `--fuel`. Re-run `./bin/motoi run carts/<name>.sks`
  and confirm EXIT=0 after your edit. If a busy cart is near the fuel ceiling,
  the title dump is the risk — trim `MAX-TICKS` slightly rather than dropping the
  charm, or drop the starfield to fewer stars.
- **Guard every sound** behind `SOUND-ON` + `safe`. No naked audio calls.
- **Only the confirmed-bound audio verbs above.** Re-probe before first use.
- **Deterministic + headless.** Starfield/tie-breaks seed off the cart's `SEED`,
  never the clock. No keyboard.
- **Keep gameplay identical.** Charm is additive — do not change the sim logic,
  the AI, or the result. Verify the same outcome after your edit.
- No emojis in files. No Curator/Sakura/Lacuna references. Do not edit
  CATALOGUE.slat.

## One teaching sentence per cart (the pedagogical thread)

Drop ONE short "TEACHING IDEA" comment near a helper so a kid reading the cart
learns a good-programming habit. The pilot uses two: **name your constants**
(the palette) and **guard your nice-extras so they can't crash the core** (the
`safe`/`SOUND-ON` idiom). Pick one that fits each cart; keep it warm and honest.
