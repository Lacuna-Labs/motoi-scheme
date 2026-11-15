// inventory.mjs — THE CART INVENTORY. Owns: reading every cart header in a carts tree (serving, drafts/, attic/, desk/,
// templates/), the deterministic `carts/INDEX.slat` built from those headers, `exam/units.jsonl` (one unit per exam id),
// the loose-file moves into drafts/ and attic/, retirement to attic/, and the nearest-cart refusal at similarity 0.85.
// Refuses: a duplicate cart (a candidate within 0.85 of a serving one: exit 12, one sentence), a move that would
// overwrite a file, a retire of a cart that is not serving. It never runs a cart and never calls the foreman's /check.
// Implements: LACUNA-3.0-DESIGN §12.3 (index, siblings, nearest-cart refusal, retire), §12.4 (units.jsonl from the
// headers; the trial refuses an exam id with no unit), §7.9 (the exam-unit form), architecture ch. 5 §5.8.
// Invariants (§18): none of the twelve directly; it feeds "a claim is not a record" by marking every generated unit
// `curated: false` so a generated unit is never read as a passed exam. Faults (§16): F-02 (a header that does not read
// is listed with its refusal sentence, state draft).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { readCart } from './cart.mjs'
import { brainOver } from './cascade.mjs'
import { parse, Sym, toJson } from './scheme.mjs'

/** The sibling directories of a carts tree and the state each one gives its carts (design §12.3). */
export const PLACES = Object.freeze({ '.': 'serving', drafts: 'draft', attic: 'retired', desk: 'serving', templates: 'template' })
/** The five 3.0 header fields every cart carries (lane C done-rule; design §12.1). */
export const FIELDS_3 = Object.freeze(['version', 'restart', 'deadlines', 'contract', 'sentry'])
/** Similarity at or above which a new cart is refused as a duplicate (design §12.3). */
export const NEAR = 0.85

const unquote = (f) => (Array.isArray(f) && f[0] instanceof Sym && f[0].name === 'quote' ? f[1] : f)

// A header entry `(k . v)` reads as [k, …rest]: one value, an alist (every item a list), or a list of words.
function value(rest) {
  if (!rest.length) return null
  if (rest.length === 1 && !Array.isArray(rest[0])) return rest[0]
  // one entry or many: `(minds (label …))` is an alist of one
  if (rest.every((x) => Array.isArray(x) && x.length)) return Object.fromEntries(rest.map((x) => [String(x[0]), value(x.slice(1))]))
  return rest.map(String)
}

/**
 * Every header field as written, including the 3.0 fields `readCart` does not return yet (K owns cart.mjs).
 * @param {string} program the cart's text
 * @returns {Object<string, *>} field → value; `{}` when the first form is not a header
 */
export function headerFields(program) {
  let head
  try { head = parse(String(program || ''))[0] } catch { return {} }
  if (!Array.isArray(head) || !(head[0] instanceof Sym) || head[0].name !== 'lacuna-cart') return {}
  const out = {}
  for (const e of toJson(unquote(head[2])) || []) if (Array.isArray(e) && e.length) out[String(e[0])] = value(e.slice(1))
  return out
}

/** The author column (design §12.3): the header's `(author . …)`, else cart_gen.py's line marks the 26B, else claude. */
function authorOf(program, fields) {
  if (fields.author) return String(fields.author)
  return /^;;.*by the 26B \(cart_gen\.py\)/m.test(program) ? '26b' : 'claude'
}

