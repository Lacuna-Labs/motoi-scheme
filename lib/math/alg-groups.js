// alg-groups.js — the 20 group-theory verbs that base/alg.js didn't cover.
//
// Provenance: 2026-07-22. Alfred's group-theory lane.
//
// base/alg.js focuses on permutations, Zn, pcsets, dihedral operations,
// subgroup enumeration. This file adds the remaining group-theory
// constructors and predicates from the reference:
//
//   Constructors:    alg/cyclic, alg/dihedral, alg/direct-product,
//                    alg/group-from-table, alg/identity, alg/cycles->perm,
//                    alg/interval-vector
//   Structural:      alg/center, alg/conjugacy-classes, alg/cosets,
//                    alg/element-order, alg/order, alg/apply-symmetry,
//                    alg/image, alg/index, alg/inverse, alg/invert
//   Predicates:      alg/is-abelian?, alg/is-field?, alg/is-group?
//
// A group is represented the same way base/alg.js represents them:
//   · Cayley table (array of arrays)  — for cyclic, direct-product
//   · Dihedral tuple list ['rot',k]/['ref',k]
//   · Permutation lists
//
// Every predicate returns #t/#f. Structural queries return real values
// (lists, integers). Where computation would be infeasible we return
// a Sym('use-backend') so the caller can escalate honestly.

import { Sym } from '../../src/reader.js'
import { apply, Closure } from '../../src/interp.js'

// One reading of "what is a group" — see the export block at the bottom of
// base/alg.js. This file used to carry a private copy of the whole dispatch,
// so a correction to one file silently left the other answering the old way.
import {
  isDihedral, isCayleyTable, isZn, isPermGroup, tableLabels,
  dihedralEl, dihedralN, dihedralTag,
  algOp, groupElements, elementEqual, elementIdentity, elementInverse,
  elementOrder,
  permIdentity, modPos,
} from '../base/alg.js'

import { isList, seqVerb } from '../base/list.js'
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)

const tableIsLabelled = (G) => tableLabels(G) !== null

// The group axioms checked through the shared dispatch, so the answer is about
// the group rather than about one storage format.
function checkAxioms(G) {
  const els = groupElements(G)
  const n = els.length
  if (n === 0) return false
  if (n > 64) return new Sym('use-backend')
  const key = (x) => JSON.stringify(x)
  const inG = new Set(els.map(key))
  for (const a of els) {
    for (const b of els) if (!inG.has(key(algOp(G, a, b)))) return false
  }
  const e = elementIdentity(G)
  for (const a of els) {
    if (!elementEqual(algOp(G, e, a), a)) return false
    if (!elementEqual(algOp(G, a, e), a)) return false
  }
  for (const a of els) {
    for (const b of els) {
      for (const c of els) {
        const lhs = algOp(G, algOp(G, a, b), c)
        const rhs = algOp(G, a, algOp(G, b, c))
        if (!elementEqual(lhs, rhs)) return false
      }
    }
  }
  for (const a of els) {
    let inv = false
    for (const b of els) if (elementEqual(algOp(G, a, b), e)) { inv = true; break }
    if (!inv) return false
  }
  return true
}

// ── inline registration metadata ─────────────────────────────────────
export const VERBS = [
  'alg/apply-symmetry',
  'alg/center',
  'alg/conjugacy-classes',
  'alg/cosets',
  'alg/cycles->perm',
  'alg/cyclic',
  'alg/dihedral',
  'alg/direct-product',
  'alg/element-order',
  'alg/group-from-table',
  'alg/identity',
  'alg/image',
  'alg/index',
  'alg/interval-vector',
  'alg/inverse',
  'alg/invert',
  'alg/is-abelian?',
  'alg/is-field?',
  'alg/is-group?',
  'alg/order',
]

export const LAZY = true

export const BOOK = 'book-of-math/ch-advanced-04-groups-and-symmetry'

