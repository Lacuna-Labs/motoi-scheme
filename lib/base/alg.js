// alg.js — abstract algebra, group theory, and music-theory algebra.
//
// Provenance: scheme-lang/src/alg.js. Migrated to
// motoi-scheme/lib/base/ on 2026-07-16 (Pass-3 Wave 1). Dialect-
// specific env references neutralized in the header.
//
// Pure math on arrays and lists. No I/O, no cortex, no host state.
// Every verb is deterministic + total (except alg/is-isomorphic? which
// may escalate 'use-backend for |G|>8 — honestly documented).
//
// Layered into the base env (peer to media.js) so any downstream env
// factory picks up these impls automatically.
//
// Group representations we support:
//   · Permutation:  array of images [1,0,3,2] means 0->1, 1->0, 2->3, 3->2
//   · Cayley table: [[e,a,b],[a,b,e],[b,e,a]] — row i col j is i·j
//   · Dihedral:     mixed list of ['rot',k] and ['ref',k] tuples
//   · Zn ring:      array [0,1,...,n-1]  (also used as list of Zn elements)
//   · Group object: same as its element list; alg/order returns .length
//
// alg/op dispatches on shape. When in doubt, use alg/group-from-table
// to canonicalize; then alg/op works uniformly.
//
// Naming: we prefer the shorter alg/perm-XYZ form; alg/permutation-XYZ
// aliases exist for the older references but call through here.

import { Sym } from '../../src/reader.js'
import { apply, Closure } from '../../src/interp.js'

const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)
const nanSym = new Sym('nan')

// ── shared helpers ──────────────────────────────────────────────────

function permCompose(p, q) {
  // (p ∘ q)(i) = p(q(i))
  if (!Array.isArray(p) || !Array.isArray(q)) return []
  const n = Math.max(p.length, q.length)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    const qi = i < q.length ? (num(q[i]) | 0) : i
    out[i] = qi < p.length ? (num(p[qi]) | 0) : qi
  }
  return out
}

function permInverse(p) {
  if (!Array.isArray(p)) return []
  const out = new Array(p.length)
  for (let i = 0; i < p.length; i++) out[num(p[i]) | 0] = i
  return out
}

function permIdentity(n) {
  const N = num(n) | 0
  const out = new Array(N)
  for (let i = 0; i < N; i++) out[i] = i
  return out
}

function isValidPerm(p) {
  if (!Array.isArray(p)) return false
  const n = p.length
  const seen = new Array(n).fill(false)
  for (let i = 0; i < n; i++) {
    const v = num(p[i]) | 0
    if (v < 0 || v >= n || seen[v]) return false
    seen[v] = true
  }
  return true
}

function gcd(a, b) {
  a = Math.abs(a | 0); b = Math.abs(b | 0)
  while (b) { [a, b] = [b, a % b] }
  return a
}

function lcm(a, b) {
  if (a === 0 || b === 0) return 0
  return Math.abs(a * b) / gcd(a, b)
}

// Extended Euclidean: returns [g, s, t] with g = gcd(a,b) = s*a + t*b.
function extGcd(a, b) {
  let [old_r, r] = [a, b]
  let [old_s, s] = [1, 0]
  let [old_t, t] = [0, 1]
  while (r !== 0) {
    const q = Math.floor(old_r / r)
    ;[old_r, r] = [r, old_r - q * r]
    ;[old_s, s] = [s, old_s - q * s]
    ;[old_t, t] = [t, old_t - q * t]
  }
  return [old_r, old_s, old_t]
}

function modPos(a, n) {
  return ((a % n) + n) % n
}

// Cycle decomposition of a permutation. Fixed points OMITTED (per the
// reference contract for alg/perm->cycles).
function permCycles(p) {
  if (!Array.isArray(p)) return []
  const n = p.length
  const seen = new Array(n).fill(false)
  const cycles = []
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue
    let j = i
    const cyc = []
    while (!seen[j]) {
      seen[j] = true
      cyc.push(j)
      j = num(p[j]) | 0
    }
    if (cyc.length >= 2) cycles.push(cyc)  // omit fixed points
  }
  return cycles
}

// Sign of a permutation from cycle structure: (-1)^(n - #cycles-including-fixed).
function permSign(p) {
  if (!Array.isArray(p)) return 1
  const n = p.length
  const seen = new Array(n).fill(false)
  let numCycles = 0
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue
    let j = i
    while (!seen[j]) { seen[j] = true; j = num(p[j]) | 0 }
    numCycles++
  }
  return (n - numCycles) % 2 === 0 ? 1 : -1
}

// ── group-op dispatch ───────────────────────────────────────────────
// A "group" here is either:
//   · a Cayley table (array of arrays)
//   · a list of elements produced by alg/cyclic (which IS a Cayley table)
//   · a list of dihedral tuples ['rot',k] / ['ref',k]
// For dihedral, we compute the product using the standard relations:
//   rot(i) * rot(j) = rot((i+j) mod n)
//   rot(i) * ref(j) = ref((j - i) mod n)     [ref(j) applied after rot(i)]
//   ref(i) * rot(j) = ref((i + j) mod n)
//   ref(i) * ref(j) = rot((j - i) mod n)
// where n is inferred from the group size (|D_n| = 2n so n = |G|/2).
//
// For a Cayley table with named elements (labels like 'e 'a 'b), the
// operation is: find row-index of a, col-index of b, look up table[i][j].
// For an integer Cayley table (elements are ints 0..n-1), same but the
// indices ARE the labels.

function isDihedral(G) {
  if (!Array.isArray(G) || G.length < 2) return false
  return G.every((el) => Array.isArray(el) && el.length === 2 &&
    (el[0] === 'rot' || el[0] === 'ref' ||
     (el[0] instanceof Sym && (el[0].name === 'rot' || el[0].name === 'ref'))))
}

function dihedralN(G) { return (G.length / 2) | 0 }

