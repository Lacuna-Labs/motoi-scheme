#!/usr/bin/env node
// probe-explanation-extract.mjs — Sample 100 verbs (stratified, seed 67)
// and author 5 fresh-phrasing prompts per verb (500 total) for the
// explanation-axis probe.
//
// Emits:
//   ~/.forge/runs/motoi-mk1/probe-explanation/verbs.jsonl   (100 rows)
//   ~/.forge/runs/motoi-mk1/probe-explanation/prompts.jsonl (500 rows)
//
// Stratification (per Marcus task-brief):
//   25 from `core`
//   15 spread across `ai` + `world` + `entity` + `game`
//   10 from math/geom/curve
//   15 from audio/animation/motion
//   10 obscure long-tail (libraries with the fewest verbs)
//   25 random from remainder
//
// Seed 67, deterministic Mulberry32 PRNG.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const REF_DIR = '/Users/alfred/code/motoi-scheme/Scheme/reference'
const OUT_DIR = '/Users/alfred/.forge/runs/motoi-mk1/probe-explanation'
mkdirSync(OUT_DIR, { recursive: true })

const VERBS_OUT = join(OUT_DIR, 'verbs.jsonl')
const PROMPTS_OUT = join(OUT_DIR, 'prompts.jsonl')

// ── deterministic PRNG (Mulberry32) ────────────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle(arr, rand) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function sampleN(arr, n, rand) {
  return shuffle(arr, rand).slice(0, Math.min(n, arr.length))
}

// ── SLAT parsing ───────────────────────────────────────────────────

function extractVerbForms(text) {
  const forms = []
  const N = text.length
  let i = 0
  while (i < N) {
    const idx = text.indexOf('(verb', i)
    if (idx === -1) break
    const bol = idx === 0 || text[idx - 1] === '\n'
    if (!bol) { i = idx + 1; continue }
    const c = text[idx + 5]
    if (c !== ' ' && c !== '\n' && c !== '\t' && c !== '\r') { i = idx + 1; continue }
    let depth = 0
    let j = idx
    let inStr = false
    let strEsc = false
    let inLineComment = false
    for (; j < N; j++) {
      const ch = text[j]
      if (inLineComment) { if (ch === '\n') inLineComment = false; continue }
      if (inStr) {
        if (strEsc) { strEsc = false; continue }
        if (ch === '\\') { strEsc = true; continue }
        if (ch === '"') { inStr = false; continue }
        continue
      }
      if (ch === '"') { inStr = true; continue }
      if (ch === ';') { inLineComment = true; continue }
      if (ch === '(') depth++
      else if (ch === ')') { depth--; if (depth === 0) { j++; break } }
    }
    if (depth === 0) forms.push(text.slice(idx, j))
    i = j
  }
  return forms
}

function parseStringField(form, key) {
  const re = new RegExp(`:${key}\\s+"`, '')
  const m = form.match(re)
  if (!m) return null
  const start = m.index + m[0].length
  let out = ''
  let esc = false
  for (let i = start; i < form.length; i++) {
    const ch = form[i]
    if (esc) { out += ch; esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') return out
    out += ch
  }
  return null
}

// Parse a list of strings inside `:key ("a" "b" "c")`
function parseStringList(form, key) {
  const re = new RegExp(`:${key}\\s+\\(`, '')
  const m = form.match(re)
  if (!m) return []
  const start = m.index + m[0].length
  const out = []
  let i = start
  let depth = 1
  while (i < form.length && depth > 0) {
    const ch = form[i]
    if (ch === '"') {
      let s = ''
      let esc = false
      i++
      while (i < form.length) {
        const c = form[i]
        if (esc) { s += c; esc = false; i++; continue }
        if (c === '\\') { esc = true; i++; continue }
        if (c === '"') { i++; break }
        s += c
        i++
      }
      out.push(s)
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth === 0) break }
    i++
  }
  return out
}

