// scratch/marcus-2-word-book-extractor.mjs
//
// Marcus #2 — WORD-BOOK pair extractor.
//
// Reads word-books/{book-of-glances,book-of-paired-scenarios,book-of-words}/
// and emits training pairs in the same messages-format used by the rest of
// the Motoi Copilot corpus.
//
// Output: /Users/alfred/code/motoi-scheme/training-data/marcus-2-word-books-2026-07-17.jsonl
//
// Usage: node scratch/marcus-2-word-book-extractor.mjs

import { parse, Sym } from '../src/reader.js'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, basename } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const WORD_BOOKS_DIR = resolve(ROOT, 'word-books')
const OUT_PATH = resolve(ROOT, 'training-data/marcus-2-word-books-2026-07-17.jsonl')

const TODAY = '2026-07-17'
const PROVENANCE_TAG = 'marcus-2-word-book-extractor-2026-07-17'

// ─────────────────────────────────────────────────────────────────────────
// SLAT walking helpers
// ─────────────────────────────────────────────────────────────────────────

function isSym(x, name) {
  if (!(x instanceof Sym)) return false
  if (name === undefined) return true
  return x.name === name
}

// Look up a keyword-value in a plist-style form (either the tail of a
// tagged form like (glance-item :n 1 :prompt "..." :answer "..."),
// or a bare (k v k v ...) sequence).
function plget(form, key) {
  const start = 1 // skip head symbol
  for (let i = start; i < form.length - 1; i++) {
    const k = form[i]
    if (k instanceof Sym && k.name === key) return form[i + 1]
  }
  return undefined
}

// Walk a parsed SLAT tree, invoking cb(form, ancestors) on every list
// whose head is a symbol.
function walk(node, cb, ancestors = []) {
  if (!Array.isArray(node)) return
  if (node.length > 0 && node[0] instanceof Sym) {
    cb(node, ancestors)
  }
  const nextAncestors = ancestors.concat([node])
  for (const child of node) walk(child, cb, nextAncestors)
}

function normalizeString(s) {
  if (typeof s !== 'string') return null
  return s.trim()
}

function truncatePreserveSentences(s, maxChars) {
  if (!s || s.length <= maxChars) return s
  const cut = s.slice(0, maxChars)
  const lastPeriod = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'))
  if (lastPeriod > maxChars * 0.6) return cut.slice(0, lastPeriod + 1)
  return cut + '…'
}

// ─────────────────────────────────────────────────────────────────────────
// GLANCE-ITEM extraction
//   Each glance-item → 1 direct Q/A pair + 1 feedback-teach pair
// ─────────────────────────────────────────────────────────────────────────

function extractFromGlances(chapterForms, filePath) {
  const pairs = []
  const chapterTitle = findChapterTitle(chapterForms)
  const chapterCategory = findChapterCategory(chapterForms)

  walk(chapterForms, (form) => {
    if (!isSym(form[0], 'glance-item')) return
    const n = plget(form, ':n')
    const prompt = normalizeString(plget(form, ':prompt'))
    const answer = normalizeString(plget(form, ':answer'))
    const feedback = normalizeString(plget(form, ':feedback'))
    const difficulty = plget(form, ':difficulty')
    if (!prompt || !answer) return

    const diffName = difficulty instanceof Sym ? difficulty.name : String(difficulty || 'unknown')

    // Pair 1: direct diagnostic Q/A
    pairs.push({
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: answer }
      ],
      family: 'word-book',
      source: 'book-of-glances',
      chapter: chapterTitle,
      category: chapterCategory,
      item_n: typeof n === 'number' ? n : null,
      difficulty: diffName,
      pair_kind: 'diagnostic',
      provenance: `${PROVENANCE_TAG} file=${basename(filePath)} item=${n}`
    })

    // Pair 2: teach with feedback if present
    if (feedback) {
      pairs.push({
        messages: [
          { role: 'user', content: `${prompt} Why?` },
          { role: 'assistant', content: `${answer}\n\n${feedback}` }
        ],
        family: 'word-book',
        source: 'book-of-glances',
        chapter: chapterTitle,
        category: chapterCategory,
        item_n: typeof n === 'number' ? n : null,
        difficulty: diffName,
        pair_kind: 'diagnostic-teach',
        provenance: `${PROVENANCE_TAG} file=${basename(filePath)} item=${n}-teach`
      })
    }
  })

  return pairs
}

