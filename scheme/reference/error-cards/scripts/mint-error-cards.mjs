#!/usr/bin/env node
// mint-error-cards.mjs — the system for the production of more error cards.
//
// An error card teaches ONE coordinate of the census: the stable normalized-key
// that normalizeError (lib/system/verb-stats.js) maps a thrown thing to. This
// script surfaces coordinates that HAVE NO CARD YET and scaffolds a provisional
// stub for each, so a human (or the model) can fill the teaching and flip it to
// :status "real".
//
// Two sources of candidate keys:
//   1. ROSTER  — the static family keys in _ERR_FAMILIES (verb-stats.js). These
//      exist whether or not anything has thrown them yet.
//   2. CENSUS  — the keys the live census has actually recorded, read from
//      ~/.motoi/stats.slat (override with MOTOI_STATS_PATH). These are observed.
//
// A key is CARDED if some *.slatl in this directory carries `:key "<that key>"`.
// The MANIFEST's :roster-coverage may also delegate a roster key to an umbrella
// card (e.g. roster-not-observed covers seven reserved keys, expand-and-reader-
// time covers the reader/expand roster); such keys are treated as covered.
//
// Usage:
//   node scripts/mint-error-cards.mjs           # report gaps + write stubs
//   node scripts/mint-error-cards.mjs --dry-run # report only, write nothing
//
// Never deletes. Never overwrites an existing card. Stubs are :status
// "provisional" and must be authored before they teach.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CARDS_DIR = path.resolve(__dirname, '..')            // scheme/reference/error-cards
const REPO_ROOT = path.resolve(CARDS_DIR, '..', '..', '..') // motoi-scheme
const VERB_STATS = path.join(REPO_ROOT, 'lib', 'system', 'verb-stats.js')
const STATS_PATH = process.env.MOTOI_STATS_PATH
  || path.join(os.homedir(), '.motoi', 'stats.slat')

const DRY_RUN = process.argv.includes('--dry-run')

// ── key -> filename (mirror SCHEMA.slat: ':' becomes '-') ──────────────────
const keyToFile = (key) => key.replace(/:/g, '-') + '.slatl'

// ── source 1: the static family roster in verb-stats.js ────────────────────
function readRoster() {
  const src = readFileSync(VERB_STATS, 'utf8')
  const block = src.match(/_ERR_FAMILIES\s*=\s*\[([\s\S]*?)\n\]/)
  if (!block) throw new Error('could not find _ERR_FAMILIES in ' + VERB_STATS)
  // each entry ends with a quoted key: [/regex/, 'key'],
  const keys = [...block[1].matchAll(/,\s*'([^']+)'\s*\]/g)].map((m) => m[1])
  if (keys.length === 0) throw new Error('parsed zero roster keys — regex drift?')
  return keys
}

