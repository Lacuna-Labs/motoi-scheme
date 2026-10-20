#!/usr/bin/env node
// cart-parse-audit — parse every scheme-carts .sks under BOTH the current
// Sakura reader and the incoming Motoi reader, and report divergence.
// Answers: "will the automations break when the engine is flipped to Motoi?"
// Also records paired-doc presence + FRAME/BODY status (the correctness check).
//
// Read-only. Writes a JSON + a short console summary. No cart is modified.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse as parseSakura } from '/Users/alfred/code/sakura-scheme/src/reader.js'
import { parse as parseMotoi } from '/Users/alfred/code/motoi-scheme/src/reader.js'

const ROOT = '/Users/alfred/code/scheme-carts'
const CARTS = path.join(ROOT, 'carts')
const DOCS = path.join(ROOT, 'docs')

async function walk (dir) {
  const out = []
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(p))
    else if (e.isFile() && p.endsWith('.sks')) out.push(p)
  }
  return out
}

function tryParse (fn, src) {
  try { fn(src); return null } catch (e) { return e.message || String(e) }
}

const R = {
  total: 0,
  bothOk: 0,
  bothFail: 0,
  sakuraOnlyFail: 0,   // parses in Motoi, fails in Sakura (regression risk low)
  motoiOnlyFail: 0,    // parses in Sakura, FAILS in Motoi = the move breaks it
  missingDoc: 0,
  bodyPending: 0,
  motoiBreaks: [],     // slugs that the flip would break (motoiOnlyFail) — capped list
  bothFailSlugs: [],
}

const files = await walk(CARTS)
R.total = files.length

for (const f of files) {
  const src = await fs.readFile(f, 'utf8')
  const sErr = tryParse(parseSakura, src)
  const mErr = tryParse(parseMotoi, src)
  const slug = f.slice(CARTS.length + 1, -4)

  if (!sErr && !mErr) R.bothOk++
  else if (sErr && mErr) { R.bothFail++; if (R.bothFailSlugs.length < 40) R.bothFailSlugs.push(slug) }
  else if (sErr && !mErr) R.sakuraOnlyFail++
  else { R.motoiOnlyFail++; if (R.motoiBreaks.length < 60) R.motoiBreaks.push({ slug, err: mErr }) }

  // doc pairing + body status
  const docPath = path.join(DOCS, slug + '.md')
  try {
    const doc = await fs.readFile(docPath, 'utf8')
    if (doc.includes('_(body pending')) R.bodyPending++
  } catch { R.missingDoc++ }
}

await fs.writeFile(
  '/Users/alfred/code/motoi-scheme/scratch/cart-parse-audit.json',
  JSON.stringify(R, null, 2)
)

console.log(`cart-parse-audit — ${R.total} carts`)
console.log(`  parse OK under BOTH readers:   ${R.bothOk}  (${(100 * R.bothOk / R.total).toFixed(1)}%)`)
console.log(`  fail under BOTH readers:       ${R.bothFail}`)
console.log(`  fail Sakura only (Motoi ok):   ${R.sakuraOnlyFail}`)
console.log(`  FAIL under MOTOI only (= flip breaks these): ${R.motoiOnlyFail}`)
console.log(`  --- correctness/coverage ---`)
console.log(`  missing paired doc:            ${R.missingDoc}`)
console.log(`  doc body still pending:        ${R.bodyPending}`)
if (R.motoiBreaks.length) {
  console.log(`\n  first Motoi-break reasons:`)
  for (const b of R.motoiBreaks.slice(0, 8)) console.log(`    ${b.slug}: ${b.err}`)
}
