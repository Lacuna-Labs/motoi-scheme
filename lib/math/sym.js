// sym.js — symbolic math verbs.
//
// Provenance: 2026-07-22. Motoi symbolic-algebra lane.
//
// Representation: symbolic expressions are Scheme lists shaped
//   (op arg1 arg2 ...)
// where op is a Sym like '+, '-, '*, '/, 'expt, '=, or the identity
// forms 'const (numeric) and 'var (a variable symbol).
//
// Explicit shape:
//   (const 3)                — the numeric constant 3
//   (var x)                  — the variable x
//   (+ (var x) (const 1))    — x + 1
//   (* (var x) (var x))      — x*x
//   (expt (var x) (const 2)) — x^2
//
// We accept these full forms AND, for convenience, treat numeric JS
// values and Sym variables as atoms (auto-wrapping to (const n) / (var s))
// where needed.
//
// Verbs installed:
//   Constructors:  sym/const · sym/var · sym/poly · sym/add · sym/sub ·
//                  sym/mul · sym/scale · sym/pow
//   Operations:    sym/expand · sym/factor · sym/derivative ·
//                  sym/substitute · sym/evaluate · sym/->string · sym/=
//   Polynomial:    sym/coeff · sym/degree
//   Solvers:       sym/solve-linear · sym/solve-quadratic · sym/solve-ineq

import { Sym } from '../../src/reader.js'

import { isList, seqVerb } from '../base/list.js'
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)
const isNum = (x) => typeof x === 'number' && Number.isFinite(x)

function opName(node) {
  if (!isList(node) || node.length === 0) return null
  const h = node[0]
  return h instanceof Sym ? h.name : (typeof h === 'string' ? h : null)
}

function isConst(node) { return opName(node) === 'const' }
function isVar(node) { return opName(node) === 'var' }

// Auto-wrap: numeric → (const n); Sym → (var s); array → returned as-is.
function wrap(x) {
  if (isNum(x)) return [new Sym('const'), x]
  if (x instanceof Sym) return [new Sym('var'), x]
  if (isList(x)) return x
  return [new Sym('const'), num(x)]
}

// Unwrap: (const n) → number; (var s) → Sym; array → node.
function constVal(node) {
  if (!isConst(node)) return null
  return num(node[1])
}

function varName(node) {
  if (!isVar(node)) return null
  return node[1] instanceof Sym ? node[1].name : String(node[1])
}

// Build (op a b ...) node
function make(op, ...args) { return [new Sym(op), ...args] }

// ── Simplification (a light hand — enough for schoolwork) ──────────

