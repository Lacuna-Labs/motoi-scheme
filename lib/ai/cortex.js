// cortex.js — Motoi's unified Cortex: ONE extensible slatl record schema
// over the whole brain. World knowledge (the four Jung graphs, read-only)
// and episodic memory (what Motoi has been told, prunable) answer through the
// same retrieval surface. This is the OPEN cortex; Curator ships a Rust one
// that reads the same public graphs and reaches further.
//
// Doctrine (Alfred, 2026-07-25): "put the 4 in some slatl schema and make a
// Cortex slatl that is universally useful. And teach the LLM to use it for
// rag. And allow pruning of memory. Use a schema that it can use. And one
// that's extensible and let the LLM use it."
//
// ── The record schema (extensible) ──────────────────────────────────────
// The store `~/motoi/cortex.slatl` is line-delimited (cortex-record …) forms:
//
//   (cortex-record
//     :kind       :memory        ; :memory | :fact | :episode | <anything>
//     :id         "mem-1721.."   ; unique; auto-assigned if omitted
//     :key        "high-score"   ; optional exact-recall handle
//     :text       "the body"     ; the searchable content (RAG matches here)
//     :tags       ("game" "won") ; optional
//     :salience   0.7            ; 0..1 keep-weight for pruning (default 0.5)
//     :ts         1721900000000  ; epoch ms, set on write
//     :data       ((:score 4200)); arbitrary extensible payload (alist)
//     :provenance "cortex/remember")
//
// Unknown fields round-trip untouched; unknown :kind values store fine. That
// is the extensibility contract — the model may invent kinds and fields, and
// the cortex keeps them. Knowledge records are VIRTUAL: they are not written
// into the file (that would re-serialize 450 KB of graph on every memory
// write — "bad to graph"); they are read live from the four graphs and merged
// into search/recall results as :kind :knowledge.
//
// ── Edges (the graph half) ────────────────────────────────────────────────
// The same file also holds labeled edges — s-expressions are flexible, so
// (cortex-edge …) lines coexist with (cortex-record …) lines in one file:
//
//   (cortex-edge :from "mem-1" :to "mem-2" :label :selected-over :ts 172…)
//
// cortex/associate appends an edge; cortex/lookup walks edges by label. This
// is what makes the memory tier a graph, not just a flat KV log.
//
// ── Append-only ───────────────────────────────────────────────────────────
// New records and edges are APPENDED (the schema calls this tier an
// append-only log). Whole-file rewrite (writeAll) is reserved for compaction:
// upsert-by-key (remember/write), forget, and prune.

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Sym, parse } from '../../src/reader.js'
import { userCortexSlatlPath } from '../../src/paths.js'
import { knowledgeLookup, knowledgeSearch } from './world-knowledge.js'

import { isList, isPair, seqVerb } from '../base/list.js'
const PATH = userCortexSlatlPath()
const nm = (x) => (x instanceof Sym ? x.name : x)
const kw = (name) => new Sym(name)
const deColon = (s) => (s.length > 1 && s[0] === ':' ? s.slice(1) : s)

// ── slatl read/write ────────────────────────────────────────────────────

function ensureDir() {
  try {
    const d = dirname(PATH)
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
  } catch { /* soft-fail */ }
}

// A form (cortex-record :k v :k v …) parsed by the reader is an array:
// [Sym('cortex-record'), Sym(':k'), v, …]. Fold the kwargs into a plain
// object keyed by de-coloned field name. Values are left as reader values
// (Sym / string / number / boolean / nested arrays) and normalized on demand.
function formToRecord(form) {
  if (!isList(form) || !(form[0] instanceof Sym)) return null
  if (form[0].name !== 'cortex-record') return null
  const rec = {}
  for (let i = 1; i + 1 < form.length; i += 2) {
    const key = form[i] instanceof Sym ? deColon(form[i].name) : String(form[i])
    rec[key] = jsFromReader(form[i + 1])
  }
  return rec
}

// Reader value → plain JS: Sym → {sym:name} sentinel so we can re-emit it as a
// symbol; everything else passes through (arrays recurse).
function jsFromReader(v) {
  if (v instanceof Sym) return { sym: v.name }
  if (isList(v)) return v.map(jsFromReader)
  return v
}