function findChapterTitle(forms) {
  let title = null
  walk(forms, (form) => {
    if (title) return
    if (isSym(form[0], 'chapter')) {
      const t = plget(form, ':title')
      if (typeof t === 'string') title = t
    }
  })
  return title || 'unknown'
}

function findChapterCategory(forms) {
  let cat = null
  walk(forms, (form) => {
    if (cat) return
    if (isSym(form[0], 'chapter')) {
      const c = plget(form, ':category')
      if (c instanceof Sym) cat = c.name.replace(/^:/, '')
      else if (typeof c === 'string') cat = c
    }
  })
  return cat || null
}

// ─────────────────────────────────────────────────────────────────────────
// PAIRED-SCENARIO extraction
//   For each chapter (or appendix pair): extract the pair + emit
//     - one "what happens" summary pair
//     - one "which pattern" analytical pair (deep-structure question)
//     - one "transfer-prompt" pair per prompt
// ─────────────────────────────────────────────────────────────────────────

function extractFromScenarios(chapterForms, filePath) {
  const pairs = []
  const chapterTitle = findChapterTitle(chapterForms) || 'unknown'
  // Find deep-structure at chapter level
  let deepStructure = null
  walk(chapterForms, (form) => {
    if (deepStructure) return
    if (isSym(form[0], 'chapter') || isSym(form[0], 'appendix')) {
      const ds = plget(form, ':deep-structure')
      if (typeof ds === 'string') deepStructure = ds
    }
  })

  // Chapter A/B pattern (16 main chapters)
  const scenarioA = plget(chapterForms[0] || [], ':scenario-a') || findChildForm(chapterForms, 'scenario-a')
  const scenarioB = plget(chapterForms[0] || [], ':scenario-b') || findChildForm(chapterForms, 'scenario-b')
  const patternProse = getPatternProse(chapterForms)
  const transferPrompts = getTransferPrompts(chapterForms)

  if (scenarioA && Array.isArray(scenarioA)) {
    const sceneA = plget(scenarioA, ':prose')
    if (sceneA && deepStructure) {
      pairs.push({
        messages: [
          { role: 'user', content: `What is the deep structure of this scenario?\n\n${truncatePreserveSentences(sceneA, 1600)}` },
          { role: 'assistant', content: deepStructure }
        ],
        family: 'word-book',
        source: 'book-of-paired-scenarios',
        chapter: chapterTitle,
        pair_kind: 'deep-structure',
        provenance: `${PROVENANCE_TAG} file=${basename(filePath)} scenario-a`
      })
    }
  }
  if (scenarioB && Array.isArray(scenarioB)) {
    const sceneB = plget(scenarioB, ':prose')
    if (sceneB && deepStructure) {
      pairs.push({
        messages: [
          { role: 'user', content: `What deep pattern is shared between this scenario and the previous one?\n\n${truncatePreserveSentences(sceneB, 1600)}` },
          { role: 'assistant', content: deepStructure }
        ],
        family: 'word-book',
        source: 'book-of-paired-scenarios',
        chapter: chapterTitle,
        pair_kind: 'deep-structure-transfer',
        provenance: `${PROVENANCE_TAG} file=${basename(filePath)} scenario-b`
      })
    }
  }

  if (patternProse && deepStructure) {
    pairs.push({
      messages: [
        { role: 'user', content: `Explain the pattern named "${chapterTitle}".` },
        { role: 'assistant', content: truncatePreserveSentences(patternProse, 2400) }
      ],
      family: 'word-book',
      source: 'book-of-paired-scenarios',
      chapter: chapterTitle,
      pair_kind: 'pattern-teach',
      provenance: `${PROVENANCE_TAG} file=${basename(filePath)} pattern`
    })
  }

  // Transfer prompts — each is a Q; the pattern-summary IS the response guide
  for (let i = 0; i < transferPrompts.length; i++) {
    const p = transferPrompts[i]
    pairs.push({
      messages: [
        { role: 'user', content: truncatePreserveSentences(p, 1200) },
        { role: 'assistant', content: `Pattern: ${deepStructure || chapterTitle}.\n\n${patternProseSummary(patternProse)}` }
      ],
      family: 'word-book',
      source: 'book-of-paired-scenarios',
      chapter: chapterTitle,
      pair_kind: 'transfer-prompt',
      provenance: `${PROVENANCE_TAG} file=${basename(filePath)} prompt-${i + 1}`
    })
  }

  // Appendix `pair` records
  walk(chapterForms, (form) => {
    if (!isSym(form[0], 'pair')) return
    const id = plget(form, ':id')
    const ds = plget(form, ':deep-structure')
    const idStr = typeof id === 'string' ? id : (id instanceof Sym ? id.name : 'unknown')
    // Nested scenario-a / scenario-b are children (not keyword-values)
    const scA = findChildForm(form, 'scenario-a')
    const scB = findChildForm(form, 'scenario-b')
    const summary = findChildForm(form, 'pattern-summary')
    const summaryText = summary && typeof summary[1] === 'string' ? summary[1] : null

    for (const [sc, label] of [[scA, 'a'], [scB, 'b']]) {
      if (!sc) continue
      const prose = plget(sc, ':prose')
      if (typeof prose !== 'string' || !ds) continue
      pairs.push({
        messages: [
          { role: 'user', content: `Which pattern is at work here?\n\n${truncatePreserveSentences(prose, 1400)}` },
          { role: 'assistant', content: typeof ds === 'string' ? ds : String(ds) }
        ],
        family: 'word-book',
        source: 'book-of-paired-scenarios',
        chapter: chapterTitle,
        pair_id: idStr,
        pair_kind: `appendix-pair-scene-${label}`,
        provenance: `${PROVENANCE_TAG} file=${basename(filePath)} pair=${idStr} scene=${label}`
      })
    }
    if (summaryText && typeof ds === 'string') {
      pairs.push({
        messages: [
          { role: 'user', content: `Teach the pattern behind ${idStr}: ${ds}` },
          { role: 'assistant', content: truncatePreserveSentences(summaryText, 2000) }
        ],
        family: 'word-book',
        source: 'book-of-paired-scenarios',
        chapter: chapterTitle,
        pair_id: idStr,
        pair_kind: 'appendix-pair-teach',
        provenance: `${PROVENANCE_TAG} file=${basename(filePath)} pair=${idStr} teach`
      })
    }
  })

  return pairs
}

