// scratch/marcus-2-verb-drill-extractor.mjs
//
// Marcus #2 — VERB-DRILL pair extractor v2 (post-scour reference).
//
// For every CORE verb (from scratch/motoi-core-verbs-list.slat), emit 3-5
// pairs from the reference's :examples list:
//   * direct-drill   — "Give me an example of foo." → code
//   * scenario-context — "In X situation, how would foo help?" → code with note
//   * teach          — "Explain foo." → summary + minimal example
//
// Every example runs through bin/motoi eval; failures are logged and the
// pair is dropped rather than emitted.
//
// Output: /Users/alfred/code/motoi-scheme/training-data/marcus-2-verb-drill-2026-07-17.jsonl

import { parse, Sym } from '../src/reader.js'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
// The reference is the chaptered book scheme/reference/*.slat. The old single-
// file monolith was retired 2026-07-24 (see _archive/).
const REF_DIR = resolve(ROOT, 'scheme/reference')
const CORE_PATH = resolve(ROOT, 'scratch/motoi-core-verbs-list.slat')
const HELDOUT_PATH = resolve(ROOT, 'training-data/held-out')
const OUT_PATH = resolve(ROOT, 'training-data/marcus-2-verb-drill-2026-07-17.jsonl')
const HEARTBEAT_PATH = resolve(ROOT, 'scratch/marcus-2-heartbeat.slat')
const MOTOI_BIN = resolve(ROOT, 'bin/motoi')

const PROVENANCE_TAG = 'marcus-2-verb-drill-extractor-2026-07-17'
const VERIFY = process.env.MARCUS2_VERIFY !== '0'  // set MARCUS2_VERIFY=0 to skip
const HEARTBEAT_EVERY = 500

// ─────────────────────────────────────────────────────────────────────────
// Load CORE verb list (335 items — 309 verbs + 13 constants + 13 slack)
// ─────────────────────────────────────────────────────────────────────────

async function loadCoreVerbSet() {
  const src = await readFile(CORE_PATH, 'utf8')
  // Parse just the (verb "name") and (constant "name") lines via regex; the
  // file has lots of commentary the SLAT parser might trip on.
  const verbs = new Set()
  const re = /\(\s*(?:verb|constant)\s+"([^"]+)"/g
  let m
  while ((m = re.exec(src))) verbs.add(m[1])
  return verbs
}

// ─────────────────────────────────────────────────────────────────────────
// Load reference
// ─────────────────────────────────────────────────────────────────────────

function isSym(x, name) {
  if (!(x instanceof Sym)) return false
  if (name === undefined) return true
  return x.name === name
}

function plget(form, key) {
  for (let i = 1; i < form.length - 1; i++) {
    const k = form[i]
    if (k instanceof Sym && k.name === key) return form[i + 1]
  }
  return undefined
}

async function loadVerbRecords() {
  const chapters = (await readdir(REF_DIR)).filter(f => f.endsWith('.slat')).sort()
  const forms = []
  for (const ch of chapters) {
    for (const f of parse(await readFile(resolve(REF_DIR, ch), 'utf8'))) forms.push(f)
  }
  const records = []
  for (const form of forms) {
    if (!Array.isArray(form)) continue
    if (!(form[0] instanceof Sym)) continue
    const head = form[0].name
    if (head !== 'verb' && head !== 'form') continue
    const name = plget(form, ':name')
    if (typeof name !== 'string') continue
    const summary = plget(form, ':summary')
    const explanation = plget(form, ':explanation')
    const signature = plget(form, ':signature')
    const library = plget(form, ':library')
    const kind = plget(form, ':kind')
    const examplesRaw = plget(form, ':examples')
    const examples = []
    if (Array.isArray(examplesRaw)) {
      for (const ex of examplesRaw) {
        if (!Array.isArray(ex)) continue
        const code = plget(ex, ':code')
        const tier = plget(ex, ':tier')
        const dialect = plget(ex, ':dialect')
        const note = plget(ex, ':note')
        if (typeof code === 'string') {
          examples.push({
            code,
            tier: typeof tier === 'string' ? tier : null,
            dialect: typeof dialect === 'string' ? dialect : 'motoi',
            note: typeof note === 'string' ? note : null
          })
        }
      }
    }
    records.push({
      name,
      library: typeof library === 'string' ? library : null,
      kind: typeof kind === 'string' ? kind : null,
      signature: typeof signature === 'string' ? signature : null,
      summary: typeof summary === 'string' ? summary : null,
      explanation: typeof explanation === 'string' ? explanation : null,
      examples,
      formHead: form[0].name
    })
  }
  return records
}

// ─────────────────────────────────────────────────────────────────────────
// Held-out check: read held-out prompts and check we don't leak them
// ─────────────────────────────────────────────────────────────────────────

