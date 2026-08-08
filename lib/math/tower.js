// tower.js — exactness for the Motoi number tower.
//
// R7RS §6.2 splits every number into EXACT and INEXACT, and the split is
// observable: `(exact? 1)` is #t, `(exact? 1.0)` is #f, `(eqv? 1 1.0)` is #f,
// and `(write 1.0)` prints `1.0`. Motoi had one carrier for both — the JS
// double — so `1` and `1.0` were the same object. `exact?` and `inexact?`
// contradicted each other, `(number->string 1.0)` printed "1", and the printer
// re-dated every value in the books.
//
// The representation:
//
//   exact integer    JS number (integral) — small; JS bigint — large
//   exact rational   { n: BigInt, d: BigInt } from lib/math/exact.js
//   inexact real     Flo (below), or a NON-INTEGRAL JS number
//
// Two carriers for inexact reals is deliberate, not sloppiness. A non-integral
// double (0.5, +inf.0, +nan.0, the result of `sqrt`) is ALREADY unambiguously
// inexact — nothing exact ever lands there, because exact non-integers are
// Rationals. So `Flo` is only strictly required for an inexact value that
// happens to be integral: 1.0, 100.0, -0.0.
//
// That choice is what makes the change tractable. `Flo extends Number`, so a
// call site that has not been taught about exactness still computes the RIGHT
// NUMBER — `Math.floor(flo)`, `flo * 2`, `flo < 3` all work through valueOf.
// Such a site loses only the inexactness TAG on an integral result, which is
// exactly the behaviour that shipped before this file existed. Missing a site
// degrades to the old answer; it does not corrupt one.

import { isRational, makeRational } from './exact.js'

// The wrapper for an inexact real. Extending Number rather than boxing in a
// plain object is the load-bearing detail: see the note above.
export class Flo extends Number {}

export const isFlo = (v) => v instanceof Flo

// Wrap a JS double as an inexact real. Non-integral doubles need no wrapper —
// they cannot be mistaken for an exact value — so they are returned bare, which
// keeps the common float path allocation-free.
export function flo(x) {
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isInteger(n) ? new Flo(n) : n
}

export const isNum = (v) =>
  typeof v === 'number' || typeof v === 'bigint' || v instanceof Flo || isRational(v)

// The JS double behind any number in the tower. Lossy for a big exact integer
// or a fine-grained rational, which is correct: this is the coercion R7RS calls
// `inexact`, and every caller of it is doing float math.
export function num(v) {
  if (typeof v === 'number') return v
  if (v instanceof Flo) return v.valueOf()
  if (typeof v === 'bigint') return Number(v)
  if (isRational(v)) return Number(v.n) / Number(v.d)
  return Number(v)
}

export function isExact(v) {
  if (v instanceof Flo) return false
  if (isRational(v) || typeof v === 'bigint') return true
  if (typeof v === 'number') return Number.isInteger(v)
  return false
}

export const isInexact = (v) => isNum(v) && !isExact(v)

// True for a value that denotes a mathematical integer, whatever its exactness
// — `(integer? 3.0)` is #t. Distinct from `exact-integer?`, which also demands
// exactness.
export function isIntegerValued(v) {
  if (typeof v === 'bigint') return true
  if (isRational(v)) return v.d === 1n
  const n = num(v)
  return Number.isFinite(n) && Number.isInteger(n)
}

// R7RS `inexact`: every number has an inexact image.
export const toInexact = (v) => flo(num(v))

// R7RS `exact`: the exact number the argument denotes. An inexact integer maps
// to that integer; any other finite double maps to the exact rational it names.
// A double IS a dyadic rational, so this is exact, not an approximation — the
// old float->rational helper rounded through a fixed 1e9 scale and turned 0.1
// into 100000000/1000000000 rather than the value the machine actually holds.
export function toExact(v) {
  if (isExact(v)) return v
  const n = num(v)
  if (!Number.isFinite(n)) {
    throw new Error(`exact: ${Number.isNaN(n) ? '+nan.0' : (n > 0 ? '+inf.0' : '-inf.0')} has no exact value`)
  }
  if (Number.isInteger(n)) return Object.is(n, -0) ? 0 : n
  let d = 1n
  let x = n
  // Doubles carry at most 1074 fractional bits, so this always terminates.
  while (!Number.isInteger(x)) { x *= 2; d *= 2n }
  return makeRational(BigInt(x), d)
}

