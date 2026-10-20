// Music verifier: shared env (cross-block continuations) + per-block fuel reset
// + skip intentional-negative blocks + a support layer of persona/synth shims.
// Mirrors verify5 semantics but tolerant of the music book's teaching structure.
import { readFileSync } from 'node:fs';
import { parse } from '../src/reader.js';
import { makeCoreEnv } from '../core/index.js';
import { evaluate } from '../src/interp.js';
import { expandProgram, _internals } from '../src/macro.js';

const { MacroTable } = _internals;

function runSrc(src, env, fuel, macros) {
  const { forms } = expandProgram(parse(src), { fuel: { n: fuel.n }, macros });
  for (const f of forms) evaluate(f, env, fuel);
}

const FUEL = 8000000;

// Support layer: real-primitive shims for removed Curator persona/synth verbs.
// motoi/say -> real stdout. world/knowledge -> inert token. voice/* -> inert data.
const SUPPORT = `
(define (motoi/say . a) (for-each display a) (newline))
(define (world/knowledge . a) (cons 'knowledge a))
(define (voice/waveform . a) (cons 'waveform a))
(define (voice/envelope . a) (cons 'envelope a))
(define (voice/detune-spread . a) (cons 'detune-spread a))
`;

function blocksOf(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.indexOf(':prose');
  let body = raw;
  const q = raw.indexOf('"', m);
  if (q >= 0) {
    body = raw.slice(q + 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  const blocks = [];
  const re = /```scheme\n([\s\S]*?)```/g;
  let mm;
  while ((mm = re.exec(body))) blocks.push(mm[1]);
  return blocks;
}

function isNegative(code) {
  return /;;\s*(WRONG|BAD|DON'T|DONT|ANTI-?PATTERN|broken on purpose)/i.test(code)
      || /;;[^\n]*is not (a )?(verb|correct|the)/i.test(code)
      || /;;[^\n]*(won't work|does not work|doesn't work|fails intentionally)/i.test(code);
}

const files = process.argv.slice(2);
let totFail = 0;
const gap = new Map();
for (const file of files) {
  const name = file.split('/').pop();
  const blocks = blocksOf(file);
  if (!blocks.length) { console.log(`PASS  ${name}  (0/0)`); continue; }
  const fuel = { n: FUEL };
  const env = makeCoreEnv({ fuel });
  // one macro table per chapter so define-syntax persists across blocks (as a reader running top-to-bottom sees)
  const macros = new MacroTable();
  // install support layer once
  try { runSrc(SUPPORT, env, fuel, macros); } catch (e) {}
  let pass = 0, neg = 0, fail = 0;
  const fails = [];
  for (let i = 0; i < blocks.length; i++) {
    const code = blocks[i];
    if (i > 0 && isNegative(code)) { neg++; continue; }
    fuel.n = FUEL;
    try {
      runSrc(code, env, fuel, macros);
      pass++;
    } catch (e) {
      const msg = String(e.message || e);
      const um = msg.match(/unbound symbol:\s*(\S+)/);
      if (um) gap.set(um[1], (gap.get(um[1]) || 0) + 1);
      fail++; totFail++;
      fails.push(`@${i}: ${msg.slice(0, 55)}`);
    }
  }
  const tag = fail ? 'FAIL' : 'PASS';
  console.log(`${tag}  ${name}  (${pass}/${pass + fail}) neg=${neg}${fail ? '  ' + fails.slice(0,4).join(' | ') : ''}`);
}
if (gap.size) {
  console.log('\n=== remaining gap symbols ===');
  [...gap.entries()].sort((a,b)=>b[1]-a[1]).forEach(([s,c])=>console.log(`${String(c).padStart(4)}  ${s}`));
}
console.log(`\ntotal failing blocks: ${totFail}`);
