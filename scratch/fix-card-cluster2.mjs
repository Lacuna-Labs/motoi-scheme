import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'scheme/reference/01-core.slat';
const enc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

const pairs = [
  // ---- CODE: card-rows -> grid-rows ----
  [
`(after-frame (lambda () (let ((h (card-rows))) (set! my-height h))))`,
`(after-frame (lambda () (let ((h (grid-rows))) (set! my-height h))))`
  ],
  [
`(define measured-height 0)
(after-frame
  (lambda ()
    (set! measured-height (card-rows))
    (display measured-height)))`,
`(define measured-height 0)
(after-frame
  (lambda ()
    (set! measured-height (grid-rows))
    (display measured-height)))`
  ],
  [
`(define height-cache 0)
(begin-frame 'main)
(grid-cell-set! 2 2 1)
(end-frame 'main)
(after-frame
  (lambda ()
    (set! height-cache (card-rows))
    (display height-cache)))`,
`(define height-cache 0)
(begin-frame 'main)
(grid-cell-set! 2 2 1)
(end-frame 'main)
(after-frame
  (lambda ()
    (set! height-cache (grid-rows))
    (display height-cache)))`
  ],
  [
`(define (post-paint-check expected-rows)
  (after-frame
    (lambda ()
      (if (= (card-rows) expected-rows)
          (display 'ok)
          (display 'stale)))))
(post-paint-check 5)`,
`(define (post-paint-check expected-rows)
  (after-frame
    (lambda ()
      (if (= (grid-rows) expected-rows)
          (display 'ok)
          (display 'stale)))))
(post-paint-check 5)`
  ],
  [
`(define measured-cache '())
(define (cache-set! key val) (set! measured-cache (cons (list key val) measured-cache)))
(define (idempotent-measure key)
  ;; guard: skip if already measured this key
  (unless (assoc key measured-cache)
    (after-frame
      (lambda ()
        (cache-set! key (card-rows))))))
(idempotent-measure 'main-panel)
(display 'ok)`,
`(define measured-cache '())
(define (cache-set! key val) (set! measured-cache (cons (list key val) measured-cache)))
(define (idempotent-measure key)
  ;; guard: skip if already measured this key
  (unless (assoc key measured-cache)
    (after-frame
      (lambda ()
        (cache-set! key (grid-rows))))))
(idempotent-measure 'main-panel)
(display 'ok)`
  ],

  // ---- CODE: card-emit local -> emit ----
  [
`(define (on-event kind thunk) (thunk))
(define (card-emit kind val) (list kind val))
(define current-recorder (camera-record 'session))
(on-event 'boss-defeated
  (lambda ()
    (let ((r (camera-export current-recorder '(:format "gif"))))
      (unless (pair? r) (card-emit 'highlight-saved r)))))`,
`(define (on-event kind thunk) (thunk))
(define (emit kind val) (list kind val))
(define current-recorder (camera-record 'session))
(on-event 'boss-defeated
  (lambda ()
    (let ((r (camera-export current-recorder '(:format "gif"))))
      (unless (pair? r) (emit 'highlight-saved r)))))`
  ],

  // ---- CODE: choreograph card-id-of -> entity-id-of, 'card -> 'entity ----
  [
`(define (choreograph ctx)
  (let ((beat (audio-beat? (card-id-of (ctx-get 'card ctx))))
        (formation (ctx-get 'formation ctx)))
    (when beat
      (for-each (lambda (e)
                  (sub-position-per-beat e (/ (entity-x e) 100) formation))
                (ctx-get 'dancers ctx)))))`,
`(define (choreograph ctx)
  (let ((beat (audio-beat? (entity-id-of (ctx-get 'entity ctx))))
        (formation (ctx-get 'formation ctx)))
    (when beat
      (for-each (lambda (e)
                  (sub-position-per-beat e (/ (entity-x e) 100) formation))
                (ctx-get 'dancers ctx)))))`
  ],
  // start slot 1
  [
`(define (start ctx)
  (touch 'hand (card-id-of (card-find-by-kind 'button))))`,
`(define (start ctx)
  (touch 'hand (entity-id-of (entity-find-by-kind 'button))))`
  ],
  // start slot 2
  [
`(define (start ctx)
  (let ((target (card-find-by-kind 'switch)))
    (if (pair? target)
        (touch 'hand (card-id-of target))
        (list))))`,
`(define (start ctx)
  (let ((target (entity-find-by-kind 'switch)))
    (if (pair? target)
        (touch 'hand (entity-id-of target))
        (list))))`
  ],
  // press-the-button (executes; locally defines helpers)
  [
`(define (card-find-by-kind kind) (list kind 'id-1))
(define (card-id-of card) (cadr card))
(define (press-the-button)
  (let ((b (card-find-by-kind 'button)))
    (when (pair? b) (touch 'hand (card-id-of b)))))
(press-the-button)
(display 'ok)`,
`(define (entity-find-by-kind kind) (list kind 'id-1))
(define (entity-id-of e) (cadr e))
(define (press-the-button)
  (let ((b (entity-find-by-kind 'button)))
    (when (pair? b) (touch 'hand (entity-id-of b)))))
(press-the-button)
(display 'ok)`
  ],

  // ---- PROSE ----
  [
`Measure DOM dimensions after a card has rendered (card-rows, card-rect, etc.).`,
`Measure surface dimensions after an entity has rendered (grid-rows, entity-rect, etc.).`
  ],
  [
`The lambda runs after two rAF cycles, so layout and paint have committed. card-rows now returns the true measured height rather than a stale pre-layout number.`,
`The lambda runs after two frame cycles, so layout and paint have committed. grid-rows now returns the true measured height rather than a stale pre-layout number.`
  ],
  [
`If you forget to cancel a tick and the card/app unloads, the tick persists and may fire in the wrong context.`,
`If you forget to cancel a tick and the entity unloads, the tick persists and may fire in the wrong context.`
  ],
  [
`All state updates must happen synchronously within the handler; asynchronous side effects require a different abstraction (e.g., card/do).`,
`All state updates must happen synchronously within the handler; asynchronous side effects require a different abstraction (e.g., entity/do).`
  ],
  [
`Does not return the sprite's final state; if you need state inspection, use card/get or card/ask after the animation completes.`,
`Does not return the sprite's final state; if you need state inspection, use entity/get or entity/state after the animation completes.`
  ],
  [
`card/emit (core verb)`,
`entity/emit (core verb)`
  ],
  [
`touch by itself does not transfer items or trigger callbacks; pair it with transfer or card-emit for full interaction.`,
`touch by itself does not transfer items or trigger callbacks; pair it with transfer or entity/emit for full interaction.`
  ],

];

