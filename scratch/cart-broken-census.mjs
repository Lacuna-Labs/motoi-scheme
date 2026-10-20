#!/usr/bin/env node
// cart-broken-census — per cart: does it parse, and does every verb it calls
// resolve against the live engine? Produces the broken set that a book flag
// would be built from.
//
// Static only. Read-only — nothing is written outside scratch/.
//
//   node scratch/cart-broken-census.mjs

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse } from '../src/reader.js'
import { makeExtendedBaseEnv } from '../src/lib-loader.js'

const ROOT = '/Users/alfred/code/scheme-carts'
const CARTS = path.join(ROOT, 'automations-carts')
const OUT = new URL('./cart-broken-census.json', import.meta.url).pathname

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
const ALIAS = { 'λ': 'lambda' }
const symName = (x) =>
  (x && typeof x === 'object' && typeof x.name === 'string' && !Array.isArray(x)) ? x.name : null
const isKeyword = (n) => n.startsWith(':')

function addNames (x, bound) {
  if (Array.isArray(x)) { for (const y of x) addNames(y, bound); return }
  const n = symName(x)
  if (n) bound.add(n)
}

function collectHeads (form, out, bound, quoted) {
  if (!Array.isArray(form)) return
  const raw = symName(form[0])
  const head = raw ? (ALIAS[raw] ?? raw) : null
  if (head && !quoted) {
    if (head === 'quote') return
    if (head === 'define' || head === 'define-syntax' || head === 'define-record-type') {
      addNames(Array.isArray(form[1]) ? form[1] : [form[1]], bound)
    } else if (head === 'define-values') {
      addNames(form[1], bound)
    } else if (head === 'lambda' || head === 'named-lambda' || head === 'case-lambda') {
      addNames(form[1], bound)
    } else if (head === 'let' || head === 'let*' || head === 'letrec' ||
               head === 'letrec*' || head === 'do' || head === 'let-values' ||
               head === 'let*-values') {
      const named = symName(form[1])
      if (named) bound.add(named)
      const binds = Array.isArray(form[1]) ? form[1] : (Array.isArray(form[2]) ? form[2] : [])
      for (const b of binds) addNames(Array.isArray(b) ? b[0] : b, bound)
    }
    if (!SYNTAX.has(head) && !isKeyword(head)) out.set(head, (out.get(head) ?? 0) + 1)
  }
  const inQuoted = quoted
    ? head !== 'unquote' && head !== 'unquote-splicing'
    : head === 'quasiquote'
  for (const x of form) collectHeads(x, out, bound, inQuoted)
}

const env = makeExtendedBaseEnv()
const bindings = new Set()
for (let e = env; e; e = e.parent) {
  if (e.vars instanceof Map) for (const k of e.vars.keys()) bindings.add(String(k))
  else if (e.vars) for (const k of Object.keys(e.vars)) bindings.add(k)
}
if (bindings.size === 0) { console.error('!! no bindings read — refusing to report'); process.exit(2) }

const slugs = (await fs.readdir(CARTS, { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name).sort()

const carts = []
for (const slug of slugs) {
  const f = path.join(CARTS, slug, `${slug}.sks`)
  let src
  try { src = await fs.readFile(f, 'utf8') } catch { continue }
  let forms
  try { forms = parse(src) } catch (e) {
    carts.push({ slug, status: 'unparseable', why: (e.message || String(e)).slice(0, 160), missing: [] })
    continue
  }
  const here = new Map(); const bound = new Set()
  for (const form of forms) collectHeads(form, here, bound, false)
  const missing = [...here.keys()].filter((n) => !bound.has(n) && !bindings.has(n)).sort()
  carts.push({
    slug,
    status: missing.length ? 'unbound-verbs' : 'resolves',
    missing,
  })
}

const by = (s) => carts.filter((c) => c.status === s)
console.log(`carts            : ${carts.length}`)
console.log(`  resolves fully : ${by('resolves').length}`)
console.log(`  unbound verbs  : ${by('unbound-verbs').length}`)
console.log(`  unparseable    : ${by('unparseable').length}`)

await fs.writeFile(OUT, JSON.stringify({ bindings: bindings.size, carts }, null, 2))
console.log(`\n-> ${OUT}`)
