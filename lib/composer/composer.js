// composer.js — Motoi Composer.
//
// PICO-8 / TIC-80 style composer. UI widgets translate deterministically
// into Scheme forms. Every widget is a plain JS record. `composer/emit`
// walks a canvas and returns a Scheme form (nested arrays with Sym
// entries). `composer/apply` walks a canvas + a form and mutates widget
// state to match. Round-trip is the guarantee:
//
//   (composer/apply c (composer/emit c))  ≡  c
//
// Provenance: engineering/COMPOSER-1.0.ENG.slat (spec, 2026-07-17).
// Doctrine: composer is a THIN LAYER over Scheme forms. Sliders don't
// have opinions. Buttons don't have opinions. Every widget carries a
// :bind path and moving it produces a form.
//
// Sakura is NOT required. This is pure deterministic translation.

import { Sym, sym, parse } from '../../src/reader.js'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { safePath } from '../security/path-guard.js'

// ── helpers ─────────────────────────────────────────────────────────

// Unwrap a Sym to its string name, otherwise passthrough.
const nm = (x) => (x instanceof Sym ? x.name : x)

// Parse a keyword-plist argument list into a plain object.
// Keywords are Syms whose name begins with `:` (e.g. `:label`, `:bind`).
// Everything else is a positional value and gets appended under a `_pos`
// key so callers can inspect it. Widget constructors use only the
// keyword slots; the `body` for `composer/canvas` is passed separately.
function plistToObj(args) {
  const out = {}
  const positional = []
  let i = 0
  while (i < args.length) {
    const a = args[i]
    const name = a instanceof Sym ? a.name : null
    if (name && name.startsWith(':')) {
      if (i + 1 >= args.length) break
      out[name.slice(1)] = args[i + 1]
      i += 2
    } else {
      positional.push(a)
      i += 1
    }
  }
  if (positional.length > 0) out._pos = positional
  return out
}

// A path is a quoted list like '(cart/main :bpm) — after evaluation this
// arrives as a plain JS array [Sym('cart/main'), Sym(':bpm')]. Store it
// as an array of *names* internally so round-trip comparisons don't hinge
// on Sym identity.
function pathToNames(path) {
  if (path == null) return []
  // Unwrap (quote x) if present — happens when a bind path is loaded from
  // disk as a quoted form.
  if (Array.isArray(path) && path.length === 2 && path[0] instanceof Sym && path[0].name === 'quote') {
    path = path[1]
  }
  if (!Array.isArray(path)) return [String(nm(path))]
  return path.map((p) => String(nm(p)))
}

// Rebuild a path (array of Syms) from stored names for emission.
function namesToPath(names) {
  return names.map((n) => sym(n))
}

// Deep-equal for the round-trip test — arrays and Syms + primitives.
export function deepEqual(a, b) {
  if (a === b) return true
  if (a instanceof Sym && b instanceof Sym) return a.name === b.name
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    for (const k of ak) if (!deepEqual(a[k], b[k])) return false
    return true
  }
  return false
}

// ── widget records ──────────────────────────────────────────────────
//
// Each widget is a plain JS object with:
//   kind:     the widget kind (canvas | slider | button | piano-roll | ...)
//   bind:     array of path names (strings), possibly empty
//   opts:     the keyword-parsed options (label, min, max, choices, ...)
//   state:    the current runtime state that emit will materialize
//
// widgets stored inside a canvas live under canvas.children.
// The canvas ALSO carries a `body` array (the raw parsed body forms) so
// composer/emit can round-trip forms it didn't recognize.

function makeCanvas(opts, body) {
  return {
    kind: 'canvas',
    bind: pathToNames(opts.bind),
    opts,
    body: Array.isArray(body) ? body : [],
    children: [],
  }
}

function makeSlider(opts) {
  const min = Number(opts.min ?? 0)
  const max = Number(opts.max ?? 1)
  const step = Number(opts.step ?? 0.01)
  const warnings = []
  // Contract: :min must not be a string / NaN / non-finite.
  if (opts.min != null && !Number.isFinite(min)) {
    throw new Error(`composer/slider: :min (${JSON.stringify(opts.min)}) is not a number`)
  }
  if (opts.max != null && !Number.isFinite(max)) {
    throw new Error(`composer/slider: :max (${JSON.stringify(opts.max)}) is not a number`)
  }
  if (opts.min != null && opts.max != null && min > max) {
    throw new Error(`composer/slider: :min (${min}) must be <= :max (${max})`)
  }
  if (opts.step != null && step < 0) {
    throw new Error(`composer/slider: :step (${step}) must be non-negative`)
  }
  let initial = opts.value != null ? Number(opts.value) : min
  if (opts.value != null && !Number.isFinite(initial)) {
    throw new Error(`composer/slider: :value (${JSON.stringify(opts.value)}) is not a number`)
  }
  // Value outside [min,max] is clamped with a warning field (kids can drag
  // past the endpoints in some UIs, but the stored value stays in-range).
  if (Number.isFinite(min) && Number.isFinite(max)) {
    if (initial < min) {
      warnings.push(`:value ${initial} clamped up to :min ${min}`)
      initial = min
    } else if (initial > max) {
      warnings.push(`:value ${initial} clamped down to :max ${max}`)
      initial = max
    }
  }
  return {
    kind: 'slider',
    bind: pathToNames(opts.bind),
    opts: {
      label: opts.label != null ? String(nm(opts.label)) : '',
      min, max, step,
      orientation: opts.orientation ? String(nm(opts.orientation)) : 'horizontal',
      log: opts.log === true,
    },
    state: { value: initial },
    ...(warnings.length ? { warnings } : {}),
  }
}

function makeButton(opts) {
  return {
    kind: 'button',
    bind: pathToNames(opts.bind),
    opts: {
      label: opts.label != null ? String(nm(opts.label)) : '',
    },
    // Emits is a Scheme form (quoted list) or a symbol — store as-is.
    state: { emits: opts.emits ?? null, clicked: 0 },
  }
}