// ── source 2: the live census keys ─────────────────────────────────────────
function readCensusKeys() {
  if (!existsSync(STATS_PATH)) return []
  let text
  try { text = readFileSync(STATS_PATH, 'utf8') } catch { return [] }
  const ec = text.match(/\(error-counts([\s\S]*?)\n\)/)
  if (!ec) return []
  return [...ec[1].matchAll(/\(:key\s+"([^"]*)"/g)].map((m) => m[1])
}

// ── which keys already have a card (direct :key, or MANIFEST coverage) ─────
function readCardedKeys() {
  const carded = new Set()
  for (const f of readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.slatl')) continue
    const text = readFileSync(path.join(CARDS_DIR, f), 'utf8')
    // the card's own key
    const own = text.match(/\(error-card\s+:key\s+"([^"]*)"/)
    if (own) carded.add(own[1])
    // umbrella cards enumerate the roster keys they cover in :reserved-keys /
    // :observed-catalogue via (:key "..." ...) — count those as covered too.
    for (const m of text.matchAll(/\(:key\s+"([^"]*)"/g)) carded.add(m[1])
  }
  // the MANIFEST's :roster-coverage ledger is authoritative for delegation
  const manifest = path.join(CARDS_DIR, 'MANIFEST.slat')
  if (existsSync(manifest)) {
    const t = readFileSync(manifest, 'utf8')
    const cov = t.match(/:roster-coverage\s*\(([\s\S]*?)\)\s*\)\s*$/m)
    const scope = cov ? cov[1] : t
    for (const m of scope.matchAll(/\(:key\s+"([^"]*)"\s+:covered-by\s+"([^"]*)"/g)) {
      carded.add(m[1])
    }
  }
  return carded
}

// ── stub scaffolding ────────────────────────────────────────────────────────
function stub(key) {
  const today = new Date().toISOString().slice(0, 10)
  return `;;; ${keyToFile(key)} — Motoi Scheme Reference · error-cards
;;; PROVISIONAL STUB minted ${today} by scripts/mint-error-cards.mjs.
;;; Fill :trigger-code / :observed-output (verify with ./bin/motoi run),
;;; :meaning, :fix-shape, :lesson — then flip :status to "real".

(dialect :applies ("motoi") :note "error-card — PROVISIONAL, needs authoring")

(error-card :key "${key}"
  :name "TODO — short human title for ${key}"
  :family "TODO — one of: language leaky-host reader-time expand-time sandbox silent-non-error"
  :census-status "TODO — counted-real | counted-via-collision | roster-only-not-observed | *-uncounted"
  :library "error-cards"
  :training-eligible #t
  :confidentiality "public"
  :provenance "scheme/reference/error-cards/${keyToFile(key)}"
  :status "provisional"

  :trigger-code   "TODO — a minimal program; VERIFY it reproduces :observed-output"
  :observed-output "TODO — exact bytes Motoi prints, verbatim"
  :normalizes-to  "${key}"

  :meaning   "TODO — what this failure MEANS, honest, 1-3 paragraphs."
  :fix-shape "TODO — the class of repair."
  :lesson    "TODO — the transferable lesson.")
`
}

// ── run ─────────────────────────────────────────────────────────────────────
const roster = readRoster()
const census = readCensusKeys()
const carded = readCardedKeys()

const candidates = new Map() // key -> Set of sources
for (const k of roster) (candidates.get(k) || candidates.set(k, new Set()).get(k)).add('roster')
for (const k of census) (candidates.get(k) || candidates.set(k, new Set()).get(k)).add('census')

const gaps = [...candidates.entries()].filter(([k]) => !carded.has(k))

console.log('error-card mint —', new Date().toISOString())
console.log('  roster keys :', roster.length)
console.log('  census keys :', census.length, existsSync(STATS_PATH) ? `(from ${STATS_PATH})` : '(no stats.slat yet)')
console.log('  carded keys :', carded.size)
console.log('  gaps        :', gaps.length)

if (gaps.length === 0) {
  console.log('\nAll roster + census coordinates are carded. Nothing to mint.')
  process.exit(0)
}

let written = 0
for (const [key, sources] of gaps) {
  const file = path.join(CARDS_DIR, keyToFile(key))
  const tag = `[${[...sources].join('+')}]`
  if (existsSync(file)) {
    console.log(`  skip (exists) ${tag} ${key}`)
    continue
  }
  if (DRY_RUN) {
    console.log(`  would mint    ${tag} ${key} -> ${keyToFile(key)}`)
  } else {
    writeFileSync(file, stub(key))
    console.log(`  minted        ${tag} ${key} -> ${keyToFile(key)}`)
    written++
  }
}

if (!DRY_RUN && written > 0) {
  console.log(`\nMinted ${written} provisional stub(s). Author each, then:`)
  console.log('  1. add a :cards row + :roster-coverage entry in MANIFEST.slat')
  console.log('  2. add a :nav row in README.slatl')
  console.log('  3. flip :status "provisional" -> "real" once :meaning/:fix-shape/:lesson are written + :trigger-code is verified')
}
