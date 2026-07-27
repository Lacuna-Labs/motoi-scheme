#!/usr/bin/env node
// probe-corpus-coverage.mjs — Count corpus mentions per verb.
//
// Reads:
//   ~/.forge/corpus/motoi-mk1/train.jsonl
//   ~/.forge/runs/motoi-mk1/probe-per-verb/verbs.jsonl
//
// Emits:
//   ~/.forge/runs/motoi-mk1/probe-per-verb/corpus-coverage.jsonl
//   ~/.forge/runs/motoi-mk1/probe-per-verb/corpus-coverage-summary.md
//
// Match: whole word, CASE-SENSITIVE (verbs are case-sensitive symbols).
// Search both messages[].content (user + assistant) and any `_meta` fields.

import { readFileSync, writeFileSync, createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const CORPUS = process.env.CORPUS_PATH || '/Users/alfred/.forge/corpus/motoi-mk1/train.jsonl'
const VERBS = process.env.VERBS_PATH || '/Users/alfred/.forge/runs/motoi-mk1/probe-per-verb/verbs.jsonl'
const OUT = process.env.OUT_PATH || '/Users/alfred/.forge/runs/motoi-mk1/probe-per-verb/corpus-coverage.jsonl'
const SUMMARY = process.env.SUMMARY_PATH || '/Users/alfred/.forge/runs/motoi-mk1/probe-per-verb/corpus-coverage-summary.md'

async function main() {
  // Load verbs
  const verbText = readFileSync(VERBS, 'utf8')
  const verbs = verbText.split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
  console.log(`Loaded ${verbs.length} verbs`)

  // Build one big regex per verb (whole-word, case-sensitive) — but 1,079 regexes
  // per row is slow. Faster: tokenize each row, build a Set, check each verb once.
  // Verbs contain hyphens/slashes/? etc; whole-word means bounded by
  // non-[a-zA-Z0-9_-] chars. So tokenize into runs of [\w-] (letters, digits, _, -).
  // But verbs may contain `/`, `?`, `!`, `*`. We need a broader token pattern.
  // Verb chars observed: letters, digits, -, /, ?, !, *, _, ., +, <, >, =.
  // Use \S runs, but that's too broad. Simpler + correct: for each row, build a
  // Set of tokens matching the exact "verb-charset" pattern, so verbs with
  // special chars are matched exactly.

  // Actually: verbs may contain almost any Scheme identifier char. To be safe:
  // for each verb, precompile a boundary regex once, then run it against the
  // concatenated row text. 1,079 regexes × ~110k rows = 118M applies —
  // manageable but slow (~30s per verb worst case). Better: single-pass
  // tokenize with a permissive pattern.

  // Tokenize by splitting on runs of chars that CANNOT appear in a Motoi verb
  // (whitespace, quotes, brackets, semicolon, comma). Everything else stays.
  // Then check each verb's exact string against the token set.
  //
  // NOTE: this over-includes trailing punctuation on words in prose. To handle:
  // strip leading/trailing chars that are punctuation-only, from each token.
  // Scheme identifiers can end in ? and !, so DO NOT strip those trailing.
  // Only strip trailing chars that never appear in a Motoi verb: . , : ; ' " ( ) ` [ ] { }
  const stripLead = /^[.,:;'"()`\[\]{}]+/
  const stripTrail = /[.,:;'"()`\[\]{}]+$/

  const verbNames = verbs.map(v => v.verb)
  const counts = new Map()
  for (const v of verbNames) counts.set(v, 0)

  const stream = createReadStream(CORPUS, { encoding: 'utf8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  let rowN = 0
  const t0 = Date.now()
  for await (const raw of rl) {
    const line = raw.trim()
    if (!line) continue
    rowN++
    let row
    try { row = JSON.parse(line) } catch { continue }
    let text = ''
    if (row.messages && Array.isArray(row.messages)) {
      for (const m of row.messages) text += (m.content || '') + '\n'
    }
    if (row._meta) text += JSON.stringify(row._meta)
    if (!text) continue

    // Tokenize on whitespace + a limited set of separators; strip punct
    // Do a straightforward split on whitespace + delimiters that never appear inside verbs.
    // Include ( ) " ' as splitters — verbs never embed those.
    const rawTokens = text.split(/[\s()"',;`\[\]{}]+/)
    const seen = new Set()
    for (const t of rawTokens) {
      if (!t) continue
      const cleaned = t.replace(stripLead, '').replace(stripTrail, '')
      if (!cleaned) continue
      if (!seen.has(cleaned)) {
        seen.add(cleaned)
      }
    }
    // Count: for each verb, if present in this row's token set, +1.
    // But we want TOTAL MENTIONS (not distinct rows). So instead count occurrences directly.
    // Reprocess raw tokens without dedup:
    for (const t of rawTokens) {
      if (!t) continue
      const cleaned = t.replace(stripLead, '').replace(stripTrail, '')
      if (!cleaned) continue
      if (counts.has(cleaned)) counts.set(cleaned, counts.get(cleaned) + 1)
    }

    if (rowN % 10000 === 0) {
      console.log(`  rows scanned: ${rowN} (${((Date.now()-t0)/1000).toFixed(1)}s)`)
    }
  }
  console.log(`Total rows scanned: ${rowN} in ${((Date.now()-t0)/1000).toFixed(1)}s`)

  // Write coverage jsonl
  const outLines = verbs.map(v => JSON.stringify({
    verb: v.verb, library: v.library, mentions: counts.get(v.verb) || 0,
  }))
  writeFileSync(OUT, outLines.join('\n') + '\n')
  console.log(`Wrote ${OUT}`)

  // Histogram
  const buckets = {
    '500+': 0,
    '100-499': 0,
    '20-99': 0,
    '1-19': 0,
    '0': 0,
  }
  const missingList = []
  const thinList = []
  for (const v of verbs) {
    const c = counts.get(v.verb) || 0
    if (c === 0) { buckets['0']++; missingList.push(`${v.library}/${v.verb}`) }
    else if (c < 20) { buckets['1-19']++; thinList.push({ verb: v.verb, library: v.library, mentions: c }) }
    else if (c < 100) buckets['20-99']++
    else if (c < 500) buckets['100-499']++
    else buckets['500+']++
  }

  const summary = [
    `# Motoi Mk1 corpus coverage — per-verb histogram`,
    ``,
    `Corpus: ${CORPUS}`,
    `Rows scanned: ${rowN}`,
    `Verbs total: ${verbs.length}`,
    ``,
    `## Coverage buckets`,
    ``,
    `- Verbs with 500+ mentions: ${buckets['500+']} (well-covered)`,
    `- Verbs with 100-499 mentions: ${buckets['100-499']}`,
    `- Verbs with 20-99 mentions: ${buckets['20-99']}`,
    `- Verbs with 1-19 mentions: ${buckets['1-19']} (thin)`,
    `- Verbs with 0 mentions: ${buckets['0']} (missing entirely from corpus)`,
    ``,
    `## Missing verbs (0 mentions, first 50)`,
    ``,
    ...missingList.slice(0, 50).map(v => `- ${v}`),
    ``,
  ].join('\n')

  writeFileSync(SUMMARY, summary)
  console.log(`Wrote ${SUMMARY}`)

  // Print histogram to stdout for parent to pick up
  console.log(`\n=== HISTOGRAM ===`)
  for (const [k, n] of Object.entries(buckets)) console.log(`  ${k}: ${n}`)
}

main().catch(err => {
  console.error('corpus-coverage error:', err)
  process.exit(1)
})
