// Survey music book: per block, classify negative (intentional-wrong) vs positive,
// and for positive blocks that throw, record the error. Uses fresh env per block
// with block-0 as prelude (like verify4). Reports gap symbols aggregated.
import { readFileSync } from 'node:fs';
import { parse } from '../src/reader.js';
import { makeCoreEnv } from '../core/index.js';

const FUEL = 8000000;

function extractProse(file) {
  const raw = readFileSync(file, 'utf8');
  // find :prose "..." — the whole markdown body. Reader-parse the SLAT record.
  const forms = parse(raw);
  // forms[0] is the chapter record; find :prose string
  function findProse(node) {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (node[i] && node[i].kw === 'prose' || node[i] === 'prose:' ) {
          // next is string
        }
      }
    }
    return null;
  }
  return raw;
}

// Simpler: pull scheme blocks straight from raw file text via fence regex on the
// unescaped prose. The prose is a SLAT string with \" and \\ escapes; newlines literal.
function blocksOf(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.indexOf(':prose');
  let body = raw;
  // Unescape SLAT string: the prose value starts at first " after :prose
  const q = raw.indexOf('"', m);
  if (q >= 0) {
    // find matching closing quote (last unescaped) — prose is the big field; assume rest of record
    body = raw.slice(q + 1);
    body = body.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  const blocks = [];
  const re = /```scheme\n([\s\S]*?)```/g;
  let mm;
  while ((mm = re.exec(body))) blocks.push(mm[1]);
  return blocks;
}

function isNegative(code) {
  return /;;\s*(WRONG|BAD|DON'T|DONT|ANTI-?PATTERN|NOT a verb|broken|error on purpose|fails)/i.test(code)
      || /;;.*is not (a )?(verb|correct)/i.test(code);
}

const files = process.argv.slice(2);
const gap = new Map();
for (const file of files) {
  const name = file.split('/').pop();
  const blocks = blocksOf(file);
  if (!blocks.length) { console.log(`SKIP  ${name} (0 blocks)`); continue; }
  const prelude = blocks[0];
  let pass = 0, neg = 0, fail = 0;
  const fails = [];
  for (let i = 0; i < blocks.length; i++) {
    const code = blocks[i];
    if (i > 0 && isNegative(code)) { neg++; continue; }
    const fuel = { n: FUEL };
    let env;
    try { env = makeCoreEnv({ fuel }); } catch (e) { }
    const src = (i === 0 ? code : prelude + '\n' + code);
    try {
      const forms = parse(src);
      const { evaluate } = await import('../src/interp.js');
      for (const f of forms) evaluate(f, env, fuel);
      pass++;
    } catch (e) {
      const msg = String(e.message || e);
      // record unbound symbol
      const um = msg.match(/unbound symbol:\s*([^\s]+)/);
      if (um) gap.set(um[1], (gap.get(um[1]) || 0) + 1);
      fail++;
      fails.push(`@${i}: ${msg.slice(0, 60)}`);
    }
  }
  const tag = fail ? 'FAIL' : 'PASS';
  console.log(`${tag}  ${name}  pass=${pass} neg=${neg} fail=${fail}${fail ? '  ' + fails.slice(0,3).join(' | ') : ''}`);
}
console.log('\n=== gap symbols (positive blocks) ===');
[...gap.entries()].sort((a,b)=>b[1]-a[1]).forEach(([s,c])=>console.log(`${String(c).padStart(4)}  ${s}`));
