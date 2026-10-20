// scratch/run-all-ref-examples.mjs
//
// Extract EVERY `:code` string anywhere in the reference chapters
// (scheme/reference/*.slat) — not just `:examples`, but also the
// :math-program / :cs-program / :eng-program / :program / :row-* grids —
// with provenance (chapter + nearest verb :name), run each through the
// same eval path as `motoi eval`, and report pass/fail.
//
// Usage:
//   node scratch/run-all-ref-examples.mjs              # run all, print summary
//   node scratch/run-all-ref-examples.mjs > /tmp/ref-run-summary.txt
// Failures are written to /tmp/motoi-ref-failures.jsonl

import { parse, Sym } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from '../src/macro.js'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REF_DIR = resolve(__dirname, '../scheme/reference')

const chapters = (await readdir(REF_DIR)).filter(f => f.endsWith('.slat')).sort()

const items = [] // { chapter, verb, field, code }

function walk(node, ctx) {
  if (!Array.isArray(node)) return
  // Update nearest verb name if this array carries a :name string.
  let verb = ctx.verb
  for (let i = 0; i < node.length - 1; i++) {
    const k = node[i]
    if (k instanceof Sym && k.name === ':name' && typeof node[i + 1] === 'string') {
      verb = node[i + 1]
    }
  }
  const childCtx = { ...ctx, verb }
  // Capture any :code string in this array, tagged by the keyword that
  // introduced the *enclosing* structure (ctx.field) — good enough for triage.
  for (let i = 0; i < node.length - 1; i++) {
    const k = node[i]
    if (k instanceof Sym && k.name === ':code' && typeof node[i + 1] === 'string') {
      items.push({ chapter: ctx.chapter, verb, field: ctx.field, code: node[i + 1] })
    }
  }
  // Recurse, tracking the keyword that introduces each sub-array.
  for (let i = 0; i < node.length; i++) {
    const el = node[i]
    if (Array.isArray(el)) {
      const introducer = (i > 0 && node[i - 1] instanceof Sym) ? node[i - 1].name : childCtx.field
      walk(el, { ...childCtx, field: introducer })
    }
  }
}

for (const ch of chapters) {
  const src = await readFile(resolve(REF_DIR, ch), 'utf8')
  for (const f of parse(src)) walk(f, { chapter: ch, verb: '<top>', field: '<top>' })
}

process.stderr.write(`chapters: ${chapters.length}\n`)
process.stderr.write(`code snippets found: ${items.length}\n`)

function evalSource(src, fuelBudget = 200000) {
  const env = makeCoreEnv({ fuel: { n: fuelBudget } })
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: fuelBudget } })
  const fuel = { n: fuelBudget }
  let result
  for (const f of expanded) result = evaluate(f, env, fuel)
  return result
}

let pass = 0
const fails = []
for (const it of items) {
  try {
    evalSource(it.code)
    pass++
  } catch (e) {
    fails.push({ ...it, error: (e && e.message) || String(e) })
  }
}

// Summary by chapter and by error-shape.
const byChapter = {}
for (const f of fails) byChapter[f.chapter] = (byChapter[f.chapter] || 0) + 1

// Classify errors: "unbound symbol: X" is the key signal for missing verbs.
const unbound = {}
for (const f of fails) {
  const m = /unbound(?:\s+symbol)?:?\s*([^\s"'()]+)/i.exec(f.error)
  if (m) unbound[m[1]] = (unbound[m[1]] || 0) + 1
}

process.stdout.write(`\n=== RESULT ===\n`)
process.stdout.write(`total snippets: ${items.length}\n`)
process.stdout.write(`pass: ${pass}\n`)
process.stdout.write(`fail: ${fails.length}\n`)
process.stdout.write(`\n=== fails by chapter (top 30) ===\n`)
for (const [ch, n] of Object.entries(byChapter).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  process.stdout.write(`  ${n}\t${ch}\n`)
}
process.stdout.write(`\n=== unbound symbols (top 40) ===\n`)
for (const [s, n] of Object.entries(unbound).sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  process.stdout.write(`  ${n}\t${s}\n`)
}

await writeFile('/tmp/motoi-ref-failures.jsonl', fails.map(f => JSON.stringify(f)).join('\n') + '\n')
process.stdout.write(`\nfailures written to /tmp/motoi-ref-failures.jsonl\n`)