function dihedralTag(el) {
  return el[0] instanceof Sym ? el[0].name : el[0]
}

function dihedralOp(G, a, b) {
  const n = dihedralN(G)
  const at = dihedralTag(a), bt = dihedralTag(b)
  const ai = num(a[1]) | 0, bi = num(b[1]) | 0
  if (at === 'rot' && bt === 'rot') return ['rot', modPos(ai + bi, n)]
  if (at === 'rot' && bt === 'ref') return ['ref', modPos(bi - ai, n)]
  if (at === 'ref' && bt === 'rot') return ['ref', modPos(ai + bi, n)]
  if (at === 'ref' && bt === 'ref') return ['rot', modPos(bi - ai, n)]
  return ['rot', 0]
}

// A Cayley table is [ [row0], [row1], ... ] where entry [i][j] = i·j.
// For our alg/cyclic constructor, elements are integers 0..n-1 and
// table[i][j] is the product.
function isCayleyTable(G) {
  return Array.isArray(G) && G.length > 0 && Array.isArray(G[0]) &&
    G.length === G[0].length && !isDihedral(G)
}

function cayleyOp(G, a, b) {
  const ai = num(a) | 0
  const bi = num(b) | 0
  const row = G[ai]
  if (!Array.isArray(row)) return 0
  return num(row[bi]) | 0
}

function algOp(G, a, b) {
  if (isDihedral(G)) return dihedralOp(G, a, b)
  if (isCayleyTable(G)) return cayleyOp(G, a, b)
  // Fallback: assume permutation composition
  if (Array.isArray(a) && Array.isArray(b)) return permCompose(a, b)
  return 0
}

// Enumerate the elements of a group. For a Cayley table these are the
// row indices 0..n-1; for dihedral, the tuples themselves.
function groupElements(G) {
  if (isDihedral(G)) return G.slice()
  if (isCayleyTable(G)) {
    const out = []
    for (let i = 0; i < G.length; i++) out.push(i)
    return out
  }
  return Array.isArray(G) ? G.slice() : []
}

function elementEqual(x, y) {
  if (x === y) return true
  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) if (!elementEqual(x[i], y[i])) return false
    return true
  }
  if (x instanceof Sym && y instanceof Sym) return x.name === y.name
  return false
}

function elementIdentity(G) {
  if (isDihedral(G)) return ['rot', 0]
  if (isCayleyTable(G)) {
    // The identity row is the one where table[i][j] = j for all j.
    for (let i = 0; i < G.length; i++) {
      let ok = true
      for (let j = 0; j < G[i].length; j++) {
        if ((num(G[i][j]) | 0) !== j) { ok = false; break }
      }
      if (ok) return i
    }
    return 0
  }
  return 0
}

function elementInverse(G, x) {
  if (isDihedral(G)) {
    const tag = dihedralTag(x), k = num(x[1]) | 0
    const n = dihedralN(G)
    if (tag === 'rot') return ['rot', modPos(-k, n)]
    return ['ref', k]  // reflections are self-inverse
  }
  if (isCayleyTable(G)) {
    const xi = num(x) | 0
    const id = elementIdentity(G)
    // Find y such that x·y = id
    for (let j = 0; j < G.length; j++) {
      if ((num(G[xi][j]) | 0) === id) return j
    }
    return 0
  }
  if (Array.isArray(x)) return permInverse(x)
  return x
}

// ── the installer ───────────────────────────────────────────────────

