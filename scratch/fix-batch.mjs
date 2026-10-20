import { readFileSync, writeFileSync } from 'node:fs';
const enc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

// Per-file jobs. Each job: { file, pairs:[[old,new,?count]], raws:[[old,new,?count]] }
const jobs = [

// ---------- 62-synth ----------
{ file: 'scheme/reference/62-synth.slat',
  pairs: [
    [ `(define (beat-flash)
  (synth/onset-tap
    (lambda (event)
      (card-emit (list ':flash 'intensity 0.8)))))
(beat-flash)`,
      `(define (beat-flash)
  (synth/onset-tap
    (lambda (event)
      (display (list ':flash 'intensity 0.8)))))
(beat-flash)` ],
  ], raws: [] },

// ---------- 72-world (card-emit local handler name + card-id-of) ----------
{ file: 'scheme/reference/72-world.slat',
  pairs: [
    [ `(define (on-card-emit card payload)
  (let ((duration (car payload)))
    (world/after duration 'particle-fade (card-id-of card))
    (next 'waiting card)))`,
      `(define (on-entity-emit e payload)
  (let ((duration (car payload)))
    (world/after duration 'particle-fade e)
    (next 'waiting e)))` ],
  ], raws: [] },

// ---------- 66-time (4 slots, card-emit -> display) ----------
{ file: 'scheme/reference/66-time.slat',
  pairs: [
    [ `(to-draw (lambda (s) (card-emit 'event-finished)))`,
      `(to-draw (lambda (s) (display 'event-finished)))` ],
    [ `(to-draw (lambda (s) (card-emit 'game-complete)))`,
      `(to-draw (lambda (s) (display 'game-complete)))` ],
    [ `(to-draw (lambda (s) (card-emit 'frame s)))`,
      `(to-draw (lambda (s) (display 'frame s)))` ],
    [ `(to-draw (lambda (s) (card-emit 'boss-dialogue)))`,
      `(to-draw (lambda (s) (display 'boss-dialogue)))` ],
  ], raws: [] },

// ---------- 65-tick (card/draw -> display; card/draw is a Curator paint verb) ----------
{ file: 'scheme/reference/65-tick.slat',
  pairs: [
    [ `(card/draw 'progress-bar (list 0 0 width 20))`,
      `(display (list 'progress-bar 0 0 width 20))` ],
    [ `(card/draw 'glow (list 100 100 (* 200 intensity) (* 200 intensity)))`,
      `(display (list 'glow 100 100 (* 200 intensity) (* 200 intensity)))` ],
  ], raws: [] },

// ---------- 40-math (prose comment: 'card/canvas' -> 'surface') ----------
{ file: 'scheme/reference/40-math.slat',
  pairs: [
    [ `;; (display spec)  ;; or render it in a card/canvas`,
      `;; (display spec)  ;; or render it on a surface` ],
  ], raws: [] },

// ---------- 64-text (prose progression: card/open -> entity/open? no; drop to surface) ----------
{ file: 'scheme/reference/64-text.slat',
  pairs: [
    [ `then surface/paint-text for lower-level control; then card/open for text inside interactive cards.`,
      `then surface/paint-text for lower-level control; then attach text to an entity for interactive labels.` ],
  ], raws: [] },

// ---------- 48-part (3 prose mentions) ----------
{ file: 'scheme/reference/48-part.slat',
  pairs: [
    [ `It must be used within an animation context (card/emit, form-group, choreography).`,
      `It must be used within an animation context (entity/emit, form-group, choreography).` ],
    [ `then learn card/effect to pair twist with physics or impact events`,
      `then learn entity/effect to pair twist with physics or impact events` ],
    [ `use with card/emit to trigger dialogue or events`,
      `use with entity/emit to trigger dialogue or events` ],
  ], raws: [] },

// ---------- 42-motion (prose card-do/card/transition + :related atoms) ----------
{ file: 'scheme/reference/42-motion.slat',
  pairs: [
    [ `The host must dispatch it (e.g. via card-do or on a card/transition).`,
      `The host must dispatch it (e.g. via entity/do or on an entity/transition).` ],
    [ `use multiple card-do calls or motion/arc for multi-waypoint paths.`,
      `use multiple entity/do calls or motion/arc for multi-waypoint paths.` ],
  ],
  raws: [
    [ `"card-do" "card-transition")`, `"entity/do" "entity/transition")` ],
    [ `("card/transition" "card-do")`, `("entity/transition" "entity/do")` ],
    [ `"motion/arc" "card/transition" "tick/pattern"`, `"motion/arc" "entity/transition" "tick/pattern"` ],
  ] },

// ---------- 24-entity (prose card/emit + :related atom) ----------
{ file: 'scheme/reference/24-entity.slat',
  pairs: [
    [ `Listeners (via card/emit, act, or similar event handlers) receive the event`,
      `Listeners (via entity/emit, act, or similar event handlers) receive the event` ],
  ],
  raws: [
    [ `"entity/tag!" "card/emit" "entity/glide!"`, `"entity/tag!" "entity/emit" "entity/glide!"` ],
  ] },

// ---------- 51-plot (prose + :related) ----------
{ file: 'scheme/reference/51-plot.slat',
  pairs: [
    [ `SVG is static; use plot/* verbs with card/transition for animation instead.`,
      `SVG is static; use plot/* verbs with entity/transition for animation instead.` ],
  ],
  raws: [
    [ `"plot/from-series" "card/emit" "surface/paint-dots"`, `"plot/from-series" "entity/emit" "surface/paint-dots"` ],
  ] },

// ---------- 63-system (:related card/* + prose card-list + :related card-list) ----------
{ file: 'scheme/reference/63-system.slat',
  pairs: [
    [ `Learn \`system/cards\` to understand the card roster, then use \`card/focus!\` or \`card/emit\` to interact with specific cards, then explore the card event system for reactive updates.`,
      `Learn \`system/cards\` to understand the entity roster, then use \`entity/all\` or \`entity/emit\` to interact with specific entities, then explore the entity event system for reactive updates.` ],
    [ `Cheaper alternatives exist: use \`camera-state\`, \`card-list\`, \`world/count\` if you only need one subsystem.`,
      `Cheaper alternatives exist: use \`camera-state\`, \`entity/all\`, \`world/count\` if you only need one subsystem.` ],
  ],
  raws: [
    // :related header list — drop focus/unfocus (no Motoi analog), map the rest
    [ `("card/list" "card/find-by-kind" "card/focus!" "card/unfocus!" "card/rect" "card/screen-rect" "system/health" "system/registry")`,
      `("entity/all" "entity-find-by-kind" "entity-rect" "entity-screen-rect" "system/health" "system/registry")` ],
    // prerequisites atom card/list
    [ `"(core)/null?" "card/list")`, `"(core)/null?" "entity/all")` ],
    // related + prerequisites quoted atoms: card-list -> entity/all (2 occurrences; drawbacks one is backtick prose, handled above)
    [ `"card-list"`, `"entity/all"`, 2 ],
  ] },

];

let total = 0;
for (const job of jobs) {
  let raw = readFileSync(job.file, 'utf8');
  const before = raw;
  for (const [oldD, newD, want] of (job.pairs || [])) {
    const expected = want ?? 1;
    const oldE = enc(oldD), newE = enc(newD);
    const parts = raw.split(oldE);
    const count = parts.length - 1;
    if (count !== expected) { console.error(`ABORT ${job.file}: expected ${expected} found ${count} for:\n${oldD.slice(0,90)}`); process.exit(1); }
    raw = parts.join(newE);
  }
  for (const [oldR, newR, want] of (job.raws || [])) {
    const parts = raw.split(oldR);
    const count = parts.length - 1;
    if (want !== undefined) {
      if (count !== want) { console.error(`ABORT ${job.file}(raw): expected ${want} found ${count} for: ${oldR}`); process.exit(1); }
    } else if (count < 1) {
      console.error(`ABORT ${job.file}(raw): 0 for ${oldR}`); process.exit(1);
    }
    raw = parts.join(newR);
  }
  if (raw !== before) { writeFileSync(job.file, raw, 'utf8'); total++; console.log(`ok ${job.file}`); }
  else console.log(`no-change ${job.file}`);
}
console.log(`Done. ${total} files written.`);
