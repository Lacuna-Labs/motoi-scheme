// world-knowledge.js — Motoi's OPEN cortex: read-only world knowledge over
// the four Jung-axis graphs (graph-of-{sensation,intuition,thinking,feeling}).
//
// Doctrine (Alfred, 2026-07-25): "World Knowledge starts with these graphs.
// In Curator we can let it reach other shit. Here it's limited. Call it."
//
// This is the OPEN reference cortex. Curator ships a PROPRIETARY one: the
// same public graphs as a base layer, answered by a Rust engine that also
// reaches private corpora + vector search. The format and the base knowledge
// are open; the scale and the private reach are proprietary. Motoi's
// world/knowledge is the open contract — same lookup shape, four files only.
//
// Why a read-only module and NOT an injection into cortex-io: episodic cortex
// rewrites its whole file on every write. Folding 450 KB of reference nodes
// into that store would re-serialize the entire semantic graph on every
// `cortex/record`. Two stores, one brain: episodic memory (append-shaped) and
// world knowledge (read-only, indexed). "Bad to graph" — Alfred asked; yes.
//
// Lookup shape: match the key against a node's :canonical, its :id (with or
// without axis prefix), or any :synonym. Honest-#f when absent (honest-null
// doctrine) — most musical-movement keys have no node and correctly return #f.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Sym } from '../../src/reader.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const GRAPHS_DIR = join(HERE, '..', '..', 'graphs')
const AXES = ['sensation', 'intuition', 'thinking', 'feeling']

// Lazily-built index: lowercased key -> node summary object. Built once on
// first world/knowledge call so `motoi run` of a program that never asks a
// question pays nothing.
let INDEX = null

const kw = (name) => new Sym(name)

// Pull the quoted strings out of a `(...)` field body, e.g.
//   ("steady" "quiet" "still")  ->  ['steady', 'quiet', 'still']
function quotedList(body) {
  const out = []
  const re = /"([^"]*)"/g
  let m
  while ((m = re.exec(body))) out.push(m[1])
  return out
}

function field(chunk, key) {
  const m = chunk.match(new RegExp(`:${key}\\s+"([^"]*)"`))
  return m ? m[1] : null
}

function listField(chunk, key) {
  // Grab up to the first close-paren after `:key (`. Fields we read
  // (:synonyms, :associations) are single-line flat string lists.
  const m = chunk.match(new RegExp(`:${key}\\s+\\(([^)]*)\\)`))
  return m ? quotedList(m[1]) : []
}

function parseGraph(axis, index) {
  let raw
  try {
    raw = readFileSync(join(GRAPHS_DIR, `graph-of-${axis}.slat`), 'utf8')
  } catch {
    return // a missing graph is not fatal — the others still answer
  }
  // Split on node boundaries. Each node record opens with "(node" at col 0.
  const chunks = raw.split(/\n(?=\(node\b)/)
  for (const chunk of chunks) {
    if (!/^\(node\b/.test(chunk.trimStart())) continue
    const id = field(chunk, 'id')
    const canonical = field(chunk, 'canonical')
    if (!canonical) continue
    const node = {
      id: id || `${axis}/${canonical}`,
      axis,
      canonical,
      definition: field(chunk, 'definition') || '',
      synonyms: listField(chunk, 'synonyms'),
      associations: listField(chunk, 'associations'),
    }
    const keys = new Set()
    keys.add(canonical.toLowerCase())
    if (id) {
      keys.add(id.toLowerCase())
      const slash = id.indexOf('/')
      if (slash >= 0) keys.add(id.slice(slash + 1).toLowerCase())
    }
    for (const s of node.synonyms) keys.add(s.toLowerCase())
    for (const k of keys) {
      // First writer wins: canonical nodes are parsed in axis order, and a
      // synonym should never clobber a real canonical entry.
      if (!index.has(k)) index.set(k, node)
    }
  }
}

function buildIndex() {
  const index = new Map()
  for (const axis of AXES) parseGraph(axis, index)
  return index
}

function lookup(key) {
  if (INDEX === null) INDEX = buildIndex()
  return INDEX.get(String(key).toLowerCase()) || null
}

// Exact-key lookup exposed for the unified cortex's :knowledge tier.
export function knowledgeLookup(key) {
  return lookup(key)
}

// Token-overlap search across the four graphs. Returns up to `limit` distinct
// node objects, ranked by how many query tokens hit each node's
// canonical / synonyms / associations / definition. The cortex's RAG tier.
export function knowledgeSearch(query, limit = 8) {
  if (INDEX === null) INDEX = buildIndex()
  const tokens = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (!tokens.length) return []
  const scored = new Map() // node -> score, deduped by node identity
  for (const node of new Set(INDEX.values())) {
    const hay = (
      node.canonical + ' ' +
      node.synonyms.join(' ') + ' ' +
      node.associations.join(' ') + ' ' +
      node.definition
    ).toLowerCase()
    let score = 0
    for (const t of tokens) {
      if (node.canonical.toLowerCase() === t) score += 5
      else if (hay.includes(t)) score += 1
    }
    if (score > 0) scored.set(node, score)
  }
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([node, score]) => ({ node, score }))
}

// Coerce a Scheme arg to its lookup string: symbols/keywords -> name,
// strings -> themselves. Keyword args like :movement are axis hints in the
// books; the real key is the trailing symbol, so callers pass the last arg.
const asKey = (x) => (x instanceof Sym ? x.name : String(x))

// Strip a leading ':' so `(world/knowledge :movement 'bebop)` and
// `(world/knowledge 'bebop)` both resolve on 'bebop', and a lone keyword
// like ':row' resolves on 'row'.
const deColon = (s) => (s.length > 1 && s[0] === ':' ? s.slice(1) : s)

function nodeToAlist(node) {
  return [
    [kw(':id'), node.id],
    [kw(':axis'), node.axis],
    [kw(':canonical'), node.canonical],
    [kw(':definition'), node.definition],
    [kw(':synonyms'), node.synonyms.slice()],
    [kw(':associations'), node.associations.slice()],
  ]
}

export function installWorldKnowledge(env) {
  // (world/knowledge key) or (world/knowledge :hint key)
  //   key: a symbol/keyword/string naming a concept.
  //   Returns an alist ((:id ..) (:canonical ..) (:definition ..)
  //   (:synonyms ..) (:associations ..)) drawn from the four Jung graphs,
  //   or #f when the concept has no node (honest-null).
  env.define('world/knowledge', (...args) => {
    if (args.length === 0) return false
    // Last arg is the concept; earlier args (if any) are axis/category hints.
    const key = deColon(asKey(args[args.length - 1]))
    const node = lookup(key)
    return node ? nodeToAlist(node) : false
  }, { perm: 'read' })

  // (world/knows? key) — cheap membership test, #t/#f.
  env.define('world/knows?', (...args) => {
    if (args.length === 0) return false
    return lookup(deColon(asKey(args[args.length - 1]))) !== null
  }, { perm: 'read' })

  // (motoi/say text) — persona aside. Motoi thinking out loud to the child.
  // Prints the line and returns the string so it composes in a program.
  env.define('motoi/say', (...parts) => {
    const text = parts.map((p) => (p instanceof Sym ? p.name : String(p))).join('')
    process.stdout.write(text + '\n')
    return text
  }, { perm: 'read' })
}
