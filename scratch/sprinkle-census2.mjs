#!/usr/bin/env node
// Refined: a target verb is "isolated" if it appears NOWHERE except its home
// reference chapter — not in other reference chapters, not in any book.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/alfred/code/motoi-scheme';
const REF = join(ROOT, 'scheme/reference');
const BOOKS = join(ROOT, 'scheme-books');
const TARGETS = {
  '03-alg.slat': 'alg', '67-topo.slat': 'topo', '73-draw.slat': 'draw',
  '74-image.slat': 'image', '75-image-compose.slat': 'image-compose',
  '76-superformula.slat': 'superformula', '77-sdf.slat': 'sdf', '78-svg-path.slat': 'svg-path',
};

function verbNames(file) {
  const txt = readFileSync(join(REF, file), 'utf8');
  const names = new Set();
  for (const m of txt.matchAll(/:name\s+"([^"]+)"/g)) if (m[1].includes('/')) names.add(m[1]);
  return names;
}
const home = new Map();
for (const file of Object.keys(TARGETS)) for (const n of verbNames(file)) if (!home.has(n)) home.set(n, file);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.slatl?$/.test(e.name)) out.push(p);
  }
  return out;
}
// Corpus = all reference files (except each verb's home) + all book files.
const refFiles = readdirSync(REF).filter(f => /^\d/.test(f) && f.endsWith('.slat'));
const bookFiles = walk(BOOKS);

const refText = new Map(refFiles.map(f => [f, readFileSync(join(REF, f), 'utf8')]));
const bookBlob = bookFiles.map(f => readFileSync(f, 'utf8')).join('\n');

const rows = [];
for (const [name, hf] of home) {
  // occurrences in reference outside home
  let refOut = 0;
  for (const [f, t] of refText) { if (f === hf) continue; if (t.includes(name)) refOut++; }
  const inBooks = bookBlob.includes(name);
  rows.push({ name, home: hf, refOut, inBooks });
}
const isolated = rows.filter(r => r.refOut === 0 && !r.inBooks);
isolated.sort((a, b) => a.home.localeCompare(b.home) || a.name.localeCompare(b.name));
console.log(`Target verbs: ${rows.length}`);
console.log(`ISOLATED (0 outside-home reference AND absent from all books): ${isolated.length}`);
const byHome = {};
for (const r of isolated) (byHome[r.home] ??= []).push(r.name);
for (const [h, ns] of Object.entries(byHome)) console.log(`\n${h} (${ns.length}):\n  ${ns.join(', ')}`);
