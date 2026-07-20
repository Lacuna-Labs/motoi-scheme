;; level-1.scm
;; Motoi Cart — Zelda Lane 2026-07-19
;;
;; (cart
;;   :name            "zelda-level-1"
;;   :category        :game
;;   :sub-category    :adventure
;;   :audience        :kid
;;   :complexity      3
;;   :runtime-tier    :runs-on-core
;;   :one-line        "One dungeon room: 16x12 tiles, a hero, an octorok, a heart, and a door."
;;   :verb-families   (graphics audio game input tick)
;;   :verbs-used      ("set-mode" "clear" "set-color" "begin-frame" "end-frame"
;;                     "rect-fill" "fill-rect" "filled-rectangle" "rectangle"
;;                     "pixel" "set-pixel!" "disc" "circle"
;;                     "note" "tone"
;;                     "on-key" "fire-key" "for-each"
;;                     "display" "newline")
;;   :aliases-used    ("fill-rect" "filled-rectangle" "rectangle" "pixel" "set-pixel!")
;;   :inspiration     "Zelda 1, 1986. One screen. A rupee, a heart, a door.")
;;
;; HOW TO RUN:
;;   ./bin/motoi run carts/cart-maker-6-zelda/level-1.scm
;;
;; ─────────────────────────────────────────────────────────────────
;; THE ROOM
;;
;; A 16-wide, 12-tall dungeon. Walls (#) around the edges plus two
;; pillar-blocks in the middle. Floor (.) inside. A HERO starts near
;; the top-left. An OCTOROK patrols and steps toward the hero each
;; tick. A HEART sits at the middle-right. A DOOR is on the far right.
;;
;;   Tile map legend:
;;     # = stone wall  (impassable)
;;     . = floor       (walkable)
;;     H = heart       (pickup, +1 HP, plays a rising two-note jingle)
;;     D = door        (exit, plays a triumphant chord when touched)
;;
;; ─────────────────────────────────────────────────────────────────
;; CONTROLS
;;
;; WASD moves the hero one tile per keypress. In this headless cart
;; the keys are fired by a MOCK-KEYS list — the same pattern the
;; game runs on when a browser drives it (on-key + real keyboard).
;; To turn this into a real Zelda: delete MOCK-KEYS and let the
;; animation loop drive on-key from the actual keyboard.
;;
;; ─────────────────────────────────────────────────────────────────
;; WHAT IS FAKE
;;
;; The enemy AI is one line — step toward hero if a tile in that
;; direction is walkable. No pathfinding. No swordplay. No damage
;; when they touch. If you want to add those things — that's the
;; point of this cart. Fork it.

;; ── canvas ────────────────────────────────────────────────────────
(set-mode 128 96)
(set-color 0)
(clear 0)

;; ── constants ─────────────────────────────────────────────────────
(define COLS 16)
(define ROWS 12)
(define TILE 8)                         ;; 8×8 pixels per tile
(define MAX-TICKS 32)

;; ── the tile map ──────────────────────────────────────────────────
;; Row 0 is at the top. A tiny room with two interior pillars.
;; Kids can edit these strings — each character is one tile.
(define MAP
  (list "################"
        "#..............#"
        "#..............#"
        "#....##........#"    ;; upper pillar (cols 5-6, rows 3-4)
        "#....##........#"
        "#..............#"
        "#.........H....#"    ;; heart on row 6, col 10
        "#..............#"
        "#..............#"    ;; clear corridor at bottom
        "#.............D#"    ;; door at col 14, row 9
        "#..............#"
        "################"))

;; String → single-character-string helpers. R7RS `string-ref` returns
;; a Ch (character) value in Motoi; `substring s i (+ i 1)` returns the
;; same character as a bare 1-char string, which `equal?` compares
;; cleanly against a string literal like "D". Both spellings are fine —
;; we pick substring here because kids read (equal? x "D") more easily
;; than (char=? x (car (string->list "D"))).
(define (tile-at col row)
  (let ((line (list-ref MAP row)))
    (substring line col (+ col 1))))

(define (wall? col row)  (equal? (tile-at col row) "#"))
(define (heart? col row) (equal? (tile-at col row) "H"))
(define (door? col row)  (equal? (tile-at col row) "D"))

;; ── hero + enemy + item state ─────────────────────────────────────
(define HERO-COL 1)
(define HERO-ROW 1)
(define HERO-HP  3)
(define STEPS 0)

(define OCT-COL 12)
(define OCT-ROW 3)
(define OCT-ALIVE? #t)
;; Octoroks in Zelda 1 move slower than Link. Same trick here: the
;; octorok steps every OTHER tick. A kid tuning difficulty can flip
;; this to 1 (as fast as hero), 3 (crawls), or delete the guard.
(define OCT-SPEED 2)

(define HEART-TAKEN? #f)
(define DOOR-REACHED? #f)

;; ── walkable predicate ────────────────────────────────────────────
;; A tile is walkable if it's inside the map and not a wall.
;; Hearts and doors are walkable — you WANT to step onto them.
(define (walkable? col row)
  (and (>= col 0) (< col COLS)
       (>= row 0) (< row ROWS)
       (not (wall? col row))))

;; ── move the hero one step ────────────────────────────────────────
;; Blocked by walls. Pickup + door happen the frame you arrive.
(define (move-hero dc dr)
  (let ((nc (+ HERO-COL dc))
        (nr (+ HERO-ROW dr)))
    (when (walkable? nc nr)
      (set! HERO-COL nc)
      (set! HERO-ROW nr)
      (set! STEPS (+ STEPS 1))
      ;; heart pickup — a rising two-note jingle
      (when (and (not HEART-TAKEN?) (heart? nc nr))
        (set! HEART-TAKEN? #t)
        (set! HERO-HP (+ HERO-HP 1))
        (note 'E5 0.12)
        (note 'A5 0.18))
      ;; door reached — a triumphant chord
      (when (door? nc nr)
        (set! DOOR-REACHED? #t)
        (tone 440 0.15)
        (tone 660 0.15)
        (tone 880 0.25)))))

;; ── input handler: WASD → move ────────────────────────────────────
(on-key
  (lambda (k)
    (case k
      ((w) (move-hero  0 -1))
      ((a) (move-hero -1  0))
      ((s) (move-hero  0  1))
      ((d) (move-hero  1  0))
      (else 'ignored))))

;; ── enemy AI: one tick's worth of chase ───────────────────────────
;; Step one tile toward the hero, prefer whichever axis is farther.
;; If both blocked, stand still. Simple. Beatable. Fair.
(define (octorok-step)
  (when (and OCT-ALIVE? (not DOOR-REACHED?))
    (let* ((dc (- HERO-COL OCT-COL))
           (dr (- HERO-ROW OCT-ROW))
           (step-c (cond ((> dc 0) 1) ((< dc 0) -1) (else 0)))
           (step-r (cond ((> dr 0) 1) ((< dr 0) -1) (else 0)))
           (try-col-first? (> (abs dc) (abs dr))))
      (cond
        ;; try the preferred axis first
        ((and try-col-first?
              (walkable? (+ OCT-COL step-c) OCT-ROW))
         (set! OCT-COL (+ OCT-COL step-c)))
        ((and (not try-col-first?)
              (walkable? OCT-COL (+ OCT-ROW step-r)))
         (set! OCT-ROW (+ OCT-ROW step-r)))
        ;; then the other axis
        ((walkable? (+ OCT-COL step-c) OCT-ROW)
         (set! OCT-COL (+ OCT-COL step-c)))
        ((walkable? OCT-COL (+ OCT-ROW step-r))
         (set! OCT-ROW (+ OCT-ROW step-r)))
        (else 'stuck)))))

;; ── touch damage: octorok on hero ─────────────────────────────────
(define (check-touch)
  (when (and OCT-ALIVE?
             (= OCT-COL HERO-COL)
             (= OCT-ROW HERO-ROW))
    (set! HERO-HP (- HERO-HP 1))
    (tone 120 0.2)))            ;; low hurt tone

;; ── drawing: one tile at a time ───────────────────────────────────
;; Uses fill-rect (alias of rect-fill), filled-rectangle (same),
;; rectangle (alias of rect), pixel + set-pixel! (aliases of pset).
;; That's five beginner-name aliases used honestly for what they do.
(define (draw-tile col row)
  (let ((px (* col TILE))
        (py (* row TILE))
        (ch (tile-at col row)))
    (cond
      ;; stone wall — dark grey block
      ((equal? ch "#")
       (set-color 5)
       (fill-rect px py TILE TILE))
      ;; heart tile — pink pip if not yet taken (filled-rectangle alias)
      ((equal? ch "H")
       (when (not HEART-TAKEN?)
         (set-color 8)
         (filled-rectangle (+ px 2) (+ py 2) 4 4)
         ;; two little bumps on top so it reads as a heart
         (set-pixel! (+ px 2) (+ py 1) 8)
         (set-pixel! (+ px 5) (+ py 1) 8)))
      ;; door — a warm brown block with a lighter frame outline
      ;; (via `rectangle` alias) and a yellow pixel handle.
      ((equal? ch "D")
       (set-color 4)
       (fill-rect px py TILE TILE)
       (set-color 10)
       (rectangle px py TILE TILE)
       (pixel (+ px 5) (+ py 4) 10))
      ;; floor — no draw (background clear handles it)
      (else 'floor))))

(define (draw-map)
  (let row-loop ((r 0))
    (when (< r ROWS)
      (let col-loop ((c 0))
        (when (< c COLS)
          (draw-tile c r)
          (col-loop (+ c 1))))
      (row-loop (+ r 1)))))

(define (draw-hero)
  (let ((px (* HERO-COL TILE))
        (py (* HERO-ROW TILE)))
    ;; green disc for the hero — cedar-cross in spirit
    (set-color 11)
    (disc (+ px 4) (+ py 4) 3)
    ;; a bright pixel for a face
    (set-color 7)
    (pixel (+ px 4) (+ py 3) 7)))

(define (draw-octorok)
  (when OCT-ALIVE?
    (let ((px (* OCT-COL TILE))
          (py (* OCT-ROW TILE)))
      ;; red circle body — outline via `circle`, filled with disc
      (set-color 8)
      (disc (+ px 4) (+ py 4) 3)
      (set-color 14)
      (circle (+ px 4) (+ py 4) 3))))

;; ── ASCII overlay for readable text log ───────────────────────────
;; Kids see the board while it plays. Matches the framebuffer state
;; symbol-for-symbol so the training model learns the tile shorthand.
(define (glyph-at col row)
  (cond
    ((and (= col HERO-COL) (= row HERO-ROW)) "@")
    ((and OCT-ALIVE? (= col OCT-COL) (= row OCT-ROW)) "X")
    ((and (heart? col row) (not HEART-TAKEN?)) "H")
    ((door? col row) "D")
    (else (tile-at col row))))

(define (dump-board)
  (display "  +----------------+") (newline)
  (let row-loop ((r 0))
    (when (< r ROWS)
      (display "  |")
      (let col-loop ((c 0))
        (when (< c COLS)
          (display (glyph-at c r))
          (col-loop (+ c 1))))
      (display "|") (newline)
      (row-loop (+ r 1))))
  (display "  +----------------+") (newline))

;; ── mocked WASD script: what a kid would press to solve it ─────
;; A path that dodges the octorok, grabs the heart, walks to the door.
;; d = right, s = down, w = up, a = left.
;;
;; Strategy: drop straight down first (octorok has to path around
;; pillars to reach the bottom), scoot right along row 9, one dip up
;; to grab the heart on row 6, back down, then walk into the door.
(define MOCK-KEYS
  '(s s s s s s s s              ;; drop from row 1 to row 9
    d d d d d d d d d             ;; run right along the bottom to col 10
    w w w                         ;; up three rows to the heart row 6
    d                             ;; step onto the heart (pickup)
    s s s                         ;; back down to the door row (row 9)
    d d d d))                     ;; walk into the door at col 14

;; ── the driver: one tick = one frame ──────────────────────────────
(display "ZELDA LEVEL 1 — one screen, one heart, one door.") (newline)
(display "=================================================") (newline)
(display "  @ = hero    X = octorok    H = heart    D = door") (newline)
(display "  WASD moves the hero one tile.") (newline)
(newline)

;; Initial board so the reader sees the start state.
(dump-board)
(newline)

;; A frame draw = clear + tiles + hero + octorok. Wrap in
;; begin-frame/end-frame so the trace records one canvas per tick.
(define (paint-frame)
  (begin-frame)
  (clear 0)
  (draw-map)
  (draw-hero)
  (draw-octorok)
  (end-frame))

;; Paint the opening frame to the framebuffer — the browser IDE renders
;; this. Headless `motoi run` just records the pixels; text log is what
;; you'll see in the terminal.
(paint-frame)

(define (one-tick key t)
  (fire-key key)          ;; hero moves via on-key handler
  (when (= (modulo t OCT-SPEED) 0)
    (octorok-step))       ;; enemy takes its step every OCT-SPEED ticks
  (check-touch)           ;; touch damage if same tile
  (display "  tick=") (display t)
  (display "  hero=(") (display HERO-COL) (display ",") (display HERO-ROW) (display ")")
  (display "  hp=") (display HERO-HP)
  (display "  oct=(") (display OCT-COL) (display ",") (display OCT-ROW) (display ")")
  (display "  key=") (display key)
  (newline))

;; Step through the mocked keypresses one per tick. Stop early if the
;; hero reaches the door or runs out of HP.
(let loop ((keys MOCK-KEYS) (t 1))
  (cond
    ((null? keys) 'no-more-keys)
    ((> t MAX-TICKS) 'ticks-exhausted)
    (DOOR-REACHED?  'level-cleared)
    ((<= HERO-HP 0) 'hero-fell)
    (else
     (one-tick (car keys) t)
     (loop (cdr keys) (+ t 1)))))

(newline)
(dump-board)
(newline)

;; Paint the closing frame — the final state of the room.
(paint-frame)

;; ── outcome banner ────────────────────────────────────────────────
(cond
  (DOOR-REACHED?
   (display "  LEVEL COMPLETE — you reached the door.") (newline)
   (display "  hearts taken: ") (display (if HEART-TAKEN? 1 0)) (newline)
   (display "  steps: ") (display STEPS) (newline)
   (display "  final hp: ") (display HERO-HP) (newline))
  ((<= HERO-HP 0)
   (display "  HERO FELL — HP hit 0. Try a safer path.") (newline))
  (else
   (display "  DEMO ENDED — hero still in the room.") (newline)
   (display "  Fork: extend MOCK-KEYS, redraw MAP, add a sword.") (newline)))
