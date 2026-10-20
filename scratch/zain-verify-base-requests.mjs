// Verifies ZAIN-BASE-REQUESTS.md by applying every requested replacement at
// the ENV level (the same expressions, bound over the installed ones) and
// running the chibi assertions that each one is supposed to fix. This is not a
// substitute for the source edits — it is the evidence that those exact
// expressions produce the answers claimed.
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'
import { isCpx, cpxToString, makeComplex } from '../lib/math/complex.js'
import { isNum, num, numEqv, flo } from '../lib/math/tower.js'
import { complexFromString } from '../src/reader.js'

const env = makeCoreEnv()
const def = (n, f) => env.define(n, f, { perm: 'read' })

// A1/A2
const _realArg = (name, x) => {
  if (isCpx(x)) throw new Error(`${name}: expected a real number, got a complex number`)
  if (!isNum(x)) throw new Error(`${name}: expected a number`)
  return x
}
def('make-rectangular', (re, im) =>
  makeComplex(_realArg('make-rectangular', re), _realArg('make-rectangular', im ?? 0)))
def('make-polar', (mag, ang) => {
  const m = num(_realArg('make-polar', mag))
  const a = num(_realArg('make-polar', ang ?? 0))
  return makeComplex(flo(m * Math.cos(a)), flo(m * Math.sin(a)))
})

// B3
const _isNumB = (x) => isNum(x)
def('zero?', (x) => isCpx(x)
  ? num(x.re) === 0 && num(x.im) === 0
  : _isNumB(x) && num(x) === 0)

// B2 — the `=` chain, rebuilt with the corrected _cpxRe.
const _cpxRe = (v) => Number(isCpx(v) ? v.re : num(v))
const _cpxIm = (v) => (isCpx(v) ? Number(v.im) : 0)
def('=', (...a) => {
  for (let i = 0; i + 1 < a.length; i++) {
    const x = a[i], y = a[i + 1]
    if (isCpx(x) || isCpx(y)) {
      if (!(_cpxRe(x) === _cpxRe(y) && _cpxIm(x) === _cpxIm(y))) return false
    } else if (!(num(x) === num(y))) return false
  }
  return true
})

// B4
def('eqv?', (a, b) => {
  if (isCpx(a) || isCpx(b)) {
    return isCpx(a) && isCpx(b) && numEqv(a.re, b.re) && numEqv(a.im, b.im)
  }
  if (isNum(a) && isNum(b)) return numEqv(a, b)
  return a === b
})

// B5
const _n2s = env.get('number->string')
def('number->string', (n, radix) => isCpx(n) ? cpxToString(n) : _n2s(n, radix))

// B6
const _s2n = env.get('string->number')
def('string->number', (s, radix) => {
  const r = isNum(radix) ? (num(radix) | 0) : 10
  const z = complexFromString(String(s), r, null)
  return z !== null ? z : _s2n(s, radix)
})

// A3/B1 — one printer for every write/display path.
def('write', (v) => { process.stdout.write(fmt(v)); return undefined })
function fmt (v) {
  if (isCpx(v)) return cpxToString(v)
  return String(v)
}

const run = (src) => {
  const { forms } = expandProgram(parse(src), { env })
  let last
  for (const f of forms) last = evaluate(f, env, { n: 1e9 })
  return last
}

