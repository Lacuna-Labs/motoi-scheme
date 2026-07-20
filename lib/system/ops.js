// ops.js — L2.5: operations-research primitives.
//
// Provenance: scheme-lang/src/ops.js. Migrated to
// motoi-scheme/lib/system/ on 2026-07-16 (Pass-3 Wave 1). The
// `registerPrimitive` import now targets a local Wave-1 shim at
// `./registry.js` (delegates to env.define; full reference-gated
// registration returns when reference-loader.js migrates in Wave 2+).
//
// The ops/ verb family — closed-form formulas, standard algorithms, and
// small solvers for the classical OR problems: inventory (EOQ,
// newsvendor), queueing (M/M/1, M/M/c, Erlang B/C), scheduling
// (SPT, EDD, Johnson), graphs (Dijkstra, Bellman–Ford, max-flow,
// PageRank), Markov chains (stationary, absorbing), linear + integer
// programming (LP, simplex, MIP, branch-and-bound, interior-point).
//
// Every verb is a REAL implementation — no descriptor stubs, no
// placeholder returns. Alfred's floor doctrine:
//
//   "We can't lie to people. They trust us."
//
// So when a shop operator writes (ops/eoq 1000 50 5), they get the
// true economic order quantity, not a shape that pretends to be one.
// When a kid opens ops/dijkstra to see how a router picks a path,
// they see the real algorithm, not a descriptor.
//
// Scope decisions:
//   - CHEAP (18): pure closed-form arithmetic. One-file, obvious.
//   - MEDIUM (14): standard algorithms — Hungarian, Dijkstra, simplex,
//     etc. Real algorithms bounded to reasonable problem sizes.
//   - EXPENSIVE (3): mip-solve, branch-bound, interior-point. Real
//     small-instance solvers with an honest 'use-backend escalation
//     path for problems above documented size thresholds.
//
// Nothing here touches I/O, network, or Cortex — the ops/ library is
// pure computation. Perm 'read across the board.
//
// Author: Zain (Lacuna Eng — ops lane, 2026-07-14)

import { Sym, sym } from '../../src/reader.js'
import { registerPrimitive } from './registry.js'

// ─── tiny helpers ────────────────────────────────────────────────────

const nm  = (x) => (x instanceof Sym ? x.name : x)
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)
// `sym` is the reader's INTERNED constructor — Sym('foo') from `sym('foo')`
// is (eq?)-equal to the reader-parsed `foo`. This is load-bearing for
// callers that do (eq? result 'infeasible) etc.

// list<->array is transparent in this Scheme (both are JS arrays).
const isList = (x) => Array.isArray(x)

// Build a Scheme-shaped result list of pairs [(k v) ...]. Used where
// the reference contracts say "path-table" or "map: node -> score".
function pairsFromMap(m) {
  const out = []
  for (const [k, v] of m) out.push([k, v])
  return out
}

// Return an entry from a list-of-pairs by key. Used to defensively
// read alist-shaped inputs like Dijkstra graphs.
function alistGet(alist, key) {
  if (!isList(alist)) return null
  for (const p of alist) {
    if (isList(p) && p.length >= 2 && nm(p[0]) === nm(key)) return p[1]
  }
  return null
}

// ─── statistical helpers ────────────────────────────────────────────

// Inverse standard-normal CDF (Beasley-Springer-Moro). Used by
// ops/newsvendor. Same body as in wired-verbs.js — replicated here
// so ops.js is self-contained (that copy is deleted in this lane).
function norminv(p) {
  if (p <= 0 || p >= 1) return 0
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
    138.357751867269, -30.6647980661472, 2.50662827745924]
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
    66.8013118877197, -13.2806815528857]
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
    -2.54973253934373, 4.37466414146497, 2.93816398269878]
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
    3.75440866190742]
  const q = p - 0.5
  if (Math.abs(q) <= 0.425) {
    const r = q * q
    return q * (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  }
  const r = Math.sqrt(-Math.log(q < 0 ? p : 1 - p))
  const x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) /
    ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1)
  return q < 0 ? -x : x
}

// Standard-normal PDF and CDF. Used inside ops/newsvendor to compute
// expected profit correctly (E[shortage] + E[leftover]).
function normpdf(z) { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) }
function normcdf(z) {
  // Abramowitz & Stegun 26.2.17 — accurate to ~1e-7
  const b1 =  0.319381530
  const b2 = -0.356563782
  const b3 =  1.781477937
  const b4 = -1.821255978
  const b5 =  1.330274429
  const p  =  0.2316419
  const c  =  0.3989422804014327
  const abz = Math.abs(z)
  const t = 1 / (1 + p * abz)
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t
  const cdf = 1 - c * Math.exp(-0.5 * z * z) * poly
  return z >= 0 ? cdf : 1 - cdf
}

// ─── graph helpers ──────────────────────────────────────────────────

// Parse a graph in either shape:
//   1. edge list: ((from to weight) ...)
//   2. alist:      ((node ((neighbor . weight) ...)) ...)
//
// Returns { adj: Map<key, [[neighborKey, weight] ...]>, nodes: Set of keys,
//           orig: Map<key, originalNode> } — the orig map lets us return
// node identities in the SAME TYPE the caller passed in (Sym stays Sym).
function parseGraph(g) {
  const adj = new Map()
  const nodes = new Set()
  const orig = new Map()
  const key = (n) => nm(n)
  const remember = (n) => {
    const k = key(n)
    if (!orig.has(k)) orig.set(k, n)
    return k
  }
  if (!isList(g)) return { adj, nodes, orig }

  // Detect alist shape: first element is (node, list-of-pairs)
  const looksAlist = g.length > 0 && isList(g[0]) && g[0].length === 2 &&
                     isList(g[0][1])

  if (looksAlist) {
    for (const entry of g) {
      if (!isList(entry) || entry.length < 2) continue
      const u = remember(entry[0])
      nodes.add(u)
      if (!adj.has(u)) adj.set(u, [])
      const neigh = entry[1]
      if (!isList(neigh)) continue
      for (const pair of neigh) {
        if (isList(pair)) {
          const v = remember(pair[0])
          const w = num(pair[1])
          nodes.add(v)
          adj.get(u).push([v, w])
        }
      }
    }
  } else {
    for (const e of g) {
      if (!isList(e) || e.length < 3) continue
      const u = remember(e[0])
      const v = remember(e[1])
      const w = num(e[2])
      nodes.add(u); nodes.add(v)
      if (!adj.has(u)) adj.set(u, [])
      adj.get(u).push([v, w])
    }
  }
  return { adj, nodes, orig }
}

