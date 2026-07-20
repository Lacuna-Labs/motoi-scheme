// The base vocabulary — the only "library" the interpreter gets.
//
// Pure, total, side-effect-free functions over numbers and lists. Anything
// that touches the world (sprites, the shop) is injected separately and
// gated. Higher-order prims (for-each, map) re-enter the evaluator through
// `apply`, so they share the same fuel budget — no way to escape the cap.

import { Env, apply, Closure } from './interp.js'
import { Sym } from './reader.js'
import { registerVerbMeta } from './verbRegistry.js'
import { installSlatVerbs } from './slat-verbs.js'
import { installR7RSCompletions } from './r7rs-completions.js'

// The bricklay cache was Curator-specific host state. Extracted engine
// keeps the `bricklay-pack-native` primitive but drops the cache — the
// primitive still returns correct results, it just re-packs every call.
// A future Curator-side wrapper can memoize.
const bricklayCacheKey = () => null
const bricklayCacheGet = () => undefined
const bricklayCacheSet = () => {}

export function makeBaseEnv(fuel) {
  const e = new Env()
  // The higher-order primitives (`map`, `for-each`, `filter`, `reduce`,
  // `apply`, `any`, `every`, `count`, `list-index`, `sort`) re-enter the
  // evaluator via `apply()`, which threads the same fuel box the rest of
  // the interpreter uses — `evalStep` does `--fuel.n` to decrement.
  // Callers pass in a raw number, so we box it once here so the whole
  // base vocabulary shares one fuel counter for callback work.
  const fuelBox = (typeof fuel === 'number') ? { n: fuel } : fuel
  // The base vocabulary is the language layer — math, predicates, list
  // ops, string ops. Every binding is a pure value transform with no
  // app-state side effects; perm `read` per CARD-MANIFEST-CONTRACT §3.2.
  // The third arg is now mandatory at the audit level (the warming
  // wrapper at interp.js logs a warn otherwise); the `def` helper
  // defaults the perm so we don't repeat it at every line.
  const def = (n, f, perm = 'read', extra = {}) => e.define(n, f, { perm, ...extra })

  def('+', (...a) => a.reduce((x, y) => x + y, 0))
  def('-', (...a) => (a.length === 1 ? -a[0] : a.reduce((x, y) => x - y)))
  def('*', (...a) => a.reduce((x, y) => x * y, 1))
  def('/', (...a) => (a.length === 1 ? 1 / a[0] : a.reduce((x, y) => x / y)))
  def('modulo', (x, y) => ((x % y) + y) % y)
  def('quotient', (x, y) => Math.trunc(x / y))   // integer division — standard Scheme
  def('remainder', (x, y) => x - Math.trunc(x / y) * y)
  def('max', (...a) => Math.max(...a))
  def('min', (...a) => Math.min(...a))
  def('abs', (x) => Math.abs(x))

  def('=', (a, b) => a === b)
  def('<', (a, b) => a < b)
  def('>', (a, b) => a > b)
  def('<=', (a, b) => a <= b)
  def('>=', (a, b) => a >= b)
  def('not', (a) => a === false)

  def('list', (...a) => a)
  def('cons', (a, b) => [a, ...(Array.isArray(b) ? b : [b])])
  def('car', (a) => a[0])
  def('cdr', (a) => a.slice(1))
  // Standard Scheme convenience accessors — second + third elements.
  // Saves the conway.sks additive-blend code from repeated `(car (cdr ...))`.
  def('cadr', (a) => a[1])
  def('caddr', (a) => a[2])
  def('null?', (a) => Array.isArray(a) && a.length === 0)
  // R7RS §6.4 / §6.3 / §6.5 — the load-bearing type predicates the spec
  // expects every Scheme to bind. `pair?` is true on a NON-empty list
  // (Curator represents cons cells as JS arrays, so a pair is any array
  // with at least one element). `symbol?` is true on a `Sym` reader
  // token. `procedure?` is true on anything callable — JS functions
  // (primitives) or `Closure` instances (user lambdas).
  def('pair?', (a) => Array.isArray(a) && a.length > 0)
  def('symbol?', (a) => a instanceof Sym)
  def('procedure?', (a) => typeof a === 'function' || a instanceof Closure)
  def('length', (a) => a.length)
  def('range', (a, b) => { const r = []; for (let i = a; i < b; i++) r.push(i); return r })

  // (for-each fn xs [ys …]) — R7RS §6.10. Multi-list form iterates
  // pairwise; the callback receives one arg from each list per step.
  // Length is the shortest list; no error on ragged inputs (matches
  // R7RS behaviour that "the shortest list determines the length").
  def('for-each', (fn, ...lists) => {
    if (lists.length === 0) return undefined
    if (lists.length === 1) {
      for (const x of lists[0]) apply(fn, [x], fuelBox)
      return undefined
    }
    const n = lists.reduce((m, l) => Math.min(m, l.length), Infinity)
    for (let i = 0; i < n; i++) {
      const args = lists.map((l) => l[i])
      apply(fn, args, fuelBox)
    }
    return undefined
  })
  // (map fn xs [ys …]) — R7RS §6.10, "Patch 2" (2026-07-19). Prior form
  // was single-list only; the multi-list form evaluates the callback
  // once per index with one arg from each list. `(map + xs ys)` sums two
  // lists pairwise. Backwards-compatible: single-list callers work
  // unchanged. If the fn has a fixed lower arity the runtime error
  // surfaces from apply, not from map.
  def('map', (fn, ...lists) => {
    if (lists.length === 0) return []
    if (lists.length === 1) return lists[0].map((x) => apply(fn, [x], fuelBox))
    const n = lists.reduce((m, l) => Math.min(m, l.length), Infinity)
    const out = new Array(n)
    for (let i = 0; i < n; i++) {
      const args = lists.map((l) => l[i])
      out[i] = apply(fn, args, fuelBox)
    }
    return out
  })
  def('filter', (fn, lst) => lst.filter((x) => apply(fn, [x], fuelBox) !== false))
  def('reduce', (fn, init, lst) => lst.reduce((acc, x) => apply(fn, [acc, x], fuelBox), init))
  // (apply fn args) — invoke `fn` with the list `args` as the argument
  // list. Same fuel budget as a direct call.
  def('apply', (fn, args) => apply(fn, Array.isArray(args) ? args : [args], fuelBox))

  // (=? a b) — smart equality. The PICO-8-style "do what I mean" verb:
  //   * numbers compare by value (===)
  //   * strings compare by value (===)
  //   * lists compare structurally (deep, length-aware)
  //   * symbols compare by name
  //   * everything else falls through to reference equality
  // Replaces the long-running confusion between eq? / eqv? / equal? in
  // the canon Schemes (per Dr. Imani's PICO-8 research pass —
  // beginners cite this as the #1 surprise). Use `=?` everywhere and
  // it just works; the verbose forms stay for the few cases that need
  // them.
  function _eqQ(a, b) {
    if (a === b) return true
    if (a == null || b == null) return false
    // Sym comparison by .name (reader interns these consistently).
    if (a && b && typeof a === 'object'
        && 'name' in a && 'name' in b
        && Object.getPrototypeOf(a) === Object.getPrototypeOf(b)
        && typeof a.name === 'string') {
      return a.name === b.name
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) if (!_eqQ(a[i], b[i])) return false
      return true
    }
    return false
  }
  def('=?', _eqQ)
  // Legacy spellings — Scheme tradition; same behaviour as `=?` so
  // operators coming from Racket/Chez/Chicken aren't surprised.
  def('equal?', _eqQ)
  def('eq?', _eqQ)

  // (inspect x) — walk any value and return a flat, readable string
  // suitable for `(text ...)` or `(display)`. The runtime
  // inspector PICO-8 authors keep asking for; pretty-prints lists,
  // truncates strings, marks closures as `<fn>`.
  function _show(v, depth = 0) {
    if (v === undefined) return 'nil'
    if (v === false) return '#f'
    if (v === true) return '#t'
    if (v === null) return 'null'
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string') {
      return v.length > 80 ? JSON.stringify(v.slice(0, 80)) + '…' : JSON.stringify(v)
    }
    if (typeof v === 'function') return '<fn>'
    if (v instanceof Closure) return '<fn>'
    if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string'
        && Object.keys(v).length === 1) return v.name
    if (Array.isArray(v)) {
      if (depth > 4) return '(…)'
      const inner = v.slice(0, 12).map((x) => _show(x, depth + 1)).join(' ')
      const tail = v.length > 12 ? ' …' : ''
      return '(' + inner + tail + ')'
    }
    if (typeof v === 'object') {
      if (depth > 3) return '{…}'
      const entries = Object.entries(v).slice(0, 8)
        .map(([k, vv]) => `${k}: ${_show(vv, depth + 1)}`)
      return '{' + entries.join(', ')
        + (Object.keys(v).length > 8 ? ', …' : '') + '}'
    }
    return String(v)
  }
  def('inspect', (v) => _show(v))

  // ── I/O — the two Scheme primitives every beginner reaches for. ─────
  //
  // `(display v)` writes v to stdout with no trailing newline. Strings
  // print unquoted (that's the whole point of `display` vs `write`);
  // #t/#f and () use the reader-visible spellings; lists recurse; every
  // other value falls through to String().
  //
  // `(newline)` writes a single '\n'. Both return undefined so a REPL
  // top-level `(display "hi")` doesn't echo a bogus `=> ...` line.
  //
  // The output stream is `process.stdout` — the CLI and REPL both write
  // there, so display/newline land next to the `=> value` prints in the
  // same terminal without any extra plumbing. A future host-injected
  // seam (opts.stdout) can override; for 1.4 the direct stdout write is
  // what a beginner cart expects. See docs/BOOK-VOICE-1.0.md §I/O.
  function _displayFormat(v) {
    if (v === undefined) return ''
    if (v === null) return '()'
    if (v === true) return '#t'
    if (v === false) return '#f'
    if (typeof v === 'string') return v
    if (Array.isArray(v)) return '(' + v.map(_displayFormat).join(' ') + ')'
    if (typeof v === 'function') return '<fn>'
    if (v instanceof Closure) return '<fn>'
    if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string'
        && Object.keys(v).length === 1) return v.name
    return String(v)
  }
  def('display', (v) => { process.stdout.write(_displayFormat(v)); return undefined })
  def('newline', () => { process.stdout.write('\n'); return undefined })

  // ── SRFI 1 essentials (per Dr. Imani's research — what every Scheme
  // author reaches for first; we already have map/filter/reduce/append/
  // reverse/first/last/nth; add the remainder so a cart authored in
  // any other Scheme runs here without a port).
  def('any', (pred, lst) => {
    if (!Array.isArray(lst)) return false
    for (const x of lst) if (apply(pred, [x], fuelBox) !== false) return true
    return false
  })
  def('every', (pred, lst) => {
    if (!Array.isArray(lst)) return true
    for (const x of lst) if (apply(pred, [x], fuelBox) === false) return false
    return true
  })
  def('count', (pred, lst) => {
    if (!Array.isArray(lst)) return 0
    let n = 0
    for (const x of lst) if (apply(pred, [x], fuelBox) !== false) n++
    return n
  })
  def('take', (lst, n) => Array.isArray(lst) ? lst.slice(0, Math.max(0, n|0)) : [])
  def('drop', (lst, n) => Array.isArray(lst) ? lst.slice(Math.max(0, n|0)) : [])
  def('zip', (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return []
    const n = Math.min(a.length, b.length)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = [a[i], b[i]]
    return out
  })
  def('append', (...ls) => [].concat(...ls))
  def('reverse', (a) => a.slice().reverse())
  def('first', (a) => a[0])
  def('last', (a) => a[a.length - 1])
  def('nth', (a, i) => a[i])

  // ── more math ───────────────────────────────────────────────────────
  def('sqrt', (x) => Math.sqrt(x))
  def('cos', (x) => Math.cos(x))
  def('sin', (x) => Math.sin(x))
  def('tan', (x) => Math.tan(x))
  def('atan2', (y, x) => Math.atan2(y, x))
  def('pi', Math.PI)                            // (pi) → 3.14159…
  def('expt', (b, p) => Math.pow(b, p))
  // Exp/log family — Wave 0, per architect-motoi-core-runtime-completion
  // 2026-07-16 §4 :exp-log. Thin wrappers over the ES Math intrinsics.
  // `log` is the natural logarithm (R7RS §6.2.6), `log10`/`log2`/`exp2`
  // are pedagogical conveniences the kid picks up in growth-curve carts.
  // Also surfaced as math/* in lib/math/basic.js during Wave 1.
  def('exp', (x) => Math.exp(x))
  def('log', (x) => Math.log(x))
  def('log2', (x) => Math.log2(x))
  def('log10', (x) => Math.log10(x))
  def('exp2', (x) => Math.pow(2, x))
  def('floor', (x) => Math.floor(x))
  def('ceil', (x) => Math.ceil(x))
  // R7RS §6.2.6 spells it `ceiling`. We keep `ceil` as the short-form
  // alias the cart authors learned first; both point to the same impl.
  def('ceiling', (x) => Math.ceil(x))
  def('round', (x) => Math.round(x))
  def('round2', (x) => Math.round(x * 100) / 100)   // money-friendly
  def('sign', (x) => Math.sign(x))
  def('clamp', (x, lo, hi) => Math.min(hi, Math.max(lo, x)))
  def('lerp', (a, b, t) => a + (b - a) * t)
  // `rng-uniform` is the BASE, non-deterministic uniform in [0,1). It is
  // intentionally NOT named `random`: the cards runtime (runWithCards)
  // binds a SEEDED `random` on top so cart replay is byte-identical.
  // run()/runSurface() don't install the seeded rng, so they reach the
  // uniform under this name. See [[curator-publish-architecture]] /
  // cartReplayer determinism note. (A1 fix, 2026-06-11)
  def('rng-uniform', () => Math.random())
  def('randint', (a, b) => a + Math.floor(Math.random() * (b - a)))
  // Racket-style aliases — friendlier names that Scheme-ers reach for.
  // `(random-int n)` → 0..n-1.  `(random-range lo hi)` → uniform float
  // in [lo, hi).  `(random-pick lst)` → an element of the list.
  def('random-int', (n) => Math.floor(Math.random() * Math.max(1, n | 0)))
  def('random-range', (lo, hi) => lo + Math.random() * (hi - lo))
  def('random-pick', (lst) => (lst && lst.length ? lst[Math.floor(Math.random() * lst.length)] : null))
  def('sum', (lst) => lst.reduce((x, y) => x + y, 0))
  def('mean', (lst) => (lst.length ? lst.reduce((x, y) => x + y, 0) / lst.length : 0))

  // ── finance ─────────────────────────────────────────────────────────
  def('pct', (a, b) => (b === 0 ? 0 : (a / b) * 100))                 // a as % of b
  def('pct-change', (oldV, newV) => (oldV === 0 ? 0 : ((newV - oldV) / oldV) * 100))
  def('margin', (price, cost) => (price === 0 ? 0 : ((price - cost) / price) * 100))
  def('markup', (cost, pctUp) => cost * (1 + pctUp / 100))
  def('markdown', (price, pctOff) => price * (1 - pctOff / 100))
  def('profit', (revenue, cost) => revenue - cost)
  def('fee', (amount, ratePct) => amount * (ratePct / 100))
  def('net', (gross, ...fees) => gross - fees.reduce((x, y) => x + y, 0))
  def('cagr', (begin, end, years) => (begin <= 0 || years <= 0 ? 0 : (Math.pow(end / begin, 1 / years) - 1) * 100))
  def('sma', (lst, n) => {            // simple moving average → array
    const out = []
    for (let i = n - 1; i < lst.length; i++) {
      let s = 0
      for (let j = i - n + 1; j <= i; j++) s += lst[j]
      out.push(s / n)
    }
    return out
  })

  // ── thresholds (over values/series the host provides) ───────────────
  def('above?', (x, t) => x > t)
  def('below?', (x, t) => x < t)
  def('crossed?', (prev, now, t) => (prev <= t && now > t) || (prev >= t && now < t))

  // ── collisions (the game kit) ───────────────────────────────────────
  def('dist', (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1))
  def('near?', (x1, y1, x2, y2, r) => Math.hypot(x2 - x1, y2 - y1) <= r)
  def('in-rect?', (px, py, x, y, w, h) => px >= x && px < x + w && py >= y && py < y + h)
  def('overlap?', (x1, y1, w1, h1, x2, y2, w2, h2) =>
    x1 < x2 + w2 && x2 < x1 + w1 && y1 < y2 + h2 && y2 < y1 + h1)

  // ── equality, predicates, strings, lookup ───────────────────────────
  // NOTE: `eq?` and `equal?` were previously ALSO defined at lines 116-117
  // above using the smart `_eqQ` shared with `=?`. Those definitions
  // handle Sym-by-name and deep list equality; the SIMPLE strict/deep
  // pair that used to live here shadowed them silently, which broke
  // (eq? (sym "foo") (sym "foo")) for freshly constructed Sym instances.
  // We keep the smart definitions in force here. Both `eq?` and `equal?`
  // remain structural per Motoi's `=?` doctrine (PICO-8-style DWIM
  // equality — Dr. Imani's beginner-friendliness research pass).
  def('zero?', (x) => x === 0)
  def('positive?', (x) => x > 0)
  def('negative?', (x) => x < 0)
  def('even?', (x) => x % 2 === 0)
  def('odd?', (x) => Math.abs(x % 2) === 1)
  def('number?', (x) => typeof x === 'number')
  def('string?', (x) => typeof x === 'string')
  def('boolean?', (x) => x === true || x === false)
  def('string-append', (...a) => a.map(String).join(''))
  def('string-length', (s) => String(s).length)
  def('string-ref', (s, i) => String(s).charAt(i))   // → single-char string
  def('string-eq?', (a, b) => String(a) === String(b))
  def('string=?', (a, b) => String(a) === String(b))
  def('vector-ref', (v, i) => (Array.isArray(v) ? v[i] : null))
  def('substring', (s, a, b = undefined) => String(s).substring(a, b))
  def('number->string', (n, radix) => {
    // Standard Scheme: (number->string n [radix]). Default radix 10.
    // Radix 16 emits lowercase hex (matches the `"#rrggbb"` convention).
    const r = (typeof radix === 'number') ? (radix | 0) : 10
    return Number(n).toString(r)
  })
  def('string->number', (s, radix) => {
    // Standard Scheme: (string->number s [radix]). Default radix 10.
    // Hex parsing supports both bare "ff" and "0xff" forms.
    const r = (typeof radix === 'number') ? (radix | 0) : 10
    if (r === 10) {
      const n = parseFloat(s)
      return Number.isNaN(n) ? false : n
    }
    const str = String(s).trim()
    const n = parseInt(str.startsWith('0x') || str.startsWith('0X') ? str.slice(2) : str, r)
    return Number.isNaN(n) ? false : n
  })
  // (hex-byte "#rrggbb" i) → 0..255. Convenience for the conway.sks
  // additive-blend code — reads 2 hex chars at offset i without forcing
  // operators to remember the radix argument to string->number.
  def('hex-byte', (s, i) => {
    const n = parseInt(String(s).substr(i, 2), 16)
    return Number.isNaN(n) ? 0 : n
  })
  // (byte->hex n) → 2-char lowercase hex string. Pads single digits.
  def('byte->hex', (n) => {
    const v = Math.max(0, Math.min(255, n | 0)).toString(16)
    return v.length === 1 ? '0' + v : v
  })
  def('list-ref', (a, i) => a[i])
  def('member', (x, lst) => { const i = lst.findIndex((y) => deepEqual(x, y)); return i < 0 ? false : lst.slice(i) })
  def('assoc', (key, alist) => alist.find((pair) => Array.isArray(pair) && deepEqual(pair[0], key)) || false)

  // ── list-builders the layout carts reach for ────────────────────────
  //
  // bricklay tracks a vector of column bottoms and updates it as cards
  // land. We expose the SRFI-1-friendly trio that makes that ergonomic:
  //
  //   (make-list n value)    → a fresh list of length n filled with value
  //   (list-set lst i value) → a NEW list with element i replaced (pure;
  //                            the source list is not mutated — matches
  //                            the immutable shape Scheme code is already
  //                            written in here)
  //   (list-index pred lst)  → index of the first element where (pred x)
  //                            is true, or #f. SRFI-1 standard.
  //   (argmin lst)           → index of the smallest number in lst
  //                            (ties: leftmost wins). The bricklay packer
  //                            uses this to pick the shortest column.
  //   (sort lst less?)       → a NEW list sorted ascending under the
  //                            two-arg less? predicate. Stable.
  def('make-list', (n, value) => {
    const k = Math.max(0, n | 0)
    const out = new Array(k)
    for (let i = 0; i < k; i++) out[i] = value
    return out
  })
  def('list-set', (lst, i, value) => {
    if (!Array.isArray(lst)) return lst
    const out = lst.slice()
    if (i >= 0 && i < out.length) out[i] = value
    return out
  })
  def('list-index', (pred, lst) => {
    if (!Array.isArray(lst)) return false
    for (let i = 0; i < lst.length; i++) {
      if (apply(pred, [lst[i]], fuelBox) !== false) return i
    }
    return false
  })
  def('argmin', (lst) => {
    if (!Array.isArray(lst) || lst.length === 0) return false
    let best = 0
    let bestV = lst[0]
    for (let i = 1; i < lst.length; i++) {
      if (lst[i] < bestV) { bestV = lst[i]; best = i }
    }
    return best
  })
  def('sort', (lst, less) => {
    if (!Array.isArray(lst)) return lst
    // Decorate-sort-undecorate so JS Array.sort can be stable on the
    // shared key while honouring the user's less? predicate.
    const indexed = lst.map((v, i) => [v, i])
    indexed.sort((a, b) => {
      const ab = apply(less, [a[0], b[0]], fuelBox) !== false
      const ba = apply(less, [b[0], a[0]], fuelBox) !== false
      if (ab && !ba) return -1
      if (ba && !ab) return 1
      return a[1] - b[1]   // stable
    })
    return indexed.map((p) => p[0])
  })

  // ── bricklay-pack-native — JS-backed bottom-left bin-pack (#414) ─────
  //
  // The Scheme cart `carts/layout/bricklay.sks` used to run a pure-Scheme
  // FFD bottom-left fill — O(N³)-in-Scheme-primitives because every
  // (cdr ...) sliced a fresh list, every (cons …) reallocated, and the
  // overlap walk and candidate regeneration each cost O(N) per card.
  // The 22-card production roster needed 4M fuel to land.
  //
  // This primitive lifts the *algorithm* into JS so the per-step cost
  // collapses to native array ops. The cart calls this once with its
  // sorted card list (sort is already JS) and dispatches `move-card`
  // for each (id x y) the primitive returns. Output is byte-identical
  // to the prior Scheme implementation on every existing fixture; only
  // the cost changes.
  //
  // Algorithm — preserved exactly so tests pass byte-for-byte:
  //   1. Iterate cards in input order (caller sorts via FFD).
  //   2. Build candidate anchors: origin at the head, then
  //      `right-of-P` and `below-of-P` for each placed P in reverse
  //      placement order (newest first — matches the cart's cons-onto-
  //      head ordering exactly).
  //   3. Valid: x≥MARGIN, y≥MARGIN, x+w ≤ vw-MARGIN, no rect overlap.
  //   4. Best: first valid candidate becomes best; replace only on
  //      strict (cy<by) || (cy==by && cx<bx). First-in-order wins ties.
  //   5. Fallback: (MARGIN, max-bottom + GAP-Y).
  //
  // Inputs:
  //   cards    — list of (id w h) triples; caller pre-sorts.
  //   vw       — viewport width (effective, after canvas-min clamp).
  //   marginX  — left/right margin (BRICKLAY-MARGIN).
  //   marginY  — top margin (BRICKLAY-MARGIN).
  //   gapX     — horizontal gap (BRICKLAY-GAP-X).
  //   gapY     — vertical gap   (BRICKLAY-GAP-Y).
  //
  // Output: list of (id x y) triples in placement order.
  //
  // Complexity: O(N²). Each placement adds 2 anchors (total 2N+1), each
  // selection scans those anchors and tests each against placed cards
  // (O(N) anchors × O(N) overlap = O(N²) per card → O(N³) WORST-CASE
  // but the JS overhead is two orders of magnitude smaller than the
  // Scheme equivalent — see bricklay.test.js benchmark notes).
  def('bricklay-pack-native', (cards, vw, marginX, marginY, gapX, gapY) => {
    if (!Array.isArray(cards) || cards.length === 0) return []
    // ── Memoization (#415) ───────────────────────────────────────────
    // The packer is deterministic — same input, same output. Cache by a
    // 32-bit FNV hash over the canonical (rows, vw, margins, gaps) key.
    // A hit returns the placement list straight from the cache; a miss
    // computes + stores. The cache is bounded (32 entries, LRU) and is
    // invalidated by `bricklayCacheClear()` whenever the host detects a
    // size/priority change. See bricklayCache.js.
    const cacheKey = bricklayCacheKey(cards, vw, marginX, marginY, gapX, gapY)
    if (cacheKey != null) {
      const cached = bricklayCacheGet(cacheKey)
      if (cached) return cached
    }
    // Parallel arrays for placed-card geometry. Avoids tuple allocation
    // per placement and keeps the overlap walk on flat number arrays.
    const px = new Array(cards.length)
    const py = new Array(cards.length)
    const pw = new Array(cards.length)
    const ph = new Array(cards.length)
    let placedCount = 0
    // Anchor buffer. Two new anchors per placement = 2N capacity, plus
    // the origin seed. We never remove entries — the validity check
    // prunes per-iteration.
    const ax = new Array(cards.length * 2 + 1)
    const ay = new Array(cards.length * 2 + 1)
    let anchorCount = 0
    const out = []

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      if (!Array.isArray(c)) continue
      const id = c[0]
      const w = +c[1]
      const h = +c[2]
      if (!isFinite(w) || !isFinite(h)) continue

      // ── Build the candidate list in the cart's iteration order. ────
      // The cart visits anchors in the order [origin, right(newest),
      // below(newest), right(2nd-newest), below(2nd-newest), …]. We
      // mirror that by walking placed in reverse-placement order.
      // For performance we don't materialise the candidate list — we
      // scan and pick the best inline.
      let bestX = 0, bestY = 0, haveBest = false

      // (a) origin anchor.
      {
        const cx = marginX, cy = marginY
        if (cx + w <= vw - marginX && !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
          bestX = cx; bestY = cy; haveBest = true
        }
      }
      // (b) per-placed anchors, walking newest→oldest (cart's order).
      for (let j = placedCount - 1; j >= 0; j--) {
        // right-of-P
        {
          const cx = px[j] + pw[j] + gapX
          const cy = py[j]
          if (cx >= marginX && cy >= marginY &&
              cx + w <= vw - marginX &&
              !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
            if (!haveBest || cy < bestY || (cy === bestY && cx < bestX)) {
              bestX = cx; bestY = cy; haveBest = true
            }
          }
        }
        // below-of-P
        {
          const cx = px[j]
          const cy = py[j] + ph[j] + gapY
          if (cx >= marginX && cy >= marginY &&
              cx + w <= vw - marginX &&
              !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
            if (!haveBest || cy < bestY || (cy === bestY && cx < bestX)) {
              bestX = cx; bestY = cy; haveBest = true
            }
          }
        }
      }

      // (c) Fallback row when no candidate fits — wide card on narrow
      // viewport. (MARGIN, max-bottom + GAP-Y). max-bottom seeded with
      // marginY so a first-card-too-wide still lands at (M, M + gapY).
      if (!haveBest) {
        let maxBottom = marginY
        for (let j = 0; j < placedCount; j++) {
          const b = py[j] + ph[j]
          if (b > maxBottom) maxBottom = b
        }
        bestX = marginX
        bestY = maxBottom + gapY
      }

      // Commit.
      px[placedCount] = bestX
      py[placedCount] = bestY
      pw[placedCount] = w
      ph[placedCount] = h
      placedCount += 1
      // anchor buffer maintenance (kept for completeness even though we
      // don't read it — keeps the API surface honest if a future caller
      // wants the anchor history).
      ax[anchorCount] = bestX + w + gapX; ay[anchorCount] = bestY; anchorCount += 1
      ax[anchorCount] = bestX;            ay[anchorCount] = bestY + h + gapY; anchorCount += 1
      out.push([id, bestX, bestY])
    }
    if (cacheKey != null) bricklayCacheSet(cacheKey, out)
    return out
  })

  // ─── artifact/* — DOM-hosted surface verbs ────────────────────────────
  //
  // These are the Phase-A core verbs from artifact-doctrine-synthesis-2026-07-10.
  // The base env installs THUNK stubs that throw a legible error when the
  // interpreter runs headless (no DOM); the browser-side wiring in
  // site/apps/hello-surface/artifact/verbs.js re-defines them with the
  // real implementations when the surface mounts.
  //
  // Any Scheme program that CALLS one of these verbs is legal in any env
  // — it just can't run in the node interpreter without a shim. The verb
  // NAMES are stable so tooling, linters, and RAG indexers can enumerate
  // the artifact API from the language alone.
  const artifactHeadlessStub = (name) => (...a) => {
    throw new Error(
      `[artifact] '${name}' called in a headless env — install browser verbs ` +
      `from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).`
    )
  }
  const ARTIFACT_VERB_NAMES = [
    'artifact/spawn',
    'artifact/describe',
    'artifact/apply',
    'artifact/read',
    'artifact/on-event',
    'artifact/at-location',
    'artifact/close',
    'artifact/list',
    // Phase B — compose / nest / subscribe-cortex
    'artifact/compose',
    'artifact/nest',
    'artifact/subscribe-cortex',
  ]
  const ARTIFACT_STATE_CHANGE_NAMES = new Set([
    'artifact/spawn',
    'artifact/apply',
    'artifact/close',
    'artifact/compose',
    'artifact/nest',
  ])
  for (const n of ARTIFACT_VERB_NAMES) {
    // Use 'state-change' as the perm for spawn/apply/close/compose/nest
    // (worst-case), 'read' for the pure introspection verbs. Since the
    // stubs throw, the dispatcher never fires them in a headless env;
    // the perm is here for static tooling.
    const perm = ARTIFACT_STATE_CHANGE_NAMES.has(n) ? 'state-change' : 'read'
    e.define(n, artifactHeadlessStub(n), { perm })
  }

  // The rich metadata for every base primitive is registered at module
  // load time (see BASE_META below). `env.define` already stamped each
  // verb with an inferred meta stub; the last-writer-wins path in
  // verbRegistry replaces the stub with the rich shape (name/arity/
  // doc/example) that the introspection surface reads.
  registerBaseMetadata()

  // SLAT primitives — the minimum-viable set the Book of SLAT teaches.
  // See src/slat-verbs.js for the full roster and design notes. Wired
  // here so every consumer that reaches for `makeBaseEnv` gets slat-
  // loads / slat-dumps / slat-key / etc. as first-class Scheme verbs
  // without a follow-up install call. Pre-launch polish item #1.
  installSlatVerbs(e)

  // R7RS-small + SRFI-1/13 + SRFI-125 completions — the FILL PASS from
  // the 2026-07-18 language finalization audit. Adds fold/iota/find/
  // string-split/string-join/hash-table-*/bytevector-*/error/raise/
  // char predicates/etc — the standard/conventional coverage Motoi was
  // missing pre-lock. See src/r7rs-completions.js for the full list
  // and per-verb R7RS/SRFI citations.
  installR7RSCompletions(e, fuelBox)

  return e
}