function simplify(node) {
  if (!isList(node)) return wrap(node)
  const op = opName(node)
  if (op === 'const' || op === 'var') return node
  if (op === '+') {
    const args = node.slice(1).map(simplify)
    // Collect constants
    let c = 0
    const rest = []
    for (const a of args) {
      const cv = constVal(a)
      if (cv !== null) c += cv
      else if (opName(a) === '+') {
        for (const inner of a.slice(1)) {
          const iv = constVal(inner)
          if (iv !== null) c += iv
          else rest.push(inner)
        }
      } else rest.push(a)
    }
    if (rest.length === 0) return [new Sym('const'), c]
    // Combine like terms (variables with numeric coefficients)
    const terms = new Map()  // key → coefficient
    const others = []
    for (const t of rest) {
      // (var x) → key "var:x", coeff 1
      // (* (const k) (var x)) → key "var:x", coeff k
      if (isVar(t)) {
        const k = 'var:' + varName(t)
        terms.set(k, (terms.get(k) || 0) + 1)
      } else if (opName(t) === '*' && t.length === 3) {
        const [_, a1, a2] = t
        if (isConst(a1) && isVar(a2)) {
          const k = 'var:' + varName(a2)
          terms.set(k, (terms.get(k) || 0) + constVal(a1))
        } else others.push(t)
      } else others.push(t)
    }
    const combined = []
    for (const [k, coef] of terms) {
      if (coef === 0) continue
      const [_, vn] = k.split(':')
      if (coef === 1) combined.push([new Sym('var'), new Sym(vn)])
      else combined.push([new Sym('*'), [new Sym('const'), coef], [new Sym('var'), new Sym(vn)]])
    }
    const finalArgs = combined.concat(others)
    if (c !== 0) finalArgs.push([new Sym('const'), c])
    if (finalArgs.length === 0) return [new Sym('const'), 0]
    if (finalArgs.length === 1) return finalArgs[0]
    return [new Sym('+'), ...finalArgs]
  }
  if (op === '-') {
    const args = node.slice(1).map(simplify)
    if (args.length === 1) {
      const cv = constVal(args[0])
      if (cv !== null) return [new Sym('const'), -cv]
      return [new Sym('-'), args[0]]
    }
    // a - b - c ... => a + (-b) + (-c) via simplify(+)
    const neg = args.slice(1).map(a => {
      const cv = constVal(a)
      if (cv !== null) return [new Sym('const'), -cv]
      return [new Sym('*'), [new Sym('const'), -1], a]
    })
    return simplify([new Sym('+'), args[0], ...neg])
  }
  if (op === '*') {
    const args = node.slice(1).map(simplify)
    // Collect constants; if any is 0 → 0
    let c = 1
    const rest = []
    for (const a of args) {
      const cv = constVal(a)
      if (cv !== null) {
        if (cv === 0) return [new Sym('const'), 0]
        c *= cv
      } else if (opName(a) === '*') {
        for (const inner of a.slice(1)) {
          const iv = constVal(inner)
          if (iv !== null) c *= iv
          else rest.push(inner)
        }
      } else rest.push(a)
    }
    if (rest.length === 0) return [new Sym('const'), c]
    if (c === 0) return [new Sym('const'), 0]
    if (c === 1 && rest.length === 1) return rest[0]
    if (c === 1) return [new Sym('*'), ...rest]
    return [new Sym('*'), [new Sym('const'), c], ...rest]
  }
  if (op === '/') {
    const args = node.slice(1).map(simplify)
    if (args.length === 2) {
      const [a, b] = args
      const bc = constVal(b)
      if (bc !== null && bc !== 0) {
        const ac = constVal(a)
        if (ac !== null) return [new Sym('const'), ac / bc]
        return [new Sym('*'), [new Sym('const'), 1 / bc], a]
      }
    }
    return [new Sym('/'), ...args]
  }
  if (op === 'expt' || op === '^') {
    const args = node.slice(1).map(simplify)
    if (args.length === 2) {
      const [base, exp] = args
      const bc = constVal(base), ec = constVal(exp)
      if (bc !== null && ec !== null) return [new Sym('const'), Math.pow(bc, ec)]
      if (ec === 0) return [new Sym('const'), 1]
      if (ec === 1) return base
      if (bc === 0) return [new Sym('const'), 0]
      if (bc === 1) return [new Sym('const'), 1]
      return [new Sym('expt'), base, exp]
    }
  }
  return node
}

// Substitute (var s) with value throughout expression.
function substitute(node, varSym, value) {
  const name = varSym instanceof Sym ? varSym.name : String(varSym)
  const wrappedValue = wrap(value)
  function go(n) {
    if (!isList(n)) return n
    if (isVar(n) && varName(n) === name) return wrappedValue
    if (isConst(n)) return n
    return n.map((c, i) => (i === 0 ? c : go(c)))
  }
  return go(node)
}