/** The text a cart is found by: what it does, its done sentence and each mind's ask (ch. 5 §5.8 "found by meaning"). */
function meaningOf(program, header) {
  const asks = [...String(program).matchAll(/:ask\s+"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
  return [header?.does || '', header?.done || '', ...asks].join(' ')
}

/**
 * Read one cart file into an index row; a header that does not read becomes a draft row carrying the refusal.
 * @param {string} path the `.sks` file
 * @param {{place?: string, tables?: Object, units?: Set<string>, runs?: Map<string, Object>}} opts
 * @returns {Object} the row (plain data; `meaning` is kept in memory, never written to the index)
 */
export function readRow(path, { place = '.', tables = {}, units = new Set(), runs = new Map() } = {}) {
  // a file that does not read (EACCES, EISDIR) is a draft row with the reason, never a throw that stops the whole scan
  let program = ''
  let unread = null
  try { program = readFileSync(path, 'utf8') } catch (e) { unread = `the file does not read: ${e.code}` }
  const fields = headerFields(program)
  const hash = createHash('sha256').update(program).digest('hex').slice(0, 12)
  let header = null
  let problem = null
  try { header = readCart(program, tables) } catch (e) { problem = unread || String(e.message).slice(0, 240) }
  const name = header?.name || basename(path).replace(/\.sks.*$/, '')
  const minds = Object.entries(header?.minds || {}).map(([job, m]) => `${job} ${m.job}${m.role ? ` role=${m.role}` : ''} served=${m.model}`)
  const allowed = new Set((tables.box?.agent_minds || []).map((m) => String(m).replace(/:latest$/, '')))
  const fits = !allowed.size || Object.values(header?.minds || {}).every((m) => allowed.has(m.model) || m.role === m.model)
  const state = problem && PLACES[place] === 'serving' ? 'draft' : PLACES[place] || 'draft'
  const exam = header?.exam || (fields.exam == null ? null : String(fields.exam))
  const last = runs.get(name) || null
  return {
    name, place, path, state, problem, hash, version: fields.version ?? null, tier: header?.tier || null,
    restart: fields.restart == null ? null : String(fields.restart),
    sentry: fields.sentry && typeof fields.sentry === 'object' ? String(fields.sentry.cart ?? 'none') : fields.sentry ? String(fields.sentry) : 'none',
    minds, acts: header?.acts || [], exam, unit: exam ? units.has(exam) : false,
    last: last ? `${last.outcome || last.state} ${last.at}` : null, runs: last ? last.runs : 0,
    firstTry: null, final: null, fit: fits ? 'fits' : 'no-fit', author: authorOf(program, fields),
    missing: FIELDS_3.filter((f) => !(f in fields)), meaning: meaningOf(program, header),
  }
}

/**
 * The newest run of each cart from the foreman's worker records (`~/lacuna-world/foreman/workers/*.json`).
 * @param {string} dir the workers directory
 * @returns {Map<string, {outcome: string, state: string, at: string, runs: number}>}
 */
export function lastRuns(dir) {
  const out = new Map()
  if (!existsSync(dir)) return out
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    let r
    try { r = JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch { continue }
    const name = r.cart?.name
    if (!name) continue
    const t = Number(r.cart.started || r.started || 0)
    const was = out.get(name)
    const runs = (was?.runs || 0) + 1
    if (!was || t >= was.t) out.set(name, { outcome: r.cart.outcome || null, state: r.state, at: new Date(t * 1000).toISOString().slice(0, 16), t, runs })
    else was.runs = runs
  }
  return out
}

/**
 * Every cart in a carts tree, top level and siblings, sorted by place then name (deterministic).
 * @param {string} root the carts directory
 * @param {Object} opts passed to readRow
 * @returns {Object[]} rows
 */
export function scanCarts(root, opts = {}) {
  const rows = []
  for (const place of Object.keys(PLACES)) {
    const dir = place === '.' ? root : join(root, place)
    if (!existsSync(dir)) continue
    // a link that points nowhere is no file (statSync would throw ENOENT and stop the scan)
    for (const f of readdirSync(dir).sort()) if (f.endsWith('.sks') && statSync(join(dir, f), { throwIfNoEntry: false })?.isFile()) rows.push(readRow(join(dir, f), { ...opts, place }))
  }
  return rows
}

const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
const slat = (v) => (v == null ? '#f' : typeof v === 'boolean' ? (v ? '#t' : '#f') : typeof v === 'number' ? String(v)
  : Array.isArray(v) ? `(${v.map(slat).join(' ')})` : q(v))
const INDEX_KEYS = ['name', 'version', 'hash', 'state', 'place', 'tier', 'restart', 'author', 'exam', 'unit', 'minds', 'acts',
  'sentry', 'last', 'runs', 'firstTry', 'final', 'fit', 'missing', 'problem']

/**
 * The text of `carts/INDEX.slat`: one `(index …)` line, then one `(cart …)` line per cart, in scan order. No clock in
 * it: the same headers give the same bytes (design §12.3 "regenerated deterministically").
 * @param {Object[]} rows from scanCarts
 * @returns {string}
 */
export function indexText(rows) {
  const lines = rows.map((r) => `(cart ${INDEX_KEYS.map((k) => `:${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} ${slat(r[k])}`).join(' ')})`)
  const count = (s) => rows.filter((r) => r.state === s).length
  const digest = createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 12)
  return [`;; carts/INDEX.slat — generated by lacuna-foreman/inventory.mjs from the headers; never edited by hand.`,
    `(index :v 1 :carts ${rows.length} :serving ${count('serving')} :draft ${count('draft')} :retired ${count('retired')} :template ${count('template')} :hash ${q(digest)})`,
    ...lines].join('\n') + '\n'
}

/**
 * One exam unit per exam id named by a header (design §7.9 `{id, cart, class, input, expect, check, gold}`). A curated
 * unit (from `carts/units.json`) is used as written; any other id gets a generated unit marked `curated: false`.
 * @param {Object[]} rows from scanCarts
 * @param {Object<string, Object>} curated exam id → unit
 * @returns {Object[]} units sorted by id
 */
export function examUnits(rows, curated = {}) {
  const out = new Map()
  for (const r of rows) {
    if (!r.exam || r.state === 'template' || out.has(r.exam)) continue
    const c = curated[r.exam]
    out.set(r.exam, c ? { id: r.exam, cart: r.name, ...c, curated: true }
      : { id: r.exam, cart: r.name, class: 'done-sentence', input: null, expect: 'outcome pass',
          check: 'the run record says outcome pass and names the cart; generated from the header, not an exam yet', gold: false, curated: false })
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
}

/**
 * The moves that clean a carts tree's top level: `x.sks.draft` → `drafts/x.sks`; `x.sks.v1-…` → `attic/x.v1.sks`.
 * @param {string} root the carts directory
 * @returns {{from: string, to: string, why: string}[]}
 */
export function planMoves(root) {
  const out = []
  for (const f of existsSync(root) ? readdirSync(root).sort() : []) {
    const m = f.match(/^([a-z][a-z0-9-]*)\.sks\.(.+)$/)
    if (!m || !statSync(join(root, f), { throwIfNoEntry: false })?.isFile()) continue
    if (m[2] === 'draft') out.push({ from: join(root, f), to: join(root, 'drafts', `${m[1]}.sks`), why: 'a draft is never loaded unattended' })
    else {
      const v = m[2].match(/^(v\d+)/)
      out.push({ from: join(root, f), to: join(root, 'attic', `${m[1]}.${v ? v[1] : m[2]}.sks`), why: 'a kept version is retired to the attic' })
    }
  }
  return out
}

/**
 * Do the planned moves. Refuses any move whose target exists (nothing is overwritten).
 * @param {{from: string, to: string}[]} moves from planMoves
 * @returns {number} moves done
 * @throws {Error} "the move would overwrite …" (exit 12) before any file moves
 */
export function applyMoves(moves) {
  for (const m of moves) if (existsSync(m.to)) throw new Error(`the move would overwrite ${m.to}; nothing was moved`)
  for (const m of moves) { mkdirSync(dirname(m.to), { recursive: true }); renameSync(m.from, m.to) }
  return moves.length
}

/**
 * Retire a serving cart (design §12.3; ch. 5 §5.8.1): the file moves to `attic/<name>.v<N>.sks` with a dated line.
 * @param {string} root the carts directory
 * @param {string} name the cart
 * @param {string} why one sentence: successor, 30 idle days, or the owner's press
 * @param {string} date YYYY-MM-DD
 * @returns {string} the attic path
 * @throws {Error} when the cart is not serving or the attic already holds that version
 */
export function retireCart(root, name, why, date) {
  const from = join(root, `${name}.sks`)
  if (!existsSync(from)) throw new Error(`no serving cart ${name}; nothing was retired`)
  const text = readFileSync(from, 'utf8')
  const to = join(root, 'attic', `${name}.v${headerFields(text).version ?? 0}.sks`)
  if (existsSync(to)) throw new Error(`the attic already holds ${basename(to)}; nothing was retired`)
  mkdirSync(dirname(to), { recursive: true })
  writeFileSync(to, `;; retired ${date}: ${why}\n${text}`)
  unlinkSync(from)                                                   // written first, removed second: never zero copies
  return to
}

const words = (s) => String(s || '').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []
function cosine(a, b) {
  let dot = 0; let na = 0; let nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}
function termVectors(texts) {
  const vocab = [...new Set(texts.flatMap(words))].sort()
  const at = new Map(vocab.map((w, i) => [w, i]))
  return texts.map((t) => { const v = new Array(vocab.length).fill(0); for (const w of words(t)) v[at.get(w)]++; return v })
}

/**
 * The serving cart nearest in meaning to a candidate. With `embed` (the `nearness` hand: EmbeddingGemma, 768-d) the
 * similarity is by meaning; without it, by shared words, and the answer says so.
 * @param {string} text the candidate's does + done + asks
 * @param {Object[]} rows from scanCarts
 * @param {{embed?: function(string[]): Promise<number[][]>}} opts
 * @returns {Promise<{name: string|null, similarity: number, by: string}>}
 */
function sockEmbed(texts, sock) {
  return new Promise((resolve) => {
    const out = new Array(texts.length).fill(null)
    let got = 0; let buf = ''; let done = false
    const c = net.createConnection(sock)
    const end = (v) => { if (!done) { done = true; clearTimeout(t); c.destroy(); resolve(v) } }
    const t = setTimeout(() => end(null), 2000)
    c.on('error', () => end(null))
    c.on('data', (d) => {
      buf += d.toString('utf8')
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1)
        const idM = /\(id\s+"e(\d+)"\)/.exec(line), vecM = /\(vec\s+"([^"]+)"\)/.exec(line)
        if (!idM || !vecM) return end(null)
        out[Number(idM[1])] = vecM[1].trim().split(/\s+/).map(Number)
        if (++got === texts.length) return end(out)
      }
    })
    c.on('connect', () => {
      texts.forEach((txt, i) => c.write(`(embed (id "e${i}") (text "task: classification | query: ${String(txt).replace(/[\\"\n\r]/g, ' ')}"))\n`))
    })
  })
}