// An alist round-trips out of the reader as [[{sym},v], …]. Field-filtering
// (query/topk) wants a plain object, and cortex/record writes data as an
// object, so re-object-ify alist-shaped values to keep fresh and persisted
// records identical. Non-alist values (scalars, plain lists) pass through.
function isAlist(v) {
  return isPair(v) && v.every(
    (e) => isList(e) && e.length === 2 && e[0] && typeof e[0].sym === 'string')
}
function objectifyAlists(v) {
  if (isAlist(v)) {
    const out = {}
    for (const [k, val] of v) out[deColon(k.sym)] = objectifyAlists(val)
    return out
  }
  if (isList(v)) return v.map(objectifyAlists)
  return v
}

function readAll() {
  try {
    if (!existsSync(PATH)) return []
    const src = readFileSync(PATH, 'utf8')
    let forms
    try { forms = parse(src) } catch { return [] }
    const out = []
    for (const f of forms) {
      const rec = formToRecord(f)
      if (rec) {
        if ('data' in rec) rec.data = objectifyAlists(rec.data)
        out.push(rec)
      }
    }
    return out
  } catch { return [] }
}

// A form (cortex-edge :from a :to b :label l …) → a plain edge object.
function formToEdge(form) {
  if (!isList(form) || !(form[0] instanceof Sym)) return null
  if (form[0].name !== 'cortex-edge') return null
  const e = {}
  for (let i = 1; i + 1 < form.length; i += 2) {
    const key = form[i] instanceof Sym ? deColon(form[i].name) : String(form[i])
    e[key] = jsFromReader(form[i + 1])
  }
  return e
}

function readEdges() {
  try {
    if (!existsSync(PATH)) return []
    const src = readFileSync(PATH, 'utf8')
    let forms
    try { forms = parse(src) } catch { return [] }
    const out = []
    for (const f of forms) {
      const e = formToEdge(f)
      if (e) out.push(e)
    }
    return out
  } catch { return [] }
}

// Serialize one JS value back to slatl text.
function slat(v) {
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (v === null || v === undefined) return '()'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return JSON.stringify(v) // safe quoting/escaping
  if (v && typeof v === 'object' && !isList(v) && typeof v.sym === 'string') {
    return v.sym // a symbol/keyword
  }
  if (isList(v)) return '(' + v.map(slat).join(' ') + ')'
  // Plain object (a payload map): emit as an alist ((:k v) …)
  return '(' + Object.entries(v).map(([k, val]) => `(:${k} ${slat(val)})`).join(' ') + ')'
}

const FIELD_ORDER = ['kind', 'id', 'key', 'text', 'tags', 'salience', 'ts', 'data', 'provenance']

function recordToForm(rec) {
  const keys = [
    ...FIELD_ORDER.filter((k) => k in rec),
    ...Object.keys(rec).filter((k) => !FIELD_ORDER.includes(k)), // extensible tail
  ]
  const body = keys.map((k) => `:${k} ${slat(rec[k])}`).join(' ')
  return `(cortex-record ${body})`
}

// Full-file rewrite (compaction only). Edges are preserved untouched — a
// records-only compaction (prune/forget/upsert) must not erase the graph, so
// existing edges are read back and re-emitted unless the caller passes its own.
function writeAll(records, edges) {
  try {
    ensureDir()
    const keptEdges = edges || readEdges()
    const lines = [
      ';; motoi cortex.slatl — unified brain (memory tier). World knowledge is',
      ';; virtual (read from graphs/graph-of-*.slat), not stored here.',
      ...records.map(recordToForm),
      ...keptEdges.map(edgeToForm),
    ]
    writeFileSync(PATH, lines.join('\n') + '\n', 'utf8')
    return true
  } catch { return false }
}

const HEADER =
  ';; motoi cortex.slatl — unified brain (memory tier). World knowledge is\n' +
  ';; virtual (read from graphs/graph-of-*.slat), not stored here.\n'

