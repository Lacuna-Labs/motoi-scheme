// http-serve.js — Motoi Composer HTTP host.
//
// Doctrine (Alfred, 2026-07-17): kids should be able to host their carts
// from a local instance so their friends can play. `(http/serve ...)` +
// `(http/stop server)` are the entire user surface. Two endpoint
// families:
//
//   /play/:cart      — public. Serves the cart in a browser shell.
//   /compose/:cart   — permission-gated. Opens the composer view.
//                      `:compose-perm 'local-only` refuses non-local.
//
// Landing page at `/` lists available carts and shows the pink/green/brown
// brand stripes + ASCII tree per memory:motoi-branding-2026-07-17.
//
// Provenance: engineering/COMPOSER-1.1.ENG.slat (Task 4).
//
// SECURITY REVIEW (Priya-style, 2026-07-17):
//   - cart-dir must resolve UNDER the process cwd. Escapes refused.
//   - No shell-out. Only fs.readFileSync + fs.readdirSync inside cart-dir.
//   - Path traversal via encoded ../ or literal ../ → 403.
//   - X-Forwarded-For spoofing: we IGNORE forwarded headers entirely
//     when checking local-only. The permission check reads the raw
//     socket remoteAddress. A remote client cannot lie its way past.
//   - Only GET (and HEAD, per RFC 7231) is supported. Others → 405.
//   - No cart write endpoint. `/compose/:cart` is READ-ONLY delivery of
//     the composer bundle; edits round-trip via WebSocket in a later
//     wave (not this ship).
//
// Priya findings addressed 2026-07-17 (see engineering/PRIYA-COMPOSER-
// AUDIT.ENG.slat for full write-up):
//   P-01 (HIGH, symlink escape): safeCartPathWithSubdir uses lstatSync
//     + openSync(O_NOFOLLOW) and refuses any symlinked component.
//     safeResolveCartDir uses lstatSync + realpathSync equivalence check.
//   P-02 (TOCTOU): file read goes through openSync(O_NOFOLLOW) + fstat
//     so the symlink check + open happen in one syscall, closing the
//     window between existsSync and readFileSync.
//   P-03 (Slowloris): explicit headersTimeout, requestTimeout,
//     keepAliveTimeout, maxConnections on every server.
//   P-04 (double-listen silent failure): server.on('error') attached
//     immediately, error stored on record.error, and wait-until-ready
//     resolves the record when the error is set (returns false only for
//     truly nothing-to-look-at cases).
//   P-05 (listCarts unbounded recursion): depth cap of 2 (matches the
//     original doctrine comment "recursive, one level").
//   P-07 (dot-file cart readable): safeCartPathWithSubdir refuses any
//     segment starting with a dot — aligns read policy with the listing
//     policy in listCarts.
//   P-08 (IPv6 loopback variants): isLocalRequest now recognizes
//     the whole 127.0.0.0/8 range and its IPv4-mapped IPv6 forms.
//   P-09 (HEAD support): HEAD returns 200 with no body wherever GET
//     returns 200.
//
// Zain findings addressed 2026-07-17 (see engineering/ZAIN-CROSS-
// SURFACE-AUDIT.ENG.slat):
//   F1 (tree logo has three sources of truth): consolidated to
//     lib/brand/tree-logo.js; imported here instead of hardcoded.
//   /play/:cart is no longer a raw `<pre>` dump — the cart source is
//     parsed and rendered per-widget as accessible HTML (real inputs,
//     labels, landmarks).
//   Landing / play / compose all wrap primary content in <main>, the
//     navigation in <nav>, and add <header>. Compose textarea gets a
//     real <label for="...">. Anchors gain aria-label and a
//     text-decoration: underline base rule (no color-only meaning).

import { createServer } from 'node:http'
import {
  readdirSync, existsSync,
  lstatSync, realpathSync, openSync, fstatSync, readSync, closeSync,
  constants as fsConstants,
} from 'node:fs'
import { resolve, join, normalize, sep } from 'node:path'
import { isIP } from 'node:net'
import { Sym, sym, parse } from '../../src/reader.js'
import { BRAND_STRIPES, NAMED_COLORS_HTML, NAMED_COLORS_HTML_ORDER } from '../graphics/named-colors-html.js'
import { TREE_LOGO } from '../brand/tree-logo.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── path-safety helpers ────────────────────────────────────────────

// Return an absolute, canonical cart-dir under process.cwd(). Throws
// on escape attempts. Nulls-out `..` and absolute paths that resolve
// outside the cwd tree. P-01 (Priya): refuses symlinked cart-dirs by
// using lstatSync and comparing realpathSync to the resolved path.
function safeResolveCartDir(cartDir) {
  const cwd = process.cwd()
  const abs = resolve(cwd, String(cartDir || 'carts'))
  const cwdNormalized = normalize(cwd + sep)
  const absNormalized = normalize(abs + sep)
  if (!absNormalized.startsWith(cwdNormalized) && absNormalized !== cwdNormalized) {
    throw new Error(`http/serve: cart-dir '${cartDir}' escapes cwd`)
  }
  if (!existsSync(abs)) {
    throw new Error(`http/serve: cart-dir '${abs}' does not exist`)
  }
  // Refuse a symlinked cart-dir up-front — the whole subtree would be
  // suspect and the traversal check would run against the link path
  // not its target.
  const lst = lstatSync(abs)
  if (lst.isSymbolicLink()) {
    throw new Error(`http/serve: cart-dir '${abs}' is a symlink (refused: symlink escape)`)
  }
  if (!lst.isDirectory()) {
    throw new Error(`http/serve: cart-dir '${abs}' is not a directory`)
  }
  // Belt-and-braces: even if none of the intermediate components was a
  // symlink individually, the realpath of the dir must equal the resolve
  // — otherwise an ancestor was a link.
  let real
  try { real = realpathSync(abs) } catch { real = abs }
  if (real !== abs) {
    throw new Error(`http/serve: cart-dir '${abs}' resolves via symlink to '${real}' (refused: symlink escape)`)
  }
  return abs
}

