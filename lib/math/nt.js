// nt.js — number-theory verbs.
//
// Provenance: 2026-07-22. Wires 29 nt/* verbs from
// scheme/reference/44-nt.slat and scheme-books/book-of-math/
// ch-advanced-01-number-theory-cryptography.book.slatl.
//
// Doctrine (Alfred): honest math. Primality uses trial division for
// small n and Miller–Rabin for n > 10^6. Factorization uses trial
// division up to √n with early wheel factoring for 2, 3, 5. Every
// verb accepts a Number or BigInt-representable Number; overflow above
// Number.MAX_SAFE_INTEGER is honest — we don't silently produce wrong
// answers, we throw or use BigInt-safe operations where feasible.

import { Sym, sym, Pair } from '../../src/reader.js'
import { isRational } from './exact.js'

import { isList, isNull, seqVerb } from '../base/list.js'
// ── inline registration metadata ─────────────────────────────────
export const VERBS = [
  'nt/base-convert',
  'nt/composite?',
  'nt/continued-fraction',
  'nt/coprime?',
  'nt/crt',
  'nt/digit-sum',
  'nt/digital-root',
  'nt/divisible?',
  'nt/divisor-count',
  'nt/divisor-sum',
  'nt/divisors',
  'nt/divmod',
  'nt/even?',
  'nt/extended-gcd',
  'nt/factor',
  'nt/factor-tree',
  'nt/gcd',
  'nt/is-perfect?',
  'nt/lcm',
  'nt/mod',
  'nt/mod-inverse',
  'nt/mod-pow',
  'nt/next-prime',
  'nt/nth-prime',
  'nt/odd?',
  'nt/prime-factorization',
  'nt/prime?',
  'nt/sieve',
  'nt/totient',
]
export const LAZY = true
export const BOOK = 'book-of-math/ch-advanced-01-number-theory-cryptography'
export const TESTS = [
  ['(nt/prime? 17)', '#t'],
  ['(nt/gcd 48 18)', '6'],
  ['(nt/factor 60)', '(2 2 3 5)'],
]

// `Number({n,d})` is NaN, so before 2026-08-02 every nt/* verb handed a
// rational literal (`22/7`, read by src/reader.js into lib/math/exact.js's
// {n,d} object) silently produced NaN — nt/continued-fraction returned
// `(+nan.0)` for the very ratios its own examples pass it.
const num  = (x) => (typeof x === 'number' ? x
                   : isRational(x) ? Number(x.n) / Number(x.d)
                   : Number(x))
const nint = (x) => Math.trunc(num(x))
const abs  = (x) => (x < 0 ? -x : x)

// ── primality: trial then Miller–Rabin ─────────────────────────────

function isPrimeSmall(n) {
  n = Math.abs(n | 0) === 0 && n !== 0 ? Math.trunc(n) : Math.trunc(n)
  if (n < 2) return false
  if (n < 4) return true
  if (n % 2 === 0) return false
  if (n % 3 === 0) return n === 3
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0) return false
    if (n % (i + 2) === 0) return false
  }
  return true
}

// Modular exponentiation with BigInt (safe for large n).
function bigPowMod(base, exp, mod) {
  base = base % mod
  if (base < 0n) base += mod
  let result = 1n
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod
    base = (base * base) % mod
    exp >>= 1n
  }
  return result
}

// Miller–Rabin deterministic for n < 3,317,044,064,679,887,385,961,981
// with witnesses [2,3,5,7,11,13,17,19,23,29,31,37]. Kid-scale coverage.
function isPrimeMR(nNum) {
  if (nNum < 2) return false
  if (nNum === 2 || nNum === 3) return true
  if (nNum % 2 === 0) return false
  const n = BigInt(nNum)
  let d = n - 1n
  let r = 0n
  while ((d & 1n) === 0n) { d >>= 1n; r += 1n }
  const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]
  outer: for (const a of witnesses) {
    if (a >= n) continue
    let x = bigPowMod(a, d, n)
    if (x === 1n || x === n - 1n) continue
    for (let i = 0n; i < r - 1n; i++) {
      x = (x * x) % n
      if (x === n - 1n) continue outer
    }
    return false
  }
  return true
}