// Append a single already-serialized form as its own line. The memory tier is
// an append-only log — a new record/edge costs one write, not a whole-file
// re-serialize. Compaction (upsert/forget/prune) still routes through writeAll.
function appendForm(text) {
  try {
    ensureDir()
    let prefix = ''
    if (existsSync(PATH)) {
      const cur = readFileSync(PATH, 'utf8')
      if (cur.length && !cur.endsWith('\n')) prefix = '\n'
    } else {
      prefix = HEADER
    }
    appendFileSync(PATH, prefix + text + '\n', 'utf8')
    return true
  } catch { return false }
}

const EDGE_ORDER = ['from', 'to', 'label', 'ts']

function edgeToForm(e) {
  const keys = [
    ...EDGE_ORDER.filter((k) => k in e),
    ...Object.keys(e).filter((k) => !EDGE_ORDER.includes(k)),
  ]
  const body = keys.map((k) => `:${k} ${slat(e[k])}`).join(' ')
  return `(cortex-edge ${body})`
}

// ── value marshalling for the Scheme boundary ─────────────────────────────

// Scheme arg → JS payload value (Sym → {sym}, arrays recurse, else as-is).
const fromScheme = (v) => {
  if (v instanceof Sym) return { sym: v.name }
  if (isList(v)) return v.map(fromScheme)
  return v
}
// JS payload value → Scheme value (inverse). Plain payload objects (the :data
// map) become Scheme alists so a program can traverse them; {sym} sentinels
// become symbols/keywords; arrays recurse.
const toScheme = (v) => {
  if (v && typeof v === 'object' && !isList(v)) {
    if (typeof v.sym === 'string') return kw(v.sym)
    return Object.entries(v).map(([k, val]) => [kw(':' + k), toScheme(val)])
  }
  if (isList(v)) return v.map(toScheme)
  return v
}

// Turn a stored record into a Scheme alist ((:kind ..) (:text ..) …).
function recordToAlist(rec) {
  const keys = [
    ...FIELD_ORDER.filter((k) => k in rec),
    ...Object.keys(rec).filter((k) => !FIELD_ORDER.includes(k)),
  ]
  return keys.map((k) => [kw(':' + k), toScheme(rec[k])])
}

// A graph node → a virtual :knowledge record (for search/recall merges).
function knowledgeAlist(node) {
  return [
    [kw(':kind'), kw(':knowledge')],
    [kw(':id'), node.id],
    [kw(':axis'), node.axis],
    [kw(':key'), node.canonical],
    [kw(':text'), node.definition],
    [kw(':synonyms'), node.synonyms.slice()],
    [kw(':associations'), node.associations.slice()],
  ]
}

// kwargs (:k v :k v …) → JS object with de-coloned keys, payload-marshalled.
function kwargs(args) {
  const out = {}
  for (let i = 0; i + 1 < args.length; i += 2) {
    const key = args[i] instanceof Sym ? deColon(args[i].name) : String(args[i])
    out[key] = fromScheme(args[i + 1])
  }
  return out
}

// Plain scalar view of a payload value for equality filtering / display.
const scalar = (v) => (v && typeof v === 'object' && typeof v.sym === 'string' ? v.sym : v)

// Best-effort text a record exposes to token search.
function recordText(rec) {
  const parts = []
  if (typeof rec.text === 'string') parts.push(rec.text)
  if (typeof rec.key === 'string') parts.push(rec.key)
  if (isList(rec.tags)) parts.push(rec.tags.map(scalar).join(' '))
  if (rec.data && typeof rec.data === 'object') parts.push(JSON.stringify(rec.data))
  return parts.join(' ').toLowerCase()
}

// ── install ───────────────────────────────────────────────────────────────

export const VERBS = [
  'cortex/search', 'cortex/recall', 'cortex/remember', 'cortex/record',
  'cortex/query', 'cortex/topk', 'cortex/read', 'cortex/write',
  'cortex/forget', 'cortex/prune', 'cortex/keys', 'cortex/size',
  'cortex/associate', 'cortex/lookup',
]
export const LAZY = false