// Exactness CONTAGION (§6.2.2): a numeric operation on mixed arguments yields
// an inexact result. Every arithmetic verb routes its result through this.
export const anyInexact = (args) => args.some(isInexact)

// Wrap a computed result to match the exactness the arguments imply. `exactVal`
// is the answer computed in the exact domain; it is only consulted when nothing
// inexact was involved.
export function withExactness(args, result) {
  return anyInexact(args) ? flo(num(result)) : result
}

// Numeric equality ACROSS exactness — `(= 1 1.0)` is #t. Compared through
// bigint when both sides are exact so that two integers past 2^53 are not
// squashed into the same double: `(= 9007199254740992 9007199254740993)` must
// be #f, and it was #t while both sides went through Number().
// True for an exact value that Number() cannot hold without losing digits. A
// plain JS number always survives the trip; a bigint past 2^53 and a rational
// with a fine denominator do not, and those are exactly the comparisons that
// have to be settled as fractions rather than as doubles.
const _wide = (v) => typeof v === 'bigint' || isRational(v)

// Compare across exactness by MATHEMATICAL value (§6.2.5), which is what `=`
// and `<` mean. Squashing both sides through Number() first made
// `(= 9007199254740992.0 9007199254740993)` answer #t and
// `(= 1/3 .3333333333333333)` answer #t — in both cases the exact operand lost
// the digits that decide the question. A finite double IS a dyadic rational,
// so the comparison can be done exactly; only an infinity or a NaN cannot.
function _crossCmp(a, b) {
  const x = num(a), y = num(b)
  if (Number.isNaN(x) || Number.isNaN(y)) return null
  if (!Number.isFinite(x) || !Number.isFinite(y)) return x < y ? -1 : x > y ? 1 : 0
  if (!_wide(a) && !_wide(b)) return x < y ? -1 : x > y ? 1 : 0
  return ratCmp(toExact(a), toExact(b))
}

export function numEq(a, b) {
  if (isExact(a) && isExact(b)) return ratCmp(a, b) === 0
  return _crossCmp(a, b) === 0
}

export function numCmp(a, b) {
  if (isExact(a) && isExact(b)) return ratCmp(a, b)
  const c = _crossCmp(a, b)
  return c === null ? 0 : c
}

// Compare two EXACT numbers as fractions, which keeps full precision.
function ratCmp(a, b) {
  const [an, ad] = asFraction(a)
  const [bn, bd] = asFraction(b)
  const l = an * bd, r = bn * ad
  return l < r ? -1 : l > r ? 1 : 0
}

// Reduce a BigInt fraction to the smallest carrier that can hold it exactly:
// a JS number while it stays inside the safe-integer range, a bigint past it,
// a Rational when the denominator does not divide out.
export function normExact(n, d) {
  if (d < 0n) { n = -n; d = -d }
  let a = n < 0n ? -n : n
  let b = d
  while (b) { [a, b] = [b, a % b] }
  const g = a || 1n
  n /= g; d /= g
  if (d !== 1n) return makeRational(n, d)
  return (n <= 9007199254740991n && n >= -9007199254740991n) ? Number(n) : n
}

// The exact value a DECIMAL LITERAL spells, or null when the text is not
// decimal notation. `#e0.1` is 1/10 — the value the digits name — not the
// dyadic rational the double 0.1 rounds to, and `#e1e1000` is an integer far
// outside the double range. So `#e` cannot be "parse as a double, then coerce";
// it has to read the digits.
export function exactFromDecimal(str) {
  const m = /^([+-]?)([0-9]*)(?:\.([0-9]*))?(?:[eE]([+-]?[0-9]+))?$/.exec(str)
  if (!m) return null
  const [, sign, int, frac = '', exp] = m
  if (int === '' && frac === '') return null
  const e = exp ? Number(exp) : 0
  if (Math.abs(e) > 1e6) return null      // §6.2.7: not a representable number
  let n = BigInt((int || '0') + frac)
  let d = 10n ** BigInt(frac.length)
  if (e > 0) n *= 10n ** BigInt(e)
  else if (e < 0) d *= 10n ** BigInt(-e)
  return normExact(sign === '-' ? -n : n, d)
}