function primeQ(n) {
  n = nint(n)
  if (n < 2) return false
  if (n < 1_000_000) return isPrimeSmall(n)
  return isPrimeMR(n)
}

function factorize(n) {
  n = nint(n)
  if (n <= 1) return []
  const out = []
  while (n % 2 === 0) { out.push(2); n /= 2 }
  while (n % 3 === 0) { out.push(3); n /= 3 }
  for (let i = 5; i * i <= n; i += 6) {
    while (n % i === 0) { out.push(i); n /= i }
    while (n % (i + 2) === 0) { out.push(i + 2); n /= (i + 2) }
  }
  if (n > 1) out.push(n)
  return out
}

function gcdInt(a, b) {
  a = abs(nint(a)); b = abs(nint(b))
  while (b) { const t = b; b = a % b; a = t }
  return a
}

function extEuclid(a, b) {
  // returns [g, x, y] such that a·x + b·y = g
  a = nint(a); b = nint(b)
  let [oldR, r] = [a, b]
  let [oldS, s] = [1, 0]
  let [oldT, t] = [0, 1]
  while (r !== 0) {
    const q = Math.trunc(oldR / r)
    ;[oldR, r] = [r, oldR - q * r]
    ;[oldS, s] = [s, oldS - q * s]
    ;[oldT, t] = [t, oldT - q * t]
  }
  return [oldR, oldS, oldT]
}

