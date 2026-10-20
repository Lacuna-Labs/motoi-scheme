#!/usr/bin/env node
// Sprinkle census: for each target verb (defined in a target chapter),
// count how many runnable example slots OUTSIDE its home chapter reference it.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REF = '/Users/alfred/code/motoi-scheme/scheme/reference';
const TARGETS = {
  '03-alg.slat': 'alg',
  '67-topo.slat': 'topo',
  '73-draw.slat': 'draw',
  '74-image.slat': 'image',
  '75-image-compose.slat': 'image-compose',
  '76-superformula.slat': 'superformula',
  '77-sdf.slat': 'sdf',
  '78-svg-path.slat': 'svg-path',
};

const RUNNABLE = /:(?:code|program|composition|[a-z0-9-]*-program|[a-z0-9-]*-composition)\b/;

// Extract verb names from a chapter file (records open with `(verb` and carry :name "...")
function verbNames(file) {
  const txt = readFileSync(join(REF, file), 'utf8');
  const names = new Set();
  const re = /:name\s+"([^"]+)"/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    if (m[1].includes('/')) names.add(m[1]);
  }
  return names;
}

// Gather all target verb names -> home file
const home = new Map();
for (const [file] of Object.entries(TARGETS)) {
  for (const name of verbNames(file)) {
    if (!home.has(name)) home.set(name, file);
  }
}

// Scan every chapter's runnable code blocks; count occurrences per verb outside home
const files = readdirSync(REF).filter(f => /^\d/.test(f) && f.endsWith('.slat'));
const outsideCount = new Map();
for (const name of home.keys()) outsideCount.set(name, 0);

for (const file of files) {
  const txt = readFileSync(join(REF, file), 'utf8');
  // find runnable key values: crude - split on lines, look for runnable key then capture the string
  const lines = txt.split('\n');
  for (const line of lines) {
    if (!RUNNABLE.test(line)) continue;
    // the code appears as a quoted string on the line
    const sm = line.match(/"((?:[^"\\]|\\.)*)"/);
    if (!sm) continue;
    const code = sm[1];
    for (const name of home.keys()) {
      if (file === home.get(name)) continue; // skip home chapter
      // word-boundary-ish match: verb name followed by space or paren
      const idx = code.indexOf('(' + name + ' ') >= 0 || code.indexOf('(' + name + ')') >= 0;
      if (idx) outsideCount.set(name, outsideCount.get(name) + 1);
    }
  }
}

// Report: sort by outside count ascending (starved first)
const rows = [...home.keys()].map(n => ({ name: n, home: home.get(n), out: outsideCount.get(n) }));
rows.sort((a, b) => a.out - b.out || a.name.localeCompare(b.name));

const starved = rows.filter(r => r.out === 0);
console.log(`TOTAL target verbs: ${rows.length}`);
console.log(`STARVED (0 uses outside home chapter): ${starved.length}`);
console.log('---STARVED BY HOME---');
const byHome = {};
for (const r of starved) (byHome[r.home] ??= []).push(r.name);
for (const [h, ns] of Object.entries(byHome)) {
  console.log(`\n${h} (${ns.length}):`);
  console.log('  ' + ns.join(', '));
}
console.log('\n---USED >=1 OUTSIDE (top 25)---');
for (const r of rows.filter(r => r.out > 0).slice(-25)) console.log(`  ${r.out}\t${r.name}`);