// Given a cart name (e.g. "synth-patch"), return the absolute path
// to the cart file if it exists safely inside cartDir. Otherwise null.
// Rejects any input containing path separators, "..", or null bytes.
//
// DEAD CODE (kept for _internal test surface) — the request handler
// uses safeCartPathWithSubdir. Refuses '.' / '..' / dot-prefixed
// / consecutive-dots to align with the live helper (P-06).
function safeCartPath(cartDir, cartName) {
  if (typeof cartName !== 'string') return null
  if (cartName.length === 0 || cartName.length > 128) return null
  if (cartName === '.' || cartName === '..') return null
  if (cartName.startsWith('.')) return null
  if (cartName.includes('..')) return null
  if (!/^[A-Za-z0-9._-]+$/.test(cartName)) return null
  for (const ext of ['.slat', '.sks']) {
    const candidate = join(cartDir, cartName + (cartName.endsWith(ext) ? '' : ext))
    const resolved = resolve(candidate)
    const cartDirNormalized = normalize(cartDir + sep)
    const resolvedNormalized = normalize(resolved)
    if (!resolvedNormalized.startsWith(cartDirNormalized)) continue
    if (existsSync(resolved)) return resolved
  }
  return null
}

// Also allow a subdirectory cart (e.g. "composer/synth-patch"). Segments
// must each pass the /[A-Za-z0-9._-]+/ regex, and must not start with a
// dot (P-07 alignment with listing policy).
//
// Symlink handling (P-01): resolves via lstatSync; refuses any final
// component that is a symbolic link. Callers should open with O_NOFOLLOW
// (see readCartFile below) to close the TOCTOU window (P-02).
function safeCartPathWithSubdir(cartDir, cartName) {
  if (typeof cartName !== 'string') return null
  if (cartName.length === 0 || cartName.length > 256) return null
  const parts = cartName.split('/')
  if (parts.length > 4) return null
  for (const p of parts) {
    if (p.length === 0 || p.length > 128) return null
    if (p === '.' || p === '..') return null
    if (p.startsWith('.')) return null           // P-07: no dot-prefixed cart names
    if (p.includes('..')) return null            // P-06: no consecutive dots (foo..bar)
    if (!/^[A-Za-z0-9._-]+$/.test(p)) return null
  }
  const base = join(cartDir, ...parts)
  for (const ext of ['', '.slat', '.sks']) {
    const candidate = ext === '' ? base : base + ext
    const resolved = resolve(candidate)
    const cartDirNormalized = normalize(cartDir + sep)
    const resolvedNormalized = normalize(resolved)
    if (!resolvedNormalized.startsWith(cartDirNormalized)) continue
    if (!existsSync(resolved)) continue
    // P-01: lstat, refuse symlinks. Ancestor-symlink check via realpath.
    let lst
    try { lst = lstatSync(resolved) } catch { continue }
    if (lst.isSymbolicLink()) return null
    if (!lst.isFile()) continue
    let real
    try { real = realpathSync(resolved) } catch { real = resolved }
    if (real !== resolved) return null  // some ancestor was a symlink
    return resolved
  }
  return null
}

// Open + read a resolved cart path atomically w.r.t. symlink swaps.
// Uses O_NOFOLLOW on platforms that expose it (POSIX); on Windows,
// falls back to a re-check via lstat after open. Returns the file
// contents as a string, or null if the atomic check fails.
function readCartFile(resolvedPath) {
  const O_NOFOLLOW = fsConstants.O_NOFOLLOW
  let fd
  try {
    if (O_NOFOLLOW != null) {
      fd = openSync(resolvedPath, fsConstants.O_RDONLY | O_NOFOLLOW)
    } else {
      fd = openSync(resolvedPath, fsConstants.O_RDONLY)
      const lst2 = lstatSync(resolvedPath)
      if (lst2.isSymbolicLink()) { closeSync(fd); return null }
    }
    // Confirm it's still a regular file at open-time (P-02: TOCTOU).
    const st = fstatSync(fd)
    if (!st.isFile()) { closeSync(fd); return null }
    // Reasonable cap on cart size — 4 MiB. Beyond that something's up.
    if (st.size > 4 * 1024 * 1024) { closeSync(fd); return null }
    const buf = Buffer.allocUnsafe(st.size)
    let bytesTotal = 0
    while (bytesTotal < st.size) {
      const chunk = readSync(fd, buf, bytesTotal, st.size - bytesTotal, null)
      if (chunk === 0) break
      bytesTotal += chunk
    }
    closeSync(fd)
    return buf.subarray(0, bytesTotal).toString('utf8')
  } catch {
    if (fd != null) { try { closeSync(fd) } catch { /* ignore */ } }
    return null
  }
}

