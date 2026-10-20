// scratch/run-ref-surgery-audit.mjs
// Run every reference :code program through the SAME env `motoi run` uses
// (makeCoreEnv) and tally failures by chapter + missing verb. Purpose:
// after the 2026-07-25 Curator-verb surgery, find exactly which reference
// programs now break (unbound symbol) so #372 can rewrite them on real
// Motoi math/physics.
//
// Usage: node scratch/run-ref-surgery-audit.mjs /tmp/motoi-ref-allcode.jsonl > /tmp/ref-surgery-audit.json

import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'

const inFile = process.argv[2] || '/tmp/motoi-ref-allcode.jsonl'
const lines = readFileSync(inFile, 'utf8').split('\n').filter(Boolean)

// Fresh env per snippet: reusing one env OOMs after ~17k accumulated
// defines. A fresh env is ~7ms and gets GC'd, keeping memory flat.
// Silence the per-define perm warnings — pure noise for this audit.
const origErr = process.stderr.write.bind(process.stderr)
process.stderr.write = (s, ...a) => (String(s).startsWith('[verbRegistry]') ? true : origErr(s, ...a))

// Evaluated reference programs write their own output to stdout via
// display/write. Swallow it so it can't pollute our JSON result file.
const outFile = process.argv[3] || '/tmp/ref-surgery-audit.json'
process.stdout.write = () => true

const UNBOUND = /(unbound|not a function|undefined verb|no such verb)/i
function classify(msg) {
  if (UNBOUND.test(msg)) {
    // pull the offending symbol name if the message carries it
    const m = msg.match(/unbound(?: symbol| variable)?:?\s*([^\s,)]+)/i)
      || msg.match(/not a function:?\s*([^\s,)]+)/i)
    return { kind: 'unbound', sym: m ? m[1] : null }
  }
  return { kind: 'other', sym: null }
}

const byChapter = {}      // chapter -> {total, pass, fail, unbound, other}
const missingVerbs = {}   // symbol -> count
const missingByChapter = {} // chapter -> Set(symbols)
const failSamples = {}    // chapter -> [{verb, code, err}] (cap 5)

let n = 0
for (const line of lines) {
  let rec
  try { rec = JSON.parse(line) } catch { continue }
  const { chapter, verb, code } = rec
  if (!code || typeof code !== 'string') continue
  n++
  const c = byChapter[chapter] || (byChapter[chapter] = { total: 0, pass: 0, fail: 0, unbound: 0, other: 0 })
  c.total++
  let ok = true, errMsg = ''
  try {
    const env = makeCoreEnv({ fuel: { n: 200000 } })
    const forms = parse(code)
    const { forms: expanded } = expandProgram(forms, { fuel: { n: 200000 } })
    const fuel = { n: 200000 }
    for (const f of expanded) evaluate(f, env, fuel)
  } catch (e) {
    ok = false
    errMsg = (e && e.message) ? e.message : String(e)
  }
  if (ok) { c.pass++; continue }
  c.fail++
  const { kind, sym } = classify(errMsg)
  if (kind === 'unbound') {
    c.unbound++
    if (sym) {
      missingVerbs[sym] = (missingVerbs[sym] || 0) + 1
      ;(missingByChapter[chapter] || (missingByChapter[chapter] = new Set())).add(sym)
    }
  } else {
    c.other++
  }
  const s = failSamples[chapter] || (failSamples[chapter] = [])
  if (s.length < 6) s.push({ verb, code: code.slice(0, 100), err: errMsg.slice(0, 120) })
}

// rank chapters by failure count
const chapterRows = Object.entries(byChapter)
  .map(([ch, v]) => ({ chapter: ch, ...v, failPct: +(100 * v.fail / v.total).toFixed(1) }))
  .sort((a, b) => b.fail - a.fail)

const missingRanked = Object.entries(missingVerbs)
  .sort((a, b) => b[1] - a[1])
  .map(([sym, count]) => ({ sym, count }))

const missingByCh = Object.fromEntries(
  Object.entries(missingByChapter).map(([ch, set]) => [ch, [...set].sort()]),
)

const totFail = chapterRows.reduce((s, r) => s + r.fail, 0)
const totUnbound = chapterRows.reduce((s, r) => s + r.unbound, 0)

writeFileSync(outFile, JSON.stringify({
  snippets: n,
  totalFail: totFail,
  totalUnbound: totUnbound,
  chapterRows,
  missingVerbs: missingRanked,
  missingByChapter: missingByCh,
  failSamples,
}, null, 2))

process.stderr.write(`ran ${n} snippets · ${totFail} fail · ${totUnbound} unbound · ${missingRanked.length} distinct missing verbs\n`)