// Evaluate expression given an env (map or list of (var val) pairs).
function evaluate(node, env) {
  const envMap = new Map()
  if (env instanceof Map) {
    for (const [k, v] of env) {
      const kn = k instanceof Sym ? k.name : String(k)
      envMap.set(kn, num(v))
    }
  } else if (isList(env)) {
    for (const pair of env) {
      if (isList(pair) && pair.length === 2) {
        const kn = pair[0] instanceof Sym ? pair[0].name : String(pair[0])
        envMap.set(kn, num(pair[1]))
      }
    }
  }
  function go(n) {
    if (!isList(n)) return num(n)
    const op = opName(n)
    if (op === 'const') return num(n[1])
    if (op === 'var') {
      const vn = varName(n)
      return envMap.has(vn) ? envMap.get(vn) : NaN
    }
    const args = n.slice(1).map(go)
    switch (op) {
      case '+': return args.reduce((s, x) => s + x, 0)
      case '-': return args.length === 1 ? -args[0] : args.slice(1).reduce((s, x) => s - x, args[0])
      case '*': return args.reduce((s, x) => s * x, 1)
      case '/': return args.slice(1).reduce((s, x) => s / x, args[0])
      case 'expt': case '^': return Math.pow(args[0], args[1])
      case 'sin': return Math.sin(args[0])
      case 'cos': return Math.cos(args[0])
      case 'log': return Math.log(args[0])
      case 'exp': return Math.exp(args[0])
    }
    return NaN
  }
  return go(node)
}

// Symbolic differentiation w.r.t. variable v.
function derivative(node, v) {
  const vName = v instanceof Sym ? v.name : String(v)
  function d(n) {
    if (!isList(n)) {
      if (isNum(n)) return [new Sym('const'), 0]
      if (n instanceof Sym) return n.name === vName ? [new Sym('const'), 1] : [new Sym('const'), 0]
      return [new Sym('const'), 0]
    }
    const op = opName(n)
    if (op === 'const') return [new Sym('const'), 0]
    if (op === 'var') return varName(n) === vName ? [new Sym('const'), 1] : [new Sym('const'), 0]
    if (op === '+') return simplify([new Sym('+'), ...n.slice(1).map(d)])
    if (op === '-') {
      if (n.length === 2) return simplify([new Sym('-'), d(n[1])])
      return simplify([new Sym('-'), ...n.slice(1).map(d)])
    }
    if (op === '*') {
      // Product rule: d(f*g*h) = f'gh + fg'h + fgh'
      const factors = n.slice(1)
      const terms = []
      for (let i = 0; i < factors.length; i++) {
        const parts = factors.map((f, j) => j === i ? d(f) : f)
        terms.push(simplify([new Sym('*'), ...parts]))
      }
      return simplify([new Sym('+'), ...terms])
    }
    if (op === '/') {
      // d(u/v) = (u'v - uv') / v^2
      if (n.length !== 3) return [new Sym('const'), 0]
      const [_, u, v] = n
      const du = d(u), dv = d(v)
      return simplify([new Sym('/'),
        [new Sym('-'),
          [new Sym('*'), du, v],
          [new Sym('*'), u, dv]],
        [new Sym('expt'), v, [new Sym('const'), 2]]])
    }
    if (op === 'expt' || op === '^') {
      // d(u^c) = c * u^(c-1) * u'   for constant c
      // d(f^g) requires log; handle constant-exp case cleanly.
      if (n.length !== 3) return [new Sym('const'), 0]
      const [_, base, exp] = n
      const ec = constVal(exp)
      if (ec !== null) {
        return simplify([new Sym('*'),
          [new Sym('const'), ec],
          [new Sym('expt'), base, [new Sym('const'), ec - 1]],
          d(base)])
      }
      return [new Sym('const'), 0]  // punt on non-constant exponent
    }
    if (op === 'sin') return simplify([new Sym('*'), [new Sym('cos'), n[1]], d(n[1])])
    if (op === 'cos') return simplify([new Sym('*'), [new Sym('const'), -1], [new Sym('sin'), n[1]], d(n[1])])
    if (op === 'log') return simplify([new Sym('/'), d(n[1]), n[1]])
    if (op === 'exp') return simplify([new Sym('*'), [new Sym('exp'), n[1]], d(n[1])])
    return [new Sym('const'), 0]
  }
  return d(node)
}

// Pretty-print a sym expression as a string.
function toString(node) {
  if (!isList(node)) {
    if (node instanceof Sym) return node.name
    return String(node)
  }
  const op = opName(node)
  if (op === 'const') return String(num(node[1]))
  if (op === 'var') return varName(node)
  if (op === 'expt' || op === '^') {
    return `${toString(node[1])}^${toString(node[2])}`
  }
  if (op === '+' || op === '-' || op === '*' || op === '/') {
    return '(' + node.slice(1).map(toString).join(' ' + op + ' ') + ')'
  }
  return '(' + op + ' ' + node.slice(1).map(toString).join(' ') + ')'
}

