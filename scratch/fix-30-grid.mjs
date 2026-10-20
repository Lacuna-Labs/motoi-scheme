import { readFileSync, writeFileSync } from 'node:fs';
const enc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const FILE = 'scheme/reference/30-grid.slat';

// CODE slots: strip Curator #card/ addresses -> plain entity-symbol ids
const pairs = [
  [ `(grid/card-center '#card/main/my-card)`, `(grid/card-center 'my-entity)` ],
  [ `(define center (grid/card-center '#card/main/status))`, `(define center (grid/card-center 'status))` ],
  [ `(spawn-effect-at-card '#card/main/boss)`, `(spawn-effect-at-card 'boss)` ],
  [ `(grid/flower-go-to! 'petal1 '#card/scene/main)`, `(grid/flower-go-to! 'petal1 'main)` ],
  [ `(swarm-to-card '(f1 f2 f3) '#card/gallery/current)`, `(swarm-to-card '(f1 f2 f3) 'current)` ],
  [ `(follow-sequence '(#card/a #card/b #card/c))`, `(follow-sequence '(a b c))` ],
];

// :related bare atom card/rect -> entity-rect
const raws = [
  [ `"grid/flower-spawn!" "card/rect" "world/spawn"`, `"grid/flower-spawn!" "entity-rect" "world/spawn"`, 1 ],
];

let raw = readFileSync(FILE, 'utf8');
for (const [oldD, newD] of pairs) {
  const oldE = enc(oldD), newE = enc(newD);
  const parts = raw.split(oldE);
  if (parts.length - 1 !== 1) { console.error(`ABORT: expected 1 found ${parts.length-1} for:\n${oldD.slice(0,90)}`); process.exit(1); }
  raw = parts.join(newE);
}
for (const [oldR, newR, want] of raws) {
  const parts = raw.split(oldR);
  if (parts.length - 1 !== want) { console.error(`ABORT(raw): expected ${want} found ${parts.length-1} for: ${oldR}`); process.exit(1); }
  raw = parts.join(newR);
}
writeFileSync(FILE, raw, 'utf8');
console.log('30-grid: written.');