// ── Rich metadata for every base primitive. ────────────────────────────
//
// The introspection surface (`,help car`, `help('car')`, the CLI
// `motoi help car`) needs the shape the extraction plan
// §"Verb metadata — the ergonomics contract" spells out: name, arity,
// doc, at least one worked example. Without this, the REPL says
// "unknown verb: car" for every base primitive.
//
// The table lives at module scope so `motoi help car` works
// even before any evaluator env has been built — the CLI's `help` path
// never touches an Env. We register at module load once; every fresh
// REPL/CLI process gets the full manifest with zero setup cost.
//
// Shape: [name, arity, doc, exampleCode, namespace?]. arity is a scalar
// number or a `[min, max]` pair (variadic → [min, Infinity]). Every
// entry ships one example (novice tier) at minimum — the beginner
// reading Sakura Book Chapter 1 sees a runnable form under `,help X`.
function registerBaseMetadata() {
  const BASE_META = [
    // arithmetic
    ['+',        [0, Infinity], 'Sum of all arguments. Zero args → 0.',                        '(+ 1 2 3) => 6',           'math'],
    ['-',        [1, Infinity], 'Subtract: (- a) negates; (- a b …) folds left.',              '(- 10 3 2) => 5',          'math'],
    ['*',        [0, Infinity], 'Product of all arguments. Zero args → 1.',                    '(* 2 3 4) => 24',          'math'],
    ['/',        [1, Infinity], 'Divide: (/ a) reciprocates; (/ a b …) folds left.',           '(/ 20 2 2) => 5',          'math'],
    ['modulo',   2,             'Mathematical modulo — result has divisor sign.',              '(modulo 7 3) => 1',        'math'],
    ['quotient', 2,             'Integer division, truncated toward zero.',                    '(quotient 7 2) => 3',      'math'],
    ['remainder',2,             'Integer remainder matching quotient.',                        '(remainder 7 2) => 1',     'math'],
    ['max',      [1, Infinity], 'Largest of the given numbers.',                               '(max 3 1 4 1 5) => 5',     'math'],
    ['min',      [1, Infinity], 'Smallest of the given numbers.',                              '(min 3 1 4 1 5) => 1',     'math'],
    ['abs',      1,             'Absolute value.',                                             '(abs -7) => 7',            'math'],
    ['sqrt',     1,             'Square root.',                                                '(sqrt 9) => 3',            'math'],
    ['expt',     2,             'Base raised to the power. (expt b p) => b^p.',                '(expt 2 10) => 1024',      'math'],
    ['floor',    1,             'Round DOWN to an integer.',                                   '(floor 3.7) => 3',         'math'],
    ['ceil',     1,             'Round UP to an integer.',                                     '(ceil 3.2) => 4',          'math'],
    ['ceiling',  1,             'Round UP to an integer (R7RS alias for ceil).',               '(ceiling 3.2) => 4',       'math'],
    ['round',    1,             'Round to the nearest integer.',                               '(round 3.5) => 4',         'math'],
    ['sign',     1,             '-1, 0, or 1 by the sign of x.',                               '(sign -8) => -1',          'math'],
    ['clamp',    3,             '(clamp x lo hi) — clamp x into [lo, hi].',                    '(clamp 15 0 10) => 10',    'math'],
    ['lerp',     3,             '(lerp a b t) — linear interpolation.',                        '(lerp 0 10 0.5) => 5',     'math'],
    ['sin',      1,             'Sine (radians).',                                             '(sin 0) => 0',             'math'],
    ['cos',      1,             'Cosine (radians).',                                           '(cos 0) => 1',             'math'],
    ['tan',      1,             'Tangent (radians).',                                          '(tan 0) => 0',             'math'],
    ['atan2',    2,             '(atan2 y x) — arc-tangent by quadrant.',                      '(atan2 1 1) => 0.785…',    'math'],
    ['sum',      1,             'Sum every element of a list.',                                '(sum (list 1 2 3)) => 6',  'math'],
    ['mean',     1,             'Arithmetic mean of a list.',                                  '(mean (list 2 4 6)) => 4', 'math'],

    // comparisons + logic
    ['=',        2, 'Numeric equality.',        '(= 3 3) => #t',        'compare'],
    ['<',        2, 'Less than.',               '(< 1 2) => #t',        'compare'],
    ['>',        2, 'Greater than.',            '(> 2 1) => #t',        'compare'],
    ['<=',       2, 'Less than or equal.',      '(<= 3 3) => #t',       'compare'],
    ['>=',       2, 'Greater than or equal.',   '(>= 3 3) => #t',       'compare'],
    ['not',      1, 'Logical negation of #f/#t.','(not #f) => #t',      'logic'],
    ['=?',       2, 'Smart equality — numbers/strings by value, lists deep, symbols by name.', "(=? '(1 2) '(1 2)) => #t", 'compare'],
    ['eq?',      2, 'Reference / structural equality.',    '(eq? 3 3) => #t',   'compare'],
    ['equal?',   2, 'Structural equality (deep, list-aware).', "(equal? '(1 2) '(1 2)) => #t", 'compare'],

    // predicates
    ['null?',    1, '#t if arg is the empty list.',   "(null? '()) => #t",       'predicate'],
    ['pair?',    1, '#t if arg is a non-empty list.', "(pair? '(1 2)) => #t",    'predicate'],
    ['symbol?',  1, '#t if arg is a symbol.',         "(symbol? 'x) => #t",      'predicate'],
    ['procedure?', 1,'#t if arg is a function.',      '(procedure? car) => #t',  'predicate'],
    ['zero?',    1, '#t if arg equals 0.',            '(zero? 0) => #t',         'predicate'],
    ['positive?', 1,'#t if arg is > 0.',              '(positive? 3) => #t',     'predicate'],
    ['negative?', 1,'#t if arg is < 0.',              '(negative? -3) => #t',    'predicate'],
    ['even?',    1, '#t if arg is an even integer.',  '(even? 4) => #t',         'predicate'],
    ['odd?',     1, '#t if arg is an odd integer.',   '(odd? 3) => #t',          'predicate'],
    ['number?',  1, '#t if arg is a number.',         '(number? 3) => #t',       'predicate'],
    ['string?',  1, '#t if arg is a string.',         '(string? "x") => #t',     'predicate'],
    ['boolean?', 1, '#t if arg is #t or #f.',         '(boolean? #t) => #t',     'predicate'],

    // lists — the core ergonomic surface
    ['list',    [0, Infinity], 'Build a list from the given elements.',            '(list 1 2 3) => (1 2 3)',           'list'],
    ['cons',    2,             'Prepend a to list b. (cons 1 (list 2 3)) → (1 2 3).', '(cons 1 (list 2 3)) => (1 2 3)', 'list'],
    ['car',     1,             'The first element of a non-empty list.',           '(car (list 1 2 3)) => 1',           'list'],
    ['cdr',     1,             'Everything but the first element.',                '(cdr (list 1 2 3)) => (2 3)',       'list'],
    ['cadr',    1,             'The second element. Alias for (car (cdr x)).',     '(cadr (list 1 2 3)) => 2',          'list'],
    ['caddr',   1,             'The third element. Alias for (car (cdr (cdr x))).', '(caddr (list 1 2 3)) => 3',         'list'],
    ['length',  1,             'How many elements in the list.',                   '(length (list 1 2 3)) => 3',        'list'],
    ['range',   2,             '(range a b) → list [a, a+1, …, b-1].',             '(range 0 5) => (0 1 2 3 4)',        'list'],
    ['append',  [0, Infinity], 'Concatenate lists.',                               '(append (list 1) (list 2 3)) => (1 2 3)', 'list'],
    ['reverse', 1,             'Reverse a list.',                                  '(reverse (list 1 2 3)) => (3 2 1)', 'list'],
    ['first',   1,             'First element.',                                   '(first (list 1 2 3)) => 1',         'list'],
    ['last',    1,             'Last element.',                                    '(last (list 1 2 3)) => 3',          'list'],
    ['nth',     2,             '(nth lst i) — the i-th element (0-indexed).',      '(nth (list 10 20 30) 1) => 20',     'list'],
    ['list-ref',2,             '(list-ref lst i) — R7RS spelling for nth.',        '(list-ref (list 10 20 30) 1) => 20','list'],
    ['member',  2,             '(member x lst) → tail beginning at x, or #f.',     "(member 2 '(1 2 3)) => (2 3)",      'list'],
    ['assoc',   2,             '(assoc key alist) — first pair whose car equals key, or #f.', "(assoc 'a '((a 1)(b 2))) => (a 1)", 'list'],
    ['make-list', 2,           '(make-list n v) → list of length n filled with v.', '(make-list 3 0) => (0 0 0)',       'list'],
    ['list-set', 3,            '(list-set lst i v) → a NEW list with element i replaced.', '(list-set (list 1 2 3) 1 9) => (1 9 3)', 'list'],
    ['take',    2,             '(take lst n) — first n elements.',                 '(take (list 1 2 3 4) 2) => (1 2)',  'list'],
    ['drop',    2,             '(drop lst n) — everything AFTER the first n.',     '(drop (list 1 2 3 4) 2) => (3 4)',  'list'],
    ['zip',     2,             'Pair up two lists element-wise.',                  '(zip (list 1 2) (list 3 4)) => ((1 3) (2 4))', 'list'],
    ['sort',    2,             '(sort lst less?) — stable ascending sort.',        '(sort (list 3 1 2) <) => (1 2 3)',  'list'],
    ['argmin',  1,             'Index of the smallest number in the list.',        '(argmin (list 5 2 8 2)) => 1',      'list'],

    // higher-order — the ones the REPL beginner reaches for
    ['for-each', 2,            'Call fn on every element for side-effects.',       '(for-each display (list 1 2))',     'higher-order'],
    ['map',      2,            'Apply fn to every element, collect the results.',  '(map (lambda (x) (* x x)) (list 1 2 3)) => (1 4 9)', 'higher-order'],
    ['filter',   2,            'Keep every element for which (pred x) is truthy.', '(filter odd? (list 1 2 3 4 5)) => (1 3 5)',          'higher-order'],
    ['reduce',   3,            '(reduce fn init lst) — left fold.',                '(reduce + 0 (list 1 2 3 4)) => 10',                  'higher-order'],
    ['apply',    2,            '(apply fn args) — call fn with the list of args.', '(apply + (list 1 2 3)) => 6',       'higher-order'],
    ['any',      2,            '#t if pred is truthy for some element.',           '(any odd? (list 2 4 5)) => #t',     'higher-order'],
    ['every',    2,            '#t if pred is truthy for every element.',          '(every odd? (list 1 3 5)) => #t',   'higher-order'],
    ['count',    2,            'How many elements satisfy pred.',                  '(count odd? (list 1 2 3 4)) => 2',  'higher-order'],
    ['list-index', 2,          'Index of the first element where pred is truthy, or #f.', '(list-index odd? (list 2 4 5)) => 2', 'higher-order'],

    // strings
    ['string-append',  [0, Infinity], 'Concatenate any number of strings.',                  '(string-append "hi" " " "there") => "hi there"', 'string'],
    ['string-length',  1,             'Character count.',                                    '(string-length "abc") => 3',            'string'],
    ['string-ref',     2,             '(string-ref s i) — the i-th character.',              '(string-ref "abc" 1) => "b"',           'string'],
    ['string=?',       2,             'String equality.',                                    '(string=? "a" "a") => #t',              'string'],
    ['string-eq?',     2,             'String equality — same as string=?.',                 '(string-eq? "a" "a") => #t',            'string'],
    ['substring',     [2, 3],         '(substring s a [b]) — a substring of s.',             '(substring "hello" 1 4) => "ell"',      'string'],
    ['number->string',[1, 2],         '(number->string n [radix]) — number to string.',      '(number->string 255 16) => "ff"',       'string'],
    ['string->number',[1, 2],         '(string->number s [radix]) — parse a number.',        '(string->number "42") => 42',           'string'],

    // I/O
    ['display', 1, 'Print value to stdout (strings unquoted). Returns void.', '(display "hi") ; prints hi',  'io'],
    ['newline', 0, 'Print a newline to stdout. Returns void.',                '(newline)',                   'io'],
    ['inspect', 1, 'Return a pretty string for any value.',                   '(inspect (list 1 2)) => "(1 2)"', 'io'],

    // randomness
    ['rng-uniform',  0, 'Uniform random in [0, 1).',                          '(rng-uniform) => 0.72…',           'random'],
    ['randint',      2, '(randint a b) — random integer in [a, b).',          '(randint 0 10) => 3',              'random'],
    ['random-int',   1, '(random-int n) — random integer in [0, n).',         '(random-int 6) => 4',              'random'],
    ['random-range', 2, '(random-range lo hi) — uniform float in [lo, hi).',  '(random-range 0 1) => 0.42…',      'random'],
    ['random-pick',  1, 'A random element from the list.',                    '(random-pick (list 1 2 3)) => 2',  'random'],
    ['pi',           0, 'The constant π (3.14159…).',                         '(pi)',                             'math'],
  ]

  for (const [name, arity, doc, exampleCode, namespace] of BASE_META) {
    registerVerbMeta(name, {
      name,
      arity,
      doc,
      examples: exampleCode ? [{ level: 'novice', code: exampleCode }] : [],
      namespace: namespace || null,
      perm: 'read',
      tier: 'base',
      source: 'src/base.js',
      since: 'motoi-scheme@0.1',
    })
  }
}