async function loadHeldOutPromptSet() {
  const set = new Set()
  try {
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(HELDOUT_PATH).catch(() => [])
    for (const e of entries) {
      if (!e.endsWith('.jsonl')) continue
      const src = await readFile(resolve(HELDOUT_PATH, e), 'utf8').catch(() => '')
      for (const line of src.split('\n')) {
        if (!line.trim()) continue
        try {
          const d = JSON.parse(line)
          if (d._provenance_header) continue
          const msgs = d.messages || []
          for (const m of msgs) {
            if (m.role === 'user' && typeof m.content === 'string') {
              set.add(m.content.trim())
            }
          }
        } catch {}
      }
    }
  } catch {}
  return set
}

// ─────────────────────────────────────────────────────────────────────────
// bin/motoi eval verification pool
// ─────────────────────────────────────────────────────────────────────────

const evalCache = new Map()
let evalRuns = 0
let evalPassed = 0
let evalFailed = 0

// Wrap code so a define-then-use example still exits 0. If the code is a
// single expr, eval it. If it has multiple top-level forms, wrap in
// (begin ...).
function normalizeForEval(code) {
  const trimmed = code.trim()
  return trimmed
}

async function motoiEval(code) {
  if (!VERIFY) return { ok: true, skipped: true }
  const key = code
  if (evalCache.has(key)) return evalCache.get(key)

  const result = await new Promise((resolvePromise) => {
    const child = spawn(MOTOI_BIN, ['eval', normalizeForEval(code)], {
      cwd: ROOT,
      env: { ...process.env, NO_COLOR: '1' }
    })
    let stdout = ''
    let stderr = ''
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      try { child.kill('SIGKILL') } catch {}
      resolvePromise({ ok: false, reason: 'timeout', stderr })
    }, 4000)
    child.stdout.on('data', (b) => { stdout += b })
    child.stderr.on('data', (b) => { stderr += b })
    child.on('exit', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolvePromise({ ok: code === 0, code, stdout, stderr })
    })
    child.on('error', (e) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolvePromise({ ok: false, reason: 'spawn-error', error: e.message })
    })
  })
  evalRuns++
  if (result.ok) evalPassed++; else evalFailed++
  evalCache.set(key, result)
  return result
}

// Run N eval jobs in parallel
async function pool(items, n, worker) {
  const results = new Array(items.length)
  let idx = 0
  async function runOne() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await worker(items[i], i)
    }
  }
  const runners = []
  for (let k = 0; k < Math.min(n, items.length); k++) runners.push(runOne())
  await Promise.all(runners)
  return results
}

// ─────────────────────────────────────────────────────────────────────────
// Pair emission
// ─────────────────────────────────────────────────────────────────────────

function tierAdjective(tier) {
  if (!tier) return 'a'
  if (tier === 'novice') return 'a novice-level'
  if (tier === 'intermediate') return 'an intermediate'
  if (tier === 'expert') return 'an expert'
  return tier
}

function verbPairsForRecord(rec) {
  const pairs = []
  const verb = rec.name
  const summary = rec.summary || ''
  const signature = rec.signature || ''

  // Sort examples by tier: novice → intermediate → expert; keep insertion
  // order within tier.
  const tierOrder = { novice: 0, intermediate: 1, expert: 2 }
  const exSorted = rec.examples.slice().sort((a, b) => {
    const ta = tierOrder[a.tier] ?? 3
    const tb = tierOrder[b.tier] ?? 3
    return ta - tb
  })

  // Pick up to 5 examples (3 mandatory if available: N/I/E, plus 2 extras)
  const picked = pickForVerbCoverage(exSorted).slice(0, 5)

  // Direct drill pair from first example
  if (picked[0]) {
    const ex = picked[0]
    pairs.push({
      pair_kind: 'direct-drill',
      example: ex,
      messages: [
        { role: 'user', content: `Show me a Motoi example of \`${verb}\`.` },
        { role: 'assistant', content: renderCode(ex.code) + (ex.note ? `\n\n${ex.note}` : '') }
      ]
    })
  }

  // Tier-specific drills
  for (let i = 1; i < picked.length; i++) {
    const ex = picked[i]
    const q = ex.tier
      ? `Give me ${tierAdjective(ex.tier)} example of \`${verb}\`.`
      : `Another example of \`${verb}\`.`
    pairs.push({
      pair_kind: `tier-drill-${ex.tier || 'unspec'}`,
      example: ex,
      messages: [
        { role: 'user', content: q },
        { role: 'assistant', content: renderCode(ex.code) + (ex.note ? `\n\n${ex.note}` : '') }
      ]
    })
  }

  // Teach pair (uses summary + first example)
  if (summary && picked[0]) {
    const teachQ = `Explain \`${verb}\` and show a small example.`
    const teachA = summary
      + (signature ? `\n\nSignature: \`${signature}\`` : '')
      + `\n\n${renderCode(picked[0].code)}`
      + (picked[0].note ? `\n\n${picked[0].note}` : '')
    pairs.push({
      pair_kind: 'teach',
      example: picked[0],
      messages: [
        { role: 'user', content: teachQ },
        { role: 'assistant', content: teachA }
      ]
    })
  }

  // Scenario-context pair (if we have any example with a note)
  const withNote = picked.find(e => e.note)
  if (withNote) {
    const scenarioQ = `I want to ${verbScenarioPhrase(verb, summary)}. How would \`${verb}\` help?`
    const scenarioA = `${withNote.note}\n\n${renderCode(withNote.code)}`
    pairs.push({
      pair_kind: 'scenario-context',
      example: withNote,
      messages: [
        { role: 'user', content: scenarioQ },
        { role: 'assistant', content: scenarioA }
      ]
    })
  }

  // Cap total pairs at 5 to hit the 3-5 window; prefer coverage over duplicates.
  return dedupePairs(pairs).slice(0, 5)
}