// Look up all carts inside cartDir. Depth cap of 2 per P-05 doctrine
// (matches the original comment "recursive, one level"). Dotfiles hidden.
// Symlinks are Dirent.isFile() = false so they never appear in the list.
const LIST_DEPTH_CAP = 2
function listCarts(cartDir) {
  const out = []
  const walk = (dir, prefix, depth) => {
    if (depth > LIST_DEPTH_CAP) return
    let ents
    try { ents = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const ent of ents) {
      if (ent.name.startsWith('.')) continue
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name
      if (ent.isDirectory()) {
        walk(join(dir, ent.name), rel, depth + 1)
      } else if (ent.isFile() && (ent.name.endsWith('.slat') || ent.name.endsWith('.sks'))) {
        const bareName = rel.replace(/\.(slat|sks)$/, '')
        out.push({ name: bareName, path: join(dir, ent.name) })
      }
    }
  }
  walk(cartDir, '', 0)
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

// ── request-origin classification ───────────────────────────────────
//
// The only trusted signal for "is this request local?" is req.socket's
// remoteAddress. We DELIBERATELY IGNORE X-Forwarded-For and any other
// client-supplied header — a spoofed header from a remote client would
// otherwise let it pretend to be local.
//
// P-08: accept the entire 127.0.0.0/8 range plus IPv6-mapped v4 for the
// same range. RFC 3330 says the whole /8 is loopback; on some OS
// configurations the OS uses e.g. 127.0.0.2 for extra loopback aliases.

function isLocalRequest(req) {
  const rawAddr = req && req.socket && req.socket.remoteAddress
  if (rawAddr == null) return false
  const addr = String(rawAddr)
  if (addr.length === 0) return false
  if (addr === '::1') return true
  // IPv4 or IPv4-mapped-v6.
  let v4 = null
  const family = isIP(addr)
  if (family === 4) v4 = addr
  else if (family === 6) {
    // ::ffff:127.0.0.1 form.
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(addr)
    if (m) v4 = m[1]
  }
  if (!v4) return false
  const parts = v4.split('.').map((n) => Number(n))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  return parts[0] === 127
}

// ── HTML responses (branded) ────────────────────────────────────────

// Shared CSS block used by all pages. Palette references
// `site/.vitepress/theme/palette.css` CSS custom props by literal value
// (this file is served standalone, so we inline the swatches). Base
// anchor rule uses text-decoration: underline so link-ness isn't
// color-only (Zain a11y F6).
function pageStyles() {
  return `
  :root {
    --motoi-pink: ${NAMED_COLORS_HTML.pink};
    --motoi-green: ${NAMED_COLORS_HTML.mediumseagreen};
    --motoi-brown: ${NAMED_COLORS_HTML.saddlebrown};
    --motoi-crimson: ${NAMED_COLORS_HTML.crimson};
    --motoi-forestgreen: ${NAMED_COLORS_HTML.forestgreen};
    --motoi-peachpuff: ${NAMED_COLORS_HTML.peachpuff};
    --motoi-gold: ${NAMED_COLORS_HTML.gold};
    --motoi-coral: ${NAMED_COLORS_HTML.coral};
    --motoi-plum: ${NAMED_COLORS_HTML.plum};
    --motoi-teal: ${NAMED_COLORS_HTML.teal};
    --motoi-sienna: ${NAMED_COLORS_HTML.sienna};
    --motoi-skyblue: ${NAMED_COLORS_HTML.skyblue};
    --motoi-mediumseagreen: ${NAMED_COLORS_HTML.mediumseagreen};
    --motoi-saddlebrown: ${NAMED_COLORS_HTML.saddlebrown};
    --motoi-slategray: ${NAMED_COLORS_HTML.slategray};
    --motoi-navy: ${NAMED_COLORS_HTML.navy};
    --motoi-black: ${NAMED_COLORS_HTML.black};
    --motoi-white: ${NAMED_COLORS_HTML.white};
  }
  body { font-family: ui-monospace, monospace; background: #fdfaf5; color: #222; padding: 24px; max-width: 900px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 24px; }
  pre.logo { color: var(--motoi-brown); font-size: 14px; line-height: 1.1; margin: 0; }
  h1 { margin: 0; color: var(--motoi-green); font-size: 22px; letter-spacing: 2px; }
  h2 { margin-top: 32px; color: var(--motoi-brown); }
  .stripes { margin: 16px 0 24px 0; }
  .stripe { height: 14px; margin: 3px 0; border-radius: 6px; }
  main { display: block; }
  nav { display: block; }
  ul { list-style: none; padding: 0; }
  li { padding: 8px 12px; background: white; border-radius: 6px; margin: 6px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  /* Base rule: links carry an underline so link-ness isn't color-only. */
  a { text-decoration: underline; text-underline-offset: 0.15em; color: var(--motoi-pink); font-weight: 600; }
  a:hover { text-decoration-thickness: 2px; }
  footer { margin-top: 32px; color: #888; font-size: 12px; }
  /* Widget card */
  .widget { background: white; padding: 12px 16px; margin: 12px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .widget label { display: block; font-weight: 600; margin-bottom: 4px; color: var(--motoi-brown); }
  .widget .value { display: inline-block; margin-left: 8px; color: var(--motoi-slategray); font-variant-numeric: tabular-nums; }
  .widget input[type=range] { width: 60%; vertical-align: middle; }
  .widget input[type=text] { width: 60%; padding: 4px 6px; font-family: inherit; border: 1px solid var(--motoi-slategray); border-radius: 4px; }
  .widget button { padding: 6px 16px; background: var(--motoi-mediumseagreen); color: white; border: 0; border-radius: 4px; font-family: inherit; cursor: pointer; }
  .widget button:focus { outline: 2px solid var(--motoi-gold); outline-offset: 2px; }
  .piano-roll { display: grid; gap: 1px; background: var(--motoi-slategray); border: 1px solid var(--motoi-slategray); border-radius: 4px; overflow: hidden; }
  .piano-roll .cell { background: white; min-width: 12px; min-height: 12px; }
  .piano-roll .cell.on { background: var(--motoi-gold); }
  .sprite-grid { display: grid; gap: 0; border: 1px solid var(--motoi-slategray); border-radius: 4px; overflow: hidden; }
  .sprite-grid .px { min-width: 12px; min-height: 12px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 4px; }
  .swatch { display: inline-block; width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--motoi-slategray); position: relative; }
  .swatch.selected { outline: 2px solid var(--motoi-brown); outline-offset: 2px; }
  .raw-source { background: #f5f0e8; color: #444; padding: 12px; border-radius: 6px; overflow: auto; max-height: 40vh; font-size: 12px; }
  `
}

function stripesBlock() {
  return `<div class="stripes" aria-hidden="true">
  <div class="stripe" style="background:${NAMED_COLORS_HTML.pink}"></div>
  <div class="stripe" style="background:${NAMED_COLORS_HTML.mediumseagreen}"></div>
  <div class="stripe" style="background:${NAMED_COLORS_HTML.saddlebrown}"></div>
</div>`
}

function brandHeader() {
  return `<header>
  <pre class="logo" aria-hidden="true">${escapeHtml(TREE_LOGO)}</pre>
  <h1>MOTOI SCHEME</h1>
</header>`
}

function landingHtml(cartList) {
  const items = cartList.map((c) =>
    `<li><a href="/play/${encodeURIComponent(c.name)}" aria-label="Play ${escapeHtml(c.name)}">${escapeHtml(c.name)}</a>` +
    ` <span aria-hidden="true" style="color:${BRAND_STRIPES.brown}">·</span>` +
    ` <a href="/compose/${encodeURIComponent(c.name)}" aria-label="Open ${escapeHtml(c.name)} in the composer" style="color:${BRAND_STRIPES.green}">compose</a></li>`
  ).join('\n')
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motoi Scheme — carts</title>
<style>${pageStyles()}</style>
</head>
<body>
${brandHeader()}
${stripesBlock()}
<main>
<h2>Your carts</h2>
<nav aria-label="Available carts">
<ul>
${items || '<li>(no carts yet — drop a .slat file in the carts/ folder)</li>'}
</ul>
</nav>
</main>
<footer>motoi-scheme composer host · pink/green/brown · ${cartList.length} cart${cartList.length === 1 ? '' : 's'}</footer>
</body></html>
`
}

// ── widget-shape → HTML ────────────────────────────────────────────
//
// Parse the cart source via the reader (S-expressions only, no
// evaluation). Walk the top-level forms; for each `(composer/canvas
// ...)` form found, render its children as accessible HTML widgets.
// This is a STATIC preview — inputs are non-functional (round-trip
// wire lands in a later wave); their role is to render the same
// canvas the TUI does, with proper HTML semantics.

// Pull keyword args (:foo bar) out of a form-tail. Returns a plain
// object mapping name-without-colon to raw value (still an S-expr
// datum).
function argsToPlist(tail) {
  const out = {}
  for (let i = 0; i < tail.length; i++) {
    const a = tail[i]
    if (a instanceof Sym && a.name.startsWith(':') && i + 1 < tail.length) {
      out[a.name.slice(1)] = tail[i + 1]
      i++
    }
  }
  return out
}

// Best-effort scalar conversion of a reader datum for display.
function toDisplay(v) {
  if (v == null) return ''
  if (v instanceof Sym) return v.name.startsWith(':') ? v.name.slice(1) : v.name
  if (Array.isArray(v)) {
    // Handle (quote foo) → foo.
    if (v.length === 2 && v[0] instanceof Sym && v[0].name === 'quote') return toDisplay(v[1])
    return v.map(toDisplay).join(' ')
  }
  return String(v)
}

function toNumber(v, dflt) {
  if (v == null) return dflt
  const n = Number(v instanceof Sym ? v.name : v)
  return Number.isFinite(n) ? n : dflt
}

function slugFromBind(bind) {
  // bind is often (quote (foo :bar)).
  const disp = toDisplay(bind).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return disp || 'widget'
}

function widgetIdFor(kind, opts, idx) {
  const b = opts.bind ? slugFromBind(opts.bind) : `w${idx}`
  return `motoi-${kind}-${b}-${idx}`
}

function widgetLabel(kind, opts) {
  return escapeHtml(toDisplay(opts.label) || toDisplay(opts.bind) || kind)
}

// Individual widget renderers. Each returns an HTML string (an
// article-shaped block; caller wraps in a <section> if needed).
function renderSliderHtml(opts, id) {
  const label = widgetLabel('slider', opts)
  const min = toNumber(opts.min, 0)
  const max = toNumber(opts.max, 1)
  const step = toNumber(opts.step, 0.01)
  const value = toNumber(opts.value, (min + max) / 2)
  return `<div class="widget" role="group">
  <label for="${id}">${label}</label>
  <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-valuenow="${value}" aria-valuemin="${min}" aria-valuemax="${max}">
  <span class="value" aria-live="polite">${value}</span>
</div>`
}

function renderButtonHtml(opts, id) {
  const label = widgetLabel('button', opts)
  return `<div class="widget">
  <button id="${id}" type="button">${label}</button>
</div>`
}

function renderTextFieldHtml(opts, id) {
  const label = widgetLabel('text-field', opts)
  const value = escapeHtml(toDisplay(opts.value))
  return `<div class="widget">
  <label for="${id}">${label}</label>
  <input id="${id}" type="text" value="${value}">
</div>`
}

function renderToggleHtml(opts, id) {
  const label = widgetLabel('toggle', opts)
  const value = toDisplay(opts.value)
  const checked = (value === '#t' || value === 'true' || value === '1') ? ' checked' : ''
  return `<div class="widget">
  <input id="${id}" type="checkbox" role="switch"${checked}>
  <label for="${id}" style="display:inline">${label}</label>
</div>`
}

function renderColorPickerHtml(opts, id) {
  const label = widgetLabel('color-picker', opts)
  const value = toDisplay(opts.value) || 'black'
  const palette = toDisplay(opts.palette)
  const useHtml16 = palette === 'html-16'
  if (useHtml16) {
    const swatches = NAMED_COLORS_HTML_ORDER.map((name) => {
      const hex = NAMED_COLORS_HTML[name]
      const selected = name === value ? ' selected' : ''
      const ariaSelected = name === value ? ' aria-selected="true"' : ' aria-selected="false"'
      return `<button type="button" class="swatch${selected}" role="option" aria-label="${escapeHtml(name)}"${ariaSelected} style="background:${hex}"></button>`
    }).join('')
    return `<div class="widget">
  <label id="${id}-label">${label}: <span class="value">${escapeHtml(value)}</span></label>
  <div class="swatches" role="listbox" aria-labelledby="${id}-label">${swatches}</div>
</div>`
  }
  // Generic fallback — native color input.
  const hex = NAMED_COLORS_HTML[value] || '#000000'
  return `<div class="widget">
  <label for="${id}">${label}</label>
  <input id="${id}" type="color" value="${hex}">
  <span class="value">${escapeHtml(value)}</span>
</div>`
}

function renderInstrumentPickerHtml(opts, id) {
  const label = widgetLabel('instrument-picker', opts)
  const choicesRaw = opts.choices
  const choices = Array.isArray(choicesRaw)
    ? choicesRaw.map(toDisplay)
    : (choicesRaw && choicesRaw[0] instanceof Sym && choicesRaw[0].name === 'quote'
       ? (Array.isArray(choicesRaw[1]) ? choicesRaw[1].map(toDisplay) : [])
       : [])
  const chosen = toDisplay(opts.chosen)
  const opts_html = choices
    .map((c) => `<option value="${escapeHtml(c)}"${c === chosen ? ' selected' : ''}>${escapeHtml(c)}</option>`)
    .join('')
  return `<div class="widget">
  <label for="${id}">${label}</label>
  <select id="${id}">${opts_html}</select>
</div>`
}

function renderPianoRollHtml(opts, id) {
  const label = widgetLabel('piano-roll', opts)
  const steps = Math.max(1, Math.min(64, toNumber(opts.steps, 16)))
  // Static preview: 12 rows × N cols, all empty.
  const rows = []
  const pitches = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C']
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < steps; c++) {
      rows.push(`<div class="cell" role="gridcell" aria-label="${escapeHtml(pitches[r])} step ${c + 1}, off"></div>`)
    }
  }
  return `<div class="widget">
  <label id="${id}-label">${label}</label>
  <div id="${id}" class="piano-roll" role="grid" aria-labelledby="${id}-label" style="grid-template-columns: repeat(${steps}, 1fr);">${rows.join('')}</div>
</div>`
}

function renderSpriteGridHtml(opts, id) {
  const label = widgetLabel('sprite-grid', opts)
  let w = 8, h = 8
  const sz = opts.size
  if (Array.isArray(sz)) {
    if (sz.length === 2 && sz[0] instanceof Sym && sz[0].name === 'quote' && Array.isArray(sz[1])) {
      w = toNumber(sz[1][0], 8); h = toNumber(sz[1][1], 8)
    } else if (sz.length >= 2) {
      w = toNumber(sz[0], 8); h = toNumber(sz[1], 8)
    }
  }
  w = Math.max(1, Math.min(64, w)); h = Math.max(1, Math.min(64, h))
  const cells = []
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      cells.push(`<div class="px" role="gridcell" aria-label="Pixel ${c + 1}, ${r + 1}" style="background:${NAMED_COLORS_HTML.white}"></div>`)
    }
  }
  return `<div class="widget">
  <label id="${id}-label">${label} (${w}×${h})</label>
  <div id="${id}" class="sprite-grid" role="grid" aria-labelledby="${id}-label" style="grid-template-columns: repeat(${w}, 1fr); width: ${w * 14}px;">${cells.join('')}</div>
</div>`
}

