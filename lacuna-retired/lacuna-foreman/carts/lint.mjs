// lint.mjs — THE CART LINT, as code (architecture ch. 5 §5.10 row 8; §5.13.3 blueprint 1: "the check is code, not a
// 270M"). Owns: the findings the `cart-lint` cart reports, one row per fault: `{cart, kind, says}`. Kinds: refused ·
// duplicate-handler · unbenched-class · label-drift · dangling-exam · no-exam · missing-fields · no-touches ·
// unused-verb · unasked-judgment · unbumped-version · orphan-worker · prose-done (a cart that ends, its body calling
// `(done …)`, whose done-check is words: no run of it can pass; E14 §5 row 18, product-03: ipad-verify's alert every
// six hours). Refuses: nothing; it reads and never writes, never runs a cart. Implements: LACUNA-3.0-DESIGN §12.1
// (header fields), §12.3 (version bump, orphans retired on sweep), §12.4 (the trial refuses an exam id with no unit);
// P3 gate "cart-lint finds 10 planted faults". Invariants (§18): none directly. Faults (§16): it names F-02 causes (a
// header that does not hold) before a run meets them.
import { readFileSync } from 'node:fs'
import { headerFields, lastRuns, scanCarts } from '../inventory.mjs'
import { parse, Sym } from '../scheme.mjs'
import { PURE } from '../capabilities.mjs'

const head = (f) => (Array.isArray(f) && f[0] instanceof Sym ? f[0].name : null)
const unquote = (f) => (head(f) === 'quote' ? f[1] : f)
const nameOf = (x) => (x instanceof Sym ? x.name : String(x))
const list = (x) => (Array.isArray(x) ? x.map(String) : x == null || x === false ? [] : [String(x)])

/** Every call head in the body (data under quote is not walked), and every (need-brain 'point …) point. */
function calls(forms) {
  const heads = new Set()
  const points = new Set()
  const walk = (f) => {
    if (!Array.isArray(f) || !f.length) return
    const h = head(f)
    if (h === 'quote' || h === 'quasiquote') return
    if (h) heads.add(h)
    if (h === 'need-brain' && head(f[1]) === 'quote') points.add(nameOf(f[1][1]))
    f.forEach(walk)
  }
  forms.forEach(walk)
  return { heads, points }
}

/** The labels each (mind-job 'job '(… :labels (a b) …)) names, by job. */
function jobLabels(forms) {
  const out = {}
  for (const f of forms) {
    if (head(f) !== 'mind-job') continue
    const spec = unquote(f[2])
    if (!Array.isArray(spec)) continue
    const at = spec.findIndex((x) => x instanceof Sym && x.name === ':labels')
    if (at >= 0 && Array.isArray(spec[at + 1])) out[nameOf(unquote(f[1]))] = spec[at + 1].map(nameOf)
  }
  return out
}

/** name → {version, hash} from a previous INDEX.slat's text (the keyword lines inventory.mjs writes). */
export function indexVersions(text) {
  const out = new Map()
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^\(cart :name "([^"]+)" :version (\S+) :hash "([0-9a-f]+)"/)
    if (m) out.set(m[1], { version: m[2], hash: m[3] })
  }
  return out
}

/**
 * Every fault in a carts tree. One finding per fault; a clean cart gives none.
 * @param {{root: string, units?: Set<string>, workersDir?: string, index?: string, tables?: Object}} opts
 *   `index` is the previous INDEX.slat text (for the version-bump check); `workersDir` the foreman's worker records
 * @returns {{cart: string, kind: string, says: string}[]} sorted by cart, then kind
 */
export function lintCarts({ root, units = new Set(), workersDir = null, index = '', tables = {} }) {
  const rows = scanCarts(root, { tables, units }).filter((r) => r.state !== 'template')
  const before = indexVersions(index)
  const out = []
  const add = (cart, kind, says) => out.push({ cart, kind, says })
  for (const r of rows) {
    if (r.problem) {
      const kind = /handlers for/.test(r.problem) ? 'duplicate-handler' : /no job class we bench/.test(r.problem) ? 'unbenched-class' : 'refused'
      add(r.name, kind, r.problem)
      continue
    }
    const text = readFileSync(r.path, 'utf8')
    const forms = parse(text)
    const fields = headerFields(text)
    const body = forms.slice(1).filter((f) => head(f) !== 'mind-job')
    const { heads, points } = calls(body)
    const verbs = list(fields.agent?.verbs)
    const unused = verbs.filter((v) => !PURE.has(v) && !heads.has(v))
    if (unused.length) add(r.name, 'unused-verb', `the header holds ${unused.join(', ')} and the body never calls ${unused.length > 1 ? 'them' : 'it'}; capabilities only shrink, so take ${unused.length > 1 ? 'them' : 'it'} out`)
    const judgment = fields.judgment && typeof fields.judgment === 'object' && !Array.isArray(fields.judgment) ? Object.keys(fields.judgment) : list(fields.judgment)
    for (const p of judgment) if (!points.has(p)) add(r.name, 'unasked-judgment', `the judgment point ${p} is never asked with (need-brain '${p} …)`)
    const declared = jobLabels(forms)
    for (const [job, m] of Object.entries(fields.minds || {})) {
      const want = list(m?.labels)
      const said = declared[job]
      if (said && want.length && (want.length !== said.length || want.some((x) => !said.includes(x))))
        add(r.name, 'label-drift', `the header gives '${job} the labels (${want.join(' ')}) and its mind-job asks for (${said.join(' ')}); one list, in both places`)
    }
    if (!r.exam) add(r.name, 'no-exam', 'the header names no exam; every cart carries (exam . <id>) with a unit')
    else if (!r.unit) add(r.name, 'dangling-exam', `the exam ${r.exam} has no unit in exam/units.jsonl; the trial refuses it`)
    if (r.missing.length) add(r.name, 'missing-fields', `the header lacks the 3.0 field${r.missing.length > 1 ? 's' : ''} ${r.missing.join(', ')}`)
    if (!list(fields.touches).length) add(r.name, 'no-touches', 'the header takes no lease: name what it touches, (touches . ("…"))')
    // the contract's done-check, else the done sentence (supervisor.mjs spawn): words check nothing, so a cart that
    // ends is `stopped` on every run and never `pass`; a standing cart (no `done` call) never reaches its check
    const contract = fields.contract && typeof fields.contract === 'object' ? fields.contract : {}
    const check = String(contract['done-check'] ?? fields.done ?? '')
    if (heads.has('done') && !/^\s*\(/.test(check)) {
      const says = `the done-check is words ("${check.slice(0, 60)}"): no run of a cart that ends can pass; `
        + 'give the header (contract . ((done-check . "(form)"))), a form over its steps, its last result or its answer'
      add(r.name, 'prose-done', says)
    }
    const was = before.get(r.name)
    if (was && String(was.version) === String(r.version ?? '#f') && was.hash !== r.hash)
      add(r.name, 'unbumped-version', `the body changed (hash ${was.hash} → ${r.hash}) and the version stayed ${r.version}; bump (version . N)`)
  }
  if (workersDir) {
    const names = new Set(rows.map((r) => r.name))
    for (const [name, run] of lastRuns(workersDir)) if (!names.has(name))
      add(name, 'orphan-worker', `${run.runs} worker record(s) name the cart ${name} and no cart file has that name; the next sweep retires them`)
  }
  return out.sort((a, b) => (a.cart === b.cart ? (a.kind < b.kind ? -1 : 1) : a.cart < b.cart ? -1 : 1))
}
