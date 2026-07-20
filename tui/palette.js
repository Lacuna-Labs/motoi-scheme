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
  cream:      [245, 236, 217],  // #f5ecd9 — Motoi's warm baseline
  creamDark:  [191, 180, 151],  // #bfb497
  // Blossoms — Motoi's pink family (softer than Sakura's blossom slot)
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

  // ── Sakura's 16 blossom-named colors (2026-07-20) ─────────────────
  // Alfred: "Motoi is Sakura's dad. Aesthetically continuous." These
  // are the exact RGBs Sakura's fantasy console renders with, exposed
  // by name so any theme or user snippet can address them directly.
  // See sakura-scheme/src/lib/graphics/named-colors.js for provenance.
  black:      [ 20,  18,  22],  //  0 ink, slight warm bias
  white:      [252, 248, 244],  //  1 off-white, paper feel
  cherry:     [216,  32,  84],  //  2 signature deep pink
  petal:      [255, 183, 197],  //  3 soft pink — Sakura's primary
  'tea-rose': [246, 194, 194],  //  4 warmer pink toward mauve
  gold:       [232, 176,  70],  //  6 luxurious yellow
  amber:      [206, 138,  57],  //  7 warm dark yellow
  sage:       [174, 199, 155],  //  8 soft green
  moss:       [ 94, 130,  92],  //  9 grounded green
  plum:       [117,  70, 128],  // 10 muted violet
  lavender:   [204, 174, 219],  // 11 soft violet
  mist:       [200, 220, 232],  // 12 pale cool
  cobalt:     [ 58, 100, 156],  // 13 deep cool
  coral:      [239, 121,  93],  // 14 warm accent
  terracotta: [180,  93,  57],  // 15 earthy warm

  // Ink is the Sakura-canonical name for the "fg" text color.
  ink:        [ 58,  36,  24],  // = fg
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
  // Sakura blossom names — 256-color spot-picks against xterm chart.
  black:         16,
  white:        231,
  cherry:       161,  // ~#d70087
  petal:        217,  // ~#ffafaf
  'tea-rose':   217,
  gold:         178,  // ~#d7af00
  amber:        130,  // ~#af5f00
  sage:         151,  // ~#afd7af
  moss:          65,  // ~#5f875f
  plum:          97,  // ~#875faf
  lavender:     183,  // ~#d7afff
  mist:         195,  // ~#d7ffff
  cobalt:        26,  // ~#005fd7
  coral:        209,  // ~#ff875f
  terracotta:   130,  // ~#af5f00
  ink:           52,
}

// ── nearest-xterm-256 for arbitrary RGB (used by theme overrides) ─
// Themes can declare RGB triples for colors we don't have a
// pre-picked 256 slot for. Map to the 6x6x6 color cube for chromatic
// colors and the 24-step gray ramp for near-grayscale. This is the
// same heuristic paintCanvas uses for framebuffer sampling.
export function rgbToXterm256(rgb) {
  const r = rgb[0] | 0, g = rgb[1] | 0, b = rgb[2] | 0
  if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8) {
    const gray = Math.round((r + g + b) / 3)
    if (gray < 8)   return 16
    if (gray > 248) return 231
    return 232 + Math.min(23, Math.max(0, Math.round((gray - 8) / 10)))
  }
  const c = (v) => Math.min(5, Math.max(0, Math.round(v / 51)))
  return 16 + 36 * c(r) + 6 * c(g) + c(b)
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
 * makePalette(mode, opts?) → { fg(tier), bg(tier), reset, bold, dim, wrap(s, tier) }.
 * When mode is 'none' every color function returns the empty string, so
 * callers can concatenate freely without special-casing.
 *
 * opts.theme (optional): a theme object from tui/themes.js. When
 * provided, tier lookups resolve in this order:
 *   1. theme.roles[tier] — the role → color-name mapping. If present,
 *      the tier is interpreted as a role and rewritten to the color
 *      name it points at.
 *   2. theme.colors[colorName] — the theme's own color palette.
 *   3. SAKURA[colorName] — Motoi's built-in colors (legacy fallback).
 *
 * This gives the Screen paint layer a single-string API (fg('pink'),
 * bg('pearlLight')) while letting themes remap those names to any
 * RGB they like. Panel code paints roles by tier name; the theme
 * decides what "pink" means in the current world.
 */
export function makePalette(mode = detectColor(), opts = {}) {
  const noop = () => ''
  if (mode === 'none') {
    return {
      mode, fg: noop, bg: noop, reset: '', bold: '', dim: '', rev: '',
      wrap: (s) => s,
      theme: opts.theme || null,
    }
  }
  const theme = opts.theme || null
  const truecolor = mode === 'truecolor'

  // Resolve a tier name to an RGB triple through the theme + SAKURA.
  const rgbFor = (tier) => {
    // If theme has a role by this name, chase to its color name.
    let name = tier
    if (theme && theme.roles && theme.roles[name]) name = theme.roles[name]
    // Prefer theme.colors — themes can override "pink" to mean green.
    if (theme && theme.colors && theme.colors[name]) return theme.colors[name]
    // Fall back to SAKURA built-ins.
    if (SAKURA[name]) return SAKURA[name]
    // Last-ditch: the ink/fg default so the paint isn't invisible.
    return SAKURA.fg
  }

  // 256-color fallback path: theme overrides go through rgbToXterm256;
  // built-in tiers stick with their spot-picked SAKURA_256 slot.
  const slotFor = (tier) => {
    let name = tier
    if (theme && theme.roles && theme.roles[name]) name = theme.roles[name]
    if (theme && theme.colors && theme.colors[name]) return rgbToXterm256(theme.colors[name])
    if (SAKURA_256[name] != null) return SAKURA_256[name]
    if (SAKURA[name]) return rgbToXterm256(SAKURA[name])
    return SAKURA_256.fg
  }

  const tierFg = (tier) => (truecolor ? fg24(rgbFor(tier)) : fg256(slotFor(tier)))
  const tierBg = (tier) => (truecolor ? bg24(rgbFor(tier)) : bg256(slotFor(tier)))
  return {
    mode,
    fg: tierFg,
    bg: tierBg,
    reset: RESET, bold: BOLD, dim: DIM, rev: REV,
    wrap: (s, tier) => tierFg(tier) + s + RESET,
    theme,
    // Expose the RGB resolver for callers that need raw color (splash,
    // direct-write paint paths). Falls through the same theme chain.
    rgbFor,
  }
}

// ── narrow ANSI stripper for logging ─────────────────────────────────
const STRIP_RE = /\x1b\[[0-9;?]*[A-Za-z]/g
export function stripAnsi(s) { return String(s || '').replace(STRIP_RE, '') }

// ── stripe glyph (mirror of REPL banner) ─────────────────────────────
export const STRIPE_CHAR = '▂'
