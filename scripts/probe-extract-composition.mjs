#!/usr/bin/env node
// probe-extract-composition.mjs — Extract composition prompts from reference SLAT.
//
// For each verb V with :related [R1, R2, R3, ...]:
//   - Sample 2-4 related verbs (seeded RNG, seed=67)
//   - Take task note from V's :examples (intermediate or expert tier)
//   - Emit prompt: "Write Scheme code that uses {V} together with {R1} and {R2} to accomplish {task}."
//   - must_contain: [V, R1, R2, ...] (at least primary + one related must appear as call form)
//
// Sampling target: 200 composition prompts, tiered:
//   - 50 from Row-1 core (map filter cond let lambda define if when kick snare note
//     pixel fb/dump display book/read etc.)
//   - 50 from Row-2/3 (audio, animation, math, etc.)
//   - 100 broader corpus, proportional to library size
//
// Output: composition-prompts.jsonl at ~/.forge/runs/motoi-mk1/probe-per-verb/

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const REF_DIR = '/Users/alfred/code/motoi-scheme/Scheme/reference'
const OUT_DIR = '/Users/alfred/.forge/runs/motoi-mk1/probe-per-verb'
mkdirSync(OUT_DIR, { recursive: true })

const OUT_PATH = join(OUT_DIR, 'composition-prompts.jsonl')
const VERBS_META_PATH = join(OUT_DIR, 'composition-verbs-meta.jsonl') // extra debug

// Seeded PRNG (mulberry32) — deterministic sample selection.
function mkRng(seed) {
  let a = seed >>> 0
  return function () {
    a += 0x6D2B79F5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function sampleK(arr, k, rng) {
  if (arr.length <= k) return arr.slice()
  const idx = arr.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, k).map(i => arr[i])
}
function pickOne(arr, rng) {
  if (arr.length === 0) return null
  return arr[Math.floor(rng() * arr.length)]
}

// ── SLAT (verb ...) extraction — same logic as probe-extract-verbs.mjs ────

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
      if (inLineComment) {
        if (ch === '\n') inLineComment = false
        continue
      }
      if (inStr) {
        if (strEsc) { strEsc = false; continue }
        if (ch === '\\') { strEsc = true; continue }
        if (ch === '"') { inStr = false; continue }
        continue
      }
      if (ch === '"') { inStr = true; continue }
      if (ch === ';') { inLineComment = true; continue }
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) { j++; break }
      }
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

// Parse a list-of-strings field like:  :related ("a" "b" "c")
function parseStringListField(form, key) {
  const re = new RegExp(`:${key}\\s*\\(`, '')
  const m = form.match(re)
  if (!m) return []
  const start = m.index + m[0].length
  // scan strings until matching ')'
  const out = []
  let i = start
  let depth = 1
  while (i < form.length && depth > 0) {
    const ch = form[i]
    if (ch === '"') {
      // read a string
      let s = ''
      let esc = false
      i++
      for (; i < form.length; i++) {
        const c = form[i]
        if (esc) { s += c; esc = false; continue }
        if (c === '\\') { esc = true; continue }
        if (c === '"') { i++; break }
        s += c
      }
      out.push(s)
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) break
    }
    i++
  }
  return out
}

// Parse :examples (( ... ) ( ... ) ...) — return array of {tier, note}
function parseExamples(form) {
  // Find start of `:examples`.
  const idx = form.indexOf(':examples')
  if (idx === -1) return []
  // Skip whitespace + '('
  let i = idx + ':examples'.length
  while (i < form.length && /\s/.test(form[i])) i++
  if (form[i] !== '(') return []
  // Walk balanced-paren block that starts here. Collect immediate-child forms.
  let depth = 0
  const children = []
  let start = -1
  for (; i < form.length; i++) {
    const ch = form[i]
    if (ch === '"') {
      // skip string
      let esc = false
      i++
      for (; i < form.length; i++) {
        const c = form[i]
        if (esc) { esc = false; continue }
        if (c === '\\') { esc = true; continue }
        if (c === '"') break
      }
      continue
    }
    if (ch === ';') {
      while (i < form.length && form[i] !== '\n') i++
      continue
    }
    if (ch === '(') {
      depth++
      if (depth === 2) start = i
    } else if (ch === ')') {
      if (depth === 2 && start !== -1) children.push(form.slice(start, i + 1))
      depth--
      if (depth === 0) break
    }
  }
  // Each child is a plist starting with `(`. Extract :tier + :note.
  const out = []
  for (const c of children) {
    const tier = parseStringField(c, 'tier')
    const note = parseStringField(c, 'note')
    if (note) out.push({ tier: tier || 'novice', note })
  }
  return out
}

