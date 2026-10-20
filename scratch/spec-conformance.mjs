#!/usr/bin/env node
// Executable conformance harness.
// Parses each Spec/*.slatl, extracts every (verb :name ... :example "(expr) => expected"),
// runs (expr) through `node bin/motoi run`, compares printed result to expected.
// Nondeterministic examples (no `=>`, or expected containing … or matching random)
// are run-only: pass if exit 0.

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const SPECS = [
  ['r7rs-small', 'Spec/r7rs-small.slatl'],
  ['srfi-1',     'Spec/srfi-1.slatl'],
  ['srfi-13',    'Spec/srfi-13.slatl'],
  ['srfi-125',   'Spec/srfi-125.slatl'],
  ['srfi-27',    'Spec/srfi-27.slatl'],
]

// Extract (verb ...) records. Each record spans until the next (verb or (part or EOF.
function parseVerbs(text) {
  const out = []
  const re = /\(verb\b/g
  let m
  const starts = []
  while ((m = re.exec(text))) starts.push(m.index)
  for (let i = 0; i < starts.length; i++) {
    const chunk = text.slice(starts[i], starts[i + 1] ?? text.length)
    const name = chunk.match(/:name\s+"((?:[^"\\]|\\.)*)"/)?.[1]
    // :example is the last field; capture the quoted string.
    const ex = chunk.match(/:example\s+"((?:[^"\\]|\\.)*)"/)?.[1]
    if (!name) continue
    // Inverse of the generator's esc(): unescape \" -> " and \\ -> \ in one
    // left-to-right pass so #\\a (stored) becomes #\a (the real char literal).
    out.push({ name, example: ex ? ex.replace(/\\(["\\])/g, '$1') : null })
  }
  return out
}

function runMotoi(expr) {
  try {
    const out = execFileSync('node', ['bin/motoi', 'run', '/dev/stdin'],
      { input: expr, stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 })
    return { ok: true, out: out.toString().replace(/\n+$/, '') }
  } catch (e) {
    return { ok: false, out: (e.stdout?.toString() || '') + (e.stderr?.toString() || '') }
  }
}

const report = {}
let totPass = 0, totFail = 0, totRun = 0
const failures = []

for (const [part, path] of SPECS) {
  const text = readFileSync(path, 'utf8')
  const verbs = parseVerbs(text)
  const r = { total: verbs.length, compared: 0, pass: 0, fail: 0, runOnly: 0, fails: [] }
  for (const v of verbs) {
    if (!v.example) { r.runOnly++; continue }
    const arrow = v.example.indexOf('=>')
    if (arrow < 0) {
      // run-only
      const res = runMotoi(v.example.trim())
      totRun++
      if (!res.ok) { r.fail++; totFail++; r.fails.push({ name: v.name, expr: v.example.trim(), expected: '(run-only)', got: res.out.slice(0, 200) }); failures.push({ part, ...v }) }
      else r.runOnly++
      continue
    }
    const expr = v.example.slice(0, arrow).trim()
    const expected = v.example.slice(arrow + 2).trim()
    // Nondeterministic marker
    if (/…|\.\.\.|random/.test(expected)) {
      const res = runMotoi(expr)
      totRun++
      if (!res.ok) { r.fail++; totFail++; r.fails.push({ name: v.name, expr, expected, got: res.out.slice(0, 200) }); failures.push({ part, ...v }) }
      else r.runOnly++
      continue
    }
    const res = runMotoi(expr)
    r.compared++
    const got = res.out
    if (res.ok && got === expected) { r.pass++; totPass++ }
    else { r.fail++; totFail++; r.fails.push({ name: v.name, expr, expected, got: got.slice(0, 200) }); failures.push({ part, ...v }) }
  }
  report[part] = r
}

writeFileSync('scratch/spec-conformance.json', JSON.stringify(report, null, 2))

console.log('=== SPEC CONFORMANCE ===')
for (const [part, r] of Object.entries(report)) {
  console.log(`\n${part}: ${r.total} verbs | compared ${r.compared} (pass ${r.pass}, fail ${r.fail - r.fails.filter(f => f.expected === '(run-only)' || /…|\.\.\.|random/.test(f.expected)).length}) | run-only ${r.runOnly}`)
  for (const f of r.fails) {
    console.log(`  ✗ ${f.name}: ${f.expr}`)
    console.log(`     expected: ${f.expected}`)
    console.log(`     got:      ${f.got}`)
  }
}
console.log(`\nTOTAL: compared-pass ${totPass}, fail ${totFail}, run-only-ok tallied above`)