function renderTileMapHtml(opts, id) {
  const label = widgetLabel('tile-map', opts)
  const cols = Math.max(1, Math.min(64, toNumber(opts.cols, 16)))
  const rows = Math.max(1, Math.min(64, toNumber(opts.rows, 16)))
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(`<div class="px" role="gridcell" aria-label="Tile ${c + 1}, ${r + 1}" style="background:${NAMED_COLORS_HTML.white}"></div>`)
    }
  }
  return `<div class="widget">
  <label id="${id}-label">${label} (${cols}×${rows})</label>
  <div id="${id}" class="sprite-grid" role="grid" aria-labelledby="${id}-label" style="grid-template-columns: repeat(${cols}, 1fr);">${cells.join('')}</div>
</div>`
}

function renderAdsrHtml(opts, id) {
  const label = widgetLabel('adsr', opts)
  return `<div class="widget" role="group" aria-label="${label}">
  <label>${label}</label>
  <span class="value">a=${escapeHtml(toDisplay(opts.a) || '0')} d=${escapeHtml(toDisplay(opts.d) || '0')} s=${escapeHtml(toDisplay(opts.s) || '0')} r=${escapeHtml(toDisplay(opts.r) || '0')}</span>
</div>`
}

// Generic pretty fallback for widget kinds we don't know how to render.
function renderGenericWidgetHtml(kind, opts) {
  const label = widgetLabel(kind, opts)
  const pretty = Object.entries(opts)
    .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(toDisplay(v))}`)
    .join('\n  ')
  return `<div class="widget">
  <label>${label} <span class="value">(${escapeHtml(kind)})</span></label>
  <pre class="raw-source">${escapeHtml(pretty)}</pre>