function patternProseSummary(prose) {
  if (!prose) return 'Apply the three checks: intent, relationship, material stakes.'
  const firstPara = prose.split(/\n\s*\n/)[0]
  return truncatePreserveSentences(firstPara, 800)
}

function findChildForm(node, headName) {
  if (!Array.isArray(node)) return null
  for (const c of node) {
    if (Array.isArray(c) && c[0] instanceof Sym && c[0].name === headName) return c
  }
  return null
}

function getPatternProse(forms) {
  let out = null
  walk(forms, (form) => {
    if (out) return
    if (isSym(form[0], 'pattern')) {
      const p = plget(form, ':prose')
      if (typeof p === 'string') out = p
      else if (form.length >= 2 && typeof form[1] === 'string') out = form[1]
    }
  })
  if (out) return out
  // Try a keyword :pattern under chapter
  walk(forms, (form) => {
    if (out) return
    if (isSym(form[0], 'chapter')) {
      const p = plget(form, ':pattern')
      if (typeof p === 'string') out = p
      else if (Array.isArray(p)) {
        const pp = plget(p, ':prose')
        if (typeof pp === 'string') out = pp
      }
    }
  })
  return out
}

function getTransferPrompts(forms) {
  const prompts = []
  walk(forms, (form) => {
    if (!isSym(form[0], 'transfer-prompts')) return
    for (let i = 1; i < form.length - 1; i++) {
      const k = form[i]
      if (k instanceof Sym && /^:prompt(-\d+)?$/.test(k.name)) {
        const v = form[i + 1]
        if (typeof v === 'string') prompts.push(v)
      }
    }
  })
  return prompts
}

// ─────────────────────────────────────────────────────────────────────────
// Regex fallback extractor for paired-scenarios (when SLAT parse fails
// due to authoring paren imbalance — treat file as text and pull known
// keyword fields).
// ─────────────────────────────────────────────────────────────────────────