export async function nearestCart(text, rows, { embed = null, sock = process.env.LACUNA_EMBED_SOCK || null } = {}) {
  const serving = rows.filter((r) => r.state === 'serving' && r.meaning.trim())
  const autoEmbed = embed || (sock && existsSync(sock) ? (ts) => sockEmbed(ts, sock) : null)
  if (!serving.length) return { name: null, similarity: 0, by: autoEmbed ? 'embedding' : 'words' }
  const vs = (autoEmbed ? await autoEmbed([text, ...serving.map((r) => r.meaning)]) : null) || termVectors([text, ...serving.map((r) => r.meaning)])
  const usedEmbed = Boolean(autoEmbed && vs[0] && vs[0].length >= 4 && (!embed ? vs.length === serving.length + 1 : true))
  let best = { name: null, similarity: 0 }
  serving.forEach((r, i) => { const s = cosine(vs[0], vs[i + 1]); if (s > best.similarity) best = { name: r.name, similarity: Math.round(s * 1000) / 1000 } })
  return { ...best, by: embed ? 'embedding' : usedEmbed ? 'embedding' : 'words' }
}

/**
 * Refuse a candidate cart that duplicates a serving one (design §12.3; CARTS-ARE-THE-WORK "a cart never duplicates").
 * @param {string} program the candidate's text
 * @param {Object[]} rows from scanCarts
 * @param {Object} opts passed to nearestCart
 * @returns {Promise<{name: string|null, similarity: number, by: string}>} the nearest, when it is below NEAR
 * @throws {Error} exit 12: "a cart that does this already serves: …"
 */
