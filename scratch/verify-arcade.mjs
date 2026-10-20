// Shared-env arcade verifier: one env + one macro table per chapter,
// blocks run top-to-bottom (helpers persist), fuel reset per block,
// intentional-negatives skipped. Reports true unbound-symbol gap.
import { readFileSync } from 'node:fs';
import { parse } from '../src/reader.js';
import { makeCoreEnv } from '../core/index.js';
import { evaluate } from '../src/interp.js';
import { expandProgram, _internals } from '../src/macro.js';

const { MacroTable } = _internals;
const FUEL = 8000000;

function runSrc(src, env, fuel, macros) {
  const { forms } = expandProgram(parse(src), { fuel: { n: fuel.n }, macros });
  for (const f of forms) evaluate(f, env, fuel);
}

function unescape(code) {
  let out = ''; let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '\\' && i + 1 < code.length) {
      const n = code[i + 1];
      if (n === '\\') { out += '\\'; i += 2; continue; }
      if (n === '"') { out += '"'; i += 2; continue; }
    }
    out += c; i++;
  }
  return out;
}

function blocksOf(file) {
  const raw = readFileSync(file, 'utf8');
  const blocks = [];
  const re = /```scheme\n([\s\S]*?)```/g;
  let mm;
  let lastEnd = 0;
  while ((mm = re.exec(raw))) {
    // A block is "deferred" (flagged for Alfred, genuinely no Motoi
    // substrate) when a needs-alfred marker sits in the gap between the
    // previous fence and this one — scoped so a marker for a prior block
    // never leaks onto the block that follows it.
    const gapText = raw.slice(lastEnd, mm.index);
    // Deferred only when a needs-alfred comment is the LAST thing
    // immediately before the fence (nothing but whitespace after it).
    const trailing = gapText.match(/<!--([\s\S]*?)-->\s*$/);
    const deferred = !!(trailing && /needs-alfred/i.test(trailing[1]));
    blocks.push({ off: mm.index, code: unescape(mm[1]), deferred });
    lastEnd = mm.index + mm[0].length;
  }
  return blocks;
}

const NEG = /;;\s*(WRONG|BAD|DON'?T|ANTI-?PATTERN|broken on purpose|won'?t work|does ?n'?t work|fails intentionally|is not )/i;

const files = process.argv.slice(2);
const gap = new Map();
let totFail = 0, totPass = 0, totNeg = 0, totDef = 0;
for (const file of files) {
  const name = file.split('/').pop();
  const blocks = blocksOf(file);
  if (!blocks.length) { continue; }
  const fuel = { n: FUEL };
  const env = makeCoreEnv({ fuel });
  const macros = new MacroTable();
  let pass = 0, neg = 0, fail = 0, def = 0;
  const fails = [];
  for (let i = 0; i < blocks.length; i++) {
    const { code, deferred } = blocks[i];
    if (deferred) { def++; totDef++; continue; }
    if (i > 0 && NEG.test(code)) { neg++; totNeg++; continue; }
    fuel.n = FUEL;
    try {
      runSrc(code, env, fuel, macros);
      pass++; totPass++;
    } catch (e) {
      const msg = String(e.message || e);
      const um = msg.match(/unbound symbol:\s*(\S+)/);
      if (um) gap.set(um[1], (gap.get(um[1]) || 0) + 1);
      fail++; totFail++;
      fails.push(`  #${i}: ${msg.slice(0, 70)}`);
    }
  }
  const tag = fail ? 'FAIL' : 'PASS';
  console.log(`${tag}  ${name}  (${pass}/${pass + fail}) neg=${neg} def=${def}`);
  if (fail) fails.slice(0, 12).forEach(l => console.log(l));
}
console.log(`\nTOTAL pass=${totPass} fail=${totFail} neg=${totNeg} def=${totDef}`);
if (gap.size) {
  console.log('=== gap symbols ===');
  [...gap.entries()].sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`${String(c).padStart(4)}  ${s}`));
}