// Register once at module load so `motoi help car` works even
// before makeBaseEnv is called (the CLI's `help` command path never
// touches an Env).
registerBaseMetadata()

/**
 * Export the artifact verb roster as data so introspection / RAG / docs
 * can enumerate it without evaluating an env.
 */
export const ARTIFACT_CORE_VERBS = Object.freeze([
  { name: 'artifact/spawn',       arity: '(type . kwargs)', perm: 'state-change', returns: 'id' },
  { name: 'artifact/describe',    arity: '(id)',            perm: 'read',         returns: 'alist' },
  { name: 'artifact/apply',       arity: '(id form)',       perm: 'state-change', returns: 'new-state' },
  { name: 'artifact/read',        arity: '(id . path-kws)', perm: 'read',         returns: 'value | #f' },
  { name: 'artifact/on-event',    arity: '(id name proc)',  perm: 'read',         returns: 'unsubscribe-proc' },
  { name: 'artifact/at-location', arity: '(id)',            perm: 'read',         returns: '(x y w h) | #f' },
  { name: 'artifact/close',       arity: '(id)',            perm: 'state-change', returns: '#t | #f' },
  { name: 'artifact/list',        arity: '()',              perm: 'read',         returns: '(id ...)' },
])

/**
 * Phase-B artifact verbs — compose, nest, subscribe-cortex. Registered
 * separately so consumers can enumerate the two phases distinctly (RAG
 * indexers, docs emitters, taxonomy tools). Every entry still ships as
 * a headless stub via ARTIFACT_VERB_NAMES above; the real
 * implementation is wired by installArtifactVerbs (which now installs
 * both phases).
 */
