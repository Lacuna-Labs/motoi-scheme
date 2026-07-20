// tui/palette.js — Sakura Cherry Tree palette for Motoi's TUI.
//
// Doctrine (Alfred, 2026-07-19): "Use Sakura's color palette. So it's
// all soft colors. Use it for our colors."
//
// The web IDE reads --motoi-cream / --motoi-pink / --motoi-mint /
// --motoi-cedar / --motoi-pearl from site/ide-assets/ide.css. This
// module is the terminal-side twin — same six tiers, mapped to ANSI
// truecolor (24-bit) with a 256-color fallback for older terminals
// and a plain-text degrade for NO_COLOR / TERM=dumb / non-TTY.
//
// The metaphor: Sakura's cherry tree. Pink (blossoms), mint (leaves),
// cedar (trunk + earth), cream + pearl (warm baseline + iridescent
// off-white for panels). Every hue is soft. Nothing here is neon.
//
// Detection mirrors src/repl.js detectColor() so the whole stack picks
// the same tier per session.

const ESC = '\x1b['
export const RESET = ESC + '0m'
export const BOLD  = ESC + '1m'
export const DIM   = ESC + '2m'
export const REV   = ESC + '7m'

// ── Sakura Cherry Tree RGB tiers (mirror of ide.css) ─────────────────
export const SAKURA = {
  // Base cream + variant
  cream:      [245, 236, 217],  // #f5ecd9 — warm baseline
  creamDark:  [191, 180, 151],  // #bfb497
  // Blossoms
  pink:       [244, 160, 181],  // #f4a0b5 — Sakura pink (canonical)
  pinkDark:   [168,  84, 108],  // #a8546c
  // Leaves
  mint:       [159, 227, 197],  // #9fe3c5 — soft mint
  mintDark:   [ 61, 157, 107],  // #3d9d6b
  // Trunk + earth
  cedar:      [163, 113,  82],  // #a37152 — warm wood-brown
  cedarDark:  [107,  74,  52],  // #6b4a34
  // Pearl (the "white" of the brand)
  pearl:        [244, 236, 220],  // #f4ecdc — main page
  pearlLight:   [251, 245, 233],  // #fbf5e9 — panels
  pearlShadow:  [235, 224, 202],  // #ebe0ca — hover / seams
  // Text
  fg:         [ 58,  36,  24],  // #3a2418 — deep cedar-brown text
  fgDim:      [107,  74,  52],  // cedar-dark for dim
  border:     [230, 220, 203],  // #e6dccb — pale cream border
  danger:     [168,  84, 108],  // pink-dark
  // Legacy semantic aliases so panel code doesn't have to know it's
  // been renamed. Only the identifiers change; the visual role stays.
  bg:         [244, 236, 220],  // = pearl
  bgPanel:    [251, 245, 233],  // = pearl-light
  // The old "lilac"/"magic" identifiers from the previous palette
  // draft are aliased to mint/cedar respectively so old panel code
  // paints Sakura colors even without a search-and-replace pass.
  lilac:      [159, 227, 197],  // = mint
  lilacDark:  [ 61, 157, 107],  // = mint-dark
  magic:      [163, 113,  82],  // = cedar
  magicDark:  [107,  74,  52],  // = cedar-dark
}

// ── 256-color approximations (nearest xterm slots) ───────────────────
// Spot-checked against the standard xterm-256 chart. Any modern
// terminal on Alfred's machines (macOS Terminal, iTerm2, kitty,
// wezterm, alacritty) will pick truecolor; these are the fallback for
// tmux without passthrough and CI machines with TERM=xterm-256color.
export const SAKURA_256 = {
  cream:        230,  // ~#ffffd7 — light warm cream
  creamDark:    187,  // warm khaki
  pink:         218,  // ~#ffafd7 — soft pink
  pinkDark:     132,  // ~#af5f87
  mint:         157,  // ~#afffd7 — light mint
  mintDark:      78,  // ~#5fd787 — leaf green
  cedar:        137,  // ~#af875f — warm cedar
  cedarDark:     94,  // ~#875f00 — deeper cedar
  pearl:        230,  // page ≈ cream
  pearlLight:   231,  // near-white
  pearlShadow:  187,  // warm shadow
  fg:            52,  // ~#5f0000 — deep brown ink (readable on cream)
  fgDim:         94,
  border:       223,  // pale cream-warm
  danger:       132,
  bg:           230,
  bgPanel:      231,
  // Legacy aliases
  lilac:        157,
  lilacDark:     78,
  magic:        137,
  magicDark:     94,
}

// ── color mode detection ─────────────────────────────────────────────
// Mirrors src/repl.js detectColor(). Returns 'none' | '256' | 'truecolor'.
// Honours NO_COLOR (no-color.org) + FORCE_COLOR.
export function detectColor(stream = process.stdout) {
  if (process.env.NO_COLOR) return 'none'
  if (process.env.FORCE_COLOR === '3') return 'truecolor'
  if (process.env.FORCE_COLOR === '2') return '256'
  if (process.env.FORCE_COLOR === '1') return '256'
  if (process.env.FORCE_COLOR === '0') return 'none'
  if (!stream || stream.isTTY !== true) return 'none'
  const colorterm = String(process.env.COLORTERM || '').toLowerCase()
  if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor'
  const term = String(process.env.TERM || '').toLowerCase()
  if (!term || term === 'dumb') return 'none'
  if (term.includes('256color')) return '256'
  return '256'
}

// ── ANSI builders ─────────────────────────────────────────────────────
function fg24(rgb) { return ESC + '38;2;' + rgb[0] + ';' + rgb[1] + ';' + rgb[2] + 'm' }
function bg24(rgb) { return ESC + '48;2;' + rgb[0] + ';' + rgb[1] + ';' + rgb[2] + 'm' }
function fg256(n)  { return ESC + '38;5;' + n + 'm' }
function bg256(n)  { return ESC + '48;5;' + n + 'm' }

/**
 * makePalette(mode) → { fg(tier), bg(tier), reset, bold, dim, wrap(s, tier) }.
 * When mode is 'none' every color function returns the empty string, so
 * callers can concatenate freely without special-casing.
 */
export function makePalette(mode = detectColor()) {
  const noop = () => ''
  if (mode === 'none') {
    return {
      mode, fg: noop, bg: noop, reset: '', bold: '', dim: '', rev: '',
      wrap: (s) => s,
    }
  }
  const rgb = mode === 'truecolor'
  const tierFg = (tier) => (rgb ? fg24(SAKURA[tier]) : fg256(SAKURA_256[tier]))
  const tierBg = (tier) => (rgb ? bg24(SAKURA[tier]) : bg256(SAKURA_256[tier]))
  return {
    mode,
    fg: tierFg,
    bg: tierBg,
    reset: RESET, bold: BOLD, dim: DIM, rev: REV,
    wrap: (s, tier) => tierFg(tier) + s + RESET,
  }
}

// ── narrow ANSI stripper for logging ─────────────────────────────────
const STRIP_RE = /\x1b\[[0-9;?]*[A-Za-z]/g
export function stripAnsi(s) { return String(s || '').replace(STRIP_RE, '') }

// ── stripe glyph (mirror of REPL banner) ─────────────────────────────
export const STRIPE_CHAR = '▂'
