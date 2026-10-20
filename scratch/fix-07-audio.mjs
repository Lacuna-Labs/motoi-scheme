import { readFileSync, writeFileSync } from 'node:fs';
const FILE = 'scheme/reference/07-audio.slat';
const enc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

const pairs = [
  // [44] choreograph-to-bars: card-set! -> entity/set!, param name card irrelevant (ctx)
  [
`(define (choreograph-to-bars handle)
  (let ((clock (audio/bar-clock handle 2)))
    (define (step ctx)
      (let ((p (clock 'phase)))
        (cond ((< p 0.25) (card-set! (ctx-get ctx) 'pose 'a))
              ((< p 0.5) (card-set! (ctx-get ctx) 'pose 'b))
              ((< p 0.75) (card-set! (ctx-get ctx) 'pose 'c))
              (else (card-set! (ctx-get ctx) 'pose 'd)))))
    (on-tick step)))
(choreograph-to-bars (audio-play "march") 2)`,
`(define (choreograph-to-bars handle)
  (let ((clock (audio/bar-clock handle 2)))
    (define (step ctx)
      (let ((p (clock 'phase)))
        (cond ((< p 0.25) (entity/set! (ctx-get ctx) 'pose 'a))
              ((< p 0.5) (entity/set! (ctx-get ctx) 'pose 'b))
              ((< p 0.75) (entity/set! (ctx-get ctx) 'pose 'c))
              (else (entity/set! (ctx-get ctx) 'pose 'd)))))
    (on-tick step)))
(choreograph-to-bars (audio-play "march") 2)`
  ],
  // [176]+[199] identical key-responsive-palette body appears twice (dialect + rung) — replace both
  [
`(define (key-responsive-palette card)
  (let ((key (audio/key)))
    (when key
      (let* ((confidence (caddr key))
             (alpha (min 1.0 (* confidence 1.5))))
        (card-set! card 'palette
          (case (car key)
            (("C" "G" "D") 'warm)
            (("F" "Bb" "Eb") 'cool)
            (else 'neutral)))
        (card-set! card 'glow alpha)))))
(on-tick (lambda () (key-responsive-palette (card-list))))`,
`(define (key-responsive-palette e)
  (let ((key (audio/key)))
    (when key
      (let* ((confidence (caddr key))
             (alpha (min 1.0 (* confidence 1.5))))
        (entity/set! e 'palette
          (case (car key)
            (("C" "G" "D") 'warm)
            (("F" "Bb" "Eb") 'cool)
            (else 'neutral)))
        (entity/set! e 'glow alpha)))))
(on-tick (lambda () (for-each key-responsive-palette (entity/all))))`,
  2
  ],
  // [440] scale-animation: card-get->ctx-get, card-set!->entity/set!
  [
`(define (scale-animation ctx)
  (let ((strength (audio/onset-strength))
        (smooth-strength (card-get ctx ':smooth-strength 0)))
    (let ((new-smooth (+ (* smooth-strength 0.8) (* strength 0.2))))
      (card-set! ctx ':animation-scale (+ 1 (* new-smooth 0.5)))
      (next 'scale-animation (ctx-set 'smooth-strength new-smooth ctx)))))`,
`(define (scale-animation ctx)
  (let ((strength (audio/onset-strength))
        (smooth-strength (ctx-get 'smooth-strength ctx)))
    (let ((new-smooth (+ (* smooth-strength 0.8) (* strength 0.2))))
      (entity/set! ctx ':animation-scale (+ 1 (* new-smooth 0.5)))
      (next 'scale-animation (ctx-set 'smooth-strength new-smooth ctx)))))`
  ],
  // [505] beat-counter: card-get->ctx-get, card-set!->entity/set!
  [
`(define (beat-counter ctx)
  (let ((beat-count (card-get ctx ':beat-count 0)))
    (if (audio/onset?)
      (let ((new-count (+ beat-count 1)))
        (card-set! ctx ':beat-display new-count)
        (ctx-set 'beat-count new-count ctx))
      ctx)))`,
`(define (beat-counter ctx)
  (let ((beat-count (ctx-get 'beat-count ctx)))
    (if (audio/onset?)
      (let ((new-count (+ beat-count 1)))
        (entity/set! ctx ':beat-display new-count)
        (ctx-set 'beat-count new-count ctx))
      ctx)))`
  ],
];

// prose :prerequisites bare atom "card/emit" -> "entity/emit"
const rawPairs = [
  [`"audio/playing?" "card/emit"`, `"audio/playing?" "entity/emit"`],
];

let raw = readFileSync(FILE, 'utf8');
const before = raw;
for (const [oldD, newD, want] of pairs) {
  const expected = want ?? 1;
  const oldE = enc(oldD), newE = enc(newD);
  const parts = raw.split(oldE);
  const count = parts.length - 1;
  if (count !== expected) { console.error(`ABORT: expected ${expected}, found ${count} for:\n${oldD.slice(0,80)}`); process.exit(1); }
  raw = parts.join(newE);
}
for (const [oldR, newR] of rawPairs) {
  const parts = raw.split(oldR);
  const count = parts.length - 1;
  if (count < 1) { console.error(`ABORT(raw): 0 for ${oldR}`); process.exit(1); }
  raw = parts.join(newR);
  console.log(`  raw ${oldR} (${count}x)`);
}
if (raw === before) { console.error('ABORT: no change'); process.exit(1); }
writeFileSync(FILE, raw, 'utf8');
console.log(`07-audio: applied ${pairs.length} code + ${rawPairs.length} raw.`);