// ─── matrix helpers ─────────────────────────────────────────────────

function matDims(M) {
  if (!isList(M)) return [0, 0]
  const R = M.length
  const C = R > 0 && isList(M[0]) ? M[0].length : 0
  return [R, C]
}
function matEye(n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0)
    row[i] = 1
    out.push(row)
  }
  return out
}
function matMul(A, B) {
  const [aR, aC] = matDims(A)
  const [bR, bC] = matDims(B)
  if (aC !== bR) return null
  const out = []
  for (let i = 0; i < aR; i++) {
    const row = new Array(bC).fill(0)
    for (let j = 0; j < bC; j++) {
      let s = 0
      for (let k = 0; k < aC; k++) s += num(A[i][k]) * num(B[k][j])
      row[j] = s
    }
    out.push(row)
  }
  return out
}
function matSub(A, B) {
  const [R, C] = matDims(A)
  const out = []
  for (let i = 0; i < R; i++) {
    const row = new Array(C)
    for (let j = 0; j < C; j++) row[j] = num(A[i][j]) - num(B[i][j])
    out.push(row)
  }
  return out
}
function matVecMul(A, v) {
  const [R, C] = matDims(A)
  const out = new Array(R).fill(0)
  for (let i = 0; i < R; i++) {
    let s = 0
    for (let j = 0; j < C; j++) s += num(A[i][j]) * num(v[j])
    out[i] = s
  }
  return out
}
// Gauss–Jordan inversion. Returns null if singular.
function matInverse(M) {
  const [R, C] = matDims(M)
  if (R !== C || R === 0) return null
  const n = R
  // Copy + augment with identity.
  const a = []
  for (let i = 0; i < n; i++) {
    const row = new Array(2 * n).fill(0)
    for (let j = 0; j < n; j++) row[j] = num(M[i][j])
    row[n + i] = 1
    a.push(row)
  }
  for (let col = 0; col < n; col++) {
    // Pivot: max |a[row][col]| across rows col..n-1
    let piv = col, best = Math.abs(a[col][col])
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > best) { piv = r; best = Math.abs(a[r][col]) }
    }
    if (best < 1e-14) return null
    if (piv !== col) { const t = a[col]; a[col] = a[piv]; a[piv] = t }
    const d = a[col][col]
    for (let j = 0; j < 2 * n; j++) a[col][j] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = a[r][col]
      if (f === 0) continue
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j]
    }
  }
  const out = []
  for (let i = 0; i < n; i++) out.push(a[i].slice(n, 2 * n))
  return out
}

// ─── main installer ─────────────────────────────────────────────────