// Bare slat quoted atoms (literal quotes in file — NO enc escaping)
const rawPairs = [
  [`"card-rect"`, `"entity-rect"`],
  [`"card-rows"`, `"grid-rows"`],
  [`"card/activity"`, `"entity/activity"`],
  [`"card/audio-pulse"`, `"entity/audio-pulse"`],
  [`"card/transition"`, `"entity/transition"`],
  [`"card-screen-rect"`, `"entity-screen-rect"`],
  [`"card/emit"`, `"entity/emit"`],
  [`"card-emit"`, `"entity/emit"`],
  [`"card-id-of"`, `"entity-id-of"`],
];

let raw = readFileSync(FILE, 'utf8');
const before = raw;

for (const [oldD, newD] of pairs) {
  const oldE = enc(oldD);
  const newE = enc(newD);
  const parts = raw.split(oldE);
  const count = parts.length - 1;
  if (count !== 1) {
    console.error(`ABORT: expected exactly 1 match, found ${count} for:\n---\n${oldD.slice(0, 90)}\n---`);
    process.exit(1);
  }
  raw = parts.join(newE);
}

for (const [oldR, newR] of rawPairs) {
  const parts = raw.split(oldR);
  const count = parts.length - 1;
  if (count < 1) {
    console.error(`ABORT(raw): found 0 matches for: ${oldR}`);
    process.exit(1);
  }
  raw = parts.join(newR);
  console.log(`  raw ${oldR} -> ${newR} (${count}x)`);
}

if (raw === before) { console.error('ABORT: no change'); process.exit(1); }
writeFileSync(FILE, raw, 'utf8');
console.log(`Applied ${pairs.length} replacements.`);
