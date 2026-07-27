#!/usr/bin/env node
// probe-composition-summarize.mjs — Read composition-results.jsonl and print
// summary breakdowns: overall + per-tier + per-library confabulation rates.

import { readFileSync } from 'node:fs'

const RESULTS = process.argv[2] || '/Users/alfred/.forge/runs/motoi-mk1/probe-per-verb/composition-results.jsonl'

const text = readFileSync(RESULTS, 'utf8')
const rows = text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l))

const N = rows.length
console.log(`\n=== COMPOSITION PROBE SUMMARY ===`)
console.log(`Total prompts scored: ${N}`)
if (N === 0) process.exit(0)

// Overall
const overall = { strict_pass: 0, partial_pass: 0, confabulation_fail: 0, full_fail: 0, has_confab: 0 }
for (const r of rows) {
  overall[r.category] = (overall[r.category] || 0) + 1
  if (r.has_confab) overall.has_confab++
}
console.log(`\nOverall:`)
console.log(`  strict_pass:        ${overall.strict_pass}/${N} (${pct(overall.strict_pass, N)}%)`)
console.log(`  partial_pass:       ${overall.partial_pass}/${N} (${pct(overall.partial_pass, N)}%)`)
console.log(`  confabulation_fail: ${overall.confabulation_fail}/${N} (${pct(overall.confabulation_fail, N)}%)`)
console.log(`  full_fail:          ${overall.full_fail}/${N} (${pct(overall.full_fail, N)}%)`)
console.log(`  any-confab (across all categories): ${overall.has_confab}/${N} (${pct(overall.has_confab, N)}%)`)

// Per tier
const tiers = {}
for (const r of rows) {
  const t = r.tier || 'unknown'
  if (!tiers[t]) tiers[t] = { strict_pass: 0, partial_pass: 0, confabulation_fail: 0, full_fail: 0, has_confab: 0, n: 0 }
  tiers[t][r.category] = (tiers[t][r.category] || 0) + 1
  tiers[t].n++
  if (r.has_confab) tiers[t].has_confab++
}
console.log(`\nPer tier:`)
for (const [tier, s] of Object.entries(tiers)) {
  console.log(`  ${tier} (n=${s.n}): strict=${s.strict_pass} (${pct(s.strict_pass, s.n)}%) · partial=${s.partial_pass} (${pct(s.partial_pass, s.n)}%) · confab=${s.confabulation_fail} (${pct(s.confabulation_fail, s.n)}%) · fail=${s.full_fail} (${pct(s.full_fail, s.n)}%) · any-confab=${s.has_confab} (${pct(s.has_confab, s.n)}%)`)
}

// Per library (top by count, and top by confab rate)
const libs = {}
for (const r of rows) {
  const l = r.library || 'unknown'
  if (!libs[l]) libs[l] = { strict_pass: 0, partial_pass: 0, confabulation_fail: 0, full_fail: 0, has_confab: 0, n: 0 }
  libs[l][r.category] = (libs[l][r.category] || 0) + 1
  libs[l].n++
  if (r.has_confab) libs[l].has_confab++
}
const libEntries = Object.entries(libs).map(([lib, s]) => ({
  lib, ...s,
  strictRate: s.strict_pass / s.n,
  anyConfabRate: s.has_confab / s.n,
}))

// Confab spotlight: libraries with ≥ 3 samples, sorted by any-confab rate desc.
const confabTop = libEntries.filter(l => l.n >= 3).sort((a, b) => b.anyConfabRate - a.anyConfabRate).slice(0, 12)
console.log(`\nTop 12 libraries by any-confab rate (n≥3):`)
for (const l of confabTop) {
  console.log(`  ${l.lib.padEnd(20)} n=${String(l.n).padStart(3)} · any-confab=${l.has_confab}/${l.n} (${pct(l.has_confab, l.n)}%) · strict=${l.strict_pass}/${l.n} (${pct(l.strict_pass, l.n)}%)`)
}

// Bottom 12 (best behaving) — libraries with ≥ 3 samples, lowest confab
const confabBot = libEntries.filter(l => l.n >= 3).sort((a, b) => a.anyConfabRate - b.anyConfabRate).slice(0, 12)
console.log(`\nBottom 12 libraries by any-confab rate (n≥3, best-behaving):`)
for (const l of confabBot) {
  console.log(`  ${l.lib.padEnd(20)} n=${String(l.n).padStart(3)} · any-confab=${l.has_confab}/${l.n} (${pct(l.has_confab, l.n)}%) · strict=${l.strict_pass}/${l.n} (${pct(l.strict_pass, l.n)}%)`)
}

// Most-confabulated verb names — count occurrences across all responses.
const confabTokenCounts = new Map()
for (const r of rows) {
  for (const v of (r.confabulated_verbs || [])) {
    confabTokenCounts.set(v, (confabTokenCounts.get(v) || 0) + 1)
  }
}
const topConfabTokens = Array.from(confabTokenCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15)
console.log(`\nTop 15 invented (confabulated) verb tokens:`)
for (const [tok, count] of topConfabTokens) {
  console.log(`  ${tok.padEnd(30)} × ${count}`)
}

function pct(a, b) {
  if (b === 0) return '0.0'
  return ((a / b) * 100).toFixed(1)
}