// str -> the text `write` must produce, and the acceptable spellings from
// chibi's own test-numeric-syntax lines.
const WRITE_CASES = [
  ['+i', ['+i', '+1i', '0+i', '0+1i']],
  ['0+i', ['+i', '+1i', '0+i', '0+1i']],
  ['0+1i', ['+i', '+1i', '0+i', '0+1i']],
  ['-i', ['-i', '-1i', '0-i', '0-1i']],
  ['0-i', ['-i', '-1i', '0-i', '0-1i']],
  ['0-1i', ['-i', '-1i', '0-i', '0-1i']],
  ['+2i', ['2i', '+2i', '0+2i']],
  ['-2i', ['-2i', '0-2i']],
  ['1+2i', ['1+2i']],
  ['1+2I', ['1+2i']],
  ['1.0+2i', ['1.0+2.0i', '1.0+2i', '1.+2i', '1.+2.i']],
  ['1+2.0i', ['1.0+2.0i', '1+2.0i', '1.+2.i', '1+2.i']],
  ['1e2+1.0i', ['100.0+1.0i', '100.+1.i']],
  ['1s2+1.0i', ['100.0+1.0i', '100.+1.i']],
  ['1.0+1e2i', ['1.0+100.0i', '1.+100.i']],
  ['1.0+1s2i', ['1.0+100.0i', '1.+100.i']],
  ['1/2+3/4i', ['1/2+3/4i']],
  ['0.5+3/4i', ['0.5+0.75i', '.5+.75i', '0.5+3/4i', '.5+3/4i', '500.0e-3+750.0e-3i']],
  ['+inf.0+inf.0i', ['+inf.0+inf.0i', '+Inf.0+Inf.0i']],
  ['-inf.0+inf.0i', ['-inf.0+inf.0i', '-Inf.0+Inf.0i']],
  ['-inf.0-inf.0i', ['-inf.0-inf.0i', '-Inf.0-Inf.0i']],
  ['+inf.0-inf.0i', ['+inf.0-inf.0i', '+Inf.0-Inf.0i']],
  ['#d1.0+1.0i', ['1.0+1.0i', '1.+1.i']],
  ['#d10+11i', ['10+11i']],
]

let pass = 0, fail = 0
for (const [src, ok] of WRITE_CASES) {
  const v = run(src)
  const s = isCpx(v) ? cpxToString(v) : String(v)
  const good = ok.includes(s)
  if (good) pass++; else { fail++; console.log('WRITE FAIL', src, '->', s, 'want one of', ok) }
}

const EXPR_CASES = [
  ['(= 1 1.0 1.0+0.0i)', '#t'],
  ['(= 1.0 1.0+1.0i)', '#f'],
  ['(zero? 0.0+0.0i)', '#t'],
  ['(zero? 1+2i)', '#f'],
  ['(eqv? (make-rectangular 3 4) (make-rectangular 3 4))', '#t'],
  ['(eqv? 1.0+2.0i 1.0+2.0i)', '#t'],
  ['(eqv? 1+2i 1.0+2.0i)', '#f'],
  ['(number->string (make-rectangular 1 2))', '1+2i'],
  ['(number->string 1/2+3/4i)', '1/2+3/4i'],
  ['(string->number "1+2i")', '1+2i'],
  // The `#x` prefix is stripped by string->number BEFORE the complex attempt
  // in B6, so the radix reaches it as an argument. This harness has no prefix
  // loop of its own; passing 16 exercises the same line.
  ['(string->number "1+2i" 16)', '1+2i'],
  ['(string->number "+i")', '0+i'],
  ['(string->number "abc")', '#f'],
  ['(string->number "#e+inf.0i")', '#f'],
  ['(make-rectangular 1 2)', '1+2i'],
  ['(make-rectangular (/ 1 2) (/ 3 4))', '1/2+3/4i'],
  ['(make-rectangular 3 0)', '3'],
  ['(real-part 1+2i)', '1'],
  ['(imag-part 1+2i)', '2'],
  ['(magnitude 1+2i)', '2.23606797749979'],
]
for (const [src, want] of EXPR_CASES) {
  let got
  try {
    const v = run(src)
    got = v === true ? '#t' : v === false ? '#f'
      : isCpx(v) ? cpxToString(v) : String(v)
  } catch (e) { got = 'RAISED ' + e.message }
  if (got === want) pass++; else { fail++; console.log('EXPR FAIL', src, '->', got, 'want', want) }
}

console.log(`pass ${pass}  fail ${fail}`)