export function installCortex(env) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  const nextId = () => `mem-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

  // ── retrieval (RAG) ──────────────────────────────────────────────────
  //
  // (cortex/search query [k]) → up to k records (memory + knowledge) ranked
  // by token overlap. THE verb the model calls to ground an answer: search,
  // read the returned :text, compose. Default k = 8.
  def('cortex/search', (query, k) => {
    const kk = Math.max(1, Number(k) || 8)
    const q = String(nm(query)).toLowerCase()
    const tokens = q.split(/[^a-z0-9]+/).filter(Boolean)
    // memory tier
    const mem = readAll().map((rec) => {
      const hay = recordText(rec)
      let score = 0
      for (const t of tokens) if (hay.includes(t)) score += 1
      return { alist: recordToAlist(rec), score }
    }).filter((x) => x.score > 0)
    // knowledge tier (virtual, from the four graphs)
    const kno = knowledgeSearch(q, kk).map(({ node, score }) => ({
      alist: knowledgeAlist(node), score,
    }))
    return [...mem, ...kno]
      .sort((a, b) => b.score - a.score)
      .slice(0, kk)
      .map((x) => x.alist)
  })

  // (cortex/recall key) → one record's alist, or #f. Checks memory keys
  // first, then world knowledge. Honest-#f when nothing is known.
  def('cortex/recall', (key) => {
    const k = String(nm(key))
    const hit = readAll().find((r) => r.key === k || r.id === k)
    if (hit) return recordToAlist(hit)
    const node = knowledgeLookup(deColon(k))
    return node ? knowledgeAlist(node) : false
  })

  // ── write ────────────────────────────────────────────────────────────
  //
  // (cortex/remember key value [:tags (...)] [:salience s]) → #t.
  // Upserts a keyed :memory record. value becomes :text if a string, else
  // :data. Re-remembering the same key replaces it.
  def('cortex/remember', (key, value, ...rest) => {
    const k = String(nm(key))
    const extra = kwargs(rest)
    const records = readAll().filter((r) => r.key !== k)
    const rec = {
      kind: { sym: ':memory' },
      id: nextId(),
      key: k,
      ts: Date.now(),
      salience: 'salience' in extra ? Number(scalar(extra.salience)) : 0.5,
      provenance: 'cortex/remember',
      ...extra,
    }
    if (typeof value === 'string') rec.text = value
    else rec.data = fromScheme(value)
    records.push(rec)
    return writeAll(records)
  }, 'paint')

  // (cortex/record :k v :k v …) → #t. Appends a free-form :memory record.
  def('cortex/record', (...args) => {
    const data = kwargs(args)
    const kindVal = 'kind' in data ? data.kind : { sym: ':memory' }
    const rec = {
      kind: kindVal,
      id: nextId(),
      ts: Date.now(),
      salience: 'salience' in data ? Number(scalar(data.salience)) : 0.5,
      provenance: 'cortex/record',
      data,
    }
    if (typeof scalar(data.text) === 'string') rec.text = scalar(data.text)
    return appendForm(recordToForm(rec))
  }, 'paint')

  // (cortex/query :k v …) → memory records whose :data matches every pair.
  def('cortex/query', (...args) => {
    const filter = kwargs(args)
    return readAll()
      .filter((r) => r.data && typeof r.data === 'object')
      .filter((r) => Object.entries(filter).every(
        ([k, v]) => scalar(r.data[k]) === scalar(v)))
      .map((r) => recordToAlist(r))
  })

  // (cortex/topk k :k v …) → k most-recent memory records matching filter.
  def('cortex/topk', (k, ...args) => {
    const kk = Math.max(1, Number(k) || 5)
    const filter = args.length ? kwargs(args) : null
    return readAll()
      .filter((r) => !filter || (r.data && Object.entries(filter).every(
        ([k2, v]) => scalar(r.data[k2]) === scalar(v))))
      .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
      .slice(0, kk)
      .map((r) => recordToAlist(r))
  })

  // (cortex/read key) → value stored by remember (:text or :data), or #f.
  def('cortex/read', (key) => {
    const k = String(nm(key))
    const hit = readAll().find((r) => r.key === k)
    if (!hit) return false
    if (typeof hit.text === 'string') return hit.text
    return hit.data !== undefined ? toScheme(hit.data) : true
  })

  // (cortex/write key value) → #t. Alias of remember for KV callers.
  def('cortex/write', (key, value) => {
    const k = String(nm(key))
    const records = readAll().filter((r) => r.key !== k)
    const rec = {
      kind: { sym: ':memory' }, id: nextId(), key: k, ts: Date.now(),
      salience: 0.5, provenance: 'cortex/write',
    }
    if (typeof value === 'string') rec.text = value
    else rec.data = fromScheme(value)
    records.push(rec)
    return writeAll(records)
  }, 'paint')

  // (cortex/forget key) → #t if a memory record was dropped, else #f.
  def('cortex/forget', (key) => {
    const k = String(nm(key))
    const records = readAll()
    const kept = records.filter((r) => r.key !== k && r.id !== k)
    if (kept.length === records.length) return false
    writeAll(kept)
    return true
  }, 'paint')

  // ── graph edges (the memory tier is a graph, not just a KV log) ───────
  //
  // (cortex/associate from to label) → #t. Appends a labeled edge from → to.
  // `from`/`to` are record keys or ids; `label` is a relation symbol
  // (e.g. :selected-over, :evidence, :instance-of).
  def('cortex/associate', (from, to, label) => {
    const e = {
      from: String(nm(from)),
      to: String(nm(to)),
      label: fromScheme(label),
      ts: Date.now(),
    }
    return appendForm(edgeToForm(e))
  }, 'paint')

  // (cortex/lookup key [label]) → list of edge targets out of key (optionally
  // filtered by label), or #f when no such edge is known. Walks the edge store.
  def('cortex/lookup', (key, label) => {
    const k = String(nm(key))
    const wantLabel = label === undefined ? null : scalar(fromScheme(label))
    const hits = readEdges().filter(
      (e) => scalar(e.from) === k && (wantLabel === null || scalar(e.label) === wantLabel))
    if (!hits.length) return false
    return hits.map((e) => scalar(e.to))
  })

  // ── pruning (memory hygiene — never touches knowledge) ────────────────
  //
  // (cortex/prune [:older-than ms] [:min-salience s] [:keep n]) → count pruned.
  //   :older-than ms   drop memory records with ts older than (now - ms)
  //   :min-salience s  drop memory records with salience < s
  //   :keep n          after the above, keep only the n most-recent
  // With no args, a gentle default: drop salience < 0.1 (scratch thoughts).
  def('cortex/prune', (...args) => {
    const opt = kwargs(args)
    let records = readAll()
    const before = records.length
    const now = Date.now()
    if ('older-than' in opt) {
      const cutoff = now - Number(scalar(opt['older-than']))
      records = records.filter((r) => (Number(r.ts) || 0) >= cutoff)
    }
    const minSal = 'min-salience' in opt ? Number(scalar(opt['min-salience'])) : (args.length ? -Infinity : 0.1)
    records = records.filter((r) => (Number(r.salience) ?? 0.5) >= minSal)
    if ('keep' in opt) {
      const n = Math.max(0, Number(scalar(opt.keep)) | 0)
      records = records.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0)).slice(0, n)
    }
    writeAll(records)
    return before - records.length
  }, 'paint')

  // (cortex/keys) → list of memory keys.
  def('cortex/keys', () => readAll().map((r) => r.key).filter((k) => typeof k === 'string'))

  // (cortex/size) → number of stored memory records (knowledge is not counted).
  def('cortex/size', () => readAll().length)

  return env
}

// ── programmatic host API (for the copilot's reasoning-loop persistence) ─────
// The copilot's ReasoningStore is in-memory; these let a host round-trip its
// reasoning records (traces / skills / person-profiles) through the ONE
// cortex.slatl so the copilot remembers ACROSS sessions what it did and whether
// it did the right thing. Confined by construction: PATH is always
// ~/motoi/copilot/cortex.slatl — the copilot cannot write anywhere else.
// Append-only (one record = one line, no whole-file rewrite); soft-fails.
export function cortexAppendRecord(rec) {
  if (!rec || typeof rec !== 'object') return false
  return appendForm(recordToForm(rec))
}
export function cortexReadRecords() { return readAll() }
export function cortexPath() { return PATH }

export default installCortex