// ── Row tiers: which verbs are Row-1 core ──────────────────────────
//
// In Motoi's reference `core` library = engine primitives (frames, grid,
// camera, audio-primitive, animation). Row-1 core = the whole `core`
// library + a handful of universal utility libraries (list, string,
// predicate, base). This is the surface Jesse (the kid) will touch first.

const ROW1_LIBS = new Set([
  'core', 'list', 'string', 'predicate', 'base',
])

// Row-2/3 libraries — audio/animation/math surface (deeper generative + numeric).
const ROW23_LIBS = new Set([
  'audio', 'beat', 'animation', 'calc', 'math', 'trig', 'complex',
  'alg', 'chem', 'geom', 'collision', 'curve', 'phys', 'vec', 'matrix',
  'linalg', 'stat', 'nt', 'topo', 'exact', 'part', 'complex',
])

// Individual verb allowlist that's still Row-1 (canonical Scheme fallbacks).
const ROW1_VERB_ALLOWLIST = new Set([
  'map', 'filter', 'fold', 'reduce', 'for-each', 'cond', 'case', 'let',
  'let*', 'letrec', 'lambda', 'define', 'if', 'when', 'unless', 'begin',
  'and', 'or', 'not', 'quote', 'set!', 'car', 'cdr', 'cons', 'list',
  'append', 'length', 'null?', 'pair?', 'eq?', 'equal?', 'display',
  'newline', 'write', 'note', 'kick', 'snare', 'pixel', 'book/read',
])

// ── Task-text extraction ─────────────────────────────────────────────

function pickTaskNote(examples, rng) {
  // Prefer intermediate or expert tier; fallback to any.
  const midOrHigh = examples.filter(e => e.tier === 'intermediate' || e.tier === 'expert')
  const pool = midOrHigh.length > 0 ? midOrHigh : examples
  if (pool.length === 0) return null
  const pick = pickOne(pool, rng)
  return pick ? pick.note : null
}