function extractFromScenariosRegex(src, filePath) {
  const pairs = []
  // Get chapter title
  const titleM = src.match(/:title\s+"([^"]+)"/)
  const slugM = src.match(/:slug\s+"([^"]+)"/)
  const chapterTitle = titleM ? titleM[1] : (slugM ? slugM[1] : basename(filePath, '.slat'))
  const dsM = src.match(/:deep-structure\s+"([^"]+)"/)
  const deepStructure = dsM ? dsM[1] : null

  // Extract each :prose "..." block; strings may span multiple lines.
  const proseBlocks = extractStringField(src, ':prose')
  // First two prose fields typically = scenario-a + scenario-b (after opening)
  const openingIdx = src.indexOf(':opening')
  const scenarioAIdx = src.indexOf(':scenario-a')
  const scenarioBIdx = src.indexOf(':scenario-b')
  const patternIdx = src.indexOf(':pattern')

  const scenes = { a: null, b: null, pattern: null, opening: null }
  for (const pb of proseBlocks) {
    if (openingIdx >= 0 && pb.pos > openingIdx && pb.pos < (scenarioAIdx >= 0 ? scenarioAIdx : Infinity) && scenes.opening === null) {
      scenes.opening = pb.value
    } else if (scenarioAIdx >= 0 && pb.pos > scenarioAIdx && pb.pos < (scenarioBIdx >= 0 ? scenarioBIdx : Infinity) && scenes.a === null) {
      scenes.a = pb.value
    } else if (scenarioBIdx >= 0 && pb.pos > scenarioBIdx && pb.pos < (patternIdx >= 0 ? patternIdx : Infinity) && scenes.b === null) {
      scenes.b = pb.value
    } else if (patternIdx >= 0 && pb.pos > patternIdx && scenes.pattern === null) {
      scenes.pattern = pb.value
    }
  }

  if (scenes.a && deepStructure) {
    pairs.push({
      messages: [
        { role: 'user', content: `What is the deep structure of this scenario?\n\n${truncatePreserveSentences(scenes.a, 1600)}` },
        { role: 'assistant', content: deepStructure }
      ],
      family: 'word-book',
      source: 'book-of-paired-scenarios',
      chapter: chapterTitle,
      pair_kind: 'deep-structure',
      provenance: `${PROVENANCE_TAG} file=${basename(filePath)} scenario-a regex`
    })
  }
  if (scenes.b && deepStructure) {
    pairs.push({
      messages: [
        { role: 'user', content: `What deep pattern is shared between this scenario and the previous one?\n\n${truncatePreserveSentences(scenes.b, 1600)}` },
        { role: 'assistant', content: deepStructure }
      ],
      family: 'word-book',
      source: 'book-of-paired-scenarios',
      chapter: chapterTitle,
      pair_kind: 'deep-structure-transfer',
      provenance: `${PROVENANCE_TAG} file=${basename(filePath)} scenario-b regex`
    })
  }
  if (scenes.pattern && deepStructure) {
    pairs.push({
      messages: [
        { role: 'user', content: `Explain the pattern named "${chapterTitle}".` },
        { role: 'assistant', content: truncatePreserveSentences(scenes.pattern, 2400) }
      ],
      family: 'word-book',
      source: 'book-of-paired-scenarios',
      chapter: chapterTitle,
      pair_kind: 'pattern-teach',
      provenance: `${PROVENANCE_TAG} file=${basename(filePath)} pattern regex`
    })
  }

  // Transfer prompts: :prompt-1 "..." :prompt-2 "..." etc.
  const promptRe = /:prompt-\d+\s+"((?:[^"\\]|\\.)*)"/g
  let m
  let idx = 0
  while ((m = promptRe.exec(src))) {
    idx++
    const promptText = m[1].replace(/\\"/g, '"')
    pairs.push({
      messages: [
        { role: 'user', content: truncatePreserveSentences(promptText, 1200) },
        { role: 'assistant', content: `Pattern: ${deepStructure || chapterTitle}.\n\n${patternProseSummary(scenes.pattern)}` }
      ],
      family: 'word-book',
      source: 'book-of-paired-scenarios',
      chapter: chapterTitle,
      pair_kind: 'transfer-prompt',
      provenance: `${PROVENANCE_TAG} file=${basename(filePath)} prompt-${idx} regex`
    })
  }

  return pairs
}

