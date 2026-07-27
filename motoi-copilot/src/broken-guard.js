// broken-guard.js — pre-emptive consultation of known traps (SuperRAG §7).
//
// Motoi keeps a library of broken-example cards (scheme/reference/broken-
// examples/*.slatl): the code that does NOT run, why, the fix, and the same
// idea across R5RS/R6RS/SRFI. This module READS those cards (never writes them
// — they are owned elsewhere) and turns them into syntactic trip-wires. Before
// the copilot finalizes a suggestion, it checks whether the candidate form
// matches a known trap; if it does, the guard surfaces the card's lesson + fix
// so the copilot warns instead of silently emitting a form history has bitten.
//
// The load-bearing rule (design §7.2): a syntactic tripwire fires
// DETERMINISTICALLY — a known trap is not probabilistic. So even before the
// gates run (Gate 2 would already reject an unbound `fold-left`), the guard can
// explain WHY the form is wrong and hand the human the fix — the difference
// between "unbound symbol" and "you reached for R6RS's fold-left; use SRFI-1
// fold, and here's why the argument order flips."
//
// The guard is BEST-EFFORT and OPTIONAL: if the cards directory is absent (a
// slimmed package), it degrades to an empty trap-set and the gates still hold.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { parse, Sym } from 'motoi-scheme/reader'

const nm = (x) => (x instanceof Sym ? x.name : (typeof x === 'string' ? x : null))

// Default location: the base repo's broken-examples. A host can override.
function defaultCardsDir() {
  const here = dirname(fileURLToPath(import.meta.url))
  // motoi-copilot/src → repo root is ../.. ; cards live under scheme/reference.
  return join(here, '..', '..', 'scheme', 'reference', 'broken-examples')
}

/**
 * A Trap distilled from a broken-example card.
 * @typedef {object} Trap
 * @property {string} name         the trap verb / idea (e.g. "fold-left")
 * @property {Set<string>} tokens  head symbols that trip it
 * @property {string} why          why it's broken (short)
 * @property {string} fix          the fix code
 * @property {string} lesson       the cross-standard lesson
 * @property {string[]} rejected   the standards it comes from (R6RS, Racket…)
 */

export class BrokenGuard {
  /**
   * @param {object} [opts]
   * @param {string} [opts.cardsDir]  override the broken-examples directory
   * @param {Trap[]}  [opts.traps]     inject traps directly (tests / hosts)
   * @param {(name:string)=>boolean} [opts.knows]  is `name` a real Motoi verb /
   *   special form? Trip-tokens are filtered through this so the guard NEVER
   *   fires on a legitimate name a card happens to mention (define, if, car…).
   *   Only the card's :name and genuinely-unresolvable head symbols survive.
   *   Absent ⇒ conservative: only the card's :name is a trip-token.
   */
  constructor(opts = {}) {
    this.traps = []
    this.byToken = new Map() // head-symbol -> Trap
    this.knows = typeof opts.knows === 'function' ? opts.knows : null
    if (Array.isArray(opts.traps)) {
      for (const t of opts.traps) this._add(normalizeTrap(t))
    } else {
      this._loadCards(opts.cardsDir || defaultCardsDir())
    }
  }

  _loadCards(dir) {
    if (!existsSync(dir)) return
    let files
    try { files = readdirSync(dir).filter((f) => f.endsWith('.slatl')) } catch { return }
    for (const f of files) {
      let text
      try { text = readFileSync(join(dir, f), 'utf8') } catch { continue }
      for (const trap of extractTraps(text, this.knows)) this._add(trap)
    }
  }

  _add(trap) {
    if (!trap || !trap.name) return
    this.traps.push(trap)
    for (const tok of trap.tokens) {
      const cur = this.byToken.get(tok)
      // A better card wins the token deterministically. "Better" =
      //   1. the token IS this card's canonical :name (a per-verb card beats a
      //      card that merely mentions the token in its broken code), then
      //   2. the shorter, cleaner fix (a one-liner beats a book excerpt).
      if (!cur || trapStrength(trap, tok) > trapStrength(cur, tok)) {
        this.byToken.set(tok, trap)
      }
    }
  }

  get size() { return this.traps.length }

  /**
   * consult — does this candidate program trip a known trap? Returns the list
   * of matched traps (empty when clean). Deterministic: any head-symbol match
   * fires (design §7.2, :confidence-gate 0.0).
   * @param {string} program   the reconstructed candidate source
   * @returns {Trap[]}
   */
  consult(program) {
    let forms
    try { forms = parse(program) } catch { return [] }
    const hits = new Map()
    const walk = (form) => {
      if (Array.isArray(form)) {
        const head = nm(form[0])
        const trap = head && this.byToken.get(head)
        // Only UNBOUND-name traps are tripwires. A real verb that merely has a
        // subtle cross-standard difference is not a syntactic error, so it must
        // not fire on every use — that would drown the signal.
        if (trap && trap.unbound) hits.set(head, trap)
        for (const el of form) walk(el)
      }
    }
    forms.forEach(walk)
    return [...hits.values()]
  }