</div>`
}

// Kind of widget → HTML renderer.
const WIDGET_KIND_TO_HTML = {
  'composer/slider':            renderSliderHtml,
  'composer/button':            renderButtonHtml,
  'composer/text-field':        renderTextFieldHtml,
  'composer/toggle':            renderToggleHtml,
  'composer/color-picker':      renderColorPickerHtml,
  'composer/instrument-picker': renderInstrumentPickerHtml,
  'composer/piano-roll':        renderPianoRollHtml,
  'composer/sprite-grid':       renderSpriteGridHtml,
  'composer/tile-map':          renderTileMapHtml,
  'composer/adsr':              renderAdsrHtml,
}

// Given a widget form like `(composer/slider :label "Attack" ...)`,
// return an HTML string. Unknown kinds fall through to the generic
// pretty renderer.
function renderWidgetFormHtml(form, idx) {
  if (!Array.isArray(form) || form.length === 0 || !(form[0] instanceof Sym)) return null
  const kind = form[0].name
  const opts = argsToPlist(form.slice(1))
  const shortKind = kind.startsWith('composer/') ? kind.slice('composer/'.length) : kind
  const id = widgetIdFor(shortKind, opts, idx)
  const renderer = WIDGET_KIND_TO_HTML[kind]
  if (renderer) return renderer(opts, id)
  // Unknown widget or a non-widget form (like define) — skip silently.
  if (!kind.startsWith('composer/')) return null
  return renderGenericWidgetHtml(kind, opts)
}

// Walk the parsed cart forms and extract widget forms. We look at every
// `(composer/canvas ...)` (which may itself hold a widget as a body item)
// AND at any top-level `(composer/<kind> ...)` form. We also unwrap the
// common `(define <name> (composer/canvas ...))` idiom.
function extractCanvasesAndWidgets(topLevelForms) {
  const canvases = [] // [{ bind: displayName, widgets: [ formArray ] }]
  const visit = (form) => {
    if (!Array.isArray(form) || form.length === 0) return
    const head = form[0]
    if (!(head instanceof Sym)) return
    if (head.name === 'define' && form.length >= 3) {
      visit(form[2])
      return
    }
    if (head.name === 'composer/canvas') {
      // First arg is often (list :bind '(...)) or an interleaved plist.
      // Rest are widget children.
      let bindLabel = ''
      const tail = form.slice(1)
      const children = []
      for (let i = 0; i < tail.length; i++) {
        const a = tail[i]
        if (Array.isArray(a) && a[0] instanceof Sym && a[0].name === 'list') {
          const inner = argsToPlist(a.slice(1))
          if (inner.bind) bindLabel = toDisplay(inner.bind)
          continue
        }
        if (a instanceof Sym && a.name.startsWith(':') && i + 1 < tail.length) {
          if (a.name === ':bind') bindLabel = toDisplay(tail[i + 1])
          i++
          continue
        }
        if (Array.isArray(a) && a[0] instanceof Sym && a[0].name.startsWith('composer/')) {
          children.push(a)
        }
      }
      canvases.push({ bind: bindLabel, widgets: children })
      return
    }
    // Top-level bare widget → single-canvas view.
    if (head.name.startsWith('composer/')) {
      canvases.push({ bind: '', widgets: [form] })
    }
  }
  for (const f of topLevelForms) visit(f)
  return canvases
}

// Render the whole /play/:cart page.
function playShellHtml(cartName, cartSrc) {
  let canvases = []
  let parseErr = null
  try {
    const forms = parse(cartSrc)
    canvases = extractCanvasesAndWidgets(forms)
  } catch (e) {
    parseErr = String(e && e.message ? e.message : e)
  }

  let widgetBlocks
  if (parseErr) {
    widgetBlocks = `<p><em>Could not parse cart source:</em> ${escapeHtml(parseErr)}</p>`
  } else if (canvases.length === 0) {
    widgetBlocks = `<p><em>This cart contains no composer widgets. Source shown below.</em></p>`
  } else {
    let idx = 0
    widgetBlocks = canvases.map((cv, ci) => {
      const bindLabel = cv.bind ? `canvas ${escapeHtml(cv.bind)}` : `canvas ${ci + 1}`
      const widgetsHtml = cv.widgets.map((w) => renderWidgetFormHtml(w, idx++)).filter(Boolean).join('\n')
      return `<section aria-label="${bindLabel}">
  <h3>${bindLabel}</h3>
  ${widgetsHtml || '<p><em>(no widgets in this canvas)</em></p>'}