// Trim to a natural task clause. Keep first sentence.
function shortenTask(note) {
  if (!note) return ''
  // Cut at first '. ' or '. \n'
  let end = note.length
  for (let i = 0; i < note.length - 1; i++) {
    if (note[i] === '.' && (note[i + 1] === ' ' || note[i + 1] === '\n')) {
      end = i
      break
    }
  }
  if (note.endsWith('.') && end === note.length) end = note.length - 1
  let s = note.slice(0, end).trim().replace(/[.!?]+$/, '')
  return s
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const rng = mkRng(67)

  // 1. Extract verb records
  const files = readdirSync(REF_DIR).filter(f => f.endsWith('.slat')).sort()
  const allVerbs = []
  for (const f of files) {
    const path = join(REF_DIR, f)
    const text = readFileSync(path, 'utf8')
    const forms = extractVerbForms(text)
    for (const form of forms) {
      const name = parseStringField(form, 'name')
      const library = parseStringField(form, 'library')
      if (!name) continue
      const related = parseStringListField(form, 'related')
      const examples = parseExamples(form)
      allVerbs.push({ verb: name, library: library || 'unknown', related, examples })
    }
  }
  console.log(`Extracted ${allVerbs.length} verbs total`)

  // Build a set of known verbs (for later cross-reference; not used for filtering,
  // since :related can point at verbs in any chapter).
  const knownVerbSet = new Set(allVerbs.map(v => v.verb))

  // Only keep verbs with at least one :related entry AND at least one example note.
  const eligible = allVerbs.filter(v => v.related.length > 0 && v.examples.length > 0)
  console.log(`Eligible verbs (has :related + :examples with :note): ${eligible.length}`)

  // Filter :related to only refer to verbs we've actually seen (avoid the confab risk
  // of pointing at non-existent verbs in the composition prompt itself).
  for (const v of eligible) {
    v.related = v.related.filter(r => knownVerbSet.has(r))
  }
  const eligible2 = eligible.filter(v => v.related.length > 0)
  console.log(`Eligible verbs with valid :related: ${eligible2.length}`)

  // 2. Partition into tiers
  const tier1 = eligible2.filter(v =>
    ROW1_LIBS.has(v.library) || ROW1_VERB_ALLOWLIST.has(v.verb))
  const tier1Names = new Set(tier1.map(v => v.verb))
  const tier2 = eligible2.filter(v => !tier1Names.has(v.verb) && ROW23_LIBS.has(v.library))
  const tier2Names = new Set(tier2.map(v => v.verb))
  const tier3 = eligible2.filter(v => !tier1Names.has(v.verb) && !tier2Names.has(v.verb))

  console.log(`Tier partition:`)
  console.log(`  Row-1 core (target 50):     ${tier1.length}`)
  console.log(`  Row-2/3 audio+anim+math (target 50): ${tier2.length}`)
  console.log(`  Broader corpus (target 100): ${tier3.length}`)

  // 3. Sample per tier
  //    - Row-1: 50 prompts. If we have fewer than 50 tier-1 verbs, allow revisit
  //      with a different :related sample. Otherwise sample without replacement.
  //    - Row-2/3: 50 prompts.
  //    - Broader: 100 prompts, sampled proportional to library size.
  const target1 = 50, target2 = 50, target3 = 100
  const target = target1 + target2 + target3

  const prompts = []

  function makePrompt(v, rngLocal) {
    // Choose 2-4 related verbs to include (from the verb's own :related list).
    const k = 2 + Math.floor(rngLocal() * 3) // 2, 3, or 4
    const related = sampleK(v.related, k, rngLocal)
    const task = shortenTask(pickTaskNote(v.examples, rngLocal))
    if (!task) return null
    // Compose the prompt sentence.
    let relText
    if (related.length === 1) {
      relText = `together with ${related[0]}`
    } else if (related.length === 2) {
      relText = `together with ${related[0]} and ${related[1]}`
    } else {
      const head = related.slice(0, -1).join(', ')
      const tail = related[related.length - 1]
      relText = `together with ${head}, and ${tail}`
    }
    const prompt = `Write Scheme code that uses ${v.verb} ${relText} to accomplish: ${task}.`
    const must_contain = [v.verb, ...related]
    return { primary_verb: v.verb, library: v.library, related, prompt, must_contain, task }
  }

  function drawFrom(pool, count, tierLabel) {
    // If pool has ≥ count verbs, sample without replacement (unique verbs).
    // Else, sample with replacement using different :related picks.
    const picks = []
    if (pool.length === 0) return picks
    if (pool.length >= count) {
      const shuffled = sampleK(pool, count, rng)
      for (const v of shuffled) {
        const p = makePrompt(v, rng)
        if (p) picks.push(p)
      }
    } else {
      // We'll cycle with replacement, but re-draw :related each time
      let i = 0
      let attempts = 0
      while (picks.length < count && attempts < count * 4) {
        const v = pool[i % pool.length]
        const p = makePrompt(v, rng)
        if (p) picks.push(p)
        i++
        attempts++
      }
    }
    return picks
  }

  const picks1 = drawFrom(tier1, target1, 'row1-core')
  const picks2 = drawFrom(tier2, target2, 'row2-3')

  // Tier 3: sample proportional to library size across broader corpus.
  //   Group by library, size = count of eligible verbs in that library.
  const byLib = new Map()
  for (const v of tier3) {
    if (!byLib.has(v.library)) byLib.set(v.library, [])
    byLib.get(v.library).push(v)
  }
  const libSizes = Array.from(byLib.entries()).map(([lib, arr]) => ({ lib, size: arr.length, arr }))
  const totalT3 = libSizes.reduce((a, l) => a + l.size, 0)
  const picks3 = []
  const quotas = []
  let allocated = 0
  for (const l of libSizes) {
    const q = Math.floor((l.size / totalT3) * target3)
    quotas.push({ lib: l.lib, quota: q, arr: l.arr })
    allocated += q
  }
  // Distribute leftover to largest libraries first
  quotas.sort((a, b) => b.arr.length - a.arr.length)
  let leftover = target3 - allocated
  let qi = 0
  while (leftover > 0) {
    quotas[qi % quotas.length].quota += 1
    qi++
    leftover--
  }
  for (const q of quotas) {
    const drawn = drawFrom(q.arr, q.quota, `broad-${q.lib}`)
    picks3.push(...drawn)
  }

  const all = [...picks1, ...picks2, ...picks3]
  console.log(`Picked: ${picks1.length} row-1 + ${picks2.length} row-2/3 + ${picks3.length} broad = ${all.length}`)

  // 4. Emit JSONL
  const out = []
  let n = 0
  for (const p of all) {
    const line = {
      id: `comp-${String(n).padStart(3, '0')}`,
      primary_verb: p.primary_verb,
      library: p.library,
      related: p.related,
      prompt: p.prompt,
      must_contain: p.must_contain,
      tier: n < picks1.length ? 'row1-core' : (n < picks1.length + picks2.length ? 'row2-3' : 'broad'),
    }
    out.push(JSON.stringify(line))
    n++
  }
  writeFileSync(OUT_PATH, out.join('\n') + '\n')
  console.log(`Wrote ${OUT_PATH} (${out.length} prompts)`)

  // 5. Also write verb catalog for scorer (used to detect confabulations).
  //    Every known verb name across the reference.
  const catalogLines = Array.from(knownVerbSet).sort().map(v => JSON.stringify({ verb: v }))
  const catalogPath = join(OUT_DIR, 'composition-verb-catalog.jsonl')
  writeFileSync(catalogPath, catalogLines.join('\n') + '\n')
  console.log(`Wrote ${catalogPath} (${catalogLines.length} verbs — catalog for confab detection)`)
}

main()