export const ARTIFACT_PHASE_B_VERBS = Object.freeze([
  {
    name: 'artifact/compose',
    arity: '(primitives . kwargs)',
    perm: 'state-change',
    returns: 'id',
    doc: 'Ad-hoc composition. Build an artifact from a primitives list without a pre-registered composition. Kwargs: :chrome sym, :state expr, :type name, :frosting sym.',
    examples: [
      { level: 'novice',       code: "(artifact/compose (list 'heading 'paragraph) :chrome 'clean-surface :state '(:title \"Hi\"))" },
      { level: 'intermediate', code: "(artifact/compose (list (list 'heading :level 1) 'markdown-body) :chrome 'clean-surface :state '(:title \"Cases\" :body \"…\"))" },
      { level: 'expert',       code: "(let ((id (artifact/compose (list 'chat-log 'input-row) :chrome 'clean-surface :state '(:messages ())))) (artifact/apply id '(set :messages (list \"hi\"))))" },
    ],
  },
  {
    name: 'artifact/nest',
    arity: '(parent-id child . kwargs)',
    perm: 'state-change',
    returns: 'child-id',
    doc: 'Recursive rendering. Attach a child composition into a named slot on a parent. :where slot-symbol, :props initial-alist. Nested address syntax: parent-id:slot:child-id.',
    examples: [
      { level: 'novice',       code: "(artifact/nest shop-1 'listing :where 'items :props '(:sku \"A-1\"))" },
      { level: 'intermediate', code: "(artifact/nest shop-1 'listing :where 'items :props '(:sku \"A-1\")) (artifact/nest shop-1 'listing :where 'items :props '(:sku \"A-2\"))" },
      { level: 'expert',       code: "(let ((child (artifact/nest shop-1 'review-form :where 'reviews :props '(:for \"A-1\")))) (artifact/on-event shop-1 'child.* (lambda (r) (display r))))" },
    ],
  },
  {
    name: 'artifact/subscribe-cortex',
    arity: '(artifact-id cortex-path :on-change form)',
    perm: 'read',
    returns: 'subscription-id',
    doc: "Cortex return path. Fire a verb-form on the artifact when a Cortex node/edge changes. Cortex path uses ':' segments with '*' wildcards. The incoming change value is appended to the form's arguments.",
    examples: [
      { level: 'novice',       code: "(artifact/subscribe-cortex chat-1 \"cortex:message:*\" :on-change '(refresh))" },
      { level: 'intermediate', code: "(artifact/subscribe-cortex shop-1 \"shop:listing:*:price\" :on-change '(reprice))" },
      { level: 'expert',       code: "(let ((sub (artifact/subscribe-cortex chat-1 \"cortex:*\" :on-change '(update-from-cortex)))) sub)" },
    ],
  },
])

// rectOverlapsAny — strict overlap against the parallel placed-rect
// arrays. Strict because two cards touching at edges (a.x + a.w === b.x)
// are NOT overlapping — the GAP lives between them.
function rectOverlapsAny(x, y, w, h, px, py, pw, ph, n) {
  const xr = x + w
  const yb = y + h
  for (let i = 0; i < n; i++) {
    if (x < px[i] + pw[i] && px[i] < xr &&
        y < py[i] + ph[i] && py[i] < yb) return true
  }
  return false
}

function deepEqual(a, b) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }
  return false
}