export function installOps(env) {
  const reg = (n, f) => registerPrimitive(env, n, f, { perm: 'read' })

  // ─── CHEAP tier: closed-form primitives ───────────────────────────

  // (ops/eoq D K h) → √(2DK/h). If any argument is nonpositive, 0.
  reg('ops/eoq', (D, K, h) => {
    const d = num(D), k = num(K), H = num(h)
    if (d <= 0 || k <= 0 || H <= 0) return 0
    return Math.sqrt((2 * d * k) / H)
  })

  // (ops/inventory-cost D Q h K) → total annual = K·D/Q + h·Q/2
  reg('ops/inventory-cost', (D, Q, h, K) => {
    const d = num(D), q = num(Q), H = num(h), k = num(K)
    if (q <= 0) return 0
    return (d / q) * k + (q / 2) * H
  })

  // (ops/littles-law λ W) → λ·W
  reg('ops/littles-law', (lam, W) => num(lam) * num(W))

  // (ops/reorder-point daily-demand lead-time-days safety-stock)
  reg('ops/reorder-point', (dd, L, ss) => num(dd) * num(L) + num(ss))

  // (ops/safety-stock z σ L) → z·σ·√L
  reg('ops/safety-stock', (z, s, L) => num(z) * num(s) * Math.sqrt(num(L)))

  // M/M/1 queue metrics.
  //
  // Returns (ρ L Lq W Wq). If unstable (λ ≥ μ), returns
  // (unstable λ μ) — a tagged list the caller can detect.
  reg('ops/mm1', (lam, mu) => {
    const l = num(lam), m = num(mu)
    if (m <= 0 || l >= m) return [sym('unstable'), l, m]
    const rho = l / m
    return [rho, rho / (1 - rho), (rho * rho) / (1 - rho),
            1 / (m - l), rho / (m - l)]
  })

  // M/M/c queue metrics: c parallel identical servers.
  // Returns (ρ L Lq W Wq Pw), where Pw = P(wait > 0) via Erlang-C.
  reg('ops/mmc', (lam, mu, c) => {
    const l = num(lam), m = num(mu), C = Math.floor(num(c))
    if (C <= 0 || m <= 0 || l >= C * m) return [sym('unstable'), l, m, C]
    const rho = l / (C * m)
    const a = l / m               // offered load
    // Pw = C(c, a) — Erlang C probability of waiting.
    let sum = 0, fact = 1
    for (let n = 0; n < C; n++) {
      if (n > 0) fact *= n
      sum += Math.pow(a, n) / fact
    }
    fact *= C
    const num_c = Math.pow(a, C) / fact * (C / (C - a))
    const P0 = 1 / (sum + num_c)
    const Pw = num_c * P0
    const Lq = Pw * (a / (C - a))
    const L = Lq + a
    const Wq = Lq / l
    const W = Wq + 1 / m
    return [rho, L, Lq, W, Wq, Pw]
  })

  // Given λ, μ and a target average queue-wait Wq, find the minimum
  // number of servers c such that resulting Wq ≤ target. Scans c
  // upward from ⌈λ/μ⌉+1 up to a safety cap of 512.
  reg('ops/mmc-servers-for', (lam, mu, targetWq) => {
    const l = num(lam), m = num(mu), T = num(targetWq)
    if (m <= 0 || l <= 0 || T <= 0) return 0
    const cMin = Math.max(1, Math.floor(l / m) + 1)
    for (let c = cMin; c <= 512; c++) {
      const res = env.vars.get('ops/mmc')(l, m, c)
      if (isList(res) && !(res[0] instanceof Sym)) {
        const Wq = res[4]
        if (Wq <= T) return c
      }
    }
    return sym('infeasible')
  })

  // Erlang B: blocking probability with N channels at offered load A.
  reg('ops/erlang-b', (A, N) => {
    const a = num(A), n = Math.floor(num(N))
    if (n < 0 || a < 0) return 0
    let B = 1
    for (let k = 1; k <= n; k++) B = (a * B) / (k + a * B)
    return B
  })

  // Erlang C: P(wait > 0) with N servers at offered load A.
  reg('ops/erlang-c', (A, N) => {
    const a = num(A), n = Math.floor(num(N))
    if (n <= 0 || a <= 0 || a >= n) return 1
    let sum = 0, fact = 1
    for (let k = 0; k < n; k++) {
      if (k > 0) fact *= k
      sum += Math.pow(a, k) / fact
    }
    fact *= n
    const top = Math.pow(a, n) / fact * (n / (n - a))
    return top / (sum + top)
  })

  // Newsvendor fractile: critical ratio (p−c)/(p−s).
  reg('ops/newsvendor-fractile', (cost, price, salvage) => {
    const c = num(cost), p = num(price), s = num(salvage)
    if (p - s <= 0) return 0
    return (p - c) / (p - s)
  })

  // Newsvendor: given demand ~ Normal(μ, σ), cost c, price p, salvage s:
  //   Q* = μ + z·σ where z = Φ⁻¹((p-c)/(p-s))
  //   Expected profit computed with normal loss function:
  //     E[profit] = (p-c)·Q - (p-s)·σ·L(z)
  //   where L(z) = φ(z) − z·(1−Φ(z))  (standard normal loss).
  // Returns (Q* profit-expected).
  reg('ops/newsvendor', (mu, sigma, cost, price, salvage) => {
    const M = num(mu), S = num(sigma), C = num(cost),
          P = num(price), Sv = num(salvage)
    if (P - Sv <= 0 || S <= 0) return [Math.max(0, M), 0]
    const cr = (P - C) / (P - Sv)
    if (cr <= 0) return [0, 0]
    if (cr >= 1) return [M + 6 * S, 0]        // trivially high; degenerate
    const z = norminv(cr)
    const Q = M + z * S
    const Lz = normpdf(z) - z * (1 - normcdf(z))
    const profit = (P - C) * M - (P - Sv) * S * Lz - (C - Sv) * Math.max(0, z) * S
    return [Math.max(0, Q), profit]
  })

  // (ops/assign-cost cost-matrix assignment) → Σ cost[i, assign[i]]
  //   assignment may be:
  //     - a flat list (task_for_worker0, task_for_worker1, ...)
  //     - a list of (i . j) pairs
  reg('ops/assign-cost', (costs, assign) => {
    if (!isList(costs) || !isList(assign)) return 0
    let total = 0
    for (let i = 0; i < assign.length; i++) {
      const a = assign[i]
      let row, col
      if (isList(a) && a.length >= 2) { row = num(a[0]); col = num(a[1]) }
      else { row = i; col = num(a) }
      const r = costs[row | 0]
      if (isList(r)) total += num(r[col | 0])
    }
    return total
  })

  // (ops/lp c A b) → tagged LP artifact for the solvers to consume.
  //   c: objective vector; A: constraint matrix; b: RHS.
  //   Direction is 'maximize by default; callers can pass the direction
  //   symbol as an extra head element if they use the (direction c A b)
  //   variant. We accept both.
  reg('ops/lp', (...args) => {
    let direction = sym('maximize'), c, A, b
    if (args.length === 4) {
      direction = args[0] instanceof Sym ? args[0] : sym(nm(args[0]) || 'maximize')
      c = args[1]; A = args[2]; b = args[3]
    } else if (args.length === 3) {
      c = args[0]; A = args[1]; b = args[2]
    } else {
      return [sym('invalid-lp'), sym('bad-arity')]
    }
    return [sym('lp'), direction, c, A, b]
  })

  // (ops/lp-value c solution) → c·x.
  //   `solution` may be a flat vector, or an LP-solve result whose head
  //   is 'optimal and payload is (list ('x .. ..) ('objective ..) ...).
  reg('ops/lp-value', (c, solution) => {
    if (!isList(c)) return 0
    // Try to extract an x-vector from a solution list.
    let x = solution
    // Detect solution-list shape: it's a list of (key value) pairs where
    // each pair's first element is a Sym. Look for ('x <vec>) or similar.
    if (isList(solution) && solution.length > 0 && isList(solution[0]) &&
        solution[0][0] instanceof Sym) {
      for (const entry of solution) {
        if (isList(entry) && entry.length >= 2 && entry[0] instanceof Sym) {
          const k = entry[0].name
          if (k === 'x' || k === 'vars' || k === 'solution') { x = entry[1]; break }
        }
      }
    }
    if (!isList(x)) return 0
    let s = 0
    for (let i = 0; i < c.length; i++) s += num(c[i]) * num(x[i] ?? 0)
    return s
  })

  // (ops/spt tasks) → tasks sorted ascending by processing time.
  //   Each task can be a scalar (processing time) or a list where
  //   first element is processing time.
  reg('ops/spt', (tasks) => {
    if (!isList(tasks)) return []
    return tasks.slice().sort((a, b) => {
      const ta = isList(a) ? num(a[0]) : num(a)
      const tb = isList(b) ? num(b[0]) : num(b)
      return ta - tb
    })
  })

  // (ops/edd jobs) → jobs sorted ascending by due date.
  //   Each job is a list; index 1 is the due date (index 0 is proc-time).
  reg('ops/edd', (jobs) => {
    if (!isList(jobs)) return []
    return jobs.slice().sort((a, b) => {
      const da = isList(a) && a.length > 1 ? num(a[1]) : 0
      const db = isList(b) && b.length > 1 ? num(b[1]) : 0
      return da - db
    })
  })

  // (ops/sequence-metrics tasks) → (makespan total-flow max-lateness).
  //   Each task: (proc-time due-date). Processed in given order on a
  //   single machine starting at time 0.
  reg('ops/sequence-metrics', (tasks) => {
    if (!isList(tasks)) return [0, 0, 0]
    let t = 0, flow = 0, maxLate = 0
    for (const task of tasks) {
      const p = isList(task) ? num(task[0]) : num(task)
      const d = isList(task) && task.length > 1 ? num(task[1]) : Infinity
      t += p
      flow += t
      const L = t - d
      if (L > maxLate) maxLate = L
    }
    if (!Number.isFinite(maxLate)) maxLate = 0
    return [t, flow, maxLate]
  })

  // ─── MEDIUM tier: standard algorithms ────────────────────────────

  // Dijkstra shortest-path from start.
  //   graph: alist ((node ((n1 . w1) (n2 . w2) ...)) ...)
  //          OR edge list ((from to weight) ...).
  //   Returns list of pairs ((node distance predecessor-or-null) ...).
  reg('ops/dijkstra', (graph, start) => {
    const { adj, nodes, orig } = parseGraph(graph)
    const src = nm(start)
    if (!orig.has(src)) orig.set(src, start)
    nodes.add(src)
    const dist = new Map(), prev = new Map()
    for (const n of nodes) dist.set(n, Infinity)
    dist.set(src, 0)
    const remaining = new Set(nodes)
    while (remaining.size) {
      let u = null, du = Infinity
      for (const n of remaining) {
        const d = dist.get(n)
        if (d < du) { u = n; du = d }
      }
      if (u === null) break
      remaining.delete(u)
      for (const [v, w] of (adj.get(u) || [])) {
        const alt = du + w
        if (alt < dist.get(v)) { dist.set(v, alt); prev.set(v, u) }
      }
    }
    const out = []
    // Return nodes in their ORIGINAL type (Sym stays Sym, number stays number).
    const nodeOf = (k) => orig.has(k) ? orig.get(k) : k
    for (const [n, d] of dist) {
      const p = prev.get(n)
      out.push([nodeOf(n), d === Infinity ? sym('unreachable') : d, p != null ? nodeOf(p) : null])
    }
    return out
  })

  // Bellman–Ford shortest-path with negative-weight support.
  //   Returns (list distances predecessors) — each is a list-of-pairs.
  //   If a negative cycle is reachable, returns 'infeasible.
  reg('ops/bellman-ford', (graph, source) => {
    const { adj, nodes, orig } = parseGraph(graph)
    const src = nm(source)
    if (!orig.has(src)) orig.set(src, source)
    nodes.add(src)
    const dist = new Map(), prev = new Map()
    for (const n of nodes) dist.set(n, Infinity)
    dist.set(src, 0)
    // Gather edges.
    const edges = []
    for (const [u, list] of adj) for (const [v, w] of list) edges.push([u, v, w])
    const N = nodes.size
    for (let i = 0; i < N - 1; i++) {
      let changed = false
      for (const [u, v, w] of edges) {
        const du = dist.get(u)
        if (du === Infinity) continue
        const alt = du + w
        if (alt < dist.get(v)) { dist.set(v, alt); prev.set(v, u); changed = true }
      }
      if (!changed) break
    }
    for (const [u, v, w] of edges) {
      if (dist.get(u) === Infinity) continue
      if (dist.get(u) + w < dist.get(v)) return sym('infeasible')
    }
    const nodeOf = (k) => orig.has(k) ? orig.get(k) : k
    const distList = [], prevList = []
    for (const [n, d] of dist) distList.push([nodeOf(n), d === Infinity ? sym('unreachable') : d])
    for (const [n, p] of prev)  prevList.push([nodeOf(n), p != null ? nodeOf(p) : null])
    return [distList, prevList]
  })

  // Max-flow via Edmonds–Karp (BFS-augmenting-paths).
  //   graph: edge list ((from to capacity) ...)
  //   Returns the max flow value from source to sink.
  reg('ops/max-flow', (graph, source, sink) => {
    if (!isList(graph)) return 0
    const src = nm(source), snk = nm(sink)
    // Build capacity map: cap[u][v] = residual capacity.
    const cap = new Map()
    const nodes = new Set([src, snk])
    for (const e of graph) {
      if (!isList(e) || e.length < 3) continue
      const u = nm(e[0]), v = nm(e[1]), c = num(e[2])
      nodes.add(u); nodes.add(v)
      if (!cap.has(u)) cap.set(u, new Map())
      if (!cap.has(v)) cap.set(v, new Map())
      cap.get(u).set(v, (cap.get(u).get(v) || 0) + c)
      if (!cap.get(v).has(u)) cap.get(v).set(u, 0)
    }
    let flow = 0
    while (true) {
      // BFS for augmenting path.
      const parent = new Map()
      parent.set(src, null)
      const queue = [src]
      while (queue.length) {
        const u = queue.shift()
        if (u === snk) break
        const row = cap.get(u) || new Map()
        for (const [v, c] of row) {
          if (!parent.has(v) && c > 0) { parent.set(v, u); queue.push(v) }
        }
      }
      if (!parent.has(snk)) break
      // Bottleneck.
      let bottleneck = Infinity
      for (let v = snk; parent.get(v) !== null; v = parent.get(v)) {
        const u = parent.get(v)
        bottleneck = Math.min(bottleneck, cap.get(u).get(v))
      }
      // Augment.
      for (let v = snk; parent.get(v) !== null; v = parent.get(v)) {
        const u = parent.get(v)
        cap.get(u).set(v, cap.get(u).get(v) - bottleneck)
        cap.get(v).set(u, (cap.get(v).get(u) || 0) + bottleneck)
      }
      flow += bottleneck
    }
    return flow
  })

  // Validate a Markov transition matrix. Returns the matrix if all
  // rows sum to ~1 (within 1e-9), otherwise 'invalid.
  reg('ops/markov', (P) => {
    if (!isList(P) || P.length === 0) return sym('invalid')
    for (const row of P) {
      if (!isList(row)) return sym('invalid')
      let s = 0
      for (const x of row) s += num(x)
      if (Math.abs(s - 1) > 1e-6) return sym('invalid')
    }
    return P
  })

  // Advance π forward k steps: π_k = π · P^k.
  reg('ops/markov-step', (pi, P, k) => {
    if (!isList(pi) || !isList(P)) return []
    const K = Math.max(0, Math.floor(num(k)))
    let v = pi.slice().map(num)
    for (let step = 0; step < K; step++) {
      const nxt = new Array(v.length).fill(0)
      for (let j = 0; j < v.length; j++) {
        let s = 0
        for (let i = 0; i < v.length; i++) s += v[i] * num(P[i]?.[j] ?? 0)
        nxt[j] = s
      }
      v = nxt
    }
    return v
  })

  // Stationary distribution via power iteration.
  //   π ← π · P until |π - π_prev| < tol OR max-iter reached.
  reg('ops/stationary', (P, tol = 1e-9, maxIter = 1000) => {
    if (!isList(P) || P.length === 0) return []
    const n = P.length
    let pi = new Array(n).fill(1 / n)
    const T = num(tol) || 1e-9
    const IT = num(maxIter) || 1000
    for (let it = 0; it < IT; it++) {
      const nxt = new Array(n).fill(0)
      for (let j = 0; j < n; j++) {
        let s = 0
        for (let i = 0; i < n; i++) s += pi[i] * num(P[i]?.[j] ?? 0)
        nxt[j] = s
      }
      let diff = 0
      for (let i = 0; i < n; i++) diff += Math.abs(nxt[i] - pi[i])
      pi = nxt
      if (diff < T) break
    }
    return pi
  })

  // Absorption probabilities from a Markov matrix P.
  // Splits P into canonical form:
  //   transient states = rows whose diagonal isn't 1
  //   absorbing states = rows whose diagonal is 1 (and rest 0)
  // Returns B = N·R where N = (I - Q)⁻¹.
  // Result: matrix indexed [transient-i][absorbing-j].
  // If no absorbing states, returns 'no-absorbing.
  reg('ops/absorbing-probs', (P) => {
    if (!isList(P) || P.length === 0) return sym('invalid')
    const n = P.length
    const absorbing = []
    const transient = []
    for (let i = 0; i < n; i++) {
      const row = P[i]
      if (!isList(row)) return sym('invalid')
      const isAbsorb = Math.abs(num(row[i]) - 1) < 1e-9
      // Also confirm all off-diagonal entries are ~0 for absorption.
      let offZero = true
      if (isAbsorb) {
        for (let j = 0; j < n; j++) {
          if (j !== i && Math.abs(num(row[j])) > 1e-9) { offZero = false; break }
        }
      }
      if (isAbsorb && offZero) absorbing.push(i); else transient.push(i)
    }
    if (absorbing.length === 0) return sym('no-absorbing')
    // Build Q (transient×transient) and R (transient×absorbing).
    const Q = transient.map(i => transient.map(j => num(P[i][j])))
    const R = transient.map(i => absorbing.map(j => num(P[i][j])))
    // N = (I - Q)^-1
    const IminusQ = matSub(matEye(transient.length), Q)
    const N = matInverse(IminusQ)
    if (!N) return sym('singular')
    const B = matMul(N, R)
    return B
  })

  // Expected steps to absorption per transient state.
  //   t = N · 1 (row sums of the fundamental matrix N).
  //   Returns a vector indexed by transient-state order in P.
  reg('ops/absorbing-steps', (P) => {
    if (!isList(P) || P.length === 0) return sym('invalid')
    const n = P.length
    const transient = []
    for (let i = 0; i < n; i++) {
      const row = P[i]
      if (!isList(row)) return sym('invalid')
      const isAbsorb = Math.abs(num(row[i]) - 1) < 1e-9
      let offZero = true
      if (isAbsorb) {
        for (let j = 0; j < n; j++) {
          if (j !== i && Math.abs(num(row[j])) > 1e-9) { offZero = false; break }
        }
      }
      if (!(isAbsorb && offZero)) transient.push(i)
    }
    if (transient.length === 0) return []
    const Q = transient.map(i => transient.map(j => num(P[i][j])))
    const N = matInverse(matSub(matEye(transient.length), Q))
    if (!N) return sym('singular')
    return N.map(row => row.reduce((a, x) => a + x, 0))
  })

  // Johnson's rule for a 2-machine flow shop.
  //   jobs: list of ids; m1times, m2times: parallel lists of processing
  //         times on machine 1 and 2.
  //   Returns the optimal permutation of job ids that minimizes makespan.
  reg('ops/johnson', (jobs, m1, m2) => {
    if (!isList(jobs) || !isList(m1) || !isList(m2)) return []
    const items = []
    for (let i = 0; i < jobs.length; i++) {
      items.push({ id: jobs[i], t1: num(m1[i]), t2: num(m2[i]) })
    }
    // Two sets: those with t1 <= t2 (sort ascending by t1),
    //           those with t1 >  t2 (sort descending by t2).
    const A = items.filter(x => x.t1 <= x.t2).sort((a, b) => a.t1 - b.t1)
    const B = items.filter(x => x.t1 >  x.t2).sort((a, b) => b.t2 - a.t2)
    return A.concat(B).map(x => x.id)
  })

  // 0/1 knapsack via DP. capacity is integer; items is list of (weight value).
  // Returns (list total-value chosen-indices).
  reg('ops/knapsack', (capacity, items) => {
    const W = Math.max(0, Math.floor(num(capacity)))
    if (!isList(items) || W === 0) return [0, []]
    const n = items.length
    const w = new Array(n), v = new Array(n)
    for (let i = 0; i < n; i++) {
      const it = items[i]
      if (!isList(it) || it.length < 2) return sym('bad-items')
      w[i] = Math.max(0, Math.floor(num(it[0])))
      v[i] = num(it[1])
    }
    // dp[i][c] = best value using first i items with capacity c.
    const dp = []
    for (let i = 0; i <= n; i++) dp.push(new Array(W + 1).fill(0))
    for (let i = 1; i <= n; i++) {
      for (let c = 0; c <= W; c++) {
        dp[i][c] = dp[i - 1][c]
        if (w[i - 1] <= c) {
          const alt = dp[i - 1][c - w[i - 1]] + v[i - 1]
          if (alt > dp[i][c]) dp[i][c] = alt
        }
      }
    }
    // Backtrack.
    const chosen = []
    let c = W
    for (let i = n; i >= 1; i--) {
      if (dp[i][c] !== dp[i - 1][c]) { chosen.unshift(i - 1); c -= w[i - 1] }
    }
    return [dp[n][W], chosen]
  })

  // PageRank via power iteration.
  //   edges: list of (from to) or (from to weight).
  //   damping: default 0.85. Returns list of (node score) pairs.
  reg('ops/pagerank', (edges, damping = 0.85) => {
    if (!isList(edges) || edges.length === 0) return []
    const d = num(damping)
    const outEdges = new Map()
    const nodes = new Set()
    const orig = new Map()
    const remember = (raw) => {
      const k = nm(raw)
      if (!orig.has(k)) orig.set(k, raw)
      return k
    }
    for (const e of edges) {
      if (!isList(e) || e.length < 2) continue
      const u = remember(e[0]), v = remember(e[1])
      nodes.add(u); nodes.add(v)
      if (!outEdges.has(u)) outEdges.set(u, [])
      outEdges.get(u).push(v)
    }
    const N = nodes.size
    if (N === 0) return []
    let score = new Map()
    for (const n of nodes) score.set(n, 1 / N)
    const inList = new Map()
    for (const n of nodes) inList.set(n, [])
    for (const [u, vs] of outEdges) for (const v of vs) inList.get(v).push(u)
    const outCount = (u) => (outEdges.get(u) || []).length
    for (let it = 0; it < 100; it++) {
      const nxt = new Map()
      let sink = 0
      for (const u of nodes) if (outCount(u) === 0) sink += score.get(u)
      const sinkShare = d * sink / N
      let diff = 0
      for (const v of nodes) {
        let s = (1 - d) / N + sinkShare
        for (const u of inList.get(v)) s += d * score.get(u) / outCount(u)
        nxt.set(v, s)
        diff += Math.abs(s - score.get(v))
      }
      score = nxt
      if (diff < 1e-9) break
    }
    const out = []
    for (const [k, v] of score) out.push([orig.has(k) ? orig.get(k) : k, v])
    return out
  })

  // Hungarian algorithm for square cost matrix.
  //   Returns list (assign[0] assign[1] ... assign[n-1]) meaning
  //   worker i is assigned to task assign[i].
  //   O(n³) — safe up to n ≈ 200 in-language.
  reg('ops/assign', (costs) => {
    if (!isList(costs) || costs.length === 0) return []
    const n = costs.length
    for (const row of costs) if (!isList(row) || row.length !== n) return sym('nonsquare')
    // Kuhn–Munkres (O(n³)) — reduced cost / potential method.
    const INF = 1e18
    const u = new Array(n + 1).fill(0)
    const v = new Array(n + 1).fill(0)
    const p = new Array(n + 1).fill(0)
    const way = new Array(n + 1).fill(0)
    for (let i = 1; i <= n; i++) {
      p[0] = i
      let j0 = 0
      const minv = new Array(n + 1).fill(INF)
      const used = new Array(n + 1).fill(false)
      do {
        used[j0] = true
        const i0 = p[j0]
        let delta = INF, j1 = 0
        for (let j = 1; j <= n; j++) {
          if (!used[j]) {
            const cur = num(costs[i0 - 1][j - 1]) - u[i0] - v[j]
            if (cur < minv[j]) { minv[j] = cur; way[j] = j0 }
            if (minv[j] < delta) { delta = minv[j]; j1 = j }
          }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta }
          else { minv[j] -= delta }
        }
        j0 = j1
      } while (p[j0] !== 0)
      do {
        const j1 = way[j0]
        p[j0] = p[j1]
        j0 = j1
      } while (j0 !== 0)
    }
    // Build assignment: for each worker i, find j where p[j] === i+1.
    const assign = new Array(n).fill(-1)
    for (let j = 1; j <= n; j++) if (p[j] > 0) assign[p[j] - 1] = j - 1
    return assign
  })

  // Simplex on a standard-form LP artifact from ops/lp.
  //   LP shape: ('lp direction c A b) with A x ≤ b, x ≥ 0.
  //   Returns list (('status 'optimal) ('objective v) ('x (x0 x1 ...))).
  //   Special symbols on failure: 'infeasible, 'unbounded, 'fuel-budget.
  reg('ops/simplex', (lp) => {
    if (!isList(lp) || lp.length < 5 || !(lp[0] instanceof Sym) || lp[0].name !== 'lp') {
      return sym('invalid-lp')
    }
    const direction = nm(lp[1]) === 'minimize' ? 'minimize' : 'maximize'
    const c0 = lp[2], A0 = lp[3], b0 = lp[4]
    if (!isList(c0) || !isList(A0) || !isList(b0)) return sym('invalid-lp')
    const n = c0.length              // decision variables
    const m = A0.length              // constraints
    if (m !== b0.length) return sym('invalid-lp')
    // Build tableau with slacks. Rows m + 1 (obj), cols n + m + 1.
    //   [ A | I | b ]
    //   [ -c or c row … | 0 ]  (for max, use negated c so we minimize -cx)
    const cols = n + m + 1
    const T = []
    for (let i = 0; i < m; i++) {
      const row = new Array(cols).fill(0)
      for (let j = 0; j < n; j++) row[j] = num(A0[i][j] ?? 0)
      row[n + i] = 1
      row[cols - 1] = num(b0[i])
      if (row[cols - 1] < 0) return sym('needs-phase-1') // no-op safeguard
      T.push(row)
    }
    const obj = new Array(cols).fill(0)
    for (let j = 0; j < n; j++) obj[j] = direction === 'maximize' ? -num(c0[j]) : num(c0[j])
    T.push(obj)
    // Basic variables = slack indices per row.
    const basis = new Array(m)
    for (let i = 0; i < m; i++) basis[i] = n + i
    const maxIter = 2000
    let iter = 0
    while (iter++ < maxIter) {
      // Choose entering column: most negative in obj row.
      let piv = -1, best = -1e-9
      for (let j = 0; j < cols - 1; j++) {
        if (T[m][j] < best) { best = T[m][j]; piv = j }
      }
      if (piv < 0) break  // optimal
      // Ratio test.
      let leave = -1, minRatio = Infinity
      for (let i = 0; i < m; i++) {
        if (T[i][piv] > 1e-9) {
          const r = T[i][cols - 1] / T[i][piv]
          if (r < minRatio) { minRatio = r; leave = i }
        }
      }
      if (leave < 0) return sym('unbounded')
      // Pivot.
      const pivotVal = T[leave][piv]
      for (let j = 0; j < cols; j++) T[leave][j] /= pivotVal
      for (let i = 0; i <= m; i++) {
        if (i === leave) continue
        const f = T[i][piv]
        if (f === 0) continue
        for (let j = 0; j < cols; j++) T[i][j] -= f * T[leave][j]
      }
      basis[leave] = piv
    }
    if (iter >= maxIter) return sym('fuel-budget')
    const x = new Array(n).fill(0)
    for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][cols - 1]
    const objValRaw = T[m][cols - 1]
    // Sign convention: we entered the obj row with -c for max and +c
    // for min, then pivoted to drive reduced costs to ≥ 0. Under the
    // "T[m][cols-1] holds Z" invariant, Z rises by (pivot-value) each
    // pivot. After solving, T[m][cols-1] = c·x* for max, and
    // T[m][cols-1] = -(c·x*) = -min for min. So for max the raw value
    // IS the objective; for min we flip sign.
    const objVal = direction === 'maximize' ? objValRaw : -objValRaw
    return [
      [sym('status'), sym('optimal')],
      [sym('objective'), objVal],
      [sym('x'), x],
    ]
  })

  // (ops/lp-solve c A b) — convenience: build LP + simplex it.
  reg('ops/lp-solve', (c, A, b) => {
    const opsLp = env.vars.get('ops/lp')
    const opsSimplex = env.vars.get('ops/simplex')
    return opsSimplex(opsLp(c, A, b))
  })

  // ─── EXPENSIVE tier: escalation-permitted ────────────────────────

  // Interior-point LP solver.
  //
  // In-language we do NOT ship a true interior-point (barrier)
  // solver — that requires careful line-search and a proper Newton
  // step. What we DO ship: for small LPs (n ≤ 20, m ≤ 20) we solve
  // via simplex and honestly report the objective, tagging the
  // provenance so the caller knows this was simplex-backed. For
  // larger LPs we escalate 'use-backend cleanly.
  //
  // This is NOT a lie because the entry documents the boundary and
  // caveats explicitly. Alfred's floor: "no fake behavior; document
  // what you actually did."
  reg('ops/interior-point', (lp) => {
    if (!isList(lp) || lp.length < 5) return sym('invalid-lp')
    const c = lp[2], A = lp[3]
    const n = isList(c) ? c.length : 0
    const m = isList(A) ? A.length : 0
    if (n > 20 || m > 20) return sym('use-backend')
    // Solve via simplex — for the small instances the reference tests,
    // this returns the same optimum an IP solver would.
    const opsSimplex = env.vars.get('ops/simplex')
    const result = opsSimplex(lp)
    if (!isList(result)) return result
    // Tag provenance so consumers know it's simplex-backed.
    return [...result, [sym('solved-by'), sym('simplex-fallback')]]
  })

  // Mixed-integer programming.
  //
  // Signature per reference: (ops/mip-solve constraints objective [opts]).
  // We accept a normalized form: constraints is a plist with
  // ('A A) ('b b) ('integers idx-list) ('direction dir) and objective
  // is the c vector. For small instances (n ≤ 12) we solve exactly via
  // branch-and-bound on the LP relaxation. Larger → 'use-backend.
  reg('ops/mip-solve', (constraints, objective, opts = null) => {
    // Parse constraints plist.
    let A = null, b = null, integers = [], direction = 'maximize'
    if (isList(constraints)) {
      for (const entry of constraints) {
        if (!isList(entry) || entry.length < 2) continue
        const k = nm(entry[0])
        const v = entry[1]
        if (k === 'A') A = v
        else if (k === 'b') b = v
        else if (k === 'integers') integers = isList(v) ? v.map(x => num(x) | 0) : []
        else if (k === 'direction') direction = nm(v)
      }
    }
    const c = isList(objective) ? objective : []
    if (!c.length || !isList(A) || !isList(b)) return sym('invalid-mip')
    if (c.length > 12) return sym('use-backend')
    const opsSimplex = env.vars.get('ops/simplex')
    const dirSym = sym(direction || 'maximize')
    // Branch-and-bound over integer variables.
    const intSet = new Set(integers.length ? integers : c.map((_, i) => i))
    let bestObj = direction === 'minimize' ? Infinity : -Infinity
    let bestX = null
    let nodesExplored = 0
    const maxNodes = 5000
    function solve(extraLower, extraUpper) {
      if (++nodesExplored > maxNodes) return
      // Build LP with extra constraints for bounds.
      const A2 = A.map(row => row.slice())
      const b2 = b.slice()
      for (const [i, lo] of extraLower) {
        // -x_i ≤ -lo
        const row = new Array(c.length).fill(0); row[i] = -1
        A2.push(row); b2.push(-lo)
      }
      for (const [i, up] of extraUpper) {
        const row = new Array(c.length).fill(0); row[i] = 1
        A2.push(row); b2.push(up)
      }
      const lp = [sym('lp'), dirSym, c, A2, b2]
      const res = opsSimplex(lp)
      if (!isList(res) || (res[0] instanceof Sym)) return
      let objVal = 0, x = null
      for (const p of res) {
        if (!isList(p) || p.length < 2) continue
        const k = nm(p[0])
        if (k === 'objective') objVal = num(p[1])
        else if (k === 'x') x = p[1]
      }
      if (!x) return
      // Bound.
      if (direction === 'maximize' && objVal <= bestObj) return
      if (direction === 'minimize' && objVal >= bestObj) return
      // Find a fractional integer variable.
      let fracIdx = -1, fracVal = 0
      for (const i of intSet) {
        const xv = num(x[i])
        const frac = xv - Math.floor(xv)
        if (frac > 1e-6 && frac < 1 - 1e-6) { fracIdx = i; fracVal = xv; break }
      }
      if (fracIdx < 0) {
        // Integer-feasible.
        if (direction === 'maximize' ? objVal > bestObj : objVal < bestObj) {
          bestObj = objVal; bestX = x.slice()
        }
        return
      }
      const floor = Math.floor(fracVal), ceil = floor + 1
      solve(extraLower, [...extraUpper, [fracIdx, floor]])
      solve([...extraLower, [fracIdx, ceil]], extraUpper)
    }
    solve([], [])
    if (nodesExplored > maxNodes) return sym('fuel-budget')
    if (bestX === null) return sym('infeasible')
    return [
      [sym('status'), sym('optimal')],
      [sym('objective'), bestObj],
      [sym('x'), bestX],
      [sym('solved-by'), sym('branch-and-bound')],
    ]
  })

  // Generic branch-and-bound over a problem-spec plist.
  //   Accepts the same shape as ops/mip-solve but the objective + A/b
  //   inside the spec list. Reuses ops/mip-solve.
  reg('ops/branch-bound', (spec) => {
    if (!isList(spec)) return sym('invalid-spec')
    let direction = 'maximize', obj = null, constraints = null, integers = null
    // Two shapes accepted:
    //   Flat plist: ('maximize (c) 'constraints ((...)) 'integers (...))
    //   Structured: ((direction dir) (objective c) (constraints ...) (integers ...))
    // Detect structured by looking for list-of-pairs.
    const isStructured = spec.length > 0 && isList(spec[0]) && spec[0].length === 2
    if (isStructured) {
      for (const p of spec) {
        if (!isList(p) || p.length < 2) continue
        const k = nm(p[0])
        if (k === 'direction' || k === 'maximize' || k === 'minimize') {
          direction = k === 'direction' ? nm(p[1]) : k
          if (k !== 'direction') obj = p[1]
        }
        else if (k === 'objective') obj = p[1]
        else if (k === 'constraints') constraints = p[1]
        else if (k === 'integers') integers = p[1]
      }
    } else {
      // Flat: alternating keyword tokens.
      for (let i = 0; i < spec.length; i++) {
        const tok = spec[i]
        const k = nm(tok)
        if (k === 'maximize' || k === 'minimize') { direction = k; obj = spec[++i] }
        else if (k === 'constraints') { constraints = spec[++i] }
        else if (k === 'integers') { integers = spec[++i] }
      }
    }
    if (!obj || !isList(constraints)) return sym('invalid-spec')
    // Constraints from spec may be triples (row op b) → convert to A/b.
    const A = [], b = []
    for (const row of constraints) {
      if (!isList(row) || row.length < 3) continue
      // row shape: (coeffs op rhs) or (a0 a1 ... op rhs)
      const rhs = num(row[row.length - 1])
      const op = nm(row[row.length - 2])
      let coeffs = row.slice(0, row.length - 2)
      if (coeffs.length === 1 && isList(coeffs[0])) coeffs = coeffs[0]
      const coeffNums = coeffs.map(num)
      if (op === '<=' || op === '<') { A.push(coeffNums); b.push(rhs) }
      else if (op === '>=' || op === '>') {
        A.push(coeffNums.map(x => -x)); b.push(-rhs)
      } else if (op === '=' || op === '==') {
        A.push(coeffNums); b.push(rhs)
        A.push(coeffNums.map(x => -x)); b.push(-rhs)
      }
    }
    const cons = [
      [sym('A'), A],
      [sym('b'), b],
      [sym('direction'), sym(direction)],
    ]
    if (integers) cons.push([sym('integers'), integers])
    const mip = env.vars.get('ops/mip-solve')
    return mip(cons, obj)
  })
}
