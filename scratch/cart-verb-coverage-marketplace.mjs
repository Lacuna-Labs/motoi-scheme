#!/usr/bin/env node
// cart-verb-coverage — of every verb the automations carts actually call, how
// many does the live Motoi engine bind? That number is the distance between
// the carts and running on Motoi, and it has never been measured.
//
// Static only: the carts are read and parsed, never executed. No model, no
// network. Read-only — no cart and no repo file is modified.
//
//   node scratch/cart-verb-coverage.mjs

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse } from '../src/reader.js'
import { makeExtendedBaseEnv } from '../src/lib-loader.js'

// `broken/` is a quarantine, not shipped work — counting it would inflate the
// missing list with verbs nothing calls in anger.
const ROOT = '/Users/alfred/code/scheme-carts'
const CARTS = ['automations-carts', 'user-carts', 'runtime'].map((d) => path.join(ROOT, d))
const OUT = new URL('./cart-verb-coverage-marketplace.json', import.meta.url).pathname

// Heads that are syntax, not verbs — an unbound `define` is not a missing verb.
const SYNTAX = new Set([
  'define', 'define-syntax', 'define-record-type', 'define-values', 'define-library',
  'lambda', 'let', 'let*', 'letrec', 'letrec*', 'let-values', 'let*-values',
  'let-syntax', 'letrec-syntax', 'named-lambda', 'if', 'cond', 'case', 'and', 'or',
  'when', 'unless', 'do', 'begin', 'quote', 'quasiquote', 'unquote',
  'unquote-splicing', 'set!', 'delay', 'delay-force', 'make-promise', 'parameterize',
  'guard', 'assert', 'syntax-rules', 'else', '=>', 'import', 'export', 'include',
  'cond-expand', 'case-lambda', 'dynamic-wind', 'library', 'only', 'except',
  'rename', 'prefix', 'match', 'while', 'for',
])

async function walk (dir) {
  const out = []
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(p))
    else if (e.isFile() && p.endsWith('.sks')) out.push(p)
  }
  return out
}

// The reader returns Sym objects (`{ name }`), not JS symbols.
const symName = (x) =>
  (x && typeof x === 'object' && typeof x.name === 'string' && !Array.isArray(x)) ? x.name : null

// `λ` is the lambda the carts actually type.
const ALIAS = { 'λ': 'lambda' }
// `:status` in `(:status "ok" :reason …)` is a plist key, not a call.
const isKeyword = (n) => n.startsWith(':')

function addNames (x, bound) {
  if (Array.isArray(x)) { for (const y of x) addNames(y, bound); return }
  const n = symName(x)
  if (n) bound.add(n)
}

// Called verbs are HEADS of application forms. A name in argument position is
// usually a variable, and counting those invents missing verbs nothing calls.
// Locals are collected per file — a helper defined in one cart does not excuse
// the same name being unbound in another.
function collectHeads (form, out, bound, quoted) {
  if (!Array.isArray(form)) return
  const raw = symName(form[0])
  const head = raw ? (ALIAS[raw] ?? raw) : null
  if (head && !quoted) {
    if (head === 'quote') return
    if (head === 'define' || head === 'define-syntax' || head === 'define-record-type') {
      const t = form[1]
      addNames(Array.isArray(t) ? t : [t], bound)
    } else if (head === 'define-values') {
      addNames(form[1], bound)
    } else if (head === 'lambda' || head === 'named-lambda' || head === 'case-lambda') {
      addNames(form[1], bound)
    } else if (head === 'let' || head === 'let*' || head === 'letrec' ||
               head === 'letrec*' || head === 'do' || head === 'let-values' ||
               head === 'let*-values') {
      // Named let: `(let loop ((i 0)) …)` — the name is a real binding too.
      const named = symName(form[1])
      if (named) bound.add(named)
      const binds = Array.isArray(form[1]) ? form[1] : (Array.isArray(form[2]) ? form[2] : [])
      for (const b of binds) addNames(Array.isArray(b) ? b[0] : b, bound)
    }
    if (!SYNTAX.has(head) && !isKeyword(head)) out.set(head, (out.get(head) ?? 0) + 1)
  }
  // Inside quasiquote everything is data until an unquote puts it back in
  // evaluated position.
  const inQuoted = quoted
    ? head !== 'unquote' && head !== 'unquote-splicing'
    : head === 'quasiquote'
  for (const x of form) collectHeads(x, out, bound, inQuoted)
}

const env = makeExtendedBaseEnv()
const bindings = new Set()
for (let e = env; e; e = e.parent) {
  const vars = e.vars ?? e.table ?? e.bindings ?? e
  if (vars instanceof Map) for (const k of vars.keys()) bindings.add(typeof k === 'symbol' ? symName(k) : k)
  else if (vars && typeof vars === 'object') for (const k of Object.keys(vars)) bindings.add(k)
}
if (bindings.size === 0) {
  console.error('!! could not read the env bindings — coverage would be a lie, refusing to print one')
  process.exit(2)
}

// Scoped to the two marketplaces on the table. The all-carts number answers
// "how far is the whole fleet"; this one answers the only question being
// asked — what do eBay and Etsy alone need.
const SCOPE = /ebay|etsy/i
const files = (await Promise.all(CARTS.map(walk))).flat().filter((f) => SCOPE.test(f))
const calls = new Map()
let parsed = 0
let unparseable = 0

for (const f of files) {
  let forms
  try { forms = parse(await fs.readFile(f, 'utf8')) } catch { unparseable++; continue }
  parsed++
  const here = new Map()
  const bound = new Set()
  for (const form of forms) collectHeads(form, here, bound, false)
  for (const [n, c] of here) {
    if (bound.has(n)) continue
    calls.set(n, (calls.get(n) ?? 0) + c)
  }
}

const rows = [...calls.entries()].sort((a, b) => b[1] - a[1])
const resolved = rows.filter(([n]) => bindings.has(n))
const missing = rows.filter(([n]) => !bindings.has(n))
const callsTotal = rows.reduce((a, [, c]) => a + c, 0)
const callsMissing = missing.reduce((a, [, c]) => a + c, 0)

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0')
console.log(`carts parsed          : ${parsed}  (${unparseable} unparseable, skipped)`)
console.log(`engine bindings       : ${bindings.size}`)
console.log(`distinct verbs called : ${rows.length}   (cart-local definitions excluded)`)
console.log(`  resolve             : ${resolved.length}  ${pct(resolved.length, rows.length)}%`)
console.log(`  missing             : ${missing.length}  ${pct(missing.length, rows.length)}%`)
console.log(`call sites            : ${callsTotal}`)
console.log(`  land on a missing verb: ${callsMissing}  ${pct(callsMissing, callsTotal)}%`)
console.log('\ntop missing verbs by call count:')
for (const [n, c] of missing.slice(0, 30)) console.log(`  ${String(c).padStart(6)}  ${n}`)

await fs.writeFile(OUT, JSON.stringify({
  parsed, unparseable, bindings: bindings.size,
  distinct: rows.length, resolved: resolved.length, missing: missing.length,
  callsTotal, callsMissing,
  missingVerbs: missing.map(([name, count]) => ({ name, count })),
}, null, 2))
console.log(`\n-> ${OUT}`)