function makePianoRoll(opts) {
  const range = opts.range || [sym('C3'), sym('C6')]
  const steps = Number(opts.steps ?? 16)
  const emitShape = opts.emitShape ? String(nm(opts.emitShape))
                   : opts['emit-shape'] ? String(nm(opts['emit-shape']))
                   : 'sequence'
  if (opts.steps != null && !Number.isFinite(steps)) {
    throw new Error(`composer/piano-roll: :steps (${JSON.stringify(opts.steps)}) must be a number`)
  }
  if (opts.steps != null && steps < 0) {
    throw new Error(`composer/piano-roll: :steps (${steps}) must be non-negative`)
  }
  // Range may arrive as a proper list [Sym('C3'), Sym('C6')] OR the
  // legacy dotted-pair reading [Sym('C3'), Sym('.'), Sym('C6')]. Filter
  // the `.` sentinel so we always get [low, high].
  let rangeArr
  if (Array.isArray(range)) {
    rangeArr = range
      .filter((r) => !(r instanceof Sym && r.name === '.'))
      .map((r) => String(nm(r)))
  } else {
    rangeArr = [String(nm(range))]
  }
  // Reload saved notes if provided.
  const notes = []
  if (Array.isArray(opts.notes)) {
    for (const n of opts.notes) {
      // Each note is [pitch at vel dur] OR {pitch, at, vel, dur}.
      if (Array.isArray(n)) {
        notes.push({
          pitch: String(nm(n[0])),
          at: Number(n[1] ?? 0),
          vel: Number(n[2] ?? 0.8),
          dur: Number(n[3] ?? 1),
        })
      } else if (n && typeof n === 'object') {
        notes.push({
          pitch: String(nm(n.pitch)),
          at: Number(n.at ?? 0),
          vel: Number(n.vel ?? 0.8),
          dur: Number(n.dur ?? 1),
        })
      }
    }
  }
  return {
    kind: 'piano-roll',
    bind: pathToNames(opts.bind),
    opts: {
      label: opts.label != null ? String(nm(opts.label)) : '',
      range: rangeArr,
      steps,
      emitShape,
    },
    // notes: [{ pitch: 'C4', vel: 0.8, at: 0, dur: 1 }, …]
    state: { notes },
  }
}

// Coerce a "size" list — accepts proper list [w, h] or defensively
// filters out the reader's dotted-pair sentinel Sym('.') so legacy
// spec examples like '(8 . 8) don't produce NaN silently.
function coerceSizeList(size, defaultW, defaultH) {
  if (size == null) return { w: defaultW, h: defaultH ?? defaultW }
  if (!Array.isArray(size)) {
    const n = Number(size)
    return { w: n, h: n }
  }
  // Filter out the dotted-pair `.` sentinel — reader emits it as Sym('.'),
  // which Number(...) would NaN on. Emit uses list-notation but legacy
  // spec examples and hand-typed carts may still use '(8 . 8).
  const clean = size.filter((x) => !(x instanceof Sym && x.name === '.'))
  const w = Number(clean[0] ?? defaultW)
  const h = Number(clean[1] ?? clean[0] ?? defaultH ?? defaultW)
  return { w, h }
}

function makeSpriteGrid(opts) {
  const { w, h } = coerceSizeList(opts.size, 8, 8)
  if (opts.size != null) {
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      throw new Error(`composer/sprite-grid: :size (${JSON.stringify(opts.size)}) must be a list of two numbers`)
    }
    if (w < 0 || h < 0) {
      throw new Error(`composer/sprite-grid: :size (${w},${h}) must be non-negative`)
    }
    if (!Number.isInteger(w) || !Number.isInteger(h)) {
      throw new Error(`composer/sprite-grid: :size (${w},${h}) must be integer`)
    }
  }
  // pixels: h rows × w cols of palette indices, default 0.
  const pixels = []
  for (let r = 0; r < h; r++) {
    const row = new Array(w).fill(0)
    pixels.push(row)
  }
  // If :pixels was provided (from a loaded save), overlay it.
  if (opts.pixels != null && Array.isArray(opts.pixels)) {
    for (let r = 0; r < Math.min(pixels.length, opts.pixels.length); r++) {
      const src = opts.pixels[r]
      if (!Array.isArray(src)) continue
      for (let c = 0; c < Math.min(pixels[r].length, src.length); c++) {
        const v = Number(src[c])
        pixels[r][c] = Number.isFinite(v) ? v : 0
      }
    }
  }
  return {
    kind: 'sprite-grid',
    bind: pathToNames(opts.bind),
    opts: {
      w, h,
      palette: opts.palette ? String(nm(opts.palette)) : 'pico-8',
      emitShape: opts.emitShape ? String(nm(opts.emitShape))
                : opts['emit-shape'] ? String(nm(opts['emit-shape']))
                : 'sprite/from-grid',
    },
    state: { pixels },
  }
}

function makeTileMap(opts) {
  const { w: cols, h: rows } = coerceSizeList(opts.size, 8, 8)
  if (opts.size != null) {
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) {
      throw new Error(`composer/tile-map: :size (${JSON.stringify(opts.size)}) must be a list of two numbers`)
    }
    if (cols < 0 || rows < 0) {
      throw new Error(`composer/tile-map: :size (${cols},${rows}) must be non-negative`)
    }
  }
  const cells = {}
  // Reload saved cells if provided as ((c r tile) ...) list.
  if (Array.isArray(opts.cells)) {
    for (const entry of opts.cells) {
      if (!Array.isArray(entry) || entry.length < 3) continue
      const [c, r, v] = entry
      const cn = Number(c), rn = Number(r), vn = Number(v)
      if (!Number.isFinite(cn) || !Number.isFinite(rn) || !Number.isFinite(vn)) continue
      cells[`${cn},${rn}`] = vn
    }
  }
  return {
    kind: 'tile-map',
    bind: pathToNames(opts.bind),
    opts: {
      cols, rows,
      tileset: opts.tileset != null ? opts.tileset : null,
    },
    // cells stored as { "c,r": tileId }
    state: { cells },
  }
}