// Extract coefficients of a polynomial (in a single variable).
// Returns list where index k = coefficient of x^k.
function polyCoeffs(node, varSym) {
  const vName = varSym instanceof Sym ? varSym.name : String(varSym)
  const coeffs = [0]
  function addTerm(coef, power) {
    while (coeffs.length <= power) coeffs.push(0)
    coeffs[power] += coef
  }
  function walkAdd(n) {
    if (!isList(n)) {
      if (isNum(n)) addTerm(n, 0)
      else if (n instanceof Sym && n.name === vName) addTerm(1, 1)
      return
    }
    const op = opName(n)
    if (op === 'const') { addTerm(num(n[1]), 0); return }
    if (op === 'var') { if (varName(n) === vName) addTerm(1, 1); return }
    if (op === '+') { for (const c of n.slice(1)) walkAdd(c); return }
    // Handle a single term (product of const and powers of variable)
    if (op === '*') {
      let coef = 1, power = 0
      let ok = true
      for (const f of n.slice(1)) {
        if (isList(f) && isConst(f)) coef *= constVal(f)
        else if (isList(f) && isVar(f) && varName(f) === vName) power += 1
        else if (isList(f) && (opName(f) === 'expt' || opName(f) === '^')) {
          if (isVar(f[1]) && varName(f[1]) === vName && isConst(f[2])) {
            power += constVal(f[2])
          } else { ok = false; break }
        } else { ok = false; break }
      }
      if (ok) addTerm(coef, power)
      return
    }
    if (op === 'expt' || op === '^') {
      if (isVar(n[1]) && varName(n[1]) === vName && isConst(n[2])) {
        addTerm(1, constVal(n[2]))
        return
      }
    }
  }
  walkAdd(simplify(node))
  // Trim trailing zeros
  while (coeffs.length > 1 && coeffs[coeffs.length - 1] === 0) coeffs.pop()
  return coeffs
}

// Build a polynomial expression from a coefficient list.
function coeffsToPoly(coeffs, varSym) {
  const vName = varSym instanceof Sym ? varSym.name : String(varSym)
  if (!coeffs.length) return [new Sym('const'), 0]
  const terms = []
  for (let k = 0; k < coeffs.length; k++) {
    const c = coeffs[k]
    if (c === 0) continue
    if (k === 0) terms.push([new Sym('const'), c])
    else if (k === 1) {
      if (c === 1) terms.push([new Sym('var'), new Sym(vName)])
      else terms.push([new Sym('*'), [new Sym('const'), c], [new Sym('var'), new Sym(vName)]])
    } else {
      const power = [new Sym('expt'), [new Sym('var'), new Sym(vName)], [new Sym('const'), k]]
      if (c === 1) terms.push(power)
      else terms.push([new Sym('*'), [new Sym('const'), c], power])
    }
  }
  if (terms.length === 0) return [new Sym('const'), 0]
  if (terms.length === 1) return terms[0]
  return [new Sym('+'), ...terms]
}

// ── inline registration metadata ────────────────────────────────────
export const VERBS = [
  'sym/->string',
  'sym/=',
  'sym/add',
  'sym/coeff',
  'sym/const',
  'sym/degree',
  'sym/derivative',
  'sym/evaluate',
  'sym/expand',
  'sym/factor',
  'sym/mul',
  'sym/poly',
  'sym/pow',
  'sym/scale',
  'sym/solve-ineq',
  'sym/solve-linear',
  'sym/solve-quadratic',
  'sym/sub',
  'sym/substitute',
  'sym/var',
]

export const LAZY = true

export const BOOK = 'book-of-math/ch-advanced-05-rings-and-fields'

