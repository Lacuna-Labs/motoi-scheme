// CAPABILITIES — owns which verbs a worker holds (report, hand, spawn, ask …); the pure helpers (get, take, recall, now …) are free.
// Owns: the verb set per worker; the tier bound; the subset rule for children; the no-acting-verb mark for untrusted readers.
// Refuses: `ask` outside an act worker; a child set wider than its parent's (refused with a sentence, never widened); any acting
//   verb for a worker that reads untrusted text (pages, logs, mail, audio) — its children inherit the mark.
// Implements: design §11 (security: capabilities only shrink; quarantine); keeps LACUNA-1.3-DESIGN §36 as history.
// Invariants (§18): none written here; the untrusted-reader rule enforces law 11 (untrusted input never triggers an act).
// Faults (§16): F-02 (a verb the header or tier does not hold is refused, exit 12), by sentence not by id.
import { readFileSync } from 'node:fs'
import { parse } from './scheme.mjs'
import { readVerbTable } from './verb-table.mjs'

// the table's source is verbs.slat (K1.13); verbs.json is its generated copy for the retiring API
export const VERBS = readVerbTable(readFileSync(new URL('./verbs.slat', import.meta.url), 'utf8')).verbs
const TIER_OF = new Map(VERBS.map((v) => [v.name, v.tier]))

// Verbs that never leave the worker: always held, never counted as a capability.
export const PURE = new Set(['on', 'recall', 'get', 'take', 'sort-by', 'now', 'my-name', 'my-gen', 'my-slot', 'display', 'newline', 'stop', 'mind-job',
                              'done', 'lacuna-cart'])   // a cart may always retire itself; its header is data
// Verbs that make something happen beyond reporting: a new process, a contract, another worker's turn, the executive's
// attention. need-brain is here because it hands the reader's words to the 26B — the privileged mind must never read
// what a quarantined one read (the dual-LLM rule), only its labels.
export const ACTING = new Set(['spawn', 'ask', 'send-to', 'need-brain', 'act', 'file', 'work-order'])   // + work-order: a mind's attention (E14 row 11)
// Every op `hand` has today is a READ done by Lacuna. A hand op with effects would be acting; none exists, and an
// unknown op is refused for a quarantined worker rather than guessed at.
export const HAND_READS = new Set(['triggers', 'bundles', 'bundle-verify', 'forge-runs', 'cart-lint', 'queue', 'wake-state', 'health-facts', 'contract', 'design', 'read', 'find', 'nearness',   // read · find · nearness: the hands table had them, this set did not (2026-10-23)
                                    'port', 'knn', 'memory', 'pointing-at', 'like', 'since', 'fading', 'trail','overview', 'disk', 'disk-eaters', 'services', 'service', 'service-log', 'watchdogs', 'box-watchdogs', 'memory-audit', 'alerts', 'errors', 'jobs', 'carts', 'cart-run', 'builds', 'release-board', 'release', 'health', 'mocks', 'devices', 'escalations', 'minds', 'roles', 'recall', 'work', 'battery-runs', 'caliper', 'eye', 'sentinel', 'petitions', 'owner-here', 'brain', 'usage', 'drills',
                                    'job', 'repos', 'git-status', 'git-log', 'branches', 'disk-usage', 'files', 'tail-log', 'read-zst',
                                    'battery-last', 'battery-status', 'codemap', 'release-sort', 'cart-record', 'outline', 'scripts', 'doc-drift', 'hand-times', 'ui-times', 'box-cost', 'cold-links', 'eye-tree', 'form-probe', 'cloud-review', 'cloud-plan', 'cloud-wiki', 'cloud-merge', 'cloud-mocks', 'self-repair-check',
                                    'web-search', 'read-page', 'procs', 'coast-sample', 'grep', 'ask-cloud', 'code-where', 'floor-events', 'floor-fold', 'floor-assay', 'floor-probe', 'ten-rehearsal',
                                    'sh', 'scheme', 'look-up', 'git', 'test'])   // + sh: one command off the hands' allow-list, argv only, under J0 (finale §3.11 unit 2); + scheme and look-up through the Agents Room's runner (unit 4); + git, a mind's moves in its own clone (§3.19)   // + code-where (M10: the code graph)   // + grep (L8: the owner's desk searched files by shell)   // the desk's web (L8, through the door) · J1's procs and coast · H1.4 floor reads · 5.2 ten-rehearsal

const RANK = { watch: 0, act: 1 }
export const governed = () => VERBS.map((v) => v.name).filter((n) => !PURE.has(n))

/** The verbs a tier allows (its ceiling). */
export function tierVerbs(tier) {
  // a verb whose tier the table does not rank is held by no tier (fail closed; U1 2026-10-24: a typo'd tier ranked as watch)
  return governed().filter((n) => (RANK[TIER_OF.get(n)] ?? Infinity) <= (RANK[tier] ?? 0))
}

const names = (xs) => [...new Set(xs.map((x) => String(x && x.name ? x.name : x)))]

/**
 * The set a new worker holds. `asked` is what the spawner asked for (null: everything it may have). The ceiling is the
 * tier's verbs, then the parent's set, then — when it reads untrusted text — nothing that acts.
 * Throws a sentence when the ask is wider than the ceiling: a set only shrinks.
 */
export function capsFor({ name = 'worker', tier, asked = null, parent = null, readsUntrusted = false }) {
  let ceiling = tierVerbs(tier)
  if (parent) ceiling = ceiling.filter((v) => parent.verbs.has(v))
  if (readsUntrusted) ceiling = ceiling.filter((v) => !ACTING.has(v))
  if (asked == null) return new Set(ceiling)
  const want = names(asked).filter((v) => !PURE.has(v))
  const unknown = want.filter((v) => !TIER_OF.has(v))
  if (unknown.length) throw new Error(`${name} asks for verbs that do not exist: ${unknown.join(', ')}`)
  const wider = want.filter((v) => !ceiling.includes(v))
  if (wider.length) {
    const why = readsUntrusted && wider.some((v) => ACTING.has(v)) ? 'it reads untrusted text, so it may not act'
              : parent ? `its parent ${parent.name} does not hold ${wider.length > 1 ? 'them' : 'it'}`
              : `${/^[aeiou]/i.test(String(tier)) ? 'an' : 'a'} ${tier} worker may not have ${wider.length > 1 ? 'them' : 'it'}`
    throw new Error(`${name} may not have ${wider.join(', ')} — ${why}; a worker's verbs only shrink`)
  }
  return new Set(want)
}

/**
 * Every string literal written in a program's text. A worker may spawn a child only from one of these: the child's
 * program was written at plan time by whoever wrote the parent (the 26B, seen on a permission card), never assembled
 * from what arrived later — runtime data never becomes code.
 */
export function literalStrings(program) {
  const out = new Set()
  const walk = (f) => { if (typeof f === 'string') out.add(f); else if (Array.isArray(f)) f.forEach(walk) }
  try { parse(program).forEach(walk) } catch { /* a program that does not read has no literals */ }
  return out
}