</section>`
    }).join('\n')
  }

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(cartName)} — motoi cart</title>
<style>${pageStyles()}</style>
</head>
<body>
${brandHeader()}
${stripesBlock()}
<nav aria-label="Cart navigation">
  <p><a href="/" aria-label="Back to cart list">← back to carts</a> · <a href="/compose/${encodeURIComponent(cartName)}" aria-label="Open ${escapeHtml(cartName)} in the composer">compose</a></p>
</nav>
<main>
<h2>▶ ${escapeHtml(cartName)}</h2>
<p><em>Static preview — the round-trip wire lands in the next wave.</em></p>
${widgetBlocks}
<h3>Source</h3>
<pre class="raw-source" tabindex="0" role="region" aria-label="Cart source: ${escapeHtml(cartName)}">${escapeHtml(cartSrc)}</pre>
</main>
</body></html>
`
}

function composeShellHtml(cartName, cartSrc) {
  const textareaId = 'motoi-compose-source'
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>compose ${escapeHtml(cartName)}</title>
<style>${pageStyles()}
  textarea { width: 100%; height: 60vh; font-family: ui-monospace, monospace; font-size: 13px; padding: 12px; border: 2px solid var(--motoi-brown); border-radius: 6px; background: #fff; box-sizing: border-box; }
  .note { color: var(--motoi-brown); font-size: 12px; }
</style>
</head>
<body>
${brandHeader()}
${stripesBlock()}
<nav aria-label="Cart navigation">
  <p><a href="/" aria-label="Back to cart list">← back to carts</a> · <a href="/play/${encodeURIComponent(cartName)}" aria-label="Play ${escapeHtml(cartName)}">play</a></p>
</nav>
<main>
<h2>compose · ${escapeHtml(cartName)}</h2>
<p class="note">local-only editor. edits do not persist yet (round-trip wire lands in the next wave).</p>
<label for="${textareaId}">Cart source (read-only preview)</label>
<textarea id="${textareaId}" readonly aria-readonly="true">${escapeHtml(cartSrc)}</textarea>
</main>
</body></html>
`
}

function forbiddenHtml(reason) {
  return `<!doctype html>
<html lang="en"><body style="font-family:monospace;padding:32px">
<main>
<h1>403 · forbidden</h1>
<p>${escapeHtml(reason)}</p>
</main>
</body></html>
`
}

function notFoundHtml(what) {
  return `<!doctype html>
<html lang="en"><body style="font-family:monospace;padding:32px">
<main>
<h1>404 · not found</h1>
<p>${escapeHtml(what)}</p>
<p><a href="/">home</a></p>
</main>
</body></html>
`
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── request handler ────────────────────────────────────────────────

function makeHandler(config) {
  const { cartDir, composePerm } = config
  return (req, res) => {
    // GET and HEAD only (P-09).
    const method = req.method
    const isHead = method === 'HEAD'
    if (method !== 'GET' && !isHead) {
      res.statusCode = 405
      res.setHeader('content-type', 'text/plain')
      res.end('method not allowed')
      return
    }
    // Reject requests whose URL contains a null byte or literal "../".
    // (These would be normalized away by URL parsing but sanity-checking
    // the raw url tightens the surface.)
    if (typeof req.url !== 'string' || req.url.includes('\0') || req.url.includes('..')) {
      res.statusCode = 403
      res.setHeader('content-type', 'text/html')
      const body = forbiddenHtml('bad url')
      res.end(isHead ? '' : body)
      return
    }
    let parsed
    try { parsed = new URL(req.url, 'http://localhost') } catch {
      res.statusCode = 400
      res.end(isHead ? '' : 'bad url')
      return
    }
    const pathname = parsed.pathname
    // P-10: hard cap on path length.
    if (pathname.length > 512) {
      res.statusCode = 414
      res.end(isHead ? '' : 'uri too long')
      return
    }

    // Small helper — write body OR just headers for HEAD.
    const writeBody = (body) => { res.end(isHead ? '' : body) }

    // Landing page.
    if (pathname === '/' || pathname === '') {
      const list = listCarts(cartDir)
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      writeBody(landingHtml(list))
      return
    }

    // /play/:cart
    if (pathname.startsWith('/play/')) {
      const raw = pathname.slice('/play/'.length)
      let cartName
      try { cartName = decodeURIComponent(raw) } catch {
        res.statusCode = 400
        res.setHeader('content-type', 'text/plain')
        writeBody('bad cart name')
        return
      }
      const p = safeCartPathWithSubdir(cartDir, cartName)
      if (!p) {
        res.statusCode = 404
        res.setHeader('content-type', 'text/html')
        writeBody(notFoundHtml(`no cart named "${cartName}"`))
        return
      }
      const src = readCartFile(p)
      if (src == null) {
        res.statusCode = 404
        res.setHeader('content-type', 'text/html')
        writeBody(notFoundHtml(`cart "${cartName}" could not be read`))
        return
      }
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      writeBody(playShellHtml(cartName, src))
      return
    }

    // /compose/:cart — permission-gated.
    if (pathname.startsWith('/compose/')) {
      if (composePerm === 'local-only' && !isLocalRequest(req)) {
        res.statusCode = 403
        res.setHeader('content-type', 'text/html')
        writeBody(forbiddenHtml('compose is local-only; this request came from off-host'))
        return
      }
      const raw = pathname.slice('/compose/'.length)
      let cartName
      try { cartName = decodeURIComponent(raw) } catch {
        res.statusCode = 400
        res.setHeader('content-type', 'text/plain')
        writeBody('bad cart name')
        return
      }
      const p = safeCartPathWithSubdir(cartDir, cartName)
      if (!p) {
        res.statusCode = 404
        res.setHeader('content-type', 'text/html')
        writeBody(notFoundHtml(`no cart named "${cartName}"`))
        return
      }
      const src = readCartFile(p)
      if (src == null) {
        res.statusCode = 404
        res.setHeader('content-type', 'text/html')
        writeBody(notFoundHtml(`cart "${cartName}" could not be read`))
        return
      }
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      writeBody(composeShellHtml(cartName, src))
      return
    }

    // Fallthrough.
    res.statusCode = 404
    res.setHeader('content-type', 'text/html')
    writeBody(notFoundHtml(pathname))
  }
}

// ── the installer ──────────────────────────────────────────────────

// Started servers, keyed by an integer id, so http/stop can find them.
let serverIdSeq = 1
const _servers = new Map()

// P-03: Slowloris-mitigating server timeouts. Kids' friends don't need
// long-poll HTTP. Kept strictly under 30s so a hostile client can't
// pin sockets open for a full minute.
const HEADERS_TIMEOUT_MS   = 10_000   // 10s
const REQUEST_TIMEOUT_MS   = 20_000   // 20s
const KEEP_ALIVE_TIMEOUT_MS =  5_000  // 5s
const MAX_CONNECTIONS      = 200      // one classroom's worth

export function installHttpServe(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (http/serve :port 8080 :cart-dir "carts/" :compose-perm 'local-only)
  //   → server-record ((:id N) (:port P) (:cart-dir D) (:compose-perm 'local-only))
  def('http/serve', (...args) => {
    const opts = plistToObj(args)
    const port = Number(opts.port ?? 0)
    const cartDirRaw = opts['cart-dir'] != null ? String(nm(opts['cart-dir'])) : 'carts'
    const composePerm = opts['compose-perm'] != null ? String(nm(opts['compose-perm'])) : 'local-only'
    const cartDir = safeResolveCartDir(cartDirRaw)
    const server = createServer(makeHandler({ cartDir, composePerm }))
    // P-03: explicit timeouts.
    server.headersTimeout = HEADERS_TIMEOUT_MS
    server.requestTimeout = REQUEST_TIMEOUT_MS
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS
    server.maxConnections = MAX_CONNECTIONS
    const id = serverIdSeq++
    // Build record NOW so the error handler can populate it.
    const record = {
      id, server, cartDir, composePerm,
      port: port, // desired; actual port is server.address().port after listen
      error: null,
    }
    // P-04: attach error listener BEFORE calling listen so an
    // EADDRINUSE lands in record.error rather than crashing the process.
    server.on('error', (e) => {
      record.error = {
        code: e && e.code ? e.code : null,
        message: e && e.message ? e.message : String(e),
      }
      _servers.delete(id)
    })
    _servers.set(id, server)
    // listen is async; callers await http/wait-until-ready to get the
    // bound port (or the error).
    server.listen(port)
    return record
  }, 'network')

  // (http/wait-until-ready server [timeout-ms])  → server-record with bound port,
  //   OR the record if it carries an error, OR false if we truly time out.
  def('http/wait-until-ready', async (record, timeoutMs) => {
    if (!record || !record.server) return false
    const t = Number(timeoutMs ?? 2000)
    const start = Date.now()
    return await new Promise((resolveP) => {
      const check = () => {
        // P-04: surface bind errors immediately.
        if (record.error) {
          resolveP(record)
          return
        }
        const addr = record.server.address()
        if (addr && addr.port) {
          record.port = addr.port
          resolveP(record)
          return
        }
        if (Date.now() - start > t) {
          // Nothing bound and no error captured — this is genuinely
          // "timed out waiting for listen()". Return false. Callers
          // that also want the error record can inspect record.error.
          if (record.error) resolveP(record)
          else resolveP(false)
          return
        }
        setTimeout(check, 20)
      }
      check()
    })
  }, 'network')

  // (http/stop server) → #t.
  def('http/stop', (record) => {
    if (!record || !record.server) return false
    try { record.server.close() } catch { /* ignore */ }
    _servers.delete(record.id)
    return true
  }, 'network')

  // Introspection.
  def('http/serve-info', (record) => {
    if (!record) return false
    return [
      [sym(':id'), record.id],
      [sym(':port'), record.port],
      [sym(':cart-dir'), record.cartDir],
      [sym(':compose-perm'), sym(record.composePerm)],
      [sym(':error'), record.error ? record.error.message : false],
    ]
  }, 'read')

  return env
}

// Plist helper — mirrors the pattern in composer.js.
function plistToObj(args) {
  const out = {}
  let i = 0
  while (i < args.length) {
    const a = args[i]
    const name = a instanceof Sym ? a.name : null
    if (name && name.startsWith(':')) {
      if (i + 1 >= args.length) break
      out[name.slice(1)] = args[i + 1]
      i += 2
    } else {
      i += 1
    }
  }
  return out
}

// Exports used by tests to drive the handler directly (without needing
// a socket) — the security tests want to simulate different remoteAddress.
export const _internal = {
  makeHandler,
  isLocalRequest,
  safeCartPath,
  safeCartPathWithSubdir,
  safeResolveCartDir,
  listCarts,
  readCartFile,
}

export default installHttpServe