export const TESTS = [
  ['(sym/->string (sym/const 3))', '3'],
  ['(sym/->string (sym/var (quote x)))', 'x'],
  ['(sym/->string (sym/add (sym/var (quote x)) (sym/const 1)))', '(x + 1)'],
  ['(sym/evaluate (sym/mul (sym/var (quote x)) (sym/var (quote x))) (list (list (quote x) 3)))', '9'],
  ['(sym/degree (sym/pow (sym/var (quote x)) 3) (quote x))', '3'],
  ['(sym/solve-linear 2 6)', '-3'],
]

export function installSym(env, ctx) {
  const def = (n, f, perm = 'read') => {
    const existing = env.vars.get(n)
    if (typeof existing === 'function' && !existing._sakuraStub && !existing.__lazy) return
    env.define(n, seqVerb(f), { perm })
  }

  // Constructors
  def('sym/const', (n) => [new Sym('const'), num(n)])
  def('sym/var', (v) => [new Sym('var'), v instanceof Sym ? v : new Sym(String(v))])

  // (sym/poly coeffs var) — build polynomial from coefficient list
  def('sym/poly', (coeffs, v) => {
    if (!isList(coeffs)) return [new Sym('const'), 0]
    const vv = v || new Sym('x')
    return coeffsToPoly(coeffs.map(num), vv)
  })

  def('sym/add', (a, b, ...rest) => {
    if (b === undefined) return wrap(a)
    return simplify([new Sym('+'), wrap(a), wrap(b), ...rest.map(wrap)])
  })

  def('sym/sub', (a, b, ...rest) => {
    if (b === undefined) return simplify([new Sym('-'), wrap(a)])
    return simplify([new Sym('-'), wrap(a), wrap(b), ...rest.map(wrap)])
  })

  def('sym/mul', (a, b, ...rest) => {
    if (b === undefined) return wrap(a)
    return simplify([new Sym('*'), wrap(a), wrap(b), ...rest.map(wrap)])
  })

  def('sym/scale', (expr, k) => {
    return simplify([new Sym('*'), [new Sym('const'), num(k)], wrap(expr)])
  })

  def('sym/pow', (base, exp) => {
    return simplify([new Sym('expt'), wrap(base), wrap(exp)])
  })

  // Operations
  def('sym/expand', (expr) => simplify(wrap(expr)))

  // Basic factoring: for quadratic ax^2+bx+c try to find integer roots.
  def('sym/factor', (expr, v) => {
    if (v === undefined) v = new Sym('x')
    const coeffs = polyCoeffs(wrap(expr), v)
    if (coeffs.length === 3) {
      const [c, b, a] = coeffs
      const disc = b * b - 4 * a * c
      if (disc >= 0) {
        const sq = Math.sqrt(disc)
        if (Number.isInteger(sq) || Math.abs(sq - Math.round(sq)) < 1e-9) {
          const s = Math.round(sq)
          const r1 = (-b + s) / (2 * a)
          const r2 = (-b - s) / (2 * a)
          if (Number.isInteger(r1) && Number.isInteger(r2)) {
            const vn = v instanceof Sym ? v : new Sym(String(v))
            return simplify([new Sym('*'),
              [new Sym('const'), a],
              [new Sym('-'), [new Sym('var'), vn], [new Sym('const'), r1]],
              [new Sym('-'), [new Sym('var'), vn], [new Sym('const'), r2]]])
          }
        }
      }
    }
    return simplify(wrap(expr))
  })

  def('sym/derivative', (expr, v) => derivative(wrap(expr), v || new Sym('x')))

  def('sym/substitute', (expr, v, val) => substitute(wrap(expr), v, val))

  def('sym/evaluate', (expr, env) => evaluate(wrap(expr), env))

  def('sym/->string', (expr) => toString(wrap(expr)))

  def('sym/=', (a, b) => {
    // Structural equality after simplification. Not a decision procedure —
    // returns #t when normalized forms match; may return #f for equal
    // expressions in different shape.
    const sa = simplify(wrap(a))
    const sb = simplify(wrap(b))
    return JSON.stringify(sa) === JSON.stringify(sb)
  })

  // Polynomial-specific
  def('sym/coeff', (expr, v, k) => {
    const vv = v || new Sym('x')
    const coeffs = polyCoeffs(wrap(expr), vv)
    const kk = num(k) | 0
    return kk >= 0 && kk < coeffs.length ? coeffs[kk] : 0
  })

  def('sym/degree', (expr, v) => {
    const vv = v || new Sym('x')
    const coeffs = polyCoeffs(wrap(expr), vv)
    return Math.max(0, coeffs.length - 1)
  })

  // Solvers
  // (sym/solve-linear a b) — solve a*x + b = 0 for x. Returns -b/a.
  def('sym/solve-linear', (a, b) => {
    const aa = num(a)
    if (aa === 0) return new Sym('no-unique-solution')
    return -num(b) / aa
  })

  // (sym/solve-quadratic a b c) — solve ax^2+bx+c=0. Returns list of
  // real roots, or a Sym for complex.
  def('sym/solve-quadratic', (a, b, c) => {
    const aa = num(a), bb = num(b), cc = num(c)
    if (aa === 0) {
      // linear: bb*x + cc = 0
      if (bb === 0) return new Sym('no-unique-solution')
      return [-cc / bb]
    }
    const disc = bb * bb - 4 * aa * cc
    if (disc < 0) return new Sym('complex-roots')
    if (disc === 0) return [-bb / (2 * aa)]
    const sq = Math.sqrt(disc)
    return [(-bb + sq) / (2 * aa), (-bb - sq) / (2 * aa)]
  })

  // (sym/solve-ineq a b op) — solve a·x ⧀ b for x.
  //
  // Reference (61-sym.slat): :signature "(sym/solve-ineq a b op) ->
  // interval-list | 'nan", and every documented call site passes the
  // coefficients first and the relational operator LAST — e.g.
  // (sym/solve-ineq 2 8 'le). The wiring here had the operator in the
  // middle ((a, rel, val)), so a documented call bound rel=8 and
  // val='le; num('le) is NaN, no branch matched, and the verb fell
  // through to 'unknown-shape for every well-formed call. Argument
  // order now follows the reference.
  //
  // op is 'lt, 'gt, 'le, 'ge as a Sym. Returns an interval descriptor
  // ('interval low high) / ('interval-closed low high), 'all-reals when
  // a = 0 and b = 0, or 'nan when the inequality has no solution — the
  // reference names 'nan explicitly for the a = 0, b ≠ 0 case.
  def('sym/solve-ineq', (a, b, op) => {
    // Assume linear: a*x compared to b.
    // Handle simple form; otherwise return a symbolic descriptor.
    const aa = num(a)
    const vv = num(b)
    const rname = op instanceof Sym ? op.name : String(op)
    if (aa > 0) {
      const cross = vv / aa
      if (rname === 'lt' || rname === '<') return [new Sym('interval'), new Sym('-inf'), cross]
      if (rname === 'gt' || rname === '>') return [new Sym('interval'), cross, new Sym('inf')]
      if (rname === 'le' || rname === '<=') return [new Sym('interval-closed'), new Sym('-inf'), cross]
      if (rname === 'ge' || rname === '>=') return [new Sym('interval-closed'), cross, new Sym('inf')]
    } else if (aa < 0) {
      const cross = vv / aa
      // Flip inequalities
      if (rname === 'lt' || rname === '<') return [new Sym('interval'), cross, new Sym('inf')]
      if (rname === 'gt' || rname === '>') return [new Sym('interval'), new Sym('-inf'), cross]
      if (rname === 'le' || rname === '<=') return [new Sym('interval-closed'), cross, new Sym('inf')]
      if (rname === 'ge' || rname === '>=') return [new Sym('interval-closed'), new Sym('-inf'), cross]
    } else {
      // a = 0 — trivial. b = 0 → every x satisfies it; b ≠ 0 (or a
      // non-numeric shape) → unsolvable, which the reference calls 'nan.
      if (vv === 0) return new Sym('all-reals')
      return new Sym('nan')
    }
    return new Sym('nan')
  })

  return env
}

export default installSym