export const TESTS = [
  // constructors
  ['(alg/cyclic 3)', '((0 1 2) (1 2 0) (2 0 1))'],
  ['(alg/dihedral 3)', '((rot 0) (rot 1) (rot 2) (ref 0) (ref 1) (ref 2))'],
  ['(alg/identity 3)', '(0 1 2)'],
  ['(alg/order (alg/cyclic 4))', '4'],
  ['(alg/is-abelian? (alg/cyclic 3))', '#t'],
  ['(alg/is-abelian? (alg/dihedral 3))', '#f'],
  ['(alg/element-order (alg/cyclic 6) 2)', '3'],
  ['(alg/is-group? (alg/cyclic 4))', '#t'],
  ['(alg/inverse (alg/cyclic 4) 1)', '3'],
  ['(alg/center (alg/cyclic 3))', '(0 1 2)'],
]

export function installAlgGroups(env, ctx) {
  const fuel = ctx && ctx.fuel
  const def = (n, f, perm = 'read') => {
    const existing = env.vars.get(n)
    if (typeof existing === 'function' && !existing._sakuraStub && !existing.__lazy) return
    env.define(n, seqVerb(f), { perm })
  }

  // ── Constructors ──────────────────────────────────────────────────

  // (alg/cyclic n) — the cyclic group Z/nZ as a Cayley table:
  //   table[i][j] = (i + j) mod n.
  def('alg/cyclic', (n) => {
    const N = num(n) | 0
    if (N <= 0) return []
    const out = new Array(N)
    for (let i = 0; i < N; i++) {
      out[i] = new Array(N)
      for (let j = 0; j < N; j++) out[i][j] = (i + j) % N
    }
    return out
  })

  // (alg/dihedral n) — the dihedral group D_n as tuple list:
  //   n rotations (rot 0)..(rot n-1), n reflections (ref 0)..(ref n-1).
  def('alg/dihedral', (n) => {
    const N = num(n) | 0
    if (N <= 0) return []
    const out = []
    for (let i = 0; i < N; i++) out.push(dihedralEl('rot', i))
    for (let i = 0; i < N; i++) out.push(dihedralEl('ref', i))
    return out
  })

  // (alg/identity n) — the identity permutation of length n.
  // Overload: (alg/identity G) — returns the identity of a group.
  def('alg/identity', (arg) => {
    if (typeof arg === 'number') return permIdentity(arg)
    if (isList(arg)) {
      // (alg/zn n) and (alg/symmetric n) are GROUPS whose identities are the
      // element 0 and the identity permutation. The old fall-through read any
      // flat list as "a permutation of this length" and handed back
      // (0 1 … n-1), so (alg/identity (alg/zn 5)) named the whole carrier set.
      if (isDihedral(arg) || isCayleyTable(arg) || isZn(arg) || isPermGroup(arg)) {
        return elementIdentity(arg)
      }
      // permutation list — return same-length identity
      return permIdentity(arg.length)
    }
    return permIdentity(num(arg) | 0)
  })

  // (alg/cycles->perm cycles n) — construct a permutation of length n
  // from a cycle representation. Cycles is a list of cycles, each a
  // list of vertex indices. Missing vertices become fixed points.
  def('alg/cycles->perm', (cycles, n) => {
    const N = num(n) | 0
    const out = permIdentity(N)
    if (!isList(cycles)) return out
    for (const cyc of cycles) {
      if (!isList(cyc) || cyc.length < 2) continue
      for (let i = 0; i < cyc.length; i++) {
        const from = num(cyc[i]) | 0
        const to = num(cyc[(i + 1) % cyc.length]) | 0
        if (from >= 0 && from < N && to >= 0 && to < N) out[from] = to
      }
    }
    return out
  })

  // (alg/group-from-table table) — pass through the table as a group value.
  // Validates shape (square, entries in-range).
  def('alg/group-from-table', (table) => {
    if (!isList(table) || table.length === 0) return []
    const n = table.length
    for (const row of table) {
      if (!isList(row) || row.length !== n) return new Sym('invalid-table')
      for (const v of row) {
        const vi = num(v) | 0
        if (vi < 0 || vi >= n) return new Sym('invalid-table')
      }
    }
    return table
  })

  // (alg/direct-product G H) — Cayley table of G × H.
  // Elements are (i * |H| + j) where i ∈ G, j ∈ H. Table is |G|·|H| square.
  def('alg/direct-product', (G, H) => {
    if (!isList(G) || !isList(H)) return []
    const gE = groupElements(G)
    const hE = groupElements(H)
    const m = gE.length, k = hE.length
    if (m === 0 || k === 0) return []
    if (m * k > 100) return new Sym('use-backend')
    const size = m * k
    const out = new Array(size)
    for (let idx = 0; idx < size; idx++) out[idx] = new Array(size).fill(0)
    // Element pair (i,j) at index i*k + j; multiplication is component-wise
    for (let ia = 0; ia < m; ia++) {
      for (let ja = 0; ja < k; ja++) {
        for (let ib = 0; ib < m; ib++) {
          for (let jb = 0; jb < k; jb++) {
            const ci = num(algOp(G, gE[ia], gE[ib])) | 0
            const cj = num(algOp(H, hE[ja], hE[jb])) | 0
            const row = ia * k + ja
            const col = ib * k + jb
            out[row][col] = ci * k + cj
          }
        }
      }
    }
    return out
  })

  // (alg/interval-vector pcset) — the interval-class vector of a pitch-class
  // set. This counts occurrences of each interval class (1..6) between
  // pairs of pitches (mod 12, using the "smaller of d, 12-d" folding).
  def('alg/interval-vector', (pcs) => {
    if (!isList(pcs)) return [0, 0, 0, 0, 0, 0]
    const cs = pcs.map(p => modPos(num(p) | 0, 12))
    const counts = [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        let d = Math.abs(cs[i] - cs[j]) % 12
        if (d > 6) d = 12 - d
        if (d >= 1 && d <= 6) counts[d - 1]++
      }
    }
    return counts
  })

  // ── Structural queries ──────────────────────────────────────────

  // (alg/order G) — the order of a group = number of elements.
  // Overload: (alg/order G g) — the order of an element g in G.
  def('alg/order', (G, g) => {
    if (g === undefined) {
      if (!isList(G)) return 0
      return groupElements(G).length
    }
    if (!isList(G)) return 1
    return elementOrder(G, g)
  })

  // (alg/element-order G g) — smallest positive k with g^k = e.
  def('alg/element-order', (G, g) => {
    if (!isList(G)) return 1
    return elementOrder(G, g)
  })

  // (alg/inverse G x) — inverse of x in G.
  def('alg/inverse', (G, x) => {
    if (!isList(G)) return x
    return elementInverse(G, x)
  })

  // (alg/invert G x) — alias of alg/inverse.
  def('alg/invert', (G, x) => {
    if (!isList(G)) return x
    return elementInverse(G, x)
  })

  // (alg/center G) — {z in G : zg = gz for all g in G}.
  def('alg/center', (G) => {
    if (!isList(G)) return []
    const elements = groupElements(G)
    const out = []
    for (const z of elements) {
      let central = true
      for (const g of elements) {
        if (!elementEqual(algOp(G, z, g), algOp(G, g, z))) { central = false; break }
      }
      if (central) out.push(z)
    }
    return out
  })

  // (alg/conjugacy-classes G) — partition G by g ~ h iff g = xhx^-1.
  def('alg/conjugacy-classes', (G) => {
    if (!isList(G)) return []
    const elements = groupElements(G)
    const seen = new Set()
    const classes = []
    for (const g of elements) {
      const key = JSON.stringify(g)
      if (seen.has(key)) continue
      const clazz = []
      for (const x of elements) {
        const xInv = elementInverse(G, x)
        const conj = algOp(G, algOp(G, x, g), xInv)
        const ck = JSON.stringify(conj)
        if (!seen.has(ck)) { seen.add(ck); clazz.push(conj) }
      }
      if (clazz.length > 0) classes.push(clazz)
    }
    return classes
  })

  // (alg/cosets G H) — left cosets of H in G. Alias route to left-cosets
  // representation in base/alg.js.
  def('alg/cosets', (G, H) => {
    if (!isList(G) || !isList(H)) return []
    const elements = groupElements(G)
    const seen = new Set()
    const cosets = []
    for (const g of elements) {
      const coset = H.map(h => algOp(G, g, h))
      const key = JSON.stringify([...coset].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
      if (!seen.has(key)) { seen.add(key); cosets.push(coset) }
    }
    return cosets
  })

  // (alg/index G H) — [G : H] = |G| / |H|.
  def('alg/index', (G, H) => {
    if (!isList(G) || !isList(H)) return 0
    const g = groupElements(G).length
    const h = H.length
    if (h === 0) return 0
    return Math.floor(g / h)
  })

  // (alg/image G H phi) — the image φ(G) ⊆ H of a homomorphism, as a set.
  // The old signature was (G, phi), so on the reference's own 3-argument call
  // the real φ landed in an ignored slot and `y = g` echoed G back unchanged.
  // A Motoi lambda is a Closure, not a JS function, so it has to be invoked
  // through the interpreter's apply.
  def('alg/image', (G, H, phi) => {
    const f = phi === undefined ? H : phi
    if (!isList(G)) return []
    if (!(f instanceof Closure) && typeof f !== 'function') return []
    const elements = groupElements(G)
    const seen = new Set()
    const out = []
    for (const g of elements) {
      let y
      try {
        y = f instanceof Closure ? apply(f, [g], fuel) : f(g)
      } catch { continue }
      if (y === undefined) continue
      const k = JSON.stringify(y)
      if (!seen.has(k)) { seen.add(k); out.push(y) }
    }
    return out
  })

  // (alg/apply-symmetry sym x) — apply a symmetry element to a point.
  // For dihedral rotations/reflections applied to a 2D point (x, y):
  //   (rot k) rotates by 2πk/n where n is inferred from sym context.
  //   (ref k) reflects across the axis at angle πk/n.
  // If sym is a permutation, apply as permutation.
  // Overload: (alg/apply-symmetry G g x) — apply element g of group G to x.
  def('alg/apply-symmetry', (a, b, c) => {
    // 3-arg form: apply-symmetry G g x
    if (c !== undefined && isList(a)) {
      const G = a, g = b, x = c
      // If group element is a permutation, apply to x (which should be
      // an index or a small list).
      if (isList(g) && !isDihedral(G) && !isCayleyTable(G)) {
        // g is a permutation
        if (typeof x === 'number') {
          const xi = num(x) | 0
          return xi >= 0 && xi < g.length ? (num(g[xi]) | 0) : xi
        }
      }
      // Dihedral: apply to a 2D coordinate list (x, y)
      if (isDihedral(G) && isList(g) && g.length === 2 && isList(x) && x.length === 2) {
        const n = dihedralN(G)
        const tag = dihedralTag(g)
        const k = num(g[1]) | 0
        const theta = tag === 'rot' ? 2 * Math.PI * k / n : 2 * Math.PI * k / (2 * n)
        const px = num(x[0]), py = num(x[1])
        if (tag === 'rot') {
          return [px * Math.cos(theta) - py * Math.sin(theta),
                  px * Math.sin(theta) + py * Math.cos(theta)]
        } else {
          // Reflection through line at angle theta
          return [px * Math.cos(2 * theta) + py * Math.sin(2 * theta),
                  px * Math.sin(2 * theta) - py * Math.cos(2 * theta)]
        }
      }
      return x
    }
    // 2-arg form: apply-symmetry g x (dihedral element applied to 2D point)
    const g = a, x = b
    if (isList(g) && g.length === 2 && isList(x) && x.length === 2) {
      const tag = dihedralTag(g)
      const k = num(g[1]) | 0
      const px = num(x[0]), py = num(x[1])
      // Assume dihedral D_6 (12-gon) as reasonable default when no group given
      const n = 6
      const theta = tag === 'rot' ? 2 * Math.PI * k / n : 2 * Math.PI * k / (2 * n)
      if (tag === 'rot') {
        return [px * Math.cos(theta) - py * Math.sin(theta),
                px * Math.sin(theta) + py * Math.cos(theta)]
      } else {
        return [px * Math.cos(2 * theta) + py * Math.sin(2 * theta),
                px * Math.sin(2 * theta) - py * Math.cos(2 * theta)]
      }
    }
    // Permutation to index
    if (isList(g) && typeof x === 'number') {
      const xi = num(x) | 0
      return xi >= 0 && xi < g.length ? (num(g[xi]) | 0) : xi
    }
    return x
  })

  // ── Predicates ──────────────────────────────────────────────────

  // (alg/is-abelian? G) — commutative iff ab = ba for all a,b.
  def('alg/is-abelian?', (G) => {
    if (!isList(G)) return false
    const elements = groupElements(G)
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i], b = elements[j]
        if (!elementEqual(algOp(G, a, b), algOp(G, b, a))) return false
      }
    }
    return true
  })

  // (alg/is-group? G) — the group axioms:
  //   closure, associativity, identity, inverses.
  def('alg/is-group?', (G) => {
    if (!isList(G)) return false
    if (isDihedral(G)) return true  // constructed to be valid
    if (!isCayleyTable(G)) {
      // Z/nZ under addition and a closed list of permutations are both group
      // representations; the old code answered #f for them because it could
      // only read an integer Cayley table.
      if (isZn(G) || isPermGroup(G)) return checkAxioms(G)
      return false
    }
    if (tableIsLabelled(G)) return checkAxioms(G)
    const n = G.length
    if (n === 0) return false
    // Closure — already guaranteed by table shape if all entries in range.
    for (const row of G) {
      for (const v of row) {
        const vi = num(v) | 0
        if (vi < 0 || vi >= n) return false
      }
    }
    // Identity exists
    const idx = elementIdentity(G)
    // Verify: G[idx][j] = j and G[i][idx] = i for all i,j
    for (let j = 0; j < n; j++) {
      if ((num(G[idx][j]) | 0) !== j) return false
      if ((num(G[j][idx]) | 0) !== j) return false
    }
    // Associativity: (a·b)·c = a·(b·c)
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        for (let c = 0; c < n; c++) {
          const ab = num(G[a][b]) | 0
          const bc = num(G[b][c]) | 0
          if ((num(G[ab][c]) | 0) !== (num(G[a][bc]) | 0)) return false
        }
      }
    }
    // Inverses: every row must contain idx
    for (let i = 0; i < n; i++) {
      let hasInv = false
      for (let j = 0; j < n; j++) {
        if ((num(G[i][j]) | 0) === idx) { hasInv = true; break }
      }
      if (!hasInv) return false
    }
    return true
  })

  // (alg/is-field? F) — field axioms on a finite structure.
  // A field is a triple (elements add-table mul-table). Report whether it
  // satisfies (i) both tables are abelian groups (with mul excluding 0),
  // (ii) distributive law holds. For simplicity: F represented as a two-
  // element list (add-table mul-table). Both are Cayley tables over the
  // same element set 0..n-1.
  def('alg/is-field?', (F) => {
    if (!isList(F) || F.length !== 2) return false
    const [addT, mulT] = F
    if (!isCayleyTable(addT) || !isCayleyTable(mulT)) return false
    const n = addT.length
    if (n !== mulT.length) return false
    // Addition group check (0..n-1)
    const addId = elementIdentity(addT)
    // Multiplication: nonzero elements form a group of size n-1
    // Just check basic: identity of mul exists, and every nonzero element has
    // a mul-inverse.
    let mulId = -1
    for (let i = 0; i < n; i++) {
      let ok = true
      for (let j = 0; j < n; j++) {
        if ((num(mulT[i][j]) | 0) !== j) { ok = false; break }
      }
      if (ok) { mulId = i; break }
    }
    if (mulId < 0) return false
    // Every nonzero element must have a mul-inverse
    for (let i = 0; i < n; i++) {
      if (i === addId) continue
      let hasInv = false
      for (let j = 0; j < n; j++) {
        if ((num(mulT[i][j]) | 0) === mulId) { hasInv = true; break }
      }
      if (!hasInv) return false
    }
    // Distributive: a*(b+c) = a*b + a*c
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        for (let c = 0; c < n; c++) {
          const bcSum = num(addT[b][c]) | 0
          const lhs = num(mulT[a][bcSum]) | 0
          const ab = num(mulT[a][b]) | 0
          const ac = num(mulT[a][c]) | 0
          const rhs = num(addT[ab][ac]) | 0
          if (lhs !== rhs) return false
        }
      }
    }
    return true
  })

  return env
}

export default installAlgGroups
