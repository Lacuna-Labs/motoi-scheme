// scratch/extract-reference-examples.mjs
//
// Extract every `:code` string from every `:examples ( ... )` list in the
// Motoi Scheme Reference Manual (the chaptered book scheme/reference/*.slat)
// and print them one-per-line as JSON. The chapters ARE the reference now —
// the old single-file monolith was retired 2026-07-24 (see _archive/).
//
// Usage: node scratch/extract-reference-examples.mjs > /tmp/motoi-ref-examples.jsonl

import { parse, Sym } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REF_DIR = resolve(__dirname, '../scheme/reference')

const chapters = (await readdir(REF_DIR)).filter(f => f.endsWith('.slat')).sort()
const forms = []
for (const ch of chapters) {
  const src = await readFile(resolve(REF_DIR, ch), 'utf8')
  for (const f of parse(src)) forms.push(f)
}

const examples = []
let verbCount = 0

// Walk each top-level form; look for (verb ... :examples (...)) patterns.
for (const form of forms) {
  if (!Array.isArray(form)) continue
  if (!(form[0] instanceof Sym)) continue
  const head = form[0].name
  if (head !== 'verb' && head !== 'form') continue
  verbCount++

  // Scan form for keyword :examples and :name
  let name = '<unknown>'
  for (let i = 1; i < form.length - 1; i++) {
    const kw = form[i]
    if (kw instanceof Sym && kw.name === ':name') {
      const nx = form[i + 1]
      if (typeof nx === 'string') name = nx
    }
  }

  for (let i = 1; i < form.length - 1; i++) {
    const kw = form[i]
    if (!(kw instanceof Sym) || kw.name !== ':examples') continue
    const list = form[i + 1]
    if (!Array.isArray(list)) continue
    for (const example of list) {
      if (!Array.isArray(example)) continue
      // Example is a plist like (:dialect "motoi" :tier "novice" :code "..." :note "...")
      let code = null
      let tier = null
      let dialect = null
      for (let j = 0; j < example.length - 1; j++) {
        const k = example[j]
        if (!(k instanceof Sym)) continue
        const v = example[j + 1]
        if (k.name === ':code' && typeof v === 'string') code = v
        else if (k.name === ':tier' && typeof v === 'string') tier = v
        else if (k.name === ':dialect' && typeof v === 'string') dialect = v
      }
      if (code) examples.push({ verb: name, tier, dialect, code })
    }
  }
}

process.stderr.write(`verb forms: ${verbCount}\n`)
process.stderr.write(`examples extracted: ${examples.length}\n`)

for (const e of examples) process.stdout.write(JSON.stringify(e) + '\n')