export function asFraction(v) {
  if (isRational(v)) return [v.n, v.d]
  if (typeof v === 'bigint') return [v, 1n]
  if (typeof v === 'number' && Number.isInteger(v)) return [BigInt(v), 1n]
  const e = toExact(v)
  return isRational(e) ? [e.n, e.d] : [BigInt(e), 1n]
}

// `eqv?` on numbers (§6.1): equal in value AND in exactness. Also the reason
// `(eqv? 0.0 -0.0)` is #f — they are distinguishable, and Object.is says so.
// Newton's method on BigInt: the floor of the square root, exactly, at any
// size. `Math.sqrt` on a value past 2^53 has already lost the digits that
// decide whether the root is exact.
export function bigISqrt(v) {
  if (v < 0n) return null
  if (v < 2n) return v
  let x = v
  let y = (x + 1n) / 2n
  while (y < x) { x = y; y = (x + v / x) / 2n }
  return x
}

// The exact square root of an exact number, or null when there isn't one.
// `sqrt` and `math/sqrt` both go through here so the two cannot disagree.
export function exactSqrt(v) {
  if (!isExact(v)) return null
  const [n, d] = asFraction(v)
  if (n < 0n) return null
  const sn = bigISqrt(n)
  const sd = bigISqrt(d)
  return (sn * sn === n && sd * sd === d) ? normExact(sn, sd) : null
}

// Exponentiation for the whole tower. An exact base raised to a non-negative
// exact integer power stays exact — 2^62 is 4611686018427387904, not the
// 4611686018427388000 a double rounds it to. Everything else is inexact.
// `expt` and `math/pow` are documented as the same procedure; this is it.
export function exptNum(b, p) {
  if (isExact(b) && isExact(p) && isIntegerValued(p) && Math.abs(num(p)) < 1e6) {
    const [bn, bd] = asFraction(b)
    const e = BigInt(Math.abs(num(p)))
    // A NEGATIVE exact exponent is still exact — it just inverts the fraction,
    // so `(expt 2 -1)` is 1/2 and not the 0.5 a double gives. Zero has no
    // reciprocal, so that one case falls through to the float path (+inf.0).
    if (num(p) < 0) {
      if (bn === 0n) return flo(Math.pow(num(b), num(p)))
      return normExact(bd ** e, bn ** e)
    }
    return normExact(bn ** e, bd ** e)
  }
  return flo(Math.pow(num(b), num(p)))
}

// §6.2.6 defines numerator/denominator on the number's EXACT value and then
// puts the argument's exactness back: `(numerator 0.5)` is 1.0, not 0.5, and
// `(denominator 0.5)` is 2.0. Both used to hand a non-rational straight back.
export function numeratorOf(v) {
  if (!Number.isFinite(num(v))) return v
  return withExactness([v], normExact(asFraction(v)[0], 1n))
}
export function denominatorOf(v) {
  if (!Number.isFinite(num(v))) return v
  return withExactness([v], normExact(asFraction(v)[1], 1n))
}

export function numEqv(a, b) {
  if (isExact(a) !== isExact(b)) return false
  if (isExact(a)) return numEq(a, b)
  return Object.is(num(a), num(b))
}

// How a real prints (§6.2.6 / §6.13.3). The whole point of the exercise: an
// inexact integer must show its decimal point, or it reads back as an exact.
export function numToString(v) {
  if (isRational(v)) return v.d === 1n ? String(v.n) : `${v.n}/${v.d}`
  if (typeof v === 'bigint') return String(v)
  const n = num(v)
  if (n === Infinity) return '+inf.0'
  if (n === -Infinity) return '-inf.0'
  if (Number.isNaN(n)) return '+nan.0'
  if (isExact(v)) return String(n)
  if (Object.is(n, -0)) return '-0.0'
  const s = String(n)
  // A double big enough to print in exponent notation is already inexact
  // notation — "2e+200" reads back as a double. Appending the decimal point
  // anyway produced "2e+200.0", which is not a number at all and read back
  // as #f, so `(string->number (number->string x))` lost the value.
  if (Number.isInteger(n) && !s.includes('e')) return `${s}.0`
  return s
}