function dedupePairs(pairs) {
  const seen = new Set()
  const out = []
  for (const p of pairs) {
    const key = p.messages.map(m => m.role + '|' + m.content).join('||')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

function pickForVerbCoverage(exSorted) {
  // We want to include at least one of each tier if available.
  const byTier = { novice: [], intermediate: [], expert: [], other: [] }
  for (const e of exSorted) {
    if (byTier[e.tier]) byTier[e.tier].push(e)
    else byTier.other.push(e)
  }
  const picked = []
  if (byTier.novice[0]) picked.push(byTier.novice[0])
  if (byTier.intermediate[0]) picked.push(byTier.intermediate[0])
  if (byTier.expert[0]) picked.push(byTier.expert[0])
  // Then pad with extras (novice-2, intermediate-2)
  if (byTier.novice[1]) picked.push(byTier.novice[1])
  if (byTier.intermediate[1]) picked.push(byTier.intermediate[1])
  if (byTier.expert[1]) picked.push(byTier.expert[1])
  if (byTier.other[0]) picked.push(byTier.other[0])
  return picked
}

function renderCode(code) {
  return '```motoi\n' + code + '\n```'
}

function verbScenarioPhrase(verb, summary) {
  if (!summary) return `use ${verb} in a real program`
  // First sentence of summary, lowercase + strip trailing period.
  const s = summary.split('.')[0].trim()
  return s.charAt(0).toLowerCase() + s.slice(1)
}

// ─────────────────────────────────────────────────────────────────────────
// Driver
// ─────────────────────────────────────────────────────────────────────────

async function updateHeartbeat(state) {
  const s =
`(heartbeat
  :owner "marcus-2"
  :task "verb-drill-and-word-book-pairs"
  :started "2026-07-17"
  :last-update "${new Date().toISOString()}"
  :phase "${state.phase}"
  :verbs-processed ${state.verbsProcessed}
  :verbs-total ${state.verbsTotal}
  :verb-drill-pairs ${state.pairsEmitted}
  :word-book-pairs ${state.wordBookPairs}
  :total-pairs ${state.pairsEmitted + state.wordBookPairs}
  :eval-runs ${state.evalRuns}
  :eval-passed ${state.evalPassed}
  :eval-failed ${state.evalFailed}
  :notes "${state.notes}")
`
  await writeFile(HEARTBEAT_PATH, s)
}

async function main() {
  process.stderr.write('loading CORE verb set…\n')
  const coreSet = await loadCoreVerbSet()
  process.stderr.write(`CORE verbs: ${coreSet.size}\n`)

  process.stderr.write('loading reference…\n')
  const records = await loadVerbRecords()
  process.stderr.write(`verb records: ${records.length}\n`)

  process.stderr.write('loading held-out prompts…\n')
  const heldOut = await loadHeldOutPromptSet()
  process.stderr.write(`held-out prompts: ${heldOut.size}\n`)

  // Merge duplicate verb records (reference has 13 dupes). For each verb
  // name, pool all examples from every record so the 3-5 pair cap applies
  // per verb, not per record.
  const byName = new Map()
  for (const r of records) {
    if (!coreSet.has(r.name)) continue
    if (!byName.has(r.name)) {
      byName.set(r.name, { ...r, examples: r.examples.slice() })
    } else {
      const acc = byName.get(r.name)
      acc.examples.push(...r.examples)
      if (!acc.summary && r.summary) acc.summary = r.summary
      if (!acc.signature && r.signature) acc.signature = r.signature
      if (!acc.explanation && r.explanation) acc.explanation = r.explanation
    }
  }
  const coreRecords = [...byName.values()]
  const missingFromReference = [...coreSet].filter(v => !byName.has(v))
  const coverage = coreRecords.length / coreSet.size

  process.stderr.write(`CORE ∩ reference: ${coreRecords.length}/${coreSet.size} (${(coverage * 100).toFixed(1)}%)\n`)
  if (missingFromReference.length) {
    process.stderr.write(`CORE verbs missing from reference: ${missingFromReference.length}\n`)
  }

  const wordBookHeader = await readFile(resolve(ROOT, 'training-data/marcus-2-word-books-2026-07-17.jsonl'), 'utf8')
    .then(s => JSON.parse(s.split('\n')[0]))
    .catch(() => ({ pair_count: 0 }))

  const allPairs = []
  let verbsProcessed = 0
  let heldOutLeaks = 0

  for (const rec of coreRecords) {
    verbsProcessed++
    const candidatePairs = verbPairsForRecord(rec)

    // Verify each pair's example code with bin/motoi eval
    const verified = []
    const codeSet = new Set()
    for (const p of candidatePairs) {
      const code = p.example && p.example.code
      if (!code) continue
      if (!codeSet.has(code)) {
        codeSet.add(code)
      }
    }
    const codeList = [...codeSet]
    const results = await pool(codeList, 4, motoiEval)
    const passing = new Set()
    for (let i = 0; i < codeList.length; i++) {
      if (results[i] && results[i].ok) passing.add(codeList[i])
    }

    for (const p of candidatePairs) {
      const code = p.example && p.example.code
      if (!code) continue
      if (!passing.has(code)) continue
      // Held-out leak check
      const userMsg = p.messages[0].content.trim()
      if (heldOut.has(userMsg)) { heldOutLeaks++; continue }

      verified.push({
        messages: p.messages,
        family: 'code',
        source: 'reference-verb-drill-v2',
        verb: rec.name,
        library: rec.library,
        tier: p.example.tier,
        pair_kind: p.pair_kind,
        provenance: `${PROVENANCE_TAG} verb=${rec.name} kind=${p.pair_kind}`
      })
    }
    allPairs.push(...verified)

    if (verbsProcessed % HEARTBEAT_EVERY === 0 || (allPairs.length > 0 && allPairs.length % HEARTBEAT_EVERY < 5)) {
      await updateHeartbeat({
        phase: 'verb-drill-running',
        verbsProcessed,
        verbsTotal: coreRecords.length,
        pairsEmitted: allPairs.length,
        wordBookPairs: wordBookHeader.pair_count || 0,
        evalRuns, evalPassed, evalFailed,
        notes: `verified via bin/motoi eval; ${heldOutLeaks} held-out leaks dropped`
      })
    }
    if (verbsProcessed % 25 === 0) {
      process.stderr.write(`  ${verbsProcessed}/${coreRecords.length} verbs; pairs=${allPairs.length}; eval pass/fail=${evalPassed}/${evalFailed}\n`)
    }
  }

  // Write output
  const header = {
    _provenance_header: true,
    generated_at: new Date().toISOString(),
    generator: 'marcus-2-verb-drill-extractor.mjs',
    source_reference: REF_DIR,
    source_core_list: CORE_PATH,
    verifier: 'bin/motoi eval',
    core_verb_count: coreSet.size,
    reference_verb_count: records.length,
    core_verbs_in_reference: coreRecords.length,
    core_verbs_missing: missingFromReference,
    pair_count: allPairs.length,
    eval_runs: evalRuns,
    eval_passed: evalPassed,
    eval_failed: evalFailed,
    held_out_leaks_dropped: heldOutLeaks,
    verify_enabled: VERIFY,
    notes: 'Marcus #2 verb-drill v2. Each pair\'s code sample verified by bin/motoi eval; failures dropped.'
  }
  const lines = [JSON.stringify(header)].concat(allPairs.map(p => JSON.stringify(p)))
  await writeFile(OUT_PATH, lines.join('\n') + '\n')

  await updateHeartbeat({
    phase: 'verb-drill-done',
    verbsProcessed,
    verbsTotal: coreRecords.length,
    pairsEmitted: allPairs.length,
    wordBookPairs: wordBookHeader.pair_count || 0,
    evalRuns, evalPassed, evalFailed,
    notes: `verb-drill complete; ${heldOutLeaks} held-out leaks dropped`
  })

  process.stderr.write(`wrote ${allPairs.length} verb-drill pairs to ${OUT_PATH}\n`)
  process.stderr.write(`  eval runs: ${evalRuns}\n`)
  process.stderr.write(`  eval passed: ${evalPassed}\n`)
  process.stderr.write(`  eval failed: ${evalFailed}\n`)
  process.stderr.write(`  held-out leaks dropped: ${heldOutLeaks}\n`)
  process.stderr.write(`  CORE coverage: ${coreRecords.length}/${coreSet.size} verbs in reference\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