// Parse :examples ( (:dialect ... :code "..." :note "..." ) ... )
// Return [{code, note}]
function parseExamples(form) {
  const re = /:examples\s+\(/
  const m = form.match(re)
  if (!m) return []
  const start = m.index + m[0].length
  const out = []
  let i = start
  let depth = 1 // we already consumed the outer '('
  while (i < form.length && depth > 0) {
    const ch = form[i]
    // find nested example plist: `(:dialect ...)`
    if (ch === '(') {
      // scan this example
      let j = i + 1
      let d2 = 1
      let inStr = false
      let esc = false
      const startExample = i
      while (j < form.length && d2 > 0) {
        const c = form[j]
        if (inStr) {
          if (esc) { esc = false; j++; continue }
          if (c === '\\') { esc = true; j++; continue }
          if (c === '"') { inStr = false; j++; continue }
          j++
          continue
        }
        if (c === '"') { inStr = true; j++; continue }
        if (c === '(') d2++
        else if (c === ')') d2--
        j++
      }
      const exBody = form.slice(startExample, j)
      const code = parseStringField(exBody, 'code')
      const note = parseStringField(exBody, 'note')
      if (code || note) out.push({ code: code || '', note: note || '' })
      i = j
      continue
    }
    if (ch === ')') { depth--; if (depth === 0) break }
    i++
  }
  return out
}

function loadAllVerbs() {
  const files = readdirSync(REF_DIR).filter(f => f.endsWith('.slat')).sort()
  const all = []
  for (const f of files) {
    const path = join(REF_DIR, f)
    const text = readFileSync(path, 'utf8')
    const forms = extractVerbForms(text)
    for (const form of forms) {
      const name = parseStringField(form, 'name')
      const library = parseStringField(form, 'library')
      if (!name) continue
      const signature = parseStringField(form, 'signature')
      const summary = parseStringField(form, 'summary')
      const related = parseStringList(form, 'related')
      const examples = parseExamples(form)
      all.push({
        verb: name,
        library: library || 'unknown',
        signature: signature || '',
        summary: summary || '',
        related,
        examples,
        _source: f,
      })
    }
  }
  return all
}

// ── stratified sampling ────────────────────────────────────────────

function stratifiedSample(allVerbs, rand) {
  // Group by library
  const byLib = new Map()
  for (const v of allVerbs) {
    if (!byLib.has(v.library)) byLib.set(v.library, [])
    byLib.get(v.library).push(v)
  }

  const chosen = []
  const takenIds = new Set()
  const takeFromLibs = (libs, n) => {
    // Concatenate all matching-lib verbs, shuffle, take n that haven't been taken
    const pool = []
    for (const lib of libs) {
      const arr = byLib.get(lib)
      if (arr) pool.push(...arr)
    }
    const shuffled = shuffle(pool, rand)
    const out = []
    for (const v of shuffled) {
      const id = `${v.library}::${v.verb}`
      if (takenIds.has(id)) continue
      takenIds.add(id)
      out.push(v)
      if (out.length >= n) break
    }
    return out
  }

  // 25 from core
  const core = takeFromLibs(['core'], 25)
  chosen.push(...core.map(v => ({ ...v, _bucket: 'core' })))

  // 15 spread across ai/world/entity/game
  const aiEtc = takeFromLibs(['ai', 'world', 'entity', 'game'], 15)
  chosen.push(...aiEtc.map(v => ({ ...v, _bucket: 'ai-world-entity-game' })))

  // 10 from math/geom/curve
  const mgc = takeFromLibs(['math', 'geom', 'curve'], 10)
  chosen.push(...mgc.map(v => ({ ...v, _bucket: 'math-geom-curve' })))

  // 15 from audio/animation/motion
  const anim = takeFromLibs(['audio', 'animation', 'motion'], 15)
  chosen.push(...anim.map(v => ({ ...v, _bucket: 'audio-animation-motion' })))

  // 10 obscure long-tail: libraries with the FEWEST verbs (bottom third)
  const libCounts = [...byLib.entries()].map(([lib, arr]) => ({ lib, n: arr.length }))
  libCounts.sort((a, b) => a.n - b.n)
  const longTailLibs = libCounts.slice(0, Math.max(15, Math.floor(libCounts.length / 3))).map(x => x.lib)
  const longtail = takeFromLibs(longTailLibs, 10)
  chosen.push(...longtail.map(v => ({ ...v, _bucket: 'long-tail' })))

  // 25 random from ALL remaining
  const remaining = allVerbs.filter(v => !takenIds.has(`${v.library}::${v.verb}`))
  const rand25 = sampleN(remaining, 25, rand)
  chosen.push(...rand25.map(v => ({ ...v, _bucket: 'random' })))

  return chosen
}

// ── prompt authoring (fresh phrasings, NOT the Mk1-trained shapes) ──

function authorPrompts(v, idxStart) {
  const prompts = []
  let idx = idxStart
  // Row 1 (HOW / composition) — FRESH phrasing
  prompts.push({
    id: `e${idx++}`,
    verb: v.verb,
    library: v.library,
    row: 1,
    prompt: `Give me a working code example of ${v.verb}.`,
  })
  // Row 2 (WHEN / audit) — FRESH phrasing
  prompts.push({
    id: `e${idx++}`,
    verb: v.verb,
    library: v.library,
    row: 2,
    prompt: `In what situation would I use ${v.verb} instead of another verb?`,
  })
  // Row 3 (WHERE-ELSE / dimension) — FRESH phrasing
  prompts.push({
    id: `e${idx++}`,
    verb: v.verb,
    library: v.library,
    row: 3,
    prompt: `What patterns in other domains resemble ${v.verb}?`,
  })
  // Row 4 (WHY / proof) — FRESH phrasing
  prompts.push({
    id: `e${idx++}`,
    verb: v.verb,
    library: v.library,
    row: 4,
    prompt: `What property of ${v.verb} makes it correct? Name the invariant.`,
  })
  // Row 5 (WITH-WHAT-ELSE / emergence) — FRESH phrasing
  prompts.push({
    id: `e${idx++}`,
    verb: v.verb,
    library: v.library,
    row: 5,
    prompt: `What larger pattern emerges when ${v.verb} composes with related verbs?`,
  })
  return prompts
}

function main() {
  const all = loadAllVerbs()
  console.log(`Loaded ${all.length} total verbs from ${REF_DIR}`)

  // Library distribution
  const libDist = new Map()
  for (const v of all) libDist.set(v.library, (libDist.get(v.library) || 0) + 1)
  console.log(`Libraries: ${libDist.size}`)

  const rand = mulberry32(67)
  const chosen = stratifiedSample(all, rand)
  console.log(`Sampled ${chosen.length} verbs (target 100)`)

  // Report stratification
  const bucketCounts = {}
  for (const v of chosen) bucketCounts[v._bucket] = (bucketCounts[v._bucket] || 0) + 1
  console.log('Stratification actual:')
  for (const [b, n] of Object.entries(bucketCounts).sort()) console.log(`  ${b}: ${n}`)

  // Write verbs.jsonl (full record so runner can score against summary/signature/related/examples)
  const vLines = chosen.map(v => JSON.stringify({
    verb: v.verb,
    library: v.library,
    signature: v.signature,
    summary: v.summary,
    related: v.related,
    example_notes: v.examples.map(e => e.note).filter(Boolean),
    bucket: v._bucket,
  }))
  writeFileSync(VERBS_OUT, vLines.join('\n') + '\n')
  console.log(`Wrote ${VERBS_OUT} (${chosen.length} verbs)`)

  // Write prompts.jsonl
  const promptLines = []
  let idx = 0
  for (const v of chosen) {
    const prompts = authorPrompts(v, idx)
    idx += prompts.length
    for (const p of prompts) promptLines.push(JSON.stringify(p))
  }
  writeFileSync(PROMPTS_OUT, promptLines.join('\n') + '\n')
  console.log(`Wrote ${PROMPTS_OUT} (${promptLines.length} prompts, 5 per verb)`)
}

main()
