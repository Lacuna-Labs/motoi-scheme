// plot.js — plot descriptors. Every verb returns a plot-spec record; the
// actual rendering happens host-side.
//
// Provenance: 2026-07-22 (Alfred completion sweep, applied-math lane).
// Reference chapter 51-plot.slat documents 14 verbs; none were wired.
//
// Doctrine:
//   * A plot-spec is a plist: `(:kind K :series S :axes A ...)`. The kind
//     is a symbol ('line 'bar 'scatter 'histogram 'contour 'parametric
//     'phase-portrait 'vector-field 'function). Series is data appropriate
//     to the kind. Axes carries range and label info.
//   * Every verb is pure and deterministic. plot/render-svg takes a spec
//     and emits a small SVG string; not a full renderer, just enough for
//     kids to see something. Contour / vector-field / phase-portrait
//     currently render only the axes + a placeholder, since marching-squares
//     and streamline traces are out of scope for this wiring pass.
//   * plot/fit-grid returns an affine map (list :scale s :offset o) usable
//     by any custom rendering pipeline.
//   * plot/nice-domain rounds a data range outward to friendly tick values.

import { Sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'


import { isList, seqVerb } from '../base/list.js'
// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  'plot/bar',
  'plot/contour',
  'plot/fit-grid',
  'plot/from-series',
  'plot/function',
  'plot/histogram',
  'plot/line',
  'plot/nice-domain',
  'plot/parametric',
  'plot/phase-portrait',
  'plot/render-svg',
  'plot/scatter',
  'plot/vector-field',
  'plot/with',
]
export const LAZY = true
export const BOOK = 'book-of-craft/ch03-the-breadboard'

export const TESTS = [
  // Bar chart
  ['(car (plot/bar (list (quote a) (quote b)) (list 1 2)))', ':kind'],
  // Line chart preserves kind
  ['(car (cdr (plot/line (list 1 2 3) (list 4 5 6))))', 'line'],
  // Scatter
  ['(car (cdr (plot/scatter (list (list 1 2) (list 3 4)))))', 'scatter'],
  // Histogram: bins from data range
  ['(car (cdr (plot/histogram (list 1 2 3 4 5) 2)))', 'histogram'],
  // Function plot: evaluate f on domain
  ['(car (cdr (plot/function (lambda (x) (* x x)) (list -1 1))))', 'function'],
  // Contour spec produced
  ['(car (cdr (plot/contour (lambda (x y) (+ x y)) (list -1 1) (list -1 1))))', 'contour'],
  // Parametric
  ['(car (cdr (plot/parametric (lambda (t) (list (cos t) (sin t))))))', 'parametric'],
  // Vector field
  ['(car (cdr (plot/vector-field (lambda (xy) (list 1 0)))))', 'vector-field'],
  // Phase portrait
  ['(car (cdr (plot/phase-portrait (lambda (xy) (list 1 1)))))', 'phase-portrait'],
  // Nice-domain rounds outward: (0.1 9.9) → (0 10) or similar
  ['(car (plot/nice-domain (list 0.1 9.9)))', '0'],
  // Fit-grid: 2nd elt is :scale keyword
  ['(car (cdr (plot/fit-grid (list 0 100) 10)))', ':scale'],
  // From-series: bundle
  ['(car (cdr (plot/from-series (list (list 1 2 3)))))', 'from-series'],
  // With: combine two specs
  ['(car (cdr (plot/with (list (plot/line (list 1) (list 2)) (plot/line (list 1) (list 3))))))', 'compose'],
  // Render-svg returns a string
  ['(string? (plot/render-svg (plot/line (list 1 2) (list 3 4))))', '#t'],
]

// ── helpers ────────────────────────────────────────────────────────
function K(name) { return new Sym(name) }
function kw(name) { return new Sym(':' + name) }

function spec(kind, ...fields) {
  return [kw('kind'), K(kind), ...fields]
}

// A sample counts toward the axes only if it is a finite number. 51-plot.slat
// (plot/function) says non-finite outputs and non-numeric outputs "break that
// sample" and that the break "is intentional" — a break must not drag the whole
// axis to NaN, which is what happened when one sample landed on an asymptote.
function finiteOnly(vals) {
  const out = []
  for (const v of vals) if (typeof v === 'number' && Number.isFinite(v)) out.push(v)
  return out
}

function axesFromRange(xs, ys) {
  const fx = finiteOnly(xs), fy = finiteOnly(ys)
  const xmn = fx.length ? Math.min(...fx) : 0, xmx = fx.length ? Math.max(...fx) : 0
  const ymn = fy.length ? Math.min(...fy) : 0, ymx = fy.length ? Math.max(...fy) : 0
  return [kw('x-min'), xmn, kw('x-max'), xmx, kw('y-min'), ymn, kw('y-max'), ymx]
}

