# ZAIN-BASE-REQUESTS — complex numbers, 2026-08-03

Everything in `src/reader.js`, `src/cli.js`, `lib/math/complex.js` and
`lib/std/r7rs-completions-core.js` is already done and green (768/768 tests,
chibi 1121 -> 1149). The eight edits below are in files I do not own.

The whole surface is now in `lib/math/complex.js`:

- `isCpx(v)` — the tag test.
- `makeComplex(re, im)` — the canonical constructor. Takes TOWER values (not
  doubles) and collapses an EXACT zero imaginary part to the real itself, which
  is what makes `(integer? 3+0i)` #t while `-2.5+0.0i` stays complex.
- `cpxToString(z)` — §6.2.7 spelling; `(string->number (number->string z))`
  recovers z for every literal I tested.

Reading is done. These eight are the printing + `zero?`/`=` half.

**Verified, not guessed.** `scratch/zain-verify-base-requests.mjs` binds every
expression below over the installed env and runs the chibi assertions each one
is meant to fix: `node scratch/zain-verify-base-requests.mjs` -> `pass 44
fail 0`. That is evidence for the expressions, not for the textual splice.

**One reference divergence lands with A3/B1.** `scheme/reference/17-complex.slat`
says in prose (line 46, line 92) that the unit imaginary prints as `i` and the
orbit as `(1 i -1 -i 1)`. It will print `0+i` and `(1 0+i -1 0-i 1)`. `i` is
not a number to Motoi's reader — nor to chibi's — so the old spelling breaks
the §6.2.7 round trip the standard requires; `0+i` is what chibi writes and is
on chibi's own accepted list. The reference prose needs the update; I have not
touched it.

---

## A. `lib/base/r7rs-small.js`

### A1 — the constructor drops exactness

`_mkCpx` coerces with `+`, so `(make-rectangular 1/2 3/4)` builds `NaN-NaNi`
and `(make-rectangular 1 2)` builds inexact components. `_realArg` returns a
JS double for the same reason.

CURRENT (~line 507):

```js
  const CPX_TAG = Symbol.for('motoi:complex')
  const _isCpx = (v) => v != null && typeof v === 'object' && v[CPX_TAG] === true
  const _mkCpx = (re, im) => ({ [CPX_TAG]: true, re: +re, im: +im })
```

REPLACEMENT:

```js
  const _isCpx = isCpx
  const _mkCpx = makeComplex
```

### A2 — the real-component guard

CURRENT (~line 517):

```js
  // A REAL argument as a JS double — rejects a complex, because the
  // constructors below take real components only.
  const _realArg = (name, x) => {
    if (_isCpx(x)) {
      throw new ErrorObject(`${name}: expected a real number, got a complex number`, [x])
    }
    return _cpxParts(name, x)[0]
  }
  def('make-rectangular', (re, im) =>
    _mkCpx(_realArg('make-rectangular', re), _realArg('make-rectangular', im ?? 0)))
  def('make-polar', (mag, ang) => {
    const m = _realArg('make-polar', mag)
    const a = _realArg('make-polar', ang ?? 0)
    return _mkCpx(m * Math.cos(a), m * Math.sin(a))
  })
```

REPLACEMENT:

```js
  // A REAL argument, kept as the TOWER value it was — `_cpxParts` flattens to
  // a double, and `(make-rectangular 1/2 3/4)` has to stay 1/2+3/4i.
  const _realArg = (name, x) => {
    if (_isCpx(x)) {
      throw new ErrorObject(`${name}: expected a real number, got a complex number`, [x])
    }
    if (!isNum(x)) {
      throw new ErrorObject(`${name}: expected a number, got ${_describeVal(x)}`, [x])
    }
    return x
  }
  def('make-rectangular', (re, im) =>
    _mkCpx(_realArg('make-rectangular', re), _realArg('make-rectangular', im ?? 0)))
  // §6.2.5: polar goes through a transcendental, so the result is inexact even
  // when both arguments were exact.
  def('make-polar', (mag, ang) => {
    const m = num(_realArg('make-polar', mag))
    const a = num(_realArg('make-polar', ang ?? 0))
    return _mkCpx(flo(m * Math.cos(a)), flo(m * Math.sin(a)))
  })
```

### A3 — `write` prints a complex that cannot be read back