  /**
   * lookupAdvice — the broken-example lesson for a REAL verb whose cross-standard
   * behavior differs (hash-table-ref default, reduce arg-order…). Advisory, not a
   * tripwire: a host surfaces it on demand (hover, one-click depth), not on every
   * use. Returns the Trap or null.
   * @param {string} name
   * @returns {Trap|null}
   */
  lookupAdvice(name) {
    const t = this.byToken.get(name)
    return t && !t.unbound ? t : null
  }

  /**
   * warn — a human-facing warning string for the first tripped trap, or null.
   * Voice per pedagogy: lead with what's right (the fix), state the trap plainly,
   * no groveling.
   * @param {string} program
   * @returns {string|null}
   */
  warn(program) {
    const hits = this.consult(program)
    if (hits.length === 0) return null
    const t = hits[0]
    const from = t.rejected.length ? ` (that's ${t.rejected.join('/')})` : ''
    return `Heads up: \`${t.name}\`${from} isn't in Motoi's standard. ${t.why} ` +
           `Use \`${t.fix}\` instead.`
  }
}

// ── card parsing ─────────────────────────────────────────────────────────────
// Cards are (broken-example :name … :broken-code … :why … :fix-code … :lesson
// … :std-rejected (…) …) forms. We parse the file and pull the fields we need,
// deriving trip-tokens from the :name and the head symbol(s) of :broken-code.

function extractTraps(text, knows) {
  let forms
  try { forms = parse(text) } catch { return [] }
  const traps = []
  for (const form of forms) {
    if (!Array.isArray(form) || nm(form[0]) !== 'broken-example') continue
    const kv = plist(form.slice(1))
    const name = strOf(kv['name'])
    if (!name) continue
    const tokens = new Set([name])
    // Add head symbols of the broken code as trip tokens — but ONLY the ones
    // that are genuinely NOT real Motoi verbs. A card mentions `define`, `if`,
    // `car`, `cdr`, `+`, `lambda`… as scaffolding; firing on those would flag
    // every correct program. The offending name (fold-left, foldl, foldr) is
    // precisely the head symbol the oracle can't resolve. With no oracle we
    // fall back to the card's :name alone (still deterministic, never a false
    // positive on a real verb).
    // Only CANONICAL per-verb cards (whose :name is a real verb like
    // `fold-left`) contribute head-symbol trip-tokens. Book-site sweep cards
    // carry slug names (`book-challenges-ch12-…`) and their broken code is a
    // whole excerpt full of LOCAL bindings (pipe, xf, acc…) that the oracle
    // can't resolve but which are not cross-standard traps — auto-extracting
    // from them would flag correct programs that reuse those local names.
    const brokenCode = strOf(kv['broken-code'])
    if (brokenCode && knows && !isSlugName(name)) {
      const bound = localBindings(brokenCode) // names the snippet defines itself
      for (const h of headSymbols(brokenCode)) {
        if (!knows(h) && !bound.has(h)) tokens.add(h)
      }
    }
    // Cross-standard SIBLINGS of a canonical trap. A card teaches one name
    // (`fold-left`) but its :three-other-libs section names the same trap under
    // sibling spellings in the rejected standards (Racket `foldl`/`foldr`).
    // Those siblings are just as unbound in Motoi and just as worth catching,
    // and there is no separate per-verb card for them — so route them to this
    // trap. Only added when they are genuinely unbound (knows() says so), and
    // only for canonical (non-slug) cards.
    if (knows && !isSlugName(name)) {
      for (const sib of SIBLING_TRAPS[name] || []) if (!knows(sib)) tokens.add(sib)
    }
    // A trap is a TRIPWIRE (fires on any use) only when its name is genuinely
    // unbound in Motoi — a name-doesn't-exist trap like `fold-left`. Cards for
    // REAL verbs with a subtle cross-standard SEMANTIC difference (hash-table-ref
    // value-vs-default, reduce arg-order, partition multiple-values) describe a
    // behavior, not a forbidden name: firing on every legitimate call would be
    // noise. Those stay in the set as advisory lessons (lookupAdvice) but do not
    // auto-warn. With no oracle we can't tell, so default to tripwire.
    const unbound = knows ? !knows(name) : true
    traps.push({
      name,
      tokens,
      unbound,
      why: firstSentence(strOf(kv['why']) || ''),
      fix: strOf(kv['fix-code']) || '',
      lesson: firstSentence(strOf(kv['lesson']) || ''),
      rejected: listOfStrings(kv['std-rejected']),
    })
  }
  return traps
}

