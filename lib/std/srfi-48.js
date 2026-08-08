// lib/std/srfi-48.js — SRFI-48: Intermediate Format Strings.
//
// Provenance: SRFI-48 (Kenneth A Dickey). https://srfi.schemers.org/srfi-48/
// Added 2026-08-04. R7RS-small has NO `format`, so per the conformance ladder
// (R7RS-small → SRFI → Motoi-own) SRFI-48 is the rung this lands on. SRFI-48
// is a strict superset of SRFI-28 (basic format strings): SRFI-28's
// `(format fmt arg ...)` is SRFI-48's string-destination shorthand, so
// adopting 48 does not strand anyone writing 28.
//
// Why it exists at all: 124 call sites across the eBay and Etsy carts, which
// use exactly three directives (~a, ~s, ~d) and all three destination forms.
// The rest of the directive set is implemented because the ladder says conform
// to the standard, not to the caller.
//
// Doctrine:
//   * NO SECOND RENDERER. ~a and ~s render by calling the language's own
//     `display` and `write` into a string port and reading it back. A private
//     printer inside format would be a fourth spelling of "how a value looks",
//     and a divergent one is how `[object Object]` reached the corpus.
//   * An UNKNOWN directive RAISES. Passing it through as literal text is the
//     silent-wrong class: the output is still string-shaped, so nothing fails,
//     and the wrong string travels. See :caveats in the reference record.
//   * Directives whose SRFI-48 semantics are not settled here (~w ~y ~h ~t)
//     raise a message naming them as unimplemented rather than guessing. No
//     fabrication — spec/srfi-48.slatl records which are execution-verified.

import { apply } from '../../src/interp.js'

export const STD = 'SRFI-48'
export const SPEC = 'spec/srfi-48.slatl'
// Not in the default bundle. The default is R7RS-small + SRFI-1 and widening
// it is a language decision, not a side effect of needing `format` somewhere.
// A consumer that wants format pulls the part in explicitly.
export const LAZY = true

export const VERBS = ['format']

export function installSRFI48 (env, fuelBox) {
  const call = (name, args) => apply(env.get(name), args, fuelBox)

  // Render through the language's own printer, not a private one.
  const via = (how, v) => {
    const p = call('open-output-string', [])
    call(how, [v, p])
    return call('get-output-string', [p])
  }
  const displayText = (v) => via('display', v)
  const writeText = (v) => via('write', v)

  // ~d ~b ~o ~x delegate radix conversion to number->string for the same
  // reason ~a delegates to display: one implementation of "number as text".
  const radix = (v, base, directive) => {
    if (typeof v !== 'number' && !(v && typeof v === 'object')) {
      throw new Error(`format: ~${directive} needs a number, got ${displayText(v)}`)
    }
    return call('number->string', base === 10 ? [v] : [v, base])
  }

  const UNIMPLEMENTED = {
    w: 'shared-structure write',
    y: 'pretty print',
    h: 'help',
    t: 'tab',
  }

  // The formatter. `out` accumulates; freshline consults it.
  function build (fmt, args) {
    if (typeof fmt !== 'string') {
      throw new Error(`format: the format string must be a string, got ${writeText(fmt)}`)
    }
    let out = ''
    let i = 0
    let argi = 0

    const nextArg = (directive) => {
      if (argi >= args.length) {
        throw new Error(`format: ~${directive} ran out of arguments (the format string asks for more than were supplied)`)
      }
      return args[argi++]
    }

    while (i < fmt.length) {
      const ch = fmt[i]
      if (ch !== '~') { out += ch; i++; continue }

      i++
      if (i >= fmt.length) throw new Error('format: the format string ends in a lone ~')

      // ~[w[,d]]F — the only directive carrying a numeric prefix.
      let width = null
      let digits = null
      if (/[0-9]/.test(fmt[i])) {
        let n = ''
        while (i < fmt.length && /[0-9]/.test(fmt[i])) n += fmt[i++]
        width = parseInt(n, 10)
        if (fmt[i] === ',') {
          i++
          let d = ''
          while (i < fmt.length && /[0-9]/.test(fmt[i])) d += fmt[i++]
          digits = d === '' ? null : parseInt(d, 10)
        }
      }

      const d = fmt[i]
      if (d === undefined) throw new Error('format: the format string ends mid-directive')
      i++
      const low = d.toLowerCase()

      if (Object.prototype.hasOwnProperty.call(UNIMPLEMENTED, low)) {
        throw new Error(`format: ~${d} (${UNIMPLEMENTED[low]}) is not implemented in this part; see spec/srfi-48.slatl`)
      }

      switch (low) {
        case 'a': out += displayText(nextArg(d)); break
        case 's': out += writeText(nextArg(d)); break
        case 'd': out += radix(nextArg(d), 10, d); break
        case 'b': out += radix(nextArg(d), 2, d); break
        case 'o': out += radix(nextArg(d), 8, d); break
        case 'x': out += radix(nextArg(d), 16, d); break
        case 'c': {
          const c = nextArg(d)
          // A character renders as itself under display; write would quote it.
          out += displayText(c)
          break
        }
        case 'f': {
          const v = nextArg(d)
          let s
          if (typeof v === 'number') {
            s = digits === null ? String(v) : v.toFixed(digits)
          } else {
            // Exact rationals and the rest of the tower print through the
            // language rather than through JS number coercion.
            s = displayText(v)
          }
          if (width !== null && s.length < width) s = ' '.repeat(width - s.length) + s
          out += s
          break
        }
        // ~? and ~k: the next argument is a format string, the one after it a
        // list of arguments for it.
        case '?':
        case 'k': {
          const sub = nextArg(d)
          const subArgs = nextArg(d)
          out += build(sub, toJsList(subArgs))
          break
        }
        case '%':
        case 'n': out += '\n'; break
        // Freshline can only see what THIS call has built — it cannot inspect
        // the column a port was already sitting at. Documented, not silent.
        case '&': if (out !== '' && !out.endsWith('\n')) out += '\n'; break
        case '_': out += ' '; break
        case '~': out += '~'; break
        default:
          throw new Error(`format: unknown directive ~${d}`)
      }
    }
    return out
  }

  // ~? hands its arguments as a Scheme list; flatten whichever spine it is.
  const toJsList = (v) => {
    if (Array.isArray(v)) return v.slice()
    const out = []
    let x = v
    while (x && typeof x === 'object' && 'car' in x && 'cdr' in x) { out.push(x.car); x = x.cdr }
    return out
  }

  const isPort = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

  // (format dest fmt arg ...) — dest #f returns a string, #t writes to the
  // current output port, a port writes there. (format fmt arg ...) is the
  // SRFI-28 shorthand for the #f case.
  env.define('format', (...args) => {
    if (args.length === 0) throw new Error('format: needs at least a format string')

    let dest
    let fmt
    let rest
    if (typeof args[0] === 'string') {
      dest = false
      fmt = args[0]
      rest = args.slice(1)
    } else {
      dest = args[0]
      fmt = args[1]
      rest = args.slice(2)
    }

    const text = build(fmt, rest)

    if (dest === false) return text
    if (dest === true) { call('display', [text]); return undefined }
    if (isPort(dest)) { call('display', [text, dest]); return undefined }
    throw new Error('format: the destination must be #f (return a string), #t (current output port), or a port')
  }, { perm: 'read' })

  return env
}

export default installSRFI48
