import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from '../src/reader.js';

const FILE = process.argv[2];
if (!FILE) { console.error('usage: node dump-card.mjs <path.slat>'); process.exit(1); }
const raw = readFileSync(FILE, 'utf8');
const forms = parse(raw);

const TOK = /card-set!|card\/[a-z!?-]+|card-id-of|glow-with-audio|card-list|card-rect|card-screen-rect|card-rows|card-do|card-emit|on-minimap-click|define-card/;

const hits = [];
function walk(node, keyName) {
  if (typeof node === 'string') {
    if (TOK.test(node)) hits.push({ key: keyName, value: node });
    return;
  }
  if (Array.isArray(node)) {
    let lastKey = keyName;
    for (let i = 0; i < node.length; i++) {
      const el = node[i];
      if (el && typeof el === 'object' && 'name' in el && typeof el.name === 'string') {
        lastKey = el.name;
      }
      walk(el, lastKey);
    }
  }
}
walk(forms, '(root)');

const seen = new Set();
const uniq = [];
for (const h of hits) {
  if (seen.has(h.value)) continue;
  seen.add(h.value);
  uniq.push(h);
}

const out = FILE.replace(/[\/.]/g, '_') + '.hits.json';
writeFileSync('scratch/' + out, JSON.stringify(uniq, null, 2));
console.log(`Found ${uniq.length} unique string values containing card-* tokens. -> scratch/${out}`);
for (const h of uniq) {
  console.log(`\n[${h.key}]\n${h.value}`);
}