export async function refuseNear(program, rows, opts = {}) {
  let header = null
  try { header = readCart(program, opts.tables || {}) } catch { /* a candidate that does not read is judged by its words */ }
  const f = headerFields(program)
  const text = meaningOf(program, header || { does: f.does, done: f.done })
  const near = await nearestCart(text, rows.filter((r) => r.name !== (header?.name || null)), opts)
  if (near.name && near.similarity >= NEAR)
    throw Object.assign(new Error(`a cart that does this already serves: ${near.name} (similarity ${near.similarity} by ${near.by}); extend it instead of writing a duplicate`), { exit: 12, near })
  return near
}

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }

// CLI: `node inventory.mjs [--write]` — scans the world's carts and this lane's carts; prints the summary and the moves;
// --write writes lacuna-foreman/carts/INDEX.slat and ~/lacuna-world/exam/units.jsonl. It never moves a file itself.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const world = process.env.LACUNA_WORLD || join(homedir(), 'lacuna-world')
  const lane = process.env.FOREMAN_CARTS || new URL('./carts/', import.meta.url).pathname   // a test points it at a scratch lane
  const box = brainOver(readJson(new URL('../../lacuna-box/brain/box-minds.json', import.meta.url).pathname), readJson(join(homedir(), '.lacuna', 'brain-profile.json')))
  const tables = { tiers: readJson(join(world, 'bench/agents/tiers.json')), box }   // the current brain's fields from the profile (order §1.5)
  const curated = readJson(join(lane, 'units.json')) || {}
  const runs = lastRuns(join(world, 'foreman/workers'))
  const scan = (dir, units) => scanCarts(dir, { tables, units, runs })
  const units = examUnits([...scan(join(world, 'carts')), ...scan(lane)], curated)
  const ids = new Set(units.map((u) => u.id))
  const worldRows = scan(join(world, 'carts'), ids)
  const laneRows = scan(lane, ids)
  for (const r of [...worldRows, ...laneRows]) console.log(`${r.state.padEnd(8)} ${r.name.padEnd(20)} v${r.version ?? '-'} ${r.exam || 'no-exam'}${r.problem ? ` — ${r.problem}` : ''}${r.missing.length ? ` · missing ${r.missing.join(' ')}` : ''}`)
  for (const m of planMoves(join(world, 'carts'))) console.log(`move ${m.from} → ${m.to} (${m.why})`)
  console.log(`${units.length} exam units (${units.filter((u) => u.curated).length} curated)`)
  if (process.argv.includes('--write')) {
    writeFileSync(join(lane, 'INDEX.slat'), indexText(laneRows))
    mkdirSync(join(world, 'exam'), { recursive: true })
    writeFileSync(join(world, 'exam', 'units.jsonl'), units.map((u) => JSON.stringify(u)).join('\n') + '\n')
    console.log(`wrote ${join(lane, 'INDEX.slat')} and ${join(world, 'exam', 'units.jsonl')}`)
  }
}
