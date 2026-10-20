import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'scheme/reference/01-core.slat';
const enc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

// [decoded-old, decoded-new] pairs. Each old must appear exactly once.
const pairs = [
  // --- CODE slots ---
  // [0] dance-section: card/emit symbol -> emit
  [
`(define formation '())
(define (dance-section ctx)
  (let ((formation (if (> (ctx-get 'beat ctx) 32) 'star 'line)))
    (act 'card/emit (list 'formation-change formation) 'await-formation)))
(across-beats formation)`,
`(define formation '())
(define (dance-section ctx)
  (let ((formation (if (> (ctx-get 'beat ctx) 32) 'star 'line)))
    (act 'emit (list 'formation-change formation) 'await-formation)))
(across-beats formation)`
  ],
  // [1] trigger-animation
  [
`(define (trigger-animation ctx)
  (after-frame (lambda () (card/emit (list ':animation 'fade-in))))
  (next 'animating ctx))`,
`(define (trigger-animation ctx)
  (after-frame (lambda () (display (list ':animation 'fade-in))))
  (next 'animating ctx))`
  ],
  // [2] composition
  [
`(begin-frame 'main)
(grid-cell-set! 3 3 1)
(end-frame 'main)
(after-frame
  (lambda ()
    (card/emit (list ':measured (card-rows)))))`,
`(begin-frame 'main)
(grid-cell-set! 3 3 1)
(end-frame 'main)
(after-frame
  (lambda ()
    (display (list ':measured (grid-rows)))))`
  ],
  // [3] eng-composition paint-measure-animate
  [
`(define (paint-measure-animate cell-x cell-y)
  (begin-frame 'main)
  (grid-cell-set! cell-x cell-y 1)
  (end-frame 'main)
  (after-frame
    (lambda ()
      (let ((h (card-rows)))
        (card/emit (list ':height h))))))
(paint-measure-animate 4 4)`,
`(define (paint-measure-animate cell-x cell-y)
  (begin-frame 'main)
  (grid-cell-set! cell-x cell-y 1)
  (end-frame 'main)
  (after-frame
    (lambda ()
      (let ((h (grid-rows)))
        (display (list ':height h))))))
(paint-measure-animate 4 4)`
  ],
  // [4] pulse-on-audio
  [
`(define (pulse-on-audio)
  (when (audio-playing?)
    (card/audio-pulse (card-id-of (card-list)))))`,
`(define (pulse-on-audio)
  (when (audio-playing?)
    (for-each (lambda (e) (entity/set! e 'pulse 1.0)) (entity/all))))`
  ],
  // [5] check-state / active
  [
`(define (check-state ctx)
  (if (audio-playing?)
    (next 'active ctx)
    (next 'dormant ctx)))
(define (active ctx)
  (card-set! (ctx-get ctx) 'glow 1.0)
  (on-tick check-state))`,
`(define (check-state ctx)
  (if (audio-playing?)
    (next 'active ctx)
    (next 'dormant ctx)))
(define (active ctx)
  (entity/set! (ctx-get ctx) 'glow 1.0)
  (on-tick check-state))`
  ],
  // [6] on-frame badge
  [
`(on-frame
  (lambda ()
    (card-set! (card-list) 'badge
      (if (audio-playing?) 'visible 'hidden))))`,
`(on-frame
  (lambda ()
    (for-each (lambda (e)
      (entity/set! e 'badge (if (audio-playing?) 'visible 'hidden)))
      (entity/all))))`
  ],
  // [7] glow-with-audio
  [
`(define (glow-with-audio card)
  (let ((rms (audio-rms)))
    (card-set! card 'glow (min 1.0 (* rms 2.0)))))
(on-tick (lambda () (glow-with-audio (card-list))))`,
`(define (glow-with-audio e)
  (let ((rms (audio-rms)))
    (entity/set! e 'glow (min 1.0 (* rms 2.0)))))
(on-tick (lambda () (for-each glow-with-audio (entity/all))))`
  ],
  // [8] on-frame glow
  [
`(on-frame
  (lambda ()
    (card-set! (card-list) 'glow (min 1.0 (* 2 (audio-rms))))))`,
`(on-frame
  (lambda ()
    (for-each (lambda (e)
      (entity/set! e 'glow (min 1.0 (* 2 (audio-rms)))))
      (entity/all))))`
  ],
  // [9] time-locked-animation
  [
`(define (time-locked-animation card start-sec duration-sec)
  (let ((t (audio-time)))
    (if (and (>= t start-sec) (< t (+ start-sec duration-sec)))
      (let ((phase (/ (- t start-sec) duration-sec)))
        (card-set! card 'scale (+ 1.0 (* 0.5 (sin (* phase 2 3.14159))))))
      (card-set! card 'scale 1.0))))
(on-tick (lambda () (time-locked-animation (card-list) 5.0 3.0)))`,
`(define (time-locked-animation e start-sec duration-sec)
  (let ((t (audio-time)))
    (if (and (>= t start-sec) (< t (+ start-sec duration-sec)))
      (let ((phase (/ (- t start-sec) duration-sec)))
        (entity/set! e 'scale (+ 1.0 (* 0.5 (sin (* phase 2 3.14159))))))
      (entity/set! e 'scale 1.0))))
(on-tick (lambda () (for-each (lambda (e) (time-locked-animation e 5.0 3.0)) (entity/all))))`
  ],
  // [10] breathe
  [
`(define (breathe)
  (+ 1 (* 0.3 (sin (* 2 3.14159 0.5 (audio-time))))))
(on-frame (lambda () (card-set! (card-list) 'scale (breathe))))`,
`(define (breathe)
  (+ 1 (* 0.3 (sin (* 2 3.14159 0.5 (audio-time))))))
(on-frame (lambda () (for-each (lambda (e) (entity/set! e 'scale (breathe))) (entity/all))))`
  ],
  // [11] card-rect id version
  [
`(define (card-rect id) (list 0 0 100 80))
(define (center-on-card card-id)
  (let* ((rect (card-rect card-id))
         (target-x (/ (+ (car rect) (caddr rect)) 2))
         (current-x (camera-x)))
    (if (> (abs (- target-x current-x)) 50)
        (camera-pan-to target-x 250)
        (display 'already-centered))))
(center-on-card 'my-card)`,
`(define (entity-rect id) (list 0 0 100 80))
(define (center-on-entity entity-id)
  (let* ((rect (entity-rect entity-id))
         (target-x (/ (+ (car rect) (caddr rect)) 2))
         (current-x (camera-x)))
    (if (> (abs (- target-x current-x)) 50)
        (camera-pan-to target-x 250)
        (display 'already-centered))))
(center-on-entity 'my-entity)`
  ],
  // [12] cs-composition card-rect
  [
`(define (card-rect card) (list 0 0 100 80))
(define (center-on-card card)
  (let* ((rect (card-rect card))
         (target-x (/ (+ (car rect) (caddr rect)) 2)))
    (when (> (abs (- target-x (camera-x))) 50)
      (camera-pan-to target-x (camera-y) 300))))
(center-on-card 'task)`,
`(define (entity-rect e) (list 0 0 100 80))
(define (center-on-entity e)
  (let* ((rect (entity-rect e))
         (target-x (/ (+ (car rect) (caddr rect)) 2)))
    (when (> (abs (- target-x (camera-x))) 50)
      (camera-pan-to target-x (camera-y) 300))))
(center-on-entity 'task)`
  ],
  // [13] choreograph-entrance
  [
`(define (card/transition c args) (list 'transition c args))
(define (choreograph-entrance card)
  (let ((t (land-on-downbeat card 'downbeat-3)))
    (display (number? t))))
(choreograph-entrance 'hero-card)`,
`(define (entity/transition c args) (list 'transition c args))
(define (choreograph-entrance e)
  (let ((t (land-on-downbeat e 'downbeat-3)))
    (display (number? t))))
(choreograph-entrance 'hero-entity)`
  ],
  // [14] cs-program motion/move-to + card-list local
  [
`(define (motion/move-to c pos) (list 'move c pos))
(define (card-list) '(card-a card-b))
(for-each
  (lambda (c)
    (display (motion/move-to c (land-on-downbeat c 'downbeat-2))))
  (card-list))`,
`(define (motion/move-to c pos) (list 'move c pos))
(define (entity-list) '(entity-a entity-b))
(for-each
  (lambda (c)
    (display (motion/move-to c (land-on-downbeat c 'downbeat-2))))
  (entity-list))`
  ],
  // [15] fit-card-in-view (defines only, never called)
  [
`(define (fit-card-in-view card-id)
  (let* ((rect (card-screen-rect card-id))
         (vp (viewport))
         (offset-x (- (rect :x) (vp :x)))
         (offset-y (- (rect :y) (vp :y))))
    (if (or (< offset-x 0) (> offset-x (vp :w)))
      (camera-pan-to (+ (vp :x) (rect :x)) (vp :y))
      (if (or (< offset-y 0) (> offset-y (vp :h)))
        (camera-pan-to (vp :x) (+ (vp :y) (rect :y)))))))`,
`(define (fit-entity-in-view entity-id)
  (let* ((rect (entity-screen-rect entity-id))
         (vp (viewport))
         (offset-x (- (rect :x) (vp :x)))
         (offset-y (- (rect :y) (vp :y))))
    (if (or (< offset-x 0) (> offset-x (vp :w)))
      (camera-pan-to (+ (vp :x) (rect :x)) (vp :y))
      (if (or (< offset-y 0) (> offset-y (vp :h)))
        (camera-pan-to (vp :x) (+ (vp :y) (rect :y)))))))`
  ],
  // [16] reflow-columns (defines only, never called)
  [
`(define (reflow-columns ctx)
  (let* ((vp-w (viewport-width))
         (col-width (/ vp-w 3))
         (cards (card-list)))
    (for-each (lambda (card-id i)
      (card-set! card-id 'x (* col-width (modulo i 3))))
      cards)))`,
`(define (reflow-columns ctx)
  (let* ((vp-w (viewport-width))
         (col-width (/ vp-w 3))
         (entities (entity/all)))
    (for-each (lambda (e i)
      (entity/set! e 'x (* col-width (modulo i 3))))
      entities)))`
  ],

  // --- PROSE slots ---
  // progression: define-card / card/emit
  [
`Next: define-card to use display objects in card layouts, or card/emit to trigger display updates from game state.`,
`Next: define-entity to use display objects in entity layouts, or entity/emit to trigger display updates from game state.`
  ],
  // explanation: card/transition or motion/move-to
  [
`Returns a choreography function that positions a card such that it lands (settles) on a named downbeat. The verb respects the tempo and beat grid, computing arrival time and easing so the card's motion synchronizes with the music. Pass the resulting function to card/transition or motion/move-to. This is a formation verb: it belongs to a family of rhythmic positioning tools (arc-between, in-formation, walk-together) that compose card motion with the audio timeline.`,
`Returns a choreography function that positions an entity such that it lands (settles) on a named downbeat. The verb respects the tempo and beat grid, computing arrival time and easing so the entity's motion synchronizes with the music. Pass the resulting function to entity/transition or motion/move-to. This is a formation verb: it belongs to a family of rhythmic positioning tools (arc-between, in-formation, walk-together) that compose entity motion with the audio timeline.`
  ],
  // progression: measure-content / card-rect
  [
`Learn measure-content to understand card dimensions, then study card-rect for screen-space positioning, and finally use both in a layout function.`,
`Learn measure-content to understand entity dimensions, then study entity-rect for screen-space positioning, and finally use both in a layout function.`
  ],
  // meta: card-rect / current card
  [
`pixels-wide/tall return surface dims; card-rect is a different scope. measure-content is the correct choice for the CURRENT card's content extents.`,
`pixels-wide/tall return surface dims; entity-rect is a different scope. measure-content is the correct choice for the CURRENT entity's content extents.`
  ],
  // progression: pixels-tall / card-screen-rect
  [
`Query pixels-tall and pixels-wide together to understand canvas bounds; then use camera-frame or card-screen-rect to position UI or cameras relative to those bounds`,
`Query pixels-tall and pixels-wide together to understand canvas bounds; then use camera-frame or entity-screen-rect to position UI or cameras relative to those bounds`
  ],
  // progression: card/ask / card-list
  [
`Combine with card/ask to poll sprite state; use part/* verbs to build humanoid animations; integrate with on-frame for frame-by-frame control if needed.`,
`Combine with entity/state to poll sprite state; use part/* verbs to build humanoid animations; integrate with on-frame for frame-by-frame control if needed.`
  ],
  // progression: card-list / form-list
  [
`Pair with clear-surface-layer to build safe surface manipulation routines; then learn card-list and form-list for similar defensive patterns`,
`Pair with clear-surface-layer to build safe surface manipulation routines; then learn entity/all and form-list for similar defensive patterns`
  ],
];

let raw = readFileSync(FILE, 'utf8');
const before = raw;

for (const [oldD, newD] of pairs) {
  const oldE = enc(oldD);
  const newE = enc(newD);
  const parts = raw.split(oldE);
  const count = parts.length - 1;
  if (count !== 1) {
    console.error(`ABORT: expected exactly 1 match, found ${count} for:\n---\n${oldD.slice(0, 80)}...\n---`);
    process.exit(1);
  }
  raw = parts.join(newE);
}

if (raw === before) {
  console.error('ABORT: no change produced');
  process.exit(1);
}

writeFileSync(FILE, raw, 'utf8');
console.log(`Applied ${pairs.length} replacements. File written.`);
