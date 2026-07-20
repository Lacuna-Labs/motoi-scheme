// tui/session.js — Motoi session for the TUI.
//
// Same runtime as `motoi ide` (the web IDE). Same CORE roster.
// Same book/* verbs. Same cpu/*. Same motoi/pair-* + motoi/reading-*.
// The TUI is a new VIEW; the runtime is one.
//
// This module is deliberately a near-copy of src/ide-server.js's
// session helpers — the ide-server exposes them behind HTTP endpoints;
// we call them directly. Shared logic (formatting, book alist→object)
// is duplicated because src/ide-server.js doesn't yet export them as
// standalone helpers; refactoring both onto a shared helpers module is
// a follow-up sweep.

import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from '../src/macro.js'
import { snapshotRegistry } from '../src/verbRegistry.js'
import { getMediaState } from '../lib/media/media.js'

// ── formatting ─────────────────────────────────────────────────────

export function format(v) {
  if (v === undefined) return ''
  if (v === null) return '()'
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (typeof v === 'string') return JSON.stringify(v)
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') return v.name
  if (Array.isArray(v)) return '(' + v.map(format).join(' ') + ')'
  return String(v)
}

function displayFormat(v) {
  if (v === undefined) return ''
  if (v === null) return '()'
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') return v.name
  if (Array.isArray(v)) return '(' + v.map(displayFormat).join(' ') + ')'
  return String(v)
}

// ── alist → JS object (for book/* replies) ──────────────────────────

export function alistToObject(v) {
  if (Array.isArray(v) && v.length > 0
      && Array.isArray(v[0]) && v[0].length === 2
      && v[0][0] && typeof v[0][0] === 'object' && 'name' in v[0][0]
      && String(v[0][0].name).startsWith(':')) {
    const obj = {}
    for (const pair of v) {
      const k = String(pair[0].name).slice(1)
      obj[k] = alistToObject(pair[1])
    }
    return obj
  }
  if (Array.isArray(v)) return v.map(alistToObject)
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') return v.name
  return v
}

function symFor(name) {
  // Reuse the reader's Sym class by parsing.
  return parse(name)[0]
}

// ── session ────────────────────────────────────────────────────────

export class Session {
  constructor(opts = {}) {
    this.fuel = opts.fuel ?? 200000
    this.env = makeCoreEnv({ fuel: { n: this.fuel * 5 } })
    this.captured = ''
    // Route (display …) + (newline) into our captured buffer so eval
    // output ends up in the REPL panel, not the terminal.
    try {
      this.env.define('display', (v) => {
        this.captured += displayFormat(v); return undefined
      }, { perm: 'read' })
      this.env.define('newline', () => { this.captured += '\n'; return undefined }, { perm: 'read' })
    } catch { /* env frozen — swallow */ }
  }

  /** Evaluate a source string; return { ok, value, stdout, error }. */
  evalSource(source) {
    this.captured = ''
    try {
      const forms = parse(source)
      const { forms: expanded } = expandProgram(forms, { fuel: { n: this.fuel } })
      const fuel = { n: this.fuel }
      let result
      for (const f of expanded) result = evaluate(f, this.env, fuel)
      return {
        ok: true,
        value: result === undefined ? '' : format(result),
        stdout: this.captured,
        error: null,
      }
    } catch (e) {
      return {
        ok: false,
        value: '',
        stdout: this.captured,
        error: e.message,
      }
    }
  }

  // ── books ────────────────────────────────────────────────────────

  bookList() {
    try {
      const fn = this.env.get('book/list')
      return fn() || []
    } catch { return [] }
  }

  bookToc(slug = 'code') {
    try {
      const fn = this.env.get('book/toc')
      return fn(symFor(':book'), symFor(slug)) || []
    } catch { return [] }
  }

  bookChapter(slug, n) {
    try {
      // Book of Code has a structured tutor endpoint.
      if (slug === 'code' && typeof this.env.get('book-of-code/chapter') === 'function') {
        const fn = this.env.get('book-of-code/chapter')
        return alistToObject(fn(n))
      }
      const fn = this.env.get('book/read')
      const prose = fn(symFor(':book'), symFor(slug), symFor(':chapter'), n)
      return { prose }
    } catch (e) {
      return { error: e.message }
    }
  }

  // ── CPU ─────────────────────────────────────────────────────────

  cpuDisplay() {
    try {
      const fn = this.env.get('cpu/display')
      return fn()
    } catch (e) { return 'CPU not booted — try (cpu/boot!).' }
  }

  // ── pair-programming shortcuts ──────────────────────────────────

  pairState() {
    try {
      const fn = this.env.get('motoi/pair-state')
      return alistToObject(fn())
    } catch (e) { return { mode: 'off' } }
  }

  setPairMode(mode) {
    const src = mode === 'off'
      ? '(motoi/pair-off!)'
      : `(motoi/pair-set-mode! (quote ${mode}))`
    return this.evalSource(src)
  }

  explain(source) {
    // Simple escape — double-quotes inside the source break the string.
    const safe = String(source).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return this.evalSource(`(motoi/explain-selection "${safe}")`)
  }

  ambientComplete(prefix) {
    const safe = String(prefix).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const r = this.evalSource(`(motoi/ambient-complete "${safe}")`)
    // Parse the returned alist to a list of {name, doc}.
    // The eval returns the formatted-string; instead just call directly.
    try {
      const fn = this.env.get('motoi/ambient-complete')
      const result = fn(prefix)
      if (!Array.isArray(result)) return []
      return result.map((rec) => alistToObject(rec)).map((o) => ({
        name: o.name,
        doc: o.doc,
      }))
    } catch { return [] }
  }

  // ── highlight + bookmark ────────────────────────────────────────

  highlight(text, context = '') {
    try {
      const fn = this.env.get('motoi/highlight!')
      fn(String(text || ''), String(context || ''))
    } catch { /* silent */ }
  }

  // ── verb list (autocomplete backing) ────────────────────────────

  verbNames() {
    return Object.keys(snapshotRegistry()).sort()
  }

  // ── framebuffer snapshot (canvas panel) ─────────────────────────
  //
  // Returns { w, h, pixels, palette } where pixels is a Uint8Array of
  // palette indices and palette is [[r,g,b,a], ...]. When the media
  // singleton hasn't been touched, this still returns a valid empty
  // 80×80 buffer (media.js lazily initializes).
  framebufferSnapshot() {
    try {
      const st = getMediaState()
      if (!st || !st.fb) return null
      const fb = st.fb
      return {
        w: fb.w,
        h: fb.h,
        pixels: fb.pixels,
        palette: fb.palette,
        frame: fb.frame || 0,
      }
    } catch { return null }
  }

  // ── call-stack snapshot (stack panel) ───────────────────────────
  //
  // Returns an array of { name, kind, depth } — deepest first. When
  // motoi/stack isn't installed (or the ledger's empty) this returns [].
  stackFrames() {
    try {
      const fn = this.env.get('motoi/stack')
      if (typeof fn !== 'function') return []
      const raw = fn()
      if (!Array.isArray(raw)) return []
      return raw.map((rec) => alistToObject(rec))
    } catch { return [] }
  }

  stackDepth() {
    try {
      const fn = this.env.get('motoi/stack-depth')
      if (typeof fn !== 'function') return 0
      return fn() | 0
    } catch { return 0 }
  }
}

export default Session