function makeTimeline(opts) {
  const entities = Array.isArray(opts.entities)
    ? opts.entities.map((e) => String(nm(e)))
    : []
  const duration = Number(opts.duration ?? 60)
  const fps = Number(opts.fps ?? 30)
  if (opts.duration != null && (!Number.isFinite(duration) || duration < 0)) {
    throw new Error(`composer/timeline: :duration (${opts.duration}) must be a non-negative number`)
  }
  if (opts.fps != null && (!Number.isFinite(fps) || fps < 0)) {
    throw new Error(`composer/timeline: :fps (${opts.fps}) must be a non-negative number`)
  }
  const frames = {}
  // Reload saved frames: `((entity ((at (x y)) ...)) ...)` — an alist per entity.
  if (Array.isArray(opts.frames)) {
    for (const bucket of opts.frames) {
      if (!Array.isArray(bucket) || bucket.length < 2) continue
      const ent = String(nm(bucket[0]))
      const arr = bucket[1]
      if (!Array.isArray(arr)) continue
      const list = []
      for (const pair of arr) {
        if (!Array.isArray(pair) || pair.length < 2) continue
        const at = Number(pair[0])
        const value = pair[1]
        if (!Number.isFinite(at)) continue
        list.push({ at, value })
      }
      list.sort((a, b) => a.at - b.at)
      frames[ent] = list
    }
  }
  return {
    kind: 'timeline',
    bind: pathToNames(opts.bind),
    opts: {
      entities,
      duration,
      fps,
      loop: opts.loop === true,
      emitShape: opts.emitShape ? String(nm(opts.emitShape))
                : opts['emit-shape'] ? String(nm(opts['emit-shape']))
                : 'animation',
    },
    // frames per entity: { entityName: [{ at: 0, value: [x,y] }, …] }
    state: { frames },
  }
}

function makeAdsr(opts) {
  const a = Number(opts.a ?? 0.01)
  const d = Number(opts.d ?? 0.1)
  const s = Number(opts.s ?? 0.7)
  const r = Number(opts.r ?? 0.2)
  for (const [k, v] of [['a', a], ['d', d], ['s', s], ['r', r]]) {
    if (opts[k] != null && !Number.isFinite(v)) {
      throw new Error(`composer/adsr: :${k} (${JSON.stringify(opts[k])}) is not a number`)
    }
    if (opts[k] != null && v < 0) {
      throw new Error(`composer/adsr: :${k} (${v}) must be non-negative`)
    }
  }
  return {
    kind: 'adsr',
    bind: pathToNames(opts.bind),
    opts: {},
    state: { a, d, s, r },
  }
}

function makeInstrumentPicker(opts) {
  const choices = Array.isArray(opts.choices)
    ? opts.choices.map((c) => String(nm(c)))
    : []
  let chosen = choices.length > 0 ? choices[0] : null
  if (opts.chosen != null) {
    if (Array.isArray(opts.chosen) && opts.chosen.length === 0) chosen = null
    else chosen = String(nm(opts.chosen))
  }
  return {
    kind: 'instrument-picker',
    bind: pathToNames(opts.bind),
    opts: { choices },
    state: { chosen },
  }
}

function makeFxChain(opts) {
  const available = Array.isArray(opts.available)
    ? opts.available.map((c) => String(nm(c)))
    : []
  const chain = []
  if (Array.isArray(opts.chain)) {
    for (const entry of opts.chain) {
      if (!Array.isArray(entry) || entry.length < 1) continue
      const name = String(nm(entry[0]))
      const pairs = Array.isArray(entry[1]) ? entry[1] : []
      const obj = {}
      for (let i = 0; i < pairs.length; i += 2) {
        const k = pairs[i]
        const v = pairs[i + 1]
        const key = k instanceof Sym && k.name.startsWith(':') ? k.name.slice(1) : String(nm(k))
        obj[key] = v
      }
      chain.push([name, obj])
    }
  }
  return {
    kind: 'fx-chain',
    bind: pathToNames(opts.bind),
    opts: { available },
    // chain: [ [fxName, {kw: val, ...}], … ]
    state: { chain },
  }
}

function makeTextField(opts) {
  return {
    kind: 'text-field',
    bind: pathToNames(opts.bind),
    opts: {
      label: opts.label != null ? String(nm(opts.label)) : '',
    },
    state: { value: opts.value != null ? String(opts.value) : '' },
  }
}

function makeToggle(opts) {
  // Contract: :value must be #t or #f. Coerce numeric 0/1 for kid ergonomics.
  // Reject strings (which silently collapse to false in JS ===).
  let value = false
  if (opts.value != null) {
    if (opts.value === true || opts.value === false) {
      value = opts.value
    } else if (opts.value === 0 || opts.value === 1) {
      value = opts.value === 1
    } else if (typeof opts.value === 'string') {
      throw new Error(`composer/toggle: :value (${JSON.stringify(opts.value)}) must be #t or #f, not a string`)
    } else {
      // Unknown shape — reject.
      throw new Error(`composer/toggle: :value must be #t or #f, got ${JSON.stringify(opts.value)}`)
    }
  }
  return {
    kind: 'toggle',
    bind: pathToNames(opts.bind),
    opts: {
      label: opts.label != null ? String(nm(opts.label)) : '',
    },
    state: { value },
  }
}

function makeColorPicker(opts) {
  return {
    kind: 'color-picker',
    bind: pathToNames(opts.bind),
    opts: {
      palette: opts.palette != null ? String(nm(opts.palette)) : null,
    },
    state: { value: opts.value != null ? nm(opts.value) : (opts.palette ? sym('black') : '#000000') },
  }
}

function makeLiveCode(opts) {
  return {
    kind: 'live-code',
    bind: pathToNames(opts.bind),
    opts: {},
    state: { source: opts.source != null ? String(opts.source) : '' },
  }
}

// ── emit — widget -> Scheme form ────────────────────────────────────

// Widget-kind extension registry — v1.1+ modules register handlers here
// so composer/emit and composer/apply keep working across new widgets
// without hard-coding switch cases in this file.
export const WIDGET_EMITTERS = new Map()
export const WIDGET_APPLIERS = new Map()
export const WIDGET_INSTANTIATORS = new Map()

