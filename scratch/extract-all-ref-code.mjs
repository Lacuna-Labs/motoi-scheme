// scratch/extract-all-ref-code.mjs
// Dump EVERY :code string in scheme/reference/*.slat with provenance.
// Usage: node scratch/extract-all-ref-code.mjs > /tmp/motoi-ref-allcode.jsonl

import { parse, Sym } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REF_DIR = resolve(__dirname, '../scheme/reference')
const chapters = (await readdir(REF_DIR)).filter(f => f.endsWith('.slat')).sort()

// Keys whose string value is a runnable program in the reference.
const CODE_KEYS = new Set([':code', ':program'])
function isCodeKey(name) {
  return CODE_KEYS.has(name) || name.endsWith('-program') || name.endsWith('-composition')
}

const items = []
function walk(node, ctx) {
  if (!Array.isArray(node)) return
  let verb = ctx.verb
  for (let i = 0; i < node.length - 1; i++) {
    const k = node[i]
    if (k instanceof Sym && k.name === ':name' && typeof node[i + 1] === 'string') verb = node[i + 1]
  }
  const childCtx = { ...ctx, verb }
  for (let i = 0; i < node.length - 1; i++) {
    const k = node[i]
    if (k instanceof Sym && isCodeKey(k.name) && typeof node[i + 1] === 'string') {
      items.push({ chapter: ctx.chapter, verb, field: k.name, code: node[i + 1] })
    }
  }
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
process.stderr.write(`snippets: ${items.length}\n`)
for (const it of items) process.stdout.write(JSON.stringify(it) + '\n')
