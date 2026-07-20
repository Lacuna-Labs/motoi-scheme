// tui/themes.js — Motoi theme loader.
//
// Doctrine (Alfred, 2026-07-20): "Motoi is Sakura's dad. Two themes
// ship: Sakura (default, soft blossom) and Hacker (80s green terminal).
// People who don't like pink can flip. Users can define their own."
//
// Themes are line-delimited s-expressions (SLAT) — see
// themes/sakura.slat for the schema. Each theme file declares a set
// of NAMED COLORS (RGB triples) and a set of ROLES (semantic → color
// name). The TUI paints against roles; roles resolve to colors; colors
// resolve to RGBs the palette module renders as ANSI.
//
// Resolution order for loadTheme(name):
//   1. ~/motoi/themes/<name>.slat          (user override)
//   2. <repo>/themes/<name>.slat           (shipped)
//   3. throw with a clear "unknown theme" error
//
// On first run — if ~/motoi/themes/ doesn't exist — the two shipped
// themes are copied there so users have starting points to edit.

import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { slatLoads, SlatValue } from '../bindings/js/slat.js'

// ── paths ─────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const SHIPPED_THEMES_DIR = resolve(__dirname, '..', 'themes')
const USER_THEMES_DIR    = join(homedir(), 'motoi', 'themes')

// ── fallback (used when no theme file loads) ──────────────────────
// Every role we know how to paint has an entry, so the TUI can boot
// even against a corrupt user theme. Values mirror the Sakura defaults.
const FALLBACK_ROLES = Object.freeze({
  bg: 'pearl', bgPanel: 'pearlLight', bgHover: 'pearlShadow',
  fg: 'fg', fgDim: 'fgDim',
  border: 'cedar', borderDim: 'cedarDark',
  focus: 'pink',
  accent: 'mintDark',
  primary: 'pink', primaryDark: 'pinkDark',
  secondary: 'mint', secondaryDark: 'mintDark',
  tertiary: 'cedar', tertiaryDark: 'cedarDark',
  danger: 'pinkDark', warning: 'gold', success: 'mintDark',
  muted: 'creamDark',
  prompt: 'pinkDark', cursor: 'cedarDark', selection: 'pink',
  stripe1: 'pink', stripe2: 'mint', stripe3: 'cedar',
  statusBar: 'mint', statusInk: 'cedarDark',
  titleBar: 'pearl', titleInk: 'cedarDark',
  codeParen: 'cedar', codeString: 'pinkDark', codeComment: 'mintDark', codeIdent: 'fg',
  ghost: 'pinkDark',
  splashTree: 'pink', splashLeaves: 'mint', splashTrunk: 'cedar',
  splashTitle: 'pinkDark', splashHint: 'mintDark', splashBlossom: 'pink',
})

// ── parsing helpers ───────────────────────────────────────────────
// slatLoads returns an object shaped like:
//   { _form: 'color', name: SlatValue('keyword','name'), ... }
// or in some paths a canonical form with keyword-keys folded in. The
// keys we care about are :name, :rgb, :color, :aesthetic. RGB comes in
// as an array of numbers because it's a positional list.

function asString(v) {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (v instanceof SlatValue) return String(v.value)
  return String(v)
}

function asRgb(v) {
  if (!Array.isArray(v)) return null
  if (v.length !== 3) return null
  const r = v[0] | 0, g = v[1] | 0, b = v[2] | 0
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null
  return [Math.max(0, Math.min(255, r)),
          Math.max(0, Math.min(255, g)),
          Math.max(0, Math.min(255, b))]
}

function parseThemeSource(src) {
  const forms = slatLoads(src)
  const list = Array.isArray(forms) ? forms : [forms]
  const colors = {}
  const roles = {}
  let name = null
  let aesthetic = null
  for (const f of list) {
    if (!f || typeof f !== 'object') continue
    const head = f._form
    if (head === 'theme') {
      name = asString(f.name) || name
      aesthetic = asString(f.aesthetic) || aesthetic
    } else if (head === 'color') {
      const cn = asString(f.name)
      const rgb = asRgb(f.rgb)
      if (cn && rgb) colors[cn] = rgb
    } else if (head === 'role') {
      const rn = asString(f.name)
      const cn = asString(f.color)
      if (rn && cn) roles[rn] = cn
    }
  }
  return { name, aesthetic, colors, roles }
}