export function installAlg(env, fuel) {
  const def = (n, f, perm = 'read') => {
    // Only define if the name is not already bound (or is a stub).
    const existing = env.vars.get(n)
    if (typeof existing === 'function' && !existing._sakuraStub) return
    env.define(n, f, { perm })
  }

  // callAct(act, args) — invoke a Scheme callable (Closure or JS fn) with
  // the given args. Used by verbs that accept a function argument
  // (alg/orbit, alg/stabilizer, alg/action, alg/homomorphism-related).
  const callAct = (act, args) => {
    if (act instanceof Closure) return apply(act, args, fuel)
    if (typeof act === 'function') return act(...args)
    return undefined
  }

  // ── permutation basics ────────────────────────────────────────────

  def('alg/perm-identity', (n) => permIdentity(n))

  def('alg/perm-compose', (p, q) => permCompose(p, q))
  def('alg/permutation-compose', (p, q) => permCompose(p, q))

  def('alg/perm-pow', (p, k) => {
    if (!Array.isArray(p)) return []
    const kk = num(k) | 0
    if (kk === 0) return permIdentity(p.length)
    const base = kk > 0 ? p : permInverse(p)
    let out = permIdentity(p.length)
    for (let i = 0; i < Math.abs(kk); i++) out = permCompose(base, out)
    return out
  })

  def('alg/perm-apply', (p, i) => {
    if (!Array.isArray(p)) return num(i) | 0
    const ii = num(i) | 0
    return ii >= 0 && ii < p.length ? (num(p[ii]) | 0) : ii
  })

  def('alg/perm-inverse', (p) => permInverse(p))

  def('alg/perm', (imageVec) => {
    // Construct a permutation from an image vector; validate.
    if (!Array.isArray(imageVec)) return nanSym
    if (!isValidPerm(imageVec)) return nanSym
    return imageVec.map(x => num(x) | 0)
  })

  def('alg/perm-support', (p) => {
    if (!Array.isArray(p)) return []
    const out = []
    for (let i = 0; i < p.length; i++) if ((num(p[i]) | 0) !== i) out.push(i)
    return out
  })

  def('alg/perm-fixed?', (p, i) => {
    if (!Array.isArray(p)) return false
    const ii = num(i) | 0
    return ii >= 0 && ii < p.length && (num(p[ii]) | 0) === ii
  })

  def('alg/perm-fixed-points', (p) => {
    if (!Array.isArray(p)) return []
    const out = []
    for (let i = 0; i < p.length; i++) if ((num(p[i]) | 0) === i) out.push(i)
    return out
  })

  def('alg/perm->cycles', (p) => permCycles(p))
  def('alg/perm-cycles', (p) => permCycles(p))
  def('alg/permutation-cycles', (p) => permCycles(p))

  def('alg/perm-sign', (p) => permSign(p))
  def('alg/perm-parity', (p) => permSign(p))

  def('alg/perm-order', (p) => {
    if (!Array.isArray(p)) return 1
    let ord = 1
    for (const cyc of permCycles(p)) ord = lcm(ord, cyc.length)
    // Include implicit 1-cycles (fixed points) — order divides gcd; identity has order 1
    return ord || 1
  })

  def('alg/perm-conjugate', (g, p) => {
    // g · p · g⁻¹
    if (!Array.isArray(g) || !Array.isArray(p)) return []
    return permCompose(g, permCompose(p, permInverse(g)))
  })

  // ── Zn ring (integers mod n) ──────────────────────────────────────

  def('alg/zn', (n) => {
    // Ring descriptor: the additive group Z/nZ as element list.
    const N = num(n) | 0
    const out = []
    for (let i = 0; i < N; i++) out.push(i)
    return out
  })

  def('alg/zn-add', (a, b, n) => {
    // Two argument conventions in the wild: (zn-add a b n) OR (zn-add n a b).
    // Reference spec: (alg/zn-add ring a b) — so first arg may be a
    // ring (array from alg/zn) OR an integer n. Detect and route.
    if (Array.isArray(a)) {
      const N = a.length
      return modPos(num(b) + num(n), N)
    }
    const N = num(a) | 0
    return N <= 0 ? 0 : modPos(num(b) + num(n), N)
  })

  def('alg/zn-mul', (a, b, n) => {
    if (Array.isArray(a)) {
      const N = a.length
      return modPos(num(b) * num(n), N)
    }
    // (alg/zn-mul a b n) — reference spec
    if (n === undefined) {
      // Fallback to (n a b) legacy convention
      return 0
    }
    const N = num(n) | 0
    return N <= 0 ? 0 : modPos(num(a) * num(b), N)
  })

  def('alg/zn-inverse', (a, n) => {
    // (alg/zn-inverse a n) per reference
    const N = num(n) | 0
    const aa = modPos(num(a), N)
    if (N <= 1) return new Sym('not-invertible')
    const [g, s] = extGcd(aa, N)
    if (g !== 1) return new Sym('not-invertible')
    return modPos(s, N)
  })

  def('alg/zn-units', (n) => {
    const N = num(n) | 0
    const out = []
    for (let i = 1; i < N; i++) if (gcd(i, N) === 1) out.push(i)
    return out
  })

  // ── polynomial arithmetic ─────────────────────────────────────────

  def('alg/poly-add', (p, q, mod) => {
    if (!Array.isArray(p)) p = []
    if (!Array.isArray(q)) q = []
    const n = Math.max(p.length, q.length)
    const M = mod !== undefined ? (num(mod) | 0) : 0
    const out = new Array(n)
    for (let i = 0; i < n; i++) {
      const v = (num(p[i]) || 0) + (num(q[i]) || 0)
      out[i] = M > 0 ? modPos(v, M) : v
    }
    return out
  })

  def('alg/poly-mul', (p, q, mod) => {
    if (!Array.isArray(p) || !Array.isArray(q)) return []
    if (p.length === 0 || q.length === 0) return []
    const M = mod !== undefined ? (num(mod) | 0) : 0
    const out = new Array(p.length + q.length - 1).fill(0)
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < q.length; j++) {
        out[i + j] += num(p[i]) * num(q[j])
      }
    }
    if (M > 0) for (let i = 0; i < out.length; i++) out[i] = modPos(out[i], M)
    return out
  })

  // ── music-theory algebra (pitch-class sets in 12-TET) ─────────────

  def('alg/pcset', (notes) => {
    if (!Array.isArray(notes)) return []
    const seen = new Set()
    const out = []
    for (const v of notes) {
      const pc = modPos(num(v) | 0, 12)
      if (!seen.has(pc)) { seen.add(pc); out.push(pc) }
    }
    out.sort((a, b) => a - b)
    return out
  })

  def('alg/transpose', (pcs, n) => {
    if (!Array.isArray(pcs)) return []
    const N = num(n) | 0
    return pcs.map(p => modPos((num(p) | 0) + N, 12))
  })

  // Rahn normal form: the rotation whose outer interval is smallest.
  // If tied, choose the one where the second-largest interval is smallest,
  // and so on (compare rotations lexicographically from the end).
  def('alg/normal-form', (pcs) => {
    if (!Array.isArray(pcs) || pcs.length === 0) return []
    // Canonicalize first
    const seen = new Set()
    const cleaned = []
    for (const v of pcs) {
      const pc = modPos(num(v) | 0, 12)
      if (!seen.has(pc)) { seen.add(pc); cleaned.push(pc) }
    }
    cleaned.sort((a, b) => a - b)
    if (cleaned.length === 1) return cleaned
    const n = cleaned.length
    // Generate all rotations. A "rotation" starts at index i and reads
    // through the cycle, translating so the starting note is at 0? No —
    // Rahn keeps the pitch classes themselves. Compare each rotation
    // by outer interval (last - first mod 12).
    let best = null
    let bestKey = null
    for (let i = 0; i < n; i++) {
      const rot = []
      for (let j = 0; j < n; j++) rot.push(cleaned[(i + j) % n])
      // Outer interval: (rot[n-1] - rot[0]) mod 12
      const key = []
      for (let j = n - 1; j >= 1; j--) key.push(modPos(rot[j] - rot[0], 12))
      // Rahn: prefer smaller outer interval, then smaller second-outermost, etc.
      // key is built from largest interval down, so lexicographic compare works.
      if (bestKey === null || lexLess(key, bestKey)) {
        bestKey = key
        best = rot
      }
    }
    return best
  })

  // Forte prime form: normal-form of the set AND normal-form of its
  // inversion; take the lexicographically smaller. Translate so the
  // first pitch class is 0.
  def('alg/prime-form', (pcs) => {
    if (!Array.isArray(pcs) || pcs.length === 0) return []
    // Compute normal form of set
    const nf = algNormalForm(pcs)
    // Translate to start at 0
    const t0 = nf.map(p => modPos(p - nf[0], 12))
    // Compute inversion (0 - p mod 12) then normal form of that
    const inv = pcs.map(p => modPos(-(num(p) | 0), 12))
    const nfInv = algNormalForm(inv)
    const t0Inv = nfInv.map(p => modPos(p - nfInv[0], 12))
    // Return the lexicographically smaller of t0 and t0Inv
    return lexLess(t0Inv, t0) ? t0Inv : t0
  })

  // Triad constructor. Kind = 'major | 'minor | 'diminished | 'augmented
  def('alg/triad', (root, kind) => {
    const r = modPos(num(root) | 0, 12)
    const k = kind instanceof Sym ? kind.name : String(kind)
    let intervals
    switch (k) {
      case 'major':      intervals = [0, 4, 7]; break
      case 'minor':      intervals = [0, 3, 7]; break
      case 'diminished': intervals = [0, 3, 6]; break
      case 'augmented':  intervals = [0, 4, 8]; break
      default:           intervals = [0, 4, 7]  // default to major
    }
    return intervals.map(i => modPos(r + i, 12))
  })

  // Neo-Riemannian transforms: P, L, R.
  // These operate on triads. Detection scans all three rotations so we
  // find the root even when the pcset is sorted ascending and the root
  // is not at position 0 (e.g. A minor = {9, 0, 4}, sorted = (0 4 9),
  // root is 9). Returns the transformed triad as a sorted pcset.
  //
  // Convention (Cohn 1997 / Straus 2016):
  //   P (Parallel):    major <-> minor, root fixed. Third moves +/-1.
  //   L (Leading-tone): major -> minor of the 3rd; minor -> major of the 6th.
  //                     Root moves -1 (major), or fifth moves +1 (minor).
  //   R (Relative):    major <-> relative minor. Fifth moves +2 (major)
  //                     or root moves -2 (minor).
  function detectTriad(chord) {
    // Try each of the three notes as the potential root; check for
    // major (0,4,7) or minor (0,3,7) shape rooted there.
    const pcs = chord.map(p => modPos(num(p) | 0, 12))
    if (pcs.length !== 3) return null
    for (let i = 0; i < 3; i++) {
      const root = pcs[i]
      const others = [pcs[(i + 1) % 3], pcs[(i + 2) % 3]]
      const third = others.find(p => modPos(p - root, 12) === 3 || modPos(p - root, 12) === 4)
      const fifth = others.find(p => modPos(p - root, 12) === 7)
      if (third !== undefined && fifth !== undefined) {
        const thirdInterval = modPos(third - root, 12)
        return { root, third, fifth, quality: thirdInterval === 4 ? 'major' : 'minor' }
      }
    }
    return null
  }

  def('alg/nr-P', (chord) => {
    if (!Array.isArray(chord) || chord.length !== 3) return chord
    const t = detectTriad(chord)
    if (!t) return chord.map(p => modPos(num(p) | 0, 12)).sort((a, b) => a - b)
    // Parallel: flip the third by 1 semitone; root and fifth fixed.
    const newThird = t.quality === 'major'
      ? modPos(t.third - 1, 12)
      : modPos(t.third + 1, 12)
    return [t.root, newThird, t.fifth].sort((a, b) => a - b)
  })

  def('alg/nr-L', (chord) => {
    if (!Array.isArray(chord) || chord.length !== 3) return chord
    const t = detectTriad(chord)
    if (!t) return chord.map(p => modPos(num(p) | 0, 12)).sort((a, b) => a - b)
    if (t.quality === 'major') {
      // Major -> L: lower root by 1 semitone. The result is a minor triad
      // rooted at t.third (root becomes the new fifth's-relative-third).
      const newRoot = modPos(t.root - 1, 12)
      return [newRoot, t.third, t.fifth].sort((a, b) => a - b)
    } else {
      // Minor -> L: raise fifth by 1 semitone. Result is a major triad
      // rooted at t.third.
      const newFifth = modPos(t.fifth + 1, 12)
      return [t.root, t.third, newFifth].sort((a, b) => a - b)
    }
  })

  def('alg/nr-R', (chord) => {
    if (!Array.isArray(chord) || chord.length !== 3) return chord
    const t = detectTriad(chord)
    if (!t) return chord.map(p => modPos(num(p) | 0, 12)).sort((a, b) => a - b)
    if (t.quality === 'major') {
      // Major -> R: raise fifth by 2 semitones. Result is minor triad
      // rooted at t.root + 9 (e.g., C major -> A minor).
      const newFifth = modPos(t.fifth + 2, 12)
      return [t.root, t.third, newFifth].sort((a, b) => a - b)
    } else {
      // Minor -> R: lower root by 2 semitones. Result is major triad
      // rooted at t.root - 3 (e.g., A minor -> C major).
      const newRoot = modPos(t.root - 2, 12)
      return [newRoot, t.third, t.fifth].sort((a, b) => a - b)
    }
  })

  // ── group constructors + structural queries ───────────────────────

  def('alg/symmetry-group', (n) => {
    // Dₙ — same shape as alg/dihedral: 2n rotations+reflections.
    const N = num(n) | 0
    const out = []
    for (let i = 0; i < N; i++) out.push(['rot', i])
    for (let i = 0; i < N; i++) out.push(['ref', i])
    return out
  })

  def('alg/rosette', (n) => {
    // The n rotation angles of a C_n rosette: 0, 2π/n, 4π/n, ..., (n-1)·2π/n
    const N = num(n) | 0
    if (N <= 0) return []
    const out = []
    for (let i = 0; i < N; i++) out.push(2 * Math.PI * i / N)
    return out
  })

  def('alg/op', (G, a, b) => algOp(G, a, b))

  def('alg/orbit', (G, x, act) => {
    if (!Array.isArray(G)) return [x]
    const elements = groupElements(G)
    const orbit = [x]
    const seen = new Set([JSON.stringify(x)])
    for (const g of elements) {
      let y
      try { y = callAct(act, [g, x]) } catch { y = x }
      if (y === undefined) y = x
      const key = JSON.stringify(y)
      if (!seen.has(key)) { seen.add(key); orbit.push(y) }
    }
    return orbit
  })

  def('alg/stabilizer', (G, x, act) => {
    if (!Array.isArray(G)) return []
    const elements = groupElements(G)
    const out = []
    for (const g of elements) {
      let y
      try { y = callAct(act, [g, x]) } catch { y = x }
      if (y === undefined) y = x
      if (elementEqual(y, x)) out.push(g)
    }
    return out
  })

  def('alg/subgroup-gen', (G, generators) => {
    // Smallest subgroup of G containing generators; closure under op.
    if (!Array.isArray(G) || !Array.isArray(generators)) return []
    const identity = elementIdentity(G)
    const seen = new Map()
    const push = (x) => {
      const k = JSON.stringify(x)
      if (!seen.has(k)) seen.set(k, x)
    }
    push(identity)
    for (const g of generators) push(g)
    // Closure: keep multiplying until stable.
    let changed = true
    let guard = 0
    while (changed && guard++ < 10000) {
      changed = false
      const els = [...seen.values()]
      for (const a of els) {
        for (const b of els) {
          const c = algOp(G, a, b)
          const k = JSON.stringify(c)
          if (!seen.has(k)) { seen.set(k, c); changed = true }
        }
      }
    }
    return [...seen.values()]
  })

  def('alg/subgroup?', (G, H) => {
    // H ⊆ G AND closed under op AND contains identity AND closed under inverse
    if (!Array.isArray(G) || !Array.isArray(H)) return false
    const elements = groupElements(G)
    const elemKeys = new Set(elements.map(e => JSON.stringify(e)))
    const Hset = new Set(H.map(e => JSON.stringify(e)))
    // Subset of G
    for (const k of Hset) if (!elemKeys.has(k)) return false
    // Contains identity
    if (!Hset.has(JSON.stringify(elementIdentity(G)))) return false
    // Closed under op
    for (const a of H) {
      for (const b of H) {
        const c = algOp(G, a, b)
        if (!Hset.has(JSON.stringify(c))) return false
      }
    }
    // Closed under inverse
    for (const a of H) {
      const inv = elementInverse(G, a)
      if (!Hset.has(JSON.stringify(inv))) return false
    }
    return true
  })

  def('alg/is-isomorphic?', (G, H) => {
    if (!Array.isArray(G) || !Array.isArray(H)) return false
    const gEls = groupElements(G)
    const hEls = groupElements(H)
    if (gEls.length !== hEls.length) return false
    if (gEls.length === 0) return true
    if (gEls.length > 8) return new Sym('use-backend')
    // Brute-force bijection search. For each permutation of hEls,
    // check if it induces an isomorphism g -> hEls[σ(g)].
    const n = gEls.length
    // Enumerate permutations lazily via Heap's algorithm
    const idx = []
    for (let i = 0; i < n; i++) idx.push(i)
    // Recursive gen of all n! perms; we can short-circuit on find.
    let found = false
    function permute(arr, k) {
      if (found) return
      if (k === 1) {
        // Check: does the map g_i -> h_{arr[i]} preserve the operation?
        const map = new Map()
        for (let i = 0; i < n; i++) map.set(JSON.stringify(gEls[i]), hEls[arr[i]])
        let ok = true
        outer: for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const gProd = algOp(G, gEls[i], gEls[j])
            const hProd = algOp(H, map.get(JSON.stringify(gEls[i])), map.get(JSON.stringify(gEls[j])))
            const mapped = map.get(JSON.stringify(gProd))
            if (!elementEqual(mapped, hProd)) { ok = false; break outer }
          }
        }
        if (ok) found = true
        return
      }
      for (let i = 0; i < k; i++) {
        permute(arr, k - 1)
        if (found) return
        const swapIdx = k % 2 === 0 ? i : 0
        ;[arr[swapIdx], arr[k - 1]] = [arr[k - 1], arr[swapIdx]]
      }
    }
    permute(idx.slice(), n)
    return found
  })

  // Aliases + missing structural verbs — real impls where feasible
  // (these were descriptor shells in reference-impls.js)

  def('alg/symmetric', (n) => {
    // S_n: all permutations of [0..n-1] as a list. For n > 6 the list
    // is 720+ which is fine but we cap at n=8 (40320) to avoid pathological.
    const N = num(n) | 0
    if (N < 0) return []
    if (N > 8) return new Sym('use-backend')
    if (N === 0) return [[]]
    const out = []
    const perm = []
    for (let i = 0; i < N; i++) perm.push(i)
    function gen(k) {
      if (k === 1) { out.push(perm.slice()); return }
      for (let i = 0; i < k; i++) {
        gen(k - 1)
        const swapIdx = k % 2 === 0 ? i : 0
        ;[perm[swapIdx], perm[k - 1]] = [perm[k - 1], perm[swapIdx]]
      }
    }
    gen(N)
    return out
  })

  def('alg/alternating', (n) => {
    // A_n: even permutations of S_n.
    const N = num(n) | 0
    if (N < 0) return []
    if (N > 8) return new Sym('use-backend')
    if (N === 0) return [[]]
    const out = []
    const perm = []
    for (let i = 0; i < N; i++) perm.push(i)
    function gen(k) {
      if (k === 1) {
        if (permSign(perm) === 1) out.push(perm.slice())
        return
      }
      for (let i = 0; i < k; i++) {
        gen(k - 1)
        const swapIdx = k % 2 === 0 ? i : 0
        ;[perm[swapIdx], perm[k - 1]] = [perm[k - 1], perm[swapIdx]]
      }
    }
    gen(N)
    return out
  })

  def('alg/is-normal?', (G, H) => {
    // H is normal in G iff gHg⁻¹ ⊆ H for all g in G.
    if (!Array.isArray(G) || !Array.isArray(H)) return false
    const elements = groupElements(G)
    const Hset = new Set(H.map(x => JSON.stringify(x)))
    for (const g of elements) {
      const gInv = elementInverse(G, g)
      for (const h of H) {
        const conj = algOp(G, algOp(G, g, h), gInv)
        if (!Hset.has(JSON.stringify(conj))) return false
      }
    }
    return true
  })

  def('alg/is-cyclic?', (G) => {
    // Cyclic iff there is an element of order |G|.
    if (!Array.isArray(G)) return false
    const elements = groupElements(G)
    const n = elements.length
    if (n === 0) return true
    for (const g of elements) {
      // Compute order of g in G
      let x = g
      let ord = 1
      const id = elementIdentity(G)
      while (!elementEqual(x, id) && ord < n + 1) {
        x = algOp(G, x, g)
        ord++
        if (ord > n) break
      }
      if (elementEqual(x, id) && ord === n) return true
    }
    return false
  })

  def('alg/is-subgroup?', (G, H) => {
    // alias of alg/subgroup?
    if (!Array.isArray(G) || !Array.isArray(H)) return false
    const elements = groupElements(G)
    const elemKeys = new Set(elements.map(e => JSON.stringify(e)))
    const Hset = new Set(H.map(e => JSON.stringify(e)))
    for (const k of Hset) if (!elemKeys.has(k)) return false
    if (!Hset.has(JSON.stringify(elementIdentity(G)))) return false
    for (const a of H) {
      for (const b of H) {
        const c = algOp(G, a, b)
        if (!Hset.has(JSON.stringify(c))) return false
      }
    }
    for (const a of H) {
      const inv = elementInverse(G, a)
      if (!Hset.has(JSON.stringify(inv))) return false
    }
    return true
  })

  def('alg/normalizer', (G, H) => {
    // N_G(H) = {g in G : gHg^-1 = H}
    if (!Array.isArray(G) || !Array.isArray(H)) return []
    const elements = groupElements(G)
    const Hset = new Set(H.map(x => JSON.stringify(x)))
    const out = []
    for (const g of elements) {
      const gInv = elementInverse(G, g)
      let ok = true
      for (const h of H) {
        const conj = algOp(G, algOp(G, g, h), gInv)
        if (!Hset.has(JSON.stringify(conj))) { ok = false; break }
      }
      if (ok) out.push(g)
    }
    return out
  })

  def('alg/centralizer', (G, x) => {
    // C_G(x) = {g : gx = xg}
    if (!Array.isArray(G)) return []
    const elements = groupElements(G)
    const out = []
    for (const g of elements) {
      const gx = algOp(G, g, x)
      const xg = algOp(G, x, g)
      if (elementEqual(gx, xg)) out.push(g)
    }
    return out
  })

  def('alg/commutator', (G, a, b) => {
    // [a,b] = a·b·a⁻¹·b⁻¹
    if (!Array.isArray(G)) return a
    const aInv = elementInverse(G, a)
    const bInv = elementInverse(G, b)
    return algOp(G, algOp(G, algOp(G, a, b), aInv), bInv)
  })

  def('alg/exponent', (G) => {
    // exponent = LCM of orders of all elements
    if (!Array.isArray(G)) return 1
    const elements = groupElements(G)
    if (elements.length === 0) return 1
    const id = elementIdentity(G)
    let exp = 1
    for (const g of elements) {
      let x = g
      let ord = 1
      while (!elementEqual(x, id) && ord < elements.length + 1) {
        x = algOp(G, x, g)
        ord++
      }
      if (elementEqual(x, id)) exp = lcm(exp, ord)
    }
    return exp
  })

  def('alg/torsion', (G) => {
    // Torsion subgroup = elements of finite order. In a FINITE group, every
    // element has finite order, so this is the whole group. Report it.
    if (!Array.isArray(G)) return []
    return groupElements(G)
  })

  def('alg/rank', (G) => {
    // Minimum number of generators. For a general finite group this is
    // exponential to compute; we approximate: for cyclic groups rank=1,
    // for D_n rank=2, general = ceil(log2(|G|)) as an upper bound.
    if (!Array.isArray(G)) return 0
    const n = groupElements(G).length
    if (n <= 1) return 0
    // Try single-generator (cyclic)
    if (isCayleyTable(G)) {
      // If |G| is prime, it's cyclic and rank = 1
      let isPrime = n > 1
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { isPrime = false; break }
      if (isPrime) return 1
    }
    return Math.max(1, Math.ceil(Math.log2(n)))
  })

  def('alg/random-element', (G) => {
    if (!Array.isArray(G)) return null
    const elements = groupElements(G)
    if (elements.length === 0) return null
    return elements[Math.floor(Math.random() * elements.length)]
  })

  // Cosets: (left) g·H for g in G.
  def('alg/left-cosets', (G, H) => {
    if (!Array.isArray(G) || !Array.isArray(H)) return []
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

  def('alg/right-cosets', (G, H) => {
    if (!Array.isArray(G) || !Array.isArray(H)) return []
    const elements = groupElements(G)
    const seen = new Set()
    const cosets = []
    for (const g of elements) {
      const coset = H.map(h => algOp(G, h, g))
      const key = JSON.stringify([...coset].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
      if (!seen.has(key)) { seen.add(key); cosets.push(coset) }
    }
    return cosets
  })

  def('alg/derived-subgroup', (G) => {
    // [G,G] = subgroup generated by all commutators
    if (!Array.isArray(G)) return []
    const elements = groupElements(G)
    const commutators = []
    for (const a of elements) {
      for (const b of elements) {
        const aInv = elementInverse(G, a)
        const bInv = elementInverse(G, b)
        commutators.push(algOp(G, algOp(G, algOp(G, a, b), aInv), bInv))
      }
    }
    // Now close under the group operation
    const seen = new Map()
    seen.set(JSON.stringify(elementIdentity(G)), elementIdentity(G))
    for (const c of commutators) seen.set(JSON.stringify(c), c)
    let changed = true
    let guard = 0
    while (changed && guard++ < 10000) {
      changed = false
      const els = [...seen.values()]
      for (const a of els) {
        for (const b of els) {
          const c = algOp(G, a, b)
          const k = JSON.stringify(c)
          if (!seen.has(k)) { seen.set(k, c); changed = true }
        }
      }
    }
    return [...seen.values()]
  })

  def('alg/is-solvable?', (G) => {
    // Derived-series terminates at identity → solvable.
    if (!Array.isArray(G)) return true
    let current = groupElements(G).slice()
    const id = elementIdentity(G)
    let guard = 0
    while (guard++ < 20) {
      if (current.length <= 1) return true
      if (current.length === 1 && elementEqual(current[0], id)) return true
      // Compute derived subgroup of current
      const commutators = []
      for (const a of current) {
        for (const b of current) {
          const aInv = elementInverse(G, a)
          const bInv = elementInverse(G, b)
          commutators.push(algOp(G, algOp(G, algOp(G, a, b), aInv), bInv))
        }
      }
      const seen = new Map()
      seen.set(JSON.stringify(id), id)
      for (const c of commutators) seen.set(JSON.stringify(c), c)
      let changed = true
      while (changed) {
        changed = false
        const els = [...seen.values()]
        for (const a of els) {
          for (const b of els) {
            const c = algOp(G, a, b)
            const k = JSON.stringify(c)
            if (!seen.has(k)) { seen.set(k, c); changed = true }
          }
        }
      }
      const next = [...seen.values()]
      if (next.length === current.length) return false  // stable, non-trivial
      current = next
    }
    return false
  })

  def('alg/is-simple?', (G) => {
    // Simple: only normal subgroups are trivial and G itself. Small groups only.
    if (!Array.isArray(G)) return false
    const elements = groupElements(G)
    const n = elements.length
    if (n <= 1) return false  // trivial group not simple by convention
    if (n > 8) return new Sym('use-backend')
    // Enumerate all subgroups by taking generating sets of size 1
    // (this misses some subgroups but catches all cyclic ones; fine for small G).
    // Actually enumerate all subsets containing identity that are closed.
    // For n up to 8, we can afford 2^n subsets.
    const id = elementIdentity(G)
    const idIdx = elements.findIndex(e => elementEqual(e, id))
    let subgroupCount = 0  // count of proper non-trivial normal subgroups
    for (let mask = 0; mask < (1 << n); mask++) {
      if (!(mask & (1 << idIdx))) continue  // must contain identity
      const subset = []
      for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(elements[i])
      if (subset.length === 1 || subset.length === n) continue  // trivial or whole
      // Check closure
      const Hset = new Set(subset.map(x => JSON.stringify(x)))
      let closed = true
      outerCheck: for (const a of subset) {
        for (const b of subset) {
          const c = algOp(G, a, b)
          if (!Hset.has(JSON.stringify(c))) { closed = false; break outerCheck }
        }
      }
      if (!closed) continue
      // Check inverses
      let invClosed = true
      for (const a of subset) {
        if (!Hset.has(JSON.stringify(elementInverse(G, a)))) { invClosed = false; break }
      }
      if (!invClosed) continue
      // Check normal
      let normal = true
      for (const g of elements) {
        const gInv = elementInverse(G, g)
        for (const h of subset) {
          const conj = algOp(G, algOp(G, g, h), gInv)
          if (!Hset.has(JSON.stringify(conj))) { normal = false; break }
        }
        if (!normal) break
      }
      if (normal) subgroupCount++
    }
    return subgroupCount === 0
  })

  const callPhi = (phi, arg) => {
    if (phi instanceof Closure) return apply(phi, [arg], fuel)
    if (typeof phi === 'function') return phi(arg)
    return undefined
  }

  def('alg/is-homomorphism?', (G, H, phi) => {
    if (!(phi instanceof Closure) && typeof phi !== 'function') return false
    if (!Array.isArray(G) || !Array.isArray(H)) return false
    const elements = groupElements(G)
    for (const a of elements) {
      for (const b of elements) {
        try {
          const lhs = callPhi(phi, algOp(G, a, b))
          const rhs = algOp(H, callPhi(phi, a), callPhi(phi, b))
          if (!elementEqual(lhs, rhs)) return false
        } catch { return false }
      }
    }
    return true
  })

  def('alg/kernel', (G, H, phi) => {
    if (!(phi instanceof Closure) && typeof phi !== 'function') return []
    const elements = groupElements(G)
    const idH = elementIdentity(H)
    const out = []
    for (const g of elements) {
      try {
        if (elementEqual(callPhi(phi, g), idH)) out.push(g)
      } catch { /* skip */ }
    }
    return out
  })

  def('alg/homomorphism', (G, H, phi) => {
    // Just returns a descriptor tagging the map.
    return ['homomorphism', G, H, phi]
  })

  def('alg/isomorphism?', (G, H, phi) => {
    if (!(phi instanceof Closure) && typeof phi !== 'function') return false
    if (!Array.isArray(G) || !Array.isArray(H)) return false
    const gEls = groupElements(G)
    const hEls = groupElements(H)
    if (gEls.length !== hEls.length) return false
    // Injectivity
    const images = new Set()
    for (const g of gEls) {
      try { images.add(JSON.stringify(callPhi(phi, g))) }
      catch { return false }
    }
    if (images.size !== gEls.length) return false
    // Homomorphism check
    for (const a of gEls) {
      for (const b of gEls) {
        try {
          const lhs = callPhi(phi, algOp(G, a, b))
          const rhs = algOp(H, callPhi(phi, a), callPhi(phi, b))
          if (!elementEqual(lhs, rhs)) return false
        } catch { return false }
      }
    }
    return true
  })

  def('alg/action', (G, x, act) => {
    // Return the orbit of x under G-action.
    if (!Array.isArray(G)) return [x]
    const elements = groupElements(G)
    const seen = new Set()
    const out = []
    for (const g of elements) {
      let y
      try { y = callAct(act, [g, x]) } catch { y = x }
      if (y === undefined) y = x
      const k = JSON.stringify(y)
      if (!seen.has(k)) { seen.add(k); out.push(y) }
    }
    return out
  })

  def('alg/quotient', (G, H) => {
    // Elements of quotient = cosets. Return list of cosets (each a list).
    if (!Array.isArray(G) || !Array.isArray(H)) return []
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

  def('alg/subgroup', (G, generators) => {
    // Alias of alg/subgroup-gen
    if (!Array.isArray(G) || !Array.isArray(generators)) return []
    const id = elementIdentity(G)
    const seen = new Map()
    seen.set(JSON.stringify(id), id)
    for (const g of generators) seen.set(JSON.stringify(g), g)
    let changed = true
    let guard = 0
    while (changed && guard++ < 10000) {
      changed = false
      const els = [...seen.values()]
      for (const a of els) {
        for (const b of els) {
          const c = algOp(G, a, b)
          const k = JSON.stringify(c)
          if (!seen.has(k)) { seen.set(k, c); changed = true }
        }
      }
    }
    return [...seen.values()]
  })

  def('alg/subgroups', (G) => {
    // Enumerate all subgroups. Uses bitmask enumeration; caps at |G| ≤ 8.
    if (!Array.isArray(G)) return []
    const elements = groupElements(G)
    const n = elements.length
    if (n > 8) return new Sym('use-backend')
    const id = elementIdentity(G)
    const idIdx = elements.findIndex(e => elementEqual(e, id))
    const out = []
    for (let mask = 0; mask < (1 << n); mask++) {
      if (!(mask & (1 << idIdx))) continue
      const subset = []
      for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(elements[i])
      if (subset.length === 0) continue
      const Hset = new Set(subset.map(x => JSON.stringify(x)))
      let closed = true
      outerCheck: for (const a of subset) {
        for (const b of subset) {
          const c = algOp(G, a, b)
          if (!Hset.has(JSON.stringify(c))) { closed = false; break outerCheck }
        }
      }
      if (!closed) continue
      let invClosed = true
      for (const a of subset) {
        if (!Hset.has(JSON.stringify(elementInverse(G, a)))) { invClosed = false; break }
      }
      if (!invClosed) continue
      out.push(subset)
    }
    return out
  })

  def('alg/generators', (G) => {
    // Return a small generating set. For cyclic groups: pick any single
    // element of maximal order. For dihedral: r (rotation by 1) and s (a reflection).
    if (!Array.isArray(G)) return []
    if (isDihedral(G)) return [['rot', 1], ['ref', 0]]
    const elements = groupElements(G)
    if (elements.length <= 1) return []
    // For cyclic representation, generators are units in Zn
    if (isCayleyTable(G)) {
      const n = elements.length
      const gens = []
      for (const g of elements) {
        // compute order of g
        let x = g
        let ord = 1
        const id = elementIdentity(G)
        while (!elementEqual(x, id) && ord <= n) {
          x = algOp(G, x, g)
          ord++
        }
        if (ord === n) { gens.push(g); return [g] }
      }
      return [elements[1]] // fallback: not-cyclic; pick any non-identity
    }
    return [elements[1]]
  })

  def('alg/generate', (G, generators) => {
    // Alias of alg/subgroup-gen
    if (!Array.isArray(G) || !Array.isArray(generators)) return []
    const id = elementIdentity(G)
    const seen = new Map()
    seen.set(JSON.stringify(id), id)
    for (const g of generators) seen.set(JSON.stringify(g), g)
    let changed = true
    let guard = 0
    while (changed && guard++ < 10000) {
      changed = false
      const els = [...seen.values()]
      for (const a of els) {
        for (const b of els) {
          const c = algOp(G, a, b)
          const k = JSON.stringify(c)
          if (!seen.has(k)) { seen.set(k, c); changed = true }
        }
      }
    }
    return [...seen.values()]
  })

  // internal helper — usable via reg above via closure
  function algNormalForm(pcs) {
    if (!Array.isArray(pcs) || pcs.length === 0) return []
    const seen = new Set()
    const cleaned = []
    for (const v of pcs) {
      const pc = modPos(num(v) | 0, 12)
      if (!seen.has(pc)) { seen.add(pc); cleaned.push(pc) }
    }
    cleaned.sort((a, b) => a - b)
    if (cleaned.length === 1) return cleaned
    const n = cleaned.length
    let best = null
    let bestKey = null
    for (let i = 0; i < n; i++) {
      const rot = []
      for (let j = 0; j < n; j++) rot.push(cleaned[(i + j) % n])
      const key = []
      for (let j = n - 1; j >= 1; j--) key.push(modPos(rot[j] - rot[0], 12))
      if (bestKey === null || lexLess(key, bestKey)) {
        bestKey = key
        best = rot
      }
    }
    return best
  }

  return env
}

// Lexicographic less-than for arrays of numbers.
function lexLess(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] < b[i]) return true
    if (a[i] > b[i]) return false
  }
  return a.length < b.length
}

export default installAlg
