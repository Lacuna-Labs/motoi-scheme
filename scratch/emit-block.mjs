import { readFileSync, writeFileSync } from 'node:fs';
function blocksOf(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.indexOf(':prose');
  const q = raw.indexOf('"', m);
  const body = raw.slice(q + 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const blocks = [];
  const re = /```scheme\n([\s\S]*?)```/g;
  let mm;
  while ((mm = re.exec(body))) blocks.push(mm[1]);
  return blocks;
}
const [file, out, ...idxs] = process.argv.slice(2);
const blocks = blocksOf(file);
const src = idxs.map(i => blocks[Number(i)]).join('\n');
writeFileSync(out, src);
console.log(`wrote ${out} (${src.length} bytes)`);
