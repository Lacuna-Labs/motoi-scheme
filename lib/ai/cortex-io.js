// cortex-io.js — cortex/read + cortex/write per Alfred (2026-07-16).
//
// Doctrine: SLAT file at `~/motoi/cortex.slat`. Simple key/value
// alist stored as SLAT. Read returns the value (or #f if missing);
// write appends/updates.

import { Sym } from '../../src/reader.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { userCortexPath } from '../../src/paths.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

const CORTEX_PATH = userCortexPath()

function ensureDir() {
  try {
    const d = dirname(CORTEX_PATH)
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
  } catch { /* soft-fail */ }
}

// Very simple line-per-entry format. Each line: (key value-json).
function readStore() {
  const map = new Map()
  try {
    if (!existsSync(CORTEX_PATH)) return map
    const src = readFileSync(CORTEX_PATH, 'utf8')
    for (const line of src.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith(';;')) continue
      const m = t.match(/^\(([^\s()]+)\s+(.*)\)\s*$/)
      if (!m) continue
      try {
        const k = m[1]
        const v = JSON.parse(m[2])
        map.set(k, v)
      } catch { /* skip malformed */ }
    }
  } catch { /* soft-fail — empty map */ }
  return map
}

function writeStore(map) {
  try {
    ensureDir()
    const lines = [';; motoi cortex — auto-generated, do not edit by hand']
    for (const [k, v] of map) {
      lines.push(`(${k} ${JSON.stringify(v)})`)
    }
    writeFileSync(CORTEX_PATH, lines.join('\n') + '\n', 'utf8')
    return true
  } catch { return false }
}

export function installCortexIO(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (cortex/read key) → value or #f.
  def('cortex/read', (key) => {
    const k = String(nm(key))
    const map = readStore()
    return map.has(k) ? map.get(k) : false
  })

  // Normalize a value: unwrap Syms to strings, recurse into arrays/objects.
  // BUG (Zane-2, 2026-07-17): moved above cortex/write so we can reuse it
  // for RECURSIVE Sym unwrapping. Previously cortex/write only unwrapped
  // top-level Syms; nested Syms serialized as {"name":"..."} plain objects
  // and silently lost their Sym-ness on read-back — a data-shape corruption
  // bug for anyone storing alists like ((:kind sprite) (:pos (1 2 3))).
  const norm = (v) => {
    if (v instanceof Sym) return v.name
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === 'object') {
      const out = {}
      for (const k of Object.keys(v)) out[k] = norm(v[k])
      return out
    }
    return v
  }

  // (cortex/write key value) → boolean.
  def('cortex/write', (key, value) => {
    const k = String(nm(key))
    const map = readStore()
    // Recursively normalize so nested Syms unwrap correctly (previously
    // only the top-level Sym unwrapped).
    map.set(k, norm(value))
    return writeStore(map)
  }, 'paint')

  // Parse keyword-arg style: (:key1 val1 :key2 val2 …) → { key1: val1, … }
  // Keywords are Syms whose name starts with ':' or a plain :sym literal.
  const kwargsToObj = (args) => {
    const out = {}
    for (let i = 0; i + 1 < args.length; i += 2) {
      const kRaw = args[i]
      const kName = kRaw instanceof Sym ? kRaw.name : String(kRaw)
      const key = kName.startsWith(':') ? kName.slice(1) : kName
      out[key] = norm(args[i + 1])
    }
    return out
  }

  // (cortex/record :key val :key val …) → boolean.
  // Appends a keyword-arg record to the store's :records collection.
  // Model queries it later with matching :key val pairs.
  def('cortex/record', (...args) => {
    const map = readStore()
    const records = Array.isArray(map.get('__records__')) ? map.get('__records__') : []
    const rec = { ts: Date.now(), data: kwargsToObj(args) }
    records.push(rec)
    map.set('__records__', records)
    return writeStore(map)
  }, 'paint')

  // (cortex/query :key val :key val …) → list of matching records' data.
  // Every :key val in the query must match on the record.
  // Empty query returns all records.
  def('cortex/query', (...args) => {
    const map = readStore()
    const records = Array.isArray(map.get('__records__')) ? map.get('__records__') : []
    if (args.length === 0) return records.map(r => r.data)
    const filter = kwargsToObj(args)
    return records
      .filter(r => r && r.data && typeof r.data === 'object')
      .filter(r => Object.entries(filter).every(([k, v]) => r.data[k] === v))
      .map(r => r.data)
  })

  return env
}

export default installCortexIO