export function installNumberTheory(env, ctx) {
  const def = (name, fn) => env.define(name, seqVerb(fn), { perm: 'read' })

  // ── divisibility / parity ────────────────────────────────────────
  def('nt/even?', (n) => nint(n) % 2 === 0)
  def('nt/odd?',  (n) => Math.abs(nint(n) % 2) === 1)
  // (nt/divisible? a b): does b evenly divide a?
  def('nt/divisible?', (a, b) => {
    const B = nint(b)
    if (B === 0) return false
    return nint(a) % B === 0
  })
  def('nt/mod', (a, b) => {
    const B = nint(b); if (B === 0) return 0
    const r = nint(a) % B
    return r < 0 ? r + Math.abs(B) : r
  })
  def('nt/divmod', (a, b) => {
    const B = nint(b); if (B === 0) return [[sym('quotient'), 0], [sym('remainder'), 0]]
    const q = Math.trunc(nint(a) / B)
    let r = nint(a) - q * B
    return [[sym('quotient'), q], [sym('remainder'), r]]
  })

  // ── gcd / lcm / extended ────────────────────────────────────────
  def('nt/gcd', (a, b) => gcdInt(a, b))
  def('nt/lcm', (a, b) => {
    const A = abs(nint(a)), B = abs(nint(b))
    if (A === 0 || B === 0) return 0
    return (A / gcdInt(A, B)) * B
  })
  def('nt/coprime?', (a, b) => gcdInt(a, b) === 1)
  def('nt/extended-gcd', (a, b) => {
    const [g, x, y] = extEuclid(a, b)
    return [[sym('gcd'), g], [sym('x'), x], [sym('y'), y]]
  })

  // ── primality / factoring ───────────────────────────────────────
  def('nt/prime?',     (n) => primeQ(n))
  def('nt/composite?', (n) => { const N = nint(n); return N > 1 && !primeQ(N) })
  def('nt/factor', (n) => factorize(n))
  // Returns an a-list of DOTTED pairs, `((p1 . e1) (p2 . e2) ...)`, exactly as
  // 44-nt.slat's :signature declares and as all 7 of its documented accessors
  // read it (`(cdr pair)` → the exponent, never `(cadr pair)`). Before
  // 2026-08-02 this pushed two-element lists, so `(cdr pair)` handed back the
  // one-element list `(e)` and every exponent arithmetic silently took a list.
  def('nt/prime-factorization', (n) => {
    const fs = factorize(n)
    const out = []
    let cur = null, count = 0
    for (const p of fs) {
      if (cur === p) count++
      else { if (cur !== null) out.push(new Pair(cur, count)); cur = p; count = 1 }
    }
    if (cur !== null) out.push(new Pair(cur, count))
    return out
  })
  def('nt/factor-tree', (n) => {
    const N = nint(n)
    if (N <= 1) return N
    // Recursive tree: smallest prime factor + rest.
    function tree(m) {
      if (m <= 1) return m
      if (primeQ(m)) return m
      // find smallest prime factor
      if (m % 2 === 0) return [m, 2, tree(m / 2)]
      if (m % 3 === 0) return [m, 3, tree(m / 3)]
      for (let i = 5; i * i <= m; i += 6) {
        if (m % i === 0) return [m, i, tree(m / i)]
        if (m % (i + 2) === 0) return [m, i + 2, tree(m / (i + 2))]
      }
      return m
    }
    return tree(N)
  })

  // Sieve of Eratosthenes: all primes ≤ n.
  def('nt/sieve', (n) => {
    const N = nint(n)
    if (N < 2) return []
    const sieve = new Uint8Array(N + 1)
    for (let i = 2; i * i <= N; i++) {
      if (!sieve[i]) for (let j = i * i; j <= N; j += i) sieve[j] = 1
    }
    const out = []
    for (let i = 2; i <= N; i++) if (!sieve[i]) out.push(i)
    return out
  })

  def('nt/next-prime', (n) => {
    let k = nint(n) + 1
    if (k < 2) k = 2
    while (!primeQ(k)) k++
    return k
  })

  def('nt/nth-prime', (n) => {
    const N = Math.max(1, nint(n))
    // Estimate upper bound via prime-counting: p_n ~ n·ln(n) for large n.
    let upper = Math.max(30, Math.floor(N * (Math.log(N) + Math.log(Math.log(N + 3)) + 1)))
    while (true) {
      const primes = env.vars.get('nt/sieve')(upper)
      if (primes.length >= N) return primes[N - 1]
      upper *= 2
    }
  })

  // ── divisors / perfect numbers ──────────────────────────────────
  def('nt/divisors', (n) => {
    const N = Math.abs(nint(n))
    if (N === 0) return []
    const out = []
    for (let i = 1; i * i <= N; i++) {
      if (N % i === 0) { out.push(i); if (i !== N / i) out.push(N / i) }
    }
    return out.sort((a, b) => a - b)
  })
  def('nt/divisor-count', (n) => {
    const N = Math.abs(nint(n)); if (N === 0) return 0
    let count = 0
    for (let i = 1; i * i <= N; i++) if (N % i === 0) count += (i * i === N ? 1 : 2)
    return count
  })
  def('nt/divisor-sum', (n) => {
    const N = Math.abs(nint(n)); if (N === 0) return 0
    let s = 0
    for (let i = 1; i * i <= N; i++) {
      if (N % i === 0) { s += i; if (i * i !== N) s += N / i }
    }
    return s
  })
  def('nt/is-perfect?', (n) => {
    const N = nint(n); if (N <= 1) return false
    let s = 1
    for (let i = 2; i * i <= N; i++) {
      if (N % i === 0) { s += i; if (i * i !== N) s += N / i }
    }
    return s === N
  })

  // ── modular arithmetic ─────────────────────────────────────────
  // `nt/mod-inverse` reports "no inverse" as the empty list (Scheme's null);
  // older callers compared against JS null, so accept both.
  const noInverse = (v) => v === null || (isNull(v))

  def('nt/mod-pow', (base, exp, mod) => {
    const M = BigInt(nint(mod))
    if (M === 0n) return 0
    const B = BigInt(nint(base))
    const E = BigInt(nint(exp))
    if (E < 0n) {
      // Use mod-inverse fallback if exp negative
      const inv = env.vars.get('nt/mod-inverse')(nint(base), nint(mod))
      if (noInverse(inv)) return []
      return Number(bigPowMod(BigInt(inv), -E, M))
    }
    return Number(bigPowMod(B, E, M))
  })

  // 44-nt.slat declares `-> number | null` and every documented guard reads it
  // with `(null? inv)`. In Scheme "null" is the EMPTY LIST, so the no-inverse
  // case must return `'()` — a JS `null` made `(null? inv)` answer #f and the
  // guarded multiply then ran on a non-number.
  def('nt/mod-inverse', (a, m) => {
    const A = nint(a), M = nint(m)
    if (M <= 0) return []
    const [g, x] = extEuclid(A, M)
    if (g !== 1 && g !== -1) return []
    let inv = x % M
    if (inv < 0) inv += M
    return inv
  })

  // Chinese remainder theorem. residues + moduli parallel lists.
  def('nt/crt', (residues, moduli) => {
    if (!isList(residues) || !isList(moduli)) return null
    if (residues.length !== moduli.length) return null
    let x = 0, M = 1
    for (let i = 0; i < moduli.length; i++) {
      const mi = nint(moduli[i])
      if (mi <= 0) return null
      M *= mi
    }
    for (let i = 0; i < residues.length; i++) {
      const ri = nint(residues[i])
      const mi = nint(moduli[i])
      const Mi = M / mi
      const inv = env.vars.get('nt/mod-inverse')(Mi % mi, mi)
      if (noInverse(inv)) return null
      x += ri * Mi * inv
    }
    return ((x % M) + M) % M
  })

  // Euler totient φ(n).
  def('nt/totient', (n) => {
    let N = nint(n)
    if (N < 1) return 0
    let result = N
    for (let p = 2; p * p <= N; p++) {
      if (N % p === 0) {
        while (N % p === 0) N /= p
        result -= result / p
      }
    }
    if (N > 1) result -= result / N
    return Math.round(result)
  })

  // ── base conversion, digit stuff ────────────────────────────────
  def('nt/base-convert', (number, fromBase, toBase) => {
    const from = nint(fromBase), to = nint(toBase)
    if (from < 2 || from > 36 || to < 2 || to > 36) return sym('bad-base')
    let val
    if (typeof number === 'string') {
      val = parseInt(number, from)
    } else {
      val = nint(number)
      if (from !== 10) {
        // Treat as decimal string of digits when from != 10 and input is number.
        val = parseInt(String(number), from)
      }
    }
    if (!Number.isFinite(val)) return sym('invalid')
    return val.toString(to).toUpperCase()
  })

  def('nt/digit-sum', (n) => {
    let N = Math.abs(nint(n))
    let s = 0
    while (N > 0) { s += N % 10; N = Math.floor(N / 10) }
    return s
  })
  def('nt/digital-root', (n) => {
    let N = Math.abs(nint(n))
    if (N === 0) return 0
    const r = N % 9
    return r === 0 ? 9 : r
  })

  // Continued-fraction expansion of a real number (or ratio).
  def('nt/continued-fraction', (x, maxDepth) => {
    const D = Math.max(1, nint(maxDepth) || 20)
    // For an exact rational the expansion IS the Euclidean algorithm, and it
    // terminates — run it on n/d so p/q gets the exact finite answer instead
    // of a float-rounded one. (44-nt.slat :explanation says exactly this.)
    if (isRational(x)) {
      let p = x.n, q = x.d
      const out = []
      for (let i = 0; i < D && q !== 0n; i++) {
        let a = p / q                       // BigInt division truncates …
        if (p % q !== 0n && (p < 0n) !== (q < 0n)) a -= 1n   // … we want floor
        out.push(Number(a))
        const r = p - a * q
        if (r === 0n) break
        p = q; q = r
      }
      return out
    }
    let val = num(x)
    const out = []
    for (let i = 0; i < D; i++) {
      const a = Math.floor(val)
      out.push(a)
      const frac = val - a
      if (Math.abs(frac) < 1e-12) break
      val = 1 / frac
      if (!Number.isFinite(val)) break
    }
    return out
  })

  return env
}

export default installNumberTheory