// ── first-run seeding ─────────────────────────────────────────────
// Copy shipped themes into ~/motoi/themes/ on first run so users have
// files to edit. Silent-idempotent: never overwrites, never throws.
function seedUserThemesIfMissing() {
  try {
    if (existsSync(USER_THEMES_DIR)) return
    mkdirSync(USER_THEMES_DIR, { recursive: true })
    // Copy every *.slat file we ship.
    if (!existsSync(SHIPPED_THEMES_DIR)) return
    for (const f of readdirSync(SHIPPED_THEMES_DIR)) {
      if (!f.endsWith('.slat')) continue
      const src = join(SHIPPED_THEMES_DIR, f)
      const dst = join(USER_THEMES_DIR, f)
      if (existsSync(dst)) continue
      try { copyFileSync(src, dst) } catch { /* soft-fail */ }
    }
  } catch { /* soft-fail — themes still work from shipped dir */ }
}

// ── public API ────────────────────────────────────────────────────

/**
 * List every theme available. Returns names (without `.slat`) from
 * user themes + shipped themes, deduplicated.
 */
export function listThemes() {
  const set = new Set()
  const scan = (dir) => {
    try {
      if (!existsSync(dir)) return
      for (const f of readdirSync(dir)) {
        if (f.endsWith('.slat')) set.add(f.slice(0, -5))
      }
    } catch { /* ignore */ }
  }
  scan(USER_THEMES_DIR)
  scan(SHIPPED_THEMES_DIR)
  return [...set].sort()
}

/**
 * Load a theme by name. Checks the user dir first, then falls back to
 * shipped. Returns a theme object with `.roles` (role → RGB triple),
 * `.colors` (name → RGB triple), `.name`, `.aesthetic`, and `.roleColor`
 * (role → color-name string, useful for the tier-based Screen API).
 *
 * On any load failure, returns a Sakura-shaped fallback so callers can
 * always paint something.
 */
export function loadTheme(name) {
  const themeName = String(name || 'sakura').toLowerCase()
  // Seed user dir on the first loadTheme call — cheap check, silent
  // when already seeded. This means the first `motoi tui` a user runs
  // populates ~/motoi/themes/ so `motoi tui --theme mine` works once
  // they've written mine.slat.
  seedUserThemesIfMissing()

  const candidates = [
    join(USER_THEMES_DIR, themeName + '.slat'),
    join(SHIPPED_THEMES_DIR, themeName + '.slat'),
  ]
  let src = null
  let path = null
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        src = readFileSync(p, 'utf8')
        path = p
        break
      }
    } catch { /* try next */ }
  }
  if (src == null) {
    // Unknown theme — fall back to Sakura shipped. If even that
    // fails, use the hardcoded fallback role map.
    if (themeName !== 'sakura') {
      try { return loadTheme('sakura') } catch { /* fall through */ }
    }
    return {
      name: 'sakura',
      aesthetic: 'cherry blossom · soft · warm',
      colors: {},
      roles: { ...FALLBACK_ROLES },      // role → color name
      roleColor: { ...FALLBACK_ROLES },  // alias
      path: null,
    }
  }

  const parsed = parseThemeSource(src)
  // Merge fallback roles under any gaps in the theme so panel code
  // never gets an undefined tier back.
  const roles = { ...FALLBACK_ROLES, ...parsed.roles }
  return {
    name: parsed.name || themeName,
    aesthetic: parsed.aesthetic || '',
    colors: parsed.colors,
    roles,           // role → color-name string (what the Screen paints with)
    roleColor: roles, // alias for symmetry with color-lookup helpers
    path,
  }
}

/**
 * Pick the active theme based on:
 *   opts.theme  (explicit)  →  MOTOI_THEME env  →  opts.hacker → 'hacker'  →  'sakura'
 */
export function activeTheme(opts = {}) {
  const explicit = opts.theme
  if (explicit) return loadTheme(explicit)
  const env = process.env.MOTOI_THEME
  if (env) return loadTheme(env)
  if (opts.hacker) return loadTheme('hacker')
  return loadTheme('sakura')
}

/**
 * Resolve a role name to an RGB triple through a theme + palette. The
 * palette gives RGBs for legacy tier names (pink, mint, cedar, …); the
 * theme adds its own colors under `theme.colors`. This helper checks
 * theme.colors first, then falls through to a supplied palette map.
 */
export function resolveRoleToRgb(theme, role, paletteMap) {
  const colorName = theme.roles[role] || FALLBACK_ROLES[role] || role
  if (theme.colors && theme.colors[colorName]) return theme.colors[colorName]
  if (paletteMap && paletteMap[colorName]) return paletteMap[colorName]
  return null
}

// Test seam — clear the seed check by exposing the paths.
export const _paths = { SHIPPED_THEMES_DIR, USER_THEMES_DIR }