export function installPlot(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // Invoke either a JS function or a Scheme Closure. apply() drives the
  // trampoline for Scheme closures; JS fns go through applyStep's fast path.
  const call = (f, args) => apply(f, args, fuel)

  // (plot/bar labels values [opts]) → spec.
  def('plot/bar', (labels, values, _opts) => {
    if (!isList(labels) || !isList(values)) {
      throw new Error('plot/bar: labels and values must be lists')
    }
    if (labels.length !== values.length) {
      throw new Error(`plot/bar: length mismatch (labels=${labels.length}, values=${values.length})`)
    }
    return spec('bar',
      kw('labels'), labels,
      kw('values'), values,
      kw('axes'), axesFromRange([0, labels.length], values.concat([0])))
  })

  // (plot/line xs ys [opts]) → spec.
  def('plot/line', (xs, ys, _opts) => {
    if (!isList(xs) || !isList(ys)) {
      throw new Error('plot/line: xs and ys must be lists')
    }
    if (xs.length !== ys.length) {
      throw new Error(`plot/line: length mismatch (xs=${xs.length}, ys=${ys.length})`)
    }
    return spec('line',
      kw('xs'), xs,
      kw('ys'), ys,
      kw('axes'), axesFromRange(xs, ys))
  })

  // (plot/scatter points [opts]) → spec. points is a list of (x y).
  def('plot/scatter', (points, _opts) => {
    if (!isList(points)) throw new Error('plot/scatter: points must be a list')
    const xs = points.map((p) => p[0])
    const ys = points.map((p) => p[1])
    return spec('scatter',
      kw('points'), points,
      kw('axes'), axesFromRange(xs.length ? xs : [0], ys.length ? ys : [0]))
  })

  // (plot/histogram data [opts]) → spec. opts may be a numeric bin count.
  def('plot/histogram', (data, opts) => {
    if (!Array.isArray(data)) throw new Error('plot/histogram: data must be a list')
    if (data.length === 0) {
      return spec('histogram', kw('bins'), [], kw('axes'), axesFromRange([0], [0]))
    }
    let mn = data[0], mx = data[0]
    for (const x of data) { if (x < mn) mn = x; if (x > mx) mx = x }
    const nb = (typeof opts === 'number' && opts > 0)
      ? (opts | 0)
      : Math.max(1, Math.ceil(Math.log2(data.length) + 1))
    const bins = new Array(nb)
    const width = mn === mx ? 1 : (mx - mn) / nb
    const counts = new Array(nb).fill(0)
    for (const x of data) {
      let idx = width === 0 ? 0 : Math.floor((x - mn) / width)
      if (idx >= nb) idx = nb - 1
      counts[idx]++
    }
    for (let i = 0; i < nb; i++) bins[i] = [mn + i * width, mn + (i + 1) * width, counts[i]]
    return spec('histogram',
      kw('bins'), bins,
      kw('axes'), axesFromRange([mn, mx], counts.concat([0])))
  })

  // (plot/function f domain-x [opts]) → spec. Sample f on 64 points.
  //
  // A sample that cannot produce a finite number is a BREAK, not a failure of
  // the whole plot. 51-plot.slat's plot/function record is explicit about this
  // in four places: the summary ("handling discontinuities honestly (1/x shows
  // two branches, never a lie-bridge)"), the caveats ("Closure must return a
  // number; returning non-numeric values breaks that sample" / "Non-finite
  // outputs (infinity, NaN) break the line; this is intentional"), the row-4
  // invariant ("non-finite y ⇒ polyline break"), and the two documented
  // examples that sit on a singularity — (lambda (x) (/ 1 x)) over '(-2 2) and
  // over '(-3 3), both of which sample x = 0 exactly. Motoi RAISES on
  // (/ 1 0) rather than yielding an infinity, so the raise has to be caught
  // here or the verb can never render the very case its summary advertises.
  // The break is recorded as +nan.0, the non-finite marker the caveats name.
  def('plot/function', (f, domainX, opts) => {
    if (!isList(domainX) || domainX.length < 2) {
      throw new Error('plot/function: domain-x must be a list of at least (lo hi)')
    }
    const lo = domainX[0], hi = domainX[1]
    const N = (typeof opts === 'number' && opts > 1) ? (opts | 0) : 64
    const xs = new Array(N + 1)
    const ys = new Array(N + 1)
    for (let i = 0; i <= N; i++) {
      const x = lo + (hi - lo) * (i / N)
      xs[i] = x
      let y
      try {
        y = call(f, [x])
      } catch (e) {
        // A runaway closure is a real failure, not a discontinuity — never
        // swallow the interpreter's own fuel guard into 65 quiet NaNs.
        if (String(e && e.message).includes('fuel exhausted')) throw e
        y = NaN
      }
      ys[i] = (typeof y === 'number') ? y : NaN
    }
    return spec('function',
      kw('xs'), xs,
      kw('ys'), ys,
      kw('axes'), axesFromRange(xs, ys))
  })

  // (plot/contour f domain-x domain-y [opts]) → spec. R capped at 32.
  //
  // We store the evaluated grid; a downstream renderer runs marching-squares.
  def('plot/contour', (f, domainX, domainY, opts) => {
    const R = Math.min(32, (typeof opts === 'number' && opts > 1) ? (opts | 0) : 16)
    const [xlo, xhi] = domainX
    const [ylo, yhi] = domainY
    const grid = new Array(R)
    for (let j = 0; j < R; j++) {
      const y = ylo + (yhi - ylo) * (j / (R - 1))
      grid[j] = new Array(R)
      for (let i = 0; i < R; i++) {
        const x = xlo + (xhi - xlo) * (i / (R - 1))
        grid[j][i] = call(f, [x, y])
      }
    }
    return spec('contour',
      kw('domain-x'), domainX,
      kw('domain-y'), domainY,
      kw('grid'), grid,
      kw('axes'), [kw('x-min'), xlo, kw('x-max'), xhi,
                   kw('y-min'), ylo, kw('y-max'), yhi])
  })

  // (plot/parametric γ [opts]) → spec. Sample γ:t→(x,y) on t in [0, 2π].
  def('plot/parametric', (gamma, opts) => {
    const N = (typeof opts === 'number' && opts > 1) ? (opts | 0) : 128
    const tlo = 0, thi = 2 * Math.PI
    const xs = new Array(N + 1), ys = new Array(N + 1)
    for (let i = 0; i <= N; i++) {
      const t = tlo + (thi - tlo) * (i / N)
      const p = call(gamma, [t])
      xs[i] = p[0]
      ys[i] = p[1]
    }
    return spec('parametric',
      kw('xs'), xs,
      kw('ys'), ys,
      kw('axes'), axesFromRange(xs, ys))
  })

  // (plot/phase-portrait F [opts]) → spec. F: R² → R² samples on a grid.
  def('plot/phase-portrait', (F, opts) => {
    const R = (typeof opts === 'number' && opts > 1) ? (opts | 0) : 12
    const arrows = []
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < R; i++) {
        const x = -1 + 2 * (i / (R - 1))
        const y = -1 + 2 * (j / (R - 1))
        const v = call(F, [[x, y]])
        arrows.push([x, y, v[0], v[1]])
      }
    }
    return spec('phase-portrait',
      kw('arrows'), arrows,
      kw('axes'), [kw('x-min'), -1, kw('x-max'), 1, kw('y-min'), -1, kw('y-max'), 1])
  })

  // (plot/vector-field F [opts]) → spec. Same shape as phase-portrait but
  // tagged for gradient/flow visualizations.
  def('plot/vector-field', (F, opts) => {
    const R = (typeof opts === 'number' && opts > 1) ? (opts | 0) : 12
    const arrows = []
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < R; i++) {
        const x = -1 + 2 * (i / (R - 1))
        const y = -1 + 2 * (j / (R - 1))
        const v = call(F, [[x, y]])
        arrows.push([x, y, v[0], v[1]])
      }
    }
    return spec('vector-field',
      kw('arrows'), arrows,
      kw('axes'), [kw('x-min'), -1, kw('x-max'), 1, kw('y-min'), -1, kw('y-max'), 1])
  })

  // (plot/nice-domain (lo hi)) → (nice-lo nice-hi) rounded outward to
  // clean tick spacing (nearest power-of-ten sub-step).
  def('plot/nice-domain', (range) => {
    if (!isList(range) || range.length < 2) {
      throw new Error('plot/nice-domain: expected (lo hi)')
    }
    const lo = range[0], hi = range[1]
    if (lo === hi) return [lo - 1, hi + 1]
    const span = hi - lo
    // Pick a step that's a "nice" power of 10 giving ~5-10 ticks.
    const rawStep = span / 6
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
    const norm = rawStep / mag
    let step
    if (norm < 1.5) step = mag
    else if (norm < 3) step = 2 * mag
    else if (norm < 7) step = 5 * mag
    else step = 10 * mag
    const nlo = Math.floor(lo / step) * step
    const nhi = Math.ceil(hi / step) * step
    return [nlo, nhi]
  })

  // (plot/fit-grid data-range grid-size) → affine map (:scale s :offset o).
  //
  // Maps data-space [min, max] onto pixel grid [0, grid-size].
  def('plot/fit-grid', (range, gridSize) => {
    if (!isList(range) || range.length < 2) {
      throw new Error('plot/fit-grid: expected (min max)')
    }
    const mn = range[0], mx = range[1]
    if (mx === mn) throw new Error('plot/fit-grid: degenerate range (min == max)')
    if (gridSize <= 0) throw new Error('plot/fit-grid: grid-size must be positive')
    const scale = gridSize / (mx - mn)
    const offset = -mn * scale
    return [kw('affine'), kw('scale'), scale, kw('offset'), offset]
  })

  // (plot/from-series series-list [opts]) → spec bundling multiple series.
  def('plot/from-series', (seriesList, _opts) => {
    if (!isList(seriesList)) throw new Error('plot/from-series: expected a list of series')
    return spec('from-series', kw('series'), seriesList)
  })

  // (plot/with specs) → spec combining multiple sub-specs (overlay).
  def('plot/with', (specs) => {
    if (!isList(specs)) throw new Error('plot/with: expected a list of specs')
    return spec('compose', kw('layers'), specs)
  })

  // (plot/render-svg spec) → SVG string. Small honest renderer: draws only
  // line and scatter and bar plots properly; other kinds emit a titled
  // frame with a note. Suitable for kid smoke-tests, not production.
  def('plot/render-svg', (s) => {
    if (!isList(s)) throw new Error('plot/render-svg: expected a spec')
    // Extract :kind.
    let kind = null
    for (let i = 0; i < s.length; i += 2) {
      if (s[i] instanceof Sym && s[i].name === ':kind') {
        kind = s[i + 1] instanceof Sym ? s[i + 1].name : String(s[i + 1])
        break
      }
    }
    // Small deterministic SVG shell.
    const w = 320, h = 200
    let body = ''
    if (kind === 'line' || kind === 'function' || kind === 'parametric') {
      // Find xs/ys.
      let xs = [], ys = []
      for (let i = 0; i < s.length; i += 2) {
        if (s[i] instanceof Sym) {
          if (s[i].name === ':xs') xs = s[i + 1]
          if (s[i].name === ':ys') ys = s[i + 1]
        }
      }
      if (xs.length && ys.length) {
        const fx = finiteOnly(xs), fy = finiteOnly(ys)
        const xmn = fx.length ? Math.min(...fx) : 0, xmx = fx.length ? Math.max(...fx) : 0
        const ymn = fy.length ? Math.min(...fy) : 0, ymx = fy.length ? Math.max(...fy) : 0
        const dx = xmx - xmn || 1
        const dy = ymx - ymn || 1
        // A non-finite sample BREAKS the polyline — 51-plot.slat promises
        // "1/x shows two branches, never a lie-bridge", so the break has to
        // start a new <polyline> instead of drawing straight across the gap.
        const runs = []
        let run = []
        for (let i = 0; i < xs.length; i++) {
          const x = xs[i], y = ys[i]
          const ok = typeof x === 'number' && Number.isFinite(x) &&
                     typeof y === 'number' && Number.isFinite(y)
          if (!ok) { if (run.length) runs.push(run); run = []; continue }
          const px = ((x - xmn) / dx) * w
          const py = h - ((y - ymn) / dy) * h
          run.push(`${px.toFixed(2)},${py.toFixed(2)}`)
        }
        if (run.length) runs.push(run)
        body = runs
          .filter((r) => r.length > 1)
          .map((r) => `<polyline fill="none" stroke="black" stroke-width="1" points="${r.join(' ')}"/>`)
          .join('')
      }
    } else if (kind === 'bar') {
      let labels = [], values = []
      for (let i = 0; i < s.length; i += 2) {
        if (s[i] instanceof Sym) {
          if (s[i].name === ':labels') labels = s[i + 1]
          if (s[i].name === ':values') values = s[i + 1]
        }
      }
      if (values.length) {
        const mx = Math.max(...values, 0)
        const bw = w / values.length
        body = values.map((v, i) => {
          const bh = mx === 0 ? 0 : (v / mx) * h * 0.9
          return `<rect x="${(i * bw).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${(bw * 0.8).toFixed(2)}" height="${bh.toFixed(2)}" fill="steelblue"/>`
        }).join('')
      }
    } else if (kind === 'scatter') {
      let points = []
      for (let i = 0; i < s.length; i += 2) {
        if (s[i] instanceof Sym && s[i].name === ':points') points = s[i + 1]
      }
      if (points.length) {
        const xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
        const xmn = Math.min(...xs), xmx = Math.max(...xs)
        const ymn = Math.min(...ys), ymx = Math.max(...ys)
        const dx = xmx - xmn || 1, dy = ymx - ymn || 1
        body = points.map((p) => {
          const px = ((p[0] - xmn) / dx) * w
          const py = h - ((p[1] - ymn) / dy) * h
          return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="3" fill="black"/>`
        }).join('')
      }
    } else {
      body = `<text x="10" y="20" font-size="12">plot kind: ${kind}</text>`
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  })

  return env
}

export default installPlot