// Sibling spellings of a canonical cross-standard trap, drawn from the fold
// card's own :three-other-libs (R6RS fold-left, Racket foldl/foldr — all the
// accumulator/element-first fold family Motoi rejects in favor of SRFI-1 fold).
const SIBLING_TRAPS = {
  'fold-left': ['foldl', 'foldr'],  // Racket spellings; guarded by knows() so a
                                     // real SRFI-1 name (fold, fold-right) never lands here
}

// A slug name is a book-site sweep card id, not a verb: it starts `book-` or
// carries the `word-chNN` shape. Verbs (fold-left, hash-ref, game/step) don't.
function isSlugName(name) {
  return /^book-/.test(name) || /-ch\d/.test(name)
}

// localBindings — names a snippet BINDS itself (define/lambda params, let/letrec
// bindings, do vars). These are never cross-standard traps — a correct program
// that reuses `id` or `acc` as a local must not trip the guard. We subtract them
// from the candidate trip-token set. Conservative and syntactic; unknown special
// forms are simply skipped (they contribute no false trip-tokens either way).
function localBindings(code) {
  let forms
  try { forms = parse(code) } catch { return new Set() }
  const bound = new Set()
  const addParams = (params) => {
    if (params instanceof Sym) { bound.add(params.name); return } // rest arg
    if (Array.isArray(params)) for (const p of params) { const n = nm(p); if (n) bound.add(n) }
  }
  const walk = (f) => {
    if (!Array.isArray(f)) return
    const head = nm(f[0])
    if (head === 'define') {
      const t = f[1]
      if (t instanceof Sym) bound.add(t.name)          // (define x …)
      else if (Array.isArray(t)) { const n = nm(t[0]); if (n) bound.add(n); addParams(t.slice(1)) } // (define (f a b) …)
    } else if (head === 'lambda') {
      addParams(f[1])
    } else if (head === 'let' || head === 'let*' || head === 'letrec' || head === 'letrec*') {
      let binds = f[1]
      if (binds instanceof Sym) { bound.add(binds.name); binds = f[2] } // named let
      if (Array.isArray(binds)) for (const b of binds) { const n = Array.isArray(b) ? nm(b[0]) : null; if (n) bound.add(n) }
    } else if (head === 'do') {
      const binds = f[1]
      if (Array.isArray(binds)) for (const b of binds) { const n = Array.isArray(b) ? nm(b[0]) : null; if (n) bound.add(n) }
    }
    for (const el of f) walk(el)
  }
  forms.forEach(walk)
  return bound
}

function headSymbols(code) {
  let forms
  try { forms = parse(code) } catch { return [] }
  const out = []
  const walk = (f) => {
    if (Array.isArray(f) && f[0] instanceof Sym) out.push(f[0].name)
    if (Array.isArray(f)) f.forEach(walk)
  }
  forms.forEach(walk)
  return out
}

// Fold a (:k v :k v …) form-slice into an object keyed by de-coloned name.
function plist(slice) {
  const out = {}
  for (let i = 0; i + 1 < slice.length; i += 2) {
    const k = nm(slice[i])
    if (k && k[0] === ':') out[k.slice(1)] = slice[i + 1]
  }
  return out
}
function strOf(v) { return typeof v === 'string' ? v : (v instanceof Sym ? v.name : null) }
function listOfStrings(v) {
  if (!Array.isArray(v)) return []
  return v.map(strOf).filter(Boolean)
}
function firstSentence(s) {
  const m = String(s).replace(/\s+/g, ' ').trim().match(/^[^.]*\./)
  return m ? m[0] : String(s).slice(0, 140)
}
// trapStrength — how good a fit is this trap for owning `tok`? Higher wins.
// Deterministic (no ties break on load order): exact-name match dominates, then
// a shorter fix (a per-verb one-liner over a book-page excerpt).
function trapStrength(trap, tok) {
  let s = 0
  if (trap.name === tok) s += 1000                 // canonical per-verb card
  const fixLen = (trap.fix || '').length
  s += Math.max(0, 200 - fixLen)                   // prefer the short, clean fix
  return s
}

function normalizeTrap(t) {
  return {
    name: t.name,
    tokens: t.tokens instanceof Set ? t.tokens : new Set([t.name, ...(t.tokens || [])]),
    unbound: t.unbound !== false, // injected traps are tripwires unless told otherwise
    why: t.why || '', fix: t.fix || '', lesson: t.lesson || '',
    rejected: t.rejected || [],
  }
}

export default BrokenGuard
