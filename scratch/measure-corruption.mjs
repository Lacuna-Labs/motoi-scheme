// scratch/measure-corruption.mjs — quantify broken-code exposure in the books corpus.
// Answers two questions:
//   (1) What fraction of ```scheme code (by char, a token proxy) sits in broken chapters?
//   (2) Are the 44 fails scattered (many distinct causes) or systematic (a few repeated causes)?
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'scheme-books'

function schemeBlocks(text) {
  const out = []
  const re = /```scheme\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
  }
  return out
}

// crude token proxy: whitespace-split count (consistent, no tokenizer dep)
const toks = s => (s.match(/\S+/g) || []).length

// gather all chapter files
const files = []
for (const book of readdirSync(ROOT)) {
  const bp = join(ROOT, book)
  if (!statSync(bp).isDirectory()) continue
  for (const f of readdirSync(bp)) {
    if (f.endsWith('.slatl')) files.push(join(bp, f))
  }
}

// the broken set, keyed by "book/chapter", tagged with root-cause bucket
const failLines = readFileSync('scratch/fails-now2.txt', 'utf8').trim().split('\n')
const bucketOf = (err) => {
  if (/fuel exhausted/.test(err)) return 'FUEL-ARTIFACT (not broken)'
  if (/unbound symbol: (module|import|cache\/|cortex\/|module-|module\/|version-compare|cart\b)/.test(err)) return 'MODULE-SYSTEM (systematic: feature not built)'
  if (/unbound symbol: define-card/.test(err)) return 'CARD-SYSTEM (systematic: feature not built)'
  if (/unbound symbol: (stats\/|text\/|system\/|stock\/)/.test(err)) return 'CONSUMER-SERVICE-VERB (semi-systematic: disclosed stand-ins)'
  if (/lst\.filter is not a function/.test(err)) return 'DATA-SHAPE-BUG (scattered real bug)'
  if (/(missing \)|unexpected \))/.test(err)) return 'PAREN-TYPO (scattered real bug)'
  return 'OTHER'
}
const brokenChapters = new Map() // "book/chapter" -> bucket
const buckets = new Map()
for (const line of failLines) {
  const m = line.match(/^FAIL\s+(\S+)\s+\(\d+ blocks\)\s+::\s+(.*)$/)
  if (!m) continue
  const key = m[1], err = m[2]
  const b = bucketOf(err)
  brokenChapters.set(key, b)
  buckets.set(b, (buckets.get(b) || 0) + 1)
}

// tally corpus-wide code exposure
let totalChapters = 0, chaptersWithCode = 0
let totalCodeToks = 0, totalCodeChars = 0, totalBlocks = 0
let brokenCodeToks = 0, brokenCodeChars = 0, brokenBlocks = 0
let fuelCodeToks = 0
for (const f of files) {
  const key = f.split('/').slice(-2).join('/')
  const bs = schemeBlocks(readFileSync(f, 'utf8'))
  totalChapters++
  if (bs.length === 0) continue
  chaptersWithCode++
  const t = bs.reduce((a, b) => a + toks(b), 0)
  const c = bs.reduce((a, b) => a + b.length, 0)
  totalCodeToks += t; totalCodeChars += c; totalBlocks += bs.length
  if (brokenChapters.has(key)) {
    const bucket = brokenChapters.get(key)
    if (bucket.startsWith('FUEL')) { fuelCodeToks += t; continue } // not broken code
    brokenCodeToks += t; brokenCodeChars += c; brokenBlocks += bs.length
  }
}

const pct = (a, b) => (100 * a / b).toFixed(2) + '%'
console.log('=== CORPUS-WIDE CODE EXPOSURE (```scheme blocks across all books) ===')
console.log(`chapters total:                 ${totalChapters}`)
console.log(`chapters with code:             ${chaptersWithCode}`)
console.log(`code blocks total:              ${totalBlocks}`)
console.log(`code tokens total (ws-split):   ${totalCodeToks.toLocaleString()}`)
console.log(`code chars total:               ${totalCodeChars.toLocaleString()}`)
console.log()
console.log('=== BROKEN-CHAPTER EXPOSURE (whole failing chapter counted = UPPER BOUND) ===')
console.log(`broken chapters (excl. fuel):   ${[...brokenChapters.values()].filter(b=>!b.startsWith('FUEL')).length}`)
console.log(`broken code blocks (upper):     ${brokenBlocks}  = ${pct(brokenBlocks, totalBlocks)} of blocks`)
console.log(`broken code tokens (upper):     ${brokenCodeToks.toLocaleString()}  = ${pct(brokenCodeToks, totalCodeToks)} of code tokens`)
console.log(`  (of which fuel-artifact, NOT broken: ${fuelCodeToks.toLocaleString()} tokens excluded above)`)
console.log()
console.log('=== ROOT-CAUSE BUCKETS (systematic vs scattered) ===')
for (const [b, n] of [...buckets.entries()].sort((x,y)=>y[1]-x[1])) {
  console.log(`  ${String(n).padStart(3)} chapters  ${b}`)
}

// --- refinement: per-bucket token totals + code-vs-whole-corpus ratio ---
let wholeCorpusChars = 0
for (const f of files) wholeCorpusChars += readFileSync(f, 'utf8').length
const perBucketToks = new Map()
for (const f of files) {
  const key = f.split('/').slice(-2).join('/')
  if (!brokenChapters.has(key)) continue
  const bucket = brokenChapters.get(key)
  const bs = schemeBlocks(readFileSync(f, 'utf8'))
  const t = bs.reduce((a, b) => a + toks(b), 0)
  perBucketToks.set(bucket, (perBucketToks.get(bucket) || 0) + t)
}
console.log()
console.log('=== BROKEN CODE TOKENS BY BUCKET (whole-chapter upper bound) ===')
for (const [b, t] of [...perBucketToks.entries()].sort((x,y)=>y[1]-x[1])) {
  console.log(`  ${t.toLocaleString().padStart(8)} tok  ${pct(t, totalCodeToks).padStart(7)} of code  ${b}`)
}
console.log()
console.log('=== CODE vs WHOLE CORPUS (CPT trains on prose+code together) ===')
console.log(`whole corpus chars (all .slatl): ${wholeCorpusChars.toLocaleString()}`)
console.log(`  of which scheme code chars:    ${totalCodeChars.toLocaleString()}  = ${pct(totalCodeChars, wholeCorpusChars)} of corpus`)
const systematicToks = (perBucketToks.get('MODULE-SYSTEM (systematic: feature not built)')||0) + (perBucketToks.get('CARD-SYSTEM (systematic: feature not built)')||0)
const scatteredToks = (perBucketToks.get('PAREN-TYPO (scattered real bug)')||0) + (perBucketToks.get('DATA-SHAPE-BUG (scattered real bug)')||0)
console.log()
console.log('=== THE DECIDING SPLIT ===')
const charsPerTok = totalCodeChars / totalCodeToks
console.log(`systematic fake-feature code (modules+cards): ${systematicToks.toLocaleString()} tok = ${pct(systematicToks, totalCodeToks)} of code tokens, ~${pct(systematicToks*charsPerTok, wholeCorpusChars)} of whole corpus`)
console.log(`scattered real bugs (typos+datashape):        ${scatteredToks.toLocaleString()} tok  (mostly ONE bug in an otherwise-fine chapter -> real broken fraction far smaller)`)