// Emit the WIDGET DECLARATION itself (as it would appear inside the
// canvas body). Used by composer/emit when serializing the canvas as
// a `(composer/canvas ...)` form.
//
// State fields (notes/pixels/cells/frames/chain/chosen/source) are
// emitted so save/load round-trips authored content — the "kid draws
// sprite, saves, reopens tomorrow" test.
function emitWidgetDeclaration(w) {
  const ext = WIDGET_EMITTERS.get(w.kind)
  if (ext) return ext(w)
  switch (w.kind) {
    case 'canvas': return emitCanvasDeclaration(w)
    case 'slider':
      return [sym('composer/slider'),
        sym(':label'), w.opts.label,
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':min'), w.opts.min,
        sym(':max'), w.opts.max,
        sym(':step'), w.opts.step,
        sym(':value'), w.state.value]
    case 'button':
      return [sym('composer/button'),
        sym(':label'), w.opts.label,
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':emits'), quoteForm(w.state.emits ?? [])]
    case 'piano-roll':
      return [sym('composer/piano-roll'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        // Emit range as a proper list, NOT a dotted-pair — round-trips
        // cleanly through the reader (no Sym('.') → NaN trap).
        sym(':range'), quoteForm([sym(w.opts.range[0]), sym(w.opts.range[1])]),
        sym(':steps'), w.opts.steps,
        sym(':emit-shape'), quoteForm(sym(w.opts.emitShape)),
        // State: notes as ((pitch at vel dur) ...)
        sym(':notes'), quoteForm(
          w.state.notes.map((n) => [sym(String(n.pitch)), n.at, n.vel, n.dur ?? 1]))]
    case 'sprite-grid':
      return [sym('composer/sprite-grid'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        // Proper-list size, not dotted-pair.
        sym(':size'), quoteForm([w.opts.w, w.opts.h]),
        sym(':palette'), quoteForm(sym(w.opts.palette)),
        // State: 2D pixel grid.
        sym(':pixels'), quoteForm(w.state.pixels.map((row) => row.slice()))]
    case 'tile-map':
      return [sym('composer/tile-map'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':size'), quoteForm([w.opts.cols, w.opts.rows]),
        // State: cells as ((c r tileId) ...)
        sym(':cells'), quoteForm(
          Object.entries(w.state.cells).map(([k, v]) => {
            const [c, r] = k.split(',').map(Number)
            return [c, r, v]
          }))]
    case 'timeline':
      return [sym('composer/timeline'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':entities'), quoteForm(w.opts.entities.map((e) => sym(e))),
        sym(':duration'), w.opts.duration,
        sym(':fps'), w.opts.fps,
        // State: frames per entity as ((entity ((at value) ...)) ...)
        sym(':frames'), quoteForm(
          Object.entries(w.state.frames).map(([ent, arr]) => {
            return [sym(ent), arr.map((f) => [f.at, f.value])]
          }))]
    case 'adsr':
      return [sym('composer/adsr'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':a'), w.state.a,
        sym(':d'), w.state.d,
        sym(':s'), w.state.s,
        sym(':r'), w.state.r]
    case 'instrument-picker':
      return [sym('composer/instrument-picker'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':choices'), quoteForm(w.opts.choices.map((c) => sym(c))),
        sym(':chosen'), w.state.chosen == null
          ? quoteForm([])
          : quoteForm(sym(String(w.state.chosen)))]
    case 'fx-chain':
      return [sym('composer/fx-chain'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':available'), quoteForm(w.opts.available.map((c) => sym(c))),
        // State: chain as ((fx-name (k v k v ...)) ...) — kws flattened
        sym(':chain'), quoteForm(w.state.chain.map(([name, kws]) => {
          const pairs = []
          for (const [k, v] of Object.entries(kws || {})) {
            pairs.push(sym(':' + k), v)
          }
          return [sym(name), pairs]
        }))]
    case 'text-field':
      return [sym('composer/text-field'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':label'), w.opts.label,
        sym(':value'), w.state.value]
    case 'toggle':
      return [sym('composer/toggle'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        sym(':label'), w.opts.label,
        sym(':value'), w.state.value]
    case 'color-picker':
      return [sym('composer/color-picker'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        // Preserve :palette (defaults to () when null so round-trip
        // reconstructor sees the same shape).
        sym(':palette'), w.opts.palette
          ? quoteForm(sym(String(w.opts.palette)))
          : quoteForm([]),
        sym(':value'), quoteForm(w.state.value)]
    case 'live-code':
      return [sym('composer/live-code'),
        sym(':bind'), quoteForm(namesToPath(w.bind)),
        // Source is a raw string — no quote needed. Represent an empty
        // source as an empty string so JSON.stringify round-trips.
        sym(':source'), String(w.state.source ?? '')]
    default:
      return [sym('composer/unknown'), w.kind]
  }
}

// Wrap a form in a (quote …) so the reader/evaluator round-trip stays
// clean. Numbers, strings, booleans do NOT need quoting.
function quoteForm(v) {
  if (v == null) return [sym('quote'), []]
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  return [sym('quote'), v]
}

// Emit a canvas as `(composer/canvas (:bind '(...)) child1 child2 …)`.
function emitCanvasDeclaration(canvas) {
  const head = sym('composer/canvas')
  const bindClause = [sym(':bind'), quoteForm(namesToPath(canvas.bind))]
  const children = canvas.children.map(emitWidgetDeclaration)
  return [head, bindClause, ...children]
}

// Emit the TARGET FORM the widgets compose. This is what most callers
// care about: the piano-roll emits `(sequence (note …) …)`, the sprite
// grid emits `(sprite/from-grid '(…))`, etc.
function emitWidgetTarget(w) {
  switch (w.kind) {
    case 'slider':      return w.state.value
    case 'text-field':  return w.state.value
    case 'toggle':      return w.state.value
    case 'color-picker': return w.state.value
    case 'instrument-picker':
      return w.state.chosen == null ? [] : sym(w.state.chosen)
    case 'adsr':
      return [sym('adsr'),
        sym(':a'), w.state.a,
        sym(':d'), w.state.d,
        sym(':s'), w.state.s,
        sym(':r'), w.state.r]
    case 'piano-roll': {
      const head = sym(w.opts.emitShape || 'sequence')
      const notes = w.state.notes.map((n) => [
        sym('note'),
        sym(':pitch'), quoteForm(sym(String(n.pitch))),
        sym(':vel'), n.vel,
        sym(':at'), n.at,
        sym(':dur'), n.dur ?? 1,
      ])
      return [head, ...notes]
    }
    case 'sprite-grid': {
      const head = sym(w.opts.emitShape || 'sprite/from-grid')
      const rows = w.state.pixels.map((row) => row.slice())
      return [head, quoteForm(rows)]
    }
    case 'tile-map': {
      const cells = Object.entries(w.state.cells).map(([k, v]) => {
        const [c, r] = k.split(',').map(Number)
        return [c, r, v]
      })
      return [sym('tile-map'),
        sym(':size'), [w.opts.cols, w.opts.rows],
        sym(':cells'), quoteForm(cells)]
    }
    case 'timeline': {
      const parts = []
      for (const [ent, frames] of Object.entries(w.state.frames)) {
        parts.push([
          sym(w.opts.emitShape || 'animation'),
          sym(':entity'), quoteForm(sym(ent)),
          sym(':frames'), quoteForm(frames.map((f) => [f.at, f.value])),
        ])
      }
      return parts.length === 1 ? parts[0] : [sym('begin'), ...parts]
    }
    case 'fx-chain': {
      const chain = w.state.chain.map(([name, kws]) => {
        const kwPairs = []
        for (const [k, v] of Object.entries(kws || {})) {
          kwPairs.push(sym(':' + k), v)
        }
        return [sym(name), ...kwPairs]
      })
      return [sym('fx-chain'), ...chain]
    }
    case 'button':
      // Buttons emit their `:emits` form as their target.
      return w.state.emits ?? []
    case 'live-code':
      return w.state.source
    default:
      return []
  }
}

// Public composer/emit: for a canvas, return a `(composer/canvas ...)`
// declaration form that preserves child widgets AND their state so a
// composer/apply of the same form reconstructs the widget tree exactly.
export function emitCanvas(canvas) {
  return emitCanvasDeclaration(canvas)
}

// ── apply — form -> widget state ────────────────────────────────────
//
// composer/apply walks a `(composer/canvas ...)` form and mutates the
// canvas widgets to match. This is the round-trip closer.

// Extract keyword args from a form like [head, :key val, :key val, ...].
function extractKws(form) {
  const kws = {}
  for (let i = 1; i < form.length; i++) {
    const a = form[i]
    const name = a instanceof Sym ? a.name : null
    if (name && name.startsWith(':')) {
      if (i + 1 >= form.length) break
      kws[name.slice(1)] = form[i + 1]
      i++
    }
  }
  return kws
}

// Extract the positional (non-keyword) forms from a canvas body.
function extractChildren(form) {
  const children = []
  for (let i = 1; i < form.length; i++) {
    const a = form[i]
    // Skip (:bind '(...)) opening clause — it's a list starting with a keyword.
    if (Array.isArray(a) && a.length > 0 && a[0] instanceof Sym && a[0].name.startsWith(':')) {
      continue
    }
    // Skip inline keyword pairs (:foo val).
    if (a instanceof Sym && a.name.startsWith(':')) { i++; continue }
    children.push(a)
  }
  return children
}

// Unwrap (quote x) → x. Otherwise passthrough.
function unquote(f) {
  if (Array.isArray(f) && f.length === 2 && f[0] instanceof Sym && f[0].name === 'quote') {
    return f[1]
  }
  return f
}

// Given a widget kind form like [Sym('composer/slider'), :label "BPM", :bind '(...), ...]
// update the given widget's state to match.
function applyFormToWidget(w, form) {
  const ext = WIDGET_APPLIERS.get(w.kind)
  if (ext) { ext(w, form); return }
  const kws = extractKws(form)
  switch (w.kind) {
    case 'slider':
      if (kws.value != null) w.state.value = Number(kws.value)
      if (kws.min != null) w.opts.min = Number(kws.min)
      if (kws.max != null) w.opts.max = Number(kws.max)
      if (kws.step != null) w.opts.step = Number(kws.step)
      if (kws.label != null) w.opts.label = String(nm(kws.label))
      break
    case 'text-field':
      if (kws.value != null) w.state.value = String(kws.value)
      if (kws.label != null) w.opts.label = String(nm(kws.label))
      break
    case 'toggle':
      if (kws.value != null) w.state.value = kws.value === true
      if (kws.label != null) w.opts.label = String(nm(kws.label))
      break
    case 'color-picker':
      if (kws.value != null) {
        const v = unquote(kws.value)
        w.state.value = v instanceof Sym ? v : String(v)
      }
      if (kws.palette != null) {
        const p = unquote(kws.palette)
        if (Array.isArray(p) && p.length === 0) w.opts.palette = null
        else w.opts.palette = String(nm(p))
      }
      break
    case 'instrument-picker':
      if (kws.choices != null) {
        const choicesRaw = unquote(kws.choices)
        if (Array.isArray(choicesRaw)) {
          w.opts.choices = choicesRaw.map((c) => String(nm(c)))
        }
      }
      if (kws.chosen != null) {
        const c = unquote(kws.chosen)
        if (Array.isArray(c) && c.length === 0) w.state.chosen = null
        else w.state.chosen = String(nm(c))
      }
      break
    case 'button':
      if (kws.emits != null) w.state.emits = unquote(kws.emits)
      if (kws.label != null) w.opts.label = String(nm(kws.label))
      break
    case 'adsr':
      if (kws.a != null) w.state.a = Number(kws.a)
      if (kws.d != null) w.state.d = Number(kws.d)
      if (kws.s != null) w.state.s = Number(kws.s)
      if (kws.r != null) w.state.r = Number(kws.r)
      break
    case 'piano-roll':
      if (kws.steps != null) w.opts.steps = Number(kws.steps)
      if (kws['emit-shape'] != null) w.opts.emitShape = String(nm(unquote(kws['emit-shape'])))
      if (kws.range != null) {
        const r = unquote(kws.range)
        if (Array.isArray(r)) {
          const clean = r.filter((x) => !(x instanceof Sym && x.name === '.'))
          if (clean.length >= 2) w.opts.range = [String(nm(clean[0])), String(nm(clean[1]))]
        }
      }
      if (kws.notes != null) {
        const nsRaw = unquote(kws.notes)
        if (Array.isArray(nsRaw)) {
          w.state.notes = nsRaw.map((n) => {
            if (Array.isArray(n)) return {
              pitch: String(nm(n[0])),
              at: Number(n[1] ?? 0),
              vel: Number(n[2] ?? 0.8),
              dur: Number(n[3] ?? 1),
            }
            return n
          }).filter(Boolean)
        }
      }
      break
    case 'sprite-grid':
      if (kws.size != null) {
        const sz = unquote(kws.size)
        if (Array.isArray(sz)) {
          const clean = sz.filter((x) => !(x instanceof Sym && x.name === '.'))
          const nums = clean.map(Number).filter((n) => Number.isFinite(n))
          if (nums.length >= 1) w.opts.w = nums[0]
          if (nums.length >= 2) w.opts.h = nums[1]
        }
      }
      if (kws.palette != null) {
        const p = unquote(kws.palette)
        if (p != null) w.opts.palette = String(nm(p))
      }
      if (kws.pixels != null) {
        const pxRaw = unquote(kws.pixels)
        if (Array.isArray(pxRaw)) {
          // Rebuild grid at the current w/h, overlay values from pxRaw.
          const h = w.opts.h, ww = w.opts.w
          const grid = []
          for (let r = 0; r < h; r++) grid.push(new Array(ww).fill(0))
          for (let r = 0; r < Math.min(h, pxRaw.length); r++) {
            const row = pxRaw[r]
            if (!Array.isArray(row)) continue
            for (let c = 0; c < Math.min(ww, row.length); c++) {
              const v = Number(row[c])
              grid[r][c] = Number.isFinite(v) ? v : 0
            }
          }
          w.state.pixels = grid
        }
      }
      break
    case 'tile-map':
      if (kws.size != null) {
        const sz = unquote(kws.size)
        if (Array.isArray(sz)) {
          const clean = sz.filter((x) => !(x instanceof Sym && x.name === '.'))
          const nums = clean.map(Number).filter((n) => Number.isFinite(n))
          if (nums.length >= 1) w.opts.cols = nums[0]
          if (nums.length >= 2) w.opts.rows = nums[1]
        }
      }
      if (kws.cells != null) {
        const cellsRaw = unquote(kws.cells)
        if (Array.isArray(cellsRaw)) {
          const cells = {}
          for (const entry of cellsRaw) {
            if (!Array.isArray(entry) || entry.length < 3) continue
            const c = Number(entry[0]), r = Number(entry[1]), v = Number(entry[2])
            if (!Number.isFinite(c) || !Number.isFinite(r) || !Number.isFinite(v)) continue
            cells[`${c},${r}`] = v
          }
          w.state.cells = cells
        }
      }
      break
    case 'fx-chain':
      if (kws.available != null) {
        const av = unquote(kws.available)
        if (Array.isArray(av)) w.opts.available = av.map((c) => String(nm(c)))
      }
      if (kws.chain != null) {
        const chainRaw = unquote(kws.chain)
        if (Array.isArray(chainRaw)) {
          w.state.chain = chainRaw.map((entry) => {
            if (!Array.isArray(entry) || entry.length < 1) return null
            const name = String(nm(entry[0]))
            const pairs = Array.isArray(entry[1]) ? entry[1] : []
            const obj = {}
            for (let i = 0; i < pairs.length; i += 2) {
              const k = pairs[i]
              const v = pairs[i + 1]
              const key = k instanceof Sym && k.name.startsWith(':') ? k.name.slice(1) : String(nm(k))
              obj[key] = v
            }
            return [name, obj]
          }).filter(Boolean)
        }
      }
      break
    case 'timeline':
      if (kws.duration != null) w.opts.duration = Number(kws.duration)
      if (kws.fps != null) w.opts.fps = Number(kws.fps)
      if (kws.entities != null) {
        const ents = unquote(kws.entities)
        if (Array.isArray(ents)) w.opts.entities = ents.map((e) => String(nm(e)))
      }
      if (kws.frames != null) {
        const fRaw = unquote(kws.frames)
        if (Array.isArray(fRaw)) {
          const frames = {}
          for (const bucket of fRaw) {
            if (!Array.isArray(bucket) || bucket.length < 2) continue
            const ent = String(nm(bucket[0]))
            const arr = bucket[1]
            if (!Array.isArray(arr)) continue
            const list = []
            for (const pair of arr) {
              if (!Array.isArray(pair) || pair.length < 2) continue
              const at = Number(pair[0])
              if (!Number.isFinite(at)) continue
              list.push({ at, value: pair[1] })
            }
            list.sort((a, b) => a.at - b.at)
            frames[ent] = list
          }
          w.state.frames = frames
        }
      }
      break
    case 'live-code':
      if (kws.source != null) w.state.source = String(kws.source)
      break
    case 'canvas':
      // Nested canvas: recurse into applyForm.
      applyForm(w, form)
      break
  }
}

// Public composer/apply: walk a canvas-form and update the canvas.
export function applyForm(canvas, form) {
  if (!Array.isArray(form)) return canvas
  if (form.length === 0) return canvas
  const head = form[0]
  const headName = head instanceof Sym ? head.name : String(head)
  if (headName !== 'composer/canvas') return canvas
  const children = extractChildren(form)
  // Update each child widget in order. If the incoming form has fewer
  // or more children than the canvas, we update the overlap only —
  // no widgets are created or destroyed by apply. (Round-trip guarantees
  // the counts match.)
  const n = Math.min(children.length, canvas.children.length)
  for (let i = 0; i < n; i++) {
    applyFormToWidget(canvas.children[i], children[i])
  }
  return canvas
}

// ── cart-level bundle (Wave 4 · Marcus 2026-07-19) ──────────────────
//
// See Spec/CART-TEMPLATE.slat for the canonical shape. The cart is an
// alist with 7 fixed keys, always in the same order. Missing sections
// are the empty list `()`, never omitted.

export const CART_SECTIONS = ['meta', 'palette', 'sprites', 'tiles', 'sounds', 'music', 'code']

// Build a canonical empty cart. Every section present, every value ().
export function cartEmpty() {
  return CART_SECTIONS.map((k) => [sym(':' + k), []])
}

// Emit a cart as its canonical alist form. Accepts either:
//   - an already-canonical alist (list of [Sym(':k'), value])
//   - a JS object { meta, palette, sprites, tiles, sounds, music, code }
// Missing keys become empty lists. Unknown keys are DROPPED (downstream
// consumers per spec silently ignore, so we round-trip cleanly).
export function cartEmit(cart) {
  const bag = {}
  if (Array.isArray(cart)) {
    for (const pair of cart) {
      if (!Array.isArray(pair) || pair.length < 2) continue
      const k = pair[0] instanceof Sym ? pair[0].name.replace(/^:/, '') : String(pair[0]).replace(/^:/, '')
      bag[k] = pair[1]
    }
  } else if (cart && typeof cart === 'object') {
    for (const k of Object.keys(cart)) bag[k] = cart[k]
  }
  return CART_SECTIONS.map((k) => [sym(':' + k), (bag[k] === undefined ? [] : bag[k])])
}

// Apply a template alist to the cart. Returns a NEW cart (the alist
// form) with the template's sections replacing the cart's. Unknown
// keys in the template are ignored. Missing keys default to whatever
// was there before, or the empty list if that was also missing.
export function cartApply(cart, template) {
  const before = cartEmit(cart)     // canonical
  const now = {}
  for (const pair of before) {
    const k = pair[0].name.replace(/^:/, '')
    now[k] = pair[1]
  }
  const incoming = cartEmit(template)
  for (const pair of incoming) {
    const k = pair[0].name.replace(/^:/, '')
    // Only overwrite when the incoming section is non-default. An
    // incoming empty list still overwrites — that's a legitimate
    // "clear this section" signal.
    now[k] = pair[1]
  }
  return CART_SECTIONS.map((k) => [sym(':' + k), (now[k] === undefined ? [] : now[k])])
}

// ── installer ───────────────────────────────────────────────────────

export function installComposer(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (composer/canvas (:bind '(...)) child …) → canvas record
  //
  // In Motoi's evaluator, keyword args aren't a special syntax — the
  // canvas verb receives all its arguments already evaluated. The first
  // argument is expected to be a plist-clause `(list :bind '(...))`, and
  // the rest are widget records. To keep the ergonomics of the spec
  // example (`(composer/canvas (:bind '(cart/main)) child …)`), we accept
  // BOTH:
  //   - a first-arg list that is itself a plist starting with a keyword
  //   - or interleaved `:bind '(...)` keyword pairs among the args
  def('composer/canvas', (...args) => {
    let opts = {}
    let children = args
    if (args.length > 0 && Array.isArray(args[0])) {
      const first = args[0]
      if (first.length > 0 && first[0] instanceof Sym && first[0].name.startsWith(':')) {
        opts = plistToObj(first)
        children = args.slice(1)
      }
    }
    // Also fold in any interleaved :kw val pairs before the first
    // widget-record.
    const inlineKws = []
    const rest = []
    let seenWidget = false
    for (const a of children) {
      if (!seenWidget && a instanceof Sym && a.name.startsWith(':')) {
        inlineKws.push(a)
      } else if (!seenWidget && inlineKws.length % 2 === 1) {
        inlineKws.push(a)
      } else {
        seenWidget = true
        rest.push(a)
      }
    }
    if (inlineKws.length > 0) {
      const inlineOpts = plistToObj(inlineKws)
      opts = { ...opts, ...inlineOpts }
    }
    // Filter out non-widget-record entries (defensive).
    const widgetChildren = rest.filter((c) => c && typeof c === 'object' && c.kind)
    const canvas = makeCanvas(opts, rest)
    canvas.children = widgetChildren
    return canvas
  }, 'state-change')

  // The individual widget verbs — each takes plist args and returns a
  // widget record. Perm 'state-change' per the spec.
  def('composer/slider',   (...args) => makeSlider(plistToObj(args)), 'state-change')
  def('composer/button',   (...args) => makeButton(plistToObj(args)), 'state-change')
  def('composer/piano-roll', (...args) => makePianoRoll(plistToObj(args)), 'state-change')
  def('composer/sprite-grid', (...args) => makeSpriteGrid(plistToObj(args)), 'state-change')
  def('composer/tile-map', (...args) => makeTileMap(plistToObj(args)), 'state-change')
  def('composer/timeline', (...args) => makeTimeline(plistToObj(args)), 'state-change')
  def('composer/adsr',     (...args) => makeAdsr(plistToObj(args)), 'state-change')
  def('composer/instrument-picker', (...args) => makeInstrumentPicker(plistToObj(args)), 'state-change')
  def('composer/fx-chain', (...args) => makeFxChain(plistToObj(args)), 'state-change')
  def('composer/text-field', (...args) => makeTextField(plistToObj(args)), 'state-change')
  def('composer/toggle',   (...args) => makeToggle(plistToObj(args)), 'state-change')
  def('composer/color-picker', (...args) => makeColorPicker(plistToObj(args)), 'state-change')
  def('composer/live-code', (...args) => makeLiveCode(plistToObj(args)), 'state-change')

  // (composer/emit canvas) → form.
  def('composer/emit', (canvas) => {
    if (!canvas || canvas.kind !== 'canvas') return []
    return emitCanvas(canvas)
  }, 'read')

  // (composer/apply canvas form) → canvas.
  def('composer/apply', (canvas, form) => {
    if (!canvas || canvas.kind !== 'canvas') return canvas
    return applyForm(canvas, form)
  }, 'state-change')

  // ── CART-LEVEL EMIT / APPLY (Wave 4 · Marcus 2026-07-19) ────────────
  //
  // A cart is an alist bundle with a fixed section order:
  //   :meta :palette :sprites :tiles :sounds :music :code
  // Spec: Spec/CART-TEMPLATE.slat
  //
  // Round-trip identity contract:
  //   (equal? cart (composer/cart-apply cart (composer/cart-emit cart)))
  //
  // A "cart" here is either a plain alist (values arriving from Scheme
  // as [[:key val] [:key val] …]) or a JS object with keys meta/palette/
  // etc. We normalize on the alist form for emit, and accept either for
  // apply.
  def('composer/cart-emit', (cart) => {
    return cartEmit(cart)
  }, 'read')

  def('composer/cart-apply', (cart, template) => {
    return cartApply(cart, template)
  }, 'state-change')

  // (composer/cart-empty) → a fresh, valid-shape empty cart.
  def('composer/cart-empty', () => cartEmpty(), 'read')

  // (composer/save canvas path) → path. Writes the emitted form as text.
  // Sandbox: path must land under cwd() or ~/.motoi/. Anything outside
  // the allowed roots is refused with a clear error (Alfred 2026-07-17).
  def('composer/save', (canvas, path) => {
    const safe = safePath(String(path), { verb: 'composer/save' })
    const form = emitCanvas(canvas)
    const text = formatForm(form)
    try { mkdirSync(dirname(safe), { recursive: true }) } catch { /* soft */ }
    writeFileSync(safe, text + '\n', 'utf8')
    return safe
  }, 'state-change')

  // (composer/load path) → canvas. Reads the file, parses to forms,
  // returns a canvas record populated from a `(composer/canvas ...)`
  // form if present. Otherwise returns an empty canvas.
  //
  // Sandbox: path must land under cwd() or ~/.motoi/. Anything outside
  // refused; symlinked targets refused (Priya P-01 pattern).
  def('composer/load', (path) => {
    const safe = safePath(String(path), {
      verb: 'composer/load',
      mustExist: true,
    })
    const src = readFileSync(safe, 'utf8')
    const forms = parse(src)
    // Find the first (composer/canvas ...) form.
    for (const f of forms) {
      if (Array.isArray(f) && f[0] instanceof Sym && f[0].name === 'composer/canvas') {
        return reconstructCanvasFromForm(f)
      }
    }
    // No canvas declaration — return an empty canvas.
    return makeCanvas({}, forms)
  }, 'read')

  return env
}

// Reconstruct a canvas + children from a saved (composer/canvas ...) form.
function reconstructCanvasFromForm(form) {
  const opts = {}
  // First arg after head might be a (:bind '(...)) list.
  let bodyStart = 1
  if (form.length > 1 && Array.isArray(form[1]) && form[1].length > 0
      && form[1][0] instanceof Sym && form[1][0].name.startsWith(':')) {
    Object.assign(opts, plistToObj(form[1]))
    bodyStart = 2
  }
  const canvas = makeCanvas(opts, form.slice(bodyStart))
  for (let i = bodyStart; i < form.length; i++) {
    const childForm = form[i]
    if (!Array.isArray(childForm) || childForm.length === 0) continue
    const head = childForm[0]
    if (!(head instanceof Sym)) continue
    const kind = head.name
    const child = instantiateWidgetFromForm(kind, childForm)
    if (child) canvas.children.push(child)
  }
  return canvas
}

function instantiateWidgetFromForm(verb, form) {
  // Nested canvas: recurse via reconstructCanvasFromForm. Nested canvases
  // are widgets in their own right (they have a .kind === 'canvas').
  if (verb === 'composer/canvas') {
    return reconstructCanvasFromForm(form)
  }
  const kws = extractKws(form)
  // Unquote any quoted arg values.
  const opts = {}
  for (const [k, v] of Object.entries(kws)) opts[k] = unquote(v)
  const ext = WIDGET_INSTANTIATORS.get(verb)
  if (ext) return ext(opts, form)
  switch (verb) {
    case 'composer/slider':          return makeSlider(opts)
    case 'composer/button':          return makeButton(opts)
    case 'composer/piano-roll':      return makePianoRoll(opts)
    case 'composer/sprite-grid':     return makeSpriteGrid(opts)
    case 'composer/tile-map':        return makeTileMap(opts)
    case 'composer/timeline':        return makeTimeline(opts)
    case 'composer/adsr':            return makeAdsr(opts)
    case 'composer/instrument-picker': return makeInstrumentPicker(opts)
    case 'composer/fx-chain':        return makeFxChain(opts)
    case 'composer/text-field':      return makeTextField(opts)
    case 'composer/toggle':          return makeToggle(opts)
    case 'composer/color-picker':    return makeColorPicker(opts)
    case 'composer/live-code':       return makeLiveCode(opts)
    default: return null
  }
}

// Format a JS form (arrays / Syms / primitives) as Scheme text. Used
// by composer/save to write .slat files.
export function formatForm(f) {
  if (f == null) return '()'
  if (f === true) return '#t'
  if (f === false) return '#f'
  if (typeof f === 'number') return String(f)
  if (typeof f === 'string') return JSON.stringify(f)
  if (f instanceof Sym) return f.name
  if (Array.isArray(f)) return '(' + f.map(formatForm).join(' ') + ')'
  return String(f)
}

// ── mutation helpers exposed for tests / interactive editing ─────────
//
// These are NOT registered as Scheme verbs — the composer surface stays
// at 15 verbs. But tests need programmatic ways to set slider values,
// place notes, paint pixels without a UI. Exported for import.

export function sliderSet(w, value) {
  if (w.kind !== 'slider') return w
  w.state.value = Number(value)
  return w
}

export function pianoRollPlace(w, pitch, at, opts = {}) {
  if (w.kind !== 'piano-roll') return w
  w.state.notes.push({
    pitch: String(nm(pitch)),
    at: Number(at),
    vel: opts.vel != null ? Number(opts.vel) : 0.8,
    dur: opts.dur != null ? Number(opts.dur) : 1,
  })
  return w
}

export function spriteGridSet(w, col, row, val) {
  if (w.kind !== 'sprite-grid') return w
  if (row < 0 || row >= w.opts.h) return w
  if (col < 0 || col >= w.opts.w) return w
  w.state.pixels[row][col] = Number(val)
  return w
}

export function tileMapSet(w, col, row, tileId) {
  if (w.kind !== 'tile-map') return w
  w.state.cells[`${col},${row}`] = Number(tileId)
  return w
}

export function timelinePlace(w, entity, at, value) {
  if (w.kind !== 'timeline') return w
  const atN = Number(at)
  if (!Number.isFinite(atN)) {
    throw new Error(`composer/timeline: :at (${JSON.stringify(at)}) must be a number`)
  }
  const key = String(nm(entity))
  if (!w.state.frames[key]) w.state.frames[key] = []
  const arr = w.state.frames[key]
  // Binary-search insertion — O(log N) find + O(N) splice = O(N) per insert
  // instead of O(N log N) sort per insert (which totals O(N^2 log N)).
  let lo = 0, hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid].at <= atN) lo = mid + 1
    else hi = mid
  }
  arr.splice(lo, 0, { at: atN, value })
  return w
}

export function adsrSet(w, envKey, value) {
  if (w.kind !== 'adsr') return w
  if (['a', 'd', 's', 'r'].includes(envKey)) w.state[envKey] = Number(value)
  return w
}

export function pickerChoose(w, choice) {
  if (w.kind !== 'instrument-picker') return w
  w.state.chosen = String(nm(choice))
  return w
}

export function fxChainAdd(w, fxName, kws = {}) {
  if (w.kind !== 'fx-chain') return w
  w.state.chain.push([String(nm(fxName)), kws])
  return w
}

export function textFieldSet(w, value) {
  if (w.kind !== 'text-field') return w
  w.state.value = String(value)
  return w
}

export function toggleSet(w, value) {
  if (w.kind !== 'toggle') return w
  w.state.value = value === true
  return w
}

export function colorPickerSet(w, value) {
  if (w.kind !== 'color-picker') return w
  w.state.value = value instanceof Sym ? value : String(value)
  return w
}

export default installComposer