This is the live `write` (it shadows `lib/std/`'s). `Number(v.re)` throws away
exactness and the tower's spelling, so `+inf.0+inf.0i` writes as
`Infinity+Infinityi`, `1/2+3/4i` as `NaN-NaNi`, and `1.0+2.0i` as `1+2i`.
About twenty chibi assertions ride on this one branch.

CURRENT (~line 1573, inside `_renderForWrite`):

```js
    if (v && typeof v === 'object' && v[Symbol.for('motoi:complex')] === true) {
      const re = Number(v.re), im = Number(v.im)
      if (im === 0) return String(re)
      const ai = Math.abs(im)
      const imPart = ai === 1 ? 'i' : `${ai}i`
      if (re === 0) return im < 0 ? `-${imPart}` : imPart
      return `${re}${im >= 0 ? '+' : '-'}${imPart}`
    }
```

REPLACEMENT:

```js
    if (isCpx(v)) return cpxToString(v)
```

### A4 — the import

CURRENT (line 26):

```js
import { isRational, makeRational } from '../math/exact.js'
```

REPLACEMENT:

```js
import { isRational, makeRational } from '../math/exact.js'
import { isCpx, makeComplex, cpxToString } from '../math/complex.js'
```

---

## B. `src/base.js`

### B1 — `display` prints a complex that cannot be read back

Same defect as A3, second copy.

CURRENT (~line 753, inside `_displayFormat`):

```js
    // Complex numbers (lib/math/complex.js) — carry the shared tag.
    const CPX_TAG = Symbol.for('motoi:complex')
    if (v && typeof v === 'object' && v[CPX_TAG] === true) {
      const { re, im } = v
      if (im === 0) return String(re)
      if (re === 0) return im === 1 ? 'i' : im === -1 ? '-i' : `${im}i`
      const sign = im >= 0 ? '+' : '-'
      const ai = Math.abs(im)
      const imPart = ai === 1 ? 'i' : `${ai}i`
      return `${re}${sign}${imPart}`
    }
```

REPLACEMENT:

```js
    // Complex numbers (lib/math/complex.js) — carry the shared tag.
    if (isCpx(v)) return cpxToString(v)
```

### B2 — `=` against an inexact real

`_toFloat` is the identity on a `Flo`, so `_cpxRe` hands back the heap object
and `===` says #f: `(= 1.0 1.0+0.0i)` is #f while `(= 1 1.0+0.0i)` is #t.

CURRENT (line 265):

```js
  const _cpxRe = (v) => (_isCpxRel(v) ? Number(v.re) : _toFloat(v))
  const _cpxIm = (v) => (_isCpxRel(v) ? Number(v.im) : 0)
```

REPLACEMENT:

```js
  // `Number(...)` on the real side too: an inexact real is a `Flo` heap
  // object, and `===` against the double on the complex side said #f.
  const _cpxRe = (v) => Number(_isCpxRel(v) ? v.re : _toFloat(v))
  const _cpxIm = (v) => (_isCpxRel(v) ? Number(v.im) : 0)
```

### B3 — `zero?` on a complex

CURRENT (line 1125):

```js
  def('zero?', (x) => isNum(x) && num(x) === 0)
```

REPLACEMENT:

```js
  // §6.2.6 defines `zero?` on the whole tower, and a complex is zero when both
  // components are — `(zero? 0.0+0.0i)` is #t.
  def('zero?', (x) => isCpx(x)
    ? num(x.re) === 0 && num(x.im) === 0
    : isNum(x) && num(x) === 0)
```

### B4 — `eqv?` on complex components

`a.re === b.re` is `===` on heap objects, so two equal inexact or rational
components answer #f, and exactness is not checked at all.

CURRENT (~line 636, inside `_eqvQ`):

```js
    const CPX = Symbol.for('motoi:complex')
    const isCpx = (x) => x != null && typeof x === 'object' && x[CPX] === true
    if (isCpx(a) || isCpx(b)) {
      return isCpx(a) && isCpx(b) && a.re === b.re && a.im === b.im
    }
```

REPLACEMENT:

```js
    if (isCpx(a) || isCpx(b)) {
      // Componentwise through the tower: a component is a tower value, so
      // `===` missed two equal `Flo`s and ignored exactness entirely.
      return isCpx(a) && isCpx(b) && numEqv(a.re, b.re) && numEqv(a.im, b.im)
    }
```

### B5 — `number->string` on a complex

Currently raises "expected a number".

CURRENT (~line 1291):

```js
    if (!_isNum(n)) throw new Error(`number->string: expected a number, got ${_describe(n)}`)
```

REPLACEMENT:

```js
    // §6.2.7 covers the whole tower. A complex has no positional spelling in
    // another radix, so only radix 10 is offered rather than emitting text
    // that cannot be read back.
    if (isCpx(n)) {
      if (r !== 10) {
        throw new Error(`number->string: radix ${r} is not supported for a complex number`)
      }
      return cpxToString(n)
    }
    if (!_isNum(n)) throw new Error(`number->string: expected a number, got ${_describe(n)}`)
```

### B6 — `string->number` on a complex

Currently #f for every complex text. `complexFromString` is exported from
`src/reader.js` (already written) and returns null — never throws — when the
text is not a complex number, so `#e+inf.0i` stays #f rather than raising.

CURRENT (~line 1374):

```js
    if (r !== 10) return false            // §6.2.5: decimals only in radix 10
```

REPLACEMENT:

```js
    // §7.1.1 <complex R> — rectangular and polar, in every radix. The grammar
    // is spelled once, in the reader, so the two cannot drift apart.
    const z = complexFromString(str, r, want)
    if (z !== null) return z
    if (r !== 10) return false            // §6.2.5: decimals only in radix 10
```

### B7 — the imports

CURRENT (line 9):

```js
import { Sym, Pair } from './reader.js'
```

REPLACEMENT:

```js
import { Sym, Pair, complexFromString } from './reader.js'
import { isCpx, cpxToString } from '../lib/math/complex.js'
```

---

## Not requested, still broken (out of the reader/writer scope)

- `+ - * /` raise on a complex, so `(- 3/2+i)` fails. `-` is negation, `+`/`*`
  are two multiplies and two adds — but it is arithmetic, not lexing, so I have
  left it alone rather than guess at how you want the exactness fold written.
- `(sqrt -1)` raises instead of answering `+i`, and `(sqrt -1.0-0.0i)` answers
  `+nan.0`. Same call: §6.2.6 wants the complex branch, which is arithmetic.

Both are chibi assertions today (lines 903, 1016, 1017).
