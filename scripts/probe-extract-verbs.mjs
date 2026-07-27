#!/usr/bin/env node
// probe-extract-verbs.mjs — Extract verb records from Scheme/reference/*.slat.
//
// Emits:
//   verbs.jsonl   — one {verb, library, signature, summary} per line
//   prompts.jsonl — 3 probe prompts per verb (recall, signature, use)
//
// Fields parsed per verb record: :name, :library, :signature, :summary.
// Mechanical only — no LLM paraphrase.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const REF_DIR = '/Users/alfred/code/motoi-scheme/Scheme/reference'
const OUT_DIR = '/Users/alfred/.forge/runs/motoi-mk1/probe-per-verb'
mkdirSync(OUT_DIR, { recursive: true })

const VERBS_OUT = join(OUT_DIR, 'verbs.jsonl')
const PROMPTS_OUT = join(OUT_DIR, 'prompts.jsonl')

// Extract complete top-level (verb ...) forms. Balanced-paren scan.
function extractVerbForms(text) {
  const forms = []
  const N = text.length
  let i = 0
  while (i < N) {
    // find next "(verb\n" or "(verb " or "(verb\r" at column 0
    const idx = text.indexOf('(verb', i)
    if (idx === -1) break
    // must be at start-of-line
    const bol = idx === 0 || text[idx - 1] === '\n'
    if (!bol) { i = idx + 1; continue }
    // ensure next char after "verb" is whitespace
    const c = text[idx + 5]
    if (c !== ' ' && c !== '\n' && c !== '\t' && c !== '\r') { i = idx + 1; continue }
    // balanced-paren scan, respecting strings + line comments
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

// Parse a single string field: `:key "value with \" escapes"`
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

// Sentence-1 short summary. Strip trailing punctuation; lowercase first char.
function shortSummary(summary) {
  if (!summary) return ''
  // First sentence end at ". " or ".\n" or end of string
  let end = summary.length
  for (let i = 0; i < summary.length - 1; i++) {
    if (summary[i] === '.' && (summary[i + 1] === ' ' || summary[i + 1] === '\n')) {
      end = i
      break
    }
  }
  if (summary[end] === '.') { /* already at period */ }
  else if (end === summary.length && summary.endsWith('.')) end = summary.length - 1
  let s = summary.slice(0, end).trim().replace(/[.!?]+$/, '')
  if (s.length === 0) return ''
  return s.charAt(0).toLowerCase() + s.slice(1)
}

function main() {
  const files = readdirSync(REF_DIR).filter(f => f.endsWith('.slat')).sort()
  const allVerbs = []
  const perChapter = {}

  for (const f of files) {
    const path = join(REF_DIR, f)
    const text = readFileSync(path, 'utf8')
    const forms = extractVerbForms(text)
    for (const form of forms) {
      const name = parseStringField(form, 'name')
      const library = parseStringField(form, 'library')
      const signature = parseStringField(form, 'signature')
      const summary = parseStringField(form, 'summary')
      if (!name) continue
      // skip records that are :library-declaration or non-verb wrappers
      allVerbs.push({ verb: name, library: library || 'unknown', signature: signature || '', summary: summary || '', _source: f })
    }
    if (forms.length > 0) perChapter[f] = forms.length
  }

  console.log(`Extracted ${allVerbs.length} verb records from ${Object.keys(perChapter).length} chapters`)

  // Dedup on (verb, library, signature). Only strip byte-for-byte duplicates
  // (should be ~zero — reference has one row per (library, verb)).
  const seen = new Set()
  const uniqueVerbs = []
  for (const v of allVerbs) {
    const k = `${v.library}::${v.verb}::${v.signature}`
    if (seen.has(k)) continue
    seen.add(k)
    uniqueVerbs.push(v)
  }
  console.log(`Unique (library, verb, signature) records: ${uniqueVerbs.length}`)

  // Write verbs.jsonl
  const vLines = uniqueVerbs.map(v => JSON.stringify({
    verb: v.verb, library: v.library, signature: v.signature, summary: v.summary,
  }))
  writeFileSync(VERBS_OUT, vLines.join('\n') + '\n')
  console.log(`Wrote ${VERBS_OUT} (${uniqueVerbs.length} verbs)`)

  // Compose 3 prompts per verb
  const promptLines = []
  let idx = 0
  for (const v of uniqueVerbs) {
    const short = shortSummary(v.summary)
    // Recall
    promptLines.push(JSON.stringify({
      id: `p${idx++}`,
      verb: v.verb,
      library: v.library,
      shape: 'recall',
      prompt: `What verb does ${short}? Respond with just the verb name.`,
      expected_verb: v.verb,
    }))
    // Signature
    promptLines.push(JSON.stringify({
      id: `p${idx++}`,
      verb: v.verb,
      library: v.library,
      shape: 'signature',
      prompt: `What is the signature of ${v.verb}?`,
      expected_signature: v.signature,
    }))
    // Use
    promptLines.push(JSON.stringify({
      id: `p${idx++}`,
      verb: v.verb,
      library: v.library,
      shape: 'use',
      prompt: `Show one line of Scheme code that calls ${v.verb} correctly.`,
      expected_verb: v.verb,
    }))
  }
  writeFileSync(PROMPTS_OUT, promptLines.join('\n') + '\n')
  console.log(`Wrote ${PROMPTS_OUT} (${promptLines.length} prompts, 3 per verb)`)

  // Per-chapter summary
  console.log('\nPer-chapter verb counts:')
  for (const [f, n] of Object.entries(perChapter).sort()) {
    console.log(`  ${f}: ${n}`)
  }
}

main()