// Extract all `:prose "..."` (or given field) string values, respecting
// escaped quotes. Returns [{ pos, value }].
function extractStringField(src, keyword) {
  const results = []
  const kw = keyword
  let i = 0
  while (i < src.length) {
    const foundAt = src.indexOf(kw, i)
    if (foundAt < 0) break
    // Move to next non-space char
    let p = foundAt + kw.length
    while (p < src.length && /\s/.test(src[p])) p++
    if (src[p] !== '"') { i = foundAt + kw.length; continue }
    // Read string
    p++
    let start = p
    let value = ''
    while (p < src.length) {
      const c = src[p]
      if (c === '\\' && p + 1 < src.length) {
        const nx = src[p + 1]
        if (nx === '"') value += '"'
        else if (nx === 'n') value += '\n'
        else if (nx === 't') value += '\t'
        else if (nx === '\\') value += '\\'
        else value += nx
        p += 2
        continue
      }
      if (c === '"') break
      value += c
      p++
    }
    results.push({ pos: foundAt, value })
    i = p + 1
  }
  return results
}

// ─────────────────────────────────────────────────────────────────────────
// BOOK-OF-WORDS extraction
//   The prose is inside :prose blocks with markdown. We turn these into
//   "explain what X is / teach me the game of Y" pairs by extracting
//   sections and definitions.
// ─────────────────────────────────────────────────────────────────────────

function extractFromWords(chapterForms, filePath) {
  const pairs = []
  const chapterTitle = findChapterTitle(chapterForms) || 'unknown'
  let prose = null
  walk(chapterForms, (form) => {
    if (prose) return
    if (isSym(form[0], 'chapter')) {
      const p = plget(form, ':prose')
      if (typeof p === 'string') prose = p
    }
  })
  if (!prose) return pairs

  // Strip yaml front-matter
  prose = prose.replace(/^---\n[\s\S]*?\n---\n/, '')

  // Split by markdown H2 (## ) or H1 (# )
  const sections = splitMarkdownSections(prose)
  for (const s of sections) {
    if (!s.body || s.body.length < 40) continue
    const q = sectionToQuestion(s.heading, chapterTitle)
    pairs.push({
      messages: [
        { role: 'user', content: q },
        { role: 'assistant', content: truncatePreserveSentences(s.body, 2400) }
      ],
      family: 'word-book',
      source: 'book-of-words',
      chapter: chapterTitle,
      section: s.heading,
      pair_kind: 'section-teach',
      provenance: `${PROVENANCE_TAG} file=${basename(filePath)} section="${s.heading}"`
    })

    // Extract bullet definitions (- **term** — description)
    const defs = extractBulletDefinitions(s.body)
    for (const d of defs) {
      pairs.push({
        messages: [
          { role: 'user', content: `What does "${d.term}" mean in this context?` },
          { role: 'assistant', content: d.definition }
        ],
        family: 'word-book',
        source: 'book-of-words',
        chapter: chapterTitle,
        section: s.heading,
        term: d.term,
        pair_kind: 'term-definition',
        provenance: `${PROVENANCE_TAG} file=${basename(filePath)} term="${d.term}"`
      })
    }
  }

  return pairs
}

function splitMarkdownSections(md) {
  const lines = md.split('\n')
  const sections = []
  let cur = { heading: null, body: '' }
  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.*)$/)
    if (h) {
      if (cur.heading || cur.body.trim()) sections.push({ heading: cur.heading, body: cur.body.trim() })
      cur = { heading: h[1].trim(), body: '' }
    } else {
      cur.body += line + '\n'
    }
  }
  if (cur.heading || cur.body.trim()) sections.push({ heading: cur.heading, body: cur.body.trim() })
  // Drop first opener with no heading (usually short lead-in) if very short
  return sections.filter(s => s.heading && s.body)
}

