#!/usr/bin/env node
// Feed each snippet to ./bin/motoi run; report pass/fail. Snippets in a JS array.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const snips = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let fail = 0;
for (const [name, code] of snips) {
  const tmp = `/tmp/snip.scm`;
  writeFileSync(tmp, code);
  try {
    const out = execFileSync('./bin/motoi', ['run', tmp], { encoding: 'utf8', stdio: ['pipe','pipe','pipe'], timeout: 15000 });
    if (/unbound|error|Error|exception/i.test(out)) { console.log(`FAIL ${name}: ${out.trim().slice(0,120)}`); fail++; }
    else console.log(`ok   ${name}`);
  } catch (e) {
    console.log(`FAIL ${name}: ${(e.stderr||e.stdout||e.message||'').toString().trim().slice(0,140)}`); fail++;
  }
}
console.log(`\n==== ${snips.length} snippets, ${fail} FAIL ====`);
