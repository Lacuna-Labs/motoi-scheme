import { readFileSync, writeFileSync } from 'node:fs';
const enc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const FILE = 'scheme/reference/63-system.slat';

const pairs = [
  [ `Learn \`system/cards\` to understand the card roster, then use \`card/focus!\` or \`card/emit\` to interact with specific cards, then explore the card event system for reactive updates.`,
    `Learn \`system/cards\` to understand the entity roster, then use \`entity/all\` or \`entity/emit\` to interact with specific entities, then explore the entity event system for reactive updates.` ],
  [ `Cheaper alternatives exist: use \`camera-state\`, \`card-list\`, \`world/count\` if you only need one subsystem.`,
    `Cheaper alternatives exist: use \`camera-state\`, \`entity/all\`, \`world/count\` if you only need one subsystem.` ],
];
const raws = [
  [ `("card/list" "card/find-by-kind" "card/focus!" "card/unfocus!" "card/rect" "card/screen-rect" "system/health" "system/registry")`,
    `("entity/all" "entity-find-by-kind" "entity-rect" "entity-screen-rect" "system/health" "system/registry")`, 1 ],
  [ `"(core)/null?" "card/list")`, `"(core)/null?" "entity/all")`, 1 ],
  [ `"card-list"`, `"entity/all"`, 2 ],
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
console.log('63-system: written.');