function sectionToQuestion(heading, chapterTitle) {
  const h = heading.replace(/^#+\s*/, '').trim()
  if (/tier|lexicon|vocabulary|words/i.test(h)) return `Teach the ${h.toLowerCase()} vocabulary from "${chapterTitle}".`
  if (/game/i.test(h)) return `Explain the game of ${h.toLowerCase()}.`
  if (/what/i.test(h)) return h.endsWith('?') ? h : h + '?'
  return `In "${chapterTitle}", ${h.toLowerCase()}?`
}

function extractBulletDefinitions(body) {
  const out = []
  const re = /^\s*-\s+\*\*([^*]+)\*\*\s+[—-]\s+([\s\S]*?)(?=\n\s*-\s+\*\*|\n\s*\n|$)/gm
  let m
  while ((m = re.exec(body))) {
    const term = m[1].trim()
    const def = m[2].trim().replace(/\s+/g, ' ')
    if (term && def && def.length < 500) out.push({ term, definition: def })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Driver
// ─────────────────────────────────────────────────────────────────────────

async function listFiles(dir, exts) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter(e => e.isFile() && exts.some(x => e.name.endsWith(x)))
      .map(e => join(dir, e.name))
      .sort()
  } catch { return [] }
}

async function main() {
  const glanceFiles = await listFiles(join(WORD_BOOKS_DIR, 'book-of-glances'), ['.slat', '.slatl'])
  const scenarioFiles = await listFiles(join(WORD_BOOKS_DIR, 'book-of-paired-scenarios'), ['.slat', '.slatl'])
  const wordFiles = await listFiles(join(WORD_BOOKS_DIR, 'book-of-words'), ['.slat', '.slatl'])

  const allPairs = []
  let stats = { glances: 0, scenarios: 0, words: 0, files: 0, errors: [] }

  for (const f of glanceFiles) {
    if (basename(f).startsWith('MANIFEST') || basename(f).startsWith('README')) continue
    try {
      const src = await readFile(f, 'utf8')
      const forms = parse(src)
      const p = extractFromGlances(forms, f)
      allPairs.push(...p)
      stats.glances += p.length
      stats.files++
    } catch (e) {
      stats.errors.push({ file: f, error: e.message })
    }
  }

  for (const f of scenarioFiles) {
    if (basename(f).startsWith('MANIFEST') || basename(f).startsWith('README')) continue
    let parsed = false
    try {
      const src = await readFile(f, 'utf8')
      const forms = parse(src)
      const p = extractFromScenarios(forms, f)
      allPairs.push(...p)
      stats.scenarios += p.length
      stats.files++
      parsed = true
    } catch (e) {
      // Fall through to regex-based extraction
    }
    if (!parsed) {
      try {
        const src = await readFile(f, 'utf8')
        const p = extractFromScenariosRegex(src, f)
        allPairs.push(...p)
        stats.scenarios += p.length
        stats.files++
      } catch (e) {
        stats.errors.push({ file: f, error: 'regex fallback failed: ' + e.message })
      }
    }
  }

  for (const f of wordFiles) {
    if (basename(f).startsWith('MANIFEST') || basename(f).startsWith('README')) continue
    try {
      const src = await readFile(f, 'utf8')
      const forms = parse(src)
      const p = extractFromWords(forms, f)
      allPairs.push(...p)
      stats.words += p.length
      stats.files++
    } catch (e) {
      stats.errors.push({ file: f, error: e.message })
    }
  }

  // Provenance header
  const header = {
    _provenance_header: true,
    generated_at: new Date().toISOString(),
    generator: 'marcus-2-word-book-extractor.mjs',
    source_dir: WORD_BOOKS_DIR,
    files_scanned: stats.files,
    pair_count: allPairs.length,
    by_source: {
      'book-of-glances': stats.glances,
      'book-of-paired-scenarios': stats.scenarios,
      'book-of-words': stats.words
    },
    errors: stats.errors,
    notes: 'Marcus #2 word-book pair extraction. Independent of Jess doc-scour.'
  }

  const lines = [JSON.stringify(header)].concat(allPairs.map(p => JSON.stringify(p)))
  await writeFile(OUT_PATH, lines.join('\n') + '\n')

  process.stderr.write(`wrote ${allPairs.length} pairs to ${OUT_PATH}\n`)
  process.stderr.write(`  glances: ${stats.glances}\n`)
  process.stderr.write(`  scenarios: ${stats.scenarios}\n`)
  process.stderr.write(`  words: ${stats.words}\n`)
  if (stats.errors.length) {
    process.stderr.write(`  errors: ${stats.errors.length}\n`)
    for (const e of stats.errors) process.stderr.write(`    ${basename(e.file)}: ${e.error}\n`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
