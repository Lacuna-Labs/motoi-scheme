#!/usr/bin/env node
// Architect: sample-check book code examples.
// Extracts fenced-code blocks from all .slat files under scheme-books/,
// picks a random N, and runs each through `bin/motoi eval`.
// Reports pass/fail with error snippets.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const SAMPLE_SIZE = parseInt(process.argv[2] || '50', 10)
const ROOT = '/Users/alfred/code/motoi-scheme/scheme-books'
const MOTOI = '/Users/alfred/code/motoi-scheme/bin/motoi'

function walkSlat(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walkSlat(p, out)
    else if (name.endsWith('.slat')) out.push(p)
  }
  return out
}

// Extract fenced code inside :prose "..." (escaped) strings, plus top-level
// (example :code "...") shapes if any.
function extractExamples(text, path) {
  const examples = []

  // Fenced code inside triple-quoted or escaped-quoted :prose. Simplest:
  // look for ``` ... ``` anywhere in file (works for both raw multiline and
  // escaped forms since \n is literal newline in js string).
  const fenceRe = /```(?:scheme|motoi|sakura)?\s*\n([\s\S]*?)```/g
  let m
  while ((m = fenceRe.exec(text)) !== null) {
    let code = m[1].trim()
    // Strip trailing comment-comment result lines like ";; -> 3"
    code = code.split('\n').filter(l => !/^\s*;;\s*->/.test(l)).join('\n').trim()
    // Unescape \" -> "  since prose is inside slat strings
    code = code.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
    if (code.length === 0) continue
    if (code.length > 500) continue // skip huge blocks
    examples.push({ path, code })
  }
  return examples
}

const files = walkSlat(ROOT)
console.error(`architect: scanning ${files.length} slat files`)

const all = []
for (const f of files) {
  const t = readFileSync(f, 'utf8')
  all.push(...extractExamples(t, f))
}
console.error(`architect: found ${all.length} code examples`)

// Deterministic-ish sample: shuffle with seeded RNG
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const rng = mulberry32(Date.now() & 0xffff)
const shuffled = all.map(v => [rng(), v]).sort((a,b) => a[0]-b[0]).map(a => a[1])
const sample = shuffled.slice(0, SAMPLE_SIZE)

let pass = 0, fail = 0
const failures = []
for (const ex of sample) {
  // Skip fragments containing literal `...` — pedagogical placeholder
  if (/\.\.\./.test(ex.code)) { continue }
  const r = spawnSync(MOTOI, ['eval', ex.code], { timeout: 5000, encoding: 'utf8' })
  const stderr = (r.stderr || '').trim()
  const stdout = (r.stdout || '').trim()
  // A REAL bug: exit code != 0 OR stderr contains "error:" (motoi's convention)
  // Legit returns like (error ...) as a value are fine — they appear in stdout,
  // not stderr, and don't cause exit != 0.
  const realErr = r.status !== 0 || /^error:/m.test(stderr) || /unbound symbol/.test(stderr) || /undefined verb/.test(stderr)
  if (!realErr) pass++
  else {
    fail++
    failures.push({
      path: ex.path.replace('/Users/alfred/code/motoi-scheme/', ''),
      code: ex.code.length > 200 ? ex.code.slice(0,200)+'...' : ex.code,
      err: (stderr || stdout).slice(0, 400)
    })
  }
}

console.log(`\narchitect-sample-examples RESULT: ${pass}/${sample.length} pass`)
if (failures.length) {
  console.log(`\n=== FAILURES (first 15) ===`)
  for (const f of failures.slice(0, 15)) {
    console.log(`\n[${f.path}]`)
    console.log(`  code: ${f.code}`)
    console.log(`  err:  ${f.err}`)
  }
}
